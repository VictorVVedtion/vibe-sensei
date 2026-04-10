/**
 * Complete model catalog with 2026 pricing data.
 *
 * All prices are in USD per 1M tokens.
 * Context windows and output limits in tokens.
 */

import type { ModelDefinition } from './types.js'

// ---------------------------------------------------------------------------
// Anthropic
// ---------------------------------------------------------------------------

const ANTHROPIC_MODELS: ModelDefinition[] = [
  {
    id: 'claude-opus-4-6',
    name: 'Claude Opus 4.6',
    provider: 'anthropic',
    inputPricePer1M: 5,
    outputPricePer1M: 25,
    contextWindow: 1_000_000,
    maxOutputTokens: 128_000,
    supportsThinking: true,
    supportsTools: true,
    supportsStreaming: true,
    supportsImages: true,
    family: 'opus',
  },
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    provider: 'anthropic',
    inputPricePer1M: 3,
    outputPricePer1M: 15,
    contextWindow: 1_000_000,
    maxOutputTokens: 64_000,
    supportsThinking: true,
    supportsTools: true,
    supportsStreaming: true,
    supportsImages: true,
    family: 'sonnet',
  },
  {
    id: 'claude-haiku-4-5',
    name: 'Claude Haiku 4.5',
    provider: 'anthropic',
    inputPricePer1M: 1,
    outputPricePer1M: 5,
    contextWindow: 200_000,
    maxOutputTokens: 64_000,
    supportsThinking: true,
    supportsTools: true,
    supportsStreaming: true,
    supportsImages: true,
    family: 'haiku',
  },
]

// ---------------------------------------------------------------------------
// OpenAI
// ---------------------------------------------------------------------------

const OPENAI_MODELS: ModelDefinition[] = [
  {
    id: 'gpt-5.4',
    name: 'GPT-5.4',
    provider: 'openai',
    inputPricePer1M: 2.5,
    outputPricePer1M: 15,
    contextWindow: 1_050_000,
    maxOutputTokens: 128_000,
    supportsThinking: true,
    supportsTools: true,
    supportsStreaming: true,
    supportsImages: true,
    family: 'gpt-5',
  },
  {
    id: 'gpt-5.4-mini',
    name: 'GPT-5.4 Mini',
    provider: 'openai',
    inputPricePer1M: 0.75,
    outputPricePer1M: 4.5,
    contextWindow: 1_050_000,
    maxOutputTokens: 64_000,
    supportsThinking: true,
    supportsTools: true,
    supportsStreaming: true,
    supportsImages: true,
    family: 'gpt-5',
  },
  {
    id: 'gpt-5.4-nano',
    name: 'GPT-5.4 Nano',
    provider: 'openai',
    inputPricePer1M: 0.2,
    outputPricePer1M: 1.25,
    contextWindow: 512_000,
    maxOutputTokens: 32_000,
    supportsThinking: false,
    supportsTools: true,
    supportsStreaming: true,
    supportsImages: true,
    family: 'gpt-5',
  },
  {
    id: 'o3',
    name: 'O3',
    provider: 'openai',
    inputPricePer1M: 2,
    outputPricePer1M: 8,
    contextWindow: 200_000,
    maxOutputTokens: 100_000,
    supportsThinking: true,
    supportsTools: true,
    supportsStreaming: true,
    supportsImages: true,
    family: 'o3',
  },
  {
    id: 'o4-mini',
    name: 'O4 Mini',
    provider: 'openai',
    inputPricePer1M: 1.1,
    outputPricePer1M: 4.4,
    contextWindow: 200_000,
    maxOutputTokens: 100_000,
    supportsThinking: true,
    supportsTools: true,
    supportsStreaming: true,
    supportsImages: false,
    family: 'o4',
  },
]

// ---------------------------------------------------------------------------
// Gemini
// ---------------------------------------------------------------------------

const GEMINI_MODELS: ModelDefinition[] = [
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro Preview',
    provider: 'gemini',
    inputPricePer1M: 2,
    outputPricePer1M: 12,
    contextWindow: 2_000_000,
    maxOutputTokens: 64_000,
    supportsThinking: true,
    supportsTools: true,
    supportsStreaming: true,
    supportsImages: true,
    family: 'gemini-3',
  },
  {
    id: 'gemini-3-flash-preview',
    name: 'Gemini 3 Flash Preview',
    provider: 'gemini',
    inputPricePer1M: 0.5,
    outputPricePer1M: 3,
    contextWindow: 1_000_000,
    maxOutputTokens: 32_000,
    supportsThinking: true,
    supportsTools: true,
    supportsStreaming: true,
    supportsImages: true,
    family: 'gemini-3',
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'gemini',
    inputPricePer1M: 1.25,
    outputPricePer1M: 10,
    contextWindow: 1_000_000,
    maxOutputTokens: 64_000,
    supportsThinking: true,
    supportsTools: true,
    supportsStreaming: true,
    supportsImages: true,
    family: 'gemini-2',
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'gemini',
    inputPricePer1M: 0.3,
    outputPricePer1M: 2.5,
    contextWindow: 1_000_000,
    maxOutputTokens: 32_000,
    supportsThinking: true,
    supportsTools: true,
    supportsStreaming: true,
    supportsImages: true,
    family: 'gemini-2',
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    provider: 'gemini',
    inputPricePer1M: 0.15,
    outputPricePer1M: 1,
    contextWindow: 500_000,
    maxOutputTokens: 16_000,
    supportsThinking: false,
    supportsTools: true,
    supportsStreaming: true,
    supportsImages: true,
    family: 'gemini-2',
  },
]

// ---------------------------------------------------------------------------
// DeepSeek
// ---------------------------------------------------------------------------

const DEEPSEEK_MODELS: ModelDefinition[] = [
  {
    id: 'deepseek-chat',
    name: 'DeepSeek V3.2 Chat',
    provider: 'deepseek',
    inputPricePer1M: 0.28,
    outputPricePer1M: 0.42,
    contextWindow: 128_000,
    maxOutputTokens: 32_000,
    supportsThinking: false,
    supportsTools: true,
    supportsStreaming: true,
    supportsImages: false,
    family: 'deepseek-v3',
  },
  {
    id: 'deepseek-reasoner',
    name: 'DeepSeek V3.2 Reasoner',
    provider: 'deepseek',
    inputPricePer1M: 0.28,
    outputPricePer1M: 0.42,
    contextWindow: 128_000,
    maxOutputTokens: 64_000,
    supportsThinking: true,
    supportsTools: true,
    supportsStreaming: true,
    supportsImages: false,
    family: 'deepseek-v3',
  },
]

// ---------------------------------------------------------------------------
// xAI (Grok)
// ---------------------------------------------------------------------------

const XAI_MODELS: ModelDefinition[] = [
  {
    id: 'grok-4.20',
    name: 'Grok 4.20',
    provider: 'xai',
    inputPricePer1M: 2,
    outputPricePer1M: 6,
    contextWindow: 2_000_000,
    maxOutputTokens: 128_000,
    supportsThinking: true,
    supportsTools: true,
    supportsStreaming: true,
    supportsImages: true,
    family: 'grok-4',
  },
  {
    id: 'grok-4-1-fast',
    name: 'Grok 4.1 Fast',
    provider: 'xai',
    inputPricePer1M: 0.2,
    outputPricePer1M: 0.5,
    contextWindow: 2_000_000,
    maxOutputTokens: 64_000,
    supportsThinking: false,
    supportsTools: true,
    supportsStreaming: true,
    supportsImages: true,
    family: 'grok-4',
  },
]

// ---------------------------------------------------------------------------
// Mistral
// ---------------------------------------------------------------------------

const MISTRAL_MODELS: ModelDefinition[] = [
  {
    id: 'mistral-large-latest',
    name: 'Mistral Large',
    provider: 'mistral',
    inputPricePer1M: 0.5,
    outputPricePer1M: 1.5,
    contextWindow: 128_000,
    maxOutputTokens: 32_000,
    supportsThinking: false,
    supportsTools: true,
    supportsStreaming: true,
    supportsImages: true,
    family: 'mistral-large',
  },
  {
    id: 'mistral-small-latest',
    name: 'Mistral Small',
    provider: 'mistral',
    inputPricePer1M: 0.1,
    outputPricePer1M: 0.3,
    contextWindow: 128_000,
    maxOutputTokens: 32_000,
    supportsThinking: false,
    supportsTools: true,
    supportsStreaming: true,
    supportsImages: false,
    family: 'mistral-small',
  },
  {
    id: 'magistral-medium-latest',
    name: 'Magistral Medium',
    provider: 'mistral',
    inputPricePer1M: 0.5,
    outputPricePer1M: 1.5,
    contextWindow: 128_000,
    maxOutputTokens: 40_000,
    supportsThinking: true,
    supportsTools: true,
    supportsStreaming: true,
    supportsImages: false,
    family: 'magistral',
  },
  {
    id: 'codestral-latest',
    name: 'Codestral',
    provider: 'mistral',
    inputPricePer1M: 0.3,
    outputPricePer1M: 0.9,
    contextWindow: 256_000,
    maxOutputTokens: 32_000,
    supportsThinking: false,
    supportsTools: true,
    supportsStreaming: true,
    supportsImages: false,
    family: 'codestral',
  },
]

// ---------------------------------------------------------------------------
// Groq
// ---------------------------------------------------------------------------

const GROQ_MODELS: ModelDefinition[] = [
  {
    id: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B',
    provider: 'groq',
    inputPricePer1M: 0.59,
    outputPricePer1M: 0.79,
    contextWindow: 128_000,
    maxOutputTokens: 32_768,
    supportsThinking: false,
    supportsTools: true,
    supportsStreaming: true,
    supportsImages: false,
    family: 'llama-3',
  },
  {
    id: 'llama-3.1-8b-instant',
    name: 'Llama 3.1 8B',
    provider: 'groq',
    inputPricePer1M: 0.05,
    outputPricePer1M: 0.08,
    contextWindow: 128_000,
    maxOutputTokens: 8_192,
    supportsThinking: false,
    supportsTools: true,
    supportsStreaming: true,
    supportsImages: false,
    family: 'llama-3',
  },
  {
    id: 'llama-4-scout-17b-16e-instruct',
    name: 'Llama 4 Scout 17B',
    provider: 'groq',
    inputPricePer1M: 0.11,
    outputPricePer1M: 0.34,
    contextWindow: 131_072,
    maxOutputTokens: 8_192,
    supportsThinking: false,
    supportsTools: true,
    supportsStreaming: true,
    supportsImages: true,
    family: 'llama-4',
  },
  {
    id: 'qwen-qwq-32b',
    name: 'Qwen QWQ 32B',
    provider: 'groq',
    inputPricePer1M: 0.29,
    outputPricePer1M: 0.39,
    contextWindow: 131_072,
    maxOutputTokens: 32_768,
    supportsThinking: true,
    supportsTools: true,
    supportsStreaming: true,
    supportsImages: false,
    family: 'qwen',
  },
]

// ---------------------------------------------------------------------------
// Together AI (no fixed pricing, representative estimates)
// ---------------------------------------------------------------------------

const TOGETHER_MODELS: ModelDefinition[] = [
  {
    id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    name: 'Llama 3.3 70B (Together)',
    provider: 'together',
    inputPricePer1M: 0.88,
    outputPricePer1M: 0.88,
    contextWindow: 128_000,
    maxOutputTokens: 32_000,
    supportsThinking: false,
    supportsTools: true,
    supportsStreaming: true,
    supportsImages: false,
    family: 'llama-3',
  },
]

// ---------------------------------------------------------------------------
// OpenRouter (pricing varies by upstream model)
// ---------------------------------------------------------------------------

const OPENROUTER_MODELS: ModelDefinition[] = [
  // OpenRouter is a meta-provider; models are defined dynamically.
  // This catalog serves as a placeholder — the real list comes from their API.
]

// ---------------------------------------------------------------------------
// Ollama (local, no pricing)
// ---------------------------------------------------------------------------

const OLLAMA_MODELS: ModelDefinition[] = [
  // Ollama models are local and user-installed.
  // No fixed catalog — discovered at runtime via /api/tags.
]

// ---------------------------------------------------------------------------
// Full catalog
// ---------------------------------------------------------------------------

export const MODEL_CATALOG: ModelDefinition[] = [
  ...ANTHROPIC_MODELS,
  ...OPENAI_MODELS,
  ...GEMINI_MODELS,
  ...DEEPSEEK_MODELS,
  ...XAI_MODELS,
  ...MISTRAL_MODELS,
  ...GROQ_MODELS,
  ...TOGETHER_MODELS,
  ...OPENROUTER_MODELS,
  ...OLLAMA_MODELS,
]

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

const _catalogByIdMap = new Map<string, ModelDefinition>()
for (const m of MODEL_CATALOG) {
  _catalogByIdMap.set(m.id, m)
}

/**
 * Look up a model definition by its id.
 */
export function getModelDefinition(modelId: string): ModelDefinition | undefined {
  return _catalogByIdMap.get(modelId)
}

/**
 * List all known models for a given provider.
 */
export function getModelsForProvider(providerId: string): ModelDefinition[] {
  return MODEL_CATALOG.filter(m => m.provider === providerId)
}

/**
 * Get all known provider IDs from the catalog.
 */
export function getKnownProviderIds(): string[] {
  const ids = new Set<string>()
  for (const m of MODEL_CATALOG) {
    ids.add(m.provider)
  }
  // Also add providers with no fixed catalog entries
  ids.add('openrouter')
  ids.add('ollama')
  return Array.from(ids)
}

/**
 * Get all known model IDs.
 */
export function getAllModelIds(): string[] {
  return MODEL_CATALOG.map(m => m.id)
}
