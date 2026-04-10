/**
 * Trade Report — post-trade R-multiple analysis and reporting.
 * Generates detailed performance metrics when a position is closed,
 * including P&L, R-multiple, MAE/MFE, and efficiency ratio.
 */

import type { Candle, ExchangeInterface, Order } from '../services/exchange/types.js'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TradeReport {
  symbol: string
  side: string
  entryPrice: number
  exitPrice: number
  quantity: number
  grossPnL: number
  netPnL: number
  netPnLPercent: number
  totalFees: number
  initialRisk: number
  rMultiple: number
  holdDurationMs: number
  holdDurationHuman: string
  mae: number
  mfe: number
  efficiencyRatio: number
  timestamp: number
}

export interface ClosedPositionInfo {
  symbol: string
  side: string
  entryPrice: number
  quantity: number
  openedAtEstimate: number
}

export interface MAEMFEResult {
  mae: number
  mfe: number
}

// ─── Duration Formatting ─────────────────────────────────────────────────────

const MS_PER_MINUTE = 60_000
const MS_PER_HOUR = 3_600_000
const MS_PER_DAY = 86_400_000

/**
 * Formats a duration in milliseconds to a human-readable string.
 * < 1h: "Xm", 1-24h: "Xh Ym", 1-7d: "Xd Yh", >7d: "Xd"
 */
export function formatDuration(ms: number): string {
  if (ms < 0) return '0m'

  if (ms < MS_PER_HOUR) {
    const minutes = Math.max(1, Math.round(ms / MS_PER_MINUTE))
    return `${minutes}m`
  }

  if (ms < MS_PER_DAY) {
    const hours = Math.floor(ms / MS_PER_HOUR)
    const minutes = Math.round((ms % MS_PER_HOUR) / MS_PER_MINUTE)
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  }

  const days = Math.floor(ms / MS_PER_DAY)
  if (days <= 7) {
    const hours = Math.round((ms % MS_PER_DAY) / MS_PER_HOUR)
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`
  }

  return `${days}d`
}

// ─── MAE / MFE Calculation ───────────────────────────────────────────────────

/**
 * Calculates Maximum Adverse Excursion and Maximum Favorable Excursion
 * from candle data during the hold period.
 *
 * Long: MAE = worst drawdown from entry, MFE = best run-up from entry
 * Short: MAE = worst run-up from entry, MFE = best drawdown from entry
 */
export function calculateMAEMFE(
  entryPrice: number,
  candles: Candle[],
  side: string,
): MAEMFEResult {
  if (candles.length === 0 || entryPrice <= 0) {
    return { mae: 0, mfe: 0 }
  }

  let minLow = Infinity
  let maxHigh = -Infinity

  for (const candle of candles) {
    if (candle.low < minLow) minLow = candle.low
    if (candle.high > maxHigh) maxHigh = candle.high
  }

  if (side === 'sell') {
    const mae = ((maxHigh - entryPrice) / entryPrice) * 100
    const mfe = ((entryPrice - minLow) / entryPrice) * 100
    return { mae: -Math.abs(mae), mfe: Math.abs(mfe) }
  }

  // Default: long side (buy)
  const mae = ((minLow - entryPrice) / entryPrice) * 100
  const mfe = ((maxHigh - entryPrice) / entryPrice) * 100
  return { mae: Math.min(0, mae), mfe: Math.max(0, mfe) }
}

// ─── ATR Calculation ─────────────────────────────────────────────────────────

/**
 * Computes Average True Range from candle data.
 * Uses standard ATR: max(high-low, |high-prevClose|, |low-prevClose|).
 */
function computeATR(candles: Candle[]): number {
  if (candles.length < 2) {
    if (candles.length === 1) {
      return candles[0]!.high - candles[0]!.low
    }
    return 0
  }

  let sum = 0
  for (let i = 1; i < candles.length; i++) {
    const curr = candles[i]!
    const prev = candles[i - 1]!
    const tr = Math.max(
      curr.high - curr.low,
      Math.abs(curr.high - prev.close),
      Math.abs(curr.low - prev.close),
    )
    sum += tr
  }

  return sum / (candles.length - 1)
}

// ─── Report Generation ──────────────────────────────────────────────────────

/**
 * Generates a complete trade report after a position is closed.
 * Fetches candle data for MAE/MFE and computes R-multiple.
 */
export async function generateTradeReport(
  closedPosition: ClosedPositionInfo,
  order: Order,
  exchange: ExchangeInterface,
): Promise<TradeReport> {
  const { symbol, side, entryPrice, quantity, openedAtEstimate } = closedPosition
  const exitPrice = order.avgFillPrice
  const totalFees = order.fee

  const grossPnL = computeGrossPnL(side, entryPrice, exitPrice, quantity)
  const netPnL = grossPnL - totalFees
  const costBasis = entryPrice * quantity
  const netPnLPercent = costBasis > 0 ? (netPnL / costBasis) * 100 : 0

  const exitTimestamp = order.updatedAt.getTime()
  const holdDurationMs = estimateHoldDuration(exitTimestamp, openedAtEstimate)

  const initialRisk = await computeInitialRisk(
    symbol, entryPrice, quantity, exchange,
  )
  const rMultiple = initialRisk > 0 ? netPnL / initialRisk : 0

  const { mae, mfe } = await fetchMAEMFE(
    symbol, entryPrice, side, holdDurationMs, exchange,
  )

  const efficiencyRatio = computeEfficiency(netPnLPercent, mfe)

  return {
    symbol,
    side,
    entryPrice,
    exitPrice,
    quantity,
    grossPnL,
    netPnL,
    netPnLPercent,
    totalFees,
    initialRisk,
    rMultiple,
    holdDurationMs,
    holdDurationHuman: formatDuration(holdDurationMs),
    mae,
    mfe,
    efficiencyRatio,
    timestamp: exitTimestamp,
  }
}

// ─── Computation Helpers ─────────────────────────────────────────────────────

function computeGrossPnL(
  side: string,
  entry: number,
  exit: number,
  qty: number,
): number {
  if (side === 'sell') return (entry - exit) * qty
  return (exit - entry) * qty
}

function computeEfficiency(netPnLPct: number, mfe: number): number {
  if (mfe <= 0) return 0
  const raw = (Math.abs(netPnLPct) / Math.abs(mfe)) * 100
  return Math.min(100, Math.round(raw))
}

async function computeInitialRisk(
  symbol: string,
  entryPrice: number,
  quantity: number,
  exchange: ExchangeInterface,
): Promise<number> {
  try {
    const openOrders = await exchange.getOpenOrders(symbol)
    const stopOrder = openOrders.find(
      (o) => o.type === 'stop_loss' && o.side === 'sell',
    )
    if (stopOrder?.stopPrice) {
      return Math.abs(entryPrice - stopOrder.stopPrice) * quantity
    }
  } catch {
    // Fall through to ATR-based estimate
  }

  return computeATRBasedRisk(symbol, entryPrice, quantity, exchange)
}

async function computeATRBasedRisk(
  symbol: string,
  entryPrice: number,
  quantity: number,
  exchange: ExchangeInterface,
): Promise<number> {
  try {
    const candles = await exchange.getCandles(symbol, '4h', 20)
    const atr = computeATR(candles)
    if (atr > 0) return atr * quantity
  } catch {
    // Fall through to percentage-based fallback
  }

  return entryPrice * quantity * 0.02
}

function estimateHoldDuration(
  exitTimestamp: number,
  openedAtEstimate: number,
): number {
  if (openedAtEstimate > 0 && exitTimestamp > openedAtEstimate) {
    return exitTimestamp - openedAtEstimate
  }
  return 4 * MS_PER_HOUR
}

async function fetchMAEMFE(
  symbol: string,
  entryPrice: number,
  side: string,
  holdDurationMs: number,
  exchange: ExchangeInterface,
): Promise<MAEMFEResult> {
  try {
    const candleCount = Math.max(10, Math.ceil(holdDurationMs / MS_PER_HOUR))
    const limit = Math.min(candleCount, 500)
    const candles = await exchange.getCandles(symbol, '1h', limit)
    return calculateMAEMFE(entryPrice, candles, side)
  } catch {
    return { mae: 0, mfe: 0 }
  }
}

// ─── Terminal Report Formatting ──────────────────────────────────────────────

/**
 * Formats a TradeReport into a terminal-friendly display string.
 * Includes P&L, R-multiple, hold time, MAE/MFE, and rolling stats.
 */
export function formatTradeReport(
  report: TradeReport,
  rollingStats?: { winRate: number; avgR: number; expectancy: number },
): string {
  const sideLabel = report.side === 'buy' ? 'LONG' : 'SHORT'
  const pnlSign = report.netPnL >= 0 ? '+' : ''
  const pctSign = report.netPnLPercent >= 0 ? '+' : ''

  const pnlStr = `${pnlSign}$${formatNum(report.netPnL)}`
  const pctStr = `${pctSign}${report.netPnLPercent.toFixed(2)}%`
  const rStr = `${report.rMultiple.toFixed(2)}R`

  const maeStr = `${report.mae.toFixed(2)}%`
  const mfeStr = `+${Math.abs(report.mfe).toFixed(2)}%`
  const effStr = `${report.efficiencyRatio}%`

  const lines: string[] = []
  const ruler = '\u2501'.repeat(40)
  lines.push(`\u2501\u2501\u2501 Trade Closed ${ruler.slice(14)}`)
  lines.push(`${report.symbol} ${sideLabel} | ${pnlStr} (${pctStr})`)
  lines.push(
    `Entry: $${formatNum(report.entryPrice)} \u00D7 ${formatQty(report.quantity)} | Exit: $${formatNum(report.exitPrice)}`,
  )
  lines.push(`R-Multiple: ${rStr} | Hold: ${report.holdDurationHuman}`)
  lines.push(`MAE: ${maeStr} | MFE: ${mfeStr} | Efficiency: ${effStr}`)

  if (rollingStats) {
    const wrStr = `${Math.round(rollingStats.winRate)}% WR`
    const avgRStr = `${rollingStats.avgR.toFixed(1)} avg R`
    const expStr = `${rollingStats.expectancy.toFixed(2)} expectancy`
    lines.push(`Rolling: ${wrStr} | ${avgRStr} | ${expStr}`)
  }

  lines.push(ruler)
  return lines.join('\n')
}

// ─── Number Formatting Helpers ───────────────────────────────────────────────

function formatNum(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1) {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }
  if (abs === 0) return '0.00'
  const decimals = Math.max(2, Math.min(6, -Math.floor(Math.log10(abs)) + 2))
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function formatQty(value: number): string {
  if (Number.isInteger(value)) return value.toLocaleString('en-US')
  const decimals = Math.min(8, String(value).split('.')[1]?.length ?? 2)
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: decimals,
  })
}
