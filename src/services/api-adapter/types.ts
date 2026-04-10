/**
 * API Adapter — type definitions and Zod schemas.
 *
 * API profiles describe external data sources so the LLM can construct
 * correct HTTP calls without pre-built integrations.
 */

import { z } from 'zod/v4'

// ── Zod Schemas ──────────────────────────────────────────────────────────────

export const ParamSpecSchema = z.strictObject({
  name: z.string(),
  location: z.enum(['query', 'path', 'header', 'body']).default('query'),
  required: z.boolean().default(false),
  description: z.string().default(''),
  example: z.string().optional(),
})

export const EndpointSpecSchema = z.strictObject({
  path: z.string(),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).default('GET'),
  description: z.string().default(''),
  params: z.array(ParamSpecSchema).default([]),
  exampleResponse: z.string().optional(),
})

export const AuthConfigSchema = z.strictObject({
  type: z.enum(['none', 'api_key_header', 'api_key_query', 'bearer']).default('none'),
  envVar: z.string().optional(),
  headerName: z.string().optional(),
  queryParam: z.string().optional(),
})

export const RateLimitSchema = z.strictObject({
  maxPerMinute: z.number().default(30),
})

export const APIProfileSchema = z.strictObject({
  name: z.string(),
  displayName: z.string(),
  baseUrl: z.string(),
  description: z.string().default(''),
  endpoints: z.array(EndpointSpecSchema).default([]),
  auth: AuthConfigSchema.default({ type: 'none' }),
  rateLimit: RateLimitSchema.default({ maxPerMinute: 30 }),
  allowMutations: z.boolean().default(false),
  createdAt: z.string(),
  lastCalledAt: z.string().nullable().default(null),
  notes: z.string().default(''),
})

// ── TypeScript Types ─────────────────────────────────────────────────────────

export type ParamSpec = z.infer<typeof ParamSpecSchema>
export type EndpointSpec = z.infer<typeof EndpointSpecSchema>
export type AuthConfig = z.infer<typeof AuthConfigSchema>
export type RateLimit = z.infer<typeof RateLimitSchema>
export type APIProfile = z.infer<typeof APIProfileSchema>
