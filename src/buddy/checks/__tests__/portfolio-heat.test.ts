/**
 * Tests for src/buddy/checks/portfolio-heat.ts
 * Covers: pass (<10%), warn (10-20%), fail (>20%), zero portfolio, custom thresholds
 */

import { describe, it, expect } from 'vitest'
import { checkPortfolioHeat } from '../portfolio-heat.js'
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

describe('checkPortfolioHeat', () => {
  const portfolio = [makeBalance(100_000)]

  it('pass: total heat < 10%', () => {
    // New order: 0.1 BTC @ 50,000 = 5,000 → 5% heat
    const input = makeGateInput('BTC/USDT', 0.1, 50_000)
    const result = checkPortfolioHeat(input, [], portfolio)
    expect(result.status).toBe('pass')
    expect(result.name).toBe('Portfolio Heat')
    expect(result.message).toContain('5.0%')
  })

  it('warn: total heat 10-20%', () => {
    // Existing: 5,000 notional, new: 10,000 → 15% heat
    const existing = [makePosition('ETH/USDT', 1, 5_000)]
    const input = makeGateInput('BTC/USDT', 0.2, 50_000)
    const result = checkPortfolioHeat(input, existing, portfolio)
    expect(result.status).toBe('warn')
    expect(result.message).toContain('15.0%')
    expect(result.recommendation).toBeDefined()
  })

  it('fail: total heat > 20%', () => {
    // Existing: 10,000, new: 15,000 → 25% heat
    const existing = [makePosition('ETH/USDT', 2, 5_000)]
    const input = makeGateInput('BTC/USDT', 0.3, 50_000)
    const result = checkPortfolioHeat(input, existing, portfolio)
    expect(result.status).toBe('fail')
    expect(result.message).toContain('exceeds')
    expect(result.recommendation).toBeDefined()
  })

  it('pass: zero portfolio returns pass', () => {
    const zeroBalance = [makeBalance(0)]
    const input = makeGateInput('BTC/USDT', 1, 50_000)
    const result = checkPortfolioHeat(input, [], zeroBalance)
    expect(result.status).toBe('pass')
    expect(result.message).toContain('No portfolio value')
  })

  it('accumulates existing positions into heat', () => {
    // Existing: 3 positions totaling 18,000 notional
    // New: 5,000 → total 23,000 / 100,000 = 23% → fail
    const existing = [
      makePosition('BTC/USDT', 0.1, 60_000),  // 6,000
      makePosition('ETH/USDT', 2, 3_000),       // 6,000
      makePosition('SOL/USDT', 40, 150),         // 6,000
    ]
    const input = makeGateInput('DOGE/USDT', 50_000, 0.1) // 5,000
    const result = checkPortfolioHeat(input, existing, portfolio)
    expect(result.status).toBe('fail')
  })

  it('uses custom thresholds when provided', () => {
    const customThresholds: ThresholdConfig = { warn: 0.05, critical: 0.10 }
    // 7,000 / 100,000 = 7% → warn (between 5% and 10%)
    const input = makeGateInput('BTC/USDT', 0.14, 50_000)
    const result = checkPortfolioHeat(input, [], portfolio, customThresholds)
    expect(result.status).toBe('warn')
  })

  it('fail with custom thresholds', () => {
    const customThresholds: ThresholdConfig = { warn: 0.05, critical: 0.10 }
    // 15,000 / 100,000 = 15% → fail (>10%)
    const input = makeGateInput('BTC/USDT', 0.3, 50_000)
    const result = checkPortfolioHeat(input, [], portfolio, customThresholds)
    expect(result.status).toBe('fail')
  })

  it('uses input.price for new order notional', () => {
    // Explicitly set price to 40,000 (not position currentPrice)
    // 0.5 * 40,000 = 20,000 → 20% → warn (at boundary, <= failAt)
    const input = makeGateInput('BTC/USDT', 0.5, 40_000)
    const result = checkPortfolioHeat(input, [], portfolio)
    expect(result.status).toBe('warn')
  })

  it('falls back to position price when input.price is undefined', () => {
    // No price on input, but matching position exists
    const existing = [makePosition('BTC/USDT', 0.1, 50_000)]
    const input: GateInput = { symbol: 'BTC/USDT', side: 'buy', type: 'market', quantity: 0.1 }
    // Existing: 5,000. New: 0.1 * 50,000 = 5,000. Total: 10,000 / 100,000 = 10% → warn
    const result = checkPortfolioHeat(input, existing, portfolio)
    expect(result.status).toBe('warn')
  })
})
