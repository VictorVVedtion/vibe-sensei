import { ipcMain, type BrowserWindow } from 'electron'
import { showGuardianNotification } from './notifications'
import { IPC } from '../shared/ipc-channels'
import type {
  TradingState,
  MasterInfo,
  GuardianAlert,
} from '../shared/ipc-channels'
import type { BridgeMessage } from './desktop-bridge'

/**
 * IPC Router — routes messages between the Bun child process and the renderer.
 *
 * Architecture:
 *   Bun process (PTY) --> Bridge File (JSONL) --> DesktopBridge --> IPC Router --> Renderer
 *
 * The router maintains a currentState store that starts with a default 100k USDT
 * balance. Bridge messages from the Bun process update this store and push
 * changes to the renderer in real time.
 */

// ── Live state store ────────────────────────────────────────────────────────

const DEFAULT_STATE: TradingState = {
  positions: [],
  balances: [
    { currency: 'USDT', free: 100000, used: 0, total: 100000 },
  ],
  totalPortfolioValue: 100000,
  riskScore: 0,
  timestamp: Date.now(),
}

let currentState: TradingState = { ...DEFAULT_STATE }
let currentMaster: MasterInfo | null = null

// ── Router setup ────────────────────────────────────────────────────────────

export function setupIpcRouter(getMainWindow: () => BrowserWindow | null): void {
  // Handle request for current trading state — returns live data
  ipcMain.on(IPC.TRADING_STATE_REQUEST, () => {
    try {
      const win = getMainWindow()
      if (!win) return
      win.webContents.send(IPC.TRADING_STATE, currentState)
    } catch (err) {
      console.error('[IPC] Trading state request error:', err)
    }
  })

  // Handle request for guardian master info — returns live data if available
  ipcMain.on(IPC.GUARDIAN_MASTER_REQUEST, () => {
    try {
      const win = getMainWindow()
      if (!win || !currentMaster) return
      win.webContents.send(IPC.GUARDIAN_MASTER, currentMaster)
    } catch (err) {
      console.error('[IPC] Guardian master request error:', err)
    }
  })
}

// ── Bridge message handler ──────────────────────────────────────────────────

/**
 * Process a message from the Bun-side bridge and push updates to the renderer.
 * Called by the DesktopBridge onData callback in index.ts.
 */
export function handleBridgeMessage(
  getMainWindow: () => BrowserWindow | null,
  message: BridgeMessage,
): void {
  const win = getMainWindow()

  switch (message.type) {
    case 'trading_state': {
      const state = message.data as TradingState
      currentState = state
      if (win) {
        win.webContents.send(IPC.TRADING_STATE, currentState)
      }
      break
    }

    case 'guardian_alert': {
      const alert = message.data as GuardianAlert
      if (win) {
        win.webContents.send(IPC.GUARDIAN_ALERT, alert)
      }
      showGuardianNotification(alert)
      break
    }

    case 'master_info': {
      const master = message.data as MasterInfo
      currentMaster = master
      if (win) {
        win.webContents.send(IPC.GUARDIAN_MASTER, currentMaster)
      }
      break
    }
  }
}

// ── Push helpers (kept for direct programmatic use) ─────────────────────────

/**
 * Push a trading state update to the renderer.
 */
export function pushTradingState(
  win: BrowserWindow | null,
  state: TradingState,
): void {
  if (!win) return
  currentState = state
  win.webContents.send(IPC.TRADING_STATE, state)
}

/**
 * Push a guardian alert to the renderer.
 */
export function pushGuardianAlert(
  win: BrowserWindow | null,
  alert: GuardianAlert,
): void {
  if (!win) return
  win.webContents.send(IPC.GUARDIAN_ALERT, alert)
  showGuardianNotification(alert)
}

/**
 * Push updated master info to the renderer.
 */
export function pushMasterInfo(
  win: BrowserWindow | null,
  master: MasterInfo,
): void {
  if (!win) return
  currentMaster = master
  win.webContents.send(IPC.GUARDIAN_MASTER, master)
}
