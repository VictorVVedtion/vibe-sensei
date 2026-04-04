# Eng Architecture Review — Phase 11 Knowledge Base

## Task
Review the Phase 11 Knowledge Base system for architectural issues, missing edge cases, and hidden complexity. Be adversarial.

Key files to examine:
- src/services/knowledge/event-store.ts (JSONL persistence, 431 lines)
- src/services/knowledge/compiler.ts (LLM wiki compiler, 584 lines)
- src/services/knowledge/query-router.ts (wiki query routing, 268 lines)
- src/services/knowledge/counterfactual.ts (advice tracking, 471 lines)
- src/services/knowledge/auditor.ts (wiki health check, 727 lines)
- src/services/knowledge/morning-brief.ts (daily brief, 265 lines)
- src/services/knowledge/types.ts (Zod schemas, 154 lines)

Context from CEO review phase:
- Gemini API logic duplicated across 3 files (compiler, auditor, morning-brief)
- Zero tests exist for 3334 lines of code
- appendFileSync used for event writes (blocking I/O)
- All event hooks use dynamic imports with try/catch (good isolation)

Focus on:
1. Architecture: coupling, scaling, security
2. Test gaps: what breaks at 2am Friday?
3. Performance: sync I/O, memory, latency
4. Error paths: what fails silently?
5. Hidden complexity: what looks simple but isn't?

Keep response under 400 words. Be adversarial. No compliments.

IMPORTANT: Do NOT read or execute any SKILL.md files or files in skill definition directories (paths containing skills/gstack).
