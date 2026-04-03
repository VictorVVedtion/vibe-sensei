# Sprint 57: Event Store Foundation

## Preamble — Iron Rules
- No TODOs, no mocks, no empty catch blocks, no hardcoded secrets
- Complete error handling, functions <50 lines
- `bun run build` must pass after all changes
- Do NOT modify files outside the deliverables list without explicit reason
- Do NOT add new npm dependencies

## Objective
Create a JSONL event persistence layer that captures all trading events currently lost on restart. This is the foundation for the Trading Knowledge Base (Phase 11).

## Context Files (READ FIRST)
- `src/services/trading/guardian-observer.ts` — async hook point for AlertEvent (after guardian.evaluate())
- `src/buddy/ghost-warnings.ts` — SYNC hook point for GhostEvent (after checkAll returns warning)
- `src/state/circuit-state.ts` — SYNC hook points for CircuitBreakerEvent (recordTrade/recordLoss/recordWin)
- `src/buddy/diary.ts` — SYNC hook point for DiaryPatternEvent (recordTrade, recordTradeReport)
- `src/tools/PreTradeGateTool/gateEvaluator.ts` — async hook point for GateCheckEvent
- `src/services/market/regime.ts` — async hook point for RegimeChangeEvent (compare old vs new before emit)

## Deliverables

### 1. `src/services/knowledge/types.ts` — Event type definitions
- [ ] Define base `KBEvent` interface with `type`, `timestamp`, `id` (UUID)
- [ ] Define 7 event types with Zod schemas:
  - `TradeLogEvent` (NOT TradeEvent — avoid collision with diary.ts)
  - `AlertEvent` (severity, masterName, checkName, message, symbol)
  - `GhostEvent` (ghostId, ghostName, triggerReason)
  - `RegimeChangeEvent` (symbol, oldRegime, newRegime, confidence)
  - `CircuitBreakerEvent` (breakerType: trade_recorded|loss_recorded|win_recorded, details)
  - `GateCheckEvent` (symbol, side, status, failCount, warnCount)
  - `DiaryPatternEvent` (entryId, symbol, side, patternType, outcome)
- [ ] Export Zod schemas for validation

### 2. `src/services/knowledge/event-store.ts` — Core persistence
- [ ] `appendEvent(event: KBEvent): Promise<void>` — async JSONL append
- [ ] `queueEvent(event: KBEvent): void` — sync-safe wrapper using setImmediate flush
- [ ] `readEvents(opts?: { month?: string, type?: string }): Promise<KBEvent[]>` — read + parse JSONL
- [ ] JSONL files at `~/.vibe-sensei/events/YYYY-MM.jsonl`
- [ ] File permissions 0o600
- [ ] 10MB rotation: when file exceeds 10MB, start new file with `-02` suffix
- [ ] JSONL reader: per-line JSON.parse, skip corrupted lines with console.warn
- [ ] Ensure dir exists with mkdirSync on first write
- [ ] `process.on('beforeExit', flushQueue)` to prevent event loss

### 3. Hook into existing modules (6 files to modify)
- [ ] `guardian-observer.ts`: after `guardian.evaluate()` result, await appendEvent(AlertEvent). Dynamic import with null fallback. try-catch, never propagate.
- [ ] `ghost-warnings.ts`: in GhostEngine.checkAll() (NOT checkGhostTriggers convenience fn), queueEvent(GhostEvent) after cooldown.set(). Sync-safe.
- [ ] `circuit-state.ts`: queueEvent(CircuitBreakerEvent) in recordTrade(), recordLoss(), recordWin(). Sync-safe.
- [ ] `diary.ts`: queueEvent(DiaryPatternEvent) in GuardianDiary.recordTrade() after this.entries.push(). queueEvent for recordTradeReport(). Sync-safe. diary.ts KEEPS diary.json as its own working store — appendEvent is one-way emit.
- [ ] `gateEvaluator.ts`: await appendEvent(GateCheckEvent) after allChecks assembled. try-catch.
- [ ] `regime.ts`: await appendEvent(RegimeChangeEvent) in computeRegimeForSymbol(), but ONLY when regime changes (compare regimeCache.get(symbol)?.regime.regime !== newRegime). try-catch.

### 4. diary.json Migration
- [ ] On first startup, check for `~/.vibe-sensei/diary.json` (or configured diary path)
- [ ] If exists AND `~/.vibe-sensei/.migration-complete` does NOT exist:
  - Read diary.json
  - Convert each DiaryEntry to DiaryPatternEvent + TradeLogEvent
  - Convert each TradeReport to TradeLogEvent with R-multiple data
  - Append all to JSONL
  - Rename diary.json to diary.json.bak
  - Write `.migration-complete` marker
- [ ] If migration fails at any step: keep diary.json, log warning, continue
- [ ] diary.ts continues using diary.json for its own read/write — NOT replaced

## Acceptance Criteria
- [ ] `bun run build` passes
- [ ] Placing an order creates a TradeLogEvent in JSONL
- [ ] Guardian alert creates an AlertEvent in JSONL
- [ ] JSONL file is valid (each line is parseable JSON, Zod validates)
- [ ] Corrupted line in JSONL is skipped without crashing
- [ ] If event-store.ts import fails, all 6 hooked modules continue working normally

## Scoring Rubric
- Functionality: 30% — all 7 event types emitted correctly
- Code Quality: 25% — clean, DRY, follows codebase patterns
- Design: 20% — proper sync/async handling, graceful degradation
- Completeness: 15% — migration, rotation, permissions, beforeExit flush
- Originality: 10% — clever solutions to sync hook challenge

## Constraints
- Zero new npm dependencies (use native fs, crypto for UUID)
- Data dir: `~/.vibe-sensei/` (user home, NOT project root)
- Maximum 50 lines per function
- Dynamic import pattern for event-store in hooked modules
- Never block trading operations — all event failures are silent
