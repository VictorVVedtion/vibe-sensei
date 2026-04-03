/**
 * UI.tsx — Render functions for ChartTool.
 * Provides the tool-use message (input) and tool-result message (output)
 * renderers that integrate with the Ink message display system.
 */

import React from 'react'
import { Box, Text } from '../../ink.js'
import { CandlestickChart } from '../../components/CandlestickChart/CandlestickChart.js'
import type { ChartToolOutput } from './ChartTool.js'

export function renderToolUseMessage(
  input: Partial<{ symbol: string; timeframe?: string; limit?: number }>,
): React.ReactNode {
  if (!input.symbol) {
    return null
  }
  const tf = input.timeframe ?? '4h'
  const lim = input.limit ?? 50
  return `${input.symbol} ${tf} (${lim} candles)`
}

export function renderToolResultMessage(
  output: ChartToolOutput,
): React.ReactNode {
  if (!output.candles || output.candles.length === 0) {
    return (
      <Box>
        <Text color="yellow">No candle data available for {output.symbol}</Text>
      </Box>
    )
  }

  return (
    <CandlestickChart
      candles={output.candles}
      symbol={output.symbol}
      timeframe={output.timeframe}
    />
  )
}
