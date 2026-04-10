/**
 * Multi-Venue Aggregator tests — portfolio aggregation, concentration detection,
 * partial venue failures, empty portfolios, and singleton management.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  aggregatePortfolio,
  getMultiVenueAggregator,
  resetMultiVenueAggregator,
} from '../multi-venue-aggregator'
import {
  getVenueRegistry,
  resetVenueRegistry,
} from '../../exchange/venue-registry'
import type {
  Balance,
  ExchangeInterface,
  Position,
  TradingVertical,
  VenueAdapter,
  PredictionInterface,
  PredictionMarket,
  PredictionOrder,
  PredictionPosition,
  Order,
  OrderRequest,
  Candle,
  Ticker,
} from '../../exchange/types'

// ── Mock Factories ──────────────────────────────────────────────────────

function mockBalance(currency: string, total: number): Balance {
  return { currency, free: total, used: 0, total }
}

function mockPosition(
  symbol: string,
  qty: number,
  entryPrice: number,
  currentPrice: number,
): Position {
  const unrealizedPnl = (currentPrice - entryPrice) * qty
  const unrealizedPnlPercent = entryPrice > 0 ? (unrealizedPnl / (entryPrice * qty)) * 100 : 0
  return {
    symbol,
    side: 'buy',
    quantity: qty,
    entryPrice,
    currentPrice,
    unrealizedPnl,
    unrealizedPnlPercent,
    realizedPnl: 0,
  }
}

function mockExchange(
  positions: Position[],
  balances: Balance[],
): ExchangeInterface {
  return {
    connect: async () => {},
    getPositions: async () => positions,
    getBalance: async () => balances,
    placeOrder: async (_req: OrderRequest): Promise<Order> => {
      throw new Error('not implemented')
    },
    cancelOrder: async (): Promise<Order> => {
      throw new Error('not implemented')
    },
    getOpenOrders: async (): Promise<Order[]> => [],
    getCandles: async (): Promise<Candle[]> => [],
    getTicker: async (): Promise<Ticker> => ({
      symbol: '', last: 0, bid: 0, ask: 0, high: 0, low: 0, volume: 0, timestamp: 0,
    }),
  }
}

function mockPredictionInterface(
  positions: PredictionPosition[],
  balances: Balance[],
): PredictionInterface {
  return {
    connect: async () => {},
    getMarkets: async (): Promise<PredictionMarket[]> => [],
    placeBet: async (): Promise<PredictionOrder> => {
      throw new Error('not implemented')
    },
    getPositions: async () => positions,
    getBalance: async () => balances,
  }
}

function spotAdapter(positions: Position[], balances: Balance[]): VenueAdapter {
  return { vertical: 'spot', exchange: mockExchange(positions, balances) }
}

function futuresAdapter(positions: Position[], balances: Balance[]): VenueAdapter {
  return { vertical: 'perp_futures', exchange: mockExchange(positions, balances) }
}

function stocksAdapter(positions: Position[], balances: Balance[]): VenueAdapter {
  return { vertical: 'stocks', exchange: mockExchange(positions, balances) }
}

function predictionAdapter(
  positions: PredictionPosition[],
  balances: Balance[],
): VenueAdapter {
  return {
    vertical: 'prediction',
    prediction: mockPredictionInterface(positions, balances),
  }
}

function failingAdapter(vertical: TradingVertical): VenueAdapter {
  const failExchange: ExchangeInterface = {
    connect: async () => {},
    getPositions: async () => { throw new Error('venue offline') },
    getBalance: async () => { throw new Error('venue offline') },
    placeOrder: async (): Promise<Order> => { throw new Error('venue offline') },
    cancelOrder: async (): Promise<Order> => { throw new Error('venue offline') },
    getOpenOrders: async (): Promise<Order[]> => { throw new Error('venue offline') },
    getCandles: async (): Promise<Candle[]> => { throw new Error('venue offline') },
    getTicker: async (): Promise<Ticker> => { throw new Error('venue offline') },
  }
  return { vertical: vertical as 'spot', exchange: failExchange }
}

// ── Setup / Teardown ────────────────────────────────────────────────────

beforeEach(() => {
  resetVenueRegistry()
  resetMultiVenueAggregator()
})

afterEach(() => {
  resetVenueRegistry()
  resetMultiVenueAggregator()
})

// ── Portfolio Aggregation ───────────────────────────────────────────────

describe('aggregatePortfolio', () => {
  it('aggregates positions and balances across 3 venues', async () => {
    const registry = getVenueRegistry()

    // Spot venue: BTC position + USDT balance
    registry.register('binance-spot', spotAdapter(
      [mockPosition('BTC/USDT', 1, 60000, 65000)],
      [mockBalance('USDT', 10000)],
    ))
    registry.markConnected('binance-spot')

    // Futures venue: BTC perp + margin balance
    registry.register('binance-futures', futuresAdapter(
      [mockPosition('BTC/USDT', 0.5, 60000, 65000)],
      [mockBalance('USDT', 5000)],
    ))
    registry.markConnected('binance-futures')

    // Prediction venue: prediction position + balance
    registry.register('polymarket', predictionAdapter(
      [{ marketId: 'election', outcome: 'yes', shares: 100, avgPrice: 0.6, currentPrice: 0.7, unrealizedPnl: 10 }],
      [mockBalance('USDC', 500)],
    ))
    registry.markConnected('polymarket')

    const result = await aggregatePortfolio()

    // totalUSD = balances + PnL
    // BTC spot PnL: (65000-60000)*1 = 5000
    // BTC futures PnL: (65000-60000)*0.5 = 2500
    // Prediction PnL: 10
    // Balances: 10000 + 5000 + 500 = 15500
    // Total: 15500 + 5000 + 2500 + 10 = 23010
    expect(result.totalUSD).toBe(23010)
    expect(result.perAsset.size).toBeGreaterThan(0)
    expect(result.venueErrors.length).toBe(0)
  })

  it('detects cross-venue BTC concentration', async () => {
    const registry = getVenueRegistry()

    // BTC on two venues with high concentration
    registry.register('spot', spotAdapter(
      [mockPosition('BTC/USDT', 2, 60000, 65000)],
      [mockBalance('USDT', 1000)],
    ))
    registry.markConnected('spot')

    registry.register('futures', futuresAdapter(
      [mockPosition('BTC/USDT', 1, 60000, 65000)],
      [mockBalance('USDT', 1000)],
    ))
    registry.markConnected('futures')

    const result = await aggregatePortfolio()

    expect(result.perAsset.has('BTC')).toBe(true)
    expect(result.concentrationAlerts.length).toBeGreaterThan(0)
    expect(result.concentrationAlerts[0]).toContain('BTC')
  })

  it('handles partial venue failure gracefully', async () => {
    const registry = getVenueRegistry()

    // Working venue
    registry.register('spot', spotAdapter(
      [mockPosition('ETH/USDT', 10, 3000, 3200)],
      [mockBalance('USDT', 50000)],
    ))
    registry.markConnected('spot')

    // Failing venue
    registry.register('futures', failingAdapter('perp_futures'))
    registry.markConnected('futures')

    const result = await aggregatePortfolio()

    // Should still get data from the working venue
    expect(result.totalUSD).toBeGreaterThan(0)
    expect(result.perAsset.has('ETH')).toBe(true)

    // Should capture the error from the failing venue
    expect(result.venueErrors.length).toBeGreaterThan(0)
    expect(result.venueErrors.some((e) => e.venueId === 'futures')).toBe(true)
  })

  it('returns empty result when no venues are connected', async () => {
    const result = await aggregatePortfolio()

    expect(result.totalUSD).toBe(0)
    expect(result.perVenue.size).toBe(0)
    expect(result.perAsset.size).toBe(0)
    expect(result.concentrationAlerts.length).toBe(0)
    expect(result.venueErrors.length).toBe(0)
  })

  it('computes perVenue breakdown correctly', async () => {
    const registry = getVenueRegistry()

    registry.register('spot', spotAdapter(
      [mockPosition('BTC/USDT', 1, 50000, 55000)],
      [mockBalance('USDT', 20000)],
    ))
    registry.markConnected('spot')

    const result = await aggregatePortfolio()

    // perVenue should include position venue and cash
    expect(result.perVenue.size).toBeGreaterThan(0)
    expect(result.perVenue.has('cash')).toBe(true)
    expect(result.perVenue.get('cash')).toBe(20000)
  })

  it('handles zero-quantity positions', async () => {
    const registry = getVenueRegistry()

    registry.register('spot', spotAdapter(
      [mockPosition('BTC/USDT', 0, 60000, 65000)],
      [mockBalance('USDT', 5000)],
    ))
    registry.markConnected('spot')

    const result = await aggregatePortfolio()

    expect(result.totalUSD).toBe(5000) // balance only, position PnL is 0
  })

  it('aggregates multiple positions in same asset across venues', async () => {
    const registry = getVenueRegistry()

    registry.register('spot', spotAdapter(
      [mockPosition('ETH/USDT', 5, 3000, 3500)],
      [mockBalance('USDT', 1000)],
    ))
    registry.markConnected('spot')

    registry.register('futures', futuresAdapter(
      [mockPosition('ETH/USDT', 3, 3000, 3500)],
      [mockBalance('USDT', 1000)],
    ))
    registry.markConnected('futures')

    const result = await aggregatePortfolio()

    // ETH should appear in perAsset with combined notional
    expect(result.perAsset.has('ETH')).toBe(true)
    // ETH notional: 5*3500 + 3*3500 = 17500 + 10500 = 28000
    expect(result.perAsset.get('ETH')).toBe(28000)
  })

  it('concentration alert shows multiple venues', async () => {
    const registry = getVenueRegistry()

    // BTC dominant across spot and futures, but also meets cross-venue threshold
    registry.register('spot', spotAdapter(
      [mockPosition('BTC/USDT', 1, 50000, 60000)],
      [mockBalance('USDT', 100)],
    ))
    registry.markConnected('spot')

    registry.register('futures', futuresAdapter(
      [mockPosition('BTC/USDT', 0.5, 50000, 60000)],
      [mockBalance('USDT', 100)],
    ))
    registry.markConnected('futures')

    const result = await aggregatePortfolio()

    expect(result.concentrationAlerts.length).toBeGreaterThan(0)
    // Alert should mention BTC
    const btcAlert = result.concentrationAlerts.find(a => a.includes('BTC'))
    expect(btcAlert).toBeDefined()
  })

  it('no concentration alert when portfolio is diversified', async () => {
    const registry = getVenueRegistry()

    // Multiple positions with roughly equal weight
    registry.register('spot', spotAdapter(
      [
        mockPosition('BTC/USDT', 0.01, 60000, 60000),
        mockPosition('ETH/USDT', 0.5, 3000, 3000),
        mockPosition('SOL/USDT', 10, 150, 150),
      ],
      [mockBalance('USDT', 10000)],
    ))
    registry.markConnected('spot')

    const result = await aggregatePortfolio()

    // With 10000 USDT balance + small positions, nothing should be concentrated
    expect(result.concentrationAlerts.length).toBe(0)
  })

  it('handles prediction venue positions correctly', async () => {
    const registry = getVenueRegistry()

    registry.register('polymarket', predictionAdapter(
      [
        { marketId: 'market-1', outcome: 'yes', shares: 50, avgPrice: 0.4, currentPrice: 0.6, unrealizedPnl: 10 },
        { marketId: 'market-2', outcome: 'no', shares: 100, avgPrice: 0.7, currentPrice: 0.3, unrealizedPnl: -40 },
      ],
      [mockBalance('USDC', 2000)],
    ))
    registry.markConnected('polymarket')

    const result = await aggregatePortfolio()

    // total = 2000 + 10 + (-40) = 1970
    expect(result.totalUSD).toBe(1970)
  })

  it('multiple venue errors are all captured', async () => {
    const registry = getVenueRegistry()

    registry.register('broken-1', failingAdapter('spot'))
    registry.markConnected('broken-1')

    registry.register('broken-2', failingAdapter('perp_futures'))
    registry.markConnected('broken-2')

    const result = await aggregatePortfolio()

    // Both venues should have errors
    expect(result.venueErrors.length).toBeGreaterThanOrEqual(2)
    expect(result.venueErrors.some(e => e.venueId === 'broken-1')).toBe(true)
    expect(result.venueErrors.some(e => e.venueId === 'broken-2')).toBe(true)
  })
})

// ── Singleton ───────────────────────────────────────────────────────────

describe('MultiVenueAggregator singleton', () => {
  it('singleton accessor works', async () => {
    const agg = getMultiVenueAggregator()
    const result = await agg.aggregate()
    expect(result.totalUSD).toBe(0)
  })

  it('reset clears the singleton', async () => {
    const agg1 = getMultiVenueAggregator()
    resetMultiVenueAggregator()
    const agg2 = getMultiVenueAggregator()
    // After reset, it's a new instance (though functionally equivalent)
    expect(agg1).not.toBe(agg2)
  })
})
