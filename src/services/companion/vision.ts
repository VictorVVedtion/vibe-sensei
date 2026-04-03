/**
 * VisionService — orchestrates chart screenshot capture and AI analysis.
 *
 * Combines ChartCapture (screenshot fetching) with GeminiClient (multimodal
 * analysis) to let trading masters "see" and comment on K-line charts.
 *
 * The service is fully optional:
 *   - No GEMINI_API_KEY → disabled (isAvailable() = false)
 *   - No :3456 web server → chart capture returns null, analysis skipped
 *   - Any error → returns null, never throws to callers
 *
 * Masters comment in character based on their archetype. The prompt steers
 * the AI to analyze trend direction, chart patterns, support/resistance
 * levels, and volume changes in the master's voice.
 */

import type { Archetype } from '../../buddy/persona.js'
import { GeminiClient } from './gemini-client.js'
import { ChartCapture } from './chart-capture.js'

// ── Archetype Descriptions ───────────────────────────────────────────────

const ARCHETYPE_DESCRIPTIONS: Record<Archetype, string> = {
  value_investor: 'value investor focused on fundamentals and margin of safety',
  trend_follower: 'trend follower focused on price momentum and breakouts',
  macro_trader: 'macro trader focused on market cycles and macro factors',
  quant: 'quantitative trader focused on statistical patterns and probability',
  strategist: 'strategist focused on the big picture and timing',
  philosopher: 'philosopher focused on market nature and human behavior',
  first_principles: 'first principles thinker reasoning from fundamental facts',
  crypto_native: 'crypto native trader focused on on-chain data and narratives',
  scientist: 'scientist focused on data patterns and hypothesis testing',
}

// ── VisionService ────────────────────────────────────────────────────────

export class VisionService {
  private readonly geminiClient: GeminiClient
  private readonly chartCapture: ChartCapture

  constructor() {
    this.geminiClient = new GeminiClient()
    this.chartCapture = new ChartCapture()
  }

  /**
   * Whether the vision system is available.
   * Requires GEMINI_API_KEY to be configured.
   */
  isAvailable(): boolean {
    return this.geminiClient.isAvailable()
  }

  /**
   * Analyze the current chart displayed on the :3456 web server.
   *
   * Captures a screenshot, sends it to Gemini with a persona-aware prompt,
   * and returns the master's commentary. Returns null if any step fails.
   *
   * @param masterArchetype - The master's archetype (e.g. 'trend_follower')
   * @param masterName - The master's display name (e.g. 'Jesse Livermore')
   * @returns The master's chart analysis text, or null
   */
  async analyzeChart(
    masterArchetype: Archetype,
    masterName: string,
  ): Promise<string | null> {
    if (!this.isAvailable()) {
      return null
    }

    try {
      // Step 1: Capture chart screenshot
      const imageBase64 = await this.chartCapture.capture()
      if (!imageBase64) {
        return null
      }

      // Step 2: Build persona-aware analysis prompt
      const prompt = buildAnalysisPrompt(masterArchetype, masterName)

      // Step 3: Send to multimodal AI
      const analysis = await this.geminiClient.analyzeImage(
        imageBase64,
        prompt,
        'image/png',
      )

      return analysis
    } catch (err: unknown) {
      console.error(
        '[VisionService] Chart analysis failed:',
        err instanceof Error ? err.message : String(err),
      )
      return null
    }
  }

  /**
   * Analyze a chart from a user-provided image file.
   *
   * Used when the web server is not running but the user has a chart
   * screenshot they want the master to comment on.
   *
   * @param filePath - Absolute path to a chart image (PNG/JPEG)
   * @param masterArchetype - The master's archetype
   * @param masterName - The master's display name
   * @returns The master's chart analysis text, or null
   */
  async analyzeChartFromFile(
    filePath: string,
    masterArchetype: Archetype,
    masterName: string,
  ): Promise<string | null> {
    if (!this.isAvailable()) {
      return null
    }

    try {
      const imageBase64 = await this.chartCapture.captureFromFile(filePath)
      if (!imageBase64) {
        return null
      }

      const prompt = buildAnalysisPrompt(masterArchetype, masterName)
      const mimeType = ChartCapture.mimeTypeFromPath(filePath)

      const analysis = await this.geminiClient.analyzeImage(
        imageBase64,
        prompt,
        mimeType,
      )

      return analysis
    } catch (err: unknown) {
      console.error(
        '[VisionService] File chart analysis failed:',
        err instanceof Error ? err.message : String(err),
      )
      return null
    }
  }

  /**
   * Check if the chart web server is currently running and available.
   * Does not require GEMINI_API_KEY — only checks the chart server.
   */
  async isChartServerAvailable(): Promise<boolean> {
    return this.chartCapture.isAvailable()
  }
}

// ── Prompt Builder ───────────────────────────────────────────────────────

/**
 * Build the analysis prompt that steers the AI to respond in-character.
 * The prompt is in Chinese as specified by the sprint contract.
 */
function buildAnalysisPrompt(archetype: Archetype, masterName: string): string {
  const archetypeDesc = ARCHETYPE_DESCRIPTIONS[archetype] ?? 'experienced trader'

  return [
    `You are ${masterName}, a ${archetypeDesc} style trading master.`,
    'Analyze this K-line chart and give a brief commentary (2-3 sentences).',
    'Focus on: trend direction, key chart patterns, support/resistance levels, volume changes.',
    'Respond in Chinese. Stay in character throughout.',
    `Do not say "as an AI" or "based on the chart" — speak directly as ${masterName}.`,
  ].join('\n')
}
