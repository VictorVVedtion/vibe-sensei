/**
 * Core types for the multi-provider AI system.
 *
 * ModelRef identifies a provider+model pair. parseModelRef() auto-detects
 * provider from well-known prefixes (gpt-*, gemini-*, deepseek-*, etc.).
 * ProviderClient is the interface every adapter must implement.
 */

import type {
  AssistantMessage,
  Message,
  StreamEvent,
  SystemAPIErrorMessage,
} from '../../../types/message.js'
import type { SystemPrompt } from '../../../utils/systemPromptType.js'
import type { ThinkingConfig } from '../../../utils/thinking.js'
import type { Tools } from '../../../Tool.js'

// ---------------------------------------------------------------------------
// ModelRef — provider + model pair
// ---------------------------------------------------------------------------

export type ModelRef = {
  provider: string
  model: string
}

/**
 * Maps well-known model prefixes to their provider IDs.
 * Order matters — first match wins.
 */
const PREFIX_TO_PROVIDER: Array<{ prefixes: string[]; provider: string }> = [
  { prefixes: ['gpt-', 'o1-', 'o3-', 'o4-'], provider: 'openai' },
  { prefixes: ['gemini-'], provider: 'gemini' },
  { prefixes: ['deepseek-'], provider: 'deepseek' },
  { prefixes: ['grok-'], provider: 'xai' },
  { prefixes: ['mistral-', 'codestral'], provider: 'mistral' },
  { prefixes: ['claude-'], provider: 'anthropic' },
  { prefixes: ['llama-', 'qwen'], provider: 'groq' },
  { prefixes: ['meta-llama/'], provider: 'together' },
]

/**
 * Parse a model string into a ModelRef.
 *
 * Accepts two forms:
 *   - "provider/model" — explicit provider selection
 *   - "model-name"     — auto-detect via prefix table
 *
 * @example
 *   parseModelRef("gpt-5.4")           // { provider: "openai", model: "gpt-5.4" }
 *   parseModelRef("openai/gpt-5.4")    // { provider: "openai", model: "gpt-5.4" }
 *   parseModelRef("gemini-3.1-pro")    // { provider: "gemini", model: "gemini-3.1-pro" }
 *   parseModelRef("deepseek-chat")     // { provider: "deepseek", model: "deepseek-chat" }
 */
export function parseModelRef(str: string): ModelRef {
  const trimmed = str.trim()

  // Explicit provider/model format
  const slashIndex = trimmed.indexOf('/')
  if (slashIndex > 0) {
    const provider = trimmed.slice(0, slashIndex).toLowerCase()
    const model = trimmed.slice(slashIndex + 1)
    // Special case: meta-llama/Llama-... is a model identifier, not provider/model
    if (provider !== 'meta-llama') {
      return { provider, model }
    }
  }

  // Auto-detect from prefix
  const lower = trimmed.toLowerCase()
  for (const { prefixes, provider } of PREFIX_TO_PROVIDER) {
    for (const prefix of prefixes) {
      if (lower.startsWith(prefix)) {
        return { provider, model: trimmed }
      }
    }
  }

  // Default: assume Anthropic for unknown models (backwards compat)
  return { provider: 'anthropic', model: trimmed }
}

/**
 * Quick check: does a model string resolve to a non-Anthropic provider?
 */
export function isNonAnthropicModelRef(str: string): boolean {
  return parseModelRef(str).provider !== 'anthropic'
}

// ---------------------------------------------------------------------------
// Provider query params
// ---------------------------------------------------------------------------

export type ProviderQueryParams = {
  messages: Message[]
  systemPrompt: SystemPrompt
  thinkingConfig: ThinkingConfig
  tools: Tools
  signal: AbortSignal
  model: string
  maxOutputTokens?: number
  temperature?: number
}

// ---------------------------------------------------------------------------
// Provider info / model definitions
// ---------------------------------------------------------------------------

export type ModelDefinition = {
  id: string
  name: string
  provider: string
  inputPricePer1M: number   // USD per 1M input tokens
  outputPricePer1M: number  // USD per 1M output tokens
  contextWindow: number     // max input tokens
  maxOutputTokens: number   // max output tokens
  supportsThinking?: boolean
  supportsTools?: boolean
  supportsStreaming?: boolean
  supportsImages?: boolean
  family?: string
}

export type ProviderInfo = {
  id: string
  name: string
  description: string
  baseUrl: string
  models: ModelDefinition[]
  authEnvVars: string[]
  supportsThinking: boolean
  supportsTools: boolean
  streamingMode: 'sse' | 'sse-chunked' | 'none'
}

export type ProviderUsage = {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  estimatedCostUSD: number
}

// ---------------------------------------------------------------------------
// ProviderClient — the interface every adapter implements
// ---------------------------------------------------------------------------

export interface ProviderClient {
  /** Provider identifier (e.g. "openai", "gemini") */
  readonly id: string

  /**
   * Stream a query and yield events + the final assistant message.
   * Mirrors the signature of queryModelWithStreaming.
   */
  streamQuery(
    params: ProviderQueryParams,
  ): AsyncGenerator<StreamEvent | AssistantMessage | SystemAPIErrorMessage, void>

  /**
   * Non-streaming query — returns the final assistant message.
   */
  query(params: ProviderQueryParams): Promise<AssistantMessage>

  /**
   * Verify that credentials are configured and valid.
   * Returns true if the provider is ready to accept queries.
   */
  verifyCredentials(): Promise<boolean>

  /**
   * Return metadata about this provider and its available models.
   */
  getInfo(): ProviderInfo
}
