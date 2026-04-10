/**
 * Concentration check — warns when a single position exceeds threshold of portfolio.
 * Default: WARNING at >40%, CRITICAL at >70%.
 * With ThresholdConfig: uses dynamic values from archetype/stat/regime system.
 */

import type { Position, Balance } from '../../services/exchange/types.js'
import type { RiskAlert, Severity } from '../guardian.js'
import type { ThresholdConfig } from '../thresholds.js'
import { totalPortfolioValue, positionNotional } from './utils.js'

const DEFAULT_WARNING = 0.4  // 40%
const DEFAULT_CRITICAL = 0.7 // 70%

export function checkConcentration(
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

  const warnAt = thresholds?.warn ?? DEFAULT_WARNING
  const critAt = thresholds?.critical ?? DEFAULT_CRITICAL

  let worstPos: Position | null = null
  let worstRatio = 0

  for (const pos of positions) {
    const ratio = positionNotional(pos) / portfolio
    if (ratio > worstRatio) {
      worstRatio = ratio
      worstPos = pos
    }
  }

  if (worstPos === null) return null

  let severity: Severity | null = null
  if (worstRatio >= critAt) {
    severity = 'CRITICAL'
  } else if (worstRatio >= warnAt) {
    severity = 'WARNING'
  }

  if (severity === null) return null

  const pct = (worstRatio * 100).toFixed(1)
  return {
    severity,
    masterId,
    masterName,
    message: `${masterName}: ${worstPos.symbol} is ${pct}% of portfolio — too concentrated. "${masterQuote}"`,
    checkName: 'concentration',
    timestamp: new Date(),
  }
}
