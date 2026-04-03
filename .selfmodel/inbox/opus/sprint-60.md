# Sprint 60: Knowledge Query Router

Read `.selfmodel/contracts/active/sprint-60.md` for full contract (if exists), otherwise use plan.md Sprint 60 description.

## Task
Create `src/services/knowledge/query-router.ts` — a separate routing layer that reads the wiki INDEX.md, determines if user questions are about their trading history, and injects relevant wiki content into Guardian context.

## Key Implementation Details
1. Create `src/services/knowledge/query-router.ts`:
   - `queryWiki(question: string): Promise<string | null>` — returns wiki content if relevant
   - Read `~/.vibe-sensei/wiki/INDEX.md`, identify relevant articles by symbol match > regime match > recency
   - Load matched article content (max ~100 tokens / ~400 chars)
   - Intent detection via keyword matching: ["my history", "my pattern", "my trades", "my win rate", "my performance", "how do I trade", "how have I done"]
   - Negative keywords (skip wiki routing): ["consult", "ask", "what would", "summon"]
   - Symbol detection: regex `/[A-Z]{2,10}\/[A-Z]{2,10}/` → check if `markets/<symbol>.md` exists
   - Return null if wiki empty/uncompiled → graceful degradation

2. Modify `src/buddy/persona.ts`:
   - Refactor `getPersonalizedAlertWithContext()` from 6 positional params to options object
   - Fix existing type mismatch: `EnhancedDiarySummary` should be `EnhancedPatternSummary` (check actual export name in diary.ts)
   - Add 5th knowledge layer at priority 2 (after regime, before portfolio)
   - Increase CONTEXT_TOKEN_BUDGET from ~260 to ~360 tokens
   - Knowledge layer content from queryWiki()

3. Modify `src/buddy/consultation.ts`:
   - In `buildConsultationPrompt()`, add optional `wikiContext` parameter
   - If wiki has relevant content for the queried topic, include it

4. Update callers of `getPersonalizedAlertWithContext()`:
   - `src/services/trading/guardian-observer.ts` — update call to use options object

Run `bun run build` to verify.
