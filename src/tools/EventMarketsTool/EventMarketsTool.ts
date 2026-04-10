/**
 * EventMarketsTool — Browse prediction market events (read-only).
 * Returns formatted market list with question, outcomes, prices, and volume.
 */

import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import type { PredictionInterface, PredictionMarket } from '../../services/exchange/types.js'

const inputSchema = z.strictObject({
  query: z
    .string()
    .optional()
    .describe('Optional search query to filter markets (e.g. "election", "BTC")'),
})

type InputSchema = typeof inputSchema
type Output = string

function formatMarket(m: PredictionMarket, idx: number): string {
  const priceList = m.outcomes
    .map((o, i) => `${o}: ${(m.currentPrices[i]! * 100).toFixed(1)}%`)
    .join(' | ')

  const volumeStr = m.volume >= 1_000_000
    ? `$${(m.volume / 1_000_000).toFixed(1)}M`
    : `$${(m.volume / 1_000).toFixed(0)}K`

  return [
    `${idx + 1}. ${m.question}`,
    `   ID: ${m.id}`,
    `   Prices: ${priceList}`,
    `   Volume: ${volumeStr} | Ends: ${formatEndDate(m.endDate)}`,
  ].join('\n')
}

function formatEndDate(iso: string): string {
  if (!iso) return 'N/A'
  try {
    const d = new Date(iso)
    const now = Date.now()
    const diffMs = d.getTime() - now
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    if (days < 0) return 'Expired'
    if (days === 0) return 'Today'
    if (days === 1) return 'Tomorrow'
    if (days < 7) return `${days} days`
    return d.toISOString().slice(0, 10)
  } catch {
    return iso.slice(0, 10)
  }
}

function formatMarketsTable(markets: PredictionMarket[], query?: string): string {
  if (markets.length === 0) {
    return query
      ? `No prediction markets found matching "${query}"`
      : 'No prediction markets available'
  }

  const header = query
    ? `Prediction Markets matching "${query}" (${markets.length} results)`
    : `Prediction Markets (${markets.length} available)`

  const separator = '\u2500'.repeat(50)
  const rows = markets.map(formatMarket)
  return [header, separator, ...rows].join('\n\n')
}

async function resolvePredictionVenue(): Promise<PredictionInterface> {
  const { ensurePrediction } = await import('../../services/exchange/venue-bootstrap.js')
  return ensurePrediction()
}

export const EventMarketsTool = buildTool({
  name: 'GetEventMarkets',
  searchHint: 'browse prediction markets events polymarket odds probability',
  maxResultSizeChars: 50_000,

  get inputSchema(): InputSchema {
    return inputSchema
  },

  isReadOnly() {
    return true
  },

  isConcurrencySafe() {
    return true
  },

  async description() {
    return 'Browse prediction market events with current prices, volume, and end dates.'
  },

  async prompt() {
    return [
      'Browse prediction market events.',
      'Optional: query to filter markets by topic.',
      'Returns market questions, YES/NO prices, volume, and expiry dates.',
      'Read-only — no bets are placed.',
    ].join('\n')
  },

  toAutoClassifierInput() {
    return 'prediction markets'
  },

  mapToolResultToToolResultBlockParam(content, toolUseID) {
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: String(content),
    }
  },

  renderToolUseMessage(input) {
    return input.query
      ? `GetEventMarkets: "${input.query}"`
      : 'GetEventMarkets: all'
  },

  async call(input) {
    try {
      const venue = await resolvePredictionVenue()
      const markets = await venue.getMarkets(input.query)
      return { data: formatMarketsTable(markets, input.query) }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[EventMarketsTool] Error: ${msg}`)
      return { data: `Error fetching markets: ${msg}` }
    }
  },
} satisfies ToolDef<InputSchema, Output>)
