import { globalShortcut, type BrowserWindow } from 'electron'

/**
 * Register global keyboard shortcuts.
 *
 * - Cmd+Shift+V (Ctrl+Shift+V on Windows/Linux): toggle window visibility
 */
export function registerShortcuts(mainWindow: BrowserWindow): void {
  globalShortcut.register('CommandOrControl+Shift+V', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide()
    } else {
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

/**
 * Unregister all global shortcuts. Call on app will-quit.
 */
export function unregisterShortcuts(): void {
  globalShortcut.unregisterAll()
}
