import { Menu, app, type BrowserWindow, type MenuItemConstructorOptions } from 'electron'

/**
 * Build the application menu bar.
 *
 * Sections:
 *   App    — About, Quit
 *   Edit   — Copy, Paste, Select All
 *   View   — Toggle panels (Cmd+1/2/3), Fullscreen, DevTools
 *   Window — Minimize, Zoom, Bring All to Front
 */
export function createMenu(mainWindow: BrowserWindow): Menu {
  const template: MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Terminal',
          accelerator: 'CommandOrControl+1',
          click: () => mainWindow.webContents.send('panel:focus', 'terminal'),
        },
        {
          label: 'Toggle Chart',
          accelerator: 'CommandOrControl+2',
          click: () => mainWindow.webContents.send('panel:focus', 'chart'),
        },
        {
          label: 'Toggle Sidebar',
          accelerator: 'CommandOrControl+3',
          click: () => mainWindow.webContents.send('panel:focus', 'sidebar'),
        },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { role: 'toggleDevTools' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
      ],
    },
  ]

  return Menu.buildFromTemplate(template)
}
