/**
 * CompanionEngine — central coordinator for the proactive companion system.
 *
 * Manages the lifecycle of:
 *   - ProactiveMonitor (4 trigger types for unprompted master interjections)
 *   - ExpressionEngine (emotion state management from Sprint 50)
 *   - CooldownManager (prevents message spam)
 *   - AsyncCouncil (background debates when risk rises, Sprint 52)
 *   - VisionService (chart screenshot analysis via multimodal AI, Sprint 53)
 *   - TTSService (text-to-speech voice output for masters, Sprint 54)
 *   - STTService (speech-to-text voice input via sox + API, Sprint 55)
 *
 * The engine runs a 60-second polling loop that checks all triggers,
 * respects cooldown, and pushes messages via a callback. Emergency/urgent
 * messages bypass cooldown. The council has its own independent 30-minute
 * cooldown — it does not share the ProactiveMonitor's cooldown.
 *
 * Usage:
 *   const engine = new CompanionEngine(config, archetype, pushMessage, masterName, userMaster)
 *   engine.start()
 *   // ... later ...
 *   engine.stop()
 */

import type { Archetype } from '../../buddy/persona.js'
import type { Master } from '../../buddy/types.js'
import { ExpressionEngine, type TradingEventType } from './expression.js'
import { CooldownManager, ProactiveMonitor } from './proactive-monitor.js'
import { AsyncCouncil } from './council.js'
import { VisionService } from './vision.js'
import { TTSService } from './tts.js'
import { STTService } from './stt.js'
import { ARCHETYPE_VOICES } from './voice-config.js'
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
  private readonly council: AsyncCouncil
  private readonly vision: VisionService
  private readonly tts: TTSService
  private readonly stt: STTService
  private readonly config: CompanionConfig
  private readonly archetype: Archetype
  private readonly masterName: string
  private readonly pushMessage: (message: string) => void
  private readonly userMaster: Master | null

  private intervalId: ReturnType<typeof setInterval> | null = null
  private running: boolean = false
  private messagesDelivered: number = 0
  private lastMessageAt: number | null = null
  private ttsEnabled: boolean = true

  constructor(
    config: CompanionConfig,
    archetype: Archetype,
    pushMessage: (message: string) => void,
    masterName?: string,
    userMaster?: Master,
  ) {
    this.config = config
    this.archetype = archetype
    this.masterName = masterName ?? 'Trading Master'
    this.pushMessage = pushMessage
    this.userMaster = userMaster ?? null
    this.monitor = new ProactiveMonitor(archetype, config.sessionStartTime)
    this.expression = new ExpressionEngine()
    this.cooldown = new CooldownManager(config.cooldownMs)
    this.council = new AsyncCouncil()
    this.vision = new VisionService()
    this.tts = new TTSService()
    this.stt = new STTService()
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

    this.tts.stop()
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

  /** Get the AsyncCouncil instance (for external queries). */
  getCouncil(): AsyncCouncil {
    return this.council
  }

  /**
   * Analyze the current chart displayed on the :3456 web server.
   * The master comments in character based on their archetype.
   *
   * Returns null if:
   *   - GEMINI_API_KEY is not set
   *   - The chart web server is not running
   *   - The screenshot capture or analysis fails
   *
   * Can be called externally (e.g. from a user command or trade event).
   */
  async analyzeChart(): Promise<string | null> {
    if (!this.vision.isAvailable()) {
      return null
    }

    try {
      const analysis = await this.vision.analyzeChart(
        this.archetype,
        this.masterName,
      )

      if (analysis) {
        // Update expression to reflect chart analysis activity
        this.expression.setEmotion('stern', PROACTIVE_EMOTION_DURATION_MS)
      }

      return analysis
    } catch (err: unknown) {
      console.error(
        '[CompanionEngine] Chart analysis error:',
        err instanceof Error ? err.message : err,
      )
      return null
    }
  }

  /**
   * Analyze a chart from a user-provided image file.
   * Fallback for when the web server is not running.
   *
   * @param filePath - Absolute path to a chart image (PNG/JPEG)
   * @returns The master's chart analysis text, or null
   */
  async analyzeChartFromFile(filePath: string): Promise<string | null> {
    if (!this.vision.isAvailable()) {
      return null
    }

    try {
      const analysis = await this.vision.analyzeChartFromFile(
        filePath,
        this.archetype,
        this.masterName,
      )

      if (analysis) {
        this.expression.setEmotion('stern', PROACTIVE_EMOTION_DURATION_MS)
      }

      return analysis
    } catch (err: unknown) {
      console.error(
        '[CompanionEngine] File chart analysis error:',
        err instanceof Error ? err.message : err,
      )
      return null
    }
  }

  /** Check if chart vision is available (has API key). */
  isVisionAvailable(): boolean {
    return this.vision.isAvailable()
  }

  /** Check if the chart web server is running. */
  async isChartServerAvailable(): Promise<boolean> {
    return this.vision.isChartServerAvailable()
  }

  /** Enable or disable TTS voice output. */
  setTTSEnabled(enabled: boolean): void {
    this.ttsEnabled = enabled
    if (!enabled) {
      this.tts.stop()
    }
  }

  /** Whether TTS is currently enabled and has a valid API key. */
  isTTSEnabled(): boolean {
    return this.ttsEnabled && this.tts.isAvailable()
  }

  /** Stop any currently playing TTS audio. */
  stopTTS(): void {
    this.tts.stop()
  }

  // ── STT (Sprint 55) ───────────────────────────────────────────────────

  /**
   * Start recording audio from the microphone.
   * No-op if STT is not available or already recording.
   */
  async startListening(): Promise<void> {
    if (!this.stt.isAvailable()) return
    await this.stt.startRecording()
  }

  /**
   * Stop recording and transcribe the captured audio to text.
   *
   * @returns The transcribed text, or null if:
   *   - STT is not available
   *   - No recording was in progress
   *   - The audio was too short (silence)
   *   - Transcription failed
   */
  async stopListeningAndGetText(): Promise<string | null> {
    return this.stt.stopAndTranscribe()
  }

  /** Whether a recording is currently in progress. */
  isListening(): boolean {
    return this.stt.isRecording()
  }

  /** Whether STT is available (has API key and sox installed). */
  isSTTAvailable(): boolean {
    return this.stt.isAvailable()
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

    // Async council check (background debates)
    this.runCouncilCheck()
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

  /**
   * Check whether the AsyncCouncil should convene.
   * The council has its own 30-minute cooldown, independent of the
   * ProactiveMonitor's cooldown managed by CooldownManager.
   * Council messages bypass the regular cooldown — they are delivered directly.
   */
  private runCouncilCheck(): void {
    if (!this.userMaster) return

    this.council.buildContext(this.userMaster).then((context) => {
      if (!context) return
      if (!this.council.shouldConvene(context)) return

      return this.council.convene(context).then((result) => {
        const message = this.council.formatMessage(result)
        this.deliverCouncilMessage(message)
      })
    }).catch((err: unknown) => {
      console.error(
        '[CompanionEngine] Council check error:',
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

    // Speak the message via TTS (async, non-blocking)
    if (this.ttsEnabled && this.tts.isAvailable()) {
      const voice = ARCHETYPE_VOICES[this.archetype]
      if (voice) {
        this.tts.speak(msg.message, voice).catch((err: unknown) => {
          console.error(
            '[CompanionEngine] TTS error:',
            err instanceof Error ? err.message : err,
          )
        })
      }
    }

    // Update expression
    this.expression.setEmotion(msg.emotion, PROACTIVE_EMOTION_DURATION_MS)

    // Record delivery
    this.cooldown.recordSpeak()
    this.messagesDelivered++
    this.lastMessageAt = Date.now()
  }

  /**
   * Deliver a council message. Council messages bypass the regular cooldown
   * since the council has its own 30-minute cooldown. Expression is set to
   * 'stern' since council messages are always serious risk discussions.
   */
  private deliverCouncilMessage(message: string): void {
    this.pushMessage(message)
    this.expression.setEmotion('stern', PROACTIVE_EMOTION_DURATION_MS)
    this.messagesDelivered++
    this.lastMessageAt = Date.now()
  }
}
