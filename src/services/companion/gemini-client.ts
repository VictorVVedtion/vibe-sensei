/**
 * Gemini API REST client for multimodal chart analysis.
 *
 * Sends chart screenshot images (base64 JPEG/PNG) to Gemini 2.5 Flash
 * and returns text analysis. Uses raw fetch — no SDK dependency.
 *
 * Environment: GEMINI_API_KEY must be set. If absent, isAvailable()
 * returns false and all calls are silently skipped upstream.
 */

// ── Error Types ──────────────────────────────────────────────────────────

export class GeminiRateLimitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GeminiRateLimitError'
  }
}

export class GeminiAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GeminiAuthError'
  }
}

export class GeminiTimeoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GeminiTimeoutError'
  }
}

export class GeminiParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GeminiParseError'
  }
}

// ── Types ────────────────────────────────────────────────────────────────

interface GeminiRequestBody {
  contents: Array<{
    parts: Array<
      | { text: string }
      | { inlineData: { mimeType: string; data: string } }
    >
  }>
  generationConfig: {
    temperature: number
    maxOutputTokens: number
  }
}

interface GeminiResponseShape {
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

// ── Constants ────────────────────────────────────────────────────────────

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const DEFAULT_MODEL = 'gemini-2.5-flash'
const REQUEST_TIMEOUT_MS = 15_000
const DEFAULT_TEMPERATURE = 0.7
const DEFAULT_MAX_TOKENS = 500

// ── Client ───────────────────────────────────────────────────────────────

export class GeminiClient {
  private readonly apiKey: string
  private readonly model: string

  constructor(model?: string) {
    this.apiKey = process.env.GEMINI_API_KEY ?? ''
    this.model = model ?? DEFAULT_MODEL
  }

  /** Whether the client has a valid API key configured. */
  isAvailable(): boolean {
    return this.apiKey.length > 0
  }

  /**
   * Send an image (base64) with a text prompt and get a text response.
   *
   * @param imageBase64 - Base64-encoded image data (without data URL prefix)
   * @param prompt - Text prompt describing what analysis to perform
   * @param mimeType - Image MIME type, defaults to 'image/png'
   * @returns The model's text response
   * @throws GeminiAuthError on 401/403
   * @throws GeminiRateLimitError on 429
   * @throws GeminiTimeoutError on request timeout
   * @throws GeminiParseError on empty or malformed response
   */
  async analyzeImage(
    imageBase64: string,
    prompt: string,
    mimeType: string = 'image/png',
  ): Promise<string> {
    if (!this.isAvailable()) {
      throw new GeminiAuthError('API key is not set')
    }

    const url = `${API_BASE}/${this.model}:generateContent`

    const body: GeminiRequestBody = {
      contents: [
        {
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: imageBase64 } },
          ],
        },
      ],
      generationConfig: {
        temperature: DEFAULT_TEMPERATURE,
        maxOutputTokens: DEFAULT_MAX_TOKENS,
      },
    }

    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'TimeoutError') {
        throw new GeminiTimeoutError(
          `API request timed out after ${REQUEST_TIMEOUT_MS}ms`,
        )
      }
      if (err instanceof Error && err.name === 'AbortError') {
        throw new GeminiTimeoutError('API request was aborted')
      }
      throw new GeminiTimeoutError(
        `API request failed: ${err instanceof Error ? err.message : String(err)}`,
      )
    }

    // Handle HTTP error codes
    if (response.status === 401 || response.status === 403) {
      throw new GeminiAuthError(
        `API authentication failed (HTTP ${response.status})`,
      )
    }

    if (response.status === 429) {
      throw new GeminiRateLimitError('API rate limit exceeded (HTTP 429)')
    }

    if (!response.ok) {
      let errorMessage = `API error (HTTP ${response.status})`
      try {
        const errorBody = (await response.json()) as GeminiResponseShape
        if (errorBody.error?.message) {
          errorMessage += `: ${errorBody.error.message}`
        }
      } catch {
        // Could not parse error body — use generic message
      }
      throw new GeminiParseError(errorMessage)
    }

    // Parse response
    let data: GeminiResponseShape
    try {
      data = (await response.json()) as GeminiResponseShape
    } catch {
      throw new GeminiParseError('Failed to parse API response as JSON')
    }

    // Extract text from response
    const text = extractResponseText(data)
    if (!text) {
      throw new GeminiParseError(
        'API returned empty or malformed response — no text in candidates',
      )
    }

    return text
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * Extract the text content from an API response.
 * Tries multiple paths to be resilient against minor schema variations.
 */
function extractResponseText(data: GeminiResponseShape): string | null {
  // Standard path: candidates[0].content.parts[0].text
  const candidates = data.candidates
  if (!candidates || candidates.length === 0) return null

  const firstCandidate = candidates[0]
  if (!firstCandidate) return null

  const content = firstCandidate.content
  if (!content) return null

  const parts = content.parts
  if (!parts || parts.length === 0) return null

  // Find the first part with text
  for (const part of parts) {
    if (part.text && part.text.trim().length > 0) {
      return part.text.trim()
    }
  }

  return null
}
