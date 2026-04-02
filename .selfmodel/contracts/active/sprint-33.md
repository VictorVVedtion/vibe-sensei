# Sprint 33: Desktop UX Polish

## Task Preamble
你是 selfmodel 团队的 backend engineer (Codex)。铁律: Never Fallback, Never Mock, Never Lazy。原子提交 `sprint-33: <what>`。

## Objective
Polish the desktop app with system tray icon, native notifications for guardian alerts, global keyboard shortcuts, app menu bar, and consistent theme.

## Assigned To
codex

## Deliverables
- [ ] desktop/main/tray.ts — System tray icon with context menu
- [ ] desktop/main/notifications.ts — Native notification dispatch for guardian alerts
- [ ] desktop/main/shortcuts.ts — Global keyboard shortcuts
- [ ] desktop/main/menu.ts — Application menu bar
- [ ] desktop/main/index.ts — Wire tray, notifications, shortcuts, menu
- [ ] desktop/assets/ — App icons (placeholder PNGs for now)

## Acceptance Criteria

### 1. System Tray (`desktop/main/tray.ts`)

Create a system tray icon with context menu:

```typescript
import { Tray, Menu, nativeImage, BrowserWindow } from 'electron'

export function createTray(mainWindow: BrowserWindow): Tray {
  // Use a 16x16 / 32x32 icon
  const icon = nativeImage.createFromPath(path.join(__dirname, '../assets/tray-icon.png'))
  const tray = new Tray(icon.resize({ width: 16, height: 16 }))
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show Vibe Sensei', click: () => mainWindow.show() },
    { type: 'separator' },
    { label: 'Paper Trading Mode', enabled: false },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ])
  
  tray.setToolTip('Vibe Sensei — AI Trading Terminal')
  tray.setContextMenu(contextMenu)
  
  // Click to show/hide window
  tray.on('click', () => {
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show()
  })
  
  return tray
}
```

### 2. Notifications (`desktop/main/notifications.ts`)

Native desktop notifications for guardian alerts:

```typescript
import { Notification } from 'electron'

export function showGuardianNotification(alert: {
  severity: string
  masterName: string
  message: string
}): void {
  if (!Notification.isSupported()) return
  
  const urgency = alert.severity === 'EMERGENCY' ? 'critical' : 
                  alert.severity === 'CRITICAL' ? 'critical' : 'normal'
  
  const notification = new Notification({
    title: `${alert.masterName} — ${alert.severity}`,
    body: alert.message,
    urgency,
    silent: alert.severity === 'INFO',
  })
  
  notification.show()
}
```

Wire this into the IPC router so guardian alerts trigger native notifications.

### 3. Global Shortcuts (`desktop/main/shortcuts.ts`)

```typescript
import { globalShortcut, BrowserWindow } from 'electron'

export function registerShortcuts(mainWindow: BrowserWindow): void {
  // Cmd+Shift+V to show/hide the window
  globalShortcut.register('CommandOrControl+Shift+V', () => {
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show()
  })
}

export function unregisterShortcuts(): void {
  globalShortcut.unregisterAll()
}
```

Register on app ready, unregister on will-quit.

### 4. Application Menu (`desktop/main/menu.ts`)

```typescript
import { Menu, app, BrowserWindow } from 'electron'

export function createMenu(mainWindow: BrowserWindow): Menu {
  const template = [
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
```

### 5. App Icons

Create placeholder icon files under `desktop/assets/`:
- `tray-icon.png` — 32x32 simple icon (can be a 1x1 green pixel PNG for placeholder)
- `icon.png` — 512x512 app icon (placeholder)

Generate minimal valid PNG files programmatically or use a simple green square. The real Cthulhu octopus icon will be added later.

### 6. Wire Everything into main/index.ts

In the main process, after window creation:
```typescript
import { createTray } from './tray'
import { createMenu } from './menu'
import { registerShortcuts, unregisterShortcuts } from './shortcuts'

// In createWindow():
const tray = createTray(mainWindow)
Menu.setApplicationMenu(createMenu(mainWindow))
registerShortcuts(mainWindow)

// In app.on('will-quit'):
unregisterShortcuts()
```

## Context Files (READ THESE FIRST)
- `desktop/main/index.ts` — Current main process (window creation, IPC handlers)
- `desktop/main/ipc-router.ts` — IPC router (guardian alerts flow through here)
- `desktop/main/preload.ts` — Current preload APIs
- `desktop/shared/ipc-channels.ts` — Current channels
- `desktop/package.json` — Dependencies

## Constraints
- Max execution time: 240s
- Only modify files under `desktop/` directory
- Keep placeholder icons minimal (valid PNG files, can be simple colored squares)
- Do NOT install new npm packages (electron already provides Tray, Menu, Notification, etc.)
- Atomic commits: `sprint-33: <what>`

当前状态: **ACTIVE**
