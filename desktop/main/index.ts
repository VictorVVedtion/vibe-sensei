import { app, BrowserWindow, Menu, ipcMain, dialog, shell, net } from 'electron'
import { execSync } from 'child_process'
import { unlinkSync } from 'fs'
import * as path from 'path'
import * as os from 'os'
import Store from 'electron-store'
import { PtyManager } from './pty-manager'
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
let ptyManager: PtyManager | null = null
let desktopBridge: DesktopBridge | null = null
let ptyReady = false
let ptyReadyPollTimer: ReturnType<typeof setInterval> | null = null

// Bridge file lives in the OS temp directory — unique per session via PID
const bridgeFilePath = path.join(
  os.tmpdir(),
  `vibe-sensei-bridge-${process.pid}.jsonl`,
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
    windowOptions.vibrancy = 'under-window'
    windowOptions.visualEffectState = 'active'
    // Let vibrancy show through — backgroundColor must be transparent
    windowOptions.backgroundColor = '#00000000'
  } else {
    windowOptions.frame = false
  }

  // Restore position if saved
  if (saved.x !== undefined && saved.y !== undefined) {
    windowOptions.x = saved.x
    windowOptions.y = saved.y
  }

  mainWindow = new BrowserWindow(windowOptions)

  if (saved.isMaximized) {
    mainWindow.maximize()
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

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
    ptyManager?.clearCallbacks()
    mainWindow = null
  })
}

const UDF_PORT = 3456

function pollUdfReady(): void {
  if (ptyReadyPollTimer) {
    clearInterval(ptyReadyPollTimer)
    ptyReadyPollTimer = null
  }
  ptyReady = false

  ptyReadyPollTimer = setInterval(() => {
    const request = net.request(`http://localhost:${UDF_PORT}/time`)
    request.on('response', (response) => {
      if (response.statusCode === 200) {
        ptyReady = true
        if (ptyReadyPollTimer) {
          clearInterval(ptyReadyPollTimer)
          ptyReadyPollTimer = null
        }
        mainWindow?.webContents.send(IPC.PTY_READY)
      }
    })
    request.on('error', () => {
      // UDF server not up yet — keep polling
    })
    request.end()
  }, 500)
}

function setupPty(): void {
  ptyManager = new PtyManager()

  // Pass bridge file path to the Bun child process via env
  ptyManager.setEnv({ VIBE_SENSEI_BRIDGE_FILE: bridgeFilePath })

  ptyManager.onData((data: string) => {
    mainWindow?.webContents.send(IPC.PTY_DATA, data)
  })

  ptyManager.onExit((exitCode: number) => {
    mainWindow?.webContents.send(IPC.PTY_EXIT, exitCode)

    if (!ptyManager) return
    const result = ptyManager.restart()
    if (result.willRestart) {
      mainWindow?.webContents.send(IPC.PTY_RESTARTING, {
        attempt: result.attempt,
        delayMs: result.delayMs,
      })
    }
  })

  ptyManager.onReady(() => {
    // PTY process started — begin polling UDF server for true readiness
    pollUdfReady()
  })

  ptyManager.spawn()
}

function setupBridge(): void {
  desktopBridge = new DesktopBridge(bridgeFilePath)

  desktopBridge.onData((message) => {
    handleBridgeMessage(() => mainWindow, message)
  })

  desktopBridge.start()
}

function setupIpcHandlers(): void {
  // PTY handlers
  ipcMain.on(IPC.PTY_INPUT, (_event, data: string) => {
    try {
      ptyManager?.write(data)
    } catch (err) {
      console.error('[IPC] PTY input error:', err)
    }
  })

  ipcMain.on(IPC.PTY_RESIZE, (_event, cols: number, rows: number) => {
    try {
      ptyManager?.resize(cols, rows)
    } catch (err) {
      console.error('[IPC] PTY resize error:', err)
    }
  })

  ipcMain.on(IPC.PTY_RESTART, () => {
    try {
      if (!ptyManager) return
      ptyManager.kill()
      setupPty()
    } catch (err) {
      console.error('[IPC] PTY restart error:', err)
    }
  })

  ipcMain.handle(IPC.UDF_PORT, () => {
    try {
      return UDF_PORT
    } catch (err) {
      console.error('[IPC] UDF port error:', err)
      return null
    }
  })

  ipcMain.handle(IPC.PTY_IS_READY, () => {
    try {
      return ptyReady
    } catch (err) {
      console.error('[IPC] PTY isReady error:', err)
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

app.whenReady().then(async () => {
  // Check Bun availability before proceeding
  if (!checkBunRuntime()) {
    await showBunMissingDialog()
    return
  }

  createWindow()
  setupIpcHandlers()
  setupBridge()
  setupPty()

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
      setupPty()
    }
  })
})

app.on('will-quit', () => {
  unregisterShortcuts()
  destroyTray()
})

app.on('window-all-closed', () => {
  if (ptyReadyPollTimer) {
    clearInterval(ptyReadyPollTimer)
    ptyReadyPollTimer = null
  }

  ptyManager?.kill()
  ptyManager = null

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
