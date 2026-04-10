/**
 * Tests for stock guardian checks, ghost triggers, and vertical dispatcher routing.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import type { VerticalContext } from '../../../verticals.js'
import type { Position, Balance } from '../../../../services/exchange/types.js'
import { checkPdtCompliance, resetDayTradeCounter } from '../pdt-compliance.js'
import { checkMarketHours } from '../market-hours.js'
import { checkEarningsProximity } from '../earnings-proximity.js'
import { checkWorldComTrigger, checkBearStearnsTrigger } from '../ghost-triggers.js'
import { getVerticalChecks } from '../../vertical-dispatcher.js'

// ── Helpers ─────────────────────────────────────────────────────────────

function makeCtx(overrides: Partial<VerticalContext> = {}): VerticalContext {
  return { vertical: 'stocks', ...overrides }
}

function makePositions(symbols: Array<{ symbol: string; qty: number; price: number }>): Position[] {
  return symbols.map((s) => ({
    symbol: s.symbol,
    side: 'buy' as const,
    quantity: s.qty,
    entryPrice: s.price,
    currentPrice: s.price,
    unrealizedPnl: 0,
    unrealizedPnlPercent: 0,
    realizedPnl: 0,
  }))
}

function makeBalances(total: number): Balance[] {
  return [{ currency: 'USD', free: total * 0.5, used: total * 0.5, total }]
}

// ── PDT Compliance ────────────────────────────────────────────────────

describe('checkPdtCompliance', () => {
  beforeEach(() => {
    resetDayTradeCounter()
  })

  it('passes with 0 day trades', () => {
    const result = checkPdtCompliance(makeCtx({ dayTradeCount: 0 }))
    expect(result.status).toBe('pass')
  })

  it('passes with 1 day trade', () => {
    const result = checkPdtCompliance(makeCtx({ dayTradeCount: 1 }))
    expect(result.status).toBe('pass')
  })

  it('warns with 2 day trades', () => {
    const result = checkPdtCompliance(makeCtx({ dayTradeCount: 2 }))
    expect(result.status).toBe('warn')
    expect(result.message).toContain('2 day trades')
  })

  it('fails with 3 day trades', () => {
    const result = checkPdtCompliance(makeCtx({ dayTradeCount: 3 }))
    expect(result.status).toBe('fail')
    expect(result.message).toContain('PDT restriction')
  })

  it('fails with 4+ day trades', () => {
    const result = checkPdtCompliance(makeCtx({ dayTradeCount: 5 }))
    expect(result.status).toBe('fail')
  })
})

// ── Market Hours ──────────────────────────────────────────────────────

describe('checkMarketHours', () => {
  it('passes when isMarketHours is true', () => {
    const result = checkMarketHours(makeCtx({ isMarketHours: true }))
    expect(result.status).toBe('pass')
    expect(result.message).toContain('open')
  })

  it('warns or fails when isMarketHours is false', () => {
    const result = checkMarketHours(makeCtx({ isMarketHours: false }))
    // During extended hours it warns, during closed it fails
    expect(['warn', 'fail']).toContain(result.status)
  })

  it('uses heuristic when isMarketHours is undefined', () => {
    const result = checkMarketHours(makeCtx())
    // Result depends on current time, but should always return a valid status
    expect(['pass', 'warn', 'fail']).toContain(result.status)
    expect(result.name).toBe('Stocks: Market Hours')
  })
})

// ── Earnings Proximity ────────────────────────────────────────────────

describe('checkEarningsProximity', () => {
  it('passes when no earnings date known', () => {
    const result = checkEarningsProximity(makeCtx())
    expect(result.status).toBe('pass')
    expect(result.message).toContain('No upcoming')
  })

  it('passes when > 7 days to earnings', () => {
    const result = checkEarningsProximity(makeCtx({ daysToEarnings: 14 }))
    expect(result.status).toBe('pass')
    expect(result.message).toContain('14 days')
  })

  it('warns when 3-7 days to earnings', () => {
    expect(checkEarningsProximity(makeCtx({ daysToEarnings: 7 })).status).toBe('warn')
    expect(checkEarningsProximity(makeCtx({ daysToEarnings: 5 })).status).toBe('warn')
    expect(checkEarningsProximity(makeCtx({ daysToEarnings: 3 })).status).toBe('warn')
  })

  it('fails when < 3 days to earnings', () => {
    expect(checkEarningsProximity(makeCtx({ daysToEarnings: 2 })).status).toBe('fail')
    expect(checkEarningsProximity(makeCtx({ daysToEarnings: 1 })).status).toBe('fail')
    expect(checkEarningsProximity(makeCtx({ daysToEarnings: 0 })).status).toBe('fail')
  })

  it('passes with negative daysToEarnings (past earnings)', () => {
    const result = checkEarningsProximity(makeCtx({ daysToEarnings: -1 }))
    expect(result.status).toBe('pass')
  })
})

// ── Ghost Triggers ────────────────────────────────────────────────────

describe('checkWorldComTrigger', () => {
  it('returns null when no positions', () => {
    expect(checkWorldComTrigger([], makeBalances(100000), 3)).toBeNull()
  })

  it('returns null when no earnings data', () => {
    const positions = makePositions([{ symbol: 'AAPL', qty: 100, price: 200 }])
    expect(checkWorldComTrigger(positions, makeBalances(20000))).toBeNull()
  })

  it('returns null when earnings > 7 days', () => {
    const positions = makePositions([{ symbol: 'AAPL', qty: 100, price: 200 }])
    expect(checkWorldComTrigger(positions, makeBalances(20000), 10)).toBeNull()
  })

  it('returns null when no concentrated position', () => {
    const positions = makePositions([
      { symbol: 'AAPL', qty: 10, price: 200 },
      { symbol: 'TSLA', qty: 10, price: 200 },
    ])
    // Total portfolio: 100000, each position: 2000 (2%)
    expect(checkWorldComTrigger(positions, makeBalances(100000), 2)).toBeNull()
  })

  it('triggers when single stock > 50% of portfolio near earnings', () => {
    // Position value: 500 * 200 = 100000, balance total: 120000
    // Concentration: 100000/120000 = 83%
    const positions = makePositions([{ symbol: 'AAPL', qty: 500, price: 200 }])
    const result = checkWorldComTrigger(positions, makeBalances(120000), 2)
    expect(result).not.toBeNull()
    expect(result!.ghostId).toBe('worldcom')
    expect(result!.triggerReason).toContain('AAPL')
    expect(result!.triggerReason).toContain('2 days')
  })
})

describe('checkBearStearnsTrigger', () => {
  it('returns null when no positions', () => {
    expect(checkBearStearnsTrigger([], makeBalances(100000))).toBeNull()
  })

  it('returns null when no financial stocks', () => {
    const positions = makePositions([
      { symbol: 'AAPL', qty: 100, price: 200 },
      { symbol: 'TSLA', qty: 50, price: 300 },
    ])
    expect(checkBearStearnsTrigger(positions, makeBalances(100000))).toBeNull()
  })

  it('returns null when financial concentration <= 60%', () => {
    // JPM: 50 * 150 = 7500, portfolio total: 100000 = 7.5%
    const positions = makePositions([
      { symbol: 'JPM', qty: 50, price: 150 },
      { symbol: 'AAPL', qty: 400, price: 200 },
    ])
    expect(checkBearStearnsTrigger(positions, makeBalances(100000))).toBeNull()
  })

  it('triggers when financials > 60% of portfolio', () => {
    // JPM: 300 * 150 = 45000, GS: 100 * 350 = 35000
    // Total financial: 80000, portfolio total: 100000 = 80%
    const positions = makePositions([
      { symbol: 'JPM', qty: 300, price: 150 },
      { symbol: 'GS', qty: 100, price: 350 },
      { symbol: 'AAPL', qty: 10, price: 200 },
    ])
    const result = checkBearStearnsTrigger(positions, makeBalances(100000))
    expect(result).not.toBeNull()
    expect(result!.ghostId).toBe('bear_stearns')
    expect(result!.triggerReason).toContain('JPM')
    expect(result!.triggerReason).toContain('GS')
    expect(result!.triggerReason).toContain('financials')
  })
})

// ── Vertical Dispatcher ───────────────────────────────────────────────

describe('getVerticalChecks for stocks', () => {
  it('returns 3 check results for stocks vertical', () => {
    const ctx = makeCtx({
      dayTradeCount: 0,
      isMarketHours: true,
      daysToEarnings: 10,
    })
    const results = getVerticalChecks(ctx)
    expect(results.length).toBe(3)
    expect(results.map((r) => r.name)).toEqual([
      'Stocks: PDT Compliance',
      'Stocks: Market Hours',
      'Stocks: Earnings',
    ])
  })

  it('returns empty for spot vertical', () => {
    expect(getVerticalChecks({ vertical: 'spot' })).toEqual([])
  })

  it('returns 4 for perp_futures vertical', () => {
    const results = getVerticalChecks({
      vertical: 'perp_futures',
      leverage: 3,
      liquidationPrice: 80,
      fundingRate: 0.0001,
      marginUtilization: 30,
    }, 100)
    expect(results.length).toBe(4)
  })
})
