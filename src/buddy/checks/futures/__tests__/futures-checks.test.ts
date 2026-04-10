/**
 * Tests for futures guardian checks, vertical dispatcher, ghost triggers,
 * and tilt leverage escalation.
 */

import { describe, it, expect } from 'vitest'
import type { VerticalContext } from '../../../verticals.js'
import { checkLeverageLimit } from '../leverage-limit.js'
import { checkLiquidationProximity } from '../liquidation-proximity.js'
import { checkFundingRateImpact } from '../funding-rate-impact.js'
import { checkMarginUtilization } from '../margin-utilization.js'
import { getVerticalChecks } from '../../vertical-dispatcher.js'
import { checkBitmexRektTrigger, checkBillHwangTrigger } from '../../ghost-triggers.js'
import { TiltDetector } from '../../../../services/trading/tilt-detector.js'

// ── Helpers ─────────────────────────────────────────────────────────────

function makeCtx(overrides: Partial<VerticalContext> = {}): VerticalContext {
  return { vertical: 'perp_futures', ...overrides }
}

// ── Leverage Limit ──────────────────────────────────────────────────────

describe('checkLeverageLimit', () => {
  it('passes when leverage <= 5', () => {
    expect(checkLeverageLimit(makeCtx({ leverage: 3 })).status).toBe('pass')
    expect(checkLeverageLimit(makeCtx({ leverage: 5 })).status).toBe('pass')
  })

  it('warns when leverage is 6-20', () => {
    expect(checkLeverageLimit(makeCtx({ leverage: 6 })).status).toBe('warn')
    expect(checkLeverageLimit(makeCtx({ leverage: 20 })).status).toBe('warn')
  })

  it('fails when leverage is 21-50', () => {
    expect(checkLeverageLimit(makeCtx({ leverage: 21 })).status).toBe('fail')
    expect(checkLeverageLimit(makeCtx({ leverage: 50 })).status).toBe('fail')
  })

  it('emergency when leverage > 50', () => {
    expect(checkLeverageLimit(makeCtx({ leverage: 51 })).status).toBe('emergency')
    expect(checkLeverageLimit(makeCtx({ leverage: 125 })).status).toBe('emergency')
  })

  it('defaults to 1x when leverage is undefined', () => {
    expect(checkLeverageLimit(makeCtx()).status).toBe('pass')
  })
})

// ── Liquidation Proximity ───────────────────────────────────────────────

describe('checkLiquidationProximity', () => {
  it('passes when distance > 15%', () => {
    // price=100, liq=80 → distance=20%
    const result = checkLiquidationProximity(makeCtx({ liquidationPrice: 80 }), 100)
    expect(result.status).toBe('pass')
  })

  it('warns when distance is 5-15%', () => {
    // price=100, liq=90 → distance=10%
    const result = checkLiquidationProximity(makeCtx({ liquidationPrice: 90 }), 100)
    expect(result.status).toBe('warn')
  })

  it('fails when distance is 2-5%', () => {
    // price=100, liq=97 → distance=3%
    const result = checkLiquidationProximity(makeCtx({ liquidationPrice: 97 }), 100)
    expect(result.status).toBe('fail')
  })

  it('emergency when distance <= 2%', () => {
    // price=100, liq=99 → distance=1%
    const result = checkLiquidationProximity(makeCtx({ liquidationPrice: 99 }), 100)
    expect(result.status).toBe('emergency')
  })

  it('passes when no liquidation price available', () => {
    const result = checkLiquidationProximity(makeCtx(), 100)
    expect(result.status).toBe('pass')
  })

  it('passes when current price is 0', () => {
    const result = checkLiquidationProximity(makeCtx({ liquidationPrice: 50 }), 0)
    expect(result.status).toBe('pass')
  })
})

// ── Funding Rate Impact ─────────────────────────────────────────────────

describe('checkFundingRateImpact', () => {
  it('passes when annualized < 20%', () => {
    // 0.0001 * 3 * 365 * 100 = 10.95%
    const result = checkFundingRateImpact(makeCtx({ fundingRate: 0.0001 }))
    expect(result.status).toBe('pass')
  })

  it('warns when annualized 20-50%', () => {
    // 0.0003 * 3 * 365 * 100 = 32.85%
    const result = checkFundingRateImpact(makeCtx({ fundingRate: 0.0003 }))
    expect(result.status).toBe('warn')
  })

  it('fails when annualized > 50%', () => {
    // 0.001 * 3 * 365 * 100 = 109.5%
    const result = checkFundingRateImpact(makeCtx({ fundingRate: 0.001 }))
    expect(result.status).toBe('fail')
  })

  it('passes when no funding rate available', () => {
    const result = checkFundingRateImpact(makeCtx())
    expect(result.status).toBe('pass')
  })

  it('handles negative funding rates (receiving)', () => {
    // -0.0003 → annualized 32.85% (absolute value used)
    const result = checkFundingRateImpact(makeCtx({ fundingRate: -0.0003 }))
    expect(result.status).toBe('warn')
    expect(result.message).toContain('receiving')
  })
})

// ── Margin Utilization ──────────────────────────────────────────────────

describe('checkMarginUtilization', () => {
  it('passes when utilization < 50%', () => {
    expect(checkMarginUtilization(makeCtx({ marginUtilization: 30 })).status).toBe('pass')
    expect(checkMarginUtilization(makeCtx({ marginUtilization: 49.9 })).status).toBe('pass')
  })

  it('warns when utilization is 50-75%', () => {
    expect(checkMarginUtilization(makeCtx({ marginUtilization: 50 })).status).toBe('warn')
    expect(checkMarginUtilization(makeCtx({ marginUtilization: 75 })).status).toBe('warn')
  })

  it('fails when utilization is 75.1-90%', () => {
    expect(checkMarginUtilization(makeCtx({ marginUtilization: 80 })).status).toBe('fail')
    expect(checkMarginUtilization(makeCtx({ marginUtilization: 90 })).status).toBe('fail')
  })

  it('emergency when utilization > 90%', () => {
    expect(checkMarginUtilization(makeCtx({ marginUtilization: 91 })).status).toBe('emergency')
    expect(checkMarginUtilization(makeCtx({ marginUtilization: 99 })).status).toBe('emergency')
  })

  it('passes when no utilization data', () => {
    expect(checkMarginUtilization(makeCtx()).status).toBe('pass')
  })
})

// ── Vertical Dispatcher ─────────────────────────────────────────────────

describe('getVerticalChecks', () => {
  it('returns empty array when ctx is undefined', () => {
    expect(getVerticalChecks(undefined)).toEqual([])
  })

  it('returns empty array for spot vertical', () => {
    expect(getVerticalChecks({ vertical: 'spot' })).toEqual([])
  })

  it('returns 4 check results for perp_futures', () => {
    const ctx = makeCtx({
      leverage: 3,
      liquidationPrice: 80,
      fundingRate: 0.0001,
      marginUtilization: 30,
    })
    const results = getVerticalChecks(ctx, 100)
    expect(results.length).toBe(4)
    expect(results.map(r => r.name)).toEqual([
      'Futures: Leverage',
      'Futures: Liquidation',
      'Futures: Funding',
      'Futures: Margin',
    ])
  })

  it('returns results for supported verticals, empty for unknown', () => {
    // perp_futures returns CheckResult[]
    const futures = getVerticalChecks({ vertical: 'perp_futures' })
    expect(Array.isArray(futures)).toBe(true)
    expect(futures.length).toBe(4)
    // unknown vertical
    const unknown = getVerticalChecks({ vertical: 'crypto_lending' as any })
    expect(unknown).toEqual([])
  })
})

// ── Ghost Triggers ──────────────────────────────────────────────────────

describe('checkBitmexRektTrigger', () => {
  it('returns null when leverage <= 20', () => {
    expect(checkBitmexRektTrigger(20, 80)).toBeNull()
    expect(checkBitmexRektTrigger(10, 90)).toBeNull()
  })

  it('returns null when margin utilization <= 75', () => {
    expect(checkBitmexRektTrigger(50, 75)).toBeNull()
    expect(checkBitmexRektTrigger(100, 50)).toBeNull()
  })

  it('triggers when leverage > 20 AND margin > 75%', () => {
    const result = checkBitmexRektTrigger(25, 80)
    expect(result).not.toBeNull()
    expect(result!.ghostId).toBe('bitmex_rekt')
    expect(result!.triggerReason).toContain('25x')
    expect(result!.triggerReason).toContain('80%')
  })
})

describe('checkBillHwangTrigger', () => {
  const balances = [{ asset: 'USDT', free: 50000, used: 0, total: 100000 }]

  it('returns null when no positions', () => {
    expect(checkBillHwangTrigger([], balances, 10)).toBeNull()
  })

  it('returns null when leverage <= 1', () => {
    const positions = [{
      symbol: 'BTC/USDT', quantity: 1, entryPrice: 50000,
      currentPrice: 50000, unrealizedPnlPercent: 0,
    }]
    expect(checkBillHwangTrigger(positions as any, balances as any, 1)).toBeNull()
  })

  it('triggers when single leveraged position > 40% of portfolio', () => {
    // position value: 1 * 50000 = 50000, leveraged: 50000 * 5 = 250000
    // total balance: 100000, concentration: 250000/100000 = 250%
    const positions = [{
      symbol: 'BTC/USDT', quantity: 1, entryPrice: 50000,
      currentPrice: 50000, unrealizedPnlPercent: 0,
    }]
    const result = checkBillHwangTrigger(positions as any, balances as any, 5)
    expect(result).not.toBeNull()
    expect(result!.ghostId).toBe('bill_hwang')
    expect(result!.triggerReason).toContain('BTC/USDT')
  })

  it('returns null when leveraged position is under 40%', () => {
    // position value: 0.01 * 50000 = 500, leveraged: 500 * 2 = 1000
    // total balance: 100000, concentration: 1%
    const positions = [{
      symbol: 'BTC/USDT', quantity: 0.01, entryPrice: 50000,
      currentPrice: 50000, unrealizedPnlPercent: 0,
    }]
    expect(checkBillHwangTrigger(positions as any, balances as any, 2)).toBeNull()
  })
})

// ── Tilt: Leverage Escalation ───────────────────────────────────────────

describe('TiltDetector leverage escalation', () => {
  it('triggers on 3 futures trades with increasing leverage and 2+ losses', () => {
    const detector = new TiltDetector()

    detector.recordTrade({
      symbol: 'BTC/USDT', side: 'buy', pnlPercent: -2,
      positionSize: 1000, timestamp: 1, leverage: 5, vertical: 'perp_futures',
    })
    detector.recordTrade({
      symbol: 'BTC/USDT', side: 'buy', pnlPercent: -3,
      positionSize: 1000, timestamp: 2, leverage: 10, vertical: 'perp_futures',
    })
    const status = detector.recordTrade({
      symbol: 'BTC/USDT', side: 'buy', pnlPercent: -5,
      positionSize: 1000, timestamp: 3, leverage: 20, vertical: 'perp_futures',
    })

    expect(status.level).toBe('warning')
    expect(status.triggers).toContain('leverage escalation on futures during losses')
  })

  it('does not trigger when leverage is not increasing', () => {
    const detector = new TiltDetector()

    detector.recordTrade({
      symbol: 'BTC/USDT', side: 'buy', pnlPercent: -2,
      positionSize: 1000, timestamp: 1, leverage: 10, vertical: 'perp_futures',
    })
    detector.recordTrade({
      symbol: 'BTC/USDT', side: 'buy', pnlPercent: -3,
      positionSize: 1000, timestamp: 2, leverage: 10, vertical: 'perp_futures',
    })
    const status = detector.recordTrade({
      symbol: 'BTC/USDT', side: 'buy', pnlPercent: -5,
      positionSize: 1000, timestamp: 3, leverage: 10, vertical: 'perp_futures',
    })

    // Should still trigger for consecutive losses, but NOT leverage escalation
    expect(status.triggers).not.toContain('leverage escalation on futures during losses')
  })

  it('does not trigger when fewer than 2 losses', () => {
    const detector = new TiltDetector()

    detector.recordTrade({
      symbol: 'BTC/USDT', side: 'buy', pnlPercent: 5,
      positionSize: 1000, timestamp: 1, leverage: 5, vertical: 'perp_futures',
    })
    detector.recordTrade({
      symbol: 'BTC/USDT', side: 'buy', pnlPercent: 3,
      positionSize: 1000, timestamp: 2, leverage: 10, vertical: 'perp_futures',
    })
    const status = detector.recordTrade({
      symbol: 'BTC/USDT', side: 'buy', pnlPercent: -1,
      positionSize: 1000, timestamp: 3, leverage: 20, vertical: 'perp_futures',
    })

    expect(status.triggers).not.toContain('leverage escalation on futures during losses')
  })

  it('does not trigger for spot trades', () => {
    const detector = new TiltDetector()

    detector.recordTrade({
      symbol: 'BTC/USDT', side: 'buy', pnlPercent: -2,
      positionSize: 1000, timestamp: 1, leverage: 5, vertical: 'spot',
    })
    detector.recordTrade({
      symbol: 'BTC/USDT', side: 'buy', pnlPercent: -3,
      positionSize: 1000, timestamp: 2, leverage: 10, vertical: 'spot',
    })
    const status = detector.recordTrade({
      symbol: 'BTC/USDT', side: 'buy', pnlPercent: -5,
      positionSize: 1000, timestamp: 3, leverage: 20, vertical: 'spot',
    })

    expect(status.triggers).not.toContain('leverage escalation on futures during losses')
  })
})
