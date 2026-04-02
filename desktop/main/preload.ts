import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  onPtyData: (callback: (data: string) => void) =>
    ipcRenderer.on('pty:data', (_event, data) => callback(data)),
  sendPtyInput: (data: string) => ipcRenderer.send('pty:input', data),
  sendPtyResize: (cols: number, rows: number) =>
    ipcRenderer.send('pty:resize', cols, rows),
  getUdfPort: () => ipcRenderer.invoke('udf:port'),
})
