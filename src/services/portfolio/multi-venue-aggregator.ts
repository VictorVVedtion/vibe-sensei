/**
 * Multi-Venue Portfolio Aggregator — central cross-venue aggregation service.
 *
 * Calls VenueRegistry for positions and balances across all connected venues,
 * normalizes to USD via the valuation layer, and detects cross-venue
 * concentration risk (e.g., BTC spot + BTC perp + BTC options).
 *
 * Partial venue failures are captured but never block aggregation.
 */

import { getVenueRegistry } from '../exchange/venue-registry.js'
import { computePortfolioValueUSD, type PortfolioValue } from './valuation.js'
import type { Balance, TradingVertical } from '../exchange/types.js'

// ── Result Types ─────────────────────────────────────────────────────────

export interface AggregatedPortfolio {
  /** Total portfolio value in USD across all venues. */
  totalUSD: number
  /** USD value breakdown per venue identifier. */
  perVenue: Map<string, number>
  /** USD value breakdown per underlying asset (e.g., BTC, ETH). */
  perAsset: Map<string, number>
  /** Human-readable concentration alerts for overexposed assets. */
  concentrationAlerts: string[]
  /** Venue errors that occurred during aggregation (partial failures). */
  venueErrors: Array<{ venueId: string; error: string }>
}

// ── Constants ────────────────────────────────────────────────────────────

/** Assets exceeding this % of portfolio trigger a concentration alert. */
const CONCENTRATION_THRESHOLD = 0.40

/** Minimum number of venues an asset must appear in to flag cross-venue risk. */
const CROSS_VENUE_MIN = 2

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * Extract the underlying base asset from a position symbol.
 * Handles pairs like "BTC/USDT", "ETH-PERP", and plain tokens.
 */
function extractBaseAsset(symbol: string): string {
  // Pair format: BTC/USDT
  if (symbol.includes('/')) return symbol.split('/')[0]!.toUpperCase()
  // Perp suffix: BTC-PERP, ETH-PERPETUAL
  const perpMatch = symbol.match(/^([A-Z0-9]+)[_-](?:PERP|PERPETUAL|USD)/i)
  if (perpMatch) return perpMatch[1]!.toUpperCase()
  // Prediction market: marketId:outcome
  if (symbol.includes(':')) return symbol.split(':')[0]!.toUpperCase()
  return symbol.toUpperCase()
}

/**
 * Build per-venue USD breakdown from positions.
 * Groups position notional values by venue source.
 */
function buildPerVenueMap(
  positions: Array<{ venue?: string; currentPrice: number; quantity: number }>,
  balances: Balance[],
): Map<string, number> {
  const map = new Map<string, number>()

  for (const pos of positions) {
    const venue = pos.venue ?? 'default'
    const notional = Math.abs(pos.currentPrice * pos.quantity)
    map.set(venue, (map.get(venue) ?? 0) + notional)
  }

  // Add balances under 'cash'
  let cashTotal = 0
  for (const b of balances) {
    cashTotal += b.total
  }
  if (cashTotal > 0) {
    map.set('cash', (map.get('cash') ?? 0) + cashTotal)
  }

  return map
}

/**
 * Build per-asset USD breakdown and detect cross-venue concentration.
 * Returns the asset map and any concentration alert strings.
 */
function analyzeConcentration(
  positions: Array<{
    symbol: string
    currentPrice: number
    quantity: number
    vertical: TradingVertical
    venue?: string
  }>,
  totalUSD: number,
): { perAsset: Map<string, number>; alerts: string[] } {
  const assetTotals = new Map<string, number>()
  const assetVenues = new Map<string, Set<string>>()

  for (const pos of positions) {
    const base = extractBaseAsset(pos.symbol)
    const notional = Math.abs(pos.currentPrice * pos.quantity)
    assetTotals.set(base, (assetTotals.get(base) ?? 0) + notional)

    const venueSet = assetVenues.get(base) ?? new Set<string>()
    venueSet.add(pos.venue ?? pos.vertical)
    assetVenues.set(base, venueSet)
  }

  const alerts: string[] = []
  if (totalUSD <= 0) return { perAsset: assetTotals, alerts }

  for (const [asset, usdValue] of assetTotals) {
    const pct = usdValue / totalUSD
    const venueCount = assetVenues.get(asset)?.size ?? 0

    if (pct > CONCENTRATION_THRESHOLD) {
      const pctStr = (pct * 100).toFixed(1)
      const venues = [...(assetVenues.get(asset) ?? [])]
      alerts.push(
        `${asset}: ${pctStr}% of portfolio across ${venues.join(', ')}`,
      )
    } else if (venueCount >= CROSS_VENUE_MIN && pct > 0.20) {
      const pctStr = (pct * 100).toFixed(1)
      const venues = [...(assetVenues.get(asset) ?? [])]
      alerts.push(
        `${asset}: ${pctStr}% across ${venueCount} venues (${venues.join(', ')})`,
      )
    }
  }

  return { perAsset: assetTotals, alerts }
}

// ── Core Aggregation ─────────────────────────────────────────────────────

/**
 * Aggregate portfolio across all connected venues.
 *
 * Fetches positions and balances from VenueRegistry (Promise.allSettled),
 * normalizes to USD, and runs cross-venue concentration analysis.
 * Partial venue failures are captured in venueErrors.
 */
export async function aggregatePortfolio(): Promise<AggregatedPortfolio> {
  const registry = getVenueRegistry()

  const [posResult, balResult] = await Promise.all([
    registry.getAllPositions(),
    registry.getAllBalances(),
  ])

  // Tag positions with venue info for per-venue breakdown
  const taggedPositions = posResult.positions.map((p) => ({
    symbol: p.symbol,
    unrealizedPnl: p.unrealizedPnl,
    currentPrice: p.currentPrice,
    quantity: p.quantity,
    venue: p.vertical,
    vertical: p.vertical,
    staleSince: undefined,
  }))

  // Compute total USD value via valuation layer
  const portfolioValue: PortfolioValue = computePortfolioValueUSD(
    taggedPositions,
    balResult.balances,
  )

  // Build venue breakdown
  const perVenue = buildPerVenueMap(taggedPositions, balResult.balances)

  // Analyze concentration
  const { perAsset, alerts } = analyzeConcentration(
    taggedPositions,
    portfolioValue.totalUSD,
  )

  // Collect all venue errors
  const venueErrors: Array<{ venueId: string; error: string }> = [
    ...posResult.errors.map((e) => ({
      venueId: e.venueId,
      error: e.error.message,
    })),
    ...balResult.errors.map((e) => ({
      venueId: e.venueId,
      error: e.error.message,
    })),
  ]

  return {
    totalUSD: portfolioValue.totalUSD,
    perVenue,
    perAsset,
    concentrationAlerts: alerts,
    venueErrors,
  }
}

// ── Singleton ────────────────────────────────────────────────────────────

class MultiVenueAggregator {
  async aggregate(): Promise<AggregatedPortfolio> {
    return aggregatePortfolio()
  }
}

let instance: MultiVenueAggregator | null = null

export function getMultiVenueAggregator(): MultiVenueAggregator {
  if (!instance) {
    instance = new MultiVenueAggregator()
  }
  return instance
}

/** Reset singleton (for testing). */
export function resetMultiVenueAggregator(): void {
  instance = null
}
