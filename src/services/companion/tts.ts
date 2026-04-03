/**
 * TTSService — Text-to-Speech via the Gemini 2.5 Flash Preview TTS API.
 *
 * Converts trading master messages to spoken audio using per-archetype
 * voice profiles. Audio is played through the system audio player
 * (afplay on macOS, aplay on Linux) as a fire-and-forget background task.
 *
 * The service is fully optional:
 *   - No GEMINI_API_KEY -> disabled (isAvailable() = false)
 *   - API timeout/error -> silently skipped, text message still delivered
 *   - Unsupported platform -> silently disabled
 *   - All errors are caught and logged, never thrown to callers
 */

import { spawn, type ChildProcess } from 'child_process'
import { writeFileSync, unlinkSync, existsSync } from 'fs'
import type { VoiceProfile } from './voice-config.js'

// ── Constants ────────────────────────────────────────────────────────────

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const TTS_MODEL = 'gemini-2.5-flash-preview-tts'
const REQUEST_TIMEOUT_MS = 15_000

/** Maximum text length sent to TTS. Longer messages are truncated. */
const MAX_TEXT_LENGTH = 500

// ── WAV Header ───────────────────────────────────────────────────────────

/**
 * Construct a WAV file header for raw PCM data.
 *
 * The TTS API may return raw PCM audio (24kHz, 16-bit, mono) without
 * a WAV container. System audio players need a proper WAV header to
 * decode sample rate, bit depth, and channel count.
 *
 * @param pcmData - Raw PCM audio bytes
 * @param sampleRate - Samples per second (default 24000)
 * @param channels - Number of audio channels (default 1 = mono)
 * @param bitsPerSample - Bits per sample (default 16)
 * @returns Complete WAV file buffer (header + PCM data)
 */
function createWavBuffer(
  pcmData: Buffer,
  sampleRate: number = 24000,
  channels: number = 1,
  bitsPerSample: number = 16,
): Buffer {
  const header = Buffer.alloc(44)
  const dataSize = pcmData.length
  const fileSize = dataSize + 36

  // RIFF chunk descriptor
  header.write('RIFF', 0)
  header.writeUInt32LE(fileSize, 4)
  header.write('WAVE', 8)

  // fmt sub-chunk
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)                                          // Sub-chunk size (16 for PCM)
  header.writeUInt16LE(1, 20)                                           // Audio format (1 = PCM)
  header.writeUInt16LE(channels, 22)                                    // Number of channels
  header.writeUInt32LE(sampleRate, 24)                                  // Sample rate
  header.writeUInt32LE(sampleRate * channels * bitsPerSample / 8, 28)   // Byte rate
  header.writeUInt16LE(channels * bitsPerSample / 8, 32)                // Block align
  header.writeUInt16LE(bitsPerSample, 34)                               // Bits per sample

  // data sub-chunk
  header.write('data', 36)
  header.writeUInt32LE(dataSize, 40)

  return Buffer.concat([header, pcmData])
}

// ── Platform Detection ───────────────────────────────────────────────────

interface AudioPlayer {
  command: string
  args: (filePath: string) => string[]
}

/**
 * Detect the system audio player available on the current platform.
 * Returns null if no supported player is found.
 */
function detectAudioPlayer(): AudioPlayer | null {
  const platform = process.platform

  if (platform === 'darwin') {
    return {
      command: 'afplay',
      args: (filePath: string) => [filePath],
    }
  }

  if (platform === 'linux') {
    return {
      command: 'aplay',
      args: (filePath: string) => [filePath],
    }
  }

  if (platform === 'win32') {
    return {
      command: 'powershell',
      args: (filePath: string) => [
        '-c',
        `(New-Object Media.SoundPlayer '${filePath}').PlaySync()`,
      ],
    }
  }

  return null
}

// ── Response Types ───────────────────────────────────────────────────────

interface TTSResponseShape {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: {
          mimeType?: string
          data?: string
        }
      }>
    }
  }>
  error?: {
    code?: number
    message?: string
  }
}

// ── TTSService ───────────────────────────────────────────────────────────

export class TTSService {
  private readonly apiKey: string
  private readonly model: string = TTS_MODEL
  private readonly audioPlayer: AudioPlayer | null
  private currentPlayer: ChildProcess | null = null

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY ?? ''
    this.audioPlayer = detectAudioPlayer()
  }

  /**
   * Whether TTS is available.
   * Requires both an API key and a supported audio player.
   */
  isAvailable(): boolean {
    return this.apiKey.length > 0 && this.audioPlayer !== null
  }

  /**
   * Convert text to speech and play it through the system audio player.
   *
   * This is a fire-and-forget operation designed to run alongside text
   * message delivery. Errors are logged but never thrown.
   *
   * @param text - The message text to speak
   * @param voice - Voice profile defining voice name, style, and rate
   */
  async speak(text: string, voice: VoiceProfile): Promise<void> {
    if (!this.isAvailable()) return

    // Stop any currently playing audio
    this.stop()

    try {
      const audioBase64 = await this.callTTSApi(text, voice)
      if (!audioBase64) return

      await this.playAudio(audioBase64)
    } catch (err: unknown) {
      console.error(
        '[TTSService] speak error:',
        err instanceof Error ? err.message : String(err),
      )
    }
  }

  /**
   * Stop the currently playing audio, if any.
   * Safe to call even when nothing is playing.
   */
  stop(): void {
    if (this.currentPlayer) {
      try {
        this.currentPlayer.kill()
      } catch {
        // Process may have already exited
      }
      this.currentPlayer = null
    }
  }

  // ── Private: API Call ──────────────────────────────────────────────────

  /**
   * Call the TTS API and return the base64-encoded audio data.
   *
   * @param text - Text to convert to speech
   * @param voice - Voice profile with name, style prompt, and speaking rate
   * @returns Base64-encoded audio data, or null on failure
   */
  private async callTTSApi(
    text: string,
    voice: VoiceProfile,
  ): Promise<string | null> {
    // Prepend style prompt and truncate if needed
    const styledText = `${voice.stylePrompt}\n\n${text.slice(0, MAX_TEXT_LENGTH)}`

    const url = `${API_BASE}/${this.model}:generateContent?key=${this.apiKey}`

    const body = {
      contents: [
        {
          parts: [{ text: styledText }],
        },
      ],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voice.voiceName,
            },
          },
        },
      },
    }

    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
    } catch (err: unknown) {
      if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
        console.error('[TTSService] API request timed out')
        return null
      }
      console.error(
        '[TTSService] API request failed:',
        err instanceof Error ? err.message : String(err),
      )
      return null
    }

    // Handle HTTP errors
    if (response.status === 429) {
      console.error('[TTSService] API rate limit exceeded (HTTP 429)')
      return null
    }

    if (response.status === 401 || response.status === 403) {
      console.error(`[TTSService] API authentication failed (HTTP ${response.status})`)
      return null
    }

    if (!response.ok) {
      console.error(`[TTSService] API error (HTTP ${response.status})`)
      return null
    }

    // Parse response
    let data: TTSResponseShape
    try {
      data = (await response.json()) as TTSResponseShape
    } catch {
      console.error('[TTSService] Failed to parse API response as JSON')
      return null
    }

    // Handle API-level errors
    if (data.error) {
      console.error(
        `[TTSService] API error: ${data.error.message ?? 'unknown'}`,
      )
      return null
    }

    // Extract audio data from response
    const audioData = extractAudioData(data)
    if (!audioData) {
      console.error('[TTSService] No audio data in API response')
      return null
    }

    return audioData.data
  }

  // ── Private: Audio Playback ────────────────────────────────────────────

  /**
   * Decode base64 audio, write to a temp WAV file, and play it.
   *
   * If the API returns raw PCM data, a WAV header is prepended.
   * The temp file is cleaned up when playback finishes.
   *
   * @param audioBase64 - Base64-encoded audio data from the API
   */
  private async playAudio(audioBase64: string): Promise<void> {
    if (!this.audioPlayer) return

    const tmpFile = `/tmp/vibe-tts-${Date.now()}.wav`
    const rawBuffer = Buffer.from(audioBase64, 'base64')

    // Check if the data already has a WAV header (starts with "RIFF")
    const hasWavHeader =
      rawBuffer.length > 4 &&
      rawBuffer[0] === 0x52 && // R
      rawBuffer[1] === 0x49 && // I
      rawBuffer[2] === 0x46 && // F
      rawBuffer[3] === 0x46    // F

    const wavBuffer = hasWavHeader ? rawBuffer : createWavBuffer(rawBuffer)

    try {
      writeFileSync(tmpFile, wavBuffer)
    } catch (err: unknown) {
      console.error(
        '[TTSService] Failed to write temp audio file:',
        err instanceof Error ? err.message : String(err),
      )
      return
    }

    const player = spawn(
      this.audioPlayer.command,
      this.audioPlayer.args(tmpFile),
      { stdio: 'ignore' },
    )

    this.currentPlayer = player

    player.on('close', () => {
      // Clean up temp file
      try {
        if (existsSync(tmpFile)) {
          unlinkSync(tmpFile)
        }
      } catch {
        // Best-effort cleanup
      }

      // Clear reference if this is still the current player
      if (this.currentPlayer === player) {
        this.currentPlayer = null
      }
    })

    player.on('error', (err: Error) => {
      console.error('[TTSService] Audio player error:', err.message)

      // Clean up temp file on error
      try {
        if (existsSync(tmpFile)) {
          unlinkSync(tmpFile)
        }
      } catch {
        // Best-effort cleanup
      }

      if (this.currentPlayer === player) {
        this.currentPlayer = null
      }
    })
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * Extract audio data from the TTS API response.
 * Returns the base64 data string and mime type if found.
 */
function extractAudioData(
  data: TTSResponseShape,
): { data: string; mimeType: string } | null {
  const candidates = data.candidates
  if (!candidates || candidates.length === 0) return null

  const firstCandidate = candidates[0]
  if (!firstCandidate?.content?.parts) return null

  for (const part of firstCandidate.content.parts) {
    if (part.inlineData?.data && part.inlineData.data.length > 0) {
      return {
        data: part.inlineData.data,
        mimeType: part.inlineData.mimeType ?? 'audio/pcm',
      }
    }
  }

  return null
}
