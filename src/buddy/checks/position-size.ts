/**
 * Position-size check — warns when a single position exceeds 30% of total portfolio.
 */

import type { Position, Balance } from '../../services/exchange/types.js'
import type { RiskAlert } from '../guardian.js'

/**
 * Calculate total portfolio value from balances.
 * Uses the `total` field on each balance entry (free + used).
 */
function totalPortfolioValue(balances: Balance[]): number {
  return balances.reduce((sum, b) => sum + b.total, 0)
}

/**
 * Calculate notional value of a position (quantity * currentPrice).
 */
function positionNotional(pos: Position): number {
  return Math.abs(pos.quantity) * pos.currentPrice
}

const THRESHOLD = 0.3 // 30%

export function checkPositionSize(
  positions: Position[],
  balances: Balance[],
  masterId: string,
  masterName: string,
  masterQuote: string,
): RiskAlert | null {
  const portfolio = totalPortfolioValue(balances)
  if (portfolio <= 0) return null

  for (const pos of positions) {
    const notional = positionNotional(pos)
    const ratio = notional / portfolio

    if (ratio > THRESHOLD) {
      const pct = (ratio * 100).toFixed(1)
      return {
        severity: 'WARNING',
        masterId,
        masterName,
        message: `${masterName}: ${pos.symbol} is ${pct}% of your portfolio. "${masterQuote}"`,
        checkName: 'position-size',
        timestamp: new Date(),
      }
    }
  }

  return null
}
