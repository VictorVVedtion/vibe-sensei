# Sprint 59: Knowledge Compiler + Obsidian Wiki

## Preamble — Iron Rules
- No TODOs, no mocks, no empty catch blocks, no hardcoded secrets
- Complete error handling, functions <50 lines
- `bun run build` must pass after all changes
- Do NOT modify files outside the deliverables list without explicit reason
- Do NOT add new npm dependencies

## Objective
Create the LLM-powered knowledge compiler that reads JSONL events and generates a human-readable Markdown wiki. This is the "compile" step from Karpathy's LLM Knowledge Base pattern.

## Context Files (READ FIRST)
- `src/services/knowledge/event-store.ts` — readEvents() function (Sprint 57)
- `src/services/knowledge/types.ts` — event type definitions (Sprint 57)
- `src/buddy/diary.ts` — existing diary with getEnhancedSummary()
- `src/services/companion/gemini-client.ts` — existing Gemini API client (may be reusable)

## Deliverables

### 1. `src/services/knowledge/compiler.ts` — Knowledge compilation engine
- [ ] `compile(opts?: { full?: boolean }): Promise<CompileResult>` — main entry point
- [ ] Read events from JSONL via readEvents()
- [ ] Incremental compilation: track last-compiled event ID + byte offset in `~/.vibe-sensei/wiki/.compile-state.json`
- [ ] If GEMINI_API_KEY env var exists:
  - Send events batch to Gemini 2.5 Flash for compilation
  - First ever /compile: show consent prompt via console.log: "Vibe Sensei will send anonymized trading data to Gemini for analysis. Continue? (y/n)"
  - Track consent in `~/.vibe-sensei/.gemini-consent`
- [ ] If GEMINI_API_KEY missing OR user declined consent:
  - Fallback to template mode: generate pure statistical summaries without LLM
  - Template mode: count trades per symbol, compute win rates, list patterns, aggregate stats
- [ ] Atomic writes: write to .tmp file, rename to final path
- [ ] Track consecutive skip count. After 3 Gemini failures, emit warning string (for companionReaction)
- [ ] Return CompileResult: { articlesUpdated, eventsProcessed, mode: 'gemini' | 'template', warnings }

### 2. `src/services/knowledge/prompts.ts` — Gemini compilation prompts
- [ ] `buildCompilationPrompt(events: KBEvent[], existingWiki?: string): string`
- [ ] Prompt instructs Gemini to:
  - Analyze trading events and extract patterns
  - Generate/update wiki articles in markdown
  - Output structured JSON with article path and content
- [ ] Token budget: ~4000 tokens for events, ~2000 for existing wiki context

### 3. Wiki directory structure at `~/.vibe-sensei/wiki/`
- [ ] `INDEX.md` — master index with article summaries and links
- [ ] `patterns/` — behavioral pattern articles (one per discovered pattern)
- [ ] `markets/` — per-symbol analysis (e.g., `BTC-USDT.md`)
- [ ] `self/` — user profile, biases, risk profile evolution
- [ ] `sessions/` — session summaries
- [ ] `reports/` — compiled periodic reports
- [ ] All .md files with YAML frontmatter: date, type, tags
- [ ] Obsidian-compatible format (default on): [[wikilinks]] for cross-references

### 4. REPL slash command `/compile`
- [ ] Register `/compile` command in the REPL command system
- [ ] `/compile` — incremental compilation
- [ ] `/compile --full` — full recompile from scratch (delete .compile-state.json first)
- [ ] Show progress during compilation: "Compiling knowledge base... X events processed"
- [ ] Auto-trigger: after every 5 trades (count PlaceOrder tool calls via event-store)

### 5. Template mode (local fallback)
- [ ] When Gemini unavailable, generate wiki from pure computation:
  - `patterns/overview.md`: list all detected PatternTypes with counts
  - `markets/<SYMBOL>.md`: per-symbol stats (trade count, win rate, avg PnL, regime history)
  - `self/profile.md`: archetype, top patterns, strengths/weaknesses
  - `INDEX.md`: links to all generated articles
- [ ] Template mode produces valid wiki that queryRouter (Sprint 60) can read

## Acceptance Criteria
- [ ] `bun run build` passes
- [ ] `/compile` generates wiki directory with INDEX.md
- [ ] Without GEMINI_API_KEY, template mode generates valid wiki with stats
- [ ] With GEMINI_API_KEY, Gemini mode generates richer wiki articles
- [ ] Incremental compilation only processes new events
- [ ] `/compile --full` regenerates entire wiki
- [ ] Atomic writes — partial compile failure doesn't corrupt existing wiki

## Constraints
- Zero new npm dependencies
- Use Gemini 2.5 Flash (model: gemini-2.5-flash)
- REST API call (not SDK), reuse pattern from src/services/companion/gemini-client.ts if applicable
- Foreground execution (blocking, show progress)
- File permissions 0o600 for wiki files
- Never crash if Gemini API fails — always fall back gracefully
