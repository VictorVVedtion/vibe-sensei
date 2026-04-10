/**
 * StockOrderTool — Place stock orders via Alpaca.
 * Gets exchange via getExchangeByVertical('stocks').
 * Includes market hours awareness in prompts.
 */

import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import {
  InsufficientFundsError,
  InvalidSymbolError,
} from '../../services/exchange/index.js'
import { ensureStocks } from '../../services/exchange/venue-bootstrap.js'
import type { ExchangeInterface, Order } from '../../services/exchange/types.js'
import { runPreTradeGate } from '../_shared/runPreTradeGate.js'

const inputSchema = z.strictObject({
  symbol: z
    .string()
    .describe('Stock ticker symbol, e.g. "AAPL", "TSLA", "MSFT" (not pairs like AAPL/USD)'),
  side: z
    .enum(['buy', 'sell'])
    .describe('Order side: buy or sell'),
  type: z
    .enum(['market', 'limit', 'stop_loss'])
    .describe('Order type'),
  quantity: z.number().positive().describe('Number of shares'),
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
    `Stock Order ${order.id}`,
    `  ${order.side.toUpperCase()} ${order.quantity} ${order.symbol} @ ${order.type}`,
    `  Status: ${order.status}`,
  ]
  if (order.avgFillPrice > 0) {
    lines.push(`  Fill price: $${order.avgFillPrice.toFixed(2)}`)
  }
  return lines.join('\n')
}

async function getStocksExchange(): Promise<ExchangeInterface> {
  return ensureStocks()
}

export const StockOrderTool = buildTool({
  name: 'PlaceStockOrder',
  searchHint: 'place a stock order buy sell shares equities AAPL TSLA',
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
    return 'Place a stock order (market, limit, or stop-loss) via Alpaca. Supports US equities.'
  },

  async prompt() {
    return [
      'Place a stock order via Alpaca.',
      'Requires: symbol (ticker like AAPL, not pairs), side (buy/sell), type, quantity.',
      'Limit orders require a price. Stop-loss orders require a stopPrice.',
      'Orders default to time_in_force: day.',
      '',
      'WARNING: US stock market hours are 9:30 AM - 4:00 PM ET (Mon-Fri).',
      'Orders placed outside market hours may be queued or rejected.',
      'Check market hours before placing time-sensitive orders.',
    ].join('\n')
  },

  toAutoClassifierInput(input) {
    return `stock ${input.side} ${input.quantity} ${input.symbol} ${input.type}`
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
    return `PlaceStockOrder: ${side} ${qty} ${sym}`
  },

  async call(input) {
    // SECURITY: fail-closed pre-trade gate. See _shared/runPreTradeGate.ts.
    // Stock-specific risk checks (PDT compliance, market hours, earnings
    // proximity) run inside the gate evaluator via the vertical-dispatcher.
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
      const exchange = await getStocksExchange()

      // Check market hours via Alpaca clock (fire-and-forget warning)
      const marketWarning = await getMarketHoursWarning(exchange)

      const order = await exchange.placeOrder({
        symbol: input.symbol,
        side: input.side,
        type: input.type,
        quantity: input.quantity,
        price: input.price,
        stopPrice: input.stopPrice,
      })

      let result = formatOrder(order)
      if (marketWarning) {
        result = `${marketWarning}\n\n${result}`
      }

      return { data: result }
    } catch (error: unknown) {
      if (error instanceof InsufficientFundsError) {
        return { data: `Insufficient buying power: ${error.message}` }
      }
      if (error instanceof InvalidSymbolError) {
        return { data: `Unknown stock symbol: ${error.message}` }
      }
      if (error instanceof Error) {
        return { data: `Stock order error: ${error.message}` }
      }
      throw error
    }
  },
} satisfies ToolDef<InputSchema, Output>)

// ── Market Hours Warning ───────────────────────────────────────────────────

async function getMarketHoursWarning(
  exchange: ExchangeInterface,
): Promise<string | null> {
  try {
    // AlpacaClient has getMarketClock; access via duck-typing
    const client = exchange as { getMarketClock?: () => Promise<{ isOpen: boolean }> }
    if (typeof client.getMarketClock !== 'function') return null

    const clock = await client.getMarketClock()
    if (!clock.isOpen) {
      return '** Market is currently CLOSED. Order will be queued for next session. **'
    }
    return null
  } catch {
    // Market hours check must never block order placement
    return null
  }
}
