/**
 * Guardian Risk Engine — 68 masters as risk guardians.
 * Runs check functions against live trading state and enforces alert policy.
 */

import type { Companion } from './types.js'
import type { ExchangeInterface, Position, Balance, TradingVertical } from '../services/exchange/types.js'
import type { ThresholdConfig } from './thresholds.js'
import type { VerticalContext as RichVerticalContext } from './verticals.js'
import type { CheckResult } from '../tools/PreTradeGateTool/types.js'
import { createExchange } from '../services/exchange/index.js'
import { getMasterName, getMasterQuote } from './companion.js'
import { getMasterArchetype } from './persona.js'
import { getThresholds } from './thresholds.js'
import { ALL_CHECKS } from './checks/index.js'
import { getVerticalChecks } from './checks/vertical-dispatcher.js'

export type Severity = 'INFO' | 'WARNING' | 'CRITICAL' | 'EMERGENCY'

export interface RiskAlert {
  severity: Severity
  masterId: string
  masterName: string
  message: string
  checkName: string
  timestamp: Date
}

export type CheckFn = (
  positions: Position[],
  balances: Balance[],
  masterId: string,
  masterName: string,
  masterQuote: string,
  thresholds?: ThresholdConfig,
) => RiskAlert | null

const SEVERITY_RANK: Record<Severity, number> = {
  INFO: 0,
  WARNING: 1,
  CRITICAL: 2,
  EMERGENCY: 3,
}

const COOLDOWN_MS = 30_000

/** Map a CheckResult status to a guardian Severity. */
const STATUS_TO_SEVERITY: Record<CheckResult['status'], Severity | null> = {
  pass: null,
  warn: 'WARNING',
  fail: 'CRITICAL',
  emergency: 'EMERGENCY',
}

/**
 * Convert a CheckResult from the vertical dispatcher into a RiskAlert.
 *
 * The dispatcher's return type is now uniformly CheckResult[] across all
 * verticals (vertical-dispatcher.ts converts OptionsCheckResult at the
 * boundary). No more duck-typing — type-safe path here.
 *
 * Returns null when the check passed (nothing to alert on).
 */
function verticalResultToAlert(
  r: CheckResult,
  masterId: string,
  masterName: string,
): RiskAlert | null {
  const severity = STATUS_TO_SEVERITY[r.status]
  if (severity === null) return null
  return {
    severity,
    masterId,
    masterName,
    message: r.message,
    checkName: r.name,
    timestamp: new Date(),
  }
}

/** Result from guardian evaluation, includes trading state for context-aware alerts. */
export interface EvaluationResult {
  alerts: RiskAlert[]
  positions: Position[]
  balances: Balance[]
}

export class RiskGuardian {
  private readonly companion: Companion
  private readonly exchange: ExchangeInterface
  private readonly lastAlertTime: Map<string, number> = new Map()

  constructor(companion: Companion, exchange?: ExchangeInterface) {
    this.companion = companion
    this.exchange = exchange ?? createExchange()
  }

  /** Expose exchange for context-aware alerts. */
  getExchange(): ExchangeInterface {
    return this.exchange
  }

  /**
   * Run all checks against current trading state, return at most 1 alert with trading state.
   *
   * When `vertical` is provided and not 'spot', also dispatches vertical-specific
   * checks via the shared dispatcher used by PreTradeGateTool. The rich
   * VerticalContext is built from available positions+balances; fields that
   * require trade-tool enrichment (leverage, greeks, daysToExpiry) remain
   * undefined and the underlying checks gracefully no-op on missing data.
   */
  async evaluate(vertical?: TradingVertical): Promise<EvaluationResult> {
    const [positions, balances] = await Promise.all([
      this.exchange.getPositions(),
      this.exchange.getBalance(),
    ])

    const masterId = this.companion.species
    const masterName = getMasterName(masterId)
    const masterQuote = getMasterQuote(masterId)

    // Compute dynamic thresholds based on archetype + stats
    const archetype = getMasterArchetype(masterId)
    const thresholdMap = getThresholds(archetype, this.companion.stats, null)

    const candidates: RiskAlert[] = []
    for (const check of ALL_CHECKS) {
      if (!this.shouldAlert(check.name)) continue
      const checkThresholds = check.thresholdKey
        ? thresholdMap[check.thresholdKey]
        : undefined
      const alert = check.fn(
        positions,
        balances,
        masterId,
        masterName,
        masterQuote,
        checkThresholds,
      )
      if (alert) candidates.push(alert)
    }

    // Dispatch vertical-specific checks for non-spot trading verticals
    if (vertical && vertical !== 'spot') {
      const verticalAlerts = this.runVerticalAlerts(
        vertical,
        positions,
        balances,
        masterId,
        masterName,
        masterQuote,
      )
      for (const alert of verticalAlerts) {
        if (this.shouldAlert(alert.checkName)) candidates.push(alert)
      }
    }

    if (candidates.length === 0) return { alerts: [], positions, balances }

    // Pick highest severity, break ties by order (first registered wins)
    candidates.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity])
    const winner = candidates[0]!

    this.lastAlertTime.set(winner.checkName, Date.now())
    return { alerts: [winner], positions, balances }
  }

  /**
   * Build a sparse rich VerticalContext from positions+balances and dispatch
   * vertical-specific checks via the shared dispatcher. Convert any
   * non-passing results into RiskAlerts.
   *
   * Most fields in the rich context (leverage, greeks, daysToExpiry, etc.)
   * are unknowable from positions+balances alone — they require trade-tool
   * enrichment via setVerticalContext. The underlying checks no-op gracefully
   * when their data is missing, so the wiring is in place even before tools
   * propagate full context.
   */
  private runVerticalAlerts(
    vertical: TradingVertical,
    positions: Position[],
    _balances: Balance[],
    masterId: string,
    masterName: string,
    masterQuote: string,
  ): RiskAlert[] {
    const firstPos = positions[0]
    const ctx: RichVerticalContext = {
      vertical,
      symbol: firstPos?.symbol,
      quantity: firstPos?.quantity,
      tradeValueUSD: positions.reduce(
        (sum, p) => sum + p.currentPrice * p.quantity,
        0,
      ),
      // Forex check dispatcher reads positions from this field
      forexPositions: vertical === 'forex' ? positions : undefined,
    }

    const currentPrice = firstPos?.currentPrice ?? 0

    let results: CheckResult[]
    try {
      results = getVerticalChecks(
        ctx,
        currentPrice,
        masterId,
        masterName,
        masterQuote,
      )
    } catch {
      // Vertical dispatcher must never propagate
      return []
    }

    const alerts: RiskAlert[] = []
    for (const r of results) {
      const alert = verticalResultToAlert(r, masterId, masterName)
      if (alert) alerts.push(alert)
    }
    return alerts
  }

  /** Policy: max 1 alert per 30s per check type. */
  private shouldAlert(checkName: string): boolean {
    const last = this.lastAlertTime.get(checkName)
    if (last === undefined) return true
    return Date.now() - last >= COOLDOWN_MS
  }
}
