import type { CompanionBones, Eye, Master, Rarity } from './types.js'
import { MASTER_NAMES, RARITY_STARS, MASTER_RARITY } from './types.js'
import { MASTER_PORTRAITS } from './sprite-atlas.js'
import type { Emotion } from './sprite-atlas.js'
import { stringWidth } from '../ink/stringWidth.js'

/**
 * Master sprites — compact visual identity cards with box-drawing frames.
 * The LLM persona system handles personality; sprites handle visual identity.
 */

// Archetype emblems for terminal display
const ARCHETYPE_EMBLEMS: Record<string, string> = {
  value_investor: '\u{1F4CA}',
  trend_follower: '\u{1F4C8}',
  macro_trader:   '\u{1F30D}',
  quant:          '\u{1F522}',
  strategist:     '\u2694\uFE0F',
  philosopher:    '\u{1F9E0}',
  first_principles: '\u{1F4A1}',
  crypto_native:  '\u20BF',
  scientist:      '\u{1F52C}',
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
  return ARCHETYPE_EMBLEMS[archetype] ?? '\u{1F9E0}'
}

/**
 * Return border characters based on rarity tier.
 * Returns [topLeft, topRight, bottomLeft, bottomRight, horizontal, vertical].
 */
function getBorderChars(_rarity: Rarity): [string, string, string, string, string, string] {
  // All tiers use single-line borders; rarity is distinguished by color, not border shape.
  return ['┌', '┐', '└', '┘', '─', '│']
}

/**
 * Pad or truncate a string to fit within a fixed visual width.
 * Uses stringWidth() for accurate Unicode width measurement.
 */
function padTo(text: string, width: number): string {
  const w = stringWidth(text)
  if (w >= width) return text.slice(0, width) // simple truncation fallback
  return text + ' '.repeat(width - w)
}

/**
 * Render a compact master sprite with box-drawing frame.
 * Returns 8 lines with personality-driven ASCII portrait.
 * Optional emotion parameter selects an emotion-variant portrait if available.
 *
 * Example (legendary):
 * ╔═══════════════════╗
 * ║   ▄▓███████▄      ║
 * ║   █▓░ ··  ░▓█     ║
 * ║   ▀▓██████▓▀      ║
 * ║                    ║
 * ║ ★★★★★ Legendary   ║
 * ║ ₿ Satoshi Nakamoto ║
 * ╚═══════════════════╝
 */
export function renderSprite(bones: CompanionBones, _frame = 0, emotion?: Emotion): string[] {
  const master = bones.species as Master
  const name = MASTER_NAMES[master] ?? master
  const rarity = MASTER_RARITY[master] ?? bones.rarity
  const stars = RARITY_STARS[rarity] ?? '\u2605'
  const emblem = getEmblem(master)
  const rarityLabel = rarity.charAt(0).toUpperCase() + rarity.slice(1)
  const portrait = MASTER_PORTRAITS[master]
  const [tl, tr, bl, br, hz, vt] = getBorderChars(rarity)
  const W = 19

  // Select emotion portrait variant if available, fallback to neutral
  const fallback: [string, string, string] = [
    `    (${bones.eye}  ${bones.eye})    `,
    '                 ',
    '                 ',
  ]
  const art = (emotion && emotion !== 'neutral' ? portrait?.emotions?.[emotion] : undefined)
    ?? portrait?.portrait
    ?? fallback

  return [
    `${tl}${hz.repeat(W)}${tr}`,
    `${vt}${padTo(` ${art[0]}`, W)}${vt}`,
    `${vt}${padTo(` ${art[1]}`, W)}${vt}`,
    `${vt}${padTo(` ${art[2]}`, W)}${vt}`,
    `${vt}${padTo('', W)}${vt}`,
    `${vt}${padTo(` ${stars} ${rarityLabel}`, W)}${vt}`,
    `${vt}${padTo(` ${emblem} ${name}`, W)}${vt}`,
    `${bl}${hz.repeat(W)}${br}`,
  ]
}

export function spriteFrameCount(_species: Master): number {
  // Masters don't animate — single frame
  return 1
}

/**
 * Render a compact face for inline display (status bar, alerts).
 * Uses personality-specific compactFace from the portrait atlas.
 */
export function renderFace(bones: CompanionBones): string {
  const master = bones.species as Master
  const portrait = MASTER_PORTRAITS[master]
  if (portrait) return portrait.compactFace
  const emblem = getEmblem(master)
  return `${emblem}(${bones.eye}${bones.eye})`
}
