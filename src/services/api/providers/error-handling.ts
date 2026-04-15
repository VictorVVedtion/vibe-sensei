/**
 * Error classification and retry logic for multi-provider HTTP calls.
 *
 * classifyHttpError() normalizes provider-specific error shapes into
 * a uniform ClassifiedError, and fetchWithRetry() adds exponential
 * backoff for transient failures (429, 5xx).
 */

// ---------------------------------------------------------------------------
// Classified error type
// ---------------------------------------------------------------------------

export type ErrorType =
  | 'auth'
  | 'not_found'
  | 'rate_limit'
  | 'server_error'
  | 'timeout'
  | 'context_length'
  | 'content_filter'
  | 'network'
  | 'unknown'

export type ClassifiedError = {
  type: ErrorType
  message: string
  retryable: boolean
  retryAfterMs: number | null
  suggestion: string
  httpStatus?: number
  rawBody?: string
}

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

/**
 * Classify an HTTP error response into a uniform shape.
 */
export function classifyHttpError(
  provider: string,
  status: number,
  body: string,
): ClassifiedError {
  // Auth errors
  if (status === 401 || status === 403) {
    return {
      type: 'auth',
      message: `Authentication failed for ${provider}`,
      retryable: false,
      retryAfterMs: null,
      suggestion: `Check your API key. Run /provider auth ${provider} to verify.`,
      httpStatus: status,
      rawBody: body,
    }
  }

  // Rate limit
  if (status === 429) {
    // Distinguish two 429 shapes Google Cloud Code Assist returns:
    //   1. MODEL_CAPACITY_EXHAUSTED — the backend has no quota for this
    //      model on this tier (e.g. gemini-3.1-pro-preview on free tier).
    //      Retrying won't help — the user needs a different model.
    //   2. RATE_LIMIT_EXCEEDED — transient per-minute/per-second throttle
    //      with a "quota will reset after Ns" hint. Retry AFTER N seconds.
    // Before this distinction, any "RESOURCE_EXHAUSTED" was marked
    // non-retryable, which killed legitimate rate-limit recovery.
    const isPermanentCapacityGap = /MODEL_CAPACITY_EXHAUSTED/i.test(body)
    if (isPermanentCapacityGap) {
      return {
        type: 'rate_limit',
        message: `Model capacity exhausted on ${provider}`,
        retryable: false,
        retryAfterMs: null,
        suggestion: 'This model has no capacity on your current tier. Try a different model (e.g. /model and pick gemini-3-flash-preview or gemini-2.5-pro) or use a paid API key.',
        httpStatus: status,
        rawBody: body,
      }
    }
    // Google's body often contains "quota will reset after 32s" or
    // "Retry after 500ms" in natural language — honor that when parsing
    // retry-after.
    const retryAfter =
      parseGoogleResetAfter(body) ?? parseRetryAfter(body)
    return {
      type: 'rate_limit',
      message: `Rate limited by ${provider}`,
      retryable: true,
      retryAfterMs: retryAfter,
      suggestion: retryAfter && retryAfter > 10_000
        ? `Rate limited. Waiting ~${Math.round(retryAfter / 1000)}s for reset...`
        : 'Waiting for rate limit to reset...',
      httpStatus: status,
      rawBody: body,
    }
  }

  // Model not found
  if (status === 404) {
    return {
      type: 'not_found',
      message: `Model not found on ${provider}`,
      retryable: false,
      retryAfterMs: null,
      suggestion: `Check the model name. Run /provider list ${provider} to see available models.`,
      httpStatus: status,
      rawBody: body,
    }
  }

  // Context length exceeded
  if (status === 400 && isContextLengthError(body)) {
    return {
      type: 'context_length',
      message: `Context length exceeded on ${provider}`,
      retryable: false,
      retryAfterMs: null,
      suggestion: 'Try /compact to reduce context size, or switch to a model with a larger context window.',
      httpStatus: status,
      rawBody: body,
    }
  }

  // Content filter
  if (status === 400 && isContentFilterError(body)) {
    return {
      type: 'content_filter',
      message: `Content filtered by ${provider}`,
      retryable: false,
      retryAfterMs: null,
      suggestion: 'The provider refused the request due to content policy.',
      httpStatus: status,
      rawBody: body,
    }
  }

  // Server errors
  if (status >= 500) {
    return {
      type: 'server_error',
      message: `Server error from ${provider} (${status})`,
      retryable: true,
      retryAfterMs: 2000,
      suggestion: `${provider} is experiencing issues. Retrying...`,
      httpStatus: status,
      rawBody: body,
    }
  }

  // Other 4xx
  if (status >= 400 && status < 500) {
    return {
      type: 'unknown',
      message: `Request error from ${provider} (${status}): ${truncate(body, 200)}`,
      retryable: false,
      retryAfterMs: null,
      suggestion: 'Check the request parameters.',
      httpStatus: status,
      rawBody: body,
    }
  }

  return {
    type: 'unknown',
    message: `Unexpected response from ${provider} (${status})`,
    retryable: false,
    retryAfterMs: null,
    suggestion: '',
    httpStatus: status,
    rawBody: body,
  }
}

// ---------------------------------------------------------------------------
// Fetch with retry (exponential backoff)
// ---------------------------------------------------------------------------

export type FetchWithRetryOptions = {
  maxRetries?: number
  baseDelayMs?: number
  maxDelayMs?: number
  signal?: AbortSignal
}

/**
 * Fetch with exponential backoff for transient errors (429, 5xx).
 * On non-retryable errors, throws immediately with a ClassifiedError.
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  provider: string,
  options: FetchWithRetryOptions = {},
): Promise<Response> {
  const { maxRetries = 3, baseDelayMs = 1000, maxDelayMs = 30000, signal } = options

  let lastError: ClassifiedError | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) {
      throw new Error('Request aborted')
    }

    try {
      const response = await fetch(url, { ...init, signal })

      if (response.ok) {
        return response
      }

      const body = await response.text()
      const classified = classifyHttpError(provider, response.status, body)
      lastError = classified

      if (!classified.retryable || attempt === maxRetries) {
        throw new ProviderHttpError(classified)
      }

      // Wait before retry
      const delay = classified.retryAfterMs
        ?? Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs)
      await sleep(delay, signal)

    } catch (error) {
      if (error instanceof ProviderHttpError) {
        throw error
      }

      // Network errors
      if (error instanceof TypeError && (error as Error).message.includes('fetch')) {
        lastError = {
          type: 'network',
          message: `Network error connecting to ${provider}: ${(error as Error).message}`,
          retryable: attempt < maxRetries,
          retryAfterMs: baseDelayMs * Math.pow(2, attempt),
          suggestion: `Check your network connection and ${provider} service status.`,
        }

        if (attempt === maxRetries) {
          throw new ProviderHttpError(lastError)
        }

        await sleep(lastError.retryAfterMs!, signal)
        continue
      }

      // Abort
      if ((error as Error).name === 'AbortError') {
        throw new Error('Request aborted')
      }

      throw error
    }
  }

  throw new ProviderHttpError(
    lastError ?? {
      type: 'unknown',
      message: `All retries exhausted for ${provider}`,
      retryable: false,
      retryAfterMs: null,
      suggestion: '',
    },
  )
}

// ---------------------------------------------------------------------------
// ProviderHttpError class
// ---------------------------------------------------------------------------

export class ProviderHttpError extends Error {
  readonly classified: ClassifiedError

  constructor(classified: ClassifiedError) {
    super(classified.message)
    this.name = 'ProviderHttpError'
    this.classified = classified
  }
}

// ---------------------------------------------------------------------------
// User-facing error format
// ---------------------------------------------------------------------------

/**
 * Format a classified error for user display.
 */
export function formatErrorForUser(
  classified: ClassifiedError,
  provider: string,
): string {
  const parts: string[] = [
    `[${provider}] ${classified.message}`,
  ]

  if (classified.suggestion) {
    parts.push(`  → ${classified.suggestion}`)
  }

  return parts.join('\n')
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse Google Cloud Code Assist's natural-language rate-limit reset
 * hint from the response body. Examples:
 *   "Your quota will reset after 32s."
 *   "Your quota will reset after 1s."
 *   "Quota will reset after 500ms."
 * Returns milliseconds, or null if no hint found.
 */
function parseGoogleResetAfter(body: string): number | null {
  const secMatch = body.match(/reset after (\d+\.?\d*)\s*s\b/i)
  if (secMatch) {
    const secs = parseFloat(secMatch[1])
    if (Number.isFinite(secs) && secs >= 0) {
      // Add a small buffer so we don't race the server clock.
      return Math.ceil(secs * 1000) + 500
    }
  }
  const msMatch = body.match(/reset after (\d+)\s*ms\b/i)
  if (msMatch) {
    const ms = parseInt(msMatch[1], 10)
    if (Number.isFinite(ms) && ms >= 0) return ms + 500
  }
  return null
}

function parseRetryAfter(body: string): number {
  try {
    const parsed = JSON.parse(body)
    // OpenAI style
    if (parsed?.error?.type === 'tokens' || parsed?.error?.code === 'rate_limit_exceeded') {
      // Look for retry-after hint
      const match = parsed.error.message?.match(/try again in (\d+\.?\d*)s/)
      if (match) {
        return Math.ceil(parseFloat(match[1]) * 1000)
      }
    }
  } catch {
    // ignore parse errors
  }
  return 5000 // default 5s
}

function isContextLengthError(body: string): boolean {
  const lower = body.toLowerCase()
  return (
    lower.includes('context_length') ||
    lower.includes('context length') ||
    lower.includes('maximum context') ||
    lower.includes('too many tokens') ||
    lower.includes('max_tokens')
  )
}

function isContentFilterError(body: string): boolean {
  const lower = body.toLowerCase()
  return (
    lower.includes('content_filter') ||
    lower.includes('content filter') ||
    lower.includes('content_policy') ||
    lower.includes('flagged')
  )
}

function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.slice(0, maxLen) + '...' : str
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(new Error('Request aborted'))
      },
      { once: true },
    )
  })
}
