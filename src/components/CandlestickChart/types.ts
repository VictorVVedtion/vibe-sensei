/**
 * Type definitions for the terminal candlestick chart renderer.
 * Uses structured segments (not raw ANSI strings) so Ink can handle coloring.
 */

export interface ChartSegment {
  text: string
  color?: 'green' | 'red' | 'gray' | 'cyan' | 'magenta' | 'white' | 'yellow'
  dim?: boolean
}

export type ChartLine = ChartSegment[]

export interface ChartOptions {
  /** Total available terminal width in columns */
  width: number
  /** Number of rows for the price chart area (default 15) */
  height: number
  /** Whether to render volume bars below the chart (default true) */
  showVolume: boolean
  /** Number of rows for volume bars (default 3) */
  volumeHeight: number
  /** Decimal places for price display */
  priceDecimals: number
  /** Trading pair symbol, e.g. "BTC/USDT" */
  symbol: string
  /** Timeframe label, e.g. "4h", "1d" */
  timeframe: string
}

export const DEFAULT_CHART_OPTIONS: Partial<ChartOptions> = {
  height: 15,
  showVolume: true,
  volumeHeight: 3,
  priceDecimals: 2,
}

/** Deep-sea Cthulhu theme color constants */
export const CHART_COLORS = {
  bullish: 'cyan' as const,       // bioluminescent cyan
  bearish: 'magenta' as const,    // abyssal purple
  axis: 'gray' as const,          // dim blue-gray
  title: 'white' as const,        // title text
  priceUp: 'cyan' as const,       // up price numbers
  priceDown: 'magenta' as const,  // down price numbers
  priceLine: 'yellow' as const,   // current price indicator — deep-sea searchlight
  volume: undefined,               // follows candle color
}
