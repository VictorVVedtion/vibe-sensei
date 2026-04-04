/**
 * Lightweight Regime Poller — keeps regime cache warm for the companion.
 *
 * Polls every 5 minutes, resolves the "primary symbol" (the one the user
 * most likely cares about), and calls computeRegimeForSymbol() to refresh
 * the cache. If MarketFeed is already running and its cached regime is
 * fresh, the poller skips to avoid duplicate work.
 *
 * Primary symbol resolution priority:
 *   1. First open position from the exchange
 *   2. Most recent trade symbol from the guardian diary
 *   3. Fallback: 'BTC/USDT'
 */

import { getConnectedExchange } from '../exchange/singleton.js'
import { computeRegimeForSymbol, getLatestRegime, isRegimeExpired } from '../market/regime.js'
import { GuardianDiary } from '../../buddy/diary.js'

// ── Constants ──────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes
const DEFAULT_SYMBOL = 'BTC/USDT'

// ── Module State ───────────────────────────────────────────────────────────

let timer: ReturnType<typeof setInterval> | null = null
let lastPoll: Date | null = null
let currentSymbol: string = DEFAULT_SYMBOL
let currentRegime: string | null = null

// ── Primary Symbol Resolution ──────────────────────────────────────────────

/**
 * Resolve the primary symbol the user cares about.
 * Priority: open positions > diary last trade > BTC/USDT.
 */
async function resolvePrimarySymbol(): Promise<string> {
  // 1. Check portfolio positions
  try {
    const exchange = await getConnectedExchange()
    const positions = await exchange.getPositions()
    if (positions.length > 0 && positions[0]!.symbol) {
      return positions[0]!.symbol
    }
  } catch {
    // Exchange not connected — fall through
  }

  // 2. Check diary for most recent trade symbol
  try {
    const diary = new GuardianDiary()
    const recent = diary.getRecentEntries(1)
    if (recent.length > 0 && recent[0]!.tradeSymbol) {
      return recent[0]!.tradeSymbol
    }
  } catch {
    // Diary unavailable — fall through
  }

  // 3. Default
  return DEFAULT_SYMBOL
}

// ── Poll Logic ─────────────────────────────────────────────────────────────

async function poll(): Promise<void> {
  try {
    const symbol = await resolvePrimarySymbol()
    currentSymbol = symbol

    // If MarketFeed already has fresh data for this symbol, skip
    if (!isRegimeExpired(symbol)) {
      const cached = getLatestRegime(symbol)
      if (cached) {
        currentRegime = cached.regime
        lastPoll = new Date()
        return
      }
    }

    // Fetch candles and compute regime
    // computeRegimeForSymbol internally fetches 65 candles (ATR_PERCENTILE_WINDOW + ATR_PERIOD + 1)
    let exchange
    try {
      exchange = await getConnectedExchange()
    } catch {
      // Exchange not connected — no-op this poll cycle
      return
    }

    const result = await computeRegimeForSymbol(symbol, exchange)
    currentRegime = result?.regime ?? null
    lastPoll = new Date()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[RegimePoller] poll error: ${msg}`)
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/** Start the regime poller. Safe to call multiple times — subsequent calls are no-ops. */
export function startRegimePoller(): void {
  if (timer !== null) return

  // Fire an initial poll immediately (non-blocking)
  void poll()

  timer = setInterval(() => {
    void poll()
  }, POLL_INTERVAL_MS)
}

/** Stop the regime poller. Clears the interval but preserves cached state. */
export function stopRegimePoller(): void {
  if (timer !== null) {
    clearInterval(timer)
    timer = null
  }
}

/** Get current poller status for debugging / diagnostics. */
export function getRegimePollerStatus(): {
  symbol: string
  lastPoll: Date | null
  regime: string | null
} {
  return {
    symbol: currentSymbol,
    lastPoll,
    regime: currentRegime,
  }
}
