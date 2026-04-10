/**
 * Circuit Breaker checks — 3 hard safety limits that protect the account.
 *
 * 1. Daily Loss Limit: >5% equity loss → EMERGENCY (hard block)
 * 2. Trade Frequency: >20 trades in 60 min → CRITICAL
 * 3. Escalating Loss: 3+ consecutive losses, each larger → CRITICAL
 *
 * These run FIRST in the pre-trade gate — before all other checks.
 * EMERGENCY status cannot be bypassed by acceptWarnings.
 */

import type { CheckResult } from '../../tools/PreTradeGateTool/types.js'
import type { CircuitBreakerState } from '../../state/circuit-state.js'

// ── Constants ─────────────────────────────────────────────────────────────

/** Daily loss limit percentage (5%). */
const DAILY_LOSS_LIMIT = 0.05

/** Maximum trades allowed in a 60-minute rolling window. */
const MAX_TRADES_PER_HOUR = 20

/** Minimum consecutive escalating losses to trigger. */
const MIN_ESCALATING_LOSSES = 3

/** Rolling window for trade frequency check (60 minutes in ms). */
const FREQUENCY_WINDOW_MS = 60 * 60 * 1000

// ── Check 1: Daily Loss Limit ─────────────────────────────────────────────

/**
 * Check if daily loss exceeds the 5% threshold.
 * Returns EMERGENCY (fail) if breached — this is a hard block.
 */
export function checkCircuitDailyLoss(
  state: CircuitBreakerState,
  currentEquity: number,
): CheckResult {
  const { dailyStartEquity } = state

  if (dailyStartEquity <= 0) {
    return {
      name: 'Circuit: Daily Loss',
      status: 'pass',
      message: 'no starting equity recorded',
    }
  }

  const loss = dailyStartEquity - currentEquity
  if (loss <= 0) {
    const gain = ((currentEquity - dailyStartEquity) / dailyStartEquity * 100).toFixed(1)
    return {
      name: 'Circuit: Daily Loss',
      status: 'pass',
      message: `+${gain}% today (limit -5%)`,
    }
  }

  const lossPercent = (loss / dailyStartEquity) * 100
  const pct = lossPercent.toFixed(1)

  if (lossPercent <= DAILY_LOSS_LIMIT * 100) {
    return {
      name: 'Circuit: Daily Loss',
      status: 'pass',
      message: `-${pct}% today (limit -5%)`,
    }
  }

  // EMERGENCY: hard block — cannot be bypassed
  const resetTime = getNextUtcMidnight()
  return {
    name: 'Circuit: Daily Loss',
    status: 'fail',
    message: `EMERGENCY: Daily loss -${pct}% exceeds 5% limit. Trading suspended until ${resetTime}.`,
    recommendation: 'Circuit breaker tripped. No new trades allowed until 00:00 UTC.',
  }
}

// ── Check 2: Trade Frequency ──────────────────────────────────────────────

/**
 * Check if trade frequency exceeds 20 trades per hour.
 * Returns CRITICAL (fail) if breached.
 */
export function checkCircuitFrequency(
  state: CircuitBreakerState,
): CheckResult {
  const now = Date.now()
  const windowStart = now - FREQUENCY_WINDOW_MS

  const recentCount = state.tradeTimestamps.filter(
    ts => ts >= windowStart,
  ).length

  if (recentCount <= MAX_TRADES_PER_HOUR) {
    return {
      name: 'Circuit: Frequency',
      status: 'pass',
      message: `${recentCount} trades in 60min (limit ${MAX_TRADES_PER_HOUR})`,
    }
  }

  return {
    name: 'Circuit: Frequency',
    status: 'fail',
    message: `${recentCount} trades in 60min exceeds limit of ${MAX_TRADES_PER_HOUR}. Cooldown 30 minutes.`,
    recommendation: 'Too many trades — step away for 30 minutes before trading again.',
  }
}

// ── Check 3: Escalating Loss ──────────────────────────────────────────────

/**
 * Check for 3+ consecutive losses where each is larger than the previous.
 * Returns CRITICAL (fail) if the pattern is detected.
 */
export function checkCircuitEscalatingLoss(
  state: CircuitBreakerState,
): CheckResult {
  const { consecutiveLosses } = state

  if (consecutiveLosses.length < MIN_ESCALATING_LOSSES) {
    const count = consecutiveLosses.length
    const label = count === 0 ? 'no consecutive losses' : `${count} consecutive losses`
    return {
      name: 'Circuit: Escalating',
      status: 'pass',
      message: label,
    }
  }

  // Check if losses are escalating (each abs(pnl) > previous)
  // consecutiveLosses is ordered most-recent-first
  let escalating = true
  for (let i = 0; i < MIN_ESCALATING_LOSSES - 1; i++) {
    const current = Math.abs(consecutiveLosses[i]!.pnl)
    const previous = Math.abs(consecutiveLosses[i + 1]!.pnl)
    if (current <= previous) {
      escalating = false
      break
    }
  }

  if (!escalating) {
    return {
      name: 'Circuit: Escalating',
      status: 'pass',
      message: `${consecutiveLosses.length} consecutive losses but not escalating`,
    }
  }

  const count = consecutiveLosses.length
  const totalLoss = consecutiveLosses
    .slice(0, MIN_ESCALATING_LOSSES)
    .reduce((sum, l) => sum + Math.abs(l.pnl), 0)
    .toFixed(2)

  return {
    name: 'Circuit: Escalating',
    status: 'fail',
    message: `${count} consecutive losses, each larger than the last (total: $${totalLoss}). Stop trading.`,
    recommendation: 'Pattern of increasing losses detected — stop, review, and reset before continuing.',
  }
}

// ── Aggregate ─────────────────────────────────────────────────────────────

/**
 * Run all 3 circuit breaker checks. Returns results in priority order.
 * The daily loss check is the most critical (EMERGENCY level).
 */
export function runCircuitBreakerChecks(
  state: CircuitBreakerState,
  currentEquity: number,
): CheckResult[] {
  return [
    checkCircuitDailyLoss(state, currentEquity),
    checkCircuitFrequency(state),
    checkCircuitEscalatingLoss(state),
  ]
}

/**
 * Check if any circuit breaker result is an EMERGENCY (daily loss >5%).
 * EMERGENCY results have "EMERGENCY" in their message.
 */
export function hasEmergency(checks: CheckResult[]): boolean {
  return checks.some(
    c => c.status === 'fail' && c.message.startsWith('EMERGENCY'),
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Format the next UTC midnight as a human-readable string.
 */
function getNextUtcMidnight(): string {
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  tomorrow.setUTCHours(0, 0, 0, 0)

  const h = String(tomorrow.getUTCHours()).padStart(2, '0')
  const m = String(tomorrow.getUTCMinutes()).padStart(2, '0')
  const month = String(tomorrow.getUTCMonth() + 1).padStart(2, '0')
  const day = String(tomorrow.getUTCDate()).padStart(2, '0')
  return `${tomorrow.getUTCFullYear()}-${month}-${day} ${h}:${m} UTC`
}
