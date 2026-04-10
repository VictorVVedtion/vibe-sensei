/**
 * OptionsOrderTool — Place options trading orders via Deribit.
 * Supports market and limit orders on crypto options.
 * Uses VenueRegistry to resolve the crypto_options exchange.
 */

import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import type { Order } from '../../services/exchange/types.js'
import { runPreTradeGate } from '../_shared/runPreTradeGate.js'

const inputSchema = z.strictObject({
  symbol: z
    .string()
    .describe('Option symbol, e.g. "BTC-28JUN24-70000-C"'),
  side: z.enum(['buy', 'sell']).describe('Order side'),
  type: z
    .enum(['market', 'limit'])
    .describe('Order type'),
  quantity: z.number().positive().describe('Number of contracts'),
  price: z
    .number()
    .positive()
    .optional()
    .describe('Limit price (required for limit orders)'),
})

type InputSchema = typeof inputSchema
type Output = string

function formatOrder(order: Order): string {
  const lines = [
    `Options Order ${order.id}`,
    `  ${order.side.toUpperCase()} ${order.quantity} ${order.symbol} @ ${order.type}`,
    `  Status: ${order.status}`,
  ]
  if (order.avgFillPrice > 0) {
    lines.push(`  Fill price: ${order.avgFillPrice.toFixed(6)}`)
  }
  if (order.fee > 0) {
    lines.push(`  Fee: ${order.fee.toFixed(6)}`)
  }
  return lines.join('\n')
}

async function getOptionsExchange() {
  const { ensureOptions } = await import(
    '../../services/exchange/venue-bootstrap.js'
  )
  return ensureOptions()
}

export const OptionsOrderTool = buildTool({
  name: 'PlaceOptionsOrder',
  searchHint: 'place a buy or sell options order on Deribit',
  maxResultSizeChars: 10_000,

  get inputSchema(): InputSchema {
    return inputSchema
  },

  isReadOnly() {
    return false
  },

  isDestructive() {
    return true
  },

  isConcurrencySafe() {
    return false
  },

  async description() {
    return 'Place an options trading order (market or limit) on Deribit.'
  },

  async prompt() {
    return [
      'Place an options order on the connected Deribit exchange.',
      'Requires: symbol (e.g. BTC-28JUN24-70000-C), side (buy/sell), type (market/limit), quantity.',
      'Limit orders require a price.',
      'Symbol format: UNDERLYING-EXPIRY-STRIKE-TYPE (C=call, P=put).',
    ].join('\n')
  },

  toAutoClassifierInput(input) {
    return `options ${input.side} ${input.quantity} ${input.symbol} ${input.type}`
  },

  mapToolResultToToolResultBlockParam(content, toolUseID) {
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: String(content),
    }
  },

  renderToolUseMessage(input) {
    const side = input.side?.toUpperCase() ?? '?'
    const qty = input.quantity ?? '?'
    const sym = input.symbol ?? '?'
    return `PlaceOptionsOrder: ${side} ${qty} ${sym}`
  },

  async call(input) {
    // SECURITY: fail-closed pre-trade gate. See _shared/runPreTradeGate.ts.
    // Options-specific risk checks (greeks exposure, theta decay, IV crush,
    // max loss) run inside the gate evaluator via the vertical-dispatcher.
    // Note: OptionsOrderTool input has no stopPrice — gate input adapts.
    const gate = await runPreTradeGate({
      symbol: input.symbol,
      side: input.side,
      type: input.type === 'limit' ? 'limit' : 'market',
      quantity: input.quantity,
      price: input.price,
    })
    if (!gate.allowed) {
      return { data: gate.formattedRejection }
    }

    try {
      const exchange = await getOptionsExchange()
      const order = await exchange.placeOrder({
        symbol: input.symbol,
        side: input.side,
        type: input.type,
        quantity: input.quantity,
        price: input.price,
      })
      return { data: formatOrder(order) }
    } catch (error: unknown) {
      if (error instanceof Error) {
        return { data: `Options order failed: ${error.message}` }
      }
      throw error
    }
  },
} satisfies ToolDef<InputSchema, Output>)
