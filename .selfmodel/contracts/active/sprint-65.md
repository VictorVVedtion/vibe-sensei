# Sprint 65: Knowledge Base Security + Data Integrity Fixes

## Task Preamble
你是 selfmodel 团队的 senior fullstack engineer (Opus)。遵守以下铁律：
1. Never Fallback — 需要 500 行就写 500 行
2. Never Mock — 全部真实数据
3. Never Lazy — 无 TODO，每个 try 有完整 catch
4. 在 worktree 内工作
5. 每个独立变更单独 commit，commit message 格式: `sprint-65: <what changed>`
6. 禁止操作: rm -rf / git push / 修改 .selfmodel/ / 安装全局依赖 / 调用生产 API

## Objective
Fix 4 critical security and data integrity bugs found by autoplan review (CEO + Eng dual voices, Claude + Codex consensus) in the Phase 11 Knowledge Base system.

## Assigned To
opus

## Deliverables

### Fix 1: Path Traversal via LLM Output (P0 Security)
**File:** `src/services/knowledge/compiler.ts`

The `writeArticle()` function at ~line 137 accepts article paths from Gemini LLM responses and writes to `join(WIKI_DIR, path)` without validation. A prompt-injected or malformed Gemini response can specify paths like `../../.bashrc` and escape WIKI_DIR.

**Fix:**
- In `writeArticle()`, after computing `fullPath = join(WIKI_DIR, relativePath)`, validate that `fullPath.startsWith(WIKI_DIR)`
- Reject any `relativePath` containing `..` segments
- Reject absolute paths (starting with `/`)
- Also validate in `isValidArticle()` at ~line 242 that the `path` field doesn't contain `..`
- Log a warning when rejecting: `[KB Compiler] rejected unsafe article path: <path>`

### Fix 2: Incremental Compile Data Loss (P0 Data Integrity)
**File:** `src/services/knowledge/compiler.ts`

The `compile()` function (~line 469) filters to only `newEvents` then passes them to `compileWithTemplate()` or `compileWithLLM()`. Template mode regenerates canonical files (`patterns/overview.md`, `self/profile.md`, `INDEX.md`) from only the new events, erasing all historical compiled knowledge. One new trade can wipe months of compiled wisdom.

**Fix for template mode (`compileWithTemplate()` at ~line 281):**
- Change `compile()` to pass ALL events to `compileWithTemplate()`, not just `newEvents`
- The template mode does statistical aggregation, so it should always compute from the full dataset
- Keep the `newEvents` filter only for determining whether compilation is needed (if 0 new events, skip)

**Fix for Gemini mode (`compileWithLLM()` at ~line 253):**
- Read existing wiki articles and pass them as context to the LLM prompt
- The prompt already has an "EXISTING WIKI CONTEXT" section in `prompts.ts` — make sure `compile()` actually reads and passes `existingIndex` content
- Verify that `buildCompilationPrompt(events, existingWiki)` receives the current wiki content

### Fix 3: API Key in URL → Header (P1 Security)
**Files:** `src/services/knowledge/compiler.ts`, `src/services/knowledge/auditor.ts`, `src/services/knowledge/morning-brief.ts`

All three files duplicate Gemini API call logic and pass the API key as a URL query parameter (`?key=${apiKey}`). This exposes the key in process listings, proxy logs, and debug traces.

**Fix:**
- Create `src/services/knowledge/gemini-client.ts` with a shared `callGemini(prompt, options)` function
- Move the API key from URL query param to `x-goog-api-key` HTTP header
- The shared client should accept: `{ prompt: string, systemInstruction?: string, maxTokens?: number, timeoutMs?: number }`
- Return `{ text: string } | null` (null on failure)
- Handle: timeout, rate limit (429), auth error (401/403), malformed response
- Update compiler.ts, auditor.ts, and morning-brief.ts to use the shared client
- Remove the duplicated `callLLM()` / equivalent functions from each file
- Preserve each caller's specific timeout and token settings via the options parameter

### Fix 4: File Sort Order After Rotation (P1 Data Integrity)
**File:** `src/services/knowledge/event-store.ts`

In `listEventFiles()` at ~line 252, files are sorted lexicographically. After 10MB rotation creates suffixed files, `2026-04-02.jsonl` sorts before `2026-04.jsonl` because `-` (ASCII 45) < `.` (ASCII 46). This breaks chronological event ordering.

**Fix:**
- Implement custom sort in `listEventFiles()` that sorts base files before their rotated variants within each month prefix
- Example correct order: `2026-04.jsonl`, `2026-04-02.jsonl`, `2026-04-03.jsonl`, `2026-05.jsonl`
- Approach: parse filenames to extract month prefix and optional suffix number, sort by (month, suffix)

## Verification
After all fixes, verify:
1. `bun run build` succeeds
2. No new TypeScript errors introduced in the knowledge/ directory
3. Each fix has its own commit

## Context
- Event store: `src/services/knowledge/event-store.ts` (431 lines)
- Compiler: `src/services/knowledge/compiler.ts` (584 lines)
- Auditor: `src/services/knowledge/auditor.ts` (727 lines)
- Morning brief: `src/services/knowledge/morning-brief.ts` (265 lines)
- Types: `src/services/knowledge/types.ts` (154 lines)
- Prompts: `src/services/knowledge/prompts.ts` (145 lines)

## Timeout
240 minutes
