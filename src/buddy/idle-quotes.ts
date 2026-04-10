/**
 * idle-quotes.ts — Per-archetype idle murmurs for the persistent Guardian.
 *
 * When the Guardian has no active reaction, the speech bubble cycles through
 * these character-appropriate idle quotes (dim, low visual weight).
 * Each archetype gets 6 quotes that reflect its trading philosophy.
 *
 * Extended with:
 *   - Regime tags: each quote is tagged with the market regimes it fits best
 *   - Care quotes: shown when the user has been idle for 10+ minutes
 *   - Time quotes: morning / late-night / weekend context
 *   - Context-aware getIdleQuote with priority chain
 */

import type { Archetype } from './persona.js'

// ── Regime type alias (mirrors RegimeType from market/types) ────────
type MarketRegime = 'trending_up' | 'trending_down' | 'ranging' | 'compressing' | 'expanding'

// ── Idle Context ────────────────────────────────────────────────────

export interface IdleContext {
  regime?: string
  isLateNight?: boolean
  isMorning?: boolean
  isWeekend?: boolean
  isIdle10min?: boolean
}

// ── Core Idle Quotes ────────────────────────────────────────────────

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

// ── Regime Tags ─────────────────────────────────────────────────────

/**
 * Each archetype's Nth quote maps to QUOTE_REGIME_TAGS[archetype][N].
 * 'any' means the quote fits all regimes.
 */
export const QUOTE_REGIME_TAGS: Record<Archetype, (MarketRegime | 'any')[][]> = {
  value_investor: [
    ['trending_down', 'ranging'],          // Patience — waiting for dips
    ['any'],                                // Margin of safety — universal
    ['trending_up', 'trending_down'],       // Mr. Market emotional — directional
    ['any'],                                // Price vs value — universal
    ['trending_down', 'compressing'],       // Ugly opportunities — bottoms
    ['trending_down', 'compressing'],       // Fear peaks — capitulation
  ],
  trend_follower: [
    ['trending_up', 'trending_down'],       // Scanning momentum — trends
    ['trending_up', 'trending_down'],       // Trend is your friend — trends
    ['any'],                                // Cut losers — universal
    ['ranging', 'compressing'],             // No signal — choppy/quiet
    ['trending_up', 'trending_down'],       // Price leads — trends
    ['ranging', 'compressing'],             // Waiting for break — consolidation
  ],
  macro_trader: [
    ['expanding', 'compressing'],           // Volatility shifting — regime change
    ['any'],                                // Position sizing — universal
    ['any'],                                // Macro first — universal
    ['trending_up', 'trending_down'],       // Reflexivity — directional
    ['compressing', 'expanding'],           // Big move — pre-breakout
    ['any'],                                // Risk on/off — universal
  ],
  quant: [
    ['any'],                                // Probability models — universal
    ['trending_up', 'trending_down'],       // Edge detected — directional
    ['any'],                                // Never override — universal
    ['any'],                                // Signal-to-noise — universal
    ['any'],                                // Trust the backtest — universal
    ['expanding'],                          // Variance expected — volatile
  ],
  strategist: [
    ['any'],                                // Positioning — universal
    ['ranging', 'compressing'],             // Studying battlefield — waiting
    ['compressing', 'expanding'],           // Nobody sees coming — breakout
    ['any'],                                // Purpose — universal
    ['trending_up', 'trending_down'],       // Order flow — directional
    ['any'],                                // Execution — universal
  ],
  philosopher: [
    ['trending_down', 'expanding'],         // Survive first — dangerous times
    ['any'],                                // Humility — universal
    ['any'],                                // Detachment — universal
    ['trending_down', 'expanding'],         // Antifragile — stress
    ['any'],                                // Observe — universal
    ['ranging', 'compressing'],             // Wu wei — waiting
  ],
  first_principles: [
    ['any'],                                // Fundamentals — universal
    ['trending_up', 'trending_down'],       // Ignore consensus — crowded trades
    ['any'],                                // Homework — universal
    ['any'],                                // Building thesis — universal
    ['any'],                                // Data is quiet — universal
    ['any'],                                // Simple models — universal
  ],
  crypto_native: [
    ['any'],                                // On-chain truth — universal
    ['trending_down', 'compressing'],       // Build in bear — bearish
    ['any'],                                // Narratives cycle — universal
    ['any'],                                // Trustless — universal
    ['expanding'],                          // Volatile present — volatile
    ['any'],                                // WAGMI — universal
  ],
  scientist: [
    ['any'],                                // Uncertainty — universal
    ['any'],                                // Data over narrative — universal
    ['any'],                                // Model the system — universal
    ['trending_up', 'trending_down'],       // Hypothesis forming — directional
    ['any'],                                // Correlation — universal
    ['any'],                                // Experiment — universal
  ],
}

// ── Care Quotes (10min idle) ────────────────────────────────────────

/** Shown when the user has been idle for 10+ minutes. 2 per archetype. */
export const CARE_QUOTES: Record<Archetype, string[]> = {
  value_investor: [
    'The market will be here when you get back. Rest.',
    'Patience is a virtue -- for your health too.',
  ],
  trend_follower: [
    'No trend needs you glued to the screen. Step away.',
    'The best moves happen after a clear head.',
  ],
  macro_trader: [
    'Even macro shifts take days. Take a break.',
    'Your edge sharpens with rest, not with screen time.',
  ],
  quant: [
    'The model runs without you. Recharge.',
    'Overfitting includes staring at charts too long.',
  ],
  strategist: [
    'A rested general makes better decisions.',
    'Step back. The battlefield will still be here.',
  ],
  philosopher: [
    'To trade well, one must first live well.',
    'Stillness is not inaction. It is preparation.',
  ],
  first_principles: [
    'First principle: protect the operator. That means rest.',
    'Clear thinking requires a clear mind. Take a pause.',
  ],
  crypto_native: [
    'The chain runs 24/7. You don\'t have to.',
    'AFK is its own kind of alpha. Touch grass.',
  ],
  scientist: [
    'Even experiments need control periods. Rest.',
    'The data will still be here. Your energy won\'t.',
  ],
}

// ── Time Quotes (universal, not per-archetype) ─────────────────────

/** Context-specific quotes for time of day and day of week. */
export const TIME_QUOTES: { morning: string[]; lateNight: string[]; weekend: string[] } = {
  morning: [
    'Good morning. Fresh eyes on fresh candles.',
    'New day, new opportunities.',
  ],
  lateNight: [
    'Late session. Rest is edge.',
    'Night owl hours. Be extra careful with sizing.',
  ],
  weekend: [
    'Markets quiet. Good time to review the week.',
    'Weekend mode. Recharge.',
  ],
}

// ── Fallback Quotes ─────────────────────────────────────────────────

/** Fallback quotes for companions without a known archetype (e.g. Vane) */
const FALLBACK_QUOTES = [
  'Watching the flow...',
  'Markets speak. Are you listening?',
  'Patience is a position.',
  'The next move reveals itself to those who wait.',
  'Stay sharp. Stay humble.',
  'Observing the orderbook...',
]

// ── Quote Selection ─────────────────────────────────────────────────

/**
 * Filter archetype quotes by regime, falling back to 'any' if no match.
 */
function filterByRegime(archetype: Archetype, regime: string): string[] {
  const quotes = IDLE_QUOTES[archetype]
  const tags = QUOTE_REGIME_TAGS[archetype]
  if (!quotes || !tags) return []

  const matched: string[] = []
  for (let i = 0; i < quotes.length; i++) {
    const regimeTags = tags[i]
    if (regimeTags && regimeTags.includes(regime as MarketRegime)) {
      matched.push(quotes[i]!)
    }
  }

  // Fall back to 'any'-tagged quotes if no regime-specific match
  if (matched.length === 0) {
    for (let i = 0; i < quotes.length; i++) {
      const regimeTags = tags[i]
      if (regimeTags && regimeTags.includes('any')) {
        matched.push(quotes[i]!)
      }
    }
  }

  return matched.length > 0 ? matched : quotes
}

/**
 * Pick an idle quote for a given archetype, cycling based on a tick counter.
 * The rotation period (~60 ticks at 500ms = ~30s) gives a breathing feel.
 * Falls back gracefully for unknown archetypes.
 *
 * Priority chain when context is provided:
 *   isIdle10min (care) > isLateNight > isMorning/isWeekend > regime-filtered > generic
 */
export function getIdleQuote(
  archetype: Archetype | undefined,
  tick: number,
  context?: IdleContext,
): string {
  const cycle = Math.floor(tick / 60)

  // Priority 1: care quotes for 10min idle
  if (context?.isIdle10min && archetype) {
    const care = CARE_QUOTES[archetype]
    if (care && care.length > 0) {
      return care[cycle % care.length]!
    }
  }

  // Priority 2: late night quotes
  if (context?.isLateNight) {
    const ln = TIME_QUOTES.lateNight
    return ln[cycle % ln.length]!
  }

  // Priority 3: morning or weekend quotes
  if (context?.isMorning) {
    const m = TIME_QUOTES.morning
    return m[cycle % m.length]!
  }
  if (context?.isWeekend) {
    const w = TIME_QUOTES.weekend
    return w[cycle % w.length]!
  }

  // Priority 4: regime-filtered archetype quotes
  if (context?.regime && archetype) {
    const filtered = filterByRegime(archetype, context.regime)
    return filtered[cycle % filtered.length]!
  }

  // Priority 5: generic archetype quotes
  const quotes = (archetype && IDLE_QUOTES[archetype]) || FALLBACK_QUOTES
  const idx = cycle % quotes.length
  return quotes[idx]!
}
