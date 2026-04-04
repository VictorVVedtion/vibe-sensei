/**
 * CandlestickChart — Interactive terminal-native candlestick chart for Ink/React.
 *
 * Renders OHLCV data as Unicode candlesticks directly in the terminal.
 * Supports mouse interaction:
 *   - Click to place crosshair (vertical + horizontal lines)
 *   - Scroll wheel to zoom in/out
 *   - Arrow keys to pan left/right and move crosshair (when focused)
 *   - Live OHLC info bar below chart updates on hover
 *
 * Uses the pure-function rendering engine in render-candles.ts and maps
 * its ChartSegment[] output to Ink <Text> elements for proper coloring.
 *
 * Focus model: the chart Box has tabIndex={0}. Clicking the chart gives
 * it focus (via Ink's click-to-focus). While focused, arrow keys move
 * the crosshair or pan the view, and Escape dismisses the crosshair.
 * Wheel events always zoom regardless of focus (they don't produce text).
 */

import React, { useState, useCallback, useRef } from 'react'
import { Box, Text, useInput, type ClickEvent } from '../../ink.js'
import type { KeyboardEvent } from '../../ink/events/keyboard-event.js'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'
import { renderCandlestickChart, type RenderResult } from './render-candles.js'
import type { CrosshairState, ChartLayout } from './types.js'
import type { Candle } from '../../services/exchange/types.js'

// ── Constants ──────────────────────────────────────────────────────

/** Minimum number of candles that can be shown when fully zoomed in */
const MIN_VISIBLE_CANDLES = 10
/** Zoom step: number of candles added/removed per scroll tick */
const ZOOM_STEP = 4
/** Pan step: number of candles shifted per arrow key press */
const PAN_STEP = 3

// ── Props ──────────────────────────────────────────────────────────

interface CandlestickChartProps {
  candles: Candle[]
  symbol: string
  timeframe: string
  showVolume?: boolean
}

// ── Component ──────────────────────────────────────────────────────

export function CandlestickChart({
  candles,
  symbol,
  timeframe,
  showVolume = true,
}: CandlestickChartProps): React.ReactNode {
  const { columns, rows } = useTerminalSize()

  // ── Interactive state ────────────────────────────────────────
  const [crosshair, setCrosshair] = useState<CrosshairState>({
    col: -1,
    row: -1,
    active: false,
  })
  const [visibleStart, setVisibleStart] = useState(-1)
  const [visibleEnd, setVisibleEnd] = useState(-1)
  const [isFocused, setIsFocused] = useState(false)

  // Ref to hold the latest layout for coordinate mapping
  const layoutRef = useRef<ChartLayout | null>(null)

  // ── Chart dimensions ─────────────────────────────────────────
  const chartHeight = Math.min(Math.max(rows - 10, 8), 20)
  const chartWidth = columns - 6 // leave margin for REPL message indentation

  const priceDecimals = inferPriceDecimals(symbol, candles)

  // ── Compute max candles that fit ─────────────────────────────
  const colWidth = 2  // 2 columns per candle (body + gap), matches render-candles.ts COL_WIDTH
  const samplePrice = candles.length > 0 ? candles[0].close : 100
  const labelWidth = Math.max(samplePrice.toFixed(priceDecimals).length, 6)
  const rightAxisWidth = 1 + 1 + labelWidth
  const leftBorderWidth = 1
  const chartAreaWidth = chartWidth - leftBorderWidth - rightAxisWidth - 1
  const maxCandles = Math.max(1, Math.floor(chartAreaWidth / colWidth))

  // ── Determine visible range ──────────────────────────────────
  let rangeParam: { start: number; end: number } | undefined

  if (visibleStart >= 0 && visibleEnd > visibleStart) {
    rangeParam = { start: visibleStart, end: visibleEnd }
  }

  // ── Render the chart ─────────────────────────────────────────
  const result: RenderResult = renderCandlestickChart(
    candles,
    {
      width: chartWidth,
      height: chartHeight,
      showVolume,
      volumeHeight: 3,
      priceDecimals,
      symbol,
      timeframe,
    },
    crosshair,
    rangeParam,
  )

  const { lines: chartLines, layout, visibleCandles } = result
  layoutRef.current = layout

  // ── Zoom handler ─────────────────────────────────────────────
  const handleZoom = useCallback((direction: 'in' | 'out') => {
    const total = candles.length
    if (total === 0) return

    let curStart: number
    let curEnd: number
    if (visibleStart >= 0 && visibleEnd > visibleStart) {
      curStart = visibleStart
      curEnd = visibleEnd
    } else {
      curEnd = total
      curStart = Math.max(0, total - maxCandles)
    }

    const curVisible = curEnd - curStart
    let newVisible: number

    if (direction === 'in') {
      newVisible = Math.max(MIN_VISIBLE_CANDLES, curVisible - ZOOM_STEP)
    } else {
      newVisible = Math.min(total, curVisible + ZOOM_STEP)
    }

    if (newVisible === curVisible) return

    const center = Math.floor((curStart + curEnd) / 2)
    let newStart = Math.floor(center - newVisible / 2)
    let newEnd = newStart + newVisible

    if (newStart < 0) {
      newStart = 0
      newEnd = Math.min(total, newVisible)
    }
    if (newEnd > total) {
      newEnd = total
      newStart = Math.max(0, total - newVisible)
    }

    setVisibleStart(newStart)
    setVisibleEnd(newEnd)
  }, [candles.length, visibleStart, visibleEnd, maxCandles])

  // ── Pan handler ──────────────────────────────────────────────
  const handlePan = useCallback((direction: 'left' | 'right') => {
    const total = candles.length
    if (total === 0) return

    let curStart: number
    let curEnd: number
    if (visibleStart >= 0 && visibleEnd > visibleStart) {
      curStart = visibleStart
      curEnd = visibleEnd
    } else {
      curEnd = total
      curStart = Math.max(0, total - maxCandles)
    }

    const shift = direction === 'left' ? -PAN_STEP : PAN_STEP
    let newStart = curStart + shift
    let newEnd = curEnd + shift
    const span = curEnd - curStart

    if (newStart < 0) {
      newStart = 0
      newEnd = span
    }
    if (newEnd > total) {
      newEnd = total
      newStart = Math.max(0, total - span)
    }

    setVisibleStart(newStart)
    setVisibleEnd(newEnd)
  }, [candles.length, visibleStart, visibleEnd, maxCandles])

  // ── useInput: wheel zoom (always active, non-conflicting) ────
  useInput((_input, key) => {
    if (key.wheelUp) {
      handleZoom('in')
    } else if (key.wheelDown) {
      handleZoom('out')
    }
  })

  // ── onKeyDown: focus-scoped keyboard interaction ─────────────
  // Only fires when the chart Box has focus (after clicking it).
  // Uses Ink's DOM event dispatch, not the global useInput system.
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const lay = layoutRef.current
    if (!lay) return

    if (event.key === 'left') {
      event.preventDefault()
      if (crosshair.active && !event.shift) {
        setCrosshair(prev => ({
          ...prev,
          col: Math.max(0, prev.col - 1),
        }))
      } else {
        handlePan('left')
      }
      return
    }
    if (event.key === 'right') {
      event.preventDefault()
      if (crosshair.active && !event.shift) {
        const maxCol = lay.visibleCandleCount * lay.colWidth - 1
        setCrosshair(prev => ({
          ...prev,
          col: Math.min(maxCol, prev.col + 1),
        }))
      } else {
        handlePan('right')
      }
      return
    }
    if (event.key === 'up' && crosshair.active) {
      event.preventDefault()
      setCrosshair(prev => ({
        ...prev,
        row: Math.max(0, prev.row - 1),
      }))
      return
    }
    if (event.key === 'down' && crosshair.active) {
      event.preventDefault()
      setCrosshair(prev => ({
        ...prev,
        row: Math.min(lay.chartHeight - 1, prev.row + 1),
      }))
      return
    }

    if (event.key === 'escape') {
      if (crosshair.active) {
        event.preventDefault()
        setCrosshair({ col: -1, row: -1, active: false })
      }
      return
    }

    if (event.key === 'r' && !event.ctrl && !event.meta) {
      event.preventDefault()
      setVisibleStart(-1)
      setVisibleEnd(-1)
      setCrosshair({ col: -1, row: -1, active: false })
      return
    }
  }, [crosshair.active, handlePan])

  // ── Click handler: set crosshair position ────────────────────
  const handleClick = useCallback((event: ClickEvent) => {
    const lay = layoutRef.current
    if (!lay) return

    const chartCol = event.localCol - lay.leftBorderWidth
    const chartRow = event.localRow - lay.headerLines

    if (chartCol < 0 || chartCol >= lay.visibleCandleCount * lay.colWidth) return
    if (chartRow < 0 || chartRow >= lay.chartHeight) return

    setCrosshair({
      col: chartCol,
      row: chartRow,
      active: true,
    })
  }, [])

  // ── Focus handlers ───────────────────────────────────────────
  const handleFocus = useCallback(() => setIsFocused(true), [])
  const handleBlur = useCallback(() => setIsFocused(false), [])

  // ── Build OHLC info bar ──────────────────────────────────────
  const infoCandle = getInfoCandle(crosshair, layout, visibleCandles)
  const infoBar = buildInfoBar(infoCandle, symbol, timeframe, priceDecimals)

  // ── Focus hint ───────────────────────────────────────────────
  const focusHint = isFocused
    ? '  [arrows: move | shift+arrows: pan | scroll: zoom | r: reset | esc: clear]'
    : '  [click chart to interact]'

  // ── Render ───────────────────────────────────────────────────
  return (
    <Box
      flexDirection="column"
      paddingX={1}
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
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
      <Text>
        <Text>{infoBar}</Text>
        <Text color="gray" dimColor>{focusHint}</Text>
      </Text>
    </Box>
  )
}

// ── Helper: determine which candle to show in the info bar ──────

function getInfoCandle(
  crosshair: CrosshairState,
  layout: ChartLayout,
  visibleCandles: Candle[],
): Candle | null {
  if (!crosshair.active || visibleCandles.length === 0) {
    return visibleCandles.length > 0
      ? visibleCandles[visibleCandles.length - 1]
      : null
  }
  const idx = Math.floor(crosshair.col / layout.colWidth)
  if (idx >= 0 && idx < visibleCandles.length) {
    return visibleCandles[idx]
  }
  return visibleCandles[visibleCandles.length - 1]
}

// ── Helper: build the OHLC info bar string ──────────────────────

function buildInfoBar(
  candle: Candle | null,
  symbol: string,
  timeframe: string,
  priceDecimals: number,
): string {
  if (!candle) return ''

  const d = priceDecimals
  const o = candle.open.toFixed(d)
  const h = candle.high.toFixed(d)
  const l = candle.low.toFixed(d)
  const c = candle.close.toFixed(d)

  const vol = formatVolume(candle.volume)

  const pctChange = candle.open !== 0
    ? ((candle.close - candle.open) / candle.open) * 100
    : 0
  const sign = pctChange >= 0 ? '+' : ''
  const arrow = pctChange >= 0 ? '^' : 'v'

  const ts = new Date(candle.timestamp)
  const dateStr = `${(ts.getUTCMonth() + 1).toString().padStart(2, '0')}/${ts.getUTCDate().toString().padStart(2, '0')} ${ts.getUTCHours().toString().padStart(2, '0')}:${ts.getUTCMinutes().toString().padStart(2, '0')} UTC`

  return `${symbol} ${timeframe.toUpperCase()} | ${dateStr} | O ${o} H ${h} L ${l} C ${c} | Vol ${vol} | ${arrow} ${sign}${pctChange.toFixed(2)}%`
}

// ── Helper: compact volume formatting ───────────────────────────

function formatVolume(vol: number): string {
  if (vol >= 1_000_000_000) return (vol / 1_000_000_000).toFixed(1) + 'B'
  if (vol >= 1_000_000) return (vol / 1_000_000).toFixed(1) + 'M'
  if (vol >= 1_000) return (vol / 1_000).toFixed(1) + 'K'
  return vol.toFixed(0)
}

// ── Helper: infer price decimal precision ───────────────────────

function inferPriceDecimals(symbol: string, candles: Candle[]): number {
  if (symbol.includes('BTC') && !symbol.startsWith('BTC')) {
    return 8
  }
  if (symbol.startsWith('BTC')) {
    return 0
  }

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
