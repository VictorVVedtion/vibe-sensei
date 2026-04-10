/**
 * Impermanent Loss Check — warns on estimated impermanent loss risk.
 *
 * Thresholds:
 *   - PASS: < 2%
 *   - WARNING: 2% - 5%
 *   - CRITICAL: > 5%
 *
 * Uses VerticalContext.estimatedSlippage as a proxy for IL risk:
 * higher slippage correlates with greater price divergence, which
 * directly drives impermanent loss in AMM pools.
 */

import type { VerticalContext } from '../../verticals.js'
import type { RiskAlert, Severity } from '../../guardian.js'

const WARN_THRESHOLD = 0.02   // 2%
const CRITICAL_THRESHOLD = 0.05 // 5%

export function checkImpermanentLoss(
  ctx: VerticalContext,
  masterId: string,
  masterName: string,
  masterQuote: string,
): RiskAlert | null {
  if (ctx.vertical !== 'defi_dex') return null
  if (ctx.estimatedSlippage === undefined) return null

  // Use slippage as IL proxy — high slippage = high price divergence = IL risk
  const ilEstimate = ctx.estimatedSlippage
  let severity: Severity | null = null

  if (ilEstimate > CRITICAL_THRESHOLD) {
    severity = 'CRITICAL'
  } else if (ilEstimate >= WARN_THRESHOLD) {
    severity = 'WARNING'
  }

  if (severity === null) return null

  const pct = (ilEstimate * 100).toFixed(2)
  return {
    severity,
    masterId,
    masterName,
    message: `${masterName}: Estimated impermanent loss risk at ${pct}%. "${masterQuote}"`,
    checkName: 'impermanent-loss',
    timestamp: new Date(),
  }
}
