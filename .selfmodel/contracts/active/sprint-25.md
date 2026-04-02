# Sprint 25: UDF Candle Caching + Exchange Connection Optimization

## Task Preamble
你是 selfmodel 团队的 backend engineer (Codex)。铁律: Never Fallback, Never Mock, Never Lazy。原子提交 `sprint-25: <what>`。

## Objective
Optimize the UDF chart server and exchange connection layer by adding caching, request deduplication, and race-condition prevention.

## Assigned To
codex

## Deliverables
- [ ] src/services/chart/udf-server.ts — Add LRU candle cache + request deduplication
- [ ] src/services/exchange/ccxt-client.ts — Cache loadMarkets() with TTL
- [ ] src/services/exchange/singleton.ts — Promise-based connection deduplication

## Acceptance Criteria

### 1. UDF Candle Cache (`src/services/chart/udf-server.ts`)

Add an LRU cache for OHLCV candle data in `handleHistory()`:

```typescript
import { LRUCache } from 'lru-cache';

const candleCache = new LRUCache<string, { s: string; t: number[]; o: number[]; h: number[]; l: number[]; c: number[]; v: number[] }>({
  max: 200,
  ttl: 3 * 60 * 1000, // 3 minutes
});
```

- Cache key format: `${symbol}:${resolution}:${from}:${to}`
- Check cache before calling `ex.getCandles()`
- Store formatted response in cache after successful fetch
- Do NOT cache `no_data` responses

### 2. Request Deduplication (`src/services/chart/udf-server.ts`)

Deduplicate concurrent in-flight requests for the same parameters:

```typescript
const inflight = new Map<string, Promise<any>>();
```

- Before fetching, check if an identical request is already in-flight
- If yes, await the existing promise instead of creating a new one
- Clean up the inflight map after the promise resolves (in a `.finally()`)
- This prevents N concurrent chart refreshes from making N identical API calls

### 3. loadMarkets() Caching (`src/services/exchange/ccxt-client.ts`)

Cache the `loadMarkets()` call with a 1-hour TTL:

- Add a module-level `let marketsLoadedAt: number = 0` timestamp
- In `connect()`, check if markets were loaded within the last hour
- If already loaded recently, skip the API call
- If `marketsLoadedAt` is 0 or older than 1 hour, call `loadMarkets()` and update timestamp
- The CCXT exchange instance already stores markets internally after `loadMarkets()`, so we just need to prevent re-calling

### 4. Connection Promise Deduplication (`src/services/exchange/singleton.ts`)

Prevent race conditions when multiple callers invoke `getConnectedExchange()` simultaneously:

Current code (line 20-27):
```typescript
export async function getConnectedExchange(): Promise<ExchangeInterface> {
  const exchange = getExchange()
  if (!connected) {
    await exchange.connect()
    connected = true
  }
  return exchange
}
```

Replace with:
```typescript
let connectionPromise: Promise<ExchangeInterface> | null = null

export async function getConnectedExchange(): Promise<ExchangeInterface> {
  const exchange = getExchange()
  if (connected) return exchange
  if (!connectionPromise) {
    connectionPromise = exchange.connect().then(() => {
      connected = true
      return exchange
    })
  }
  return connectionPromise
}
```

### 5. Build Passes
`bun run build` must complete without new errors.

## Context Files (READ THESE FIRST)
- `src/services/chart/udf-server.ts` — UDF server (238 lines). `handleHistory()` at line 124 is the main target. Currently fetches fresh candles on every request with zero caching.
- `src/services/exchange/ccxt-client.ts` — CCXT wrapper (330 lines). `connect()` at line 123 calls `loadMarkets()` unconditionally.
- `src/services/exchange/singleton.ts` — Exchange singleton (33 lines). `getConnectedExchange()` at line 20 has a race condition.
- `src/services/exchange/types.ts` — Type definitions (Candle, Balance, Position, etc.)

## Key API Signatures
```typescript
// LRUCache (already in package.json as lru-cache)
import { LRUCache } from 'lru-cache';

// Exchange interface
interface ExchangeInterface {
  connect(): Promise<void>;
  getCandles(symbol: string, timeframe: string, limit: number): Promise<Candle[]>;
  // ...
}
```

## Constraints
- Max execution time: 120s
- Do NOT install any new npm packages (lru-cache is already a dependency)
- Do NOT change any function signatures or exports
- Do NOT modify handleConfig, handleTime, handleSearch, handleSymbols, handleMarks
- Atomic commits: `sprint-25: <what>`

当前状态: **ACTIVE**
