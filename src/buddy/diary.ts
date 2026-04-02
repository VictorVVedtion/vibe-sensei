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
  private tradeReports: TradeReport[] = []
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

  /** Get recent entries, newest first. */
  getRecentEntries(limit: number = 10): DiaryEntry[] {
    const start = Math.max(0, this.entries.length - limit)
    return this.entries.slice(start).reverse()
  }

  /** Record a completed trade report. Keeps the last 50 reports. */
  recordTradeReport(report: TradeReport): void {
    this.tradeReports.push(report)
    if (this.tradeReports.length > 50) {
      this.tradeReports = this.tradeReports.slice(-50)
    }
    this.save()
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
      mkdirSync(dir, { recursive: true })
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err
    }

    const data: DiaryFile = {
      version: 1,
      entries: this.entries.map(serializeEntry),
      tradeReports: this.tradeReports,
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
