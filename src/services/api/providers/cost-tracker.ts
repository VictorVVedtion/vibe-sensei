/**
 * Per-provider session cost tracking.
 *
 * Records input/output token usage per provider+model combination
 * and computes running cost totals using catalog pricing.
 */

import { getModelDefinition } from './model-catalog.js'

// ---------------------------------------------------------------------------
// Session state
// ---------------------------------------------------------------------------

type UsageEntry = {
  provider: string
  model: string
  inputTokens: number
  outputTokens: number
  estimatedCostUSD: number
  requestCount: number
}

const sessionUsage = new Map<string, UsageEntry>()

function usageKey(provider: string, model: string): string {
  return `${provider}::${model}`
}

// ---------------------------------------------------------------------------
// Recording
// ---------------------------------------------------------------------------

/**
 * Record token usage for a provider+model pair.
 * Accumulates into the session total.
 */
export function recordProviderUsage(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
): void {
  const key = usageKey(provider, model)
  const existing = sessionUsage.get(key)

  const def = getModelDefinition(model)
  const inputCost = def
    ? (inputTokens / 1_000_000) * def.inputPricePer1M
    : 0
  const outputCost = def
    ? (outputTokens / 1_000_000) * def.outputPricePer1M
    : 0
  const requestCost = inputCost + outputCost

  if (existing) {
    existing.inputTokens += inputTokens
    existing.outputTokens += outputTokens
    existing.estimatedCostUSD += requestCost
    existing.requestCount += 1
  } else {
    sessionUsage.set(key, {
      provider,
      model,
      inputTokens,
      outputTokens,
      estimatedCostUSD: requestCost,
      requestCount: 1,
    })
  }
}

// ---------------------------------------------------------------------------
// Summaries
// ---------------------------------------------------------------------------

export type CostSummaryEntry = {
  provider: string
  model: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  estimatedCostUSD: number
  requestCount: number
}

export type SessionCostSummary = {
  entries: CostSummaryEntry[]
  totalCostUSD: number
  totalInputTokens: number
  totalOutputTokens: number
  totalRequests: number
}

/**
 * Get structured session cost data.
 */
export function getSessionCostSummary(): SessionCostSummary {
  const entries: CostSummaryEntry[] = []
  let totalCostUSD = 0
  let totalInputTokens = 0
  let totalOutputTokens = 0
  let totalRequests = 0

  for (const entry of sessionUsage.values()) {
    entries.push({
      ...entry,
      totalTokens: entry.inputTokens + entry.outputTokens,
    })
    totalCostUSD += entry.estimatedCostUSD
    totalInputTokens += entry.inputTokens
    totalOutputTokens += entry.outputTokens
    totalRequests += entry.requestCount
  }

  // Sort by cost descending
  entries.sort((a, b) => b.estimatedCostUSD - a.estimatedCostUSD)

  return {
    entries,
    totalCostUSD,
    totalInputTokens,
    totalOutputTokens,
    totalRequests,
  }
}

/**
 * Format a human-readable cost summary table.
 */
export function formatCostSummary(): string {
  const summary = getSessionCostSummary()

  if (summary.entries.length === 0) {
    return 'No multi-provider usage this session.'
  }

  const lines: string[] = [
    '┌─────────────┬──────────────────────────┬──────────┬───────────┬──────────┐',
    '│ Provider    │ Model                    │ Requests │ Tokens    │ Cost     │',
    '├─────────────┼──────────────────────────┼──────────┼───────────┼──────────┤',
  ]

  for (const entry of summary.entries) {
    const provider = entry.provider.padEnd(11)
    const model = entry.model.slice(0, 24).padEnd(24)
    const requests = String(entry.requestCount).padStart(8)
    const tokens = formatTokenCount(entry.totalTokens).padStart(9)
    const cost = formatUSD(entry.estimatedCostUSD).padStart(8)
    lines.push(`│ ${provider} │ ${model} │ ${requests} │ ${tokens} │ ${cost} │`)
  }

  lines.push('├─────────────┴──────────────────────────┼──────────┼───────────┼──────────┤')
  const totalRequests = String(summary.totalRequests).padStart(8)
  const totalTokens = formatTokenCount(summary.totalInputTokens + summary.totalOutputTokens).padStart(9)
  const totalCost = formatUSD(summary.totalCostUSD).padStart(8)
  lines.push(`│ TOTAL                                 │ ${totalRequests} │ ${totalTokens} │ ${totalCost} │`)
  lines.push('└───────────────────────────────────────┴──────────┴───────────┴──────────┘')

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatUSD(amount: number): string {
  if (amount < 0.01) {
    return `$${amount.toFixed(4)}`
  }
  return `$${amount.toFixed(2)}`
}

function formatTokenCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K`
  }
  return String(count)
}

/**
 * Reset session usage (for testing).
 */
export function resetSessionUsage(): void {
  sessionUsage.clear()
}
