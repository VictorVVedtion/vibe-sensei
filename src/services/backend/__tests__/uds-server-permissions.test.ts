/**
 * UdsServer filesystem-permission security tests (Sprint 144 / v0.2.1-sensei).
 *
 * REGRESSION SUITE: these tests verify that the UDS backend creates its
 * socket file with mode 0600 (owner-only) and verifies ownership at
 * startup. If a refactor accidentally removes the umask trick or the
 * chmod-and-verify path, these tests fail.
 *
 *   THREAT: prior to this fix, the UDS backend at uds-server.ts:118
 *   accepted any local connection. Any other process running on the same
 *   machine (sandboxed, sidecar container, malicious script) could
 *   connect over the unix socket and inject UserInput / ToolApproval
 *   messages, driving the trading layer remotely. Verified by /autoplan
 *   eng dual voices on 2026-04-06.
 *
 *   FIX: lower process umask to 0o077 before listen() so the socket file
 *   is created with mode 0600 atomically; verify mode + ownership after.
 *   Same mechanism Postgres / MySQL / Docker use.
 */

import { describe, it, expect, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as net from 'node:net'
import * as os from 'node:os'
import * as path from 'node:path'
import { UdsServer } from '../uds-server.js'

let server: UdsServer | null = null
let socketPath: string | null = null

afterEach(async () => {
  if (server) {
    try {
      await server.stop()
    } catch {
      // best-effort cleanup
    }
    server = null
  }
  if (socketPath) {
    try {
      fs.unlinkSync(socketPath)
    } catch {
      // file may not exist
    }
    socketPath = null
  }
})

function makeTempSocketPath(): string {
  return path.join(
    os.tmpdir(),
    `vibe-sensei-test-perms-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.sock`,
  )
}

describe('UdsServer — filesystem permission security (Sprint 144)', () => {
  it('REGRESSION — creates socket file with mode 0600', async () => {
    socketPath = makeTempSocketPath()
    server = new UdsServer(socketPath)

    await server.start()

    const stat = fs.statSync(socketPath)
    const mode = stat.mode & 0o777
    expect(mode).toBe(0o600)
  })

  it('REGRESSION — socket file is owned by current process UID', async () => {
    if (typeof process.getuid !== 'function') {
      // Windows / non-POSIX — getuid not available, skip
      return
    }

    socketPath = makeTempSocketPath()
    server = new UdsServer(socketPath)

    await server.start()

    const stat = fs.statSync(socketPath)
    expect(stat.uid).toBe(process.getuid())
  })

  it('REGRESSION — same-process connection still works (does not break existing flow)', async () => {
    socketPath = makeTempSocketPath()
    server = new UdsServer(socketPath)

    await server.start()

    // Connect to ourselves and verify the socket actually accepts a
    // same-uid connection. We do not exchange protocol messages — we
    // only assert the connect() call succeeds before disconnecting.
    await new Promise<void>((resolve, reject) => {
      const sock = net.createConnection(socketPath!, () => {
        sock.end()
        resolve()
      })
      sock.on('error', reject)
      // Sanity timeout
      setTimeout(() => reject(new Error('connect timeout')), 2000)
    })
  })

  it('REGRESSION — restores process umask after start (no global side effect)', async () => {
    if (typeof process.umask !== 'function') return

    // Capture pre-start umask. We must temporarily set it to a value
    // distinct from 0o077 to verify it gets restored to THIS value, not
    // accidentally left at 0o077.
    const sentinelUmask = 0o022
    const original = process.umask(sentinelUmask)

    try {
      socketPath = makeTempSocketPath()
      server = new UdsServer(socketPath)
      await server.start()

      // After start, the umask must be back to the sentinel we set,
      // not 0o077 (which start() uses internally).
      const after = process.umask(sentinelUmask)
      expect(after).toBe(sentinelUmask)
    } finally {
      process.umask(original)
    }
  })

  it('REGRESSION — server refuses to start twice (defends against concurrent start)', async () => {
    socketPath = makeTempSocketPath()
    server = new UdsServer(socketPath)

    await server.start()

    await expect(server.start()).rejects.toThrow(/already started/i)
  })
})
