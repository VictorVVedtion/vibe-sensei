# Sprint 68: Guardian System Bug Fixes

## Task Preamble
你是 selfmodel 团队的 senior fullstack engineer (Opus)。遵守以下铁律：
1. Never Fallback — 需要 500 行就写 500 行
2. Never Mock — 全部真实数据
3. Never Lazy — 无 TODO，每个 try 有完整 catch
4. 在 worktree 内工作
5. 每个独立变更单独 commit，commit message 格式: `sprint-68: <what changed>`
6. 禁止操作: rm -rf / git push / 修改 .selfmodel/ / 安装全局依赖 / 调用生产 API

## Objective
Fix bugs found by the Guardian E2E audit. Two HIGH-severity bugs and several MEDIUM issues.

## Assigned To
opus

## Deliverables

### Fix 1: buildDiaryContext Accesses Non-Existent Fields (HIGH)
**File:** `src/buddy/persona.ts`, lines ~325-342

`buildDiaryContext()` accesses fields that don't exist on `EnhancedPatternSummary`:
- `summary.topPattern` is an object `{ type, count, label, advice }`, not a string → renders as `[object Object]`
- `summary.topPatternCount` doesn't exist → `undefined`
- `summary.worstInstrument` doesn't exist → `undefined`
- `summary.worstInstrumentLosses` doesn't exist
- `summary.bestSession` doesn't exist

First, READ `src/buddy/diary.ts` to find the actual `EnhancedPatternSummary` type definition and its real field names. Then fix persona.ts to use the correct fields:
- `summary.topPattern` → `summary.topPattern?.label` (for the pattern name)
- `summary.topPatternCount` → `summary.topPattern?.count`
- `summary.worstInstrument` → `summary.instrumentBiases?.[0]?.symbol` (or similar, check the actual type)
- `summary.bestSession` → derive from `summary.timeOfDayAnalysis` (check actual field)

Also fix the type import: `EnhancedDiarySummary` → `EnhancedPatternSummary` (or whatever the actual exported name is).

### Fix 2: Market Orders Never Trigger Debates (HIGH)
**File:** `src/buddy/debate.ts`, lines ~53-54

`estimateOrderValue()` uses `order.price ?? 0`. Market orders have no `price`, so the value is always 0, and `shouldTriggerDebate` returns false.

**Fix:**
- In `estimateOrderValue()`, when `order.price` is undefined, fall back to the last known price for that symbol
- Read `src/services/exchange/singleton.ts` to find how to get the current price (e.g., `exchange.getTicker(symbol)`)
- If no price can be determined, use a conservative fallback that still allows debate trigger for large quantities
- Alternative simpler approach: if price is undefined (market order), check quantity against a threshold relative to portfolio balance instead of absolute order value

Also check: who calls `shouldTriggerDebate` in `guardian-observer.ts`? Make sure the fix integrates correctly.

### Fix 3: Ghost Convenience Function Loses Cooldown State (MEDIUM)
**File:** `src/buddy/ghost-warnings.ts`, line ~143

`checkGhostTriggers()` creates a new `GhostEngine()` on every call, resetting the cooldown map.

**Fix:**
- Use a module-level singleton: `let defaultEngine: GhostEngine | null = null`
- `function checkGhostTriggers(context) { if (!defaultEngine) defaultEngine = new GhostEngine(); return defaultEngine.checkAll(context); }`
- Or deprecate the convenience function with a comment if the observer already uses its own cached instance

### Fix 4: Diary Enhanced Summary Cache Hash (MEDIUM)
**File:** `src/buddy/diary.ts`, lines ~788-799

Cache invalidation uses only `entries.length`. If an entry is updated (e.g., outcome changes from pending to profit), the cache returns stale data.

**Fix:**
- Incorporate a content hash: use `entries.length + lastEntryTimestamp + lastEntryOutcome` or similar
- Or simpler: add a `_cacheVersion` counter that increments on any mutation (recordTrade, updateOutcome)

### Fix 5: Silent Catch Blocks in persona.ts (MEDIUM)
**File:** `src/buddy/persona.ts`, lines ~328, 461, 505

Empty `catch {}` blocks in `buildDiaryContext` and related functions silently swallow errors with no logging.

**Fix:**
- Add `console.warn('[Persona] diary context error:', err)` or similar minimal logging
- Keep the behavior (return fallback), just add visibility

### Fix 6: Guardian Observer Hardcoded Companion Values (LOW)
**File:** `src/services/trading/guardian-observer.ts`, lines ~266-271

`notifyTradingEvent` sends `side: 'buy', quantity: 0, price: 0` — hardcoded dummy values.

**Fix:**
- Extract actual trade values from the tool result or tool input
- The tool input should be available in the function context — read the function signature to determine where the original order data is accessible
- At minimum, parse the tool result text for the actual values, or pass them through from the caller

### Fix 7: Master Count + Duplicate Quote (LOW — Documentation)
**File:** `src/buddy/types.ts`

- Update rarity distribution comments to reflect actual counts (56 total, Epic: 18, Rare: 18, etc.)
- Give `bai_gui` a distinct quote (he has other famous sayings, e.g., "智者寡于事，愚者多于事。" or "时不至，不可强生。")

## Verification
1. `bun run build` succeeds
2. Each fix has its own commit
3. Verify: `grep -n "object Object" src/buddy/persona.ts` returns nothing (H1 is fixed)

## Timeout
180 minutes
