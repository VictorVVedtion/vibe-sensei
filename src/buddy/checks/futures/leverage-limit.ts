/**
 * Leverage Limit check for perpetual futures.
 * Evaluates the leverage multiplier against tiered safety thresholds.
 *
 * Thresholds:
 *   pass:      leverage <= 5x
 *   warn:      5x < leverage <= 20x
 *   fail:      20x < leverage <= 50x
 *   emergency: leverage > 50x
 */

import type { VerticalContext } from '../../verticals.js'
import type { CheckResult } from '../../../tools/PreTradeGateTool/types.js'

const PASS_MAX = 5
const WARN_MAX = 20
const FAIL_MAX = 50

export function checkLeverageLimit(ctx: VerticalContext): CheckResult {
  const leverage = ctx.leverage ?? 1

  if (leverage <= PASS_MAX) {
    return {
      name: 'Futures: Leverage',
      status: 'pass',
      message: `${leverage}x leverage within safe range (limit ${PASS_MAX}x)`,
    }
  }

  if (leverage <= WARN_MAX) {
    return {
      name: 'Futures: Leverage',
      status: 'warn',
      message: `${leverage}x leverage is elevated (safe limit ${PASS_MAX}x)`,
      recommendation: `Reduce leverage to ${PASS_MAX}x or below to stay in safe range`,
    }
  }

  if (leverage <= FAIL_MAX) {
    return {
      name: 'Futures: Leverage',
      status: 'fail',
      message: `${leverage}x leverage is dangerous (limit ${WARN_MAX}x)`,
      recommendation: `Reduce leverage immediately — liquidation risk is extreme above ${WARN_MAX}x`,
    }
  }

  return {
    name: 'Futures: Leverage',
    status: 'emergency',
    message: `EMERGENCY: ${leverage}x leverage exceeds ${FAIL_MAX}x — liquidation imminent`,
    recommendation: 'Close or reduce position immediately. This leverage level is suicidal.',
  }
}
