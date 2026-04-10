/**
 * Vertical Dispatcher — routes risk checks to vertical-specific implementations.
 *
 * Supports: perp_futures, crypto_options, stocks, defi_dex, prediction, forex
 * Returns empty array for unknown verticals or when no vertical context is provided.
 */

import type { VerticalContext } from '../verticals.js'
import type { CheckResult, GateStatus } from '../../tools/PreTradeGateTool/types.js'
import type { RiskAlert } from '../guardian.js'
import type { OptionsCheckResult } from './options/types.js'

import { checkLeverageLimit } from './futures/leverage-limit.js'
import { checkLiquidationProximity } from './futures/liquidation-proximity.js'
import { checkFundingRateImpact } from './futures/funding-rate-impact.js'
import { checkMarginUtilization } from './futures/margin-utilization.js'
import { runOptionsChecks } from './options/vertical-dispatcher.js'
import { runStockChecks } from './stocks/index.js'
import { runDefiChecks } from './defi/index.js'
import { runForexChecks } from './forex/index.js'

/** Run all 4 perpetual futures risk checks. */
function runFuturesChecks(
  ctx: VerticalContext,
  currentPrice?: number,
): CheckResult[] {
  return [
    checkLeverageLimit(ctx),
    checkLiquidationProximity(ctx, currentPrice ?? 0),
    checkFundingRateImpact(ctx),
    checkMarginUtilization(ctx),
  ]
}

/** Map a RiskAlert severity to a GateStatus for CheckResult compatibility. */
const SEVERITY_TO_GATE: Record<string, GateStatus> = {
  INFO: 'pass',
  WARNING: 'warn',
  CRITICAL: 'fail',
  EMERGENCY: 'emergency',
}

/** Convert a RiskAlert into a CheckResult so verticals returning alerts integrate with the gate system. */
function alertToCheckResult(alert: RiskAlert): CheckResult {
  return {
    name: alert.checkName,
    status: SEVERITY_TO_GATE[alert.severity] ?? 'warn',
    message: alert.message,
  }
}

/**
 * Convert an OptionsCheckResult into a CheckResult so the dispatcher's
 * return type stays uniform across all verticals. Without this converter,
 * the options branch would leak its internal `{passed, severity}` shape
 * upward and force every consumer (guardian-observer, gate evaluator) to
 * duck-type the result. The conversion is the dispatcher's responsibility.
 *
 * Mapping rules:
 *   passed=true             → status='pass'
 *   passed=false, INFO      → status='warn'  (informational, but blocking the
 *                                              "pass" verdict)
 *   passed=false, WARNING   → status='warn'
 *   passed=false, CRITICAL  → status='fail'
 *
 * Options checks have no concept of 'emergency' (only the circuit breaker
 * generates that).
 */
function optionsToCheckResult(o: OptionsCheckResult): CheckResult {
  if (o.passed) {
    return { name: o.name, status: 'pass', message: o.message }
  }
  const status: GateStatus =
    o.severity === 'CRITICAL' ? 'fail' : 'warn'
  return { name: o.name, status, message: o.message }
}

/**
 * Dispatch vertical-specific risk checks based on the trading vertical.
 * Returns an empty array when no vertical context is provided or
 * the vertical has no specialized checks yet.
 */
export function getVerticalChecks(
  ctx: VerticalContext | undefined,
  currentPrice?: number,
  masterId?: string,
  masterName?: string,
  masterQuote?: string,
): CheckResult[] {
  if (!ctx) return []

  switch (ctx.vertical) {
    case 'perp_futures':
      return runFuturesChecks(ctx, currentPrice)
    case 'crypto_options':
      // Convert OptionsCheckResult[] → CheckResult[] at the dispatcher
      // boundary so downstream consumers see a uniform shape.
      return runOptionsChecks(ctx).map(optionsToCheckResult)
    case 'stocks':
      return runStockChecks(ctx)
    case 'defi_dex': {
      const tradeValueUSD = ctx.tradeValueUSD ?? 0
      const alert = runDefiChecks(
        ctx,
        tradeValueUSD,
        masterId ?? 'unknown',
        masterName ?? 'Guardian',
        masterQuote ?? '',
      )
      return alert ? [alertToCheckResult(alert)] : []
    }
    case 'prediction': {
      try {
        const mod = require('./prediction/vertical-dispatcher.js') as any
        if (typeof mod.runPredictionChecks !== 'function') return []
        const alert = mod.runPredictionChecks({
          positions: ctx.predictionPositions ?? [],
          markets: ctx.predictionMarkets ?? [],
          masterId: masterId ?? 'unknown',
          masterName: masterName ?? 'Guardian',
          masterQuote: masterQuote ?? '',
        })
        return alert ? [alertToCheckResult(alert)] : []
      } catch (err) {
        console.warn('[vertical-dispatcher] prediction checks failed:', err)
        return []
      }
    }
    case 'forex': {
      return runForexChecks({
        symbol: ctx.symbol ?? '',
        quantity: ctx.quantity ?? 0,
        positions: ctx.forexPositions ?? [],
        verticalContext: ctx,
      })
    }
    default:
      return []
  }
}

/** Alias for backward compatibility with tests that use the old name. */
export const dispatchVerticalChecks = getVerticalChecks
