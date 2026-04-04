import { useEffect, useRef, useState, useCallback } from 'react'
import {
  createChart,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type Time,
} from 'lightweight-charts'
import { useUdfPort } from '../hooks/useUdfPort'
import { ChartControls } from './chart/ChartControls'
import { OhlcBar, type OhlcData } from './chart/OhlcBar'
import '../styles/theme.css'

const WS_RECONNECT_DELAY = 3000

interface ChartPanelProps {
  onSymbolChange?: (symbol: string) => void
  onPriceUpdate?: (price: number, prevClose: number | null) => void
  onConnectionChange?: (
    status: 'connected' | 'reconnecting' | 'disconnected',
  ) => void
}

interface UdfHistoryResponse {
  s: string
  t: number[]
  o: number[]
  h: number[]
  l: number[]
  c: number[]
  v: number[]
}

interface TickerMessage {
  type: string
  data: {
    symbol: string
    last: number
    bid: number
    ask: number
  }
}

function mapCandleData(udf: UdfHistoryResponse): CandlestickData<Time>[] {
  if (!udf || udf.s !== 'ok' || !udf.t || udf.t.length === 0) return []
  const result: CandlestickData<Time>[] = []
  for (let i = 0; i < udf.t.length; i++) {
    result.push({
      time: udf.t[i] as Time,
      open: udf.o[i],
      high: udf.h[i],
      low: udf.l[i],
      close: udf.c[i],
    })
  }
  return result
}

function mapVolumeData(udf: UdfHistoryResponse): HistogramData<Time>[] {
  if (!udf || udf.s !== 'ok' || !udf.t || udf.t.length === 0) return []
  const result: HistogramData<Time>[] = []
  for (let i = 0; i < udf.t.length; i++) {
    const isUp = udf.c[i] >= udf.o[i]
    result.push({
      time: udf.t[i] as Time,
      value: udf.v[i],
      color: isUp ? 'rgba(0, 229, 160, 0.35)' : 'rgba(255, 77, 106, 0.35)',
    })
  }
  return result
}

export function ChartPanel({
  onSymbolChange,
  onPriceUpdate,
  onConnectionChange,
}: ChartPanelProps) {
  const port = useUdfPort()
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const wsReconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [symbol, setSymbol] = useState('BTCUSDT')
  const [resolution, setResolution] = useState('60')
  const [lastPrice, setLastPrice] = useState<number | null>(null)
  const [prevClose, setPrevClose] = useState<number | null>(null)
  const [crosshairData, setCrosshairData] = useState<OhlcData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lastCandleRef = useRef<OhlcData | null>(null)
  const currentSymbolRef = useRef(symbol)
  currentSymbolRef.current = symbol

  const udfBase = port ? `http://localhost:${port}` : null

  // Notify parent of symbol changes
  const handleSymbolChange = useCallback(
    (s: string) => {
      setSymbol(s)
      onSymbolChange?.(s)
    },
    [onSymbolChange],
  )

  // Initialize chart
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: {
        background: { type: 'solid' as const, color: '#0D1117' },
        textColor: '#00FF41',
        fontSize: 12,
      },
      grid: {
        vertLines: { color: '#0D150D' },
        horzLines: { color: '#0D150D' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: '#002B0E',
          width: 1,
          style: LineStyle.Dashed,
        },
        horzLine: {
          color: '#002B0E',
          width: 1,
          style: LineStyle.Dashed,
        },
      },
      rightPriceScale: {
        borderColor: '#0D150D',
      },
      timeScale: {
        borderColor: '#0D150D',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { vertTouchDrag: false },
    })

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#00E5A0',
      downColor: '#FF4D6A',
      borderUpColor: '#00E5A0',
      borderDownColor: '#FF4D6A',
      wickUpColor: '#00E5A0',
      wickDownColor: '#FF4D6A',
    })

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    })

    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    })

    chart.subscribeCrosshairMove((param) => {
      if (!param || !param.time) {
        setCrosshairData(lastCandleRef.current)
        return
      }
      const data = param.seriesData.get(candleSeries) as
        | CandlestickData<Time>
        | undefined
      if (data) {
        setCrosshairData({
          open: data.open,
          high: data.high,
          low: data.low,
          close: data.close,
        })
      }
    })

    chartRef.current = chart
    candleSeriesRef.current = candleSeries
    volumeSeriesRef.current = volumeSeries

    // Resize handler via ResizeObserver
    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        if (chartRef.current && container) {
          chartRef.current.resize(container.clientWidth, container.clientHeight)
        }
      })
    })
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
      chart.remove()
      chartRef.current = null
      candleSeriesRef.current = null
      volumeSeriesRef.current = null
    }
  }, [])

  // Load data when symbol, resolution, or port changes
  const loadData = useCallback(async () => {
    if (!udfBase || !candleSeriesRef.current || !volumeSeriesRef.current) return

    setLoading(true)
    setError(null)

    const now = Math.floor(Date.now() / 1000)
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60

    try {
      const url =
        `${udfBase}/history?symbol=${encodeURIComponent(symbol)}` +
        `&resolution=${encodeURIComponent(resolution)}` +
        `&from=${thirtyDaysAgo}&to=${now}`

      const res = await fetch(url)
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }
      const data: UdfHistoryResponse = await res.json()

      const candles = mapCandleData(data)
      const volumes = mapVolumeData(data)

      if (candles.length === 0) {
        setError(
          `No candle data returned for ${symbol}. Is the UDF server running?`,
        )
        setLoading(false)
        return
      }

      candleSeriesRef.current.setData(candles)
      volumeSeriesRef.current.setData(volumes)
      chartRef.current?.timeScale().fitContent()

      const lastCandle = candles[candles.length - 1]
      const prevCandle =
        candles.length > 1 ? candles[candles.length - 2] : lastCandle
      const ohlc: OhlcData = {
        open: lastCandle.open,
        high: lastCandle.high,
        low: lastCandle.low,
        close: lastCandle.close,
      }
      lastCandleRef.current = ohlc
      setLastPrice(lastCandle.close)
      setPrevClose(prevCandle.close)
      setCrosshairData(ohlc)
      onPriceUpdate?.(lastCandle.close, prevCandle.close)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(
        `Could not load data from UDF server at ${udfBase}. ` +
          `Make sure the server is running on port ${port}. ${message}`,
      )
      console.error('[ChartPanel] Data load failed:', err)
    } finally {
      setLoading(false)
    }
  }, [udfBase, symbol, resolution, port, onPriceUpdate])

  useEffect(() => {
    loadData()
  }, [loadData])

  // WebSocket connection for live ticker updates
  useEffect(() => {
    if (!port) return

    function connectWebSocket() {
      const wsUrl = `ws://localhost:${port}`
      let ws: WebSocket
      try {
        ws = new WebSocket(wsUrl)
      } catch (err) {
        console.warn('[ChartPanel] WebSocket connection failed:', err)
        onConnectionChange?.('disconnected')
        scheduleReconnect()
        return
      }

      ws.onopen = () => {
        console.log('[ChartPanel] WebSocket connected')
        onConnectionChange?.('connected')
        if (wsReconnectTimerRef.current) {
          clearTimeout(wsReconnectTimerRef.current)
          wsReconnectTimerRef.current = null
        }
      }

      ws.onmessage = (event: MessageEvent) => {
        try {
          const msg: TickerMessage = JSON.parse(event.data)
          if (msg.type === 'ticker' && msg.data) {
            const chartSymbol = msg.data.symbol.replace('/', '')
            if (chartSymbol !== currentSymbolRef.current) return
            setLastPrice((prev) => {
              setPrevClose(prev)
              onPriceUpdate?.(msg.data.last, prev)
              return msg.data.last
            })
          }
        } catch (err) {
          console.warn(
            '[ChartPanel] Failed to parse WebSocket message:',
            err,
          )
        }
      }

      ws.onclose = () => {
        console.log('[ChartPanel] WebSocket disconnected')
        wsRef.current = null
        onConnectionChange?.('reconnecting')
        scheduleReconnect()
      }

      ws.onerror = () => {
        // onclose fires after onerror, reconnect handled there
      }

      wsRef.current = ws
    }

    function scheduleReconnect() {
      if (wsReconnectTimerRef.current) return
      wsReconnectTimerRef.current = setTimeout(() => {
        wsReconnectTimerRef.current = null
        connectWebSocket()
      }, WS_RECONNECT_DELAY)
    }

    connectWebSocket()

    return () => {
      if (wsReconnectTimerRef.current) {
        clearTimeout(wsReconnectTimerRef.current)
        wsReconnectTimerRef.current = null
      }
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [port, onConnectionChange, onPriceUpdate])

  return (
    <div className="chart-panel">
      <ChartControls
        symbol={symbol}
        resolution={resolution}
        onSymbolChange={handleSymbolChange}
        onResolutionChange={setResolution}
      />
      <div className="chart-container" ref={containerRef}>
        {loading && (
          <div
            className="loading-indicator visible"
            style={{
              position: 'absolute',
              top: 8,
              right: 16,
              zIndex: 5,
            }}
          >
            Loading...
          </div>
        )}
        {error && (
          <div className="error-overlay">
            <h3>Connection Error</h3>
            <p>{error}</p>
          </div>
        )}
        {!port && (
          <div className="error-overlay">
            <h3>Waiting for UDF Server</h3>
            <p>
              Connecting to chart data server...
            </p>
          </div>
        )}
      </div>
      <OhlcBar
        symbol={symbol}
        lastPrice={lastPrice}
        prevClose={prevClose}
        crosshairData={crosshairData}
      />
    </div>
  )
}
