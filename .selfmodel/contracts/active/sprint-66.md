# Sprint 66: API + CLI Resilience Fixes (Rampage Findings)

## Task Preamble
你是 selfmodel 团队的 senior fullstack engineer (Opus)。遵守以下铁律：
1. Never Fallback — 需要 500 行就写 500 行
2. Never Mock — 全部真实数据
3. Never Lazy — 无 TODO，每个 try 有完整 catch
4. 在 worktree 内工作
5. 每个独立变更单独 commit，commit message 格式: `sprint-66: <what changed>`
6. 禁止操作: rm -rf / git push / 修改 .selfmodel/ / 安装全局依赖 / 调用生产 API

## Objective
Fix HIGH and MEDIUM severity findings from the rampage chaos test (2026-04-03).
Full report at `.gstack/rampage-reports/rampage-vibe-sensei-2026-04-03.md`.

## Assigned To
opus

## Deliverables

### Fix 1: Screenshot MIME Spoofing (RAMPAGE-001, HIGH)
**File:** `src/services/chart/udf-server.ts`

`handleScreenshotPost()` accepts any content. `handleScreenshotGet()` serves it as `image/png`.
Non-PNG data gets served with a false Content-Type.

**Fix:**
- In `handleScreenshotPost()`, after `Buffer.concat(chunks)`, validate PNG magic bytes (`\x89PNG\r\n\x1a\n` = first 8 bytes)
- If not valid PNG, return `res.status(400).json({ error: 'Invalid image: not a PNG file' })`
- Only store in `latestScreenshot` if validation passes

### Fix 2: NaN Timestamp Fallthrough (RAMPAGE-002, HIGH)
**File:** `src/services/chart/udf-server.ts`

`/history?from=NaN&to=NaN` returns real data. `Number('NaN') || 0` silently defaults.

**Fix:**
- In `handleHistory()`, after parsing `from` and `to`, check `Number.isNaN(from)` and `Number.isNaN(to)`
- If either is NaN, return `res.status(400).json({ s: 'error', errmsg: 'Invalid timestamp parameter' })`

### Fix 3: Express Fingerprint (RAMPAGE-004, MEDIUM)
**File:** `src/services/chart/udf-server.ts`

`X-Powered-By: Express` header exposed on every response.

**Fix:**
- In `createUdfApp()`, add `app.disable('x-powered-by')` right after `const app = express()`

### Fix 4: Custom 404 Handler (RAMPAGE-005, MEDIUM)
**File:** `src/services/chart/udf-server.ts`

Express default HTML error pages reveal framework. "Cannot GET /path" leaks info.

**Fix:**
- In `mountUdfRoutes()` or `createUdfApp()`, add a catch-all 404 handler at the end:
  ```typescript
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found' });
  });
  ```

### Fix 5: Search limit=0 / NaN Behavior (RAMPAGE-006, MEDIUM)
**File:** `src/services/chart/udf-server.ts`

`/search?limit=0` returns 10 results because `Number(0) || 10` treats 0 as falsy.

**Fix:**
- In `handleSearch()`, change the limit parsing:
  ```typescript
  const rawLimit = Number(req.query.limit);
  const limit = Number.isNaN(rawLimit) || rawLimit < 0 ? 10 : Math.min(rawLimit, 30);
  ```
- This makes `limit=0` return 0 results, `limit=-1` return default 10, `limit=NaN` return default 10

### Fix 6: Wrong Method Returns 404 Instead of 405 (RAMPAGE-015, LOW)
**File:** `src/services/chart/udf-server.ts`

DELETE/PUT to valid paths return 404. Should be 405 Method Not Allowed.

**Fix:**
- In `mountUdfRoutes()`, add handlers for the defined GET paths that reject non-GET methods:
  ```typescript
  app.all('/config', (_req, res) => res.status(405).json({ error: 'Method not allowed' }));
  // etc for /time, /search, /symbols, /history, /marks
  ```
  (Place these AFTER the `.get()` routes so GET still works)

## Verification
1. `bun run build` succeeds
2. Each fix has its own commit
3. Manual curl test:
   - `curl -X POST -d "text" localhost:3456/api/screenshot` → 400
   - `curl "localhost:3456/history?symbol=BTCUSDT&from=NaN"` → 400
   - `curl -D - localhost:3456/config` → no X-Powered-By
   - `curl localhost:3456/nonexistent` → JSON 404
   - `curl "localhost:3456/search?limit=0"` → `[]`

## Context
- UDF server: `src/services/chart/udf-server.ts` (356 lines)
- Report: `.gstack/rampage-reports/rampage-vibe-sensei-2026-04-03.md`

## Timeout
120 minutes
