/**
 * Drawdown check — warns when total unrealized PnL exceeds loss thresholds.
 * WARNING at >10% drawdown, CRITICAL at >20%.
 */

import type { Position } from '../../services/exchange/types.js'
import type { RiskAlert, Severity } from '../guardian.js'

const WARNING_THRESHOLD = -10
const CRITICAL_THRESHOLD = -20

export function checkDrawdown(
  positions: Position[],
  _balances: unknown,
  masterId: string,
  masterName: string,
  masterQuote: string,
): RiskAlert | null {
  if (positions.length === 0) return null

  const totalPnlPct = positions.reduce(
    (sum, p) => sum + p.unrealizedPnlPercent,
    0,
  )

  let severity: Severity | null = null
  if (totalPnlPct <= CRITICAL_THRESHOLD) {
    severity = 'CRITICAL'
  } else if (totalPnlPct <= WARNING_THRESHOLD) {
    severity = 'WARNING'
  }

  if (severity === null) return null

  const pct = totalPnlPct.toFixed(1)
  return {
    severity,
    masterId,
    masterName,
    message: `${masterName}: Portfolio drawdown at ${pct}%. "${masterQuote}"`,
    checkName: 'drawdown',
    timestamp: new Date(),
  }
}
