# Sprint 38: IPC Bridge Part 2 — Guardian Alerts + Real Data

## Task Preamble
你是 selfmodel 团队的 senior fullstack engineer (Opus)。铁律: Never Fallback, Never Mock, Never Lazy。原子提交 `sprint-38: <what>`。

## Objective
Wire the guardian system into the desktop bridge so the sidebar shows real master assignment, live alerts, and real-time trading data.

## Assigned To
opus

## Deliverables
- [ ] src/buddy/companion.ts — Emit master info to desktop bridge on startup
- [ ] src/services/trading/guardian-observer.ts — Enhance bridge emission with full state
- [ ] desktop/renderer/hooks/useTradingState.ts — Remove all placeholder/fallback data
- [ ] desktop/renderer/hooks/useGuardianAlerts.ts — Remove placeholder alerts

## Acceptance Criteria

### 1. Master Info Emission (`src/buddy/companion.ts`)
When `isDesktopMode()` is true, emit `master_info` with:
- Master name, rarity, archetype
- Quote
- 5 stats (precision, patience, aggression, wisdom, sass)

Call `emitToDesktop('master_info', {...})` when `getCompanion()` is first resolved.

### 2. Enhanced Guardian Observer (`src/services/trading/guardian-observer.ts`)
Sprint 37 already added basic bridge emission. Enhance it:
- Emit full `trading_state` after EVERY trade tool call (not just when alerts fire)
- Include all positions + all balances from exchange
- Emit `master_info` on first companion resolution (if not already emitted)

### 3. Clean Up Renderer Hooks
**`desktop/renderer/hooks/useTradingState.ts`:**
- Remove PLACEHOLDER_STATE and PLACEHOLDER_MASTER constants
- Start with empty state (no positions, default balance)
- Only show data that comes from IPC

**`desktop/renderer/hooks/useGuardianAlerts.ts`:**
- Remove placeholder alerts
- Start with empty array
- Only show alerts that come from IPC

### 4. Build Passes
`bun run build` must complete without new errors.

## Context Files (READ THESE FIRST)
- `src/services/desktop/bridge.ts` — Bridge API (emitToDesktop, isDesktopMode)
- `src/services/trading/guardian-observer.ts` — Already emits bridge data (Sprint 37)
- `src/buddy/companion.ts` — getCompanion() returns master assignment
- `src/buddy/types.ts` — Master, Companion types
- `desktop/renderer/hooks/useTradingState.ts` — Has placeholder data
- `desktop/renderer/hooks/useGuardianAlerts.ts` — Has placeholder alerts

## Constraints
- Max execution time: 300s
- Bridge errors must NEVER crash trading engine
- Atomic commits: `sprint-38: <what>`

当前状态: **ACTIVE**
