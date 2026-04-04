/**
 * EMOTION DECISION TABLE
 * ──────────────────────────────────────────────────────
 * Condition                    -> Emotion  -> Color
 * ──────────────────────────────────────────────────────
 * regime=compressing/volatile  -> worried  -> red
 * regime=trending_up/down      -> happy    -> (default green)
 * regime=ranging               -> neutral  -> (default green, dim via fading)
 * regime=expanding             -> stern    -> yellow
 * no regime data               -> neutral  -> (default)
 * portfolioHeat > 60%          -> worried  -> red (overrides regime)
 * drawdown > 5%                -> worried  -> red (overrides regime)
 * time=lateNight (00-05)       -> worried  -> red (health concern)
 * petting                      -> happy    -> (heart animation)
 * ──────────────────────────────────────────────────────
 * Visual Weight Tiers:
 *   dim     = normal idle quotes (fading=true)
 *   medium  = care/warning/attentive (fading=false, no bold)
 *   bright  = active reaction (fading=false initially, fades over time)
 * ──────────────────────────────────────────────────────
 * Signal Priority Chain (highest first):
 *   1. reaction (guardian-observer)  -> bright
 *   2. attentive (post-trade)        -> medium
 *   3. care (10min idle)             -> medium
 *   4. time greeting (morning/late)  -> dim
 *   5. regime-filtered quote         -> dim
 *   6. generic idle                  -> dim
 * ──────────────────────────────────────────────────────
 */

/**
 * guardian-display.ts — Module-level singleton for guardian display state.
 *
 * Provides a single tick counter + display text that both CompanionSprite
 * and CompanionFloatingBubble consume via useGuardianDisplay(). Avoids
 * duplicate setInterval timers when both components are mounted.
 *
 * Lifecycle: timer starts on first subscriber, stops when the last
 * subscriber leaves. Adaptive frequency: 500ms when a reaction is
 * active, 5000ms when idle.
 */

import { useSyncExternalStore } from 'react'
import { getCompanion } from './companion.js'
import { getMasterArchetype } from './persona.js'
import type { Archetype } from './persona.js'
import { getIdleQuote, type IdleContext } from './idle-quotes.js'
import { inferEmotionFromReaction } from '../services/companion/expression.js'
import { getLatestRegime } from '../services/market/regime.js'
import { getLastActivityTime } from '../utils/activityManager.js'
import { getRegimePollerStatus } from '../services/companion/regime-poller.js'
import type { Emotion } from './sprite-atlas.js'
import type { Master } from './types.js'

// ── Constants ────────────────────────────────────────────────────────

const TICK_ACTIVE_MS = 500
const TICK_IDLE_MS = 5000
const BUBBLE_SHOW = 20   // ticks at 500ms = ~10s
const FADE_WINDOW = 6    // last ~3s the bubble dims
const ATTENTIVE_TICKS = 10 // ~5s at 500ms

// ── Attentive Quotes ────────────────────────────────────────────────────
const ATTENTIVE_QUOTES: Record<Archetype, readonly string[]> = {
  value_investor: ['Position noted. Watching the value.', 'Entry logged. Patience from here.'],
  trend_follower: ['Position opened. Riding the momentum.', 'Trade on. Let the trend work.'],
  macro_trader: ['Position sized. Macro thesis in play.', 'Entered. Watching the big picture.'],
  quant: ['Signal executed. Monitoring the model.', 'Trade logged. System running.'],
  strategist: ['Move made. Watching the board.', 'Position deployed. Strategy active.'],
  philosopher: ['The trade is placed. Now we observe.', 'Action taken. Detachment begins.'],
  first_principles: ['Thesis deployed. Data will confirm.', 'Position in. Fundamentals will tell.'],
  crypto_native: ['Position on-chain. LFG.', 'Trade live. Watching the flow.'],
  scientist: ['Experiment started. Data incoming.', 'Hypothesis active. Measuring.'],
}
const CRITICAL_KEYWORDS = ['CRITICAL', 'EMERGENCY', 'WARNING', '🔴', '🟠']

// ── Snapshot type ────────────────────────────────────────────────────

export interface GuardianDisplaySnapshot {
  displayText: string
  fading: boolean
  emotionColor: string | undefined
  emotion: Emotion
}

// ── Singleton state ──────────────────────────────────────────────────

let tick = 0
let timer: ReturnType<typeof setInterval> | null = null
let currentInterval = TICK_IDLE_MS

// Reaction state — set externally via pushReaction()
let reaction: string | undefined
let reactionTick = 0

// Attentive state — brief post-trade confirmation
let isAttentive = false
let attentiveTicksRemaining = 0
let attentiveText = ''
let attentiveIndex = 0

// Subscriber tracking
const listeners = new Set<() => void>()

// Cached snapshot — recreated on every tick or reaction change
let snapshot: GuardianDisplaySnapshot = buildSnapshot()

// ── Internal helpers ─────────────────────────────────────────────────

/**
 * Map a regime type to an emotion color for the guardian's face.
 *   compressing/volatile → red (worried)
 *   expanding → yellow (stern/alert)
 *   trending/ranging/default → undefined (use rarity color)
 */
function regimeToColor(regime?: string): string | undefined {
  switch (regime) {
    case 'compressing':
    case 'volatile':
      return 'red'
    case 'expanding':
      return 'yellow'
    case 'trending_up':
    case 'trending_down':
    case 'ranging':
    default:
      return undefined
  }
}

/**
 * Build the idle context from current time, regime, and user activity.
 */
function buildIdleContext(): IdleContext {
  const hour = new Date().getHours()
  const dayOfWeek = new Date().getDay()

  // Resolve regime: try the poller's tracked symbol first, then BTC/USDT fallback
  let regimeType: string | undefined
  try {
    const pollerStatus = getRegimePollerStatus()
    const symbol = pollerStatus.symbol || 'BTC/USDT'
    const regimeData = getLatestRegime(symbol)
    regimeType = regimeData?.regime
  } catch {
    // Regime unavailable — leave undefined
  }

  // User idle detection
  let isIdle10min = false
  try {
    const lastActivity = getLastActivityTime()
    if (lastActivity > 0) {
      isIdle10min = Date.now() - lastActivity > 600_000
    }
  } catch {
    // Activity manager unavailable
  }

  return {
    regime: regimeType,
    isLateNight: hour >= 0 && hour < 5,
    isMorning: hour >= 5 && hour < 10,
    isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
    isIdle10min,
  }
}

function buildSnapshot(): GuardianDisplaySnapshot {
  const companion = getCompanion()
  const archetype = companion
    ? getMasterArchetype(companion.species as Master)
    : undefined

  const hasReaction = reaction !== undefined
  const bubbleAge = hasReaction ? tick - reactionTick : 0

  // Signal Priority Chain: reaction > attentive > idle (with context)
  let displayText: string
  let fading: boolean

  if (hasReaction) {
    // Priority 1: Active reaction from guardian-observer (bright)
    displayText = reaction!
    fading = bubbleAge >= BUBBLE_SHOW - FADE_WINDOW
  } else if (isAttentive && attentiveTicksRemaining > 0) {
    // Priority 2: Post-trade attentive state (medium brightness)
    displayText = attentiveText
    fading = false
  } else {
    // Priority 3-6: Idle quotes with context chain (care > time > regime > generic)
    const context = buildIdleContext()
    displayText = getIdleQuote(archetype, tick, context)

    if (context.isIdle10min || context.isLateNight || context.regime === 'compressing' || context.regime === 'expanding') {
      fading = false // medium brightness for attention-worthy states
    } else {
      fading = true // normal idle dim
    }
  }

  const emotion: Emotion = inferEmotionFromReaction(reaction)
  const emotionColor: string | undefined = hasReaction
    ? undefined  // reactions use default rarity color
    : regimeToColor(context?.regime)

  return { displayText, fading, emotionColor, emotion }
}

function notifyListeners(): void {
  snapshot = buildSnapshot()
  for (const listener of listeners) listener()
}

function onTick(): void {
  tick++
  // Auto-clear reaction after BUBBLE_SHOW ticks → transition to attentive if applicable
  if (reaction !== undefined && tick - reactionTick >= BUBBLE_SHOW) {
    reaction = undefined
  }
  // Decrement attentive countdown
  if (isAttentive && attentiveTicksRemaining > 0) {
    attentiveTicksRemaining--
    if (attentiveTicksRemaining <= 0) {
      isAttentive = false
    }
  }
  adjustInterval()
  notifyListeners()
}

function adjustInterval(): void {
  const target = reaction !== undefined ? TICK_ACTIVE_MS : TICK_IDLE_MS
  if (target !== currentInterval && timer !== null) {
    clearInterval(timer)
    currentInterval = target
    timer = setInterval(onTick, currentInterval)
  }
}

function startTimer(): void {
  if (timer !== null) return
  currentInterval = reaction !== undefined ? TICK_ACTIVE_MS : TICK_IDLE_MS
  timer = setInterval(onTick, currentInterval)
}

function stopTimer(): void {
  if (timer === null) return
  clearInterval(timer)
  timer = null
}

// ── Public API: imperative ───────────────────────────────────────────

/**
 * Push a reaction from the guardian. Called by the companion engine /
 * AppState subscriber when companionReaction changes.
 */
export function pushReaction(text: string | undefined): void {
  if (text === reaction) return
  // When reaction clears, check if it was non-critical → trigger attentive
  if (text === undefined && reaction !== undefined) {
    const wasCritical = CRITICAL_KEYWORDS.some(kw => reaction!.includes(kw))
    if (!wasCritical) {
      const companion = getCompanion()
      const arch = companion ? getMasterArchetype(companion.species as Master) : undefined
      const quotes = arch ? ATTENTIVE_QUOTES[arch] : undefined
      if (quotes && quotes.length > 0) {
        isAttentive = true
        attentiveTicksRemaining = ATTENTIVE_TICKS
        attentiveText = quotes[attentiveIndex % quotes.length]
        attentiveIndex++
      }
    }
  }
  reaction = text
  if (text !== undefined) {
    reactionTick = tick
  }
  adjustInterval()
  notifyListeners()
}

/**
 * Read the current display state without subscribing (for non-React code).
 */
export function getGuardianDisplay(): GuardianDisplaySnapshot {
  return snapshot
}

// ── Public API: React hook ───────────────────────────────────────────

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange)
  if (listeners.size === 1) startTimer()
  return () => {
    listeners.delete(onStoreChange)
    if (listeners.size === 0) stopTimer()
  }
}

function getSnapshot(): GuardianDisplaySnapshot {
  return snapshot
}

/**
 * Thin React hook — consumes the singleton via useSyncExternalStore.
 * Both CompanionSprite and CompanionFloatingBubble call this, sharing
 * the same single timer.
 */
export function useGuardianDisplay(): GuardianDisplaySnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
