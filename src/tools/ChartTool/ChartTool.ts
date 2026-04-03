/**
 * ChartTool — Display terminal-native candlestick charts.
 * Fetches OHLCV data via the exchange singleton and returns structured
 * data that the UI component renders as Unicode candles in the terminal.
 */

import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { getConnectedExchange } from '../../services/exchange/singleton.js'
import type { Candle } from '../../services/exchange/types.js'
import { renderToolResultMessage, renderToolUseMessage } from './UI.js'

const inputSchema = z.strictObject({
  symbol: z
    .string()
    .describe('Trading pair, e.g. "BTC/USDT"'),
  timeframe: z
    .enum(['1m', '5m', '15m', '1h', '4h', '1d'])
    .optional()
    .describe('Chart timeframe (default "4h")'),
  limit: z
    .number()
    .optional()
    .describe('Number of candles to display (default 50)'),
})

type InputSchema = typeof inputSchema

export interface ChartToolOutput {
  candles: Candle[]
  symbol: string
  timeframe: string
  candleCount: number
}

type Output = ChartToolOutput

export const ChartTool = buildTool({
  name: 'ShowChart',
  searchHint: 'display candlestick price chart OHLCV terminal',
  maxResultSizeChars: 100_000,

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
    return 'Display a candlestick chart in the terminal for a trading pair.'
  },

  async prompt() {
    return [
      'Display a candlestick chart in the terminal.',
      'Provide a symbol (e.g. "BTC/USDT"), optional timeframe (1m, 5m, 15m, 1h, 4h, 1d), and optional candle count.',
      'The chart renders directly in the terminal with Unicode characters.',
      'Shows price candles (green=bullish, red=bearish), volume bars, price scale, and time axis.',
    ].join('\n')
  },

  toAutoClassifierInput(input) {
    return input.symbol ? `chart ${input.symbol}` : 'chart'
  },

  mapToolResultToToolResultBlockParam(content, toolUseID) {
    // Send a compact text summary to the model, not the visual chart
    const out = content as Output
    const last = out.candles[out.candles.length - 1]
    let summary = `[Chart displayed: ${out.symbol} ${out.timeframe} — ${out.candleCount} candles]`
    if (last) {
      const pct = last.open !== 0
        ? ((last.close - last.open) / last.open * 100).toFixed(2)
        : '0.00'
      const sign = Number(pct) >= 0 ? '+' : ''
      summary += `\nLatest: O:${last.open} H:${last.high} L:${last.low} C:${last.close} (${sign}${pct}%)`
    }
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: summary,
    }
  },

  renderToolUseMessage,
  renderToolResultMessage,

  async call(input) {
    try {
      const exchange = await getConnectedExchange()
      const timeframe = input.timeframe ?? '4h'
      const limit = input.limit ?? 50

      const candles = await exchange.getCandles(input.symbol, timeframe, limit)

      return {
        data: {
          candles,
          symbol: input.symbol,
          timeframe,
          candleCount: candles.length,
        } satisfies Output,
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[ChartTool] Error fetching chart: ${msg}`)
      return { data: `Error fetching chart: ${msg}` as unknown as Output }
    }
  },
} satisfies ToolDef<InputSchema, Output>)
