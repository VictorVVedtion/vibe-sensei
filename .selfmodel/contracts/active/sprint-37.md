# Sprint 37: IPC Bridge Part 1 — Bun to Electron Socket

## Task Preamble
你是 selfmodel 团队的 senior fullstack engineer (Opus)。铁律: Never Fallback, Never Mock, Never Lazy。原子提交 `sprint-37: <what>`。

## Objective
Create a real data bridge between the Bun REPL process and the Electron main process, replacing placeholder data with live trading state.

## Assigned To
opus

## Deliverables
- [ ] src/services/desktop/bridge.ts — NEW: Desktop bridge (Bun side)
- [ ] desktop/main/desktop-bridge.ts — NEW: Bridge listener (Electron side)
- [ ] desktop/main/ipc-router.ts — Replace placeholder data with real state store
- [ ] desktop/main/index.ts — Initialize bridge listener
- [ ] src/services/trading/guardian-observer.ts — Emit to desktop bridge after alerts

## Acceptance Criteria

### 1. Bun-Side Bridge (`src/services/desktop/bridge.ts` — NEW)

When `VIBE_SENSEI_DESKTOP=1` is set, create a simple IPC mechanism. Use a temp file or stdout-based JSON protocol:

**Approach: JSON-over-stdout with markers**

The Bun process already writes to PTY stdout. We can't mix data there. Instead, use a **temp file protocol**:

```typescript
import { writeFileSync } from 'fs'

const BRIDGE_FILE = process.env.VIBE_SENSEI_BRIDGE_FILE || '/tmp/vibe-sensei-bridge.jsonl'

export function isDesktopMode(): boolean {
  return process.env.VIBE_SENSEI_DESKTOP === '1'
}

export function emitToDesktop(type: string, data: unknown): void {
  if (!isDesktopMode()) return
  try {
    const msg = JSON.stringify({ type, data, ts: Date.now() }) + '\n'
    writeFileSync(BRIDGE_FILE, msg, { flag: 'a' })
  } catch {
    // Never crash the trading engine for bridge errors
  }
}
```

**Types of messages:**
- `trading_state` — positions + balances after each trade
- `guardian_alert` — risk alerts from guardian observer
- `master_info` — companion assignment on startup

### 2. Electron-Side Bridge Listener (`desktop/main/desktop-bridge.ts` — NEW)

Watch the bridge file for new messages and forward to renderer:

```typescript
import { watchFile, readFileSync } from 'fs'

export class DesktopBridge {
  private filePath: string
  private lastSize = 0
  private onMessage: ((msg: { type: string; data: unknown }) => void) | null = null

  constructor(filePath: string) {
    this.filePath = filePath
  }

  start(): void {
    // Poll the file for new lines every 500ms
    // Or use fs.watchFile with a callback
    setInterval(() => this.checkForNewMessages(), 500)
  }

  private checkForNewMessages(): void {
    try {
      const content = readFileSync(this.filePath, 'utf-8')
      if (content.length <= this.lastSize) return
      
      const newContent = content.slice(this.lastSize)
      this.lastSize = content.length
      
      const lines = newContent.split('\n').filter(Boolean)
      for (const line of lines) {
        try {
          const msg = JSON.parse(line)
          this.onMessage?.(msg)
        } catch { /* skip malformed */ }
      }
    } catch { /* file may not exist yet */ }
  }

  onData(callback: (msg: { type: string; data: unknown }) => void): void {
    this.onMessage = callback
  }

  stop(): void {
    // Clear the bridge file
  }
}
```

### 3. Update IPC Router (`desktop/main/ipc-router.ts`)

Replace `PLACEHOLDER_STATE` with a real state store:

```typescript
let currentState: TradingState = {
  positions: [],
  balances: [{ currency: 'USDT', free: 100000, used: 0, total: 100000 }],
  lastUpdated: Date.now(),
}

let currentMaster: MasterInfo | null = null
```

When bridge receives `trading_state` message:
```typescript
bridge.onData((msg) => {
  if (msg.type === 'trading_state') {
    currentState = msg.data as TradingState
    pushTradingState(getMainWindow(), currentState)
  }
  if (msg.type === 'guardian_alert') {
    pushGuardianAlert(getMainWindow(), msg.data as GuardianAlert)
  }
  if (msg.type === 'master_info') {
    currentMaster = msg.data as MasterInfo
    pushMasterInfo(getMainWindow(), currentMaster)
  }
})
```

On `trading:state:request`, return `currentState` (not placeholder).

### 4. Wire into guardian-observer (`src/services/trading/guardian-observer.ts`)

After evaluating alerts, emit to desktop bridge:

```typescript
import { emitToDesktop, isDesktopMode } from '../desktop/bridge.js'

// In evaluateAfterToolCall(), after getting alerts:
if (isDesktopMode() && alerts.length > 0) {
  emitToDesktop('guardian_alert', {
    severity: topAlert.severity,
    masterName: topAlert.masterName,
    message: personalizedAlert,
    checkName: topAlert.checkName,
    timestamp: Date.now(),
  })
}
```

### 5. Wire into index.ts

- Pass bridge file path to Bun process via env: `VIBE_SENSEI_BRIDGE_FILE`
- Create DesktopBridge instance in main process
- Start bridge on app ready
- Stop bridge on app quit

### 6. Emit trading state after tool calls

In the trading tools (OrderTool, PositionTool, BalanceTool), after execution:
```typescript
if (isDesktopMode()) {
  const exchange = await getConnectedExchange()
  const positions = await exchange.getPositions()
  const balances = await exchange.getBalance()
  emitToDesktop('trading_state', { positions, balances, lastUpdated: Date.now() })
}
```

Or: emit from guardian-observer since it already runs after every trade tool call.

### 7. Build Passes
`bun run build` must complete without new errors.

## Context Files (READ THESE FIRST)
- `desktop/main/ipc-router.ts` — Current router with PLACEHOLDER_STATE
- `desktop/main/index.ts` — Main process setup
- `src/services/trading/guardian-observer.ts` — Runs after each trade tool call
- `src/services/exchange/singleton.ts` — Exchange singleton
- `src/services/exchange/types.ts` — Position, Balance types

## Constraints
- Max execution time: 300s
- The bridge must NEVER crash the trading engine — all bridge errors are silently caught
- Use temp file JSONL protocol (simplest, cross-platform)
- Atomic commits: `sprint-37: <what>`

当前状态: **ACTIVE**
