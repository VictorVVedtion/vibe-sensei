# Sprint 57: Event Store Foundation

Read the contract at `.selfmodel/contracts/active/sprint-57.md` and implement all deliverables.

## Quick Start
1. Read the contract fully
2. Read all 6 context files listed
3. Create `src/services/knowledge/types.ts` first (Zod schemas)
4. Create `src/services/knowledge/event-store.ts` (core persistence)
5. Hook into the 6 existing modules
6. Implement diary.json migration
7. Run `bun run build` to verify

## Key Technical Decisions (from eng review)
- Sync callers use `queueEvent()` with `setImmediate` flush
- Async callers use direct `await appendEvent()` with try-catch
- Dynamic import with null fallback for event-store in all hooked modules
- diary.ts keeps diary.json — appendEvent is one-way emit (dual data source)
- regime.ts: only emit RegimeChangeEvent when regime actually changes (compare old vs new)
- ghost-warnings.ts: hook in GhostEngine.checkAll() method, NOT checkGhostTriggers()
- File permissions 0o600, JSONL 10MB rotation, process.on('beforeExit') flush
