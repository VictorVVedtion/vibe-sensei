/**
 * OrderTool — Place trading orders via the exchange service.
 * Supports market, limit, and stop-loss orders in paper mode.
 * Detects position closures on sell fills and generates trade reports.
 */

import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import {
  InsufficientFundsError,
  InvalidSymbolError,
} from '../../services/exchange/index.js'
import { getConnectedExchange } from '../../services/exchange/singleton.js'
import type { ExchangeInterface, Order, Position } from '../../services/exchange/types.js'
import type { ClosedPositionInfo } from '../../buddy/trade-report.js'

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
    const exchange = await getConnectedExchange()

    // Snapshot positions before sell orders for close detection
    let prePositions: Position[] = []
    if (input.side === 'sell') {
      prePositions = await snapshotPositions(exchange)
    }

    try {
      const order = await exchange.placeOrder({
        symbol: input.symbol,
        side: input.side,
        type: input.type,
        quantity: input.quantity,
        price: input.price,
        stopPrice: input.stopPrice,
      })

      let result = formatOrder(order)

      // Detect position closure after sell fills
      if (input.side === 'sell' && order.status === 'filled') {
        const report = await detectAndReportClose(
          prePositions, order, exchange,
        )
        if (report) result += '\n\n' + report
      }

      // Check if this order ignores a recent guardian alert (fire-and-forget)
      checkIgnoredAlert(input.symbol, input.side).catch(() => {})

      return { data: result }
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

// ─── Position Close Detection ────────────────────────────────────────────────

async function snapshotPositions(
  exchange: ExchangeInterface,
): Promise<Position[]> {
  try {
    return await exchange.getPositions()
  } catch {
    return []
  }
}

/**
 * Detects if a sell order closed a position by comparing pre/post state.
 * Returns formatted trade report string, or null if no closure detected.
 */
async function detectAndReportClose(
  prePositions: Position[],
  order: Order,
  exchange: ExchangeInterface,
): Promise<string | null> {
  try {
    const postPositions = await exchange.getPositions()
    const closed = findClosedPosition(
      prePositions, postPositions, order.symbol,
    )
    if (!closed) return null

    const closedInfo: ClosedPositionInfo = {
      symbol: closed.symbol,
      side: closed.side,
      entryPrice: closed.entryPrice,
      quantity: order.filledQuantity,
      openedAtEstimate: estimateOpenTime(order),
    }

    const { generateTradeReport, formatTradeReport } = await import(
      '../../buddy/trade-report.js'
    )
    const report = await generateTradeReport(closedInfo, order, exchange)

    // Record to diary if available
    await recordToDiary(report)

    const { computeCumulativeStats } = await import('../../buddy/diary.js')
    const rollingStats = computeCumulativeStats()

    return formatTradeReport(report, rollingStats ?? undefined)
  } catch {
    return null
  }
}

/**
 * Finds a position that was closed (quantity went from >0 to 0 or absent).
 */
function findClosedPosition(
  pre: Position[],
  post: Position[],
  symbol: string,
): Position | null {
  const prePosn = pre.find(
    (p) => p.symbol === symbol && p.quantity > 0,
  )
  if (!prePosn) return null

  const postPosn = post.find((p) => p.symbol === symbol)
  if (!postPosn || postPosn.quantity <= 0) return prePosn

  return null
}

/**
 * Heuristic: estimate when the position was opened from order timestamps.
 * Uses session start as a rough lower bound.
 */
function estimateOpenTime(order: Order): number {
  // Use 4 hours before the exit as a rough estimate
  // This will be refined by the trade report's hold duration logic
  return order.createdAt.getTime() - 4 * 3_600_000
}

/**
 * Records a trade report to the guardian diary if available.
 * Failure is silently swallowed.
 */
async function recordToDiary(
  report: import('../../buddy/trade-report.js').TradeReport,
): Promise<void> {
  try {
    const { recordTradeReport } = await import('../../buddy/diary.js')
    recordTradeReport(report)
  } catch {
    // Diary integration is optional — never propagate
  }
}

/**
 * Check if the placed order ignores a recent guardian alert.
 * Dynamic import with try-catch — failure is silently swallowed.
 */
async function checkIgnoredAlert(
  symbol: string,
  side: string,
): Promise<void> {
  try {
    const { checkIfIgnored } = await import(
      '../../services/knowledge/counterfactual.js'
    )
    await checkIfIgnored(symbol, Date.now(), side)
  } catch {
    // Counterfactual tracking must never block trading
  }
}
