/**
 * Multi-provider AI system — barrel export.
 *
 * Usage:
 *   import { parseModelRef, getProviderById } from 'src/services/api/providers/index.js'
 */

// Core types
export { parseModelRef, isNonAnthropicModelRef } from './types.js'
export type {
  ModelRef,
  ProviderClient,
  ProviderQueryParams,
  ProviderInfo,
  ProviderUsage,
  ModelDefinition,
} from './types.js'

// Auth
export {
  resolveProviderApiKey,
  resolveProviderBaseUrl,
  getProviderAuthStatus,
  getProviderAuthEnvVars,
  PROVIDER_AUTH_ENV_VARS,
  PROVIDER_BASE_URLS,
} from './auth-env.js'

// Registry
export {
  getProviderById,
  getProviderForModelId,
  listRegisteredProviders,
  isProviderAvailable,
  getAvailableProviders,
} from './registry.js'

// Model catalog
export {
  MODEL_CATALOG,
  getModelDefinition,
  getModelsForProvider,
  getKnownProviderIds,
  getAllModelIds,
} from './model-catalog.js'

// Capabilities
export {
  getProviderCapabilities,
  providerSupportsThinking,
  providerSupportsTools,
  getAssistantRoleName,
} from './capabilities.js'
export type { ProviderCapabilities } from './capabilities.js'

// Query router
export { createProviderAwareCallModel } from './query-router.js'

// Validation
export { validateMultiProviderModel, isNonAnthropicModel } from './validate.js'

// Cost tracking
export {
  recordProviderUsage,
  getSessionCostSummary,
  formatCostSummary,
  resetSessionUsage,
} from './cost-tracker.js'
export type { CostSummaryEntry, SessionCostSummary } from './cost-tracker.js'

// Error handling
export {
  classifyHttpError,
  fetchWithRetry,
  formatErrorForUser,
  ProviderHttpError,
} from './error-handling.js'
export type { ClassifiedError, ErrorType } from './error-handling.js'

// OAuth
export { startCodexOAuthFlow, resolveCodexAuth } from './openai-codex-oauth.js'
export { resolveGeminiAuth } from './gemini-oauth.js'
export type { GeminiAuth } from './gemini-oauth.js'

// Adapters (for direct use if needed)
export { AnthropicProvider } from './anthropic.js'
export { OpenAICompatProvider } from './openai-compat.js'
export { OpenAIResponsesProvider, isResponsesApiModel } from './openai-responses.js'
export { GeminiProvider } from './gemini.js'
