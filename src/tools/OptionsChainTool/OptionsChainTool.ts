/**
 * OptionsChainTool — Fetch and display the options chain for an underlying.
 * Read-only. Uses VenueRegistry to resolve the crypto_options exchange.
 */

import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import type { OptionsChainEntry, OptionsInterface } from '../../services/exchange/types.js'

const inputSchema = z.strictObject({
  underlying: z
    .string()
    .describe('Underlying asset, e.g. "BTC" or "ETH"'),
  expiry: z
    .string()
    .optional()
    .describe('Optional expiry filter, e.g. "2024-06-28"'),
})

type InputSchema = typeof inputSchema
type Output = string

function formatChainEntry(entry: OptionsChainEntry): string {
  const typeLabel = entry.type.toUpperCase().padEnd(4)
  const strike = String(entry.strike).padStart(8)
  const bid = entry.bid.toFixed(6).padStart(10)
  const ask = entry.ask.toFixed(6).padStart(10)
  const iv = (entry.iv * 100).toFixed(1).padStart(6) + '%'
  const vol = String(entry.volume).padStart(8)
  const oi = String(entry.openInterest).padStart(8)
  return `${typeLabel} ${strike} ${bid} ${ask}  ${iv} ${vol} ${oi}  ${entry.expiry}`
}

function formatChain(entries: OptionsChainEntry[], underlying: string): string {
  if (entries.length === 0) {
    return `No options found for ${underlying}`
  }

  const header =
    'Type   Strike       Bid        Ask     IV      Vol       OI  Expiry'
  const separator = '-'.repeat(header.length)

  const sorted = [...entries].sort((a, b) => {
    if (a.expiry !== b.expiry) return a.expiry.localeCompare(b.expiry)
    if (a.strike !== b.strike) return a.strike - b.strike
    return a.type === 'call' ? -1 : 1
  })

  const rows = sorted.map(formatChainEntry)
  return [
    `Options Chain: ${underlying} (${entries.length} contracts)`,
    '',
    header,
    separator,
    ...rows,
  ].join('\n')
}

async function getOptionsExchange(): Promise<OptionsInterface> {
  const { ensureOptions } = await import(
    '../../services/exchange/venue-bootstrap.js'
  )
  return ensureOptions()
}

export const OptionsChainTool = buildTool({
  name: 'GetOptionsChain',
  searchHint: 'view options chain for BTC ETH crypto underlying',
  maxResultSizeChars: 50_000,

  get inputSchema(): InputSchema {
    return inputSchema
  },

  isReadOnly() {
    return true
  },

  isDestructive() {
    return false
  },

  isConcurrencySafe() {
    return true
  },

  async description() {
    return 'Fetch the options chain (strikes, expiries, bids, asks, IV, volume) for a crypto underlying.'
  },

  async prompt() {
    return [
      'Fetch the options chain for a crypto underlying asset.',
      'Requires: underlying (e.g. "BTC").',
      'Optional: expiry to filter by a specific expiration date.',
      'Returns calls and puts with strike, bid, ask, IV, volume, and open interest.',
    ].join('\n')
  },

  toAutoClassifierInput(input) {
    return `options chain ${input.underlying} ${input.expiry ?? ''}`
  },

  mapToolResultToToolResultBlockParam(content, toolUseID) {
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: String(content),
    }
  },

  renderToolUseMessage(input) {
    return `GetOptionsChain: ${input.underlying}${input.expiry ? ` exp=${input.expiry}` : ''}`
  },

  async call(input) {
    try {
      const exchange = await getOptionsExchange()
      const chain = await exchange.getOptionsChain(
        input.underlying,
        input.expiry,
      )
      return { data: formatChain(chain, input.underlying) }
    } catch (error: unknown) {
      if (error instanceof Error) {
        return { data: `Options chain error: ${error.message}` }
      }
      throw error
    }
  },
} satisfies ToolDef<InputSchema, Output>)
