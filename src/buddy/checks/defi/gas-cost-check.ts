/**
 * Gas Cost Check — warns when gas fees consume too much of the trade value.
 *
 * Thresholds:
 *   - PASS: gas < 1% of trade value
 *   - WARNING: 1% <= gas <= 5%
 *   - CRITICAL: gas > 5%
 *
 * Uses VerticalContext.gasEstimateUSD alongside trade amount.
 */

import type { VerticalContext } from '../../verticals.js'
import type { RiskAlert, Severity } from '../../guardian.js'

const WARN_THRESHOLD = 0.01   // 1%
const CRITICAL_THRESHOLD = 0.05 // 5%

export function checkGasCost(
  ctx: VerticalContext,
  tradeValueUSD: number,
  masterId: string,
  masterName: string,
  masterQuote: string,
): RiskAlert | null {
  if (ctx.vertical !== 'defi_dex') return null
  if (ctx.gasEstimateUSD === undefined) return null
  if (tradeValueUSD <= 0) return null

  const gasRatio = ctx.gasEstimateUSD / tradeValueUSD
  let severity: Severity | null = null

  if (gasRatio > CRITICAL_THRESHOLD) {
    severity = 'CRITICAL'
  } else if (gasRatio >= WARN_THRESHOLD) {
    severity = 'WARNING'
  }

  if (severity === null) return null

  const pct = (gasRatio * 100).toFixed(2)
  return {
    severity,
    masterId,
    masterName,
    message: `${masterName}: Gas cost $${ctx.gasEstimateUSD.toFixed(2)} is ${pct}% of your trade. "${masterQuote}"`,
    checkName: 'gas-cost',
    timestamp: new Date(),
  }
}
