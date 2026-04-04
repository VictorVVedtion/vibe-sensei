import React, { useState, useCallback } from 'react'
import { TerminalPanel } from './components/TerminalPanel'
import { ChartPanel } from './components/ChartPanel'
import { Layout } from './components/Layout'
import { GuardianSidebar } from './components/GuardianSidebar'

// ── Error Boundary ─────────────────────────────────────────────────────────

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, color: '#FF003C', background: '#0A1628', height: '100vh' }}>
          <h1>Something went wrong</h1>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {this.state.error?.message}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 20,
              padding: '8px 16px',
              background: '#182233',
              color: '#00FF41',
              border: '1px solid #00FF41',
              borderRadius: 0,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// ── App ────────────────────────────────────────────────────────────────────

function AppInner() {
  const [symbol, setSymbol] = useState('BTCUSDT')
  const [lastPrice, setLastPrice] = useState<number | null>(null)
  const [prevClose, setPrevClose] = useState<number | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<
    'connected' | 'reconnecting' | 'disconnected'
  >('disconnected')

  const onSymbolChange = useCallback((s: string) => setSymbol(s), [])
  const onPriceUpdate = useCallback(
    (price: number, prev: number | null) => {
      setLastPrice(price)
      setPrevClose(prev)
    },
    [],
  )
  const onConnectionChange = useCallback(
    (status: 'connected' | 'reconnecting' | 'disconnected') => {
      setConnectionStatus(status)
    },
    [],
  )

  return (
    <Layout
      terminal={<TerminalPanel />}
      chart={
        <ChartPanel
          onSymbolChange={onSymbolChange}
          onPriceUpdate={onPriceUpdate}
          onConnectionChange={onConnectionChange}
        />
      }
      sidebar={<GuardianSidebar />}
      connectionStatus={connectionStatus}
      symbol={symbol}
      lastPrice={lastPrice}
      prevClose={prevClose}
    />
  )
}

export function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  )
}
