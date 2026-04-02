# Sprint 22: Market Data WebSocket Feed

## Task Preamble
你是 selfmodel 团队的 senior fullstack engineer (Opus)。铁律: Never Fallback, Never Mock, Never Lazy。原子提交 `sprint-22: <what>`。

## Objective
Create a real-time market data feed using CCXT fetchTicker() polling + WebSocket push to the web frontend. BTC/USDT and ETH/USDT price updates.

## Assigned To
opus

## Deliverables
- [ ] src/services/market/feed.ts — Market data feed engine
- [ ] src/services/chart/index.ts — Add WebSocket upgrade to UDF server
- [ ] web/app.js — Add WebSocket client for live price updates

## Acceptance Criteria

### 1. Market Feed Engine (`src/services/market/feed.ts`)
Create a market data feed module:
- Exports `MarketFeed` class:
  ```typescript
  class MarketFeed {
    constructor(symbols: string[])      // e.g., ['BTC/USDT', 'ETH/USDT']
    start(interval?: number): void      // Start polling, default 5000ms
    stop(): void                        // Stop polling
    onUpdate(cb: (ticker: TickerUpdate) => void): void  // Subscribe to updates
    getLatest(symbol: string): TickerUpdate | undefined
  }
  ```
- `TickerUpdate` type:
  ```typescript
  interface TickerUpdate {
    symbol: string
    last: number
    bid: number
    ask: number
    high: number
    low: number
    volume: number
    timestamp: number
  }
  ```
- Uses `getConnectedExchange()` singleton to call `exchange.getTicker(symbol)` for each symbol
- Polls every `interval` ms (default 5000ms) using setInterval
- Emits updates via registered callbacks
- Error handling: log errors, continue polling (never crash)
- Exports singleton factory: `getMarketFeed(symbols?: string[]): MarketFeed`

### 2. WebSocket Server Integration (`src/services/chart/index.ts`)
Extend the UDF server to support WebSocket:
- After Express server is created, attach a WebSocket server on the same port (use `ws` package or Bun.serve WebSocket)
- On client connect: immediately send latest prices for all tracked symbols
- On market feed update: broadcast to all connected WebSocket clients
- Message format (JSON): `{ type: 'ticker', data: TickerUpdate }`
- Start market feed when first WebSocket client connects, stop when last disconnects
- Import and use `getMarketFeed` from the feed module

### 3. Frontend WebSocket Client (`web/app.js`)
Add WebSocket handling to the chart frontend:
- On page load: connect to `ws://localhost:3456` (same port as UDF server)
- On `ticker` message: update the price display in the info panel
- Show live last price, bid/ask spread
- Reconnect on disconnect (simple retry with 3s delay)
- If WebSocket not available, fall back to existing HTTP behavior (graceful degradation)

### 4. Build Passes
`bun run build` must complete without new errors.

## Important Notes
- CcxtClient currently has `getTicker(symbol)` which calls `this.exchange.fetchTicker(symbol)` — this is a REST call, NOT a WebSocket subscription
- Use polling (fetchTicker in a loop) rather than CCXT Pro's WebSocket API, since CCXT Pro may not be installed
- The `ws` npm package should already be available (check node_modules). If not, use Bun's built-in WebSocket via `Bun.serve()`
- Default symbols: `['BTC/USDT', 'ETH/USDT']`

## Context Files (READ THESE FIRST)
- `src/services/exchange/singleton.ts` — getConnectedExchange()
- `src/services/exchange/ccxt-client.ts` — getTicker() implementation (line ~218)
- `src/services/exchange/types.ts` — Ticker type
- `src/services/chart/index.ts` — startUdfServer(), Express server setup
- `web/app.js` — Frontend JavaScript
- `web/index.html` — Frontend HTML structure

## Constraints
- Max execution time: 180s
- Polling interval minimum 5000ms (respect rate limits)
- WebSocket is optional enhancement — UDF HTTP must keep working
- Frontend must gracefully degrade without WebSocket
- Do NOT install new npm packages — use what's available or Bun built-ins

当前状态: **ACTIVE**
