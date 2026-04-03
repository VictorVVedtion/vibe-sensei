import type { Emotion } from '../../buddy/sprite-atlas.js'

/**
 * Trading event types that can trigger emotional responses.
 */
export type TradingEventType =
  | 'trade_win'
  | 'trade_loss'
  | 'alert_warning'
  | 'alert_critical'
  | 'alert_emergency'
  | 'ghost_warning'
  | 'debate_triggered'

/**
 * Result of evaluating a trading event for emotional response.
 */
export interface ExpressionTrigger {
  emotion: Emotion
  reason: string
  duration: number  // ms, auto-reset to neutral after this
}

/**
 * Event-to-emotion duration mapping (in milliseconds).
 */
const EVENT_DURATIONS: Record<TradingEventType, number> = {
  trade_win:        10_000,
  trade_loss:       15_000,
  alert_warning:    10_000,
  alert_critical:   20_000,
  alert_emergency:  30_000,
  ghost_warning:    15_000,
  debate_triggered:      0,  // neutral — stays as-is
}

/**
 * Event-to-emotion mapping.
 */
const EVENT_EMOTIONS: Record<TradingEventType, Emotion> = {
  trade_win:        'happy',
  trade_loss:       'worried',
  alert_warning:    'worried',
  alert_critical:   'stern',
  alert_emergency:  'stern',
  ghost_warning:    'worried',
  debate_triggered: 'neutral',
}

/**
 * ExpressionEngine manages the guardian master's current emotional state.
 * Maps trading events to emotions with auto-reset timers.
 *
 * Usage:
 *   const engine = new ExpressionEngine()
 *   const trigger = engine.evaluateEvent('trade_win')
 *   if (trigger) engine.setEmotion(trigger.emotion, trigger.duration)
 *   // ... later ...
 *   const current = engine.getEmotion()  // 'happy' or 'neutral' after timeout
 */
export class ExpressionEngine {
  private currentEmotion: Emotion = 'neutral'
  private resetTimer: ReturnType<typeof setTimeout> | null = null

  /**
   * Evaluate a trading event and return the appropriate expression trigger.
   * Returns null for events that don't change emotion (e.g. debate_triggered
   * when already neutral).
   */
  evaluateEvent(event: TradingEventType): ExpressionTrigger | null {
    const emotion = EVENT_EMOTIONS[event]
    const duration = EVENT_DURATIONS[event]

    // No change needed for neutral transitions
    if (emotion === 'neutral' && this.currentEmotion === 'neutral') {
      return null
    }

    return {
      emotion,
      reason: event,
      duration,
    }
  }

  /**
   * Set the current emotion with an auto-reset timer.
   * If duration is 0 or emotion is 'neutral', sets immediately without timer.
   * Cancels any existing reset timer before setting a new one.
   */
  setEmotion(emotion: Emotion, durationMs: number): void {
    // Clear any pending reset
    if (this.resetTimer !== null) {
      clearTimeout(this.resetTimer)
      this.resetTimer = null
    }

    this.currentEmotion = emotion

    // Auto-reset to neutral after duration (skip for neutral or zero-duration)
    if (emotion !== 'neutral' && durationMs > 0) {
      this.resetTimer = setTimeout(() => {
        this.currentEmotion = 'neutral'
        this.resetTimer = null
      }, durationMs)
    }
  }

  /**
   * Get the current emotion state.
   */
  getEmotion(): Emotion {
    return this.currentEmotion
  }

  /**
   * Force reset to neutral and clear any pending timer.
   */
  reset(): void {
    if (this.resetTimer !== null) {
      clearTimeout(this.resetTimer)
      this.resetTimer = null
    }
    this.currentEmotion = 'neutral'
  }

  /**
   * Clean up timers (call on unmount/shutdown).
   */
  dispose(): void {
    this.reset()
  }
}

/**
 * Infer emotion from a companion reaction string (text analysis fallback).
 * Used when CompanionSprite doesn't have a direct event type, but does have
 * the guardian's reaction text from companionReaction in AppState.
 */
export function inferEmotionFromReaction(reaction: string | undefined): Emotion {
  if (!reaction) return 'neutral'

  const lower = reaction.toLowerCase()

  // Stern signals: risk alerts, warnings, danger
  const sternPatterns = [
    'danger', 'critical', 'emergency', 'stop', 'halt',
    'reckless', 'catastroph', 'liquidat', 'margin call',
    'unacceptable', 'madness', 'foolish', 'suicidal',
  ]
  for (const p of sternPatterns) {
    if (lower.includes(p)) return 'stern'
  }

  // Worried signals: caution, concern, loss
  const worriedPatterns = [
    'careful', 'caution', 'warning', 'risk', 'concern',
    'worry', 'loss', 'losing', 'down', 'drawdown',
    'overexpos', 'concentrat', 'volatile', 'uncertain',
    'wait', 'patience', 'slow down',
  ]
  for (const p of worriedPatterns) {
    if (lower.includes(p)) return 'worried'
  }

  // Happy signals: profit, good trade, approval
  const happyPatterns = [
    'profit', 'gain', 'excellent', 'well done', 'nice',
    'good trade', 'smart', 'wise', 'brilliant', 'perfect',
    'impressive', 'congratul', 'bravo', 'masterful',
    'approve', 'agree', 'correct',
  ]
  for (const p of happyPatterns) {
    if (lower.includes(p)) return 'happy'
  }

  return 'neutral'
}
