/**
 * Funding Rate Impact check for perpetual futures.
 * Annualizes the funding rate (3 funding periods per day) and flags
 * when the cost of holding a position becomes excessive.
 *
 * Thresholds:
 *   pass: annualized < 20%
 *   warn: 20% <= annualized <= 50%
 *   fail: annualized > 50%
 */

import type { VerticalContext } from '../../verticals.js'
import type { CheckResult } from '../../../tools/PreTradeGateTool/types.js'

const PASS_MAX = 20
const WARN_MAX = 50

/** 3 funding periods per day * 365 days. */
const ANNUALIZATION_FACTOR = 3 * 365

export function checkFundingRateImpact(ctx: VerticalContext): CheckResult {
  const fundingRate = ctx.fundingRate

  if (fundingRate === undefined) {
    return {
      name: 'Futures: Funding',
      status: 'pass',
      message: 'No funding rate data available — skipping check',
    }
  }

  const annualized = Math.abs(fundingRate) * ANNUALIZATION_FACTOR * 100
  const pct = annualized.toFixed(1)
  const direction = fundingRate >= 0 ? 'paying' : 'receiving'

  if (annualized < PASS_MAX) {
    return {
      name: 'Futures: Funding',
      status: 'pass',
      message: `${pct}% annualized funding (${direction}) — manageable`,
    }
  }

  if (annualized <= WARN_MAX) {
    return {
      name: 'Futures: Funding',
      status: 'warn',
      message: `${pct}% annualized funding (${direction}) — eating into profits`,
      recommendation: 'Consider closing before the next funding period or switching to spot',
    }
  }

  return {
    name: 'Futures: Funding',
    status: 'fail',
    message: `${pct}% annualized funding (${direction}) — extreme cost`,
    recommendation: 'Funding cost exceeds any reasonable trade thesis. Close or switch to spot.',
  }
}
