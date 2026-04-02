import type { CompanionBones, Eye, Master } from './types.js'
import { MASTER_NAMES, RARITY_STARS, MASTER_RARITY } from './types.js'

/**
 * Master sprites — simplified iconic representations for terminal display.
 * Instead of 18 animal ASCII art frames, masters get a compact 4-line card.
 * The LLM persona system handles personality; sprites handle visual identity.
 */

// Archetype emblems for terminal display
const ARCHETYPE_EMBLEMS: Record<string, string> = {
  value_investor: '📊',
  trend_follower: '📈',
  macro_trader:   '🌍',
  quant:          '🔢',
  strategist:     '⚔️',
  philosopher:    '🧠',
  first_principles: '💡',
  crypto_native:  '₿',
  scientist:      '🔬',
}

function getEmblem(master: Master): string {
  // Import getMasterArchetype dynamically to avoid circular deps
  // Fallback to a generic emblem
  const archetypeMap: Partial<Record<Master, string>> = {
    warren_buffett: 'value_investor', benjamin_graham: 'value_investor',
    charlie_munger: 'value_investor', john_templeton: 'value_investor',
    jesse_livermore: 'trend_follower', nicolas_darvas: 'trend_follower',
    george_soros: 'macro_trader', paul_tudor_jones: 'macro_trader',
    stanley_druckenmiller: 'macro_trader', ray_dalio: 'macro_trader',
    jim_simons: 'quant', ed_thorp: 'quant', richard_dennis: 'quant',
    linda_raschke: 'quant', claude_shannon: 'quant',
    sun_tzu: 'strategist', miyamoto_musashi: 'strategist',
    fan_li: 'strategist', lv_buwei: 'strategist', bai_gui: 'strategist',
    nassim_taleb: 'philosopher', seneca: 'philosopher',
    laozi: 'philosopher', machiavelli: 'philosopher',
    elon_musk: 'first_principles', jeff_bezos: 'first_principles',
    peter_thiel: 'first_principles', steve_jobs: 'first_principles',
    richard_feynman: 'first_principles', garry_tan: 'first_principles',
    andrej_karpathy: 'first_principles',
    satoshi_nakamoto: 'crypto_native', arthur_hayes: 'crypto_native',
    vitalik_buterin: 'crypto_native', cz_zhao: 'crypto_native',
    andre_cronje: 'crypto_native', he_yi: 'crypto_native',
    xu_mingxing: 'crypto_native',
    isaac_newton: 'scientist', albert_einstein: 'scientist',
    alan_turing: 'scientist', carl_gauss: 'scientist',
    benoit_mandelbrot: 'scientist', john_von_neumann: 'scientist',
  }
  const archetype = archetypeMap[master] ?? 'philosopher'
  return ARCHETYPE_EMBLEMS[archetype] ?? '🧠'
}

/**
 * Render a compact master sprite for terminal display.
 * Returns 4 lines representing the master's identity card.
 */
export function renderSprite(bones: CompanionBones, _frame = 0): string[] {
  const master = bones.species as Master
  const name = MASTER_NAMES[master] ?? master
  const rarity = MASTER_RARITY[master] ?? bones.rarity
  const stars = RARITY_STARS[rarity] ?? '★'
  const emblem = getEmblem(master)

  // Compact 4-line master card
  return [
    `  ${emblem} ${name}`,
    `  ${stars}`,
    `  (${bones.eye}  ${bones.eye})`,
    `  guardian`,
  ]
}

export function spriteFrameCount(_species: Master): number {
  // Masters don't animate — single frame
  return 1
}

/**
 * Render a compact face for inline display (status bar, alerts).
 */
export function renderFace(bones: CompanionBones): string {
  const master = bones.species as Master
  const emblem = getEmblem(master)
  return `${emblem}(${bones.eye}${bones.eye})`
}
