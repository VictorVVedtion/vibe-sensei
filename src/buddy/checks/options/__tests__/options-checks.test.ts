/**
 * Tests for options guardian checks, vertical dispatcher, and ghost triggers.
 *
 * Covers all 4 checks (greeks-exposure, theta-decay, iv-crush-risk, max-loss-check)
 * with pass/warn/fail thresholds, the vertical dispatcher, and both options ghosts.
 */

import { describe, test, expect } from 'vitest'
import { checkGreeksExposure } from '../greeks-exposure.js'
import { checkThetaDecay } from '../theta-decay.js'
import { checkIvCrushRisk } from '../iv-crush-risk.js'
import { checkMaxLoss } from '../max-loss-check.js'
import { runOptionsChecks } from '../vertical-dispatcher.js'
import { checkNickLeesonTrigger, checkOptionSellersTrigger } from '../ghost-triggers.js'
import type { VerticalContext } from '../../../verticals.js'

// ── Greeks Exposure ────────────────────────────────────────────────────────

describe('checkGreeksExposure', () => {
  test('pass: |netDelta| < 0.8', () => {
    const result = checkGreeksExposure(0.5)
    expect(result.passed).toBe(true)
    expect(result.severity).toBe('INFO')
    expect(result.name).toBe('greeks-exposure')
  })

  test('pass: negative delta within range', () => {
    const result = checkGreeksExposure(-0.3)
    expect(result.passed).toBe(true)
    expect(result.severity).toBe('INFO')
  })

  test('warn: |netDelta| = 0.8', () => {
    const result = checkGreeksExposure(0.8)
    expect(result.passed).toBe(false)
    expect(result.severity).toBe('WARNING')
  })

  test('warn: |netDelta| = 1.5', () => {
    const result = checkGreeksExposure(-1.5)
    expect(result.passed).toBe(false)
    expect(result.severity).toBe('WARNING')
  })

  test('fail: |netDelta| > 1.5', () => {
    const result = checkGreeksExposure(2.0)
    expect(result.passed).toBe(false)
    expect(result.severity).toBe('CRITICAL')
  })

  test('fail: large negative delta', () => {
    const result = checkGreeksExposure(-3.0)
    expect(result.passed).toBe(false)
    expect(result.severity).toBe('CRITICAL')
  })

  test('pass: zero delta', () => {
    const result = checkGreeksExposure(0)
    expect(result.passed).toBe(true)
  })
})

// ── Theta Decay ────────────────────────────────────────────────────────────

describe('checkThetaDecay', () => {
  test('pass: DTE > 14', () => {
    const result = checkThetaDecay(30, 'BTC-CALL')
    expect(result.passed).toBe(true)
    expect(result.severity).toBe('INFO')
    expect(result.name).toBe('theta-decay')
  })

  test('warn: DTE = 14', () => {
    const result = checkThetaDecay(14, 'BTC-CALL')
    expect(result.passed).toBe(false)
    expect(result.severity).toBe('WARNING')
  })

  test('warn: DTE = 4', () => {
    const result = checkThetaDecay(4, 'BTC-CALL')
    expect(result.passed).toBe(false)
    expect(result.severity).toBe('WARNING')
  })

  test('fail: DTE = 3', () => {
    const result = checkThetaDecay(3, 'BTC-CALL')
    expect(result.passed).toBe(false)
    expect(result.severity).toBe('CRITICAL')
  })

  test('fail: DTE = 0', () => {
    const result = checkThetaDecay(0, 'BTC-CALL')
    expect(result.passed).toBe(false)
    expect(result.severity).toBe('CRITICAL')
  })

  test('pass: DTE = 15', () => {
    const result = checkThetaDecay(15, 'BTC-CALL')
    expect(result.passed).toBe(true)
    expect(result.severity).toBe('INFO')
  })
})

// ── IV Crush Risk ──────────────────────────────────────────────────────────

describe('checkIvCrushRisk', () => {
  test('pass: IV rank < 60%', () => {
    const result = checkIvCrushRisk(40, 5, 'BTC-CALL')
    expect(result.passed).toBe(true)
    expect(result.severity).toBe('INFO')
    expect(result.name).toBe('iv-crush-risk')
  })

  test('pass: IV rank 70% but no event near', () => {
    const result = checkIvCrushRisk(70, 30, 'BTC-CALL')
    expect(result.passed).toBe(true)
    expect(result.severity).toBe('INFO')
  })

  test('warn: IV rank 65% with event in 5 days', () => {
    const result = checkIvCrushRisk(65, 5, 'BTC-CALL')
    expect(result.passed).toBe(false)
    expect(result.severity).toBe('WARNING')
  })

  test('warn: IV rank 80% with event in 7 days', () => {
    const result = checkIvCrushRisk(80, 7, 'BTC-CALL')
    expect(result.passed).toBe(false)
    expect(result.severity).toBe('WARNING')
  })

  test('fail: IV rank 85% with event in 2 days', () => {
    const result = checkIvCrushRisk(85, 2, 'BTC-CALL')
    expect(result.passed).toBe(false)
    expect(result.severity).toBe('CRITICAL')
  })

  test('fail: IV rank 95% with event in 1 day', () => {
    const result = checkIvCrushRisk(95, 1, 'BTC-CALL')
    expect(result.passed).toBe(false)
    expect(result.severity).toBe('CRITICAL')
  })
})

// ── Max Loss Check ─────────────────────────────────────────────────────────

describe('checkMaxLoss', () => {
  test('pass: maxLoss < 3%', () => {
    const result = checkMaxLoss(2, 10000, 'BTC-CALL')
    expect(result.passed).toBe(true)
    expect(result.severity).toBe('INFO')
    expect(result.name).toBe('max-loss-check')
  })

  test('warn: maxLoss = 3%', () => {
    const result = checkMaxLoss(3, 10000, 'BTC-CALL')
    expect(result.passed).toBe(false)
    expect(result.severity).toBe('WARNING')
  })

  test('warn: maxLoss = 4.5%', () => {
    const result = checkMaxLoss(4.5, 10000, 'BTC-CALL')
    expect(result.passed).toBe(false)
    expect(result.severity).toBe('WARNING')
  })

  test('fail: maxLoss > 5%', () => {
    const result = checkMaxLoss(7, 10000, 'BTC-CALL')
    expect(result.passed).toBe(false)
    expect(result.severity).toBe('CRITICAL')
  })

  test('fail: undefined max loss (naked shorts)', () => {
    const result = checkMaxLoss(null, 10000, 'BTC-CALL')
    expect(result.passed).toBe(false)
    expect(result.severity).toBe('CRITICAL')
    expect(result.message).toContain('naked')
  })

  test('warn: zero portfolio value', () => {
    const result = checkMaxLoss(2, 0, 'BTC-CALL')
    expect(result.passed).toBe(false)
    expect(result.severity).toBe('WARNING')
  })
})

// ── Vertical Dispatcher ────────────────────────────────────────────────────

describe('runOptionsChecks', () => {
  test('returns 4 check results for crypto_options context', () => {
    const ctx: VerticalContext = {
      vertical: 'crypto_options',
      greeks: { delta: 0.5, gamma: 0.01, theta: -0.05, vega: 0.1, rho: 0.001 },
      iv: 0.3,
      daysToExpiry: 30,
      strikePrice: 70000,
      optionType: 'call',
    }
    const results = runOptionsChecks(ctx)
    expect(results).toHaveLength(4)

    const names = results.map(r => r.name)
    expect(names).toContain('greeks-exposure')
    expect(names).toContain('theta-decay')
    expect(names).toContain('iv-crush-risk')
    expect(names).toContain('max-loss-check')
  })

  test('all pass for healthy context', () => {
    const ctx: VerticalContext = {
      vertical: 'crypto_options',
      greeks: { delta: 0.1, gamma: 0.001, theta: -0.01, vega: 0.05, rho: 0.001 },
      iv: 0.2,
      daysToExpiry: 45,
      strikePrice: 70000,
      optionType: 'call',
    }
    const results = runOptionsChecks(ctx)
    const allPass = results.every(r => r.passed)
    expect(allPass).toBe(true)
  })

  test('critical greeks exposure for high delta', () => {
    const ctx: VerticalContext = {
      vertical: 'crypto_options',
      greeks: { delta: 2.5, gamma: 0.01, theta: -0.05, vega: 0.1, rho: 0.001 },
      iv: 0.3,
      daysToExpiry: 30,
      strikePrice: 70000,
      optionType: 'call',
    }
    const results = runOptionsChecks(ctx)
    const greeksCheck = results.find(r => r.name === 'greeks-exposure')
    expect(greeksCheck?.severity).toBe('CRITICAL')
  })

  test('critical theta decay for low DTE', () => {
    const ctx: VerticalContext = {
      vertical: 'crypto_options',
      greeks: { delta: 0.1, gamma: 0.001, theta: -0.01, vega: 0.05, rho: 0.001 },
      iv: 0.2,
      daysToExpiry: 2,
      strikePrice: 70000,
      optionType: 'call',
    }
    const results = runOptionsChecks(ctx)
    const thetaCheck = results.find(r => r.name === 'theta-decay')
    expect(thetaCheck?.severity).toBe('CRITICAL')
  })
})

// ── Ghost Triggers ─────────────────────────────────────────────────────────

describe('checkNickLeesonTrigger', () => {
  test('returns null when no naked short', () => {
    const result = checkNickLeesonTrigger(false)
    expect(result).toBeNull()
  })

  test('triggers on naked short', () => {
    const result = checkNickLeesonTrigger(true)
    expect(result).not.toBeNull()
    expect(result!.ghostId).toBe('nick_leeson')
    expect(result!.ghostName).toContain('Nick Leeson')
    expect(result!.triggerReason).toContain('naked')
  })
})

describe('checkOptionSellersTrigger', () => {
  test('returns null when net gamma >= 0', () => {
    expect(checkOptionSellersTrigger(0)).toBeNull()
    expect(checkOptionSellersTrigger(0.5)).toBeNull()
  })

  test('triggers on negative net gamma', () => {
    const result = checkOptionSellersTrigger(-0.05)
    expect(result).not.toBeNull()
    expect(result!.ghostId).toBe('option_sellers')
    expect(result!.ghostName).toContain('OptionSellers')
    expect(result!.triggerReason).toContain('gamma')
  })

  test('includes gamma value in trigger reason', () => {
    const result = checkOptionSellersTrigger(-0.123456)
    expect(result!.triggerReason).toContain('-0.123456')
  })
})
