/**
 * Provider authentication via environment variables.
 *
 * Maps each provider to the env var(s) that hold its API key,
 * plus default base URLs with override support.
 */

// ---------------------------------------------------------------------------
// Env var registry
// ---------------------------------------------------------------------------

export const PROVIDER_AUTH_ENV_VARS: Record<string, string[]> = {
  anthropic: ['ANTHROPIC_API_KEY'],
  openai: ['OPENAI_API_KEY'],
  gemini: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
  deepseek: ['DEEPSEEK_API_KEY'],
  openrouter: ['OPENROUTER_API_KEY'],
  ollama: [], // No key needed for local Ollama
  groq: ['GROQ_API_KEY'],
  together: ['TOGETHER_API_KEY'],
  mistral: ['MISTRAL_API_KEY'],
  xai: ['XAI_API_KEY'],
}

// ---------------------------------------------------------------------------
// Base URL defaults
// ---------------------------------------------------------------------------

export const PROVIDER_BASE_URLS: Record<string, string> = {
  anthropic: 'https://api.anthropic.com',
  openai: 'https://api.openai.com',
  gemini: 'https://generativelanguage.googleapis.com',
  deepseek: 'https://api.deepseek.com',
  openrouter: 'https://openrouter.ai/api',
  ollama: 'http://localhost:11434',
  groq: 'https://api.groq.com',
  together: 'https://api.together.xyz',
  mistral: 'https://api.mistral.ai',
  xai: 'https://api.x.ai',
}

// ---------------------------------------------------------------------------
// Env var override keys for base URL
// ---------------------------------------------------------------------------

const BASE_URL_OVERRIDES: Record<string, string> = {
  openai: 'OPENAI_BASE_URL',
  deepseek: 'DEEPSEEK_BASE_URL',
  gemini: 'GEMINI_BASE_URL',
  ollama: 'OLLAMA_BASE_URL',
  groq: 'GROQ_BASE_URL',
  together: 'TOGETHER_BASE_URL',
  mistral: 'MISTRAL_BASE_URL',
  xai: 'XAI_BASE_URL',
  openrouter: 'OPENROUTER_BASE_URL',
}

// ---------------------------------------------------------------------------
// Resolution helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the API key for a provider by checking its env vars in order.
 * Returns the first non-empty value, or null if none are set.
 */
export function resolveProviderApiKey(provider: string): string | null {
  const envVars = PROVIDER_AUTH_ENV_VARS[provider]
  if (!envVars || envVars.length === 0) {
    // Providers like Ollama don't need a key
    return provider === 'ollama' ? '' : null
  }

  for (const envVar of envVars) {
    const value = process.env[envVar]?.trim()
    if (value) {
      return value
    }
  }

  return null
}

/**
 * Resolve the base URL for a provider.
 * Respects per-provider env var overrides (e.g. OPENAI_BASE_URL).
 */
export function resolveProviderBaseUrl(provider: string): string {
  const overrideKey = BASE_URL_OVERRIDES[provider]
  if (overrideKey) {
    const override = process.env[overrideKey]?.trim()
    if (override) {
      // Strip trailing slash for consistency
      return override.replace(/\/+$/, '')
    }
  }

  return PROVIDER_BASE_URLS[provider] || ''
}

/**
 * Get a map of provider → boolean indicating whether credentials are available.
 */
export function getProviderAuthStatus(): Record<string, boolean> {
  const status: Record<string, boolean> = {}

  for (const provider of Object.keys(PROVIDER_AUTH_ENV_VARS)) {
    if (provider === 'ollama') {
      // Ollama is available if the server is reachable (always "authed")
      status[provider] = true
    } else {
      status[provider] = resolveProviderApiKey(provider) !== null
    }
  }

  return status
}

/**
 * Get the list of env var names for a provider.
 */
export function getProviderAuthEnvVars(provider: string): string[] {
  return PROVIDER_AUTH_ENV_VARS[provider] || []
}

/**
 * Check whether any non-Anthropic provider has credentials configured
 * via environment variables. Used to determine if the user is
 * "authenticated" via an external provider even without Anthropic keys.
 *
 * Note: This is synchronous (env vars only). Async CLI OAuth checks
 * (Codex/Gemini) happen at query time in the provider implementations.
 */
export function hasAnyNonAnthropicProviderKey(): boolean {
  for (const [provider, envVars] of Object.entries(PROVIDER_AUTH_ENV_VARS)) {
    if (provider === 'anthropic' || provider === 'ollama') continue
    for (const envVar of envVars) {
      if (process.env[envVar]?.trim()) return true
    }
  }
  return false
}

/**
 * Synchronously check if Codex CLI or Gemini CLI auth files exist.
 * This is a fast existence check (not token validation) used to
 * suppress "Not logged in" when CLI OAuth credentials are present.
 */
export function hasCliOAuthCredentials(): boolean {
  try {
    const { existsSync } = require('fs')
    const { join } = require('path')
    const { homedir } = require('os')
    const home = homedir()
    return (
      existsSync(join(home, '.codex', 'auth.json')) ||
      existsSync(join(home, '.gemini', 'oauth_creds.json'))
    )
  } catch {
    return false
  }
}
