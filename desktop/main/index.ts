import { app, BrowserWindow, ipcMain } from 'electron'
import * as path from 'path'
import Store from 'electron-store'
import { PtyManager } from './pty-manager'
import { IPC } from '../shared/ipc-channels'

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
      preload: path.join(__dirname, 'preload.ts'),
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
      path.join(__dirname, '..', 'dist', 'renderer', 'index.html'),
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

function setupPty(): void {
  ptyManager = new PtyManager()

  ptyManager.onData((data: string) => {
    mainWindow?.webContents.send(IPC.PTY_DATA, data)
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
}

app.whenReady().then(() => {
  createWindow()
  setupIpcHandlers()
  setupPty()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
      setupPty()
    }
  })
})

app.on('window-all-closed', () => {
  ptyManager?.kill()
  ptyManager = null

  if (process.platform !== 'darwin') {
    app.quit()
  }
})
