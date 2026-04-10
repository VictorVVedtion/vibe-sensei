/**
 * Cross-Venue Arbitrage Scanner tests — funding rate differentials,
 * price divergence, probability vs IV, no-opportunity baseline,
 * confidence threshold filtering, error resilience, and output sorting.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { CrossVenueScanner, resetArbitrageScanner } from '../cross-venue-scanner'
import type {
  Balance,
  ExchangeInterface,
  FuturesInterface,
  OptionsInterface,
  OptionsChainEntry,
  Greeks,
  PredictionInterface,
  PredictionMarket,
  PredictionOrder,
  PredictionPosition,
  Ticker,
  VenueAdapter,
} from '../../exchange/types'

// ── Stub factories ──────────────────────────────────────────────────────────

function stubExchange(overrides?: Partial<ExchangeInterface>): ExchangeInterface {
  return {
    connect: async () => {},
    getBalance: async () => [],
    placeOrder: async () => { throw new Error('not implemented') },
    cancelOrder: async () => { throw new Error('not implemented') },
    getOpenOrders: async () => [],
    getPositions: async () => [],
    getCandles: async () => [],
    getTicker: async () => { throw new Error('not implemented') },
    ...overrides,
  }
}

function stubFutures(overrides?: Partial<FuturesInterface>): FuturesInterface {
  return {
    ...stubExchange(),
    setLeverage: async () => {},
    getFundingRate: async () => ({ rate: 0, nextTime: Date.now() + 28800000 }),
    setMarginMode: async () => {},
    ...overrides,
  }
}

function stubOptions(overrides?: Partial<OptionsInterface>): OptionsInterface {
  return {
    ...stubExchange(),
    getOptionsChain: async (): Promise<OptionsChainEntry[]> => [],
    getGreeks: async (): Promise<Greeks> => ({ delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 }),
    ...overrides,
  }
}

function stubPrediction(overrides?: Partial<PredictionInterface>): PredictionInterface {
  return {
    connect: async () => {},
    getMarkets: async (): Promise<PredictionMarket[]> => [],
    placeBet: async (): Promise<PredictionOrder> => { throw new Error('not implemented') },
    getPositions: async (): Promise<PredictionPosition[]> => [],
    getBalance: async (): Promise<Balance[]> => [],
    ...overrides,
  }
}

function makeTicker(bid: number, ask: number, symbol = 'BTC/USDT'): Ticker {
  return {
    symbol,
    last: (bid + ask) / 2,
    bid,
    ask,
    high: ask * 1.01,
    low: bid * 0.99,
    volume: 1000,
    timestamp: Date.now(),
  }
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('CrossVenueScanner', () => {
  let scanner: CrossVenueScanner

  beforeEach(() => {
    resetArbitrageScanner()
    scanner = new CrossVenueScanner()
  })

  // ── Funding Rate Spread Detection ────────────────────────────────────

  describe('funding rate spread detection', () => {
    it('detects funding rate differential above 0.01% threshold', async () => {
      const venueMap = new Map<string, VenueAdapter>()

      // Venue A: low funding rate (0.005%)
      venueMap.set('binance-perp', {
        vertical: 'perp_futures',
        exchange: stubFutures({
          getFundingRate: async () => ({ rate: 0.00005, nextTime: Date.now() }),
        }),
      })

      // Venue B: high funding rate (0.03%)
      venueMap.set('okx-perp', {
        vertical: 'perp_futures',
        exchange: stubFutures({
          getFundingRate: async () => ({ rate: 0.0003, nextTime: Date.now() }),
        }),
      })

      const opportunities = await scanner.scan(venueMap)
      const fundingOpps = opportunities.filter(o => o.type === 'funding_rate')

      expect(fundingOpps.length).toBeGreaterThan(0)

      const opp = fundingOpps[0]!
      expect(opp.venues).toContain('binance-perp')
      expect(opp.venues).toContain('okx-perp')
      expect(opp.spread).toBeGreaterThan(0.0001)
      expect(opp.confidence).toBeGreaterThan(0)
      expect(opp.confidence).toBeLessThanOrEqual(1)
      expect(opp.description).toContain('long on')
      expect(opp.description).toContain('short on')
    })

    it('does not flag when funding rates are similar', async () => {
      const venueMap = new Map<string, VenueAdapter>()

      venueMap.set('venue-a', {
        vertical: 'perp_futures',
        exchange: stubFutures({
          getFundingRate: async () => ({ rate: 0.0001, nextTime: Date.now() }),
        }),
      })

      venueMap.set('venue-b', {
        vertical: 'perp_futures',
        exchange: stubFutures({
          getFundingRate: async () => ({ rate: 0.00011, nextTime: Date.now() }),
        }),
      })

      const opportunities = await scanner.scan(venueMap)
      const fundingOpps = opportunities.filter(o => o.type === 'funding_rate')

      expect(fundingOpps).toHaveLength(0)
    })

    it('detects opportunities across 3 futures venues (pairwise)', async () => {
      const venueMap = new Map<string, VenueAdapter>()

      venueMap.set('venue-a', {
        vertical: 'perp_futures',
        exchange: stubFutures({
          getFundingRate: async () => ({ rate: 0.0001, nextTime: Date.now() }),
        }),
      })

      venueMap.set('venue-b', {
        vertical: 'perp_futures',
        exchange: stubFutures({
          getFundingRate: async () => ({ rate: 0.0005, nextTime: Date.now() }),
        }),
      })

      venueMap.set('venue-c', {
        vertical: 'perp_futures',
        exchange: stubFutures({
          getFundingRate: async () => ({ rate: 0.001, nextTime: Date.now() }),
        }),
      })

      const opportunities = await scanner.scan(venueMap)
      const fundingOpps = opportunities.filter(o => o.type === 'funding_rate')

      // Should detect pairs: (a,b), (a,c), (b,c) — at least 2 should exceed threshold
      expect(fundingOpps.length).toBeGreaterThanOrEqual(2)
    })
  })

  // ── Price Divergence Detection ───────────────────────────────────────

  describe('price divergence detection', () => {
    it('detects price divergence above 0.5% threshold', async () => {
      const venueMap = new Map<string, VenueAdapter>()

      // Venue A: BTC at ~$60,000
      venueMap.set('binance-spot', {
        vertical: 'spot',
        exchange: stubExchange({
          getTicker: async () => makeTicker(59900, 60100),
        }),
      })

      // Venue B: BTC at ~$60,600 (1% higher)
      venueMap.set('kraken-spot', {
        vertical: 'spot',
        exchange: stubExchange({
          getTicker: async () => makeTicker(60500, 60700),
        }),
      })

      const opportunities = await scanner.scan(venueMap)
      const priceOpps = opportunities.filter(o => o.type === 'price_divergence')

      expect(priceOpps.length).toBeGreaterThan(0)

      const opp = priceOpps[0]!
      expect(opp.venues).toContain('binance-spot')
      expect(opp.venues).toContain('kraken-spot')
      expect(opp.spread).toBeGreaterThan(0.005)
      expect(opp.description).toContain('buy on')
      expect(opp.description).toContain('sell on')
    })

    it('does not flag when prices are close', async () => {
      const venueMap = new Map<string, VenueAdapter>()

      venueMap.set('venue-a', {
        vertical: 'spot',
        exchange: stubExchange({
          getTicker: async () => makeTicker(60000, 60020),
        }),
      })

      venueMap.set('venue-b', {
        vertical: 'spot',
        exchange: stubExchange({
          getTicker: async () => makeTicker(60030, 60050),
        }),
      })

      const opportunities = await scanner.scan(venueMap)
      const priceOpps = opportunities.filter(o => o.type === 'price_divergence')

      expect(priceOpps).toHaveLength(0)
    })
  })

  // ── Probability vs IV Mismatch ──────────────────────────────────────

  describe('probability vs IV mismatch detection', () => {
    it('detects divergence between prediction market and options IV', async () => {
      const venueMap = new Map<string, VenueAdapter>()

      // Prediction venue: market with 80% probability
      venueMap.set('polymarket', {
        vertical: 'prediction',
        prediction: stubPrediction({
          getMarkets: async () => [{
            id: 'btc-100k',
            question: 'Will BTC hit 100k?',
            outcomes: ['yes', 'no'],
            volume: 1000000,
            endDate: '2026-12-31',
            currentPrices: [0.80, 0.20],
          }],
        }),
      })

      // Options venue: low IV (30%) implies ~30% probability of large move
      venueMap.set('deribit', {
        vertical: 'crypto_options',
        exchange: stubOptions({
          getOptionsChain: async () => [
            { symbol: 'BTC-100K-C', strike: 100000, expiry: '2026-12-31', type: 'call' as const, bid: 0.01, ask: 0.02, iv: 30, volume: 100, openInterest: 500 },
            { symbol: 'BTC-100K-P', strike: 100000, expiry: '2026-12-31', type: 'put' as const, bid: 0.01, ask: 0.02, iv: 30, volume: 80, openInterest: 400 },
          ],
        }),
      })

      const opportunities = await scanner.scan(venueMap)
      const probOpps = opportunities.filter(o => o.type === 'probability_vs_iv')

      expect(probOpps.length).toBeGreaterThan(0)
      expect(probOpps[0]!.description).toContain('prediction=')
      expect(probOpps[0]!.description).toContain('options-implied=')
    })

    it('returns empty when prediction and options agree', async () => {
      const venueMap = new Map<string, VenueAdapter>()

      // Prediction at 50%
      venueMap.set('polymarket', {
        vertical: 'prediction',
        prediction: stubPrediction({
          getMarkets: async () => [{
            id: 'btc-test',
            question: 'Will BTC move?',
            outcomes: ['yes', 'no'],
            volume: 100000,
            endDate: '2026-12-31',
            currentPrices: [0.50, 0.50],
          }],
        }),
      })

      // Options IV at 50 => implied prob = 50/100 = 0.50
      venueMap.set('deribit', {
        vertical: 'crypto_options',
        exchange: stubOptions({
          getOptionsChain: async () => [
            { symbol: 'BTC-C', strike: 60000, expiry: '2026-12-31', type: 'call' as const, bid: 0.1, ask: 0.2, iv: 50, volume: 100, openInterest: 500 },
          ],
        }),
      })

      const opportunities = await scanner.scan(venueMap)
      const probOpps = opportunities.filter(o => o.type === 'probability_vs_iv')

      expect(probOpps).toHaveLength(0)
    })

    it('returns empty when no prediction venues exist', async () => {
      const venueMap = new Map<string, VenueAdapter>()

      venueMap.set('deribit', {
        vertical: 'crypto_options',
        exchange: stubOptions(),
      })

      const opportunities = await scanner.scan(venueMap)
      const probOpps = opportunities.filter(o => o.type === 'probability_vs_iv')
      expect(probOpps).toHaveLength(0)
    })
  })

  // ── No Opportunity Baseline ──────────────────────────────────────────

  describe('no opportunity baseline', () => {
    it('returns empty array when all spreads are within thresholds', async () => {
      const venueMap = new Map<string, VenueAdapter>()

      venueMap.set('venue-a', {
        vertical: 'perp_futures',
        exchange: stubFutures({
          getFundingRate: async () => ({ rate: 0.0001, nextTime: Date.now() }),
          getTicker: async () => makeTicker(60000, 60010),
        }),
      })

      venueMap.set('venue-b', {
        vertical: 'perp_futures',
        exchange: stubFutures({
          getFundingRate: async () => ({ rate: 0.00011, nextTime: Date.now() }),
          getTicker: async () => makeTicker(60005, 60015),
        }),
      })

      const opportunities = await scanner.scan(venueMap)
      expect(opportunities).toHaveLength(0)
    })

    it('returns empty array with only one venue', async () => {
      const venueMap = new Map<string, VenueAdapter>()

      venueMap.set('solo-venue', {
        vertical: 'spot',
        exchange: stubExchange({
          getTicker: async () => makeTicker(60000, 60010),
        }),
      })

      const opportunities = await scanner.scan(venueMap)
      expect(opportunities).toHaveLength(0)
    })

    it('returns empty array with no venues', async () => {
      const venueMap = new Map<string, VenueAdapter>()
      const opportunities = await scanner.scan(venueMap)
      expect(opportunities).toHaveLength(0)
    })
  })

  // ── Confidence Threshold Filtering ──────────────────────────────────

  describe('confidence threshold', () => {
    it('higher spread produces higher confidence', async () => {
      const venueMap = new Map<string, VenueAdapter>()

      venueMap.set('venue-low', {
        vertical: 'perp_futures',
        exchange: stubFutures({
          getFundingRate: async () => ({ rate: 0.00005, nextTime: Date.now() }),
        }),
      })

      venueMap.set('venue-high', {
        vertical: 'perp_futures',
        exchange: stubFutures({
          getFundingRate: async () => ({ rate: 0.001, nextTime: Date.now() }),
        }),
      })

      const opportunities = await scanner.scan(venueMap)
      const fundingOpps = opportunities.filter(o => o.type === 'funding_rate')

      expect(fundingOpps.length).toBeGreaterThan(0)
      // Large spread should produce confidence near or at max
      expect(fundingOpps[0]!.confidence).toBeGreaterThan(0.5)
    })

    it('confidence is capped at 1.0', async () => {
      const venueMap = new Map<string, VenueAdapter>()

      // Extremely large spread
      venueMap.set('venue-a', {
        vertical: 'perp_futures',
        exchange: stubFutures({
          getFundingRate: async () => ({ rate: 0, nextTime: Date.now() }),
        }),
      })

      venueMap.set('venue-b', {
        vertical: 'perp_futures',
        exchange: stubFutures({
          getFundingRate: async () => ({ rate: 0.01, nextTime: Date.now() }),
        }),
      })

      const opportunities = await scanner.scan(venueMap)
      const fundingOpps = opportunities.filter(o => o.type === 'funding_rate')

      expect(fundingOpps.length).toBeGreaterThan(0)
      expect(fundingOpps[0]!.confidence).toBeLessThanOrEqual(1)
    })
  })

  // ── Resilience ───────────────────────────────────────────────────────

  describe('resilience', () => {
    it('returns opportunities from healthy venues when one fails', async () => {
      const venueMap = new Map<string, VenueAdapter>()

      venueMap.set('healthy-a', {
        vertical: 'perp_futures',
        exchange: stubFutures({
          getFundingRate: async () => ({ rate: 0.00005, nextTime: Date.now() }),
        }),
      })

      // Failing venue
      venueMap.set('broken', {
        vertical: 'perp_futures',
        exchange: stubFutures({
          getFundingRate: async () => { throw new Error('connection refused') },
          getTicker: async () => { throw new Error('connection refused') },
        }),
      })

      venueMap.set('healthy-b', {
        vertical: 'perp_futures',
        exchange: stubFutures({
          getFundingRate: async () => ({ rate: 0.0005, nextTime: Date.now() }),
        }),
      })

      const opportunities = await scanner.scan(venueMap)
      const fundingOpps = opportunities.filter(o => o.type === 'funding_rate')

      expect(fundingOpps.length).toBeGreaterThan(0)
      // Broken venue should not appear
      const brokenInvolved = fundingOpps.filter(o => o.venues.includes('broken'))
      expect(brokenInvolved).toHaveLength(0)
    })

    it('returns empty array when all venues fail', async () => {
      const venueMap = new Map<string, VenueAdapter>()

      venueMap.set('broken-a', {
        vertical: 'perp_futures',
        exchange: stubFutures({
          getFundingRate: async () => { throw new Error('timeout') },
          getTicker: async () => { throw new Error('timeout') },
        }),
      })

      venueMap.set('broken-b', {
        vertical: 'perp_futures',
        exchange: stubFutures({
          getFundingRate: async () => { throw new Error('rate limited') },
          getTicker: async () => { throw new Error('rate limited') },
        }),
      })

      const opportunities = await scanner.scan(venueMap)
      expect(opportunities).toHaveLength(0)
    })
  })

  // ── Output Sorting ──────────────────────────────────────────────────

  describe('output sorting', () => {
    it('sorts opportunities by riskAdjustedReturn descending', async () => {
      const venueMap = new Map<string, VenueAdapter>()

      venueMap.set('venue-a', {
        vertical: 'perp_futures',
        exchange: stubFutures({
          getFundingRate: async () => ({ rate: 0.00005, nextTime: Date.now() }),
          getTicker: async () => makeTicker(59000, 59100),
        }),
      })

      venueMap.set('venue-b', {
        vertical: 'perp_futures',
        exchange: stubFutures({
          getFundingRate: async () => ({ rate: 0.001, nextTime: Date.now() }),
          getTicker: async () => makeTicker(60000, 60100),
        }),
      })

      const opportunities = await scanner.scan(venueMap)

      if (opportunities.length >= 2) {
        for (let i = 0; i < opportunities.length - 1; i++) {
          expect(opportunities[i]!.riskAdjustedReturn)
            .toBeGreaterThanOrEqual(opportunities[i + 1]!.riskAdjustedReturn)
        }
      }
    })
  })
})
