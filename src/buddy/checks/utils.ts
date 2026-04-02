/**
 * Shared utility functions for risk checks.
 *
 * Extracted from position-size, concentration, and leverage checks
 * to eliminate duplicated portfolio/notional calculations.
 * Includes SMA and TrueRange helpers for ATR-based computations.
 */

import type { Position, Balance, Candle } from '../../services/exchange/types.js'

/**
 * Calculate total portfolio value from balances.
 * Uses the `total` field on each balance entry (free + used).
 */
export function totalPortfolioValue(balances: Balance[]): number {
  return balances.reduce((sum, b) => sum + b.total, 0)
}

/**
 * Calculate notional value of a single position (|quantity| * currentPrice).
 */
export function positionNotional(pos: Position): number {
  return Math.abs(pos.quantity) * pos.currentPrice
}

/**
 * Calculate total notional value across all positions.
 */
export function totalNotionalValue(positions: Position[]): number {
  return positions.reduce((sum, pos) => sum + positionNotional(pos), 0)
}

/**
 * Compute Simple Moving Average over a given period.
 * Returns NaN if values has fewer elements than period.
 */
export function computeSMA(values: number[], period: number): number {
  if (values.length < period || period <= 0) return NaN
  let sum = 0
  for (let i = values.length - period; i < values.length; i++) {
    sum += values[i]!
  }
  return sum / period
}

/**
 * Compute True Range for a candle given the previous close.
 * TR = max(H - L, |H - prevClose|, |L - prevClose|)
 */
export function computeTrueRange(candle: Candle, prevClose: number): number {
  const hl = candle.high - candle.low
  const hpc = Math.abs(candle.high - prevClose)
  const lpc = Math.abs(candle.low - prevClose)
  return Math.max(hl, hpc, lpc)
}
