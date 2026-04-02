import { useState, useEffect } from 'react'
import type {
  TradingState,
  MasterInfo,
} from '../../shared/ipc-channels'

// ── Placeholder data for initial UI ─────────────────────────────────────────
// These render the sidebar beautifully without a running Bun process.

const PLACEHOLDER_STATE: TradingState = {
  positions: [
    {
      symbol: 'BTC/USDT',
      side: 'buy',
      quantity: 0.15,
      entryPrice: 84250.0,
      currentPrice: 85120.5,
      unrealizedPnl: 130.58,
      unrealizedPnlPercent: 1.03,
    },
    {
      symbol: 'ETH/USDT',
      side: 'buy',
      quantity: 2.5,
      entryPrice: 1885.0,
      currentPrice: 1862.4,
      unrealizedPnl: -56.5,
      unrealizedPnlPercent: -1.2,
    },
    {
      symbol: 'SOL/USDT',
      side: 'sell',
      quantity: 50,
      entryPrice: 135.8,
      currentPrice: 132.15,
      unrealizedPnl: 182.5,
      unrealizedPnlPercent: 2.69,
    },
  ],
  balances: [
    { currency: 'USDT', free: 82450.25, used: 17549.75, total: 100000.0 },
    { currency: 'BTC', free: 0.15, used: 0, total: 0.15 },
    { currency: 'ETH', free: 2.5, used: 0, total: 2.5 },
    { currency: 'SOL', free: 0, used: 50, total: 50 },
  ],
  totalPortfolioValue: 100000.0,
  riskScore: 28,
  timestamp: Date.now(),
}

const PLACEHOLDER_MASTER: MasterInfo = {
  id: 'nassim_taleb',
  name: 'Nassim Taleb',
  rarity: 'epic',
  archetype: 'philosopher',
  quote: 'Wind extinguishes a candle and energizes fire. Be the fire.',
  stats: {
    PRECISION: 62,
    PATIENCE: 78,
    AGGRESSION: 35,
    WISDOM: 95,
    SASS: 88,
  },
}

interface UseTradingStateResult {
  state: TradingState
  master: MasterInfo | null
}

export function useTradingState(): UseTradingStateResult {
  const [state, setState] = useState<TradingState>(PLACEHOLDER_STATE)
  const [master, setMaster] = useState<MasterInfo | null>(PLACEHOLDER_MASTER)

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
