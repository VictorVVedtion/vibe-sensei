/**
 * Market regime type definitions.
 *
 * A "regime" describes the current market structure for a symbol:
 * trend direction, volatility level (via ATR), and classification
 * into one of 5 regime types.
 */

/** The 5 possible market regime classifications. */
export type RegimeType =
  | 'trending_up'
  | 'trending_down'
  | 'ranging'
  | 'compressing'
  | 'expanding'

/** Directional signal counts from HH/HL and LL/LH analysis. */
export interface DirectionSignals {
  /** Number of Higher Highs + Higher Lows in the lookback window. */
  hlCount: number
  /** Number of Lower Highs + Lower Lows in the lookback window. */
  lhCount: number
  /** Total candles analyzed for direction. */
  totalCandles: number
}

/** ATR (Average True Range) snapshot. */
export interface AtrSnapshot {
  /** Current ATR(14) value. */
  value: number
  /** ATR percentile relative to last 50 candles (0-100). */
  percentile: number
}

/** A complete market regime classification for a symbol at a point in time. */
export interface MarketRegime {
  /** Trading pair symbol (e.g. "BTC/USDT"). */
  symbol: string
  /** Classified regime type. */
  regime: RegimeType
  /** Confidence score (0-1) based on direction strength and ATR. */
  confidence: number
  /** ATR data used for classification. */
  atr: AtrSnapshot
  /** Directional signal data used for classification. */
  direction: DirectionSignals
  /** Timestamp when this regime was computed (ms since epoch). */
  computedAt: number
}

/** Cached regime entry with expiration tracking. */
export interface RegimeSnapshot {
  /** The computed regime data. */
  regime: MarketRegime
  /** When this snapshot expires and should be recomputed (ms since epoch). */
  expiresAt: number
}
