import { useEffect, useRef, useState, useCallback } from 'react'
import { useUdfPort } from '../hooks/useUdfPort'
import '../styles/theme.css'
import '../styles/chart-theme.css'

/**
 * Declarations for TradingView Charting Library globals.
 * These are loaded dynamically via <script> tags from the UDF server.
 */
declare global {
  interface Window {
    TradingView: {
      widget: new (config: TradingViewWidgetConfig) => TradingViewWidgetInstance
    }
    Datafeeds: {
      UDFCompatibleDatafeed: new (
        url: string,
        updateFrequency?: number,
        options?: Record<string, unknown>,
      ) => unknown
    }
  }
}

interface TradingViewWidgetConfig {
  symbol: string
  interval: string
  container: string | HTMLElement
  datafeed: unknown
  library_path: string
  locale: string
  theme: string
  custom_css_url?: string
  autosize: boolean
  timezone: string
  fullscreen?: boolean
  disabled_features: string[]
  enabled_features: string[]
  overrides: Record<string, string | number>
  loading_screen: { backgroundColor: string; foregroundColor: string }
}

interface TradingViewWidgetInstance {
  onChartReady: (callback: () => void) => void
  activeChart: () => {
    setSymbol: (symbol: string, callback?: () => void) => void
    setResolution: (resolution: string, callback?: () => void) => void
  }
  remove: () => void
}

interface ChartPanelProps {
  onSymbolChange?: (symbol: string) => void
  onPriceUpdate?: (price: number, prevClose: number | null) => void
  onConnectionChange?: (
    status: 'connected' | 'reconnecting' | 'disconnected',
  ) => void
}

/**
 * Load a script tag dynamically and resolve when loaded.
 * Reuses already-loaded scripts by checking the DOM for existing tags.
 */
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`)
    if (existing) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => resolve()
    script.onerror = () =>
      reject(new Error(`Failed to load script: ${src}`))
    document.head.appendChild(script)
  })
}

const CONTAINER_ID = 'tv_chart_container'

export function ChartPanel({
  onSymbolChange,
  onPriceUpdate,
  onConnectionChange,
}: ChartPanelProps) {
  const port = useUdfPort()
  const widgetRef = useRef<TradingViewWidgetInstance | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const wsReconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentSymbolRef = useRef('BTCUSDT')
  const lastPriceRef = useRef<number | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const udfBase = port ? `http://localhost:${port}` : null

  // Initialize TradingView widget when port becomes available
  const initWidget = useCallback(async () => {
    if (!udfBase) return

    setLoading(true)
    setError(null)

    try {
      // Load charting library scripts from the UDF server
      await loadScript(`${udfBase}/charting_library/charting_library.standalone.js`)
      await loadScript(`${udfBase}/datafeeds/udf/dist/bundle.js`)

      // Verify globals are available
      if (!window.TradingView || !window.Datafeeds) {
        throw new Error(
          'TradingView library failed to initialize. ' +
          'Globals TradingView/Datafeeds not found on window.',
        )
      }

      // Destroy previous widget if any
      if (widgetRef.current) {
        try {
          widgetRef.current.remove()
        } catch (err) {
          console.warn('[ChartPanel] Error removing previous widget:', err)
        }
        widgetRef.current = null
      }

      const datafeed = new window.Datafeeds.UDFCompatibleDatafeed(udfBase, undefined, {
        maxResponseLength: 1000,
        expectedOrder: 'latestFirst',
      })

      const widget = new window.TradingView.widget({
        symbol: 'BTCUSDT',
        interval: '60',
        container: CONTAINER_ID,
        datafeed,
        library_path: `${udfBase}/charting_library/`,
        locale: 'en',
        theme: 'dark',
        custom_css_url: `${udfBase}/charting_library/custom_chart.css`,
        autosize: true,
        timezone: 'Etc/UTC',
        disabled_features: [
          'use_localstorage_for_settings',
          'header_compare',
          'display_market_status',
          'popup_hints',
        ],
        enabled_features: [
          'study_templates',
          'hide_left_toolbar_by_default',
        ],
        overrides: {
          // Candle colors
          'mainSeriesProperties.candleStyle.upColor': '#26a69a',
          'mainSeriesProperties.candleStyle.downColor': '#ef5350',
          'mainSeriesProperties.candleStyle.wickUpColor': '#26a69a',
          'mainSeriesProperties.candleStyle.wickDownColor': '#ef5350',
          'mainSeriesProperties.candleStyle.borderUpColor': '#26a69a',
          'mainSeriesProperties.candleStyle.borderDownColor': '#ef5350',
          // Background
          'paneProperties.background': '#131722',
          'paneProperties.backgroundType': 'solid',
          'scalesProperties.backgroundColor': '#131722',
          // Grid
          'paneProperties.vertGridProperties.color': 'rgba(43, 43, 67, 0.4)',
          'paneProperties.horzGridProperties.color': 'rgba(43, 43, 67, 0.4)',
          // Text
          'scalesProperties.textColor': '#d1d4dc',
          // Volume
          'volumePaneSize': 'medium',
        },
        loading_screen: {
          backgroundColor: '#131722',
          foregroundColor: '#00FF41',
        },
      })

      widgetRef.current = widget

      widget.onChartReady(() => {
        setLoading(false)
        onConnectionChange?.('connected')
        console.log('[ChartPanel] TradingView widget ready')
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(
        `Could not initialize TradingView chart. ` +
        `Make sure the UDF server is running on port ${port}. ${message}`,
      )
      setLoading(false)
      console.error('[ChartPanel] Widget init failed:', err)
    }
  }, [udfBase, port, onConnectionChange])

  useEffect(() => {
    initWidget()

    return () => {
      if (widgetRef.current) {
        try {
          widgetRef.current.remove()
        } catch (err) {
          console.warn('[ChartPanel] Error removing widget on cleanup:', err)
        }
        widgetRef.current = null
      }
    }
  }, [initWidget])

  // WebSocket connection for live price updates to parent
  // TradingView widget handles its own real-time data via the UDF datafeed,
  // but we still need to push price updates to the parent Layout component
  // for the status bar display.
  useEffect(() => {
    if (!port) return

    const WS_RECONNECT_DELAY = 3000

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
        if (wsReconnectTimerRef.current) {
          clearTimeout(wsReconnectTimerRef.current)
          wsReconnectTimerRef.current = null
        }
      }

      ws.onmessage = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.type === 'ticker' && msg.data) {
            const chartSymbol = msg.data.symbol.replace('/', '')
            if (chartSymbol !== currentSymbolRef.current) return

            const prevPrice = lastPriceRef.current
            lastPriceRef.current = msg.data.last
            onPriceUpdate?.(msg.data.last, prevPrice)

            // Notify parent of symbol if it changed
            onSymbolChange?.(chartSymbol)
          }
        } catch (err) {
          console.warn('[ChartPanel] Failed to parse WebSocket message:', err)
        }
      }

      ws.onclose = () => {
        console.log('[ChartPanel] WebSocket disconnected')
        wsRef.current = null
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
  }, [port, onConnectionChange, onPriceUpdate, onSymbolChange])

  return (
    <div className="chart-panel">
      <div className="chart-container" id={CONTAINER_ID}>
        {loading && (
          <div
            className="loading-indicator visible"
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 5,
              color: '#00FF41',
              fontSize: '14px',
            }}
          >
            Initializing chart...
          </div>
        )}
        {error && (
          <div className="error-overlay">
            <h3>Chart Error</h3>
            <p>{error}</p>
          </div>
        )}
        {!port && (
          <div className="error-overlay">
            <h3>Waiting for UDF Server</h3>
            <p>Connecting to chart data server...</p>
          </div>
        )}
      </div>
    </div>
  )
}
