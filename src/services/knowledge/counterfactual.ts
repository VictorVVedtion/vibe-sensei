/**
 * Counterfactual Tracking Engine — measures advice accuracy over time.
 *
 * Tracks whether users follow or ignore Guardian alerts by correlating
 * alert emissions with subsequent order placements. When a user places
 * an order for a symbol that had a recent alert (within 5 minutes),
 * an AlertIgnoredEvent is emitted to the Knowledge Base.
 *
 * Also computes advice accuracy statistics from historical JSONL data:
 * heeded rate, accuracy when heeded vs ignored, per-archetype breakdowns.
 */

import type { KBEvent, KBEventUnion, AlertIgnoredEvent } from './types.js'

// ── Constants ────────────────────────────────────────────────────────────────

/** Maximum alerts held in the ring buffer. */
const MAX_RING_SIZE = 20

/** Correlation window: 5 minutes in milliseconds. */
const CORRELATION_WINDOW_MS = 5 * 60 * 1000

// ── Ring Buffer Types ────────────────────────────────────────────────────────

interface BufferedAlert {
  id: string
  symbol: string
  timestamp: number
  severity: 'INFO' | 'WARNING' | 'CRITICAL' | 'EMERGENCY'
  checkName: string
}

// ── Ring Buffer ──────────────────────────────────────────────────────────────

const recentAlerts: BufferedAlert[] = []

// ── Advice Accuracy Types ────────────────────────────────────────────────────

export interface ArchetypeAccuracy {
  archetype: string
  totalAlerts: number
  heededCount: number
  ignoredCount: number
  heededProfitRate: number
  ignoredProfitRate: number
}

export interface AdviceAccuracy {
  totalAlerts: number
  totalIgnored: number
  heededRate: number
  heededProfitRate: number
  ignoredProfitRate: number
  byArchetype: ArchetypeAccuracy[]
  trend: 'improving' | 'declining' | 'stable' | 'unknown'
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Record an alert into the ring buffer after it is emitted by the guardian.
 * Called from guardian-observer.ts. Never throws.
 */
export function recordAlert(alert: {
  id: string
  symbol: string | undefined
  timestamp: Date
  severity: 'INFO' | 'WARNING' | 'CRITICAL' | 'EMERGENCY'
  checkName: string
}): void {
  try {
    if (!alert.symbol) return

    const entry: BufferedAlert = {
      id: alert.id,
      symbol: normalizeSymbol(alert.symbol),
      timestamp: alert.timestamp.getTime(),
      severity: alert.severity,
      checkName: alert.checkName,
    }

    recentAlerts.push(entry)

    // Enforce ring buffer size limit
    while (recentAlerts.length > MAX_RING_SIZE) {
      recentAlerts.shift()
    }
  } catch {
    // Recording must never propagate errors
  }
}

/**
 * Check if a recently-placed order ignores a buffered alert for the same symbol.
 * If a matching alert is found within the 5-minute correlation window,
 * appends an AlertIgnoredEvent to the Knowledge Base.
 *
 * Called from OrderTool after a successful order placement.
 */
export async function checkIfIgnored(
  symbol: string,
  orderTimestamp: number,
  orderSide?: string,
): Promise<void> {
  try {
    const normalizedSymbol = normalizeSymbol(symbol)
    const match = findMatchingAlert(normalizedSymbol, orderTimestamp)
    if (!match) return

    const { appendEvent } = await import('./event-store.js')
    const event: KBEvent & Omit<AlertIgnoredEvent, 'id' | 'timestamp'> = {
      id: '',
      type: 'alert_ignored',
      timestamp: new Date(orderTimestamp).toISOString(),
      alertId: match.id,
      symbol: normalizedSymbol,
      alertSeverity: match.severity,
      alertCheckName: match.checkName,
      orderSide: orderSide ?? undefined,
      timeDeltaMs: orderTimestamp - match.timestamp,
    }

    await appendEvent(event as KBEvent)
  } catch {
    // Counterfactual tracking must never block trading
  }
}

/**
 * Compute advice accuracy statistics from JSONL event data.
 *
 * Correlates AlertEvents, AlertIgnoredEvents, and TradeLogEvents to determine:
 * - How often users heed vs ignore alerts
 * - Profit rates when heeded vs ignored
 * - Per-archetype accuracy breakdowns
 * - Trend comparison (last 20 vs previous 20)
 */
export async function getAdviceAccuracy(): Promise<AdviceAccuracy> {
  try {
    const { readEvents } = await import('./event-store.js')
    const events = await readEvents()
    return computeAdviceAccuracy(events)
  } catch {
    return buildEmptyAccuracy()
  }
}

// ── Internal Helpers ─────────────────────────────────────────────────────────

/** Normalize a trading symbol for consistent matching. */
function normalizeSymbol(symbol: string): string {
  return symbol.toUpperCase().trim()
}

/**
 * Find a buffered alert matching the given symbol within the correlation window.
 * Returns the most recent match, or null if none found.
 */
function findMatchingAlert(
  normalizedSymbol: string,
  orderTimestamp: number,
): BufferedAlert | null {
  let bestMatch: BufferedAlert | null = null

  for (const alert of recentAlerts) {
    const timeDelta = orderTimestamp - alert.timestamp
    if (timeDelta < 0 || timeDelta > CORRELATION_WINDOW_MS) continue
    if (alert.symbol !== normalizedSymbol) continue

    // Pick the most recent matching alert
    if (!bestMatch || alert.timestamp > bestMatch.timestamp) {
      bestMatch = alert
    }
  }

  return bestMatch
}

/**
 * Compute advice accuracy from a set of events.
 * Exported for direct use when events are already loaded.
 */
export function computeAdviceAccuracy(events: KBEventUnion[]): AdviceAccuracy {
  const alerts = filterAlertEvents(events)
  const ignored = filterIgnoredEvents(events)
  const trades = filterTradeLogEvents(events)

  if (alerts.length === 0) return buildEmptyAccuracy()

  const ignoredAlertIds = new Set(ignored.map((e) => e.alertId))
  const totalIgnored = ignored.length
  const totalHeeded = alerts.length - totalIgnored
  const heededRate = alerts.length > 0 ? totalHeeded / alerts.length : 0

  const heededProfitRate = computeHeededProfitRate(alerts, ignoredAlertIds, trades)
  const ignoredProfitRate = computeIgnoredProfitRate(ignored, trades)
  const byArchetype = computeArchetypeAccuracy(alerts, ignored, trades)
  const trend = computeTrend(alerts, ignored)

  return {
    totalAlerts: alerts.length,
    totalIgnored,
    heededRate,
    heededProfitRate,
    ignoredProfitRate,
    byArchetype,
    trend,
  }
}

// ── Event Filters ────────────────────────────────────────────────────────────

type AlertEventType = Extract<KBEventUnion, { type: 'alert' }>
type IgnoredEventType = Extract<KBEventUnion, { type: 'alert_ignored' }>
type TradeLogType = Extract<KBEventUnion, { type: 'trade_log' }>

/** Filter events to AlertEvents only. */
function filterAlertEvents(events: KBEventUnion[]): AlertEventType[] {
  return events.filter(
    (e): e is AlertEventType => e.type === 'alert',
  )
}

/** Filter events to AlertIgnoredEvents only. */
function filterIgnoredEvents(events: KBEventUnion[]): IgnoredEventType[] {
  return events.filter(
    (e): e is IgnoredEventType => e.type === 'alert_ignored',
  )
}

/** Filter events to TradeLogEvents only. */
function filterTradeLogEvents(events: KBEventUnion[]): TradeLogType[] {
  return events.filter(
    (e): e is TradeLogType => e.type === 'trade_log',
  )
}

// ── Profit Rate Calculations ─────────────────────────────────────────────────

/**
 * Compute profit rate for trades where alerts were heeded (not ignored).
 * Looks for subsequent trades on the same symbol to determine outcome.
 */
function computeHeededProfitRate(
  alerts: AlertEventType[],
  ignoredAlertIds: Set<string>,
  trades: TradeLogType[],
): number {
  let heeded = 0
  let profitable = 0

  for (const alert of alerts) {
    if (ignoredAlertIds.has(alert.id)) continue
    if (!alert.symbol) continue

    heeded++
    const nextTrade = findNextTrade(alert.symbol, alert.timestamp, trades)
    if (nextTrade && isTradeProfit(nextTrade)) profitable++
  }

  return heeded > 0 ? profitable / heeded : 0
}

/**
 * Compute profit rate for trades that ignored alerts.
 * For each ignored event, find the subsequent trade and check PnL.
 */
function computeIgnoredProfitRate(
  ignored: IgnoredEventType[],
  trades: TradeLogType[],
): number {
  let matched = 0
  let profitable = 0

  for (const ign of ignored) {
    const nextTrade = findNextTrade(ign.symbol, ign.timestamp, trades)
    if (!nextTrade) continue

    matched++
    if (isTradeProfit(nextTrade)) profitable++
  }

  return matched > 0 ? profitable / matched : 0
}

/** Check if a trade was profitable. */
function isTradeProfit(trade: TradeLogType): boolean {
  if (trade.netPnL !== undefined) return trade.netPnL > 0
  if (trade.grossPnL !== undefined) return trade.grossPnL > 0
  return false
}

/**
 * Find the next trade for a given symbol after a timestamp.
 * Returns null if no matching trade found.
 */
function findNextTrade(
  symbol: string,
  afterTimestamp: string,
  trades: TradeLogType[],
): TradeLogType | null {
  const afterMs = new Date(afterTimestamp).getTime()
  let best: TradeLogType | null = null
  let bestDelta = Infinity

  for (const trade of trades) {
    if (trade.symbol.toUpperCase() !== symbol.toUpperCase()) continue
    const tradeMs = new Date(trade.timestamp).getTime()
    const delta = tradeMs - afterMs
    if (delta > 0 && delta < bestDelta) {
      best = trade
      bestDelta = delta
    }
  }

  return best
}

// ── Per-Archetype Accuracy ───────────────────────────────────────────────────

/**
 * Compute per-archetype accuracy by grouping alerts by masterName.
 */
function computeArchetypeAccuracy(
  alerts: AlertEventType[],
  ignored: IgnoredEventType[],
  trades: TradeLogType[],
): ArchetypeAccuracy[] {
  const ignoredAlertIds = new Set(ignored.map((e) => e.alertId))
  const byMaster = new Map<string, MasterStats>()

  for (const alert of alerts) {
    const master = alert.masterName
    const stats = byMaster.get(master) ?? createEmptyMasterStats()

    stats.total++
    const wasIgnored = ignoredAlertIds.has(alert.id)

    if (wasIgnored) {
      updateIgnoredStats(stats, alert, trades)
    } else {
      updateHeededStats(stats, alert, trades)
    }

    byMaster.set(master, stats)
  }

  return formatArchetypeResults(byMaster)
}

interface MasterStats {
  total: number
  heeded: number
  ignoredCount: number
  heededProfitable: number
  heededWithTrade: number
  ignoredProfitable: number
  ignoredWithTrade: number
}

function createEmptyMasterStats(): MasterStats {
  return {
    total: 0, heeded: 0, ignoredCount: 0,
    heededProfitable: 0, heededWithTrade: 0,
    ignoredProfitable: 0, ignoredWithTrade: 0,
  }
}

function updateIgnoredStats(
  stats: MasterStats,
  alert: AlertEventType,
  trades: TradeLogType[],
): void {
  stats.ignoredCount++
  if (!alert.symbol) return
  const nextTrade = findNextTrade(alert.symbol, alert.timestamp, trades)
  if (!nextTrade) return
  stats.ignoredWithTrade++
  if (isTradeProfit(nextTrade)) stats.ignoredProfitable++
}

function updateHeededStats(
  stats: MasterStats,
  alert: AlertEventType,
  trades: TradeLogType[],
): void {
  stats.heeded++
  if (!alert.symbol) return
  const nextTrade = findNextTrade(alert.symbol, alert.timestamp, trades)
  if (!nextTrade) return
  stats.heededWithTrade++
  if (isTradeProfit(nextTrade)) stats.heededProfitable++
}

function formatArchetypeResults(
  byMaster: Map<string, MasterStats>,
): ArchetypeAccuracy[] {
  return Array.from(byMaster.entries()).map(([master, stats]) => ({
    archetype: master,
    totalAlerts: stats.total,
    heededCount: stats.heeded,
    ignoredCount: stats.ignoredCount,
    heededProfitRate: stats.heededWithTrade > 0
      ? stats.heededProfitable / stats.heededWithTrade
      : 0,
    ignoredProfitRate: stats.ignoredWithTrade > 0
      ? stats.ignoredProfitable / stats.ignoredWithTrade
      : 0,
  }))
}

// ── Trend Calculation ────────────────────────────────────────────────────────

/**
 * Compute trend by comparing last 20 alerts vs previous 20.
 * Returns 'improving' if heeded rate is increasing, 'declining' if decreasing.
 */
function computeTrend(
  alerts: AlertEventType[],
  ignored: IgnoredEventType[],
): 'improving' | 'declining' | 'stable' | 'unknown' {
  if (alerts.length < 10) return 'unknown'

  const sorted = [...alerts].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  )

  const recentIds = new Set(sorted.slice(-20).map((a) => a.id))
  const previousIds = new Set(sorted.slice(-40, -20).map((a) => a.id))

  if (previousIds.size === 0) return 'unknown'

  const ignoredIds = new Set(ignored.map((e) => e.alertId))

  const recentIgnored = countIntersection(recentIds, ignoredIds)
  const previousIgnored = countIntersection(previousIds, ignoredIds)

  const recentHeededRate = recentIds.size > 0
    ? 1 - recentIgnored / recentIds.size
    : 0
  const previousHeededRate = previousIds.size > 0
    ? 1 - previousIgnored / previousIds.size
    : 0

  const delta = recentHeededRate - previousHeededRate
  if (delta > 0.1) return 'improving'
  if (delta < -0.1) return 'declining'
  return 'stable'
}

/** Count how many elements from setA are also in setB. */
function countIntersection(setA: Set<string>, setB: Set<string>): number {
  let count = 0
  for (const item of setA) {
    if (setB.has(item)) count++
  }
  return count
}

/** Build an empty AdviceAccuracy result for error/empty cases. */
function buildEmptyAccuracy(): AdviceAccuracy {
  return {
    totalAlerts: 0,
    totalIgnored: 0,
    heededRate: 0,
    heededProfitRate: 0,
    ignoredProfitRate: 0,
    byArchetype: [],
    trend: 'unknown',
  }
}
