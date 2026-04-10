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

/** Trading terminal color constants — matches DESIGN.md (green up, red down) */
export const CHART_COLORS = {
  bullish: 'green' as const,      // #00FF41 — profit / up
  bearish: 'red' as const,        // #FF003C — loss / down
  axis: 'gray' as const,          // dim gray for price labels
  title: 'white' as const,        // bright header
  priceUp: 'green' as const,      // up price numbers
  priceDown: 'red' as const,      // down price numbers
  priceLine: 'yellow' as const,   // current price indicator
  crosshair: 'yellow' as const,   // crosshair lines
  volume: undefined,               // follows candle color
}

/**
 * Crosshair overlay state — describes where the crosshair should render.
 * Coordinates are in chart-area space (0-indexed from the top-left of the
 * price grid, not including borders/axis).
 */
export interface CrosshairState {
  /** Column index within the chart grid (0-indexed) */
  col: number
  /** Row index within the chart grid (0-indexed) */
  row: number
  /** Whether the crosshair is currently active/visible */
  active: boolean
}

/**
 * Layout metadata returned by the render engine so the interactive
 * component can map terminal coordinates to chart coordinates.
 */
export interface ChartLayout {
  /** Number of columns used by the left border (always 1) */
  leftBorderWidth: number
  /** Width of the right axis area (border + space + label) */
  rightAxisWidth: number
  /** Number of rows in the price chart area */
  chartHeight: number
  /** Width of the chart content area in terminal columns */
  chartAreaWidth: number
  /** Column width per candle (1 or 2) */
  colWidth: number
  /** Number of visible candles */
  visibleCandleCount: number
  /** Price at the top of the chart */
  priceMax: number
  /** Price at the bottom of the chart */
  priceMin: number
  /** Total price range (priceMax - priceMin) */
  priceRange: number
  /** Number of title lines before the chart grid (title + top border) */
  headerLines: number
  /** Price decimal precision */
  priceDecimals: number
}
