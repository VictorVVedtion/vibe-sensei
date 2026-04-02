/**
 * OrderTool — Place trading orders via the exchange service.
 * Supports market, limit, and stop-loss orders in paper mode.
 */

import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import {
  createExchange,
  InsufficientFundsError,
  InvalidSymbolError,
} from '../../services/exchange/index.js'
import type { Order } from '../../services/exchange/types.js'

const inputSchema = z.strictObject({
  symbol: z.string().describe('Trading pair symbol, e.g. "BTC/USDT"'),
  side: z.enum(['buy', 'sell']).describe('Order side'),
  type: z
    .enum(['market', 'limit', 'stop_loss'])
    .describe('Order type'),
  quantity: z.number().positive().describe('Order quantity'),
  price: z
    .number()
    .positive()
    .optional()
    .describe('Limit price (required for limit orders)'),
  stopPrice: z
    .number()
    .positive()
    .optional()
    .describe('Stop price (required for stop_loss orders)'),
})

type InputSchema = typeof inputSchema
type Output = string

function formatOrder(order: Order): string {
  const lines = [
    `Order ${order.id}`,
    `  ${order.side.toUpperCase()} ${order.quantity} ${order.symbol} @ ${order.type}`,
    `  Status: ${order.status}`,
  ]
  if (order.avgFillPrice > 0) {
    lines.push(`  Fill price: ${order.avgFillPrice.toFixed(2)}`)
  }
  if (order.fee > 0) {
    lines.push(`  Fee: ${order.fee.toFixed(4)}`)
  }
  return lines.join('\n')
}

export const OrderTool = buildTool({
  name: 'PlaceOrder',
  searchHint: 'place a buy or sell trading order on the exchange',
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
    return 'Place a trading order (market, limit, or stop-loss) on the exchange in paper trading mode.'
  },

  async prompt() {
    return [
      'Place a trading order on the exchange.',
      'Requires: symbol, side (buy/sell), type (market/limit/stop_loss), quantity.',
      'Limit orders require a price. Stop-loss orders require a stopPrice.',
      'All orders execute in paper trading mode by default.',
    ].join('\n')
  },

  toAutoClassifierInput(input) {
    return `${input.side} ${input.quantity} ${input.symbol} ${input.type}`
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
    return `PlaceOrder: ${side} ${qty} ${sym}`
  },

  async call(input) {
    const exchange = createExchange({ mode: 'paper' })
    await exchange.connect()

    try {
      const order = await exchange.placeOrder({
        symbol: input.symbol,
        side: input.side,
        type: input.type,
        quantity: input.quantity,
        price: input.price,
        stopPrice: input.stopPrice,
      })
      return { data: formatOrder(order) }
    } catch (error: unknown) {
      if (error instanceof InsufficientFundsError) {
        return { data: `Not enough balance: ${error.message}` }
      }
      if (error instanceof InvalidSymbolError) {
        return { data: `Unknown trading pair: ${error.message}` }
      }
      throw error
    }
  },
} satisfies ToolDef<InputSchema, Output>)
