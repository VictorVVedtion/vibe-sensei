/**
 * Portfolio Heat Calculator — measures total portfolio risk exposure.
 *
 * "Heat" is the percentage of total equity at risk across all open positions.
 *
 * For positions with a stop-loss:
 *   risk = |entryPrice - stopPrice| * quantity
 *
 * For positions without a stop-loss:
 *   risk = entryPrice * quantity * 0.10 (assumes 10% max adverse move)
 *
 * Heat% = sum(risks) / totalEquity * 100
 *
 * The riskScore (0-100) maps heat percentage to a normalized score
 * suitable for display in the trading dashboard.
 */

import type { Balance, Order, Position } from '../exchange/types.js'

// ── Types ──────────────────────────────────────────────────────────────────

/** Risk breakdown for a single position. */
export interface PositionRisk {
  /** Trading pair symbol. */
  symbol: string
  /** Dollar risk for this position. */
  risk: number
  /** Whether this position has a stop-loss order. */
  hasStopLoss: boolean
  /** Stop-loss price if available. */
  stopPrice: number | null
  /** Entry price of the position. */
  entryPrice: number
  /** Position quantity. */
  quantity: number
}

/** Aggregated portfolio heat metrics. */
export interface HeatMetrics {
  /** Total dollar risk across all positions. */
  totalRisk: number
  /** Total portfolio equity (sum of all balance totals). */
  totalEquity: number
  /** Heat percentage: totalRisk / totalEquity * 100. */
  heatPercent: number
  /** Normalized risk score (0-100) for dashboard display. */
  riskScore: number
  /** Per-position risk breakdown. */
  positions: PositionRisk[]
}

// ── Constants ──────────────────────────────────────────────────────────────

/** Default adverse move assumption when no stop-loss is set. */
const DEFAULT_ADVERSE_MOVE = 0.10

/** Heat percentage thresholds for risk score mapping. */
const HEAT_SCORE_THRESHOLDS = {
  /** Heat% at which risk score hits 100. */
  maxHeat: 20,
} as const

// ── Stop-loss Matching ─────────────────────────────────────────────────────

/**
 * Find the stop-loss order for a given position, if one exists.
 * Matches by symbol + opposite side (sell stop for long, buy stop for short).
 */
function findStopLoss(
  position: Position,
  openOrders: Order[],
): Order | null {
  const stopSide = position.side === 'buy' ? 'sell' : 'buy'

  for (const order of openOrders) {
    if (order.type !== 'stop_loss') continue
    if (order.symbol !== position.symbol) continue
    if (order.side !== stopSide) continue
    if (order.status !== 'open') continue
    return order
  }

  return null
}

// ── Risk Calculation ───────────────────────────────────────────────────────

/**
 * Calculate dollar risk for a single position.
 *
 * With stop-loss: risk = |entry - stop| * quantity
 * Without stop-loss: risk = entry * quantity * 10%
 */
function calculatePositionRisk(
  position: Position,
  openOrders: Order[],
): PositionRisk {
  const stopOrder = findStopLoss(position, openOrders)
  const qty = Math.abs(position.quantity)

  let risk: number
  let hasStopLoss: boolean
  let stopPrice: number | null = null

  if (stopOrder && stopOrder.stopPrice != null) {
    hasStopLoss = true
    stopPrice = stopOrder.stopPrice
    risk = Math.abs(position.entryPrice - stopPrice) * qty
  } else {
    hasStopLoss = false
    risk = position.entryPrice * qty * DEFAULT_ADVERSE_MOVE
  }

  return {
    symbol: position.symbol,
    risk,
    hasStopLoss,
    stopPrice,
    entryPrice: position.entryPrice,
    quantity: qty,
  }
}

/**
 * Compute total portfolio equity from balance entries.
 * Sums the `total` field (free + used) across all currencies.
 */
function computeTotalEquity(balances: Balance[]): number {
  let equity = 0
  for (const b of balances) {
    equity += b.total
  }
  return equity
}

// ── Risk Score Mapping ─────────────────────────────────────────────────────

/**
 * Convert heat percentage to a 0-100 risk score.
 *
 * Linear mapping: 0% heat = 0 score, maxHeat% = 100 score.
 * Clamped to [0, 100].
 */
export function riskScoreFromHeat(heatPercent: number): number {
  if (heatPercent <= 0) return 0
  const score = (heatPercent / HEAT_SCORE_THRESHOLDS.maxHeat) * 100
  return Math.min(100, Math.round(score))
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Calculate portfolio heat metrics from current positions, balances,
 * and open orders.
 *
 * Returns zeroed metrics when there are no positions.
 * Handles zero equity gracefully (returns 0 heat, not Infinity).
 *
 * @param positions — Current open positions
 * @param balances — Current account balances
 * @param openOrders — Current open orders (used to find stop-losses)
 */
export function calculatePortfolioHeat(
  positions: Position[],
  balances: Balance[],
  openOrders: Order[],
): HeatMetrics {
  // No positions = no risk
  if (positions.length === 0) {
    return {
      totalRisk: 0,
      totalEquity: computeTotalEquity(balances),
      heatPercent: 0,
      riskScore: 0,
      positions: [],
    }
  }

  const totalEquity = computeTotalEquity(balances)
  const positionRisks = positions.map((p) =>
    calculatePositionRisk(p, openOrders),
  )

  let totalRisk = 0
  for (const pr of positionRisks) {
    totalRisk += pr.risk
  }

  // Guard against division by zero
  const heatPercent = totalEquity > 0
    ? (totalRisk / totalEquity) * 100
    : 0

  return {
    totalRisk,
    totalEquity,
    heatPercent,
    riskScore: riskScoreFromHeat(heatPercent),
    positions: positionRisks,
  }
}
