/**
 * Desktop Bridge (Bun side) — emits structured JSON lines to a temp file
 * that the Electron main process polls for new data.
 *
 * Protocol: one JSON object per line (JSONL), appended atomically.
 * The Electron side reads new lines and routes them to the renderer via IPC.
 *
 * ALL errors are silently caught — the bridge must NEVER crash the trading engine.
 */

import { writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

// ── Bridge message types ────────────────────────────────────────────────────

export type BridgeMessageType =
  | 'trading_state'
  | 'guardian_alert'
  | 'master_info'
  | 'companion_emotion'
  | 'companion_speech'
  | 'tilt_state'
  | 'playbook_card'
  | 'trade_review'
  | 'anti_portfolio'
  | 'council_debate'
  | 'news_alert'
  | 'trade_history'
  | 'weekly_review'
  | 'risk_map'
  | 'cross_venue_portfolio'
  | 'venue_status'
  | 'vertical_risk_alert'
  | 'arbitrage_opportunity'

export interface BridgeMessage {
  type: BridgeMessageType
  data: unknown
  timestamp: number
}

// ── Desktop mode detection ──────────────────────────────────────────────────

let desktopModeCache: boolean | null = null

/**
 * Returns true when running inside the Electron desktop shell.
 * Checks the VIBE_SENSEI_DESKTOP=1 environment variable set by the PTY manager.
 */
export function isDesktopMode(): boolean {
  if (desktopModeCache !== null) return desktopModeCache
  desktopModeCache = process.env.VIBE_SENSEI_DESKTOP === '1'
  return desktopModeCache
}

// ── Bridge file path ────────────────────────────────────────────────────────

let bridgeFilePath: string | null = null

/**
 * Resolve the bridge file path. Priority:
 * 1. VIBE_SENSEI_BRIDGE_FILE env variable (set by Electron main process)
 * 2. Platform-appropriate temp directory fallback
 */
function getBridgeFilePath(): string {
  if (bridgeFilePath !== null) return bridgeFilePath

  const envPath = process.env.VIBE_SENSEI_BRIDGE_FILE
  if (envPath) {
    bridgeFilePath = envPath
    return bridgeFilePath
  }

  // Fallback: session-unique path with random UUID to prevent prediction
  const tmpDir = process.platform === 'win32'
    ? (process.env.TEMP ?? process.env.TMP ?? 'C:\\Temp')
    : '/tmp'
  bridgeFilePath = `${tmpDir}/vibe-sensei-bridge-${randomUUID()}.jsonl`
  return bridgeFilePath
}

// ── Emit function ───────────────────────────────────────────────────────────

/**
 * Append a JSON line to the bridge file for the Electron side to consume.
 * Uses writeFileSync with append flag for atomic line writes.
 *
 * Silently swallows all errors — this function must NEVER throw.
 */
export function emitToDesktop(type: BridgeMessageType, data: unknown): void {
  try {
    if (!isDesktopMode()) return

    const message: BridgeMessage = {
      type,
      data,
      timestamp: Date.now(),
    }

    const line = JSON.stringify(message) + '\n'
    writeFileSync(getBridgeFilePath(), line, { flag: 'a' })
  } catch {
    // Bridge failure must never propagate — silently discard
  }
}
