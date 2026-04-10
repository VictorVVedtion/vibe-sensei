/**
 * API Adapter — HTTP execution layer.
 *
 * Resolves auth, enforces rate limits, makes the request, and truncates output.
 * Pattern follows hyperliquid-client.ts: native fetch + AbortController.
 */

import type { APIProfile } from './types.js'
import { canCall, recordCall } from './rate-limiter.js'

// ── Constants ────────────────────────────────────────────────────────────────

const TIMEOUT_MS = 30_000
const MAX_RESPONSE_CHARS = 100_000

// ── Types ────────────────────────────────────────────────────────────────────

export interface CallOptions {
  profile: APIProfile
  endpoint: string
  method?: string
  params?: Record<string, string>
  pathParams?: Record<string, string>
}

export interface CallResult {
  status: number
  statusText: string
  data: string
  durationMs: number
}

// ── Execute ──────────────────────────────────────────────────────────────────

export async function executeAPICall(opts: CallOptions): Promise<CallResult> {
  const { profile, endpoint, params, pathParams } = opts
  const method = (opts.method ?? 'GET').toUpperCase()

  // 1. Mutation guard
  if (method !== 'GET' && !profile.allowMutations) {
    throw new Error(
      `${profile.displayName} does not allow ${method} requests. ` +
      `Set allowMutations=true during registration to enable write operations.`
    )
  }

  // 2. Rate limit
  if (!canCall(profile.name, profile.rateLimit.maxPerMinute)) {
    throw new Error(
      `Rate limit exceeded for ${profile.displayName} ` +
      `(${profile.rateLimit.maxPerMinute}/min). Wait a moment and retry.`
    )
  }

  // 3. Build URL with path param substitution
  let path = endpoint
  if (pathParams) {
    for (const [key, value] of Object.entries(pathParams)) {
      path = path.replace(`{${key}}`, encodeURIComponent(value))
    }
  }

  // Catch unreplaced path params — they'd produce confusing 404s
  const unreplaced = path.match(/\{[^}]+\}/g)
  if (unreplaced) {
    throw new Error(
      `Missing path parameters: ${unreplaced.join(', ')}. ` +
      `Provide them via pathParams.`
    )
  }

  // Concatenate base + path to preserve base URL path segments
  // (new URL('/simple/price', 'https://api.coingecko.com/api/v3') would lose /api/v3)
  const base = profile.baseUrl.replace(/\/+$/, '')
  const suffix = path.startsWith('/') ? path : `/${path}`
  const url = new URL(`${base}${suffix}`)

  // 4. Inject query params
  if (params && method === 'GET') {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value)
    }
  }

  // 5. Resolve auth
  const headers: Record<string, string> = { 'Accept': 'application/json' }
  const auth = profile.auth

  if (auth.type !== 'none' && auth.envVar) {
    const key = process.env[auth.envVar]
    if (!key) {
      throw new Error(
        `API key not found. Set the ${auth.envVar} environment variable ` +
        `(e.g. in your .env file: ${auth.envVar}=your_key_here).`
      )
    }

    switch (auth.type) {
      case 'api_key_header':
        headers[auth.headerName ?? 'Authorization'] = key
        break
      case 'api_key_query':
        url.searchParams.set(auth.queryParam ?? 'api_key', key)
        break
      case 'bearer':
        headers['Authorization'] = `Bearer ${key}`
        break
    }
  }

  // 6. Execute with timeout
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const start = Date.now()

  try {
    const fetchOpts: RequestInit = {
      method,
      headers,
      signal: controller.signal,
    }

    // Body for non-GET
    if (method !== 'GET' && params) {
      headers['Content-Type'] = 'application/json'
      fetchOpts.body = JSON.stringify(params)
    }

    const resp = await fetch(url.toString(), fetchOpts)
    const durationMs = Date.now() - start

    // Only count successful responses against rate limit
    if (resp.ok) {
      recordCall(profile.name)
    }

    // Read and truncate response
    let data = await resp.text()
    if (data.length > MAX_RESPONSE_CHARS) {
      data = data.slice(0, MAX_RESPONSE_CHARS) + `\n...[truncated at ${MAX_RESPONSE_CHARS} chars]`
    }

    return {
      status: resp.status,
      statusText: resp.statusText,
      data,
      durationMs,
    }
  } finally {
    clearTimeout(timer)
  }
}
