# Project Plan: Vibe Sensei — Trading Terminal

## Plan Meta
- Total Phases: 3
- Total Sprints: 12
- Created: 2026-04-01T17:45:00Z
- Last Updated: 2026-04-01T17:45:00Z
- Current Phase: 2

## Phase 0: Core Trading Loop

### Gate
CCXT paper trading works. "buy 0.1 BTC" in terminal → AI parses → guardian checks → paper trade executes.

### Sprint 1: CCXT Exchange Service + Paper Trading
- Agent: opus
- Dependencies: none
- Status: MERGED
- Priority: P0
- Timeout: 180
- Description: Create src/services/exchange/ with ccxt-client.ts (unified CCXT wrapper), paper-trading.ts (simulated exchange with balances, positions, order matching), types.ts (Order, Position, Candle, Balance, Fill types). Install ccxt npm package. Paper trading starts with 100,000 USDT. Support market/limit orders, position tracking, P&L calculation.

### Sprint 2: OrderTool + PositionTool + BalanceTool
- Agent: opus
- Dependencies: Sprint 1
- Status: MERGED
- Priority: P0
- Timeout: 180
- Description: Create 3 trading tools following existing Claude Code Tool pattern (buildTool factory). OrderTool: place market/limit/stop orders via exchange service. PositionTool: query current positions with P&L. BalanceTool: account balance + buying power. Register all in tools.ts. Each tool has inputSchema (JSON Schema), call() implementation, and React render component.

### Sprint 3: Trading Context Injection
- Agent: codex
- Dependencies: Sprint 1
- Status: MERGED
- Priority: P0
- Timeout: 120
- Description: Modify src/context.ts to inject trading state into the AI system prompt. Include: current positions + P&L, account balance, open orders, risk guardian mood, market summary (prices from watchlist). Keep under 500 tokens. Ensure context refreshes before each AI call.

### Sprint 4: Guardian Risk Engine (Phase 0 — 2 checks)
- Agent: opus
- Dependencies: Sprint 1, Sprint 2
- Status: MERGED
- Priority: P0
- Timeout: 180
- Description: Create src/buddy/guardian.ts with RiskGuardian class. Implements 2 initial checks: position_size (alert when single position > 30% of portfolio) and drawdown (alert when total drawdown > 10%). Guardian observes tool call results from the query loop. Uses master personality (getGuardianPrompt) for alert messages. Integrates with CompanionSprite.tsx speech bubble for display. Policy engine: max 1 alert per 30 seconds, severity threshold.

## Phase 1: Guardian Persona System

### Gate
Phase 0 complete. Paper trading loop works end-to-end. Guardian alerts display in terminal.

### Sprint 5: Guardian Persona Prompt System
- Agent: codex
- Dependencies: Sprint 4
- Status: MERGED
- Priority: P0
- Timeout: 120
- Description: Wire getGuardianPrompt() into the AI query loop. Before each AI call, prepend the master's persona instruction to the system prompt. The AI should respond in character as the assigned master when discussing trades. Test: same trade question yields different responses for Buffett vs Soros vs Taleb.

### Sprint 6: Cross-Guardian Consultation ("What would X do?")
- Agent: codex
- Dependencies: Sprint 5
- Status: MERGED
- Priority: P1
- Timeout: 120
- Description: Add a command/tool that lets users query any of the 52 masters, not just their assigned guardian. Parse "what would soros do?" or "ask buffett about this" patterns. Temporarily switch the guardian persona for one response, then revert. Minimal implementation — just a system prompt swap per query.

### Sprint 7: Guardian Debates (dual-master adversarial analysis)
- Agent: opus
- Dependencies: Sprint 5
- Status: MERGED
- Priority: P1
- Timeout: 180
- Description: Before trades exceeding 5% of portfolio, automatically trigger a debate between 2 masters. Pick the user's assigned guardian + a contrarian (e.g., if guardian is Buffett, pick Soros or Taleb). Each makes a case for/against. Display as a structured dialog in the terminal. User decides after seeing both perspectives. This is 2 sequential AI calls with different persona prompts.

### Sprint 8: Ghost Warning System
- Agent: codex
- Dependencies: Sprint 4
- Status: MERGED
- Priority: P1
- Timeout: 120
- Description: Implement ghost warnings from types.ts GHOST_WARNINGS array. Detect trigger conditions: SBF triggers on missing stop loss, Do Kwon on ignoring warning signs, Su Zhu on >3x leverage, Newton on buying after 20%+ run-up. When triggered, display ghost warning with terminal visual effect (dim screen via ANSI escape codes, flickering text, eerie quote). Max 1 ghost per session to avoid fatigue.

## Phase 2: Web Mode + Polish

### Gate
Phase 1 complete. Guardian personas work. Debates trigger on big trades. Ghosts appear on risky behavior.

### Sprint 9: TradingView UDF Server
- Agent: opus
- Dependencies: Sprint 1
- Status: MERGED
- Priority: P1
- Timeout: 180
- Description: Create src/services/chart/udf-server.ts using Express. Implement TradingView UDF endpoints: /config, /symbol_info, /search, /symbols, /history, /time. Serve OHLCV data from CCXT. Support BTC/ETH/SOL on Binance. Run on port 3456 when --web flag is passed.

### Sprint 10: Web Frontend with Lightweight Charts
- Agent: gemini
- Dependencies: Sprint 9
- Status: ACTIVE
- Priority: P1
- Timeout: 180
- Description: Create web/ directory with React frontend. Integrate TradingView Lightweight Charts (install lightweight-charts npm). Connect to UDF server for candle data. Add trade markers on chart (buy = green arrow, sell = red arrow). Include basic chat panel that mirrors terminal conversation. Serve as static files from Express server.

### Sprint 11: Trade Card Screenshot Generator
- Agent: codex
- Dependencies: Sprint 2, Sprint 5
- Status: ACTIVE
- Priority: P2
- Timeout: 120
- Description: Create a /share command that generates a shareable trade card as a text block. Format: "Symbol | Side | Price | Guardian: Name (Rarity) | Thesis: [AI 1-liner] | R:R ratio". Output as copyable text suitable for Twitter/X. No image generation — pure text card that looks good when pasted.

### Sprint 12: Guardian Evolution Diary
- Agent: opus
- Dependencies: Sprint 4, Sprint 5
- Status: MERGED
- Priority: P2
- Timeout: 180
- Description: Create src/buddy/diary.ts. After each trade (success or failure), guardian records an observation in SQLite (better-sqlite3). Schema: diary(id, master, timestamp, trade_id, observation, pattern_type). After 10+ entries, guardian can summarize observed patterns: "I've noticed you tend to exit winners too early." Surface diary insights as periodic guardian comments during quiet moments.
