# Sprint 28: WebSocket Feed Reconnection + Error Recovery

## Task Preamble
你是 selfmodel 团队的 backend engineer (Codex)。铁律: Never Fallback, Never Mock, Never Lazy。原子提交 `sprint-28: <what>`。

## Objective
Add automatic reconnection with exponential backoff to the MarketFeed, connection status tracking, and exchange API rate limit handling.

## Assigned To
codex

## Deliverables
- [ ] src/services/market/feed.ts — Reconnection logic + connection status
- [ ] src/services/exchange/ccxt-client.ts — Rate limit retry logic
- [ ] src/services/chart/udf-server.ts — Error recovery for candle fetches

## Acceptance Criteria

### 1. MarketFeed Reconnection (`src/services/market/feed.ts`)

Add automatic reconnection when poll errors occur:

```typescript
// New fields on MarketFeed class:
private consecutiveErrors = 0;
private maxRetryDelay = 60000; // 60s max backoff
private status: 'connected' | 'reconnecting' | 'disconnected' = 'disconnected';
```

**Reconnection behavior:**
- When `poll()` fails for ALL symbols in a cycle, increment `consecutiveErrors`
- If `consecutiveErrors >= 3`, transition status to `'reconnecting'`
- Apply exponential backoff: `delay = min(1000 * 2^consecutiveErrors, maxRetryDelay)`
- Stop the current interval, wait `delay`, then restart polling
- On successful poll (at least 1 symbol succeeds), reset `consecutiveErrors` to 0 and status to `'connected'`
- When `start()` is called, set status to `'connected'`
- When `stop()` is called, set status to `'disconnected'` and reset `consecutiveErrors`

**Status tracking:**
```typescript
/** Get the current connection status. */
getStatus(): 'connected' | 'reconnecting' | 'disconnected' {
  return this.status;
}

/** Register a callback for status changes. */
onStatusChange(cb: (status: 'connected' | 'reconnecting' | 'disconnected') => void): void
```

### 2. Rate Limit Handling (`src/services/exchange/ccxt-client.ts`)

Add retry logic for rate-limited API calls:

- When a `RateLimitExceeded` error (already detected in `translateCcxtError` at line 88) is caught in `getCandles()`, `getTicker()`, or `getBalance()`:
  - Wait 1 second, retry once
  - If still rate-limited, throw the error as normal
- Implement this as a private helper method:

```typescript
private async withRateLimitRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error: unknown) {
    if (error instanceof ccxt.RateLimitExceeded) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return await fn();
    }
    throw error;
  }
}
```

Apply to `getCandles()`, `getTicker()`, and `getBalance()` — wrap the core CCXT call in `withRateLimitRetry()`.

### 3. UDF Error Recovery (`src/services/chart/udf-server.ts`)

In `fetchCandles()` (the function added in Sprint 25), add a single retry on transient errors:
- If `getCandles()` throws, wait 500ms and retry once
- If the retry also fails, throw the original error
- This handles momentary exchange API blips without exposing errors to the chart frontend

### 4. Build Passes
`bun run build` must complete without new errors.

## Context Files (READ THESE FIRST)
- `src/services/market/feed.ts` — MarketFeed class (132 lines). `poll()` at line 81 iterates symbols. `start()` at line 58 creates the interval. Currently no reconnection or status tracking.
- `src/services/exchange/ccxt-client.ts` — CCXT wrapper. `translateCcxtError()` at line 77 already detects `RateLimitExceeded`. Methods `getCandles()` line 196, `getTicker()` line 215, `getBalance()` line 132 need retry wrapping.
- `src/services/chart/udf-server.ts` — UDF server. `fetchCandles()` was added in Sprint 25. Add retry logic there.

## Constraints
- Max execution time: 120s
- Do NOT change any exported function signatures (only add new ones)
- Do NOT install any npm packages
- Keep `console.error` for logging errors (no new logging framework)
- Atomic commits: `sprint-28: <what>`

当前状态: **ACTIVE**
