/**
 * Provider capabilities metadata.
 *
 * Describes what each provider supports (thinking, tools, streaming)
 * and any compatibility quirks (e.g. DeepSeek needs assistant message
 * after tool results, Gemini uses 'model' role instead of 'assistant').
 */

export type ProviderCapabilities = {
  supportsThinking: boolean
  supportsTools: boolean
  streamingMode: 'sse' | 'sse-chunked' | 'none'
  maxContextWindow: number
  strictToolSchemas: boolean

  // Compat flags
  /** Some providers require an assistant message after every tool_result */
  requiresAssistantAfterToolResult: boolean
  /** Format for thinking/reasoning tokens: 'anthropic' | 'openai' | 'gemini' | 'none' */
  thinkingFormat: 'anthropic' | 'openai-reasoning' | 'gemini-thinking' | 'none'
  /** Role name for assistant messages: 'assistant' or 'model' */
  assistantRole: 'assistant' | 'model'
  /** Whether the provider requires strict JSON schema for tools (no additionalProperties) */
  requiresStrictJsonSchema: boolean
}

const CAPABILITIES: Record<string, ProviderCapabilities> = {
  anthropic: {
    supportsThinking: true,
    supportsTools: true,
    streamingMode: 'sse',
    maxContextWindow: 1_000_000,
    strictToolSchemas: false,
    requiresAssistantAfterToolResult: false,
    thinkingFormat: 'anthropic',
    assistantRole: 'assistant',
    requiresStrictJsonSchema: false,
  },
  openai: {
    supportsThinking: true,
    supportsTools: true,
    streamingMode: 'sse',
    maxContextWindow: 1_050_000,
    strictToolSchemas: true,
    requiresAssistantAfterToolResult: false,
    thinkingFormat: 'openai-reasoning',
    assistantRole: 'assistant',
    requiresStrictJsonSchema: true,
  },
  gemini: {
    supportsThinking: true,
    supportsTools: true,
    streamingMode: 'sse',
    maxContextWindow: 2_000_000,
    strictToolSchemas: false,
    requiresAssistantAfterToolResult: false,
    thinkingFormat: 'gemini-thinking',
    assistantRole: 'model',
    requiresStrictJsonSchema: false,
  },
  deepseek: {
    supportsThinking: true,
    supportsTools: true,
    streamingMode: 'sse',
    maxContextWindow: 128_000,
    strictToolSchemas: false,
    requiresAssistantAfterToolResult: true,
    thinkingFormat: 'none',
    assistantRole: 'assistant',
    requiresStrictJsonSchema: false,
  },
  openrouter: {
    supportsThinking: false,
    supportsTools: true,
    streamingMode: 'sse',
    maxContextWindow: 2_000_000,
    strictToolSchemas: false,
    requiresAssistantAfterToolResult: false,
    thinkingFormat: 'none',
    assistantRole: 'assistant',
    requiresStrictJsonSchema: false,
  },
  ollama: {
    supportsThinking: false,
    supportsTools: true,
    streamingMode: 'sse',
    maxContextWindow: 128_000,
    strictToolSchemas: false,
    requiresAssistantAfterToolResult: true,
    thinkingFormat: 'none',
    assistantRole: 'assistant',
    requiresStrictJsonSchema: false,
  },
  groq: {
    supportsThinking: false,
    supportsTools: true,
    streamingMode: 'sse',
    maxContextWindow: 131_072,
    strictToolSchemas: false,
    requiresAssistantAfterToolResult: false,
    thinkingFormat: 'none',
    assistantRole: 'assistant',
    requiresStrictJsonSchema: false,
  },
  together: {
    supportsThinking: false,
    supportsTools: true,
    streamingMode: 'sse',
    maxContextWindow: 128_000,
    strictToolSchemas: false,
    requiresAssistantAfterToolResult: false,
    thinkingFormat: 'none',
    assistantRole: 'assistant',
    requiresStrictJsonSchema: false,
  },
  mistral: {
    supportsThinking: true,
    supportsTools: true,
    streamingMode: 'sse',
    maxContextWindow: 256_000,
    strictToolSchemas: false,
    requiresAssistantAfterToolResult: false,
    thinkingFormat: 'none',
    assistantRole: 'assistant',
    requiresStrictJsonSchema: false,
  },
  xai: {
    supportsThinking: true,
    supportsTools: true,
    streamingMode: 'sse',
    maxContextWindow: 2_000_000,
    strictToolSchemas: false,
    requiresAssistantAfterToolResult: false,
    thinkingFormat: 'none',
    assistantRole: 'assistant',
    requiresStrictJsonSchema: false,
  },
}

/**
 * Get capabilities for a provider. Returns a safe default for unknown providers.
 */
export function getProviderCapabilities(id: string): ProviderCapabilities {
  return (
    CAPABILITIES[id] ?? {
      supportsThinking: false,
      supportsTools: true,
      streamingMode: 'sse',
      maxContextWindow: 128_000,
      strictToolSchemas: false,
      requiresAssistantAfterToolResult: false,
      thinkingFormat: 'none',
      assistantRole: 'assistant',
      requiresStrictJsonSchema: false,
    }
  )
}

/**
 * Quick check: does a provider support thinking/reasoning tokens?
 */
export function providerSupportsThinking(id: string): boolean {
  return getProviderCapabilities(id).supportsThinking
}

/**
 * Quick check: does a provider support tool use?
 */
export function providerSupportsTools(id: string): boolean {
  return getProviderCapabilities(id).supportsTools
}

/**
 * Get the assistant role name for a provider.
 */
export function getAssistantRoleName(id: string): string {
  return getProviderCapabilities(id).assistantRole
}
