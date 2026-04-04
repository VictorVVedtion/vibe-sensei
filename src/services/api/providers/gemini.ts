/**
 * Google Gemini adapter.
 *
 * Raw fetch to generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse
 * Uses contents[] format (user/model roles), systemInstruction, functionDeclarations.
 * API key via x-goog-api-key header (NOT URL param).
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
// Gemini ProviderClient
// ---------------------------------------------------------------------------

export class GeminiProvider implements ProviderClient {
  readonly id = 'gemini'

  async *streamQuery(
    params: ProviderQueryParams,
  ): AsyncGenerator<StreamEvent | AssistantMessage | SystemAPIErrorMessage, void> {
    const apiKey = resolveProviderApiKey('gemini')
    const baseUrl = resolveProviderBaseUrl('gemini')

    if (!apiKey) {
      // Try OAuth fallback
      const oauthToken = await tryGeminiOAuth()
      if (!oauthToken) {
        yield createErrorMessage(`No API key configured for Gemini. Set one of: ${getProviderAuthEnvVars('gemini').join(', ')}`)
        return
      }
      yield* this.streamWithAuth(params, baseUrl, { type: 'oauth', token: oauthToken })
      return
    }

    yield* this.streamWithAuth(params, baseUrl, { type: 'api-key', key: apiKey })
  }

  private async *streamWithAuth(
    params: ProviderQueryParams,
    baseUrl: string,
    auth: { type: 'api-key'; key: string } | { type: 'oauth'; token: string },
  ): AsyncGenerator<StreamEvent | AssistantMessage | SystemAPIErrorMessage, void> {
    const url = `${baseUrl}/v1beta/models/${params.model}:streamGenerateContent?alt=sse`
    const body = buildGeminiRequestBody(params)
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (auth.type === 'api-key') {
      headers['x-goog-api-key'] = auth.key
    } else {
      headers['Authorization'] = `Bearer ${auth.token}`
    }

    let response: Response
    try {
      response = await fetchWithRetry(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: params.signal,
      }, 'gemini', { maxRetries: 2 })
    } catch (error) {
      if (error instanceof ProviderHttpError) {
        yield createErrorMessage(formatErrorForUser(error.classified, 'gemini'))
      } else {
        yield createErrorMessage(`Connection error to Gemini: ${(error as Error).message}`)
      }
      return
    }

    yield* parseGeminiSSEStream(response, params.model)
  }

  async query(params: ProviderQueryParams): Promise<AssistantMessage> {
    const apiKey = resolveProviderApiKey('gemini')
    const baseUrl = resolveProviderBaseUrl('gemini')

    if (!apiKey) {
      throw new Error('No API key configured for Gemini')
    }

    const url = `${baseUrl}/v1beta/models/${params.model}:generateContent`
    const body = buildGeminiRequestBody(params)
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    }

    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: params.signal,
    }, 'gemini')

    const json = await response.json()
    return geminiResponseToAssistantMessage(json, params.model)
  }

  async verifyCredentials(): Promise<boolean> {
    const key = resolveProviderApiKey('gemini')
    if (key) return true

    // Check for OAuth
    const oauthToken = await tryGeminiOAuth()
    return oauthToken !== null
  }

  getInfo(): ProviderInfo {
    return {
      id: 'gemini',
      name: 'Google Gemini',
      description: 'Gemini family of models (3.1 Pro, 3 Flash, 2.5 Pro/Flash)',
      baseUrl: resolveProviderBaseUrl('gemini'),
      models: getModelsForProvider('gemini'),
      authEnvVars: getProviderAuthEnvVars('gemini'),
      supportsThinking: true,
      supportsTools: true,
      streamingMode: 'sse',
    }
  }
}

// ---------------------------------------------------------------------------
// Request body building
// ---------------------------------------------------------------------------

function buildGeminiRequestBody(
  params: ProviderQueryParams,
): Record<string, unknown> {
  const contents = messagesToGeminiContents(params.messages)
  const body: Record<string, unknown> = { contents }

  // System instruction
  const sysText = extractSystemPromptText(params.systemPrompt)
  if (sysText) {
    body.systemInstruction = {
      parts: [{ text: sysText }],
    }
  }

  // Tools as function declarations
  if (params.tools.length > 0) {
    const functionDeclarations = toolsToGeminiFunctions(params.tools)
    if (functionDeclarations.length > 0) {
      body.tools = [{ functionDeclarations }]
    }
  }

  // Generation config
  const generationConfig: Record<string, unknown> = {}
  if (params.maxOutputTokens) {
    generationConfig.maxOutputTokens = params.maxOutputTokens
  }
  if (params.temperature !== undefined) {
    generationConfig.temperature = params.temperature
  }
  if (Object.keys(generationConfig).length > 0) {
    body.generationConfig = generationConfig
  }

  return body
}

// ---------------------------------------------------------------------------
// Message conversion: internal → Gemini contents[]
// ---------------------------------------------------------------------------

type GeminiContent = {
  role: 'user' | 'model'
  parts: Array<{ text?: string; functionCall?: { name: string; args: unknown }; functionResponse?: { name: string; response: unknown } }>
}

function messagesToGeminiContents(messages: any[]): GeminiContent[] {
  const contents: GeminiContent[] = []

  for (const msg of messages) {
    if (!msg.message) continue
    const role = msg.message.role
    const content = msg.message.content

    if (role === 'user') {
      // Check for tool results in user messages
      if (Array.isArray(content)) {
        const parts: any[] = []
        for (const block of content) {
          if (typeof block === 'object' && block !== null && 'type' in block) {
            if (block.type === 'tool_result') {
              parts.push({
                functionResponse: {
                  name: (block as any).tool_use_id || 'unknown',
                  response: {
                    content: typeof (block as any).content === 'string'
                      ? (block as any).content
                      : JSON.stringify((block as any).content ?? ''),
                  },
                },
              })
            } else if (block.type === 'text') {
              parts.push({ text: (block as any).text || '' })
            }
          } else if (typeof block === 'string') {
            parts.push({ text: block })
          }
        }
        if (parts.length > 0) {
          contents.push({ role: 'user', parts })
        }
      } else {
        const text = extractText(content)
        if (text) {
          contents.push({ role: 'user', parts: [{ text }] })
        }
      }
    } else if (role === 'assistant') {
      if (Array.isArray(content)) {
        const parts: any[] = []
        for (const block of content) {
          if (typeof block === 'object' && block !== null && 'type' in block) {
            if (block.type === 'tool_use') {
              parts.push({
                functionCall: {
                  name: (block as any).name,
                  args: (block as any).input ?? {},
                },
              })
            } else if (block.type === 'text') {
              parts.push({ text: (block as any).text || '' })
            }
          }
        }
        if (parts.length > 0) {
          contents.push({ role: 'model', parts })
        }
      } else {
        const text = extractText(content)
        if (text) {
          contents.push({ role: 'model', parts: [{ text }] })
        }
      }
    }
  }

  // Gemini requires alternating roles — merge consecutive same-role entries
  return mergeConsecutiveRoles(contents)
}

function mergeConsecutiveRoles(contents: GeminiContent[]): GeminiContent[] {
  if (contents.length === 0) return contents

  const merged: GeminiContent[] = [contents[0]]

  for (let i = 1; i < contents.length; i++) {
    const last = merged[merged.length - 1]
    if (contents[i].role === last.role) {
      last.parts.push(...contents[i].parts)
    } else {
      merged.push(contents[i])
    }
  }

  return merged
}

// ---------------------------------------------------------------------------
// Tool conversion
// ---------------------------------------------------------------------------

function toolsToGeminiFunctions(
  tools: any[],
): Array<{ name: string; description: string; parameters: unknown }> {
  const result: Array<{ name: string; description: string; parameters: unknown }> = []

  for (const tool of tools) {
    if (!tool || typeof tool !== 'object') continue
    const name = tool.name || ''
    const description = tool.description || ''
    const parameters = tool.input_schema || tool.inputSchema || { type: 'object', properties: {} }

    if (!name) continue

    // Gemini does not accept additionalProperties in the schema
    const cleanedParams = removeAdditionalProperties(parameters)

    result.push({ name, description, parameters: cleanedParams })
  }

  return result
}

function removeAdditionalProperties(schema: any): any {
  if (!schema || typeof schema !== 'object') return schema
  const cleaned = { ...schema }
  delete cleaned.additionalProperties

  if (cleaned.properties) {
    const props: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(cleaned.properties)) {
      props[key] = removeAdditionalProperties(value)
    }
    cleaned.properties = props
  }

  if (cleaned.items) {
    cleaned.items = removeAdditionalProperties(cleaned.items)
  }

  return cleaned
}

// ---------------------------------------------------------------------------
// SSE stream parsing
// ---------------------------------------------------------------------------

async function* parseGeminiSSEStream(
  response: Response,
  model: string,
): AsyncGenerator<StreamEvent | AssistantMessage | SystemAPIErrorMessage, void> {
  const reader = response.body?.getReader()
  if (!reader) {
    yield createErrorMessage('No response body from Gemini')
    return
  }

  const decoder = new TextDecoder()
  let buffer = ''
  let fullText = ''
  let toolCalls: Array<{ name: string; args: unknown }> = []
  let totalInputTokens = 0
  let totalOutputTokens = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data: ')) continue
        const jsonStr = trimmed.slice(6)
        if (!jsonStr) continue

        let chunk: any
        try {
          chunk = JSON.parse(jsonStr)
        } catch {
          continue
        }

        // Process candidates
        const candidates = chunk.candidates || []
        for (const candidate of candidates) {
          const parts = candidate.content?.parts || []
          for (const part of parts) {
            if (part.text) {
              fullText += part.text
              yield {
                type: 'content_block_delta',
                delta: { type: 'text_delta', text: part.text },
              } as StreamEvent
            }
            if (part.functionCall) {
              toolCalls.push({
                name: part.functionCall.name,
                args: part.functionCall.args || {},
              })
            }
          }
        }

        // Usage metadata
        if (chunk.usageMetadata) {
          totalInputTokens = chunk.usageMetadata.promptTokenCount || 0
          totalOutputTokens = chunk.usageMetadata.candidatesTokenCount || 0
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  // Record usage
  if (totalInputTokens > 0 || totalOutputTokens > 0) {
    recordProviderUsage('gemini', model, totalInputTokens, totalOutputTokens)
  }

  // Build final assistant message
  const contentBlocks: any[] = []

  if (fullText) {
    contentBlocks.push({ type: 'text', text: fullText })
  }

  for (const tc of toolCalls) {
    contentBlocks.push({
      type: 'tool_use',
      id: randomUUID(),
      name: tc.name,
      input: tc.args,
    })
  }

  const stopReason = toolCalls.length > 0 ? 'tool_use' : 'end_turn'

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

function geminiResponseToAssistantMessage(
  json: any,
  model: string,
): AssistantMessage {
  const contentBlocks: any[] = []
  const toolCalls: Array<{ name: string; args: unknown }> = []

  const candidates = json.candidates || []
  for (const candidate of candidates) {
    const parts = candidate.content?.parts || []
    for (const part of parts) {
      if (part.text) {
        contentBlocks.push({ type: 'text', text: part.text })
      }
      if (part.functionCall) {
        toolCalls.push({
          name: part.functionCall.name,
          args: part.functionCall.args || {},
        })
      }
    }
  }

  for (const tc of toolCalls) {
    contentBlocks.push({
      type: 'tool_use',
      id: randomUUID(),
      name: tc.name,
      input: tc.args,
    })
  }

  const usage = json.usageMetadata || {}
  const inputTokens = usage.promptTokenCount || 0
  const outputTokens = usage.candidatesTokenCount || 0

  if (inputTokens > 0 || outputTokens > 0) {
    recordProviderUsage('gemini', model, inputTokens, outputTokens)
  }

  return {
    type: 'assistant',
    uuid: randomUUID() as any,
    message: {
      role: 'assistant',
      id: randomUUID(),
      content: contentBlocks,
      model,
      stop_reason: toolCalls.length > 0 ? 'tool_use' : 'end_turn',
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
// OAuth fallback — reuse Gemini CLI credentials
// ---------------------------------------------------------------------------

async function tryGeminiOAuth(): Promise<string | null> {
  try {
    const { resolveGeminiAuth } = await import('./gemini-oauth.js')
    const auth = await resolveGeminiAuth()
    if (auth?.type === 'oauth') return auth.accessToken
    if (auth?.type === 'api-key') return null // already handled
  } catch {
    // Module not available or failed
  }
  return null
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
