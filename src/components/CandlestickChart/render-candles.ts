/**
 * render-candles.ts — Pure function rendering engine for terminal candlestick charts.
 *
 * Input: Candle[] (OHLCV data) + ChartOptions (terminal dimensions, display prefs)
 * Output: ChartLine[] — array of lines, each line an array of colored segments.
 *
 * Ink's <Text color="green"> handles coloring; we never emit raw ANSI codes.
 */

import type { Candle } from '../../services/exchange/types.js'
import type { ChartLine, ChartSegment, ChartOptions } from './types.js'
import { DEFAULT_CHART_OPTIONS } from './types.js'

// ── Unicode characters ──────────────────────────────────────────────

const BLOCK_FULL = '\u2588'  // █  candle body
const WICK_THIN  = '\u2502'  // │  wick line
const DOJI_CROSS = '\u253C'  // ┼  doji (open ≈ close)

const VOLUME_BLOCKS = [' ', '\u2581', '\u2582', '\u2583', '\u2584', '\u2585', '\u2586', '\u2587', '\u2588']
//                      0     ▁        ▂        ▃        ▄        ▅        ▆        ▇        █

const AXIS_TEE   = '\u2524'  // ┤  Y-axis tick mark
const CORNER_BL  = '\u2514'  // └  bottom-left corner
const HLINE      = '\u2500'  // ─  horizontal line
const TICK_UP    = '\u2534'  // ┴  X-axis tick

// ── Nice number rounding ────────────────────────────────────────────

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

// ── Segment helpers ─────────────────────────────────────────────────

function seg(text: string, color?: ChartSegment['color'], dim?: boolean): ChartSegment {
  return dim ? { text, color, dim } : color ? { text, color } : { text }
}

function dimSeg(text: string): ChartSegment {
  return { text, color: 'gray', dim: true }
}

// ── Price formatting ────────────────────────────────────────────────

function formatPrice(price: number, decimals: number, labelWidth: number): string {
  const s = price.toFixed(decimals)
  return s.padStart(labelWidth)
}

// ── Compute candle column width ─────────────────────────────────────

function candleColumnWidth(availableWidth: number): number {
  if (availableWidth > 120) return 2
  return 1
}

// ── Main rendering function ─────────────────────────────────────────

export function renderCandlestickChart(
  candles: Candle[],
  partialOpts: Partial<ChartOptions> & Pick<ChartOptions, 'width' | 'symbol' | 'timeframe'>,
): ChartLine[] {
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
    return [[seg(`  No candle data for ${opts.symbol}`, 'gray')]]
  }

  const colWidth = candleColumnWidth(opts.width)

  // Determine how many candles fit
  // Layout: [label + axis] [chart area] [gap]
  // Y-axis label width: adapt to price magnitude
  const samplePrice = candles[0].close
  const labelWidth = Math.max(
    samplePrice.toFixed(opts.priceDecimals).length,
    6,
  )
  const axisWidth = labelWidth + 2 // label + space + ┤
  const chartAreaWidth = opts.width - axisWidth - 1
  const maxCandles = Math.max(1, Math.floor(chartAreaWidth / colWidth))
  const visibleCandles = candles.slice(-maxCandles)

  // ── Price range ───────────────────────────────────────────────
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

  const chartHeight = opts.height

  // Map a price to a row index (0 = top = highest price)
  function priceToRow(price: number): number {
    const ratio = (priceMax - price) / priceRange
    return Math.round(ratio * (chartHeight - 1))
  }

  // ── Build price chart grid ────────────────────────────────────

  // Each cell: { char, color, dim }
  type Cell = { char: string; color?: ChartSegment['color']; dim?: boolean }
  const grid: Cell[][] = []
  for (let row = 0; row < chartHeight; row++) {
    const line: Cell[] = []
    for (let col = 0; col < visibleCandles.length * colWidth; col++) {
      line.push({ char: ' ' })
    }
    grid.push(line)
  }

  // Draw each candle
  for (let i = 0; i < visibleCandles.length; i++) {
    const c = visibleCandles[i]
    const bullish = c.close >= c.open
    const color: ChartSegment['color'] = bullish ? 'green' : 'red'

    const highRow = priceToRow(c.high)
    const lowRow = priceToRow(c.low)
    const openRow = priceToRow(c.open)
    const closeRow = priceToRow(c.close)

    const bodyTop = Math.min(openRow, closeRow)
    const bodyBottom = Math.max(openRow, closeRow)

    const colStart = i * colWidth

    // Is it a doji? (open ≈ close within 1 row)
    const isDoji = bodyTop === bodyBottom

    for (let row = highRow; row <= lowRow; row++) {
      for (let cw = 0; cw < colWidth; cw++) {
        const col = colStart + cw
        if (col >= grid[0].length) break

        if (isDoji && row === bodyTop) {
          // Doji cross
          grid[row][col] = { char: DOJI_CROSS, color }
        } else if (row >= bodyTop && row <= bodyBottom) {
          // Body
          grid[row][col] = { char: BLOCK_FULL, color }
        } else {
          // Wick — only draw on the first column of multi-column candles
          if (cw === 0 || colWidth === 1) {
            grid[row][col] = { char: WICK_THIN, color }
          }
        }
      }
    }
  }

  // ── Assemble chart lines ──────────────────────────────────────

  const lines: ChartLine[] = []

  // Title line
  const lastCandle = visibleCandles[visibleCandles.length - 1]
  const titleLine = buildTitleLine(lastCandle, opts)
  lines.push(titleLine)

  // Empty spacer
  lines.push([seg('')])

  // Price rows with Y-axis
  for (let row = 0; row < chartHeight; row++) {
    const line: ChartLine = []
    const price = priceMax - (row / (chartHeight - 1)) * priceRange
    const label = formatPrice(price, opts.priceDecimals, labelWidth)
    line.push(dimSeg(label + ' ' + AXIS_TEE))

    // Chart cells — group consecutive same-color cells for efficiency
    const rowCells = grid[row]
    let runText = ''
    let runColor: ChartSegment['color'] | undefined
    let runDim: boolean | undefined

    for (const cell of rowCells) {
      const cellColor = cell.color
      const cellDim = cell.dim
      if (cellColor === runColor && cellDim === runDim) {
        runText += cell.char
      } else {
        if (runText) {
          line.push(seg(runText, runColor, runDim))
        }
        runText = cell.char
        runColor = cellColor
        runDim = cellDim
      }
    }
    if (runText) {
      line.push(seg(runText, runColor, runDim))
    }

    lines.push(line)
  }

  // X-axis line
  const xAxisLine = buildXAxisLine(visibleCandles, colWidth, axisWidth, chartAreaWidth)
  lines.push(xAxisLine)

  // Time labels
  const timeLabelsLine = buildTimeLabels(visibleCandles, colWidth, axisWidth, opts.timeframe, chartAreaWidth)
  lines.push(timeLabelsLine)

  // Volume bars
  if (opts.showVolume && opts.volumeHeight > 0) {
    lines.push([seg('')]) // spacer
    const volumeLines = buildVolumeLines(visibleCandles, colWidth, axisWidth, opts.volumeHeight)
    for (const vl of volumeLines) {
      lines.push(vl)
    }
  }

  return lines
}

// ── Title line ──────────────────────────────────────────────────────

function buildTitleLine(lastCandle: Candle, opts: ChartOptions): ChartLine {
  const line: ChartLine = []
  const d = opts.priceDecimals

  line.push(seg('  '))
  line.push(seg(opts.symbol, 'cyan'))
  line.push(seg(' '))
  line.push(dimSeg(opts.timeframe.toUpperCase()))
  line.push(seg('  '))

  line.push(dimSeg('O:'))
  line.push(seg(lastCandle.open.toFixed(d), 'white'))
  line.push(seg(' '))
  line.push(dimSeg('H:'))
  line.push(seg(lastCandle.high.toFixed(d), 'white'))
  line.push(seg(' '))
  line.push(dimSeg('L:'))
  line.push(seg(lastCandle.low.toFixed(d), 'white'))
  line.push(seg(' '))
  line.push(dimSeg('C:'))
  line.push(seg(lastCandle.close.toFixed(d), 'white'))

  // Change percentage
  const pctChange = lastCandle.open !== 0
    ? ((lastCandle.close - lastCandle.open) / lastCandle.open) * 100
    : 0
  const sign = pctChange >= 0 ? '+' : ''
  const pctColor: ChartSegment['color'] = pctChange >= 0 ? 'green' : 'red'
  line.push(seg(' '))
  line.push(seg(`(${sign}${pctChange.toFixed(2)}%)`, pctColor))

  return line
}

// ── X-axis ──────────────────────────────────────────────────────────

function buildXAxisLine(
  candles: Candle[],
  colWidth: number,
  axisWidth: number,
  chartAreaWidth: number,
): ChartLine {
  const line: ChartLine = []
  // Padding to align with Y-axis
  const pad = ' '.repeat(axisWidth - 1)
  line.push(dimSeg(pad + CORNER_BL))

  const totalCandleCols = candles.length * colWidth
  const usedWidth = Math.min(totalCandleCols, chartAreaWidth)

  // Build the X-axis line with tick marks at label positions
  const labelInterval = computeLabelInterval(candles.length, colWidth)
  let xStr = ''
  for (let i = 0; i < usedWidth; i++) {
    const candleIdx = Math.floor(i / colWidth)
    const isTickPos = (i % colWidth === 0) && (candleIdx % labelInterval === 0)
    xStr += isTickPos ? TICK_UP : HLINE
  }
  line.push(dimSeg(xStr))

  return line
}

// ── Time labels ─────────────────────────────────────────────────────

function buildTimeLabels(
  candles: Candle[],
  colWidth: number,
  axisWidth: number,
  timeframe: string,
  chartAreaWidth: number,
): ChartLine {
  const line: ChartLine = []
  line.push(dimSeg(' '.repeat(axisWidth)))

  const labelInterval = computeLabelInterval(candles.length, colWidth)

  // Build a character buffer for time labels
  const bufLen = Math.min(candles.length * colWidth, chartAreaWidth)
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

  // Check if this candle crosses a day boundary
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
  // Labels need at least 5 characters of space between them
  const minLabelSpacing = 5
  const minInterval = Math.ceil(minLabelSpacing / colWidth)
  // Aim for roughly 8-12 labels across the chart
  const idealInterval = Math.max(minInterval, Math.ceil(candleCount / 10))
  // Round to a "nice" interval
  if (idealInterval <= 1) return 1
  if (idealInterval <= 2) return 2
  if (idealInterval <= 4) return 4
  if (idealInterval <= 5) return 5
  if (idealInterval <= 8) return 8
  if (idealInterval <= 10) return 10
  return Math.ceil(idealInterval / 5) * 5
}

// ── Volume bars ─────────────────────────────────────────────────────

function buildVolumeLines(
  candles: Candle[],
  colWidth: number,
  axisWidth: number,
  volumeHeight: number,
): ChartLine[] {
  // Find max volume for scaling
  let maxVol = 0
  for (const c of candles) {
    if (c.volume > maxVol) maxVol = c.volume
  }
  if (maxVol === 0) maxVol = 1

  // Total fractional height in "eighth-blocks" units
  const totalEighths = volumeHeight * 8

  // Pre-compute volume levels per candle (in eighths)
  const levels: number[] = candles.map(c =>
    Math.round((c.volume / maxVol) * totalEighths),
  )

  // Build volume rows from top (highest) to bottom (lowest)
  const lines: ChartLine[] = []
  const labelPrefix = ' '.repeat(axisWidth)

  // Add "Vol" label on first row
  for (let row = 0; row < volumeHeight; row++) {
    const line: ChartLine = []
    if (row === 0) {
      const volLabel = 'Vol'.padStart(axisWidth - 1) + ' '
      line.push(dimSeg(volLabel))
    } else {
      line.push(dimSeg(labelPrefix))
    }

    // For each candle, determine what character to show in this row
    // Row 0 = top of volume area, row volumeHeight-1 = bottom
    const rowFromBottom = volumeHeight - 1 - row
    const rowStartEighth = rowFromBottom * 8
    const rowEndEighth = (rowFromBottom + 1) * 8

    let runText = ''
    let runColor: ChartSegment['color'] | undefined

    for (let i = 0; i < candles.length; i++) {
      const level = levels[i]
      const bullish = candles[i].close >= candles[i].open
      const color: ChartSegment['color'] = bullish ? 'green' : 'red'

      let char: string
      if (level >= rowEndEighth) {
        // Full block
        char = VOLUME_BLOCKS[8]
      } else if (level > rowStartEighth) {
        // Partial block
        const partial = level - rowStartEighth
        char = VOLUME_BLOCKS[Math.min(partial, 8)]
      } else {
        char = ' '
      }

      const cellStr = colWidth === 2 ? char + char : char
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

    lines.push(line)
  }

  return lines
}
