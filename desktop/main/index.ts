import { app, BrowserWindow, ipcMain } from 'electron'
import * as path from 'path'
import { PtyManager } from './pty-manager'
import { IPC } from '../shared/ipc-channels'

let mainWindow: BrowserWindow | null = null
let ptyManager: PtyManager | null = null

const isDev = !app.isPackaged

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'Vibe Sensei',
    backgroundColor: '#0a0a0a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.ts'),
    },
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(
      path.join(__dirname, '..', 'dist', 'renderer', 'index.html'),
    )
  }

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
  ipcMain.on(IPC.PTY_INPUT, (_event, data: string) => {
    ptyManager?.write(data)
  })

  ipcMain.on(IPC.PTY_RESIZE, (_event, cols: number, rows: number) => {
    ptyManager?.resize(cols, rows)
  })

  ipcMain.handle(IPC.UDF_PORT, () => UDF_PORT)
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
