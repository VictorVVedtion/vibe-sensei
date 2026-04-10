/**
 * Chart Context Reader (Bun side) — reads the chart context file written by
 * the Electron renderer via IPC reverse bridge.
 *
 * The Electron main process atomically writes chart context (symbol, timeframe)
 * to ~/.vibe-sensei/desktop-context.json whenever the user changes the
 * TradingView chart's symbol or interval.
 *
 * This module provides a cached reader that:
 *   - Caches for 2 seconds to avoid filesystem thrashing
 *   - Returns null if the file is missing or data is stale (>10s old)
 *   - Never throws — all errors return null gracefully
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

// ── Constants ──────────────────────────────────────────────────────────────────

const CONTEXT_FILE = join(homedir(), '.vibe-sensei', 'desktop-context.json')
const CACHE_TTL_MS = 2_000   // re-read from disk at most every 2 seconds
const STALE_MS = 10_000      // data older than 10 seconds is considered stale

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ChartContextData {
  symbol: string
  timeframe: string
}

// ── Cache ──────────────────────────────────────────────────────────────────────

let cachedResult: ChartContextData | null = null
let cachedAt = 0

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Read the current chart context from the desktop bridge file.
 *
 * Returns {symbol, timeframe} when the user has a chart open and the data
 * is fresh, or null when:
 *   - Not running in desktop mode
 *   - File does not exist
 *   - File content is malformed
 *   - Data timestamp is stale (>10 seconds ago)
 */
export function readChartContext(): ChartContextData | null {
  const now = Date.now()

  // Return cached value if within TTL
  if (now - cachedAt < CACHE_TTL_MS) {
    return cachedResult
  }

  // Read from disk
  try {
    const raw = readFileSync(CONTEXT_FILE, 'utf-8')
    const parsed = JSON.parse(raw)

    // Validate required fields
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof parsed.symbol !== 'string' ||
      typeof parsed.timeframe !== 'string' ||
      typeof parsed.timestamp !== 'number'
    ) {
      cachedResult = null
      cachedAt = now
      return null
    }

    // Check staleness — if the chart context was written more than 10s ago,
    // the renderer may have disconnected or the widget may have been destroyed
    if (now - parsed.timestamp > STALE_MS) {
      cachedResult = null
      cachedAt = now
      return null
    }

    cachedResult = {
      symbol: parsed.symbol,
      timeframe: parsed.timeframe,
    }
    cachedAt = now
    return cachedResult
  } catch {
    // File missing, permission error, JSON parse error — all return null
    cachedResult = null
    cachedAt = now
    return null
  }
}
