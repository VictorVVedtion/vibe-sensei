/**
 * Position-size check — warns when a single position exceeds threshold of total portfolio.
 * Default: WARNING at >30%.
 * With ThresholdConfig: uses dynamic values from archetype/stat/regime system.
 */

import type { Position, Balance } from '../../services/exchange/types.js'
import type { RiskAlert, Severity } from '../guardian.js'
import type { ThresholdConfig } from '../thresholds.js'
import { totalPortfolioValue, positionNotional } from './utils.js'

const DEFAULT_WARNING = 0.3 // 30%

export function checkPositionSize(
  positions: Position[],
  balances: Balance[],
  masterId: string,
  masterName: string,
  masterQuote: string,
  thresholds?: ThresholdConfig,
): RiskAlert | null {
  const portfolio = totalPortfolioValue(balances)
  if (portfolio <= 0) return null

  const warnAt = thresholds?.warn ?? DEFAULT_WARNING
  const critAt = thresholds?.critical ?? null

  for (const pos of positions) {
    const notional = positionNotional(pos)
    const ratio = notional / portfolio

    let severity: Severity | null = null
    if (critAt !== null && ratio > critAt) {
      severity = 'CRITICAL'
    } else if (ratio > warnAt) {
      severity = 'WARNING'
    }

    if (severity !== null) {
      const pct = (ratio * 100).toFixed(1)
      return {
        severity,
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
