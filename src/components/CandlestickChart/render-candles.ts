/**
 * render-candles.ts — ASCII line chart renderer with per-segment coloring.
 *
 * Draws close prices as a smooth curve using box-drawing characters (╭╮╰╯─│).
 * Each data point occupies 1 terminal column, enabling ~70 points at 80 cols.
 * Green segments for rising prices, red for falling.
 * Dim vertical lines show the high-low range behind the close price line.
 *
 * Deep-sea Cthulhu theme: green (up) / red (down), right-side Y-axis,
 * current price indicator, volume bars below chart.
 */

import type { Candle } from '../../services/exchange/types.js'
import type { ChartLine, ChartSegment, ChartOptions, CrosshairState, ChartLayout } from './types.js'
import { DEFAULT_CHART_OPTIONS, CHART_COLORS } from './types.js'

/** Result of the render function — chart lines plus layout metadata. */
export interface RenderResult {
  lines: ChartLine[]
  layout: ChartLayout
  visibleCandles: Candle[]
}

// ── Candlestick characters ────────────────────────────────────────

const CH_BODY = '\u2588'     // █  full block for body
const CH_WICK = '\u2502'     // │  box drawings light vertical (wick)
const CH_DOJI = '\u2500'     // ─  box drawings light horizontal (doji)


// Crosshair
const CH_CROSS_V = '\u2502'  // │
const CH_CROSS_H = '\u2500'  // ─
const CH_CROSS_X = '\u253C'  // ┼

// Axis & border
const AXIS_TEE   = '\u2524'  // ┤
const AXIS_LINE  = '\u2502'  // │
const BORDER_H   = '\u2500'  // ─
const BORDER_BR  = '\u2518'  // ┘
const TICK_UP    = '\u2534'  // ┴
const PRICE_DASH = '\u2504'  // ┄
const PRICE_ARROW = '\u25B6' // ▶

// Volume
const VOLUME_BLOCKS = [' ', '\u2581', '\u2582', '\u2583', '\u2584', '\u2585', '\u2586', '\u2587', '\u2588']

// ── Terminal columns per data point ───────────────────────────────

const COL_WIDTH = 2

// ── Nice number rounding ──────────────────────────────────────────

function niceStep(range: number, targetTicks: number): number {
  const rough = range / targetTicks
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)))
  const residual = rough / magnitude
  let nice: number
  if (residual <= 1.5) nice = 1
  else if (residual <= 3) nice = 2
  else if (residual <= 7) nice = 5
  else nice = 10
  return nice * magnitude
}

function niceMin(val: number, step: number): number {
  return Math.floor(val / step) * step
}

function niceMax(val: number, step: number): number {
  return Math.ceil(val / step) * step
}

// ── Segment helpers ───────────────────────────────────────────────

function seg(text: string, color?: ChartSegment['color'], dim?: boolean): ChartSegment {
  return dim ? { text, color, dim } : color ? { text, color } : { text }
}

function dimSeg(text: string): ChartSegment {
  return { text, color: 'gray', dim: true }
}

function formatPrice(price: number, decimals: number, labelWidth: number): string {
  return price.toFixed(decimals).padStart(labelWidth)
}

// ── Cell grid ─────────────────────────────────────────────────────

type CellColor = ChartSegment['color']
interface Cell { char: string; color?: CellColor; dim?: boolean }

function emptyGrid(rows: number, cols: number): Cell[][] {
  const grid: Cell[][] = []
  for (let r = 0; r < rows; r++) {
    const row: Cell[] = []
    for (let c = 0; c < cols; c++) row.push({ char: ' ' })
    grid.push(row)
  }
  return grid
}

// ── Price-to-row mapping ──────────────────────────────────────────

function makePriceMapper(priceMax: number, priceRange: number, chartHeight: number) {
  return (price: number): number => {
    const ratio = (priceMax - price) / priceRange
    return Math.round(ratio * (chartHeight - 1))
  }
}

// ── Draw Candlesticks (Wick + Body) ───────────────────────────────

function drawCandles(
  grid: Cell[][],
  candles: Candle[],
  priceToRow: (p: number) => number,
): void {
  for (let col = 0; col < candles.length; col++) {
    const c = candles[col]
    
    // Determine color based on open vs close
    const isBullish = c.close >= c.open
    const color: CellColor = isBullish ? CHART_COLORS.bullish : CHART_COLORS.bearish

    const highRow = priceToRow(c.high)
    const lowRow = priceToRow(c.low)
    const openRow = priceToRow(c.open)
    const closeRow = priceToRow(c.close)

    const bodyTop = Math.min(openRow, closeRow)
    const bodyBottom = Math.max(openRow, closeRow)

    const isDoji = bodyTop === bodyBottom

    // Loop through the entire vertical range of this candle
    // Note: lower row number = higher on screen
    for (let r = highRow; r <= lowRow; r++) {
      if (!grid[r] || !grid[r][col]) continue

      // In the body?
      if (r >= bodyTop && r <= bodyBottom) {
        if (isDoji) {
          grid[r][col * COL_WIDTH] = { char: CH_DOJI, color }
        } else {
          grid[r][col * COL_WIDTH] = { char: CH_BODY, color }
        }
      } 
      // In the wick?
      else {
        grid[r][col * COL_WIDTH] = { char: CH_WICK, color, dim: true } // Dimming wicks slightly
      }
    }
  }
}


// ── Draw current price indicator ──────────────────────────────────

function drawPriceLine(
  grid: Cell[][],
  priceRow: number,
  width: number,
): void {
  if (priceRow < 0 || priceRow >= grid.length) return
  for (let c = 0; c < width; c++) {
    if (grid[priceRow][c] && grid[priceRow][c].char === ' ') {
      grid[priceRow][c] = { char: PRICE_DASH, color: CHART_COLORS.priceLine }
    }
  }
}

// ── Draw crosshair ────────────────────────────────────────────────

function drawCrosshair(
  grid: Cell[][],
  col: number,
  row: number,
  chartHeight: number,
  chartWidth: number,
): void {
  const gridCol = col * COL_WIDTH
  // Vertical line
  if (gridCol >= 0 && gridCol < chartWidth) {
    for (let r = 0; r < chartHeight; r++) {
      if (r === row) continue
      if (grid[r] && grid[r][gridCol] && grid[r][gridCol].char === ' ') {
        grid[r][gridCol] = { char: CH_CROSS_V, color: CHART_COLORS.crosshair, dim: true }
      }
    }
  }
  // Horizontal line
  if (row >= 0 && row < chartHeight) {
    for (let c = 0; c < chartWidth; c++) {
      if (c === col) continue
      if (grid[row] && grid[row][c] && grid[row][c].char === ' ') {
        grid[row][c] = { char: CH_CROSS_H, color: CHART_COLORS.crosshair, dim: true }
      }
    }
  }
  // Intersection
  if (gridCol >= 0 && gridCol < chartWidth && row >= 0 && row < chartHeight && grid[row] && grid[row][gridCol]) {
    grid[row][gridCol] = { char: CH_CROSS_X, color: CHART_COLORS.crosshair }
  }
}

// ── Grid → ChartLine[] ───────────────────────────────────────────

function gridToSegments(row: Cell[]): ChartSegment[] {
  const segs: ChartSegment[] = []
  let runText = ''
  let runColor: CellColor | undefined
  let runDim: boolean | undefined

  for (const cell of row) {
    if (cell.color === runColor && cell.dim === runDim) {
      runText += cell.char
    } else {
      if (runText) segs.push(seg(runText, runColor, runDim))
      runText = cell.char
      runColor = cell.color
      runDim = cell.dim
    }
  }
  if (runText) segs.push(seg(runText, runColor, runDim))
  return segs
}

// ── Main rendering function ───────────────────────────────────────

export function renderCandlestickChart(
  candles: Candle[],
  partialOpts: Partial<ChartOptions> & Pick<ChartOptions, 'width' | 'symbol' | 'timeframe'>,
  crosshair?: CrosshairState,
  visibleRange?: { start: number; end: number },
): RenderResult {
  const opts: ChartOptions = {
    height: partialOpts.height ?? (DEFAULT_CHART_OPTIONS.height as number),
    showVolume: partialOpts.showVolume ?? (DEFAULT_CHART_OPTIONS.showVolume as boolean),
    volumeHeight: partialOpts.volumeHeight ?? (DEFAULT_CHART_OPTIONS.volumeHeight as number),
    priceDecimals: partialOpts.priceDecimals ?? (DEFAULT_CHART_OPTIONS.priceDecimals as number),
    width: partialOpts.width,
    symbol: partialOpts.symbol,
    timeframe: partialOpts.timeframe,
  }

  if (candles.length === 0) {
    const emptyLayout: ChartLayout = {
      leftBorderWidth: 0, rightAxisWidth: 8, chartHeight: opts.height,
      chartAreaWidth: opts.width - 10, colWidth: COL_WIDTH, visibleCandleCount: 0,
      priceMax: 0, priceMin: 0, priceRange: 0, headerLines: 1,
      priceDecimals: opts.priceDecimals,
    }
    return {
      lines: [[seg(`  No candle data for ${opts.symbol}`, 'gray')]],
      layout: emptyLayout,
      visibleCandles: [],
    }
  }

  // ── Layout ────────────────────────────────────────────────
  const colWidth = COL_WIDTH
  const samplePrice = candles[0].close
  const labelWidth = Math.max(samplePrice.toFixed(opts.priceDecimals).length, 6)
  const rightAxisWidth = 1 + 1 + labelWidth
  const leftBorderWidth = 0
  const chartAreaWidth = opts.width - leftBorderWidth - rightAxisWidth - 1
  const maxCandles = Math.max(1, Math.floor(chartAreaWidth / colWidth))

  // ── Visible range ─────────────────────────────────────────
  let visibleCandles: Candle[]
  if (visibleRange) {
    const start = Math.max(0, visibleRange.start)
    const end = Math.min(candles.length, visibleRange.end)
    visibleCandles = candles.slice(start, end)
  } else {
    visibleCandles = candles.slice(-maxCandles)
  }

  const candleCount = visibleCandles.length
  const innerWidth = Math.max(candleCount * colWidth, chartAreaWidth)
  const chartHeight = opts.height

  // ── Price range (use high/low for full range) ─────────────
  let rawMin = Infinity
  let rawMax = -Infinity
  for (const c of visibleCandles) {
    if (c.low < rawMin) rawMin = c.low
    if (c.high > rawMax) rawMax = c.high
  }
  const rawRange = rawMax - rawMin
  const padding = rawRange * 0.05 || rawMax * 0.01 || 1
  const step = niceStep(rawRange + padding * 2, opts.height)
  const priceMin = niceMin(rawMin - padding, step)
  const priceMax = niceMax(rawMax + padding, step)
  const priceRange = priceMax - priceMin || 1

  const priceToRow = makePriceMapper(priceMax, priceRange, chartHeight)

  // ── Build chart grid ──────────────────────────────────────
  const grid = emptyGrid(chartHeight, candleCount * colWidth)

  // Only element: candlesticks (body ┃ + wick │) — no price dash noise
  drawCandles(grid, visibleCandles, priceToRow)

  const lastCandle = visibleCandles[candleCount - 1]
  const currentPriceRow = priceToRow(lastCandle.close)

  // Layer 4: Crosshair
  if (crosshair && crosshair.active) {
    drawCrosshair(grid, crosshair.col, crosshair.row, chartHeight, candleCount * colWidth)
  }

  // ── Assemble output lines ─────────────────────────────────
  const lines: ChartLine[] = []

  // Title line
  const hoveredIdx = crosshair && crosshair.active
    ? Math.min(crosshair.col, candleCount - 1)
    : -1
  const titleCandle = (hoveredIdx >= 0 && hoveredIdx < candleCount)
    ? visibleCandles[hoveredIdx]
    : lastCandle
  lines.push(buildTitleLine(titleCandle, opts))

  // Chart rows with right-side Y-axis
  for (let row = 0; row < chartHeight; row++) {
    const line: ChartLine = gridToSegments(grid[row])
    const price = priceMax - (row / (chartHeight - 1)) * priceRange
    const label = formatPrice(price, opts.priceDecimals, labelWidth)

    // Pad to full width (clean spaces, no dash noise)
    const usedCols = candleCount * colWidth
    if (usedCols < innerWidth) {
      line.push(seg(' '.repeat(innerWidth - usedCols)))
    }

    // Right axis
    const isCrosshairRow = crosshair && crosshair.active && row === crosshair.row
    if (row === currentPriceRow) {
      line.push(seg(PRICE_ARROW, CHART_COLORS.priceLine))
      line.push(seg(' ' + label, CHART_COLORS.priceLine))
    } else if (isCrosshairRow) {
      line.push(seg(BORDER_H, CHART_COLORS.crosshair, true))
      line.push(seg(' ' + label, CHART_COLORS.crosshair))
    } else {
      line.push(dimSeg(AXIS_LINE + ' ' + label))
    }

    lines.push(line)
  }

  // Bottom border
  lines.push(buildBottomBorder(visibleCandles, colWidth, innerWidth))

  // Time labels
  lines.push(buildTimeLabels(visibleCandles, colWidth, leftBorderWidth, opts.timeframe, innerWidth))

  // Volume bars
  if (opts.showVolume && opts.volumeHeight > 0) {
    lines.push([seg('')])
    const volumeLines = buildVolumeLines(visibleCandles, colWidth, leftBorderWidth, opts.volumeHeight)
    for (const vl of volumeLines) lines.push(vl)
  }

  // ── Layout metadata ───────────────────────────────────────
  const layout: ChartLayout = {
    leftBorderWidth,
    rightAxisWidth,
    chartHeight,
    chartAreaWidth,
    colWidth,
    visibleCandleCount: candleCount,
    priceMax,
    priceMin,
    priceRange,
    headerLines: 1,
    priceDecimals: opts.priceDecimals,
  }

  return { lines, layout, visibleCandles }
}

// ── Title line ────────────────────────────────────────────────────

function buildTitleLine(candle: Candle, opts: ChartOptions): ChartLine {
  const line: ChartLine = []
  const d = opts.priceDecimals

  line.push(seg('\u2588 ', CHART_COLORS.bullish))
  line.push(seg('VIBE SENSEI', 'white'))
  line.push(dimSeg(' \u2500 '))
  line.push(seg(opts.symbol, CHART_COLORS.bullish))
  line.push(seg(' '))
  line.push(dimSeg('[' + opts.timeframe.toUpperCase() + ']'))
  line.push(seg('  '))

  line.push(dimSeg('O:'))
  line.push(seg(candle.open.toFixed(d), 'white'))
  line.push(seg('  '))
  line.push(dimSeg('H:'))
  line.push(seg(candle.high.toFixed(d), 'white'))
  line.push(seg('  '))
  line.push(dimSeg('L:'))
  line.push(seg(candle.low.toFixed(d), 'white'))
  line.push(seg('  '))
  line.push(dimSeg('C:'))
  line.push(seg(candle.close.toFixed(d), 'white'))

  const pctChange = candle.open !== 0
    ? ((candle.close - candle.open) / candle.open) * 100
    : 0
  const sign = pctChange >= 0 ? '+' : ''
  const pctColor: ChartSegment['color'] = pctChange >= 0 ? CHART_COLORS.priceUp : CHART_COLORS.priceDown
  line.push(seg(' '))
  line.push(seg(`(${sign}${pctChange.toFixed(2)}%)`, pctColor))

  return line
}

// ── Bottom border ─────────────────────────────────────────────────

function buildBottomBorder(
  candles: Candle[],
  colWidth: number,
  innerWidth: number,
): ChartLine {
  const labelInterval = computeLabelInterval(candles.length, colWidth)
  const candleContentWidth = candles.length * colWidth

  let s = ''
  for (let i = 0; i < innerWidth; i++) {
    if (i < candleContentWidth) {
      const idx = Math.floor(i / colWidth)
      const isTickPos = (i % colWidth === 0) && (idx % labelInterval === 0)
      s += isTickPos ? TICK_UP : BORDER_H
    } else {
      s += BORDER_H
    }
  }
  s += BORDER_BR
  return [dimSeg(s)]
}

// ── Time labels ───────────────────────────────────────────────────

function buildTimeLabels(
  candles: Candle[],
  colWidth: number,
  leftOffset: number,
  timeframe: string,
  innerWidth: number,
): ChartLine {
  const line: ChartLine = []
  line.push(dimSeg(' '.repeat(leftOffset)))

  const labelInterval = computeLabelInterval(candles.length, colWidth)
  const bufLen = Math.min(candles.length * colWidth, innerWidth)
  const buf = new Array<string>(bufLen).fill(' ')

  for (let i = 0; i < candles.length; i++) {
    if (i % labelInterval !== 0) continue
    const label = formatTimeLabel(candles[i].timestamp, timeframe, i, candles)
    const pos = i * colWidth
    for (let j = 0; j < label.length && pos + j < bufLen; j++) {
      buf[pos + j] = label[j]
    }
  }

  line.push(dimSeg(buf.join('')))
  return line
}

function formatTimeLabel(
  timestamp: number,
  timeframe: string,
  index: number,
  candles: Candle[],
): string {
  const date = new Date(timestamp)
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')

  const showDate = index === 0 || (
    index > 0 &&
    new Date(candles[index - 1].timestamp).getDate() !== date.getDate()
  )

  if (showDate && (timeframe === '1d' || timeframe === '1w')) {
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    return `${month}/${day}`
  }

  if (showDate) {
    const day = date.getDate().toString().padStart(2, '0')
    return `${day} `
  }

  if (timeframe === '1m' || timeframe === '5m' || timeframe === '15m') {
    return `${hours}:${minutes}`
  }

  return `${hours} `
}

function computeLabelInterval(candleCount: number, colWidth: number): number {
  const minLabelSpacing = 5
  const minInterval = Math.ceil(minLabelSpacing / colWidth)
  const idealInterval = Math.max(minInterval, Math.ceil(candleCount / 10))
  if (idealInterval <= 1) return 1
  if (idealInterval <= 2) return 2
  if (idealInterval <= 4) return 4
  if (idealInterval <= 5) return 5
  if (idealInterval <= 8) return 8
  if (idealInterval <= 10) return 10
  return Math.ceil(idealInterval / 5) * 5
}

// ── Volume bars ───────────────────────────────────────────────────

function buildVolumeLines(
  candles: Candle[],
  colWidth: number,
  leftOffset: number,
  volumeHeight: number,
): ChartLine[] {
  let maxVol = 0
  for (const c of candles) {
    if (c.volume > maxVol) maxVol = c.volume
  }
  if (maxVol === 0) maxVol = 1

  const totalEighths = volumeHeight * 8
  const levels: number[] = candles.map(c =>
    Math.round((c.volume / maxVol) * totalEighths),
  )

  const resultLines: ChartLine[] = []
  const labelPrefix = ' '.repeat(leftOffset)

  for (let row = 0; row < volumeHeight; row++) {
    const line: ChartLine = []
    line.push(row === 0 ? dimSeg('Vol ') : dimSeg(labelPrefix))

    const rowFromBottom = volumeHeight - 1 - row
    const rowStartEighth = rowFromBottom * 8
    const rowEndEighth = (rowFromBottom + 1) * 8

    let runText = ''
    let runColor: ChartSegment['color'] | undefined

    for (let i = 0; i < candles.length; i++) {
      const level = levels[i]
      const bullish = candles[i].close >= candles[i].open
      const color: ChartSegment['color'] = bullish ? CHART_COLORS.bullish : CHART_COLORS.bearish

      let char: string
      if (level >= rowEndEighth) char = VOLUME_BLOCKS[8]
      else if (level > rowStartEighth) char = VOLUME_BLOCKS[Math.min(level - rowStartEighth, 8)]
      else char = ' '

      const cellColor = char === ' ' ? undefined : color

      if (cellColor === runColor) {
        runText += char + ' '.repeat(colWidth - 1)
      } else {
        if (runText) line.push(seg(runText, runColor))
        runText = char + ' '.repeat(colWidth - 1)
        runColor = cellColor
      }
    }
    if (runText) line.push(seg(runText, runColor))
    resultLines.push(line)
  }

  return resultLines
}
