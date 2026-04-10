/**
 * Daily Loss Limit gate check — tracks today's realized + unrealized losses.
 * Uses current positions' unrealizedPnl as a simplified loss tracker.
 * pass: < 3% | warn: 3-5% | fail: > 5%
 */

import type { Position, Balance } from '../../services/exchange/types.js'
import type { CheckResult } from '../../tools/PreTradeGateTool/types.js'
import { totalPortfolioValue } from './utils.js'

const PASS_THRESHOLD = 0.03  // 3%
const WARN_THRESHOLD = 0.05  // 5%

export function checkDailyLossLimit(
  positions: Position[],
  balances: Balance[],
): CheckResult {
  const equity = totalPortfolioValue(balances)
  if (equity <= 0) {
    return {
      name: 'Daily Loss',
      status: 'pass',
      message: 'no equity to measure losses against',
    }
  }

  const totalUnrealizedPnl = positions.reduce(
    (sum, p) => sum + p.unrealizedPnl,
    0,
  )

  // Only count losses (negative PnL)
  if (totalUnrealizedPnl >= 0) {
    const pct = ((totalUnrealizedPnl / equity) * 100).toFixed(1)
    return {
      name: 'Daily Loss',
      status: 'pass',
      message: `${pct >= '0' ? '+' : ''}${pct}% (limit 5%)`,
    }
  }

  const lossRatio = Math.abs(totalUnrealizedPnl) / equity
  const pct = (lossRatio * 100).toFixed(1)

  if (lossRatio < PASS_THRESHOLD) {
    return {
      name: 'Daily Loss',
      status: 'pass',
      message: `-${pct}% (limit 5%)`,
    }
  }

  if (lossRatio <= WARN_THRESHOLD) {
    return {
      name: 'Daily Loss',
      status: 'warn',
      message: `-${pct}% approaching daily limit (5%)`,
      recommendation: 'Consider closing losing positions before adding new risk',
    }
  }

  return {
    name: 'Daily Loss',
    status: 'fail',
    message: `-${pct}% exceeds 5% daily loss limit`,
    recommendation: 'Stop trading for today; close losing positions to limit damage',
  }
}
