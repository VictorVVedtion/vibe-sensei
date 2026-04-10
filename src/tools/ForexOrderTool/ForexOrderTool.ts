/**
 * ForexOrderTool — Place forex/commodity orders via OANDA.
 * Routes to the forex vertical venue registered in VenueRegistry.
 * Instrument format: EUR_USD (underscore, not slash).
 */

import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import type { ExchangeInterface, Order } from '../../services/exchange/types.js'
import { runPreTradeGate } from '../_shared/runPreTradeGate.js'

const inputSchema = z.strictObject({
  symbol: z
    .string()
    .describe('Forex instrument, e.g. "EUR_USD", "XAU_USD", "GBP_JPY"'),
  side: z.enum(['buy', 'sell']).describe('Order side'),
  type: z
    .enum(['market', 'limit', 'stop_loss'])
    .describe('Order type'),
  quantity: z
    .number()
    .positive()
    .describe('Position size in units (100000 = 1 standard lot)'),
  price: z
    .number()
    .positive()
    .optional()
    .describe('Limit price (required for limit orders)'),
  stopPrice: z
    .number()
    .positive()
    .optional()
    .describe('Stop-loss price'),
})

type InputSchema = typeof inputSchema
type Output = string

function formatOrder(order: Order): string {
  const lines = [
    `Forex Order ${order.id}`,
    `  ${order.side.toUpperCase()} ${order.quantity} ${order.symbol} @ ${order.type}`,
    `  Status: ${order.status}`,
  ]
  if (order.avgFillPrice > 0) {
    lines.push(`  Fill price: ${order.avgFillPrice.toFixed(5)}`)
  }
  if (order.fee > 0) {
    lines.push(`  Commission: ${order.fee.toFixed(4)}`)
  }
  return lines.join('\n')
}

async function getForexExchange(): Promise<ExchangeInterface> {
  const { ensureForex } = await import(
    '../../services/exchange/venue-bootstrap.js'
  )
  return ensureForex()
}

export const ForexOrderTool = buildTool({
  name: 'PlaceForexOrder',
  searchHint: 'place a forex or commodity order via OANDA',
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
    return 'Place a forex or commodity order (EUR_USD, XAU_USD, etc.) via OANDA. Supports market, limit, and stop-loss orders.'
  },

  async prompt() {
    return [
      'Place a forex or commodity trading order via OANDA.',
      'Instruments use underscore format: EUR_USD, GBP_USD, XAU_USD (gold), XAG_USD (silver), BCO_USD (oil).',
      'Quantity is in units (100,000 = 1 standard lot, 10,000 = 1 mini lot).',
      'Requires OANDA_TOKEN and OANDA_ACCOUNT_ID environment variables.',
    ].join('\n')
  },

  toAutoClassifierInput(input) {
    return `forex ${input.side} ${input.quantity} ${input.symbol} ${input.type}`
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
    return `PlaceForexOrder: ${side} ${qty} ${sym}`
  },

  async call(input) {
    // SECURITY: fail-closed pre-trade gate. See _shared/runPreTradeGate.ts.
    // Forex-specific risk checks (correlation, carry cost, central bank
    // events) run inside the gate evaluator via the vertical-dispatcher.
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
      const exchange = await getForexExchange()

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
      const msg = error instanceof Error ? error.message : String(error)
      return { data: `Forex order error: ${msg}` }
    }
  },
} satisfies ToolDef<InputSchema, Output>)
