# Vibe Sensei

**AI trading terminal with 52 master guardians.**

Vibe Sensei is a terminal-based trading copilot where historical trading legends, philosophers, and scientists act as your personal risk guardians. Each user is deterministically assigned a master who watches your trades, warns you in character, and debates other masters before big moves. Paper trading sandbox included.

## Quick Start

```bash
bun install
bun run dev          # Interactive terminal REPL
bun run dev -- --web # REPL + TradingView chart UI on :3456
bun run build        # Production single-file bundle
```

**Requirements:** [Bun](https://bun.sh/) >= 1.3.11, valid API key (Anthropic, Bedrock, or Vertex).

## Features

- **52 master guardians** -- deterministic assignment per user via seeded PRNG
- **Paper trading sandbox** -- 100k USDT starting balance, CCXT-powered exchange
- **Real-time risk engine** -- position size and drawdown checks after every trade
- **Guardian personality system** -- 9 archetypes, 5 stat dimensions, in-character alerts
- **Cross-guardian consultation** -- ask any of the 52 masters for a second opinion
- **Adversarial debates** -- two masters argue for and against before big trades
- **Ghost warnings** -- cautionary apparitions from crypto's fallen (SBF, Do Kwon, 3AC, Newton)
- **TradingView charts** -- real-time candlestick charts via `--web` flag and UDF server
- **Trade cards** -- shareable text cards for Twitter/X with box-drawing art
- **Evolution diary** -- your guardian learns your trading habits over time

## The 52 Masters

Each master is a real historical figure with a known trading philosophy. Your guardian is assigned deterministically from your user ID -- same person, same master, every session.

<details>
<summary><strong>Legendary (8)</strong> -- ★★★★★</summary>

| Master | Philosophy |
|--------|-----------|
| Jesse Livermore | The market is never wrong, opinions are. |
| George Soros | It's not whether you're right or wrong, but how much you make when right. |
| Warren Buffett | Rule #1: Never lose money. Rule #2: Never forget Rule #1. |
| Benjamin Graham | The essence of investment management is the management of risks. |
| Jim Simons | We don't override the models. The model is the system. |
| Sun Tzu | Know yourself and know your enemy, a hundred battles without danger. |
| Satoshi Nakamoto | If you don't believe me or don't get it, I don't have time to convince you. |
| John von Neumann | If people do not believe that math is simple, it's because they don't realize how complicated life is. |

</details>

<details>
<summary><strong>Epic (18)</strong> -- ★★★★</summary>

| Master | Archetype |
|--------|-----------|
| Paul Tudor Jones | Macro Trader |
| Stanley Druckenmiller | Macro Trader |
| Michael Burry | Value Investor |
| Charlie Munger | Value Investor |
| Ray Dalio | Quant |
| Ed Thorp | Quant |
| Munehisa Homma | Trend Follower |
| Miyamoto Musashi | Strategist |
| Nassim Taleb | Philosopher |
| Elon Musk | First Principles |
| Peter Thiel | First Principles |
| Garry Tan | First Principles |
| Andrej Karpathy | Scientist |
| Li Ka-shing | Value Investor |
| Vitalik Buterin | Crypto Native |
| Alan Turing | Scientist |
| Benoit Mandelbrot | Scientist |
| Claude Shannon | Scientist |

</details>

<details>
<summary><strong>Rare (18)</strong> -- ★★★</summary>

| Master | Archetype |
|--------|-----------|
| John Paulson | Macro Trader |
| Sir John Templeton | Value Investor |
| Richard Dennis | Trend Follower |
| Fan Li | Strategist |
| Lv Buwei | Strategist |
| Seneca | Philosopher |
| Laozi | Philosopher |
| Jeff Bezos | First Principles |
| Steve Jobs | First Principles |
| Richard Feynman | Scientist |
| Hu Xueyan | Strategist |
| Zeng Guofan | Strategist |
| Bai Gui | Value Investor |
| CZ Zhao | Crypto Native |
| He Yi | Crypto Native |
| Isaac Newton | Scientist |
| Albert Einstein | Scientist |
| Carl F. Gauss | Scientist |

</details>

<details>
<summary><strong>Uncommon (11)</strong> -- ★★</summary>

| Master | Archetype |
|--------|-----------|
| Nicolas Darvas | Trend Follower |
| Linda Raschke | Trend Follower |
| Machiavelli | Strategist |
| Arthur Hayes | Crypto Native |
| Victor Sperandeo | Macro Trader |
| Larry Williams | Trend Follower |
| Zong Qinghou | Value Investor |
| Shen Wansan | Macro Trader |
| Zhang Jian | First Principles |
| Andre Cronje | Crypto Native |
| Xu Mingxing | Crypto Native |

</details>

<details>
<summary><strong>Common (1)</strong> -- ★</summary>

| Master | Archetype |
|--------|-----------|
| William O'Neil | Trend Follower |

</details>

## Guardian System

Your guardian is assigned via `mulberry32(hash(userId))` -- fully deterministic, no randomness per session.

**5 Stats** drive alert tone and personality:

| Stat | Effect |
|------|--------|
| PRECISION | Cites specific numbers, levels, and indicators |
| PATIENCE | Prefers waiting for the perfect setup |
| AGGRESSION | Favors bold, concentrated positions |
| WISDOM | Analyzes calmly and thoroughly before speaking |
| SASS | Direct and sharp, does not sugarcoat |

**9 Archetypes** define trading philosophy:

`value_investor` `trend_follower` `macro_trader` `quant` `strategist` `philosopher` `first_principles` `crypto_native` `scientist`

Stats are rolled per user based on rarity tier. Higher rarity masters get higher stat floors.

## Trading Tools

| Tool | Description |
|------|-------------|
| `PlaceOrder` | Market, limit, and stop-loss orders |
| `GetPositions` | View all open positions with PnL |
| `GetBalance` | Check portfolio balance across assets |

All orders execute in **paper trading mode** by default (safe sandbox with simulated fills). The exchange layer is powered by CCXT.

## Risk Engine

The `RiskGuardian` class auto-evaluates after every trade tool call:

| Check | Trigger | Severity |
|-------|---------|----------|
| Position Size | Single position > 30% of portfolio | WARNING |
| Drawdown | Unrealized loss > 10% | WARNING |
| Drawdown | Unrealized loss > 20% | CRITICAL |

Alerts are delivered in your guardian's voice. A high-SASS Nassim Taleb will be blunt; a high-WISDOM Benjamin Graham will be measured. Cooldown policy: max 1 alert per check per 30 seconds.

**Ghost Warnings** -- when you repeat patterns that destroyed real traders, cautionary ghosts appear:

| Ghost | Trigger |
|-------|---------|
| Sam Bankman-Fried | Missing risk controls |
| Do Kwon | Ignoring alerts (arrogance) |
| Su Zhu / 3AC | Excessive leverage |
| Isaac Newton | FOMO buying at the top |

Only 1 ghost per session to prevent alert fatigue.

## Architecture

```
src/
  buddy/           # Guardian system (52 masters, risk engine, personas)
    types.ts       # Master roster, rarities, quotes, stats
    guardian.ts    # RiskGuardian class
    persona.ts     # Archetype system, tone modifiers
    companion.ts   # Deterministic assignment via mulberry32
    debate.ts      # Adversarial guardian debates
    consultation.ts # Cross-guardian second opinions
    ghost-warnings.ts # Cautionary apparitions
    diary.ts       # Evolution diary (habit tracking)
    trade-card.ts  # Shareable trade cards
    checks/        # Risk check implementations
  tools/           # Trading tools (OrderTool, PositionTool, BalanceTool)
  services/
    exchange/      # CCXT exchange abstraction (paper + live)
    chart/         # TradingView UDF server + web frontend
  screens/         # Terminal REPL (React + Ink)
  components/      # Terminal UI components
```

- **Runtime:** Bun
- **UI:** React + Ink (terminal rendering)
- **Charts:** TradingView Lightweight Charts + UDF data server
- **Exchange:** CCXT (paper mode default, live mode supported)
- **Build:** `bun run build` produces a single-file bundle (~25MB)

## Commands

```bash
bun install          # Install dependencies
bun run dev          # Interactive REPL
bun run dev -- --web # REPL + chart server on :3456
bun run build        # Production bundle to dist/cli.js
```

## License

MIT
