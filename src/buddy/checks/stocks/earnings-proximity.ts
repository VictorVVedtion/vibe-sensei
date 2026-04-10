/**
 * Earnings Proximity check for stock trading.
 * Warns when trading near an earnings announcement.
 *
 * Thresholds:
 *   pass:  > 7 days to earnings (or no earnings date known)
 *   warn:  3-7 days to earnings
 *   fail:  < 3 days to earnings (high IV, gap risk)
 */

import type { VerticalContext } from '../../verticals.js'
import type { CheckResult } from '../../../tools/PreTradeGateTool/types.js'

const SAFE_DAYS = 7
const WARN_DAYS = 3

export function checkEarningsProximity(ctx: VerticalContext): CheckResult {
  const daysToEarnings = ctx.daysToEarnings

  // No earnings data available — assume safe
  if (daysToEarnings == null || daysToEarnings < 0) {
    return {
      name: 'Stocks: Earnings',
      status: 'pass',
      message: 'No upcoming earnings date detected',
    }
  }

  if (daysToEarnings > SAFE_DAYS) {
    return {
      name: 'Stocks: Earnings',
      status: 'pass',
      message: `Earnings in ${daysToEarnings} days — safe distance`,
    }
  }

  if (daysToEarnings >= WARN_DAYS) {
    return {
      name: 'Stocks: Earnings',
      status: 'warn',
      message: `Earnings in ${daysToEarnings} days — elevated volatility expected`,
      recommendation: 'Consider reducing position size or hedging. IV crush after earnings can destroy option value.',
    }
  }

  // < 3 days to earnings
  return {
    name: 'Stocks: Earnings',
    status: 'fail',
    message: `Earnings in ${daysToEarnings} day(s) — extreme gap risk`,
    recommendation: 'Earnings within 3 days. Stock can gap 10-20%+ overnight. Reduce position or accept binary risk.',
  }
}
