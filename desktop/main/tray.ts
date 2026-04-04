import { Tray, Menu, app, nativeImage, type BrowserWindow } from 'electron'
import * as path from 'path'

let trayInstance: Tray | null = null

export function createTray(mainWindow: BrowserWindow): Tray {
  const iconPath = path.join(__dirname, '..', 'assets', 'TrayIconTemplate.png')
  const icon = nativeImage.createFromPath(iconPath)
  const tray = new Tray(icon.resize({ width: 16, height: 16 }))

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Vibe Sensei',
      click: () => {
        mainWindow.show()
        mainWindow.focus()
      },
    },
    { type: 'separator' },
    { label: 'Paper Trading Mode', enabled: false },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ])

  tray.setToolTip('Vibe Sensei — AI Trading Terminal')
  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide()
    } else {
      mainWindow.show()
      mainWindow.focus()
    }
  })

  trayInstance = tray
  return tray
}

export function destroyTray(): void {
  if (trayInstance) {
    trayInstance.destroy()
    trayInstance = null
  }
}
