/**
 * Tests for forex-specific guardian checks, correlation matrix,
 * ghost triggers, and vertical dispatcher.
 *
 * Run with: bun test src/buddy/checks/forex/__tests__/forex-checks.test.ts
 */

import { describe, it, expect } from 'vitest'

import {
  CORRELATION_MATRIX,
  getCorrelation,
  findCorrelatedPairs,
  checkCorrelation,
} from '../correlation-check.js'
import {
  calculateCarryCostPerLot,
  calculateTotalCarryCost,
  checkCarryCost,
} from '../carry-cost.js'
import {
  evaluateEventRisk,
  checkCentralBankEvent,
} from '../central-bank-event.js'
import { runForexChecks } from '../index.js'
import { dispatchVerticalChecks } from '../../vertical-dispatcher.js'
import {
  checkSnbFrancShockTrigger,
  checkAsianCrisisTrigger,
} from '../../ghost-triggers.js'
import type { Position } from '../../../../services/exchange/types.js'
import type { VerticalContext } from '../../../verticals.js'

// ── Test Helpers ───────────────────────────────────────────────────────────

function makePosition(overrides: Partial<Position> = {}): Position {
  return {
    symbol: 'EUR/USD',
    side: 'buy',
    quantity: 100_000,
    entryPrice: 1.1000,
    currentPrice: 1.1050,
    unrealizedPnl: 500,
    unrealizedPnlPercent: 0.45,
    realizedPnl: 0,
    ...overrides,
  }
}

// ── Correlation Check Tests ────────────────────────────────────────────────

describe('Correlation Check', () => {
  describe('CORRELATION_MATRIX', () => {
    it('has EUR/USD vs GBP/USD at 0.85', () => {
      expect(CORRELATION_MATRIX['EUR/USD']?.['GBP/USD']).toBe(0.85)
    })

    it('has EUR/USD vs USD/CHF at -0.95', () => {
      expect(CORRELATION_MATRIX['EUR/USD']?.['USD/CHF']).toBe(-0.95)
    })

    it('has XAU/USD vs XAG/USD at 0.90', () => {
      expect(CORRELATION_MATRIX['XAU/USD']?.['XAG/USD']).toBe(0.90)
    })

    it('has symmetric lookups', () => {
      expect(getCorrelation('EUR/USD', 'GBP/USD')).toBe(0.85)
      expect(getCorrelation('GBP/USD', 'EUR/USD')).toBe(0.85)
    })
  })

  describe('getCorrelation', () => {
    it('returns 1.0 for same instrument', () => {
      expect(getCorrelation('EUR/USD', 'EUR/USD')).toBe(1.0)
    })

    it('returns 0 for unknown pairs', () => {
      expect(getCorrelation('EUR/USD', 'BTC/USDT')).toBe(0)
    })

    it('looks up reverse direction', () => {
      // GBP/USD -> EUR/GBP is -0.50 (in GBP/USD row)
      expect(getCorrelation('EUR/GBP', 'GBP/USD')).toBe(-0.50)
    })
  })

  describe('findCorrelatedPairs', () => {
    it('finds correlated positions', () => {
      const positions = [makePosition({ symbol: 'GBP/USD' })]
      const result = findCorrelatedPairs('EUR/USD', positions)
      expect(result.length).toBe(1)
      expect(result[0]!.symbol).toBe('GBP/USD')
      expect(result[0]!.correlation).toBe(0.85)
    })

    it('excludes same instrument', () => {
      const positions = [makePosition({ symbol: 'EUR/USD' })]
      const result = findCorrelatedPairs('EUR/USD', positions)
      expect(result.length).toBe(0)
    })

    it('excludes weakly correlated pairs', () => {
      const positions = [makePosition({ symbol: 'USD/JPY' })]
      // EUR/USD vs USD/JPY = -0.30 (below 0.5 threshold)
      const result = findCorrelatedPairs('EUR/USD', positions)
      expect(result.length).toBe(0)
    })

    it('includes negatively correlated pairs above threshold', () => {
      const positions = [makePosition({ symbol: 'USD/CHF' })]
      const result = findCorrelatedPairs('EUR/USD', positions)
      expect(result.length).toBe(1)
      expect(result[0]!.correlation).toBe(-0.95)
    })
  })

  describe('checkCorrelation', () => {
    it('passes with no correlated positions', () => {
      const result = checkCorrelation('EUR/USD', [])
      expect(result.status).toBe('pass')
    })

    it('warns on moderate correlation', () => {
      const positions = [makePosition({ symbol: 'AUD/USD' })]
      // EUR/USD vs AUD/USD = 0.70
      const result = checkCorrelation('EUR/USD', positions)
      expect(result.status).toBe('warn')
    })

    it('fails on very high correlation', () => {
      const positions = [makePosition({ symbol: 'USD/CHF' })]
      // EUR/USD vs USD/CHF = -0.95 (abs > 0.8)
      const result = checkCorrelation('EUR/USD', positions)
      expect(result.status).toBe('fail')
    })
  })
})

// ── Carry Cost Tests ───────────────────────────────────────────────────────

describe('Carry Cost Check', () => {
  describe('calculateCarryCostPerLot', () => {
    it('returns absolute value for negative swap', () => {
      expect(calculateCarryCostPerLot(-2.5)).toBe(2.5)
    })

    it('returns absolute value for positive swap', () => {
      expect(calculateCarryCostPerLot(1.5)).toBe(1.5)
    })
  })

  describe('calculateTotalCarryCost', () => {
    it('calculates cost for 1 lot (100k units)', () => {
      // -$2/day/lot * 1 lot = $2
      expect(calculateTotalCarryCost(-2.0, 100_000)).toBe(2.0)
    })

    it('calculates cost for 0.5 lot (50k units)', () => {
      expect(calculateTotalCarryCost(-2.0, 50_000)).toBe(1.0)
    })

    it('returns 0 for positive swap', () => {
      expect(calculateTotalCarryCost(1.5, 100_000)).toBe(0)
    })
  })

  describe('checkCarryCost', () => {
    it('passes when no context available', () => {
      const result = checkCarryCost(100_000, undefined)
      expect(result.status).toBe('pass')
    })

    it('passes on positive carry', () => {
      const ctx: VerticalContext = { vertical: 'forex', swapRate: 1.5 }
      const result = checkCarryCost(100_000, ctx)
      expect(result.status).toBe('pass')
      expect(result.message).toContain('Positive carry')
    })

    it('warns on moderate negative swap', () => {
      const ctx: VerticalContext = { vertical: 'forex', swapRate: -2.0 }
      const result = checkCarryCost(100_000, ctx)
      expect(result.status).toBe('warn')
    })

    it('fails on high negative swap', () => {
      const ctx: VerticalContext = { vertical: 'forex', swapRate: -6.0 }
      const result = checkCarryCost(100_000, ctx)
      expect(result.status).toBe('fail')
    })

    it('passes on small negative swap', () => {
      const ctx: VerticalContext = { vertical: 'forex', swapRate: -0.5 }
      const result = checkCarryCost(100_000, ctx)
      expect(result.status).toBe('pass')
    })
  })
})

// ── Central Bank Event Tests ───────────────────────────────────────────────

describe('Central Bank Event Check', () => {
  describe('evaluateEventRisk', () => {
    it('fails when event < 2 days away', () => {
      expect(evaluateEventRisk(1)).toEqual({ status: 'fail', daysToEvent: 1 })
      expect(evaluateEventRisk(0)).toEqual({ status: 'fail', daysToEvent: 0 })
    })

    it('warns when event 2-7 days away', () => {
      expect(evaluateEventRisk(2)).toEqual({ status: 'warn', daysToEvent: 2 })
      expect(evaluateEventRisk(5)).toEqual({ status: 'warn', daysToEvent: 5 })
      expect(evaluateEventRisk(7)).toEqual({ status: 'warn', daysToEvent: 7 })
    })

    it('passes when event > 7 days away', () => {
      expect(evaluateEventRisk(8)).toEqual({ status: 'pass', daysToEvent: 8 })
      expect(evaluateEventRisk(30)).toEqual({ status: 'pass', daysToEvent: 30 })
    })

    it('passes when undefined', () => {
      expect(evaluateEventRisk(undefined)).toEqual({
        status: 'pass',
        daysToEvent: undefined,
      })
    })
  })

  describe('checkCentralBankEvent', () => {
    it('passes with no context', () => {
      const result = checkCentralBankEvent('EUR/USD', undefined)
      expect(result.status).toBe('pass')
    })

    it('fails near CB event', () => {
      const ctx: VerticalContext = {
        vertical: 'forex',
        centralBankEventDays: 1,
      }
      const result = checkCentralBankEvent('EUR/USD', ctx)
      expect(result.status).toBe('fail')
      expect(result.message).toContain('1 day')
    })

    it('warns on approaching CB event', () => {
      const ctx: VerticalContext = {
        vertical: 'forex',
        centralBankEventDays: 5,
      }
      const result = checkCentralBankEvent('EUR/USD', ctx)
      expect(result.status).toBe('warn')
    })

    it('passes with distant CB event', () => {
      const ctx: VerticalContext = {
        vertical: 'forex',
        centralBankEventDays: 14,
      }
      const result = checkCentralBankEvent('EUR/USD', ctx)
      expect(result.status).toBe('pass')
    })
  })
})

// ── Forex Ghost Triggers ───────────────────────────────────────────────────

describe('Forex Ghost Triggers', () => {
  describe('SNB Franc Shock', () => {
    it('triggers on large position near CB event', () => {
      const positions = [
        makePosition({ quantity: 100_000, currentPrice: 1.1 }),
      ]
      const result = checkSnbFrancShockTrigger(positions, 1)
      expect(result).not.toBeNull()
      expect(result!.ghostId).toBe('snb_franc_shock')
      expect(result!.triggerReason).toContain('central bank surprise')
    })

    it('does not trigger when CB event > 2 days', () => {
      const positions = [
        makePosition({ quantity: 100_000, currentPrice: 1.1 }),
      ]
      const result = checkSnbFrancShockTrigger(positions, 3)
      expect(result).toBeNull()
    })

    it('does not trigger on small position', () => {
      const positions = [
        makePosition({ quantity: 1_000, currentPrice: 1.1 }),
      ]
      const result = checkSnbFrancShockTrigger(positions, 1)
      expect(result).toBeNull()
    })

    it('does not trigger with no positions', () => {
      const result = checkSnbFrancShockTrigger([], 1)
      expect(result).toBeNull()
    })

    it('does not trigger with undefined CB days', () => {
      const positions = [makePosition({ quantity: 100_000 })]
      const result = checkSnbFrancShockTrigger(positions, undefined)
      expect(result).toBeNull()
    })
  })

  describe('Asian Currency Crisis', () => {
    it('triggers on 3+ forex positions', () => {
      const positions = [
        makePosition({ symbol: 'EUR/USD' }),
        makePosition({ symbol: 'GBP/USD' }),
        makePosition({ symbol: 'AUD/USD' }),
      ]
      const result = checkAsianCrisisTrigger(positions)
      expect(result).not.toBeNull()
      expect(result!.ghostId).toBe('asian_crisis_1997')
      expect(result!.triggerReason).toContain('carry trade unwind')
    })

    it('triggers with underscore format too', () => {
      const positions = [
        makePosition({ symbol: 'EUR_USD' }),
        makePosition({ symbol: 'GBP_USD' }),
        makePosition({ symbol: 'XAU_USD' }),
      ]
      const result = checkAsianCrisisTrigger(positions)
      expect(result).not.toBeNull()
    })

    it('does not trigger with fewer than 3 forex positions', () => {
      const positions = [
        makePosition({ symbol: 'EUR/USD' }),
        makePosition({ symbol: 'GBP/USD' }),
      ]
      const result = checkAsianCrisisTrigger(positions)
      expect(result).toBeNull()
    })

    it('ignores non-forex positions', () => {
      const positions = [
        makePosition({ symbol: 'BTCUSDT' }),
        makePosition({ symbol: 'ETHUSDT' }),
        makePosition({ symbol: 'SOLUSDT' }),
      ]
      const result = checkAsianCrisisTrigger(positions)
      expect(result).toBeNull()
    })
  })
})

// ── Vertical Dispatcher ────────────────────────────────────────────────────

describe('Vertical Dispatcher', () => {
  it('dispatches forex checks', () => {
    const results = dispatchVerticalChecks({
      symbol: 'EUR/USD',
      quantity: 100_000,
      forexPositions: [makePosition({ symbol: 'GBP/USD' })],
      vertical: 'forex',
      swapRate: -2.0,
      centralBankEventDays: 5,
    })

    expect(results.length).toBe(3)

    const names = results.map(r => r.name)
    expect(names).toContain('FX Correlation')
    expect(names).toContain('Carry Cost')
    expect(names).toContain('CB Event')
  })

  it('returns empty for spot vertical', () => {
    const results = dispatchVerticalChecks({
      symbol: 'BTC/USDT',
      quantity: 1,
      positions: [],
      vertical: 'spot',
    })
    expect(results.length).toBe(0)
  })

  it('returns empty for unknown vertical', () => {
    const results = dispatchVerticalChecks({
      symbol: 'UNKNOWN',
      quantity: 100,
      positions: [],
      vertical: 'crypto_lending' as any,
    })
    expect(results.length).toBe(0)
  })

  it('runs full forex check suite', () => {
    const results = runForexChecks({
      symbol: 'EUR/USD',
      quantity: 100_000,
      positions: [],
    })
    // All 3 checks should run even with no context
    expect(results.length).toBe(3)
  })
})
