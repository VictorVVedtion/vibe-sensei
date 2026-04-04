/**
 * idle-quotes.ts — Per-archetype idle murmurs for the persistent Guardian.
 *
 * When the Guardian has no active reaction, the speech bubble cycles through
 * these character-appropriate idle quotes (dim, low visual weight).
 * Each archetype gets 6 quotes that reflect its trading philosophy.
 */

import type { Archetype } from './persona.js'

/** Idle quotes indexed by archetype. Rotated every ~30s. */
export const IDLE_QUOTES: Record<Archetype, string[]> = {
  value_investor: [
    'Patience. The right price comes to those who wait.',
    'Margin of safety... always margin of safety.',
    'Mr. Market is emotional. We are not.',
    'Price is what you pay. Value is what you get.',
    'The best opportunities look ugly at first.',
    'Watching. Waiting. Ready to act when fear peaks.',
  ],
  trend_follower: [
    'Scanning for momentum...',
    'The trend is your only friend. Respect it.',
    'Cut losers fast. Let winners breathe.',
    'No signal yet. Sitting on hands is a position.',
    'Price leads. Everything else follows.',
    'Waiting for a clean break. No chasing.',
  ],
  macro_trader: [
    'Reading the regime... volatility shifting.',
    'Position sizing is the whole game.',
    'Macro picture first. Micro second.',
    'Reflexivity at work. Watch the feedback loop.',
    'The big move starts before consensus notices.',
    'Risk on or risk off? The data will tell.',
  ],
  quant: [
    'Running probability models...',
    'Edge detected. Confirming statistical significance.',
    'Never override the model. Never.',
    'Signal-to-noise ratio: monitoring.',
    'The system knows. Trust the backtest.',
    'Variance is expected. Ruin is not.',
  ],
  strategist: [
    'Positioning. Timing. Know the terrain.',
    'Studying the battlefield before engaging.',
    'The best trade is the one nobody sees coming.',
    'Every position has a purpose. Or it shouldn\'t exist.',
    'Observing the order flow...',
    'Strategy without execution is philosophy.',
  ],
  philosopher: [
    'Survive first. Everything else follows.',
    'The market teaches humility to all.',
    'Detachment is not apathy. It is clarity.',
    'What does not kill the portfolio makes it antifragile.',
    'Observe without reacting. React without emotion.',
    'The Tao of trading: wu wei, then decisive action.',
  ],
  first_principles: [
    'Reasoning from fundamentals...',
    'Ignore consensus. What do the base facts say?',
    'Conviction requires homework, not hope.',
    'Building a thesis from first principles.',
    'The crowd is noisy. The data is quiet.',
    'Simple models, deeply understood.',
  ],
  crypto_native: [
    'Watching the chain. On-chain tells the truth.',
    'Build in bear markets. Sell in euphoria.',
    'Narratives cycle. Fundamentals compound.',
    'Trustless systems, trustworthy data.',
    'The future is decentralized. The present is volatile.',
    'WAGMI... but only with risk management.',
  ],
  scientist: [
    'Quantifying uncertainty...',
    'Data over narrative. Always.',
    'Model the system. Measure the deviation.',
    'Hypothesis: forming. Evidence: accumulating.',
    'Correlation is not causation. Remember that.',
    'The experiment continues. Sample size growing.',
  ],
}

/** Fallback quotes for companions without a known archetype (e.g. Vane) */
const FALLBACK_QUOTES = [
  'Watching the flow...',
  'Markets speak. Are you listening?',
  'Patience is a position.',
  'The next move reveals itself to those who wait.',
  'Stay sharp. Stay humble.',
  'Observing the orderbook...',
]

/**
 * Pick an idle quote for a given archetype, cycling based on a tick counter.
 * The rotation period (~60 ticks at 500ms = ~30s) gives a breathing feel.
 * Falls back gracefully for unknown archetypes.
 */
export function getIdleQuote(archetype: Archetype | undefined, tick: number): string {
  const quotes = (archetype && IDLE_QUOTES[archetype]) || FALLBACK_QUOTES
  const idx = Math.floor(tick / 60) % quotes.length
  return quotes[idx]
}
