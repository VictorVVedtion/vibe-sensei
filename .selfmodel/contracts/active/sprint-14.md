# Sprint 14: --web Flag + Chart Server Startup

## Task Preamble
你是 selfmodel 团队的 backend engineer (Codex)。铁律: Never Fallback, Never Mock, Never Lazy。原子提交 `sprint-14: <what>`。

## Objective
Add `--web` CLI flag to main.tsx. When passed, start the UDF chart server alongside the REPL and auto-open the browser.

## Assigned To
codex

## Deliverables
- [ ] src/main.tsx — Add `--web` option and server startup logic

## Acceptance Criteria

### 1. CLI Flag Addition (`src/main.tsx`)
Add a new option to the Commander.js chain (before the `.action()` call around line 1006):
```typescript
.option('--web', 'Start web chart server alongside REPL')
```

### 2. Server Startup in Action Handler
Inside the action handler (after line 1007), when `options.web` is truthy:
- Dynamically import `startUdfServer` from `src/services/chart/index.js`
- Call `await startUdfServer(3456)` 
- Auto-open browser: use `Bun.spawn(['open', 'http://localhost:3456'])` (macOS)
  - Wrap in try-catch, non-fatal if open command fails
- Log to stderr: `console.error('📊 Chart server running at http://localhost:3456')`
- Server runs in background alongside the REPL — do NOT block on it
- Do NOT await the open command

### 3. Server Lifecycle
- Server starts BEFORE the REPL renders (so charts are ready when user sees terminal)
- Server stays alive for the entire session (no cleanup needed — process exit kills it)
- If server fails to start (port in use, etc.), log warning and continue with REPL anyway — do NOT abort

### 4. Build Passes
`bun run build` must complete without new errors.

## Context Files (READ THESE FIRST)
- `src/main.tsx` — Commander.js CLI, lines 968-1006 (option chain), line 1007+ (action handler)
- `src/services/chart/index.ts` — `startUdfServer(port): Promise<void>`, `stopUdfServer(): void`
- `src/services/chart/udf-server.ts` — UDF route definitions, Express app creation
- `web/index.html` — Frontend that loads TradingView Lightweight Charts

## Key API
```typescript
// src/services/chart/index.ts
export async function startUdfServer(port: number): Promise<void>
export function stopUdfServer(): void
```

## Constraints
- Max execution time: 120s
- Only modify `src/main.tsx` — do NOT touch chart server code
- Server failure must NOT prevent REPL from starting
- Keep the option simple — no --web-port or other sub-options for now
- Use dynamic import() for the chart module to avoid loading it when --web is not used

当前状态: **ACTIVE**
