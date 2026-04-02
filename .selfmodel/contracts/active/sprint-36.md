# Sprint 36: PTY Crash Recovery + Process Management

## Task Preamble
你是 selfmodel 团队的 senior fullstack engineer (Opus)。铁律: Never Fallback, Never Mock, Never Lazy。原子提交 `sprint-36: <what>`。

## Objective
Make the PTY subprocess robust: detect crashes, show error UI, auto-restart, proper cleanup on shutdown, and fix memory leaks.

## Assigned To
opus

## Deliverables
- [ ] desktop/main/pty-manager.ts — Exit detection, restart, process group kill, resize bounds
- [ ] desktop/main/index.ts — Wire pty:exit to renderer, handle restart
- [ ] desktop/main/preload.ts — Add pty:exit and pty:restart IPC
- [ ] desktop/shared/ipc-channels.ts — Add PTY lifecycle channels
- [ ] desktop/renderer/components/TerminalPanel.tsx — Error overlay when PTY dies, reconnect button

## Acceptance Criteria

### 1. PTY Exit Detection (`desktop/main/pty-manager.ts`)
- Add `onExitCallback` field and `onExit(cb)` method
- In the `onExit` handler, call the callback with exit code
- Add `isAlive()` method returning boolean

### 2. Auto-Restart with Backoff
- Add `restart()` method to PtyManager
- Exponential backoff: 1s, 2s, 4s, max 30s
- Max 5 restart attempts before giving up
- Reset attempt counter on successful 10-second run

### 3. Process Group Kill
- On Unix: use `process.kill(-pid, 'SIGTERM')` to kill process group
- On Windows: use `child_process.execSync('taskkill /pid ${pid} /t /f')`
- Wrap in try/catch (process may already be dead)

### 4. Resize Bounds Validation
- Validate: cols 1-500, rows 1-200
- Reject out-of-bounds silently

### 5. Fix Memory Leak
- `onData` callback holds reference to mainWindow
- Add `clearCallbacks()` method
- Call it when mainWindow closes (in index.ts)

### 6. Renderer Error Overlay
In TerminalPanel.tsx, when PTY exits:
- Show overlay: "Terminal disconnected (exit code N)"
- "Reconnecting..." during restart attempts
- "Reconnect" button if auto-restart exhausted
- Clear overlay when PTY reconnects

### 7. IPC Channels
Add: `PTY_EXIT: 'pty:exit'`, `PTY_RESTART: 'pty:restart'`, `PTY_READY: 'pty:ready'`

## Context Files (READ THESE FIRST)
- `desktop/main/pty-manager.ts` — Current PTY manager (60 lines). No exit handling.
- `desktop/main/index.ts` — setupPty() at line ~153. No crash handling.
- `desktop/main/preload.ts` — Current preload APIs.
- `desktop/renderer/components/TerminalPanel.tsx` — No error state.

## Constraints
- Max execution time: 180s
- Only modify files under `desktop/`
- Atomic commits: `sprint-36: <what>`

当前状态: **ACTIVE**
