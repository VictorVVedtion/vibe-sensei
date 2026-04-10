/**
 * UI.tsx — Render functions for ChartTool.
 * Provides the tool-use message (input) and tool-result message (output)
 * renderers that integrate with the Ink message display system.
 *
 * LiveChart: periodically refreshes candle data with generation ID
 * protection, stale detection, and exponential backoff on failures.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Box, Text } from '../../ink.js'
import { CandlestickChart } from '../../components/CandlestickChart/CandlestickChart.js'
import { getConnectedExchange } from '../../services/exchange/singleton.js'
import type { ChartToolOutput } from './ChartTool.js'
import type { Candle } from '../../services/exchange/types.js'

// ── Generation ID: ensures only the latest LiveChart instance updates state ──
let currentGeneration = 0

// ── Constants ────────────────────────────────────────────────────────
const BASE_REFRESH_MS = 30_000     // 30s base refresh interval
const MAX_REFRESH_MS = 60_000      // 60s cap after backoff
const STALE_THRESHOLD = 3          // consecutive fails before showing stale warning

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
        <Text color="yellow">No candle data for {output.symbol}</Text>
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

// ── LiveChart: auto-refreshing wrapper around CandlestickChart ───────

interface LiveChartProps {
  initialCandles: Candle[]
  symbol: string
  timeframe: string
  limit: number
}

function LiveChart({
  initialCandles,
  symbol,
  timeframe,
  limit,
}: LiveChartProps): React.ReactNode {
  const [candles, setCandles] = useState<Candle[]>(initialCandles)
  const [consecutiveFails, setConsecutiveFails] = useState(0)

  // Generation ID for this instance — only the latest mount updates state
  const genRef = useRef(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const currentIntervalMs = useRef(BASE_REFRESH_MS)

  // Refresh callback with generation guard
  const refresh = useCallback(async (myGen: number) => {
    if (myGen !== currentGeneration) return
    try {
      const exchange = await getConnectedExchange()
      const fresh = await exchange.getCandles(symbol, timeframe, limit)
      // Guard: only update if this instance is still the active generation
      if (myGen !== currentGeneration) return
      if (fresh.length > 0) {
        setCandles(fresh)
        // Only reset fails on actual data received
        setConsecutiveFails(0)
      }
      // Empty response: don't reset fails — exchange may be returning empty for delisted/auth issues
      if (currentIntervalMs.current !== BASE_REFRESH_MS) {
        currentIntervalMs.current = BASE_REFRESH_MS
        resetInterval(myGen)
      }
    } catch {
      if (myGen !== currentGeneration) return
      setConsecutiveFails(prev => prev + 1)
      // Exponential backoff: 1x, 2x, 4x, capped at MAX_REFRESH_MS
      const next = Math.min(currentIntervalMs.current * 2, MAX_REFRESH_MS)
      if (next !== currentIntervalMs.current) {
        currentIntervalMs.current = next
        resetInterval(myGen)
      }
    }
  }, [symbol, timeframe, limit])

  // Reset interval with new timing
  const resetInterval = useCallback((myGen: number) => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
    }
    if (myGen !== currentGeneration) return
    intervalRef.current = setInterval(() => void refresh(myGen), currentIntervalMs.current)
  }, [refresh])

  // Mount: claim generation, start refresh loop
  useEffect(() => {
    ++currentGeneration
    const myGen = currentGeneration
    genRef.current = myGen
    currentIntervalMs.current = BASE_REFRESH_MS

    intervalRef.current = setInterval(() => void refresh(myGen), BASE_REFRESH_MS)

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [refresh])

  // Empty state guard
  if (candles.length === 0) {
    return (
      <Box>
        <Text color="yellow">No candle data for {symbol}</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      {consecutiveFails >= STALE_THRESHOLD && (
        <Text dimColor color="yellow">
          {'⚠ stale data'}
        </Text>
      )}
      <CandlestickChart
        candles={candles}
        symbol={symbol}
        timeframe={timeframe}
      />
    </Box>
  )
}
