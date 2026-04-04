/**
 * Provider factory — registers all providers on init.
 *
 * Providers:
 *   Anthropic, Gemini, OpenAI (Chat Completions), OpenAI (Responses),
 *   DeepSeek, OpenRouter, Ollama, Groq, Together, Mistral, xAI
 */

import type { ProviderClient } from './types.js'
import { isResponsesApiModel } from './openai-responses.js'
import { resolveProviderApiKey } from './auth-env.js'

// ---------------------------------------------------------------------------
// Lazy singleton map — providers are instantiated on first access
// ---------------------------------------------------------------------------

let _initialized = false
const _providers = new Map<string, ProviderClient>()

/**
 * Ensure all providers are registered. Safe to call multiple times.
 */
function ensureInitialized(): void {
  if (_initialized) return
  _initialized = true

  // Import is synchronous because all adapters are in the same bundle
  const { AnthropicProvider } = require('./anthropic.js')
  const { OpenAICompatProvider } = require('./openai-compat.js')
  const { OpenAIResponsesProvider } = require('./openai-responses.js')
  const { GeminiProvider } = require('./gemini.js')

  // Anthropic — thin wrapper around existing claude.ts
  _providers.set('anthropic', new AnthropicProvider())

  // Gemini — native API adapter
  _providers.set('gemini', new GeminiProvider())

  // OpenAI — Chat Completions (for non-GPT-5.4 models)
  _providers.set(
    'openai',
    new OpenAICompatProvider('openai', 'OpenAI', 'GPT and O-series models via Chat Completions'),
  )

  // OpenAI — Responses API (for GPT-5.4 family)
  _providers.set('openai-responses', new OpenAIResponsesProvider())

  // DeepSeek
  _providers.set(
    'deepseek',
    new OpenAICompatProvider('deepseek', 'DeepSeek', 'DeepSeek V3.2 Chat and Reasoner'),
  )

  // OpenRouter
  _providers.set(
    'openrouter',
    new OpenAICompatProvider('openrouter', 'OpenRouter', 'Access 200+ models through a single API'),
  )

  // Ollama (local)
  _providers.set(
    'ollama',
    new OpenAICompatProvider('ollama', 'Ollama', 'Local models via Ollama'),
  )

  // Groq
  _providers.set(
    'groq',
    new OpenAICompatProvider('groq', 'Groq', 'Ultra-fast inference (Llama, Qwen)'),
  )

  // Together AI
  _providers.set(
    'together',
    new OpenAICompatProvider('together', 'Together AI', 'Open-source models at scale'),
  )

  // Mistral
  _providers.set(
    'mistral',
    new OpenAICompatProvider('mistral', 'Mistral', 'Mistral Large, Small, Magistral, Codestral'),
  )

  // xAI (Grok)
  _providers.set(
    'xai',
    new OpenAICompatProvider('xai', 'xAI', 'Grok family of models'),
  )
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get a provider by its ID (e.g. "openai", "gemini", "deepseek").
 */
export function getProviderById(id: string): ProviderClient | undefined {
  ensureInitialized()
  return _providers.get(id)
}

/**
 * Get the correct provider for a given provider ID and model ID.
 * For OpenAI, GPT-5.4 models route to the Responses API adapter.
 */
export function getProviderForModelId(
  providerId: string,
  modelId: string,
): ProviderClient | undefined {
  ensureInitialized()

  // Special routing: GPT-5.4 → Responses API
  if (providerId === 'openai' && isResponsesApiModel(modelId)) {
    return _providers.get('openai-responses')
  }

  return _providers.get(providerId)
}

/**
 * List all registered providers.
 */
export function listRegisteredProviders(): ProviderClient[] {
  ensureInitialized()
  return Array.from(_providers.values())
}

/**
 * Check if a provider is available (has credentials configured).
 */
export function isProviderAvailable(providerId: string): boolean {
  if (providerId === 'ollama') return true // Always "available" (may not be running)
  if (providerId === 'anthropic') return !!process.env.ANTHROPIC_API_KEY
  if (providerId === 'openai-responses') return !!resolveProviderApiKey('openai')
  return resolveProviderApiKey(providerId) !== null
}

/**
 * Get providers that have valid credentials.
 */
export function getAvailableProviders(): ProviderClient[] {
  ensureInitialized()
  return Array.from(_providers.entries())
    .filter(([id]) => isProviderAvailable(id))
    .map(([, provider]) => provider)
}
