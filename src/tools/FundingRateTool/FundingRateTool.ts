/**
 * FundingRateTool — Query current funding rate for a perpetual futures symbol.
 * Returns the current rate and next funding time.
 * Read-only, no state changes.
 */

import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { ensureFutures } from '../../services/exchange/venue-bootstrap.js'
import type { FuturesInterface } from '../../services/exchange/types.js'

const inputSchema = z.strictObject({
  symbol: z
    .string()
    .describe('Futures symbol, e.g. "BTC/USDT:USDT"'),
})

type InputSchema = typeof inputSchema
type Output = string

async function getFuturesExchange(): Promise<FuturesInterface> {
  return ensureFutures()
}

function formatFundingRate(
  symbol: string,
  rate: number,
  nextTime: number,
): string {
  const pct = (rate * 100).toFixed(4)
  const annualized = (rate * 3 * 365 * 100).toFixed(2)
  const next = new Date(nextTime)
  const timeStr = next.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC')
  return [
    `Funding Rate: ${symbol}`,
    `${'─'.repeat(40)}`,
    `  Current rate: ${pct}% per 8h`,
    `  Annualized: ${annualized}%`,
    `  Next funding: ${timeStr}`,
    `  Note: Display only — not deducted from balance in paper mode`,
  ].join('\n')
}

export const FundingRateTool = buildTool({
  name: 'GetFundingRate',
  searchHint: 'funding rate perpetual futures symbol',
  maxResultSizeChars: 5_000,

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
    return 'Get the current funding rate and next funding time for a perpetual futures symbol.'
  },

  async prompt() {
    return [
      'Query the current funding rate for a perpetual futures symbol.',
      'Returns the rate per 8h, annualized rate, and next funding timestamp.',
      'In paper mode, funding is display-only (not deducted).',
    ].join('\n')
  },

  toAutoClassifierInput(input) {
    return `funding rate ${input.symbol}`
  },

  mapToolResultToToolResultBlockParam(content, toolUseID) {
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: String(content),
    }
  },

  renderToolUseMessage(input) {
    return `GetFundingRate: ${input.symbol ?? '?'}`
  },

  async call(input) {
    try {
      const exchange = await getFuturesExchange()
      const { rate, nextTime } = await exchange.getFundingRate(input.symbol)
      return { data: formatFundingRate(input.symbol, rate, nextTime) }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      return { data: `Error fetching funding rate: ${msg}` }
    }
  },
} satisfies ToolDef<InputSchema, Output>)
