# Sprint 65: Knowledge Base Security + Data Integrity Fixes

Read the full sprint contract at `.selfmodel/contracts/active/sprint-65.md` and implement all 4 fixes.

Key files to modify:
1. `src/services/knowledge/compiler.ts` — path traversal fix + incremental compile fix
2. `src/services/knowledge/event-store.ts` — file sort order fix
3. `src/services/knowledge/auditor.ts` — replace inline Gemini call with shared client
4. `src/services/knowledge/morning-brief.ts` — replace inline Gemini call with shared client
5. NEW: `src/services/knowledge/gemini-client.ts` — shared Gemini API client

Each fix gets its own commit. Verify `bun run build` at the end.
