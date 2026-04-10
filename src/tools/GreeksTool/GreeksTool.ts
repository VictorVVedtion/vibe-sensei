/**
 * GreeksTool — Fetch and display option Greeks for a specific symbol
 * or aggregate portfolio Greeks across all open option positions.
 * Read-only. Uses VenueRegistry to resolve the crypto_options exchange.
 */

import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import type { Greeks, OptionsInterface, Position } from '../../services/exchange/types.js'

const inputSchema = z.strictObject({
  symbol: z
    .string()
    .optional()
    .describe(
      'Option symbol, e.g. "BTC-28JUN24-70000-C". Omit for portfolio Greeks.',
    ),
})

type InputSchema = typeof inputSchema
type Output = string

function formatGreeks(greeks: Greeks, label: string): string {
  return [
    `Greeks: ${label}`,
    '',
    `  Delta:  ${greeks.delta >= 0 ? '+' : ''}${greeks.delta.toFixed(4)}`,
    `  Gamma:  ${greeks.gamma.toFixed(6)}`,
    `  Theta:  ${greeks.theta.toFixed(4)}`,
    `  Vega:   ${greeks.vega.toFixed(4)}`,
    `  Rho:    ${greeks.rho.toFixed(4)}`,
  ].join('\n')
}

function formatPortfolioGreeks(
  greeks: Greeks,
  positionCount: number,
): string {
  return [
    `Portfolio Greeks (${positionCount} option positions)`,
    '',
    `  Net Delta:  ${greeks.delta >= 0 ? '+' : ''}${greeks.delta.toFixed(4)}`,
    `  Net Gamma:  ${greeks.gamma.toFixed(6)}`,
    `  Net Theta:  ${greeks.theta.toFixed(4)}`,
    `  Net Vega:   ${greeks.vega.toFixed(4)}`,
    `  Net Rho:    ${greeks.rho.toFixed(4)}`,
  ].join('\n')
}

async function getOptionsExchange(): Promise<OptionsInterface> {
  const { ensureOptions } = await import(
    '../../services/exchange/venue-bootstrap.js'
  )
  return ensureOptions()
}

async function aggregatePortfolioGreeks(
  exchange: OptionsInterface,
): Promise<{ greeks: Greeks; positionCount: number }> {
  const positions: Position[] = await exchange.getPositions()
  if (positions.length === 0) {
    return {
      greeks: { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 },
      positionCount: 0,
    }
  }

  const aggregate: Greeks = { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 }

  for (const pos of positions) {
    try {
      const g = await exchange.getGreeks(pos.symbol)
      const sign = pos.side === 'sell' ? -1 : 1
      const qty = pos.quantity
      aggregate.delta += g.delta * qty * sign
      aggregate.gamma += g.gamma * qty * sign
      aggregate.theta += g.theta * qty * sign
      aggregate.vega += g.vega * qty * sign
      aggregate.rho += g.rho * qty * sign
    } catch {
      // Skip positions where greeks are unavailable
    }
  }

  return { greeks: aggregate, positionCount: positions.length }
}

export const GreeksTool = buildTool({
  name: 'GetGreeks',
  searchHint: 'view option greeks delta gamma theta vega',
  maxResultSizeChars: 10_000,

  get inputSchema(): InputSchema {
    return inputSchema
  },

  isReadOnly() {
    return true
  },

  isDestructive() {
    return false
  },

  isConcurrencySafe() {
    return true
  },

  async description() {
    return 'Fetch option Greeks (delta, gamma, theta, vega, rho) for a specific option or the entire portfolio.'
  },

  async prompt() {
    return [
      'Fetch option Greeks for a specific symbol or aggregate portfolio Greeks.',
      'Optional: symbol (e.g. "BTC-28JUN24-70000-C").',
      'If symbol is omitted, aggregates Greeks across all open option positions.',
      'Returns delta, gamma, theta, vega, and rho.',
    ].join('\n')
  },

  toAutoClassifierInput(input) {
    return `greeks ${input.symbol ?? 'portfolio'}`
  },

  mapToolResultToToolResultBlockParam(content, toolUseID) {
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: String(content),
    }
  },

  renderToolUseMessage(input) {
    return `GetGreeks: ${input.symbol ?? 'portfolio'}`
  },

  async call(input) {
    try {
      const exchange = await getOptionsExchange()

      if (input.symbol) {
        const greeks = await exchange.getGreeks(input.symbol)
        return { data: formatGreeks(greeks, input.symbol) }
      }

      const { greeks, positionCount } =
        await aggregatePortfolioGreeks(exchange)
      if (positionCount === 0) {
        return { data: 'No open option positions. Portfolio Greeks are all zero.' }
      }
      return { data: formatPortfolioGreeks(greeks, positionCount) }
    } catch (error: unknown) {
      if (error instanceof Error) {
        return { data: `Greeks error: ${error.message}` }
      }
      throw error
    }
  },
} satisfies ToolDef<InputSchema, Output>)
