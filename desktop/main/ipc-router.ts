import { ipcMain, type BrowserWindow } from 'electron'
import { showGuardianNotification } from './notifications'
import { IPC } from '../shared/ipc-channels'
import type {
  TradingState,
  MasterInfo,
  GuardianAlert,
} from '../shared/ipc-channels'

/**
 * IPC Router — routes messages between the Bun child process and the renderer.
 *
 * Architecture:
 *   Bun process (PTY) <--> IPC Router (main) <--> Renderer (React)
 *
 * The router currently serves placeholder data. When the Bun process implements
 * a structured message protocol (JSON over stdout or a dedicated IPC socket),
 * this router will parse those messages and forward them to the renderer.
 */

// ── Placeholder data ────────────────────────────────────────────────────────

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

// ── Router setup ────────────────────────────────────────────────────────────

export function setupIpcRouter(getMainWindow: () => BrowserWindow | null): void {
  // Handle request for current trading state
  ipcMain.on(IPC.TRADING_STATE_REQUEST, () => {
    const win = getMainWindow()
    if (!win) return
    win.webContents.send(IPC.TRADING_STATE, PLACEHOLDER_STATE)
  })

  // Handle request for guardian master info
  ipcMain.on(IPC.GUARDIAN_MASTER_REQUEST, () => {
    const win = getMainWindow()
    if (!win) return
    win.webContents.send(IPC.GUARDIAN_MASTER, PLACEHOLDER_MASTER)
  })
}

/**
 * Push a trading state update to the renderer.
 * Call this from the Bun process message handler when real data arrives.
 */
export function pushTradingState(
  win: BrowserWindow | null,
  state: TradingState,
): void {
  if (!win) return
  win.webContents.send(IPC.TRADING_STATE, state)
}

/**
 * Push a guardian alert to the renderer.
 * Call this from the Bun process message handler when an alert fires.
 */
export function pushGuardianAlert(
  win: BrowserWindow | null,
  alert: GuardianAlert,
): void {
  if (!win) return
  win.webContents.send(IPC.GUARDIAN_ALERT, alert)
  // Fire native OS notification for guardian alerts
  showGuardianNotification(alert)
}

/**
 * Push updated master info to the renderer.
 * Call this when the user's guardian assignment changes.
 */
export function pushMasterInfo(
  win: BrowserWindow | null,
  master: MasterInfo,
): void {
  if (!win) return
  win.webContents.send(IPC.GUARDIAN_MASTER, master)
}
