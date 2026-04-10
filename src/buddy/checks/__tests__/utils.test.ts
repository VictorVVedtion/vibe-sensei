/**
 * Tests for src/buddy/checks/utils.ts
 * Covers: totalPortfolioValue, positionNotional, totalNotionalValue, computeSMA, computeTrueRange
 */

import { describe, it, expect } from 'vitest'
import {
  totalPortfolioValue,
  positionNotional,
  totalNotionalValue,
  computeSMA,
  computeTrueRange,
} from '../utils.js'
import type { Position, Balance, Candle } from '../../../services/exchange/types.js'

// ── Helpers ────────────────────────────────────────────────────────────────

function makeBalance(currency: string, total: number): Balance {
  return { currency, free: total * 0.8, used: total * 0.2, total }
}

function makePosition(symbol: string, quantity: number, currentPrice: number): Position {
  return {
    symbol,
    side: quantity >= 0 ? 'buy' : 'sell',
    quantity,
    entryPrice: currentPrice * 0.95,
    currentPrice,
    unrealizedPnl: 0,
    unrealizedPnlPercent: 0,
    realizedPnl: 0,
  }
}

function makeCandle(high: number, low: number, close: number): Candle {
  return { timestamp: Date.now(), open: (high + low) / 2, high, low, close, volume: 1000 }
}

// ── totalPortfolioValue ────────────────────────────────────────────────────

describe('totalPortfolioValue', () => {
  it('sums total across multiple balances', () => {
    const balances = [makeBalance('USDT', 50_000), makeBalance('BTC', 30_000)]
    expect(totalPortfolioValue(balances)).toBe(80_000)
  })

  it('returns 0 for empty balances', () => {
    expect(totalPortfolioValue([])).toBe(0)
  })

  it('handles a single balance', () => {
    expect(totalPortfolioValue([makeBalance('ETH', 12_345)])).toBe(12_345)
  })
})

// ── positionNotional ───────────────────────────────────────────────────────

describe('positionNotional', () => {
  it('computes |quantity| * currentPrice', () => {
    const pos = makePosition('BTC/USDT', 2, 50_000)
    expect(positionNotional(pos)).toBe(100_000)
  })

  it('uses absolute quantity for short positions', () => {
    const pos = makePosition('ETH/USDT', -10, 3_000)
    expect(positionNotional(pos)).toBe(30_000)
  })

  it('returns 0 for zero-quantity position', () => {
    const pos = makePosition('SOL/USDT', 0, 150)
    expect(positionNotional(pos)).toBe(0)
  })
})

// ── totalNotionalValue ─────────────────────────────────────────────────────

describe('totalNotionalValue', () => {
  it('sums notional across positions', () => {
    const positions = [
      makePosition('BTC/USDT', 1, 60_000),
      makePosition('ETH/USDT', 10, 3_000),
    ]
    expect(totalNotionalValue(positions)).toBe(90_000)
  })

  it('returns 0 for empty positions', () => {
    expect(totalNotionalValue([])).toBe(0)
  })
})

// ── computeSMA ─────────────────────────────────────────────────────────────

describe('computeSMA', () => {
  it('computes SMA of last N values', () => {
    const values = [10, 20, 30, 40, 50]
    // SMA(3) of last 3 = (30+40+50)/3 = 40
    expect(computeSMA(values, 3)).toBe(40)
  })

  it('uses full array when period equals length', () => {
    const values = [2, 4, 6]
    expect(computeSMA(values, 3)).toBe(4)
  })

  it('returns NaN when values.length < period', () => {
    expect(computeSMA([1, 2], 5)).toBeNaN()
  })

  it('returns NaN when period is 0', () => {
    expect(computeSMA([1, 2, 3], 0)).toBeNaN()
  })

  it('returns NaN when period is negative', () => {
    expect(computeSMA([1, 2, 3], -1)).toBeNaN()
  })

  it('handles single-element array with period 1', () => {
    expect(computeSMA([42], 1)).toBe(42)
  })

  it('handles empty array', () => {
    expect(computeSMA([], 1)).toBeNaN()
  })
})

// ── computeTrueRange ───────────────────────────────────────────────────────

describe('computeTrueRange', () => {
  it('uses H-L when prevClose is between H and L', () => {
    const candle = makeCandle(110, 90, 100)
    // H-L = 20, |H-prevClose|=10, |L-prevClose|=10  → max = 20
    expect(computeTrueRange(candle, 100)).toBe(20)
  })

  it('uses |H - prevClose| when gap up', () => {
    const candle = makeCandle(120, 115, 118)
    // H-L=5, |H-100|=20, |L-100|=15 → max=20
    expect(computeTrueRange(candle, 100)).toBe(20)
  })

  it('uses |L - prevClose| when gap down', () => {
    const candle = makeCandle(85, 80, 82)
    // H-L=5, |H-100|=15, |L-100|=20 → max=20
    expect(computeTrueRange(candle, 100)).toBe(20)
  })

  it('returns 0 when H=L=prevClose', () => {
    const candle = makeCandle(100, 100, 100)
    expect(computeTrueRange(candle, 100)).toBe(0)
  })
})
