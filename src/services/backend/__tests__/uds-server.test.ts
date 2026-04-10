import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import * as net from 'node:net'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { UdsServer } from '../uds-server.js'
import {
  serializeFrame,
  deserializePayload,
  FrameDecoder,
  FRAME_HEADER_SIZE,
} from '../msgpack.js'
import {
  getBackendEventStream,
  resetBackendEventStream,
} from '../event-stream.js'
import type { StreamChunkEvent, BackendEvent } from '../types.js'

// ─── Test Helpers ──────────────────────────────────────────────────────────

/** Generate a unique socket path for each test to avoid collisions. */
let testCounter = 0
function testSocketPath(): string {
  testCounter++
  return path.join(
    os.tmpdir(),
    `vibe-sensei-test-${process.pid}-${testCounter}.sock`,
  )
}

/** Connect a raw client to a UDS path. */
function connectClient(sockPath: string): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const client = net.createConnection(sockPath, () => resolve(client))
    client.on('error', reject)
  })
}

/** Collect all decoded frames from a socket until it closes or timeout. */
function collectFrames<T = unknown>(
  socket: net.Socket,
  timeoutMs: number,
): Promise<T[]> {
  return new Promise((resolve) => {
    const decoder = new FrameDecoder()
    const results: T[] = []
    const timer = setTimeout(() => {
      resolve(results)
    }, timeoutMs)

    socket.on('data', (chunk: Buffer) => {
      try {
        const msgs = decoder.feed<T>(chunk)
        results.push(...msgs)
      } catch {
        // skip corrupt frames in tests
      }
    })

    socket.on('close', () => {
      clearTimeout(timer)
      resolve(results)
    })
  })
}

/** Wait for a specified number of milliseconds. */
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ─── Frame Serialization Tests ─────────────────────────────────────────────

describe('msgpack framing', () => {
  test('serializeFrame produces correct length prefix', () => {
    const frame = serializeFrame({ hello: 'world' })
    expect(frame.length).toBeGreaterThan(FRAME_HEADER_SIZE)
    const payloadLen = frame.readUInt32BE(0)
    expect(payloadLen).toBe(frame.length - FRAME_HEADER_SIZE)
  })

  test('round-trip serialize/deserialize preserves data', () => {
    const original = {
      type: 'StreamChunk',
      text: 'Hello from msgpack',
      timestamp: 1234567890,
    }
    const frame = serializeFrame(original)
    const payloadLen = frame.readUInt32BE(0)
    const payload = frame.subarray(FRAME_HEADER_SIZE, FRAME_HEADER_SIZE + payloadLen)
    const decoded = deserializePayload(payload)
    expect(decoded).toEqual(original)
  })

  test('round-trip with complex nested data', () => {
    const original = {
      type: 'BalanceUpdate',
      balances: [
        { currency: 'USDT', free: 95000.5, used: 5000, total: 100000.5 },
        { currency: 'BTC', free: 0.5, used: 0, total: 0.5 },
      ],
      timestamp: Date.now(),
    }
    const frame = serializeFrame(original)
    const payloadLen = frame.readUInt32BE(0)
    const payload = frame.subarray(FRAME_HEADER_SIZE, FRAME_HEADER_SIZE + payloadLen)
    const decoded = deserializePayload(payload)
    expect(decoded).toEqual(original)
  })

  test('FrameDecoder handles multiple messages in one chunk', () => {
    const decoder = new FrameDecoder()
    const msg1 = { type: 'A', value: 1 }
    const msg2 = { type: 'B', value: 2 }
    const combined = Buffer.concat([serializeFrame(msg1), serializeFrame(msg2)])

    const results = decoder.feed(combined)
    expect(results).toHaveLength(2)
    expect(results[0]).toEqual(msg1)
    expect(results[1]).toEqual(msg2)
  })

  test('FrameDecoder handles split chunks', () => {
    const decoder = new FrameDecoder()
    const msg = { type: 'test', data: 'split across chunks' }
    const frame = serializeFrame(msg)

    // Split the frame in the middle
    const mid = Math.floor(frame.length / 2)
    const part1 = frame.subarray(0, mid)
    const part2 = frame.subarray(mid)

    const r1 = decoder.feed(part1)
    expect(r1).toHaveLength(0) // not enough data yet

    const r2 = decoder.feed(part2)
    expect(r2).toHaveLength(1)
    expect(r2[0]).toEqual(msg)
  })

  test('FrameDecoder rejects oversized payloads', () => {
    const decoder = new FrameDecoder()
    // Craft a header claiming 32MB payload
    const header = Buffer.allocUnsafe(4)
    header.writeUInt32BE(32 * 1024 * 1024, 0)

    expect(() => decoder.feed(header)).toThrow('Frame payload too large')
  })
})

// ─── UDS Server Tests ──────────────────────────────────────────────────────

describe('UdsServer', () => {
  let server: UdsServer
  let sockPath: string

  beforeEach(() => {
    resetBackendEventStream()
    sockPath = testSocketPath()
    server = new UdsServer(sockPath)
  })

  afterEach(async () => {
    try {
      await server.stop()
    } catch {
      // already stopped
    }
    // Cleanup socket file just in case
    try {
      fs.unlinkSync(sockPath)
    } catch {
      // already removed
    }
  })

  test('start creates socket file and stop removes it', async () => {
    await server.start()
    expect(fs.existsSync(sockPath)).toBe(true)

    await server.stop()
    expect(fs.existsSync(sockPath)).toBe(false)
  })

  test('getSocketPath returns configured path', () => {
    expect(server.getSocketPath()).toBe(sockPath)
  })

  test('client can connect', async () => {
    await server.start()
    const client = await connectClient(sockPath)

    expect(server.getClientCount()).toBe(1)

    client.destroy()
    await wait(50)
    expect(server.getClientCount()).toBe(0)
  })

  test('broadcasts BackendEvents to connected clients', async () => {
    await server.start()
    const client = await connectClient(sockPath)
    const frames = collectFrames<Record<string, unknown>>(client, 500)

    // Wait for connection to settle
    await wait(50)

    // Emit an event on the BackendEventStream
    const stream = getBackendEventStream()
    const event: StreamChunkEvent = {
      type: 'StreamChunk',
      text: 'broadcast test',
      timestamp: Date.now(),
    }
    stream.emitEvent(event)

    await wait(100)
    client.destroy()

    const received = await frames
    // Filter out heartbeats
    const nonHeartbeat = received.filter((m) => m.type !== 'Heartbeat')
    expect(nonHeartbeat.length).toBeGreaterThanOrEqual(1)
    expect(nonHeartbeat[0]!.type).toBe('StreamChunk')
    expect(nonHeartbeat[0]!.text).toBe('broadcast test')
  })

  test('broadcasts to multiple clients', async () => {
    await server.start()
    const c1 = await connectClient(sockPath)
    const c2 = await connectClient(sockPath)

    const frames1 = collectFrames<Record<string, unknown>>(c1, 500)
    const frames2 = collectFrames<Record<string, unknown>>(c2, 500)

    await wait(50)

    const stream = getBackendEventStream()
    stream.emitEvent({
      type: 'GuardianAlert',
      severity: 'warning',
      message: 'multi-client test',
      emotion: 'stern',
      masterName: 'Buffett',
      timestamp: Date.now(),
    })

    await wait(100)
    c1.destroy()
    c2.destroy()

    const r1 = (await frames1).filter((m) => m.type !== 'Heartbeat')
    const r2 = (await frames2).filter((m) => m.type !== 'Heartbeat')

    expect(r1.length).toBeGreaterThanOrEqual(1)
    expect(r2.length).toBeGreaterThanOrEqual(1)
    expect(r1[0]!.type).toBe('GuardianAlert')
    expect(r2[0]!.type).toBe('GuardianAlert')
  })

  test('enforces max 3 concurrent clients', async () => {
    await server.start()
    const c1 = await connectClient(sockPath)
    const c2 = await connectClient(sockPath)
    const c3 = await connectClient(sockPath)

    await wait(50)
    expect(server.getClientCount()).toBe(3)

    // 4th client should be rejected
    const c4 = await connectClient(sockPath)
    const frames4 = collectFrames<Record<string, unknown>>(c4, 300)
    const received = await frames4

    // Should get Error message and then disconnect
    const errors = received.filter((m) => m.type === 'Error')
    expect(errors.length).toBeGreaterThanOrEqual(1)
    expect(errors[0]!.message).toBe('Max clients reached')

    c1.destroy()
    c2.destroy()
    c3.destroy()
    c4.destroy()
  })

  test('handles inbound UserInput messages', async () => {
    await server.start()

    const receivedMessages: Array<{ msg: unknown; clientId: number }> = []
    server.setInboundHandler((msg, clientId) => {
      receivedMessages.push({ msg, clientId })
    })

    const client = await connectClient(sockPath)
    await wait(50)

    // Send a UserInput message
    const frame = serializeFrame({ type: 'UserInput', text: 'buy BTC' })
    client.write(frame)

    await wait(100)

    expect(receivedMessages).toHaveLength(1)
    expect((receivedMessages[0]!.msg as any).type).toBe('UserInput')
    expect((receivedMessages[0]!.msg as any).text).toBe('buy BTC')

    client.destroy()
  })

  test('handles inbound ToolApproval messages', async () => {
    await server.start()

    const receivedMessages: Array<{ msg: unknown; clientId: number }> = []
    server.setInboundHandler((msg, clientId) => {
      receivedMessages.push({ msg, clientId })
    })

    const client = await connectClient(sockPath)
    await wait(50)

    const frame = serializeFrame({
      type: 'ToolApproval',
      id: 'tool-42',
      allow: true,
    })
    client.write(frame)

    await wait(100)

    expect(receivedMessages).toHaveLength(1)
    expect((receivedMessages[0]!.msg as any).type).toBe('ToolApproval')
    expect((receivedMessages[0]!.msg as any).id).toBe('tool-42')
    expect((receivedMessages[0]!.msg as any).allow).toBe(true)

    client.destroy()
  })

  test('handles HeartbeatAck to keep connection alive', async () => {
    await server.start()
    const client = await connectClient(sockPath)

    await wait(50)
    expect(server.getClientCount()).toBe(1)

    // Send HeartbeatAck
    const ackFrame = serializeFrame({ type: 'HeartbeatAck' })
    client.write(ackFrame)

    await wait(100)

    // Client should still be connected
    expect(server.getClientCount()).toBe(1)

    client.destroy()
  })

  test(
    'server sends heartbeat frames',
    async () => {
      // Use a short test — just verify we receive at least one heartbeat
      await server.start()
      const client = await connectClient(sockPath)
      const frames = collectFrames<Record<string, unknown>>(client, 6500)

      // Send HeartbeatAck to stay alive
      const ackInterval = setInterval(() => {
        try {
          if (!client.destroyed) {
            client.write(serializeFrame({ type: 'HeartbeatAck' }))
          }
        } catch {
          // ignore
        }
      }, 2000)

      await wait(5500)
      clearInterval(ackInterval)
      client.destroy()

      const received = await frames
      const heartbeats = received.filter((m) => m.type === 'Heartbeat')
      // Should have received at least 1 heartbeat in 5.5 seconds (sent every 5s)
      expect(heartbeats.length).toBeGreaterThanOrEqual(1)
    },
    { timeout: 10000 },
  )

  test('double start throws', async () => {
    await server.start()
    await expect(server.start()).rejects.toThrow('already started')
  })

  test('stop is idempotent', async () => {
    await server.start()
    await server.stop()
    // Should not throw
    await server.stop()
  })

  test('client disconnect does not crash server', async () => {
    await server.start()
    const client = await connectClient(sockPath)
    await wait(50)

    // Abruptly destroy client
    client.destroy()
    await wait(50)

    expect(server.getClientCount()).toBe(0)

    // Server should still accept new connections
    const client2 = await connectClient(sockPath)
    await wait(50)
    expect(server.getClientCount()).toBe(1)

    client2.destroy()
  })

  test('corrupt data from client does not crash server', async () => {
    await server.start()
    const client = await connectClient(sockPath)
    await wait(50)

    // Send garbage data with an oversized length header
    const corrupt = Buffer.allocUnsafe(4)
    corrupt.writeUInt32BE(32 * 1024 * 1024, 0)
    client.write(corrupt)

    await wait(100)

    // Client should be disconnected but server still running
    // Server should still accept new connections
    const client2 = await connectClient(sockPath)
    await wait(50)
    expect(server.getClientCount()).toBeGreaterThanOrEqual(1)

    client2.destroy()
  })
})
