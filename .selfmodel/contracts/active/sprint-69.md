# Sprint 69: Real Market Prices + Symbol Validation in Paper Mode

## Task Preamble
你是 selfmodel 团队的 senior fullstack engineer (Opus)。遵守以下铁律：
1. Never Fallback — 需要 500 行就写 500 行
2. Never Mock — 全部真实数据
3. Never Lazy — 无 TODO，每个 try 有完整 catch
4. 在 worktree 内工作
5. 每个独立变更单独 commit，commit message 格式: `sprint-69: <what changed>`
6. 禁止操作: rm -rf / git push / 修改 .selfmodel/ / 安装全局依赖 / 调用生产 API

## Objective
Make PaperExchange use REAL market prices from Binance public API (via CCXT) instead of the hardcoded $50,000 default. Also add symbol validation to reject non-existent trading pairs.

## Assigned To
opus

## Deliverables

### Fix 1: Inject CCXT Market Data Client into PaperExchange

**File:** `src/services/exchange/paper-trading.ts`

The PaperExchange currently uses `DEFAULT_PRICE = 50_000` for all symbols (line 20). It generates synthetic candles and tickers from this static price.

**Changes:**
1. Add an optional `marketDataSource` parameter to the PaperExchange constructor:
   ```typescript
   constructor(private marketDataSource?: ExchangeInterface) {}
   ```

2. Modify `getTicker()` (line ~143): If `marketDataSource` exists, delegate to it. On failure, fall back to synthetic data:
   ```typescript
   async getTicker(symbol: string): Promise<Ticker> {
     if (this.marketDataSource) {
       try {
         const ticker = await this.marketDataSource.getTicker(symbol);
         this.prices.set(symbol, ticker.last);  // Cache real price
         return ticker;
       } catch {
         // Fall back to synthetic
       }
     }
     // Existing synthetic logic...
   }
   ```

3. Modify `getCandles()` (line ~131): If `marketDataSource` exists, fetch real OHLCV data:
   ```typescript
   async getCandles(symbol: string, timeframe: string, limit: number): Promise<Candle[]> {
     if (this.marketDataSource) {
       try {
         return await this.marketDataSource.getCandles(symbol, timeframe, limit);
       } catch {
         // Fall back to synthetic
       }
     }
     // Existing synthetic logic...
   }
   ```

4. Modify `resolveExecutionPrice()` (line ~222): Before falling back to DEFAULT_PRICE, try fetching real price:
   ```typescript
   private async resolveExecutionPrice(order: PaperOrder): Promise<number> {
     // Check cached price first
     const cached = this.prices.get(order.symbol);
     if (cached) return cached;
     
     // Try real market price
     if (this.marketDataSource) {
       try {
         const ticker = await this.marketDataSource.getTicker(order.symbol);
         this.prices.set(order.symbol, ticker.last);
         return ticker.last;
       } catch {
         // Fall through to default
       }
     }
     
     return DEFAULT_PRICE;
   }
   ```
   Note: `resolveExecutionPrice` is currently sync. You may need to make it async and update callers (`executeBuyOrder`, `executeSellOrder`).

### Fix 2: Create Read-Only CCXT Client for Market Data

**File:** `src/services/exchange/index.ts`

Create a function that initializes a CCXT client for public market data only (no API key needed for Binance public endpoints):

```typescript
function createMarketDataSource(): ExchangeInterface {
  return new CcxtClient({
    mode: 'live',
    exchangeId: 'binance',
    // No apiKey/secret needed for public endpoints (getTicker, getCandles)
  });
}
```

Update `createExchange()` to inject this into PaperExchange:
```typescript
if (resolvedConfig.mode === 'paper') {
  const marketData = createMarketDataSource();
  return new PaperExchange(marketData);
}
```

**IMPORTANT:** The CcxtClient constructor and `connect()` must handle the case where no API key is provided. Check if it already does — Binance public API (fetchTicker, fetchOHLCV) doesn't require authentication. If CcxtClient requires apiKey/secret for initialization, make them optional.

### Fix 3: Symbol Validation in PaperExchange

**File:** `src/services/exchange/paper-trading.ts`

Add symbol validation in `placeOrder()` before order execution:

1. Define a symbol allowlist (can reuse `POPULAR_PAIRS` from udf-server or create a broader one):
   ```typescript
   const VALID_SYMBOLS = new Set([
     'BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT',
     'ADA/USDT', 'DOGE/USDT', 'AVAX/USDT', 'DOT/USDT', 'MATIC/USDT',
     'LINK/USDT', 'UNI/USDT', 'ATOM/USDT', 'LTC/USDT', 'NEAR/USDT',
     'APT/USDT', 'ARB/USDT', 'OP/USDT', 'SUI/USDT', 'PEPE/USDT',
   ]);
   ```

2. If `marketDataSource` is available, try to validate via `getTicker()` — if the exchange rejects the symbol, it's invalid.

3. If `marketDataSource` is not available (offline mode), fall back to the static allowlist.

4. On invalid symbol, throw `InvalidSymbolError` (import from `src/services/exchange/errors.ts` or define inline):
   ```typescript
   if (!isValidSymbol(symbol)) {
     throw new InvalidSymbolError(`Unknown trading pair: ${symbol}. Use format like BTC/USDT.`);
   }
   ```

### Fix 4: Handle CcxtClient Without API Key

**File:** `src/services/exchange/ccxt-client.ts`

Check the constructor (line ~106-124). If `apiKey` and `secret` are required, make them optional. Binance public endpoints (fetchTicker, fetchOHLCV, fetchMarkets) don't need authentication.

Ensure `connect()` works without credentials — `loadMarkets()` is a public endpoint.

### Fix 5: Lazy Connection for Market Data Source

**File:** `src/services/exchange/paper-trading.ts`

The market data source should connect lazily (on first use), not at PaperExchange construction time:

```typescript
private async ensureMarketDataConnected(): Promise<boolean> {
  if (!this.marketDataSource) return false;
  if (!this.marketDataConnected) {
    try {
      await this.marketDataSource.connect();
      this.marketDataConnected = true;
    } catch {
      console.warn('[Paper] Market data source unavailable, using synthetic prices');
      this.marketDataSource = undefined;
      return false;
    }
  }
  return true;
}
```

This ensures:
- No startup delay if market data isn't needed
- Graceful fallback if network is unavailable
- Connection attempted only once

## Verification
1. `bun run build` succeeds
2. Test: `echo "查看余额" | bun run dev -- --print --max-turns 1` → still works
3. Test: `echo "显示BTC/USDT的K线图" | bun run dev -- --print --allowedTools "ShowChart" --max-turns 2` → shows REAL BTC price (not $50,000)
4. Test: `echo "买入1个FAKECOIN/USDT" | bun run dev -- --print --allowedTools "PlaceOrder" --max-turns 2` → error about unknown symbol
5. Offline fallback: disconnect network → synthetic prices still work

## Context
- Paper exchange: `src/services/exchange/paper-trading.ts` (475 lines)
- CCXT client: `src/services/exchange/ccxt-client.ts` (280 lines)
- Factory: `src/services/exchange/index.ts` (50 lines)
- Singleton: `src/services/exchange/singleton.ts` (40 lines)
- Types: `src/services/exchange/types.ts` (120 lines)
- UDF server (has POPULAR_PAIRS): `src/services/chart/udf-server.ts`

## Timeout
240 minutes
