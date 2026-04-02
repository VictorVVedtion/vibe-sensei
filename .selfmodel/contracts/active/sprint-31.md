# Sprint 31: Multi-Panel Layout + Window Management

## Task Preamble
你是 selfmodel 团队的 frontend colleague (Gemini)。铁律: Never Fallback, Never Mock, Never Lazy。原子提交 `sprint-31: <what>`。

## Objective
Create a professional multi-panel trading terminal layout with resizable panels, custom title bar, status bar, keyboard shortcuts for panel focus, and window state persistence.

## Assigned To
gemini

## Deliverables
- [ ] desktop/renderer/components/Layout.tsx — CSS Grid 3-panel layout with resizable dividers
- [ ] desktop/renderer/components/TitleBar.tsx — Custom frameless window title bar
- [ ] desktop/renderer/components/StatusBar.tsx — Bottom status bar
- [ ] desktop/renderer/styles/layout.css — Grid and panel styling
- [ ] desktop/renderer/App.tsx — Updated root component with full layout
- [ ] desktop/main/index.ts — Frameless window config + window state persistence
- [ ] desktop/main/preload.ts — Window control IPC (minimize, maximize, close)

## Acceptance Criteria

### 1. Layout Component (`desktop/renderer/components/Layout.tsx`)

CSS Grid 3-panel layout:
```
+------------------------------------------+
|              Title Bar                     |
+-------------------+----------------------+
|                   |      Chart Panel     |
|    Terminal       |                      |
|    Panel          +----------------------+
|                   |    Sidebar           |
|                   |    (placeholder)     |
+-------------------+----------------------+
|              Status Bar                   |
+------------------------------------------+
```

- Terminal: left panel, ~55% width
- Chart: top-right, ~45% width, ~60% height
- Sidebar placeholder: bottom-right, ~45% width, ~40% height (Sprint 32 fills this)
- Resizable horizontal divider between terminal and right panels
- Resizable vertical divider between chart and sidebar

Implement drag-to-resize:
- Track mouse events on divider elements
- Update CSS Grid template dynamically
- Min panel sizes: terminal 300px, chart 400px, sidebar 200px
- Cursor changes to `col-resize` / `row-resize` on dividers

### 2. Title Bar (`desktop/renderer/components/TitleBar.tsx`)

Custom frameless window title bar:
- `-webkit-app-region: drag` for the title bar area
- App name: "Vibe Sensei" with octopus emoji or small icon
- Window controls (minimize, maximize/restore, close) — `-webkit-app-region: no-drag`
- On macOS: traffic light style (or let native controls show)
- On Windows/Linux: custom minimize/maximize/close buttons

IPC for window controls:
```typescript
window.electronAPI.minimizeWindow()
window.electronAPI.maximizeWindow()
window.electronAPI.closeWindow()
```

### 3. Status Bar (`desktop/renderer/components/StatusBar.tsx`)

Bottom status bar showing:
- Connection status indicator (green dot = connected, yellow = reconnecting, red = disconnected)
- Current trading pair and last price
- Mode indicator: "Paper Trading" (or "Live" in future)
- Keyboard shortcut hint: "Cmd+1 Terminal | Cmd+2 Chart | Cmd+3 Sidebar"

### 4. Layout CSS (`desktop/renderer/styles/layout.css`)

- CSS Grid definitions for the 3-panel layout
- Divider styling (thin lines with hover highlight)
- Panel focus indicators (subtle border glow on focused panel)
- Responsive minimum sizes
- Smooth transitions for panel resize
- Integration with theme.css colors

### 5. Keyboard Shortcuts

Panel focus via Cmd+1 (Terminal), Cmd+2 (Chart), Cmd+3 (Sidebar):
- Register keyboard shortcuts in the renderer
- Focused panel gets a subtle visual indicator (e.g., border highlight)
- Terminal focus means xterm.js gets keyboard focus
- Chart focus is visual only (chart doesn't need keyboard input)

### 6. Window State Persistence

Use `electron-store` (already in dependencies) to persist:
- Window position (x, y)
- Window size (width, height)
- Panel ratios (terminal width %, chart height %)
- Whether window was maximized

Restore on app launch, save on window close/resize.

### 7. Frameless Window Config

Update `desktop/main/index.ts`:
- Set `frame: false` in BrowserWindow options (for custom title bar)
- OR on macOS use `titleBarStyle: 'hiddenInset'` for native traffic lights
- Set `transparent: false`, `backgroundColor: '#0a1a14'`
- Restore saved window bounds on launch

### 8. Window Control IPC

Update `desktop/main/preload.ts` to expose:
```typescript
minimizeWindow: () => ipcRenderer.send('window:minimize'),
maximizeWindow: () => ipcRenderer.send('window:maximize'),
closeWindow: () => ipcRenderer.send('window:close'),
isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
```

Update `desktop/main/index.ts` to handle these IPC events.

## Context Files (READ THESE FIRST)
- `desktop/renderer/App.tsx` — Current root (flexbox with Terminal + Chart)
- `desktop/renderer/components/TerminalPanel.tsx` — Terminal panel
- `desktop/renderer/components/ChartPanel.tsx` — Chart panel
- `desktop/renderer/styles/theme.css` — Current theme
- `desktop/main/index.ts` — Current Electron main (BrowserWindow setup)
- `desktop/main/preload.ts` — Current preload (PTY + UDF port)
- `desktop/shared/ipc-channels.ts` — Current IPC channels
- `desktop/package.json` — Dependencies (electron-store already included)

## Constraints
- Max execution time: 240s
- Only modify files under `desktop/` — do NOT touch `src/` or `web/`
- Use CSS Grid (not a heavy layout library)
- electron-store is already in desktop/package.json
- Atomic commits: `sprint-31: <what>`

当前状态: **ACTIVE**
