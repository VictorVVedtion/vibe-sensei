/**
 * OpenAI Codex Provider — full implementation.
 *
 * Calls https://chatgpt.com/backend-api/codex/responses with ChatGPT Plus/Pro
 * OAuth token. Implements the OpenAI Responses API (not Chat Completions):
 *
 *   - Responses API "input" format (message / function_call / function_call_output)
 *   - Responses API function tool format
 *   - Full SSE event stream: response.output_item.added/done,
 *     response.output_text.delta, response.function_call_arguments.delta, etc.
 *   - Reasoning summaries (for gpt-5.* models)
 *   - Tool calls with streaming argument JSON
 *   - Cache retention / session_id for prompt_cache_key
 *
 * Ported from @mariozechner/pi-ai (openai-responses-shared.js + openai-codex-responses.js).
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
import { resolveCodexCredentials } from './openai-codex-oauth.js'
import { recordProviderUsage } from './cost-tracker.js'
import {
  messageStartEvent,
  textBlockStartEvent,
  textBlockDeltaEvent,
  toolUseBlockStartEvent,
  inputJsonDeltaEvent,
  thinkingBlockStartEvent,
  thinkingDeltaEvent,
  blockStopEvent,
  messageDeltaEvent,
  messageStopEvent,
} from './stream-event-helpers.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_CODEX_BASE_URL = 'https://chatgpt.com/backend-api'
const ORIGINATOR = 'vibe-sensei'
const MAX_RETRIES = 3
const BASE_DELAY_MS = 1000

// Responses API SSE event types we handle
type ResponsesEvent =
  | { type: 'response.created'; response?: any }
  | { type: 'response.output_item.added'; item?: any }
  | { type: 'response.output_item.done'; item?: any }
  | { type: 'response.content_part.added'; part?: any; item_id?: string }
  | { type: 'response.content_part.done'; part?: any }
  | { type: 'response.output_text.delta'; delta?: string; item_id?: string }
  | { type: 'response.output_text.done'; text?: string }
  | { type: 'response.refusal.delta'; delta?: string }
  | { type: 'response.refusal.done'; refusal?: string }
  | { type: 'response.function_call_arguments.delta'; delta?: string; item_id?: string }
  | { type: 'response.function_call_arguments.done'; arguments?: string }
  | { type: 'response.reasoning_summary_part.added'; part?: any }
  | { type: 'response.reasoning_summary_part.done' }
  | { type: 'response.reasoning_summary_text.delta'; delta?: string }
  | { type: 'response.completed'; response?: any }
  | { type: 'response.done'; response?: any }
  | { type: 'response.failed'; response?: any }
  | { type: 'error'; code?: string; message?: string }

// ---------------------------------------------------------------------------
// Provider class
// ---------------------------------------------------------------------------

export class OpenAICodexProvider implements ProviderClient {
  readonly id = 'openai-codex'

  async *streamQuery(
    params: ProviderQueryParams,
  ): AsyncGenerator<StreamEvent | AssistantMessage | SystemAPIErrorMessage, void> {
    const creds = await resolveCodexCredentials()
    if (!creds) {
      yield createErrorMessage(
        'Not logged in to OpenAI Codex. Run /login → OpenAI, or set OPENAI_API_KEY.',
      )
      return
    }

    const body = buildResponsesRequestBody(params)
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${creds.access}`,
      'chatgpt-account-id': creds.accountId,
      'OpenAI-Beta': 'responses=experimental',
      'originator': ORIGINATOR,
      'content-type': 'application/json',
      'accept': 'text/event-stream',
      'User-Agent': `vibe-sensei (${process.platform})`,
    }

    const url = `${DEFAULT_CODEX_BASE_URL}/codex/responses`
    const bodyJson = JSON.stringify(body)

    // Retry loop for transient errors
    let response: Response | undefined
    let lastError: Error | undefined
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (params.signal?.aborted) {
        yield createErrorMessage('Request was aborted')
        return
      }
      try {
        response = await fetch(url, {
          method: 'POST',
          headers,
          body: bodyJson,
          signal: params.signal,
        })
        if (response.ok) break

        const errorText = await response.text().catch(() => '')
        if (attempt < MAX_RETRIES && isRetryableError(response.status, errorText)) {
          await sleep(BASE_DELAY_MS * 2 ** attempt, params.signal)
          continue
        }

        // Non-retryable or max retries
        const friendly = parseErrorBody(errorText, response.status)
        yield createErrorMessage(friendly)
        return
      } catch (err) {
        if (err instanceof Error && (err.name === 'AbortError' || err.message === 'Request was aborted')) {
          yield createErrorMessage('Request was aborted')
          return
        }
        lastError = err instanceof Error ? err : new Error(String(err))
        if (attempt < MAX_RETRIES) {
          await sleep(BASE_DELAY_MS * 2 ** attempt, params.signal)
          continue
        }
        yield createErrorMessage(`Connection error: ${lastError.message}`)
        return
      }
    }

    if (!response || !response.ok) {
      yield createErrorMessage(lastError?.message || 'Failed after retries')
      return
    }

    yield* processResponsesStream(response, params.model)
  }

  async query(params: ProviderQueryParams): Promise<AssistantMessage> {
    let last: AssistantMessage | undefined
    for await (const ev of this.streamQuery(params)) {
      if ('type' in ev && ev.type === 'assistant') {
        last = ev as AssistantMessage
      }
    }
    if (!last) throw new Error('No response from ChatGPT Codex backend')
    return last
  }

  async verifyCredentials(): Promise<boolean> {
    const creds = await resolveCodexCredentials()
    return creds !== null
  }

  getInfo(): ProviderInfo {
    return {
      id: 'openai-codex',
      name: 'OpenAI (ChatGPT Codex)',
      description: 'ChatGPT Plus/Pro subscription via OAuth → chatgpt.com/backend-api',
      baseUrl: DEFAULT_CODEX_BASE_URL,
      models: [],
      authEnvVars: [],
      supportsThinking: true,
      supportsTools: true,
      streamingMode: 'sse',
    }
  }
}

// ---------------------------------------------------------------------------
// Request body (Responses API format)
// ---------------------------------------------------------------------------

function buildResponsesRequestBody(params: ProviderQueryParams): Record<string, unknown> {
  const input = convertMessagesToResponsesInput(params.messages)
  const sysText = extractSystemPromptText(params.systemPrompt)

  const body: Record<string, unknown> = {
    model: stripProviderPrefix(params.model),
    store: false,
    stream: true,
    input,
    text: { verbosity: 'medium' },
    include: ['reasoning.encrypted_content'],
    tool_choice: 'auto',
    parallel_tool_calls: true,
  }

  if (sysText) {
    body.instructions = sysText
  }

  if (params.temperature !== undefined) {
    body.temperature = params.temperature
  }

  // Tools
  if (params.tools && params.tools.length > 0) {
    const tools = convertToolsToResponses(params.tools as any[])
    if (tools.length > 0) {
      body.tools = tools
    }
  }

  // Reasoning (thinking) for gpt-5.* models
  const modelId = stripProviderPrefix(params.model)
  if (modelId.startsWith('gpt-5') || modelId.startsWith('o1') || modelId.startsWith('o3')) {
    body.reasoning = {
      effort: 'medium',
      summary: 'auto',
    }
  }

  return body
}

function stripProviderPrefix(model: string): string {
  return model.includes('/') ? model.split('/').slice(-1)[0]! : model
}

// ---------------------------------------------------------------------------
// Message conversion: vibe-sensei Message[] → Responses API input[]
// ---------------------------------------------------------------------------

type ResponsesInputItem =
  | {
      type: 'message'
      role: 'user' | 'assistant' | 'developer' | 'system'
      content: Array<{ type: 'input_text' | 'output_text'; text: string; annotations?: unknown[] }>
      status?: string
      id?: string
    }
  | {
      type: 'function_call'
      id?: string
      call_id: string
      name: string
      arguments: string
    }
  | {
      type: 'function_call_output'
      call_id: string
      output: string
    }

function convertMessagesToResponsesInput(messages: Message[]): ResponsesInputItem[] {
  const items: ResponsesInputItem[] = []

  for (const msg of messages) {
    if (!msg.message) continue
    const role = (msg.message as any).role as string | undefined
    const content = (msg.message as any).content

    if (role === 'user') {
      // Check if this is a tool_result-carrying user message
      if (Array.isArray(content)) {
        let hasToolResult = false
        for (const block of content) {
          if (typeof block === 'object' && block !== null && 'type' in block) {
            const b = block as any
            if (b.type === 'tool_result') {
              hasToolResult = true
              const output =
                typeof b.content === 'string'
                  ? b.content
                  : Array.isArray(b.content)
                    ? b.content
                        .map((c: any) => (typeof c === 'string' ? c : c?.text || ''))
                        .filter(Boolean)
                        .join('\n')
                    : JSON.stringify(b.content ?? '')
              items.push({
                type: 'function_call_output',
                call_id: b.tool_use_id || '',
                output: sanitizeText(output),
              })
            }
          }
        }
        if (!hasToolResult) {
          // Regular user message with array content
          const text = extractInlineText(content)
          if (text) {
            items.push({
              type: 'message',
              role: 'user',
              content: [{ type: 'input_text', text: sanitizeText(text) }],
            })
          }
        }
      } else if (typeof content === 'string' && content.trim()) {
        items.push({
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: sanitizeText(content) }],
        })
      }
      continue
    }

    if (role === 'assistant') {
      if (Array.isArray(content)) {
        let textBuffer = ''
        const pendingToolCalls: Array<{ id: string; name: string; input: unknown }> = []

        for (const block of content) {
          if (typeof block !== 'object' || block === null || !('type' in block)) continue
          const b = block as any
          if (b.type === 'text') {
            textBuffer += b.text || ''
          } else if (b.type === 'tool_use') {
            pendingToolCalls.push({
              id: b.id || randomUUID(),
              name: b.name || '',
              input: b.input ?? {},
            })
          }
          // Thinking blocks: skip (Responses API wants reasoning_encrypted_content)
        }

        if (textBuffer.trim()) {
          items.push({
            type: 'message',
            role: 'assistant',
            content: [{ type: 'output_text', text: sanitizeText(textBuffer), annotations: [] }],
            status: 'completed',
            id: `msg_${randomUUID().replace(/-/g, '').slice(0, 24)}`,
          })
        }

        for (const tc of pendingToolCalls) {
          const callId = tc.id
          const itemId = `fc_${randomUUID().replace(/-/g, '').slice(0, 24)}`
          items.push({
            type: 'function_call',
            id: itemId,
            call_id: callId,
            name: tc.name,
            arguments: typeof tc.input === 'string' ? tc.input : JSON.stringify(tc.input ?? {}),
          })
        }
      } else if (typeof content === 'string' && content.trim()) {
        items.push({
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: sanitizeText(content), annotations: [] }],
          status: 'completed',
        })
      }
      continue
    }
  }

  return items
}

function extractInlineText(blocks: any[]): string {
  const parts: string[] = []
  for (const b of blocks) {
    if (typeof b === 'string') parts.push(b)
    else if (typeof b === 'object' && b !== null && 'type' in b && b.type === 'text') {
      parts.push((b as any).text || '')
    }
  }
  return parts.join('')
}

function sanitizeText(text: string): string {
  // Strip lone surrogates (Responses API is strict about valid UTF-8)
  return text.replace(/[\uD800-\uDFFF]/g, '?')
}

function extractSystemPromptText(systemPrompt: any): string {
  if (!systemPrompt) return ''
  if (typeof systemPrompt === 'string') return systemPrompt
  if (Array.isArray(systemPrompt)) {
    return systemPrompt
      .map((b: any) => (typeof b === 'string' ? b : b?.text || ''))
      .filter(Boolean)
      .join('\n\n')
  }
  if (systemPrompt.text) return systemPrompt.text
  return ''
}

// ---------------------------------------------------------------------------
// Tool conversion: vibe-sensei Tools → Responses API tools
// ---------------------------------------------------------------------------

function convertToolsToResponses(tools: any[]): Array<{
  type: 'function'
  name: string
  description: string
  parameters: unknown
  strict: boolean
}> {
  const result: Array<{ type: 'function'; name: string; description: string; parameters: unknown; strict: boolean }> = []
  for (const tool of tools) {
    if (!tool || typeof tool !== 'object') continue
    const name = tool.name || (tool as any).function?.name || ''
    if (!name) continue
    const description = tool.description || (tool as any).function?.description || ''

    // Convert Zod → JSON Schema when necessary (vibe-sensei tools carry
    // raw Zod in `inputSchema`). Prefer pre-converted fields first.
    let parameters: any
    if (tool.inputJSONSchema) {
      parameters = tool.inputJSONSchema
    } else if (tool.input_schema) {
      parameters = tool.input_schema
    } else if ((tool as any).function?.parameters) {
      parameters = (tool as any).function.parameters
    } else if (tool.inputSchema) {
      parameters = toZodJsonSchema(tool.inputSchema)
    } else {
      parameters = { type: 'object', properties: {} }
    }

    // Strip $refs / $defs — OpenAI Responses API schemas must be self-contained
    parameters = sanitizeResponsesSchema(parameters)

    result.push({
      type: 'function',
      name,
      description: typeof description === 'string' ? description : '',
      parameters,
      strict: false,
    })
  }
  return result
}

function toZodJsonSchema(schema: any): any {
  if (
    schema &&
    typeof schema === 'object' &&
    !schema._def &&
    !schema.def &&
    (schema.type === 'object' || schema.properties)
  ) {
    return schema
  }
  try {
    const { zodToJsonSchema } = require('../../../utils/zodToJsonSchema.js')
    return zodToJsonSchema(schema)
  } catch {
    return { type: 'object', properties: {} }
  }
}

function sanitizeResponsesSchema(schema: any): any {
  if (!schema || typeof schema !== 'object') return schema
  const defs = schema.$defs || schema.definitions || {}
  return inlineSchemaRefs(schema, defs)
}

function inlineSchemaRefs(node: any, defs: Record<string, any>): any {
  if (Array.isArray(node)) return node.map(i => inlineSchemaRefs(i, defs))
  if (!node || typeof node !== 'object') return node
  if (typeof node.$ref === 'string') {
    const m = node.$ref.match(/^#\/(\$defs|definitions)\/(.+)$/)
    if (m) {
      const target = defs[m[2]]
      if (target) {
        const { $ref: _, ...rest } = node
        return inlineSchemaRefs({ ...target, ...rest }, defs)
      }
    }
  }
  const cleaned: Record<string, any> = {}
  for (const [k, v] of Object.entries(node)) {
    if (k.startsWith('$')) continue
    if (k === 'definitions') continue
    cleaned[k] = inlineSchemaRefs(v, defs)
  }
  return cleaned
}

// ---------------------------------------------------------------------------
// Stream processing: Responses API SSE → vibe-sensei StreamEvents
// ---------------------------------------------------------------------------

async function* processResponsesStream(
  response: Response,
  model: string,
): AsyncGenerator<StreamEvent | AssistantMessage | SystemAPIErrorMessage, void> {
  const reader = response.body?.getReader()
  if (!reader) {
    yield createErrorMessage('No response body from ChatGPT backend')
    return
  }

  const messageId = `msg_${randomUUID()}`

  // Content block accumulator
  type Block =
    | { kind: 'text'; text: string; itemId?: string }
    | { kind: 'tool_use'; id: string; name: string; args: string; itemId?: string }
    | { kind: 'thinking'; text: string; itemId?: string }

  const blocks: Block[] = []
  // Map from openai item_id → index in blocks array
  const itemToBlockIdx = new Map<string, number>()

  let inputTokens = 0
  let outputTokens = 0
  let cachedInputTokens = 0
  let stopReason: string = 'end_turn'

  const decoder = new TextDecoder()
  let buffer = ''

  // 1. message_start
  yield messageStartEvent(messageId, model)

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      // Events are separated by blank line ("\n\n")
      let sep = buffer.indexOf('\n\n')
      while (sep !== -1) {
        const rawEvent = buffer.slice(0, sep)
        buffer = buffer.slice(sep + 2)
        sep = buffer.indexOf('\n\n')

        const dataLines = rawEvent
          .split('\n')
          .filter(l => l.startsWith('data:'))
          .map(l => l.slice(5).trimStart())
        if (dataLines.length === 0) continue

        const data = dataLines.join('\n').trim()
        if (!data || data === '[DONE]') continue

        let event: ResponsesEvent
        try {
          event = JSON.parse(data) as ResponsesEvent
        } catch {
          continue
        }

        const eventType = (event as any).type as string
        if (!eventType) continue

        // Dispatch on event type
        if (eventType === 'response.output_item.added') {
          const item = (event as any).item
          if (!item) continue
          if (item.type === 'message') {
            const idx = blocks.length
            blocks.push({ kind: 'text', text: '', itemId: item.id })
            if (item.id) itemToBlockIdx.set(item.id, idx)
            yield textBlockStartEvent(idx)
          } else if (item.type === 'function_call') {
            const idx = blocks.length
            const toolId = item.call_id || item.id || `toolu_${randomUUID()}`
            const toolName = item.name || ''
            blocks.push({
              kind: 'tool_use',
              id: toolId,
              name: toolName,
              args: '',
              itemId: item.id,
            })
            if (item.id) itemToBlockIdx.set(item.id, idx)
            yield toolUseBlockStartEvent(idx, toolId, toolName)
          } else if (item.type === 'reasoning') {
            const idx = blocks.length
            blocks.push({ kind: 'thinking', text: '', itemId: item.id })
            if (item.id) itemToBlockIdx.set(item.id, idx)
            yield thinkingBlockStartEvent(idx)
          }
        } else if (eventType === 'response.output_text.delta') {
          const delta = (event as any).delta as string | undefined
          const itemId = (event as any).item_id as string | undefined
          if (!delta) continue
          const idx = itemId ? itemToBlockIdx.get(itemId) : findLastBlockIdx(blocks, 'text')
          if (idx === undefined) continue
          const block = blocks[idx] as Block & { kind: 'text' }
          if (block.kind !== 'text') continue
          block.text += delta
          yield textBlockDeltaEvent(idx, delta)
        } else if (eventType === 'response.reasoning_summary_text.delta') {
          const delta = (event as any).delta as string | undefined
          if (!delta) continue
          const idx = findLastBlockIdx(blocks, 'thinking')
          if (idx === undefined) continue
          const block = blocks[idx] as Block & { kind: 'thinking' }
          block.text += delta
          yield thinkingDeltaEvent(idx, delta)
        } else if (eventType === 'response.reasoning_summary_part.done') {
          const idx = findLastBlockIdx(blocks, 'thinking')
          if (idx === undefined) continue
          const block = blocks[idx] as Block & { kind: 'thinking' }
          block.text += '\n\n'
          yield thinkingDeltaEvent(idx, '\n\n')
        } else if (eventType === 'response.function_call_arguments.delta') {
          const delta = (event as any).delta as string | undefined
          const itemId = (event as any).item_id as string | undefined
          if (!delta) continue
          const idx = itemId ? itemToBlockIdx.get(itemId) : findLastBlockIdx(blocks, 'tool_use')
          if (idx === undefined) continue
          const block = blocks[idx] as Block & { kind: 'tool_use' }
          if (block.kind !== 'tool_use') continue
          block.args += delta
          yield inputJsonDeltaEvent(idx, delta)
        } else if (eventType === 'response.function_call_arguments.done') {
          // Finalize args — if no delta events fired, use full arguments
          const fullArgs = (event as any).arguments as string | undefined
          if (fullArgs !== undefined) {
            const idx = findLastBlockIdx(blocks, 'tool_use')
            if (idx !== undefined) {
              const block = blocks[idx] as Block & { kind: 'tool_use' }
              if (!block.args) {
                block.args = fullArgs
                yield inputJsonDeltaEvent(idx, fullArgs)
              }
            }
          }
        } else if (eventType === 'response.output_item.done') {
          const item = (event as any).item
          if (!item) continue
          const idx = item.id ? itemToBlockIdx.get(item.id) : undefined
          if (idx !== undefined) {
            yield blockStopEvent(idx)
          }
        } else if (eventType === 'response.completed' || eventType === 'response.done') {
          const resp = (event as any).response
          const usage = resp?.usage
          if (usage) {
            inputTokens = usage.input_tokens ?? 0
            outputTokens = usage.output_tokens ?? 0
            cachedInputTokens = usage.input_tokens_details?.cached_tokens ?? 0
          }
          const status = resp?.status
          stopReason = mapResponsesStopReason(status)
        } else if (eventType === 'response.failed') {
          const resp = (event as any).response
          const msg = resp?.error?.message || 'ChatGPT Codex response failed'
          yield createErrorMessage(msg)
          return
        } else if (eventType === 'error') {
          const msg = (event as any).message || (event as any).code || 'Unknown error'
          yield createErrorMessage(`Codex error: ${msg}`)
          return
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  // Record usage
  if (inputTokens > 0 || outputTokens > 0) {
    recordProviderUsage('openai-codex', model, inputTokens, outputTokens)
  }

  // Build final content array
  const finalContent: any[] = []
  for (const block of blocks) {
    if (block.kind === 'text' && block.text) {
      finalContent.push({ type: 'text', text: block.text })
    } else if (block.kind === 'thinking' && block.text) {
      finalContent.push({ type: 'thinking', thinking: block.text, signature: '' })
    } else if (block.kind === 'tool_use') {
      let parsedInput: unknown = {}
      if (block.args) {
        try {
          parsedInput = JSON.parse(block.args)
        } catch {
          parsedInput = block.args
        }
      }
      finalContent.push({
        type: 'tool_use',
        id: block.id,
        name: block.name,
        input: parsedInput,
      })
    }
  }

  // If we have tool calls, stop reason should be tool_use
  if (finalContent.some(b => b.type === 'tool_use')) {
    stopReason = 'tool_use'
  }

  // message_delta + message_stop
  yield messageDeltaEvent(stopReason, {
    input_tokens: Math.max(0, inputTokens - cachedInputTokens),
    output_tokens: outputTokens,
  })
  yield messageStopEvent()

  const assistantMessage: AssistantMessage = {
    type: 'assistant',
    uuid: randomUUID() as any,
    timestamp: new Date().toISOString(),
    message: {
      role: 'assistant',
      id: messageId,
      content: finalContent,
      model,
      stop_reason: stopReason,
      stop_sequence: null,
      usage: {
        input_tokens: Math.max(0, inputTokens - cachedInputTokens),
        output_tokens: outputTokens,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: cachedInputTokens,
      },
    } as any,
    costUSD: 0,
  } as unknown as AssistantMessage

  yield assistantMessage
}

function findLastBlockIdx(
  blocks: Array<{ kind: string }>,
  kind: 'text' | 'tool_use' | 'thinking',
): number | undefined {
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (blocks[i].kind === kind) return i
  }
  return undefined
}

function mapResponsesStopReason(status?: string): string {
  switch (status) {
    case 'completed': return 'end_turn'
    case 'incomplete': return 'max_tokens'
    case 'failed':
    case 'cancelled': return 'error'
    default: return 'end_turn'
  }
}

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

function isRetryableError(status: number, errorText: string): boolean {
  if (status === 429 || status === 500 || status === 502 || status === 503 || status === 504) {
    return true
  }
  return /rate.?limit|overloaded|service.?unavailable|upstream.?connect|connection.?refused/i.test(errorText)
}

function parseErrorBody(errorText: string, status: number): string {
  try {
    const parsed = JSON.parse(errorText)
    const err = parsed?.error
    if (err) {
      const code = err.code || err.type || ''
      if (/usage_limit_reached|usage_not_included|rate_limit_exceeded/i.test(code) || status === 429) {
        const plan = err.plan_type ? ` (${err.plan_type.toLowerCase()} plan)` : ''
        const mins = err.resets_at
          ? Math.max(0, Math.round((err.resets_at * 1000 - Date.now()) / 60000))
          : undefined
        const when = mins !== undefined ? ` Try again in ~${mins} min.` : ''
        return `ChatGPT usage limit reached${plan}.${when}`.trim()
      }
      if (err.message) return err.message
    }
  } catch { /* ignore */ }
  return `ChatGPT backend error (${status})`
}

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Request was aborted'))
      return
    }
    // Must explicitly remove the abort listener on the resolve path.
    // `sleep()` is called from a retry loop that reuses the same AbortSignal;
    // without removal every retry leaks a listener, triggering Node's
    // MaxListenersExceededWarning and risking a double-reject if abort
    // fires after the timer has already fulfilled the promise.
    const onAbort = () => {
      clearTimeout(timeout)
      reject(new Error('Request was aborted'))
    }
    const timeout = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

// ---------------------------------------------------------------------------
// Error message helper
// ---------------------------------------------------------------------------

function createErrorMessage(message: string): SystemAPIErrorMessage {
  return {
    type: 'system',
    uuid: randomUUID() as any,
    message: {
      role: 'system',
      content: [{ type: 'text', text: `[OpenAI Codex] ${message}` }],
    },
  } as unknown as SystemAPIErrorMessage
}
