import type { Master } from './types.js'

/**
 * Personality-driven ASCII portraits for all 52 guardian masters.
 *
 * Design rules:
 * - Each portrait has 3 lines of ASCII art, each ≤17 display chars
 * - compactFace is a 4-6 char inline face for narrow terminals
 * - eyeChars lists the eye characters used in each portrait (for blink replacement)
 * - emotions maps emotion states to variant portraits (by rarity tier)
 * - LEGENDARY: maximum detail, uses ▓░ shading, 4 emotions
 * - EPIC: good detail with personality-specific features, 3 emotions
 * - RARE: moderate detail, 2 emotions
 * - UNCOMMON: simpler, 1-2 key features, eyeChars only
 * - COMMON: minimal, eyeChars only
 * - NO emoji inside portraits (width unpredictable)
 *
 * Emotion design principles:
 * - HEAD/HAIR (line 1) stays the same across emotions
 * - MOUTH/JAW (line 3) is the primary expression carrier
 * - EYES (line 2) may change for stronger emotions
 * - happy: bigger smile, brighter eyes
 * - worried: tight/wavy mouth, smaller/dimmer eyes
 * - stern: hard line mouth, sharp/narrow eyes
 *
 * Character palette:
 *   Structure: ( ) / \ _ - ~ ^ | -
 *   Shading:   █ ▓ ░ ▀ ▄ ▌ ▐
 *   Face:      . : ; ' " * # = + < >
 *   Special:   ◉ ● ○ · ✦ × ° ▬ ╱ ╲ ╳ ┤ ├ ╰ ╯ ⊙ ‿
 */

export type Emotion = 'neutral' | 'happy' | 'worried' | 'stern'

export interface MasterPortrait {
  portrait: [string, string, string]  // 3 lines ASCII art, each ≤17 chars (= neutral)
  compactFace: string                 // narrow terminal 4-6 char face
  eyeChars: string[]                  // eye characters used in portrait, for blink replacement
  emotions?: Partial<Record<Emotion, [string, string, string]>>  // emotion variant portraits
}

export const MASTER_PORTRAITS: Record<Master, MasterPortrait> = {
  // ═══════════════════════════════════════════════════════════
  // LEGENDARY (8) — Maximum detail, ▓░ shading, 4 emotions
  // ═══════════════════════════════════════════════════════════

  // Jesse Livermore — 1920s slicked hair, sharp squinting eyes, high collar
  jesse_livermore: {
    portrait: [
      ' ▄▓▓▓▓▓▓▓▄ ',
      ' ▌◉▬▬▬▬◉▐░ ',
      ' ▀▄▄▄▬▄▄▄▀ ',
    ],
    compactFace: '◉▬▬◉',
    eyeChars: ['◉'],
    emotions: {
      happy:   [' ▄▓▓▓▓▓▓▓▄ ', ' ▌◉▬▬▬▬◉▐░ ', ' ▀▄▄▄▽▄▄▄▀ '],
      worried: [' ▄▓▓▓▓▓▓▓▄ ', ' ▌·▬▬▬▬·▐░ ', ' ▀▄▄▄~▄▄▄▀ '],
      stern:   [' ▄▓▓▓▓▓▓▓▄ ', ' ▌◉▬▬▬▬◉▐░ ', ' ▀▄▄▄═▄▄▄▀ '],
    },
  },

  // George Soros — heavy brow ridge, angular jaw, deep-set eyes
  george_soros: {
    portrait: [
      ' ░▄▄▄▄▄▄▄░ ',
      ' ▓▌◉    ◉▐▓',
      '  ▀▄▬▬▬▄▀  ',
    ],
    compactFace: '▓◉◉▓',
    eyeChars: ['◉'],
    emotions: {
      happy:   [' ░▄▄▄▄▄▄▄░ ', ' ▓▌◉    ◉▐▓', '  ▀▄ ▽▽ ▄▀  '],
      worried: [' ░▄▄▄▄▄▄▄░ ', ' ▓▌·    ·▐▓', '  ▀▄~~~▄▀  '],
      stern:   [' ░▄▄▄▄▄▄▄░ ', ' ▓▌◉    ◉▐▓', '  ▀▄═══▄▀  '],
    },
  },

  // Warren Buffett — round face, round glasses, warm smile
  warren_buffett: {
    portrait: [
      '  ░░▄▄▄░░   ',
      ' (⊙)    (⊙) ',
      '  ╲  ‿‿  ╱  ',
    ],
    compactFace: '(⊙‿⊙)',
    eyeChars: ['⊙'],
    emotions: {
      happy:   ['  ░░▄▄▄░░   ', ' (⊙)    (⊙) ', '  ╲  ▽▽  ╱  '],
      worried: ['  ░░▄▄▄░░   ', ' (⊙)    (⊙) ', '  ╲  ~~  ╱  '],
      stern:   ['  ░░▄▄▄░░   ', ' (⊙)    (⊙) ', '  ╲  ▬▬  ╱  '],
    },
  },

  // Benjamin Graham — thin-frame glasses, high scholar forehead
  benjamin_graham: {
    portrait: [
      '  ▄▄▄▄▄▄▄  ',
      ' ┌○┐    ┌○┐',
      '  ▀▄────▄▀  ',
    ],
    compactFace: '┌○○┐',
    eyeChars: ['○'],
    emotions: {
      happy:   ['  ▄▄▄▄▄▄▄  ', ' ┌○┐    ┌○┐', '  ▀▄ ‿‿ ▄▀  '],
      worried: ['  ▄▄▄▄▄▄▄  ', ' ┌·┐    ┌·┐', '  ▀▄~~~~▄▀  '],
      stern:   ['  ▄▄▄▄▄▄▄  ', ' ┌○┐    ┌○┐', '  ▀▄════▄▀  '],
    },
  },

  // Jim Simons — big beard, glasses, bald mathematician
  jim_simons: {
    portrait: [
      ' ░▄▓▓▓▓▄░  ',
      ' ▌○      ○▐',
      ' ▓▓▓▓▓▓▓▓▓ ',
    ],
    compactFace: '○▓▓○',
    eyeChars: ['○'],
    emotions: {
      happy:   [' ░▄▓▓▓▓▄░  ', ' ▌○      ○▐', ' ▓▓▓▽▽▓▓▓ '],
      worried: [' ░▄▓▓▓▓▄░  ', ' ▌·      ·▐', ' ▓▓▓~~▓▓▓ '],
      stern:   [' ░▄▓▓▓▓▄░  ', ' ▌○      ○▐', ' ▓▓▓▬▬▓▓▓ '],
    },
  },

  // Sun Tzu — warrior helmet, visor slit, full armor
  sun_tzu: {
    portrait: [
      '▄█▀▀▀▀▀▀█▄ ',
      '█▌▬░░░░▬▐█ ',
      '▀█▄▄▄▄▄▄█▀ ',
    ],
    compactFace: '█▬▬█',
    eyeChars: ['▬'],
    emotions: {
      happy:   ['▄█▀▀▀▀▀▀█▄ ', '█▌▬░░░░▬▐█ ', '▀█▄▄▽▽▄▄█▀ '],
      worried: ['▄█▀▀▀▀▀▀█▄ ', '█▌·░░░░·▐█ ', '▀█▄▄~~▄▄█▀ '],
      stern:   ['▄█▀▀▀▀▀▀█▄ ', '█▌▬░░░░▬▐█ ', '▀█▄▄══▄▄█▀ '],
    },
  },

  // Satoshi Nakamoto — deep hood, full face shadow, only eye glints
  satoshi_nakamoto: {
    portrait: [
      ' ▄▓███████▄',
      ' █▓░ ··  ░▓█',
      ' ▀▓██████▓▀',
    ],
    compactFace: '▓··▓',
    eyeChars: ['·'],
    emotions: {
      happy:   [' ▄▓███████▄', ' █▓░ ✦✦  ░▓█', ' ▀▓██████▓▀'],
      worried: [' ▄▓███████▄', ' █▓░ ..  ░▓█', ' ▀▓██████▓▀'],
      stern:   [' ▄▓███████▄', ' █▓░ ××  ░▓█', ' ▀▓██████▓▀'],
    },
  },

  // John von Neumann — high forehead, neat hair, bow tie
  john_von_neumann: {
    portrait: [
      '  ▄▄▄▄▄▄▄  ',
      '  ▌◉    ◉▐  ',
      '  ▀▄╳╳╳▄▀  ',
    ],
    compactFace: '◉╳◉',
    eyeChars: ['◉'],
    emotions: {
      happy:   ['  ▄▄▄▄▄▄▄  ', '  ▌◉    ◉▐  ', '  ▀▄ ▽▽ ▄▀  '],
      worried: ['  ▄▄▄▄▄▄▄  ', '  ▌·    ·▐  ', '  ▀▄~~~▄▀  '],
      stern:   ['  ▄▄▄▄▄▄▄  ', '  ▌◉    ◉▐  ', '  ▀▄═══▄▀  '],
    },
  },

  // ═══════════════════════════════════════════════════════════
  // EPIC (18) — Good detail, personality-specific features, 3 emotions
  // ═══════════════════════════════════════════════════════════

  // Paul Tudor Jones — thick hair, athletic jaw
  paul_tudor_jones: {
    portrait: [
      '  ▄▓▓▓▓▓▓▄ ',
      '  ▌●    ●▐  ',
      '   ▀▄══▄▀   ',
    ],
    compactFace: '●══●',
    eyeChars: ['●'],
    emotions: {
      happy:   ['  ▄▓▓▓▓▓▓▄ ', '  ▌●    ●▐  ', '   ▀▄▽▽▄▀   '],
      worried: ['  ▄▓▓▓▓▓▓▄ ', '  ▌·    ·▐  ', '   ▀▄~~▄▀   '],
    },
  },

  // Stanley Druckenmiller — tall head, serious focus
  stanley_druckenmiller: {
    portrait: [
      '  ▄▓▓▓▓▓▄  ',
      '  ▌◉    ◉▐  ',
      '   ▀▄▄▄▀    ',
    ],
    compactFace: '◉▄◉',
    eyeChars: ['◉'],
    emotions: {
      happy:   ['  ▄▓▓▓▓▓▄  ', '  ▌◉    ◉▐  ', '   ▀▄‿▄▀    '],
      worried: ['  ▄▓▓▓▓▓▄  ', '  ▌·    ·▐  ', '   ▀▄~▄▀    '],
    },
  },

  // Michael Burry — messy hair, asymmetric eyes (● real / ○ glass)
  michael_burry: {
    portrait: [
      ' ░▓▄▓░▓▄░  ',
      '  ▌●    ○▐  ',
      '   ▀▄──▄▀   ',
    ],
    compactFace: '●··○',
    eyeChars: ['●', '○'],
    emotions: {
      happy:   [' ░▓▄▓░▓▄░  ', '  ▌●    ○▐  ', '   ▀▄‿‿▄▀   '],
      worried: [' ░▓▄▓░▓▄░  ', '  ▌·    ·▐  ', '   ▀▄~~▄▀   '],
    },
  },

  // Charlie Munger — ultra-thick glasses [◉], jowls
  charlie_munger: {
    portrait: [
      '   ░░▄▄░░   ',
      ' [◉]    [◉] ',
      '  ▀▀▬▬▀▀    ',
    ],
    compactFace: '[◉◉]',
    eyeChars: ['◉'],
    emotions: {
      happy:   ['   ░░▄▄░░   ', ' [◉]    [◉] ', '  ▀▀▽▽▀▀    '],
      worried: ['   ░░▄▄░░   ', ' [·]    [·] ', '  ▀▀~~▀▀    '],
    },
  },

  // Ray Dalio — meditation half-closed eyes, zen
  ray_dalio: {
    portrait: [
      '   ░▄▄▄▄░   ',
      '  ▌─    ─▐  ',
      '    ▀▄▄▀     ',
    ],
    compactFace: '─∿─',
    eyeChars: ['─'],
    emotions: {
      happy:   ['   ░▄▄▄▄░   ', '  ▌○    ○▐  ', '    ▀‿‿▀     '],
      worried: ['   ░▄▄▄▄░   ', '  ▌·    ·▐  ', '    ▀~~▀     '],
    },
  },

  // Ed Thorp — academic neat, precise thin lips
  ed_thorp: {
    portrait: [
      '   ▄▄▄▄▄    ',
      '  ▌○    ○▐  ',
      '    ▀──▀     ',
    ],
    compactFace: '○♠○',
    eyeChars: ['○'],
    emotions: {
      happy:   ['   ▄▄▄▄▄    ', '  ▌○    ○▐  ', '    ▀‿‿▀     '],
      worried: ['   ▄▄▄▄▄    ', '  ▌·    ·▐  ', '    ▀~~▀     '],
    },
  },

  // Munehisa Homma — tall eboshi hat, merchant
  munehisa_homma: {
    portrait: [
      ' ▄██▀▀▀██▄ ',
      '  ▌●    ●▐  ',
      '   ╲▄▄╱     ',
    ],
    compactFace: '██●●',
    eyeChars: ['●'],
    emotions: {
      happy:   [' ▄██▀▀▀██▄ ', '  ▌●    ●▐  ', '   ╲▽▽╱     '],
      worried: [' ▄██▀▀▀██▄ ', '  ▌·    ·▐  ', '   ╲~~╱     '],
    },
  },

  // Miyamoto Musashi — topknot, fierce × eyes, crossed swords
  miyamoto_musashi: {
    portrait: [
      '    ┃▓▓┃    ',
      '  ▌×    ×▐  ',
      ' ╱▀▄▬▬▄▀╲  ',
    ],
    compactFace: '┃××┃',
    eyeChars: ['×'],
    emotions: {
      happy:   ['    ┃▓▓┃    ', '  ▌✦    ✦▐  ', ' ╱▀▄‿‿▄▀╲  '],
      worried: ['    ┃▓▓┃    ', '  ▌·    ·▐  ', ' ╱▀▄~~▄▀╲  '],
    },
  },

  // Nassim Taleb — short hair, wide face, thick neck, weightlifter
  nassim_taleb: {
    portrait: [
      '  ▄▓▓▓▓▄   ',
      ' ▓▌●    ●▐▓',
      ' ▓▀▄▬▬▄▀▓  ',
    ],
    compactFace: '▓●●▓',
    eyeChars: ['●'],
    emotions: {
      happy:   ['  ▄▓▓▓▓▄   ', ' ▓▌●    ●▐▓', ' ▓▀▄▽▽▄▀▓  '],
      worried: ['  ▄▓▓▓▓▄   ', ' ▓▌·    ·▐▓', ' ▓▀▄~~▄▀▓  '],
    },
  },

  // Elon Musk — modern hair, star eyes, angular jaw
  elon_musk: {
    portrait: [
      '  ▄▄▄▄▄▄   ',
      '  ▌✦    ✦▐  ',
      '  ╲▀▄▄▀╱   ',
    ],
    compactFace: '✦╱╲✦',
    eyeChars: ['✦'],
    emotions: {
      happy:   ['  ▄▄▄▄▄▄   ', '  ▌✦    ✦▐  ', '  ╲▀▽▽▀╱   '],
      worried: ['  ▄▄▄▄▄▄   ', '  ▌·    ·▐  ', '  ╲▀~~▀╱   '],
    },
  },

  // Peter Thiel — neat short hair, laser-focus
  peter_thiel: {
    portrait: [
      '   ▄▄▄▄▄    ',
      '  ▌◉    ◉▐  ',
      '    ▀▄▄▀     ',
    ],
    compactFace: '◉→◉',
    eyeChars: ['◉'],
    emotions: {
      happy:   ['   ▄▄▄▄▄    ', '  ▌◉    ◉▐  ', '    ▀‿‿▀     '],
      worried: ['   ▄▄▄▄▄    ', '  ▌·    ·▐  ', '    ▀~~▀     '],
    },
  },

  // Garry Tan — modern hair, modern glasses
  garry_tan: {
    portrait: [
      '   ▄▓▓▓▄    ',
      ' ┌●┐  ┌●┐  ',
      '    ▀▄▄▀     ',
    ],
    compactFace: '┌●●┐',
    eyeChars: ['●'],
    emotions: {
      happy:   ['   ▄▓▓▓▄    ', ' ┌●┐  ┌●┐  ', '    ▀‿‿▀     '],
      worried: ['   ▄▓▓▓▄    ', ' ┌·┐  ┌·┐  ', '    ▀~~▀     '],
    },
  },

  // Andrej Karpathy — tech look, analytic eyes, neural texture
  andrej_karpathy: {
    portrait: [
      '   ▄▄▄▄▄    ',
      '  ▌○    ○▐  ',
      '  ░▀▄▄▀░    ',
    ],
    compactFace: '○≡○',
    eyeChars: ['○'],
    emotions: {
      happy:   ['   ▄▄▄▄▄    ', '  ▌○    ○▐  ', '  ░▀‿‿▀░    '],
      worried: ['   ▄▄▄▄▄    ', '  ▌·    ·▐  ', '  ░▀~~▀░    '],
    },
  },

  // Li Ka-shing — elder, business glasses
  li_ka_shing: {
    portrait: [
      '   ░░▄▄░░   ',
      ' ┌◉┐  ┌◉┐  ',
      '    ▀▬▬▀     ',
    ],
    compactFace: '◉▬◉',
    eyeChars: ['◉'],
    emotions: {
      happy:   ['   ░░▄▄░░   ', ' ┌◉┐  ┌◉┐  ', '    ▀‿‿▀     '],
      worried: ['   ░░▄▄░░   ', ' ┌·┐  ┌·┐  ', '    ▀~~▀     '],
    },
  },

  // Vitalik Buterin — ultra-thin face, small eyes, very narrow jaw
  vitalik_buterin: {
    portrait: [
      '  ▄▄▄▄▄▄   ',
      '  ▌·    ·▐  ',
      '     ▀▄▀     ',
    ],
    compactFace: '·◇·',
    eyeChars: ['·'],
    emotions: {
      happy:   ['  ▄▄▄▄▄▄   ', '  ▌✦    ✦▐  ', '     ▀‿▀     '],
      worried: ['  ▄▄▄▄▄▄   ', '  ▌.    .▐  ', '     ▀~▀     '],
    },
  },

  // Alan Turing — 1940s side-parted hair, clear analytic eyes
  alan_turing: {
    portrait: [
      '  ▄▓▄▄▄▄▄  ',
      '  ▌●    ●▐  ',
      '    ▀▄▄▀     ',
    ],
    compactFace: '●01●',
    eyeChars: ['●'],
    emotions: {
      happy:   ['  ▄▓▄▄▄▄▄  ', '  ▌●    ●▐  ', '    ▀‿‿▀     '],
      worried: ['  ▄▓▄▄▄▄▄  ', '  ▌·    ·▐  ', '    ▀~~▀     '],
    },
  },

  // Benoit Mandelbrot — fractal hair alternating, big round glasses
  benoit_mandelbrot: {
    portrait: [
      ' ░▓░▓░▓░▓░ ',
      ' ┌○┐    ┌○┐',
      '   ▀▄▄▄▄▀   ',
    ],
    compactFace: '░○○░',
    eyeChars: ['○'],
    emotions: {
      happy:   [' ░▓░▓░▓░▓░ ', ' ┌○┐    ┌○┐', '   ▀▄‿‿▄▀   '],
      worried: [' ░▓░▓░▓░▓░ ', ' ┌·┐    ┌·┐', '   ▀▄~~▄▀   '],
    },
  },

  // Claude Shannon — 1950s neat, sharp focus
  claude_shannon: {
    portrait: [
      '  ▄▓▓▓▓▓▄  ',
      '  ▌●    ●▐  ',
      '    ▀▄▄▀     ',
    ],
    compactFace: '●10●',
    eyeChars: ['●'],
    emotions: {
      happy:   ['  ▄▓▓▓▓▓▄  ', '  ▌●    ●▐  ', '    ▀‿‿▀     '],
      worried: ['  ▄▓▓▓▓▓▄  ', '  ▌·    ·▐  ', '    ▀~~▀     '],
    },
  },

  // ═══════════════════════════════════════════════════════════
  // RARE (18) — Moderate detail, 2 emotions (neutral + worried)
  // ═══════════════════════════════════════════════════════════

  // John Paulson — conservative hedge fund hair
  john_paulson: {
    portrait: [
      '  ▄▓▓▓▓▄   ',
      '  ▌●    ●▐  ',
      '    ▀▄▄▀     ',
    ],
    compactFace: '●$●',
    eyeChars: ['●'],
    emotions: {
      worried: ['  ▄▓▓▓▓▄   ', '  ▌·    ·▐  ', '    ▀~~▀     '],
    },
  },

  // Sir John Templeton — elder bow tie
  john_templeton: {
    portrait: [
      '   ░▄▄▄░    ',
      '  ▌○    ○▐  ',
      '    ▀╳╳▀     ',
    ],
    compactFace: '○╳○',
    eyeChars: ['○'],
    emotions: {
      worried: ['   ░▄▄▄░    ', '  ▌·    ·▐  ', '    ▀~~▀     '],
    },
  },

  // Richard Dennis — 70-80s hair, wide face
  richard_dennis: {
    portrait: [
      '  ▄▓▓▓▓▄   ',
      '  ▌●    ●▐  ',
      '   ▀▄▬▄▀    ',
    ],
    compactFace: '●▬●',
    eyeChars: ['●'],
    emotions: {
      worried: ['  ▄▓▓▓▓▄   ', '  ▌·    ·▐  ', '   ▀▄~▄▀    '],
    },
  },

  // Fan Li — simple headcloth, flowing robe collar
  fan_li: {
    portrait: [
      ' ─▄▄▄▄▄─   ',
      '  ▌·    ·▐  ',
      '   ╲▄▄▄╱    ',
    ],
    compactFace: '─··─',
    eyeChars: ['·'],
    emotions: {
      worried: [' ─▄▄▄▄▄─   ', '  ▌.    .▐  ', '   ╲~~~╱    '],
    },
  },

  // Lv Buwei — official crown, shrewd
  lv_buwei: {
    portrait: [
      ' ▄█▀▀▀▀█▄  ',
      '  ▌●    ●▐  ',
      '    ▀▄▄▀     ',
    ],
    compactFace: '█●●█',
    eyeChars: ['●'],
    emotions: {
      worried: [' ▄█▀▀▀▀█▄  ', '  ▌·    ·▐  ', '    ▀~~▀     '],
    },
  },

  // Seneca — Roman bald, stoic eyes, short beard
  seneca: {
    portrait: [
      '   ░▄▄▄░    ',
      '  ▌◉    ◉▐  ',
      '    ▀▓▓▓▀    ',
    ],
    compactFace: '◉▓◉',
    eyeChars: ['◉'],
    emotions: {
      worried: ['   ░▄▄▄░    ', '  ▌·    ·▐  ', '    ▀▓~▓▀    '],
    },
  },

  // Laozi — zen half-closed eyes, long flowing beard
  laozi: {
    portrait: [
      '   ░▄▄▄░    ',
      '  ▌─    ─▐  ',
      '  ░▓▓▓▓░    ',
    ],
    compactFace: '─▓▓─',
    eyeChars: ['─'],
    emotions: {
      worried: ['   ░▄▄▄░    ', '  ▌·    ·▐  ', '  ░▓~~▓░    '],
    },
  },

  // Jeff Bezos — bald, strong jaw
  jeff_bezos: {
    portrait: [
      '   ░░░░░    ',
      '  ▌●    ●▐  ',
      '  ▀▄▬▬▄▀   ',
    ],
    compactFace: '░●●░',
    eyeChars: ['●'],
    emotions: {
      worried: ['   ░░░░░    ', '  ▌·    ·▐  ', '  ▀▄~~▄▀   '],
    },
  },

  // Steve Jobs — round glasses, black turtleneck
  steve_jobs: {
    portrait: [
      '   ▄▄▄▄▄    ',
      ' (○)    (○) ',
      '  ▀████▀    ',
    ],
    compactFace: '(○○)',
    eyeChars: ['○'],
    emotions: {
      worried: ['   ▄▄▄▄▄    ', ' (·)    (·) ', '  ▀█~~█▀    '],
    },
  },

  // Richard Feynman — curly hair alternating, playful wide grin
  richard_feynman: {
    portrait: [
      '  ░▓░▓░▓░   ',
      '  ▌●    ●▐  ',
      '    ▀▬▬▀     ',
    ],
    compactFace: '●▬▬●',
    eyeChars: ['●'],
    emotions: {
      worried: ['  ░▓░▓░▓░   ', '  ▌·    ·▐  ', '    ▀~~▀     '],
    },
  },

  // Hu Xueyan — red-top official hat, merchant
  hu_xueyan: {
    portrait: [
      ' ▄●▀▀▀●▄   ',
      '  ▌·    ·▐  ',
      '    ▀▄▄▀     ',
    ],
    compactFace: '●··●',
    eyeChars: ['·'],
    emotions: {
      worried: [' ▄●▀▀▀●▄   ', '  ▌.    .▐  ', '    ▀~~▀     '],
    },
  },

  // Zeng Guofan — military cap, stern
  zeng_guofan: {
    portrait: [
      ' ▄██▀▀██▄  ',
      '  ▌●    ●▐  ',
      '    ▀▄▄▀     ',
    ],
    compactFace: '██●●',
    eyeChars: ['●'],
    emotions: {
      worried: [' ▄██▀▀██▄  ', '  ▌·    ·▐  ', '    ▀~~▀     '],
    },
  },

  // Bai Gui — simple cloth cap, scholar beard
  bai_gui: {
    portrait: [
      '  ─▄▄▄▄─    ',
      '  ▌·    ·▐  ',
      '    ▀──▀     ',
    ],
    compactFace: '·──·',
    eyeChars: ['·'],
    emotions: {
      worried: ['  ─▄▄▄▄─    ', '  ▌.    .▐  ', '    ▀~~▀     '],
    },
  },

  // CZ Zhao — modern short hair, confident
  cz_zhao: {
    portrait: [
      '   ▄▄▄▄▄    ',
      '  ▌●    ●▐  ',
      '    ▀▄▄▀     ',
    ],
    compactFace: '●₿●',
    eyeChars: ['●'],
    emotions: {
      worried: ['   ▄▄▄▄▄    ', '  ▌·    ·▐  ', '    ▀~~▀     '],
    },
  },

  // He Yi — female long hair, bright eyes
  he_yi: {
    portrait: [
      ' ▄▓▓▓▓▓▓▄  ',
      '  ▌✦    ✦▐  ',
      '    ▀▄▄▀     ',
    ],
    compactFace: '▓✦✦▓',
    eyeChars: ['✦'],
    emotions: {
      worried: [' ▄▓▓▓▓▓▓▄  ', '  ▌·    ·▐  ', '    ▀~~▀     '],
    },
  },

  // Isaac Newton — big curly wig
  isaac_newton: {
    portrait: [
      '░▓▓▓▓▓▓▓░  ',
      '▓▌◉    ◉▐▓  ',
      '   ▀▄▄▄▀    ',
    ],
    compactFace: '▓◉◉▓',
    eyeChars: ['◉'],
    emotions: {
      worried: ['░▓▓▓▓▓▓▓░  ', '▓▌·    ·▐▓  ', '   ▀▄~▄▀    '],
    },
  },

  // Albert Einstein — wild side hair (gap in middle), mustache
  albert_einstein: {
    portrait: [
      '░▓░    ░▓░  ',
      '  ▌●    ●▐  ',
      '   ▀▓▓▓▓▀   ',
    ],
    compactFace: '░●●░',
    eyeChars: ['●'],
    emotions: {
      worried: ['░▓░    ░▓░  ', '  ▌·    ·▐  ', '   ▀▓~~▓▀   '],
    },
  },

  // Carl Gauss — 19th century academic cap, sideburns
  carl_gauss: {
    portrait: [
      ' ▄▀▀▀▀▀▄   ',
      ' ▓▌●    ●▐▓',
      '    ▀▄▄▀     ',
    ],
    compactFace: '▓●●▓',
    eyeChars: ['●'],
    emotions: {
      worried: [' ▄▀▀▀▀▀▄   ', ' ▓▌·    ·▐▓', '    ▀~~▀     '],
    },
  },

  // ═══════════════════════════════════════════════════════════
  // UNCOMMON (11) — Simple, 1-2 key features, eyeChars only
  // ═══════════════════════════════════════════════════════════

  // Nicolas Darvas — elegant slicked hair, slender
  nicolas_darvas: {
    portrait: [
      '   ▄▄▄▄▄    ',
      '  ▌●    ●▐  ',
      '     ▀▄▀     ',
    ],
    compactFace: '●□●',
    eyeChars: ['●'],
  },

  // Linda Raschke — female hair, sharp eyes
  linda_raschke: {
    portrait: [
      '  ▄▓▓▓▓▄   ',
      '  ▌✦    ✦▐  ',
      '     ▀▄▀     ',
    ],
    compactFace: '✦▬✦',
    eyeChars: ['✦'],
  },

  // Machiavelli — Renaissance hat, cunning eyes
  machiavelli: {
    portrait: [
      '  ▄▀▀▀▀▄   ',
      '  ▌×    ×▐  ',
      '     ▀▄▀     ',
    ],
    compactFace: '▀××▀',
    eyeChars: ['×'],
  },

  // Arthur Hayes — modern glasses
  arthur_hayes: {
    portrait: [
      '    ▄▄▄▄     ',
      ' ┌●┐  ┌●┐  ',
      '     ▀▄▀     ',
    ],
    compactFace: '┌●●┐',
    eyeChars: ['●'],
  },

  // Victor Sperandeo — sparse veteran hair, mouth
  victor_sperandeo: {
    portrait: [
      '    ▄▄▄▄     ',
      '  ▌●    ●▐  ',
      '    ▀▄▬▀     ',
    ],
    compactFace: '●▬●',
    eyeChars: ['●'],
  },

  // Larry Williams — graying hair, observant eyes
  larry_williams: {
    portrait: [
      '   ░▄▄░     ',
      '  ▌○    ○▐  ',
      '      ▀▀     ',
    ],
    compactFace: '○  ○',
    eyeChars: ['○'],
  },

  // Zong Qinghou — practical neat hair
  zong_qinghou: {
    portrait: [
      '    ▄▄▄▄     ',
      '  ▌●    ●▐  ',
      '     ▀▄▀     ',
    ],
    compactFace: '●步●',
    eyeChars: ['●'],
  },

  // Shen Wansan — Ming dynasty merchant hat
  shen_wansan: {
    portrait: [
      '  ▄▀▀▀▄    ',
      '  ▌·    ·▐  ',
      '     ▀▄▀     ',
    ],
    compactFace: '▀··▀',
    eyeChars: ['·'],
  },

  // Zhang Jian — late Qing modern hair
  zhang_jian: {
    portrait: [
      '    ▄▄▄▄     ',
      '  ▌●    ●▐  ',
      '     ▀▄▀     ',
    ],
    compactFace: '●工●',
    eyeChars: ['●'],
  },

  // Andre Cronje — hoodie, hacker eyes
  andre_cronje: {
    portrait: [
      '  ▄████▄   ',
      '  ▌✦    ✦▐  ',
      '     ▀▄▀     ',
    ],
    compactFace: '█✦✦█',
    eyeChars: ['✦'],
  },

  // Xu Mingxing — business neat hair
  xu_mingxing: {
    portrait: [
      '    ▄▄▄▄     ',
      '  ▌●    ●▐  ',
      '     ▀▄▀     ',
    ],
    compactFace: '●⚡●',
    eyeChars: ['●'],
  },

  // ═══════════════════════════════════════════════════════════
  // COMMON (1) — Minimal, eyeChars only
  // ═══════════════════════════════════════════════════════════

  // William O'Neil — standard business hair, simple
  william_oneil: {
    portrait: [
      '    ▄▄▄▄     ',
      '  (●    ●)  ',
      '      ▀▀     ',
    ],
    compactFace: '●●',
    eyeChars: ['●'],
  },
}
