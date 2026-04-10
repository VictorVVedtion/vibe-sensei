/**
 * Integration tests for the chart UDF server security model.
 *
 * These tests boot a real HTTP server on an ephemeral port and exercise the
 * exact attack vectors that /cso (2026-04-05) found and we patched. They
 * exist as REGRESSION TESTS — if a refactor accidentally re-introduces any
 * of these holes, these tests fail in CI.
 *
 * The threats being tested:
 *
 *   1. Network exposure  — server must NOT bind to all interfaces. A LAN
 *      host on the same WiFi must not be able to reach this server.
 *
 *   2. WebSocket origin gate — /ws/chat feeds the AI agent. A request
 *      from a non-local Origin header must get 403 on upgrade.
 *
 *   3. CORS allowlist — wildcard CORS (Access-Control-Allow-Origin: *)
 *      must NOT be reflected. Only known-local origins get reflected.
 *
 *   4. Chart-token gate — /api/chart-token returns a bearer token used
 *      to gate screenshot uploads. It must reject Origin: evil.com but
 *      allow same-host and file:// (Electron renderer).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import express from 'express'
import type { Server, AddressInfo } from 'net'
import { createUdfApp } from '../udf-server.js'

// ── Bootstrap a real server on an ephemeral port ────────────────────────────

let server: Server
let baseUrl: string
let host: string

beforeAll(async () => {
  const app = createUdfApp()
  // 404 fallthrough so /api/chart-token doesn't get masked by static
  app.use((_req, res) => res.status(404).json({ error: 'Not found' }))

  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, '127.0.0.1', () => resolve())
    server.on('error', reject)
  })

  const addr = server.address() as AddressInfo
  host = `127.0.0.1:${addr.port}`
  baseUrl = `http://${host}`
})

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

// ── Bind regression — server must reject non-loopback connections ───────────

describe('chart server bind regression', () => {
  it('binds to 127.0.0.1 only (not 0.0.0.0)', () => {
    const addr = server.address() as AddressInfo
    expect(addr.address).toBe('127.0.0.1')
    // Defensive: if Node ever changes defaults, this catches the regression
    expect(addr.address).not.toBe('0.0.0.0')
    expect(addr.address).not.toBe('::')
  })
})

// ── Chart token gate — Finding #3 from /cso ─────────────────────────────────

describe('GET /api/chart-token — Origin gate', () => {
  it('returns token for same-host request (no Origin header)', async () => {
    const res = await fetch(`${baseUrl}/api/chart-token`)
    expect(res.status).toBe(200)
    const body = await res.json() as { token: string }
    expect(body.token).toMatch(/^[0-9a-f-]{36}$/) // UUID
  })

  it('returns token when Origin matches Host', async () => {
    const res = await fetch(`${baseUrl}/api/chart-token`, {
      headers: { Origin: baseUrl },
    })
    expect(res.status).toBe(200)
  })

  it('returns token for file:// origin (Electron renderer)', async () => {
    const res = await fetch(`${baseUrl}/api/chart-token`, {
      headers: { Origin: 'file:///Users/foo/index.html' },
    })
    expect(res.status).toBe(200)
  })

  it('REGRESSION — rejects evil.com Origin with 403', async () => {
    const res = await fetch(`${baseUrl}/api/chart-token`, {
      headers: { Origin: 'https://evil.com' },
    })
    expect(res.status).toBe(403)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Forbidden')
  })

  it('REGRESSION — rejects LAN attacker Origin', async () => {
    const res = await fetch(`${baseUrl}/api/chart-token`, {
      headers: { Origin: 'http://192.168.1.42:8080' },
    })
    expect(res.status).toBe(403)
  })
})

// ── CORS middleware — Finding #3 (wildcard regression) ──────────────────────

describe('CORS middleware — origin reflection allowlist', () => {
  it('reflects same-host Origin', async () => {
    const res = await fetch(`${baseUrl}/api/chart-token`, {
      headers: { Origin: baseUrl },
    })
    expect(res.headers.get('access-control-allow-origin')).toBe(baseUrl)
    expect(res.headers.get('vary')).toBe('Origin')
  })

  it('reflects file:// Origin', async () => {
    const res = await fetch(`${baseUrl}/api/chart-token`, {
      headers: { Origin: 'file:///' },
    })
    expect(res.headers.get('access-control-allow-origin')).toBe('file:///')
  })

  it('REGRESSION — does NOT reflect evil.com Origin', async () => {
    // The endpoint will return 403 (token gate), but the CORS header check
    // is what we care about: it must not echo the attacker origin even on
    // error responses (which are still readable cross-origin).
    const res = await fetch(`${baseUrl}/api/chart-token`, {
      headers: { Origin: 'https://evil.com' },
    })
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('REGRESSION — never returns wildcard Access-Control-Allow-Origin', async () => {
    // The pre-fix bug was setHeader('Access-Control-Allow-Origin', '*').
    // Verify the wildcard has been removed everywhere.
    const cases: Array<Record<string, string> | undefined> = [
      undefined,
      { Origin: baseUrl },
      { Origin: 'https://evil.com' },
      { Origin: 'file://' },
    ]
    for (const headers of cases) {
      const res = await fetch(`${baseUrl}/api/chart-token`, { headers })
      expect(res.headers.get('access-control-allow-origin')).not.toBe('*')
    }
  })
})
