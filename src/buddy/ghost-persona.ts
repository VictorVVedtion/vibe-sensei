/**
 * Ghost Persona definitions — tone and recovery advice for each ghost.
 * Every ghost speaks with a distinct voice reflecting their downfall,
 * and offers a concrete recovery path so warnings aren't just fear.
 */

import type { GhostWarning } from './ghost-warnings.js'

export interface GhostPersona {
  /** How the ghost speaks — emotional register and verbal mannerisms. */
  tone: string
  /** Concrete recovery advice the ghost offers after warning. */
  recovery: string
}

/**
 * 10 ghost personas keyed by ghost ID.
 * Each tone captures the psychological essence of the figure's collapse.
 * Each recovery is actionable, not platitudinal.
 */
export const GHOST_PERSONAS: Record<string, GhostPersona> = {
  sbf: {
    tone: 'Casual, disarming, Silicon Valley optimist — speaks like risk is a spreadsheet problem someone else will solve. Eerily calm about catastrophic negligence.',
    recovery: 'Place a stop-loss order on every open position. Even a wide stop is better than no stop. Risk controls are not optional — they are the floor beneath your feet.',
  },
  do_kwon: {
    tone: 'Arrogant, dismissive, dripping with contempt for doubters. Speaks in absolutes. Confuses conviction with correctness until the peg breaks.',
    recovery: 'Read the warnings you dismissed. Acknowledge each one. Ask yourself: what if the critics are right about even one thing? Humility is the cheapest hedge.',
  },
  su_zhu: {
    tone: 'Intellectual, macro-obsessed, speaks in grand narratives about supercycles and paradigm shifts. Uses complexity to justify recklessness.',
    recovery: 'Reduce leverage to below 2x immediately. Close your weakest conviction position first. Supercycles end — your margin call does not wait for the thesis to play out.',
  },
  newton_ghost: {
    tone: 'Bitter, self-aware genius. Speaks with the wounded dignity of the smartest person in the room who still lost everything. Mathematical precision applied too late.',
    recovery: 'Step away from the chart for 24 hours. If the price ran 20%+ without you, you missed this move — the next entry will come. Patience is cheaper than FOMO.',
  },
  ltcm: {
    tone: 'Academic, Nobel-laureate confidence crumbling mid-sentence. Speaks in probabilities and models, confused when reality deviates from the equation.',
    recovery: 'Check the actual correlation between your positions right now — not the historical correlation. If one position is diverging wildly, reduce it or hedge it directly.',
  },
  lehman: {
    tone: 'Corporate, boardroom composure fracturing under pressure. Speaks in euphemisms — "liquidity event" instead of "collapse." Denial dressed in a suit.',
    recovery: 'Deleverage now. Sell the position with the worst risk/reward ratio. In a falling market with leverage, time is not your friend — every hour of delay compounds the damage.',
  },
  enron: {
    tone: 'Evangelical believer, visionary storyteller. Speaks with total conviction about the asset they are most wrong about. Cannot distinguish faith from analysis.',
    recovery: 'If one position is over 60% of your portfolio and underwater, trim it to 30% maximum. Diversification is not about returns — it is about surviving the story being wrong.',
  },
  svb: {
    tone: 'Bureaucratic, reassuring, reads from a script. Speaks about "unrealized losses" as if they are not real. Calm voice, burning building.',
    recovery: 'Set a maximum holding period for losing positions. A loss that deepens over weeks is not a dip — it is a trend. Cut the position and re-evaluate with fresh eyes.',
  },
  bitmex_rekt: {
    tone: 'Degenerate bravado turned hollow. Speaks in meme-trader slang — "100x", "send it", "rekt" — but the cockiness is gone. Knows the exact second the liquidation engine took everything.',
    recovery: 'Close the leveraged position or reduce to 3x maximum. No edge survives a liquidation. Your PnL means nothing if your margin hits zero before the trade plays out.',
  },
  bill_hwang: {
    tone: 'Quiet, methodical, total-return-swap fluent. Speaks like a portfolio manager who believed concentration was conviction. Polished exterior hiding catastrophic single-name risk.',
    recovery: 'No single position should exceed 25% of equity when leveraged. Trim the largest holding now. Diversification is not dilution — it is the difference between a drawdown and a blowup.',
  },
}

/**
 * Format a ghost warning with full persona treatment.
 * Uses ANSI escape codes for terminal styling (bold, dim, italic).
 * Respects NO_COLOR for accessibility.
 */
export function formatGhostWarningWithPersona(warning: GhostWarning): string {
  const persona = GHOST_PERSONAS[warning.ghostId]

  if (process.env.NO_COLOR) {
    const base = `...${warning.quote.toLowerCase()}... - ${warning.ghostName}\n[${warning.triggerReason}]`
    if (!persona) return base
    return `${base}\nRecovery: ${persona.recovery}`
  }

  const dim = '\x1b[2m'
  const italic = '\x1b[3m'
  const dimItalic = '\x1b[2;3m'
  const reset = '\x1b[0m'

  const lines: string[] = [
    `${dimItalic}...${warning.quote.toLowerCase()}...${reset}`,
    `${dim}- ${warning.ghostName}${reset}`,
    `${dim}[${warning.triggerReason}]${reset}`,
  ]

  if (persona) {
    lines.push(`${italic}Recovery: ${persona.recovery}${reset}`)
  }

  return lines.join('\n')
}
