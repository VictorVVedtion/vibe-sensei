/**
 * /provider command implementation.
 *
 * Subcommands:
 *   /provider list [provider]  — List available models
 *   /provider auth [provider]  — Show auth status
 *   /provider set <model>      — Set current model
 *   /provider status           — Show provider status overview
 *   /provider cost             — Show session cost breakdown
 */

import type { LocalCommandResult } from '../../types/command.js'

export async function call(
  args: string,
): Promise<LocalCommandResult> {
  const parts = args.trim().split(/\s+/)
  const subcommand = parts[0]?.toLowerCase() || 'status'
  const subArg = parts.slice(1).join(' ').trim()

  switch (subcommand) {
    case 'list':
      return handleList(subArg)
    case 'auth':
      return handleAuth(subArg)
    case 'set':
      return handleSet(subArg)
    case 'status':
      return handleStatus()
    case 'cost':
      return handleCost()
    default:
      return {
        type: 'text',
        value: [
          'Usage: /provider <subcommand>',
          '',
          'Subcommands:',
          '  list [provider]  — List available models (optionally filtered by provider)',
          '  auth [provider]  — Show authentication status',
          '  set <model>      — Set the current model (e.g. "gpt-5.4", "gemini/gemini-3-flash-preview")',
          '  status           — Show provider overview',
          '  cost             — Show session cost breakdown by provider',
        ].join('\n'),
      }
  }
}

// ---------------------------------------------------------------------------
// Subcommand handlers
// ---------------------------------------------------------------------------

async function handleList(provider: string): Promise<LocalCommandResult> {
  const { listRegisteredProviders, isProviderAvailable, getModelsForProvider } = await import(
    '../../services/api/providers/registry.js'
  )
  const { MODEL_CATALOG } = await import('../../services/api/providers/model-catalog.js')

  const lines: string[] = []

  if (provider) {
    // List models for specific provider
    const models = getModelsForProvider(provider)
    if (models.length === 0) {
      return {
        type: 'text',
        value: `No known models for provider '${provider}'. If using OpenRouter or Ollama, models are discovered at runtime.`,
      }
    }

    const available = isProviderAvailable(provider)
    lines.push(`Models for ${provider} ${available ? '(configured)' : '(not configured)'}:`)
    lines.push('')

    for (const m of models) {
      const pricing = `$${m.inputPricePer1M}/$${m.outputPricePer1M} per 1M tokens`
      const ctx = formatContextWindow(m.contextWindow)
      const features: string[] = []
      if (m.supportsThinking) features.push('thinking')
      if (m.supportsTools) features.push('tools')
      if (m.supportsImages) features.push('vision')

      lines.push(`  ${m.id}`)
      lines.push(`    ${m.name} | ${ctx} context | ${pricing}`)
      if (features.length > 0) {
        lines.push(`    Features: ${features.join(', ')}`)
      }
    }
  } else {
    // List all providers with model counts
    const providers = listRegisteredProviders()
    lines.push('Available providers:')
    lines.push('')

    for (const p of providers) {
      const info = p.getInfo()
      const available = isProviderAvailable(info.id)
      const status = available ? '  [configured]' : ' [not configured]'
      const modelCount = info.models.length
      const modelText = modelCount > 0 ? `${modelCount} models` : 'dynamic'

      lines.push(`  ${info.name.padEnd(22)} ${status}  ${modelText}`)
      lines.push(`    ${info.description}`)
    }

    lines.push('')
    lines.push('Use /provider list <provider> for model details')
  }

  return { type: 'text', value: lines.join('\n') }
}

async function handleAuth(provider: string): Promise<LocalCommandResult> {
  const { getProviderAuthStatus, PROVIDER_AUTH_ENV_VARS } = await import(
    '../../services/api/providers/auth-env.js'
  )

  const lines: string[] = []
  const status = getProviderAuthStatus()

  if (provider) {
    // Show auth for specific provider
    const isAuthed = status[provider]
    const envVars = PROVIDER_AUTH_ENV_VARS[provider] || []

    lines.push(`${provider}: ${isAuthed ? 'configured' : 'NOT configured'}`)
    if (envVars.length > 0) {
      lines.push(`  Required env vars: ${envVars.join(' or ')}`)
      for (const envVar of envVars) {
        const isSet = !!process.env[envVar]?.trim()
        lines.push(`    ${envVar}: ${isSet ? 'set' : 'not set'}`)
      }
    } else {
      lines.push('  No API key required (local provider)')
    }
  } else {
    // Show all providers
    lines.push('Provider authentication status:')
    lines.push('')

    for (const [p, isAuthed] of Object.entries(status)) {
      const symbol = isAuthed ? '+' : '-'
      const envVars = PROVIDER_AUTH_ENV_VARS[p] || []
      const envHint = envVars.length > 0 ? ` (${envVars[0]})` : ' (no key needed)'
      lines.push(`  [${symbol}] ${p.padEnd(12)}${envHint}`)
    }

    lines.push('')
    lines.push('Use /provider auth <provider> for details')
  }

  return { type: 'text', value: lines.join('\n') }
}

async function handleSet(model: string): Promise<LocalCommandResult> {
  if (!model) {
    return {
      type: 'text',
      value: 'Usage: /provider set <model>\nExample: /provider set gpt-5.4',
    }
  }

  const { parseModelRef } = await import('../../services/api/providers/types.js')
  const { isProviderAvailable } = await import('../../services/api/providers/registry.js')
  const { getModelDefinition } = await import('../../services/api/providers/model-catalog.js')

  const ref = parseModelRef(model)

  if (!isProviderAvailable(ref.provider)) {
    return {
      type: 'text',
      value: `Provider '${ref.provider}' is not configured. Run /provider auth ${ref.provider} to check.`,
    }
  }

  const modelDef = getModelDefinition(ref.model)
  const modelInfo = modelDef
    ? `${modelDef.name} (${formatContextWindow(modelDef.contextWindow)} context, $${modelDef.inputPricePer1M}/$${modelDef.outputPricePer1M})`
    : ref.model

  return {
    type: 'text',
    value: `Set model to: ${ref.model} via ${ref.provider}\n${modelInfo}\n\nUse /model ${model} to apply.`,
  }
}

async function handleStatus(): Promise<LocalCommandResult> {
  const { listRegisteredProviders, isProviderAvailable } = await import(
    '../../services/api/providers/registry.js'
  )
  const { getSessionCostSummary } = await import('../../services/api/providers/cost-tracker.js')

  const lines: string[] = ['Multi-Provider Status', '']

  const providers = listRegisteredProviders()
  let configuredCount = 0

  for (const p of providers) {
    const info = p.getInfo()
    const available = isProviderAvailable(info.id)
    if (available) configuredCount++

    const symbol = available ? '+' : '-'
    lines.push(`  [${symbol}] ${info.name}`)
  }

  lines.push('')
  lines.push(`${configuredCount}/${providers.length} providers configured`)

  const cost = getSessionCostSummary()
  if (cost.totalRequests > 0) {
    lines.push('')
    lines.push(`Session: ${cost.totalRequests} requests, $${cost.totalCostUSD.toFixed(4)} estimated cost`)
  }

  return { type: 'text', value: lines.join('\n') }
}

async function handleCost(): Promise<LocalCommandResult> {
  const { formatCostSummary } = await import('../../services/api/providers/cost-tracker.js')
  return { type: 'text', value: formatCostSummary() }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatContextWindow(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(tokens % 1_000_000 === 0 ? 0 : 1)}M`
  }
  return `${(tokens / 1_000).toFixed(0)}K`
}
