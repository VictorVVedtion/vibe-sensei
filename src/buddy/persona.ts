/**
 * Guardian Persona Prompt System — makes each of the 52 masters speak in character.
 * LLMs already know these historical figures; prompts are concise guidance, not biographies.
 */

import type { Master, StatName } from './types.js'
import { MASTER_NAMES, MASTER_QUOTES } from './types.js'
import type { RiskAlert } from './guardian.js'

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
