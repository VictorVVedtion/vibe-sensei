/**
 * Slippage Tolerance Check — warns when DEX swap slippage is excessive.
 *
 * Thresholds:
 *   - PASS: estimatedSlippage < 0.5%
 *   - WARNING: 0.5% <= estimatedSlippage <= 2%
 *   - CRITICAL: estimatedSlippage > 2%
 *
 * Uses VerticalContext.estimatedSlippage from the DeFi vertical.
 */

import type { VerticalContext } from '../../verticals.js'
import type { RiskAlert, Severity } from '../../guardian.js'

const WARN_THRESHOLD = 0.005   // 0.5%
const CRITICAL_THRESHOLD = 0.02 // 2%

export function checkSlippageTolerance(
  ctx: VerticalContext,
  masterId: string,
  masterName: string,
  masterQuote: string,
): RiskAlert | null {
  if (ctx.vertical !== 'defi_dex') return null
  if (ctx.estimatedSlippage === undefined) return null

  const slippage = ctx.estimatedSlippage
  let severity: Severity | null = null

  if (slippage > CRITICAL_THRESHOLD) {
    severity = 'CRITICAL'
  } else if (slippage >= WARN_THRESHOLD) {
    severity = 'WARNING'
  }

  if (severity === null) return null

  const pct = (slippage * 100).toFixed(2)
  return {
    severity,
    masterId,
    masterName,
    message: `${masterName}: Slippage at ${pct}% is ${severity === 'CRITICAL' ? 'dangerously high' : 'elevated'}. "${masterQuote}"`,
    checkName: 'slippage-tolerance',
    timestamp: new Date(),
  }
}
