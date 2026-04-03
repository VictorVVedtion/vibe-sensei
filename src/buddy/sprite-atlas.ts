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
 * - SIGNATURE features (line 3: beard, helmet, bow tie, collar, turtleneck)
 *   are NEVER changed by emotions — express through eyes (line 2) only
 * - MOUTH/JAW (line 3) is the expression carrier ONLY when line 3 has no
 *   signature element
 * - EYES (line 2) may change for stronger emotions
 * - happy: personality-appropriate (cold smirk for predators, warm for mentors,
 *   eyes-only for masked/obscured faces)
 * - worried: tight/wavy mouth or dimmer eyes
 * - stern: hard line mouth + sharp/narrow eyes (━ for most, keeps × ▬ ✦ ⊙)
 *
 * Character palette:
 *   Structure: ( ) / \ _ - ~ ^ | -
 *   Shading:   █ ▓ ░ ▀ ▄ ▌ ▐
 *   Face:      . : ; ' " * # = + < >
 *   Special:   ◉ ● ○ · ✦ × ° ▬ ╱ ╲ ╳ ┤ ├ ╰ ╯ ⊙ ‿ ︶ ━
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
  // Happy: cold smirk ︶ (financial predator, not cute)
  // Stern: eyes narrow to ━
  jesse_livermore: {
    portrait: [
      ' ▄▓▓▓▓▓▓▓▄ ',
      ' ▌◉▬▬▬▬◉▐░ ',
      ' ▀▄▄▄▬▄▄▄▀ ',
    ],
    compactFace: '◉▬▬◉',
    eyeChars: ['◉', '━'],
    emotions: {
      happy:   [' ▄▓▓▓▓▓▓▓▄ ', ' ▌◉▬▬▬▬◉▐░ ', ' ▀▄▄▄︶▄▄▄▀ '],
      worried: [' ▄▓▓▓▓▓▓▓▄ ', ' ▌·▬▬▬▬·▐░ ', ' ▀▄▄▄~▄▄▄▀ '],
      stern:   [' ▄▓▓▓▓▓▓▓▄ ', ' ▌━▬▬▬▬━▐░ ', ' ▀▄▄▄═▄▄▄▀ '],
    },
  },

  // George Soros — heavy brow ridge, angular jaw, deep-set eyes
  // Happy: cold smirk ︶ (financial predator, not cute ▽▽)
  // Stern: eyes narrow to ━
  george_soros: {
    portrait: [
      ' ░▄▄▄▄▄▄▄░ ',
      ' ▓▌◉    ◉▐▓',
      '  ▀▄▬▬▬▄▀  ',
    ],
    compactFace: '▓◉◉▓',
    eyeChars: ['◉', '━'],
    emotions: {
      happy:   [' ░▄▄▄▄▄▄▄░ ', ' ▓▌◉    ◉▐▓', '  ▀▄ ︶︶ ▄▀  '],
      worried: [' ░▄▄▄▄▄▄▄░ ', ' ▓▌·    ·▐▓', '  ▀▄~~~▄▀  '],
      stern:   [' ░▄▄▄▄▄▄▄░ ', ' ▓▌━    ━▐▓', '  ▀▄═══▄▀  '],
    },
  },

  // Warren Buffett — round face, round glasses, warm smile
  // Happy: warm ▽▽ (kindly mentor)
  // Stern: keeps ⊙ eyes (serious but warm), mouth ▬▬
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
  // Happy: warm ‿‿ (kindly mentor)
  // Stern: eyes narrow to ━
  benjamin_graham: {
    portrait: [
      '  ▄▄▄▄▄▄▄  ',
      ' ┌○┐    ┌○┐',
      '  ▀▄────▄▀  ',
    ],
    compactFace: '┌○○┐',
    eyeChars: ['○', '━'],
    emotions: {
      happy:   ['  ▄▄▄▄▄▄▄  ', ' ┌○┐    ┌○┐', '  ▀▄ ‿‿ ▄▀  '],
      worried: ['  ▄▄▄▄▄▄▄  ', ' ┌·┐    ┌·┐', '  ▀▄~~~~▄▀  '],
      stern:   ['  ▄▄▄▄▄▄▄  ', ' ┌━┐    ┌━┐', '  ▀▄════▄▀  '],
    },
  },

  // Jim Simons — big beard, glasses, bald mathematician
  // ANCHOR: line 3 is beard ▓▓▓▓▓▓▓▓▓ — NEVER change it
  // Happy: eyes brighten ^ (pure eye expression)
  // Stern: eyes sharpen ━
  jim_simons: {
    portrait: [
      ' ░▄▓▓▓▓▄░  ',
      ' ▌○      ○▐',
      ' ▓▓▓▓▓▓▓▓▓ ',
    ],
    compactFace: '○▓▓○',
    eyeChars: ['○', '^', '━'],
    emotions: {
      happy:   [' ░▄▓▓▓▓▄░  ', ' ▌^      ^▐', ' ▓▓▓▓▓▓▓▓▓ '],
      worried: [' ░▄▓▓▓▓▄░  ', ' ▌·      ·▐', ' ▓▓▓▓▓▓▓▓▓ '],
      stern:   [' ░▄▓▓▓▓▄░  ', ' ▌━      ━▐', ' ▓▓▓▓▓▓▓▓▓ '],
    },
  },

  // Sun Tzu — warrior helmet, visor slit, full armor
  // ANCHOR: line 3 is helmet visor ▀█▄▄▄▄▄▄█▀ — NEVER change it
  // Happy: eyes brighten ✦ (through visor slit)
  // Stern: eyes stay ▬ (already maximally stern)
  sun_tzu: {
    portrait: [
      '▄█▀▀▀▀▀▀█▄ ',
      '█▌▬░░░░▬▐█ ',
      '▀█▄▄▄▄▄▄█▀ ',
    ],
    compactFace: '█▬▬█',
    eyeChars: ['▬', '✦'],
    emotions: {
      happy:   ['▄█▀▀▀▀▀▀█▄ ', '█▌✦░░░░✦▐█ ', '▀█▄▄▄▄▄▄█▀ '],
      worried: ['▄█▀▀▀▀▀▀█▄ ', '█▌·░░░░·▐█ ', '▀█▄▄▄▄▄▄█▀ '],
      stern:   ['▄█▀▀▀▀▀▀█▄ ', '█▌▬░░░░▬▐█ ', '▀█▄▄▄▄▄▄█▀ '],
    },
  },

  // Satoshi Nakamoto — deep hood, full face shadow, only eye glints
  // Happy: eyes brighten ✦✦ (pure eye expression through shadow)
  // Worried: >< (protocol error, distinguishable from neutral ··)
  // Stern: ×× (already correct)
  satoshi_nakamoto: {
    portrait: [
      ' ▄▓███████▄',
      ' █▓░ ··  ░▓█',
      ' ▀▓██████▓▀',
    ],
    compactFace: '▓··▓',
    eyeChars: ['·', '✦', '×'],
    emotions: {
      happy:   [' ▄▓███████▄', ' █▓░ ✦✦  ░▓█', ' ▀▓██████▓▀'],
      worried: [' ▄▓███████▄', ' █▓░ ><  ░▓█', ' ▀▓██████▓▀'],
      stern:   [' ▄▓███████▄', ' █▓░ ××  ░▓█', ' ▀▓██████▓▀'],
    },
  },

  // John von Neumann — high forehead, neat hair, bow tie
  // ANCHOR: line 3 is bow tie ▀▄╳╳╳▄▀ — NEVER change it
  // Happy: eyes brighten ^ (pure eye expression)
  // Stern: eyes sharpen ━
  john_von_neumann: {
    portrait: [
      '  ▄▄▄▄▄▄▄  ',
      '  ▌◉    ◉▐  ',
      '  ▀▄╳╳╳▄▀  ',
    ],
    compactFace: '◉╳◉',
    eyeChars: ['◉', '^', '━'],
    emotions: {
      happy:   ['  ▄▄▄▄▄▄▄  ', '  ▌^    ^▐  ', '  ▀▄╳╳╳▄▀  '],
      worried: ['  ▄▄▄▄▄▄▄  ', '  ▌·    ·▐  ', '  ▀▄╳╳╳▄▀  '],
      stern:   ['  ▄▄▄▄▄▄▄  ', '  ▌━    ━▐  ', '  ▀▄╳╳╳▄▀  '],
    },
  },

  // ═══════════════════════════════════════════════════════════
  // EPIC (18) — Good detail, personality-specific features, 3 emotions
  // ═══════════════════════════════════════════════════════════

  // Paul Tudor Jones — thick hair, athletic jaw
  // Happy: cold smirk ︶ (financial predator)
  // Stern: eyes narrow ━
  paul_tudor_jones: {
    portrait: [
      '  ▄▓▓▓▓▓▓▄ ',
      '  ▌●    ●▐  ',
      '   ▀▄══▄▀   ',
    ],
    compactFace: '●══●',
    eyeChars: ['●', '━'],
    emotions: {
      happy:   ['  ▄▓▓▓▓▓▓▄ ', '  ▌●    ●▐  ', '   ▀▄︶︶▄▀   '],
      worried: ['  ▄▓▓▓▓▓▓▄ ', '  ▌·    ·▐  ', '   ▀▄~~▄▀   '],
      stern:   ['  ▄▓▓▓▓▓▓▄ ', '  ▌━    ━▐  ', '   ▀▄══▄▀   '],
    },
  },

  // Stanley Druckenmiller — tall head, serious focus
  // Happy: cold smirk ︶ (financial predator)
  // Stern: eyes narrow ━
  stanley_druckenmiller: {
    portrait: [
      '  ▄▓▓▓▓▓▄  ',
      '  ▌◉    ◉▐  ',
      '   ▀▄▄▄▀    ',
    ],
    compactFace: '◉▄◉',
    eyeChars: ['◉', '━'],
    emotions: {
      happy:   ['  ▄▓▓▓▓▓▄  ', '  ▌◉    ◉▐  ', '   ▀▄︶▄▀    '],
      worried: ['  ▄▓▓▓▓▓▄  ', '  ▌·    ·▐  ', '   ▀▄~▄▀    '],
      stern:   ['  ▄▓▓▓▓▓▄  ', '  ▌━    ━▐  ', '   ▀▄▄▄▀    '],
    },
  },

  // Michael Burry — messy hair, asymmetric eyes (● real / ○ glass)
  // Stern: eyes narrow ━
  michael_burry: {
    portrait: [
      ' ░▓▄▓░▓▄░  ',
      '  ▌●    ○▐  ',
      '   ▀▄──▄▀   ',
    ],
    compactFace: '●··○',
    eyeChars: ['●', '○', '━'],
    emotions: {
      happy:   [' ░▓▄▓░▓▄░  ', '  ▌●    ○▐  ', '   ▀▄‿‿▄▀   '],
      worried: [' ░▓▄▓░▓▄░  ', '  ▌·    ·▐  ', '   ▀▄~~▄▀   '],
      stern:   [' ░▓▄▓░▓▄░  ', '  ▌━    ━▐  ', '   ▀▄══▄▀   '],
    },
  },

  // Charlie Munger — ultra-thick glasses [◉], jowls
  // Stern: eyes narrow ━
  charlie_munger: {
    portrait: [
      '   ░░▄▄░░   ',
      ' [◉]    [◉] ',
      '  ▀▀▬▬▀▀    ',
    ],
    compactFace: '[◉◉]',
    eyeChars: ['◉', '━'],
    emotions: {
      happy:   ['   ░░▄▄░░   ', ' [◉]    [◉] ', '  ▀▀▽▽▀▀    '],
      worried: ['   ░░▄▄░░   ', ' [·]    [·] ', '  ▀▀~~▀▀    '],
      stern:   ['   ░░▄▄░░   ', ' [━]    [━] ', '  ▀▀══▀▀    '],
    },
  },

  // Ray Dalio — meditation half-closed eyes, zen
  // Happy: calm — eyes open slightly brighter ○, mouth stays same (meditative type)
  // Stern: eyes narrow ━
  ray_dalio: {
    portrait: [
      '   ░▄▄▄▄░   ',
      '  ▌─    ─▐  ',
      '    ▀▄▄▀     ',
    ],
    compactFace: '─∿─',
    eyeChars: ['─', '○', '━'],
    emotions: {
      happy:   ['   ░▄▄▄▄░   ', '  ▌○    ○▐  ', '    ▀▄▄▀     '],
      worried: ['   ░▄▄▄▄░   ', '  ▌·    ·▐  ', '    ▀~~▀     '],
      stern:   ['   ░▄▄▄▄░   ', '  ▌━    ━▐  ', '    ▀▄▄▀     '],
    },
  },

  // Ed Thorp — academic neat, precise thin lips
  // Happy: calm — eyes stay same, mouth barely changes (quantitative type)
  // Stern: eyes narrow ━
  ed_thorp: {
    portrait: [
      '   ▄▄▄▄▄    ',
      '  ▌○    ○▐  ',
      '    ▀──▀     ',
    ],
    compactFace: '○♠○',
    eyeChars: ['○', '━'],
    emotions: {
      happy:   ['   ▄▄▄▄▄    ', '  ▌○    ○▐  ', '    ▀‿‿▀     '],
      worried: ['   ▄▄▄▄▄    ', '  ▌·    ·▐  ', '    ▀~~▀     '],
      stern:   ['   ▄▄▄▄▄    ', '  ▌━    ━▐  ', '    ▀══▀     '],
    },
  },

  // Munehisa Homma — tall eboshi hat, merchant
  // ANCHOR: line 3 is traditional collar ╲▄▄╱ — NEVER change it
  // Happy: eyes brighten ^ (pure eye expression)
  // Stern: eyes narrow ━
  munehisa_homma: {
    portrait: [
      ' ▄██▀▀▀██▄ ',
      '  ▌●    ●▐  ',
      '   ╲▄▄╱     ',
    ],
    compactFace: '██●●',
    eyeChars: ['●', '^', '━'],
    emotions: {
      happy:   [' ▄██▀▀▀██▄ ', '  ▌^    ^▐  ', '   ╲▄▄╱     '],
      worried: [' ▄██▀▀▀██▄ ', '  ▌·    ·▐  ', '   ╲▄▄╱     '],
      stern:   [' ▄██▀▀▀██▄ ', '  ▌━    ━▐  ', '   ╲▄▄╱     '],
    },
  },

  // Miyamoto Musashi — topknot, fierce × eyes, crossed swords
  // ANCHOR: line 3 has crossed swords ╱▀▄▬▬▄▀╲ — preserve structure
  // Happy: fierce grin ▽ + bright warrior eyes ✦ (warrior's triumph)
  // Stern: keeps × eyes (already maximally fierce)
  miyamoto_musashi: {
    portrait: [
      '    ┃▓▓┃    ',
      '  ▌×    ×▐  ',
      ' ╱▀▄▬▬▄▀╲  ',
    ],
    compactFace: '┃××┃',
    eyeChars: ['×', '✦'],
    emotions: {
      happy:   ['    ┃▓▓┃    ', '  ▌✦    ✦▐  ', ' ╱▀▄▽▽▄▀╲  '],
      worried: ['    ┃▓▓┃    ', '  ▌·    ·▐  ', ' ╱▀▄~~▄▀╲  '],
      stern:   ['    ┃▓▓┃    ', '  ▌×    ×▐  ', ' ╱▀▄══▄▀╲  '],
    },
  },

  // Nassim Taleb — short hair, wide face, thick neck, weightlifter
  // ANCHOR: line 3 has thick neck ▓ markers — preserve ▓ structure
  // Happy: fierce grin ▽▽ + keep fierce ● eyes (warrior's triumph)
  // Stern: eyes narrow ━
  nassim_taleb: {
    portrait: [
      '  ▄▓▓▓▓▄   ',
      ' ▓▌●    ●▐▓',
      ' ▓▀▄▬▬▄▀▓  ',
    ],
    compactFace: '▓●●▓',
    eyeChars: ['●', '━'],
    emotions: {
      happy:   ['  ▄▓▓▓▓▄   ', ' ▓▌●    ●▐▓', ' ▓▀▄▽▽▄▀▓  '],
      worried: ['  ▄▓▓▓▓▄   ', ' ▓▌·    ·▐▓', ' ▓▀▄~~▄▀▓  '],
      stern:   ['  ▄▓▓▓▓▄   ', ' ▓▌━    ━▐▓', ' ▓▀▄══▄▀▓  '],
    },
  },

  // Elon Musk — modern hair, star eyes, angular jaw
  // Happy: ▽▽ (active/energetic type)
  // Stern: keeps ✦ eyes (star eyes are his signature)
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
      stern:   ['  ▄▄▄▄▄▄   ', '  ▌✦    ✦▐  ', '  ╲▀══▀╱   '],
    },
  },

  // Peter Thiel — neat short hair, laser-focus
  // Stern: eyes narrow ━
  peter_thiel: {
    portrait: [
      '   ▄▄▄▄▄    ',
      '  ▌◉    ◉▐  ',
      '    ▀▄▄▀     ',
    ],
    compactFace: '◉→◉',
    eyeChars: ['◉', '━'],
    emotions: {
      happy:   ['   ▄▄▄▄▄    ', '  ▌◉    ◉▐  ', '    ▀‿‿▀     '],
      worried: ['   ▄▄▄▄▄    ', '  ▌·    ·▐  ', '    ▀~~▀     '],
      stern:   ['   ▄▄▄▄▄    ', '  ▌━    ━▐  ', '    ▀══▀     '],
    },
  },

  // Garry Tan — modern hair, modern glasses
  // Stern: eyes narrow ━
  garry_tan: {
    portrait: [
      '   ▄▓▓▓▄    ',
      ' ┌●┐  ┌●┐  ',
      '    ▀▄▄▀     ',
    ],
    compactFace: '┌●●┐',
    eyeChars: ['●', '━'],
    emotions: {
      happy:   ['   ▄▓▓▓▄    ', ' ┌●┐  ┌●┐  ', '    ▀‿‿▀     '],
      worried: ['   ▄▓▓▓▄    ', ' ┌·┐  ┌·┐  ', '    ▀~~▀     '],
      stern:   ['   ▄▓▓▓▄    ', ' ┌━┐  ┌━┐  ', '    ▀══▀     '],
    },
  },

  // Andrej Karpathy — tech look, analytic eyes, neural texture
  // Happy: ‿‿ (active/energetic type)
  // Stern: eyes narrow ━
  andrej_karpathy: {
    portrait: [
      '   ▄▄▄▄▄    ',
      '  ▌○    ○▐  ',
      '  ░▀▄▄▀░    ',
    ],
    compactFace: '○≡○',
    eyeChars: ['○', '━'],
    emotions: {
      happy:   ['   ▄▄▄▄▄    ', '  ▌○    ○▐  ', '  ░▀‿‿▀░    '],
      worried: ['   ▄▄▄▄▄    ', '  ▌·    ·▐  ', '  ░▀~~▀░    '],
      stern:   ['   ▄▄▄▄▄    ', '  ▌━    ━▐  ', '  ░▀══▀░    '],
    },
  },

  // Li Ka-shing — elder, business glasses
  // Stern: eyes narrow ━
  li_ka_shing: {
    portrait: [
      '   ░░▄▄░░   ',
      ' ┌◉┐  ┌◉┐  ',
      '    ▀▬▬▀     ',
    ],
    compactFace: '◉▬◉',
    eyeChars: ['◉', '━'],
    emotions: {
      happy:   ['   ░░▄▄░░   ', ' ┌◉┐  ┌◉┐  ', '    ▀‿‿▀     '],
      worried: ['   ░░▄▄░░   ', ' ┌·┐  ┌·┐  ', '    ▀~~▀     '],
      stern:   ['   ░░▄▄░░   ', ' ┌━┐  ┌━┐  ', '    ▀══▀     '],
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
    eyeChars: ['·', '✦'],
    emotions: {
      happy:   ['  ▄▄▄▄▄▄   ', '  ▌✦    ✦▐  ', '     ▀‿▀     '],
      worried: ['  ▄▄▄▄▄▄   ', '  ▌.    .▐  ', '     ▀~▀     '],
    },
  },

  // Alan Turing — 1940s side-parted hair, clear analytic eyes
  // Stern: eyes narrow ━
  alan_turing: {
    portrait: [
      '  ▄▓▄▄▄▄▄  ',
      '  ▌●    ●▐  ',
      '    ▀▄▄▀     ',
    ],
    compactFace: '●01●',
    eyeChars: ['●', '━'],
    emotions: {
      happy:   ['  ▄▓▄▄▄▄▄  ', '  ▌●    ●▐  ', '    ▀‿‿▀     '],
      worried: ['  ▄▓▄▄▄▄▄  ', '  ▌·    ·▐  ', '    ▀~~▀     '],
      stern:   ['  ▄▓▄▄▄▄▄  ', '  ▌━    ━▐  ', '    ▀══▀     '],
    },
  },

  // Benoit Mandelbrot — fractal hair alternating, big round glasses
  // Stern: eyes narrow ━
  benoit_mandelbrot: {
    portrait: [
      ' ░▓░▓░▓░▓░ ',
      ' ┌○┐    ┌○┐',
      '   ▀▄▄▄▄▀   ',
    ],
    compactFace: '░○○░',
    eyeChars: ['○', '━'],
    emotions: {
      happy:   [' ░▓░▓░▓░▓░ ', ' ┌○┐    ┌○┐', '   ▀▄‿‿▄▀   '],
      worried: [' ░▓░▓░▓░▓░ ', ' ┌·┐    ┌·┐', '   ▀▄~~▄▀   '],
      stern:   [' ░▓░▓░▓░▓░ ', ' ┌━┐    ┌━┐', '   ▀▄══▄▀   '],
    },
  },

  // Claude Shannon — 1950s neat, sharp focus
  // Happy: calm — eyes stay same, slight smile (quantitative type)
  // Stern: eyes narrow ━
  claude_shannon: {
    portrait: [
      '  ▄▓▓▓▓▓▄  ',
      '  ▌●    ●▐  ',
      '    ▀▄▄▀     ',
    ],
    compactFace: '●10●',
    eyeChars: ['●', '━'],
    emotions: {
      happy:   ['  ▄▓▓▓▓▓▄  ', '  ▌●    ●▐  ', '    ▀‿‿▀     '],
      worried: ['  ▄▓▓▓▓▓▄  ', '  ▌·    ·▐  ', '    ▀~~▀     '],
      stern:   ['  ▄▓▓▓▓▓▄  ', '  ▌━    ━▐  ', '    ▀══▀     '],
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
  // ANCHOR: line 3 is turtleneck ▀████▀ — NEVER change it
  // Worried: eyes only (dim to ·)
  steve_jobs: {
    portrait: [
      '   ▄▄▄▄▄    ',
      ' (○)    (○) ',
      '  ▀████▀    ',
    ],
    compactFace: '(○○)',
    eyeChars: ['○'],
    emotions: {
      worried: ['   ▄▄▄▄▄    ', ' (·)    (·) ', '  ▀████▀    '],
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
