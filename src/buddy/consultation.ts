/**
 * Cross-guardian consultation system — ask ANY of the 52 masters for their opinion.
 * Parses natural language queries, fuzzy-matches master names, and builds one-shot prompts.
 */

import type { Master } from './types.js'
import { MASTERS, MASTER_NAMES } from './types.js'
import { buildGuardianSystemPrompt } from './persona.js'
import type { StatName } from './types.js'

// ─── Aliases ────────────────────────────────────────────────────────────────────

/** Common aliases and Chinese names mapping to Master IDs. */
export const MASTER_ALIASES: Record<string, Master> = {
  // 8 core masters — English short names
  livermore: 'jesse_livermore',
  soros: 'george_soros',
  buffett: 'warren_buffett',
  munger: 'charlie_munger',
  dalio: 'ray_dalio',
  taleb: 'nassim_taleb',
  satoshi: 'satoshi_nakamoto',
  sun_tzu: 'sun_tzu',

  // Additional English short names
  burry: 'michael_burry',
  simons: 'jim_simons',
  thorp: 'ed_thorp',
  darvas: 'nicolas_darvas',
  graham: 'benjamin_graham',
  templeton: 'john_templeton',
  dennis: 'richard_dennis',
  raschke: 'linda_raschke',
  paulson: 'john_paulson',
  druckenmiller: 'stanley_druckenmiller',
  ptj: 'paul_tudor_jones',
  tudor_jones: 'paul_tudor_jones',
  hayes: 'arthur_hayes',
  oneil: 'william_oneil',
  sperandeo: 'victor_sperandeo',
  williams: 'larry_williams',
  musk: 'elon_musk',
  bezos: 'jeff_bezos',
  thiel: 'peter_thiel',
  jobs: 'steve_jobs',
  feynman: 'richard_feynman',
  tan: 'garry_tan',
  karpathy: 'andrej_karpathy',
  vitalik: 'vitalik_buterin',
  buterin: 'vitalik_buterin',
  cz: 'cz_zhao',
  cronje: 'andre_cronje',
  newton: 'isaac_newton',
  einstein: 'albert_einstein',
  turing: 'alan_turing',
  gauss: 'carl_gauss',
  mandelbrot: 'benoit_mandelbrot',
  shannon: 'claude_shannon',
  von_neumann: 'john_von_neumann',
  neumann: 'john_von_neumann',
  musashi: 'miyamoto_musashi',
  machiavelli: 'machiavelli',
  seneca: 'seneca',
  laozi: 'laozi',

  // Chinese names — all masters with Chinese display names
  '孙子': 'sun_tzu',
  '孙武': 'sun_tzu',
  '本间宗久': 'munehisa_homma',
  '本間宗久': 'munehisa_homma',
  '范蠡': 'fan_li',
  '宫本武藏': 'miyamoto_musashi',
  '宮本武蔵': 'miyamoto_musashi',
  '吕不韦': 'lv_buwei',
  '呂不韋': 'lv_buwei',
  '老子': 'laozi',
  '李嘉诚': 'li_ka_shing',
  '李嘉誠': 'li_ka_shing',
  '胡雪岩': 'hu_xueyan',
  '宗庆后': 'zong_qinghou',
  '宗慶後': 'zong_qinghou',
  '曾国藩': 'zeng_guofan',
  '曾國藩': 'zeng_guofan',
  '白圭': 'bai_gui',
  '沈万三': 'shen_wansan',
  '沈萬三': 'shen_wansan',
  '张謇': 'zhang_jian',
  '張謇': 'zhang_jian',
  '赵长鹏': 'cz_zhao',
  '趙長鵬': 'cz_zhao',
  '何一': 'he_yi',
  '徐明星': 'xu_mingxing',

  // Chinese names for Western figures
  '巴菲特': 'warren_buffett',
  '索罗斯': 'george_soros',
  '索羅斯': 'george_soros',
  '塔勒布': 'nassim_taleb',
  '芒格': 'charlie_munger',
  '达利欧': 'ray_dalio',
  '達利歐': 'ray_dalio',
  '中本聪': 'satoshi_nakamoto',
  '中本聰': 'satoshi_nakamoto',
  '牛顿': 'isaac_newton',
  '牛頓': 'isaac_newton',
  '爱因斯坦': 'albert_einstein',
  '愛因斯坦': 'albert_einstein',
  '马斯克': 'elon_musk',
  '馬斯克': 'elon_musk',
}

// ─── Fuzzy Matching ─────────────────────────────────────────────────────────────

/**
 * Finds a master by name — fuzzy, case-insensitive, partial match.
 * Checks aliases first, then master IDs, then display names.
 */
export function findMasterByName(name: string): Master | null {
  const lower = name.toLowerCase().trim()
  if (!lower) return null

  // 1. Exact alias match (case-insensitive for Latin, exact for CJK)
  const aliasHit = MASTER_ALIASES[lower] ?? MASTER_ALIASES[name.trim()]
  if (aliasHit) return aliasHit

  // 2. Exact master ID match
  const idHit = MASTERS.find(m => m === lower)
  if (idHit) return idHit

  // 3. Partial match on master ID (e.g., "soros" matches "george_soros")
  const idPartial = MASTERS.find(m => m.includes(lower))
  if (idPartial) return idPartial

  // 4. Partial match on display name (case-insensitive)
  const namePartial = MASTERS.find(m => {
    const display = MASTER_NAMES[m].toLowerCase()
    return display.includes(lower)
  })
  if (namePartial) return namePartial

  // 5. Partial alias key match
  for (const [alias, master] of Object.entries(MASTER_ALIASES)) {
    if (alias.includes(lower) || lower.includes(alias)) return master
  }

  return null
}

// ─── Query Parsing ──────────────────────────────────────────────────────────────

// Patterns that indicate a consultation query
const QUERY_PATTERNS = [
  /what\s+would\s+(.+?)\s+(?:do|say|think|advise|recommend)\b/i,
  /ask\s+(.+?)\s+(?:about|on|regarding|for)\s+(.+)/i,
  /(?:consult|summon|call)\s+(.+?)(?:\s+(?:about|on|regarding|for)\s+(.+))?$/i,
  /(.+?)(?:'s|'s)\s+(?:take|opinion|view|advice|thought)\s+(?:on|about|regarding)\s+(.+)/i,
  /how\s+would\s+(.+?)\s+(?:approach|handle|analyze|trade|view)\s+(.+)/i,
]

/**
 * Parses natural language into a master consultation request.
 * Handles: "what would soros do?", "ask buffett about ETH", "consult taleb on risk".
 */
export function parseMasterQuery(
  input: string,
): { master: Master; question: string } | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  for (const pattern of QUERY_PATTERNS) {
    const match = trimmed.match(pattern)
    if (!match) continue

    const nameCandidate = match[1]!.trim().replace(/[?.!,]+$/, '')
    const master = findMasterByName(nameCandidate)
    if (!master) continue

    // Extract question: either from capture group 2 or the full input
    const question = match[2]?.trim() || trimmed
    return { master, question }
  }

  return null
}

// ─── Prompt Builder ─────────────────────────────────────────────────────────────

/** Default balanced stats for one-shot consultations (no user-specific roll). */
const CONSULTATION_STATS: Record<StatName, number> = {
  PRECISION: 60,
  PATIENCE: 60,
  AGGRESSION: 50,
  WISDOM: 70,
  SASS: 55,
}

/**
 * Builds a complete prompt for a one-shot consultation with a master.
 * Uses buildGuardianSystemPrompt for persona, injects trading context and question.
 */
export function buildConsultationPrompt(
  master: Master,
  question: string,
  tradingContext: string,
): string {
  const persona = buildGuardianSystemPrompt(master, CONSULTATION_STATS)
  const name = MASTER_NAMES[master]

  return [
    persona,
    '',
    `You are being consulted as ${name}. A trader has a question for you.`,
    '',
    tradingContext ? `Current trading context: ${tradingContext}` : '',
    '',
    `Question: ${question}`,
    '',
    'Give your analysis in 2-3 sentences. Stay in character.',
  ]
    .filter(line => line !== undefined)
    .join('\n')
}
