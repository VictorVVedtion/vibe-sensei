/**
 * CompanionEngine — central coordinator for the proactive companion system.
 *
 * Manages the lifecycle of:
 *   - ProactiveMonitor (4 trigger types for unprompted master interjections)
 *   - ExpressionEngine (emotion state management from Sprint 50)
 *   - CooldownManager (prevents message spam)
 *
 * The engine runs a 60-second polling loop that checks all triggers,
 * respects cooldown, and pushes messages via a callback. Emergency/urgent
 * messages bypass cooldown.
 *
 * Usage:
 *   const engine = new CompanionEngine(config, archetype, pushMessage)
 *   engine.start()
 *   // ... later ...
 *   engine.stop()
 */

import type { Archetype } from '../../buddy/persona.js'
import { ExpressionEngine, type TradingEventType } from './expression.js'
import { CooldownManager, ProactiveMonitor } from './proactive-monitor.js'
import type {
  CompanionConfig,
  CompanionStatus,
  ProactiveMessage,
  TradingEvent,
} from './types.js'

// ── Constants ─────────────────────────────────────────────────────────────

/** How often the monitor polls for triggers (ms). */
const CHECK_INTERVAL_MS = 60_000

/** Duration (ms) to hold the emotion after a proactive message. */
const PROACTIVE_EMOTION_DURATION_MS = 15_000

// ── CompanionEngine ───────────────────────────────────────────────────────

export class CompanionEngine {
  private readonly monitor: ProactiveMonitor
  private readonly expression: ExpressionEngine
  private readonly cooldown: CooldownManager
  private readonly config: CompanionConfig
  private readonly pushMessage: (message: string) => void

  private intervalId: ReturnType<typeof setInterval> | null = null
  private running: boolean = false
  private messagesDelivered: number = 0
  private lastMessageAt: number | null = null

  constructor(
    config: CompanionConfig,
    archetype: Archetype,
    pushMessage: (message: string) => void,
  ) {
    this.config = config
    this.pushMessage = pushMessage
    this.monitor = new ProactiveMonitor(archetype, config.sessionStartTime)
    this.expression = new ExpressionEngine()
    this.cooldown = new CooldownManager(config.cooldownMs)
  }

  /** Start the polling loop and async market checks. */
  start(): void {
    if (!this.config.enabled || !this.config.proactiveEnabled) return
    if (this.running) return

    this.running = true

    // Run first check immediately
    this.runCheck()

    // Set up recurring checks
    this.intervalId = setInterval(() => {
      this.runCheck()
    }, CHECK_INTERVAL_MS)
  }

  /** Stop the polling loop and clean up resources. */
  stop(): void {
    if (!this.running) return

    this.running = false

    if (this.intervalId !== null) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }

    this.expression.dispose()
  }

  /** Handle a trading event — update expression and potentially trigger behavior check. */
  handleTradingEvent(event: TradingEvent): void {
    if (!this.config.enabled) return

    // Map trading events to expression events
    if (event.type === 'position_closed' && event.pnlPercent !== undefined) {
      const expressionEvent: TradingEventType = event.pnlPercent > 0 ? 'trade_win' : 'trade_loss'
      const trigger = this.expression.evaluateEvent(expressionEvent)
      if (trigger) {
        this.expression.setEmotion(trigger.emotion, trigger.duration)
      }
    }

    // Run a behavior check immediately after trade events
    if (this.config.proactiveEnabled) {
      try {
        const msg = this.monitor.check()
        if (msg) {
          this.deliverMessage(msg)
        }
      } catch (err: unknown) {
        console.error(
          '[CompanionEngine] Post-trade check error:',
          err instanceof Error ? err.message : err,
        )
      }
    }
  }

  /** Get current engine status. */
  getStatus(): CompanionStatus {
    return {
      running: this.running,
      proactiveActive: this.running && this.config.proactiveEnabled,
      messagesDelivered: this.messagesDelivered,
      lastMessageAt: this.lastMessageAt,
      sessionDurationMs: Date.now() - this.config.sessionStartTime,
      cooldownActive: this.cooldown.isOnCooldown(),
    }
  }

  /** Get the ExpressionEngine instance (for external emotion queries). */
  getExpressionEngine(): ExpressionEngine {
    return this.expression
  }

  // ── Private ─────────────────────────────────────────────────────────────

  private runCheck(): void {
    // Synchronous trigger check
    try {
      const msg = this.monitor.check()
      if (msg) {
        this.deliverMessage(msg)
      }
    } catch (err: unknown) {
      console.error(
        '[CompanionEngine] Sync check error:',
        err instanceof Error ? err.message : err,
      )
    }

    // Async market check (portfolio heat, etc.)
    this.runAsyncCheck()
  }

  private runAsyncCheck(): void {
    this.monitor.checkMarketAsync().then((msg) => {
      if (msg) {
        this.deliverMessage(msg)
      }
    }).catch((err: unknown) => {
      console.error(
        '[CompanionEngine] Async check error:',
        err instanceof Error ? err.message : err,
      )
    })
  }

  private deliverMessage(msg: ProactiveMessage): void {
    // Urgent messages bypass cooldown
    const canDeliver = msg.severity === 'urgent' || this.cooldown.canSpeak()

    if (!canDeliver) return

    // Push the message
    this.pushMessage(msg.message)

    // Update expression
    this.expression.setEmotion(msg.emotion, PROACTIVE_EMOTION_DURATION_MS)

    // Record delivery
    this.cooldown.recordSpeak()
    this.messagesDelivered++
    this.lastMessageAt = Date.now()
  }
}
