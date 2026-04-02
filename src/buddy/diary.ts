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

export interface DiaryEntry {
  id: string
  masterId: string
  timestamp: Date
  tradeSymbol: string
  tradeSide: OrderSide
  observation: string
  patternType: PatternType
  outcome?: 'profit' | 'loss' | 'pending'
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

// ─── Enhanced summary types ─────────────────────────────────────────────────

export interface EnhancedDiarySummary {
  topPattern: string | null
  topPatternCount: number
  worstInstrument: string | null
  worstInstrumentLosses: number
  bestSession: string | null
  totalEntries: number
}

function classifySession(hour: number): string {
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 21) return 'evening'
  return 'night'
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
}

const PATTERN_ADVICE: Record<PatternType, string> = {
  early_exit: 'Consider letting winners run with a trailing stop.',
  late_entry: 'Wait for a pullback before entering established trends.',
  oversize: 'Spread risk across more positions.',
  revenge_trade: 'Step away after a loss. Set a cooldown timer.',
  good_discipline: 'Keep this up. Patience is your edge.',
  fomo: 'Set your position once and walk away.',
  general: 'Keep building your trade journal for deeper insights.',
}

function buildPatternSummary(entries: DiaryEntry[], masterId: string): string | null {
  if (entries.length < 10) return null

  const counts: Record<PatternType, number> = {
    early_exit: 0, late_entry: 0, oversize: 0,
    revenge_trade: 0, good_discipline: 0, fomo: 0, general: 0,
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

    const entry: DiaryEntry = {
      id: randomUUID(),
      masterId,
      timestamp: new Date(),
      tradeSymbol: trade.symbol,
      tradeSide: trade.side,
      observation,
      patternType,
      outcome: determineOutcome(trade),
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

  /**
   * Get an enhanced summary of trading behavior.
   * Returns null if fewer than 20 entries (insufficient data).
   * Contains: top pattern, worst instrument, best session info.
   */
  getEnhancedSummary(): EnhancedDiarySummary | null {
    if (this.entries.length < 20) return null

    // Count patterns (excluding 'general')
    const patternCounts: Partial<Record<PatternType, number>> = {}
    for (const entry of this.entries) {
      if (entry.patternType === 'general') continue
      patternCounts[entry.patternType] = (patternCounts[entry.patternType] ?? 0) + 1
    }

    // Find top pattern
    let topPattern: PatternType = 'general'
    let topCount = 0
    for (const [pattern, count] of Object.entries(patternCounts)) {
      if (count > topCount) {
        topPattern = pattern as PatternType
        topCount = count
      }
    }

    // Find worst instrument (most loss outcomes)
    const instrumentLosses: Record<string, number> = {}
    for (const entry of this.entries) {
      if (entry.outcome === 'loss') {
        instrumentLosses[entry.tradeSymbol] = (instrumentLosses[entry.tradeSymbol] ?? 0) + 1
      }
    }
    let worstInstrument: string | null = null
    let worstLosses = 0
    for (const [symbol, losses] of Object.entries(instrumentLosses)) {
      if (losses > worstLosses) {
        worstInstrument = symbol
        worstLosses = losses
      }
    }

    // Find best session (hour with most profit outcomes)
    const sessionProfits: Record<string, number> = {}
    for (const entry of this.entries) {
      if (entry.outcome === 'profit') {
        const hour = entry.timestamp.getHours()
        const session = classifySession(hour)
        sessionProfits[session] = (sessionProfits[session] ?? 0) + 1
      }
    }
    let bestSession = 'unknown'
    let bestSessionCount = 0
    for (const [session, count] of Object.entries(sessionProfits)) {
      if (count > bestSessionCount) {
        bestSession = session
        bestSessionCount = count
      }
    }

    return {
      topPattern: topCount > 0 ? PATTERN_LABELS[topPattern] : null,
      topPatternCount: topCount,
      worstInstrument,
      worstInstrumentLosses: worstLosses,
      bestSession: bestSessionCount > 0 ? bestSession : null,
      totalEntries: this.entries.length,
    }
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
  }
}

const VALID_PATTERN_TYPES = new Set<string>([
  'early_exit', 'late_entry', 'oversize',
  'revenge_trade', 'good_discipline', 'fomo', 'general',
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
