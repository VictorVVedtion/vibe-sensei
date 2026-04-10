import { ipcMain, type BrowserWindow } from 'electron'
import { writeFileSync, renameSync, appendFileSync } from 'fs'
import * as path from 'path'
import * as os from 'os'
import Store from 'electron-store'
import { showGuardianNotification } from './notifications'
import { IPC } from '../shared/ipc-channels'
import type {
  TradingState,
  MasterInfo,
  GuardianAlert,
  CompanionEmotion,
  CompanionSpeech,
  TiltState,
  PlaybookCard,
  TradeReview,
  AntiPortfolio,
  CouncilDebate,
  NewsAlert,
  ChartContext,
  TradeHistory,
  WeeklyReviewData,
  RiskMapData,
  CrossVenuePortfolio,
  VenueStatus,
} from '../shared/ipc-channels'
import type { BridgeMessage } from './desktop-bridge'

/**
 * IPC Router — routes messages between the Bun child process and the renderer.
 *
 * Architecture:
 *   Bun process --> Bridge File (JSONL) --> DesktopBridge --> IPC Router --> Renderer
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
let currentEmotion: CompanionEmotion | null = null
let currentSpeech: CompanionSpeech | null = null
let currentTilt: TiltState | null = null
let currentPlaybook: PlaybookCard | null = null
let currentReview: TradeReview | null = null
let currentAntiPortfolio: AntiPortfolio | null = null
let currentDebate: CouncilDebate | null = null
let currentNews: NewsAlert | null = null
let currentTradeHistory: TradeHistory | null = null
let currentWeeklyReview: WeeklyReviewData | null = null
let currentRiskMap: RiskMapData | null = null
let currentCrossVenuePortfolio: CrossVenuePortfolio | null = null
let currentVenueStatus: VenueStatus | null = null

const isDev = !!(process.env.NODE_ENV === 'development' || process.env.VIBE_DEV)

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

  // Handle request for companion emotion state
  ipcMain.on(IPC.COMPANION_EMOTION_REQUEST, () => {
    try {
      const win = getMainWindow()
      if (!win || !currentEmotion) return
      win.webContents.send(IPC.COMPANION_EMOTION, currentEmotion)
    } catch (err) {
      console.error('[IPC] Companion emotion request error:', err)
    }
  })

  // Handle request for trade history
  ipcMain.on(IPC.TRADE_HISTORY_REQUEST, () => {
    try {
      const win = getMainWindow()
      if (!win || !currentTradeHistory) return
      win.webContents.send(IPC.TRADE_HISTORY, currentTradeHistory)
    } catch (err) {
      console.error('[IPC] Trade history request error:', err)
    }
  })

  // Handle request for weekly review
  ipcMain.on(IPC.WEEKLY_REVIEW_REQUEST, () => {
    try {
      const win = getMainWindow()
      if (!win || !currentWeeklyReview) return
      win.webContents.send(IPC.WEEKLY_REVIEW, currentWeeklyReview)
    } catch (err) {
      console.error('[IPC] Weekly review request error:', err)
    }
  })

  // Handle request for risk map data
  ipcMain.on(IPC.RISK_MAP_REQUEST, () => {
    try {
      const win = getMainWindow()
      if (!win || !currentRiskMap) return
      win.webContents.send(IPC.RISK_MAP, currentRiskMap)
    } catch (err) {
      console.error('[IPC] Risk map request error:', err)
    }
  })

  // Handle request for cross-venue portfolio data
  ipcMain.on(IPC.CROSS_VENUE_PORTFOLIO + ':request', () => {
    try {
      const win = getMainWindow()
      if (!win || !currentCrossVenuePortfolio) return
      win.webContents.send(IPC.CROSS_VENUE_PORTFOLIO, currentCrossVenuePortfolio)
    } catch (err) {
      console.error('[IPC] Cross-venue portfolio request error:', err)
    }
  })

  // Handle request for venue status data
  ipcMain.on(IPC.VENUE_STATUS + ':request', () => {
    try {
      const win = getMainWindow()
      if (!win || !currentVenueStatus) return
      win.webContents.send(IPC.VENUE_STATUS, currentVenueStatus)
    } catch (err) {
      console.error('[IPC] Venue status request error:', err)
    }
  })

  // Handle layout state request — returns persisted panel sizes
  ipcMain.handle(IPC.LAYOUT_STATE_REQUEST, () => {
    try {
      const store = new Store()
      const windowState = store.get('windowState', {} as Record<string, unknown>)
      const ws = windowState as Record<string, unknown>
      return {
        terminalWidthPercent: typeof ws.terminalWidthPercent === 'number' ? ws.terminalWidthPercent : 55,
        chartHeightPercent: typeof ws.chartHeightPercent === 'number' ? ws.chartHeightPercent : 60,
      }
    } catch (err) {
      console.error('[IPC] Layout state request error:', err)
      return { terminalWidthPercent: 55, chartHeightPercent: 60 }
    }
  })

  // Reverse bridge: chart context from renderer
  ipcMain.on(IPC.CHART_CONTEXT, (_event, context: ChartContext) => {
    try {
      writeReverseBridgeFile('desktop-context.json', JSON.stringify(context))
    } catch (err) {
      console.error('[IPC] Chart context write error:', err)
    }
  })

  // Reverse bridge: playbook execute request from renderer
  ipcMain.on(IPC.PLAYBOOK_EXECUTE, (_event, request: { playbookId: string; params?: Record<string, unknown> }) => {
    try {
      const line = JSON.stringify({ ...request, timestamp: Date.now() }) + '\n'
      appendReverseBridgeFile('execute-requests.jsonl', line)
    } catch (err) {
      console.error('[IPC] Playbook execute write error:', err)
    }
  })
}

// ── Reverse bridge helpers ──────────────────────────────────────────────────

const VIBE_SENSEI_DIR = path.join(os.homedir(), '.vibe-sensei')

/** Atomically write a file into ~/.vibe-sensei/ using tmp+rename. */
function writeReverseBridgeFile(filename: string, content: string): void {
  const target = path.join(VIBE_SENSEI_DIR, filename)
  const tmp = target + '.tmp'
  writeFileSync(tmp, content, 'utf-8')
  renameSync(tmp, target)
}

/** Atomically append a line to a file in ~/.vibe-sensei/ using tmp+rename. */
function appendReverseBridgeFile(filename: string, line: string): void {
  const target = path.join(VIBE_SENSEI_DIR, filename)
  appendFileSync(target, line, 'utf-8')
}

// ── Dev-mode bridge logging ────────────────────────────────────────────────

function logBridgeMessage(message: BridgeMessage): void {
  if (isDev) {
    console.log('[bridge]', message.type, message.timestamp)
  }
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
  logBridgeMessage(message)
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

    case 'companion_emotion': {
      const emotion = message.data as CompanionEmotion
      currentEmotion = emotion
      if (win) {
        win.webContents.send(IPC.COMPANION_EMOTION, emotion)
      }
      break
    }

    case 'companion_speech': {
      const speech = message.data as CompanionSpeech
      currentSpeech = speech
      if (win) {
        win.webContents.send(IPC.COMPANION_SPEECH, speech)
      }
      break
    }

    case 'tilt_state': {
      const tilt = message.data as TiltState
      currentTilt = tilt
      if (win) {
        win.webContents.send(IPC.TILT_STATE, tilt)
      }
      break
    }

    case 'playbook_card': {
      const card = message.data as PlaybookCard
      currentPlaybook = card
      if (win) {
        win.webContents.send(IPC.PLAYBOOK_CARD, card)
      }
      break
    }

    case 'trade_review': {
      const review = message.data as TradeReview
      currentReview = review
      if (win) {
        win.webContents.send(IPC.TRADE_REVIEW, review)
      }
      break
    }

    case 'anti_portfolio': {
      const portfolio = message.data as AntiPortfolio
      currentAntiPortfolio = portfolio
      if (win) {
        win.webContents.send(IPC.ANTI_PORTFOLIO, portfolio)
      }
      break
    }

    case 'council_debate': {
      const debate = message.data as CouncilDebate
      currentDebate = debate
      if (win) {
        win.webContents.send(IPC.COUNCIL_DEBATE, debate)
      }
      break
    }

    case 'news_alert': {
      const news = message.data as NewsAlert
      currentNews = news
      if (win) {
        win.webContents.send(IPC.NEWS_ALERT, news)
      }
      break
    }

    case 'trade_history': {
      const history = message.data as TradeHistory
      currentTradeHistory = history
      if (win) {
        win.webContents.send(IPC.TRADE_HISTORY, history)
      }
      break
    }

    case 'weekly_review': {
      const review = message.data as WeeklyReviewData
      currentWeeklyReview = review
      if (win) {
        win.webContents.send(IPC.WEEKLY_REVIEW, review)
      }
      break
    }

    case 'risk_map': {
      const riskMap = message.data as RiskMapData
      currentRiskMap = riskMap
      if (win) {
        win.webContents.send(IPC.RISK_MAP, riskMap)
      }
      break
    }

    case 'cross_venue_portfolio': {
      const portfolio = message.data as CrossVenuePortfolio
      currentCrossVenuePortfolio = portfolio
      if (win) {
        win.webContents.send(IPC.CROSS_VENUE_PORTFOLIO, portfolio)
      }
      break
    }

    case 'venue_status': {
      const status = message.data as VenueStatus
      currentVenueStatus = status
      if (win) {
        win.webContents.send(IPC.VENUE_STATUS, status)
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
