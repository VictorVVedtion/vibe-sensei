/**
 * CandlestickChart — Terminal-native candlestick chart component for Ink/React.
 *
 * Renders OHLCV data as Unicode candlesticks directly in the terminal.
 * Uses the pure-function rendering engine in render-candles.ts and maps
 * its ChartSegment[] output to Ink <Text> elements for proper coloring.
 */

import React from 'react'
import { Box, Text } from '../../ink.js'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'
import { renderCandlestickChart } from './render-candles.js'
import type { Candle } from '../../services/exchange/types.js'

interface CandlestickChartProps {
  candles: Candle[]
  symbol: string
  timeframe: string
  showVolume?: boolean
}

export function CandlestickChart({
  candles,
  symbol,
  timeframe,
  showVolume = true,
}: CandlestickChartProps): React.ReactNode {
  const { columns, rows } = useTerminalSize()

  // Compute available chart space
  const chartHeight = Math.min(Math.max(rows - 10, 8), 20)
  const chartWidth = columns - 2 // 2 columns padding

  // Determine price decimal precision from symbol
  const priceDecimals = inferPriceDecimals(symbol, candles)

  const chartLines = renderCandlestickChart(candles, {
    width: chartWidth,
    height: chartHeight,
    showVolume,
    volumeHeight: 3,
    priceDecimals,
    symbol,
    timeframe,
  })

  return (
    <Box flexDirection="column" paddingX={1}>
      {chartLines.map((segments, lineIdx) => (
        <Text key={lineIdx}>
          {segments.map((segment, segIdx) => (
            <Text
              key={segIdx}
              color={segment.color}
              dimColor={segment.dim}
            >
              {segment.text}
            </Text>
          ))}
        </Text>
      ))}
    </Box>
  )
}

/**
 * Infer price decimal precision from symbol name and actual price values.
 */
function inferPriceDecimals(symbol: string, candles: Candle[]): number {
  // BTC pairs: integer prices
  if (symbol.includes('BTC') && !symbol.startsWith('BTC')) {
    return 8
  }
  if (symbol.startsWith('BTC')) {
    return 0
  }

  // For other pairs, check the magnitude of the price
  if (candles.length > 0) {
    const price = candles[candles.length - 1].close
    if (price >= 1000) return 0
    if (price >= 100) return 1
    if (price >= 1) return 2
    if (price >= 0.01) return 4
    return 6
  }

  return 2
}
