import type { Master } from './types.js'

/**
 * Personality-driven ASCII portraits for all 52 guardian masters.
 *
 * Design rules:
 * - Each portrait has 3 lines of ASCII art, each ≤17 display chars
 * - compactFace is a 4-6 char inline face for narrow terminals
 * - LEGENDARY: maximum detail, uses ▓░ shading
 * - EPIC: good detail with personality-specific features
 * - RARE: moderate detail
 * - UNCOMMON: simpler, 1-2 key features
 * - COMMON: minimal
 * - NO emoji inside portraits (width unpredictable)
 *
 * Character palette:
 *   Structure: ( ) / \ _ - ~ ^ | -
 *   Shading:   █ ▓ ░ ▀ ▄ ▌ ▐
 *   Face:      . : ; ' " * # = + < >
 *   Special:   ◉ ● ○ · ✦ × ° ▬ ╱ ╲ ╳ ┤ ├ ╰ ╯ ⊙ ‿
 */

export interface MasterPortrait {
  portrait: [string, string, string]  // 3 lines ASCII art, each ≤17 chars
  compactFace: string                 // narrow terminal 4-6 char face
}

export const MASTER_PORTRAITS: Record<Master, MasterPortrait> = {
  // ═══════════════════════════════════════════════════════════
  // LEGENDARY (8) — Maximum detail, ▓░ shading
  // ═══════════════════════════════════════════════════════════

  // Jesse Livermore — 1920s slicked hair, sharp squinting eyes, high collar
  jesse_livermore: {
    portrait: [
      ' ▄▓▓▓▓▓▓▓▄ ',
      ' ▌◉▬▬▬▬◉▐░ ',
      ' ▀▄▄▄▬▄▄▄▀ ',
    ],
    compactFace: '◉▬▬◉',
  },

  // George Soros — heavy brow ridge, angular jaw, deep-set eyes
  george_soros: {
    portrait: [
      ' ░▄▄▄▄▄▄▄░ ',
      ' ▓▌◉    ◉▐▓',
      '  ▀▄▬▬▬▄▀  ',
    ],
    compactFace: '▓◉◉▓',
  },

  // Warren Buffett — round face, round glasses, warm smile
  warren_buffett: {
    portrait: [
      '  ░░▄▄▄░░   ',
      ' (⊙)    (⊙) ',
      '  ╲  ‿‿  ╱  ',
    ],
    compactFace: '(⊙‿⊙)',
  },

  // Benjamin Graham — thin-frame glasses, high scholar forehead
  benjamin_graham: {
    portrait: [
      '  ▄▄▄▄▄▄▄  ',
      ' ┌○┐    ┌○┐',
      '  ▀▄────▄▀  ',
    ],
    compactFace: '┌○○┐',
  },

  // Jim Simons — big beard, glasses, bald mathematician
  jim_simons: {
    portrait: [
      ' ░▄▓▓▓▓▄░  ',
      ' ▌○      ○▐',
      ' ▓▓▓▓▓▓▓▓▓ ',
    ],
    compactFace: '○▓▓○',
  },

  // Sun Tzu — warrior helmet, visor slit, full armor
  sun_tzu: {
    portrait: [
      '▄█▀▀▀▀▀▀█▄ ',
      '█▌▬░░░░▬▐█ ',
      '▀█▄▄▄▄▄▄█▀ ',
    ],
    compactFace: '█▬▬█',
  },

  // Satoshi Nakamoto — deep hood, full face shadow, only eye glints
  satoshi_nakamoto: {
    portrait: [
      ' ▄▓███████▄',
      ' █▓░ ··  ░▓█',
      ' ▀▓██████▓▀',
    ],
    compactFace: '▓··▓',
  },

  // John von Neumann — high forehead, neat hair, bow tie
  john_von_neumann: {
    portrait: [
      '  ▄▄▄▄▄▄▄  ',
      '  ▌◉    ◉▐  ',
      '  ▀▄╳╳╳▄▀  ',
    ],
    compactFace: '◉╳◉',
  },

  // ═══════════════════════════════════════════════════════════
  // EPIC (18) — Good detail, personality-specific features
  // ═══════════════════════════════════════════════════════════

  // Paul Tudor Jones — thick hair, athletic jaw
  paul_tudor_jones: {
    portrait: [
      '  ▄▓▓▓▓▓▓▄ ',
      '  ▌●    ●▐  ',
      '   ▀▄══▄▀   ',
    ],
    compactFace: '●══●',
  },

  // Stanley Druckenmiller — tall head, serious focus
  stanley_druckenmiller: {
    portrait: [
      '  ▄▓▓▓▓▓▄  ',
      '  ▌◉    ◉▐  ',
      '   ▀▄▄▄▀    ',
    ],
    compactFace: '◉▄◉',
  },

  // Michael Burry — messy hair, asymmetric eyes (● real / ○ glass)
  michael_burry: {
    portrait: [
      ' ░▓▄▓░▓▄░  ',
      '  ▌●    ○▐  ',
      '   ▀▄──▄▀   ',
    ],
    compactFace: '●··○',
  },

  // Charlie Munger — ultra-thick glasses [◉], jowls
  charlie_munger: {
    portrait: [
      '   ░░▄▄░░   ',
      ' [◉]    [◉] ',
      '  ▀▀▬▬▀▀    ',
    ],
    compactFace: '[◉◉]',
  },

  // Ray Dalio — meditation half-closed eyes, zen
  ray_dalio: {
    portrait: [
      '   ░▄▄▄▄░   ',
      '  ▌─    ─▐  ',
      '    ▀▄▄▀     ',
    ],
    compactFace: '─∿─',
  },

  // Ed Thorp — academic neat, precise thin lips
  ed_thorp: {
    portrait: [
      '   ▄▄▄▄▄    ',
      '  ▌○    ○▐  ',
      '    ▀──▀     ',
    ],
    compactFace: '○♠○',
  },

  // Munehisa Homma — tall eboshi hat, merchant
  munehisa_homma: {
    portrait: [
      ' ▄██▀▀▀██▄ ',
      '  ▌●    ●▐  ',
      '   ╲▄▄╱     ',
    ],
    compactFace: '██●●',
  },

  // Miyamoto Musashi — topknot, fierce × eyes, crossed swords
  miyamoto_musashi: {
    portrait: [
      '    ┃▓▓┃    ',
      '  ▌×    ×▐  ',
      ' ╱▀▄▬▬▄▀╲  ',
    ],
    compactFace: '┃××┃',
  },

  // Nassim Taleb — short hair, wide face, thick neck, weightlifter
  nassim_taleb: {
    portrait: [
      '  ▄▓▓▓▓▄   ',
      ' ▓▌●    ●▐▓',
      ' ▓▀▄▬▬▄▀▓  ',
    ],
    compactFace: '▓●●▓',
  },

  // Elon Musk — modern hair, star eyes, angular jaw
  elon_musk: {
    portrait: [
      '  ▄▄▄▄▄▄   ',
      '  ▌✦    ✦▐  ',
      '  ╲▀▄▄▀╱   ',
    ],
    compactFace: '✦╱╲✦',
  },

  // Peter Thiel — neat short hair, laser-focus
  peter_thiel: {
    portrait: [
      '   ▄▄▄▄▄    ',
      '  ▌◉    ◉▐  ',
      '    ▀▄▄▀     ',
    ],
    compactFace: '◉→◉',
  },

  // Garry Tan — modern hair, modern glasses
  garry_tan: {
    portrait: [
      '   ▄▓▓▓▄    ',
      ' ┌●┐  ┌●┐  ',
      '    ▀▄▄▀     ',
    ],
    compactFace: '┌●●┐',
  },

  // Andrej Karpathy — tech look, analytic eyes, neural texture
  andrej_karpathy: {
    portrait: [
      '   ▄▄▄▄▄    ',
      '  ▌○    ○▐  ',
      '  ░▀▄▄▀░    ',
    ],
    compactFace: '○≡○',
  },

  // Li Ka-shing — elder, business glasses
  li_ka_shing: {
    portrait: [
      '   ░░▄▄░░   ',
      ' ┌◉┐  ┌◉┐  ',
      '    ▀▬▬▀     ',
    ],
    compactFace: '◉▬◉',
  },

  // Vitalik Buterin — ultra-thin face, small eyes, very narrow jaw
  vitalik_buterin: {
    portrait: [
      '  ▄▄▄▄▄▄   ',
      '  ▌·    ·▐  ',
      '     ▀▄▀     ',
    ],
    compactFace: '·◇·',
  },

  // Alan Turing — 1940s side-parted hair, clear analytic eyes
  alan_turing: {
    portrait: [
      '  ▄▓▄▄▄▄▄  ',
      '  ▌●    ●▐  ',
      '    ▀▄▄▀     ',
    ],
    compactFace: '●01●',
  },

  // Benoit Mandelbrot — fractal hair alternating, big round glasses
  benoit_mandelbrot: {
    portrait: [
      ' ░▓░▓░▓░▓░ ',
      ' ┌○┐    ┌○┐',
      '   ▀▄▄▄▄▀   ',
    ],
    compactFace: '░○○░',
  },

  // Claude Shannon — 1950s neat, sharp focus
  claude_shannon: {
    portrait: [
      '  ▄▓▓▓▓▓▄  ',
      '  ▌●    ●▐  ',
      '    ▀▄▄▀     ',
    ],
    compactFace: '●10●',
  },

  // ═══════════════════════════════════════════════════════════
  // RARE (18) — Moderate detail
  // ═══════════════════════════════════════════════════════════

  // John Paulson — conservative hedge fund hair
  john_paulson: {
    portrait: [
      '  ▄▓▓▓▓▄   ',
      '  ▌●    ●▐  ',
      '    ▀▄▄▀     ',
    ],
    compactFace: '●$●',
  },

  // Sir John Templeton — elder bow tie
  john_templeton: {
    portrait: [
      '   ░▄▄▄░    ',
      '  ▌○    ○▐  ',
      '    ▀╳╳▀     ',
    ],
    compactFace: '○╳○',
  },

  // Richard Dennis — 70-80s hair, wide face
  richard_dennis: {
    portrait: [
      '  ▄▓▓▓▓▄   ',
      '  ▌●    ●▐  ',
      '   ▀▄▬▄▀    ',
    ],
    compactFace: '●▬●',
  },

  // Fan Li — simple headcloth, flowing robe collar
  fan_li: {
    portrait: [
      ' ─▄▄▄▄▄─   ',
      '  ▌·    ·▐  ',
      '   ╲▄▄▄╱    ',
    ],
    compactFace: '─··─',
  },

  // Lv Buwei — official crown, shrewd
  lv_buwei: {
    portrait: [
      ' ▄█▀▀▀▀█▄  ',
      '  ▌●    ●▐  ',
      '    ▀▄▄▀     ',
    ],
    compactFace: '█●●█',
  },

  // Seneca — Roman bald, stoic eyes, short beard
  seneca: {
    portrait: [
      '   ░▄▄▄░    ',
      '  ▌◉    ◉▐  ',
      '    ▀▓▓▓▀    ',
    ],
    compactFace: '◉▓◉',
  },

  // Laozi — zen half-closed eyes, long flowing beard
  laozi: {
    portrait: [
      '   ░▄▄▄░    ',
      '  ▌─    ─▐  ',
      '  ░▓▓▓▓░    ',
    ],
    compactFace: '─▓▓─',
  },

  // Jeff Bezos — bald, strong jaw
  jeff_bezos: {
    portrait: [
      '   ░░░░░    ',
      '  ▌●    ●▐  ',
      '  ▀▄▬▬▄▀   ',
    ],
    compactFace: '░●●░',
  },

  // Steve Jobs — round glasses, black turtleneck
  steve_jobs: {
    portrait: [
      '   ▄▄▄▄▄    ',
      ' (○)    (○) ',
      '  ▀████▀    ',
    ],
    compactFace: '(○○)',
  },

  // Richard Feynman — curly hair alternating, playful wide grin
  richard_feynman: {
    portrait: [
      '  ░▓░▓░▓░   ',
      '  ▌●    ●▐  ',
      '    ▀▬▬▀     ',
    ],
    compactFace: '●▬▬●',
  },

  // Hu Xueyan — red-top official hat, merchant
  hu_xueyan: {
    portrait: [
      ' ▄●▀▀▀●▄   ',
      '  ▌·    ·▐  ',
      '    ▀▄▄▀     ',
    ],
    compactFace: '●··●',
  },

  // Zeng Guofan — military cap, stern
  zeng_guofan: {
    portrait: [
      ' ▄██▀▀██▄  ',
      '  ▌●    ●▐  ',
      '    ▀▄▄▀     ',
    ],
    compactFace: '██●●',
  },

  // Bai Gui — simple cloth cap, scholar beard
  bai_gui: {
    portrait: [
      '  ─▄▄▄▄─    ',
      '  ▌·    ·▐  ',
      '    ▀──▀     ',
    ],
    compactFace: '·──·',
  },

  // CZ Zhao — modern short hair, confident
  cz_zhao: {
    portrait: [
      '   ▄▄▄▄▄    ',
      '  ▌●    ●▐  ',
      '    ▀▄▄▀     ',
    ],
    compactFace: '●₿●',
  },

  // He Yi — female long hair, bright eyes
  he_yi: {
    portrait: [
      ' ▄▓▓▓▓▓▓▄  ',
      '  ▌✦    ✦▐  ',
      '    ▀▄▄▀     ',
    ],
    compactFace: '▓✦✦▓',
  },

  // Isaac Newton — big curly wig
  isaac_newton: {
    portrait: [
      '░▓▓▓▓▓▓▓░  ',
      '▓▌◉    ◉▐▓  ',
      '   ▀▄▄▄▀    ',
    ],
    compactFace: '▓◉◉▓',
  },

  // Albert Einstein — wild side hair (gap in middle), mustache
  albert_einstein: {
    portrait: [
      '░▓░    ░▓░  ',
      '  ▌●    ●▐  ',
      '   ▀▓▓▓▓▀   ',
    ],
    compactFace: '░●●░',
  },

  // Carl Gauss — 19th century academic cap, sideburns
  carl_gauss: {
    portrait: [
      ' ▄▀▀▀▀▀▄   ',
      ' ▓▌●    ●▐▓',
      '    ▀▄▄▀     ',
    ],
    compactFace: '▓●●▓',
  },

  // ═══════════════════════════════════════════════════════════
  // UNCOMMON (11) — Simple, 1-2 key features
  // ═══════════════════════════════════════════════════════════

  // Nicolas Darvas — elegant slicked hair, slender
  nicolas_darvas: {
    portrait: [
      '   ▄▄▄▄▄    ',
      '  ▌●    ●▐  ',
      '     ▀▄▀     ',
    ],
    compactFace: '●□●',
  },

  // Linda Raschke — female hair, sharp eyes
  linda_raschke: {
    portrait: [
      '  ▄▓▓▓▓▄   ',
      '  ▌✦    ✦▐  ',
      '     ▀▄▀     ',
    ],
    compactFace: '✦▬✦',
  },

  // Machiavelli — Renaissance hat, cunning eyes
  machiavelli: {
    portrait: [
      '  ▄▀▀▀▀▄   ',
      '  ▌×    ×▐  ',
      '     ▀▄▀     ',
    ],
    compactFace: '▀××▀',
  },

  // Arthur Hayes — modern glasses
  arthur_hayes: {
    portrait: [
      '    ▄▄▄▄     ',
      ' ┌●┐  ┌●┐  ',
      '     ▀▄▀     ',
    ],
    compactFace: '┌●●┐',
  },

  // Victor Sperandeo — sparse veteran hair, mouth
  victor_sperandeo: {
    portrait: [
      '    ▄▄▄▄     ',
      '  ▌●    ●▐  ',
      '    ▀▄▬▀     ',
    ],
    compactFace: '●▬●',
  },

  // Larry Williams — graying hair, observant eyes
  larry_williams: {
    portrait: [
      '   ░▄▄░     ',
      '  ▌○    ○▐  ',
      '      ▀▀     ',
    ],
    compactFace: '○  ○',
  },

  // Zong Qinghou — practical neat hair
  zong_qinghou: {
    portrait: [
      '    ▄▄▄▄     ',
      '  ▌●    ●▐  ',
      '     ▀▄▀     ',
    ],
    compactFace: '●步●',
  },

  // Shen Wansan — Ming dynasty merchant hat
  shen_wansan: {
    portrait: [
      '  ▄▀▀▀▄    ',
      '  ▌·    ·▐  ',
      '     ▀▄▀     ',
    ],
    compactFace: '▀··▀',
  },

  // Zhang Jian — late Qing modern hair
  zhang_jian: {
    portrait: [
      '    ▄▄▄▄     ',
      '  ▌●    ●▐  ',
      '     ▀▄▀     ',
    ],
    compactFace: '●工●',
  },

  // Andre Cronje — hoodie, hacker eyes
  andre_cronje: {
    portrait: [
      '  ▄████▄   ',
      '  ▌✦    ✦▐  ',
      '     ▀▄▀     ',
    ],
    compactFace: '█✦✦█',
  },

  // Xu Mingxing — business neat hair
  xu_mingxing: {
    portrait: [
      '    ▄▄▄▄     ',
      '  ▌●    ●▐  ',
      '     ▀▄▀     ',
    ],
    compactFace: '●⚡●',
  },

  // ═══════════════════════════════════════════════════════════
  // COMMON (1) — Minimal
  // ═══════════════════════════════════════════════════════════

  // William O'Neil — standard business hair, simple
  william_oneil: {
    portrait: [
      '    ▄▄▄▄     ',
      '  (●    ●)  ',
      '      ▀▀     ',
    ],
    compactFace: '●●',
  },
}
