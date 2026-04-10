import { app, BrowserWindow, Menu, ipcMain, dialog, shell, net } from 'electron'
import { execSync, spawn as cpSpawn } from 'child_process'
import { randomUUID } from 'crypto'
import { unlinkSync, mkdirSync } from 'fs'
import * as path from 'path'
import * as os from 'os'
import Store from 'electron-store'
import { DesktopBridge } from './desktop-bridge'
import { IPC } from '../shared/ipc-channels'
import { setupIpcRouter, handleBridgeMessage } from './ipc-router'
import { createTray, destroyTray } from './tray'
import { createMenu } from './menu'
import { registerShortcuts, unregisterShortcuts } from './shortcuts'
import { showGuardianNotification } from './notifications'

interface WindowState {
  x: number | undefined
  y: number | undefined
  width: number
  height: number
  isMaximized: boolean
  terminalWidthPercent: number
  chartHeightPercent: number
}

const store = new Store<{ windowState: WindowState }>({
  defaults: {
    windowState: {
      x: undefined,
      y: undefined,
      width: 1400,
      height: 900,
      isMaximized: false,
      terminalWidthPercent: 55,
      chartHeightPercent: 60,
    },
  },
})

let mainWindow: BrowserWindow | null = null
let bunProcess: ReturnType<typeof cpSpawn> | null = null
let desktopBridge: DesktopBridge | null = null
let udfReady = false
let udfReadyPollTimer: ReturnType<typeof setInterval> | null = null

// Bridge file lives in the OS temp directory — unique per session via random UUID
const bridgeFilePath = path.join(
  os.tmpdir(),
  `vibe-sensei-bridge-${randomUUID()}.jsonl`,
)

const isDev = process.env.VIBE_FORCE_PROD === '1' ? false : !app.isPackaged
const isMac = process.platform === 'darwin'

function checkBunRuntime(): boolean {
  try {
    execSync('bun --version', { stdio: 'pipe', timeout: 5000 })
    return true
  } catch {
    return false
  }
}

async function showBunMissingDialog(): Promise<void> {
  const result = await dialog.showMessageBox({
    type: 'error',
    title: 'Bun Runtime Required',
    message: 'Vibe Sensei requires Bun to run.',
    detail:
      'The Bun JavaScript runtime was not found on your system. ' +
      'Vibe Sensei uses Bun to power its AI trading terminal.\n\n' +
      'Install Bun from https://bun.sh',
    buttons: ['Install Now', 'Quit'],
    defaultId: 0,
    cancelId: 1,
  })

  if (result.response === 0) {
    await shell.openExternal('https://bun.sh')
  }

  app.quit()
}

function getSavedWindowState(): WindowState {
  return store.get('windowState')
}

function saveWindowState(): void {
  if (!mainWindow) return
  const bounds = mainWindow.getBounds()
  const current = store.get('windowState')
  store.set('windowState', {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    isMaximized: mainWindow.isMaximized(),
    terminalWidthPercent: current.terminalWidthPercent,
    chartHeightPercent: current.chartHeightPercent,
  })
}

function createWindow(): void {
  const saved = getSavedWindowState()

  const windowOptions: Electron.BrowserWindowConstructorOptions = {
    width: saved.width,
    height: saved.height,
    minWidth: 800,
    minHeight: 600,
    title: 'Vibe Sensei',
    backgroundColor: '#0B0E14',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  }

  // Platform-specific frameless config
  if (isMac) {
    windowOptions.titleBarStyle = 'hiddenInset'
    windowOptions.trafficLightPosition = { x: 12, y: 12 }
  } else {
    windowOptions.frame = false
  }

  // Restore position if saved — validate it's on a visible display
  if (saved.x !== undefined && saved.y !== undefined) {
    const { screen } = require('electron')
    const displays = screen.getAllDisplays()
    const onScreen = displays.some((d: Electron.Display) =>
      saved.x! >= d.bounds.x && saved.x! < d.bounds.x + d.bounds.width &&
      saved.y! >= d.bounds.y && saved.y! < d.bounds.y + d.bounds.height,
    )
    if (onScreen) {
      windowOptions.x = saved.x
      windowOptions.y = saved.y
    }
  }

  mainWindow = new BrowserWindow(windowOptions)

  if (saved.isMaximized) {
    mainWindow.maximize()
  }

  // Show window when ready, with a fallback timeout
  let shown = false
  mainWindow.once('ready-to-show', () => {
    if (!shown) {
      shown = true
      mainWindow?.show()
    }
  })
  setTimeout(() => {
    if (!shown) {
      shown = true
      mainWindow?.show()
    }
  }, 3000)

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(
      path.join(__dirname, '..', 'renderer', 'index.html'),
    )
  }

  // Save window state on resize and move
  mainWindow.on('resize', saveWindowState)
  mainWindow.on('move', saveWindowState)
  mainWindow.on('maximize', saveWindowState)
  mainWindow.on('unmaximize', saveWindowState)

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

const UDF_PORT = 3456

function pollUdfReady(): void {
  if (udfReadyPollTimer) {
    clearInterval(udfReadyPollTimer)
    udfReadyPollTimer = null
  }
  udfReady = false

  udfReadyPollTimer = setInterval(() => {
    const request = net.request(`http://localhost:${UDF_PORT}/time`)
    request.on('response', (response) => {
      if (response.statusCode === 200) {
        udfReady = true
        if (udfReadyPollTimer) {
          clearInterval(udfReadyPollTimer)
          udfReadyPollTimer = null
        }
        mainWindow?.webContents.send(IPC.UDF_READY)
      }
    })
    request.on('error', () => {
      // UDF server not up yet — keep polling
    })
    request.end()
  }, 500)
}

function spawnBackend(): void {
  const projectRoot = path.resolve(__dirname, '..', '..', '..')

  bunProcess = cpSpawn('bun', ['run', 'src/entrypoints/cli.tsx'], {
    cwd: projectRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      VIBE_SENSEI_DESKTOP: '1',
      VIBE_SENSEI_BRIDGE_FILE: bridgeFilePath,
    },
  })

  bunProcess.stdout?.on('data', (data: Buffer) => {
    console.log(`[backend:stdout] ${data.toString().trimEnd()}`)
  })

  bunProcess.stderr?.on('data', (data: Buffer) => {
    console.error(`[backend:stderr] ${data.toString().trimEnd()}`)
  })

  bunProcess.on('exit', (code) => {
    console.log(`[backend] Bun process exited with code ${code}`)
    bunProcess = null
  })

  // Begin polling UDF server for readiness
  pollUdfReady()
}

function setupBridge(): void {
  desktopBridge = new DesktopBridge(bridgeFilePath)

  desktopBridge.onData((message) => {
    handleBridgeMessage(() => mainWindow, message)
  })

  desktopBridge.start()
}

function setupIpcHandlers(): void {
  ipcMain.handle(IPC.UDF_PORT, () => {
    try {
      return UDF_PORT
    } catch (err) {
      console.error('[IPC] UDF port error:', err)
      return null
    }
  })

  ipcMain.handle(IPC.UDF_IS_READY, () => {
    try {
      return udfReady
    } catch (err) {
      console.error('[IPC] UDF isReady error:', err)
      return false
    }
  })

  // Window control handlers
  ipcMain.on(IPC.WINDOW_MINIMIZE, () => {
    try {
      mainWindow?.minimize()
    } catch (err) {
      console.error('[IPC] Window minimize error:', err)
    }
  })

  ipcMain.on(IPC.WINDOW_MAXIMIZE, () => {
    try {
      if (mainWindow?.isMaximized()) {
        mainWindow.unmaximize()
      } else {
        mainWindow?.maximize()
      }
    } catch (err) {
      console.error('[IPC] Window maximize error:', err)
    }
  })

  ipcMain.on(IPC.WINDOW_CLOSE, () => {
    try {
      mainWindow?.close()
    } catch (err) {
      console.error('[IPC] Window close error:', err)
    }
  })

  ipcMain.handle(IPC.WINDOW_IS_MAXIMIZED, () => {
    try {
      return mainWindow?.isMaximized() ?? false
    } catch (err) {
      console.error('[IPC] Window isMaximized error:', err)
      return false
    }
  })

  // Guardian & Trading IPC router
  setupIpcRouter(() => mainWindow)
}

/** Ensure ~/.vibe-sensei/ directory exists for reverse bridge files. */
function ensureVibeSenseiDir(): void {
  try {
    mkdirSync(path.join(os.homedir(), '.vibe-sensei'), { recursive: true })
  } catch (err) {
    console.error('[startup] Failed to create ~/.vibe-sensei/:', err)
  }
}

app.whenReady().then(async () => {
  // Check Bun availability before proceeding
  if (!checkBunRuntime()) {
    await showBunMissingDialog()
    return
  }

  ensureVibeSenseiDir()
  createWindow()
  setupIpcHandlers()
  setupBridge()
  spawnBackend()

  // Desktop UX: tray, menu, shortcuts
  if (mainWindow) {
    createTray(mainWindow)
    Menu.setApplicationMenu(createMenu(mainWindow))
    registerShortcuts(mainWindow)
  }

  // Guardian alert notifications
  ipcMain.on(IPC.GUARDIAN_ALERT_NOTIFY, (_event, alert: { severity: string; masterName: string; message: string }) => {
    try {
      showGuardianNotification(alert)
    } catch (err) {
      console.error('[IPC] Guardian alert notify error:', err)
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
      spawnBackend()
    }
  })
})

app.on('will-quit', () => {
  unregisterShortcuts()
  destroyTray()
})

app.on('window-all-closed', () => {
  if (udfReadyPollTimer) {
    clearInterval(udfReadyPollTimer)
    udfReadyPollTimer = null
  }

  if (bunProcess) {
    try { bunProcess.kill() } catch { /* already dead */ }
    bunProcess = null
  }

  desktopBridge?.stop()
  desktopBridge = null

  // Clean up bridge file
  try {
    unlinkSync(bridgeFilePath)
  } catch {
    // File may not exist — that's fine
  }

  if (process.platform !== 'darwin') {
    app.quit()
  }
})
