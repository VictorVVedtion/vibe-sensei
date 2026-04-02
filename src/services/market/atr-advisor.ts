/**
 * ATR Stop-Loss Advisor — computes ATR(14) from 4h candles
 * and recommends stop-loss levels + risk-sized position quantities.
 *
 * Multipliers:
 *   - trending (with trend): entry ∓ ATR × 2.0
 *   - ranging:                entry ∓ ATR × 1.0
 *   - counter-trend:         entry ∓ ATR × 1.5
 *
 * Advisory only — never auto-places orders.
 */

import type { Candle, ExchangeInterface } from '../exchange/types.js'
import { computeSMA, computeTrueRange } from '../../buddy/checks/utils.js'

// ── Types ─────────────────────────────────────────────────────────────────

export type RegimeLabel = 'trending' | 'ranging' | 'counter_trend'

export interface ATRRecommendation {
  /** Suggested stop-loss price. */
  stopPrice: number
  /** Dollar amount at risk (equity * riskPercent). */
  riskAmount: number
  /** Maximum quantity to buy/sell at the given risk level. */
  maxQuantity: number
  /** Current ATR(14) value. */
  atrValue: number
  /** Detected regime for the stop multiplier. */
  regime: RegimeLabel
  /** Human-readable explanation for the LLM. */
  reason: string
}

// ── Constants ─────────────────────────────────────────────────────────────

const ATR_PERIOD = 14
const SMA_PERIOD = 20
const MIN_CANDLES = ATR_PERIOD + 1
const DEFAULT_RISK_PERCENT = 0.02 // 2%

/** ATR multiplier by regime. */
const REGIME_MULTIPLIER: Record<RegimeLabel, number> = {
  trending: 2.0,
  ranging: 1.0,
  counter_trend: 1.5,
}

// ── ATR Computation ───────────────────────────────────────────────────────

/**
 * Compute ATR(14) from an array of candles.
 * Returns NaN if insufficient data.
 */
function computeATR(candles: Candle[]): number {
  if (candles.length < MIN_CANDLES) return NaN

  const trValues: number[] = []
  for (let i = 1; i < candles.length; i++) {
    trValues.push(computeTrueRange(candles[i]!, candles[i - 1]!.close))
  }

  return computeSMA(trValues, ATR_PERIOD)
}

// ── Regime Detection (simplified) ─────────────────────────────────────────

/**
 * Classify regime for stop-loss purposes.
 * price > SMA(20) of closes → trending (with trend for longs, counter for shorts)
 * price <= SMA(20) → ranging for longs, trending for shorts
 */
function classifyRegime(
  candles: Candle[],
  side: 'buy' | 'sell',
): RegimeLabel {
  if (candles.length < SMA_PERIOD) return 'ranging'

  const closes = candles.map(c => c.close)
  const sma20 = computeSMA(closes, SMA_PERIOD)
  const lastClose = closes[closes.length - 1]!

  const aboveSMA = lastClose > sma20

  if (side === 'buy') {
    // Buying in an uptrend → trending; below SMA → ranging
    return aboveSMA ? 'trending' : 'ranging'
  }

  // Selling into a downtrend (below SMA) → trending; above SMA → counter
  return aboveSMA ? 'counter_trend' : 'trending'
}

// ── Stop Price Calculation ────────────────────────────────────────────────

/**
 * Calculate stop-loss price from entry, ATR, multiplier, and side.
 */
function calculateStopPrice(
  entryPrice: number,
  atrValue: number,
  multiplier: number,
  side: 'buy' | 'sell',
): number {
  const distance = atrValue * multiplier
  if (side === 'buy') {
    return Math.max(0, entryPrice - distance)
  }
  return entryPrice + distance
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Compute ATR-based stop-loss and position sizing recommendation.
 *
 * @param symbol      Trading pair (e.g. "BTC/USDT")
 * @param entryPrice  Planned entry price
 * @param side        Order side ('buy' or 'sell')
 * @param exchange    Connected exchange instance
 * @param riskPercent Fraction of equity to risk (default 0.02 = 2%)
 * @returns ATRRecommendation or null if insufficient candle data
 */
export async function computeATRAdvisor(
  symbol: string,
  entryPrice: number,
  side: 'buy' | 'sell',
  exchange: ExchangeInterface,
  riskPercent: number = DEFAULT_RISK_PERCENT,
): Promise<ATRRecommendation | null> {
  try {
    const candles = await exchange.getCandles(symbol, '4h', SMA_PERIOD + ATR_PERIOD)

    if (candles.length < MIN_CANDLES) return null

    const atrValue = computeATR(candles)
    if (isNaN(atrValue) || atrValue <= 0) return null

    const regime = classifyRegime(candles, side)
    const multiplier = REGIME_MULTIPLIER[regime]
    const stopPrice = calculateStopPrice(entryPrice, atrValue, multiplier, side)
    const stopDistance = Math.abs(entryPrice - stopPrice)

    if (stopDistance <= 0) return null

    // Fetch equity for position sizing
    const balances = await exchange.getBalance()
    const equity = balances.reduce((sum, b) => sum + b.total, 0)
    const riskAmount = equity * riskPercent
    const maxQuantity = riskAmount / stopDistance

    const pctRisk = (riskPercent * 100).toFixed(0)
    const reason = buildReason(
      side, regime, multiplier, atrValue, stopPrice, maxQuantity, pctRisk,
    )

    return {
      stopPrice,
      riskAmount,
      maxQuantity,
      atrValue,
      regime,
      reason,
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[ATRAdvisor] error for ${symbol}: ${msg}`)
    return null
  }
}

/**
 * Build a human-readable reason string for the recommendation.
 */
function buildReason(
  side: 'buy' | 'sell',
  regime: RegimeLabel,
  multiplier: number,
  atrValue: number,
  stopPrice: number,
  maxQuantity: number,
  pctRisk: string,
): string {
  const dir = side === 'buy' ? 'below' : 'above'
  const regimeLabel = regime.replace('_', '-')
  const atrStr = atrValue.toFixed(2)
  const stopStr = formatPrice(stopPrice)
  const qtyStr = formatQuantity(maxQuantity)

  return (
    `ATR(14)=${atrStr}. ${regimeLabel} regime → stop ${multiplier.toFixed(1)}×ATR ` +
    `${dir} entry at $${stopStr}. Max qty: ${qtyStr} at ${pctRisk}% risk.`
  )
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
