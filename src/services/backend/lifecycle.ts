/**
 * Backend lifecycle manager — starts/stops the UDS server and wires
 * inbound messages (UserInput, ToolApproval) into the query engine.
 *
 * Usage:
 *   const backend = await startBackend({ getAppState, onUserInput, onToolApproval })
 *   // ... later ...
 *   await backend.shutdown()
 *
 * Design:
 * - UDS server is optional: if start fails, the app continues without it
 * - VIBE_SENSEI_SOCK env var is exported for child process discovery
 * - Graceful shutdown: drain pending messages (max 2s), close socket, unlink
 * - StateSync: emits full state snapshot when a new client connects
 */

import { UdsServer, getDefaultSocketPath } from './uds-server.js'
import { getBackendEventStream } from './event-stream.js'
import type { InboundMessage, UserInputMessage, ToolApprovalMessage } from './uds-server.js'
import type { StateSyncEvent } from './types.js'

// ─── Types ────────────────────────────────────────────────────────────────

export interface BackendHandle {
  /** The UDS socket path clients connect to. */
  socketPath: string
  /** Gracefully shutdown the backend server. */
  shutdown: () => Promise<void>
  /** Whether the backend started successfully. */
  active: boolean
}

export interface BackendConfig {
  /** Return current application state snapshot for StateSync events. */
  getAppState?: () => Record<string, unknown>
  /** Handler for UserInput messages from TUI clients. */
  onUserInput?: (text: string) => void
  /** Handler for ToolApproval messages from TUI clients. */
  onToolApproval?: (id: string, allow: boolean) => void
  /** Custom socket path (defaults to VIBE_SENSEI_SOCK or /tmp/vibe-sensei-{pid}.sock). */
  socketPath?: string
}

// ─── Singleton Guard ──────────────────────────────────────────────────────

let activeBackend: BackendHandle | null = null

// ─── Lifecycle Functions ──────────────────────────────────────────────────

/**
 * Start the UDS backend server.
 *
 * Creates a UdsServer, subscribes to BackendEventStream, and wires inbound
 * messages to the provided handlers. Exports VIBE_SENSEI_SOCK for child
 * process discovery.
 *
 * If the server fails to start, returns a no-op handle with active=false
 * so the caller can continue without the backend.
 */
export async function startBackend(
  config: BackendConfig = {},
): Promise<BackendHandle> {
  // Prevent double-start
  if (activeBackend?.active) {
    return activeBackend
  }

  const socketPath = config.socketPath ?? getDefaultSocketPath()
  const server = new UdsServer(socketPath)

  try {
    await server.start()
  } catch (err) {
    // Backend is optional — log and return inactive handle
    const msg = err instanceof Error ? err.message : String(err)
    process.stderr.write(`[backend] UDS server failed to start: ${msg}\n`)
    return createInactiveHandle(socketPath)
  }

  // Export socket path for child processes (Rust TUI discovery)
  process.env.VIBE_SENSEI_SOCK = socketPath

  // Wire inbound message routing
  server.setInboundHandler((msg: InboundMessage, _clientId: number) => {
    routeInboundMessage(msg, config)
  })

  // Wire StateSync on new client connect by listening to client count changes.
  // The UDS server emits data on new connections; we piggyback on the heartbeat
  // cycle — the first heartbeat a client receives is ~5s after connect.
  // For immediate StateSync, we broadcast to all clients when the state getter
  // is available. The BackendEventStream StateSync handler in the UDS server
  // broadcasts to all connected clients automatically.
  if (config.getAppState) {
    setupStateSyncOnConnect(server, config.getAppState)
  }

  // Register SIGTERM handler for graceful shutdown
  const sigTermHandler = () => {
    void gracefulShutdown(server, socketPath)
  }
  process.on('SIGTERM', sigTermHandler)

  const handle: BackendHandle = {
    socketPath,
    active: true,
    shutdown: async () => {
      process.off('SIGTERM', sigTermHandler)
      await gracefulShutdown(server, socketPath)
      activeBackend = null
    },
  }

  activeBackend = handle
  return handle
}

/**
 * Stop the active backend server (if running).
 * Convenience wrapper around the handle's shutdown method.
 */
export async function stopBackend(): Promise<void> {
  if (activeBackend?.active) {
    await activeBackend.shutdown()
  }
  activeBackend = null
}

/**
 * Get the currently active backend handle, if any.
 */
export function getActiveBackend(): BackendHandle | null {
  return activeBackend
}

// ─── Internals ────────────────────────────────────────────────────────────

/** Route an inbound UDS message to the appropriate handler. */
function routeInboundMessage(
  msg: InboundMessage,
  config: BackendConfig,
): void {
  switch (msg.type) {
    case 'UserInput': {
      const userMsg = msg as UserInputMessage
      if (config.onUserInput && userMsg.text) {
        config.onUserInput(userMsg.text)
      }
      break
    }
    case 'ToolApproval': {
      const approvalMsg = msg as ToolApprovalMessage
      if (config.onToolApproval && approvalMsg.id) {
        config.onToolApproval(approvalMsg.id, approvalMsg.allow)
      }
      break
    }
    case 'HeartbeatAck':
      // Handled internally by UdsServer
      break
    default:
      // Unknown message type — ignore
      break
  }
}

/**
 * Set up StateSync emission when clients connect.
 *
 * Polls the server's client count and emits a StateSync event when a new
 * client is detected. This is lightweight: checks every 2 seconds.
 */
function setupStateSyncOnConnect(
  server: UdsServer,
  getAppState: () => Record<string, unknown>,
): void {
  let lastClientCount = 0

  const checkInterval = setInterval(() => {
    const currentCount = server.getClientCount()
    if (currentCount > lastClientCount && currentCount > 0) {
      // New client connected — send state snapshot
      const stream = getBackendEventStream()
      const syncEvent: StateSyncEvent = {
        type: 'StateSync',
        fullState: getAppState(),
        timestamp: Date.now(),
      }
      stream.emitEvent(syncEvent)
    }
    lastClientCount = currentCount
  }, 2000)

  // Ensure the interval doesn't prevent process exit
  if (checkInterval.unref) {
    checkInterval.unref()
  }
}

/**
 * Graceful shutdown: drain pending messages (max 2s timeout),
 * then close server and unlink socket.
 */
async function gracefulShutdown(
  server: UdsServer,
  _socketPath: string,
): Promise<void> {
  // Give pending writes up to 2 seconds to drain
  const drainPromise = new Promise<void>((resolve) => {
    setTimeout(resolve, 2000)
  })

  try {
    await Promise.race([server.stop(), drainPromise])
  } catch {
    // Shutdown errors are non-fatal
  }

  // Clean up env var
  delete process.env.VIBE_SENSEI_SOCK
}

/** Create an inactive handle for when the server fails to start. */
function createInactiveHandle(socketPath: string): BackendHandle {
  return {
    socketPath,
    active: false,
    shutdown: async () => {
      // No-op
    },
  }
}
