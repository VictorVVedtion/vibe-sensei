/**
 * Drawdown check — warns when total unrealized PnL exceeds loss thresholds.
 * Default: WARNING at >10% drawdown, CRITICAL at >20%.
 * With ThresholdConfig: uses dynamic values from archetype/stat/regime system.
 */

import type { Position } from '../../services/exchange/types.js'
import type { RiskAlert, Severity } from '../guardian.js'
import type { ThresholdConfig } from '../thresholds.js'

const DEFAULT_WARNING = -10
const DEFAULT_CRITICAL = -20

export function checkDrawdown(
  positions: Position[],
  _balances: unknown,
  masterId: string,
  masterName: string,
  masterQuote: string,
  thresholds?: ThresholdConfig,
): RiskAlert | null {
  if (positions.length === 0) return null

  const totalPnlPct = positions.reduce(
    (sum, p) => sum + p.unrealizedPnlPercent,
    0,
  )

  const warnAt = thresholds?.warn ?? DEFAULT_WARNING
  const critAt = thresholds?.critical ?? DEFAULT_CRITICAL

  let severity: Severity | null = null
  if (totalPnlPct <= critAt) {
    severity = 'CRITICAL'
  } else if (totalPnlPct <= warnAt) {
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
