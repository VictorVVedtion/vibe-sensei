/**
 * STTService — Speech-to-Text via sox recording + multimodal AI transcription.
 *
 * Records audio from the microphone using the `sox` CLI tool, encodes the
 * resulting WAV file as base64, and sends it to the transcription API for
 * speech recognition. Push-to-talk model: caller invokes startRecording() on
 * key press and stopAndTranscribe() on key release.
 *
 * The service is fully optional and degrades gracefully:
 *   - No API key -> disabled (isAvailable() = false)
 *   - No `sox` installed -> disabled, logs install hint
 *   - Recording failure -> returns null
 *   - Transcription failure -> returns null
 *   - All errors are caught and logged, never thrown to callers
 *
 * Audio constraints:
 *   - Format: WAV, 16 kHz, mono, 16-bit PCM
 *   - Max recording duration: 30 seconds (auto-stop)
 *   - Files below 1 KB are treated as silence and skipped
 *   - Transcription API timeout: 15 seconds
 */

import { spawn, execSync, type ChildProcess } from 'child_process'
import { readFileSync, unlinkSync, existsSync, statSync } from 'fs'

// ── Constants ────────────────────────────────────────────────────────────

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const STT_MODEL = 'gemini-2.5-flash'
const TRANSCRIPTION_TIMEOUT_MS = 15_000

/** Maximum recording duration in milliseconds. Auto-stops after this. */
const MAX_RECORDING_DURATION_MS = 30_000

/** Files smaller than this (bytes) are treated as silence. */
const MIN_AUDIO_FILE_SIZE = 1024

/** Transcription prompt — instructs the model to return only the text. */
const TRANSCRIPTION_PROMPT =
  'Transcribe the following audio to text. Output ONLY the transcription, nothing else. No explanations, no formatting, no quotation marks.'

// ── sox Detection ────────────────────────────────────────────────────────

/**
 * Check whether `sox` (or its `rec` frontend) is available on the system.
 * Caches the result after the first call.
 */
let soxAvailableCache: boolean | null = null

function isSoxInstalled(): boolean {
  if (soxAvailableCache !== null) return soxAvailableCache

  try {
    execSync('which sox', { stdio: 'ignore' })
    soxAvailableCache = true
    return true
  } catch {
    // Try `rec` as a fallback (sox alias on some systems)
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

// ── API Response Types ───────────────────────────────────────────────────

interface TranscriptionResponseShape {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string
      }>
    }
  }>
  error?: {
    code?: number
    message?: string
  }
}

// ── STTService ───────────────────────────────────────────────────────────

export class STTService {
  private readonly apiKey: string
  private recording: boolean = false
  private recorderProcess: ChildProcess | null = null
  private recordingFile: string | null = null
  private maxDurationTimer: ReturnType<typeof setTimeout> | null = null

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY ?? ''

    // Log a helpful hint if sox is missing (only once at construction)
    if (this.apiKey.length > 0 && !isSoxInstalled()) {
      console.error(
        '[STTService] sox not found. Install it to enable voice input: brew install sox',
      )
    }
  }

  /**
   * Whether STT is available.
   * Requires both an API key and sox installed.
   */
  isAvailable(): boolean {
    return this.apiKey.length > 0 && isSoxInstalled()
  }

  /** Whether a recording is currently in progress. */
  isRecording(): boolean {
    return this.recording
  }

  /**
   * Start recording audio from the default microphone.
   *
   * The recording is saved to a temporary WAV file. If a recording is
   * already in progress, this call is ignored. A safety timer auto-stops
   * the recording after MAX_RECORDING_DURATION_MS.
   */
  async startRecording(): Promise<void> {
    if (this.recording) return
    if (!this.isAvailable()) return

    const tmpFile = `/tmp/vibe-stt-${Date.now()}.wav`
    this.recordingFile = tmpFile
    this.recording = true

    try {
      // sox -d: record from default audio device
      // -t wav: output WAV format
      // -r 16000: 16 kHz sample rate
      // -c 1: mono channel
      // -b 16: 16-bit depth
      const proc = spawn(
        'sox',
        ['-d', '-t', 'wav', '-r', '16000', '-c', '1', '-b', '16', tmpFile],
        { stdio: 'ignore' },
      )

      this.recorderProcess = proc

      proc.on('error', (err: Error) => {
        console.error('[STTService] Recorder process error:', err.message)
        this.cleanupRecording()
      })

      // Safety: auto-stop after max duration
      this.maxDurationTimer = setTimeout(() => {
        if (this.recording) {
          this.stopRecorder()
        }
      }, MAX_RECORDING_DURATION_MS)
    } catch (err: unknown) {
      console.error(
        '[STTService] Failed to start recording:',
        err instanceof Error ? err.message : String(err),
      )
      this.cleanupRecording()
    }
  }

  /**
   * Stop the current recording and transcribe the audio via the API.
   *
   * @returns The transcribed text, or null if:
   *   - No recording was in progress
   *   - The recorded file is too small (silence)
   *   - The transcription API call failed
   */
  async stopAndTranscribe(): Promise<string | null> {
    if (!this.recording) return null

    // Stop the recorder process
    this.stopRecorder()

    const audioFile = this.recordingFile
    this.recordingFile = null

    if (!audioFile) return null

    try {
      // Wait a beat for sox to flush its buffers and finalize the WAV file
      await new Promise((resolve) => setTimeout(resolve, 200))

      // Verify the file exists and is large enough
      if (!existsSync(audioFile)) {
        console.error('[STTService] Recording file not found:', audioFile)
        return null
      }

      const stat = statSync(audioFile)
      if (stat.size < MIN_AUDIO_FILE_SIZE) {
        // File too small — likely silence or near-empty recording
        this.cleanupFile(audioFile)
        return null
      }

      // Read and encode to base64
      const audioBuffer = readFileSync(audioFile)
      const audioBase64 = audioBuffer.toString('base64')

      // Clean up the temp file before making the API call
      this.cleanupFile(audioFile)

      // Send to the transcription API
      return await this.transcribe(audioBase64)
    } catch (err: unknown) {
      console.error(
        '[STTService] Stop and transcribe error:',
        err instanceof Error ? err.message : String(err),
      )
      if (audioFile) this.cleanupFile(audioFile)
      return null
    }
  }

  // ── Private: Recording Control ────────────────────────────────────────

  /**
   * Terminate the sox recorder process gracefully.
   * Sends SIGTERM first (sox writes a valid WAV header on clean exit),
   * then clears the safety timer.
   */
  private stopRecorder(): void {
    if (this.maxDurationTimer !== null) {
      clearTimeout(this.maxDurationTimer)
      this.maxDurationTimer = null
    }

    if (this.recorderProcess) {
      try {
        // SIGTERM lets sox finalize the WAV header properly
        this.recorderProcess.kill('SIGTERM')
      } catch {
        // Process may have already exited
      }
      this.recorderProcess = null
    }

    this.recording = false
  }

  /** Reset recording state without stopping any process. */
  private cleanupRecording(): void {
    if (this.maxDurationTimer !== null) {
      clearTimeout(this.maxDurationTimer)
      this.maxDurationTimer = null
    }
    this.recorderProcess = null
    this.recording = false
    if (this.recordingFile) {
      this.cleanupFile(this.recordingFile)
      this.recordingFile = null
    }
  }

  /** Best-effort temp file removal. */
  private cleanupFile(filePath: string): void {
    try {
      if (existsSync(filePath)) {
        unlinkSync(filePath)
      }
    } catch {
      // Best-effort cleanup — don't propagate
    }
  }

  // ── Private: Transcription ────────────────────────────────────────────

  /**
   * Send base64-encoded WAV audio to the multimodal API for transcription.
   *
   * @param audioBase64 - Base64-encoded WAV audio data
   * @returns Transcribed text, or null on failure
   */
  private async transcribe(audioBase64: string): Promise<string | null> {
    const url = `${API_BASE}/${STT_MODEL}:generateContent`

    const body = {
      contents: [
        {
          parts: [
            { text: TRANSCRIPTION_PROMPT },
            {
              inlineData: {
                mimeType: 'audio/wav',
                data: audioBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 500,
      },
    }

    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TRANSCRIPTION_TIMEOUT_MS),
      })
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        (err.name === 'TimeoutError' || err.name === 'AbortError')
      ) {
        console.error(
          `[STTService] Transcription API timed out after ${TRANSCRIPTION_TIMEOUT_MS}ms`,
        )
        return null
      }
      console.error(
        '[STTService] Transcription API request failed:',
        err instanceof Error ? err.message : String(err),
      )
      return null
    }

    // Handle HTTP errors
    if (response.status === 429) {
      console.error('[STTService] API rate limit exceeded (HTTP 429)')
      return null
    }

    if (response.status === 401 || response.status === 403) {
      console.error(
        `[STTService] API authentication failed (HTTP ${response.status})`,
      )
      return null
    }

    if (!response.ok) {
      console.error(`[STTService] API error (HTTP ${response.status})`)
      return null
    }

    // Parse response
    let data: TranscriptionResponseShape
    try {
      data = (await response.json()) as TranscriptionResponseShape
    } catch {
      console.error('[STTService] Failed to parse API response as JSON')
      return null
    }

    // Handle API-level errors
    if (data.error) {
      console.error(
        `[STTService] API error: ${data.error.message ?? 'unknown'}`,
      )
      return null
    }

    // Extract transcribed text
    const text = this.extractText(data)
    if (!text) {
      console.error('[STTService] No text in API response')
      return null
    }

    return text
  }

  /**
   * Extract the text content from the API response.
   * Searches through all candidate parts for the first non-empty text.
   */
  private extractText(data: TranscriptionResponseShape): string | null {
    const candidates = data.candidates
    if (!candidates || candidates.length === 0) return null

    const firstCandidate = candidates[0]
    if (!firstCandidate?.content?.parts) return null

    for (const part of firstCandidate.content.parts) {
      if (part.text && part.text.trim().length > 0) {
        return part.text.trim()
      }
    }

    return null
  }
}
