# Sprint 24: AutoResearch Workflow (Karpathy-style)

## Task Preamble
你是 selfmodel 团队的 senior fullstack engineer (Opus)。铁律: Never Fallback, Never Mock, Never Lazy。原子提交 `sprint-24: <what>`。

## Objective
Create an AutoResearchTool that implements a Karpathy-style research loop: discover market factors → compose strategy hypotheses → backtest against historical data → rank by Sharpe ratio and drawdown → iterate.

## Assigned To
opus

## Deliverables
- [ ] src/tools/AutoResearchTool/AutoResearchTool.ts — The auto-research tool
- [ ] src/tools.ts — Register AutoResearchTool

## Acceptance Criteria

### 1. AutoResearchTool (`src/tools/AutoResearchTool/AutoResearchTool.ts`)

**Input Schema (Zod):**
```typescript
z.strictObject({
  symbol: z.string().describe('Trading pair to research, e.g. BTC/USDT'),
  timeframe: z.string().optional().describe('Analysis timeframe, e.g. 1h, 4h, 1d').default('4h'),
  iterations: z.number().optional().describe('Number of research iterations').default(3),
  factors: z.array(z.string()).optional().describe('Specific factors to analyze, e.g. ["RSI", "MACD", "volume"]'),
})
```

**Research Loop (each iteration):**
1. **Discover**: Fetch recent candle data via exchange singleton `getCandles(symbol, timeframe, 100)`
2. **Analyze**: Compute basic technical factors from the candle data:
   - Price momentum (% change over last N candles)
   - Volatility (standard deviation of returns)
   - Volume trend (increasing/decreasing)
   - Simple moving average crossover signals (fast=10, slow=30)
3. **Hypothesize**: Based on factors, generate a trading hypothesis:
   - If momentum positive + volume increasing → "BULLISH momentum setup"
   - If SMA crossover + low volatility → "BREAKOUT potential"
   - If high volatility + negative momentum → "MEAN REVERSION opportunity"
   - etc.
4. **Score**: Assign a confidence score (0-100) based on how many factors align
5. **Report**: Build a structured report for each iteration

**Output Format:**
```
═══ AutoResearch Report: BTC/USDT (4h) ═══
Iterations: 3 | Candles analyzed: 100

── Iteration 1 ──
Factors:
  Momentum (20-candle): +3.2%
  Volatility (σ): 1.8%
  Volume trend: ↑ increasing
  SMA(10/30): bullish crossover
Hypothesis: BULLISH momentum with rising volume
Confidence: 72/100
Signal: BUY

── Iteration 2 ──
...

── Summary ──
Consensus: BUY (2/3 iterations)
Avg Confidence: 68/100
Key Factors: momentum +3.2%, SMA crossover, volume ↑
Risk: Volatility at 1.8% suggests position sizing caution
═══════════════════════════════════════════
```

**Tool Properties:**
- `name: 'AutoResearch'`
- `isReadOnly: true`
- `isDestructive: false`
- `isConcurrencySafe: true`

### 2. Technical Analysis Functions
Implement these as pure functions within the tool file (no external TA library needed):

- `calcMomentum(closes: number[], period: number): number` — % change over period
- `calcVolatility(closes: number[], period: number): number` — stddev of returns
- `calcSMA(closes: number[], period: number): number` — simple moving average
- `calcVolumetrend(volumes: number[], period: number): 'increasing' | 'decreasing' | 'flat'`
- `detectSMACrossover(closes: number[], fast: number, slow: number): 'bullish' | 'bearish' | 'none'`

### 3. Tool Registration (`src/tools.ts`)
Import and register AutoResearchTool alongside StrategyTool.

### 4. Build Passes
`bun run build` must complete without new errors.

## Context Files (READ THESE FIRST)
- `src/tools/StrategyTool/StrategyTool.ts` — Reference tool (just shipped, similar pattern)
- `src/tools/OrderTool/OrderTool.ts` — Another reference tool
- `src/Tool.ts` — Tool interface, buildTool()
- `src/tools.ts` — Tool registry
- `src/services/exchange/singleton.ts` — getConnectedExchange()
- `src/services/exchange/types.ts` — Candle type (has open, high, low, close, volume, timestamp)

## Constraints
- Max execution time: 300s
- All TA functions are pure — no external libraries
- Use exchange singleton for candle data
- Each iteration re-analyzes (can use different lookback periods for variety)
- Tool returns string output (formatted report for AI to interpret)
- Do NOT install any npm packages

当前状态: **ACTIVE**
