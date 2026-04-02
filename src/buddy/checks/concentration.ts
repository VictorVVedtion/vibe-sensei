/**
 * Concentration check — warns when a single position exceeds 40% of portfolio.
 * WARNING at >40%, CRITICAL at >70%.
 */

import type { Position, Balance } from '../../services/exchange/types.js'
import type { RiskAlert, Severity } from '../guardian.js'
import { totalPortfolioValue, positionNotional } from './utils.js'

const WARNING_THRESHOLD = 0.4  // 40%
const CRITICAL_THRESHOLD = 0.7 // 70%

export function checkConcentration(
  positions: Position[],
  balances: Balance[],
  masterId: string,
  masterName: string,
  masterQuote: string,
): RiskAlert | null {
  if (positions.length === 0) return null

  const portfolio = totalPortfolioValue(balances)
  if (portfolio <= 0) return null

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
  if (worstRatio >= CRITICAL_THRESHOLD) {
    severity = 'CRITICAL'
  } else if (worstRatio >= WARNING_THRESHOLD) {
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
