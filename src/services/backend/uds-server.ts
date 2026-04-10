/**
 * UdsServer — Unix Domain Socket server for Rust TUI clients.
 *
 * Subscribes to BackendEventStream and broadcasts MessagePack-serialized
 * events to all connected clients using length-prefixed framing.
 *
 * Protocol:
 * - Server → Client: BackendEvent frames + Heartbeat frames (every 5s)
 * - Client → Server: UserInput, ToolApproval, HeartbeatAck frames
 * - Socket path: /tmp/vibe-sensei-{pid}.sock (env override: VIBE_SENSEI_SOCK)
 * - Max 3 concurrent clients
 * - Heartbeat timeout: 10s without HeartbeatAck → disconnect
 */

import * as net from 'node:net'
import * as fs from 'node:fs'
import type { BackendEvent } from './types.js'
import { getBackendEventStream } from './event-stream.js'
import { serializeFrame, FrameDecoder } from './msgpack.js'

// ─── Constants ─────────────────────────────────────────────────────────────

const MAX_CLIENTS = 3
const HEARTBEAT_INTERVAL_MS = 5_000
const HEARTBEAT_TIMEOUT_MS = 10_000

// ─── Inbound Message Types ─────────────────────────────────────────────────

export type UserInputMessage = {
  type: 'UserInput'
  text: string
}

export type ToolApprovalMessage = {
  type: 'ToolApproval'
  id: string
  allow: boolean
}

export type HeartbeatAckMessage = {
  type: 'HeartbeatAck'
}

export type InboundMessage =
  | UserInputMessage
  | ToolApprovalMessage
  | HeartbeatAckMessage

// ─── Client State ──────────────────────────────────────────────────────────

interface ClientState {
  socket: net.Socket
  decoder: FrameDecoder
  heartbeatTimer: ReturnType<typeof setInterval> | null
  lastAck: number
  id: number
}

// ─── UdsServer ─────────────────────────────────────────────────────────────

export class UdsServer {
  private server: net.Server | null = null
  private clients: Map<number, ClientState> = new Map()
  private nextClientId = 1
  private socketPath: string
  private eventHandler: ((event: BackendEvent) => void) | null = null
  private onInboundMessage:
    | ((msg: InboundMessage, clientId: number) => void)
    | null = null

  constructor(socketPath?: string) {
    this.socketPath = socketPath ?? getDefaultSocketPath()
  }

  /** Get the socket path this server is using. */
  getSocketPath(): string {
    return this.socketPath
  }

  /** Get count of currently connected clients. */
  getClientCount(): number {
    return this.clients.size
  }

  /**
   * Register a handler for inbound messages from clients.
   * Only one handler at a time. Sprint 127 will wire this into QueryEngine.
   */
  setInboundHandler(
    handler: (msg: InboundMessage, clientId: number) => void,
  ): void {
    this.onInboundMessage = handler
  }

  /**
   * Start the UDS server.
   * - Removes stale socket file if present
   * - Begins listening for connections
   * - Subscribes to BackendEventStream for broadcast
   *
   * SECURITY (Sprint 144 / v0.2.1-sensei): the socket file is created with
   * mode 0600 (owner-only) atomically by lowering the process umask to
   * 0o077 before listen(). After listen() the mode and ownership are
   * verified explicitly. If verification fails, the server refuses to
   * start. This prevents any other local process running under a
   * different UID from connecting and injecting UserInput / ToolApproval
   * messages into the trading layer (an in-kernel filesystem permission
   * check rejects the connect() call before our handleConnection ever
   * fires). Same mechanism Postgres / MySQL / Docker use for their
   * unix sockets — no FFI / SO_PEERCRED needed.
   */
  async start(): Promise<void> {
    if (this.server) {
      throw new Error('UdsServer already started')
    }

    // Remove stale socket file
    cleanupSocketFile(this.socketPath)

    // Subscribe to BackendEventStream
    const stream = getBackendEventStream()
    this.eventHandler = (event: BackendEvent) => {
      this.broadcast(event)
    }
    stream.onAnyEvent(this.eventHandler)

    // Create and start server
    return new Promise<void>((resolve, reject) => {
      const server = net.createServer((socket) => {
        this.handleConnection(socket)
      })

      server.on('error', (err) => {
        if (!this.server) {
          reject(err)
        }
        // After startup, server errors are non-fatal — log and continue
      })

      // SECURITY: lower umask BEFORE listen() so the socket file is
      // created atomically with mode 0600. This is the only race-free
      // way — there is no listen({ mode }) option on Node's net module.
      const supportsUid = typeof process.getuid === 'function'
      let oldUmask: number | null = null
      if (supportsUid) {
        oldUmask = process.umask(0o077)
      }

      const restoreUmask = () => {
        if (oldUmask !== null) {
          process.umask(oldUmask)
          oldUmask = null
        }
      }

      const failStartup = (err: Error) => {
        restoreUmask()
        try {
          server.close()
        } catch {
          // best-effort
        }
        cleanupSocketFile(this.socketPath)
        reject(err)
      }

      server.listen(this.socketPath, () => {
        // Restore umask immediately, before any other work, so subsequent
        // file creation in the process is unaffected by our temporary
        // restriction. We still verify the socket file below.
        restoreUmask()

        if (supportsUid) {
          try {
            // Defense in depth: explicit chmod 0600 (in case the umask
            // was somehow not applied, e.g. weird platform).
            fs.chmodSync(this.socketPath, 0o600)

            // Verify the socket file is owned by us and has restrictive
            // permissions. Refuse to start if either is wrong — better
            // to crash loudly than expose the trading layer.
            const stat = fs.statSync(this.socketPath)
            const expectedUid = process.getuid!()
            if (stat.uid !== expectedUid) {
              failStartup(
                new Error(
                  `UdsServer refusing to start: socket file owner mismatch ` +
                    `(expected uid=${expectedUid}, got uid=${stat.uid}). ` +
                    `Possible race condition or filesystem-level attack.`,
                ),
              )
              return
            }
            const mode = stat.mode & 0o777
            if (mode !== 0o600) {
              failStartup(
                new Error(
                  `UdsServer refusing to start: socket file mode is ` +
                    `0${mode.toString(8)}, expected 0600. Other local ` +
                    `users may be able to connect.`,
                ),
              )
              return
            }
          } catch (err) {
            failStartup(
              err instanceof Error
                ? err
                : new Error(`UdsServer permission check failed: ${String(err)}`),
            )
            return
          }
        }

        this.server = server
        this.registerCleanupHandlers()
        resolve()
      })
    })
  }

  /**
   * Stop the UDS server gracefully.
   * - Disconnects all clients
   * - Closes the server socket
   * - Unlinks the socket file
   * - Unsubscribes from BackendEventStream
   */
  async stop(): Promise<void> {
    // Unsubscribe from event stream
    if (this.eventHandler) {
      const stream = getBackendEventStream()
      stream.offAnyEvent(this.eventHandler)
      this.eventHandler = null
    }

    // Disconnect all clients
    for (const [, client] of this.clients) {
      this.disconnectClient(client, 'server shutdown')
    }
    this.clients.clear()

    // Close server
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => resolve())
      })
      this.server = null
    }

    // Clean up socket file
    cleanupSocketFile(this.socketPath)
  }

  // ─── Connection Handling ───────────────────────────────────────────────

  private handleConnection(socket: net.Socket): void {
    // Enforce max client limit
    if (this.clients.size >= MAX_CLIENTS) {
      try {
        const rejectFrame = serializeFrame({
          type: 'Error',
          message: 'Max clients reached',
        })
        socket.write(rejectFrame)
      } catch {
        // Best-effort rejection message
      }
      socket.destroy()
      return
    }

    const clientId = this.nextClientId++
    const client: ClientState = {
      socket,
      decoder: new FrameDecoder(),
      heartbeatTimer: null,
      lastAck: Date.now(),
      id: clientId,
    }

    this.clients.set(clientId, client)

    // Start heartbeat for this client
    client.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat(client)
    }, HEARTBEAT_INTERVAL_MS)

    // Handle incoming data
    socket.on('data', (chunk: Buffer) => {
      this.handleClientData(client, chunk)
    })

    // Handle client disconnect
    socket.on('close', () => {
      this.removeClient(clientId)
    })

    // Handle client errors (never crash)
    socket.on('error', () => {
      this.removeClient(clientId)
    })
  }

  private handleClientData(client: ClientState, chunk: Buffer): void {
    let messages: InboundMessage[]
    try {
      messages = client.decoder.feed<InboundMessage>(chunk)
    } catch {
      // Corrupt frame — disconnect client
      this.disconnectClient(client, 'corrupt frame')
      return
    }

    for (const msg of messages) {
      try {
        this.processInboundMessage(client, msg)
      } catch {
        // Individual message processing errors are non-fatal
      }
    }
  }

  private processInboundMessage(
    client: ClientState,
    msg: InboundMessage,
  ): void {
    if (!msg || typeof msg !== 'object' || !('type' in msg)) {
      return
    }

    switch (msg.type) {
      case 'HeartbeatAck':
        client.lastAck = Date.now()
        break
      case 'UserInput':
      case 'ToolApproval':
        if (this.onInboundMessage) {
          this.onInboundMessage(msg, client.id)
        }
        break
      default:
        // Unknown message type — ignore
        break
    }
  }

  // ─── Heartbeat ─────────────────────────────────────────────────────────

  private sendHeartbeat(client: ClientState): void {
    // Check timeout first
    const elapsed = Date.now() - client.lastAck
    if (elapsed > HEARTBEAT_TIMEOUT_MS) {
      this.disconnectClient(client, 'heartbeat timeout')
      return
    }

    // Send heartbeat frame
    try {
      const frame = serializeFrame({ type: 'Heartbeat' })
      if (!client.socket.destroyed) {
        client.socket.write(frame)
      }
    } catch {
      // Write error — will be caught by socket error handler
    }
  }

  // ─── Broadcast ─────────────────────────────────────────────────────────

  /**
   * Broadcast a BackendEvent to all connected clients.
   * Serializes once, writes to all. Failed writes are silently ignored.
   */
  private broadcast(event: BackendEvent): void {
    if (this.clients.size === 0) return

    let frame: Buffer
    try {
      frame = serializeFrame(event)
    } catch {
      return // Serialization failure — skip this event
    }

    for (const [, client] of this.clients) {
      try {
        if (!client.socket.destroyed) {
          client.socket.write(frame)
        }
      } catch {
        // Write error for this client — continue broadcasting to others
      }
    }
  }

  // ─── Client Lifecycle ──────────────────────────────────────────────────

  private disconnectClient(client: ClientState, _reason: string): void {
    if (client.heartbeatTimer) {
      clearInterval(client.heartbeatTimer)
      client.heartbeatTimer = null
    }
    if (!client.socket.destroyed) {
      client.socket.destroy()
    }
    this.clients.delete(client.id)
  }

  private removeClient(clientId: number): void {
    const client = this.clients.get(clientId)
    if (client) {
      this.disconnectClient(client, 'connection closed')
    }
  }

  // ─── Process Cleanup ───────────────────────────────────────────────────

  private cleanupBound = false

  private registerCleanupHandlers(): void {
    if (this.cleanupBound) return
    this.cleanupBound = true

    const cleanup = () => {
      cleanupSocketFile(this.socketPath)
    }

    process.on('SIGTERM', cleanup)
    process.on('SIGINT', cleanup)
    process.on('exit', cleanup)
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Get the default socket path: env override or /tmp/vibe-sensei-{pid}.sock */
export function getDefaultSocketPath(): string {
  return process.env.VIBE_SENSEI_SOCK ?? `/tmp/vibe-sensei-${process.pid}.sock`
}

/** Remove a socket file if it exists. Ignores errors. */
function cleanupSocketFile(path: string): void {
  try {
    fs.unlinkSync(path)
  } catch {
    // File doesn't exist or already removed — fine
  }
}
