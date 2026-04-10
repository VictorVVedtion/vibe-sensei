/**
 * Correlation Check — warns when portfolio holds correlated currency pairs.
 * Uses a static correlation matrix for major FX pairs to detect hidden
 * concentration risk from correlated positions.
 */

import type { Position } from '../../../services/exchange/types.js'
import type { CheckResult, GateStatus } from '../../../tools/PreTradeGateTool/types.js'

/**
 * Static correlation matrix for major FX pairs.
 * Values represent typical rolling 90-day correlations.
 * Positive = move together, Negative = move opposite.
 */
export const CORRELATION_MATRIX: Record<string, Record<string, number>> = {
  'EUR/USD': {
    'GBP/USD': 0.85,
    'USD/CHF': -0.95,
    'AUD/USD': 0.70,
    'NZD/USD': 0.65,
    'USD/CAD': -0.55,
    'EUR/GBP': 0.30,
    'EUR/JPY': 0.60,
    'GBP/JPY': 0.45,
    'USD/JPY': -0.30,
    'XAU/USD': 0.40,
  },
  'GBP/USD': {
    'EUR/USD': 0.85,
    'USD/CHF': -0.80,
    'AUD/USD': 0.60,
    'NZD/USD': 0.55,
    'USD/CAD': -0.50,
    'EUR/GBP': -0.50,
    'EUR/JPY': 0.50,
    'GBP/JPY': 0.70,
    'USD/JPY': -0.20,
    'XAU/USD': 0.35,
  },
  'USD/JPY': {
    'EUR/USD': -0.30,
    'GBP/USD': -0.20,
    'USD/CHF': 0.50,
    'AUD/USD': -0.10,
    'EUR/JPY': 0.65,
    'GBP/JPY': 0.75,
    'XAU/USD': -0.40,
  },
  'USD/CHF': {
    'EUR/USD': -0.95,
    'GBP/USD': -0.80,
    'AUD/USD': -0.65,
    'USD/JPY': 0.50,
    'XAU/USD': -0.45,
  },
  'AUD/USD': {
    'EUR/USD': 0.70,
    'GBP/USD': 0.60,
    'NZD/USD': 0.90,
    'USD/CHF': -0.65,
    'USD/CAD': -0.60,
    'XAU/USD': 0.55,
  },
  'NZD/USD': {
    'EUR/USD': 0.65,
    'GBP/USD': 0.55,
    'AUD/USD': 0.90,
    'USD/CAD': -0.55,
    'XAU/USD': 0.45,
  },
  'XAU/USD': {
    'EUR/USD': 0.40,
    'GBP/USD': 0.35,
    'USD/JPY': -0.40,
    'USD/CHF': -0.45,
    'AUD/USD': 0.55,
    'NZD/USD': 0.45,
    'XAG/USD': 0.90,
  },
  'XAG/USD': {
    'XAU/USD': 0.90,
    'EUR/USD': 0.35,
    'AUD/USD': 0.50,
  },
}

/** Correlation threshold above which we warn. */
const WARN_THRESHOLD = 0.5

/**
 * Look up the correlation between two instruments.
 * Checks both directions (A->B and B->A) since the matrix is sparse.
 * Returns 0 if no data is available.
 */
export function getCorrelation(a: string, b: string): number {
  if (a === b) return 1.0

  const forward = CORRELATION_MATRIX[a]?.[b]
  if (forward !== undefined) return forward

  const reverse = CORRELATION_MATRIX[b]?.[a]
  if (reverse !== undefined) return reverse

  return 0
}

/**
 * Find all highly correlated pairs in the current portfolio
 * relative to a new instrument being traded.
 */
export function findCorrelatedPairs(
  newSymbol: string,
  positions: Position[],
): Array<{ symbol: string; correlation: number }> {
  const correlated: Array<{ symbol: string; correlation: number }> = []

  for (const pos of positions) {
    if (pos.symbol === newSymbol) continue
    const corr = getCorrelation(newSymbol, pos.symbol)
    if (Math.abs(corr) > WARN_THRESHOLD) {
      correlated.push({ symbol: pos.symbol, correlation: corr })
    }
  }

  return correlated.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation))
}

/**
 * Pre-trade gate check: warn on correlated FX positions.
 */
export function checkCorrelation(
  symbol: string,
  positions: Position[],
): CheckResult {
  const correlated = findCorrelatedPairs(symbol, positions)

  if (correlated.length === 0) {
    return {
      name: 'FX Correlation',
      status: 'pass' as GateStatus,
      message: 'No highly correlated positions detected',
    }
  }

  const pairs = correlated
    .map(c => `${c.symbol} (${c.correlation > 0 ? '+' : ''}${c.correlation.toFixed(2)})`)
    .join(', ')

  const maxCorr = Math.abs(correlated[0]!.correlation)
  const status: GateStatus = maxCorr > 0.8 ? 'fail' : 'warn'

  return {
    name: 'FX Correlation',
    status,
    message: `Correlated with existing positions: ${pairs}`,
    recommendation: maxCorr > 0.8
      ? 'Reduce position size — near-duplicate exposure'
      : 'Monitor combined exposure to correlated pairs',
  }
}
