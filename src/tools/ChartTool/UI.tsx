/**
 * UI.tsx — Render functions for ChartTool.
 * Provides the tool-use message (input) and tool-result message (output)
 * renderers that integrate with the Ink message display system.
 * Includes live auto-refresh: polls for fresh candle data at an interval
 * determined by the timeframe, so the chart updates in real-time.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { Box, Text } from '../../ink.js'
import { CandlestickChart } from '../../components/CandlestickChart/CandlestickChart.js'
import { getConnectedExchange } from '../../services/exchange/singleton.js'
import type { Candle } from '../../services/exchange/types.js'
import type { ChartToolOutput } from './ChartTool.js'

/** Refresh interval (ms) based on timeframe — faster for shorter candles. */
function refreshMs(tf: string): number {
  switch (tf) {
    case '1m':  return 5_000
    case '5m':  return 10_000
    case '15m': return 15_000
    case '1h':  return 30_000
    case '4h':  return 30_000
    case '1d':  return 60_000
    default:    return 30_000
  }
}

/** Live-updating chart wrapper. */
function LiveChart({
  initialCandles,
  symbol,
  timeframe,
  limit,
}: {
  initialCandles: Candle[]
  symbol: string
  timeframe: string
  limit: number
}) {
  const [candles, setCandles] = useState(initialCandles)

  const refresh = useCallback(async () => {
    try {
      const exchange = await getConnectedExchange()
      const fresh = await exchange.getCandles(symbol, timeframe, limit)
      if (fresh.length > 0) setCandles(fresh)
    } catch {
      // silently keep last known data
    }
  }, [symbol, timeframe, limit])

  useEffect(() => {
    const id = setInterval(refresh, refreshMs(timeframe))
    return () => clearInterval(id)
  }, [refresh, timeframe])

  return (
    <CandlestickChart
      candles={candles}
      symbol={symbol}
      timeframe={timeframe}
    />
  )
}

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
    <LiveChart
      initialCandles={output.candles}
      symbol={output.symbol}
      timeframe={output.timeframe}
      limit={output.candleCount}
    />
  )
}
