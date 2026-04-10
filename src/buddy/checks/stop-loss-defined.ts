/**
 * Stop-Loss Defined gate check — verifies that a stop-loss is set for the order.
 * pass: has stopPrice or order type is stop_loss
 * warn: no stopPrice but position risk < 5%
 * fail: no stopPrice and position risk >= 5%
 */

import type { Balance } from '../../services/exchange/types.js'
import type { CheckResult, GateInput } from '../../tools/PreTradeGateTool/types.js'
import { totalPortfolioValue } from './utils.js'

export function checkStopLossDefined(
  input: GateInput,
  balances: Balance[],
  entryPrice: number,
): CheckResult {
  // Stop-loss order types always pass
  if (input.type === 'stop_loss') {
    return {
      name: 'Stop-Loss',
      status: 'pass',
      message: 'order is a stop-loss',
    }
  }

  // Explicit stop price provided
  if (input.stopPrice !== undefined && input.stopPrice > 0) {
    const distance = Math.abs(entryPrice - input.stopPrice)
    const pct = ((distance / entryPrice) * 100).toFixed(1)
    return {
      name: 'Stop-Loss',
      status: 'pass',
      message: `defined at ${input.stopPrice} (${pct}% away)`,
    }
  }

  // No stop-loss: evaluate risk to determine severity
  const equity = totalPortfolioValue(balances)
  if (equity <= 0) {
    return {
      name: 'Stop-Loss',
      status: 'warn',
      message: 'not defined',
      recommendation: 'Set a stop-loss to limit downside risk',
    }
  }

  const impliedRisk = (entryPrice * input.quantity * 0.10) / equity
  const riskPct = (impliedRisk * 100).toFixed(1)

  if (impliedRisk < 0.05) {
    return {
      name: 'Stop-Loss',
      status: 'warn',
      message: `not defined, implied risk ${riskPct}%`,
      recommendation: 'Consider setting a stop-loss for protection',
    }
  }

  return {
    name: 'Stop-Loss',
    status: 'fail',
    message: `not defined, risk ${riskPct}%`,
    recommendation: 'Set a stop-loss or reduce position size',
  }
}
