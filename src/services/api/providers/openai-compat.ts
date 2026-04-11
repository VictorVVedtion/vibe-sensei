/**
 * OpenAI Chat Completions adapter.
 *
 * Raw fetch to {baseUrl}/v1/chat/completions with stream:true.
 * Configurable base URL so one adapter serves:
 *   OpenAI, DeepSeek, OpenRouter, Ollama, Groq, Together, Mistral, xAI
 *
 * All HTTP calls use raw fetch — no SDK dependencies.
 */

import { randomUUID } from 'crypto'
import type {
  AssistantMessage,
  Message,
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
import { getProviderCapabilities } from './capabilities.js'
import { fetchWithRetry, ProviderHttpError, formatErrorForUser, classifyHttpError } from './error-handling.js'
import { recordProviderUsage } from './cost-tracker.js'
import {
  messageStartEvent,
  textBlockStartEvent,
  textBlockDeltaEvent,
  toolUseBlockStartEvent,
  inputJsonDeltaEvent,
  blockStopEvent,
  messageDeltaEvent,
  messageStopEvent,
} from './stream-event-helpers.js'

// ---------------------------------------------------------------------------
// OpenAI-compatible ProviderClient
// ---------------------------------------------------------------------------

export class OpenAICompatProvider implements ProviderClient {
  readonly id: string
  private readonly displayName: string
  private readonly description: string

  constructor(
    providerId: string,
    displayName: string,
    description: string,
  ) {
    this.id = providerId
    this.displayName = displayName
    this.description = description
  }

  async *streamQuery(
    params: ProviderQueryParams,
  ): AsyncGenerator<StreamEvent | AssistantMessage | SystemAPIErrorMessage, void> {
    let apiKey = resolveProviderApiKey(this.id)
    const baseUrl = resolveProviderBaseUrl(this.id)

    // OpenAI: fallback to Codex CLI OAuth if no env var key
    if (!apiKey && this.id === 'openai') {
      try {
        const { resolveCodexAuth } = await import('./openai-codex-oauth.js')
        apiKey = await resolveCodexAuth()
      } catch { /* module unavailable */ }
    }

    if (!apiKey && this.id !== 'ollama') {
      yield createErrorMessage(`No API key configured for ${this.displayName}. Set one of: ${getProviderAuthEnvVars(this.id).join(', ')}`)
      return
    }

    const url = buildChatCompletionsUrl(baseUrl, this.id)
    const body = buildRequestBody(params, this.id)
    const headers = buildHeaders(apiKey, this.id)

    let response: Response
    try {
      response = await fetchWithRetry(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: params.signal,
      }, this.id, { maxRetries: 2 })
    } catch (error) {
      if (error instanceof ProviderHttpError) {
        yield createErrorMessage(formatErrorForUser(error.classified, this.id))
      } else {
        yield createErrorMessage(`Connection error to ${this.displayName}: ${(error as Error).message}`)
      }
      return
    }

    // Parse SSE stream
    yield* parseSSEStream(response, params.model, this.id)
  }

  async query(params: ProviderQueryParams): Promise<AssistantMessage> {
    let apiKey = resolveProviderApiKey(this.id)
    const baseUrl = resolveProviderBaseUrl(this.id)

    // OpenAI: fallback to Codex CLI OAuth if no env var key
    if (!apiKey && this.id === 'openai') {
      try {
        const { resolveCodexAuth } = await import('./openai-codex-oauth.js')
        apiKey = await resolveCodexAuth()
      } catch { /* module unavailable */ }
    }

    if (!apiKey && this.id !== 'ollama') {
      throw new Error(`No API key configured for ${this.displayName}`)
    }

    const url = buildChatCompletionsUrl(baseUrl, this.id)
    const body = buildRequestBody(params, this.id, false)
    const headers = buildHeaders(apiKey, this.id)

    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: params.signal,
    }, this.id)

    const json = await response.json()
    return openAIResponseToAssistantMessage(json, params.model, this.id)
  }

  async verifyCredentials(): Promise<boolean> {
    if (this.id === 'ollama') {
      try {
        const baseUrl = resolveProviderBaseUrl('ollama')
        const resp = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) })
        return resp.ok
      } catch {
        return false
      }
    }

    const key = resolveProviderApiKey(this.id)
    return key !== null && key.length > 0
  }

  getInfo(): ProviderInfo {
    const caps = getProviderCapabilities(this.id)
    return {
      id: this.id,
      name: this.displayName,
      description: this.description,
      baseUrl: resolveProviderBaseUrl(this.id),
      models: getModelsForProvider(this.id),
      authEnvVars: getProviderAuthEnvVars(this.id),
      supportsThinking: caps.supportsThinking,
      supportsTools: caps.supportsTools,
      streamingMode: caps.streamingMode,
    }
  }
}

// ---------------------------------------------------------------------------
// URL building
// ---------------------------------------------------------------------------

function buildChatCompletionsUrl(baseUrl: string, providerId: string): string {
  // Ollama uses a different path
  if (providerId === 'ollama') {
    return `${baseUrl}/v1/chat/completions`
  }
  // OpenRouter already has /api in baseUrl
  if (providerId === 'openrouter') {
    return `${baseUrl}/v1/chat/completions`
  }
  return `${baseUrl}/v1/chat/completions`
}

// ---------------------------------------------------------------------------
// Request body
// ---------------------------------------------------------------------------

function buildRequestBody(
  params: ProviderQueryParams,
  providerId: string,
  stream = true,
): Record<string, unknown> {
  const caps = getProviderCapabilities(providerId)
  const messages = messagesToOpenAI(params.messages, params.systemPrompt, caps.requiresAssistantAfterToolResult)
  const tools = params.tools.length > 0 ? toolsToOpenAI(params.tools, caps.requiresStrictJsonSchema) : undefined

  const body: Record<string, unknown> = {
    model: params.model,
    messages,
    stream,
  }

  if (stream) {
    body.stream_options = { include_usage: true }
  }

  if (tools && tools.length > 0) {
    body.tools = tools
  }

  if (params.maxOutputTokens) {
    body.max_tokens = params.maxOutputTokens
  }

  if (params.temperature !== undefined) {
    body.temperature = params.temperature
  }

  return body
}

// ---------------------------------------------------------------------------
// Headers
// ---------------------------------------------------------------------------

function buildHeaders(apiKey: string | null, providerId: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`
  }

  // OpenRouter-specific headers
  if (providerId === 'openrouter') {
    headers['HTTP-Referer'] = 'https://github.com/vibe-sensei'
    headers['X-Title'] = 'Vibe Sensei'
  }

  return headers
}

// ---------------------------------------------------------------------------
// Message conversion: internal → OpenAI format
// ---------------------------------------------------------------------------

type OpenAIMessage = {
  role: string
  content?: string | Array<{ type: string; text?: string; image_url?: { url: string } }>
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>
  tool_call_id?: string
  name?: string
}

function messagesToOpenAI(
  messages: Message[],
  systemPrompt: any,
  requiresAssistantAfterToolResult: boolean,
): OpenAIMessage[] {
  const result: OpenAIMessage[] = []

  // System prompt
  const sysText = extractSystemPromptText(systemPrompt)
  if (sysText) {
    result.push({ role: 'system', content: sysText })
  }

  for (const msg of messages) {
    const converted = convertSingleMessage(msg)
    if (converted) {
      result.push(converted)
    }
  }

  // Insert assistant stubs after tool results if required
  if (requiresAssistantAfterToolResult) {
    const patched: OpenAIMessage[] = []
    for (let i = 0; i < result.length; i++) {
      patched.push(result[i])
      if (
        result[i].role === 'tool' &&
        (i + 1 >= result.length || result[i + 1].role !== 'assistant')
      ) {
        // DeepSeek/Ollama need an assistant message after tool results
        // Only insert if not already followed by one
        if (i + 1 < result.length && result[i + 1].role !== 'assistant') {
          patched.push({ role: 'assistant', content: '' })
        }
      }
    }
    return patched
  }

  return result
}

function convertSingleMessage(msg: Message): OpenAIMessage | null {
  if (!msg.message) return null

  const role = msg.message.role
  const content = msg.message.content

  if (role === 'user') {
    return {
      role: 'user',
      content: extractTextContent(content),
    }
  }

  if (role === 'assistant') {
    // Check for tool use blocks
    if (Array.isArray(content)) {
      const toolCalls: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> = []
      let textParts: string[] = []

      for (const block of content) {
        if (typeof block === 'object' && block !== null) {
          if ('type' in block && block.type === 'tool_use') {
            const b = block as any
            toolCalls.push({
              id: b.id || randomUUID(),
              type: 'function',
              function: {
                name: b.name,
                arguments: typeof b.input === 'string' ? b.input : JSON.stringify(b.input ?? {}),
              },
            })
          } else if ('type' in block && block.type === 'text') {
            textParts.push((block as any).text || '')
          }
        }
      }

      const result: OpenAIMessage = { role: 'assistant' }
      if (textParts.length > 0) {
        result.content = textParts.join('')
      }
      if (toolCalls.length > 0) {
        result.tool_calls = toolCalls
      }
      return result
    }

    return {
      role: 'assistant',
      content: extractTextContent(content),
    }
  }

  // Tool results
  if (msg.toolUseResult !== undefined && Array.isArray(content)) {
    for (const block of content) {
      if (typeof block === 'object' && block !== null && 'type' in block && block.type === 'tool_result') {
        const b = block as any
        return {
          role: 'tool',
          tool_call_id: b.tool_use_id || '',
          content: typeof b.content === 'string'
            ? b.content
            : JSON.stringify(b.content ?? ''),
        }
      }
    }
  }

  return null
}

function extractTextContent(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''

  const texts: string[] = []
  for (const block of content) {
    if (typeof block === 'string') {
      texts.push(block)
    } else if (typeof block === 'object' && block !== null && 'type' in block) {
      if ((block as any).type === 'text') {
        texts.push((block as any).text || '')
      }
    }
  }
  return texts.join('')
}

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

// ---------------------------------------------------------------------------
// Tool conversion
// ---------------------------------------------------------------------------

function toolsToOpenAI(
  tools: any[],
  strict: boolean,
): Array<{ type: 'function'; function: { name: string; description: string; parameters: unknown; strict?: boolean } }> {
  const result: Array<{ type: 'function'; function: { name: string; description: string; parameters: unknown; strict?: boolean } }> = []

  for (const tool of tools) {
    if (!tool || typeof tool !== 'object') continue

    const name = tool.name || (tool as any).function?.name || ''
    if (!name) continue
    const description = tool.description || (tool as any).function?.description || ''

    // Convert Zod → JSON Schema when necessary. `tool.inputSchema` in
    // vibe-sensei is a raw Zod object which leaks internal `def` field.
    let parameters: any
    if (tool.inputJSONSchema) {
      parameters = tool.inputJSONSchema
    } else if (tool.input_schema) {
      parameters = tool.input_schema
    } else if ((tool as any).function?.parameters) {
      parameters = (tool as any).function.parameters
    } else if (tool.inputSchema) {
      // Raw Zod — convert.
      const isPreConverted =
        typeof tool.inputSchema === 'object' &&
        !tool.inputSchema._def &&
        !tool.inputSchema.def &&
        (tool.inputSchema.type === 'object' || tool.inputSchema.properties)
      if (isPreConverted) {
        parameters = tool.inputSchema
      } else {
        try {
          const { zodToJsonSchema } = require('../../../utils/zodToJsonSchema.js')
          parameters = zodToJsonSchema(tool.inputSchema)
        } catch {
          parameters = { type: 'object', properties: {} }
        }
      }
    } else {
      parameters = { type: 'object', properties: {} }
    }

    const fn: { name: string; description: string; parameters: unknown; strict?: boolean } = {
      name,
      description,
      parameters,
    }

    if (strict) {
      fn.strict = true
    }

    result.push({ type: 'function', function: fn })
  }

  return result
}

// ---------------------------------------------------------------------------
// SSE stream parsing
// ---------------------------------------------------------------------------

async function* parseSSEStream(
  response: Response,
  model: string,
  providerId: string,
): AsyncGenerator<StreamEvent | AssistantMessage | SystemAPIErrorMessage, void> {
  const reader = response.body?.getReader()
  if (!reader) {
    yield createErrorMessage('No response body from provider')
    return
  }

  const messageId = `msg_${randomUUID()}`
  const decoder = new TextDecoder()
  let buffer = ''
  let fullText = ''
  // toolIdx → accumulator state. `blockIdx` is the Anthropic stream block index.
  type ToolCallState = {
    id: string
    name: string
    arguments: string
    blockIdx: number
    blockStarted: boolean
  }
  const toolCalls: Map<number, ToolCallState> = new Map()
  let finishReason: string | null = null
  let totalInputTokens = 0
  let totalOutputTokens = 0

  // Block index state
  let textBlockStarted = false
  const textBlockIndex = 0
  let nextBlockIndex = 1

  // 1. message_start
  yield messageStartEvent(messageId, model)

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed === 'data: [DONE]') continue
        if (!trimmed.startsWith('data: ')) continue

        const jsonStr = trimmed.slice(6)
        let chunk: any
        try { chunk = JSON.parse(jsonStr) } catch { continue }

        // Usage-only chunks
        const choice = chunk.choices?.[0]
        if (!choice) {
          if (chunk.usage) {
            totalInputTokens = chunk.usage.prompt_tokens || 0
            totalOutputTokens = chunk.usage.completion_tokens || 0
          }
          continue
        }

        const delta = choice.delta
        if (!delta) {
          if (choice.finish_reason) finishReason = choice.finish_reason
          continue
        }

        // Text content
        if (delta.content) {
          if (!textBlockStarted) {
            textBlockStarted = true
            yield textBlockStartEvent(textBlockIndex)
          }
          fullText += delta.content
          yield textBlockDeltaEvent(textBlockIndex, delta.content)
        }

        // Tool calls — streamed incrementally by provider index
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0
            let state = toolCalls.get(idx)
            if (!state) {
              state = {
                id: tc.id || `toolu_${randomUUID()}`,
                name: tc.function?.name || '',
                arguments: '',
                blockIdx: -1,
                blockStarted: false,
              }
              toolCalls.set(idx, state)
            }
            if (tc.function?.name) {
              state.name = tc.function.name
            }
            if (tc.id && !state.id.startsWith('toolu_')) {
              state.id = tc.id
            }

            // Emit content_block_start once we have both id and name
            if (!state.blockStarted && state.name) {
              // Close text block if still open — tool blocks follow text
              if (textBlockStarted && fullText) {
                // We keep text open until request ends; only close if switching
                // content type. OpenAI returns text and tool_calls in separate
                // chunks though, so it's safe to close here.
              }
              state.blockIdx = nextBlockIndex++
              state.blockStarted = true
              yield toolUseBlockStartEvent(state.blockIdx, state.id, state.name)
            }

            if (tc.function?.arguments) {
              state.arguments += tc.function.arguments
              if (state.blockStarted) {
                yield inputJsonDeltaEvent(state.blockIdx, tc.function.arguments)
              }
            }
          }
        }

        // Finish reason
        if (choice.finish_reason) {
          finishReason = choice.finish_reason
        }

        // Usage
        if (chunk.usage) {
          totalInputTokens = chunk.usage.prompt_tokens || 0
          totalOutputTokens = chunk.usage.completion_tokens || 0
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  // Close open blocks
  if (textBlockStarted) {
    yield blockStopEvent(textBlockIndex)
  }
  for (const [, state] of toolCalls) {
    if (state.blockStarted) {
      yield blockStopEvent(state.blockIdx)
    }
  }

  // Map finish reason
  const stopReason = mapFinishReason(finishReason)

  // message_delta + message_stop
  yield messageDeltaEvent(stopReason, {
    input_tokens: totalInputTokens,
    output_tokens: totalOutputTokens,
  })
  yield messageStopEvent()

  // Record usage
  if (totalInputTokens > 0 || totalOutputTokens > 0) {
    recordProviderUsage(providerId, model, totalInputTokens, totalOutputTokens)
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
      id: tc.id,
      name: tc.name,
      input: parsedArgs,
    })
  }

  const assistantMessage: AssistantMessage = {
    type: 'assistant',
    uuid: randomUUID() as any,
    timestamp: new Date().toISOString(),
    message: {
      role: 'assistant',
      id: messageId,
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
  } as any

  yield assistantMessage
}

// ---------------------------------------------------------------------------
// Non-streaming response conversion
// ---------------------------------------------------------------------------

function openAIResponseToAssistantMessage(
  json: any,
  model: string,
  providerId: string,
): AssistantMessage {
  const choice = json.choices?.[0]
  const message = choice?.message || {}
  const contentBlocks: any[] = []

  if (message.content) {
    contentBlocks.push({ type: 'text', text: message.content })
  }

  if (message.tool_calls) {
    for (const tc of message.tool_calls) {
      let parsedArgs: unknown = {}
      try {
        parsedArgs = JSON.parse(tc.function.arguments)
      } catch {
        parsedArgs = tc.function.arguments
      }
      contentBlocks.push({
        type: 'tool_use',
        id: tc.id || randomUUID(),
        name: tc.function.name,
        input: parsedArgs,
      })
    }
  }

  const usage = json.usage || {}
  const inputTokens = usage.prompt_tokens || 0
  const outputTokens = usage.completion_tokens || 0

  if (inputTokens > 0 || outputTokens > 0) {
    recordProviderUsage(providerId, model, inputTokens, outputTokens)
  }

  return {
    type: 'assistant',
    uuid: randomUUID() as any,
    message: {
      role: 'assistant',
      id: json.id || randomUUID(),
      content: contentBlocks,
      model,
      stop_reason: mapFinishReason(choice?.finish_reason),
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

function mapFinishReason(reason: string | null): string {
  switch (reason) {
    case 'tool_calls':
      return 'tool_use'
    case 'stop':
      return 'end_turn'
    case 'length':
      return 'max_tokens'
    case 'content_filter':
      return 'end_turn'
    default:
      return 'end_turn'
  }
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
