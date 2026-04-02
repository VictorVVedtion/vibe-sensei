# Sprint 17: README.md Rewrite

## Task Preamble
你是 selfmodel 团队的 senior fullstack engineer (Opus)。铁律: Never Fallback, Never Mock, Never Lazy。原子提交 `sprint-17: <what>`。

## Objective
Rewrite README.md from Claude Code reverse-engineering docs to Vibe Sensei product docs. The README should make someone understand what Vibe Sensei is, how to use it, and what makes it unique.

## Assigned To
opus

## Deliverables
- [ ] README.md — Complete rewrite

## Acceptance Criteria

### 1. Structure (these sections, in order)

**Header:**
- Product name: **Vibe Sensei**
- One-line tagline: AI trading terminal with 52 master guardians
- Brief description (2-3 sentences): What it is, what makes it unique

**Quick Start:**
```bash
bun install
bun run dev          # Terminal REPL
bun run dev -- --web # Terminal + Chart UI
```

**Features (bullet list):**
- 52 historical trading master guardians (deterministic assignment per user)
- Paper trading with 100k USDT sandbox (CCXT-powered)
- Real-time risk evaluation after every trade (position size, drawdown checks)
- Guardian personality system (9 archetypes, 5 stat dimensions)
- Cross-guardian consultation and adversarial debates
- Ghost warnings (SBF, Do Kwon, 3AC, Newton)
- TradingView charts via `--web` flag
- Trade cards + evolution diary

**The 52 Masters:**
A table or organized list showing all 52 masters grouped by rarity tier:
- Legendary (8): Jesse Livermore, George Soros, Warren Buffett, Benjamin Graham, Jim Simons, Sun Tzu, Satoshi Nakamoto, John von Neumann
- Epic (15+): list them
- Rare (14): list them
- Uncommon (10): list them  
- Common (1): William O'Neil

Use a collapsible `<details>` block for the full roster to keep README scannable.

**Guardian System:**
- Deterministic assignment via mulberry32 hash of user ID
- 5 stats: PRECISION, PATIENCE, AGGRESSION, WISDOM, SASS
- 9 archetypes: value_investor, trend_follower, macro_trader, quant, strategist, philosopher, first_principles, crypto_native, scientist
- Stats drive alert tone and personality

**Trading Tools:**
- PlaceOrder: market/limit/stop_loss orders
- GetPositions: view open positions
- GetBalance: check portfolio balance
- Paper mode by default (safe sandbox)

**Risk Engine:**
- Auto-evaluates after every trade tool call
- Position size check (>30% portfolio = warning)
- Drawdown check (>10% warning, >20% critical)
- Alerts delivered in guardian's voice and personality

**Architecture (brief):**
- Runtime: Bun
- UI: React + Ink (terminal)
- Charts: TradingView Lightweight Charts + UDF server
- Exchange: CCXT (paper + live modes)
- Build: `bun run build` → single-file bundle

**Commands:**
```bash
bun install          # Install dependencies
bun run dev          # Interactive REPL
bun run dev -- --web # REPL + chart server on :3456
bun run build        # Production bundle
```

**License:** Keep existing or add MIT

### 2. Style Guidelines
- English language (the user base is international)
- Concise, no fluff — each section earns its place
- Code examples where helpful
- No Claude Code references — this is Vibe Sensei now
- Do NOT include the ASCII logo in README (it's in the terminal only)

### 3. Build Passes
`bun run build` must still pass (README changes shouldn't affect this, but verify).

## Context Files (READ THESE for accurate content)
- `src/buddy/types.ts` — All 52 masters, names, quotes, rarities, stats
- `src/buddy/guardian.ts` — RiskGuardian class, severity levels
- `src/buddy/persona.ts` — Archetype system, tone modifiers
- `src/tools/OrderTool/OrderTool.ts` — Order placement API
- `src/services/chart/index.ts` — Chart server
- `src/buddy/checks/` — Risk check implementations
- `package.json` — Project metadata

## Constraints
- Max execution time: 180s
- Only modify `README.md`
- Do NOT reference Claude Code, Anthropic, or decompilation
- English only
- Keep under 300 lines — scannable, not a novel

当前状态: **ACTIVE**
