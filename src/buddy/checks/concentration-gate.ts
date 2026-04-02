/**
 * Concentration gate check — wraps existing concentration logic for pre-trade gate.
 * Checks if adding a new trade would over-concentrate the portfolio.
 * pass: < 30% | warn: 30-50% | fail: > 50%
 */

import type { Position, Balance } from '../../services/exchange/types.js'
import type { CheckResult, GateInput } from '../../tools/PreTradeGateTool/types.js'
import { totalPortfolioValue, positionNotional } from './utils.js'

const WARN_THRESHOLD = 0.30  // 30%
const FAIL_THRESHOLD = 0.50  // 50%

export function checkConcentrationGate(
  input: GateInput,
  positions: Position[],
  balances: Balance[],
  entryPrice: number,
): CheckResult {
  const portfolio = totalPortfolioValue(balances)
  if (portfolio <= 0) {
    return {
      name: 'Concentration',
      status: 'pass',
      message: 'no portfolio value to measure',
    }
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

  if (ratio < WARN_THRESHOLD) {
    return {
      name: 'Concentration',
      status: 'pass',
      message: `${pct}% ${input.symbol} (limit 50%)`,
    }
  }

  if (ratio <= FAIL_THRESHOLD) {
    return {
      name: 'Concentration',
      status: 'warn',
      message: `${pct}% in ${input.symbol} (limit 50%)`,
      recommendation: 'Diversify across more assets to reduce single-asset risk',
    }
  }

  const maxQty = ((portfolio * WARN_THRESHOLD - symbolNotional) / entryPrice)
  const safeQty = Math.max(0, maxQty).toFixed(4)
  return {
    name: 'Concentration',
    status: 'fail',
    message: `${pct}% in ${input.symbol} exceeds 50% limit`,
    recommendation: `Reduce quantity to ~${safeQty} to stay under 30%`,
  }
}
