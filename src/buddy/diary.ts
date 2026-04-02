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
  private readonly storePath: string

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
    this.save()
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

  /** Persist diary to JSON file. */
  save(): void {
    const dir = dirname(this.storePath)
    try {
      mkdirSync(dir, { recursive: true })
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err
    }

    const data: DiaryFile = {
      version: 1,
      entries: this.entries.map(serializeEntry),
    }

    const json = JSON.stringify(data, null, 2)
    writeFileSync(this.storePath, json, 'utf-8')
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
        return
      }
      this.entries = parsed.entries.map(deserializeEntry)
    } catch {
      // Corrupted JSON — reset to empty diary
      this.entries = []
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
