# Sprint 58: Counterfactual + Advice Accuracy

## Preamble — Iron Rules
- No TODOs, no mocks, no empty catch blocks, no hardcoded secrets
- Complete error handling, functions <50 lines
- `bun run build` must pass after all changes
- Do NOT modify files outside the deliverables list without explicit reason
- Do NOT add new npm dependencies

## Objective
Track whether users follow or ignore Guardian advice, and measure advice accuracy over time. This is the "data-driven coach" feature that turns Guardian from role-play to evidence-backed advisor.

## Context Files (READ FIRST)
- `src/services/knowledge/event-store.ts` — the JUST-CREATED event store (Sprint 57)
- `src/services/knowledge/types.ts` — event type definitions (Sprint 57)
- `src/services/trading/guardian-observer.ts` — where alerts are emitted (already hooks appendEvent)
- `src/buddy/diary.ts` — trade outcome tracking

## Deliverables

### 1. `src/services/knowledge/counterfactual.ts` — Counterfactual tracking engine
- [ ] `AlertIgnoredEvent` type: extends KBEvent with alertId, symbol, alertSeverity, alertCheckName
- [ ] Add AlertIgnoredEvent Zod schema to types.ts
- [ ] In-memory ring buffer: `recentAlerts: Array<{id, symbol, timestamp, severity, checkName}>` (max 20)
- [ ] `recordAlert(alert)`: push to ring buffer (called by guardian-observer after alert emitted)
- [ ] `checkIfIgnored(symbol, timestamp)`: scan ring buffer for same-symbol alert within 5 minutes. If found, appendEvent(AlertIgnoredEvent). Use Date.now() consistently.
- [ ] `getAdviceAccuracy(events: KBEvent[]): AdviceAccuracy` — compute from JSONL:
  - Per-archetype accuracy (% of trades where heeded advice was profitable)
  - Per-regime accuracy
  - Overall trend (last 20 vs previous 20)
- [ ] Export `AdviceAccuracy` type

### 2. Hook into guardian-observer.ts
- [ ] After alert is emitted (after existing appendEvent call), call `recordAlert()` to buffer the alert
- [ ] Dynamic import with try-catch, same pattern as Sprint 57

### 3. Hook into OrderTool or gateEvaluator
- [ ] When an order is placed (PlaceOrder tool call succeeds), call `checkIfIgnored(symbol, Date.now())`
- [ ] If ignored alert found, appendEvent(AlertIgnoredEvent) with correlation data
- [ ] The hook should be in the order execution path, after the order succeeds

### 4. Advice accuracy computation
- [ ] `computeAdviceAccuracy()`: read AlertEvents + AlertIgnoredEvents + TradeLogEvents from JSONL
- [ ] Correlate: for each AlertIgnoredEvent, find subsequent TradeLogEvent for same symbol
- [ ] Compute: heeded rate, accuracy when heeded, accuracy when ignored
- [ ] Return structured AdviceAccuracy object for later wiki compilation

## Acceptance Criteria
- [ ] `bun run build` passes
- [ ] When Guardian warns about BTC and user places BTC order within 5min, AlertIgnoredEvent is logged
- [ ] When Guardian warns about BTC and user waits >5min, no AlertIgnoredEvent
- [ ] `getAdviceAccuracy()` returns valid statistics from JSONL data
- [ ] All hooks fail silently — never block trading

## Constraints
- Zero new npm dependencies
- Use existing appendEvent/queueEvent from event-store.ts
- 5-minute correlation window (not 30)
- Symbol from order input (structured), not from alert message text
- Never block trading operations
