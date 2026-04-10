/**
 * Weekly Review Coach tests — venue stats, cross-vertical insights,
 * quiet week handling, archetype templates, terminal formatting.
 */

import { describe, it, expect } from 'vitest'
import {
  generateWeeklyReview,
  formatWeeklyReviewForTerminal,
  type WeeklyReviewReport,
} from '../weekly-review'
import type { DiaryEntry } from '../diary'
import type { TradeReport } from '../trade-report'

// ── Helpers ─────────────────────────────────────────────────────────────────

const NOW = new Date('2026-04-04T12:00:00Z')
const DAY_MS = 24 * 60 * 60 * 1000

function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * DAY_MS)
}

function makeDiaryEntry(overrides: Partial<DiaryEntry> = {}): DiaryEntry {
  return {
    id: `entry-${Math.random().toString(36).slice(2)}`,
    masterId: 'warren_buffett',
    timestamp: daysAgo(1),
    tradeSymbol: 'BTC/USDT',
    tradeSide: 'buy',
    observation: 'test observation',
    patternType: 'general',
    outcome: 'profit',
    tradeUtcHour: 14,
    holdDurationMs: 3_600_000,
    positionSizePercentile: 50,
    profitPercent: 5.0,
    ...overrides,
  }
}

function makeTradeReport(overrides: Partial<TradeReport> = {}): TradeReport {
  return {
    symbol: 'BTC/USDT',
    side: 'buy',
    entryPrice: 60000,
    exitPrice: 63000,
    quantity: 0.1,
    grossPnL: 300,
    netPnL: 295,
    netPnLPercent: 5.0,
    totalFees: 5,
    initialRisk: 100,
    rMultiple: 2.95,
    holdDurationMs: 3_600_000,
    holdDurationHuman: '1h',
    mae: -1.5,
    mfe: 6.0,
    efficiencyRatio: 0.83,
    timestamp: daysAgo(1).getTime(),
    ...overrides,
  }
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('generateWeeklyReview', () => {
  it('generates review with sample diary data', () => {
    const entries: DiaryEntry[] = [
      makeDiaryEntry({ timestamp: daysAgo(1), tradeSymbol: 'BTC/USDT', outcome: 'profit' }),
      makeDiaryEntry({ timestamp: daysAgo(2), tradeSymbol: 'ETH/USDT', outcome: 'loss' }),
      makeDiaryEntry({ timestamp: daysAgo(3), tradeSymbol: 'SOL/USDT', outcome: 'profit' }),
    ]

    const reports: TradeReport[] = [
      makeTradeReport({ symbol: 'BTC/USDT', netPnL: 295, rMultiple: 2.95, timestamp: daysAgo(1).getTime() }),
      makeTradeReport({ symbol: 'ETH/USDT', netPnL: -150, rMultiple: -1.5, timestamp: daysAgo(2).getTime() }),
      makeTradeReport({ symbol: 'SOL/USDT', netPnL: 200, rMultiple: 2.0, timestamp: daysAgo(3).getTime() }),
    ]

    const review = generateWeeklyReview(entries, reports, 'warren_buffett', NOW)

    expect(review.masterName).toBe('Warren Buffett')
    expect(review.archetype).toBe('value_investor')
    expect(review.isQuietWeek).toBe(false)
    expect(review.overallStats.totalTrades).toBe(3)
    expect(review.reviewText).toContain('Warren Buffett')
    expect(review.reviewText).toContain('Win Rate:')
    expect(review.venueStats.length).toBeGreaterThan(0)
  })

  it('R-multiple stats calculation', () => {
    const reports: TradeReport[] = [
      makeTradeReport({ symbol: 'BTC/USDT', netPnL: 300, rMultiple: 3.0, timestamp: daysAgo(1).getTime() }),
      makeTradeReport({ symbol: 'ETH/USDT', netPnL: -100, rMultiple: -1.0, timestamp: daysAgo(2).getTime() }),
      makeTradeReport({ symbol: 'SOL/USDT', netPnL: 200, rMultiple: 2.0, timestamp: daysAgo(3).getTime() }),
      makeTradeReport({ symbol: 'BNB/USDT', netPnL: -50, rMultiple: -0.5, timestamp: daysAgo(4).getTime() }),
    ]

    const review = generateWeeklyReview([], reports, 'jim_simons', NOW)

    // 2 wins / 4 total = 50%
    expect(review.overallStats.winRate).toBe(50)
    // avg R = (3.0 + -1.0 + 2.0 + -0.5) / 4 = 0.875
    expect(review.overallStats.avgR).toBeCloseTo(0.875, 2)
    expect(review.overallStats.totalTrades).toBe(4)

    // All spot — single venue
    const spotVenue = review.venueStats.find(v => v.venue === 'spot')
    expect(spotVenue).toBeTruthy()
    expect(spotVenue!.totalTrades).toBe(4)
    expect(spotVenue!.bestTrade?.rMultiple).toBe(3.0)
    expect(spotVenue!.worstTrade?.rMultiple).toBe(-1.0)
  })

  it('empty week (no trades) produces quiet week message', () => {
    const review = generateWeeklyReview([], [], 'warren_buffett', NOW)

    expect(review.isQuietWeek).toBe(true)
    expect(review.overallStats.totalTrades).toBe(0)
    expect(review.reviewText).toContain('Patience')
    expect(review.venueStats.length).toBe(0)
  })

  it('quiet week for different archetypes', () => {
    // Trend follower quiet week
    const trendReview = generateWeeklyReview([], [], 'jesse_livermore', NOW)
    expect(trendReview.isQuietWeek).toBe(true)
    expect(trendReview.reviewText).toContain('No signals')

    // Quant quiet week
    const quantReview = generateWeeklyReview([], [], 'jim_simons', NOW)
    expect(quantReview.isQuietWeek).toBe(true)
    expect(quantReview.reviewText).toContain('No edge')
  })

  it('filters entries outside 7-day window', () => {
    const reports: TradeReport[] = [
      makeTradeReport({ symbol: 'BTC/USDT', timestamp: daysAgo(1).getTime() }),
      makeTradeReport({ symbol: 'OLD/USDT', timestamp: daysAgo(10).getTime() }), // too old
    ]

    const review = generateWeeklyReview([], reports, 'warren_buffett', NOW)

    expect(review.overallStats.totalTrades).toBe(1)
    expect(review.venueStats.length).toBe(1)
  })

  it('venue classification groups spot vs perp correctly', () => {
    const reports: TradeReport[] = [
      makeTradeReport({ symbol: 'BTC/USDT', timestamp: daysAgo(1).getTime() }),
      makeTradeReport({ symbol: 'ETH-PERP-SWAP', timestamp: daysAgo(2).getTime() }),
    ]

    const review = generateWeeklyReview([], reports, 'warren_buffett', NOW)

    const venues = review.venueStats.map(v => v.venue)
    expect(venues).toContain('spot')
    expect(venues).toContain('perp_futures')
    expect(review.venueStats.length).toBe(2)
  })

  it('archetype-specific template selection', () => {
    const reports: TradeReport[] = [
      makeTradeReport({ timestamp: daysAgo(1).getTime() }),
    ]

    // Trend follower
    const trendReview = generateWeeklyReview([], reports, 'jesse_livermore', NOW)
    expect(trendReview.archetype).toBe('trend_follower')
    expect(trendReview.reviewText).toContain('tape')

    // Quant
    const quantReview = generateWeeklyReview([], reports, 'jim_simons', NOW)
    expect(quantReview.archetype).toBe('quant')
    expect(quantReview.reviewText).toContain('metrics')

    // Philosopher
    const philReview = generateWeeklyReview([], reports, 'nassim_taleb', NOW)
    expect(philReview.archetype).toBe('philosopher')
    expect(philReview.reviewText).toContain('reflection')

    // Strategist
    const stratReview = generateWeeklyReview([], reports, 'sun_tzu', NOW)
    expect(stratReview.archetype).toBe('strategist')
    expect(stratReview.reviewText).toContain('battlefield')

    // Crypto native
    const cryptoReview = generateWeeklyReview([], reports, 'satoshi_nakamoto', NOW)
    expect(cryptoReview.archetype).toBe('crypto_native')
    expect(cryptoReview.reviewText).toContain('on-chain')
  })

  it('win streak triggers winStreak template', () => {
    const winReports: TradeReport[] = Array.from({ length: 5 }, (_, i) =>
      makeTradeReport({
        symbol: `WIN${i}/USDT`,
        netPnL: 100,
        rMultiple: 1.0,
        timestamp: daysAgo(i + 1).getTime(),
      }),
    )
    const review = generateWeeklyReview([], winReports, 'warren_buffett', NOW)
    // value_investor winStreak contains "overconfidence"
    expect(review.reviewText).toContain('overconfidence')
  })

  it('loss streak triggers lossStreak template', () => {
    const lossReports: TradeReport[] = Array.from({ length: 5 }, (_, i) =>
      makeTradeReport({
        symbol: `LOSS${i}/USDT`,
        netPnL: -100,
        rMultiple: -1.0,
        timestamp: daysAgo(i + 1).getTime(),
      }),
    )
    const review = generateWeeklyReview([], lossReports, 'warren_buffett', NOW)
    // value_investor lossStreak contains "tuition"
    expect(review.reviewText).toContain('tuition')
  })

  it('cross-vertical aggression mismatch detection', () => {
    const entries: DiaryEntry[] = [
      makeDiaryEntry({ tradeSymbol: 'BTC/USDT', positionSizePercentile: 80, timestamp: daysAgo(1) }),
      makeDiaryEntry({ tradeSymbol: 'ETH/USDT', positionSizePercentile: 85, timestamp: daysAgo(2) }),
      makeDiaryEntry({ tradeSymbol: 'BTC-PERP-SWAP', positionSizePercentile: 20, timestamp: daysAgo(3) }),
      makeDiaryEntry({ tradeSymbol: 'ETH-PERP-SWAP', positionSizePercentile: 15, timestamp: daysAgo(4) }),
    ]

    const reports: TradeReport[] = [
      makeTradeReport({ symbol: 'BTC/USDT', timestamp: daysAgo(1).getTime() }),
      makeTradeReport({ symbol: 'ETH/USDT', timestamp: daysAgo(2).getTime() }),
      makeTradeReport({ symbol: 'BTC-PERP-SWAP', timestamp: daysAgo(3).getTime() }),
      makeTradeReport({ symbol: 'ETH-PERP-SWAP', timestamp: daysAgo(4).getTime() }),
    ]

    const review = generateWeeklyReview(entries, reports, 'nassim_taleb', NOW)

    const mismatch = review.crossVerticalInsights.find(i => i.type === 'aggression_mismatch')
    expect(mismatch).toBeTruthy()
    expect(mismatch!.message).toContain('Aggressive')
  })

  it('venue avoidance detection (low win rate venue)', () => {
    // Create 4 trades in one venue all losing
    const reports: TradeReport[] = [
      makeTradeReport({ symbol: 'BTC-PERP-SWAP', netPnL: -100, rMultiple: -1.0, timestamp: daysAgo(1).getTime() }),
      makeTradeReport({ symbol: 'ETH-PERP-SWAP', netPnL: -50, rMultiple: -0.5, timestamp: daysAgo(2).getTime() }),
      makeTradeReport({ symbol: 'SOL-PERP-SWAP', netPnL: -80, rMultiple: -0.8, timestamp: daysAgo(3).getTime() }),
      // add a spot winner to have multiple venues
      makeTradeReport({ symbol: 'BTC/USDT', netPnL: 200, rMultiple: 2.0, timestamp: daysAgo(4).getTime() }),
    ]

    const review = generateWeeklyReview([], reports, 'warren_buffett', NOW)

    const avoidance = review.crossVerticalInsights.find(i => i.type === 'venue_avoidance')
    expect(avoidance).toBeTruthy()
    expect(avoidance!.message).toContain('Futures')
  })

  it('concentration detection (>80% in one venue)', () => {
    // 5 spot trades, 1 futures trade
    const reports: TradeReport[] = [
      ...Array.from({ length: 5 }, (_, i) =>
        makeTradeReport({ symbol: `TOKEN${i}/USDT`, timestamp: daysAgo(i + 1).getTime() }),
      ),
      makeTradeReport({ symbol: 'BTC-PERP-SWAP', timestamp: daysAgo(6).getTime() }),
    ]

    const review = generateWeeklyReview([], reports, 'warren_buffett', NOW)

    const concentration = review.crossVerticalInsights.find(i => i.type === 'concentration')
    expect(concentration).toBeTruthy()
    expect(concentration!.message).toContain('Spot')
  })

  it('mixed venue reports compute per-venue stats', () => {
    const reports: TradeReport[] = [
      makeTradeReport({ symbol: 'BTC/USDT', netPnL: 300, rMultiple: 3.0, timestamp: daysAgo(1).getTime() }),
      makeTradeReport({ symbol: 'ETH/USDT', netPnL: -100, rMultiple: -1.0, timestamp: daysAgo(2).getTime() }),
      makeTradeReport({ symbol: 'BTC-PERP-SWAP', netPnL: 500, rMultiple: 5.0, timestamp: daysAgo(3).getTime() }),
      makeTradeReport({ symbol: 'ETH-CALL-30000', netPnL: 200, rMultiple: 2.0, timestamp: daysAgo(4).getTime() }),
    ]

    const review = generateWeeklyReview([], reports, 'ray_dalio', NOW)

    expect(review.venueStats.length).toBe(3) // spot, perp_futures, crypto_options
    const spotStats = review.venueStats.find(v => v.venue === 'spot')
    expect(spotStats).toBeTruthy()
    expect(spotStats!.totalTrades).toBe(2)
    expect(spotStats!.winRate).toBe(50) // 1 win out of 2
  })

  it('overall expectancy calculation', () => {
    const reports: TradeReport[] = [
      makeTradeReport({ symbol: 'A/USDT', netPnL: 200, rMultiple: 2.0, timestamp: daysAgo(1).getTime() }),
      makeTradeReport({ symbol: 'B/USDT', netPnL: -100, rMultiple: -1.0, timestamp: daysAgo(2).getTime() }),
    ]

    const review = generateWeeklyReview([], reports, 'warren_buffett', NOW)

    // winRate: 50%
    expect(review.overallStats.winRate).toBe(50)
    // avgR: (2.0 + -1.0) / 2 = 0.5
    expect(review.overallStats.avgR).toBeCloseTo(0.5, 2)
    // expectancy: 0.5 * 2.0 - 0.5 * 1.0 = 0.5
    expect(review.overallStats.expectancy).toBeCloseTo(0.5, 2)
  })
})

// ── Terminal Formatting ─────────────────────────────────────────────────────

describe('formatWeeklyReviewForTerminal', () => {
  it('formats a review with box-drawing characters', () => {
    const reports: TradeReport[] = [
      makeTradeReport({ symbol: 'BTC/USDT', timestamp: daysAgo(1).getTime() }),
    ]

    const review = generateWeeklyReview([], reports, 'warren_buffett', NOW)
    const formatted = formatWeeklyReviewForTerminal(review)

    // Should contain box-drawing characters
    expect(formatted).toContain('\u250C') // top-left corner
    expect(formatted).toContain('\u2514') // bottom-left corner
    expect(formatted).toContain('Weekly Review')
    expect(formatted).toContain('Warren Buffett')
  })

  it('formats a quiet week', () => {
    const review = generateWeeklyReview([], [], 'sun_tzu', NOW)
    const formatted = formatWeeklyReviewForTerminal(review)

    expect(formatted).toContain('Sun Tzu')
    expect(formatted).toContain('Trades: 0')
  })

  it('includes per-venue section for multi-venue reports', () => {
    const reports: TradeReport[] = [
      makeTradeReport({ symbol: 'BTC/USDT', timestamp: daysAgo(1).getTime() }),
      makeTradeReport({ symbol: 'BTC-PERP-SWAP', timestamp: daysAgo(2).getTime() }),
    ]

    const review = generateWeeklyReview([], reports, 'warren_buffett', NOW)
    const formatted = formatWeeklyReviewForTerminal(review)

    expect(formatted).toContain('Per-Venue')
    expect(formatted).toContain('spot')
    expect(formatted).toContain('perp_futures')
  })

  it('includes cross-vertical insights section', () => {
    // 5 spot + 1 futures to trigger concentration
    const reports: TradeReport[] = [
      ...Array.from({ length: 5 }, (_, i) =>
        makeTradeReport({ symbol: `T${i}/USDT`, timestamp: daysAgo(i + 1).getTime() }),
      ),
      makeTradeReport({ symbol: 'BTC-PERP-SWAP', timestamp: daysAgo(6).getTime() }),
    ]

    const review = generateWeeklyReview([], reports, 'warren_buffett', NOW)
    const formatted = formatWeeklyReviewForTerminal(review)

    expect(formatted).toContain('Insights')
  })
})
