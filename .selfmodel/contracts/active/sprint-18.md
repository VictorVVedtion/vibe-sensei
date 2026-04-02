# Sprint 18: CLAUDE.md Update

## Task Preamble
你是 selfmodel 团队的 backend engineer (Codex)。铁律: Never Fallback, Never Mock, Never Lazy。原子提交 `sprint-18: <what>`。

## Objective
Rewrite CLAUDE.md (the project-level one at repo root) from Claude Code reverse-engineering docs to Vibe Sensei project guide. This file is read by AI assistants working on the codebase.

## Assigned To
codex

## Deliverables
- [ ] CLAUDE.md — Complete rewrite for Vibe Sensei

## Acceptance Criteria

### 1. Keep the Watchdog skill section
The CLAUDE.md at repo root has TWO parts:
- A large "Watchdog Skill Execution Instructions" section at the TOP — **KEEP THIS ENTIRELY UNCHANGED**
- A "# CLAUDE.md" section below it with project info — **REWRITE THIS PART ONLY**

### 2. Rewrite the Project Section
Replace everything from `# CLAUDE.md` down to end of file. New content:

**Project Overview:**
- Vibe Sensei: AI trading terminal with 52 master guardians
- Runtime: Bun, UI: React + Ink, Charts: TradingView
- Paper trading sandbox (100k USDT) via CCXT

**Commands:**
```bash
bun install
bun run dev          # Interactive REPL
bun run dev -- --web # REPL + chart server on :3456
bun run build        # Production bundle
```

**Architecture (brief):**
- Entry: `src/entrypoints/cli.tsx` → `src/main.tsx`
- Query loop: `src/query.ts` (tool execution + guardian observer)
- Guardian system: `src/buddy/` (52 masters, risk engine, personas, debates, ghosts)
- Trading: `src/services/exchange/` (CCXT paper/live, singleton)
- Trading tools: `src/tools/OrderTool/`, `PositionTool/`, `BalanceTool/`
- Charts: `src/services/chart/` (UDF server) + `web/` (frontend)
- UI: `src/screens/REPL.tsx`, `src/components/`

**Key Systems:**
- Guardian observer: `src/services/trading/guardian-observer.ts` — hooks into query loop
- Exchange singleton: `src/services/exchange/singleton.ts` — shared state across tools
- Persona engine: `src/buddy/persona.ts` — 9 archetypes, 5 stats, tone modifiers
- Risk checks: `src/buddy/checks/` — position_size, drawdown

**Working with This Codebase:**
- ~1341 tsc errors from decompilation — don't affect Bun runtime
- `feature()` always returns `false` — code behind feature flags is dead
- React Compiler output — `_c()` memoization calls are normal
- Selfmodel multi-agent orchestration available via `/selfmodel:sprint`

**Selfmodel section:** Keep the existing selfmodel section as-is (commands, agents, iron rules)

### 3. Build Passes
`bun run build` must still pass.

## Context Files
- `CLAUDE.md` — Current file (READ THE WHOLE THING to understand structure)
- `README.md` — Just-rewritten product README (align terminology)

## Constraints
- Max execution time: 120s
- Only modify `CLAUDE.md`
- KEEP the Watchdog section at the top completely unchanged
- KEEP the Selfmodel section at the bottom
- Only rewrite the middle "Project" section
- No Claude Code / Anthropic / decompilation / reverse-engineering references in the rewritten section

当前状态: **ACTIVE**
