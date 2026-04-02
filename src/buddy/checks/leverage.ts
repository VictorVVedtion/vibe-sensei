/**
 * Leverage check — warns when effective leverage exceeds 2x.
 * Effective leverage = total notional value / total portfolio value.
 * WARNING at >2x, CRITICAL at >5x.
 */

import type { Position, Balance } from '../../services/exchange/types.js'
import type { RiskAlert, Severity } from '../guardian.js'

const WARNING_THRESHOLD = 2
const CRITICAL_THRESHOLD = 5

function totalNotionalValue(positions: Position[]): number {
  return positions.reduce(
    (sum, pos) => sum + Math.abs(pos.quantity) * pos.currentPrice,
    0,
  )
}

function totalPortfolioValue(balances: Balance[]): number {
  return balances.reduce((sum, b) => sum + b.total, 0)
}

export function checkLeverage(
  positions: Position[],
  balances: Balance[],
  masterId: string,
  masterName: string,
  masterQuote: string,
): RiskAlert | null {
  if (positions.length === 0) return null

  const portfolio = totalPortfolioValue(balances)
  if (portfolio <= 0) return null

  const notional = totalNotionalValue(positions)
  const leverage = notional / portfolio

  let severity: Severity | null = null
  if (leverage >= CRITICAL_THRESHOLD) {
    severity = 'CRITICAL'
  } else if (leverage >= WARNING_THRESHOLD) {
    severity = 'WARNING'
  }

  if (severity === null) return null

  const leverageStr = leverage.toFixed(1)
  return {
    severity,
    masterId,
    masterName,
    message: `${masterName}: Effective leverage at ${leverageStr}x. "${masterQuote}"`,
    checkName: 'leverage',
    timestamp: new Date(),
  }
}
