import { z } from 'zod'

export const IPC = {
  PTY_DATA: 'pty:data',
  PTY_INPUT: 'pty:input',
  PTY_RESIZE: 'pty:resize',
  PTY_EXIT: 'pty:exit',
  PTY_RESTART: 'pty:restart',
  PTY_RESTARTING: 'pty:restarting',
  PTY_READY: 'pty:ready',
  PTY_IS_READY: 'pty:isReady',
  UDF_PORT: 'udf:port',
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
  WINDOW_IS_MAXIMIZED: 'window:isMaximized',
  // Guardian & Trading IPC channels
  TRADING_STATE: 'trading:state',
  TRADING_STATE_REQUEST: 'trading:state:request',
  GUARDIAN_ALERT: 'guardian:alert',
  GUARDIAN_ALERT_NOTIFY: 'guardian:alert:notify',
  GUARDIAN_MASTER: 'guardian:master',
  GUARDIAN_MASTER_REQUEST: 'guardian:master:request',
} as const

// ── Zod validation schemas ─────────────────────────────────────────────────

export const TradingPositionSchema = z.object({
  symbol: z.string(),
  side: z.enum(['buy', 'sell']),
  quantity: z.number(),
  entryPrice: z.number(),
  currentPrice: z.number(),
  unrealizedPnl: z.number(),
  unrealizedPnlPercent: z.number(),
})

export const TradingBalanceSchema = z.object({
  currency: z.string(),
  free: z.number(),
  used: z.number(),
  total: z.number(),
})

export const TradingStateSchema = z.object({
  positions: z.array(TradingPositionSchema),
  balances: z.array(TradingBalanceSchema),
  totalPortfolioValue: z.number(),
  riskScore: z.number(),
  timestamp: z.number(),
})

export const GuardianAlertSchema = z.object({
  id: z.string(),
  severity: z.enum(['info', 'warning', 'critical', 'emergency']),
  masterName: z.string(),
  message: z.string(),
  checkName: z.string().optional(),
  timestamp: z.number(),
})

export const MasterInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  rarity: z.enum(['common', 'uncommon', 'rare', 'epic', 'legendary']),
  archetype: z.string(),
  quote: z.string(),
  stats: z.object({
    PRECISION: z.number(),
    PATIENCE: z.number(),
    AGGRESSION: z.number(),
    WISDOM: z.number(),
    SASS: z.number(),
  }),
})

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
