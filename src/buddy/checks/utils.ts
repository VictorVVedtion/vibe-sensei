/**
 * Shared utility functions for risk checks.
 *
 * Extracted from position-size, concentration, and leverage checks
 * to eliminate duplicated portfolio/notional calculations.
 */

import type { Position, Balance } from '../../services/exchange/types.js'

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
