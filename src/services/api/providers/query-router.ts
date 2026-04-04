/**
 * Query router — wraps the existing queryModelWithStreaming to add
 * multi-provider routing.
 *
 * createProviderAwareCallModel(originalCallModel) returns a drop-in
 * replacement that:
 *   1. Parses the model string via parseModelRef()
 *   2. Routes Anthropic models unchanged to the original function
 *   3. Routes non-Anthropic models through the provider registry
 */

import type {
  AssistantMessage,
  StreamEvent,
  SystemAPIErrorMessage,
} from '../../../types/message.js'
import { parseModelRef } from './types.js'
import { getProviderForModelId } from './registry.js'

/**
 * Wrap the original callModel function with multi-provider routing.
 *
 * The returned function has the same signature as queryModelWithStreaming,
 * so it can be used as a drop-in replacement in QueryDeps.
 */
export function createProviderAwareCallModel(
  originalCallModel: (...args: any[]) => AsyncGenerator<StreamEvent | AssistantMessage | SystemAPIErrorMessage, void>,
): (...args: any[]) => AsyncGenerator<StreamEvent | AssistantMessage | SystemAPIErrorMessage, void> {
  return function* providerAwareCallModel(
    ...args: any[]
  ): any {
    // The first argument is an object with { messages, systemPrompt, thinkingConfig, tools, signal, options }
    const params = args[0]
    if (!params || typeof params !== 'object') {
      return yield* originalCallModel(...args)
    }

    const model = params.options?.model || ''
    const ref = parseModelRef(model)

    // Anthropic models pass through unchanged
    if (ref.provider === 'anthropic') {
      return yield* originalCallModel(...args)
    }

    // Non-Anthropic: route through provider registry
    return yield* routeToProvider(ref.provider, ref.model, params)
  }
}

/**
 * Route a query to a non-Anthropic provider.
 */
async function* routeToProvider(
  providerId: string,
  modelId: string,
  params: any,
): AsyncGenerator<StreamEvent | AssistantMessage | SystemAPIErrorMessage, void> {
  const provider = getProviderForModelId(providerId, modelId)

  if (!provider) {
    const { randomUUID } = await import('crypto')
    yield {
      type: 'system',
      uuid: randomUUID() as any,
      message: {
        role: 'system',
        content: [{
          type: 'text',
          text: `[Provider Error] Unknown provider: ${providerId}. Available providers: anthropic, openai, gemini, deepseek, groq, together, mistral, xai, openrouter, ollama`,
        }],
      },
    } as SystemAPIErrorMessage
    return
  }

  // Convert from the existing queryModelWithStreaming params to ProviderQueryParams
  const providerParams = {
    messages: params.messages,
    systemPrompt: params.systemPrompt,
    thinkingConfig: params.thinkingConfig,
    tools: params.tools,
    signal: params.signal,
    model: modelId,
    maxOutputTokens: params.options?.maxOutputTokensOverride,
    temperature: params.options?.temperatureOverride,
  }

  yield* provider.streamQuery(providerParams)
}
