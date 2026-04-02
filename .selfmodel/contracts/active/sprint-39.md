# Sprint 39: Race Conditions + Error Handling + IPC Validation

## Task Preamble
你是 selfmodel 团队的 backend engineer (Codex)。铁律: Never Fallback, Never Mock, Never Lazy。原子提交 `sprint-39: <what>`。

## Objective
Fix race conditions, add error handling to all IPC handlers, add Zod validation for IPC messages, and add React Error Boundary.

## Assigned To
codex

## Deliverables
- [ ] desktop/main/index.ts — PTY readiness handshake, error handling in IPC
- [ ] desktop/main/preload.ts — Add pty:ready check API
- [ ] desktop/shared/ipc-channels.ts — Add Zod validation schemas
- [ ] desktop/renderer/App.tsx — React Error Boundary
- [ ] desktop/renderer/hooks/useUdfPort.ts — Wait for PTY ready before returning port

## Acceptance Criteria

### 1. PTY Readiness Handshake (`desktop/main/index.ts`)
Add a `ptyReady` flag set to true when PTY is alive and UDF server is responding:
- After PTY spawns, poll `http://localhost:3456/time` every 500ms
- When it responds, set `ptyReady = true` and send `pty:ready` to renderer
- Add IPC handler: `ipcMain.handle('pty:isReady', () => ptyReady)`

### 2. Error Handling in IPC Handlers
Wrap ALL `ipcMain.on()` and `ipcMain.handle()` handlers in try/catch:
```typescript
ipcMain.on(IPC.PTY_INPUT, (_event, data: string) => {
  try {
    ptyManager?.write(data)
  } catch (err) {
    console.error('[IPC] PTY input error:', err)
  }
})
```

Apply to: PTY_INPUT, PTY_RESIZE, WINDOW_MINIMIZE, WINDOW_MAXIMIZE, WINDOW_CLOSE, and all other handlers.

### 3. Zod Validation Schemas (`desktop/shared/ipc-channels.ts`)
Add Zod schemas for the main IPC message types:
```typescript
import { z } from 'zod'

export const TradingPositionSchema = z.object({
  symbol: z.string(),
  side: z.enum(['buy', 'sell']),
  quantity: z.number(),
  entryPrice: z.number(),
  currentPrice: z.number(),
  unrealizedPnl: z.number(),
  unrealizedPnlPercent: z.number(),
})

export const TradingStateSchema = z.object({
  positions: z.array(TradingPositionSchema),
  balances: z.array(z.object({
    currency: z.string(),
    free: z.number(),
    used: z.number(),
    total: z.number(),
  })),
  lastUpdated: z.number(),
})

export const GuardianAlertSchema = z.object({
  severity: z.enum(['INFO', 'WARNING', 'CRITICAL', 'EMERGENCY']),
  masterName: z.string(),
  message: z.string(),
  checkName: z.string(),
  timestamp: z.number(),
})
```

Note: Zod is already a dependency in the root package.json. Add it to desktop/package.json too.

### 4. React Error Boundary (`desktop/renderer/App.tsx`)
Add an Error Boundary component:
```tsx
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null as Error | null }
  
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, color: '#ff4444', background: '#0a1a14', height: '100vh' }}>
          <h1>Something went wrong</h1>
          <pre>{this.state.error?.message}</pre>
          <button onClick={() => window.location.reload()}>Reload</button>
        </div>
      )
    }
    return this.props.children
  }
}
```

Wrap the root `<App />` component in `<ErrorBoundary>`.

### 5. UDF Port Hook Fix (`desktop/renderer/hooks/useUdfPort.ts`)
Wait for PTY readiness before returning port:
- On mount, check `electronAPI.isPtyReady()`
- If not ready, listen for `pty:ready` event
- Only return port number after PTY is confirmed ready

### 6. Build Passes
`bun run build` must complete without new errors.

## Context Files (READ THESE FIRST)
- `desktop/main/index.ts` — Current main process with IPC handlers
- `desktop/main/preload.ts` — Current preload APIs
- `desktop/shared/ipc-channels.ts` — Current channel definitions
- `desktop/renderer/App.tsx` — Current root component
- `desktop/renderer/hooks/useUdfPort.ts` — Current UDF port hook

## Constraints
- Max execution time: 180s
- Add `zod` to desktop/package.json (run npm install)
- Only modify files under `desktop/`
- Atomic commits: `sprint-39: <what>`

当前状态: **ACTIVE**
