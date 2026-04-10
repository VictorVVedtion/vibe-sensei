/**
 * Gemini CLI OAuth reuse.
 *
 * Checks for existing Gemini CLI credentials at:
 *   ~/.gemini/credentials.json
 *   ~/.config/gemini/credentials.json
 *
 * If found, refreshes the OAuth token via oauth2.googleapis.com/token.
 * Falls back to API key if no OAuth credentials are available.
 */

import { readFile } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GeminiAuth =
  | { type: 'api-key'; key: string }
  | { type: 'oauth'; accessToken: string }

type GeminiCredentials = {
  client_id: string
  client_secret: string
  refresh_token: string
  type?: string
}

// ---------------------------------------------------------------------------
// Known credential paths
// ---------------------------------------------------------------------------

const CREDENTIAL_PATHS = [
  join(homedir(), '.gemini', 'credentials.json'),
  join(homedir(), '.config', 'gemini', 'credentials.json'),
]

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

/**
 * Resolve Gemini authentication.
 *
 * Priority:
 * 1. GEMINI_API_KEY or GOOGLE_API_KEY env var → api-key
 * 2. Gemini CLI OAuth credentials → oauth (with refresh)
 * 3. null
 */
export async function resolveGeminiAuth(): Promise<GeminiAuth | null> {
  // Check env var first
  const envKey =
    process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim()
  if (envKey) {
    return { type: 'api-key', key: envKey }
  }

  // Check for OAuth credentials
  const creds = await findGeminiCredentials()
  if (!creds) {
    return null
  }

  // Refresh the token
  try {
    const accessToken = await refreshGeminiToken(creds)
    return { type: 'oauth', accessToken }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Credential loading
// ---------------------------------------------------------------------------

async function findGeminiCredentials(): Promise<GeminiCredentials | null> {
  for (const path of CREDENTIAL_PATHS) {
    try {
      const raw = await readFile(path, 'utf-8')
      const parsed = JSON.parse(raw)

      // Handle both direct format and nested format
      const creds = parsed.installed || parsed.web || parsed

      if (creds.client_id && creds.refresh_token) {
        return {
          client_id: creds.client_id,
          client_secret: creds.client_secret || '',
          refresh_token: creds.refresh_token,
        }
      }
    } catch {
      // File not found or invalid, try next
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Token refresh
// ---------------------------------------------------------------------------

async function refreshGeminiToken(creds: GeminiCredentials): Promise<string> {
  const body: Record<string, string> = {
    grant_type: 'refresh_token',
    client_id: creds.client_id,
    refresh_token: creds.refresh_token,
  }

  if (creds.client_secret) {
    body.client_secret = creds.client_secret
  }

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gemini token refresh failed: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  if (!data.access_token) {
    throw new Error('No access_token in refresh response')
  }

  return data.access_token
}
