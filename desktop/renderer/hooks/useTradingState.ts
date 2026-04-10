import { useState, useEffect } from 'react'
import type {
  TradingState,
  MasterInfo,
} from '../../shared/ipc-channels'

// ── Empty initial state — only real IPC data is shown ───────────────────────

const EMPTY_STATE: TradingState = {
  positions: [],
  balances: [
    { currency: 'USDT', free: 100000, used: 0, total: 100000 },
  ],
  totalPortfolioValue: 100000,
  riskScore: 0,
  timestamp: 0,
}

interface UseTradingStateResult {
  state: TradingState
  master: MasterInfo | null
}

export function useTradingState(): UseTradingStateResult {
  const [state, setState] = useState<TradingState>(EMPTY_STATE)
  const [master, setMaster] = useState<MasterInfo | null>(null)

  useEffect(() => {
    const api = (window as any).electronAPI
    if (!api) return

    // Request fresh state on mount
    if (typeof api.requestTradingState === 'function') {
      api.requestTradingState()
    }
    if (typeof api.requestGuardianMaster === 'function') {
      api.requestGuardianMaster()
    }

    // Subscribe to trading state updates
    let cleanupState: (() => void) | undefined
    if (typeof api.onTradingState === 'function') {
      cleanupState = api.onTradingState((data: TradingState) => {
        setState(data)
      })
    }

    // Subscribe to master info updates
    let cleanupMaster: (() => void) | undefined
    if (typeof api.onGuardianMaster === 'function') {
      cleanupMaster = api.onGuardianMaster((data: MasterInfo) => {
        setMaster(data)
      })
    }

    return () => {
      if (typeof cleanupState === 'function') cleanupState()
      if (typeof cleanupMaster === 'function') cleanupMaster()
    }
  }, [])

  return { state, master }
}
