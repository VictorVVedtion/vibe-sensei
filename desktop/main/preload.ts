import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  onPtyData: (callback: (data: string) => void) =>
    ipcRenderer.on('pty:data', (_event, data) => callback(data)),
  sendPtyInput: (data: string) => ipcRenderer.send('pty:input', data),
  sendPtyResize: (cols: number, rows: number) =>
    ipcRenderer.send('pty:resize', cols, rows),
  getUdfPort: () => ipcRenderer.invoke('udf:port'),
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
})
