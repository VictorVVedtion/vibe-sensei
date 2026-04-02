/**
 * Leverage check — warns when effective leverage exceeds threshold.
 * Effective leverage = total notional value / total portfolio value.
 * Default: WARNING at >2x, CRITICAL at >5x.
 * With ThresholdConfig: uses dynamic values from archetype/stat/regime system.
 */

import type { Position, Balance } from '../../services/exchange/types.js'
import type { RiskAlert, Severity } from '../guardian.js'
import type { ThresholdConfig } from '../thresholds.js'
import { totalPortfolioValue, totalNotionalValue } from './utils.js'

const DEFAULT_WARNING = 2
const DEFAULT_CRITICAL = 5

export function checkLeverage(
  positions: Position[],
  balances: Balance[],
  masterId: string,
  masterName: string,
  masterQuote: string,
  thresholds?: ThresholdConfig,
): RiskAlert | null {
  if (positions.length === 0) return null

  const portfolio = totalPortfolioValue(balances)
  if (portfolio <= 0) return null

  const notional = totalNotionalValue(positions)
  const leverage = notional / portfolio

  const warnAt = thresholds?.warn ?? DEFAULT_WARNING
  const critAt = thresholds?.critical ?? DEFAULT_CRITICAL

  let severity: Severity | null = null
  if (leverage >= critAt) {
    severity = 'CRITICAL'
  } else if (leverage >= warnAt) {
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
