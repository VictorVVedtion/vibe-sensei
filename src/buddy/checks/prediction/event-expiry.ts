/**
 * Event expiry check for prediction markets.
 * Warns when betting on events that are about to expire.
 *
 * Thresholds:
 *   PASS:     > 7 days until expiry
 *   WARNING:  1-7 days
 *   CRITICAL: < 24 hours
 */

import type { PredictionMarket, PredictionPosition } from '../../../services/exchange/types.js'
import type { RiskAlert, Severity } from '../../guardian.js'

const MS_PER_DAY = 24 * 60 * 60 * 1000
const CRITICAL_DAYS = 1
const WARN_DAYS = 7

export interface ExpiryContext {
  positions: PredictionPosition[]
  markets: PredictionMarket[]
  masterId: string
  masterName: string
  masterQuote: string
}

/**
 * Find the market object for a given position's marketId.
 */
function findMarket(
  markets: PredictionMarket[],
  marketId: string,
): PredictionMarket | undefined {
  return markets.find(m => m.id === marketId)
}

/**
 * Calculate days remaining until market end date.
 * Returns Infinity if no valid end date.
 */
function daysUntilExpiry(endDate: string): number {
  if (!endDate) return Infinity
  try {
    const end = new Date(endDate).getTime()
    const now = Date.now()
    return (end - now) / MS_PER_DAY
  } catch {
    return Infinity
  }
}

export function checkEventExpiry(
  ctx: ExpiryContext,
): RiskAlert | null {
  if (ctx.positions.length === 0) return null

  for (const pos of ctx.positions) {
    const market = findMarket(ctx.markets, pos.marketId)
    if (!market) continue

    const days = daysUntilExpiry(market.endDate)

    let severity: Severity | null = null
    let timeDesc = ''

    if (days < CRITICAL_DAYS) {
      severity = 'CRITICAL'
      const hours = Math.max(0, Math.floor(days * 24))
      timeDesc = hours <= 0 ? 'expired' : `${hours}h remaining`
    } else if (days <= WARN_DAYS) {
      severity = 'WARNING'
      timeDesc = `${Math.floor(days)} day${Math.floor(days) !== 1 ? 's' : ''} remaining`
    }

    if (severity) {
      return {
        severity,
        masterId: ctx.masterId,
        masterName: ctx.masterName,
        message: `${ctx.masterName}: ${market.question} — ${timeDesc}. "${ctx.masterQuote}"`,
        checkName: 'event-expiry',
        timestamp: new Date(),
      }
    }
  }

  return null
}
