# Sprint 72: CancelOrder Tool + Symbol Validation + Price Fallback

## Task Preamble
你是 selfmodel 团队的 senior fullstack engineer (Opus)。遵守以下铁律：
1. Never Fallback — 需要 500 行就写 500 行
2. Never Mock — 全部真实数据
3. Never Lazy — 无 TODO，每个 try 有完整 catch
4. 在 worktree 内工作
5. 每个独立变更单独 commit，commit message 格式: `sprint-72: <what changed>`
6. 禁止操作: rm -rf / git push / 修改 .selfmodel/ / 安装全局依赖 / 调用生产 API

## Objective
Fix 3 bugs found during 68-test E2E deep testing of the CLI.

## Assigned To
opus

## Deliverables

### Fix 1: Create CancelOrder Tool
**New file:** `src/tools/CancelOrderTool/CancelOrderTool.ts`

The exchange layer (`paper-trading.ts` line 114, `ccxt-client.ts`) already has `cancelOrder(id, symbol?)`. But there's no Tool that exposes it to the AI.

**Create:**
1. New directory `src/tools/CancelOrderTool/`
2. Tool definition with:
   - Name: `CancelOrder`
   - Input schema: `{ orderId: string (required), symbol: string (optional) }`
   - Description: "Cancel an open order by its order ID. Optionally specify the symbol."
   - `isReadOnly()`: false
   - `isDestructive()`: true
   - `isConcurrencySafe()`: false
3. Implementation: call `exchange.cancelOrder(orderId, symbol)`, handle errors (order not found, already filled)
4. Register in `src/tools.ts` — add to the trading tools array alongside PlaceOrder, GetPositions, GetBalance

**Follow the exact pattern of OrderTool** for error handling, imports, and tool registration.

### Fix 2: Symbol Validation in ShowChart and AutoResearch
**Files:** `src/tools/ChartTool/ChartTool.ts`, `src/tools/AutoResearchTool/AutoResearchTool.ts`

Currently these tools accept any symbol string and silently show fake data when the paper exchange falls back to synthetic prices for unknown symbols.

**Fix:**
- In each tool's `call()` method, before fetching data, validate the symbol:
  1. Try `exchange.getTicker(symbol)` — if it throws `InvalidSymbolError`, return an error message
  2. Or check against the `VALID_SYMBOLS` set from `paper-trading.ts`
- Return clear error: `"Unknown symbol: ${symbol}. Use format like BTC/USDT. Available: BTC, ETH, SOL, BNB, XRP, ADA, DOGE, AVAX, DOT, LINK..."`

### Fix 3: Improve Price Fallback Behavior
**File:** `src/services/exchange/paper-trading.ts`

When the OKX market data source fails to connect (network timeout, geo-restriction), `resolveExecutionPrice()` falls back to `DEFAULT_PRICE = 50_000` for ALL symbols. This means BTC, ETH, and DOGE all fill at $50K.

**Fix:**
- Add per-symbol default prices as a fallback before the universal DEFAULT_PRICE:
```typescript
const SYMBOL_DEFAULT_PRICES: Record<string, number> = {
  'BTC/USDT': 65000,
  'ETH/USDT': 2000,
  'SOL/USDT': 80,
  'BNB/USDT': 300,
  'XRP/USDT': 0.50,
  'ADA/USDT': 0.35,
  'DOGE/USDT': 0.09,
  'AVAX/USDT': 25,
  'DOT/USDT': 5,
  'LINK/USDT': 12,
  'UNI/USDT': 7,
  'ATOM/USDT': 8,
  'LTC/USDT': 70,
  'NEAR/USDT': 4,
  'APT/USDT': 8,
  'ARB/USDT': 0.80,
  'OP/USDT': 1.50,
  'SUI/USDT': 1.20,
  'PEPE/USDT': 0.000008,
  'MATIC/USDT': 0.50,
};
```
- In `resolveExecutionPrice()`, after checking cached price and before DEFAULT_PRICE:
  ```typescript
  return this.prices.get(symbol) ?? SYMBOL_DEFAULT_PRICES[symbol] ?? DEFAULT_PRICE;
  ```
- Also update `generateSyntheticCandles()` and `buildSyntheticTicker()` to use per-symbol prices

## Verification
1. `bun run build` succeeds
2. Test CancelOrder: place a limit order → cancel it → verify order status is 'cancelled'
3. Test symbol validation: `ShowChart` with FAKECOIN → error message instead of fake data
4. Test price fallback: if offline, ETH should fill at ~$2000, not $50K

## Context
- OrderTool pattern: `src/tools/OrderTool/OrderTool.ts` (260 lines)
- Tool registry: `src/tools.ts` (250 lines)
- Paper exchange: `src/services/exchange/paper-trading.ts`
- ChartTool: `src/tools/ChartTool/ChartTool.ts`
- AutoResearch: `src/tools/AutoResearchTool/AutoResearchTool.ts`

## Timeout
180 minutes
