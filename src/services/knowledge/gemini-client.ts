/**
 * Shared Gemini API Client — centralized LLM call for knowledge subsystem.
 *
 * Moves the API key from URL query parameter to the `x-goog-api-key` HTTP
 * header, preventing key exposure in process listings, proxy logs, and
 * debug traces.
 *
 * Used by: compiler.ts, auditor.ts, morning-brief.ts
 */

// ── Constants ─────────────────────────────────────────────────────────────────

const LLM_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const DEFAULT_MODEL = 'gemini-2.5-flash'
const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_MAX_TOKENS = 4000

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GeminiCallOptions {
  /** The prompt text to send. */
  prompt: string
  /** Optional system instruction for the model. */
  systemInstruction?: string
  /** Maximum output tokens. Defaults to 4000. */
  maxTokens?: number
  /** Request timeout in milliseconds. Defaults to 30000. */
  timeoutMs?: number
  /** Temperature for generation. Defaults to 0.3. */
  temperature?: number
  /** Model name override. Defaults to gemini-2.5-flash. */
  model?: string
}

export interface GeminiResult {
  text: string
}

interface GeminiResponseShape {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>
    }
  }>
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Call Gemini API with the given prompt. API key is sent via header,
 * not as a URL query parameter.
 *
 * @returns `{ text }` on success, `null` on any failure.
 */
export async function callGemini(
  options: GeminiCallOptions,
): Promise<GeminiResult | null> {
  const apiKey = process.env.GEMINI_API_KEY ?? ''
  if (apiKey.length === 0) return null

  const model = options.model ?? DEFAULT_MODEL
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS
  const temperature = options.temperature ?? 0.3

  // Build URL without API key in query params
  const url = `${LLM_API_BASE}/${model}:generateContent`

  // Build request body
  const body: Record<string, unknown> = {
    contents: [{ parts: [{ text: options.prompt }] }],
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  }

  if (options.systemInstruction) {
    body.systemInstruction = {
      parts: [{ text: options.systemInstruction }],
    }
  }

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[Gemini Client] request failed: ${msg}`)
    return null
  }

  if (!response.ok) {
    const status = response.status
    if (status === 429) {
      console.warn('[Gemini Client] rate limited (429)')
    } else if (status === 401 || status === 403) {
      console.warn(`[Gemini Client] auth error (${status}) — check GEMINI_API_KEY`)
    } else {
      console.warn(`[Gemini Client] HTTP ${status}`)
    }
    return null
  }

  try {
    const data = (await response.json()) as GeminiResponseShape
    const text = extractText(data)
    if (!text) {
      console.warn('[Gemini Client] empty or malformed response')
      return null
    }
    return { text }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[Gemini Client] failed to parse response: ${msg}`)
    return null
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Extract text from Gemini response, trying the standard candidate path. */
function extractText(data: GeminiResponseShape): string | undefined {
  const parts = data.candidates?.[0]?.content?.parts
  if (!parts) return undefined
  for (const part of parts) {
    if (part.text && part.text.trim().length > 0) return part.text.trim()
  }
  return undefined
}
