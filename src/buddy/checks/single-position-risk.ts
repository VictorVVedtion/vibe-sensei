/**
 * Single Position Risk gate check — measures risk of a single trade relative to equity.
 * With stop-loss: risk = |price - stopPrice| * quantity / equity
 * Without stop-loss: risk = price * quantity * 10% / equity (assumes 10% adverse move)
 */

import type { Balance } from '../../services/exchange/types.js'
import type { CheckResult, GateInput } from '../../tools/PreTradeGateTool/types.js'
import { totalPortfolioValue } from './utils.js'

const PASS_THRESHOLD = 0.05   // < 5%
const WARN_THRESHOLD = 0.10   // 5-10%
// > 10% = fail

export function checkSinglePositionRisk(
  input: GateInput,
  balances: Balance[],
  entryPrice: number,
): CheckResult {
  const equity = totalPortfolioValue(balances)
  if (equity <= 0) {
    return {
      name: 'Position Risk',
      status: 'pass',
      message: 'No equity to measure risk against',
    }
  }

  let riskAmount: number
  if (input.stopPrice !== undefined && input.stopPrice > 0) {
    riskAmount = Math.abs(entryPrice - input.stopPrice) * input.quantity
  } else {
    riskAmount = entryPrice * input.quantity * 0.10
  }

  const riskRatio = riskAmount / equity
  const pct = (riskRatio * 100).toFixed(1)

  if (riskRatio < PASS_THRESHOLD) {
    return {
      name: 'Position Risk',
      status: 'pass',
      message: `${pct}% (limit 10%)`,
    }
  }

  if (riskRatio <= WARN_THRESHOLD) {
    const safeQty = ((equity * PASS_THRESHOLD) / (input.stopPrice
      ? Math.abs(entryPrice - input.stopPrice)
      : entryPrice * 0.10
    )).toFixed(4)
    return {
      name: 'Position Risk',
      status: 'warn',
      message: `${pct}% risk approaching limit (10%)`,
      recommendation: `Reduce quantity to ~${safeQty} to stay under 5%`,
    }
  }

  const safeQty = ((equity * PASS_THRESHOLD) / (input.stopPrice
    ? Math.abs(entryPrice - input.stopPrice)
    : entryPrice * 0.10
  )).toFixed(4)
  return {
    name: 'Position Risk',
    status: 'fail',
    message: `${pct}% exceeds 10% risk limit`,
    recommendation: `Reduce quantity to ~${safeQty} to pass`,
  }
}
