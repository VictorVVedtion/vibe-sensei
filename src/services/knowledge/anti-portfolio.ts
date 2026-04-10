/**
 * Anti-Portfolio (Shadow PnL) — tracks trades blocked by gates or tilt warnings
 * and computes what would have happened if they had gone through.
 *
 * Records blocked trades with entry price, checks current prices every 5 minutes,
 * computes hypothetical PnL, and aggregates weekly/monthly totals.
 * Emits anti_portfolio bridge messages so the desktop sidebar can display
 * "{MasterName} saved you $X this week".
 *
 * Integration points:
 *   - PreTradeGateTool (gate fail/warn) -> recordBlockedTrade()
 *   - TiltState (tilt warning) -> recordBlockedTrade()
 *   - CompanionEngine polling loop -> startPricePolling() / stopPricePolling()
 *   - Desktop bridge -> emitToDesktop('anti_portfolio', ...)
 */

import type { GateStatus } from '../../tools/PreTradeGateTool/types.js'

// ── Types ──────────────────────────────────────────────────────────────────

export interface BlockedTrade {
  id: string
  symbol: string
  side: 'buy' | 'sell'
  quantity: number
  entryPrice: number
  reason: string
  source: 'gate_fail' | 'gate_warn' | 'tilt_warning'
  gateStatus?: GateStatus
  masterName: string
  timestamp: number
  /** Latest checked price. Updated by the price poller. */
  currentPrice: number | null
  /** Hypothetical PnL if the trade had gone through. */
  hypotheticalPnl: number | null
}

export interface AntiPortfolioSummary {
  weeklyBlocked: number
  weeklySavedAmount: number
  monthlyBlocked: number
  monthlySavedAmount: number
  entries: BlockedTradeEntry[]
  masterName: string
  timestamp: number
}

export interface BlockedTradeEntry {
  symbol: string
  side: 'buy' | 'sell'
  reason: string
  entryPrice: number
  currentPrice: number | null
  hypotheticalPnl: number | null
  timestamp: number
}

// ── Constants ──────────────────────────────────────────────────────────────

/** Price check interval: 5 minutes. */
const PRICE_CHECK_INTERVAL_MS = 5 * 60 * 1000

/** Maximum blocked trades kept in memory. */
const MAX_BLOCKED_TRADES = 100

/** One week in milliseconds. */
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000

/** One month in milliseconds (30 days). */
const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000

// ── State ──────────────────────────────────────────────────────────────────

const blockedTrades: BlockedTrade[] = []
let pollTimer: ReturnType<typeof setInterval> | null = null
let masterNameCache: string = 'Guardian'

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Record a trade that was blocked by a gate check or tilt warning.
 * Called from PreTradeGateTool after a gate fail/warn, or from tilt detection.
 */
export function recordBlockedTrade(trade: {
  symbol: string
  side: 'buy' | 'sell'
  quantity: number
  entryPrice: number
  reason: string
  source: 'gate_fail' | 'gate_warn' | 'tilt_warning'
  gateStatus?: GateStatus
  masterName: string
}): void {
  try {
    const entry: BlockedTrade = {
      id: `${trade.symbol}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      symbol: trade.symbol,
      side: trade.side,
      quantity: trade.quantity,
      entryPrice: trade.entryPrice,
      reason: trade.reason,
      source: trade.source,
      gateStatus: trade.gateStatus,
      masterName: trade.masterName,
      timestamp: Date.now(),
      currentPrice: null,
      hypotheticalPnl: null,
    }

    masterNameCache = trade.masterName
    blockedTrades.push(entry)

    // Enforce ring buffer size
    while (blockedTrades.length > MAX_BLOCKED_TRADES) {
      blockedTrades.shift()
    }
  } catch {
    // Recording must never propagate errors
  }
}

/**
 * Start the 5-minute price polling loop.
 * Fetches current prices for all blocked trades and computes hypothetical PnL.
 */
export function startPricePolling(): void {
  if (pollTimer !== null) return

  // Run first check immediately
  updatePricesAndEmit()

  pollTimer = setInterval(() => {
    updatePricesAndEmit()
  }, PRICE_CHECK_INTERVAL_MS)
}

/** Stop the price polling loop. */
export function stopPricePolling(): void {
  if (pollTimer !== null) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

/**
 * Get the current anti-portfolio summary.
 * Can be called externally for programmatic access.
 */
export function getAntiPortfolioSummary(): AntiPortfolioSummary {
  return buildSummary()
}

/**
 * Get the raw blocked trades list.
 * Useful for detailed inspection or debugging.
 */
export function getBlockedTrades(): readonly BlockedTrade[] {
  return blockedTrades
}

// ── Internal ───────────────────────────────────────────────────────────────

/**
 * Update current prices for all blocked trades, compute hypothetical PnL,
 * and emit the summary to the desktop bridge.
 */
async function updatePricesAndEmit(): Promise<void> {
  try {
    if (blockedTrades.length === 0) return

    // Collect unique symbols that need price updates
    const symbols = new Set<string>()
    for (const trade of blockedTrades) {
      symbols.add(trade.symbol)
    }

    // Fetch current prices from exchange
    const prices = await fetchCurrentPrices(symbols)

    // Update each blocked trade with current price and compute PnL
    for (const trade of blockedTrades) {
      const currentPrice = prices.get(trade.symbol)
      if (currentPrice === undefined) continue

      trade.currentPrice = currentPrice
      trade.hypotheticalPnl = computeHypotheticalPnl(trade, currentPrice)
    }

    // Build summary and emit to desktop
    const summary = buildSummary()
    emitAntiPortfolio(summary)
  } catch {
    // Price update must never propagate errors
  }
}

/**
 * Fetch current prices for a set of symbols from the exchange.
 * Returns a map of symbol -> current price.
 */
async function fetchCurrentPrices(symbols: Set<string>): Promise<Map<string, number>> {
  const prices = new Map<string, number>()

  try {
    const { getConnectedExchange } = await import('../exchange/singleton.js')
    const exchange = await getConnectedExchange()

    const tickerPromises = Array.from(symbols).map(async (symbol) => {
      try {
        const ticker = await exchange.getTicker(symbol)
        if (ticker.last > 0) {
          prices.set(symbol, ticker.last)
        }
      } catch {
        // Individual ticker fetch failure — skip this symbol
      }
    })

    await Promise.all(tickerPromises)
  } catch {
    // Exchange unavailable — return empty prices
  }

  return prices
}

/**
 * Compute hypothetical PnL for a blocked trade given the current price.
 *
 * For a blocked BUY: PnL = (currentPrice - entryPrice) * quantity
 *   (positive means the trade would have profited — guardian saved nothing)
 *   (negative means the trade would have lost — guardian saved money)
 *
 * For a blocked SELL: PnL = (entryPrice - currentPrice) * quantity
 *   (positive means selling would have been profitable)
 *   (negative means not selling was the right call)
 *
 * The "saved amount" perspective is inverted: if the hypothetical PnL is
 * negative (the trade would have lost money), the guardian saved that amount.
 */
function computeHypotheticalPnl(trade: BlockedTrade, currentPrice: number): number {
  if (trade.side === 'buy') {
    return (currentPrice - trade.entryPrice) * trade.quantity
  }
  // sell
  return (trade.entryPrice - currentPrice) * trade.quantity
}

/**
 * Build the anti-portfolio summary with weekly/monthly aggregates.
 */
function buildSummary(): AntiPortfolioSummary {
  const now = Date.now()
  const weekAgo = now - ONE_WEEK_MS
  const monthAgo = now - ONE_MONTH_MS

  let weeklyBlocked = 0
  let weeklySaved = 0
  let monthlyBlocked = 0
  let monthlySaved = 0

  const entries: BlockedTradeEntry[] = []

  for (const trade of blockedTrades) {
    // Compute saved amount: negative hypothetical PnL means money saved
    const savedAmount = trade.hypotheticalPnl !== null
      ? Math.max(0, -trade.hypotheticalPnl)
      : 0

    if (trade.timestamp >= weekAgo) {
      weeklyBlocked++
      weeklySaved += savedAmount
    }

    if (trade.timestamp >= monthAgo) {
      monthlyBlocked++
      monthlySaved += savedAmount
    }

    entries.push({
      symbol: trade.symbol,
      side: trade.side,
      reason: trade.reason,
      entryPrice: trade.entryPrice,
      currentPrice: trade.currentPrice,
      hypotheticalPnl: trade.hypotheticalPnl,
      timestamp: trade.timestamp,
    })
  }

  // Sort entries by timestamp descending (most recent first)
  entries.sort((a, b) => b.timestamp - a.timestamp)

  return {
    weeklyBlocked,
    weeklySavedAmount: Math.round(weeklySaved * 100) / 100,
    monthlyBlocked,
    monthlySavedAmount: Math.round(monthlySaved * 100) / 100,
    entries: entries.slice(0, 20), // Limit to 20 most recent for display
    masterName: masterNameCache,
    timestamp: now,
  }
}

// ── Bridge module cache ────────────────────────────────────────────────

let bridgeModCache: typeof import('../desktop/bridge.js') | null = null

async function getBridgeMod() {
  if (bridgeModCache) return bridgeModCache
  bridgeModCache = await import('../desktop/bridge.js')
  return bridgeModCache
}

/**
 * Emit the anti-portfolio summary to the desktop bridge.
 * Transforms the summary into the AntiPortfolio IPC schema shape.
 */
async function emitAntiPortfolio(summary: AntiPortfolioSummary): Promise<void> {
  try {
    const bridge = await getBridgeMod()
    if (!bridge.isDesktopMode()) return

    bridge.emitToDesktop('anti_portfolio', {
      entries: summary.entries.map((e) => ({
        symbol: e.symbol,
        reason: e.reason,
        missedPnl: e.hypotheticalPnl,
        date: new Date(e.timestamp).toISOString().slice(0, 10),
      })),
      weeklyBlocked: summary.weeklyBlocked,
      weeklySavedAmount: summary.weeklySavedAmount,
      monthlyBlocked: summary.monthlyBlocked,
      monthlySavedAmount: summary.monthlySavedAmount,
      masterName: summary.masterName,
      timestamp: summary.timestamp,
    })
  } catch {
    // Bridge emission must never propagate
  }
}
