/**
 * SetLeverageTool — Set leverage for a futures symbol.
 * Range: 1-125x. Applies to subsequent futures orders on that symbol.
 */

import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { ensureFutures } from '../../services/exchange/venue-bootstrap.js'
import type { FuturesInterface } from '../../services/exchange/types.js'

const inputSchema = z.strictObject({
  symbol: z
    .string()
    .describe('Futures symbol, e.g. "BTC/USDT:USDT"'),
  leverage: z
    .number()
    .min(1)
    .max(125)
    .describe('Leverage multiplier (1-125)'),
})

type InputSchema = typeof inputSchema
type Output = string

async function getFuturesExchange(): Promise<FuturesInterface> {
  return ensureFutures()
}

export const SetLeverageTool = buildTool({
  name: 'SetLeverage',
  searchHint: 'set leverage for futures trading symbol',
  maxResultSizeChars: 1_000,

  get inputSchema(): InputSchema {
    return inputSchema
  },

  isReadOnly() {
    return false
  },

  isConcurrencySafe() {
    return true
  },

  async description() {
    return 'Set leverage (1-125x) for a futures symbol. Applies to all subsequent orders on that symbol.'
  },

  async prompt() {
    return [
      'Set the leverage multiplier for futures trading on a specific symbol.',
      'Requires: symbol and leverage (1-125).',
      'Higher leverage = higher risk and potential returns.',
    ].join('\n')
  },

  toAutoClassifierInput(input) {
    return `leverage ${input.leverage}x ${input.symbol}`
  },

  mapToolResultToToolResultBlockParam(content, toolUseID) {
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: String(content),
    }
  },

  renderToolUseMessage(input) {
    return `SetLeverage: ${input.leverage}x ${input.symbol ?? ''}`
  },

  async call(input) {
    try {
      const exchange = await getFuturesExchange()
      await exchange.setLeverage(input.leverage, input.symbol)
      return {
        data: `Leverage set to ${input.leverage}x for ${input.symbol}`,
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      return { data: `Error setting leverage: ${msg}` }
    }
  },
} satisfies ToolDef<InputSchema, Output>)
