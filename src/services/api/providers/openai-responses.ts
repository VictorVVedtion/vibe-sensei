/**
 * OpenAI Responses API adapter for GPT-5.4 family.
 *
 * POST to {baseUrl}/v1/responses with stream:true
 * Uses SSE events: response.output_text.delta, response.function_call_arguments.delta,
 * response.completed
 *
 * Supports reasoning.effort, store:true.
 * Only used for GPT-5.4 family models — other OpenAI models use Chat Completions.
 */

import { randomUUID } from 'crypto'
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
import { resolveProviderApiKey, resolveProviderBaseUrl, getProviderAuthEnvVars } from './auth-env.js'
import { getModelsForProvider } from './model-catalog.js'
import { fetchWithRetry, ProviderHttpError, formatErrorForUser } from './error-handling.js'
import { recordProviderUsage } from './cost-tracker.js'

// ---------------------------------------------------------------------------
// Models that use the Responses API
// ---------------------------------------------------------------------------

const RESPONSES_API_MODELS = new Set([
  'gpt-5.4',
  'gpt-5.4-mini',
  'gpt-5.4-nano',
])

/**
 * Check if a model should use the Responses API instead of Chat Completions.
 */
export function isResponsesApiModel(model: string): boolean {
  return RESPONSES_API_MODELS.has(model) || model.startsWith('gpt-5.4')
}

// ---------------------------------------------------------------------------
// OpenAI Responses ProviderClient
// ---------------------------------------------------------------------------

export class OpenAIResponsesProvider implements ProviderClient {
  readonly id = 'openai-responses'

  async *streamQuery(
    params: ProviderQueryParams,
  ): AsyncGenerator<StreamEvent | AssistantMessage | SystemAPIErrorMessage, void> {
    const apiKey = resolveProviderApiKey('openai')
    const baseUrl = resolveProviderBaseUrl('openai')

    if (!apiKey) {
      yield createErrorMessage(`No API key configured for OpenAI. Set: ${getProviderAuthEnvVars('openai').join(', ')}`)
      return
    }

    const url = `${baseUrl}/v1/responses`
    const body = buildResponsesBody(params, true)
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    }

    let response: Response
    try {
      response = await fetchWithRetry(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: params.signal,
      }, 'openai', { maxRetries: 2 })
    } catch (error) {
      if (error instanceof ProviderHttpError) {
        yield createErrorMessage(formatErrorForUser(error.classified, 'openai'))
      } else {
        yield createErrorMessage(`Connection error to OpenAI Responses API: ${(error as Error).message}`)
      }
      return
    }

    yield* parseResponsesSSEStream(response, params.model)
  }

  async query(params: ProviderQueryParams): Promise<AssistantMessage> {
    const apiKey = resolveProviderApiKey('openai')
    const baseUrl = resolveProviderBaseUrl('openai')

    if (!apiKey) {
      throw new Error('No API key configured for OpenAI')
    }

    const url = `${baseUrl}/v1/responses`
    const body = buildResponsesBody(params, false)
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    }

    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: params.signal,
    }, 'openai')

    const json = await response.json()
    return responsesJsonToAssistantMessage(json, params.model)
  }

  async verifyCredentials(): Promise<boolean> {
    const key = resolveProviderApiKey('openai')
    return key !== null && key.length > 0
  }

  getInfo(): ProviderInfo {
    const models = getModelsForProvider('openai').filter(m =>
      RESPONSES_API_MODELS.has(m.id) || m.id.startsWith('gpt-5.4'),
    )
    return {
      id: 'openai-responses',
      name: 'OpenAI (Responses API)',
      description: 'GPT-5.4 family via the native Responses API',
      baseUrl: resolveProviderBaseUrl('openai'),
      models,
      authEnvVars: getProviderAuthEnvVars('openai'),
      supportsThinking: true,
      supportsTools: true,
      streamingMode: 'sse',
    }
  }
}

// ---------------------------------------------------------------------------
// Request body building
// ---------------------------------------------------------------------------

function buildResponsesBody(
  params: ProviderQueryParams,
  stream: boolean,
): Record<string, unknown> {
  const input = buildResponsesInput(params)
  const tools = params.tools.length > 0 ? toolsToResponsesFormat(params.tools) : undefined

  const body: Record<string, unknown> = {
    model: params.model,
    input,
    stream,
    store: true,
  }

  if (tools && tools.length > 0) {
    body.tools = tools
  }

  if (params.maxOutputTokens) {
    body.max_output_tokens = params.maxOutputTokens
  }

  if (params.temperature !== undefined) {
    body.temperature = params.temperature
  }

  // Reasoning effort for thinking models
  if (params.thinkingConfig) {
    body.reasoning = { effort: 'medium' }
  }

  return body
}

function buildResponsesInput(params: ProviderQueryParams): Array<Record<string, unknown>> {
  const input: Array<Record<string, unknown>> = []

  // System instruction
  const sysText = extractSystemPromptText(params.systemPrompt)
  if (sysText) {
    input.push({
      role: 'developer',
      content: sysText,
    })
  }

  // Messages
  for (const msg of params.messages) {
    const converted = convertMessageForResponses(msg)
    if (converted) {
      input.push(converted)
    }
  }

  return input
}

function convertMessageForResponses(msg: any): Record<string, unknown> | null {
  if (!msg.message) return null
  const role = msg.message.role
  const content = msg.message.content

  if (role === 'user') {
    return { role: 'user', content: extractText(content) }
  }

  if (role === 'assistant') {
    const text = extractText(content)
    if (text) {
      return { role: 'assistant', content: text }
    }
    return null
  }

  return null
}

// ---------------------------------------------------------------------------
// Tool conversion for Responses API
// ---------------------------------------------------------------------------

function toolsToResponsesFormat(tools: any[]): Array<Record<string, unknown>> {
  const result: Array<Record<string, unknown>> = []

  for (const tool of tools) {
    if (!tool || typeof tool !== 'object') continue
    const name = tool.name || ''
    const description = tool.description || ''
    const parameters = tool.input_schema || tool.inputSchema || { type: 'object', properties: {} }

    if (!name) continue

    result.push({
      type: 'function',
      name,
      description,
      parameters,
      strict: true,
    })
  }

  return result
}

// ---------------------------------------------------------------------------
// SSE stream parsing for Responses API
// ---------------------------------------------------------------------------

async function* parseResponsesSSEStream(
  response: Response,
  model: string,
): AsyncGenerator<StreamEvent | AssistantMessage | SystemAPIErrorMessage, void> {
  const reader = response.body?.getReader()
  if (!reader) {
    yield createErrorMessage('No response body from OpenAI Responses API')
    return
  }

  const decoder = new TextDecoder()
  let buffer = ''
  let fullText = ''
  let toolCalls: Map<string, { id: string; name: string; arguments: string }> = new Map()
  let totalInputTokens = 0
  let totalOutputTokens = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      let currentEvent = ''

      for (const line of lines) {
        const trimmed = line.trim()

        if (trimmed.startsWith('event: ')) {
          currentEvent = trimmed.slice(7)
          continue
        }

        if (!trimmed.startsWith('data: ')) continue
        const jsonStr = trimmed.slice(6)
        if (!jsonStr || jsonStr === '[DONE]') continue

        let data: any
        try {
          data = JSON.parse(jsonStr)
        } catch {
          continue
        }

        // Handle different event types
        switch (currentEvent) {
          case 'response.output_text.delta': {
            const delta = data.delta || ''
            if (delta) {
              fullText += delta
              yield {
                type: 'content_block_delta',
                delta: { type: 'text_delta', text: delta },
              } as StreamEvent
            }
            break
          }

          case 'response.function_call_arguments.delta': {
            const callId = data.item_id || data.call_id || ''
            if (!toolCalls.has(callId)) {
              toolCalls.set(callId, {
                id: callId,
                name: data.name || '',
                arguments: '',
              })
            }
            const existing = toolCalls.get(callId)!
            if (data.name) existing.name = data.name
            if (data.delta) existing.arguments += data.delta
            break
          }

          case 'response.function_call_arguments.done': {
            const callId = data.item_id || data.call_id || ''
            if (toolCalls.has(callId) && data.name) {
              toolCalls.get(callId)!.name = data.name
            }
            break
          }

          case 'response.completed': {
            // Final response object
            if (data.response?.usage) {
              totalInputTokens = data.response.usage.input_tokens || 0
              totalOutputTokens = data.response.usage.output_tokens || 0
            }
            break
          }

          default:
            // Other events: response.created, response.in_progress, etc.
            if (data.usage) {
              totalInputTokens = data.usage.input_tokens || 0
              totalOutputTokens = data.usage.output_tokens || 0
            }
            break
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  // Record usage
  if (totalInputTokens > 0 || totalOutputTokens > 0) {
    recordProviderUsage('openai', model, totalInputTokens, totalOutputTokens)
  }

  // Build final assistant message
  const contentBlocks: any[] = []

  if (fullText) {
    contentBlocks.push({ type: 'text', text: fullText })
  }

  for (const [, tc] of toolCalls) {
    let parsedArgs: unknown = {}
    try {
      parsedArgs = JSON.parse(tc.arguments)
    } catch {
      parsedArgs = tc.arguments
    }
    contentBlocks.push({
      type: 'tool_use',
      id: tc.id || randomUUID(),
      name: tc.name,
      input: parsedArgs,
    })
  }

  const stopReason = toolCalls.size > 0 ? 'tool_use' : 'end_turn'

  const assistantMessage: AssistantMessage = {
    type: 'assistant',
    uuid: randomUUID() as any,
    message: {
      role: 'assistant',
      id: randomUUID(),
      content: contentBlocks,
      model,
      stop_reason: stopReason,
      usage: {
        input_tokens: totalInputTokens,
        output_tokens: totalOutputTokens,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        server_tool_use: undefined,
      },
    },
    costUSD: 0,
  }

  yield assistantMessage
}

// ---------------------------------------------------------------------------
// Non-streaming response conversion
// ---------------------------------------------------------------------------

function responsesJsonToAssistantMessage(
  json: any,
  model: string,
): AssistantMessage {
  const contentBlocks: any[] = []
  const output = json.output || []

  for (const item of output) {
    if (item.type === 'message') {
      for (const content of item.content || []) {
        if (content.type === 'output_text') {
          contentBlocks.push({ type: 'text', text: content.text })
        }
      }
    }
    if (item.type === 'function_call') {
      let parsedArgs: unknown = {}
      try {
        parsedArgs = JSON.parse(item.arguments || '{}')
      } catch {
        parsedArgs = item.arguments
      }
      contentBlocks.push({
        type: 'tool_use',
        id: item.call_id || randomUUID(),
        name: item.name,
        input: parsedArgs,
      })
    }
  }

  const usage = json.usage || {}
  const inputTokens = usage.input_tokens || 0
  const outputTokens = usage.output_tokens || 0

  if (inputTokens > 0 || outputTokens > 0) {
    recordProviderUsage('openai', model, inputTokens, outputTokens)
  }

  return {
    type: 'assistant',
    uuid: randomUUID() as any,
    message: {
      role: 'assistant',
      id: json.id || randomUUID(),
      content: contentBlocks,
      model,
      stop_reason: contentBlocks.some(b => b.type === 'tool_use') ? 'tool_use' : 'end_turn',
      usage: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        server_tool_use: undefined,
      },
    },
    costUSD: 0,
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractSystemPromptText(systemPrompt: any): string {
  if (typeof systemPrompt === 'string') return systemPrompt
  if (Array.isArray(systemPrompt)) {
    return systemPrompt
      .map((block: any) => {
        if (typeof block === 'string') return block
        if (block?.text) return block.text
        return ''
      })
      .filter(Boolean)
      .join('\n\n')
  }
  if (systemPrompt?.text) return systemPrompt.text
  return ''
}

function extractText(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((b: any) => {
      if (typeof b === 'string') return b
      if (b?.type === 'text') return b.text || ''
      return ''
    })
    .filter(Boolean)
    .join('')
}

function createErrorMessage(text: string): SystemAPIErrorMessage {
  return {
    type: 'system',
    uuid: randomUUID() as any,
    message: {
      role: 'system',
      content: [{ type: 'text', text: `[Provider Error] ${text}` }],
    },
  } as SystemAPIErrorMessage
}
