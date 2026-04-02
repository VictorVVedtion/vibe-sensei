/**
 * PositionTool — Query open positions with P&L information.
 * Optionally filters by symbol.
 */

import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { createExchange } from '../../services/exchange/index.js'
import type { Position } from '../../services/exchange/types.js'

const inputSchema = z.strictObject({
  symbol: z
    .string()
    .optional()
    .describe('Filter positions by symbol, e.g. "BTC/USDT". Omit for all.'),
})

type InputSchema = typeof inputSchema
type Output = string

function formatPnl(value: number): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}`
}

function formatPosition(pos: Position): string {
  const pnlColor = pos.unrealizedPnl >= 0 ? '+' : ''
  return [
    `${pos.symbol}  ${pos.side.toUpperCase()}  qty: ${pos.quantity}`,
    `  Entry: ${pos.entryPrice.toFixed(2)}  Current: ${pos.currentPrice.toFixed(2)}`,
    `  Unrealized P&L: ${formatPnl(pos.unrealizedPnl)} (${pnlColor}${pos.unrealizedPnlPercent.toFixed(2)}%)`,
    `  Realized P&L: ${formatPnl(pos.realizedPnl)}`,
  ].join('\n')
}

function formatPositionsTable(positions: Position[]): string {
  if (positions.length === 0) {
    return 'No open positions'
  }
  const header = `Open Positions (${positions.length})\n${'─'.repeat(50)}`
  const rows = positions.map(formatPosition)
  return [header, ...rows].join('\n\n')
}

export const PositionTool = buildTool({
  name: 'GetPositions',
  searchHint: 'query open trading positions and P&L',
  maxResultSizeChars: 50_000,

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
    return 'Query open trading positions with unrealized and realized P&L. Optionally filter by symbol.'
  },

  async prompt() {
    return [
      'Query open trading positions on the exchange.',
      'Optionally provide a symbol to filter (e.g. "BTC/USDT").',
      'Returns position details including entry price, current price, and P&L.',
    ].join('\n')
  },

  toAutoClassifierInput(input) {
    return input.symbol ? `positions ${input.symbol}` : 'positions'
  },

  mapToolResultToToolResultBlockParam(content, toolUseID) {
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: String(content),
    }
  },

  renderToolUseMessage(input) {
    const sym = input.symbol ?? 'all'
    return `GetPositions: ${sym}`
  },

  async call(input) {
    const exchange = createExchange({ mode: 'paper' })
    await exchange.connect()

    const allPositions = await exchange.getPositions()
    const filtered = input.symbol
      ? allPositions.filter((p) => p.symbol === input.symbol)
      : allPositions

    return { data: formatPositionsTable(filtered) }
  },
} satisfies ToolDef<InputSchema, Output>)
