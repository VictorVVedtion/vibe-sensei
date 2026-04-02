# Sprint 32: Guardian Sidebar + IPC Data Bridge

## Task Preamble
你是 selfmodel 团队的 senior fullstack engineer (Opus)。铁律: Never Fallback, Never Mock, Never Lazy。原子提交 `sprint-32: <what>`。

## Objective
Build the Guardian sidebar for the desktop app: master info card, live positions, portfolio balance, risk alert feed, and the IPC data bridge to receive guardian alerts and trading state from the Bun REPL process.

## Assigned To
opus

## Deliverables
- [ ] desktop/renderer/components/GuardianSidebar.tsx — Sidebar container
- [ ] desktop/renderer/components/guardian/MasterCard.tsx — Master info display
- [ ] desktop/renderer/components/guardian/PositionsList.tsx — Live positions table
- [ ] desktop/renderer/components/guardian/BalanceDisplay.tsx — Portfolio balance
- [ ] desktop/renderer/components/guardian/AlertFeed.tsx — Scrolling risk alert history
- [ ] desktop/renderer/components/guardian/RiskGauge.tsx — Visual risk meter
- [ ] desktop/renderer/hooks/useTradingState.ts — Trading state subscription hook
- [ ] desktop/renderer/hooks/useGuardianAlerts.ts — Alert event subscription hook
- [ ] desktop/main/ipc-router.ts — Route messages between Bun process and renderer
- [ ] desktop/main/preload.ts — Add guardian/trading IPC channels
- [ ] desktop/shared/ipc-channels.ts — Add guardian channels
- [ ] desktop/renderer/App.tsx — Wire GuardianSidebar into Layout

## Acceptance Criteria

### 1. MasterCard (`desktop/renderer/components/guardian/MasterCard.tsx`)

Display the user's assigned guardian master:
- Master name (e.g., "Warren Buffett", "Sun Tzu")
- Rarity tier with stars (Legendary ★★★★★, Epic ★★★★, Rare ★★★, etc.)
- Archetype label (e.g., "The Patient Oracle")
- Iconic quote in italics
- 5 stat bars: PRECISION, PATIENCE, AGGRESSION, WISDOM, SASS (0-100 scale, horizontal bars)
- Visual styling matching the deep sea green theme

Data comes via IPC `guardian:info` channel. For now, use placeholder data until the IPC bridge is connected.

### 2. PositionsList (`desktop/renderer/components/guardian/PositionsList.tsx`)

Live positions table:
- Columns: Symbol, Side (BUY/SELL), Qty, Entry, Current, PnL, PnL%
- PnL coloring: green for positive, red for negative
- Empty state: "No open positions"
- Data refreshes via IPC `trading:state` channel

### 3. BalanceDisplay (`desktop/renderer/components/guardian/BalanceDisplay.tsx`)

Portfolio balance breakdown:
- Total portfolio value (large number, prominent)
- Asset breakdown: USDT, BTC, ETH, etc. with amounts
- Simple horizontal bar chart showing allocation %
- Green/neutral styling

### 4. AlertFeed (`desktop/renderer/components/guardian/AlertFeed.tsx`)

Scrolling list of guardian risk alerts:
- Each alert shows: timestamp, severity icon (green/yellow/orange/red), master name, message
- Severity levels: INFO (green), WARNING (yellow), CRITICAL (orange), EMERGENCY (red)
- Auto-scroll to newest alert
- Max 50 alerts in display (FIFO)
- Empty state: "No alerts — all clear"

### 5. RiskGauge (`desktop/renderer/components/guardian/RiskGauge.tsx`)

Visual risk meter:
- Semicircular or horizontal gauge showing overall risk level
- Position size utilization bar (% of max)
- Drawdown indicator
- Color transitions: green (low risk) → yellow → orange → red (high risk)
- Can be a simple horizontal bar with color gradient and a marker

### 6. GuardianSidebar Container (`desktop/renderer/components/GuardianSidebar.tsx`)

Stacks all guardian components vertically:
```
+------------------+
| MasterCard       |
+------------------+
| RiskGauge        |
+------------------+
| PositionsList    |
+------------------+
| BalanceDisplay   |
+------------------+
| AlertFeed        |
+------------------+
```

Scrollable if content overflows. Accepts props for trading state, alerts, and master info.

### 7. IPC Data Hooks

`useTradingState()`:
```typescript
interface TradingState {
  positions: Position[]
  balances: Balance[]
  lastUpdated: number
}
// Subscribe to trading:state IPC channel
// Request fresh state on mount
```

`useGuardianAlerts()`:
```typescript
interface GuardianAlert {
  id: string
  severity: 'INFO' | 'WARNING' | 'CRITICAL' | 'EMERGENCY'
  masterName: string
  message: string
  checkName: string
  timestamp: number
}
// Subscribe to guardian:alert IPC channel
// Maintain alert history (max 50)
```

### 8. IPC Router (`desktop/main/ipc-router.ts`)

Route structured messages between the Bun child process and the renderer:
- Listen for JSON messages from PTY stdout (messages prefixed with a special marker like `\x1BVIBE_DATA:`)
- Parse the JSON payload
- Forward to renderer via appropriate IPC channel
- Handle: `guardian:alert`, `guardian:info`, `trading:state`

For the initial implementation, use a simple approach:
- The Bun process can emit data via a secondary channel (environment variable pointing to a Unix socket or named pipe)
- OR: Parse PTY output for specially marked JSON lines
- OR: Simply poll — have the renderer request state periodically via IPC and have the main process ask the Bun child

**Simplest approach for v1:** Use IPC `trading:state:request` from renderer → main process invokes a separate quick Bun command to get state. Or just use placeholder/mock data for now and wire the real bridge in a follow-up.

**Pragmatic approach:** Include both the full IPC infrastructure AND placeholder data that demonstrates the UI. Add a `// TODO: wire to real Bun process IPC` comment at the integration point.

### 9. Preload + IPC Channel Updates

Add to preload:
```typescript
onGuardianAlert: (callback) => ipcRenderer.on('guardian:alert', (_, data) => callback(data)),
onGuardianInfo: (callback) => ipcRenderer.on('guardian:info', (_, data) => callback(data)),
onTradingState: (callback) => ipcRenderer.on('trading:state', (_, data) => callback(data)),
requestTradingState: () => ipcRenderer.send('trading:state:request'),
```

### 10. Wire into Layout

Update `desktop/renderer/App.tsx` to pass GuardianSidebar as the sidebar content in Layout (replacing the placeholder).

## Context Files (READ THESE FIRST)
- `desktop/renderer/components/Layout.tsx` — 3-panel layout (sidebar is bottom-right placeholder)
- `desktop/renderer/App.tsx` — Current root with terminal + chart
- `desktop/renderer/styles/theme.css` — Current theme colors
- `desktop/renderer/styles/layout.css` — Current layout CSS
- `desktop/main/preload.ts` — Current preload APIs
- `desktop/shared/ipc-channels.ts` — Current channels
- `desktop/main/index.ts` — Current main process
- `src/buddy/types.ts` — Master roster, rarities, stats (reference for data structures)
- `src/buddy/guardian.ts` — RiskGuardian (reference for alert format)
- `src/services/exchange/types.ts` — Position, Balance types (reference)

## Constraints
- Max execution time: 300s
- Only modify files under `desktop/` — do NOT modify `src/` files in this sprint
- Use placeholder data for the initial UI (real IPC bridge can be refined later)
- All components must render correctly without a Bun process running
- Atomic commits: `sprint-32: <what>`

当前状态: **ACTIVE**
