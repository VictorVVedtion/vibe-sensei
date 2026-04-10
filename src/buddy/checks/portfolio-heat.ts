/**
 * Portfolio Heat gate check — measures total portfolio exposure.
 * Reuses the existing position-based heat calculation.
 *
 * When the multi-venue aggregator is available, an async variant
 * uses USD-normalized equity for accurate cross-venue risk assessment.
 */

import type { Position, Balance } from '../../services/exchange/types.js'
import type { CheckResult, GateInput } from '../../tools/PreTradeGateTool/types.js'
import { totalPortfolioValue, totalNotionalValue, tryGetAggregatedEquity } from './utils.js'
import type { ThresholdConfig } from '../thresholds.js'

const DEFAULT_WARN = 0.10  // < 10%
const DEFAULT_FAIL = 0.20  // 10-20%, > 20% = fail

/**
 * Synchronous portfolio heat check using local venue data only.
 * This is the default path called by gateEvaluator.
 */
export function checkPortfolioHeat(
  input: GateInput,
  positions: Position[],
  balances: Balance[],
  thresholds?: ThresholdConfig,
): CheckResult {
  return checkPortfolioHeatCore(input, positions, balances, thresholds)
}

/**
 * Async variant that uses USD-normalized equity from the multi-venue aggregator
 * when available. Falls back to local data on any failure.
 */
export async function checkPortfolioHeatWithAggregation(
  input: GateInput,
  positions: Position[],
  balances: Balance[],
  thresholds?: ThresholdConfig,
): Promise<CheckResult> {
  const equity = await tryGetAggregatedEquity()
  return checkPortfolioHeatCore(input, positions, balances, thresholds, equity)
}

/** Core heat calculation used by both sync and async paths. */
function checkPortfolioHeatCore(
  input: GateInput,
  positions: Position[],
  balances: Balance[],
  thresholds?: ThresholdConfig,
  overrideEquity?: number | null,
): CheckResult {
  const warnAt = thresholds?.warn ?? DEFAULT_WARN
  const failAt = thresholds?.critical ?? DEFAULT_FAIL
  const limitPct = (failAt * 100).toFixed(0)

  const portfolio = overrideEquity ?? totalPortfolioValue(balances)
  if (portfolio <= 0) {
    return {
      name: 'Portfolio Heat',
      status: 'pass',
      message: 'No portfolio value to measure heat against',
    }
  }

  const currentNotional = totalNotionalValue(positions)
  const newOrderPrice = input.price ?? positions.find(p => p.symbol === input.symbol)?.currentPrice ?? 0
  const newNotional = input.quantity * newOrderPrice
  const totalHeat = (currentNotional + newNotional) / portfolio
  const pct = (totalHeat * 100).toFixed(1)
  const label = overrideEquity ? 'Portfolio Heat (cross-venue)' : 'Portfolio Heat'

  if (totalHeat < warnAt) {
    return { name: label, status: 'pass', message: `${pct}% (limit ${limitPct}%)` }
  }

  if (totalHeat <= failAt) {
    return {
      name: label,
      status: 'warn',
      message: `${pct}% heat approaching limit (${limitPct}%)`,
      recommendation: 'Consider reducing open exposure before adding positions',
    }
  }

  return {
    name: label,
    status: 'fail',
    message: `${pct}% exceeds ${limitPct}% heat limit`,
    recommendation: 'Close or reduce existing positions before opening new ones',
  }
}

