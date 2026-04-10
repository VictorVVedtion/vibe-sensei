/**
 * Tests for src/buddy/trade-review.ts
 * Covers: generateTradeReview template selection, entry quality, exit quality,
 * efficiency commentary, pattern comments, formatTradeReviewForTerminal
 *
 * Note: The sprint originally asked for weekly-review.ts tests, but that module
 * does not exist in the codebase. trade-review.ts is the closest match and
 * contains pure-logic template generation suitable for unit testing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateTradeReview, formatTradeReviewForTerminal } from '../trade-review.js'
import type { TradeReport } from '../trade-report.js'
import type { DiaryEntry } from '../diary.js'

// Mock the desktop bridge to avoid side effects
vi.mock('../../services/desktop/bridge.js', () => ({
  isDesktopMode: () => false,
  emitToDesktop: () => {},
}))

// Mock the knowledge event store to avoid side effects
vi.mock('../../services/knowledge/event-store.js', () => ({
  queueEvent: () => {},
}))

// ── Helpers ────────────────────────────────────────────────────────────────

function makeReport(overrides: Partial<TradeReport> = {}): TradeReport {
  return {
    symbol: 'BTC/USDT',
    side: 'buy',
    entryPrice: 50_000,
    exitPrice: 55_000,
    quantity: 1,
    grossPnL: 5_000,
    netPnL: 4_950,
    netPnLPercent: 9.9,
    totalFees: 50,
    initialRisk: 2_000,
    rMultiple: 2.475,
    holdDurationMs: 4 * 3_600_000,
    holdDurationHuman: '4h',
    mae: -2.5,
    mfe: 12.0,
    efficiencyRatio: 82,
    timestamp: Date.now(),
    ...overrides,
  }
}

function makeDiaryEntry(patternType: string): DiaryEntry {
  return {
    id: 'test-id',
    masterId: 'jesse_livermore',
    timestamp: new Date(),
    tradeSymbol: 'BTC/USDT',
    tradeSide: 'buy',
    observation: 'test',
    patternType: patternType as DiaryEntry['patternType'],
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('generateTradeReview', () => {
  beforeEach(() => {
    // Reset achievement state between tests by clearing the module cache
    // Achievement state is module-level, so we just verify the review text
  })

  it('includes hold duration in review text', () => {
    const report = makeReport({ holdDurationHuman: '2h 30m' })
    const result = generateTradeReview(report, 'jesse_livermore', [])
    expect(result.text).toContain('2h 30m')
  })

  it('selects goodEntry template for low MAE (< 0.5R)', () => {
    // MAE that yields < 0.5R: mae = -0.5%, entry=50000, qty=1, initialRisk=2000
    // maeR = |(-0.5/100)*50000*1| / 2000 = 250/2000 = 0.125R
    const report = makeReport({ mae: -0.5, initialRisk: 2_000 })
    const result = generateTradeReview(report, 'jesse_livermore', [])
    // Jesse Livermore is trend_follower: goodEntry = "Caught the move early. Timing was sharp."
    expect(result.text).toContain('Caught the move early')
  })

  it('selects badEntry template for high MAE (>= 1R)', () => {
    // maeR = |(-5/100)*50000*1| / 2000 = 2500/2000 = 1.25R
    const report = makeReport({ mae: -5, initialRisk: 2_000 })
    const result = generateTradeReview(report, 'jesse_livermore', [])
    // trend_follower badEntry = "Chased the move..."
    expect(result.text).toContain('Chased the move')
  })

  it('selects goodExit template for R > 1', () => {
    const report = makeReport({ rMultiple: 2.5 })
    const result = generateTradeReview(report, 'jesse_livermore', [])
    // trend_follower goodExit = "Let the winner run. This is how you trade."
    expect(result.text).toContain('Let the winner run')
    expect(result.text).toContain('2.5R')
  })

  it('selects breakeven template for -0.3 < R < 0.3', () => {
    const report = makeReport({ rMultiple: 0.1 })
    const result = generateTradeReview(report, 'jesse_livermore', [])
    // trend_follower breakeven = "Scratched it. No harm, no edge. Next."
    expect(result.text).toContain('Scratched it')
  })

  it('selects loss template for R < -0.3', () => {
    const report = makeReport({ rMultiple: -1.5 })
    const result = generateTradeReview(report, 'jesse_livermore', [])
    // trend_follower loss = "Cut quickly. The trend was not your friend here."
    expect(result.text).toContain('Cut quickly')
  })

  it('includes discipline commentary for high efficiency', () => {
    const report = makeReport({ efficiencyRatio: 85 })
    const result = generateTradeReview(report, 'jesse_livermore', [])
    // trend_follower discipline = "Rode the trend through noise. Well done."
    expect(result.text).toContain('Rode the trend')
  })

  it('includes impatient commentary for low efficiency with positive MFE', () => {
    const report = makeReport({ efficiencyRatio: 20, mfe: 10 })
    const result = generateTradeReview(report, 'jesse_livermore', [])
    // trend_follower impatient = "Jumped off too early. The trend had more to give."
    expect(result.text).toContain('Jumped off too early')
  })

  it('uses value_investor templates for Warren Buffett', () => {
    const report = makeReport({ rMultiple: 2.0 })
    const result = generateTradeReview(report, 'warren_buffett', [])
    expect(result.archetype).toBe('value_investor')
    // value_investor goodExit = "Patient holding rewarded. This is the way."
    expect(result.text).toContain('Patient holding rewarded')
  })

  it('uses crypto_native templates for SBF-adjacent masters', () => {
    const report = makeReport({ rMultiple: -1.0 })
    const result = generateTradeReview(report, 'arthur_hayes', [])
    expect(result.archetype).toBe('crypto_native')
    // crypto_native loss = "Rekt. It happens. Size down and survive."
    expect(result.text).toContain('Rekt')
  })

  it('includes pattern comments when dominant pattern exists (>= 2)', () => {
    const patterns = [
      makeDiaryEntry('early_exit'),
      makeDiaryEntry('early_exit'),
      makeDiaryEntry('early_exit'),
    ]
    const report = makeReport()
    const result = generateTradeReview(report, 'jesse_livermore', patterns)
    expect(result.text).toContain('exiting winners early')
  })

  it('does not include pattern comments with < 2 of same type', () => {
    const patterns = [
      makeDiaryEntry('early_exit'),
      makeDiaryEntry('fomo'),
    ]
    const report = makeReport()
    const result = generateTradeReview(report, 'jesse_livermore', patterns)
    expect(result.text).not.toContain('Pattern:')
  })

  it('ignores general pattern type', () => {
    const patterns = [
      makeDiaryEntry('general'),
      makeDiaryEntry('general'),
      makeDiaryEntry('general'),
    ]
    const report = makeReport()
    const result = generateTradeReview(report, 'jesse_livermore', patterns)
    expect(result.text).not.toContain('Pattern:')
  })

  it('returns correct masterName and masterId', () => {
    const report = makeReport()
    const result = generateTradeReview(report, 'george_soros', [])
    expect(result.masterName).toBe('George Soros')
    expect(result.masterId).toBe('george_soros')
    expect(result.archetype).toBe('macro_trader')
  })

  it('attaches the original report', () => {
    const report = makeReport()
    const result = generateTradeReview(report, 'jesse_livermore', [])
    expect(result.report).toBe(report)
  })
})

describe('formatTradeReviewForTerminal', () => {
  it('includes master name and review text', () => {
    const report = makeReport()
    const review = generateTradeReview(report, 'jesse_livermore', [])
    const formatted = formatTradeReviewForTerminal(review)
    expect(formatted).toContain('Jesse Livermore')
    expect(formatted).toContain(review.text)
  })

  it('includes ruler lines', () => {
    const report = makeReport()
    const review = generateTradeReview(report, 'jesse_livermore', [])
    const formatted = formatTradeReviewForTerminal(review)
    // Uses box-drawing character ━
    expect(formatted).toContain('\u2501')
  })
})
