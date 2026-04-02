# Project Plan: Vibe Sensei — Trading Terminal

## Plan Meta
- Total Phases: 9
- Total Sprints: 45
- Created: 2026-04-01T17:45:00Z
- Last Updated: 2026-04-02T12:00:00Z
- Current Phase: 6

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
- Status: MERGED
- Priority: P0
- Timeout: 180
- Description: Wire RiskGuardian into query loop. After each tool call, pass event to guardian.evaluate(). If alert, inject as assistant message. Wire persona prompt into system prompt assembly in prompts.ts.

### Sprint 14: --web Flag + Chart Server Startup
- Agent: codex
- Dependencies: Sprint 9, Sprint 10
- Status: MERGED
- Priority: P0
- Timeout: 120
- Description: Add --web flag to main.tsx CLI. When passed, start UDF server on port 3456 alongside REPL. Auto-open browser to localhost:3456.

### Sprint 15: Exchange Singleton Wiring
- Agent: codex
- Dependencies: Sprint 1, Sprint 2
- Status: MERGED
- Priority: P0
- Timeout: 120
- Description: Update OrderTool, PositionTool, BalanceTool to use global exchange singleton (getConnectedExchange). Update buildTradingContext() to use same singleton. Paper trading state persists across tool calls.

### Sprint 16: REPL Guardian Welcome + Status
- Agent: codex
- Dependencies: Sprint 5, Sprint 13
- Status: MERGED
- Priority: P1
- Timeout: 120
- Description: On REPL startup, show guardian info below logo: "Guardian: {Name} ({Rarity} {Stars}) — {Quote}". Show paper trading balance. 2 lines max.

## Phase 4: Documentation + Cleanup

### Gate
Phase 3 complete. App fully integrated end-to-end.

### Sprint 17: README.md Rewrite
- Agent: opus
- Dependencies: Sprint 16
- Status: MERGED
- Priority: P0
- Timeout: 180
- Description: Rewrite README from Claude Code reverse-engineering to Vibe Sensei product docs. Features, installation, usage, master roster, architecture, license.

### Sprint 18: CLAUDE.md Update
- Agent: codex
- Dependencies: Sprint 17
- Status: MERGED
- Priority: P0
- Timeout: 120
- Description: Rewrite CLAUDE.md for Vibe Sensei. Project overview, commands, architecture, trading tools, guardian system.

### Sprint 19: Remove Dead Code + Analytics Stubs
- Agent: opus
- Dependencies: none
- Status: MERGED
- Priority: P1
- Timeout: 180
- Description: Remove Anthropic-specific stubs: analytics/GrowthBook, Sentry, telemetry, nativeInstaller, autoUpdater GCS logic. Don't touch query engine, tools, Ink UI, buddy. Test build after each removal.

### Sprint 20: Package.json Cleanup
- Agent: codex
- Dependencies: Sprint 19
- Status: MERGED
- Priority: P1
- Timeout: 120
- Description: Remove unused Claude Code dependencies. Add missing deps. Update package metadata. Verify bun install + bun run build.

## Phase 5: Advanced Features

### Gate
Phase 4 complete. Docs updated. Dead code removed.

### Sprint 21: Additional Risk Checks (leverage, concentration, fat-finger)
- Agent: opus
- Dependencies: Sprint 13
- Status: MERGED
- Priority: P1
- Timeout: 180
- Description: Add 3 more risk checks: leverage (>2x warn), concentration (>40% single asset), order-validation (price deviation >5% = fat finger). Register in checks/index.ts.

### Sprint 22: Market Data WebSocket Feed
- Agent: opus
- Dependencies: Sprint 1, Sprint 15
- Status: MERGED
- Priority: P1
- Timeout: 180
- Description: Create market/feed.ts. CCXT watchTicker() for real-time prices. Update paper trading prices. Push to web frontend via WebSocket. BTC/USDT + ETH/USDT.

### Sprint 23: Python Strategy Bridge
- Agent: opus
- Dependencies: Sprint 2
- Status: MERGED
- Priority: P2
- Timeout: 180
- Description: StrategyTool executes Python scripts from ~/Desktop/trading\ personal/ via subprocess. Parses BUY/SELL/HOLD signals.

### Sprint 24: AutoResearch Workflow (Karpathy-style)
- Agent: opus
- Dependencies: Sprint 23, Sprint 22
- Status: MERGED
- Priority: P2
- Timeout: 300
- Description: Karpathy autoresearch loop: discover factors → compose strategies → backtest → rank by Sharpe/drawdown → iterate. AutoResearchTool for AI invocation.

## Phase 6: Performance & Polish

### Gate
Phase 5 complete. All core features merged.

### Sprint 25: UDF Candle Caching + Exchange Connection Optimization
- Agent: codex
- Dependencies: none
- Status: MERGED
- Priority: P1
- Timeout: 120
- Description: Add LRU cache for OHLCV candle data in UDF server. Deduplicate concurrent requests. Cache loadMarkets() with 1-hour TTL. Promise-based dedup for getConnectedExchange().

### Sprint 26: Guardian Check Utils Extraction + Observer Module Caching
- Agent: codex
- Dependencies: none
- Status: MERGED
- Priority: P1
- Timeout: 120
- Description: Extract duplicated totalPortfolioValue() and positionNotional() into shared utils. Cache dynamic imports in guardian-observer after first load.

### Sprint 27: Bundle Size Optimization
- Agent: opus
- Dependencies: Sprint 25, Sprint 26
- Status: MERGED
- Priority: P1
- Timeout: 180
- Description: Analyze 36MB bundle. Dynamic imports for heavy optional deps. Lazy-load CCXT. Audit unused deps. Target <25MB.

### Sprint 28: WebSocket Feed Reconnection + Error Recovery
- Agent: codex
- Dependencies: Sprint 25
- Status: MERGED
- Priority: P2
- Timeout: 120
- Description: Auto-reconnect with exponential backoff for WebSocket market feed. Connection status tracking. Rate limit handling. UDF error recovery.

## Phase 7: Desktop App — Electron

### Gate
Phase 6 complete. Performance optimizations merged.

### Sprint 29: Electron Scaffold + PTY Terminal
- Agent: opus
- Dependencies: Sprint 27
- Status: MERGED
- Priority: P0
- Timeout: 300
- Description: Electron + Vite + React scaffold. PTY manager spawns Bun REPL. xterm.js terminal panel. Dev script.

### Sprint 30: Chart Panel Integration
- Agent: gemini
- Dependencies: Sprint 29
- Status: MERGED
- Priority: P0
- Timeout: 240
- Description: Port web/app.js into React ChartPanel.tsx. UDF connection. Desktop env detection in main.tsx.

### Sprint 31: Multi-Panel Layout + Window Management
- Agent: gemini
- Dependencies: Sprint 29, Sprint 30
- Status: MERGED
- Priority: P0
- Timeout: 240
- Description: CSS Grid 3-panel layout. Resizable dividers. Custom title bar. Status bar. Window state persistence.

### Sprint 32: Guardian Sidebar + IPC Data Bridge
- Agent: opus
- Dependencies: Sprint 31
- Status: MERGED
- Priority: P0
- Timeout: 300
- Description: Guardian sidebar with MasterCard, PositionsList, BalanceDisplay, AlertFeed, RiskGauge. IPC bridge for guardian data.

### Sprint 33: Desktop UX Polish
- Agent: codex
- Dependencies: Sprint 32
- Status: MERGED
- Priority: P1
- Timeout: 240
- Description: Tray icon, notifications, global shortcuts, menu bar, theme polish, app icons.

### Sprint 34: Build Pipeline + Distribution
- Agent: opus
- Dependencies: Sprint 33
- Status: MERGED
- Priority: P0
- Timeout: 300
- Description: electron-builder for macOS DMG, Windows NSIS, Linux AppImage. Bun runtime detection. Build scripts.

## Phase 8: Desktop Hardening (Post-Review Fixes)

### Gate
Phase 7 complete. Autoplan review identified 3 blockers + 8 critical issues.

### Sprint 35: Build Pipeline Fix + Preload Bundling
- Agent: opus
- Dependencies: Sprint 34
- Status: MERGED
- Priority: P0
- Timeout: 180
- Description: Fix production build blockers. Add esbuild step to compile main process TypeScript (index.ts, preload.ts, pty-manager.ts, etc.) to JavaScript. Update electron-builder.yml file patterns to reference dist/ not source. Update build.sh with main process compilation step. Verify packaged app loads correctly.

### Sprint 36: PTY Crash Recovery + Process Management
- Agent: opus
- Dependencies: Sprint 35
- Status: MERGED
- Priority: P0
- Timeout: 180
- Description: Add PTY exit detection with onExit callback. Send pty:exit event to renderer. Show error overlay in TerminalPanel when PTY dies. Auto-restart with exponential backoff. Kill process group on shutdown (not just pid). Fix mainWindow reference leak in data callback. Add resize bounds validation.

### Sprint 37: IPC Bridge Part 1 — Bun to Electron Socket
- Agent: opus
- Dependencies: Sprint 35
- Status: MERGED
- Priority: P0
- Timeout: 300
- Description: Create Unix domain socket server in Electron main process. In Bun REPL, when VIBE_SENSEI_DESKTOP=1, connect to socket and emit trading state after each tool call. Send positions, balances, risk score as JSON messages. Replace placeholder data in ipc-router.ts with real state store.

### Sprint 38: IPC Bridge Part 2 — Guardian Alerts + Real Data
- Agent: opus
- Dependencies: Sprint 37
- Status: MERGED
- Priority: P0
- Timeout: 300
- Description: Wire guardian-observer.ts to emit alerts via desktop socket when in desktop mode. Forward real guardian alerts to renderer (replace placeholder Nassim Taleb data). Forward real master assignment from companion.ts. Native notifications fire on real CRITICAL+ alerts. Sidebar updates live when user trades.

### Sprint 39: Race Conditions + Error Handling + IPC Validation
- Agent: codex
- Dependencies: Sprint 36
- Status: MERGED
- Priority: P0
- Timeout: 180
- Description: Add PTY readiness handshake before renderer loads URL. Add try/catch to all IPC handlers in index.ts. Add Zod validation schemas for TradingState, GuardianAlert, MasterInfo in ipc-channels.ts. Validate messages in preload.ts before passing to callbacks. Add React Error Boundary in App.tsx.

### Sprint 40: Accessibility + Test Infrastructure
- Agent: codex
- Dependencies: Sprint 39
- Status: MERGED
- Priority: P1
- Timeout: 240
- Description: Add tabindex to panel elements for Tab navigation. Add ARIA roles (progressbar for RiskGauge, log for AlertFeed, row for positions). Add aria-labels. Improve focus ring visibility (2px, 0.6 opacity). Add colorblind indicators (arrows) for PnL. Add vitest config + basic test suite for pty-manager, ipc-router, and hooks.
