/**
 * render-candles.ts — Pure function rendering engine for terminal candlestick charts.
 *
 * Input: Candle[] (OHLCV data) + ChartOptions (terminal dimensions, display prefs)
 * Output: ChartLine[] — array of lines, each line an array of colored segments.
 *
 * Deep-sea Cthulhu theme: cyan (bullish) / magenta (bearish), unified fine-line
 * wicks, right-side Y-axis, current price indicator, border frame, background
 * grid dots. Ink's <Text color="cyan"> handles coloring; we never emit raw ANSI.
 */

import type { Candle } from '../../services/exchange/types.js'
import type { ChartLine, ChartSegment, ChartOptions } from './types.js'
import { DEFAULT_CHART_OPTIONS, CHART_COLORS } from './types.js'

// ── Unicode characters ──────────────────────────────────────────────

const BLOCK_BULL  = '\u2588'  // █  bullish body — solid, radiant
const BLOCK_BEAR  = '\u2593'  // ▓  bearish body — shaded, devoured
const WICK_TOP    = '\u2577'  // ╷  upper wick (fine line)
const WICK_BOTTOM = '\u2575'  // ╵  lower wick (fine line)
const WICK_MID    = '\u2502'  // │  body-adjacent wick (fine line)
const DOJI_CROSS  = '\u253C'  // ┼  doji (open ≈ close)

const VOLUME_BLOCKS = [' ', '\u2581', '\u2582', '\u2583', '\u2584', '\u2585', '\u2586', '\u2587', '\u2588']
//                      0     ▁        ▂        ▃        ▄        ▅        ▆        ▇        █

// Border frame characters
const BORDER_TL   = '\u250C'  // ┌
const BORDER_TR   = '\u2510'  // ┐
const BORDER_BL   = '\u2514'  // └
const BORDER_BR   = '\u2518'  // ┘
const BORDER_H    = '\u2500'  // ─
const BORDER_V    = '\u2502'  // │

// Y-axis (right side)
const AXIS_TEE_R  = '\u2502'  // │  right-side axis separator

// X-axis
const TICK_UP     = '\u2534'  // ┴  X-axis tick
const HLINE       = '\u2500'  // ─  horizontal line

// Current price indicator
const PRICE_DASH  = '\u2508'  // ┈  dashed line
const PRICE_ARROW = '\u25B6'  // ▶  arrow pointing to price

// Background grid
const GRID_DOT    = '\u00B7'  // ·  dim bubble dot

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

// ── Grid dot interval ───────────────────────────────────────────────

function isGridDotColumn(candleIdx: number, totalCandles: number): boolean {
  // Place grid dots at roughly every 4th candle position, skip first and last
  const interval = Math.max(4, Math.ceil(totalCandles / 12))
  return candleIdx > 0 && candleIdx < totalCandles - 1 && candleIdx % interval === 0
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

  // Layout: [border│] [chart area] [border│ space label]
  // Y-axis is on the RIGHT side now
  const samplePrice = candles[0].close
  const labelWidth = Math.max(
    samplePrice.toFixed(opts.priceDecimals).length,
    6,
  )
  // Right-side axis: │ + space + label
  const rightAxisWidth = 1 + 1 + labelWidth
  // Left border: │
  const leftBorderWidth = 1
  const chartAreaWidth = opts.width - leftBorderWidth - rightAxisWidth - 1
  const maxCandles = Math.max(1, Math.floor(chartAreaWidth / colWidth))
  const visibleCandles = candles.slice(-maxCandles)

  // Actual chart content width (candles may not fill the whole area)
  const candleContentWidth = visibleCandles.length * colWidth
  const innerWidth = Math.max(candleContentWidth, chartAreaWidth)

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

  // ── Find current price row (last candle's close) ──────────────
  const lastCandle = visibleCandles[visibleCandles.length - 1]
  const currentPriceRow = priceToRow(lastCandle.close)

  // ── Build price chart grid ────────────────────────────────────

  type Cell = { char: string; color?: ChartSegment['color']; dim?: boolean }
  const grid: Cell[][] = []
  for (let row = 0; row < chartHeight; row++) {
    const line: Cell[] = []
    for (let col = 0; col < visibleCandles.length * colWidth; col++) {
      line.push({ char: ' ' })
    }
    grid.push(line)
  }

  // Seed background grid dots (before drawing candles, so candles overwrite)
  for (let row = 0; row < chartHeight; row++) {
    for (let i = 0; i < visibleCandles.length; i++) {
      if (isGridDotColumn(i, visibleCandles.length)) {
        const col = i * colWidth
        if (col < grid[row].length) {
          grid[row][col] = { char: GRID_DOT, color: 'gray', dim: true }
        }
      }
    }
  }

  // Draw each candle
  for (let i = 0; i < visibleCandles.length; i++) {
    const c = visibleCandles[i]
    const bullish = c.close >= c.open
    const color: ChartSegment['color'] = bullish ? CHART_COLORS.bullish : CHART_COLORS.bearish
    const bodyChar = bullish ? BLOCK_BULL : BLOCK_BEAR

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
          // Body — different Unicode for bull vs bear
          grid[row][col] = { char: bodyChar, color }
        } else {
          // Wick — only draw on the first column of multi-column candles
          if (cw === 0 || colWidth === 1) {
            // Use fine wick characters based on position
            let wickChar: string
            if (row === highRow) {
              wickChar = WICK_TOP  // ╷ at the very top
            } else if (row === lowRow) {
              wickChar = WICK_BOTTOM  // ╵ at the very bottom
            } else {
              wickChar = WICK_MID  // │ for body-adjacent wicks
            }
            grid[row][col] = { char: wickChar, color }
          }
        }
      }
    }
  }

  // ── Overlay current price indicator line ──────────────────────
  // Draw ┈ dashes across the chart at the current price row,
  // but only on cells that are empty (space or grid dot).
  if (currentPriceRow >= 0 && currentPriceRow < chartHeight) {
    const priceRow = grid[currentPriceRow]
    for (let col = 0; col < priceRow.length; col++) {
      const cell = priceRow[col]
      if (cell.char === ' ' || cell.char === GRID_DOT) {
        priceRow[col] = { char: PRICE_DASH, color: CHART_COLORS.priceLine, dim: false }
      }
    }
  }

  // ── Assemble chart lines ──────────────────────────────────────

  const lines: ChartLine[] = []

  // Title line
  const titleLine = buildTitleLine(lastCandle, opts)
  lines.push(titleLine)

  // Top border: ┌────────────────────────────────┐
  const topBorder = buildTopBorder(innerWidth)
  lines.push(topBorder)

  // Price rows with right-side Y-axis
  for (let row = 0; row < chartHeight; row++) {
    const line: ChartLine = []
    const price = priceMax - (row / (chartHeight - 1)) * priceRange
    const label = formatPrice(price, opts.priceDecimals, labelWidth)

    // Left border
    line.push(dimSeg(BORDER_V))

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

    // Pad remaining chart area
    const usedCols = rowCells.length
    if (usedCols < innerWidth) {
      // If this is the price line row, fill with dashes
      if (row === currentPriceRow) {
        const remaining = innerWidth - usedCols
        line.push(seg(PRICE_DASH.repeat(remaining), CHART_COLORS.priceLine))
      } else {
        line.push(seg(' '.repeat(innerWidth - usedCols)))
      }
    }

    // Right border + price indicator
    if (row === currentPriceRow) {
      // Arrow pointing to current price label
      line.push(seg(PRICE_ARROW, CHART_COLORS.priceLine))
      line.push(seg(' ' + label, CHART_COLORS.priceLine))
    } else {
      line.push(dimSeg(AXIS_TEE_R + ' ' + label))
    }

    lines.push(line)
  }

  // Bottom border: └──────┬──────┬──────┬─────┘
  const bottomBorder = buildBottomBorder(visibleCandles, colWidth, innerWidth)
  lines.push(bottomBorder)

  // Time labels
  const timeLabelsLine = buildTimeLabels(visibleCandles, colWidth, leftBorderWidth, opts.timeframe, innerWidth)
  lines.push(timeLabelsLine)

  // Volume bars (outside border frame)
  if (opts.showVolume && opts.volumeHeight > 0) {
    lines.push([seg('')]) // spacer
    const volumeLines = buildVolumeLines(visibleCandles, colWidth, leftBorderWidth, opts.volumeHeight)
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

  line.push(seg(BLOCK_BULL + ' ', CHART_COLORS.bullish))
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

  // Change percentage
  const pctChange = lastCandle.open !== 0
    ? ((lastCandle.close - lastCandle.open) / lastCandle.open) * 100
    : 0
  const sign = pctChange >= 0 ? '+' : ''
  const pctColor: ChartSegment['color'] = pctChange >= 0 ? CHART_COLORS.priceUp : CHART_COLORS.priceDown
  line.push(seg(' '))
  line.push(seg(`(${sign}${pctChange.toFixed(2)}%)`, pctColor))

  return line
}

// ── Border frame ────────────────────────────────────────────────────

function buildTopBorder(innerWidth: number): ChartLine {
  return [dimSeg(BORDER_TL + BORDER_H.repeat(innerWidth) + BORDER_TR)]
}

function buildBottomBorder(
  candles: Candle[],
  colWidth: number,
  innerWidth: number,
): ChartLine {
  const labelInterval = computeLabelInterval(candles.length, colWidth)
  const candleContentWidth = candles.length * colWidth

  let bottomStr = BORDER_BL
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

// ── Time labels ─────────────────────────────────────────────────────

function buildTimeLabels(
  candles: Candle[],
  colWidth: number,
  leftOffset: number,
  timeframe: string,
  innerWidth: number,
): ChartLine {
  const line: ChartLine = []
  // Align with left border
  line.push(dimSeg(' '.repeat(leftOffset)))

  const labelInterval = computeLabelInterval(candles.length, colWidth)

  // Build a character buffer for time labels
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
  leftOffset: number,
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
  const resultLines: ChartLine[] = []
  const labelPrefix = ' '.repeat(leftOffset)

  for (let row = 0; row < volumeHeight; row++) {
    const line: ChartLine = []
    if (row === 0) {
      const volLabel = 'Vol '
      line.push(dimSeg(volLabel))
    } else {
      line.push(dimSeg(labelPrefix))
    }

    // For each candle, determine what character to show in this row
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

    resultLines.push(line)
  }

  return resultLines
}
