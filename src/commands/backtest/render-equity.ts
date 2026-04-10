/**
 * render-equity.ts — Smooth equity curve using braille characters.
 *
 * Uses Unicode braille (⠀⠁⠂...⣿) for smooth, dense line rendering.
 * Each braille cell is 2×4 dots, giving 2x horizontal and 4x vertical
 * subpixel resolution compared to block characters. Two clearly
 * distinct lines with different braille patterns.
 *
 * Shares the CandlestickChart color system (ChartSegment/CHART_COLORS)
 * and axis style (│ ┴ ┘ ▶ dim labels) for visual consistency.
 */

import type { ChartSegment } from '../../components/CandlestickChart/types.js'
import { CHART_COLORS } from '../../components/CandlestickChart/types.js'

export type ChartLine = ChartSegment[]
type CellColor = ChartSegment['color']

// ── Primitives ──────────────────────────────────────────────────────

function seg(text: string, color?: CellColor, dim?: boolean): ChartSegment {
  return dim ? { text, color, dim } : color ? { text, color } : { text }
}
function dimSeg(text: string): ChartSegment {
  return { text, color: 'gray', dim: true }
}

function fmtDollar(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `$${(v / 1000).toFixed(0)}K`
  if (v >= 1)         return `$${Math.round(v)}`
  return '$1'
}

// ── Braille dot mapping ─────────────────────────────────────────────
// Each braille character is a 2-wide × 4-tall dot grid.
// Dot positions:  ⠁⠈    (row 0: bits 0,3)
//                 ⠂⠐    (row 1: bits 1,4)
//                 ⠄⠠    (row 2: bits 2,5)
//                 ⡀⢀    (row 3: bits 6,7)
// Unicode braille starts at U+2800.

const BRAILLE_BASE = 0x2800
// Bit index for (col, row) within a braille cell
const BRAILLE_DOT: number[][] = [
  [0, 1, 2, 6],  // left column:  bits 0,1,2,6
  [3, 4, 5, 7],  // right column: bits 3,4,5,7
]

// ── Public API ──────────────────────────────────────────────────────

export interface EquitySeries {
  label: string
  values: number[]
  color: CellColor
  char?: string  // unused in braille mode, kept for API compat
}

export interface EquityChartOptions {
  width: number
  height: number
  title: string
  subtitle: string
  timeLabels: string[]
}

export function renderEquityChart(
  series: EquitySeries[],
  opts: EquityChartOptions,
): ChartLine[] {
  // Each braille character covers 2 horizontal × 4 vertical subpixels.
  // So `cols` braille chars = `cols*2` horizontal resolution,
  // and `rows` braille chars = `rows*4` vertical resolution.

  const labelWidth = 8
  const rightAxisWidth = 2 + labelWidth  // "│" + space + label
  const chartCols = Math.floor((opts.width - rightAxisWidth) / 1)  // 1 char per braille cell
  const chartRows = opts.height

  const hRes = chartCols * 2   // horizontal subpixel resolution
  const vRes = chartRows * 4   // vertical subpixel resolution

  // Find data range
  const allVals = series.flatMap(s => s.values).filter(v => v > 0)
  if (allVals.length === 0) return [[dimSeg('  No data')]]

  const logMin = Math.log10(Math.max(Math.min(...allVals), 1))
  const logMax = Math.log10(Math.max(...allVals))
  const logPad = (logMax - logMin) * 0.06 || 0.3
  const yMin = logMin - logPad
  const yMax = logMax + logPad
  const yRange = yMax - yMin || 1

  // Map value → vertical subpixel row (0 = top, vRes-1 = bottom)
  function valToSubRow(v: number): number {
    if (v <= 0) return vRes - 1
    const logV = Math.log10(Math.max(v, 1))
    return Math.round((yMax - logV) / yRange * (vRes - 1))
  }

  // ── Build braille grids (one per series for color separation) ───
  // Each grid is chartRows × chartCols of braille dot bitmasks.
  const grids: number[][][] = series.map(() =>
    Array.from({ length: chartRows }, () => Array(chartCols).fill(0))
  )

  for (let si = 0; si < series.length; si++) {
    const vals = series[si]!.values
    const maxLen = vals.length

    for (let i = 0; i < hRes; i++) {
      // Map horizontal subpixel to data index
      const dataIdx = Math.floor(i / hRes * maxLen)
      if (dataIdx >= maxLen) continue

      const v = vals[dataIdx]!
      const subRow = valToSubRow(v)

      // Which braille cell and which dot within it?
      const cellCol = Math.floor(i / 2)
      const dotCol = i % 2
      const cellRow = Math.floor(subRow / 4)
      const dotRow = subRow % 4

      if (cellRow >= 0 && cellRow < chartRows && cellCol >= 0 && cellCol < chartCols) {
        grids[si]![cellRow]![cellCol]! |= (1 << BRAILLE_DOT[dotCol]![dotRow]!)
      }

      // Connect to previous point with vertical interpolation
      if (i > 0) {
        const prevIdx = Math.floor((i - 1) / hRes * maxLen)
        const prevSubRow = valToSubRow(vals[Math.min(prevIdx, maxLen - 1)]!)
        const from = Math.min(prevSubRow, subRow)
        const to = Math.max(prevSubRow, subRow)
        for (let sr = from; sr <= to; sr++) {
          const cr = Math.floor(sr / 4)
          const dr = sr % 4
          if (cr >= 0 && cr < chartRows && cellCol >= 0 && cellCol < chartCols) {
            grids[si]![cr]![cellCol]! |= (1 << BRAILLE_DOT[dotCol]![dr]!)
          }
        }
      }
    }
  }

  // ── Assemble output lines ─────────────────────────────────────
  const lines: ChartLine[] = []

  // Title
  lines.push([
    seg('\u2588 ', CHART_COLORS.bullish),
    seg('VIBE SENSEI', 'white'),
    dimSeg(' \u2500 '),
    seg(opts.title, CHART_COLORS.bullish),
  ])
  lines.push([dimSeg('  ' + opts.subtitle)])

  // Legend
  const legend: ChartLine = [seg('  ')]
  for (const s of series) {
    legend.push(seg('\u2588 ', s.color))
    legend.push(seg(s.label + '   '))
  }
  lines.push(legend)
  lines.push([seg('')])

  // Chart rows
  for (let row = 0; row < chartRows; row++) {
    const rowSegs: ChartSegment[] = []

    // Render each column: check each series for dots at this cell
    // Render series in reverse order so first series (raw) draws last (on top)
    for (let col = 0; col < chartCols; col++) {
      let rendered = false
      // Last series (guardian) first, then raw on top
      for (let si = series.length - 1; si >= 0; si--) {
        const bits = grids[si]![row]![col]!
        if (bits !== 0) {
          const ch = String.fromCharCode(BRAILLE_BASE + bits)
          rowSegs.push(seg(ch, series[si]!.color))
          rendered = true
          break  // only one color per cell (foreground wins)
        }
      }
      if (!rendered) {
        rowSegs.push(seg(' '))
      }
    }

    // Y-axis label
    const logVal = yMax - (row / (chartRows - 1)) * yRange
    const dollarVal = Math.pow(10, logVal)
    const label = fmtDollar(dollarVal).padStart(labelWidth)
    rowSegs.push(dimSeg('\u2502' + label))

    lines.push(rowSegs)
  }

  // Bottom border
  let border = '\u2514'
  for (let i = 0; i < chartCols; i++) {
    border += (i % Math.max(1, Math.floor(chartCols / 8)) === 0) ? '\u2534' : '\u2500'
  }
  border += '\u2518'
  lines.push([dimSeg(border)])

  // Time labels
  if (opts.timeLabels.length > 0) {
    const timeLine: ChartLine = [dimSeg(' ')]
    const spacing = Math.max(1, Math.floor(chartCols / opts.timeLabels.length))
    for (const label of opts.timeLabels) {
      const pad = Math.max(0, spacing - label.length)
      timeLine.push(dimSeg(label + ' '.repeat(pad)))
    }
    lines.push(timeLine)
  }

  return lines
}
