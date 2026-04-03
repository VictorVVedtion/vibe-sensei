# Sprint 61: Self-Audit + Pattern Discovery

## Task
Create `src/services/knowledge/auditor.ts` — periodic wiki health check and LLM-powered pattern discovery.

## Key Implementation Details

1. Create `src/services/knowledge/auditor.ts`:
   - `auditWiki(): Promise<AuditResult>` — run health check over wiki
   - Find inconsistencies: articles referencing non-existent symbols, outdated statistics
   - Impute missing data: events without corresponding wiki articles
   - Suggest new article candidates via cross-referencing patterns

2. Pattern Discovery:
   - During compilation (or as standalone audit), pass event batches to LLM
   - Prompt: "find patterns not captured by the existing 13 PatternType types in diary.ts"
   - The 13 types are: early_exit, late_entry, oversize, revenge_trade, good_discipline, fomo, general, time_of_day_bias, holding_period_bias, instrument_bias, position_size_bad, averaging_down_bad, pyramid_good
   - New discovered patterns → write to `~/.vibe-sensei/wiki/patterns/discovered/`
   - Notify user via companionReaction (import from AppStateStore or similar)

3. Wiki Health Score:
   - Completeness: % of events that have been compiled into wiki articles
   - Freshness: days since last compile
   - Coverage: % of traded symbols that have market articles
   - Return as `WikiHealthScore` object

4. Integration with compiler:
   - Export `getWikiHealthScore()` for use by Morning Brief (Sprint 62)
   - `auditWiki()` can be triggered via `/compile --audit` or standalone

5. Use Gemini 2.5 Flash for pattern discovery (same API as compiler.ts)
   - If no GEMINI_API_KEY: skip LLM discovery, only run statistical health check
   - Template-mode audit: check for missing articles, count coverage, compute freshness

Run `bun run build` to verify.
