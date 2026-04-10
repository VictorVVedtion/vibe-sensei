/**
 * Regime Alignment gate check — validates trade direction against market regime.
 * Uses a lightweight regime detection based on recent price action.
 * Only warns, never fails (regime is suggestive, not definitive).
 */

import type { Candle } from '../../services/exchange/types.js'
import type { CheckResult, GateInput } from '../../tools/PreTradeGateTool/types.js'

export type RegimeType = 'trending_up' | 'trending_down' | 'ranging' | 'unknown'

/**
 * Detect regime from recent candles using a simple SMA crossover.
 * 5-period SMA vs 20-period SMA on closes.
 */
export function detectRegime(candles: Candle[]): RegimeType {
  if (candles.length < 20) return 'unknown'

  const closes = candles.map(c => c.close)
  const sma5 = closes.slice(-5).reduce((s, v) => s + v, 0) / 5
  const sma20 = closes.slice(-20).reduce((s, v) => s + v, 0) / 20

  const diff = (sma5 - sma20) / sma20
  if (diff > 0.02) return 'trending_up'
  if (diff < -0.02) return 'trending_down'
  return 'ranging'
}

export function checkRegimeAlignment(
  input: GateInput,
  regime: RegimeType,
): CheckResult {
  if (regime === 'unknown') {
    return {
      name: 'Regime',
      status: 'pass',
      message: 'insufficient data to determine regime',
    }
  }

  const aligned =
    (input.side === 'buy' && regime === 'trending_up') ||
    (input.side === 'sell' && regime === 'trending_down') ||
    regime === 'ranging'

  if (aligned) {
    return {
      name: 'Regime',
      status: 'pass',
      message: `${regime} — aligned`,
    }
  }

  const direction = regime === 'trending_up' ? 'bullish' : 'bearish'
  return {
    name: 'Regime',
    status: 'warn',
    message: `${regime} — ${input.side} against ${direction} trend`,
    recommendation: `Market is ${direction}; consider waiting for a reversal or reducing size`,
  }
}
