/**
 * DeFi DEX check registry — all DeFi-specific risk checks.
 *
 * These checks evaluate DeFi-specific risks: slippage, gas costs,
 * contract audit status, and impermanent loss.
 */

export { checkSlippageTolerance } from './slippage-tolerance.js'
export { checkGasCost } from './gas-cost-check.js'
export { checkContractAudit } from './contract-audit.js'
export { checkImpermanentLoss } from './impermanent-loss.js'

import type { VerticalContext } from '../../verticals.js'
import type { RiskAlert } from '../../guardian.js'
import { checkSlippageTolerance } from './slippage-tolerance.js'
import { checkGasCost } from './gas-cost-check.js'
import { checkContractAudit } from './contract-audit.js'
import { checkImpermanentLoss } from './impermanent-loss.js'

/**
 * Run all DeFi checks against the given vertical context.
 * Returns the first (highest priority) alert, or null if all pass.
 */
export function runDefiChecks(
  ctx: VerticalContext,
  tradeValueUSD: number,
  masterId: string,
  masterName: string,
  masterQuote: string,
): RiskAlert | null {
  const checks: Array<() => RiskAlert | null> = [
    () => checkSlippageTolerance(ctx, masterId, masterName, masterQuote),
    () => checkGasCost(ctx, tradeValueUSD, masterId, masterName, masterQuote),
    () => checkContractAudit(ctx, masterId, masterName, masterQuote),
    () => checkImpermanentLoss(ctx, masterId, masterName, masterQuote),
  ]

  for (const check of checks) {
    const alert = check()
    if (alert !== null) return alert
  }

  return null
}
