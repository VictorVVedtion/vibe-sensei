import React, { useState, useCallback, useEffect, useRef } from 'react'
import { ChatPanel, type ChatPanelHandle } from './components/chat/ChatPanel'
import { ChartPanel, type CandleData } from './components/ChartPanel'
import { Layout } from './components/Layout'
import { GuardianSidebar } from './components/GuardianSidebar'
import { LiveFeedStrip } from './components/LiveFeedStrip'
import { DebateRoom } from './components/guardian/DebateRoom'
import { CommandPalette } from './components/CommandPalette'
import { WatchlistPanel } from './components/WatchlistPanel'
import { ShortcutOverlay } from './components/ShortcutOverlay'
import { ToastStack } from './components/ToastStack'
import { useUdfPort } from './hooks/useUdfPort'
import { useToast } from './hooks/useToast'
import { useGuardianAlerts } from './hooks/useGuardianAlerts'

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
        <div style={{ padding: 40, color: 'var(--color-loss)', background: 'var(--bg-base)', height: '100vh', fontFamily: 'var(--font-ui)' }}>
          <h1>Something went wrong</h1>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginTop: 12 }}>
            {this.state.error?.message}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 20,
              padding: '8px 16px',
              fontFamily: 'var(--font-ui)',
              background: 'var(--bg-raised)',
              color: 'var(--color-accent)',
              border: '1px solid var(--border-base)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontWeight: 600,
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
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [shortcutOverlayVisible, setShortcutOverlayVisible] = useState(false)

  const udfPort = useUdfPort()
  const chatRef = useRef<ChatPanelHandle | null>(null)
  const cmdHeldTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { toasts, addToast, dismissToast } = useToast()
  const { alerts } = useGuardianAlerts()
  const lastAlertIdRef = useRef<string | null>(null)

  // Fire toasts for CRITICAL/EMERGENCY guardian alerts
  useEffect(() => {
    if (alerts.length === 0) return
    const latest = alerts[alerts.length - 1]
    if (latest.id === lastAlertIdRef.current) return
    lastAlertIdRef.current = latest.id
    if (latest.severity === 'critical' || latest.severity === 'emergency') {
      addToast(
        `[${latest.masterName}] ${latest.message}`,
        'critical',
      )
    }
  }, [alerts, addToast])

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

  // Global keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey

      // Cmd/Ctrl held alone: start 500ms timer for shortcut overlay
      if ((e.key === 'Meta' || e.key === 'Control') && !cmdHeldTimer.current) {
        cmdHeldTimer.current = setTimeout(() => {
          setShortcutOverlayVisible(true)
        }, 500)
      }

      // Cmd+K: Command palette
      if (mod && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen(prev => !prev)
      }

      // Cmd+/: Toggle chat panel focus
      if (mod && e.key === '/') {
        e.preventDefault()
        const chatInput = document.querySelector('.chat-input') as HTMLTextAreaElement | null
        chatInput?.focus()
      }

      // Cmd+B: Prefill /buy
      if (mod && e.key === 'b') {
        e.preventDefault()
        chatRef.current?.prefillInput('/buy ')
      }

      // Cmd+S: Prefill /sell (prevent browser save!)
      if (mod && e.key === 's') {
        e.preventDefault()
        chatRef.current?.prefillInput('/sell ')
      }

      // Escape: Close palette
      if (e.key === 'Escape' && paletteOpen) {
        setPaletteOpen(false)
      }

      // Any key other than Meta/Ctrl pressed while mod held: cancel overlay timer
      if (e.key !== 'Meta' && e.key !== 'Control' && cmdHeldTimer.current) {
        clearTimeout(cmdHeldTimer.current)
        cmdHeldTimer.current = null
        setShortcutOverlayVisible(false)
      }
    }

    function handleKeyUp(e: KeyboardEvent) {
      if (e.key === 'Meta' || e.key === 'Control') {
        if (cmdHeldTimer.current) {
          clearTimeout(cmdHeldTimer.current)
          cmdHeldTimer.current = null
        }
        setShortcutOverlayVisible(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      if (cmdHeldTimer.current) clearTimeout(cmdHeldTimer.current)
    }
  }, [paletteOpen])

  const handlePaletteSendChat = useCallback((message: string) => {
    chatRef.current?.sendMessage(message)
  }, [])

  return (
    <>
      <Layout
        watchlist={<WatchlistPanel port={udfPort} activeSymbol={symbol} onSymbolClick={onSymbolChange} />}
        chat={<ChatPanel port={udfPort} ref={chatRef} />}
        chart={
          <ChartPanel
            onSymbolChange={onSymbolChange}
            onPriceUpdate={onPriceUpdate}
            onConnectionChange={onConnectionChange}
            onChartAnalyze={(sym, price, candle) => {
              const msg = candle
                ? `Analyze ${sym} candle: O=${candle.open} H=${candle.high} L=${candle.low} C=${candle.close} Vol=${candle.volume} — trend, key levels, risk`
                : `Analyze ${sym} at $${price.toLocaleString()} — trend, support/resistance, key levels, risk assessment`
              chatRef.current?.sendMessage(msg)
            }}
            guardianMarkers={alerts.map(a => ({
              time: Math.floor((a.timestamp ?? Date.now()) / 1000),
              text: `${a.masterName}: ${a.message.slice(0, 40)}`,
              color: a.severity === 'critical' || a.severity === 'emergency' ? '#F23645' : a.severity === 'warning' ? '#F7931A' : '#00B589',
            }))}
          />
        }
        sidebar={<GuardianSidebar />}
        liveFeed={<LiveFeedStrip />}
      />
      <DebateRoom />
      <CommandPalette
        isOpen={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSendChat={handlePaletteSendChat}
      />
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      <ShortcutOverlay isVisible={shortcutOverlayVisible} />
    </>
  )
}

export function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  )
}
