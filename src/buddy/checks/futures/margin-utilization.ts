/**
 * Margin Utilization check for perpetual futures.
 * Measures what percentage of available margin is currently in use.
 *
 * Thresholds:
 *   pass:      < 50%
 *   warn:      50% - 75%
 *   fail:      75% - 90%
 *   emergency: > 90%
 */

import type { VerticalContext } from '../../verticals.js'
import type { CheckResult } from '../../../tools/PreTradeGateTool/types.js'

const PASS_MAX = 50
const WARN_MAX = 75
const FAIL_MAX = 90

export function checkMarginUtilization(ctx: VerticalContext): CheckResult {
  const utilization = ctx.marginUtilization

  if (utilization === undefined) {
    return {
      name: 'Futures: Margin',
      status: 'pass',
      message: 'No margin utilization data available — skipping check',
    }
  }

  const pct = utilization.toFixed(1)

  if (utilization < PASS_MAX) {
    return {
      name: 'Futures: Margin',
      status: 'pass',
      message: `${pct}% margin used (safe below ${PASS_MAX}%)`,
    }
  }

  if (utilization <= WARN_MAX) {
    return {
      name: 'Futures: Margin',
      status: 'warn',
      message: `${pct}% margin used — limited buffer remaining`,
      recommendation: 'Free up margin by closing or reducing positions',
    }
  }

  if (utilization <= FAIL_MAX) {
    return {
      name: 'Futures: Margin',
      status: 'fail',
      message: `${pct}% margin used — dangerously thin buffer`,
      recommendation: 'Reduce positions immediately. A small adverse move will trigger margin call.',
    }
  }

  return {
    name: 'Futures: Margin',
    status: 'emergency',
    message: `EMERGENCY: ${pct}% margin used — margin call imminent`,
    recommendation: 'Close positions NOW or deposit additional margin to avoid forced liquidation.',
  }
}
