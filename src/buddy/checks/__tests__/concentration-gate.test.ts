/**
 * Tests for src/buddy/checks/concentration-gate.ts
 * Covers: pass (<30%), warn (30-50%), fail (>50%), zero portfolio, custom thresholds, cross-venue label
 */

import { describe, it, expect } from 'vitest'
import { checkConcentrationGate } from '../concentration-gate.js'
import type { Position, Balance } from '../../../services/exchange/types.js'
import type { GateInput } from '../../../tools/PreTradeGateTool/types.js'
import type { ThresholdConfig } from '../../thresholds.js'

// ── Helpers ────────────────────────────────────────────────────────────────

function makeBalance(total: number): Balance {
  return { currency: 'USDT', free: total * 0.8, used: total * 0.2, total }
}

function makePosition(symbol: string, quantity: number, currentPrice: number): Position {
  return {
    symbol,
    side: 'buy',
    quantity,
    entryPrice: currentPrice,
    currentPrice,
    unrealizedPnl: 0,
    unrealizedPnlPercent: 0,
    realizedPnl: 0,
  }
}

function makeGateInput(symbol: string, quantity: number, price?: number): GateInput {
  return { symbol, side: 'buy', type: 'market', quantity, price }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('checkConcentrationGate', () => {
  const portfolio = [makeBalance(100_000)]

  it('pass: proposed trade < 30% of portfolio', () => {
    // 10,000 / 100,000 = 10%
    const input = makeGateInput('BTC/USDT', 0.2, 50_000)
    const result = checkConcentrationGate(input, [], portfolio, 50_000)
    expect(result.status).toBe('pass')
    expect(result.name).toBe('Concentration')
    expect(result.message).toContain('10.0%')
  })

  it('warn: proposed trade 30-50% of portfolio', () => {
    // 40,000 / 100,000 = 40%
    const input = makeGateInput('BTC/USDT', 0.8, 50_000)
    const result = checkConcentrationGate(input, [], portfolio, 50_000)
    expect(result.status).toBe('warn')
    expect(result.message).toContain('40.0%')
    expect(result.recommendation).toBeDefined()
  })

  it('fail: proposed trade > 50% of portfolio', () => {
    // 60,000 / 100,000 = 60%
    const input = makeGateInput('BTC/USDT', 1.2, 50_000)
    const result = checkConcentrationGate(input, [], portfolio, 50_000)
    expect(result.status).toBe('fail')
    expect(result.message).toContain('60.0%')
    expect(result.message).toContain('exceeds')
    expect(result.recommendation).toBeDefined()
  })

  it('pass: zero portfolio returns pass', () => {
    const zeroBalance = [makeBalance(0)]
    const input = makeGateInput('BTC/USDT', 1, 50_000)
    const result = checkConcentrationGate(input, [], zeroBalance, 50_000)
    expect(result.status).toBe('pass')
    expect(result.message).toContain('no portfolio value')
  })

  it('accumulates existing positions for the same symbol', () => {
    // Existing: 0.5 BTC @ 50,000 = 25,000
    // New: 0.6 BTC @ 50,000 = 30,000
    // Total: 55,000 / 100,000 = 55% → fail
    const existing = [makePosition('BTC/USDT', 0.5, 50_000)]
    const input = makeGateInput('BTC/USDT', 0.6, 50_000)
    const result = checkConcentrationGate(input, existing, portfolio, 50_000)
    expect(result.status).toBe('fail')
  })

  it('ignores positions in different symbols', () => {
    // Existing ETH position should not count toward BTC concentration
    const existing = [makePosition('ETH/USDT', 10, 3_000)]
    const input = makeGateInput('BTC/USDT', 0.2, 50_000) // 10,000 / 100,000 = 10%
    const result = checkConcentrationGate(input, existing, portfolio, 50_000)
    expect(result.status).toBe('pass')
  })

  it('uses custom thresholds when provided', () => {
    const customThresholds: ThresholdConfig = { warn: 0.10, critical: 0.20 }
    // 15,000 / 100,000 = 15% → warn (between 10% and 20%)
    const input = makeGateInput('BTC/USDT', 0.3, 50_000)
    const result = checkConcentrationGate(input, [], portfolio, 50_000, customThresholds)
    expect(result.status).toBe('warn')
  })

  it('fail with custom thresholds', () => {
    const customThresholds: ThresholdConfig = { warn: 0.10, critical: 0.20 }
    // 25,000 / 100,000 = 25% → fail (>20%)
    const input = makeGateInput('BTC/USDT', 0.5, 50_000)
    const result = checkConcentrationGate(input, [], portfolio, 50_000, customThresholds)
    expect(result.status).toBe('fail')
  })

  it('cross-venue: symbol label appears in message', () => {
    const input = makeGateInput('AAPL', 100, 180)
    // 18,000 / 100,000 = 18% → pass
    const result = checkConcentrationGate(input, [], portfolio, 180)
    expect(result.status).toBe('pass')
    expect(result.message).toContain('AAPL')
  })

  it('fail recommendation suggests safe quantity', () => {
    // 60,000 / 100,000 = 60% → fail
    const input = makeGateInput('BTC/USDT', 1.2, 50_000)
    const result = checkConcentrationGate(input, [], portfolio, 50_000)
    expect(result.status).toBe('fail')
    expect(result.recommendation).toMatch(/Reduce quantity/)
    expect(result.recommendation).toMatch(/30%/)
  })
})
