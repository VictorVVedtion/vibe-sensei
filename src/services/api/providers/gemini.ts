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

// Debug logging (enable with VIBE_GEMINI_DEBUG=1).
// Logs are written to ~/.vibe-sensei/gemini-debug.log (0o600) rather than
// /tmp, because they can include request/response fragments that are
// sensitive when OAuth tokens flow through this file.
function debugLog(msg: string): void {
  if (!process.env.VIBE_GEMINI_DEBUG) return
  try {
    const fs = require('fs')
    const os = require('os')
    const path = require('path')
    const dir = path.join(os.homedir(), '.vibe-sensei')
    try { fs.mkdirSync(dir, { recursive: true, mode: 0o700 }) } catch { /* ignore */ }
    fs.appendFileSync(
      path.join(dir, 'gemini-debug.log'),
      `[${new Date().toISOString()}] ${msg}\n`,
      { mode: 0o600 },
    )
  } catch { /* ignore */ }
}

/**
 * Cloud Code Assist only supports a specific set of Gemini model names.
 * Alias unsupported names to the closest supported model.
 *
 * Supported on the Cloud Code Assist OAuth path (verified 2026-04-14):
 *   - gemini-3-flash-preview  (latest, fast, default)
 *   - gemini-2.5-pro           (pro-class, slower)
 *   - gemini-2.5-flash
 *   - gemini-2.5-flash-lite
 *
 * Explicitly EXCLUDED (Cloud Code Assist returns HTTP 429
 * MODEL_CAPACITY_EXHAUSTED for these on the free tier):
 *   - gemini-3.1-pro-preview
 *   - gemini-3-pro-preview
 * Users with paid-tier access should use the direct
 * generativelanguage.googleapis.com API key path instead of OAuth.
 */
const CLOUD_CODE_ASSIST_MODELS = new Set([
  'gemini-3-flash-preview',
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
])

function remapToCloudCodeAssistModel(model: string): string {
  if (CLOUD_CODE_ASSIST_MODELS.has(model)) return model

  const lowered = model.toLowerCase()

  // Flash variants → prefer flash
  if (lowered.includes('flash')) {
    if (lowered.includes('lite') || lowered.includes('8b')) {
      return 'gemini-2.5-flash-lite'
    }
    if (lowered.includes('3')) {
      return 'gemini-3-flash-preview'
    }
    return 'gemini-2.5-flash'
  }
  // Lite/nano → lite
  if (lowered.includes('lite') || lowered.includes('nano')) {
    return 'gemini-2.5-flash-lite'
  }
  // Any pro-class request → 2.5-pro (3.x pro variants 429 on the
  // Cloud Code Assist free tier, so we can't route pro to them).
  if (lowered.includes('pro') || lowered.includes('ultra')) {
    return 'gemini-2.5-pro'
  }
  // Everything else (unknown / old names) → latest flash-preview, which
  // is faster, free-tier-available, and handles tool calls well.
  return 'gemini-3-flash-preview'
}

// ---------------------------------------------------------------------------
// Gemini ProviderClient
// ---------------------------------------------------------------------------

export class GeminiProvider implements ProviderClient {
  readonly id = 'gemini'

  async *streamQuery(
    params: ProviderQueryParams,
  ): AsyncGenerator<StreamEvent | AssistantMessage | SystemAPIErrorMessage, void> {
    debugLog(`streamQuery: model=${params.model}, tools=${params.tools?.length || 0}`)
    const apiKey = resolveProviderApiKey('gemini')
    const baseUrl = resolveProviderBaseUrl('gemini')

    if (!apiKey) {
      const { resolveGeminiAuth } = await import('./gemini-oauth.js')
      const auth = await resolveGeminiAuth()
      if (!auth) {
        yield createErrorMessage(`No API key configured for Gemini. Set ${getProviderAuthEnvVars('gemini').join(' or ')}, or run /login to sign in.`)
        return
      }
      if (auth.type === 'api-key') {
        yield* this.streamWithAuth(params, baseUrl, { type: 'api-key', key: auth.key })
        return
      }
      // OAuth with projectId → Cloud Code Assist endpoint
      yield* this.streamWithCloudCodeAssist(params, auth.accessToken, auth.projectId)
      return
    }

    yield* this.streamWithAuth(params, baseUrl, { type: 'api-key', key: apiKey })
  }

  /**
   * OAuth path: call cloudcode-pa.googleapis.com/v1internal:streamGenerateContent
   * with Gemini CLI headers and project in request body.
   * Ported from @mariozechner/pi-ai.
   *
   * IMPORTANT: Cloud Code Assist only supports the gemini-2.5-* family
   * (gemini-2.5-flash, gemini-2.5-pro). Older / preview models return 404.
   * We alias unsupported names to the closest supported model.
   */
  private async *streamWithCloudCodeAssist(
    params: ProviderQueryParams,
    accessToken: string,
    projectId: string,
  ): AsyncGenerator<StreamEvent | AssistantMessage | SystemAPIErrorMessage, void> {
    const url = 'https://cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse'
    const innerBody = buildGeminiRequestBody(params)

    // Remap models not supported by Cloud Code Assist
    const requestedModel = params.model
    const ccaModel = remapToCloudCodeAssistModel(requestedModel)
    if (ccaModel !== requestedModel) {
      debugLog(`[cca] remapped model ${requestedModel} → ${ccaModel}`)
    }

    // Cloud Code Assist wraps the request in { project, model, request, userAgent, requestId }
    const wrappedBody = {
      project: projectId,
      model: ccaModel,
      request: innerBody,
      userAgent: 'vibe-sensei',
      requestId: `vs-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
      'User-Agent': 'google-cloud-sdk vscode_cloudshelleditor/0.1',
      'X-Goog-Api-Client': 'gl-node/22.17.0',
      'Client-Metadata': JSON.stringify({
        ideType: 'IDE_UNSPECIFIED',
        platform: 'PLATFORM_UNSPECIFIED',
        pluginType: 'GEMINI',
      }),
    }

    let response: Response
    try {
      response = await fetchWithRetry(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(wrappedBody),
        signal: params.signal,
      }, 'gemini', { maxRetries: 2 })
    } catch (error) {
      if (error instanceof ProviderHttpError) {
        yield createErrorMessage(formatErrorForUser(error.classified, 'gemini'))
      } else {
        yield createErrorMessage(`Connection error to Gemini (Cloud Code Assist): ${(error as Error).message}`)
      }
      return
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      yield createErrorMessage(`Gemini Cloud Code Assist error (${response.status}): ${errText.substring(0, 300)}`)
      return
    }

    yield* parseCloudCodeAssistStream(response, params.model)
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

    // Check for OAuth credentials (including projectId discovery state)
    const { resolveGeminiAuth } = await import('./gemini-oauth.js')
    const auth = await resolveGeminiAuth()
    return auth !== null
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

  // Pre-scan to build a `tool_use_id → tool_name` index. Gemini's
  // `functionResponse.name` must match an earlier `functionCall.name`
  // (e.g. "ShowChart"), NOT the Anthropic-style `tool_use_id`
  // ("toolu_abc123..."). Sending the id makes Gemini silently hang on
  // follow-up turns because it can't correlate the response to any
  // call it made.
  const toolUseIdToName = new Map<string, string>()
  for (const msg of messages) {
    if (msg?.message?.role !== 'assistant') continue
    const c = msg.message.content
    if (!Array.isArray(c)) continue
    for (const block of c) {
      if (
        typeof block === 'object' && block !== null &&
        (block as any).type === 'tool_use' &&
        typeof (block as any).id === 'string' &&
        typeof (block as any).name === 'string'
      ) {
        toolUseIdToName.set((block as any).id, (block as any).name)
      }
    }
  }

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
              const toolUseId = (block as any).tool_use_id
              const toolName =
                (typeof toolUseId === 'string' && toolUseIdToName.get(toolUseId)) ||
                // Fallback when the tool_use block isn't in this batch
                // (e.g. mid-conversation resume). Use the id so the
                // response is at least present — Gemini will still
                // reject name mismatches but the failure is surfaced.
                toolUseId ||
                'unknown'
              parts.push({
                functionResponse: {
                  name: toolName,
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
    if (!name) continue

    const description = typeof tool.description === 'string' ? tool.description : ''

    // Convert Zod → JSON Schema. vibe-sensei tools carry `inputSchema` as a
    // raw Zod object, which when serialized leaks Zod internals like `def`
    // that Gemini rejects with `Unknown name "def"`. Prefer pre-converted
    // `inputJSONSchema` / `input_schema` first.
    let parameters: any
    if (tool.inputJSONSchema) {
      parameters = tool.inputJSONSchema
    } else if (tool.input_schema) {
      parameters = tool.input_schema
    } else if (tool.inputSchema && typeof tool.inputSchema === 'object') {
      parameters = toolSchemaToJsonSchema(tool.inputSchema)
    } else {
      parameters = { type: 'object', properties: {} }
    }

    // Gemini rejects schemas with $defs/$ref/$schema/additionalProperties.
    const cleanedParams = sanitizeSchemaForGemini(parameters)

    result.push({ name, description, parameters: cleanedParams })
  }

  return result
}

// Convert a Zod schema to JSON Schema. Tolerant of already-converted schemas.
function toolSchemaToJsonSchema(schema: any): any {
  // If it already looks like a JSON Schema (has `type: 'object'` or `properties`),
  // pass through.
  if (
    schema &&
    typeof schema === 'object' &&
    !schema._def &&
    !schema.def &&
    (schema.type === 'object' || schema.properties)
  ) {
    return schema
  }
  // Otherwise treat as Zod and convert.
  try {
    const { zodToJsonSchema } = require('../../../utils/zodToJsonSchema.js')
    return zodToJsonSchema(schema)
  } catch {
    return { type: 'object', properties: {} }
  }
}

/**
 * Deep-merge an `allOf` member list into a single schema. Combines
 * `properties` maps via Object.assign (later members override earlier
 * keys, matching JSON Schema allOf validation order), unions `required`
 * arrays, and takes the first-seen definition for scalar keys so parent
 * constraints aren't silently clobbered by children.
 */
function mergeAllOf(members: any[]): any {
  const merged: Record<string, any> = {}
  const mergedProps: Record<string, any> = {}
  const mergedRequired = new Set<string>()
  for (const m of members) {
    if (!m || typeof m !== 'object') continue
    for (const [k, v] of Object.entries(m)) {
      if (k === 'properties' && v && typeof v === 'object') {
        Object.assign(mergedProps, v as Record<string, any>)
      } else if (k === 'required' && Array.isArray(v)) {
        for (const r of v) if (typeof r === 'string') mergedRequired.add(r)
      } else if (k === 'allOf' && Array.isArray(v)) {
        // Nested allOf: flatten one level at a time
        const inner = mergeAllOf(v)
        if (inner.properties) Object.assign(mergedProps, inner.properties)
        if (Array.isArray(inner.required)) for (const r of inner.required) mergedRequired.add(r)
        for (const [ik, iv] of Object.entries(inner)) {
          if (ik !== 'properties' && ik !== 'required' && !(ik in merged)) {
            merged[ik] = iv
          }
        }
      } else if (!(k in merged)) {
        merged[k] = v
      }
    }
  }
  if (Object.keys(mergedProps).length) merged.properties = mergedProps
  if (mergedRequired.size) merged.required = Array.from(mergedRequired)
  return merged
}

/**
 * Convert a JSON Schema to a Gemini-compatible schema:
 *   1. Inline all `$ref` references against `$defs` / `definitions`
 *   2. Strip all `$*` keys and `additionalProperties`
 *   3. Recurse into `properties`, `items`, `anyOf`, `oneOf`, `allOf`
 */
function sanitizeSchemaForGemini(schema: any): any {
  if (!schema || typeof schema !== 'object') return schema

  // Collect definitions from the root schema for $ref resolution
  const defs = schema.$defs || schema.definitions || {}
  return inlineAndClean(schema, defs)
}

// Gemini's restricted OpenAPI-subset schema. Use a WHITELIST — anything
// not in this set is stripped, because vendor extensions and JSON Schema
// features leak through otherwise (x-google-*, `deprecated`, `default`, etc.).
//
// Based on Google's Cloud Code Assist API schema spec.
const GEMINI_SCHEMA_KEYS = new Set([
  'type',
  'format',
  'description',
  'nullable',
  'enum',
  'properties',
  'required',
  'items',
  'minItems', 'maxItems',
  'minLength', 'maxLength',
  'minimum', 'maximum',
  'pattern',
  'anyOf',
  'default',
])

/**
 * Recursively clean a JSON Schema node for Gemini.
 * The whitelist only applies to SCHEMA OBJECTS. Maps like `properties` /
 * `$defs` have user-defined keys that must be preserved as-is; we only
 * apply the whitelist when walking into their VALUES.
 *
 * `visiting` tracks $ref names currently being resolved on the active
 * resolution path. Self-referential schemas (tree-shaped inputs like JSON
 * patch) would otherwise infinite-loop: resolving `#/$defs/Node` inlines a
 * node that itself contains `#/$defs/Node`, re-entering this function
 * forever. On cycle detection we return a permissive `{}` placeholder.
 */
function inlineAndClean(
  node: any,
  defs: Record<string, any>,
  visiting: ReadonlySet<string> = new Set(),
): any {
  if (Array.isArray(node)) {
    return node.map(item => inlineAndClean(item, defs, visiting))
  }
  if (!node || typeof node !== 'object') return node

  // Resolve $ref → inline from defs
  if (typeof node.$ref === 'string') {
    const refPath = node.$ref
    const match = refPath.match(/^#\/(\$defs|definitions)\/(.+)$/)
    if (match) {
      const defName = match[2]
      // Cycle guard: if we're already resolving this def on the current
      // path, stop and return a permissive placeholder instead of recursing.
      if (visiting.has(defName)) {
        return {}
      }
      const target = defs[defName]
      if (target) {
        const { $ref, ...rest } = node
        const nextVisiting = new Set(visiting)
        nextVisiting.add(defName)
        return inlineAndClean({ ...target, ...rest }, defs, nextVisiting)
      }
    }
    // Unresolvable $ref — return a permissive placeholder
    return {}
  }

  // `const` → single-value `enum` (Gemini doesn't support const)
  if ('const' in node) {
    const { const: constVal, ...rest } = node
    return inlineAndClean({ ...rest, enum: [constVal] }, defs, visiting)
  }

  // `oneOf` → `anyOf`. Gemini only accepts `anyOf`; silently dropping
  // `oneOf` would collapse discriminated unions to `{}`. `anyOf` is
  // semantically looser but accepts every input valid under `oneOf`,
  // so this is the safest remap.
  if (Array.isArray(node.oneOf)) {
    const { oneOf, ...rest } = node
    return inlineAndClean({ ...rest, anyOf: oneOf }, defs, visiting)
  }

  // `allOf` → deep-merge members into the parent. Gemini doesn't accept
  // `allOf`, and dropping it would lose constraints. Merging preserves
  // the "all must hold" semantics by unioning `properties` and `required`
  // and taking the first definition of any scalar key.
  if (Array.isArray(node.allOf)) {
    const { allOf, ...rest } = node
    return inlineAndClean(mergeAllOf([rest, ...allOf]), defs, visiting)
  }

  const cleaned: Record<string, any> = {}
  for (const [key, value] of Object.entries(node)) {
    // WHITELIST: only keep keys Gemini explicitly supports
    if (!GEMINI_SCHEMA_KEYS.has(key)) continue

    // `properties` is a MAP of user-defined property names to schemas.
    // Don't apply the whitelist to its KEYS; recurse into each value
    // as a new schema node.
    if (key === 'properties' && value && typeof value === 'object') {
      const cleanedProps: Record<string, any> = {}
      for (const [propName, propSchema] of Object.entries(value as Record<string, any>)) {
        cleanedProps[propName] = inlineAndClean(propSchema, defs, visiting)
      }
      cleaned[key] = cleanedProps
      continue
    }

    // `required` is an array of property names (strings) — don't recurse
    if (key === 'required' && Array.isArray(value)) {
      cleaned[key] = value
      continue
    }

    // `enum` is an array of literal values — don't recurse
    if (key === 'enum' && Array.isArray(value)) {
      cleaned[key] = value
      continue
    }

    cleaned[key] = inlineAndClean(value, defs, visiting)
  }

  // Gemini requires `type` to be a single string, not array (e.g. ["string","null"])
  if (Array.isArray(cleaned.type)) {
    const types = cleaned.type.filter((t: string) => t !== 'null')
    if (types.length === 1) {
      cleaned.type = types[0]
      cleaned.nullable = true
    } else {
      cleaned.type = types[0] || 'string'
    }
  }

  return cleaned
}

// ---------------------------------------------------------------------------
// SSE stream parsing
// ---------------------------------------------------------------------------

/**
 * Parse Cloud Code Assist SSE stream.
 * Each event is wrapped: { response: { candidates: [...], usageMetadata: {...} } }
 *
 * Emits the full Anthropic-style stream_event sequence so the REPL renders
 * progressive text/tool deltas.
 */
async function* parseCloudCodeAssistStream(
  response: Response,
  model: string,
): AsyncGenerator<StreamEvent | AssistantMessage | SystemAPIErrorMessage, void> {
  const reader = response.body?.getReader()
  if (!reader) {
    yield createErrorMessage('No response body from Gemini (Cloud Code Assist)')
    return
  }

  const messageId = `msg_${randomUUID()}`
  const decoder = new TextDecoder()
  let buffer = ''
  let fullText = ''
  const toolCalls: Array<{ id: string; name: string; args: unknown }> = []
  let totalInputTokens = 0
  let totalOutputTokens = 0

  // Block index state
  let textBlockStarted = false
  const textBlockIndex = 0
  let nextBlockIndex = 1

  debugLog(`[parser] starting, response.ok=${response.ok}`)

  // 1. message_start — tells the REPL a new assistant turn has begun
  yield messageStartEvent(messageId, model)
  debugLog('[parser] yielded message_start')

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

        let wrapper: any
        try { wrapper = JSON.parse(jsonStr) } catch { continue }

        // Unwrap Cloud Code Assist response envelope
        const chunk = wrapper.response ?? wrapper
        if (!chunk) continue

        const candidates = chunk.candidates || []
        debugLog(`[parser] chunk candidates=${candidates.length}`)
        for (const candidate of candidates) {
          const parts = candidate.content?.parts || []
          for (const part of parts) {
            if (part.text) {
              debugLog(`[parser] text delta: ${JSON.stringify(part.text).substring(0, 100)}`)
              // Start the text block on first text delta
              if (!textBlockStarted) {
                textBlockStarted = true
                yield textBlockStartEvent(textBlockIndex)
                debugLog('[parser] yielded content_block_start (text)')
              }
              fullText += part.text
              yield textBlockDeltaEvent(textBlockIndex, part.text)
              debugLog('[parser] yielded content_block_delta (text_delta)')
            }
            if (part.functionCall) {
              debugLog(`[parser] tool call: ${part.functionCall.name}`)
              toolCalls.push({
                id: `toolu_${randomUUID()}`,
                name: part.functionCall.name,
                args: part.functionCall.args || {},
              })
            }
          }
        }

        if (chunk.usageMetadata) {
          totalInputTokens = chunk.usageMetadata.promptTokenCount || 0
          totalOutputTokens = chunk.usageMetadata.candidatesTokenCount || 0
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  // Close the text block if we opened one
  if (textBlockStarted) {
    yield blockStopEvent(textBlockIndex)
  }

  // Emit tool_use blocks (Gemini delivers the full arguments at once)
  for (const tc of toolCalls) {
    const idx = nextBlockIndex++
    yield toolUseBlockStartEvent(idx, tc.id, tc.name)
    const argsJson = JSON.stringify(tc.args)
    if (argsJson && argsJson !== '{}') {
      yield inputJsonDeltaEvent(idx, argsJson)
    }
    yield blockStopEvent(idx)
  }

  const stopReason = toolCalls.length > 0 ? 'tool_use' : 'end_turn'

  // message_delta + message_stop
  yield messageDeltaEvent(stopReason, {
    input_tokens: totalInputTokens,
    output_tokens: totalOutputTokens,
  })
  yield messageStopEvent()

  if (totalInputTokens > 0 || totalOutputTokens > 0) {
    recordProviderUsage('gemini', model, totalInputTokens, totalOutputTokens)
  }

  // Final AssistantMessage for query.ts accumulation
  const contentBlocks: any[] = []
  if (fullText) contentBlocks.push({ type: 'text', text: fullText })
  for (const tc of toolCalls) {
    contentBlocks.push({
      type: 'tool_use',
      id: tc.id,
      name: tc.name,
      input: tc.args,
    })
  }

  const finalMsg = {
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
    } as any,
    costUSD: 0,
  } as unknown as AssistantMessage

  debugLog(`[parser] about to yield final AssistantMessage, fullText len=${fullText.length}, contentBlocks=${contentBlocks.length}`)
  yield finalMsg
  debugLog('[parser] yielded final AssistantMessage, DONE')
}

async function* parseGeminiSSEStream(
  response: Response,
  model: string,
): AsyncGenerator<StreamEvent | AssistantMessage | SystemAPIErrorMessage, void> {
  const reader = response.body?.getReader()
  if (!reader) {
    yield createErrorMessage('No response body from Gemini')
    return
  }

  const messageId = `msg_${randomUUID()}`
  const decoder = new TextDecoder()
  let buffer = ''
  let fullText = ''
  const toolCalls: Array<{ id: string; name: string; args: unknown }> = []
  let totalInputTokens = 0
  let totalOutputTokens = 0

  let textBlockStarted = false
  const textBlockIndex = 0
  let nextBlockIndex = 1

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
        if (!trimmed.startsWith('data: ')) continue
        const jsonStr = trimmed.slice(6)
        if (!jsonStr) continue

        let chunk: any
        try { chunk = JSON.parse(jsonStr) } catch { continue }

        const candidates = chunk.candidates || []
        for (const candidate of candidates) {
          const parts = candidate.content?.parts || []
          for (const part of parts) {
            if (part.text) {
              if (!textBlockStarted) {
                textBlockStarted = true
                yield textBlockStartEvent(textBlockIndex)
              }
              fullText += part.text
              yield textBlockDeltaEvent(textBlockIndex, part.text)
            }
            if (part.functionCall) {
              toolCalls.push({
                id: `toolu_${randomUUID()}`,
                name: part.functionCall.name,
                args: part.functionCall.args || {},
              })
            }
          }
        }

        if (chunk.usageMetadata) {
          totalInputTokens = chunk.usageMetadata.promptTokenCount || 0
          totalOutputTokens = chunk.usageMetadata.candidatesTokenCount || 0
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  if (textBlockStarted) {
    yield blockStopEvent(textBlockIndex)
  }

  for (const tc of toolCalls) {
    const idx = nextBlockIndex++
    yield toolUseBlockStartEvent(idx, tc.id, tc.name)
    const argsJson = JSON.stringify(tc.args)
    if (argsJson && argsJson !== '{}') {
      yield inputJsonDeltaEvent(idx, argsJson)
    }
    yield blockStopEvent(idx)
  }

  const stopReason = toolCalls.length > 0 ? 'tool_use' : 'end_turn'
  yield messageDeltaEvent(stopReason, {
    input_tokens: totalInputTokens,
    output_tokens: totalOutputTokens,
  })
  yield messageStopEvent()

  if (totalInputTokens > 0 || totalOutputTokens > 0) {
    recordProviderUsage('gemini', model, totalInputTokens, totalOutputTokens)
  }

  const contentBlocks: any[] = []
  if (fullText) contentBlocks.push({ type: 'text', text: fullText })
  for (const tc of toolCalls) {
    contentBlocks.push({
      type: 'tool_use',
      id: tc.id,
      name: tc.name,
      input: tc.args,
    })
  }

  yield {
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
    } as any,
    costUSD: 0,
  } as unknown as AssistantMessage
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
