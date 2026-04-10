/**
 * LiveSession — Full-duplex voice conversation via the Live API (WebSocket).
 *
 * Enables real-time voice dialogue between the user and their trading master.
 * The user speaks through the microphone (sox recording streamed as PCM chunks
 * over WebSocket), and the master responds with both text and audio played back
 * through sox.
 *
 * Key features:
 *   - Full-duplex: user and master can speak simultaneously
 *   - Barge-in: user speech interrupts master playback (server-side)
 *   - Auto-reconnect: up to 3 retries with 2-second backoff
 *   - 15-minute session timeout with graceful shutdown
 *   - State machine: idle -> connecting -> active -> idle/error
 *
 * The service is fully optional and degrades gracefully:
 *   - No API key -> disabled (isAvailable() = false)
 *   - No sox installed -> disabled
 *   - WebSocket failure -> error state with auto-reconnect
 *   - Recorder crash -> session stops
 *   - Player crash -> text responses continue
 *   - All errors are caught and logged, never thrown to callers
 */

import { spawn, execSync, type ChildProcess } from 'child_process'

// ── Types ────────────────────────────────────────────────────────────────

export type LiveSessionState = 'idle' | 'connecting' | 'active' | 'error'

export interface LiveSessionConfig {
  apiKey: string
  masterName: string
  archetype: string
  voiceName: string
  systemInstruction: string
  onTranscript: (text: string) => void
  onResponse: (text: string) => void
  onStateChange: (state: LiveSessionState) => void
}

// ── Constants ────────────────────────────────────────────────────────────

const WS_BASE =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent'
const LIVE_MODEL = 'models/gemini-3.1-flash-live-preview'

/** WebSocket connection timeout in milliseconds. */
const CONNECT_TIMEOUT_MS = 10_000

/** Maximum reconnection attempts after unexpected disconnect. */
const MAX_RECONNECT_ATTEMPTS = 3

/** Delay between reconnection attempts in milliseconds. */
const RECONNECT_DELAY_MS = 2_000

/** Maximum session duration in milliseconds (15 minutes). */
const MAX_SESSION_DURATION_MS = 15 * 60 * 1_000

/** Output sample rate from the Live API. */
const OUTPUT_SAMPLE_RATE = 24_000

/** Input sample rate for recording. */
const INPUT_SAMPLE_RATE = 16_000

// ── sox Detection ────────────────────────────────────────────────────────

let soxAvailableCache: boolean | null = null

function isSoxInstalled(): boolean {
  if (soxAvailableCache !== null) return soxAvailableCache

  try {
    execSync('which sox', { stdio: 'ignore' })
    soxAvailableCache = true
    return true
  } catch {
    try {
      execSync('which rec', { stdio: 'ignore' })
      soxAvailableCache = true
      return true
    } catch {
      soxAvailableCache = false
      return false
    }
  }
}

// ── WebSocket Message Types ──────────────────────────────────────────────

interface ServerContentPart {
  text?: string
  inlineData?: {
    mimeType: string
    data: string
  }
}

interface ServerContent {
  modelTurn?: {
    parts?: ServerContentPart[]
  }
  inputTranscript?: string
  turnComplete?: boolean
}

interface ServerMessage {
  setupComplete?: Record<string, unknown>
  serverContent?: ServerContent
}

// ── LiveSession ──────────────────────────────────────────────────────────

export class LiveSession {
  private state: LiveSessionState = 'idle'
  private ws: WebSocket | null = null
  private recorder: ChildProcess | null = null
  private player: ChildProcess | null = null
  private readonly config: LiveSessionConfig

  private reconnectAttempts: number = 0
  private sessionTimer: ReturnType<typeof setTimeout> | null = null
  private connectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private setupDone: boolean = false
  private intentionalClose: boolean = false

  constructor(config: LiveSessionConfig) {
    this.config = config
  }

  // ── Public API ─────────────────────────────────────────────────────────

  /**
   * Start the full-duplex voice conversation.
   * Connects to the Live API via WebSocket, starts sox recording,
   * and begins streaming audio chunks to the server.
   */
  async start(): Promise<void> {
    if (this.state === 'active' || this.state === 'connecting') return
    if (!this.isAvailable()) {
      console.error('[LiveSession] Not available — missing API key or sox')
      return
    }

    this.intentionalClose = false
    this.reconnectAttempts = 0

    await this.connect()
  }

  /**
   * Stop the voice conversation gracefully.
   * Closes WebSocket, kills recorder and player processes, clears timers.
   */
  stop(): void {
    this.intentionalClose = true
    this.cleanup()
    this.setState('idle')
  }

  /** Get the current session state. */
  getState(): LiveSessionState {
    return this.state
  }

  /**
   * Whether the live session feature is available.
   * Requires an API key and sox installed on the system.
   */
  isAvailable(): boolean {
    return this.config.apiKey.length > 0 && isSoxInstalled()
  }

  // ── Connection ─────────────────────────────────────────────────────────

  private async connect(): Promise<void> {
    this.setState('connecting')
    this.setupDone = false

    const url = `${WS_BASE}?key=${this.config.apiKey}`

    try {
      const ws = new WebSocket(url)
      this.ws = ws

      // Connection timeout
      this.connectTimer = setTimeout(() => {
        if (!this.setupDone) {
          console.error('[LiveSession] Connection timed out')
          this.handleDisconnect()
        }
      }, CONNECT_TIMEOUT_MS)

      ws.addEventListener('open', () => {
        this.sendSetupMessage()
      })

      ws.addEventListener('message', (event: MessageEvent) => {
        this.handleMessage(event)
      })

      ws.addEventListener('close', (event: CloseEvent) => {
        console.error(
          `[LiveSession] WebSocket closed: code=${event.code} reason=${event.reason || 'none'}`,
        )
        if (!this.intentionalClose) {
          this.handleDisconnect()
        }
      })

      ws.addEventListener('error', (event: Event) => {
        console.error(
          '[LiveSession] WebSocket error:',
          event instanceof ErrorEvent ? event.message : 'unknown error',
        )
      })
    } catch (err: unknown) {
      console.error(
        '[LiveSession] Failed to create WebSocket:',
        err instanceof Error ? err.message : String(err),
      )
      this.handleDisconnect()
    }
  }

  /**
   * Send the initial setup message to configure the Live session.
   * This must be sent immediately after the WebSocket connection opens.
   */
  private sendSetupMessage(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return

    const setup = {
      setup: {
        model: LIVE_MODEL,
        generationConfig: {
          responseModalities: ['AUDIO', 'TEXT'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: this.config.voiceName },
            },
          },
        },
        systemInstruction: {
          parts: [{ text: this.config.systemInstruction }],
        },
      },
    }

    try {
      this.ws.send(JSON.stringify(setup))
    } catch (err: unknown) {
      console.error(
        '[LiveSession] Failed to send setup message:',
        err instanceof Error ? err.message : String(err),
      )
      this.handleDisconnect()
    }
  }

  // ── Message Handling ───────────────────────────────────────────────────

  private handleMessage(event: MessageEvent): void {
    let msg: ServerMessage
    try {
      const raw =
        typeof event.data === 'string'
          ? event.data
          : event.data instanceof Buffer
            ? event.data.toString('utf-8')
            : String(event.data)
      msg = JSON.parse(raw) as ServerMessage
    } catch (err: unknown) {
      console.error(
        '[LiveSession] Failed to parse server message:',
        err instanceof Error ? err.message : String(err),
      )
      return
    }

    // Setup acknowledgment
    if (msg.setupComplete !== undefined) {
      this.onSetupComplete()
      return
    }

    // Server content — model responses and transcripts
    if (msg.serverContent) {
      this.handleServerContent(msg.serverContent)
    }
  }

  /**
   * Called when the server acknowledges the setup message.
   * Transitions to 'active' state and starts recording.
   */
  private onSetupComplete(): void {
    this.setupDone = true

    // Clear connection timeout
    if (this.connectTimer !== null) {
      clearTimeout(this.connectTimer)
      this.connectTimer = null
    }

    // Reset reconnect counter on successful connection
    this.reconnectAttempts = 0

    this.setState('active')
    this.startRecording()
    this.startPlayer()
    this.startSessionTimer()
  }

  /**
   * Handle server content messages — model responses and input transcripts.
   */
  private handleServerContent(content: ServerContent): void {
    // Model turn — text and/or audio from the master
    if (content.modelTurn?.parts) {
      for (const part of content.modelTurn.parts) {
        if (part.text) {
          this.config.onResponse(part.text)
        }
        if (part.inlineData) {
          this.playAudioChunk(part.inlineData.data)
        }
      }
    }

    // Input transcript — what the user said (transcribed by the server)
    if (content.inputTranscript) {
      this.config.onTranscript(content.inputTranscript)
    }
  }

  // ── Audio Recording (Microphone -> WebSocket) ─────────────────────────

  /**
   * Start sox recording from the default microphone.
   * Audio is captured as raw PCM (16kHz, mono, 16-bit signed integer)
   * and streamed to stdout. Each chunk is base64-encoded and sent to
   * the WebSocket as a realtimeInput message.
   */
  private startRecording(): void {
    try {
      const proc = spawn(
        'sox',
        [
          '-d',                    // Default audio device
          '-t', 'raw',            // Raw PCM output
          '-r', String(INPUT_SAMPLE_RATE),
          '-c', '1',             // Mono
          '-b', '16',            // 16-bit
          '-e', 'signed-integer',
          '-',                    // Output to stdout
        ],
        { stdio: ['ignore', 'pipe', 'ignore'] },
      )

      this.recorder = proc

      proc.stdout?.on('data', (chunk: Buffer) => {
        this.sendAudioChunk(chunk)
      })

      proc.on('error', (err: Error) => {
        console.error('[LiveSession] Recorder process error:', err.message)
        this.stop()
      })

      proc.on('close', (code: number | null) => {
        if (!this.intentionalClose && this.state === 'active') {
          console.error(
            `[LiveSession] Recorder process exited unexpectedly (code=${code})`,
          )
          this.stop()
        }
      })
    } catch (err: unknown) {
      console.error(
        '[LiveSession] Failed to start recorder:',
        err instanceof Error ? err.message : String(err),
      )
      this.stop()
    }
  }

  /**
   * Send a raw PCM audio chunk to the WebSocket as a realtimeInput message.
   * Encodes the chunk as base64 and wraps it in the expected message format.
   */
  private sendAudioChunk(chunk: Buffer): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return

    const message = {
      realtimeInput: {
        mediaChunks: [
          {
            mimeType: `audio/pcm;rate=${INPUT_SAMPLE_RATE}`,
            data: chunk.toString('base64'),
          },
        ],
      },
    }

    try {
      this.ws.send(JSON.stringify(message))
    } catch (err: unknown) {
      console.error(
        '[LiveSession] Failed to send audio chunk:',
        err instanceof Error ? err.message : String(err),
      )
    }
  }

  // ── Audio Playback (WebSocket -> Speaker) ──────────────────────────────

  /**
   * Start the sox play process that accepts raw PCM on stdin.
   * Audio chunks received from the server are written to this process.
   */
  private startPlayer(): void {
    try {
      const proc = spawn(
        'sox',
        [
          '-t', 'raw',            // Raw PCM input
          '-r', String(OUTPUT_SAMPLE_RATE),
          '-c', '1',             // Mono
          '-b', '16',            // 16-bit
          '-e', 'signed-integer',
          '-',                    // Read from stdin
          '-d',                  // Output to default audio device
        ],
        { stdio: ['pipe', 'ignore', 'ignore'] },
      )

      this.player = proc

      proc.on('error', (err: Error) => {
        console.error('[LiveSession] Player process error:', err.message)
        // Player crash is non-fatal — text responses continue
        this.player = null
      })

      proc.on('close', () => {
        if (this.player === proc) {
          this.player = null
        }
      })
    } catch (err: unknown) {
      console.error(
        '[LiveSession] Failed to start player:',
        err instanceof Error ? err.message : String(err),
      )
      // Non-fatal: text responses still work
      this.player = null
    }
  }

  /**
   * Decode a base64 audio chunk and write it to the sox player stdin.
   * Barge-in is handled server-side: when the user speaks, the server
   * stops generating audio, so this method simply stops receiving new chunks.
   * If the player has crashed, it is restarted for continued playback.
   */
  private playAudioChunk(base64Data: string): void {
    if (!this.player || !this.player.stdin?.writable) {
      // If player is gone, restart it for continued playback
      this.startPlayer()
      if (!this.player || !this.player.stdin?.writable) return
    }

    try {
      const buffer = Buffer.from(base64Data, 'base64')
      this.player.stdin.write(buffer)
    } catch (err: unknown) {
      console.error(
        '[LiveSession] Failed to write audio to player:',
        err instanceof Error ? err.message : String(err),
      )
    }
  }

  /**
   * Stop the current audio playback.
   * Used for barge-in: when user starts speaking, kill the player
   * to immediately silence the master.
   */
  private stopPlayback(): void {
    if (this.player) {
      try {
        this.player.stdin?.end()
        this.player.kill()
      } catch {
        // Process may have already exited
      }
      this.player = null
    }
  }

  // ── Reconnection ───────────────────────────────────────────────────────

  /**
   * Handle an unexpected disconnect. Attempts to reconnect up to
   * MAX_RECONNECT_ATTEMPTS times with a RECONNECT_DELAY_MS backoff.
   */
  private handleDisconnect(): void {
    // Clean up current resources but don't reset intentionalClose
    this.cleanupConnection()

    if (this.intentionalClose) {
      this.setState('idle')
      return
    }

    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error(
        `[LiveSession] Max reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached`,
      )
      this.cleanup()
      this.setState('error')
      return
    }

    this.reconnectAttempts++
    console.error(
      `[LiveSession] Reconnecting in ${RECONNECT_DELAY_MS}ms ` +
        `(attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`,
    )

    this.reconnectTimer = setTimeout(() => {
      if (!this.intentionalClose) {
        this.connect()
      }
    }, RECONNECT_DELAY_MS)
  }

  // ── Session Timer ──────────────────────────────────────────────────────

  /**
   * Start the 15-minute session timer.
   * When the timer fires, the session is gracefully stopped.
   */
  private startSessionTimer(): void {
    if (this.sessionTimer !== null) {
      clearTimeout(this.sessionTimer)
    }

    this.sessionTimer = setTimeout(() => {
      console.error(
        '[LiveSession] Max session duration reached (15 min) — auto-stopping',
      )
      this.stop()
    }, MAX_SESSION_DURATION_MS)
  }

  // ── State Management ───────────────────────────────────────────────────

  private setState(newState: LiveSessionState): void {
    if (this.state === newState) return
    this.state = newState
    this.config.onStateChange(newState)
  }

  // ── Cleanup ────────────────────────────────────────────────────────────

  /**
   * Clean up just the WebSocket connection, without touching
   * recorder or player. Used during reconnection.
   */
  private cleanupConnection(): void {
    if (this.connectTimer !== null) {
      clearTimeout(this.connectTimer)
      this.connectTimer = null
    }

    if (this.ws) {
      try {
        this.ws.close()
      } catch {
        // WebSocket may already be closed
      }
      this.ws = null
    }
  }

  /**
   * Full cleanup: close WebSocket, kill recorder, kill player, clear all timers.
   */
  private cleanup(): void {
    this.cleanupConnection()

    // Kill recorder
    if (this.recorder) {
      try {
        this.recorder.kill('SIGTERM')
      } catch {
        // Process may have already exited
      }
      this.recorder = null
    }

    // Kill player
    this.stopPlayback()

    // Clear session timer
    if (this.sessionTimer !== null) {
      clearTimeout(this.sessionTimer)
      this.sessionTimer = null
    }

    // Clear reconnect timer
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    this.setupDone = false
  }
}
