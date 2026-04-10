/**
 * Multi-provider model validation.
 *
 * validateMultiProviderModel() — checks if a non-Anthropic model ID is
 * known in the catalog or belongs to a recognized provider.
 *
 * isNonAnthropicModel() — quick check for the model allowlist bypass.
 */

import { parseModelRef, isNonAnthropicModelRef } from './types.js'
import { getModelDefinition, getKnownProviderIds } from './model-catalog.js'
import { isProviderAvailable } from './registry.js'

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate a model string for multi-provider support.
 *
 * Returns:
 *   - `{ valid: true }` if the model is a known non-Anthropic model
 *   - `{ valid: false, error }` if the model is non-Anthropic but invalid
 *   - `null` if the model is Anthropic (let existing validation handle it)
 */
export function validateMultiProviderModel(
  model: string,
): { valid: boolean; error?: string } | null {
  const ref = parseModelRef(model)

  // Anthropic models: return null to let existing validation handle them
  if (ref.provider === 'anthropic') {
    return null
  }

  // Check if the provider is recognized
  const knownProviders = getKnownProviderIds()
  if (!knownProviders.includes(ref.provider)) {
    return {
      valid: false,
      error: `Unknown provider '${ref.provider}'. Available: ${knownProviders.join(', ')}`,
    }
  }

  // Check if provider has credentials
  if (!isProviderAvailable(ref.provider)) {
    return {
      valid: false,
      error: `Provider '${ref.provider}' is not configured. Set the required API key env var.`,
    }
  }

  // Check if the model is in the catalog
  const modelDef = getModelDefinition(ref.model)
  if (modelDef) {
    return { valid: true }
  }

  // Model not in catalog — allow it anyway for providers that support arbitrary models
  // (OpenRouter, Ollama, and user-specified models)
  const flexibleProviders = new Set(['openrouter', 'ollama', 'together'])
  if (flexibleProviders.has(ref.provider)) {
    return { valid: true }
  }

  // For fixed-catalog providers, warn but allow (the API will reject if truly invalid)
  return { valid: true }
}

// ---------------------------------------------------------------------------
// Quick check
// ---------------------------------------------------------------------------

/**
 * Quick check: is this a non-Anthropic model?
 * Used by the model allowlist to bypass Anthropic-specific validation.
 */
export function isNonAnthropicModel(model: string): boolean {
  return isNonAnthropicModelRef(model)
}
