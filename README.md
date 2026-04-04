# Vibe Sensei

**AI trading terminal. 56 master guardians. One ancient octopus from the deep.**

Vibe Sensei is a terminal-native trading copilot where historical trading legends, philosophers, and scientists watch your trades from the shadows. Each user is deterministically assigned a master guardian who warns you in character, debates other masters before big trades, and evolves alongside your habits.

Paper trading sandbox included. 100K USDT starting balance. Real-time market data from Hyperliquid. No real money at risk unless you choose it.

## Quick Start

```bash
# Install
bun install
cd desktop && npm install && npx electron-rebuild -f -w node-pty && cd ..

# CLI (Terminal REPL)
bun run dev

# Desktop (Electron + TradingView)
cd desktop
npm run build:main && npx vite build
VIBE_SENSEI_DESKTOP=1 VIBE_FORCE_PROD=1 npx electron dist/main/index.js

# Production bundle
bun run build
```

**Requirements:** [Bun](https://bun.sh/) >= 1.3, valid API key (Anthropic, Bedrock, or Vertex), Node.js >= 18 (for Desktop).

## Two Surfaces

### CLI (Terminal)

The primary interface. A conversational AI REPL where you trade, analyze, and learn with your guardian master.

```
bun run dev
```

Features:
- Natural language trading ("buy 0.1 BTC", "show me ETH chart")
- Interactive candlestick chart with mouse crosshair, zoom, and pan
- Guardian personality alerts after every trade
- Pre-trade gate with 13 risk checks
- AutoResearch (Karpathy-style iterative analysis)
- Ghost warnings from crypto's fallen

### Desktop (Electron)

A 3-panel professional trading terminal with TradingView Charting Library.

```
cd desktop
npm run build:main && npx vite build
VIBE_SENSEI_DESKTOP=1 VIBE_FORCE_PROD=1 npx electron dist/main/index.js
```

Layout:
- **Terminal** (35%) -- full REPL with guardian interactions
- **Chart** (65%) -- TradingView Charting Library with indicators, drawing tools, multi-timeframe
- **Sidebar** -- guardian card, risk gauge, positions, balance, alerts
- **Status Bar** -- connection, price ticker, paper mode badge

## Features

### Trading Tools (8)

| Tool | Description |
|------|-------------|
| PlaceOrder | Market, limit, and stop-loss orders |
| CancelOrder | Cancel open orders by ID |
| GetPositions | View open positions with unrealized PnL |
| GetBalance | Portfolio balance across assets |
| ShowChart | Terminal candlestick chart (interactive) |
| AutoResearch | Multi-iteration technical analysis |
| PreTradeGate | 13-check risk gate before trading |
| RunStrategy | Execute Python trading scripts |

### Market Data

Real-time prices from **Hyperliquid** direct REST API (no CCXT middleman):
- Candlestick OHLCV data via `candleSnapshot`
- Live prices via `allMids`
- No API key required (public endpoints)
- Graceful fallback to per-symbol defaults if offline

### 56 Master Guardians

Each master is a real historical figure with a known trading philosophy. Your guardian is assigned deterministically from your user ID via `mulberry32(hash(userId))`.

<details>
<summary><strong>Legendary (8)</strong></summary>

Jesse Livermore, George Soros, Warren Buffett, Benjamin Graham, Jim Simons, Sun Tzu, Satoshi Nakamoto, John von Neumann
</details>

<details>
<summary><strong>Epic (18)</strong></summary>

Paul Tudor Jones, Stanley Druckenmiller, Michael Burry, Charlie Munger, Ray Dalio, Ed Thorp, Munehisa Homma, Miyamoto Musashi, Nassim Taleb, Elon Musk, Peter Thiel, Garry Tan, Andrej Karpathy, Li Ka-shing, Vitalik Buterin, Alan Turing, Benoit Mandelbrot, Claude Shannon
</details>

<details>
<summary><strong>Rare (18) + Uncommon (11) + Common (1)</strong></summary>

30 more masters across value investors, trend followers, macro traders, quants, strategists, philosophers, crypto natives, and scientists.
</details>

**9 Archetypes:** value_investor, trend_follower, macro_trader, quant, strategist, philosopher, first_principles, crypto_native, scientist

**5 Stats:** PRECISION, PATIENCE, AGGRESSION, WISDOM, SASS -- rolled per user based on rarity tier.

### Risk Engine

**Pre-Trade Gate (13 checks):**

| Check | Type |
|-------|------|
| Circuit Breaker: Daily Loss | Hard block at >5% equity loss |
| Circuit Breaker: Frequency | >20 trades in 60 minutes |
| Circuit Breaker: Escalating | 3+ losses, each larger |
| Portfolio Heat | Position risk aggregation |
| Single Position Risk | >10% of equity |
| Concentration | >50% in one asset |
| Regime Alignment | Market regime vs order direction |
| Volume Confirmation | Liquidity check |
| Stop-Loss Defined | Warns if no stop-loss |
| Risk-Reward Ratio | Minimum 1.5:1 |
| Revenge Trade | Trading too soon after a loss |
| Daily Loss Limit | >5% daily drawdown |
| ATR Stop-Loss Advisor | Suggests ATR-based stop price |

**8 Ghost Warnings** -- cautionary apparitions triggered by dangerous patterns:

| Ghost | Trigger |
|-------|---------|
| Sam Bankman-Fried | Missing risk controls |
| Do Kwon | Ignoring alerts (arrogance) |
| Su Zhu / 3AC | Leverage >3x |
| Isaac Newton | FOMO buying after >20% pump |
| LTCM | Correlation collapse (3+ positions) |
| Lehman Brothers | Cascade liquidation risk |
| Enron | Concentrated loser (>60% portfolio) |
| SVB | Duration mismatch (underwater hold) |

### Knowledge Base

Karpathy-inspired learning system at `~/.vibe-sensei/`:
- **Event Store** -- JSONL event persistence (trades, alerts, ghosts, regime changes)
- **Wiki Compiler** -- LLM-compiled trading knowledge articles (Obsidian format)
- **Query Router** -- injects relevant wiki context into guardian alerts
- **Morning Brief** -- daily personalized briefing from your guardian
- **Self-Audit** -- periodic wiki health check and pattern discovery

## Architecture

```
src/
  entrypoints/cli.tsx    -- CLI entry point
  screens/REPL.tsx       -- Interactive REPL (React + Ink)
  buddy/                 -- Guardian system
    types.ts             -- 56 masters, rarities, quotes, stats
    guardian.ts           -- RiskGuardian class
    persona.ts            -- 9 archetypes, tone modifiers
    companion.ts          -- Deterministic assignment
    debate.ts             -- Adversarial debates
    ghost-warnings.ts     -- 8 ghost triggers + cooldown
    diary.ts              -- Evolution diary
  tools/                  -- 8 trading tools
  services/
    exchange/
      paper-trading.ts    -- Paper exchange with real market data
      hyperliquid-client.ts -- Direct Hyperliquid REST API
      singleton.ts        -- Exchange singleton with retry
    chart/
      udf-server.ts       -- TradingView UDF protocol server
      index.ts            -- Express + static file serving
    knowledge/            -- Event store, compiler, query router
    trading/              -- Guardian observer, regime, circuit breaker
  components/
    CandlestickChart/     -- Interactive terminal chart (mouse support)
    LogoV2/               -- Welcome banner + branding

desktop/
  main/
    index.ts              -- Electron window + IPC
    pty-manager.ts        -- PTY child process management
    preload.ts            -- Context bridge
  renderer/
    components/
      Layout.tsx           -- 3-panel resizable layout
      ChartPanel.tsx       -- TradingView Charting Library widget
      TerminalPanel.tsx    -- xterm.js terminal
      GuardianSidebar.tsx  -- Sidebar container
      guardian/            -- MasterCard, RiskGauge, Positions, Balance, Alerts
    styles/
      theme.css            -- Matrix green color system
      layout.css           -- Panel layout + status bar
  charting_library/        -- TradingView Charting Library (cloned)
```

### Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun |
| CLI UI | React + Ink (terminal rendering) |
| Desktop | Electron + xterm.js + TradingView Charting Library |
| Market Data | Hyperliquid REST API (direct, no CCXT) |
| Exchange | CCXT (paper mode default, live mode supported) |
| Charts (Desktop) | TradingView Charting Library (full version) |
| Charts (CLI) | Unicode candlestick with mouse interaction |
| Knowledge | JSONL + LLM wiki compiler |
| Build | Bun bundler (~28MB single-file) |

## Design System

Matrix green on dark black. Nuclear submarine sonar room meets The Matrix.

| Token | Hex | Usage |
|-------|-----|-------|
| Primary | `#00FF41` | Matrix phosphor green |
| Background | `#0D1117` | Dark green-black |
| Up/Profit | `#26a69a` | TradingView green (chart) |
| Down/Loss | `#ef5350` | TradingView red (chart) |
| Dim | `#008F11` | Secondary text |
| Border | `#002B0E` | Panel dividers |

The octopus logo is the product brand identity. Guardians are the user's personal AI mentors -- separate concepts, never mixed.

## Development

```bash
# CLI development
bun run dev

# Desktop development (3 steps)
cd desktop
npm run build:main        # Compile Electron main process
npx vite build            # Build renderer
VIBE_SENSEI_DESKTOP=1 VIBE_FORCE_PROD=1 npx electron dist/main/index.js

# Production build (CLI only)
bun run build             # Output: dist/cli.js (~28MB)

# After changing desktop native modules
cd desktop && npx electron-rebuild -f -w node-pty
```

## License

MIT
