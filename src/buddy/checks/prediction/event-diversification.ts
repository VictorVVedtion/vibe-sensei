/**
 * Event diversification check for prediction markets.
 * Warns when too much capital is concentrated on a single event.
 *
 * Thresholds:
 *   PASS:     < 20% of prediction portfolio on single event
 *   WARNING:  20-35%
 *   CRITICAL: > 35%
 */

import type { PredictionPosition } from '../../../services/exchange/types.js'
import type { RiskAlert, Severity } from '../../guardian.js'

const WARN_THRESHOLD = 0.20
const CRITICAL_THRESHOLD = 0.35

export interface PredictionCheckContext {
  positions: PredictionPosition[]
  totalPredictionValue: number
  masterId: string
  masterName: string
  masterQuote: string
}

/**
 * Calculate total notional value of prediction positions.
 */
export function predictionPortfolioValue(
  positions: PredictionPosition[],
): number {
  return positions.reduce(
    (sum, p) => sum + p.shares * p.currentPrice,
    0,
  )
}

/**
 * Group positions by market and sum their notional values.
 */
function groupByMarket(
  positions: PredictionPosition[],
): Map<string, number> {
  const map = new Map<string, number>()
  for (const p of positions) {
    const notional = p.shares * p.currentPrice
    map.set(p.marketId, (map.get(p.marketId) ?? 0) + notional)
  }
  return map
}

export function checkEventDiversification(
  ctx: PredictionCheckContext,
): RiskAlert | null {
  if (ctx.positions.length === 0) return null
  if (ctx.totalPredictionValue <= 0) return null

  const marketValues = groupByMarket(ctx.positions)

  for (const [marketId, value] of marketValues) {
    const ratio = value / ctx.totalPredictionValue

    let severity: Severity | null = null
    if (ratio > CRITICAL_THRESHOLD) {
      severity = 'CRITICAL'
    } else if (ratio >= WARN_THRESHOLD) {
      severity = 'WARNING'
    }

    if (severity) {
      const pct = (ratio * 100).toFixed(1)
      return {
        severity,
        masterId: ctx.masterId,
        masterName: ctx.masterName,
        message: `${ctx.masterName}: ${pct}% of prediction portfolio on event ${marketId}. "${ctx.masterQuote}"`,
        checkName: 'event-diversification',
        timestamp: new Date(),
      }
    }
  }

  return null
}
