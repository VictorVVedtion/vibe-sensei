/**
 * Market Regime Engine — classifies market structure from 4h candles.
 *
 * Uses ATR(14) for volatility measurement and HH/HL pattern analysis
 * for directional classification. Results are cached with a 4-hour TTL.
 *
 * Regime types:
 *   trending_up    — clear uptrend with high volatility
 *   trending_down  — clear downtrend with high volatility
 *   ranging        — no direction, moderate volatility
 *   compressing    — no direction, low volatility (squeeze)
 *   expanding      — no direction, high volatility (breakout/chop)
 */

import type { Candle, ExchangeInterface } from '../exchange/types.js'
import type {
  AtrSnapshot,
  DirectionSignals,
  MarketRegime,
  RegimeSnapshot,
  RegimeType,
} from './types.js'

// ── Constants ──────────────────────────────────────────────────────────────

/** ATR lookback period. */
const ATR_PERIOD = 14

/** Number of candles used for ATR percentile ranking. */
const ATR_PERCENTILE_WINDOW = 50

/** Direction lookback: analyze last 14 candles for HH/HL vs LL/LH. */
const DIRECTION_LOOKBACK = 14

/** Minimum candles required to compute a regime (ATR_PERIOD + 1). */
const MIN_CANDLES = ATR_PERIOD + 1

/** Cache TTL: 4 hours in milliseconds. */
const REGIME_TTL_MS = 4 * 60 * 60 * 1000

/** Threshold for directional count to qualify as trending. */
const DIRECTION_THRESHOLD = 7

// ── ATR Computation ────────────────────────────────────────────────────────

/**
 * Compute True Range for a candle given the previous close.
 * TR = max(H - L, |H - prevClose|, |L - prevClose|)
 */
function trueRange(candle: Candle, prevClose: number): number {
  const hl = candle.high - candle.low
  const hpc = Math.abs(candle.high - prevClose)
  const lpc = Math.abs(candle.low - prevClose)
  return Math.max(hl, hpc, lpc)
}

/**
 * Compute ATR(14) from candles. Returns an array of ATR values
 * (one per candle starting from index ATR_PERIOD).
 * Uses Simple Moving Average of True Range.
 */
function computeAtrSeries(candles: Candle[]): number[] {
  if (candles.length < MIN_CANDLES) return []

  // Compute true range series (starts from index 1)
  const trSeries: number[] = []
  for (let i = 1; i < candles.length; i++) {
    trSeries.push(trueRange(candles[i]!, candles[i - 1]!.close))
  }

  // Compute SMA of TR over ATR_PERIOD
  const atrSeries: number[] = []
  for (let i = ATR_PERIOD - 1; i < trSeries.length; i++) {
    let sum = 0
    for (let j = i - ATR_PERIOD + 1; j <= i; j++) {
      sum += trSeries[j]!
    }
    atrSeries.push(sum / ATR_PERIOD)
  }

  return atrSeries
}

/**
 * Compute ATR percentile: where the current ATR sits relative
 * to the last `window` ATR values (0-100).
 */
function computeAtrPercentile(
  atrSeries: number[],
  window: number,
): number {
  if (atrSeries.length === 0) return 50

  const currentAtr = atrSeries[atrSeries.length - 1]!
  const lookback = atrSeries.slice(-window)
  let belowCount = 0

  for (const val of lookback) {
    if (val < currentAtr) belowCount++
  }

  return (belowCount / lookback.length) * 100
}

/**
 * Build an AtrSnapshot from a series of candles.
 * Returns null if insufficient data.
 */
function buildAtrSnapshot(candles: Candle[]): AtrSnapshot | null {
  const atrSeries = computeAtrSeries(candles)
  if (atrSeries.length === 0) return null

  const value = atrSeries[atrSeries.length - 1]!
  const percentile = computeAtrPercentile(atrSeries, ATR_PERCENTILE_WINDOW)

  return { value, percentile }
}

// ── Direction Analysis ─────────────────────────────────────────────────────

/**
 * Count Higher Highs + Higher Lows (bullish) and Lower Highs + Lower Lows
 * (bearish) patterns in the last `lookback` candles.
 */
function analyzeDirection(
  candles: Candle[],
  lookback: number,
): DirectionSignals {
  const recent = candles.slice(-lookback)
  if (recent.length < 2) {
    return { hlCount: 0, lhCount: 0, totalCandles: recent.length }
  }

  let hlCount = 0
  let lhCount = 0

  for (let i = 1; i < recent.length; i++) {
    const prev = recent[i - 1]!
    const curr = recent[i]!

    // Higher High or Higher Low → bullish signal
    if (curr.high > prev.high) hlCount++
    if (curr.low > prev.low) hlCount++

    // Lower High or Lower Low → bearish signal
    if (curr.high < prev.high) lhCount++
    if (curr.low < prev.low) lhCount++
  }

  return { hlCount, lhCount, totalCandles: recent.length }
}

// ── Regime Classification ──────────────────────────────────────────────────

/**
 * Classify the regime from ATR and direction signals.
 */
function classifyRegime(
  atr: AtrSnapshot,
  direction: DirectionSignals,
): RegimeType {
  const { hlCount, lhCount } = direction
  const { percentile } = atr

  // Trending up: strong bullish direction + high volatility
  if (hlCount >= DIRECTION_THRESHOLD && percentile > 70) {
    return 'trending_up'
  }

  // Trending down: strong bearish direction + high volatility
  if (lhCount >= DIRECTION_THRESHOLD && percentile > 70) {
    return 'trending_down'
  }

  // No clear direction — classify by volatility
  if (percentile < 30) return 'compressing'
  if (percentile > 70) return 'expanding'
  return 'ranging'
}

/**
 * Compute confidence score (0-1) based on how strong the signals are.
 *
 * For trending: strength of direction count relative to max possible.
 * For non-trending: how far ATR percentile is from the middle (50).
 */
function computeConfidence(
  regime: RegimeType,
  atr: AtrSnapshot,
  direction: DirectionSignals,
): number {
  const maxPossible = (direction.totalCandles - 1) * 2

  if (regime === 'trending_up' || regime === 'trending_down') {
    const dirCount =
      regime === 'trending_up' ? direction.hlCount : direction.lhCount
    // Direction strength: how dominant is the directional count
    const dirStrength = maxPossible > 0 ? dirCount / maxPossible : 0
    // ATR strength: how high is volatility
    const atrStrength = atr.percentile / 100
    // Weighted combination
    return Math.min(1, dirStrength * 0.6 + atrStrength * 0.4)
  }

  // Non-trending regimes: confidence based on ATR percentile extremity
  if (regime === 'compressing') {
    // Lower percentile = more confident compression
    return Math.min(1, (30 - atr.percentile) / 30)
  }

  if (regime === 'expanding') {
    // Higher percentile = more confident expansion
    return Math.min(1, (atr.percentile - 70) / 30)
  }

  // Ranging: confidence based on how centered ATR is
  const distFromCenter = Math.abs(atr.percentile - 50)
  return Math.min(1, 1 - distFromCenter / 50)
}

// ── Public API ─────────────────────────────────────────────────────────────

/** In-memory regime cache keyed by symbol. */
const regimeCache = new Map<string, RegimeSnapshot>()

/**
 * Compute the market regime for a symbol by fetching 4h candles.
 *
 * Requires at least 15 candles (ATR_PERIOD + 1). Returns null if
 * the exchange provides fewer candles or if any computation fails.
 *
 * @param symbol — Trading pair (e.g. "BTC/USDT")
 * @param exchange — Connected exchange instance
 */
export async function computeRegimeForSymbol(
  symbol: string,
  exchange: ExchangeInterface,
): Promise<MarketRegime | null> {
  try {
    // Fetch enough candles for ATR percentile window + ATR period + 1
    const needed = ATR_PERCENTILE_WINDOW + ATR_PERIOD + 1
    const candles = await exchange.getCandles(symbol, '4h', needed)

    if (candles.length < MIN_CANDLES) return null

    const atr = buildAtrSnapshot(candles)
    if (!atr) return null

    const direction = analyzeDirection(candles, DIRECTION_LOOKBACK)
    const regime = classifyRegime(atr, direction)
    const confidence = computeConfidence(regime, atr, direction)

    const result: MarketRegime = {
      symbol,
      regime,
      confidence,
      atr,
      direction,
      computedAt: Date.now(),
    }

    // Update cache
    regimeCache.set(symbol, {
      regime: result,
      expiresAt: Date.now() + REGIME_TTL_MS,
    })

    return result
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[MarketRegime] compute error for ${symbol}: ${msg}`)
    return null
  }
}

/**
 * Return the cached latest regime for a symbol, or null if
 * no regime has been computed yet or the cache has expired.
 */
export function getLatestRegime(symbol: string): MarketRegime | null {
  const snapshot = regimeCache.get(symbol)
  if (!snapshot) return null

  // Return even if expired — caller can decide to refresh
  return snapshot.regime
}

/**
 * Check whether the cached regime for a symbol has expired
 * and needs recomputation.
 */
export function isRegimeExpired(symbol: string): boolean {
  const snapshot = regimeCache.get(symbol)
  if (!snapshot) return true
  return Date.now() >= snapshot.expiresAt
}

/**
 * Clear the regime cache. Useful for testing or reset scenarios.
 */
export function clearRegimeCache(): void {
  regimeCache.clear()
}
