/**
 * Cross-Venue Arbitrage Scanner — detects funding rate differentials,
 * price divergences, and probability vs implied volatility mismatches
 * across connected venues in the VenueRegistry.
 *
 * Uses Promise.allSettled() for resilience: one failing venue never
 * blocks scanning of others. All public functions are <50 lines.
 */

import type {
  ExchangeInterface,
  FuturesInterface,
  OptionsInterface,
  PredictionInterface,
  Ticker,
  VenueAdapter,
} from '../exchange/types.js'

// ── Types ──────────────────────────────────────────────────────────────────

export type ArbitrageType =
  | 'funding_rate'
  | 'price_divergence'
  | 'probability_vs_iv'

export interface ArbitrageOpportunity {
  type: ArbitrageType
  venues: string[]
  spread: number
  confidence: number
  riskAdjustedReturn: number
  description: string
}

// ── Thresholds ─────────────────────────────────────────────────────────────

const FUNDING_RATE_SPREAD_THRESHOLD = 0.0001 // 0.01% per 8h
const PRICE_DIVERGENCE_THRESHOLD = 0.005 // 0.5%
const PROBABILITY_IV_DIVERGENCE_THRESHOLD = 0.10 // 10%

// ── Type Guards ────────────────────────────────────────────────────────────

function isFuturesAdapter(
  adapter: VenueAdapter,
): adapter is { vertical: 'perp_futures'; exchange: FuturesInterface } {
  return adapter.vertical === 'perp_futures'
}

function isOptionsAdapter(
  adapter: VenueAdapter,
): adapter is { vertical: 'crypto_options'; exchange: OptionsInterface } {
  return adapter.vertical === 'crypto_options'
}

function isPredictionAdapter(
  adapter: VenueAdapter,
): adapter is { vertical: 'prediction'; prediction: PredictionInterface } {
  return adapter.vertical === 'prediction'
}

function isExchangeAdapter(
  adapter: VenueAdapter,
): adapter is { vertical: 'spot' | 'perp_futures' | 'crypto_options' | 'stocks' | 'forex'; exchange: ExchangeInterface } {
  return 'exchange' in adapter
}

// ── Internal data fetchers ─────────────────────────────────────────────────

interface VenueTickerResult {
  venueId: string
  ticker: Ticker
}

interface VenueFundingResult {
  venueId: string
  symbol: string
  rate: number
}

async function fetchTickerSafe(
  venueId: string,
  exchange: ExchangeInterface,
  symbol: string,
): Promise<VenueTickerResult | null> {
  try {
    const ticker = await exchange.getTicker(symbol)
    return { venueId, ticker }
  } catch {
    return null
  }
}

async function fetchFundingRateSafe(
  venueId: string,
  exchange: FuturesInterface,
  symbol: string,
): Promise<VenueFundingResult | null> {
  try {
    const { rate } = await exchange.getFundingRate(symbol)
    return { venueId, symbol, rate }
  } catch {
    return null
  }
}

// ── Scanner Class ──────────────────────────────────────────────────────────

export class CrossVenueScanner {
  /**
   * Scan all connected venues for arbitrage opportunities.
   * Returns an array of detected opportunities sorted by risk-adjusted return.
   */
  async scan(
    venueMap: Map<string, VenueAdapter>,
  ): Promise<ArbitrageOpportunity[]> {
    const adapters = [...venueMap.entries()]
    const [funding, priceDivergence, probVsIV] = await Promise.allSettled([
      this.scanFundingRateDifferentials(adapters),
      this.scanPriceDivergences(adapters),
      this.scanProbabilityVsIV(adapters),
    ])

    const opportunities: ArbitrageOpportunity[] = []
    if (funding.status === 'fulfilled') opportunities.push(...funding.value)
    if (priceDivergence.status === 'fulfilled') opportunities.push(...priceDivergence.value)
    if (probVsIV.status === 'fulfilled') opportunities.push(...probVsIV.value)

    return opportunities.sort((a, b) => b.riskAdjustedReturn - a.riskAdjustedReturn)
  }

  /**
   * Compare perp funding rates across futures venues.
   * If spread > 0.01% per 8h between any pair, flag opportunity.
   */
  async scanFundingRateDifferentials(
    adapters: [string, VenueAdapter][],
  ): Promise<ArbitrageOpportunity[]> {
    const futuresVenues = adapters.filter(([, a]) => isFuturesAdapter(a))
    if (futuresVenues.length < 2) return []

    const symbols = this.findOverlappingSymbols(futuresVenues)
    const opportunities: ArbitrageOpportunity[] = []

    for (const symbol of symbols) {
      const opps = await this.scanFundingForSymbol(symbol, futuresVenues)
      opportunities.push(...opps)
    }

    return opportunities
  }

  /**
   * Fetch funding rates for a single symbol across futures venues,
   * then compare each pair for spread exceeding threshold.
   */
  private async scanFundingForSymbol(
    symbol: string,
    futuresVenues: [string, VenueAdapter][],
  ): Promise<ArbitrageOpportunity[]> {
    const tasks = futuresVenues.map(([id, adapter]) => {
      const exchange = (adapter as { exchange: FuturesInterface }).exchange
      return fetchFundingRateSafe(id, exchange, symbol)
    })

    const results = await Promise.allSettled(tasks)
    const rates = results
      .filter((r): r is PromiseFulfilledResult<VenueFundingResult | null> => r.status === 'fulfilled')
      .map(r => r.value)
      .filter((v): v is VenueFundingResult => v !== null)

    return this.compareFundingRates(rates)
  }

  /**
   * Compare all pairs of funding rate results and flag spreads above threshold.
   */
  private compareFundingRates(
    rates: VenueFundingResult[],
  ): ArbitrageOpportunity[] {
    const opportunities: ArbitrageOpportunity[] = []

    for (let i = 0; i < rates.length; i++) {
      for (let j = i + 1; j < rates.length; j++) {
        const a = rates[i]!
        const b = rates[j]!
        const spread = Math.abs(a.rate - b.rate)

        if (spread <= FUNDING_RATE_SPREAD_THRESHOLD) continue

        const lowVenue = a.rate < b.rate ? a : b
        const highVenue = a.rate < b.rate ? b : a
        const confidence = Math.min(spread / FUNDING_RATE_SPREAD_THRESHOLD, 5) / 5

        opportunities.push({
          type: 'funding_rate',
          venues: [lowVenue.venueId, highVenue.venueId],
          spread,
          confidence,
          riskAdjustedReturn: spread * 3 * 365 * confidence,
          description: `${a.symbol}: long on ${lowVenue.venueId} (${formatRate(lowVenue.rate)}), short on ${highVenue.venueId} (${formatRate(highVenue.rate)}). Spread: ${formatRate(spread)}/8h`,
        })
      }
    }

    return opportunities
  }

  /**
   * Compare ticker prices across CEX venues for the same symbol.
   * If spread > 0.5%, flag opportunity.
   */
  async scanPriceDivergences(
    adapters: [string, VenueAdapter][],
  ): Promise<ArbitrageOpportunity[]> {
    const exchangeVenues = adapters.filter(([, a]) => isExchangeAdapter(a))
    if (exchangeVenues.length < 2) return []

    const symbols = this.findOverlappingSymbols(exchangeVenues)
    const opportunities: ArbitrageOpportunity[] = []

    for (const symbol of symbols) {
      const opps = await this.scanPriceForSymbol(symbol, exchangeVenues)
      opportunities.push(...opps)
    }

    return opportunities
  }

  /**
   * Fetch tickers for a single symbol across exchange venues,
   * then compare each pair for price divergence exceeding threshold.
   */
  private async scanPriceForSymbol(
    symbol: string,
    exchangeVenues: [string, VenueAdapter][],
  ): Promise<ArbitrageOpportunity[]> {
    const tasks = exchangeVenues.map(([id, adapter]) => {
      const exchange = (adapter as { exchange: ExchangeInterface }).exchange
      return fetchTickerSafe(id, exchange, symbol)
    })

    const results = await Promise.allSettled(tasks)
    const tickers = results
      .filter((r): r is PromiseFulfilledResult<VenueTickerResult | null> => r.status === 'fulfilled')
      .map(r => r.value)
      .filter((v): v is VenueTickerResult => v !== null)

    return this.comparePrices(symbol, tickers)
  }

  /**
   * Compare all pairs of ticker results and flag spreads above threshold.
   */
  private comparePrices(
    symbol: string,
    tickers: VenueTickerResult[],
  ): ArbitrageOpportunity[] {
    const opportunities: ArbitrageOpportunity[] = []

    for (let i = 0; i < tickers.length; i++) {
      for (let j = i + 1; j < tickers.length; j++) {
        const a = tickers[i]!
        const b = tickers[j]!
        const midA = (a.ticker.bid + a.ticker.ask) / 2
        const midB = (b.ticker.bid + b.ticker.ask) / 2
        const avgPrice = (midA + midB) / 2

        if (avgPrice === 0) continue

        const spread = Math.abs(midA - midB) / avgPrice

        if (spread <= PRICE_DIVERGENCE_THRESHOLD) continue

        const lowVenue = midA < midB ? a : b
        const highVenue = midA < midB ? b : a
        const confidence = Math.min(spread / PRICE_DIVERGENCE_THRESHOLD, 3) / 3

        opportunities.push({
          type: 'price_divergence',
          venues: [lowVenue.venueId, highVenue.venueId],
          spread,
          confidence,
          riskAdjustedReturn: spread * confidence,
          description: `${symbol}: buy on ${lowVenue.venueId} ($${formatPrice(lowVenue.ticker.ask)}), sell on ${highVenue.venueId} ($${formatPrice(highVenue.ticker.bid)}). Spread: ${(spread * 100).toFixed(2)}%`,
        })
      }
    }

    return opportunities
  }

  /**
   * If both prediction and options venues are connected, compare implied
   * probability from prediction market with options-implied probability.
   * If divergence > 10%, flag opportunity.
   */
  async scanProbabilityVsIV(
    adapters: [string, VenueAdapter][],
  ): Promise<ArbitrageOpportunity[]> {
    const predictionVenues = adapters.filter(([, a]) => isPredictionAdapter(a))
    const optionsVenues = adapters.filter(([, a]) => isOptionsAdapter(a))

    if (predictionVenues.length === 0 || optionsVenues.length === 0) return []

    const opportunities: ArbitrageOpportunity[] = []

    for (const [predId, predAdapter] of predictionVenues) {
      for (const [optId, optAdapter] of optionsVenues) {
        const opps = await this.comparePredictionVsOptions(
          predId,
          predAdapter as { vertical: 'prediction'; prediction: PredictionInterface },
          optId,
          optAdapter as { vertical: 'crypto_options'; exchange: OptionsInterface },
        )
        opportunities.push(...opps)
      }
    }

    return opportunities
  }

  /**
   * Compare a single prediction venue against a single options venue.
   * Prediction market prices are implied probabilities (0-1).
   * Options IV can be converted to a rough probability using the options chain.
   */
  private async comparePredictionVsOptions(
    predId: string,
    predAdapter: { vertical: 'prediction'; prediction: PredictionInterface },
    optId: string,
    optAdapter: { vertical: 'crypto_options'; exchange: OptionsInterface },
  ): Promise<ArbitrageOpportunity[]> {
    try {
      const [markets, chain] = await Promise.allSettled([
        predAdapter.prediction.getMarkets(),
        optAdapter.exchange.getOptionsChain('BTC'),
      ])

      if (markets.status !== 'fulfilled' || chain.status !== 'fulfilled') return []
      if (markets.value.length === 0 || chain.value.length === 0) return []

      return this.matchPredictionToOptions(
        predId, markets.value,
        optId, chain.value,
      )
    } catch {
      return []
    }
  }

  /**
   * Match prediction market probabilities against ATM options implied vol
   * to detect divergences.
   */
  private matchPredictionToOptions(
    predId: string,
    markets: Awaited<ReturnType<PredictionInterface['getMarkets']>>,
    optId: string,
    chain: Awaited<ReturnType<OptionsInterface['getOptionsChain']>>,
  ): ArbitrageOpportunity[] {
    const opportunities: ArbitrageOpportunity[] = []

    // Use the average IV of near-ATM options as a proxy for market-implied probability
    const avgIV = chain.reduce((sum, o) => sum + o.iv, 0) / chain.length
    // Rough heuristic: higher IV implies higher probability of large moves
    const optionsImpliedProb = Math.min(avgIV / 100, 1)

    for (const market of markets) {
      if (market.currentPrices.length === 0) continue

      // Prediction market price is the implied probability (first outcome)
      const predictionProb = market.currentPrices[0]!
      const divergence = Math.abs(predictionProb - optionsImpliedProb)

      if (divergence <= PROBABILITY_IV_DIVERGENCE_THRESHOLD) continue

      const confidence = Math.min(divergence / PROBABILITY_IV_DIVERGENCE_THRESHOLD, 3) / 3

      opportunities.push({
        type: 'probability_vs_iv',
        venues: [predId, optId],
        spread: divergence,
        confidence,
        riskAdjustedReturn: divergence * confidence,
        description: `"${market.question}": prediction=${(predictionProb * 100).toFixed(1)}% vs options-implied=${(optionsImpliedProb * 100).toFixed(1)}%. Divergence: ${(divergence * 100).toFixed(1)}%`,
      })
    }

    return opportunities
  }

  /**
   * Find symbols that appear across multiple venues by convention.
   * Uses common crypto trading pairs as the search set.
   */
  private findOverlappingSymbols(
    _venues: [string, VenueAdapter][],
  ): string[] {
    // Common highly-liquid symbols likely available on all major venues
    return ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT']
  }
}

// ── Formatting helpers ─────────────────────────────────────────────────────

function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(4)}%`
}

function formatPrice(price: number): string {
  return price >= 1 ? price.toFixed(2) : price.toFixed(6)
}

// ── Module-level Singleton ─────────────────────────────────────────────────

let scanner: CrossVenueScanner | null = null

export function getArbitrageScanner(): CrossVenueScanner {
  if (!scanner) {
    scanner = new CrossVenueScanner()
  }
  return scanner
}

/** Reset the singleton (for testing). */
export function resetArbitrageScanner(): void {
  scanner = null
}

// ── Convenience: scan using the global VenueRegistry ───────────────────────

/**
 * Scan all connected venues in the global VenueRegistry for arbitrage.
 * Resolves the registry dynamically to avoid circular imports.
 * Returns empty array on any failure — never throws.
 */
export async function scanForArbitrage(): Promise<ArbitrageOpportunity[]> {
  try {
    const { getVenueRegistry } = await import('../exchange/venue-registry.js')
    const registry = getVenueRegistry()
    const venueIds = registry.getVenueIds()

    const venueMap = new Map<string, VenueAdapter>()
    for (const id of venueIds) {
      if (!registry.isConnected(id)) continue
      const adapter = registry.get(id)
      if (adapter) venueMap.set(id, adapter)
    }

    if (venueMap.size < 2) return []

    return await getArbitrageScanner().scan(venueMap)
  } catch {
    return []
  }
}
