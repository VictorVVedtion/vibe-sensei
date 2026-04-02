# Project Plan: Vibe Sensei — Trading Terminal

## Plan Meta
- Total Phases: 5
- Total Sprints: 24
- Created: 2026-04-01T17:45:00Z
- Last Updated: 2026-04-02T00:30:00Z
- Current Phase: 3

## Phase 0: Core Trading Loop — COMPLETE

### Sprint 1: CCXT Exchange Service + Paper Trading
- Agent: opus
- Dependencies: none
- Status: MERGED

### Sprint 2: OrderTool + PositionTool + BalanceTool
- Agent: opus
- Dependencies: Sprint 1
- Status: MERGED

### Sprint 3: Trading Context Injection
- Agent: codex
- Dependencies: Sprint 1
- Status: MERGED

### Sprint 4: Guardian Risk Engine (Phase 0 — 2 checks)
- Agent: opus
- Dependencies: Sprint 1, Sprint 2
- Status: MERGED

## Phase 1: Guardian Persona System — COMPLETE

### Sprint 5: Guardian Persona Prompt System
- Agent: codex
- Dependencies: Sprint 4
- Status: MERGED

### Sprint 6: Cross-Guardian Consultation ("What would X do?")
- Agent: codex
- Dependencies: Sprint 5
- Status: MERGED

### Sprint 7: Guardian Debates (dual-master adversarial analysis)
- Agent: opus
- Dependencies: Sprint 5
- Status: MERGED

### Sprint 8: Ghost Warning System
- Agent: codex
- Dependencies: Sprint 4
- Status: MERGED

## Phase 2: Web Mode + Polish — COMPLETE

### Sprint 9: TradingView UDF Server
- Agent: opus
- Dependencies: Sprint 1
- Status: MERGED

### Sprint 10: Web Frontend with Lightweight Charts
- Agent: gemini
- Dependencies: Sprint 9
- Status: MERGED

### Sprint 11: Trade Card Screenshot Generator
- Agent: codex
- Dependencies: Sprint 2, Sprint 5
- Status: MERGED

### Sprint 12: Guardian Evolution Diary
- Agent: opus
- Dependencies: Sprint 4, Sprint 5
- Status: MERGED

## Phase 3: Integration + Wiring

### Gate
All Phase 0-2 modules exist but aren't fully wired into the main app loop.

### Sprint 13: Guardian Observer in Query Loop
- Agent: opus
- Dependencies: Sprint 4, Sprint 5
- Status: PENDING
- Priority: P0
- Timeout: 180
- Description: Wire RiskGuardian into query loop. After each tool call, pass event to guardian.evaluate(). If alert, inject as assistant message. Wire persona prompt into system prompt assembly in prompts.ts.

### Sprint 14: --web Flag + Chart Server Startup
- Agent: codex
- Dependencies: Sprint 9, Sprint 10
- Status: PENDING
- Priority: P0
- Timeout: 120
- Description: Add --web flag to main.tsx CLI. When passed, start UDF server on port 3456 alongside REPL. Auto-open browser to localhost:3456.

### Sprint 15: Exchange Singleton Wiring
- Agent: codex
- Dependencies: Sprint 1, Sprint 2
- Status: PENDING
- Priority: P0
- Timeout: 120
- Description: Update OrderTool, PositionTool, BalanceTool to use global exchange singleton (getConnectedExchange). Update buildTradingContext() to use same singleton. Paper trading state persists across tool calls.

### Sprint 16: REPL Guardian Welcome + Status
- Agent: codex
- Dependencies: Sprint 5, Sprint 13
- Status: PENDING
- Priority: P1
- Timeout: 120
- Description: On REPL startup, show guardian info below logo: "Guardian: {Name} ({Rarity} {Stars}) — {Quote}". Show paper trading balance. 2 lines max.

## Phase 4: Documentation + Cleanup

### Gate
Phase 3 complete. App fully integrated end-to-end.

### Sprint 17: README.md Rewrite
- Agent: opus
- Dependencies: Sprint 16
- Status: PENDING
- Priority: P0
- Timeout: 180
- Description: Rewrite README from Claude Code reverse-engineering to Vibe Sensei product docs. Features, installation, usage, master roster, architecture, license.

### Sprint 18: CLAUDE.md Update
- Agent: codex
- Dependencies: Sprint 17
- Status: PENDING
- Priority: P0
- Timeout: 120
- Description: Rewrite CLAUDE.md for Vibe Sensei. Project overview, commands, architecture, trading tools, guardian system.

### Sprint 19: Remove Dead Code + Analytics Stubs
- Agent: opus
- Dependencies: none
- Status: PENDING
- Priority: P1
- Timeout: 180
- Description: Remove Anthropic-specific stubs: analytics/GrowthBook, Sentry, telemetry, nativeInstaller, autoUpdater GCS logic. Don't touch query engine, tools, Ink UI, buddy. Test build after each removal.

### Sprint 20: Package.json Cleanup
- Agent: codex
- Dependencies: Sprint 19
- Status: PENDING
- Priority: P1
- Timeout: 120
- Description: Remove unused Claude Code dependencies. Add missing deps. Update package metadata. Verify bun install + bun run build.

## Phase 5: Advanced Features

### Gate
Phase 4 complete. Docs updated. Dead code removed.

### Sprint 21: Additional Risk Checks (leverage, concentration, fat-finger)
- Agent: opus
- Dependencies: Sprint 13
- Status: PENDING
- Priority: P1
- Timeout: 180
- Description: Add 3 more risk checks: leverage (>2x warn), concentration (>40% single asset), order-validation (price deviation >5% = fat finger). Register in checks/index.ts.

### Sprint 22: Market Data WebSocket Feed
- Agent: opus
- Dependencies: Sprint 1, Sprint 15
- Status: PENDING
- Priority: P1
- Timeout: 180
- Description: Create market/feed.ts. CCXT watchTicker() for real-time prices. Update paper trading prices. Push to web frontend via WebSocket. BTC/USDT + ETH/USDT.

### Sprint 23: Python Strategy Bridge
- Agent: opus
- Dependencies: Sprint 2
- Status: PENDING
- Priority: P2
- Timeout: 180
- Description: StrategyTool executes Python scripts from ~/Desktop/trading\ personal/ via subprocess. Parses BUY/SELL/HOLD signals.

### Sprint 24: AutoResearch Workflow (Karpathy-style)
- Agent: opus
- Dependencies: Sprint 23, Sprint 22
- Status: PENDING
- Priority: P2
- Timeout: 300
- Description: Karpathy autoresearch loop: discover factors → compose strategies → backtest → rank by Sharpe/drawdown → iterate. AutoResearchTool for AI invocation.
