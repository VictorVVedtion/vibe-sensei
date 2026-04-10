/**
 * Guardian Evolution Diary — the guardian learns your trading habits over time.
 * Records trade observations, detects behavioral patterns, and generates
 * personalized summaries through the guardian's voice.
 */

import { randomUUID } from 'crypto'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { homedir } from 'os'
import type { Master } from './types.js'
import { MASTER_NAMES } from './types.js'
import type { OrderSide } from '../services/exchange/types.js'
import type { TradeReport } from './trade-report.js'

// ─── Types ───────────────────────────────────────────────────────────────────

export type PatternType =
  | 'early_exit'
  | 'late_entry'
  | 'oversize'
  | 'revenge_trade'
  | 'good_discipline'
  | 'fomo'
  | 'general'
  | 'time_of_day_bias'
  | 'holding_period_bias'
  | 'instrument_bias'
  | 'position_size_bad'
  | 'averaging_down_bad'
  | 'pyramid_good'

export interface DiaryEntry {
  id: string
  masterId: string
  timestamp: Date
  tradeSymbol: string
  tradeSide: OrderSide
  observation: string
  patternType: PatternType
  outcome?: 'profit' | 'loss' | 'pending'
  /** UTC hour of the trade (0-23) */
  tradeUtcHour?: number
  /** Hold duration in milliseconds */
  holdDurationMs?: number
  /** Position size percentile relative to user average (0-100) */
  positionSizePercentile?: number
  /** Realized or unrealized profit/loss percentage */
  profitPercent?: number
}

export interface TradeEvent {
  symbol: string
  side: OrderSide
  entryPrice: number
  exitPrice?: number
  currentPrice: number
  quantity: number
  portfolioPercent: number
  priceChange24h: number
  timeSinceLastClose?: number  // milliseconds since last closed trade
  maxDrawdown?: number         // max % drawdown during hold
  profitPercent?: number       // realized or unrealized P&L %
  priceAfterExit?: number      // price after position was closed (for early_exit)
  samePairBuysLastHour: number // count of buys in same pair within last hour
}


// ─── Enhanced summary types ─────────────────────────────────────────────────

export interface SessionAnalysis {
  session: string
  winRate: number
  totalTrades: number
}

export interface HoldingPeriodAnalysis {
  period: string
  winRate: number
  totalTrades: number
}

export interface InstrumentBiasInfo {
  symbol: string
  winRate: number
  totalTrades: number
}

export interface EnhancedPatternSummary {
  topPattern: { type: PatternType; count: number; label: string; advice: string } | null
  timeOfDayAnalysis: SessionAnalysis[]
  holdingPeriodAnalysis: HoldingPeriodAnalysis[]
  instrumentBiases: InstrumentBiasInfo[]
  positionSizeBias: string | null
  averagingDownStats: { total: number; emotional: number; planned: number; mixed: number }
  pyramidStats: { total: number; profitable: number; unprofitable: number }
}

// ─── Serialization shapes ────────────────────────────────────────────────────

interface SerializedEntry {
  id: string
  masterId: string
  timestamp: string
  tradeSymbol: string
  tradeSide: OrderSide
  observation: string
  patternType: PatternType
  outcome?: 'profit' | 'loss' | 'pending'
  tradeUtcHour?: number
  holdDurationMs?: number
  positionSizePercentile?: number
  profitPercent?: number
}

interface DiaryFile {
  version: 1
  entries: SerializedEntry[]
  tradeReports?: TradeReport[]
}

export interface CumulativeStats {
  winRate: number
  avgR: number
  expectancy: number
  totalTrades: number
}

// ─── Pattern detection ───────────────────────────────────────────────────────

const EARLY_EXIT_PROFIT_THRESHOLD = 2
const EARLY_EXIT_CONTINUATION_THRESHOLD = 5
const LATE_ENTRY_PRICE_INCREASE_THRESHOLD = 15
const OVERSIZE_PORTFOLIO_THRESHOLD = 25
const REVENGE_TRADE_WINDOW_MS = 5 * 60 * 1000
const FOMO_BUY_THRESHOLD = 2
const DISCIPLINE_DRAWDOWN_THRESHOLD = 5

function detectEarlyExit(trade: TradeEvent): string | null {
  if (trade.exitPrice === undefined || trade.priceAfterExit === undefined) return null
  if (trade.profitPercent === undefined) return null
  if (trade.profitPercent <= 0 || trade.profitPercent >= EARLY_EXIT_PROFIT_THRESHOLD) return null

  const continuationPercent = ((trade.priceAfterExit - trade.exitPrice) / trade.exitPrice) * 100
  const sameDirection =
    (trade.side === 'buy' && continuationPercent >= EARLY_EXIT_CONTINUATION_THRESHOLD) ||
    (trade.side === 'sell' && continuationPercent <= -EARLY_EXIT_CONTINUATION_THRESHOLD)

  if (!sameDirection) return null
  const dir = Math.abs(continuationPercent).toFixed(1)
  return `Closed ${trade.symbol} with +${trade.profitPercent.toFixed(1)}% but price continued ${dir}% in your favor.`
}

function detectLateEntry(trade: TradeEvent): string | null {
  if (trade.side !== 'buy') return null
  if (trade.priceChange24h < LATE_ENTRY_PRICE_INCREASE_THRESHOLD) return null
  return `Bought ${trade.symbol} after a ${trade.priceChange24h.toFixed(1)}% run-up in 24h. Chasing momentum?`
}

function detectOversize(trade: TradeEvent): string | null {
  if (trade.portfolioPercent <= OVERSIZE_PORTFOLIO_THRESHOLD) return null
  return `${trade.symbol} position is ${trade.portfolioPercent.toFixed(1)}% of portfolio. Heavy concentration.`
}

function detectRevengeTrade(trade: TradeEvent, recentEntries: DiaryEntry[]): string | null {
  if (trade.timeSinceLastClose === undefined) return null
  if (trade.timeSinceLastClose >= REVENGE_TRADE_WINDOW_MS) return null

  const lastLoss = recentEntries
    .filter(e => e.outcome === 'loss')
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0]
  if (!lastLoss) return null

  const msSinceLoss = Date.now() - lastLoss.timestamp.getTime()
  if (msSinceLoss >= REVENGE_TRADE_WINDOW_MS) return null

  const mins = Math.round(trade.timeSinceLastClose / 60_000)
  return `New ${trade.side} on ${trade.symbol} only ${mins}min after closing a loss. Revenge trading?`
}

function detectGoodDiscipline(trade: TradeEvent): string | null {
  if (trade.maxDrawdown === undefined || trade.profitPercent === undefined) return null
  if (trade.maxDrawdown < DISCIPLINE_DRAWDOWN_THRESHOLD) return null
  if (trade.profitPercent <= 0) return null
  return `Held ${trade.symbol} through a ${trade.maxDrawdown.toFixed(1)}% drawdown and recovered to +${trade.profitPercent.toFixed(1)}%. Strong hands.`
}

function detectFomo(trade: TradeEvent): string | null {
  if (trade.side !== 'buy') return null
  if (trade.samePairBuysLastHour < FOMO_BUY_THRESHOLD) return null
  return `${trade.samePairBuysLastHour} buys on ${trade.symbol} within the last hour. FOMO stacking?`
}

function classifyTrade(
  trade: TradeEvent,
  recentEntries: DiaryEntry[],
): { patternType: PatternType; observation: string } {
  const earlyExit = detectEarlyExit(trade)
  if (earlyExit) return { patternType: 'early_exit', observation: earlyExit }

  const revenge = detectRevengeTrade(trade, recentEntries)
  if (revenge) return { patternType: 'revenge_trade', observation: revenge }

  const fomo = detectFomo(trade)
  if (fomo) return { patternType: 'fomo', observation: fomo }

  const lateEntry = detectLateEntry(trade)
  if (lateEntry) return { patternType: 'late_entry', observation: lateEntry }

  const oversize = detectOversize(trade)
  if (oversize) return { patternType: 'oversize', observation: oversize }

  const discipline = detectGoodDiscipline(trade)
  if (discipline) return { patternType: 'good_discipline', observation: discipline }

  return {
    patternType: 'general',
    observation: `${trade.side === 'buy' ? 'Opened' : 'Closed'} ${trade.symbol} at ${trade.currentPrice.toFixed(2)}.`,
  }
}

// ─── Behavioral pattern detectors (v2) ──────────────────────────────────────

type SessionName = 'Asian' | 'European' | 'American'

const SESSION_RANGES: Record<SessionName, [number, number]> = {
  Asian: [0, 8],
  European: [8, 16],
  American: [16, 24],
}

const TIME_BIAS_WIN_THRESHOLD = 0.35
const TIME_BIAS_MIN_TRADES = 5

/** Detect UTC time-of-day sessions with poor win rates. */
export function detectTimeOfDayBias(entries: DiaryEntry[]): string[] {
  const sessions: Record<SessionName, { wins: number; total: number }> = {
    Asian: { wins: 0, total: 0 },
    European: { wins: 0, total: 0 },
    American: { wins: 0, total: 0 },
  }

  for (const e of entries) {
    if (e.tradeUtcHour === undefined || e.outcome === 'pending') continue
    const hour = e.tradeUtcHour
    for (const [name, [lo, hi]] of Object.entries(SESSION_RANGES) as [SessionName, [number, number]][]) {
      if (hour >= lo && hour < hi) {
        sessions[name].total++
        if (e.outcome === 'profit') sessions[name].wins++
        break
      }
    }
  }

  const alerts: string[] = []
  for (const [name, { wins, total }] of Object.entries(sessions) as [SessionName, { wins: number; total: number }][]) {
    if (total < TIME_BIAS_MIN_TRADES) continue
    const winRate = wins / total
    if (winRate < TIME_BIAS_WIN_THRESHOLD) {
      const pct = (winRate * 100).toFixed(0)
      alerts.push(`${name} session (UTC ${SESSION_RANGES[name][0]}-${SESSION_RANGES[name][1]}): ${pct}% win rate across ${total} trades.`)
    }
  }
  return alerts
}

type HoldBucket = 'scalp' | 'swing' | 'position' | 'invest'

const HOLD_BUCKET_LABELS: Record<HoldBucket, string> = {
  scalp: 'Scalps (<1h)',
  swing: 'Swings (1-24h)',
  position: 'Positions (1-7d)',
  invest: 'Investments (>7d)',
}

const HOLD_BIAS_WIN_THRESHOLD = 0.30
const HOLD_BIAS_MIN_TRADES = 5
const MS_1H = 3_600_000
const MS_24H = 86_400_000
const MS_7D = 604_800_000

function classifyHoldDuration(ms: number): HoldBucket {
  if (ms < MS_1H) return 'scalp'
  if (ms < MS_24H) return 'swing'
  if (ms < MS_7D) return 'position'
  return 'invest'
}

/** Detect holding periods with poor win rates. */
export function detectHoldingPeriodBias(entries: DiaryEntry[]): string[] {
  const buckets: Record<HoldBucket, { wins: number; total: number }> = {
    scalp: { wins: 0, total: 0 },
    swing: { wins: 0, total: 0 },
    position: { wins: 0, total: 0 },
    invest: { wins: 0, total: 0 },
  }

  for (const e of entries) {
    if (e.holdDurationMs === undefined || e.outcome === 'pending') continue
    const bucket = classifyHoldDuration(e.holdDurationMs)
    buckets[bucket].total++
    if (e.outcome === 'profit') buckets[bucket].wins++
  }

  const alerts: string[] = []
  for (const [bucket, { wins, total }] of Object.entries(buckets) as [HoldBucket, { wins: number; total: number }][]) {
    if (total < HOLD_BIAS_MIN_TRADES) continue
    const winRate = wins / total
    if (winRate < HOLD_BIAS_WIN_THRESHOLD) {
      const pct = (winRate * 100).toFixed(0)
      alerts.push(`${HOLD_BUCKET_LABELS[bucket]}: ${pct}% win rate across ${total} trades.`)
    }
  }
  return alerts
}

const INSTRUMENT_BIAS_WIN_THRESHOLD = 0.35
const INSTRUMENT_BIAS_MIN_TRADES = 5

/** Detect instruments with consistently poor win rates. */
export function detectInstrumentBias(entries: DiaryEntry[]): string[] {
  const symbols = new Map<string, { wins: number; total: number }>()

  for (const e of entries) {
    if (e.outcome === 'pending') continue
    const stats = symbols.get(e.tradeSymbol) ?? { wins: 0, total: 0 }
    stats.total++
    if (e.outcome === 'profit') stats.wins++
    symbols.set(e.tradeSymbol, stats)
  }

  const alerts: string[] = []
  for (const [symbol, { wins, total }] of symbols) {
    if (total < INSTRUMENT_BIAS_MIN_TRADES) continue
    const winRate = wins / total
    if (winRate < INSTRUMENT_BIAS_WIN_THRESHOLD) {
      const pct = (winRate * 100).toFixed(0)
      alerts.push(`${symbol}: ${pct}% win rate across ${total} trades.`)
    }
  }
  return alerts
}

const LARGE_POSITION_PERCENTILE = 67
const POSITION_SIZE_MIN_LARGE = 3
const POSITION_SIZE_PENALTY_GAP = 20

/** Detect if large positions perform worse than average. */
export function detectPositionSizeCorrelation(entries: DiaryEntry[]): string | null {
  const resolved = entries.filter(e =>
    e.positionSizePercentile !== undefined && e.outcome !== 'pending',
  )
  if (resolved.length === 0) return null

  let totalWins = 0
  let totalCount = 0
  let largeWins = 0
  let largeCount = 0

  for (const e of resolved) {
    totalCount++
    if (e.outcome === 'profit') totalWins++
    if (e.positionSizePercentile! >= LARGE_POSITION_PERCENTILE) {
      largeCount++
      if (e.outcome === 'profit') largeWins++
    }
  }

  if (largeCount < POSITION_SIZE_MIN_LARGE) return null

  const avgWinRate = totalWins / totalCount
  const largeWinRate = largeWins / largeCount

  if (largeWinRate < 0.30 || (avgWinRate - largeWinRate) * 100 >= POSITION_SIZE_PENALTY_GAP) {
    const avgPct = (avgWinRate * 100).toFixed(0)
    const largePct = (largeWinRate * 100).toFixed(0)
    return `Large positions (top 33%): ${largePct}% win rate vs ${avgPct}% overall across ${largeCount} large trades.`
  }
  return null
}

export interface AveragingDownResult {
  symbol: string
  buyCount: number
  outcome: 'emotional' | 'planned' | 'mixed'
}

const AVERAGING_DOWN_WINDOW_MS = 2 * 3_600_000 // 2 hours
const EMOTIONAL_THRESHOLD_MS = 15 * 60_000     // 15 minutes
const PLANNED_THRESHOLD_MS = 30 * 60_000       // 30 minutes

/** Detect averaging-down patterns: same symbol, sequential buys, decreasing prices. */
export function detectAveragingDown(entries: DiaryEntry[]): AveragingDownResult[] {
  const sorted = [...entries]
    .filter(e => e.tradeSide === 'buy')
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

  const results: AveragingDownResult[] = []
  let i = 0

  while (i < sorted.length) {
    const chain: DiaryEntry[] = [sorted[i]!]
    let j = i + 1

    while (j < sorted.length) {
      const prev = chain[chain.length - 1]!
      const curr = sorted[j]!
      const gap = curr.timestamp.getTime() - prev.timestamp.getTime()
      if (curr.tradeSymbol !== prev.tradeSymbol || gap > AVERAGING_DOWN_WINDOW_MS) break
      chain.push(curr)
      j++
    }

    if (chain.length >= 2) {
      const gaps = chain.slice(1).map((e, idx) =>
        e.timestamp.getTime() - chain[idx]!.timestamp.getTime(),
      )
      const allEmotional = gaps.every(g => g < EMOTIONAL_THRESHOLD_MS)
      const allPlanned = gaps.every(g => g >= PLANNED_THRESHOLD_MS)

      results.push({
        symbol: chain[0]!.tradeSymbol,
        buyCount: chain.length,
        outcome: allEmotional ? 'emotional' : allPlanned ? 'planned' : 'mixed',
      })
    }

    i = j
  }
  return results
}

export interface PyramidResult {
  symbol: string
  buyCount: number
  outcome: 'profit' | 'loss' | 'mixed'
}

/** Detect pyramid patterns: same symbol, sequential buys, increasing prices. */
export function detectPyramidSuccess(entries: DiaryEntry[]): PyramidResult[] {
  const sorted = [...entries]
    .filter(e => e.tradeSide === 'buy' && e.profitPercent !== undefined)
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

  const results: PyramidResult[] = []
  let i = 0

  while (i < sorted.length) {
    const chain: DiaryEntry[] = [sorted[i]!]
    let j = i + 1

    while (j < sorted.length) {
      const prev = chain[chain.length - 1]!
      const curr = sorted[j]!
      if (curr.tradeSymbol !== prev.tradeSymbol) break
      // Price increasing = pyramid (profitPercent of later buys is positive)
      if (curr.profitPercent !== undefined && curr.profitPercent > (prev.profitPercent ?? 0)) {
        chain.push(curr)
      } else {
        break
      }
      j++
    }

    if (chain.length >= 2) {
      const profits = chain.filter(e => e.outcome === 'profit').length
      const losses = chain.filter(e => e.outcome === 'loss').length
      let outcome: 'profit' | 'loss' | 'mixed' = 'mixed'
      if (profits > 0 && losses === 0) outcome = 'profit'
      else if (losses > 0 && profits === 0) outcome = 'loss'

      results.push({
        symbol: chain[0]!.tradeSymbol,
        buyCount: chain.length,
        outcome,
      })
    }

    i = Math.max(i + 1, j)
  }
  return results
}

// ─── Pattern summary ─────────────────────────────────────────────────────────

const PATTERN_LABELS: Record<PatternType, string> = {
  early_exit: 'exit winning trades too early',
  late_entry: 'chase assets after big run-ups',
  oversize: 'take oversized positions',
  revenge_trade: 'revenge trade after losses',
  good_discipline: 'hold through drawdowns with discipline',
  fomo: 'FOMO-stack buys on the same asset',
  general: 'trade without a strong pattern',
  time_of_day_bias: 'trade poorly during certain hours',
  holding_period_bias: 'lose on certain holding periods',
  instrument_bias: 'lose consistently on certain instruments',
  position_size_bad: 'lose more on larger positions',
  averaging_down_bad: 'average down into losing positions',
  pyramid_good: 'successfully pyramid into winners',
}

const PATTERN_ADVICE: Record<PatternType, string> = {
  early_exit: 'Consider letting winners run with a trailing stop.',
  late_entry: 'Wait for a pullback before entering established trends.',
  oversize: 'Spread risk across more positions.',
  revenge_trade: 'Step away after a loss. Set a cooldown timer.',
  good_discipline: 'Keep this up. Patience is your edge.',
  fomo: 'Set your position once and walk away.',
  general: 'Keep building your trade journal for deeper insights.',
  time_of_day_bias: 'Avoid trading during your weakest session.',
  holding_period_bias: 'Adjust your strategy for the timeframe that loses.',
  instrument_bias: 'Stop trading the instruments where you consistently lose.',
  position_size_bad: 'Scale down position sizes until discipline improves.',
  averaging_down_bad: 'Set a hard rule: no adding to losers within 2 hours.',
  pyramid_good: 'Keep pyramiding winners — this is working for you.',
}

function buildPatternSummary(entries: DiaryEntry[], masterId: string): string | null {
  if (entries.length < 10) return null

  const counts: Record<PatternType, number> = {
    early_exit: 0, late_entry: 0, oversize: 0,
    revenge_trade: 0, good_discipline: 0, fomo: 0, general: 0,
    time_of_day_bias: 0, holding_period_bias: 0, instrument_bias: 0,
    position_size_bad: 0, averaging_down_bad: 0, pyramid_good: 0,
  }
  for (const entry of entries) {
    counts[entry.patternType]++
  }

  const sorted = (Object.entries(counts) as [PatternType, number][])
    .filter(([type]) => type !== 'general')
    .sort((a, b) => b[1] - a[1])

  const top = sorted[0]
  if (!top || top[1] === 0) return null

  const masterName = MASTER_NAMES[masterId as Master] ?? masterId
  const label = PATTERN_LABELS[top[0]]
  const advice = PATTERN_ADVICE[top[0]]
  return `${masterName} has noticed: You tend to ${label} (seen ${top[1]} times). ${advice}`
}


function buildEnhancedSummary(entries: DiaryEntry[]): EnhancedPatternSummary {
  // Top pattern
  const counts: Partial<Record<PatternType, number>> = {}
  for (const e of entries) {
    counts[e.patternType] = (counts[e.patternType] ?? 0) + 1
  }
  let topPattern: EnhancedPatternSummary['topPattern'] = null
  let maxCount = 0
  for (const [type, count] of Object.entries(counts) as [PatternType, number][]) {
    if (type === 'general') continue
    if (count > maxCount) {
      maxCount = count
      topPattern = {
        type,
        count,
        label: PATTERN_LABELS[type],
        advice: PATTERN_ADVICE[type],
      }
    }
  }

  // Time-of-day analysis
  const timeOfDayAnalysis: SessionAnalysis[] = buildSessionAnalysis(entries)

  // Holding period analysis
  const holdingPeriodAnalysis: HoldingPeriodAnalysis[] = buildHoldingAnalysis(entries)

  // Instrument biases
  const instrumentBiases: InstrumentBiasInfo[] = buildInstrumentAnalysis(entries)

  // Position size bias
  const positionSizeBias = detectPositionSizeCorrelation(entries)

  // Averaging down stats
  const avgDown = detectAveragingDown(entries)
  const averagingDownStats = {
    total: avgDown.length,
    emotional: avgDown.filter(r => r.outcome === 'emotional').length,
    planned: avgDown.filter(r => r.outcome === 'planned').length,
    mixed: avgDown.filter(r => r.outcome === 'mixed').length,
  }

  // Pyramid stats
  const pyramids = detectPyramidSuccess(entries)
  const pyramidStats = {
    total: pyramids.length,
    profitable: pyramids.filter(r => r.outcome === 'profit').length,
    unprofitable: pyramids.filter(r => r.outcome === 'loss').length,
  }

  return {
    topPattern,
    timeOfDayAnalysis,
    holdingPeriodAnalysis,
    instrumentBiases,
    positionSizeBias,
    averagingDownStats,
    pyramidStats,
  }
}

function buildSessionAnalysis(entries: DiaryEntry[]): SessionAnalysis[] {
  const sessions: Record<string, { wins: number; total: number }> = {
    Asian: { wins: 0, total: 0 },
    European: { wins: 0, total: 0 },
    American: { wins: 0, total: 0 },
  }

  for (const e of entries) {
    if (e.tradeUtcHour === undefined || e.outcome === 'pending') continue
    for (const [name, [lo, hi]] of Object.entries(SESSION_RANGES) as [SessionName, [number, number]][]) {
      if (e.tradeUtcHour >= lo && e.tradeUtcHour < hi) {
        sessions[name].total++
        if (e.outcome === 'profit') sessions[name].wins++
        break
      }
    }
  }

  return Object.entries(sessions)
    .filter(([, s]) => s.total > 0)
    .map(([session, s]) => ({
      session,
      winRate: s.total > 0 ? s.wins / s.total : 0,
      totalTrades: s.total,
    }))
}

function buildHoldingAnalysis(entries: DiaryEntry[]): HoldingPeriodAnalysis[] {
  const buckets: Record<string, { wins: number; total: number }> = {
    'Scalps (<1h)': { wins: 0, total: 0 },
    'Swings (1-24h)': { wins: 0, total: 0 },
    'Positions (1-7d)': { wins: 0, total: 0 },
    'Investments (>7d)': { wins: 0, total: 0 },
  }

  const bucketMap: Record<HoldBucket, string> = {
    scalp: 'Scalps (<1h)',
    swing: 'Swings (1-24h)',
    position: 'Positions (1-7d)',
    invest: 'Investments (>7d)',
  }

  for (const e of entries) {
    if (e.holdDurationMs === undefined || e.outcome === 'pending') continue
    const bucket = classifyHoldDuration(e.holdDurationMs)
    const label = bucketMap[bucket]
    buckets[label].total++
    if (e.outcome === 'profit') buckets[label].wins++
  }

  return Object.entries(buckets)
    .filter(([, s]) => s.total > 0)
    .map(([period, s]) => ({
      period,
      winRate: s.total > 0 ? s.wins / s.total : 0,
      totalTrades: s.total,
    }))
}

function buildInstrumentAnalysis(entries: DiaryEntry[]): InstrumentBiasInfo[] {
  const symbols = new Map<string, { wins: number; total: number }>()

  for (const e of entries) {
    if (e.outcome === 'pending') continue
    const stats = symbols.get(e.tradeSymbol) ?? { wins: 0, total: 0 }
    stats.total++
    if (e.outcome === 'profit') stats.wins++
    symbols.set(e.tradeSymbol, stats)
  }

  return Array.from(symbols)
    .filter(([, s]) => s.total >= INSTRUMENT_BIAS_MIN_TRADES && (s.wins / s.total) < INSTRUMENT_BIAS_WIN_THRESHOLD)
    .map(([symbol, s]) => ({
      symbol,
      winRate: s.wins / s.total,
      totalTrades: s.total,
    }))
}

// ─── Outcome determination ───────────────────────────────────────────────────

function determineOutcome(trade: TradeEvent): 'profit' | 'loss' | 'pending' {
  if (trade.profitPercent === undefined) return 'pending'
  if (trade.exitPrice === undefined) return 'pending'
  return trade.profitPercent > 0 ? 'profit' : 'loss'
}

// ─── Position percentile helper ─────────────────────────────────────────────

function computePositionPercentile(portfolioPercent: number, entries: DiaryEntry[]): number {
  const sizes = entries
    .filter(e => e.positionSizePercentile !== undefined)
    .map(e => e.positionSizePercentile!)

  if (sizes.length === 0) return 50 // first trade defaults to median

  const sorted = [...sizes].sort((a, b) => a - b)
  let rank = 0
  for (const s of sorted) {
    if (s < portfolioPercent) rank++
    else break
  }
  return Math.round((rank / sorted.length) * 100)
}

// ─── Diary class ─────────────────────────────────────────────────────────────

const DEFAULT_STORE_DIR = join(homedir(), '.vibe-sensei')
const DEFAULT_STORE_PATH = join(DEFAULT_STORE_DIR, 'diary.json')

export class GuardianDiary {
  private entries: DiaryEntry[] = []
  private tradeReports: TradeReport[] = []
  private readonly storePath: string
  private enhancedCache: { hash: number; summary: EnhancedPatternSummary } | null = null
  private _cacheVersion = 0

  constructor(storePath?: string) {
    this.storePath = storePath ?? DEFAULT_STORE_PATH
    this.load()
  }

  /** Record an observation after a trade. */
  recordTrade(masterId: string, trade: TradeEvent): void {
    const recent = this.getRecentEntries(20)
    const { patternType, observation } = classifyTrade(trade, recent)

    const now = new Date()
    const entry: DiaryEntry = {
      id: randomUUID(),
      masterId,
      timestamp: now,
      tradeSymbol: trade.symbol,
      tradeSide: trade.side,
      observation,
      patternType,
      outcome: determineOutcome(trade),
      tradeUtcHour: now.getUTCHours(),
      holdDurationMs: trade.timeSinceLastClose,
      positionSizePercentile: computePositionPercentile(trade.portfolioPercent, this.entries),
      profitPercent: trade.profitPercent,
    }

    this.entries.push(entry)
    this._cacheVersion++
    this.save()

    // Emit DiaryPatternEvent to Knowledge Base (sync-safe, one-way emit)
    try {
      const { queueEvent } = require('../services/knowledge/event-store.js') as typeof import('../services/knowledge/event-store.js')
      queueEvent({
        id: '',
        type: 'diary_pattern',
        timestamp: now.toISOString(),
        entryId: entry.id,
        symbol: trade.symbol,
        side: trade.side,
        patternType,
        outcome: entry.outcome,
      })
    } catch {
      // KB event emission must never propagate
    }
  }

  /** Get pattern summary after 10+ entries. Returns null if insufficient data. */
  getPatternSummary(): string | null {
    if (this.entries.length === 0) return null
    const masterId = this.entries[this.entries.length - 1]!.masterId
    return buildPatternSummary(this.entries, masterId)
  }

  /** Get recent entries, newest first. */
  getRecentEntries(limit: number = 10): DiaryEntry[] {
    const start = Math.max(0, this.entries.length - limit)
    return this.entries.slice(start).reverse()
  }

  /** Get all entries (for external analysis). */
  getAllEntries(): DiaryEntry[] {
    return [...this.entries]
  }

  /** Enhanced behavioral summary. Requires 20+ entries. Cached until new entries arrive. */
  getEnhancedSummary(): EnhancedPatternSummary | null {
    if (this.entries.length < 20) return null

    const hash = this.entries.length * 1000 + this._cacheVersion
    if (this.enhancedCache && this.enhancedCache.hash === hash) {
      return this.enhancedCache.summary
    }

    const summary = buildEnhancedSummary(this.entries)
    this.enhancedCache = { hash, summary }
    return summary
  }

  /** Record a completed trade report. Keeps the last 50 reports. */
  recordTradeReport(report: TradeReport): void {
    this.tradeReports.push(report)
    if (this.tradeReports.length > 50) {
      this.tradeReports = this.tradeReports.slice(-50)
    }
    this._cacheVersion++
    this.save()

    // Emit TradeLogEvent to Knowledge Base (sync-safe, one-way emit)
    try {
      const { queueEvent } = require('../services/knowledge/event-store.js') as typeof import('../services/knowledge/event-store.js')
      queueEvent({
        id: '',
        type: 'trade_log',
        timestamp: new Date(report.timestamp).toISOString(),
        symbol: report.symbol,
        side: report.side,
        quantity: report.quantity,
        price: report.entryPrice,
        grossPnL: report.grossPnL,
        netPnL: report.netPnL,
        rMultiple: report.rMultiple,
        holdDurationMs: report.holdDurationMs,
        fees: report.totalFees,
      })
    } catch {
      // KB event emission must never propagate
    }
  }

  /** Compute rolling stats from the most recent 20 trade reports. */
  getCumulativeStats(): CumulativeStats | null {
    if (this.tradeReports.length === 0) return null

    const recent = this.tradeReports.slice(-20)
    const total = recent.length
    const wins = recent.filter((r) => r.netPnL > 0).length
    const winRate = (wins / total) * 100

    const rValues = recent.map((r) => r.rMultiple)
    const avgR = rValues.reduce((s, v) => s + v, 0) / total

    const avgWin = computeAvgWin(recent)
    const avgLoss = computeAvgLoss(recent)
    const winProb = winRate / 100
    const lossProb = 1 - winProb
    const expectancy = winProb * avgWin - lossProb * Math.abs(avgLoss)

    return { winRate, avgR, expectancy, totalTrades: total }
  }

  /** Persist diary to JSON file. */
  save(): void {
    const dir = dirname(this.storePath)
    try {
      mkdirSync(dir, { recursive: true, mode: 0o700 })
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err
    }

    const data: DiaryFile = {
      version: 1,
      entries: this.entries.map(serializeEntry),
      tradeReports: this.tradeReports,
    }

    const json = JSON.stringify(data, null, 2)
    writeFileSync(this.storePath, json, { encoding: 'utf-8', mode: 0o600 })
  }

  /** Load diary from JSON file. Handles missing file and corrupted data. */
  load(): void {
    let raw: string
    try {
      raw = readFileSync(this.storePath, 'utf-8')
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        this.entries = []
        return
      }
      throw err
    }

    try {
      const parsed = JSON.parse(raw) as DiaryFile
      if (!isValidDiaryFile(parsed)) {
        this.entries = []
        this.tradeReports = []
        return
      }
      this.entries = parsed.entries.map(deserializeEntry)
      this.tradeReports = Array.isArray(parsed.tradeReports)
        ? parsed.tradeReports
        : []
    } catch {
      // Corrupted JSON — reset to empty diary
      this.entries = []
      this.tradeReports = []
    }
  }
}

// ─── Serialization helpers ───────────────────────────────────────────────────

function serializeEntry(entry: DiaryEntry): SerializedEntry {
  return {
    id: entry.id,
    masterId: entry.masterId,
    timestamp: entry.timestamp.toISOString(),
    tradeSymbol: entry.tradeSymbol,
    tradeSide: entry.tradeSide,
    observation: entry.observation,
    patternType: entry.patternType,
    outcome: entry.outcome,
    tradeUtcHour: entry.tradeUtcHour,
    holdDurationMs: entry.holdDurationMs,
    positionSizePercentile: entry.positionSizePercentile,
    profitPercent: entry.profitPercent,
  }
}

function deserializeEntry(raw: SerializedEntry): DiaryEntry {
  return {
    id: raw.id,
    masterId: raw.masterId,
    timestamp: new Date(raw.timestamp),
    tradeSymbol: raw.tradeSymbol,
    tradeSide: raw.tradeSide,
    observation: raw.observation,
    patternType: raw.patternType,
    outcome: raw.outcome,
    tradeUtcHour: raw.tradeUtcHour,
    holdDurationMs: raw.holdDurationMs,
    positionSizePercentile: raw.positionSizePercentile,
    profitPercent: raw.profitPercent,
  }
}

const VALID_PATTERN_TYPES = new Set<string>([
  'early_exit', 'late_entry', 'oversize',
  'revenge_trade', 'good_discipline', 'fomo', 'general',
  'time_of_day_bias', 'holding_period_bias', 'instrument_bias',
  'position_size_bad', 'averaging_down_bad', 'pyramid_good',
])

function isValidDiaryFile(data: unknown): data is DiaryFile {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>
  if (obj.version !== 1) return false
  if (!Array.isArray(obj.entries)) return false
  return obj.entries.every(isValidSerializedEntry)
}

function isValidSerializedEntry(entry: unknown): entry is SerializedEntry {
  if (typeof entry !== 'object' || entry === null) return false
  const e = entry as Record<string, unknown>
  return (
    typeof e.id === 'string' &&
    typeof e.masterId === 'string' &&
    typeof e.timestamp === 'string' &&
    typeof e.tradeSymbol === 'string' &&
    (e.tradeSide === 'buy' || e.tradeSide === 'sell') &&
    typeof e.observation === 'string' &&
    typeof e.patternType === 'string' &&
    VALID_PATTERN_TYPES.has(e.patternType)
  )
}

// ─── Cumulative stats helpers ───────────────────────────────────────────────

function computeAvgWin(reports: TradeReport[]): number {
  const wins = reports.filter((r) => r.netPnL > 0)
  if (wins.length === 0) return 0
  return wins.reduce((s, r) => s + r.rMultiple, 0) / wins.length
}

function computeAvgLoss(reports: TradeReport[]): number {
  const losses = reports.filter((r) => r.netPnL <= 0)
  if (losses.length === 0) return 0
  return losses.reduce((s, r) => s + r.rMultiple, 0) / losses.length
}

// ─── Module-level singleton access ──────────────────────────────────────────

let diaryInstance: GuardianDiary | null = null

function getDiary(): GuardianDiary {
  if (!diaryInstance) {
    diaryInstance = new GuardianDiary()
  }
  return diaryInstance
}

/**
 * Records a trade report to the global diary singleton.
 * Creates the diary instance on first call.
 */
export function recordTradeReport(report: TradeReport): void {
  getDiary().recordTradeReport(report)
}

/**
 * Computes rolling cumulative stats from the global diary singleton.
 * Returns null if no trade reports exist.
 */
export function computeCumulativeStats(): CumulativeStats | null {
  return getDiary().getCumulativeStats()
}
