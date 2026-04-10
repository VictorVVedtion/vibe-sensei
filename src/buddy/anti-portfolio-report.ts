/**
 * Cross-Venue Anti-Portfolio Report — "what if you listened?" analysis.
 *
 * Uses multi-venue counterfactual data to generate a report showing
 * the hypothetical P&L impact of ignored guardian alerts, grouped by
 * venue. Formatted through the guardian's archetype voice.
 * Zero LLM calls — all text is template-driven.
 */

import type { Master } from './types.js'
import { MASTER_NAMES } from './types.js'
import type { Archetype } from './persona.js'
import { getMasterArchetype } from './persona.js'
import type { MultiVenueCounterfactual, VenueCounterfactualGroup } from '../services/knowledge/counterfactual.js'

// ── Types ────────────────────────────────────────────────────────────────────

export interface VenueAntiSummary {
  venueId: string
  vertical: string
  ignoredCount: number
  estimatedSavings: number
  estimatedCost: number
  netImpact: number
}

export interface AntiPortfolioReport {
  masterName: string
  archetype: Archetype
  venues: VenueAntiSummary[]
  totalIgnored: number
  totalHypotheticalPnL: number
  commentary: string
}

// ── Archetype Commentary Templates ───────────────────────────────────────────

const ARCHETYPE_COMMENTARY: Record<Archetype, { positive: string; negative: string; neutral: string }> = {
  value_investor: {
    positive: 'Had you listened, you would have preserved capital. Margin of safety works.',
    negative: 'The alerts were overly cautious. But remember: avoiding ruin is always the first rule.',
    neutral: 'Mixed results. The guardian errs on the side of caution — as it should.',
  },
  trend_follower: {
    positive: 'The trend was against you and the alerts saw it. Next time, cut faster.',
    negative: 'Some whipsaw alerts, but the cost of listening is always less than the cost of blowing up.',
    neutral: 'Noise in the signal. But the alerts that mattered saved real money.',
  },
  macro_trader: {
    positive: 'The macro regime was wrong for those trades. Sizing down would have saved you.',
    negative: 'The macro call was too conservative. But capital preservation beats regret.',
    neutral: 'The regime was ambiguous. Some alerts were right, some were noise.',
  },
  quant: {
    positive: 'The risk model flagged these correctly. Trust the system next time.',
    negative: 'False positives in the model. But false negatives are far more expensive.',
    neutral: 'Expected noise in the filter. Net expected value of listening is still positive.',
  },
  strategist: {
    positive: 'The terrain was unfavorable. The guardian read the battlefield correctly.',
    negative: 'Some false alarms. But a cautious general survives to fight another day.',
    neutral: 'Mixed intelligence. Sharpen the reconnaissance for next week.',
  },
  philosopher: {
    positive: 'Pain avoided is wisdom gained. The antifragile trader listens to warnings.',
    negative: 'Caution has a cost. But survival has infinite value.',
    neutral: 'Some warnings were noise, some were prophecy. Wisdom is knowing which.',
  },
  first_principles: {
    positive: 'The fundamentals were wrong and the alert caught it. Reason from first principles.',
    negative: 'The alert was premature. But asking "why" before trading is never wasted.',
    neutral: 'Mixed signals. Go back to the fundamental thesis for each trade.',
  },
  crypto_native: {
    positive: 'The narrative shifted and you ignored the warning. Crypto humbles everyone.',
    negative: 'Some alerts were too bearish. But staying liquid is how you survive crypto.',
    neutral: 'Volatile results. The guardian kept you from the worst of it.',
  },
  scientist: {
    positive: 'The data supported the warnings. Ignoring evidence is a costly experiment.',
    negative: 'Type I errors in the detection. But the cost of Type II errors is ruin.',
    neutral: 'Noisy data. The hypothesis needs more samples to confirm.',
  },
}

// ── Report Generation ────────────────────────────────────────────────────────

function buildVenueSummaries(data: MultiVenueCounterfactual): VenueAntiSummary[] {
  const summaries: VenueAntiSummary[] = []

  for (const group of data.byVenue) {
    const savings = group.alerts
      .filter(a => a.hypotheticalPnL !== undefined && a.hypotheticalPnL < 0)
      .reduce((s, a) => s + Math.abs(a.hypotheticalPnL!), 0)

    const cost = group.alerts
      .filter(a => a.hypotheticalPnL !== undefined && a.hypotheticalPnL > 0)
      .reduce((s, a) => s + a.hypotheticalPnL!, 0)

    summaries.push({
      venueId: group.venueId,
      vertical: group.vertical,
      ignoredCount: group.alerts.length,
      estimatedSavings: savings,
      estimatedCost: cost,
      netImpact: savings - cost,
    })
  }

  return summaries.sort((a, b) => b.netImpact - a.netImpact)
}

function computeTotalHypotheticalPnL(venues: VenueAntiSummary[]): number {
  return venues.reduce((s, v) => s + v.netImpact, 0)
}

function selectCommentary(archetype: Archetype, totalPnL: number): string {
  const templates = ARCHETYPE_COMMENTARY[archetype]
  if (totalPnL > 100) return templates.positive
  if (totalPnL < -100) return templates.negative
  return templates.neutral
}

function formatCurrency(amount: number): string {
  const sign = amount >= 0 ? '+' : '-'
  const abs = Math.abs(amount)
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`
  return `${sign}$${abs.toFixed(2)}`
}

function buildCommentaryText(
  masterName: string,
  archetype: Archetype,
  venues: VenueAntiSummary[],
  totalIgnored: number,
  totalPnL: number,
): string {
  const parts: string[] = []

  parts.push(`[${masterName}] Anti-Portfolio Report`)
  parts.push(`${totalIgnored} ignored alerts | Hypothetical impact: ${formatCurrency(totalPnL)}`)

  if (venues.length > 0) {
    parts.push('Per-Venue Impact:')
    for (const v of venues) {
      const venueLabel = v.vertical.charAt(0).toUpperCase() + v.vertical.slice(1).replace('_', ' ')
      parts.push(`  ${venueLabel}: ${v.ignoredCount} ignored, saved ${formatCurrency(v.estimatedSavings)}, missed ${formatCurrency(-v.estimatedCost)}`)
    }
  }

  parts.push(selectCommentary(archetype, totalPnL))

  return parts.join('\n')
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate a cross-venue anti-portfolio report.
 *
 * @param data - Multi-venue counterfactual data from getMultiVenueCounterfactuals()
 * @param masterId - The guardian master ID for personality
 */
export function generateAntiPortfolioReport(
  data: MultiVenueCounterfactual,
  masterId: Master,
): AntiPortfolioReport {
  const masterName = MASTER_NAMES[masterId] ?? masterId
  const archetype = getMasterArchetype(masterId)

  const venues = buildVenueSummaries(data)
  const totalIgnored = venues.reduce((s, v) => s + v.ignoredCount, 0)
  const totalHypotheticalPnL = computeTotalHypotheticalPnL(venues)

  const commentary = buildCommentaryText(
    masterName,
    archetype,
    venues,
    totalIgnored,
    totalHypotheticalPnL,
  )

  return {
    masterName,
    archetype,
    venues,
    totalIgnored,
    totalHypotheticalPnL,
    commentary,
  }
}
