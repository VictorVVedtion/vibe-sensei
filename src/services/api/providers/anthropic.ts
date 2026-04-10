/**
 * Anthropic adapter — thin wrapper around existing queryModelWithStreaming.
 *
 * This adapter delegates directly to the existing Anthropic API client
 * in claude.ts. It exists so the provider registry can treat Anthropic
 * uniformly with all other providers.
 */

import type {
  AssistantMessage,
  StreamEvent,
  SystemAPIErrorMessage,
} from '../../../types/message.js'
import type {
  ProviderClient,
  ProviderInfo,
  ProviderQueryParams,
} from './types.js'
import { getModelsForProvider } from './model-catalog.js'

// ---------------------------------------------------------------------------
// Anthropic ProviderClient
// ---------------------------------------------------------------------------

export class AnthropicProvider implements ProviderClient {
  readonly id = 'anthropic'

  /**
   * Stream query by delegating to the existing queryModelWithStreaming.
   *
   * We dynamically import claude.ts to avoid circular dependency issues
   * since claude.ts is the original entry point and we are being called
   * from the query router which wraps it.
   */
  async *streamQuery(
    params: ProviderQueryParams,
  ): AsyncGenerator<StreamEvent | AssistantMessage | SystemAPIErrorMessage, void> {
    // The Anthropic path is handled by the original callModel in the query
    // router — this adapter should not be called directly for streaming.
    // If it is, we import and delegate.
    const { queryModelWithStreaming } = await import('../claude.js')
    const options = buildAnthropicOptions(params)

    yield* queryModelWithStreaming({
      messages: params.messages,
      systemPrompt: params.systemPrompt,
      thinkingConfig: params.thinkingConfig,
      tools: params.tools,
      signal: params.signal,
      options,
    })
  }

  async query(params: ProviderQueryParams): Promise<AssistantMessage> {
    const { queryModelWithoutStreaming } = await import('../claude.js')
    const options = buildAnthropicOptions(params)

    return queryModelWithoutStreaming({
      messages: params.messages,
      systemPrompt: params.systemPrompt,
      thinkingConfig: params.thinkingConfig,
      tools: params.tools,
      signal: params.signal,
      options,
    })
  }

  async verifyCredentials(): Promise<boolean> {
    const key = process.env.ANTHROPIC_API_KEY
    return !!key && key.trim().length > 0
  }

  getInfo(): ProviderInfo {
    return {
      id: 'anthropic',
      name: 'Anthropic',
      description: 'Claude family of models (Opus, Sonnet, Haiku)',
      baseUrl: 'https://api.anthropic.com',
      models: getModelsForProvider('anthropic'),
      authEnvVars: ['ANTHROPIC_API_KEY'],
      supportsThinking: true,
      supportsTools: true,
      streamingMode: 'sse',
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build the Options object that queryModelWithStreaming expects.
 * We construct a minimal-but-valid Options from ProviderQueryParams.
 */
function buildAnthropicOptions(params: ProviderQueryParams): any {
  return {
    model: params.model,
    getToolPermissionContext: async () => ({
      toolPermissions: {},
      allowedTools: new Set<string>(),
    }),
    isNonInteractiveSession: false,
    querySource: 'model_query' as any,
    agents: [],
    hasAppendSystemPrompt: false,
    mcpTools: [],
    ...(params.maxOutputTokens
      ? { maxOutputTokensOverride: params.maxOutputTokens }
      : {}),
    ...(params.temperature !== undefined
      ? { temperatureOverride: params.temperature }
      : {}),
  }
}
