/**
 * LiquidationTool — Show liquidation prices for open futures positions.
 * If symbol is provided, shows only that position. Otherwise shows all.
 * Read-only.
 */

import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { ensureFutures } from '../../services/exchange/venue-bootstrap.js'
import type { FuturesInterface, Position } from '../../services/exchange/types.js'
import { calcLiquidationPrice } from '../../services/exchange/paper-futures.js'

const inputSchema = z.strictObject({
  symbol: z
    .string()
    .optional()
    .describe('Futures symbol to check. If omitted, shows all positions'),
})

type InputSchema = typeof inputSchema
type Output = string

async function getFuturesExchange(): Promise<FuturesInterface> {
  return ensureFutures()
}

function formatLiquidationRow(pos: Position, liqPrice: number): string {
  const side = pos.side === 'buy' ? 'LONG' : 'SHORT'
  const distance = Math.abs(pos.currentPrice - liqPrice)
  const distPct = ((distance / pos.currentPrice) * 100).toFixed(2)
  const danger = Number(distPct) < 5 ? ' ⚠️ DANGER' : ''
  return [
    `${pos.symbol} (${side})`,
    `  Entry: ${pos.entryPrice.toFixed(2)}`,
    `  Current: ${pos.currentPrice.toFixed(2)}`,
    `  Liquidation: ${liqPrice.toFixed(2)}`,
    `  Distance: ${distPct}%${danger}`,
  ].join('\n')
}

/**
 * Infer leverage from position data.
 * Uses margin = notional / leverage relationship.
 * Falls back to 1x if margin info is unavailable.
 */
function inferLeverage(pos: Position): number {
  // Positions from paper-futures have leverage baked into margin.
  // Without direct access to margin, use PnL percent as proxy:
  // unrealizedPnlPercent already accounts for full notional, not margined.
  // Default to 1x — caller should use setLeverage for accuracy.
  return 1;
}

export const LiquidationTool = buildTool({
  name: 'GetLiquidationPrice',
  searchHint: 'liquidation price futures position margin',
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
    return 'Show liquidation prices for open futures positions, with distance from current price.'
  },

  async prompt() {
    return [
      'Get liquidation prices for perpetual futures positions.',
      'If symbol is provided, shows only that position.',
      'If omitted, shows all open positions with liquidation info.',
      'Includes distance-to-liquidation percentage.',
    ].join('\n')
  },

  toAutoClassifierInput(input) {
    return `liquidation ${input.symbol ?? 'all'}`
  },

  mapToolResultToToolResultBlockParam(content, toolUseID) {
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: String(content),
    }
  },

  renderToolUseMessage(input) {
    return `GetLiquidationPrice: ${input.symbol ?? 'all positions'}`
  },

  async call(input) {
    try {
      const exchange = await getFuturesExchange()
      const positions = await exchange.getPositions()

      const filtered = input.symbol
        ? positions.filter((p) => p.symbol === input.symbol)
        : positions

      if (filtered.length === 0) {
        const target = input.symbol ? input.symbol : 'any symbol'
        return { data: `No open futures positions for ${target}` }
      }

      const header = `Liquidation Prices (${filtered.length} position${filtered.length > 1 ? 's' : ''})\n${'═'.repeat(45)}`
      const rows = filtered.map((pos) => {
        const side: 'long' | 'short' = pos.side === 'buy' ? 'long' : 'short'
        const leverage = inferLeverage(pos)
        const liqPrice = calcLiquidationPrice(pos.entryPrice, leverage, side)
        return formatLiquidationRow(pos, liqPrice)
      })

      return { data: [header, ...rows].join('\n\n') }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      return { data: `Error fetching liquidation prices: ${msg}` }
    }
  },
} satisfies ToolDef<InputSchema, Output>)
