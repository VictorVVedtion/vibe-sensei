import { describe, expect, test } from 'vitest'
import {
  computeAssetValueUSD,
  computePortfolioValueUSD,
  getStalePenalty,
  type AssetVertical,
  type MarketSnapshot,
} from '../valuation.js'

// ── Helpers ───────────────────────────────────────────────────────────────

function pos(quantity: number) {
  return { quantity }
}

function snap(overrides: Partial<MarketSnapshot> = {}): MarketSnapshot {
  return { price: 100, ...overrides }
}

// ── computeAssetValueUSD — 7 vertical tests ──────────────────────────────

describe('computeAssetValueUSD', () => {
  test('spot: price * quantity', () => {
    const value = computeAssetValueUSD(pos(2), 'spot', snap({ price: 50_000 }))
    expect(value).toBe(100_000)
  })

  test('perp_futures: markPrice * quantity when markPrice provided', () => {
    const value = computeAssetValueUSD(
      pos(10),
      'perp_futures',
      snap({ price: 3000, markPrice: 3010 }),
    )
    expect(value).toBe(30_100)
  })

  test('perp_futures: falls back to price when no markPrice', () => {
    const value = computeAssetValueUSD(
      pos(10),
      'perp_futures',
      snap({ price: 3000 }),
    )
    expect(value).toBe(30_000)
  })

  test('crypto_options: price * quantity (premium-based)', () => {
    const value = computeAssetValueUSD(
      pos(5),
      'crypto_options',
      snap({ price: 200 }),
    )
    expect(value).toBe(1_000)
  })

  test('stocks: price * quantity', () => {
    const value = computeAssetValueUSD(
      pos(100),
      'stocks',
      snap({ price: 150.5 }),
    )
    expect(value).toBe(15_050)
  })

  test('prediction: probability * quantity when probability provided', () => {
    const value = computeAssetValueUSD(
      pos(1000),
      'prediction',
      snap({ price: 0.65, probability: 0.72 }),
    )
    expect(value).toBe(720)
  })

  test('prediction: falls back to price when no probability', () => {
    const value = computeAssetValueUSD(
      pos(1000),
      'prediction',
      snap({ price: 0.65 }),
    )
    expect(value).toBe(650)
  })

  test('defi_dex: price * quantity', () => {
    const value = computeAssetValueUSD(
      pos(500),
      'defi_dex',
      snap({ price: 1.05 }),
    )
    expect(value).toBe(525)
  })

  test('forex: price * quantity (quote currency units)', () => {
    const value = computeAssetValueUSD(
      pos(10_000),
      'forex',
      snap({ price: 1.085 }),
    )
    expect(value).toBe(10_850)
  })

  test('uses absolute quantity for short positions', () => {
    const value = computeAssetValueUSD(pos(-5), 'spot', snap({ price: 100 }))
    expect(value).toBe(500)
  })
})

// ── getStalePenalty ───────────────────────────────────────────────────────

describe('getStalePenalty', () => {
  test('returns 1.0 for fresh data (undefined staleSince)', () => {
    expect(getStalePenalty(undefined)).toBe(1.0)
  })

  test('returns 1.0 for data within threshold (30s)', () => {
    expect(getStalePenalty(30_000)).toBe(1.0)
  })

  test('returns 1.0 for data exactly at threshold (60s)', () => {
    expect(getStalePenalty(60_000)).toBe(1.0)
  })

  test('returns 1.1 for stale data (90s)', () => {
    expect(getStalePenalty(90_000)).toBe(1.1)
  })

  test('returns 1.1 for very stale data (5 min)', () => {
    expect(getStalePenalty(300_000)).toBe(1.1)
  })
})

// ── computePortfolioValueUSD ─────────────────────────────────────────────

describe('computePortfolioValueUSD', () => {
  test('sums balances as USD', () => {
    const result = computePortfolioValueUSD([], [
      { currency: 'USDT', free: 8000, used: 2000, total: 10_000 },
      { currency: 'USD', free: 5000, used: 0, total: 5_000 },
    ])
    expect(result.totalUSD).toBe(15_000)
    expect(result.staleCount).toBe(0)
  })

  test('adds position unrealized PnL to total', () => {
    const positions = [
      {
        symbol: 'BTC/USDT',
        unrealizedPnl: 500,
        currentPrice: 60_000,
        quantity: 0.1,
      },
      {
        symbol: 'ETH/USDT',
        unrealizedPnl: -200,
        currentPrice: 3_000,
        quantity: 1,
      },
    ]
    const balances = [
      { currency: 'USDT', free: 10_000, used: 0, total: 10_000 },
    ]
    const result = computePortfolioValueUSD(positions, balances)
    expect(result.totalUSD).toBe(10_300) // 10000 + 500 - 200
  })

  test('tracks stale positions', () => {
    const positions = [
      {
        symbol: 'BTC/USDT',
        unrealizedPnl: 100,
        currentPrice: 60_000,
        quantity: 0.1,
        staleSince: 90_000, // stale
      },
      {
        symbol: 'ETH/USDT',
        unrealizedPnl: 50,
        currentPrice: 3_000,
        quantity: 1,
        staleSince: 30_000, // fresh
      },
      {
        symbol: 'SOL/USDT',
        unrealizedPnl: -25,
        currentPrice: 150,
        quantity: 10,
        // no staleSince = fresh
      },
    ]
    const result = computePortfolioValueUSD(positions, [])
    expect(result.staleCount).toBe(1)
    expect(result.totalUSD).toBe(125) // 100 + 50 - 25
  })

  test('groups unrealized PnL by venue', () => {
    const positions = [
      {
        symbol: 'BTC/USDT',
        unrealizedPnl: 400,
        currentPrice: 60_000,
        quantity: 0.1,
        venue: 'binance',
      },
      {
        symbol: 'ETH/USDT',
        unrealizedPnl: 100,
        currentPrice: 3_000,
        quantity: 1,
        venue: 'binance',
      },
      {
        symbol: 'AAPL',
        unrealizedPnl: 250,
        currentPrice: 180,
        quantity: 10,
        venue: 'alpaca',
      },
    ]
    const result = computePortfolioValueUSD(positions, [])
    expect(result.perVenue.get('binance')).toBe(500)
    expect(result.perVenue.get('alpaca')).toBe(250)
  })

  test('uses "default" venue when none specified', () => {
    const positions = [
      {
        symbol: 'BTC/USDT',
        unrealizedPnl: 100,
        currentPrice: 60_000,
        quantity: 0.1,
      },
    ]
    const result = computePortfolioValueUSD(positions, [])
    expect(result.perVenue.get('default')).toBe(100)
  })

  test('handles empty inputs', () => {
    const result = computePortfolioValueUSD([], [])
    expect(result.totalUSD).toBe(0)
    expect(result.staleCount).toBe(0)
    expect(result.perVenue.size).toBe(0)
  })
})
