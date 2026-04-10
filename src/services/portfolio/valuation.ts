/**
 * Unified Valuation Layer — canonical USD normalization for 7 asset verticals.
 *
 * Provides consistent USD value computation across spot, perp futures,
 * crypto options, stocks, prediction markets, DeFi/DEX, and forex.
 * Staleness tracking ensures risk calculations penalize stale data.
 */

import type { Balance, Position } from '../exchange/types.js'

// ── Asset Verticals ───────────────────────────────────────────────────────

export type AssetVertical =
  | 'spot'
  | 'perp_futures'
  | 'crypto_options'
  | 'stocks'
  | 'prediction'
  | 'defi_dex'
  | 'forex'

// ── Market Snapshot ───────────────────────────────────────────────────────

/** Point-in-time market data for a single asset. */
export interface MarketSnapshot {
  /** Current market price in USD. */
  price: number
  /** Mark price for derivatives (perps, futures). */
  markPrice?: number
  /** Funding rate for perpetual contracts. */
  fundingRate?: number
  /** Probability price for prediction market shares (0-1). */
  probability?: number
  /** Timestamp (ms) since data was last refreshed. Undefined = fresh. */
  staleSince?: number
}

// ── Portfolio Value Result ────────────────────────────────────────────────

/** Aggregated portfolio value across all venues. */
export interface PortfolioValue {
  /** Total portfolio value in USD. */
  totalUSD: number
  /** Value breakdown per venue/exchange identifier. */
  perVenue: Map<string, number>
  /** Count of positions with stale market data (>60s old). */
  staleCount: number
}

// ── Constants ─────────────────────────────────────────────────────────────

/** Data older than this (ms) is considered stale. */
const STALE_THRESHOLD_MS = 60_000

/** Risk multiplier applied to stale data (10% penalty). */
const STALE_PENALTY_MULTIPLIER = 1.1

// ── Staleness ─────────────────────────────────────────────────────────────

/**
 * Returns a risk multiplier based on data staleness.
 *
 * Fresh data (<=60s or undefined): 1.0 (no penalty).
 * Stale data (>60s): 1.1 (10% risk penalty).
 */
export function getStalePenalty(staleSince: number | undefined): number {
  if (staleSince == null) return 1.0
  return staleSince > STALE_THRESHOLD_MS ? STALE_PENALTY_MULTIPLIER : 1.0
}

// ── Per-Asset Valuation ───────────────────────────────────────────────────

/**
 * Valuation dispatch table. Each vertical has a single-line formula
 * that converts (position quantity, market data) → USD value.
 */
const valuationFormulas: Record<
  AssetVertical,
  (quantity: number, data: MarketSnapshot) => number
> = {
  /** Spot: simple price * quantity. */
  spot: (qty, data) => data.price * qty,

  /** Perp futures: notional exposure via mark price or current price. */
  perp_futures: (qty, data) => (data.markPrice ?? data.price) * qty,

  /** Crypto options: premium-based value; delta exposure tracked separately. */
  crypto_options: (qty, data) => data.price * qty,

  /** Equities: straightforward price * shares. */
  stocks: (qty, data) => data.price * qty,

  /** Prediction markets: shares * probability (or price as fallback). */
  prediction: (qty, data) => (data.probability ?? data.price) * qty,

  /** DeFi/DEX: token value; LP positions handled upstream by adapter. */
  defi_dex: (qty, data) => data.price * qty,

  /** Forex: quote currency units (OANDA convention). */
  forex: (qty, data) => data.price * qty,
}

/**
 * Compute the USD value of a single asset position.
 *
 * @param position - Must have `quantity` (absolute units) and `currentPrice`.
 * @param vertical - The asset class for formula selection.
 * @param marketData - Point-in-time market data snapshot.
 * @returns USD value (always non-negative).
 */
export function computeAssetValueUSD(
  position: Pick<Position, 'quantity'>,
  vertical: AssetVertical,
  marketData: MarketSnapshot,
): number {
  const qty = Math.abs(position.quantity)
  const formula = valuationFormulas[vertical]
  return Math.abs(formula(qty, marketData))
}

// ── Portfolio Aggregation ─────────────────────────────────────────────────

/** Minimal position shape needed for portfolio aggregation. */
interface PortfolioPosition {
  symbol: string
  unrealizedPnl: number
  currentPrice: number
  quantity: number
  /** Optional venue identifier for per-venue breakdown. */
  venue?: string
  /** Optional staleness timestamp. */
  staleSince?: number
}

/**
 * Compute total portfolio value in USD from positions and balances.
 *
 * - Balances are summed as-is (assumed USD-denominated).
 * - Position unrealized P&L is added to the total.
 * - Positions with data older than 60s are counted as stale.
 */
export function computePortfolioValueUSD(
  positions: PortfolioPosition[],
  balances: Balance[],
): PortfolioValue {
  const perVenue = new Map<string, number>()
  let staleCount = 0

  let balanceTotal = 0
  for (const b of balances) {
    balanceTotal += b.total
  }

  let pnlTotal = 0
  for (const pos of positions) {
    pnlTotal += pos.unrealizedPnl

    const venue = pos.venue ?? 'default'
    const current = perVenue.get(venue) ?? 0
    perVenue.set(venue, current + pos.unrealizedPnl)

    if (pos.staleSince != null && pos.staleSince > STALE_THRESHOLD_MS) {
      staleCount++
    }
  }

  // Add balance totals to 'cash' venue
  if (balanceTotal > 0) {
    const cashVenue = perVenue.get('cash') ?? 0
    perVenue.set('cash', cashVenue + balanceTotal)
  }

  return {
    totalUSD: balanceTotal + pnlTotal,
    perVenue,
    staleCount,
  }
}
