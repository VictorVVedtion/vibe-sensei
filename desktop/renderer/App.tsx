import { useState, useCallback } from 'react'
import { TerminalPanel } from './components/TerminalPanel'
import { ChartPanel } from './components/ChartPanel'
import { Layout } from './components/Layout'
import { GuardianSidebar } from './components/GuardianSidebar'

export function App() {
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
