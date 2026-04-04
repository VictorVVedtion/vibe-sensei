/**
 * OpenAI Codex OAuth — Device Authorization Flow.
 *
 * Uses Auth0 device flow against auth0.openai.com to authenticate
 * users with a ChatGPT subscription. Token storage at
 * ~/.vibe-sensei/openai-codex-oauth.json with 0o600 permissions.
 *
 * Client ID: DRivsnm2Mu42T3KOpqdtwB3NYviHYzwD (public)
 */

import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AUTH0_DOMAIN = 'https://auth0.openai.com'
const CLIENT_ID = 'DRivsnm2Mu42T3KOpqdtwB3NYviHYzwD'
const AUDIENCE = 'https://api.openai.com/v1'
const SCOPE = 'openid profile email offline_access'

const TOKEN_DIR = join(homedir(), '.vibe-sensei')
const TOKEN_FILE = join(TOKEN_DIR, 'openai-codex-oauth.json')

// ---------------------------------------------------------------------------
// Token types
// ---------------------------------------------------------------------------

type StoredToken = {
  access_token: string
  refresh_token: string
  expires_at: number // unix timestamp in ms
  token_type: string
}

// ---------------------------------------------------------------------------
// Device Authorization Flow
// ---------------------------------------------------------------------------

type DeviceCodeResponse = {
  device_code: string
  user_code: string
  verification_uri: string
  verification_uri_complete: string
  expires_in: number
  interval: number
}

/**
 * Start the OAuth device authorization flow.
 * Returns user instructions (code + URL) and a promise that
 * resolves when the user completes authorization.
 */
export async function startCodexOAuthFlow(): Promise<{
  userCode: string
  verificationUrl: string
  waitForAuth: () => Promise<StoredToken>
}> {
  const response = await fetch(`${AUTH0_DOMAIN}/oauth/device/code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      scope: SCOPE,
      audience: AUDIENCE,
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Device code request failed: ${response.status} ${body}`)
  }

  const data: DeviceCodeResponse = await response.json()

  return {
    userCode: data.user_code,
    verificationUrl: data.verification_uri_complete || data.verification_uri,
    waitForAuth: () => pollForToken(data.device_code, data.interval, data.expires_in),
  }
}

/**
 * Poll Auth0 for the token after user has entered the device code.
 */
async function pollForToken(
  deviceCode: string,
  interval: number,
  expiresIn: number,
): Promise<StoredToken> {
  const pollIntervalMs = Math.max(interval, 5) * 1000
  const deadline = Date.now() + expiresIn * 1000

  while (Date.now() < deadline) {
    await sleep(pollIntervalMs)

    const response = await fetch(`${AUTH0_DOMAIN}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        device_code: deviceCode,
        client_id: CLIENT_ID,
      }),
    })

    const data = await response.json()

    if (response.ok) {
      const token: StoredToken = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Date.now() + (data.expires_in || 3600) * 1000,
        token_type: data.token_type || 'Bearer',
      }

      await storeToken(token)
      return token
    }

    // Auth0 error responses
    const error = data.error
    if (error === 'authorization_pending') {
      continue // User hasn't authorized yet
    }
    if (error === 'slow_down') {
      await sleep(5000) // Slow down and retry
      continue
    }
    if (error === 'expired_token') {
      throw new Error('Device code expired. Please try again.')
    }
    if (error === 'access_denied') {
      throw new Error('Authorization denied by user.')
    }

    throw new Error(`OAuth error: ${error}: ${data.error_description || ''}`)
  }

  throw new Error('Authorization timed out. Please try again.')
}

// ---------------------------------------------------------------------------
// Token resolution (with refresh)
// ---------------------------------------------------------------------------

/**
 * Resolve stored access token, refreshing if expired.
 * Returns null if no token is stored.
 */
export async function resolveCodexAuth(): Promise<string | null> {
  const token = await loadToken()
  if (!token) return null

  // Token still valid (with 5 minute buffer)
  if (Date.now() < token.expires_at - 300_000) {
    return token.access_token
  }

  // Refresh
  if (token.refresh_token) {
    try {
      const refreshed = await refreshAccessToken(token.refresh_token)
      return refreshed.access_token
    } catch {
      // Refresh failed — token is expired
      return null
    }
  }

  return null
}

async function refreshAccessToken(refreshToken: string): Promise<StoredToken> {
  const response = await fetch(`${AUTH0_DOMAIN}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: CLIENT_ID,
      refresh_token: refreshToken,
    }),
  })

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${response.status}`)
  }

  const data = await response.json()
  const token: StoredToken = {
    access_token: data.access_token,
    refresh_token: data.refresh_token || refreshToken,
    expires_at: Date.now() + (data.expires_in || 3600) * 1000,
    token_type: data.token_type || 'Bearer',
  }

  await storeToken(token)
  return token
}

// ---------------------------------------------------------------------------
// Token storage
// ---------------------------------------------------------------------------

async function storeToken(token: StoredToken): Promise<void> {
  await mkdir(TOKEN_DIR, { recursive: true })
  await writeFile(TOKEN_FILE, JSON.stringify(token, null, 2), { mode: 0o600 })
}

async function loadToken(): Promise<StoredToken | null> {
  try {
    const raw = await readFile(TOKEN_FILE, 'utf-8')
    const parsed = JSON.parse(raw)
    if (parsed.access_token && parsed.expires_at) {
      return parsed
    }
  } catch {
    // File doesn't exist or is invalid
  }
  return null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
