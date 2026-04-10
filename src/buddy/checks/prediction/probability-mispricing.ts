/**
 * Probability mispricing check for prediction markets.
 * Warns when betting at extreme probability levels where edge is unlikely.
 *
 * Thresholds:
 *   PASS:     10-90%
 *   WARNING:  5-10% or 90-95%
 *   CRITICAL: < 5% or > 95%
 */

import type { PredictionPosition } from '../../../services/exchange/types.js'
import type { RiskAlert, Severity } from '../../guardian.js'

const EXTREME_LOW = 0.05
const WARN_LOW = 0.10
const WARN_HIGH = 0.90
const EXTREME_HIGH = 0.95

export interface MispricingContext {
  positions: PredictionPosition[]
  masterId: string
  masterName: string
  masterQuote: string
}

export function checkProbabilityMispricing(
  ctx: MispricingContext,
): RiskAlert | null {
  if (ctx.positions.length === 0) return null

  for (const pos of ctx.positions) {
    const price = pos.avgPrice

    let severity: Severity | null = null
    let description = ''

    if (price < EXTREME_LOW || price > EXTREME_HIGH) {
      severity = 'CRITICAL'
      description = price < EXTREME_LOW
        ? `buying at ${(price * 100).toFixed(1)}% — almost certainly mispriced or zero edge`
        : `buying at ${(price * 100).toFixed(1)}% — paying max premium for minimal upside`
    } else if (price < WARN_LOW || price > WARN_HIGH) {
      severity = 'WARNING'
      description = price < WARN_LOW
        ? `buying at ${(price * 100).toFixed(1)}% — very low probability, high risk`
        : `buying at ${(price * 100).toFixed(1)}% — very high premium for small edge`
    }

    if (severity) {
      return {
        severity,
        masterId: ctx.masterId,
        masterName: ctx.masterName,
        message: `${ctx.masterName}: ${pos.marketId} ${pos.outcome} ${description}. "${ctx.masterQuote}"`,
        checkName: 'probability-mispricing',
        timestamp: new Date(),
      }
    }
  }

  return null
}
