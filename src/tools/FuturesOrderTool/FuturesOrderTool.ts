/**
 * FuturesOrderTool — Place perpetual futures orders.
 * Supports market, limit, and stop-loss orders with optional leverage.
 * Gets futures exchange from VenueRegistry (perp_futures vertical).
 */

import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import {
  InsufficientFundsError,
  InvalidSymbolError,
} from '../../services/exchange/index.js'
import { ensureFutures } from '../../services/exchange/venue-bootstrap.js'
import type { FuturesInterface, Order } from '../../services/exchange/types.js'
import { runPreTradeGate } from '../_shared/runPreTradeGate.js'

const inputSchema = z.strictObject({
  symbol: z
    .string()
    .describe('Futures symbol, e.g. "BTC/USDT:USDT" for linear perpetuals'),
  side: z
    .enum(['buy', 'sell'])
    .describe('Order side: buy = open/close long, sell = open/close short'),
  type: z
    .enum(['market', 'limit', 'stop_loss'])
    .describe('Order type'),
  quantity: z.number().positive().describe('Order quantity in base currency'),
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
  leverage: z
    .number()
    .min(1)
    .max(125)
    .optional()
    .describe('Leverage (1-125). If set, calls setLeverage before placing order'),
})

type InputSchema = typeof inputSchema
type Output = string

function formatOrder(order: Order): string {
  const lines = [
    `Futures Order ${order.id}`,
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

async function getFuturesExchange(): Promise<FuturesInterface> {
  return ensureFutures()
}

export const FuturesOrderTool = buildTool({
  name: 'PlaceFuturesOrder',
  searchHint: 'place a perpetual futures order with leverage long short',
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
    return 'Place a perpetual futures order (market, limit, or stop-loss) with optional leverage.'
  },

  async prompt() {
    return [
      'Place a perpetual futures order on the exchange.',
      'Requires: symbol (e.g. BTC/USDT:USDT), side (buy/sell), type, quantity.',
      'Optional: price (limit), stopPrice (stop_loss), leverage (1-125).',
      'buy = long direction, sell = short direction.',
      'If leverage is provided, it will be set before placing the order.',
    ].join('\n')
  },

  toAutoClassifierInput(input) {
    return `futures ${input.side} ${input.quantity} ${input.symbol} ${input.type}`
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
    const lev = input.leverage ? ` ${input.leverage}x` : ''
    return `PlaceFuturesOrder: ${side}${lev} ${qty} ${sym}`
  },

  async call(input) {
    // SECURITY: fail-closed pre-trade gate. See _shared/runPreTradeGate.ts
    // for the threat model. The futures-specific risk checks (leverage,
    // liquidation proximity, margin utilization, funding rate) run inside
    // the gate evaluator via the vertical-dispatcher.
    const gate = await runPreTradeGate({
      symbol: input.symbol,
      side: input.side,
      type: input.type,
      quantity: input.quantity,
      price: input.price,
      stopPrice: input.stopPrice,
    })
    if (!gate.allowed) {
      return { data: gate.formattedRejection }
    }

    try {
      const exchange = await getFuturesExchange()

      // Set leverage before placing order if specified
      if (input.leverage != null) {
        await exchange.setLeverage(input.leverage, input.symbol)
      }

      const order = await exchange.placeOrder({
        symbol: input.symbol,
        side: input.side,
        type: input.type,
        quantity: input.quantity,
        price: input.price,
        stopPrice: input.stopPrice,
      })

      let result = formatOrder(order)
      if (input.leverage != null) {
        result = `Leverage set to ${input.leverage}x\n${result}`
      }

      return { data: result }
    } catch (error: unknown) {
      if (error instanceof InsufficientFundsError) {
        return { data: `Insufficient margin: ${error.message}` }
      }
      if (error instanceof InvalidSymbolError) {
        return { data: `Unknown futures pair: ${error.message}` }
      }
      if (error instanceof Error) {
        return { data: `Futures order error: ${error.message}` }
      }
      throw error
    }
  },
} satisfies ToolDef<InputSchema, Output>)
