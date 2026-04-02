# Sprint 29: Electron Scaffold + PTY Terminal

## Task Preamble
你是 selfmodel 团队的 senior fullstack engineer (Opus)。铁律: Never Fallback, Never Mock, Never Lazy。原子提交 `sprint-29: <what>`。

## Objective
Create the Electron desktop app scaffold with a working PTY terminal that renders the Bun REPL via xterm.js.

## Assigned To
opus

## Deliverables
- [ ] desktop/package.json — Electron + xterm + node-pty + Vite + React
- [ ] desktop/main/index.ts — Electron main process: BrowserWindow, lifecycle
- [ ] desktop/main/pty-manager.ts — Spawn Bun REPL via node-pty, handle I/O + resize
- [ ] desktop/renderer/index.html — Shell HTML for Vite
- [ ] desktop/renderer/index.tsx — React entry point
- [ ] desktop/renderer/App.tsx — Root component with TerminalPanel
- [ ] desktop/renderer/components/TerminalPanel.tsx — xterm.js connected to PTY via IPC
- [ ] desktop/shared/ipc-channels.ts — IPC channel name constants
- [ ] desktop/vite.config.ts — Vite config for renderer
- [ ] desktop/tsconfig.json — TypeScript config extending root
- [ ] desktop/scripts/dev.sh — Dev mode launcher

## Acceptance Criteria

### 1. Project Structure

Create `desktop/` directory at the project root with this structure:
```
desktop/
  package.json
  tsconfig.json
  vite.config.ts
  scripts/
    dev.sh
  main/
    index.ts
    pty-manager.ts
  renderer/
    index.html
    index.tsx
    App.tsx
    components/
      TerminalPanel.tsx
  shared/
    ipc-channels.ts
```

### 2. desktop/package.json

```json
{
  "name": "vibe-sensei-desktop",
  "version": "0.1.0",
  "description": "Vibe Sensei Desktop — AI Trading Terminal",
  "main": "main/index.ts",
  "scripts": {
    "dev": "bash scripts/dev.sh",
    "build:renderer": "vite build",
    "start": "electron ."
  },
  "dependencies": {
    "@xterm/xterm": "^5.5.0",
    "@xterm/addon-fit": "^0.10.0",
    "@xterm/addon-webgl": "^0.18.0",
    "electron-store": "^10.0.0",
    "node-pty": "^1.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "electron": "^34.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "vite": "^6.0.0",
    "typescript": "^5.7.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "concurrently": "^9.0.0"
  }
}
```

### 3. Electron Main Process (desktop/main/index.ts)

- Import `electron` (app, BrowserWindow, ipcMain)
- Import `PtyManager` from `./pty-manager`
- On `app.whenReady()`:
  1. Create BrowserWindow with:
     - width: 1400, height: 900, minWidth: 800, minHeight: 600
     - `webPreferences: { nodeIntegration: false, contextIsolation: true, preload: ... }`
     - NOTE: Since we need preload for IPC, create a simple `preload.ts` that exposes IPC via `contextBridge`
  2. In dev mode, load `http://localhost:5173` (Vite dev server)
  3. In production, load the built `renderer/index.html`
  4. Create PtyManager instance
  5. Set up IPC handlers for PTY channels

- IPC handlers:
  - `pty:input` (renderer → main): forward to PTY stdin
  - `pty:resize` (renderer → main): resize PTY (cols, rows)
  - PTY data callback → send `pty:data` to renderer window

- On `window-all-closed`: quit app (unless macOS)
- On `activate`: re-create window if none (macOS)

### 4. Preload Script (desktop/main/preload.ts)

```typescript
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  onPtyData: (callback: (data: string) => void) =>
    ipcRenderer.on('pty:data', (_event, data) => callback(data)),
  sendPtyInput: (data: string) =>
    ipcRenderer.send('pty:input', data),
  sendPtyResize: (cols: number, rows: number) =>
    ipcRenderer.send('pty:resize', cols, rows),
})
```

### 5. PTY Manager (desktop/main/pty-manager.ts)

```typescript
import * as pty from 'node-pty'

export class PtyManager {
  private process: pty.IPty | null = null
  private onDataCallback: ((data: string) => void) | null = null

  spawn(): void {
    // Spawn: bun run src/entrypoints/cli.tsx
    // with env: VIBE_SENSEI_DESKTOP=1, TERM=xterm-256color
    // shell: detect platform (bash on mac/linux, powershell on win)
    this.process = pty.spawn('bun', ['run', 'src/entrypoints/cli.tsx'], {
      name: 'xterm-256color',
      cols: 120,
      rows: 40,
      cwd: process.cwd(), // project root
      env: { ...process.env, VIBE_SENSEI_DESKTOP: '1', TERM: 'xterm-256color' },
    })
    
    this.process.onData((data) => {
      this.onDataCallback?.(data)
    })
  }

  onData(callback: (data: string) => void): void {
    this.onDataCallback = callback
  }

  write(data: string): void {
    this.process?.write(data)
  }

  resize(cols: number, rows: number): void {
    this.process?.resize(cols, rows)
  }

  kill(): void {
    this.process?.kill()
    this.process = null
  }
}
```

### 6. IPC Channels (desktop/shared/ipc-channels.ts)

```typescript
export const IPC = {
  PTY_DATA: 'pty:data',
  PTY_INPUT: 'pty:input',
  PTY_RESIZE: 'pty:resize',
} as const
```

### 7. Terminal Panel (desktop/renderer/components/TerminalPanel.tsx)

React component that:
1. Creates an xterm.js Terminal instance with FitAddon
2. Opens the terminal in a container div ref
3. Listens for `electronAPI.onPtyData()` and writes to terminal
4. On terminal `onData` event, sends to `electronAPI.sendPtyInput()`
5. On resize, calls FitAddon.fit() and sends `electronAPI.sendPtyResize()`
6. Dark theme matching Vibe Sensei brand (deep sea green accents)

```typescript
import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

export function TerminalPanel() {
  const containerRef = useRef<HTMLDivElement>(null)
  // ... terminal setup with useEffect
}
```

### 8. Vite Config (desktop/vite.config.ts)

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  root: 'renderer',
  build: {
    outDir: '../dist/renderer',
  },
  server: {
    port: 5173,
  },
})
```

### 9. Dev Script (desktop/scripts/dev.sh)

```bash
#!/bin/bash
cd "$(dirname "$0")/.."
npx concurrently \
  "npx vite --config vite.config.ts" \
  "sleep 3 && npx electron ."
```

### 10. Build Verification

After all files are created:
- `cd desktop && npm install` (or `bun install`) must succeed
- The Vite dev server should be startable (verify config is valid)
- The Electron app structure is correct

Do NOT worry about actually running the full app end-to-end in this sprint — that requires a display environment. Focus on creating correct, complete files that will work.

## Constraints
- Max execution time: 300s
- Create ONLY files under `desktop/` directory — do NOT modify any existing source files
- Do NOT add desktop/ to root package.json workspaces
- Use CommonJS for Electron main process files (Electron requires it)
- Use ESM for renderer files (Vite handles this)
- Atomic commits: `sprint-29: <what>`

当前状态: **ACTIVE**
