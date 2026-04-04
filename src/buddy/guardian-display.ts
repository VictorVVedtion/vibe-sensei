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

  // Build context for idle quote selection
  const context = hasReaction ? undefined : buildIdleContext()

  const displayText = hasReaction
    ? reaction!
    : getIdleQuote(archetype, tick, context)

  // Three-tier brightness:
  //   Active reaction: fading controlled by bubbleAge (starts bright, fades)
  //   Care/lateNight/volatile regime: fading=false (medium brightness)
  //   Normal idle: fading=true (dim)
  let fading: boolean
  if (hasReaction) {
    fading = bubbleAge >= BUBBLE_SHOW - FADE_WINDOW
  } else if (context?.isIdle10min || context?.isLateNight || context?.regime === 'compressing' || context?.regime === 'expanding') {
    fading = false // medium brightness for attention-worthy states
  } else {
    fading = true // normal idle dim
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
  // Auto-clear reaction after BUBBLE_SHOW ticks
  if (reaction !== undefined && tick - reactionTick >= BUBBLE_SHOW) {
    reaction = undefined
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
