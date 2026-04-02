# Sprint 15: Exchange Singleton Wiring

## Task Preamble
你是 selfmodel 团队的 backend engineer (Codex)。铁律: Never Fallback, Never Mock, Never Lazy。原子提交 `sprint-15: <what>`。

## Objective
Replace all `createExchange()` factory calls in trading tools with the global singleton `getConnectedExchange()` so paper trading state persists across tool calls within a session.

## Assigned To
codex

## Deliverables
- [ ] src/tools/OrderTool/OrderTool.ts — Use singleton
- [ ] src/tools/PositionTool/PositionTool.ts — Use singleton
- [ ] src/tools/BalanceTool/BalanceTool.ts — Use singleton
- [ ] src/services/trading-context.ts — Use singleton
- [ ] src/services/chart/udf-server.ts — Use singleton

## Acceptance Criteria

### 1. OrderTool (`src/tools/OrderTool/OrderTool.ts`)
- Line 9: Change import from `createExchange` to import `getConnectedExchange` from `../../services/exchange/singleton.js`
- Line 106: Replace `const exchange = createExchange({ mode: 'paper' })` with `const exchange = await getConnectedExchange()`
- Line 107: Remove `await exchange.connect()` (singleton handles connection)
- Keep all other logic unchanged

### 2. PositionTool (`src/tools/PositionTool/PositionTool.ts`)
- Line 8: Change import to `getConnectedExchange` from `../../services/exchange/singleton.js`
- Line 92: Replace `const exchange = createExchange({ mode: 'paper' })` with `const exchange = await getConnectedExchange()`
- Line 93: Remove `await exchange.connect()`

### 3. BalanceTool (`src/tools/BalanceTool/BalanceTool.ts`)
- Line 8: Change import to `getConnectedExchange` from `../../services/exchange/singleton.js`
- Line 80: Replace `const exchange = createExchange({ mode: 'paper' })` with `const exchange = await getConnectedExchange()`
- Line 81: Remove `await exchange.connect()`

### 4. Trading Context (`src/services/trading-context.ts`)
- Line ~113: Replace `const exchange = createExchange()` with `const exchange = await getConnectedExchange()`
- Import `getConnectedExchange` from `./exchange/singleton.js`
- Remove the `createExchange` import if no longer used

### 5. UDF Server (`src/services/chart/udf-server.ts`)
- Lines 32-51: Remove the local `getExchange()` function and `ensureConnected()` function
- Replace with import of `getConnectedExchange` from `../exchange/singleton.js`
- Update all internal usages to call `await getConnectedExchange()` instead of local cache
- This ensures chart server uses same exchange instance as trading tools

### 6. Singleton Already Exists
The singleton module at `src/services/exchange/singleton.ts` is ALREADY IMPLEMENTED with:
- `getExchange()` — returns cached instance or creates paper-mode
- `getConnectedExchange()` — lazy-init + auto-connect
- `resetExchange(config?)` — replace instance
Do NOT modify this file.

### 7. Build Passes
`bun run build` must complete without new errors.

## Context Files (READ THESE FIRST)
- `src/services/exchange/singleton.ts` — The singleton (DO NOT MODIFY)
- `src/services/exchange/index.ts` — Factory function (keep for other uses)
- `src/tools/OrderTool/OrderTool.ts` — Line 106: createExchange()
- `src/tools/PositionTool/PositionTool.ts` — Line 92: createExchange()
- `src/tools/BalanceTool/BalanceTool.ts` — Line 80: createExchange()
- `src/services/trading-context.ts` — Line 113: createExchange()
- `src/services/chart/udf-server.ts` — Lines 32-51: local exchange cache

## Key API
```typescript
// src/services/exchange/singleton.ts (DO NOT MODIFY)
export function getExchange(): ExchangeInterface
export async function getConnectedExchange(): Promise<ExchangeInterface>
export function resetExchange(config?: ExchangeConfig): void
```

## Constraints
- Max execution time: 120s
- Do NOT modify singleton.ts — only consume it
- Do NOT modify exchange/index.ts — createExchange() factory may be used elsewhere
- All 5 files must be updated atomically
- Paper trading state must persist: place order → check positions → see the order

当前状态: **ACTIVE**
