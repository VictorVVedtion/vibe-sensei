/**
 * AutoResearchTool — Karpathy-style research loop for market analysis.
 * Fetches candle data, computes technical factors (momentum, volatility,
 * SMA, volume trend), generates hypotheses, scores them, and produces
 * a structured research report.
 *
 * All TA functions are pure math on candle arrays — no external libraries.
 */

import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { getConnectedExchange } from '../../services/exchange/singleton.js'
import { InvalidSymbolError } from '../../services/exchange/index.js'
import type { Candle } from '../../services/exchange/types.js'

// ---------------------------------------------------------------------------
// Input Schema
// ---------------------------------------------------------------------------

const inputSchema = z.strictObject({
  symbol: z.string().describe('Trading pair to research, e.g. BTC/USDT'),
  timeframe: z
    .string()
    .optional()
    .describe('Analysis timeframe, e.g. 1h, 4h, 1d')
    .default('4h'),
  iterations: z
    .number()
    .optional()
    .describe('Number of research iterations')
    .default(3),
  factors: z
    .array(z.string())
    .optional()
    .describe(
      'Specific factors to analyze, e.g. ["momentum", "volatility", "volume", "sma"]',
    ),
})

type InputSchema = typeof inputSchema
type Output = string

// ---------------------------------------------------------------------------
// Pure TA Functions
// ---------------------------------------------------------------------------

/**
 * Price momentum — percentage change over the last `period` candles.
 * Returns NaN when insufficient data.
 */
export function calcMomentum(closes: number[], period: number): number {
  if (closes.length < period + 1) return NaN
  const recent = closes[closes.length - 1]
  const past = closes[closes.length - 1 - period]
  if (past === 0) return NaN
  return ((recent - past) / past) * 100
}

/**
 * Volatility — standard deviation of period-over-period returns.
 * Returns NaN when insufficient data.
 */
export function calcVolatility(closes: number[], period: number): number {
  if (closes.length < period + 1) return NaN
  const returns: number[] = []
  const start = closes.length - period
  for (let i = start; i < closes.length; i++) {
    const prev = closes[i - 1]
    if (prev === 0) continue
    returns.push((closes[i] - prev) / prev)
  }
  if (returns.length === 0) return NaN
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length
  const variance =
    returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length
  return Math.sqrt(variance) * 100 // percentage
}

/**
 * Simple Moving Average over the last `period` values.
 * Returns NaN when insufficient data.
 */
export function calcSMA(closes: number[], period: number): number {
  if (closes.length < period) return NaN
  let sum = 0
  for (let i = closes.length - period; i < closes.length; i++) {
    sum += closes[i]
  }
  return sum / period
}

/**
 * Volume trend — compare average volume of the recent half of the period
 * to the earlier half. Returns 'increasing', 'decreasing', or 'flat'.
 */
export function calcVolumeTrend(
  volumes: number[],
  period: number,
): 'increasing' | 'decreasing' | 'flat' {
  if (volumes.length < period) return 'flat'
  const slice = volumes.slice(-period)
  const half = Math.floor(period / 2)
  const early = slice.slice(0, half)
  const late = slice.slice(half)

  const avgEarly = early.reduce((s, v) => s + v, 0) / early.length
  const avgLate = late.reduce((s, v) => s + v, 0) / late.length

  if (avgEarly === 0) return avgLate > 0 ? 'increasing' : 'flat'
  const change = ((avgLate - avgEarly) / avgEarly) * 100
  if (change > 10) return 'increasing'
  if (change < -10) return 'decreasing'
  return 'flat'
}

/**
 * SMA crossover detection — compare fast SMA to slow SMA at the
 * current bar and the previous bar to detect crossovers.
 */
export function detectSMACrossover(
  closes: number[],
  fast: number,
  slow: number,
): 'bullish' | 'bearish' | 'none' {
  if (closes.length < slow + 1) return 'none'

  // Current bar SMAs
  const fastNow = calcSMA(closes, fast)
  const slowNow = calcSMA(closes, slow)

  // Previous bar SMAs (exclude last element)
  const prevCloses = closes.slice(0, -1)
  const fastPrev = calcSMA(prevCloses, fast)
  const slowPrev = calcSMA(prevCloses, slow)

  if (
    isNaN(fastNow) ||
    isNaN(slowNow) ||
    isNaN(fastPrev) ||
    isNaN(slowPrev)
  ) {
    return 'none'
  }

  // Fast crossed above slow -> bullish
  if (fastPrev <= slowPrev && fastNow > slowNow) return 'bullish'
  // Fast crossed below slow -> bearish
  if (fastPrev >= slowPrev && fastNow < slowNow) return 'bearish'
  return 'none'
}

// ---------------------------------------------------------------------------
// Hypothesis Engine
// ---------------------------------------------------------------------------

type Signal = 'BUY' | 'SELL' | 'HOLD'

interface FactorReport {
  momentum: number
  volatility: number
  volumeTrend: 'increasing' | 'decreasing' | 'flat'
  smaCrossover: 'bullish' | 'bearish' | 'none'
  smaFast: number
  smaSlow: number
  lastClose: number
}

interface IterationResult {
  iteration: number
  lookbackPeriod: number
  factors: FactorReport
  hypothesis: string
  confidence: number
  signal: Signal
}

function analyzeFactors(
  candles: Candle[],
  lookback: number,
): FactorReport {
  const closes = candles.map((c) => c.close)
  const volumes = candles.map((c) => c.volume)

  return {
    momentum: calcMomentum(closes, lookback),
    volatility: calcVolatility(closes, lookback),
    volumeTrend: calcVolumeTrend(volumes, lookback),
    smaCrossover: detectSMACrossover(closes, 10, 30),
    smaFast: calcSMA(closes, 10),
    smaSlow: calcSMA(closes, 30),
    lastClose: closes[closes.length - 1] ?? 0,
  }
}

function generateHypothesis(f: FactorReport): {
  hypothesis: string
  signal: Signal
  confidence: number
} {
  let score = 50 // neutral baseline
  const reasons: string[] = []

  // Momentum factor
  if (f.momentum > 2) {
    score += 10
    reasons.push('positive momentum')
  } else if (f.momentum > 0) {
    score += 5
    reasons.push('mild positive momentum')
  } else if (f.momentum < -2) {
    score -= 10
    reasons.push('negative momentum')
  } else if (f.momentum < 0) {
    score -= 5
    reasons.push('mild negative momentum')
  }

  // Volume factor
  if (f.volumeTrend === 'increasing') {
    // Volume confirms direction
    score += f.momentum > 0 ? 10 : -5
    reasons.push('volume increasing')
  } else if (f.volumeTrend === 'decreasing') {
    score -= 5
    reasons.push('volume decreasing')
  }

  // SMA crossover factor
  if (f.smaCrossover === 'bullish') {
    score += 15
    reasons.push('SMA bullish crossover')
  } else if (f.smaCrossover === 'bearish') {
    score -= 15
    reasons.push('SMA bearish crossover')
  }

  // Volatility factor
  if (f.volatility > 3) {
    // High volatility reduces confidence but may signal mean reversion
    score -= 5
    reasons.push('high volatility')
  } else if (f.volatility < 1) {
    // Low volatility with crossover -> breakout potential
    if (f.smaCrossover !== 'none') {
      score += 5
      reasons.push('low volatility breakout setup')
    }
  }

  // Clamp confidence to 0-100
  const confidence = Math.max(0, Math.min(100, score))

  // Determine hypothesis text and signal
  let hypothesis: string
  let signal: Signal

  if (f.momentum > 2 && f.volumeTrend === 'increasing') {
    hypothesis = 'BULLISH momentum with rising volume'
    signal = 'BUY'
  } else if (
    f.smaCrossover === 'bullish' &&
    f.volatility < 2
  ) {
    hypothesis = 'BREAKOUT potential — SMA crossover + low volatility'
    signal = 'BUY'
  } else if (f.smaCrossover === 'bullish') {
    hypothesis = 'BULLISH — SMA crossover detected'
    signal = 'BUY'
  } else if (
    f.volatility > 3 &&
    f.momentum < -2
  ) {
    hypothesis =
      'MEAN REVERSION opportunity — high volatility + negative momentum'
    signal = 'BUY'
  } else if (f.momentum < -2 && f.volumeTrend === 'increasing') {
    hypothesis = 'BEARISH momentum with rising sell volume'
    signal = 'SELL'
  } else if (f.smaCrossover === 'bearish') {
    hypothesis = 'BEARISH — SMA death cross detected'
    signal = 'SELL'
  } else if (
    f.momentum < -2 &&
    f.volumeTrend === 'decreasing'
  ) {
    hypothesis = 'WEAK BEARISH — declining momentum and fading volume'
    signal = 'SELL'
  } else if (
    Math.abs(f.momentum) < 1 &&
    f.volumeTrend === 'flat'
  ) {
    hypothesis = 'CONSOLIDATION — no clear trend, stay flat'
    signal = 'HOLD'
  } else if (f.momentum > 0) {
    hypothesis = 'MILD BULLISH — slight upward tendency'
    signal = 'BUY'
  } else if (f.momentum < 0) {
    hypothesis = 'MILD BEARISH — slight downward tendency'
    signal = 'SELL'
  } else {
    hypothesis = 'NEUTRAL — insufficient directional signals'
    signal = 'HOLD'
  }

  return { hypothesis, signal, confidence }
}

// ---------------------------------------------------------------------------
// Report Formatting
// ---------------------------------------------------------------------------

function formatNumber(n: number, decimals: number = 2): string {
  if (isNaN(n)) return 'N/A'
  return n.toFixed(decimals)
}

function volumeArrow(
  trend: 'increasing' | 'decreasing' | 'flat',
): string {
  if (trend === 'increasing') return '\u2191 increasing'
  if (trend === 'decreasing') return '\u2193 decreasing'
  return '\u2194 flat'
}

function crossoverLabel(
  crossover: 'bullish' | 'bearish' | 'none',
): string {
  if (crossover === 'bullish') return 'bullish crossover'
  if (crossover === 'bearish') return 'bearish crossover'
  return 'no crossover'
}

function formatIteration(r: IterationResult): string {
  const lines: string[] = []
  lines.push(
    '\u2500\u2500 Iteration ' + r.iteration + ' (lookback: ' + r.lookbackPeriod + ') \u2500\u2500',
  )
  lines.push('Factors:')
  lines.push(
    '  Momentum (' +
      r.lookbackPeriod +
      '-candle): ' +
      (r.factors.momentum > 0 ? '+' : '') +
      formatNumber(r.factors.momentum) +
      '%',
  )
  lines.push(
    '  Volatility (\u03C3): ' + formatNumber(r.factors.volatility) + '%',
  )
  lines.push(
    '  Volume trend: ' + volumeArrow(r.factors.volumeTrend),
  )
  lines.push(
    '  SMA(10/30): ' + crossoverLabel(r.factors.smaCrossover),
  )
  lines.push(
    '  SMA fast: ' +
      formatNumber(r.factors.smaFast) +
      ' | SMA slow: ' +
      formatNumber(r.factors.smaSlow),
  )
  lines.push('  Last close: ' + formatNumber(r.factors.lastClose))
  lines.push('Hypothesis: ' + r.hypothesis)
  lines.push('Confidence: ' + r.confidence + '/100')
  lines.push('Signal: ' + r.signal)
  return lines.join('\n')
}

function formatSummary(
  results: IterationResult[],
  symbol: string,
  timeframe: string,
  candleCount: number,
): string {
  const signalCounts: Record<Signal, number> = {
    BUY: 0,
    SELL: 0,
    HOLD: 0,
  }
  for (const r of results) {
    signalCounts[r.signal]++
  }

  // Determine consensus
  let consensus: Signal = 'HOLD'
  if (
    signalCounts.BUY > signalCounts.SELL &&
    signalCounts.BUY > signalCounts.HOLD
  ) {
    consensus = 'BUY'
  } else if (
    signalCounts.SELL > signalCounts.BUY &&
    signalCounts.SELL > signalCounts.HOLD
  ) {
    consensus = 'SELL'
  }

  const avgConfidence =
    results.reduce((s, r) => s + r.confidence, 0) / results.length

  // Collect key factors from highest-confidence iteration
  const best = results.reduce((a, b) =>
    a.confidence >= b.confidence ? a : b,
  )
  const keyFactors: string[] = []
  if (!isNaN(best.factors.momentum)) {
    keyFactors.push(
      'momentum ' +
        (best.factors.momentum > 0 ? '+' : '') +
        formatNumber(best.factors.momentum) +
        '%',
    )
  }
  if (best.factors.smaCrossover !== 'none') {
    keyFactors.push('SMA ' + best.factors.smaCrossover + ' crossover')
  }
  if (best.factors.volumeTrend !== 'flat') {
    keyFactors.push('volume ' + volumeArrow(best.factors.volumeTrend))
  }

  // Risk assessment from average volatility
  const avgVol =
    results.reduce((s, r) => s + r.factors.volatility, 0) /
    results.length

  const bar = '\u2550'.repeat(43)
  const lines: string[] = []
  lines.push(bar)
  lines.push(
    '\u2550\u2550\u2550 AutoResearch Report: ' + symbol + ' (' + timeframe + ') \u2550\u2550\u2550',
  )
  lines.push(
    'Iterations: ' + results.length + ' | Candles analyzed: ' + candleCount,
  )
  lines.push('')

  for (const r of results) {
    lines.push(formatIteration(r))
    lines.push('')
  }

  lines.push('\u2500\u2500 Summary \u2500\u2500')
  lines.push(
    'Consensus: ' +
      consensus +
      ' (' +
      signalCounts[consensus] +
      '/' +
      results.length +
      ' iterations)',
  )
  lines.push('Avg Confidence: ' + formatNumber(avgConfidence, 0) + '/100')
  if (keyFactors.length > 0) {
    lines.push('Key Factors: ' + keyFactors.join(', '))
  }
  if (!isNaN(avgVol)) {
    let riskNote: string
    if (avgVol > 3) {
      riskNote = 'high volatility \u2014 reduce position size'
    } else if (avgVol > 1.5) {
      riskNote = 'moderate volatility \u2014 standard position sizing'
    } else {
      riskNote = 'low volatility \u2014 favorable risk profile'
    }
    lines.push(
      'Risk: Volatility at ' + formatNumber(avgVol) + '% \u2014 ' + riskNote,
    )
  }
  lines.push(bar)

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Lookback periods for iteration variety
// ---------------------------------------------------------------------------

function getLookbackPeriods(iterations: number): number[] {
  const periods = [20, 14, 10, 30, 7, 5, 25]
  const result: number[] = []
  for (let i = 0; i < iterations; i++) {
    result.push(periods[i % periods.length])
  }
  return result
}

// ---------------------------------------------------------------------------
// Tool Definition
// ---------------------------------------------------------------------------

export const AutoResearchTool = buildTool({
  name: 'AutoResearch',
  searchHint: 'karpathy research loop technical analysis market factors',
  maxResultSizeChars: 100_000,

  get inputSchema(): InputSchema {
    return inputSchema
  },

  isReadOnly() {
    return true
  },

  isDestructive() {
    return false
  },

  isConcurrencySafe() {
    return true
  },

  async description() {
    return 'Run a Karpathy-style research loop: fetch candles, compute technical factors (momentum, volatility, SMA, volume), hypothesize, score, and report.'
  },

  async prompt() {
    return [
      'Run an automated research loop on a trading pair.',
      'Fetches candle data from the exchange, computes technical analysis factors',
      '(momentum, volatility, volume trend, SMA crossover), generates hypotheses,',
      'scores confidence, and produces a structured report.',
      'Each iteration uses a different lookback period for analysis variety.',
      'Parameters: symbol (required), timeframe (default 4h), iterations (default 3).',
      'Factors computed: momentum (% change), volatility (stddev of returns),',
      'volume trend (increasing/decreasing/flat), SMA(10/30) crossover.',
      'Output includes per-iteration breakdown and consensus summary.',
    ].join('\n')
  },

  toAutoClassifierInput(input) {
    return 'research ' + (input.symbol ?? '?') + ' ' + (input.timeframe ?? '4h') + ' x' + (input.iterations ?? 3)
  },

  mapToolResultToToolResultBlockParam(content, toolUseID) {
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: String(content),
    }
  },

  renderToolUseMessage(input) {
    const symbol = input.symbol ?? '?'
    const tf = input.timeframe ?? '4h'
    const iter = input.iterations ?? 3
    return 'AutoResearch: ' + symbol + ' (' + tf + ') x' + iter
  },

  async call(input) {
    const symbol = input.symbol
    const timeframe = input.timeframe ?? '4h'
    const iterations = input.iterations ?? 3

    let candles: Candle[]
    try {
      const exchange = await getConnectedExchange()
      candles = await exchange.getCandles(symbol, timeframe, 100)
    } catch (error: unknown) {
      if (error instanceof InvalidSymbolError) {
        return {
          data: 'Unknown symbol: ' + symbol + '. Use format like BTC/USDT. Available: BTC, ETH, SOL, BNB, XRP, ADA, DOGE, AVAX, DOT, LINK, UNI, ATOM, LTC, NEAR, APT, ARB, OP, SUI, PEPE, MATIC.',
        }
      }
      const msg =
        error instanceof Error ? error.message : String(error)
      return { data: 'Failed to fetch candle data: ' + msg }
    }

    if (candles.length === 0) {
      return {
        data:
          'No candle data returned for ' +
          symbol +
          ' (' +
          timeframe +
          '). Check that the symbol is valid.',
      }
    }

    const lookbacks = getLookbackPeriods(iterations)
    const results: IterationResult[] = []

    for (let i = 0; i < iterations; i++) {
      const lookback = lookbacks[i]
      const factors = analyzeFactors(candles, lookback)
      const { hypothesis, signal, confidence } =
        generateHypothesis(factors)

      results.push({
        iteration: i + 1,
        lookbackPeriod: lookback,
        factors,
        hypothesis,
        confidence,
        signal,
      })
    }

    const report = formatSummary(
      results,
      symbol,
      timeframe,
      candles.length,
    )

    return { data: report }
  },
} satisfies ToolDef<InputSchema, Output>)
