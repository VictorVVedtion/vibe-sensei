/**
 * render-candles.ts — Braille high-resolution candlestick chart renderer.
 *
 * Uses Unicode Braille characters (U+2800–U+28FF) where each terminal character
 * cell maps to a 2×4 subpixel grid, giving 8× the effective resolution of the
 * previous block-character approach. Candle bodies, wicks, and overlays are drawn
 * into a subpixel buffer, then encoded to Braille characters with per-character
 * coloring via the existing ChartSegment model.
 *
 * Deep-sea Cthulhu theme: green (bullish) / red (bearish), right-side Y-axis,
 * current price indicator, border frame, volume bars below chart.
 */

import type { Candle } from '../../services/exchange/types.js'
import type { ChartLine, ChartSegment, ChartOptions, CrosshairState, ChartLayout } from './types.js'
import { DEFAULT_CHART_OPTIONS, CHART_COLORS } from './types.js'

/** Result of the render function — chart lines plus layout metadata. */
export interface RenderResult {
  lines: ChartLine[]
  layout: ChartLayout
  /** The visible candles slice (after zoom/pan). */
  visibleCandles: Candle[]
}

// ── Braille encoding ──────────────────────────────────────────────

const BRAILLE_BASE = 0x2800

/**
 * Bit values for each dot in a 2×4 Braille cell.
 * DOT_BITS[dx][dy]: dx=0 left col, dx=1 right col; dy=0..3 top→bottom.
 *
 *   [d0][d3]     bits: 0x01  0x08
 *   [d1][d4]           0x02  0x10
 *   [d2][d5]           0x04  0x20
 *   [d6][d7]           0x40  0x80
 */
const DOT_BITS = [
  [0x01, 0x02, 0x04, 0x40],  // left column  (dx=0)
  [0x08, 0x10, 0x20, 0x80],  // right column (dx=1)
] as const

// ── Subpixel layout constants ─────────────────────────────────────

/** Candle body width in subpixels */
const BODY_PX = 3
/** Wick X offset within slot (centered in 0..BODY_PX-1) */
const WICK_X = 1
/** Total slot width in subpixels (body + 1px gap) */
const SLOT_PX = 4
/** Terminal columns per candle slot (SLOT_PX / 2) */
const COL_WIDTH = 2

// ── Pixel colors (internal to renderer) ───────────────────────────

const PX_NONE  = 0
const PX_GREEN = 1   // bullish
const PX_RED   = 2   // bearish
const PX_YELLOW = 3  // price line
const PX_GRAY  = 4   // crosshair

/** Map internal pixel color → ChartSegment color string */
const PX_TO_SEG: (ChartSegment['color'] | undefined)[] = [
  undefined,              // PX_NONE
  CHART_COLORS.bullish,   // PX_GREEN  → 'green'
  CHART_COLORS.bearish,   // PX_RED    → 'red'
  CHART_COLORS.priceLine, // PX_YELLOW → 'yellow'
  'gray',                 // PX_GRAY
]

// ── Non-Braille characters (borders, axis, volume) ────────────────

const VOLUME_BLOCKS = [' ', '\u2581', '\u2582', '\u2583', '\u2584', '\u2585', '\u2586', '\u2587', '\u2588']

const BORDER_H    = '\u2500'  // ─
const BORDER_BR   = '\u2518'  // ┘
const TICK_UP     = '\u2534'  // ┴
const AXIS_TEE_R  = '\u2502'  // │
const PRICE_DASH  = '\u2504'  // ┄
const PRICE_ARROW = '\u25B6'  // ▶

// ── Nice number rounding ──────────────────────────────────────────

function niceStep(range: number, targetTicks: number): number {
  const rough = range / targetTicks
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)))
  const residual = rough / magnitude
  let nice: number
  if (residual <= 1.5) {
    nice = 1
  } else if (residual <= 3) {
    nice = 2
  } else if (residual <= 7) {
    nice = 5
  } else {
    nice = 10
  }
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

// ── Price formatting ──────────────────────────────────────────────

function formatPrice(price: number, decimals: number, labelWidth: number): string {
  return price.toFixed(decimals).padStart(labelWidth)
}

// ── Pixel buffer ──────────────────────────────────────────────────

interface PixelBuffer {
  width: number    // subpixel columns
  height: number   // subpixel rows
  dots: Uint8Array // 1=on, 0=off; index = y * width + x
  colors: Uint8Array // pixel color at each dot
}

function createBuffer(w: number, h: number): PixelBuffer {
  return { width: w, height: h, dots: new Uint8Array(w * h), colors: new Uint8Array(w * h) }
}

function setDot(buf: PixelBuffer, x: number, y: number, color: number): void {
  if (x < 0 || x >= buf.width || y < 0 || y >= buf.height) return
  const idx = y * buf.width + x
  buf.dots[idx] = 1
  buf.colors[idx] = color
}

/** Read one terminal cell (col, row) from the buffer → Braille char + dominant color. */
function readCell(buf: PixelBuffer, col: number, row: number): { char: string; color: number } {
  let bitmask = 0
  const counts = [0, 0, 0, 0, 0]  // indexed by PX_*
  const bx = col * 2
  const by = row * 4

  for (let dx = 0; dx < 2; dx++) {
    const px = bx + dx
    if (px >= buf.width) continue
    for (let dy = 0; dy < 4; dy++) {
      const py = by + dy
      if (py >= buf.height) continue
      const idx = py * buf.width + px
      if (buf.dots[idx]) {
        bitmask |= DOT_BITS[dx][dy]
        counts[buf.colors[idx]]++
      }
    }
  }

  if (bitmask === 0) return { char: ' ', color: PX_NONE }

  // Dominant color: highest count, tie-break favors lower index (candle > overlay)
  let best = PX_NONE
  let bestCount = 0
  for (let c = 1; c < counts.length; c++) {
    if (counts[c] > bestCount) {
      bestCount = counts[c]
      best = c
    }
  }

  return { char: String.fromCharCode(BRAILLE_BASE + bitmask), color: best }
}

// ── Drawing primitives ────────────────────────────────────────────

function drawCandle(
  buf: PixelBuffer,
  index: number,
  highY: number,
  lowY: number,
  bodyTopY: number,
  bodyBotY: number,
  color: number,
): void {
  const sx = index * SLOT_PX

  // Wick — 1px centered
  const wx = sx + WICK_X
  for (let y = highY; y <= lowY; y++) {
    setDot(buf, wx, y, color)
  }

  // Body — 3px wide, overwrites wick dots in body range
  for (let y = bodyTopY; y <= bodyBotY; y++) {
    for (let dx = 0; dx < BODY_PX; dx++) {
      setDot(buf, sx + dx, y, color)
    }
  }
}

function drawPriceLine(buf: PixelBuffer, subY: number): void {
  if (subY < 0 || subY >= buf.height) return
  for (let x = 0; x < buf.width; x++) {
    // Only draw on empty subpixels, with a dashed pattern
    if (!buf.dots[subY * buf.width + x] && x % 3 !== 2) {
      setDot(buf, x, subY, PX_YELLOW)
    }
  }
}

function drawCrosshairIntoBuffer(
  buf: PixelBuffer,
  subCol: number,
  subRow: number,
): void {
  // Vertical line
  if (subCol >= 0 && subCol < buf.width) {
    for (let y = 0; y < buf.height; y++) {
      if (!buf.dots[y * buf.width + subCol]) {
        setDot(buf, subCol, y, PX_GRAY)
      }
    }
  }
  // Horizontal line
  if (subRow >= 0 && subRow < buf.height) {
    for (let x = 0; x < buf.width; x++) {
      if (!buf.dots[subRow * buf.width + x]) {
        setDot(buf, x, subRow, PX_GRAY)
      }
    }
  }
  // Intersection — always yellow
  if (subCol >= 0 && subCol < buf.width && subRow >= 0 && subRow < buf.height) {
    setDot(buf, subCol, subRow, PX_YELLOW)
  }
}

// ── Buffer → ChartLine[] ─────────────────────────────────────────

function bufferToChartLines(buf: PixelBuffer, termCols: number): ChartLine[] {
  const termRows = Math.ceil(buf.height / 4)
  const result: ChartLine[] = []

  for (let row = 0; row < termRows; row++) {
    const line: ChartSegment[] = []
    let runText = ''
    let runColor: ChartSegment['color'] | undefined

    for (let col = 0; col < termCols; col++) {
      const { char, color } = readCell(buf, col, row)
      const segColor = PX_TO_SEG[color]

      if (segColor === runColor) {
        runText += char
      } else {
        if (runText) line.push(seg(runText, runColor))
        runText = char
        runColor = segColor
      }
    }
    if (runText) line.push(seg(runText, runColor))

    result.push(line)
  }

  return result
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

  const colWidth = COL_WIDTH

  // ── Layout ────────────────────────────────────────────────
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

  const candleContentWidth = visibleCandles.length * colWidth
  const innerWidth = Math.max(candleContentWidth, chartAreaWidth)
  const chartHeight = opts.height

  // ── Price range ───────────────────────────────────────────
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

  // ── Subpixel space ────────────────────────────────────────
  const subW = visibleCandles.length * SLOT_PX
  const subH = chartHeight * 4
  const buf = createBuffer(subW, subH)

  function priceToSubY(price: number): number {
    return Math.round(((priceMax - price) / priceRange) * (subH - 1))
  }

  function priceToTermRow(price: number): number {
    return Math.round(((priceMax - price) / priceRange) * (chartHeight - 1))
  }

  // ── Draw candles ──────────────────────────────────────────
  for (let i = 0; i < visibleCandles.length; i++) {
    const c = visibleCandles[i]
    const bullish = c.close >= c.open
    const color = bullish ? PX_GREEN : PX_RED

    const highY = priceToSubY(c.high)
    const lowY = priceToSubY(c.low)
    const openY = priceToSubY(c.open)
    const closeY = priceToSubY(c.close)
    const bodyTopY = Math.min(openY, closeY)
    const bodyBotY = Math.max(openY, closeY)

    drawCandle(buf, i, highY, lowY, bodyTopY, bodyBotY, color)
  }

  // ── Price line overlay ────────────────────────────────────
  const lastCandle = visibleCandles[visibleCandles.length - 1]
  const priceLineSubY = priceToSubY(lastCandle.close)
  drawPriceLine(buf, priceLineSubY)

  const currentPriceTermRow = priceToTermRow(lastCandle.close)

  // ── Crosshair overlay ─────────────────────────────────────
  if (crosshair && crosshair.active) {
    // Convert terminal crosshair coords to subpixel space
    // Snap horizontal to candle wick center
    const candleIdx = Math.floor(crosshair.col / colWidth)
    const subCol = candleIdx * SLOT_PX + WICK_X
    // Center vertically within terminal row
    const subRow = crosshair.row * 4 + 2
    drawCrosshairIntoBuffer(buf, subCol, subRow)
  }

  // ── Convert buffer → Braille segments ─────────────────────
  const termCandleCols = Math.ceil(subW / 2)
  const brailleLines = bufferToChartLines(buf, termCandleCols)

  // ── Assemble output lines ─────────────────────────────────
  const lines: ChartLine[] = []

  // Title line
  const hoveredCandleIdx = crosshair && crosshair.active
    ? Math.floor(crosshair.col / colWidth)
    : -1
  const titleCandle = (hoveredCandleIdx >= 0 && hoveredCandleIdx < visibleCandles.length)
    ? visibleCandles[hoveredCandleIdx]
    : lastCandle
  lines.push(buildTitleLine(titleCandle, opts))

  // Price rows: Braille chart + right-side Y-axis
  for (let row = 0; row < chartHeight; row++) {
    const line: ChartLine = [...(brailleLines[row] || [])]
    const price = priceMax - (row / (chartHeight - 1)) * priceRange
    const label = formatPrice(price, opts.priceDecimals, labelWidth)

    // Pad chart area to full width
    const usedCols = termCandleCols
    if (usedCols < innerWidth) {
      if (row === currentPriceTermRow) {
        line.push(seg(PRICE_DASH.repeat(innerWidth - usedCols), CHART_COLORS.priceLine))
      } else {
        line.push(seg(' '.repeat(innerWidth - usedCols)))
      }
    }

    // Right axis
    const isCrosshairRow = crosshair && crosshair.active && row === crosshair.row
    if (row === currentPriceTermRow) {
      line.push(seg(PRICE_ARROW, CHART_COLORS.priceLine))
      line.push(seg(' ' + label, CHART_COLORS.priceLine))
    } else if (isCrosshairRow) {
      const crosshairLabel = formatPrice(price, opts.priceDecimals, labelWidth)
      line.push(seg(BORDER_H, CHART_COLORS.crosshair, true))
      line.push(seg(' ' + crosshairLabel, CHART_COLORS.crosshair))
    } else {
      line.push(dimSeg(AXIS_TEE_R + ' ' + label))
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
    for (const vl of volumeLines) {
      lines.push(vl)
    }
  }

  // ── Layout metadata ───────────────────────────────────────
  const layout: ChartLayout = {
    leftBorderWidth,
    rightAxisWidth,
    chartHeight,
    chartAreaWidth,
    colWidth,
    visibleCandleCount: visibleCandles.length,
    priceMax,
    priceMin,
    priceRange,
    headerLines: 1,
    priceDecimals: opts.priceDecimals,
  }

  return { lines, layout, visibleCandles }
}

// ── Title line ────────────────────────────────────────────────────

function buildTitleLine(lastCandle: Candle, opts: ChartOptions): ChartLine {
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
  line.push(seg(lastCandle.open.toFixed(d), 'white'))
  line.push(seg('  '))
  line.push(dimSeg('H:'))
  line.push(seg(lastCandle.high.toFixed(d), 'white'))
  line.push(seg('  '))
  line.push(dimSeg('L:'))
  line.push(seg(lastCandle.low.toFixed(d), 'white'))
  line.push(seg('  '))
  line.push(dimSeg('C:'))
  line.push(seg(lastCandle.close.toFixed(d), 'white'))

  const pctChange = lastCandle.open !== 0
    ? ((lastCandle.close - lastCandle.open) / lastCandle.open) * 100
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

  let bottomStr = ''
  for (let i = 0; i < innerWidth; i++) {
    if (i < candleContentWidth) {
      const candleIdx = Math.floor(i / colWidth)
      const isTickPos = (i % colWidth === 0) && (candleIdx % labelInterval === 0)
      bottomStr += isTickPos ? TICK_UP : BORDER_H
    } else {
      bottomStr += BORDER_H
    }
  }
  bottomStr += BORDER_BR

  return [dimSeg(bottomStr)]
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
    const ts = candles[i].timestamp
    const label = formatTimeLabel(ts, timeframe, i, candles)
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
  const hours = date.getUTCHours().toString().padStart(2, '0')
  const minutes = date.getUTCMinutes().toString().padStart(2, '0')

  const showDate = index === 0 || (
    index > 0 &&
    new Date(candles[index - 1].timestamp).getUTCDate() !== date.getUTCDate()
  )

  if (showDate && (timeframe === '1d' || timeframe === '1w')) {
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0')
    const day = date.getUTCDate().toString().padStart(2, '0')
    return `${month}/${day}`
  }

  if (showDate) {
    const day = date.getUTCDate().toString().padStart(2, '0')
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
    if (row === 0) {
      line.push(dimSeg('Vol '))
    } else {
      line.push(dimSeg(labelPrefix))
    }

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
      if (level >= rowEndEighth) {
        char = VOLUME_BLOCKS[8]
      } else if (level > rowStartEighth) {
        const partial = level - rowStartEighth
        char = VOLUME_BLOCKS[Math.min(partial, 8)]
      } else {
        char = ' '
      }

      const cellStr = colWidth === 2 ? char + ' ' : char
      const cellColor = char === ' ' ? undefined : color

      if (cellColor === runColor) {
        runText += cellStr
      } else {
        if (runText) line.push(seg(runText, runColor))
        runText = cellStr
        runColor = cellColor
      }
    }
    if (runText) line.push(seg(runText, runColor))

    resultLines.push(line)
  }

  return resultLines
}
