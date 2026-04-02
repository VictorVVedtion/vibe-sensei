/**
 * Gate Evaluator — orchestrates all 9 pre-trade risk checks.
 * Fetches exchange state once, distributes to each check, aggregates results.
 */

import { getConnectedExchange } from '../../services/exchange/singleton.js'
import type { Position, Balance, Ticker, Candle } from '../../services/exchange/types.js'
import type { GateInput, CheckResult, RiskGateResult, GateStatus } from './types.js'

import { checkPortfolioHeat } from '../../buddy/checks/portfolio-heat.js'
import { checkSinglePositionRisk } from '../../buddy/checks/single-position-risk.js'
import { checkRegimeAlignment, detectRegime } from '../../buddy/checks/regime-alignment.js'
import { checkVolumeConfirmation } from '../../buddy/checks/volume-confirmation.js'
import { checkStopLossDefined } from '../../buddy/checks/stop-loss-defined.js'
import { checkRiskRewardRatio } from '../../buddy/checks/risk-reward-ratio.js'
import { checkRevengeTrade } from '../../buddy/checks/revenge-trade.js'
import { checkDailyLossLimit } from '../../buddy/checks/daily-loss-limit.js'
import { checkConcentrationGate } from '../../buddy/checks/concentration-gate.js'

/** Fetch all exchange data needed by the 9 checks in parallel. */
async function fetchExchangeData(symbol: string): Promise<{
  positions: Position[]
  balances: Balance[]
  ticker: Ticker
  candles: Candle[]
}> {
  const exchange = await getConnectedExchange()

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

/** Run all 9 pre-trade gate checks and return aggregated result. */
export async function evaluateGate(input: GateInput): Promise<RiskGateResult> {
  const { positions, balances, ticker, candles } = await fetchExchangeData(input.symbol)
  const entryPrice = resolveEntryPrice(input, ticker)

  const regime = detectRegime(candles)

  const checks: CheckResult[] = [
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

  const status = aggregateStatus(checks)
  const summary = buildSummary(status, checks)
  const recommendation = buildRecommendation(checks)

  return { status, checks, summary, recommendation }
}

/** Format gate result as a readable text block for LLM consumption. */
export function formatGateResult(
  input: GateInput,
  result: RiskGateResult,
): string {
  const statusIcon: Record<GateStatus, string> = {
    pass: 'PASS',
    warn: 'WARN',
    fail: 'FAIL',
  }

  const lines: string[] = []
  lines.push('═══ Pre-Trade Gate ═══════════════════════════')
  lines.push(`Symbol: ${input.symbol} | Side: ${input.side.toUpperCase()} | Qty: ${input.quantity}`)
  lines.push('')

  for (const check of result.checks) {
    const tag = `[${statusIcon[check.status]}]`
    lines.push(`${tag} ${check.name}: ${check.message}`)
  }

  lines.push('')
  lines.push(`Status: ${result.status.toUpperCase()} — ${result.summary}`)
  if (result.recommendation) {
    lines.push(`→ ${result.recommendation}`)
  }
  lines.push('═══════════════════════════════════════════════')

  return lines.join('\n')
}
