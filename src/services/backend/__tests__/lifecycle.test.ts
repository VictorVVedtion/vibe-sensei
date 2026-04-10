import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import * as net from 'node:net'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import {
  startBackend,
  stopBackend,
  getActiveBackend,
} from '../lifecycle.js'
import {
  resetBackendEventStream,
  getBackendEventStream,
} from '../event-stream.js'
import {
  serializeFrame,
  FrameDecoder,
} from '../msgpack.js'

// ─── Test Helpers ──────────────────────────────────────────────────────────

let testCounter = 0
function testSocketPath(): string {
  testCounter++
  return path.join(
    os.tmpdir(),
    `vibe-sensei-lifecycle-test-${process.pid}-${testCounter}.sock`,
  )
}

/** Connect a raw client to a UDS path. */
function connectClient(sockPath: string): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const client = net.createConnection(sockPath, () => resolve(client))
    client.on('error', reject)
  })
}

/** Collect decoded frames from a socket until timeout. */
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
        // skip corrupt frames
      }
    })

    socket.on('close', () => {
      clearTimeout(timer)
      resolve(results)
    })
  })
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('Backend Lifecycle', () => {
  let sockPath: string

  beforeEach(() => {
    resetBackendEventStream()
    sockPath = testSocketPath()
    // Ensure no leftover active backend
    void stopBackend()
  })

  afterEach(async () => {
    await stopBackend()
    try {
      fs.unlinkSync(sockPath)
    } catch {
      // already removed
    }
    // Restore env
    delete process.env.VIBE_SENSEI_SOCK
  })

  // ─── Start/Stop ─────────────────────────────────────────────────────────

  test('startBackend creates socket and returns active handle', async () => {
    const handle = await startBackend({ socketPath: sockPath })

    expect(handle.active).toBe(true)
    expect(handle.socketPath).toBe(sockPath)
    expect(fs.existsSync(sockPath)).toBe(true)
    expect(process.env.VIBE_SENSEI_SOCK).toBe(sockPath)
  })

  test('stopBackend cleans up socket and env var', async () => {
    await startBackend({ socketPath: sockPath })
    await stopBackend()

    expect(fs.existsSync(sockPath)).toBe(false)
    expect(process.env.VIBE_SENSEI_SOCK).toBeUndefined()
  })

  test('shutdown is idempotent', async () => {
    const handle = await startBackend({ socketPath: sockPath })
    await handle.shutdown()
    // Second call should not throw
    await handle.shutdown()
  })

  test('getActiveBackend returns current handle', async () => {
    expect(getActiveBackend()).toBeNull()

    const handle = await startBackend({ socketPath: sockPath })
    expect(getActiveBackend()).toBe(handle)

    await stopBackend()
    expect(getActiveBackend()).toBeNull()
  })

  // ─── Double Start Prevention ────────────────────────────────────────────

  test('double startBackend returns same handle', async () => {
    const h1 = await startBackend({ socketPath: sockPath })
    const h2 = await startBackend({ socketPath: sockPath })

    expect(h1).toBe(h2)
    expect(h1.active).toBe(true)
  })

  // ─── Graceful Degradation ──────────────────────────────────────────────

  test('startBackend returns inactive handle on failure', async () => {
    // Create a file at the socket path to force a conflict
    const conflictPath = testSocketPath()
    fs.mkdirSync(conflictPath, { recursive: true })

    const handle = await startBackend({ socketPath: conflictPath })

    expect(handle.active).toBe(false)
    expect(handle.socketPath).toBe(conflictPath)

    // Cleanup the directory
    try {
      fs.rmdirSync(conflictPath)
    } catch {
      // ignore
    }
  })

  // ─── UserInput Routing ─────────────────────────────────────────────────

  test('routes UserInput messages to onUserInput handler', async () => {
    const received: string[] = []

    await startBackend({
      socketPath: sockPath,
      onUserInput: (text) => received.push(text),
    })

    const client = await connectClient(sockPath)
    await wait(50)

    // Send UserInput
    const frame = serializeFrame({ type: 'UserInput', text: 'buy BTC/USDT' })
    client.write(frame)

    await wait(100)

    expect(received).toHaveLength(1)
    expect(received[0]).toBe('buy BTC/USDT')

    client.destroy()
  })

  // ─── ToolApproval Routing ──────────────────────────────────────────────

  test('routes ToolApproval messages to onToolApproval handler', async () => {
    const received: Array<{ id: string; allow: boolean }> = []

    await startBackend({
      socketPath: sockPath,
      onToolApproval: (id, allow) => received.push({ id, allow }),
    })

    const client = await connectClient(sockPath)
    await wait(50)

    // Send ToolApproval
    const frame = serializeFrame({
      type: 'ToolApproval',
      id: 'tool-99',
      allow: true,
    })
    client.write(frame)

    await wait(100)

    expect(received).toHaveLength(1)
    expect(received[0]!.id).toBe('tool-99')
    expect(received[0]!.allow).toBe(true)

    client.destroy()
  })

  // ─── StateSync on Connect ──────────────────────────────────────────────

  test('emits StateSync when client connects', async () => {
    const mockState = {
      sessionId: 'test-session',
      turnCount: 5,
      contextUsage: 0.32,
    }

    await startBackend({
      socketPath: sockPath,
      getAppState: () => mockState,
    })

    const client = await connectClient(sockPath)
    const frames = collectFrames<Record<string, unknown>>(client, 3500)

    // Wait for the StateSync poll interval (2s) + margin
    await wait(2500)
    client.destroy()

    const received = await frames
    const syncEvents = received.filter((m) => m.type === 'StateSync')

    expect(syncEvents.length).toBeGreaterThanOrEqual(1)
    const state = syncEvents[0]!.fullState as Record<string, unknown>
    expect(state.sessionId).toBe('test-session')
    expect(state.turnCount).toBe(5)
  })

  // ─── Multiple Messages ─────────────────────────────────────────────────

  test('handles multiple inbound messages sequentially', async () => {
    const userInputs: string[] = []
    const approvals: Array<{ id: string; allow: boolean }> = []

    await startBackend({
      socketPath: sockPath,
      onUserInput: (text) => userInputs.push(text),
      onToolApproval: (id, allow) => approvals.push({ id, allow }),
    })

    const client = await connectClient(sockPath)
    await wait(50)

    // Send multiple messages
    client.write(serializeFrame({ type: 'UserInput', text: 'show balance' }))
    client.write(
      serializeFrame({
        type: 'ToolApproval',
        id: 'tool-1',
        allow: false,
      }),
    )
    client.write(serializeFrame({ type: 'UserInput', text: 'exit' }))

    await wait(150)

    expect(userInputs).toHaveLength(2)
    expect(userInputs[0]).toBe('show balance')
    expect(userInputs[1]).toBe('exit')
    expect(approvals).toHaveLength(1)
    expect(approvals[0]!.allow).toBe(false)

    client.destroy()
  })

  // ─── Client Connects After Backend ──────────────────────────────────────

  test('clients can connect and disconnect without crashing', async () => {
    await startBackend({ socketPath: sockPath })

    const c1 = await connectClient(sockPath)
    await wait(50)
    c1.destroy()
    await wait(50)

    // New client can still connect
    const c2 = await connectClient(sockPath)
    await wait(50)
    c2.destroy()
  })
})
