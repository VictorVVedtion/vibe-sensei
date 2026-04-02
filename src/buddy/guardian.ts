/**
 * Guardian Risk Engine — 52 masters as risk guardians.
 * Runs check functions against live trading state and enforces alert policy.
 */

import type { Companion } from './types.js'
import type { ExchangeInterface, Position, Balance } from '../services/exchange/types.js'
import type { ThresholdConfig } from './thresholds.js'
import { createExchange } from '../services/exchange/index.js'
import { getMasterName, getMasterQuote } from './companion.js'
import { getMasterArchetype } from './persona.js'
import { getThresholds } from './thresholds.js'
import { ALL_CHECKS } from './checks/index.js'

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

export class RiskGuardian {
  private readonly companion: Companion
  private readonly exchange: ExchangeInterface
  private readonly lastAlertTime: Map<string, number> = new Map()

  constructor(companion: Companion, exchange?: ExchangeInterface) {
    this.companion = companion
    this.exchange = exchange ?? createExchange()
  }

  /** Run all checks against current trading state, return at most 1 alert. */
  async evaluate(): Promise<RiskAlert[]> {
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

    if (candidates.length === 0) return []

    // Pick highest severity, break ties by order (first registered wins)
    candidates.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity])
    const winner = candidates[0]!

    this.lastAlertTime.set(winner.checkName, Date.now())
    return [winner]
  }

  /** Policy: max 1 alert per 30s per check type. */
  private shouldAlert(checkName: string): boolean {
    const last = this.lastAlertTime.get(checkName)
    if (last === undefined) return true
    return Date.now() - last >= COOLDOWN_MS
  }
}
