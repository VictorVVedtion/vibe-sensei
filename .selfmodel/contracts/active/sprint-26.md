# Sprint 26: Guardian Check Utils Extraction + Observer Module Caching

## Task Preamble
你是 selfmodel 团队的 backend engineer (Codex)。铁律: Never Fallback, Never Mock, Never Lazy。原子提交 `sprint-26: <what>`。

## Objective
Extract duplicated utility functions from guardian risk checks into a shared module, and cache dynamic imports in the guardian observer to avoid re-importing on every tool call.

## Assigned To
codex

## Deliverables
- [ ] src/buddy/checks/utils.ts — NEW: shared portfolio calculation utilities
- [ ] src/buddy/checks/position-size.ts — Refactored to use shared utils
- [ ] src/buddy/checks/concentration.ts — Refactored to use shared utils
- [ ] src/buddy/checks/leverage.ts — Refactored to use shared utils
- [ ] src/services/trading/guardian-observer.ts — Cache dynamic imports after first load

## Acceptance Criteria

### 1. Shared Utils (`src/buddy/checks/utils.ts` — NEW FILE)

Extract these duplicated functions into a new shared module:

```typescript
import type { Position, Balance } from '../../services/exchange/types.js'

/** Calculate total portfolio value from balances (sum of all balance.total). */
export function totalPortfolioValue(balances: Balance[]): number {
  return balances.reduce((sum, b) => sum + b.total, 0)
}

/** Calculate notional value of a single position (|quantity| * currentPrice). */
export function positionNotional(pos: Position): number {
  return Math.abs(pos.quantity) * pos.currentPrice
}

/** Calculate total notional value across all positions. */
export function totalNotionalValue(positions: Position[]): number {
  return positions.reduce((sum, pos) => sum + positionNotional(pos), 0)
}
```

### 2. Refactor position-size.ts (`src/buddy/checks/position-size.ts`)

Current file has local `totalPortfolioValue()` (line 12-14) and `positionNotional()` (line 19-21).

Replace with imports from utils:
```typescript
import { totalPortfolioValue, positionNotional } from './utils.js'
```

Remove the local function definitions. Keep `checkPositionSize()` function unchanged.

### 3. Refactor concentration.ts (`src/buddy/checks/concentration.ts`)

Current file has local `totalPortfolioValue()` (line 12-14) and `positionNotional()` (line 16-18).

Replace with imports from utils:
```typescript
import { totalPortfolioValue, positionNotional } from './utils.js'
```

Remove the local function definitions. Keep `checkConcentration()` function unchanged.

### 4. Refactor leverage.ts (`src/buddy/checks/leverage.ts`)

Current file has local `totalNotionalValue()` (line 13-17) and `totalPortfolioValue()` (line 20-22).

Replace with imports from utils:
```typescript
import { totalPortfolioValue, totalNotionalValue } from './utils.js'
```

Remove the local function definitions. Keep `checkLeverage()` function unchanged.

### 5. Cache Dynamic Imports in Observer (`src/services/trading/guardian-observer.ts`)

Current code (line 39-45) re-imports modules on every tool call:
```typescript
const [guardianMod, companionMod, personaMod, exchangeMod] =
  await Promise.all([
    import('../../buddy/guardian.js'),
    import('../../buddy/companion.js'),
    import('../../buddy/persona.js'),
    import('../exchange/singleton.js'),
  ])
```

Cache the imported modules at module scope:
```typescript
let cachedModules: {
  guardianMod: typeof import('../../buddy/guardian.js')
  companionMod: typeof import('../../buddy/companion.js')
  personaMod: typeof import('../../buddy/persona.js')
  exchangeMod: typeof import('../exchange/singleton.js')
} | null = null

async function getModules() {
  if (!cachedModules) {
    const [guardianMod, companionMod, personaMod, exchangeMod] =
      await Promise.all([
        import('../../buddy/guardian.js'),
        import('../../buddy/companion.js'),
        import('../../buddy/persona.js'),
        import('../exchange/singleton.js'),
      ])
    cachedModules = { guardianMod, companionMod, personaMod, exchangeMod }
  }
  return cachedModules
}
```

Then use `getModules()` in `evaluateAfterToolCall()` instead of inline imports.

### 6. Build Passes
`bun run build` must complete without new errors.

## Context Files (READ THESE FIRST)
- `src/buddy/checks/position-size.ts` — 53 lines. Has local `totalPortfolioValue()` at line 12 and `positionNotional()` at line 19.
- `src/buddy/checks/concentration.ts` — 63 lines. Has local `totalPortfolioValue()` at line 12 and `positionNotional()` at line 16.
- `src/buddy/checks/leverage.ts` — 57 lines. Has local `totalNotionalValue()` at line 13 and `totalPortfolioValue()` at line 20.
- `src/services/trading/guardian-observer.ts` — 77 lines. Dynamic imports at line 39-45.
- `src/services/exchange/types.ts` — Type definitions (Position, Balance).
- `src/buddy/guardian.ts` — RiskGuardian class.

## Constraints
- Max execution time: 120s
- Do NOT change any exported function signatures
- Do NOT change the behavior of any risk check (same thresholds, same logic)
- Do NOT install any npm packages
- Atomic commits: `sprint-26: <what>`

当前状态: **ACTIVE**
