/**
 * Vertical dispatcher for options risk checks.
 *
 * Runs all 4 options-specific checks given a VerticalContext
 * and returns aggregated results. Called from the guardian
 * system when the active vertical is 'crypto_options'.
 */

import type { VerticalContext } from '../../verticals.js'
import type { OptionsCheckResult } from './types.js'
import { checkGreeksExposure } from './greeks-exposure.js'
import { checkThetaDecay } from './theta-decay.js'
import { checkIvCrushRisk } from './iv-crush-risk.js'
import { checkMaxLoss } from './max-loss-check.js'

/**
 * Run all options guardian checks for the given vertical context.
 * Returns one result per check (4 total).
 */
export function runOptionsChecks(ctx: VerticalContext): OptionsCheckResult[] {
  const results: OptionsCheckResult[] = []

  // Greeks exposure: use net delta from greeks
  const netDelta = ctx.greeks?.delta ?? 0
  results.push(checkGreeksExposure(netDelta))

  // Theta decay: use daysToExpiry
  const dte = ctx.daysToExpiry ?? 999
  const symbol = `${ctx.optionType ?? 'option'}@${ctx.strikePrice ?? 0}`
  results.push(checkThetaDecay(dte, symbol))

  // IV crush risk: use iv as rank proxy, daysToExpiry as event proxy
  const ivRank = (ctx.iv ?? 0) * 100
  const daysToEvent = ctx.daysToExpiry ?? 999
  results.push(checkIvCrushRisk(ivRank, daysToEvent, symbol))

  // Max loss: null for naked shorts (sell without defined max loss)
  const maxLossPercent = computeMaxLossPercent(ctx)
  results.push(checkMaxLoss(maxLossPercent, 100, symbol))

  return results
}

/**
 * Compute max loss as a percentage of portfolio.
 * Returns null for naked/uncovered short positions (undefined risk).
 */
function computeMaxLossPercent(ctx: VerticalContext): number | null {
  // Naked short options have undefined max loss
  if (ctx.optionType === 'call' && !ctx.greeks) {
    return null
  }

  // If we have greeks and strike info, compute a bounded estimate
  if (ctx.strikePrice && ctx.strikePrice > 0) {
    // For bought options, max loss = premium paid (approximated by vega * iv)
    const premium = Math.abs(ctx.greeks?.vega ?? 0) * (ctx.iv ?? 0.5)
    if (premium > 0) return premium
    // Fallback: use a conservative 2% estimate for defined-risk positions
    return 2
  }

  return 2
}
