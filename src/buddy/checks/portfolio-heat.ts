/**
 * Portfolio Heat gate check — measures total portfolio exposure.
 * Reuses the existing position-based heat calculation.
 */

import type { Position, Balance } from '../../services/exchange/types.js'
import type { CheckResult, GateInput } from '../../tools/PreTradeGateTool/types.js'
import { totalPortfolioValue, totalNotionalValue, positionNotional } from './utils.js'

const PASS_THRESHOLD = 0.10  // < 10%
const WARN_THRESHOLD = 0.20  // 10-20%
// > 20% = fail

export function checkPortfolioHeat(
  input: GateInput,
  positions: Position[],
  balances: Balance[],
): CheckResult {
  const portfolio = totalPortfolioValue(balances)
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

  if (totalHeat < PASS_THRESHOLD) {
    return {
      name: 'Portfolio Heat',
      status: 'pass',
      message: `${pct}% (limit 20%)`,
    }
  }

  if (totalHeat <= WARN_THRESHOLD) {
    return {
      name: 'Portfolio Heat',
      status: 'warn',
      message: `${pct}% heat approaching limit (20%)`,
      recommendation: 'Consider reducing open exposure before adding positions',
    }
  }

  return {
    name: 'Portfolio Heat',
    status: 'fail',
    message: `${pct}% exceeds 20% heat limit`,
    recommendation: 'Close or reduce existing positions before opening new ones',
  }
}
