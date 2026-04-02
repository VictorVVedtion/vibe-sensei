import { app, BrowserWindow, Menu, ipcMain, dialog, shell } from 'electron'
import { execSync } from 'child_process'
import * as path from 'path'
import Store from 'electron-store'
import { PtyManager } from './pty-manager'
import { IPC } from '../shared/ipc-channels'
import { setupIpcRouter } from './ipc-router'
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

const isDev = !app.isPackaged
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
    backgroundColor: '#0a1a14',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: isDev
        ? path.join(__dirname, 'preload.ts')
        : path.join(__dirname, 'preload.js'),
    },
  }

  // Platform-specific frameless config
  if (isMac) {
    windowOptions.titleBarStyle = 'hiddenInset'
    windowOptions.trafficLightPosition = { x: 12, y: 12 }
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

function setupPty(): void {
  ptyManager = new PtyManager()

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
    mainWindow?.webContents.send(IPC.PTY_READY)
  })

  ptyManager.spawn()
}

const UDF_PORT = 3456

function setupIpcHandlers(): void {
  // PTY handlers
  ipcMain.on(IPC.PTY_INPUT, (_event, data: string) => {
    ptyManager?.write(data)
  })

  ipcMain.on(IPC.PTY_RESIZE, (_event, cols: number, rows: number) => {
    ptyManager?.resize(cols, rows)
  })

  ipcMain.on(IPC.PTY_RESTART, () => {
    if (!ptyManager) return
    ptyManager.kill()
    setupPty()
  })

  ipcMain.handle(IPC.UDF_PORT, () => UDF_PORT)

  // Window control handlers
  ipcMain.on(IPC.WINDOW_MINIMIZE, () => {
    mainWindow?.minimize()
  })

  ipcMain.on(IPC.WINDOW_MAXIMIZE, () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow?.maximize()
    }
  })

  ipcMain.on(IPC.WINDOW_CLOSE, () => {
    mainWindow?.close()
  })

  ipcMain.handle(IPC.WINDOW_IS_MAXIMIZED, () => {
    return mainWindow?.isMaximized() ?? false
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
  setupPty()

  // Desktop UX: tray, menu, shortcuts
  if (mainWindow) {
    createTray(mainWindow)
    Menu.setApplicationMenu(createMenu(mainWindow))
    registerShortcuts(mainWindow)
  }

  // Guardian alert notifications
  ipcMain.on('guardian:alert:notify', (_event, alert: { severity: string; masterName: string; message: string }) => {
    showGuardianNotification(alert)
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
  ptyManager?.kill()
  ptyManager = null

  if (process.platform !== 'darwin') {
    app.quit()
  }
})
