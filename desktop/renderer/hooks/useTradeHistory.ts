import { useState, useEffect, useCallback } from 'react'
import type { TradeHistory, TradeHistoryEntry } from '../../shared/ipc-channels'

interface UseTradeHistoryResult {
  trades: TradeHistoryEntry[]
  loading: boolean
}

export function useTradeHistory(): UseTradeHistoryResult {
  const [trades, setTrades] = useState<TradeHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  const handleHistory = useCallback((history: TradeHistory) => {
    setTrades(history.trades)
    setLoading(false)
  }, [])

  useEffect(() => {
    const api = (window as any).electronAPI
    if (!api) {
      setLoading(false)
      return
    }

    // Request fresh history on mount
    if (typeof api.requestTradeHistory === 'function') {
      api.requestTradeHistory()
    }

    // Subscribe to trade history updates
    let cleanup: (() => void) | undefined
    if (typeof api.onTradeHistory === 'function') {
      cleanup = api.onTradeHistory((history: TradeHistory) => {
        handleHistory(history)
      })
    }

    // If no response within 500ms, stop loading indicator
    const timeout = setTimeout(() => setLoading(false), 500)

    return () => {
      clearTimeout(timeout)
      if (typeof cleanup === 'function') cleanup()
    }
  }, [handleHistory])

  return { trades, loading }
}
