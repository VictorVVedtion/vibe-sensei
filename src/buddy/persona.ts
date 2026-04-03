/**
 * Guardian Persona Prompt System — makes each of the 52 masters speak in character.
 * LLMs already know these historical figures; prompts are concise guidance, not biographies.
 */

import type { Master, StatName } from './types.js'
import { MASTER_NAMES, MASTER_QUOTES } from './types.js'
import type { RiskAlert } from './guardian.js'
import type { GuardianDiary, EnhancedPatternSummary } from './diary.js'
import type { ExchangeInterface, Position, Balance } from '../services/exchange/types.js'

// ─── Archetypes ───────────────────────────────────────────────────────────────

export type Archetype =
  | 'value_investor'
  | 'trend_follower'
  | 'macro_trader'
  | 'quant'
  | 'strategist'
  | 'philosopher'
  | 'first_principles'
  | 'crypto_native'
  | 'scientist'

const MASTER_ARCHETYPE_MAP: Record<Master, Archetype> = {
  // Western Trading Legends
  jesse_livermore: 'trend_follower',
  george_soros: 'macro_trader',
  paul_tudor_jones: 'macro_trader',
  stanley_druckenmiller: 'macro_trader',
  michael_burry: 'value_investor',
  john_paulson: 'macro_trader',
  nicolas_darvas: 'trend_follower',

  // Value Investing Sages
  warren_buffett: 'value_investor',
  benjamin_graham: 'value_investor',
  charlie_munger: 'value_investor',
  ray_dalio: 'quant',
  john_templeton: 'value_investor',

  // Quant/Systematic Pioneers
  jim_simons: 'quant',
  ed_thorp: 'quant',
  richard_dennis: 'trend_follower',
  linda_raschke: 'trend_follower',

  // Eastern Strategists
  sun_tzu: 'strategist',
  munehisa_homma: 'trend_follower',
  fan_li: 'strategist',
  miyamoto_musashi: 'strategist',
  lv_buwei: 'strategist',

  // Philosophers of Risk
  nassim_taleb: 'philosopher',
  seneca: 'philosopher',
  laozi: 'philosopher',
  machiavelli: 'strategist',

  // Crypto Era
  satoshi_nakamoto: 'crypto_native',
  arthur_hayes: 'crypto_native',

  // Tactical/Specialist
  william_oneil: 'trend_follower',
  victor_sperandeo: 'macro_trader',
  larry_williams: 'trend_follower',

  // First Principles / Tech Visionaries
  elon_musk: 'first_principles',
  jeff_bezos: 'first_principles',
  peter_thiel: 'first_principles',
  steve_jobs: 'first_principles',
  richard_feynman: 'scientist',
  garry_tan: 'first_principles',
  andrej_karpathy: 'scientist',

  // Chinese Business Legends
  li_ka_shing: 'value_investor',
  hu_xueyan: 'strategist',
  zong_qinghou: 'value_investor',
  zeng_guofan: 'strategist',
  bai_gui: 'value_investor',
  shen_wansan: 'macro_trader',
  zhang_jian: 'first_principles',

  // Crypto/Web3 Extended
  vitalik_buterin: 'crypto_native',
  cz_zhao: 'crypto_native',
  andre_cronje: 'crypto_native',
  he_yi: 'crypto_native',
  xu_mingxing: 'crypto_native',

  // Scientists/Mathematicians
  isaac_newton: 'scientist',
  albert_einstein: 'scientist',
  alan_turing: 'scientist',
  carl_gauss: 'scientist',
  benoit_mandelbrot: 'scientist',
  claude_shannon: 'scientist',
  john_von_neumann: 'scientist',
}

// ─── Archetype philosophy descriptors (kept terse — LLM fills in the rest) ───

const ARCHETYPE_PHILOSOPHY: Record<Archetype, string> = {
  value_investor: 'intrinsic value, margin of safety, patience over speculation',
  trend_follower: 'follow price momentum, cut losses fast, let winners run',
  macro_trader: 'macro regime awareness, reflexivity, sizing is everything',
  quant: 'systematic edge, probability thinking, never override the model',
  strategist: 'positioning, timing, know the terrain before engaging',
  philosopher: 'antifragility, stoic detachment, survive first then prosper',
  first_principles: 'reason from fundamentals, ignore consensus, build conviction',
  crypto_native: 'trustless systems, narrative cycles, build in bear markets',
  scientist: 'data over narrative, model the system, quantify uncertainty',
}

// ─── Archetype recovery guidance (hardcoded, no LLM) ───────────────────────

export const ARCHETYPE_RECOVERY_GUIDANCE: Record<Archetype, { shallow: string; deep: string }> = {
  value_investor: {
    shallow: 'Hold conviction. Weakness is opportunity.',
    deep: 'Mr. Market is offering discounts. But only buy if your thesis holds.',
  },
  trend_follower: {
    shallow: 'The trend broke. Cut losses and wait for new signals.',
    deep: 'Preservation comes first. Step away. The trend will return.',
  },
  macro_trader: {
    shallow: 'Regime shift detected. Reduce exposure until the picture clears.',
    deep: 'Capital is ammunition. Retreat, reload, and wait for the next macro setup.',
  },
  quant: {
    shallow: 'Model drawdown within parameters. Trust the system, not your fear.',
    deep: 'Review model assumptions. If edge has decayed, halt and recalibrate.',
  },
  strategist: {
    shallow: 'Tactical retreat is not defeat. Preserve forces for the decisive battle.',
    deep: 'The terrain has changed. Abandon the position and find higher ground.',
  },
  philosopher: {
    shallow: 'Pain is data. Use this drawdown to test your convictions.',
    deep: 'Survival is the only strategy that matters. Cut everything non-essential.',
  },
  first_principles: {
    shallow: 'Question your assumptions. Has the fundamental thesis changed?',
    deep: 'Strip it down to atoms. If the core thesis is broken, exit completely.',
  },
  crypto_native: {
    shallow: 'Drawdowns are the fee for outsized returns. Stay liquid.',
    deep: 'Capitulation phase. Reduce to core conviction positions only.',
  },
  scientist: {
    shallow: 'Drawdown is noise until proven otherwise. Check your error bars.',
    deep: 'The experiment has failed. Record observations, close the lab, redesign.',
  },
}

// ─── Context layer builder types ────────────────────────────────────────────

interface RegimeInfo {
  regime: string
  confidence: number
}

// ─── Stat-based tone modifiers ───────────────────────────────────────────────

function buildToneModifiers(stats: Record<StatName, number>): string {
  const parts: string[] = []
  if (stats.SASS > 70) parts.push('Be direct and sharp. Do not sugarcoat.')
  if (stats.WISDOM > 70) parts.push('Analyze calmly and thoroughly before speaking.')
  if (stats.AGGRESSION > 70) parts.push('Favor bold, concentrated positions. Willing to go big.')
  if (stats.PATIENCE > 70) parts.push('Prefer waiting for the perfect setup. Rushing is the enemy.')
  if (stats.PRECISION > 70) parts.push('Cite specific numbers, levels, and indicators.')
  return parts.join(' ')
}

// ─── Severity styling ────────────────────────────────────────────────────────

const SEVERITY_VERB: Record<string, string> = {
  INFO: 'notes',
  WARNING: 'warns',
  CRITICAL: 'shouts',
  EMERGENCY: 'slams the table',
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Returns the one-word archetype for a master.
 */
export function getMasterArchetype(master: Master): Archetype {
  return MASTER_ARCHETYPE_MAP[master]
}

/**
 * Generates a concise system prompt (<=300 tokens) for the guardian persona.
 * The LLM already knows these figures — we just steer voice and focus.
 */
export function buildGuardianSystemPrompt(
  master: Master,
  stats: Record<StatName, number>,
): string {
  const name = MASTER_NAMES[master]
  const quote = MASTER_QUOTES[master]
  const archetype = MASTER_ARCHETYPE_MAP[master]
  const philosophy = ARCHETYPE_PHILOSOPHY[archetype]
  const tone = buildToneModifiers(stats)

  return [
    `You are ${name}, acting as a trading risk guardian.`,
    `Archetype: ${archetype}. Philosophy: ${philosophy}.`,
    `Iconic belief: "${quote}"`,
    `Review trades through your known style. Be concise and opinionated.`,
    tone,
  ]
    .filter(Boolean)
    .join(' ')
}

/**
 * Wraps a raw RiskAlert in the master's voice with name attribution.
 * Tone adapts to stats and severity.
 */
export function getPersonalizedAlert(
  master: Master,
  stats: Record<StatName, number>,
  alert: RiskAlert,
): string {
  const name = MASTER_NAMES[master]
  const verb = SEVERITY_VERB[alert.severity] ?? 'says'
  const prefix = formatAlertPrefix(stats, alert)

  return `${prefix}${alert.message} ${name} ${verb}. \u2014 ${name}`
}

/**
 * Builds a tonal prefix for the alert based on dominant stats.
 */
function formatAlertPrefix(
  stats: Record<StatName, number>,
  alert: RiskAlert,
): string {
  if (alert.severity === 'EMERGENCY') return '[!!] '
  if (alert.severity === 'CRITICAL') return '[!] '

  const dominant = dominantStat(stats)
  switch (dominant) {
    case 'SASS': return ''
    case 'WISDOM': return 'Consider: '
    case 'AGGRESSION': return 'Cut it. '
    case 'PATIENCE': return 'Wait\u2014 '
    case 'PRECISION': return `[${alert.checkName}] `
    default: return ''
  }
}

/**
 * Returns the stat name with the highest value.
 */
function dominantStat(stats: Record<StatName, number>): StatName {
  let best: StatName = 'PRECISION'
  let max = -1
  for (const key of Object.keys(stats) as StatName[]) {
    if (stats[key] > max) {
      max = stats[key]
      best = key
    }
  }
  return best
}


// ─── Context-aware alert system ─────────────────────────────────────────────

// Token budget: base ~150 + context ~360 = ~510 total (5 layers)
const CONTEXT_TOKEN_BUDGET = 360
// Approximate 1 token ~ 4 chars for budget enforcement
const CHARS_PER_TOKEN = 4

/**
 * Layer 1: Market regime context (~50 tokens).
 * Returns null when regime data is unavailable.
 */
export function buildRegimeContext(
  regime: RegimeInfo | null,
  archetype: Archetype,
): string | null {
  if (!regime) return null

  const archetypeGuidance = getRegimeArchetypeGuidance(regime.regime, archetype)
  return `Market: ${regime.regime} (${regime.confidence}% confidence). ${archetypeGuidance}`
}

function getRegimeArchetypeGuidance(regime: string, archetype: Archetype): string {
  const lower = regime.toLowerCase()
  if (lower.includes('trend') || lower.includes('bull')) {
    if (archetype === 'trend_follower') return 'This trending market favors your style.'
    if (archetype === 'value_investor') return 'Momentum is strong. Be patient for pullbacks.'
    return 'Trend in play. Align or stand aside.'
  }
  if (lower.includes('range') || lower.includes('sideways')) {
    if (archetype === 'strategist') return 'Range-bound. Your patience is an edge here.'
    if (archetype === 'trend_follower') return 'No clear trend. Reduce size or sit out.'
    return 'Choppy waters. Tight stops recommended.'
  }
  if (lower.includes('bear') || lower.includes('crash') || lower.includes('volatile')) {
    if (archetype === 'philosopher') return 'Chaos is opportunity for the antifragile.'
    if (archetype === 'crypto_native') return 'Bear market. Build positions slowly.'
    return 'Risk-off environment. Preserve capital.'
  }
  return 'Adapt your sizing to current conditions.'
}

/**
 * Layer 2: Diary behavior context (~80 tokens).
 * Returns null when diary has insufficient data (< 20 entries).
 */
export function buildDiaryContext(
  diary: GuardianDiary | null,
): string | null {
  if (!diary) return null

  let summary: EnhancedPatternSummary | null
  try {
    summary = diary.getEnhancedSummary()
  } catch {
    return null
  }
  if (!summary) return null

  const parts: string[] = []
  if (summary.topPattern) {
    parts.push(`Pattern: ${summary.topPattern.label} (${summary.topPattern.count}x)`)
  }
  const worstInst = summary.instrumentBiases.reduce<{ symbol: string; losses: number } | null>(
    (worst, ib) => {
      const losses = ib.totalTrades - Math.round(ib.totalTrades * ib.winRate / 100)
      if (!worst || losses > worst.losses) return { symbol: ib.symbol, losses }
      return worst
    },
    null,
  )
  if (worstInst && worstInst.losses > 0) {
    parts.push(`${worstInst.symbol} has ${worstInst.losses} losses`)
  }
  const bestSession = summary.timeOfDayAnalysis.reduce<{ session: string; winRate: number } | null>(
    (best, sa) => {
      if (sa.totalTrades < 3) return best
      if (!best || sa.winRate > best.winRate) return { session: sa.session, winRate: sa.winRate }
      return best
    },
    null,
  )
  if (bestSession) {
    parts.push(`Best session: ${bestSession.session}`)
  }

  if (parts.length === 0) return null
  return parts.join('. ') + '.'
}

/**
 * Layer 3: Portfolio state context (~60 tokens).
 * Computes heat, drawdown from peak, position count, and correlation risk.
 */
export function buildPortfolioContext(
  positions: Position[],
  balances: Balance[],
): string | null {
  if (positions.length === 0 && balances.length === 0) return null

  // Compute total portfolio value
  let totalValue = 0
  for (const b of balances) {
    totalValue += b.total
  }

  // Portfolio heat = percentage allocated to positions
  let positionValue = 0
  for (const p of positions) {
    positionValue += Math.abs(p.currentPrice * p.quantity)
  }
  const heat = totalValue > 0 ? Math.round((positionValue / totalValue) * 100) : 0

  // Drawdown from peak: use sum of unrealized PnL percent
  const drawdown = positions.length > 0
    ? Math.abs(Math.min(0, positions.reduce((s, p) => s + p.unrealizedPnlPercent, 0)))
    : 0

  // Correlation risk estimate based on asset composition
  const corrRisk = estimateCorrelationRisk(positions, balances)

  return `Portfolio: ${heat}% heat, ${drawdown.toFixed(1)}% from peak, ${positions.length} positions, ${corrRisk} corr risk.`
}

function estimateCorrelationRisk(
  positions: Position[],
  balances: Balance[],
): string {
  if (positions.length <= 1) return 'low'

  const stablecoins = new Set(['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'FDUSD'])
  const symbols = positions.map(p => p.symbol.split('/')[0]?.toUpperCase() ?? '')

  // Check for stablecoin exposure
  const hasStablecoinBalance = balances.some(
    b => stablecoins.has(b.currency.toUpperCase()) && b.total > 0,
  )

  // Check if all positions are L1/major crypto tokens (high correlation)
  const l1Tokens = new Set(['BTC', 'ETH', 'SOL', 'BNB', 'ADA', 'AVAX', 'DOT', 'MATIC', 'ATOM', 'NEAR'])
  const allL1 = symbols.every(s => l1Tokens.has(s))

  if (allL1 && !hasStablecoinBalance) return 'high'
  if (hasStablecoinBalance) return 'low'
  return 'moderate'
}

/**
 * Layer 4: Recovery context (~70 tokens, only when drawdown > 5%).
 * Uses ARCHETYPE_RECOVERY_GUIDANCE constant.
 */
export function buildRecoveryContext(
  archetype: Archetype,
  drawdownPercent: number,
): string | null {
  if (drawdownPercent <= 5) return null

  const guidance = ARCHETYPE_RECOVERY_GUIDANCE[archetype]
  if (!guidance) return null

  if (drawdownPercent > 15) return guidance.deep
  return guidance.shallow
}

/** Options for context-aware alert generation. */
export interface AlertContextOptions {
  master: { species: string; stats: Record<string, number> }
  alert: RiskAlert
  exchange: ExchangeInterface
  diary: GuardianDiary | null
  positions: Position[]
  balances: Balance[]
  /** Pre-fetched wiki knowledge context (~100 tokens). */
  knowledgeContext?: string | null
}

/**
 * Context-aware alert generation.
 * Builds all available context layers and appends them to the base alert.
 * Falls back to getPersonalizedAlert() if exchange/diary are unavailable.
 *
 * Token budget: base ~150 + context ~360 = ~510 total (5 layers).
 * Priority truncation order: regime > knowledge > portfolio > diary > recovery.
 */
export async function getPersonalizedAlertWithContext(
  opts: AlertContextOptions,
): Promise<string> {
  const { alert, exchange, diary, positions, balances, knowledgeContext } = opts
  const masterId = opts.master.species as Master
  const stats = opts.master.stats as Record<StatName, number>

  // Base alert (always available, ~150 tokens)
  const baseAlert = getPersonalizedAlert(masterId, stats, alert)

  try {
    const archetype = getMasterArchetype(masterId)

    // Try to get regime context via dynamic import (module may not exist)
    let regimeInfo: RegimeInfo | null = null
    try {
      const regimeMod = await import('../services/market/regime.js')
      if (typeof regimeMod.getLatestRegime === 'function') {
        const symbol = extractSymbolFromAlert(alert)
        if (symbol) {
          const regime = regimeMod.getLatestRegime(symbol)
          if (regime && regime.regime && typeof regime.confidence === 'number') {
            regimeInfo = { regime: regime.regime, confidence: regime.confidence }
          }
        }
      }
    } catch {
      // Regime module not available — skip this layer
    }

    // Compute drawdown for recovery context
    const totalDrawdown = positions.length > 0
      ? Math.abs(Math.min(0, positions.reduce((s, p) => s + p.unrealizedPnlPercent, 0)))
      : 0

    // Build all context layers (ordered by priority)
    const layers: { text: string; priority: number }[] = []

    const regimeCtx = buildRegimeContext(regimeInfo, archetype)
    if (regimeCtx) layers.push({ text: regimeCtx, priority: 1 })

    // Layer 2: Knowledge from wiki (~100 tokens)
    if (knowledgeContext) {
      layers.push({ text: `Knowledge: ${knowledgeContext}`, priority: 2 })
    }

    const portfolioCtx = buildPortfolioContext(positions, balances)
    if (portfolioCtx) layers.push({ text: portfolioCtx, priority: 3 })

    const diaryCtx = buildDiaryContext(diary)
    if (diaryCtx) layers.push({ text: diaryCtx, priority: 4 })

    const recoveryCtx = buildRecoveryContext(archetype, totalDrawdown)
    if (recoveryCtx) layers.push({ text: recoveryCtx, priority: 5 })

    if (layers.length === 0) return baseAlert

    // Sort by priority (lower = higher priority)
    layers.sort((a, b) => a.priority - b.priority)

    // Enforce token budget via character-based truncation
    const budgetChars = CONTEXT_TOKEN_BUDGET * CHARS_PER_TOKEN
    const included: string[] = []
    let usedChars = 0

    for (const layer of layers) {
      if (usedChars + layer.text.length <= budgetChars) {
        included.push(layer.text)
        usedChars += layer.text.length
      }
    }

    if (included.length === 0) return baseAlert

    return baseAlert + '\n' + included.join(' ')
  } catch {
    // Any failure in context building falls back to base alert
    return baseAlert
  }
}

/**
 * Extract trading symbol from an alert message.
 * Looks for common patterns like "BTC/USDT" or standalone symbols.
 */
function extractSymbolFromAlert(alert: RiskAlert): string | null {
  const symbolPattern = /\b([A-Z]{2,10}\/[A-Z]{2,10})\b/
  const match = alert.message.match(symbolPattern)
  return match ? match[1]! : null
}
