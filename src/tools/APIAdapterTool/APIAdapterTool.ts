/**
 * APIAdapterTool — universal external API connector.
 *
 * 4 operations:
 *   register — Teach the system about a new API (from docs, spec, or description)
 *   call     — Call a registered API endpoint
 *   list     — Show all registered APIs
 *   remove   — Remove a registered API
 *
 * The LLM is the integration layer: it reads API docs, constructs profiles,
 * and interprets responses. No pre-built integrations needed.
 */

import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import {
  ParamSpecSchema,
  EndpointSpecSchema,
  type APIProfile,
  type EndpointSpec,
} from '../../services/api-adapter/types.js'

// ── Input Schema ─────────────────────────────────────────────────────────────

// Reuse schemas from types.ts with all fields optional for LLM flexibility
const endpointParamInput = ParamSpecSchema.partial().required({ name: true })
const endpointInput = EndpointSpecSchema.extend({
  params: z.array(endpointParamInput).optional(),
}).partial().required({ path: true })

const inputSchema = z.strictObject({
  operation: z
    .enum(['register', 'call', 'list', 'remove'])
    .describe('API adapter operation'),

  // ── register fields ──
  name: z.string().optional().describe('API name slug (e.g. "coingecko")'),
  displayName: z.string().optional().describe('Human-readable API name'),
  baseUrl: z.string().optional().describe('API base URL'),
  description: z.string().optional().describe('What this API provides'),
  endpoints: z
    .array(endpointInput)
    .optional()
    .describe('Known API endpoints'),
  authType: z
    .enum(['none', 'api_key_header', 'api_key_query', 'bearer'])
    .optional()
    .describe('Authentication method'),
  authEnvVar: z.string().optional().describe('Env var name for the API key (never the actual key)'),
  authHeaderName: z.string().optional().describe('Header name for API key auth'),
  authQueryParam: z.string().optional().describe('Query param name for API key auth'),
  allowMutations: z.boolean().optional().describe('Allow POST/PUT/DELETE (default false)'),
  maxPerMinute: z.number().optional().describe('Rate limit per minute (default 30)'),
  notes: z.string().optional().describe('Free-form notes about the API'),

  // ── call fields ──
  api: z.string().optional().describe('Name of the registered API to call'),
  endpoint: z.string().optional().describe('Endpoint path (e.g. "/simple/price")'),
  method: z.string().optional().describe('HTTP method override (default GET)'),
  params: z.record(z.string(), z.string()).optional().describe('Query params or body fields'),
  pathParams: z.record(z.string(), z.string()).optional().describe('Path template params (e.g. {id} → bitcoin)'),
})

type InputSchema = typeof inputSchema
type Output = string

// ── Tool Definition ──────────────────────────────────────────────────────────

export const APIAdapterTool = buildTool({
  name: 'APIAdapter',
  searchHint: 'external api data source coingecko glassnode register call fetch market data',
  maxResultSizeChars: 100_000,

  get inputSchema(): InputSchema {
    return inputSchema
  },

  isReadOnly(input) {
    const op = (input as { operation?: string }).operation
    return op === 'call' || op === 'list'
  },

  isDestructive() {
    return false
  },

  isConcurrencySafe() {
    return true
  },

  async description() {
    return 'Connect and call any external data API. Register APIs from docs or descriptions, then call them for market data, on-chain metrics, sentiment, and more.'
  },

  async prompt() {
    return [
      'Universal API Adapter — connect and call any external data API.',
      '',
      'Operations:',
      '  register — Teach the system about a new API. Provide name, baseUrl, description,',
      '             endpoints, and auth config. The profile is saved locally.',
      '  call     — Call a registered API. Provide api name, endpoint path, and params.',
      '  list     — Show all registered APIs and their endpoints.',
      '  remove   — Remove a registered API by name.',
      '',
      'Registration tips:',
      '  - When a user pastes API docs or a URL, extract: base URL, available endpoints,',
      '    auth method, and key parameters.',
      '  - Auth keys are NEVER stored in profiles. Store the env var name (e.g. COINGECKO_API_KEY)',
      '    and tell the user to set it in their .env file.',
      '  - By default, only GET requests are allowed. Set allowMutations=true only if the user',
      '    explicitly requests write access.',
      '  - If the user provides an OpenAPI/Swagger spec, parse it and register the API.',
      '',
      'Calling tips:',
      '  - Use the api name exactly as registered (slug form).',
      '  - For path parameters like /coins/{id}, use pathParams: {"id": "bitcoin"}.',
      '  - The response is returned as raw text — interpret it for the user.',
      '  - Rate limits are enforced automatically per API.',
      '',
      'Pre-registered APIs (available immediately):',
      '  - coingecko: crypto prices, market cap, historical charts',
      '  - fear-greed: Fear & Greed Index (sentiment indicator)',
      '  - defillama: DeFi TVL, protocol data, chain analytics',
    ].join('\n')
  },

  toAutoClassifierInput(input) {
    const op = input.operation ?? 'list'
    const api = input.api ?? input.name ?? ''
    const ep = input.endpoint ?? ''
    return `APIAdapter ${op} ${api} ${ep}`.trim()
  },

  mapToolResultToToolResultBlockParam(content, toolUseID) {
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: String(content),
    }
  },

  renderToolUseMessage(input) {
    const op = input.operation ?? 'list'
    switch (op) {
      case 'register':
        return `API Adapter: registering ${input.name ?? 'unknown'}`
      case 'call':
        return `API Adapter: ${input.api ?? '?'}${input.endpoint ?? ''}`
      case 'list':
        return 'API Adapter: listing registered APIs'
      case 'remove':
        return `API Adapter: removing ${input.name ?? 'unknown'}`
      default:
        return `API Adapter: ${op}`
    }
  },

  async call(input) {
    const op = input.operation

    switch (op) {
      case 'register':
        return handleRegister(input)
      case 'call':
        return handleCall(input)
      case 'list':
        return handleList()
      case 'remove':
        return handleRemove(input.name)
      default:
        return { data: `Unknown operation: ${op}` }
    }
  },
} satisfies ToolDef<InputSchema, Output>)

// ── Operation Handlers ───────────────────────────────────────────────────────

async function handleRegister(input: z.infer<typeof inputSchema>): Promise<{ data: string }> {
  try {
    const { saveProfile, profileExists, slugify } = await import(
      '../../services/api-adapter/store.js'
    )

    if (!input.name || !input.baseUrl) {
      return { data: 'Registration requires at least "name" and "baseUrl".' }
    }

    const name = slugify(input.name)
    const isUpdate = profileExists(name)

    const endpoints: EndpointSpec[] = (input.endpoints ?? []).map(ep => ({
      path: ep.path,
      method: ep.method ?? 'GET',
      description: ep.description ?? '',
      params: (ep.params ?? []).map(p => ({
        name: p.name,
        location: p.location ?? 'query',
        required: p.required ?? false,
        description: p.description ?? '',
        example: p.example,
      })),
      exampleResponse: ep.exampleResponse,
    }))

    const profile: APIProfile = {
      name,
      displayName: input.displayName ?? input.name,
      baseUrl: input.baseUrl.replace(/\/+$/, ''), // trim trailing slashes
      description: input.description ?? '',
      endpoints,
      auth: {
        type: input.authType ?? 'none',
        envVar: input.authEnvVar,
        headerName: input.authHeaderName,
        queryParam: input.authQueryParam,
      },
      rateLimit: { maxPerMinute: input.maxPerMinute ?? 30 },
      allowMutations: input.allowMutations ?? false,
      createdAt: new Date().toISOString(),
      lastCalledAt: null,
      notes: input.notes ?? '',
    }

    saveProfile(profile)

    const lines = [
      isUpdate
        ? `Updated API: ${profile.displayName} (${name})`
        : `Registered API: ${profile.displayName} (${name})`,
      `Base URL: ${profile.baseUrl}`,
      `Endpoints: ${endpoints.length}`,
      `Auth: ${profile.auth.type}${profile.auth.envVar ? ` (env: ${profile.auth.envVar})` : ''}`,
      `Rate limit: ${profile.rateLimit.maxPerMinute}/min`,
      `Mutations: ${profile.allowMutations ? 'allowed' : 'GET only'}`,
    ]

    if (profile.auth.type !== 'none' && profile.auth.envVar) {
      lines.push('')
      lines.push(`Set your API key: export ${profile.auth.envVar}=your_key_here`)
    }

    return { data: lines.join('\n') }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { data: `Registration failed: ${msg}` }
  }
}

async function handleCall(input: z.infer<typeof inputSchema>): Promise<{ data: string }> {
  try {
    const { loadProfile } = await import('../../services/api-adapter/store.js')
    const { executeAPICall } = await import('../../services/api-adapter/fetcher.js')

    if (!input.api) {
      return { data: 'Call requires "api" (name of a registered API). Use operation "list" to see available APIs.' }
    }

    const profile = loadProfile(input.api)
    if (!profile) {
      return { data: `API "${input.api}" not found. Use operation "list" to see registered APIs, or "register" to add it.` }
    }

    if (!input.endpoint) {
      // No endpoint specified — return the profile info with available endpoints
      const epList = profile.endpoints
        .map(ep => `  ${ep.method} ${ep.path} — ${ep.description}`)
        .join('\n')
      return {
        data: [
          `${profile.displayName} (${profile.baseUrl})`,
          profile.description,
          '',
          'Available endpoints:',
          epList || '  (no endpoints cataloged — provide an endpoint path to call directly)',
          '',
          'Specify an endpoint to make a call.',
        ].join('\n'),
      }
    }

    const result = await executeAPICall({
      profile,
      endpoint: input.endpoint,
      method: input.method,
      params: input.params,
      pathParams: input.pathParams,
    })

    const header = `${result.status} ${result.statusText} (${result.durationMs}ms)`
    return { data: `${header}\n\n${result.data}` }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { data: `API call failed: ${msg}` }
  }
}

async function handleList(): Promise<{ data: string }> {
  try {
    const { listProfiles } = await import('../../services/api-adapter/store.js')

    const profiles = listProfiles()
    if (profiles.length === 0) {
      return { data: 'No APIs registered. Use operation "register" to add one.' }
    }

    const lines = profiles.map(p => {
      const epCount = p.endpoints.length
      const auth = p.auth.type === 'none' ? 'no auth' : `${p.auth.type}`
      const last = p.lastCalledAt
        ? `last called ${p.lastCalledAt}`
        : 'never called'
      return `  ${p.name} — ${p.displayName} | ${epCount} endpoints | ${auth} | ${last}`
    })

    return {
      data: [
        `Registered APIs (${profiles.length}):`,
        ...lines,
        '',
        'Use operation "call" with api="<name>" and endpoint="<path>" to fetch data.',
      ].join('\n'),
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { data: `Failed to list APIs: ${msg}` }
  }
}

async function handleRemove(name: string | undefined): Promise<{ data: string }> {
  try {
    const { removeProfile } = await import('../../services/api-adapter/store.js')

    if (!name) {
      return { data: 'Remove requires "name" of the API to remove.' }
    }

    const removed = removeProfile(name)
    return {
      data: removed
        ? `Removed API: ${name}`
        : `API "${name}" not found. Use operation "list" to see registered APIs.`,
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { data: `Failed to remove API: ${msg}` }
  }
}
