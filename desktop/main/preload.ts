import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // ── PTY ──
  onPtyData: (callback: (data: string) => void) =>
    ipcRenderer.on('pty:data', (_event, data) => callback(data)),
  sendPtyInput: (data: string) => ipcRenderer.send('pty:input', data),
  sendPtyResize: (cols: number, rows: number) =>
    ipcRenderer.send('pty:resize', cols, rows),
  getUdfPort: () => ipcRenderer.invoke('udf:port'),

  // ── PTY Lifecycle ──
  onPtyExit: (callback: (exitCode: number) => void) => {
    const handler = (_event: any, exitCode: number) => callback(exitCode)
    ipcRenderer.on('pty:exit', handler)
    return () => {
      ipcRenderer.removeListener('pty:exit', handler)
    }
  },
  onPtyReady: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('pty:ready', handler)
    return () => {
      ipcRenderer.removeListener('pty:ready', handler)
    }
  },
  restartPty: () => ipcRenderer.send('pty:restart'),

  // ── Window Controls ──
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),

  // ── Trading State ──
  requestTradingState: () => ipcRenderer.send('trading:state:request'),
  onTradingState: (callback: (state: any) => void) => {
    const handler = (_event: any, state: any) => callback(state)
    ipcRenderer.on('trading:state', handler)
    return () => {
      ipcRenderer.removeListener('trading:state', handler)
    }
  },

  // ── Guardian Master ──
  requestGuardianMaster: () => ipcRenderer.send('guardian:master:request'),
  onGuardianMaster: (callback: (master: any) => void) => {
    const handler = (_event: any, master: any) => callback(master)
    ipcRenderer.on('guardian:master', handler)
    return () => {
      ipcRenderer.removeListener('guardian:master', handler)
    }
  },

  // ── Guardian Alerts ──
  onGuardianAlert: (callback: (alert: any) => void) => {
    const handler = (_event: any, alert: any) => callback(alert)
    ipcRenderer.on('guardian:alert', handler)
    return () => {
      ipcRenderer.removeListener('guardian:alert', handler)
    }
  },
})
