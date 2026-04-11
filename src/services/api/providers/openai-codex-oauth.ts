/**
 * OpenAI Codex OAuth — PKCE flow ported from @mariozechner/pi-ai.
 *
 * Uses the REAL auth.openai.com endpoints (not auth0.openai.com) with
 * ChatGPT-specific parameters (id_token_add_organizations, codex_cli_simplified_flow).
 *
 * The resulting token is a ChatGPT Plus/Pro session token that can access
 * https://chatgpt.com/backend-api/codex/responses — NOT the public API.
 */

import { createHash, randomBytes } from 'node:crypto'
import { createServer } from 'node:http'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann'
const AUTHORIZE_URL = 'https://auth.openai.com/oauth/authorize'
const TOKEN_URL = 'https://auth.openai.com/oauth/token'
const REDIRECT_URI = 'http://localhost:1455/auth/callback'
const SCOPE = 'openid profile email offline_access'
const JWT_CLAIM_PATH = 'https://api.openai.com/auth'
const ORIGINATOR = 'vibe-sensei'

const TOKEN_DIR = join(homedir(), '.vibe-sensei')
const TOKEN_FILE = join(TOKEN_DIR, 'openai-codex-oauth.json')
const CODEX_CLI_AUTH_FILE = join(homedir(), '.codex', 'auth.json')

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CodexCredentials = {
  access: string
  refresh: string
  expires: number // ms since epoch
  accountId: string
}

type StoredTokenLegacy = {
  access_token: string
  refresh_token: string
  expires_at: number
  token_type: string
}

// ---------------------------------------------------------------------------
// PKCE helpers
// ---------------------------------------------------------------------------

function base64urlEncode(bytes: Buffer | Uint8Array): string {
  return Buffer.from(bytes).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function generatePKCE(): { verifier: string; challenge: string } {
  const verifier = base64urlEncode(randomBytes(32))
  const challenge = base64urlEncode(createHash('sha256').update(verifier).digest())
  return { verifier, challenge }
}

function createState(): string {
  return randomBytes(16).toString('hex')
}

// ---------------------------------------------------------------------------
// JWT helpers
// ---------------------------------------------------------------------------

function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = Buffer.from(parts[1], 'base64').toString('utf-8')
    return JSON.parse(payload)
  } catch {
    return null
  }
}

export function extractCodexAccountId(accessToken: string): string | null {
  const payload = decodeJwt(accessToken)
  const auth = payload?.[JWT_CLAIM_PATH] as { chatgpt_account_id?: string } | undefined
  const id = auth?.chatgpt_account_id
  return typeof id === 'string' && id.length > 0 ? id : null
}

function extractExpiryFromJwt(token: string): number | null {
  const payload = decodeJwt(token)
  const exp = payload?.exp
  return typeof exp === 'number' ? exp * 1000 : null
}

// ---------------------------------------------------------------------------
// Public: PKCE login flow
// ---------------------------------------------------------------------------

// Server-side helper that runs full sequence: listen → open browser → wait for code
export async function runOpenAICodexLoginFlow(
  openUrl: (url: string) => Promise<void>,
  onProgress?: (msg: string) => void,
): Promise<CodexCredentials> {
  const { verifier, challenge } = generatePKCE()
  const state = createState()

  const authUrl = new URL(AUTHORIZE_URL)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id', CLIENT_ID)
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI)
  authUrl.searchParams.set('scope', SCOPE)
  authUrl.searchParams.set('code_challenge', challenge)
  authUrl.searchParams.set('code_challenge_method', 'S256')
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('id_token_add_organizations', 'true')
  authUrl.searchParams.set('codex_cli_simplified_flow', 'true')
  authUrl.searchParams.set('originator', ORIGINATOR)

  onProgress?.('Starting local callback server on localhost:1455...')

  const codePromise = waitForCodexCallback(state)

  // Give server a moment to bind, then open browser
  await new Promise(r => setTimeout(r, 100))
  onProgress?.('Opening browser for ChatGPT authentication...')
  try {
    await openUrl(authUrl.toString())
  } catch {
    onProgress?.(`Open this URL: ${authUrl.toString()}`)
  }

  onProgress?.('Waiting for authorization...')
  const { code } = await codePromise

  onProgress?.('Exchanging authorization code for tokens...')
  const tokens = await exchangeCodexCodeForToken(code, verifier)
  const accountId = extractCodexAccountId(tokens.access)
  if (!accountId) {
    throw new Error('No chatgpt_account_id in token')
  }

  const creds: CodexCredentials = { ...tokens, accountId }
  await storeCodexCredentials(creds)
  return creds
}

// ---------------------------------------------------------------------------
// Callback server
// ---------------------------------------------------------------------------

const CALLBACK_SUCCESS_HTML = `<!doctype html>
<html><head><meta charset="utf-8"/><title>Authentication successful</title></head>
<body style="font-family:system-ui;padding:2rem;">
  <h2>Authentication successful</h2>
  <p>Return to your terminal to continue.</p>
</body></html>`

function waitForCodexCallback(expectedState: string): Promise<{ code: string }> {
  return new Promise((resolve, reject) => {
    let timeout: NodeJS.Timeout | null = null
    const server = createServer((req, res) => {
      try {
        const url = new URL(req.url || '/', 'http://localhost:1455')
        if (url.pathname !== '/auth/callback') {
          res.statusCode = 404
          res.end('Not found')
          return
        }
        const state = url.searchParams.get('state')
        const code = url.searchParams.get('code')
        const error = url.searchParams.get('error')

        if (error) {
          res.statusCode = 400
          res.end(`OAuth error: ${error}`)
          finish(new Error(`OAuth error: ${error}`))
          return
        }
        if (state !== expectedState) {
          res.statusCode = 400
          res.end('State mismatch')
          finish(new Error('OAuth state mismatch'))
          return
        }
        if (!code) {
          res.statusCode = 400
          res.end('Missing code')
          finish(new Error('Missing authorization code'))
          return
        }

        res.statusCode = 200
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.end(CALLBACK_SUCCESS_HTML)
        finish(undefined, { code })
      } catch (err) {
        finish(err instanceof Error ? err : new Error('Callback error'))
      }
    })

    const finish = (err?: Error, result?: { code: string }) => {
      if (timeout) clearTimeout(timeout)
      try { server.close() } catch { /* ignore */ }
      if (err) reject(err)
      else if (result) resolve(result)
    }

    server.once('error', (err) => finish(err instanceof Error ? err : new Error('Server error')))
    server.listen(1455, '127.0.0.1')
    timeout = setTimeout(() => finish(new Error('OAuth timeout (5 min)')), 5 * 60 * 1000)
  })
}

// ---------------------------------------------------------------------------
// Token exchange & refresh
// ---------------------------------------------------------------------------

async function exchangeCodexCodeForToken(
  code: string,
  verifier: string,
): Promise<{ access: string; refresh: string; expires: number }> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: CLIENT_ID,
    code,
    code_verifier: verifier,
    redirect_uri: REDIRECT_URI,
  })

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Codex token exchange failed: ${response.status} ${text}`)
  }

  const data = await response.json() as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
  }

  if (!data.access_token || !data.refresh_token || typeof data.expires_in !== 'number') {
    throw new Error(`Codex token response missing fields: ${JSON.stringify(data)}`)
  }

  return {
    access: data.access_token,
    refresh: data.refresh_token,
    expires: Date.now() + data.expires_in * 1000,
  }
}

export async function refreshCodexToken(
  refreshToken: string,
): Promise<{ access: string; refresh: string; expires: number }> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: CLIENT_ID,
    refresh_token: refreshToken,
  })

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Codex token refresh failed: ${response.status} ${text}`)
  }

  const data = await response.json() as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
  }

  if (!data.access_token || !data.refresh_token || typeof data.expires_in !== 'number') {
    throw new Error('Codex refresh response missing fields')
  }

  return {
    access: data.access_token,
    refresh: data.refresh_token,
    expires: Date.now() + data.expires_in * 1000,
  }
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

async function storeCodexCredentials(creds: CodexCredentials): Promise<void> {
  // 0o700 on the directory so other local users can't enumerate filenames
  // or confirm credentials exist; the file itself is already 0o600 below.
  await mkdir(TOKEN_DIR, { recursive: true, mode: 0o700 })
  await writeFile(TOKEN_FILE, JSON.stringify(creds, null, 2), { mode: 0o600 })
}

async function loadOwnCredentials(): Promise<CodexCredentials | null> {
  try {
    const raw = await readFile(TOKEN_FILE, 'utf-8')
    const parsed = JSON.parse(raw)
    if (parsed.access && parsed.refresh && typeof parsed.expires === 'number' && parsed.accountId) {
      return parsed as CodexCredentials
    }
    // Legacy format compatibility
    if (parsed.access_token && parsed.refresh_token) {
      const legacy = parsed as StoredTokenLegacy
      const accountId = extractCodexAccountId(legacy.access_token)
      if (accountId) {
        return {
          access: legacy.access_token,
          refresh: legacy.refresh_token,
          expires: legacy.expires_at,
          accountId,
        }
      }
    }
  } catch { /* file missing or invalid */ }
  return null
}

async function loadCodexCliCredentials(): Promise<CodexCredentials | null> {
  try {
    const raw = await readFile(CODEX_CLI_AUTH_FILE, 'utf-8')
    const parsed = JSON.parse(raw)
    const tokens = parsed.tokens
    if (tokens?.access_token && tokens?.refresh_token) {
      const accountId = extractCodexAccountId(tokens.access_token)
        || tokens.account_id
      if (!accountId) return null

      let expires = extractExpiryFromJwt(tokens.access_token)
        ?? Date.now() + 10 * 24 * 3600_000

      return {
        access: tokens.access_token,
        refresh: tokens.refresh_token,
        expires,
        accountId,
      }
    }
  } catch { /* file missing or invalid */ }
  return null
}

// ---------------------------------------------------------------------------
// Public: resolve credentials for API calls
// ---------------------------------------------------------------------------

export async function resolveCodexCredentials(): Promise<CodexCredentials | null> {
  // 1. Own stored credentials (from PKCE flow via /login)
  let creds = await loadOwnCredentials()
  if (creds) {
    creds = await ensureFreshCodex(creds, 'own')
    if (creds) return creds
  }

  // 2. Codex CLI credentials (for users who already logged in via `codex`)
  creds = await loadCodexCliCredentials()
  if (creds) {
    creds = await ensureFreshCodex(creds, 'codex-cli')
    if (creds) return creds
  }

  return null
}

/**
 * Back-compat shim: old callers expect a raw access token string.
 * @deprecated Prefer resolveCodexCredentials() which returns accountId too.
 */
export async function resolveCodexAuth(): Promise<string | null> {
  const creds = await resolveCodexCredentials()
  return creds?.access ?? null
}

async function ensureFreshCodex(
  creds: CodexCredentials,
  source: 'own' | 'codex-cli',
): Promise<CodexCredentials | null> {
  if (Date.now() < creds.expires - 300_000) {
    return creds
  }
  try {
    const refreshed = await refreshCodexToken(creds.refresh)
    const accountId = extractCodexAccountId(refreshed.access) ?? creds.accountId
    const next: CodexCredentials = { ...refreshed, accountId }
    if (source === 'own') {
      await storeCodexCredentials(next)
    }
    return next
  } catch {
    return null
  }
}
