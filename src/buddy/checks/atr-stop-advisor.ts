/**
 * ATR Stop-Loss Advisor gate check — suggests ATR-based stop-loss levels.
 *
 * Triggers when an order has no stopPrice defined.
 * Severity: INFO — advisory only, never blocks the trade.
 * Appended to the end of gate results as supplementary information.
 */

import type { Candle, ExchangeInterface } from '../../services/exchange/types.js'
import type { CheckResult, GateInput } from '../../tools/PreTradeGateTool/types.js'
import { computeATRAdvisor } from '../../services/market/atr-advisor.js'

/**
 * Run the ATR stop advisor check.
 * Returns INFO-level advice when no stop-loss is set.
 * Passes silently when a stop is already defined or order is a stop_loss type.
 */
export async function checkATRStopAdvisor(
  input: GateInput,
  entryPrice: number,
  exchange: ExchangeInterface,
): Promise<CheckResult> {
  // Stop-loss already defined — nothing to advise
  if (input.stopPrice !== undefined && input.stopPrice > 0) {
    return {
      name: 'ATR Stop',
      status: 'pass',
      message: `stop already set at ${formatPrice(input.stopPrice)}`,
    }
  }

  // Stop-loss order type — nothing to advise
  if (input.type === 'stop_loss') {
    return {
      name: 'ATR Stop',
      status: 'pass',
      message: 'order is a stop-loss',
    }
  }

  // Entry price not available — cannot compute
  if (entryPrice <= 0) {
    return {
      name: 'ATR Stop',
      status: 'pass',
      message: 'no entry price to compute ATR stop',
    }
  }

  try {
    const recommendation = await computeATRAdvisor(
      input.symbol,
      entryPrice,
      input.side,
      exchange,
    )

    if (!recommendation) {
      return {
        name: 'ATR Stop',
        status: 'pass',
        message: 'insufficient candle data for ATR calculation',
      }
    }

    // INFO level: use 'pass' status but include the advisory in the message
    // The recommendation text tells the LLM what stop to suggest
    return {
      name: 'ATR Stop',
      status: 'pass',
      message: recommendation.reason,
      recommendation: `Consider setting stop at $${formatPrice(recommendation.stopPrice)} and limiting size to ${formatQuantity(recommendation.maxQuantity)}`,
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      name: 'ATR Stop',
      status: 'pass',
      message: `ATR advisor error: ${msg}`,
    }
  }
}

/** Format price with appropriate decimal places. */
function formatPrice(price: number): string {
  if (price >= 1000) return price.toFixed(0)
  if (price >= 1) return price.toFixed(2)
  return price.toFixed(6)
}

/** Format quantity with appropriate decimal places. */
function formatQuantity(qty: number): string {
  if (qty >= 100) return qty.toFixed(0)
  if (qty >= 1) return qty.toFixed(2)
  if (qty >= 0.01) return qty.toFixed(4)
  return qty.toFixed(6)
}
