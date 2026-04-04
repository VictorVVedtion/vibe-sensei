# Sprint 70: Desktop Renderer Fix — xterm.js Terminal Panel

## Task Preamble
你是 selfmodel 团队的 senior fullstack engineer (Opus)。遵守以下铁律：
1. Never Fallback — 需要 500 行就写 500 行
2. Never Mock — 全部真实数据
3. Never Lazy — 无 TODO，每个 try 有完整 catch
4. 在 worktree 内工作
5. 每个独立变更单独 commit，commit message 格式: `sprint-70: <what changed>`
6. 禁止操作: rm -rf / git push / 修改 .selfmodel/ / 安装全局依赖 / 调用生产 API

## Objective
Fix the Desktop Electron app's blank screen. The window launches, PTY runs, UDF server starts, but the xterm.js terminal panel doesn't render.

## Assigned To
opus

## Background

### What works:
- Electron window opens with deep-sea blue (#0A1628) background
- macOS traffic lights visible
- Preload script loads (contextBridge.exposeInMainWorld works)
- PTY child process spawns (`bun run src/entrypoints/cli.tsx`)
- UDF server starts on port 3456

### What fails:
- Renderer shows blank dark screen — no xterm terminal, no chart panel, no sidebar
- Error on first attempt: `Cannot read properties of undefined (reading 'onPtyData')` — fixed by using compiled preload.js instead of .ts
- After fix: no crash but no content rendered

### Root cause candidates:
1. **React app fails to mount** — check `desktop/renderer/main.tsx` or entry point
2. **xterm.js not initializing** — TerminalPanel component may have dependency issues
3. **CSS not loading** — styles.css or Tailwind not bundled properly
4. **IPC data flow** — PTY sends data but renderer doesn't receive/render it
5. **Vite build output** — renderer built to `dist/renderer/` but paths may be wrong

## Deliverables

### Fix 1: Debug and fix renderer mounting
**Files:** `desktop/renderer/` — all components

1. Read `desktop/renderer/main.tsx` (or equivalent entry) to understand the React app structure
2. Read `desktop/renderer/Layout.tsx`, `TerminalPanel.tsx`, `ChartPanel.tsx`
3. Check if the HTML file (`dist/renderer/index.html`) correctly references the JS/CSS bundles
4. Check if React app mounts — add a simple `console.log('App mounted')` as debug
5. Check xterm.js initialization in TerminalPanel — does it create a Terminal instance and attach it?

### Fix 2: Fix project root path
**File:** `desktop/main/pty-manager.ts`

Line 32: `const projectRoot = path.resolve(__dirname, '..', '..')` is wrong for compiled code.
When running from `dist/main/index.js`, `__dirname = desktop/dist/main/`, so `../..` = `desktop/`, not repo root.

**Fix:** Use `path.resolve(__dirname, '..', '..', '..')` to get from `desktop/dist/main/` to repo root.

### Fix 3: Dev/prod mode detection
**File:** `desktop/main/index.ts`

Line 52: `const isDev = !app.isPackaged` — when running `npx electron dist/main/index.js`, `app.isPackaged = false` but we're using compiled code.

**Fix:** Add env override: `const isDev = process.env.VIBE_FORCE_PROD === '1' ? false : !app.isPackaged`
(This was done in-memory but needs to be committed)

### Fix 4: Verify renderer HTML paths
**File:** `desktop/dist/renderer/index.html`

Check that the built HTML references correct JS/CSS asset paths. The vite build should produce correct relative paths.

## Verification
1. `cd desktop && npm run build:main && npx vite build` succeeds
2. `VIBE_SENSEI_DESKTOP=1 VIBE_FORCE_PROD=1 npx electron dist/main/index.js` shows terminal with REPL output
3. xterm.js renders PTY output (Ink/React terminal UI visible)
4. Chart panel shows (if UDF server is running)

## Context
- Main process: `desktop/main/index.ts` (350 lines)
- PTY manager: `desktop/main/pty-manager.ts` (150 lines)
- Preload: `desktop/main/preload.ts` (80 lines)
- Renderer entry: `desktop/renderer/` (Layout, TerminalPanel, ChartPanel, etc.)
- Vite config: `desktop/vite.config.ts`
- node-pty was rebuilt for Electron 34 via `npx electron-rebuild -f -w node-pty`

## Timeout
240 minutes
