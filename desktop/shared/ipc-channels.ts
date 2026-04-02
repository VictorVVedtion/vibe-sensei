export const IPC = {
  PTY_DATA: 'pty:data',
  PTY_INPUT: 'pty:input',
  PTY_RESIZE: 'pty:resize',
  PTY_EXIT: 'pty:exit',
  PTY_RESTART: 'pty:restart',
  PTY_RESTARTING: 'pty:restarting',
  PTY_READY: 'pty:ready',
  UDF_PORT: 'udf:port',
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
  WINDOW_IS_MAXIMIZED: 'window:isMaximized',
  // Guardian & Trading IPC channels
  TRADING_STATE: 'trading:state',
  TRADING_STATE_REQUEST: 'trading:state:request',
  GUARDIAN_ALERT: 'guardian:alert',
  GUARDIAN_MASTER: 'guardian:master',
  GUARDIAN_MASTER_REQUEST: 'guardian:master:request',
} as const

// ── Guardian/Trading IPC payload types ──────────────────────────────────────

export interface TradingPosition {
  symbol: string
  side: 'buy' | 'sell'
  quantity: number
  entryPrice: number
  currentPrice: number
  unrealizedPnl: number
  unrealizedPnlPercent: number
}

export interface TradingBalance {
  currency: string
  free: number
  used: number
  total: number
}

export interface TradingState {
  positions: TradingPosition[]
  balances: TradingBalance[]
  totalPortfolioValue: number
  riskScore: number
  timestamp: number
}

export type AlertSeverity = 'info' | 'warning' | 'critical' | 'emergency'

export interface GuardianAlert {
  id: string
  severity: AlertSeverity
  masterName: string
  message: string
  timestamp: number
}

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

export interface MasterInfo {
  id: string
  name: string
  rarity: Rarity
  archetype: string
  quote: string
  stats: {
    PRECISION: number
    PATIENCE: number
    AGGRESSION: number
    WISDOM: number
    SASS: number
  }
}
