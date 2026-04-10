/**
 * Origin validation helpers for the local UDF server.
 *
 * THREAT MODEL — desktop chart server (Electron mode)
 * ════════════════════════════════════════════════════
 *
 *  Attacker position           Defense layer
 *  ─────────────────           ─────────────
 *  LAN host on same WiFi  →  ┌─────────────────────┐
 *                            │ Layer 1: bind to    │  chart/index.ts:60
 *                            │ 127.0.0.1 only      │
 *                            └─────────────────────┘
 *  Malicious browser tab  →  ┌─────────────────────┐
 *  on the user's machine     │ Layer 2: WS Origin  │  chart/index.ts:135
 *                            │ gate (isLocalOrigin)│
 *                            └─────────────────────┘
 *  Other local process    →  ┌─────────────────────┐
 *  trying to steal token     │ Layer 3: Token gate │  udf-server.ts:380
 *                            │ (isSameHostOrigin)  │
 *                            └─────────────────────┘
 *
 *                                     ▼
 *                           AI agent + 78 trade tools
 *
 * Each layer handles a different attacker model. Removing any one
 * re-introduces a /cso CRITICAL finding (2026-04-05).
 *
 * Two predicates because two callers need different strictness:
 *
 *   isLocalOrigin    — used by WS upgrade. Permissive: any loopback
 *                      hostname on any port, plus file:/app:. A dev
 *                      process on a different port is still trusted.
 *
 *   isSameHostOrigin — used by token handout. Strict: must match the
 *                      actual Host header. Other localhost processes
 *                      do not get the token.
 */

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1'])
const LOCAL_PROTOCOLS = new Set(['file:', 'app:'])

/**
 * True if `origin` is a known-local origin (loopback host or local protocol).
 * Empty string returns true: some same-origin XHRs omit Origin (legacy quirk),
 * and the loopback bind already prevents non-local callers from reaching us.
 */
export function isLocalOrigin(origin: string): boolean {
  if (!origin) return true
  try {
    const u = new URL(origin)
    if (LOCAL_PROTOCOLS.has(u.protocol)) return true
    // URL.hostname keeps the brackets on IPv6 literals (e.g. '[::1]'),
    // which would not match the bracketless ::1 in LOOPBACK_HOSTNAMES.
    const host = u.hostname.replace(/^\[|\]$/g, '')
    return LOOPBACK_HOSTNAMES.has(host)
  } catch {
    return false
  }
}

/**
 * True if `origin` is exactly the same host the request was sent to.
 * Stricter than isLocalOrigin — used to gate token handouts where
 * "another process on the same machine" is not trusted enough.
 */
export function isSameHostOrigin(origin: string, host: string): boolean {
  if (!origin || !host) return false
  return origin === `http://${host}` || origin === `https://${host}`
}
