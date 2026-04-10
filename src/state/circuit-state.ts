/**
 * Circuit Breaker State — in-memory tracking for daily loss limits,
 * trade frequency, and consecutive loss escalation.
 *
 * Resets automatically at UTC midnight (day boundary detection).
 * Singleton pattern: one global state per session.
 */

// ── Types ─────────────────────────────────────────────────────────────────

export interface ConsecutiveLoss {
  pnl: number
  timestamp: number
}

export interface CircuitBreakerState {
  /** Portfolio equity at the start of the current UTC day. */
  dailyStartEquity: number
  /** UTC timestamp of the day start (00:00:00.000). */
  dailyStartTime: number
  /** Timestamps of the last 20 order fills (most recent first). */
  tradeTimestamps: number[]
  /** Consecutive losing trades with PnL amounts (most recent first). */
  consecutiveLosses: ConsecutiveLoss[]
}

// ── Constants ─────────────────────────────────────────────────────────────

/** Maximum trade timestamps to retain. */
const MAX_TRADE_TIMESTAMPS = 20

/** Maximum consecutive loss entries to retain. */
const MAX_CONSECUTIVE_LOSSES = 10

// ── Utilities ─────────────────────────────────────────────────────────────

/**
 * Compute the UTC midnight timestamp for the current day.
 */
function getUtcMidnight(now: number = Date.now()): number {
  const d = new Date(now)
  d.setUTCHours(0, 0, 0, 0)
  return d.getTime()
}

/**
 * Check whether the state's day start has crossed into a new UTC day.
 */
function isNewDay(state: CircuitBreakerState, now: number): boolean {
  const currentMidnight = getUtcMidnight(now)
  return currentMidnight > state.dailyStartTime
}

// ── Factory ───────────────────────────────────────────────────────────────

/**
 * Create a fresh circuit breaker state with a given starting equity.
 */
export function createCircuitBreakerState(
  equity: number,
): CircuitBreakerState {
  return {
    dailyStartEquity: equity,
    dailyStartTime: getUtcMidnight(),
    tradeTimestamps: [],
    consecutiveLosses: [],
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────

let globalState: CircuitBreakerState | null = null

/**
 * Get the global circuit breaker state (singleton).
 * Creates with default 100k equity if not yet initialized.
 * Automatically resets on UTC day boundary crossing.
 */
export function getCircuitState(
  currentEquity?: number,
): CircuitBreakerState {
  const now = Date.now()

  if (globalState === null) {
    globalState = createCircuitBreakerState(currentEquity ?? 100_000)
    return globalState
  }

  // Day boundary reset: equity rolls over, counters clear
  if (isNewDay(globalState, now)) {
    globalState = createCircuitBreakerState(
      currentEquity ?? globalState.dailyStartEquity,
    )
  }

  return globalState
}

/**
 * Initialize or reset the circuit breaker state with a specific equity.
 */
export function initCircuitState(equity: number): void {
  globalState = createCircuitBreakerState(equity)
}

// ── Mutations ─────────────────────────────────────────────────────────────

/**
 * Record a trade execution timestamp.
 * Retains the most recent MAX_TRADE_TIMESTAMPS entries.
 */
export function recordTrade(timestamp: number): void {
  const state = getCircuitState()
  state.tradeTimestamps.unshift(timestamp)
  if (state.tradeTimestamps.length > MAX_TRADE_TIMESTAMPS) {
    state.tradeTimestamps.length = MAX_TRADE_TIMESTAMPS
  }

  // Emit CircuitBreakerEvent to Knowledge Base (sync-safe)
  try {
    const { queueEvent } = require('../services/knowledge/event-store.js') as typeof import('../services/knowledge/event-store.js')
    queueEvent({
      id: '',
      type: 'circuit_breaker',
      timestamp: new Date(timestamp).toISOString(),
      breakerType: 'trade_recorded',
      details: { tradeCount: state.tradeTimestamps.length },
    })
  } catch {
    // KB event emission must never propagate
  }
}

/**
 * Record a losing trade. Appends to the consecutive loss streak.
 * PnL should be negative.
 */
export function recordLoss(pnl: number, timestamp: number): void {
  const state = getCircuitState()
  state.consecutiveLosses.unshift({ pnl, timestamp })
  if (state.consecutiveLosses.length > MAX_CONSECUTIVE_LOSSES) {
    state.consecutiveLosses.length = MAX_CONSECUTIVE_LOSSES
  }

  // Emit CircuitBreakerEvent to Knowledge Base (sync-safe)
  try {
    const { queueEvent } = require('../services/knowledge/event-store.js') as typeof import('../services/knowledge/event-store.js')
    queueEvent({
      id: '',
      type: 'circuit_breaker',
      timestamp: new Date(timestamp).toISOString(),
      breakerType: 'loss_recorded',
      details: { pnl, consecutiveLosses: state.consecutiveLosses.length },
    })
  } catch {
    // KB event emission must never propagate
  }
}

/**
 * Record a winning trade. Clears the consecutive loss streak.
 */
export function recordWin(): void {
  const state = getCircuitState()
  state.consecutiveLosses = []

  // Emit CircuitBreakerEvent to Knowledge Base (sync-safe)
  try {
    const { queueEvent } = require('../services/knowledge/event-store.js') as typeof import('../services/knowledge/event-store.js')
    queueEvent({
      id: '',
      type: 'circuit_breaker',
      timestamp: new Date().toISOString(),
      breakerType: 'win_recorded',
    })
  } catch {
    // KB event emission must never propagate
  }
}
