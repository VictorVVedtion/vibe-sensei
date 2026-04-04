# Sprint 67: Reliability + Security Hardening

## Task Preamble
你是 selfmodel 团队的 senior fullstack engineer (Opus)。遵守以下铁律：
1. Never Fallback — 需要 500 行就写 500 行
2. Never Mock — 全部真实数据
3. Never Lazy — 无 TODO，每个 try 有完整 catch
4. 在 worktree 内工作
5. 每个独立变更单独 commit，commit message 格式: `sprint-67: <what changed>`
6. 禁止操作: rm -rf / git push / 修改 .selfmodel/ / 安装全局依赖 / 调用生产 API

## Objective
Fix reliability and security issues found by CSO, Trading E2E, and Code Health audits.

## Assigned To
opus

## Deliverables

### Fix 1: Exchange Singleton Stale-Promise Bug (HIGH — Reliability)
**File:** `src/services/exchange/singleton.ts`

If `exchange.connect()` throws, `connectionPromise` remains set to the rejected promise forever. Every subsequent `getConnectedExchange()` returns the same rejected promise — no retry possible.

**Fix:**
- Add `.catch()` handler that resets `connectionPromise = null` and `connected = false` before re-throwing
- This allows the next `getConnectedExchange()` call to retry the connection
- Pattern:
```typescript
connectionPromise = exchange.connect().then(() => {
  connected = true
  return exchange
}).catch((err) => {
  connectionPromise = null
  connected = false
  throw err
})
```

### Fix 2: Read-Only Tools Missing try/catch (MEDIUM — Reliability)
**Files:** `src/tools/PositionTool/PositionTool.ts`, `src/tools/BalanceTool/BalanceTool.ts`, `src/tools/ChartTool/ChartTool.ts`

All three read-only tools lack try/catch around `getConnectedExchange()` and subsequent exchange method calls. If the exchange throws (timeout, network error), the error propagates unhandled.

**Fix for each tool:**
- Wrap the exchange call block in try/catch
- Return a user-friendly error message: `{ data: "Error fetching <positions|balance|chart>: <message>" }`
- Follow the same pattern used in OrderTool (which has proper error handling)

### Fix 3: TTS API Key in URL (MEDIUM — Security)
**File:** `src/services/companion/tts.ts`

Line ~215: `const url = \`...:generateContent?key=\${this.apiKey}\``
The Gemini API key is passed as URL query parameter. Sprint 65 fixed this in `gemini-client.ts` using `x-goog-api-key` header.

**Fix:**
- Remove `?key=${this.apiKey}` from the URL
- Add `'x-goog-api-key': this.apiKey` to the fetch headers
- Check if there are other Gemini API calls in `src/services/companion/` that need the same fix (engine.ts, vision.ts, stt.ts)

### Fix 4: UDF Server Binds to 0.0.0.0 (MEDIUM — Security)
**File:** `src/services/chart/index.ts`

Line ~38: `app.listen(port)` binds to all interfaces by default.

**Fix:**
- Change to `app.listen(port, '127.0.0.1', callback)` to restrict to localhost only

### Fix 5: UDF 500 Error Leaks Internal Messages (MEDIUM — Security)
**File:** `src/services/chart/udf-server.ts`

Line ~231: `res.status(500).json({ s: 'error', errmsg: message })` passes raw CCXT error messages to the client.

**Fix:**
- Log the full error to console.error (keep for debugging)
- Return a generic message to the client: `res.status(500).json({ s: 'error', errmsg: 'Internal server error' })`
- Note: there's already a catch-all at line ~336 that does this correctly. Fix the inner handler at ~231 to match.

### Fix 6: diary.json File Permissions (MEDIUM — Security)
**File:** `src/buddy/diary.ts`

Line ~868: `writeFileSync(this.storePath, json, 'utf-8')` — default permissions (0o644, world-readable).
Line ~856: `mkdirSync(dir, { recursive: true })` — default permissions.

**Fix:**
- `writeFileSync(this.storePath, json, { encoding: 'utf-8', mode: 0o600 })`
- `mkdirSync(dir, { recursive: true, mode: 0o700 })`
- Match the pattern used in `src/services/knowledge/event-store.ts`

### Fix 7: StrategyTool isReadOnly Mismark (LOW — Security)
**File:** `src/tools/StrategyTool/StrategyTool.ts`

The tool executes arbitrary Python scripts but `isReadOnly()` returns `true` (line ~143). This is semantically incorrect and may bypass permission checks.

**Fix:**
- Change `isReadOnly()` to return `false`

## Verification
1. `bun run build` succeeds
2. Each fix has its own commit
3. No new TypeScript errors in modified files

## Timeout
180 minutes
