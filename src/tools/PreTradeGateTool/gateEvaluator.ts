/**
 * Gate Evaluator — orchestrates all pre-trade risk checks.
 *
 * Execution order:
 *   1. Circuit Breaker checks (FIRST — can hard-block all further checks)
 *   2. 9 standard pre-trade risk checks
 *   3. ATR Stop Advisor (LAST — advisory info appended)
 *
 * Fetches exchange state once, distributes to each check, aggregates results.
 */

import { getConnectedExchange } from '../../services/exchange/singleton.js'
import type { Position, Balance, Ticker, Candle, ExchangeInterface } from '../../services/exchange/types.js'
import type { GateInput, CheckResult, RiskGateResult, GateStatus } from './types.js'
import { totalPortfolioValue } from '../../buddy/checks/utils.js'

import { checkPortfolioHeat } from '../../buddy/checks/portfolio-heat.js'
import { checkSinglePositionRisk } from '../../buddy/checks/single-position-risk.js'
import { checkRegimeAlignment, detectRegime } from '../../buddy/checks/regime-alignment.js'
import { checkVolumeConfirmation } from '../../buddy/checks/volume-confirmation.js'
import { checkStopLossDefined } from '../../buddy/checks/stop-loss-defined.js'
import { checkRiskRewardRatio } from '../../buddy/checks/risk-reward-ratio.js'
import { checkRevengeTrade } from '../../buddy/checks/revenge-trade.js'
import { checkDailyLossLimit } from '../../buddy/checks/daily-loss-limit.js'
import { checkConcentrationGate } from '../../buddy/checks/concentration-gate.js'

import { runCircuitBreakerChecks, hasEmergency } from '../../buddy/checks/circuit-breaker.js'
import { getCircuitState } from '../../state/circuit-state.js'
import { checkATRStopAdvisor } from '../../buddy/checks/atr-stop-advisor.js'

/** Fetch all exchange data needed by the checks in parallel. */
async function fetchExchangeData(symbol: string, exchange: ExchangeInterface): Promise<{
  positions: Position[]
  balances: Balance[]
  ticker: Ticker
  candles: Candle[]
}> {
  const [positions, balances, ticker, candles] = await Promise.all([
    exchange.getPositions().catch((): Position[] => []),
    exchange.getBalance().catch((): Balance[] => []),
    exchange.getTicker(symbol).catch((): Ticker => ({
      symbol,
      last: 0,
      bid: 0,
      ask: 0,
      high: 0,
      low: 0,
      volume: 0,
      timestamp: Date.now(),
    })),
    exchange.getCandles(symbol, '4h', 20).catch((): Candle[] => []),
  ])

  return { positions, balances, ticker, candles }
}

/** Determine entry price from input or market data. */
function resolveEntryPrice(input: GateInput, ticker: Ticker): number {
  if (input.price !== undefined && input.price > 0) return input.price
  if (ticker.last > 0) return ticker.last
  if (ticker.ask > 0) return ticker.ask
  return 0
}

/** Aggregate individual check statuses into overall gate status. */
function aggregateStatus(checks: CheckResult[]): GateStatus {
  if (checks.some(c => c.status === 'fail')) return 'fail'
  if (checks.some(c => c.status === 'warn')) return 'warn'
  return 'pass'
}

/** Build human-readable summary line. */
function buildSummary(status: GateStatus, checks: CheckResult[]): string {
  const failCount = checks.filter(c => c.status === 'fail').length
  const warnCount = checks.filter(c => c.status === 'warn').length

  switch (status) {
    case 'pass':
      return 'All checks passed'
    case 'warn':
      return `${warnCount} warning${warnCount > 1 ? 's' : ''} — review before proceeding`
    case 'fail':
      return `${failCount} issue${failCount > 1 ? 's' : ''} must be resolved`
  }
}

/** Collect actionable recommendations from failed/warned checks. */
function buildRecommendation(checks: CheckResult[]): string | undefined {
  const recs = checks
    .filter(c => c.status !== 'pass' && c.recommendation)
    .map(c => c.recommendation!)

  if (recs.length === 0) return undefined
  return recs.join('; ')
}

/** Run all pre-trade gate checks and return aggregated result. */
export async function evaluateGate(input: GateInput): Promise<RiskGateResult> {
  const exchange = await getConnectedExchange()
  const { positions, balances, ticker, candles } = await fetchExchangeData(input.symbol, exchange)
  const entryPrice = resolveEntryPrice(input, ticker)
  const equity = totalPortfolioValue(balances)

  // ── Phase 1: Circuit Breaker (runs FIRST) ──────────────────────────────
  const circuitState = getCircuitState(equity)
  const circuitChecks = runCircuitBreakerChecks(circuitState, equity)

  // EMERGENCY = hard block — skip all remaining checks
  if (hasEmergency(circuitChecks)) {
    return {
      status: 'fail',
      checks: circuitChecks,
      summary: 'CIRCUIT BREAKER TRIPPED — trading suspended',
      recommendation: circuitChecks
        .filter(c => c.status === 'fail')
        .map(c => c.recommendation ?? c.message)
        .join('; '),
    }
  }

  // ── Phase 2: Standard 9 risk checks ────────────────────────────────────
  const regime = detectRegime(candles)

  const standardChecks: CheckResult[] = [
    checkPortfolioHeat(input, positions, balances),
    checkSinglePositionRisk(input, balances, entryPrice),
    checkConcentrationGate(input, positions, balances, entryPrice),
    checkRegimeAlignment(input, regime),
    checkVolumeConfirmation(ticker, candles),
    checkStopLossDefined(input, balances, entryPrice),
    checkRiskRewardRatio(input, entryPrice),
    checkRevengeTrade(),
    checkDailyLossLimit(positions, balances),
  ]

  // ── Phase 3: ATR Stop Advisor (runs LAST, advisory) ────────────────────
  const atrCheck = await checkATRStopAdvisor(input, entryPrice, exchange)

  // Combine all checks in execution order
  const allChecks = [...circuitChecks, ...standardChecks, atrCheck]

  const status = aggregateStatus(allChecks)
  const summary = buildSummary(status, allChecks)
  const recommendation = buildRecommendation(allChecks)

  // Emit GateCheckEvent to Knowledge Base (fire-and-forget)
  try {
    const { appendEvent } = await import('../../services/knowledge/event-store.js')
    const failCount = allChecks.filter(c => c.status === 'fail').length
    const warnCount = allChecks.filter(c => c.status === 'warn').length
    await appendEvent({
      id: '',
      type: 'gate_check',
      timestamp: new Date().toISOString(),
      symbol: input.symbol,
      side: input.side,
      status,
      failCount,
      warnCount,
    } as import('../../services/knowledge/types.js').KBEvent)
  } catch {
    // KB event emission must never propagate
  }

  return { status, checks: allChecks, summary, recommendation }
}

/** Format gate result as a readable text block for LLM consumption. */
export function formatGateResult(
  input: GateInput,
  result: RiskGateResult,
): string {
  const statusIcon: Record<GateStatus, string> = {
    pass: 'OK',
    warn: '!',
    fail: 'XX',
  }

  const lines: string[] = []
  lines.push('═══ Pre-Trade Gate ═══════════════════════════')
  lines.push(`Symbol: ${input.symbol} | Side: ${input.side.toUpperCase()} | Qty: ${input.quantity}`)
  lines.push('')

  // Separate circuit breaker, standard checks, and ATR advisor
  const circuitChecks = result.checks.filter(c => c.name.startsWith('Circuit:'))
  const atrChecks = result.checks.filter(c => c.name === 'ATR Stop')
  const standardChecks = result.checks.filter(
    c => !c.name.startsWith('Circuit:') && c.name !== 'ATR Stop',
  )

  // Circuit breaker section (only show if any are non-pass)
  if (circuitChecks.some(c => c.status !== 'pass')) {
    lines.push('─── Circuit Breaker ────────────────────────')
    for (const check of circuitChecks) {
      const tag = `[${statusIcon[check.status]}]`
      lines.push(`${tag} ${check.name}: ${check.message}`)
    }
    lines.push('')
  }

  // Standard checks
  for (const check of standardChecks) {
    const tag = `[${statusIcon[check.status]}]`
    lines.push(`${tag} ${check.name}: ${check.message}`)
  }

  // ATR advisor section (always show if has recommendation)
  for (const check of atrChecks) {
    if (check.recommendation || check.message.includes('ATR')) {
      lines.push('')
      lines.push('─── ATR Stop Advisor ───────────────────────')
      lines.push(`[INFO] ${check.name}: ${check.message}`)
      if (check.recommendation) {
        lines.push(`  → ${check.recommendation}`)
      }
    }
  }

  lines.push('')
  lines.push(`Status: ${result.status.toUpperCase()} — ${result.summary}`)
  if (result.recommendation) {
    lines.push(`→ ${result.recommendation}`)
  }
  lines.push('═══════════════════════════════════════════════')

  return lines.join('\n')
}
