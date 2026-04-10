/**
 * Tests for src/services/chart/origin-utils.ts
 *
 * These exist primarily as a regression suite for the desktop UDF server
 * security fixes (2026-04-05). If you're refactoring chart/, do NOT skip
 * these — they encode the threat model from /cso finding #1 and #3.
 *
 *   THREAT: a LAN-adjacent attacker (or a malicious page in the user's
 *   own browser) hits ws://localhost:3456/ws/chat and drives the AI agent
 *   to place trades on the user's behalf. The Origin gate is the second
 *   layer of defense (the first is the loopback bind in chart/index.ts).
 */

import { describe, it, expect } from 'vitest'
import { isLocalOrigin, isSameHostOrigin } from '../origin-utils.js'

describe('isLocalOrigin', () => {
  it('allows empty origin (legacy same-origin XHR)', () => {
    expect(isLocalOrigin('')).toBe(true)
  })

  it('rejects malformed URL', () => {
    expect(isLocalOrigin('not-a-url')).toBe(false)
    expect(isLocalOrigin('http://')).toBe(false)
  })

  it('allows file:// (Electron renderer with file: protocol)', () => {
    expect(isLocalOrigin('file:///Users/foo/index.html')).toBe(true)
    expect(isLocalOrigin('file://')).toBe(true)
  })

  it('allows app:// (packaged Electron app)', () => {
    expect(isLocalOrigin('app://./index.html')).toBe(true)
  })

  it('allows http://localhost on any port', () => {
    expect(isLocalOrigin('http://localhost')).toBe(true)
    expect(isLocalOrigin('http://localhost:3456')).toBe(true)
    expect(isLocalOrigin('http://localhost:9999')).toBe(true)
  })

  it('allows http://127.0.0.1 on any port', () => {
    expect(isLocalOrigin('http://127.0.0.1')).toBe(true)
    expect(isLocalOrigin('http://127.0.0.1:3456')).toBe(true)
    expect(isLocalOrigin('http://127.0.0.1:9999')).toBe(true)
  })

  it('allows https://localhost (rare but valid)', () => {
    expect(isLocalOrigin('https://localhost:8443')).toBe(true)
  })

  it('allows http://[::1] (IPv6 loopback)', () => {
    // URL parser strips brackets — verify the hostname check matches
    expect(isLocalOrigin('http://[::1]:3456')).toBe(true)
  })

  it('REJECTS the attacker case — arbitrary external host', () => {
    expect(isLocalOrigin('https://evil.com')).toBe(false)
    expect(isLocalOrigin('https://attacker.evil.com:443')).toBe(false)
    expect(isLocalOrigin('http://192.168.1.42:3456')).toBe(false)
  })

  it('REJECTS lookalike hostnames', () => {
    expect(isLocalOrigin('http://localhost.evil.com')).toBe(false)
    expect(isLocalOrigin('http://127.0.0.1.evil.com')).toBe(false)
    expect(isLocalOrigin('http://notlocalhost')).toBe(false)
  })

  it('REJECTS LAN/private network addresses (not loopback)', () => {
    expect(isLocalOrigin('http://192.168.1.1')).toBe(false)
    expect(isLocalOrigin('http://10.0.0.5:3456')).toBe(false)
    expect(isLocalOrigin('http://172.16.0.1')).toBe(false)
  })
})

describe('isSameHostOrigin', () => {
  it('matches http://${host}', () => {
    expect(isSameHostOrigin('http://127.0.0.1:3456', '127.0.0.1:3456')).toBe(true)
    expect(isSameHostOrigin('http://localhost:3456', 'localhost:3456')).toBe(true)
  })

  it('matches https://${host}', () => {
    expect(isSameHostOrigin('https://example.com', 'example.com')).toBe(true)
  })

  it('rejects port mismatch', () => {
    expect(isSameHostOrigin('http://127.0.0.1:3456', '127.0.0.1:9999')).toBe(false)
  })

  it('rejects host mismatch', () => {
    expect(isSameHostOrigin('http://evil.com', '127.0.0.1:3456')).toBe(false)
  })

  it('rejects empty origin', () => {
    expect(isSameHostOrigin('', '127.0.0.1:3456')).toBe(false)
  })

  it('rejects empty host', () => {
    expect(isSameHostOrigin('http://127.0.0.1:3456', '')).toBe(false)
  })

  it('rejects mixed case where origin omits scheme', () => {
    expect(isSameHostOrigin('127.0.0.1:3456', '127.0.0.1:3456')).toBe(false)
  })
})
