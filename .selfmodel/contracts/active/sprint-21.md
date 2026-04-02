# Sprint 21: Additional Risk Checks (leverage, concentration, fat-finger)

## Task Preamble
你是 selfmodel 团队的 senior fullstack engineer (Opus)。铁律: Never Fallback, Never Mock, Never Lazy。原子提交 `sprint-21: <what>`。

## Objective
Add 3 new risk checks to the guardian system: leverage, concentration, and order validation (fat-finger). Register them in the check registry.

## Assigned To
opus

## Deliverables
- [ ] src/buddy/checks/leverage.ts — Leverage check
- [ ] src/buddy/checks/concentration.ts — Concentration check
- [ ] src/buddy/checks/order-validation.ts — Fat-finger price deviation check
- [ ] src/buddy/checks/index.ts — Register all 3 new checks

## Acceptance Criteria

### 1. Leverage Check (`src/buddy/checks/leverage.ts`)
- Export a `CheckFn` that calculates effective leverage: total position notional value / total portfolio value
- Thresholds: >2x = WARNING, >5x = CRITICAL
- Message includes current leverage ratio and the master's warning
- If no positions, return null (no alert)

### 2. Concentration Check (`src/buddy/checks/concentration.ts`)
- Export a `CheckFn` that finds the largest single position as % of portfolio
- Threshold: >40% in a single asset = WARNING, >70% = CRITICAL
- Message includes the concentrated symbol and percentage
- Ignore USDT/stablecoin balances when checking concentration

### 3. Order Validation / Fat-Finger Check (`src/buddy/checks/order-validation.ts`)
- Export a `CheckFn` that detects suspicious price deviations
- Check: if any position's entry price deviates >5% from current price at time of check, it may indicate a fat-finger order
- Threshold: >5% deviation = WARNING, >20% deviation = CRITICAL
- Message includes the symbol and deviation percentage
- This is a heuristic — check unrealizedPnlPercent as a proxy

### 4. Check Registration (`src/buddy/checks/index.ts`)
- Import all 3 new check functions
- Add to ALL_CHECKS array: `{ name: 'leverage', fn: checkLeverage }`, `{ name: 'concentration', fn: checkConcentration }`, `{ name: 'order-validation', fn: checkOrderValidation }`
- Existing checks (position-size, drawdown) must remain unchanged

### 5. Build Passes
`bun run build` must complete without new errors.

## CheckFn Signature (MUST match exactly)
```typescript
type CheckFn = (
  positions: Position[],
  balances: Balance[],
  masterId: string,
  masterName: string,
  masterQuote: string,
) => RiskAlert | null
```

## RiskAlert Interface
```typescript
interface RiskAlert {
  severity: 'INFO' | 'WARNING' | 'CRITICAL' | 'EMERGENCY'
  masterId: string
  masterName: string
  message: string
  checkName: string
  timestamp: Date
}
```

## Context Files (READ THESE FIRST)
- `src/buddy/checks/index.ts` — Check registry, ALL_CHECKS array
- `src/buddy/checks/position-size.ts` — Example check implementation
- `src/buddy/checks/drawdown.ts` — Example check implementation
- `src/buddy/guardian.ts` — RiskGuardian class, Severity type, RiskAlert interface
- `src/services/exchange/types.ts` — Position, Balance, Order types

## Constraints
- Max execution time: 180s
- Follow the exact same pattern as position-size.ts and drawdown.ts
- Each check in its own file
- Only modify checks/index.ts among existing files
- Import Severity from guardian.ts, types from exchange/types.ts

当前状态: **ACTIVE**
