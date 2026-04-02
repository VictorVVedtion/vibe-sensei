/**
 * Order validation (fat-finger) check — warns when any position shows
 * extreme unrealized PnL percentage, which may indicate a fat-finger entry.
 * Uses unrealizedPnlPercent as a proxy for price deviation from intended entry.
 * WARNING at >5% deviation, CRITICAL at >15%.
 */

import type { Position } from '../../services/exchange/types.js'
import type { RiskAlert, Severity } from '../guardian.js'

const WARNING_THRESHOLD = 5   // 5% unrealized PnL deviation
const CRITICAL_THRESHOLD = 15 // 15% unrealized PnL deviation

export function checkOrderValidation(
  positions: Position[],
  _balances: unknown,
  masterId: string,
  masterName: string,
  masterQuote: string,
): RiskAlert | null {
  if (positions.length === 0) return null

  let worstPos: Position | null = null
  let worstDeviation = 0

  for (const pos of positions) {
    const deviation = Math.abs(pos.unrealizedPnlPercent)
    if (deviation > worstDeviation) {
      worstDeviation = deviation
      worstPos = pos
    }
  }

  if (worstPos === null) return null

  let severity: Severity | null = null
  if (worstDeviation >= CRITICAL_THRESHOLD) {
    severity = 'CRITICAL'
  } else if (worstDeviation >= WARNING_THRESHOLD) {
    severity = 'WARNING'
  }

  if (severity === null) return null

  const pct = worstDeviation.toFixed(1)
  const direction = worstPos.unrealizedPnlPercent >= 0 ? '+' : '-'
  return {
    severity,
    masterId,
    masterName,
    message: `${masterName}: ${worstPos.symbol} at ${direction}${pct}% from entry — possible fat-finger. "${masterQuote}"`,
    checkName: 'order-validation',
    timestamp: new Date(),
  }
}
