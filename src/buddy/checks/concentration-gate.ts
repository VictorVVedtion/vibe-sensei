/**
 * Concentration gate check — wraps existing concentration logic for pre-trade gate.
 * Checks if adding a new trade would over-concentrate the portfolio.
 * pass: < 30% | warn: 30-50% | fail: > 50%
 *
 * When the multi-venue aggregator is available, an async variant considers
 * positions across all connected venues for cross-venue concentration detection.
 */

import type { Position, Balance } from '../../services/exchange/types.js'
import type { CheckResult, GateInput } from '../../tools/PreTradeGateTool/types.js'
import { totalPortfolioValue, positionNotional, tryGetAggregatedEquity } from './utils.js'
import type { ThresholdConfig } from '../thresholds.js'

const DEFAULT_WARN = 0.30  // 30%
const DEFAULT_FAIL = 0.50  // 50%

/**
 * Synchronous concentration check using local venue data only.
 * This is the default path called by gateEvaluator.
 */
export function checkConcentrationGate(
  input: GateInput,
  positions: Position[],
  balances: Balance[],
  entryPrice: number,
  thresholds?: ThresholdConfig,
): CheckResult {
  return checkConcentrationCore(input, positions, balances, entryPrice, thresholds)
}

/**
 * Async variant that uses cross-venue USD equity from the aggregator
 * when available. Falls back to local data on any failure.
 */
export async function checkConcentrationGateWithAggregation(
  input: GateInput,
  positions: Position[],
  balances: Balance[],
  entryPrice: number,
  thresholds?: ThresholdConfig,
): Promise<CheckResult> {
  const crossVenue = await tryGetAggregatedEquity()
  return checkConcentrationCore(input, positions, balances, entryPrice, thresholds, crossVenue)
}

/** Core concentration calculation used by both sync and async paths. */
function checkConcentrationCore(
  input: GateInput,
  positions: Position[],
  balances: Balance[],
  entryPrice: number,
  thresholds?: ThresholdConfig,
  overrideEquity?: number | null,
): CheckResult {
  const warnAt = thresholds?.warn ?? DEFAULT_WARN
  const failAt = thresholds?.critical ?? DEFAULT_FAIL
  const limitPct = (failAt * 100).toFixed(0)
  const safePct = (warnAt * 100).toFixed(0)

  const portfolio = overrideEquity ?? totalPortfolioValue(balances)
  if (portfolio <= 0) {
    return { name: 'Concentration', status: 'pass', message: 'no portfolio value to measure' }
  }

  // Sum existing notional for the same symbol
  let symbolNotional = 0
  for (const pos of positions) {
    if (pos.symbol === input.symbol) {
      symbolNotional += positionNotional(pos)
    }
  }

  // Add the proposed trade notional
  const newNotional = input.quantity * entryPrice
  const totalSymbolNotional = symbolNotional + newNotional
  const ratio = totalSymbolNotional / portfolio
  const pct = (ratio * 100).toFixed(1)
  const label = overrideEquity ? 'Concentration (cross-venue)' : 'Concentration'

  if (ratio < warnAt) {
    return { name: label, status: 'pass', message: `${pct}% ${input.symbol} (limit ${limitPct}%)` }
  }

  if (ratio <= failAt) {
    return {
      name: label,
      status: 'warn',
      message: `${pct}% in ${input.symbol} (limit ${limitPct}%)`,
      recommendation: 'Diversify across more assets to reduce single-asset risk',
    }
  }

  const maxQty = ((portfolio * warnAt - symbolNotional) / entryPrice)
  const safeQty = Math.max(0, maxQty).toFixed(4)
  return {
    name: label,
    status: 'fail',
    message: `${pct}% in ${input.symbol} exceeds ${limitPct}% limit`,
    recommendation: `Reduce quantity to ~${safeQty} to stay under ${safePct}%`,
  }
}

