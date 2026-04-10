/**
 * CancelOrderTool — Cancel an open order by its order ID.
 * Wraps exchange.cancelOrder() with proper error handling.
 */

import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import {
  InvalidSymbolError,
} from '../../services/exchange/index.js'
import { getConnectedExchange } from '../../services/exchange/singleton.js'
import type { Order } from '../../services/exchange/types.js'

const inputSchema = z.strictObject({
  orderId: z.string().describe('The ID of the order to cancel'),
  symbol: z
    .string()
    .optional()
    .describe('Trading pair symbol, e.g. "BTC/USDT". Optional but may be required by some exchanges.'),
})

type InputSchema = typeof inputSchema
type Output = string

function formatCancelledOrder(order: Order): string {
  const lines = [
    `Order ${order.id} cancelled`,
    `  ${order.side.toUpperCase()} ${order.quantity} ${order.symbol} @ ${order.type}`,
    `  Status: ${order.status}`,
  ]
  if (order.price != null && order.price > 0) {
    lines.push(`  Price: ${order.price.toFixed(2)}`)
  }
  if (order.stopPrice != null && order.stopPrice > 0) {
    lines.push(`  Stop price: ${order.stopPrice.toFixed(2)}`)
  }
  return lines.join('\n')
}

export const CancelOrderTool = buildTool({
  name: 'CancelOrder',
  searchHint: 'cancel an open trading order on the exchange',
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
    return 'Cancel an open order by its order ID. Optionally specify the symbol.'
  },

  async prompt() {
    return [
      'Cancel an open order on the exchange.',
      'Requires: orderId (the ID of the order to cancel).',
      'Optionally provide the symbol (e.g. "BTC/USDT").',
      'Cannot cancel orders that are already filled or cancelled.',
    ].join('\n')
  },

  toAutoClassifierInput(input) {
    return `cancel order ${input.orderId ?? '?'}`
  },

  mapToolResultToToolResultBlockParam(content, toolUseID) {
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: String(content),
    }
  },

  renderToolUseMessage(input) {
    const id = input.orderId ?? '?'
    const sym = input.symbol ? ` (${input.symbol})` : ''
    return `CancelOrder: ${id}${sym}`
  },

  async call(input) {
    const exchange = await getConnectedExchange()

    try {
      const order = await exchange.cancelOrder(input.orderId, input.symbol)
      return { data: formatCancelledOrder(order) }
    } catch (error: unknown) {
      if (error instanceof InvalidSymbolError) {
        return { data: `Unknown trading pair: ${error.message}` }
      }
      if (error instanceof Error) {
        // Handle "order not found" and "already filled/cancelled" errors
        if (
          error.message.includes('not found') ||
          error.message.includes('Cannot cancel')
        ) {
          return { data: `Cannot cancel order: ${error.message}` }
        }
      }
      throw error
    }
  },
} satisfies ToolDef<InputSchema, Output>)
