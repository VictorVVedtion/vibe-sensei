# Project Plan: Vibe Sensei — Trading Terminal

## Plan Meta
- Total Phases: 15
- Total Sprints: 78
- Created: 2026-04-01T17:45:00Z
- Last Updated: 2026-04-04T08:15:00Z
- Current Phase: 15

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

## Phase 9: LLM x Vibe Trading — Intelligent Risk Layer

### Gate
Phase 8 complete. All desktop hardening sprints merged. Research complete (7 agent deep-dive).

### Sprint 41: Market Regime Engine + Portfolio Heat Calculator
- Agent: opus
- Dependencies: none
- Status: MERGED
- Priority: P0
- Timeout: 300
- Description: Create MarketRegimeEngine in src/services/market/regime.ts. Compute regime from 4h candles: ATR(14) percentile + HH/HL directional count. Classify trending_up/trending_down/ranging/compressing/expanding with confidence score. Create regime types in src/services/market/types.ts. Recompute every 4h, store in memory. Create portfolio heat calculator in src/services/portfolio/heat-calculator.ts. For each position with stop: risk=(entry-stop)*qty. Without stop: assume 10% adverse move. Heat = sum(risks)/equity. Replace hardcoded riskScore:0 in TradingState with actual heat percentage. Emit regime + heat via desktop bridge. Hook regime computation into market feed poll loop.

### Sprint 42: Dynamic Check Thresholds by Archetype
- Agent: opus
- Dependencies: Sprint 41
- Status: MERGED
- Priority: P0
- Timeout: 180
- Description: Create src/buddy/thresholds.ts with 9-archetype x 10-check threshold matrix. value_investor leverage WARNING at 1.2x vs crypto_native at 4x. Add stat modifiers (high AGGRESSION relaxes position-size 25%, high WISDOM tightens 15%). Add regime modifiers (trending allows 30% higher concentration). Update all check functions (leverage, position-size, concentration, drawdown) to accept optional ThresholdConfig parameter with backward-compatible defaults. Update RiskGuardian.evaluate() to compute and pass dynamic thresholds via getThresholds(archetype, stats, regime).

### Sprint 43: Pre-Trade Gate Tool (9 Pre-Flight Checks)
- Agent: opus
- Dependencies: Sprint 41, Sprint 42
- Status: MERGED
- Priority: P0
- Timeout: 300
- Description: Create PreTradeGateTool in src/tools/PreTradeGateTool/ wrapping OrderTool. 9 checks before PlaceOrder: portfolio-heat, single-position-risk, concentration-correlation, regime-alignment, volume-confirmation, stop-loss-presence, risk-reward-ratio, revenge-trade, daily-loss-limit. Gate returns pass/warn/fail with per-check results and recommendation. Override mechanism with one-time tokens (2 min expiry). Register as tool alongside OrderTool. Each check in its own file under src/buddy/checks/. Gate latency target <500ms.

### Sprint 44: ATR Stop-Loss Advisor + Circuit Breaker
- Agent: opus
- Dependencies: Sprint 41, Sprint 43
- Status: MERGED
- Priority: P0
- Timeout: 300
- Description: ATR Stop Advisor in src/services/market/atr-advisor.ts: compute ATR(14) from 4h candles, suggest stop at entry minus ATR*multiplier (2x trending, 1x ranging, 1.5x counter-trend). Calculate risk-sized max quantity (2% equity risk). Output as recommendation not auto-execute. Circuit Breaker in src/buddy/checks/circuit-breaker.ts + src/state/circuit-state.ts: daily loss limit >5% = EMERGENCY hard block, trade frequency >10 round-trips per hour = CRITICAL, escalating loss 3+ consecutive each larger = CRITICAL. Circuit checks run FIRST in pre-trade gate. Add SMA and TrueRange helpers to checks/utils.ts.

### Sprint 45: Enhanced Diary — 6 New Behavioral Patterns
- Agent: opus
- Dependencies: none
- Status: MERGED
- Priority: P1
- Timeout: 300
- Description: Extend diary.ts with 6 new pattern detectors. (1) Time-of-day bias: win rate by Asian/European/American session, alert if <35% with 5+ trades. (2) Holding period bias: <1h scalp, 1-24h swing, 1-7d position, >7d invest, alert if <30% with 5+ trades. (3) Instrument bias: per-symbol win rate, alert if <35% with 5+ trades. (4) Position size vs outcome: detect if large positions have >20% worse win rate. (5) Averaging down: 2+ buys at successively lower prices within 2h. (6) Pyramid success: adding to winners tracking. Extend DiaryEntry with tradeUtcHour, holdDurationMs, positionSizePercentile, profitPercent. Add getEnhancedSummary(). Create checkBehavioralPatterns() in src/buddy/checks/behavioral-patterns.ts.

### Sprint 46: Post-Trade R-Multiple Report
- Agent: opus
- Dependencies: Sprint 45
- Status: MERGED
- Priority: P1
- Timeout: 240
- Description: Create src/buddy/trade-report.ts. Detect position closure (qty to 0) in OrderTool by comparing positions before/after sell. Compute: gross/net PnL, R-multiple (net PnL / initial risk), hold duration, MAE (max adverse excursion from candle lows during hold), MFE (max favorable from highs), efficiency ratio (actual PnL / MFE). Store TradeReport in diary with rolling cumulative stats (win rate, avg R, expectancy over last 20 trades). Format report for terminal. Add generateTradeReportCard() to trade-card.ts.

### Sprint 47: Dynamic Guardian Prompts (Context-Aware Alerts)
- Agent: opus
- Dependencies: Sprint 41, Sprint 45
- Status: MERGED
- Priority: P1
- Timeout: 240
- Description: Enhance persona.ts buildGuardianSystemPrompt() with 4 dynamic context layers injected on alerts only. (1) Regime layer ~50 tokens: current market state + archetype guidance. (2) Diary layer ~80 tokens: top pattern + worst/best instrument + best session. (3) Portfolio state ~60 tokens: heat + drawdown zone + correlation risk. (4) Recovery layer ~70 tokens: archetype-specific guidance when drawdown >5%. Add ARCHETYPE_RECOVERY_GUIDANCE constant (9 archetypes x 2 depths). Create getPersonalizedAlertWithContext() async function. Pass exchange + diary to guardian alert generation. Normal queries stay at 150 tokens. Alert prompts max 410 tokens.

### Sprint 48: Enhanced Ghost Triggers (4 New Financial Ghosts)
- Agent: opus
- Dependencies: none
- Status: MERGED
- Priority: P1
- Timeout: 240
- Description: Add 4 new ghosts to types.ts GHOST_WARNINGS array and ghost-triggers.ts. (1) LTCM — correlation collapse: 3+ positions, one deviates >3x from median move. (2) Lehman — cascading liquidation: leverage >2x AND market down >5% in 24h. (3) Enron — concentrated loser: single position >60% portfolio AND losing. (4) SVB — bag holding: held >14 days with >15% unrealized loss. Add per-ghost 60-minute cooldown replacing 1-per-session limit. Create src/buddy/ghost-persona.ts with tone and recovery guidance per ghost. Extend GhostContext interface with historicalPrices and lastPrice. Update GhostEngine.checkAll() for 8 total ghosts.

### Sprint 49: 52 Guardian ASCII Portraits
- Agent: opus
- Dependencies: none
- Status: MERGED
- Priority: P1
- Timeout: 180
- Description: Create src/buddy/sprite-atlas.ts with personality-driven ASCII art for all 52 masters. Unique 3-line portraits + compactFace per master. Update sprites.ts rendering engine with rarity-aware borders (legendary=double, epic=rounded), stringWidth fix, 8-line box format.

## Phase 10: Multimodal Trading Companion — COMPLETE

### Gate
Phase 9 complete. Sprint 49 (ASCII portraits) merged. CEO Review approved 5 scope expansions for multimodal companion system.

### Sprint 50: Expression System (4 Emotional States per Master)
- Agent: opus
- Dependencies: Sprint 49
- Status: MERGED
- Priority: P0
- Timeout: 300
- Description: Extend MasterPortrait interface with emotion-keyed portrait variants. 4 states per master: neutral (existing), happy (trade wins), worried (high risk/drawdown), stern (rule violations). Add ExpressionEngine in src/services/companion/expression.ts mapping trading events to emotion states. Fix blink animation: add eyeChars field to MasterPortrait so CompanionSprite.tsx can find the correct eye characters to replace. Wire expression changes through companionReaction pipeline. For legendary masters: 4 full unique portraits. Epic: 3 (neutral+happy+worried). Rare: 2 (neutral+worried). Uncommon/Common: neutral only (existing).

### Sprint 51: Proactive Companion Engine (Async Interjections)
- Agent: opus
- Dependencies: Sprint 50
- Status: MERGED
- Priority: P0
- Timeout: 300
- Description: Create src/services/companion/engine.ts as central CompanionEngine. Create src/services/companion/proactive-monitor.ts with 4 trigger types: (1) Time-based: session >2h without break → remind rest. (2) Market events: regime change detected → alert. (3) Behavioral patterns: diary detects revenge trading → intervene. (4) Encouragement: 3+ consecutive wins → praise. Cooldown system: min 5 minutes between interjections. Severity escalation (gentle→firm→urgent). Use companionReaction to push messages. Wire into REPL via setInterval polling. Master speaks in character using persona.ts prompts.

### Sprint 52: Async Master Council (Background Debates)
- Agent: opus
- Dependencies: Sprint 51
- Status: MERGED
- Priority: P1
- Timeout: 240
- Description: Create src/services/companion/council.ts extending debate.ts. Trigger conditions: portfolio heat >60%, new position >20% portfolio, market regime change. Council selects 2-3 relevant masters (based on archetype fit) to debate. Runs async in background, pushes conclusion to companionReaction when done. Format: "[Master1] vs [Master2]: Master1 argues X, Master2 counters Y. Conclusion: Z." Reuse debate.ts scoring logic. Max 1 council per 30 minutes.

### Sprint 53: Chart Vision — Gemini Integration
- Agent: opus
- Dependencies: Sprint 51
- Status: MERGED
- Priority: P0
- Timeout: 300
- Description: Create src/services/companion/vision.ts with VisionService. ChartCapture: use Puppeteer to screenshot TradingView at :3456 (requires --web mode). Compress to JPEG 80%. Send to Gemini 2.5 Flash via REST API with master persona prompt. Parse response as chart analysis. Trigger: on-demand via command, or automatically when ProactiveMonitor detects significant price movement. Master comments in character (Livermore on momentum, Simons on statistical patterns). Gemini API key from env GEMINI_API_KEY. Graceful degradation: if --web not running or API fails, skip silently.

### Sprint 54: TTS — Master Voice Output
- Agent: opus
- Dependencies: Sprint 53
- Status: MERGED
- Priority: P1
- Timeout: 300
- Description: Create src/services/companion/voice.ts with VoiceService. Use Gemini 2.5 Pro Preview TTS API. Map 9 archetypes to voice presets: value_investor→Sulafat(warm), trend_follower→Kore(firm), macro_trader→Charon(informative), quant→Enceladus(measured), strategist→Fenrir(commanding), philosopher→Aoede(contemplative), first_principles→Puck(energetic), crypto_native→Leda(mysterious), scientist→Orbit(precise). Stream 24kHz PCM audio, pipe to system audio player (afplay on macOS). Natural language style prompt per master personality. Toggle via config. Silent fallback if audio device unavailable. Desktop-only initially (terminal audio may not work in all environments).

### Sprint 55: STT — Voice Input
- Agent: opus
- Dependencies: Sprint 54
- Status: MERGED
- Priority: P2
- Timeout: 300
- Description: Create src/services/companion/stt.ts. Use Gemini 3.1 Flash Live API via WebSocket. Record microphone audio (16kHz PCM) using node-record-lpcm16 or native APIs. Stream to Gemini Live, receive transcription. Inject transcribed text as user messages into the conversation. Push-to-talk mode (keyboard shortcut to activate). Auto-timeout after 10s silence. Permission request flow for microphone access. Desktop-only (Electron has native audio access). Barge-in support: user can interrupt TTS playback.

### Sprint 56: Full Duplex Voice Conversation
- Agent: opus
- Dependencies: Sprint 55
- Status: MERGED
- Priority: P2
- Timeout: 300
- Description: Create src/services/companion/live-session.ts. Use Gemini 3.1 Flash Live API for full-duplex audio conversation. WebSocket connection management with reconnection. Function calling integration: master can check positions, balances mid-conversation. Session context: inject master persona + portfolio state + regime. Voice activity detection for natural turn-taking. Visual indicator in CompanionSprite when master is "listening" vs "speaking". Graceful shutdown on session end.

## Phase 11: Trading Knowledge Base (Karpathy-Inspired) — COMPLETE

### Gate
Phase 10 complete. CEO Review + Eng Review approved. Karpathy LLM Knowledge Base pattern: raw data -> LLM compile -> .md wiki -> Q&A / linting -> feedback loop. Resolves data persistence gap (only diary.json survives restarts).

### Sprint 57: Event Store Foundation
- Agent: opus
- Dependencies: none
- Status: MERGED
- Priority: P0
- Timeout: 300
- Description: Create JSONL event persistence layer at ~/.vibe-sensei/events/. Create src/services/knowledge/event-store.ts and src/services/knowledge/types.ts. Define 7 event types with Zod schemas: TradeLogEvent (avoid collision with diary.ts TradeEvent), AlertEvent, GhostEvent, RegimeChangeEvent, CircuitBreakerEvent, GateCheckEvent, DiaryPatternEvent. Use appendEvent(event) direct function call (not EventEmitter). For synchronous callers (ghost-warnings.ts, circuit-state.ts, diary.ts), use queueEvent() with setImmediate flush + process.on('beforeExit', flushQueue). For async callers (guardian-observer.ts, gateEvaluator.ts, regime.ts), direct await + try-catch. Use dynamic import with null fallback matching codebase pattern. JSONL files partitioned by month (YYYY-MM.jsonl), 10MB rotation. File permissions 0o600. diary.ts remains pattern detector, calls appendEvent as side-effect of recordTrade(). Migration: read diary.json -> convert to JSONL -> rename to .bak, with .migration-complete marker to prevent re-migration. JSONL reader: per-line parse, skip corrupted lines + log warning. Data dir at ~/.vibe-sensei/ (user home, not repo).

### Sprint 58: Counterfactual + Advice Accuracy
- Agent: opus
- Dependencies: Sprint 57
- Status: MERGED
- Priority: P0
- Timeout: 300
- Description: Create src/services/knowledge/counterfactual.ts. In guardian-observer.ts, when alert shown and user proceeds, log AlertIgnoredEvent to JSONL. Ignored = same symbol order within 5 minutes of alert (use Date.now() consistently for both). Maintain in-memory ring buffer of last N AlertEvents for fast correlation (avoid JSONL reads on every order). Record heeded (true/false), trade result (profit/loss/amount). From JSONL directly compute per-archetype accuracy, per-regime accuracy, accuracy trend. Output as JSONL query results for later wiki compilation. Phase B (full counterfactual PnL) deferred.

### Sprint 59: Knowledge Compiler + Obsidian Wiki
- Agent: opus
- Dependencies: Sprint 57
- Status: MERGED
- Priority: P0
- Timeout: 300
- Description: Create src/services/knowledge/compiler.ts and prompts.ts. Read JSONL events -> Gemini 2.5 Flash -> generate/update wiki .md at ~/.vibe-sensei/wiki/. Structure: INDEX.md, patterns/, markets/, self/, sessions/, reports/. GEMINI_API_KEY env var, missing -> fallback to local template mode (pure stats, no LLM insights). First /compile shows consent prompt about data sent to Gemini. API failure: rate limit/timeout -> skip cycle + increment skip counter, auth error -> one-time notify, 3 consecutive skips -> companionReaction warning. Atomic writes (.tmp -> rename). Incremental compilation via .compile-state.json tracking last-compiled-event-id + byte offset. Obsidian format opt-in (default on): [[wikilinks]] + YAML frontmatter. REPL slash command /compile + auto every 5 trades. /compile --full for rebuild. Foreground execution with progress display.

### Sprint 60: Knowledge Query Router
- Agent: opus
- Dependencies: Sprint 59
- Status: MERGED
- Priority: P0
- Timeout: 240
- Description: Create src/services/knowledge/query-router.ts. Separate routing layer before persona pipeline (not embedded inside). Read INDEX.md, rank by symbol match > regime match > recency. Inject into Guardian context. CONTEXT_TOKEN_BUDGET from ~260 to ~360 tokens. 5th knowledge layer at priority 2 (after regime, before portfolio) with ~100 token sub-budget. Refactor getPersonalizedAlertWithContext() to options object (fix existing type mismatch EnhancedDiarySummary vs EnhancedPatternSummary as prerequisite). Intent detection via keyword matching with negative keywords (skip if "consult"/"ask" present). Symbol detection via regex /[A-Z]{2,10}\/[A-Z]{2,10}/ -> check markets/<symbol>.md. Wiki empty/uncompiled -> graceful degradation.

### Sprint 61: Self-Audit + Pattern Discovery
- Agent: opus
- Dependencies: Sprint 59
- Status: MERGED
- Priority: P1
- Timeout: 300
- Description: Create src/services/knowledge/auditor.ts. Periodic wiki health check: find inconsistencies, impute missing data, suggest new article candidates. Pattern Discovery: during compilation, pass event batches to LLM, find patterns beyond diary.ts 13 PatternType types. New patterns -> patterns/discovered/ + companionReaction notify. Wiki Health Score: completeness (% events compiled), freshness (days since last compile), coverage (% symbols with market articles).

### Sprint 62: Morning Brief + Knowledge Milestones
- Agent: opus
- Dependencies: Sprint 59, Sprint 61
- Status: MERGED
- Priority: P1
- Timeout: 240
- Description: Create src/services/knowledge/morning-brief.ts and milestones.ts. Morning Brief: first startup of day (check last-brief-date), Guardian generates 5-line personalized briefing from wiki. Content: current regime + historical win rate, behavioral pattern reminder, discipline streak count, advice accuracy highlight. Guardian personality voice via persona.ts. Milestones: thresholds at 10/50/100/250 events, 7/14/30 day discipline streaks, first pattern discovery, first wiki compile. Track achieved milestones in state. Guardian celebrates in character. Visual via companionReaction.

## Phase 12: Knowledge Base Hardening (Autoplan Review Fixes)

### Gate
Phase 11 complete. Autoplan re-review identified 4 critical bugs in shipped knowledge base code. CEO + Eng dual voices (Claude + Codex) both confirmed findings.

### Sprint 65: Knowledge Base Security + Data Integrity Fixes
- Agent: opus
- Dependencies: Sprint 62
- Status: MERGED
- Priority: P0
- Timeout: 240
- Description: Fix 4 critical issues found by autoplan review in src/services/knowledge/. (1) Path traversal via LLM output: in compiler.ts writeArticle(), validate that join(WIKI_DIR, path) starts with WIKI_DIR before writing. Reject paths containing '..' or absolute paths. (2) Incremental compile data loss: in compiler.ts compile(), the template mode compileWithTemplate() regenerates canonical files (patterns/overview.md, self/profile.md, INDEX.md) from only new events, erasing historical data. Fix: always pass ALL events to compileWithTemplate(), not just newEvents. For Gemini mode compileWithLLM(), pass existing wiki content as context so the LLM can merge rather than overwrite. (3) API key in URL: in compiler.ts, auditor.ts, and morning-brief.ts, move the Gemini API key from URL query parameter (?key=) to x-goog-api-key HTTP header. Extract shared callGemini() helper to a new file src/services/knowledge/gemini-client.ts to eliminate the 3x DRY violation. (4) File sort order after rotation: in event-store.ts listEventFiles(), the lexicographic sort puts YYYY-MM-02.jsonl before YYYY-MM.jsonl because '-' < '.'. Fix: sort base files before their rotated suffixes within each month prefix.

### Sprint 66: API + CLI Resilience Fixes (Rampage Findings)
- Agent: opus
- Dependencies: none
- Status: MERGED
- Priority: P1
- Timeout: 120
- Description: Fix 6 issues from rampage chaos test. (1) Screenshot MIME spoofing: validate PNG magic bytes on POST /api/screenshot. (2) NaN timestamp fallthrough: check Number.isNaN() on /history from/to params. (3) Express fingerprint: app.disable('x-powered-by'). (4) Custom 404 handler: JSON instead of Express HTML. (5) Search limit=0 behavior: fix Number(0)||10 falsy bug. (6) Wrong method 404→405.

## Phase 13: Full-Stack Hardening (CSO + E2E + Code Health Audit Fixes)

### Gate
Phase 12 complete. 4 parallel audits (CSO Security, Trading E2E, Guardian E2E, Code Health) identified 5 HIGH, 16 MEDIUM, 23 LOW findings. Phase 13 addresses all HIGH and actionable MEDIUM issues.

### Sprint 67: Reliability + Security Hardening
- Agent: opus
- Dependencies: Sprint 66
- Status: MERGED
- Priority: P0
- Timeout: 180
- Description: Fix 7 issues from CSO/Trading E2E/Code Health audits. (1) Exchange singleton stale-promise bug — reset connectionPromise on failure. (2) PositionTool/BalanceTool/ChartTool add try/catch around exchange calls. (3) TTS API key from URL to x-goog-api-key header. (4) UDF server bind 127.0.0.1. (5) UDF 500 error message sanitization. (6) diary.json file permissions 0o600. (7) StrategyTool isReadOnly → false.

### Sprint 68: Guardian System Bug Fixes
- Agent: opus
- Dependencies: none
- Status: MERGED
- Priority: P0
- Timeout: 180
- Description: Fix 7 issues from Guardian E2E audit. (1) persona.ts buildDiaryContext accesses non-existent fields → [object Object] garbled output. (2) debate.ts market orders never trigger debates (price=undefined→value=0). (3) Ghost convenience function loses cooldown state. (4) Diary enhanced summary cache uses only length as hash. (5) persona.ts silent catch blocks → add logging. (6) Guardian observer hardcoded companion values. (7) types.ts master count update + duplicate quote fix.

### Sprint 69: Real Market Prices + Symbol Validation
- Agent: opus
- Dependencies: none
- Status: MERGED
- Priority: P0
- Timeout: 240
- Description: Make PaperExchange use real market prices from OKX (CCXT public API). Inject market data source into PaperExchange, delegate getTicker/getCandles to real exchange with graceful fallback. Add symbol validation to reject unknown pairs (InvalidSymbolError). Lazy connection on first use.

### Sprint 70: Desktop Renderer Fix
- Agent: opus
- Dependencies: none
- Status: MERGED
- Priority: P0
- Timeout: 240
- Description: Fix Desktop Electron blank screen. Root causes: (1) Vite base path missing './' → assets didn't load via file://. (2) PTY manager projectRoot off by one directory level. (3) isDev detection wrong for compiled code. (4) PTY spawn error handling missing try-catch.

### Sprint 71: Desktop Design Overhaul (Gemini 3.1 Pro Review)
- Agent: opus
- Dependencies: Sprint 70
- Status: MERGED
- Priority: P1
- Timeout: 240
- Description: Implement Gemini 3.1 Pro design review improvements. (1) Kill all border-radius and box-shadow globally. (2) Enforce abyssal palette — cyan-green #00FFA3 up, magenta #C850C0 down. (3) Discretize risk gauge to ASCII blocks. (4) Compact guardian card. (5) Remove CSS transitions. (6) Tighten spacing. (7) Darker status bar. (8) Tabular numbers. (9) Step animations.

## Phase 14: E2E Bug Fixes (CLI Deep Test Findings)

### Gate
Phase 13 complete. 68 fine-grained CLI tests found 3 bugs and 3 weak areas. Phase 14 fixes all actionable bugs.

### Sprint 72: CancelOrder Tool + Chart/Research Symbol Validation + Price Fallback
- Agent: opus
- Dependencies: Sprint 69
- Status: MERGED
- Priority: P1
- Timeout: 180
- Description: Fix 3 bugs from E2E deep testing. (1) Create CancelOrderTool: wrap exchange.cancelOrder() as a new tool, register in tools.ts. (2) Add symbol validation to ShowChart and AutoResearch tools — reject unknown symbols instead of showing fake $50K data. (3) Improve price fallback: when market data source fails to connect, block market orders or use per-symbol cached prices instead of universal $50K DEFAULT_PRICE.

## Phase 15: Companion Always-On + Ambient Intelligence

### Gate
Phase 14 complete. CEO Review (SCOPE EXPANSION, 6/6 accepted) + Design Review (7.5/10) + Eng Review (5 issues resolved) + Codex Outside Voice (9 findings, regime fusion architecture designed). Autoplan CLEARED. User's existing uncommitted changes provide the base (10 files, +315/-434 lines: CompanionSprite minimalist rewrite, Braille→ASCII chart, LiveChart auto-refresh, desktop dev fix).

### Sprint 73: Core Cleanup — Feature Gates + Dead Code + Chart Fixes
- Agent: opus
- Dependencies: none
- Status: MERGED
- Priority: P0
- Timeout: 240
- Description: Three cleanup tasks on the existing uncommitted changes. (1) Remove remaining 6 feature('BUDDY') gates: src/commands.ts:119, src/components/PromptInput/PromptInput.tsx:312+1789+1984, src/buddy/prompt.ts:18, src/utils/attachments.ts:865. Remove the feature() call and keep the inner code unconditional. (2) Dead code cleanup in CompanionSprite.tsx: remove unused imports (useTerminalSize, stringWidth, Theme, renderSprite, spriteFrameCount, MASTER_PORTRAITS), unused constants (IDLE_SEQUENCE, PET_HEARTS, MIN_COLS_FOR_FULL_SPRITE, SPRITE_BODY_WIDTH, NAME_ROW_PAD, SPRITE_PADDING_X, BUBBLE_WIDTH, NARROW_QUIP_CAP), unused function spriteColWidth(), and unused variable colWidth at line 219. (3) Chart fixes: in CandlestickChart.tsx change colWidth from 1 to 2 to match render-candles.ts COL_WIDTH=2. In render-candles.ts and CandlestickChart.tsx revert getHours()/getMonth()/getDate() back to getUTCHours()/getUTCMonth()/getUTCDate() and add ' UTC' suffix to the info bar dateStr.

### Sprint 74: Guardian Display Singleton + LiveChart Hardening
- Agent: opus
- Dependencies: Sprint 73
- Status: MERGED
- Priority: P0
- Timeout: 300
- Description: (1) Create src/buddy/guardian-display.ts as a module-level singleton (NOT a React hook with timer) that provides getGuardianDisplay(): {displayText, fading, emotionColor, emotion}. Owns a single tick counter with adaptive rate: 500ms when reaction active, 5000ms when idle. Both CompanionSprite and CompanionFloatingBubble consume this singleton via a thin useGuardianDisplay() hook that subscribes to changes. This avoids the double-instance problem in fullscreen where both components mount simultaneously (REPL.tsx:4617 + REPL.tsx:5047). (2) LiveChart hardening in src/tools/ChartTool/UI.tsx: add global incrementing generationId — each new LiveChart instance gets the next ID, refresh callback checks if its ID is still current before updating state. Add consecutiveFails counter: after 3 failures show dim '⚠ stale' in chart title. Add exponential backoff on failures: base interval → 2x → 4x → cap at 60s. Reset to base on success. Add empty state: if initial candles are empty, show 'No candle data for {symbol}'. (3) Narrow terminal guard: if terminal columns < 40, hide SpeechBubble and show only minimalistFaceRow. If < 20, return null (hide companion entirely).

### Sprint 75: Lightweight Regime Poller + Primary Symbol Resolution
- Agent: opus
- Dependencies: Sprint 74
- Status: PENDING
- Priority: P0
- Timeout: 300
- Description: Create src/services/companion/regime-poller.ts as a module-level singleton with start()/stop() lifecycle. On start(): resolve primary symbol via priority chain — (1) check portfolio positions via getConnectedExchange().getPositions(), use first position's symbol, (2) if no positions, check diary.getLastTradedSymbol() if diary has trades, (3) default to 'BTC/USDT'. Every 5 minutes: call getConnectedExchange().getCandles(primarySymbol, '4h', 65) and pass to the EXISTING computeRegime() from src/services/market/regime.ts (use 65 candles, same as MarketFeed, to avoid creating a weaker second model per Codex finding). Write result to the existing regime cache via setLatestRegime(). If MarketFeed is also running (UDF WebSocket connected), MarketFeed data takes priority (it polls more frequently). If exchange not connected: no-op, leave regime cache empty. On primary symbol change (position opened/closed): update and re-poll immediately. Expose getRegimePollerStatus(): {symbol, lastPoll, regime}. Wire start() call into companion boot in REPL.tsx alongside existing companion initialization (after getCompanion() succeeds). Stop on process exit.

### Sprint 76: Context-Aware Idle Quotes + Time Greetings + Emotion Colors
- Agent: opus
- Dependencies: Sprint 74, Sprint 75
- Status: PENDING
- Priority: P1
- Timeout: 300
- Description: (1) Extend idle-quotes.ts: add regime relevance tags to existing 54 quotes. Each quote gets optional tags: regimes it's most relevant for (e.g., value_investor quote 'Margin of safety' → ['ranging','compressing']). Add CARE_QUOTES array (6 quotes per archetype for idle >10min). Add TIME_QUOTES: morning (05-10), late_night (00-05), weekend (Sat/Sun). Extend getIdleQuote() signature to accept context: {regime?, isLateNight?, isMorning?, isWeekend?, isIdle10min?}. Priority chain: care (10min idle) > lateNight > morning/weekend > regime-filtered > generic. (2) Idle detection: add public getLastActivityTime(): number to src/utils/activityManager.ts that returns the private lastUserActivityTime value. In guardian-display.ts singleton, check Date.now() - getLastActivityTime() > 600000 for care mode. (3) Time detection: in guardian-display.ts, compute hour = new Date().getHours(), dayOfWeek = new Date().getDay(). Map to context flags. Reuse proactive-monitor.ts patterns for consistency but don't duplicate — proactive-monitor handles long-session warnings (2h/4h), idle-quotes handles ambient mood. (4) Emotion colors in guardian-display.ts: read regime from cache via getLatestRegime(). Map: volatile/compressing → 'worried' → red, trending_up/trending_down → 'happy' → bright green, ranging → 'neutral' → dim green, expanding → 'stern' → yellow. No regime data → 'neutral'. Return emotionColor from getGuardianDisplay(). CompanionSprite wraps renderFace() Text with the color. (5) Three-tier brightness: normal idle = dimColor={true}, care/lateNight/volatile = normal color (medium), reaction from guardian-observer = bold (bright).

### Sprint 77: Volume Spike + Price Line + drawPriceLine Integration
- Agent: opus
- Dependencies: Sprint 73
- Status: MERGED
- Priority: P1
- Timeout: 180
- Description: (1) Volume spike highlight in render-candles.ts buildVolumeLines(): compute avgVolume of visible candles, for any candle with volume > 2x avgVolume mark it as spike. Spikes get bold color (same bullish/bearish but without dim). Non-spikes keep current rendering. The averaging window is the visible candle set. (2) Current price horizontal line: in renderCandlestickChart(), after drawCandles(), call the existing but unused drawPriceLine() function to draw a dim dotted line (PRICE_DASH '┄') across the currentPriceRow. This makes the last close price immediately visible across the full chart width. The function already exists at render-candles.ts:160 — just uncomment/wire the call. (3) Verify crosshair coordinate math still works correctly with colWidth=2 (from Sprint 73 fix) — the hoveredIdx calculation in renderCandlestickChart uses crosshair.col which should map correctly since both CandlestickChart.tsx and render-candles.ts now agree on COL_WIDTH=2.

### Sprint 78: Attentive State + Signal Priority + Responsive Polish
- Agent: opus
- Dependencies: Sprint 74, Sprint 76
- Status: PENDING
- Priority: P1
- Timeout: 240
- Description: (1) Attentive middle state: in guardian-display.ts, after a trade executes and passes risk checks (no CRITICAL/EMERGENCY alert), emit a brief 'attentive' display for ~5 seconds. Text: archetype-specific trade-acknowledgment quote (e.g., trend_follower: 'Position opened. Watching the momentum.' — 9 archetypes × 2 quotes). Brightness: medium tier (between dim idle and bright alert). This fills the gap between silent idle and loud risk alert that both design voices flagged. (2) Signal priority chain enforcement in guardian-display.ts: when multiple signals compete, use strict priority: reaction (from guardian-observer) > stale indicator > attentive (post-trade) > care (10min idle) > time greeting (morning/late/weekend) > regime-filtered quote > generic idle quote. Higher priority always wins. Lower priority waits until higher clears. (3) Responsive polish: in CompanionSprite.tsx, check terminal columns. < 40 cols: hide SpeechBubble, show only face + name row with truncated name if needed. < 20 cols: return null. In CompanionFloatingBubble: same column check, return null if < 40. (4) Emotion decision table document: add a comment block in guardian-display.ts mapping (regime, drawdown%, portfolioHeat, timeOfDay) → emotion state → color. This serves as the behavioral spec both design voices requested.
