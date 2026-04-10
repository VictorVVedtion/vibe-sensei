<div align="center">

# Vibe Sensei

**68 dead investors watch your every trade. One of them hates you personally.**

[![MIT License](https://img.shields.io/badge/license-MIT-00ff88.svg)](LICENSE)
[![Stars](https://img.shields.io/github/stars/VictorVVedtion/vibe-sensei?color=00ff88)](https://github.com/VictorVVedtion/vibe-sensei)

<img src="assets/demo.gif" alt="Vibe Sensei demo — guardian warnings, ghost apparitions, master debates" width="800" />

*Warren Buffett judges your entries. Jesse Livermore roasts your stops. SBF's ghost haunts your leverage.*

</div>

---

Vibe Sensei is a terminal-native AI trading copilot where historical legends — Buffett, Soros, Livermore, Graham, Simons, Sun Tzu, and 62 more — watch your trades from the shadows. Each user gets a deterministic guardian master who warns in character, debates other masters before big moves, and evolves alongside your habits.

**Paper trading sandbox included.** 100K USDT starting balance. No real money at risk unless you choose it.

> **"Isn't this just ai-hedge-fund?"**
>
> No. They write reports. Our 68 masters **yell at you in character**, then SBF's ghost shows up when you touch leverage. Plus master debates, rarity tiers, ghost warnings, braille charts, and a full terminal-native experience that doesn't need a browser.

## Try it now (no API key needed)

```bash
bun install
bun run dev -- --demo
```

Demo mode boots with **Warren Buffett** as your guardian, canned responses, and zero external API calls. See the guardian system, ghost warnings, and master debates in 60 seconds.

## Full setup

```bash
bun install
bun run dev
```

**Requirements:** [Bun](https://bun.sh/) >= 1.3, API key (Anthropic, Bedrock, or Vertex).

## What happens when you trade

1. You type `/buy BTC 50000`
2. **Pre-Trade Gate** runs 9 risk checks + circuit breaker
3. Your guardian master warns you in character (*"Be fearful when others are greedy..."*)
4. If you're overleveraged, **SBF's ghost appears** (*"I too thought leverage was just a number"*)
5. Two masters **debate** your trade (Soros FOR, Graham AGAINST)
6. You confirm or back off
7. Your guardian's **diary** tracks the outcome and learns your patterns

<details>
<summary><strong>68 Master Guardians</strong> -- 5 rarity tiers, 9 archetypes, 5 stat dimensions</summary>

Each master is a real historical figure with a known trading philosophy. Your guardian is assigned deterministically from your user ID via seeded PRNG (`mulberry32(hash(userId))`).

**5 Rarity Tiers** -- **9 Archetypes** (value investor, trend follower, macro trader, quant, strategist, philosopher, first principles, crypto native, scientist) -- **5 Stats** (Precision, Patience, Aggression, Wisdom, Sass)

| Tier | Masters |
|------|---------|
| **Legendary (8)** | Jesse Livermore, George Soros, Warren Buffett, Benjamin Graham, Jim Simons, Sun Tzu, Satoshi Nakamoto, John von Neumann |
| **Epic (18)** | Paul Tudor Jones, Stanley Druckenmiller, Michael Burry, Charlie Munger, Ray Dalio, Ed Thorp, Munehisa Homma, Miyamoto Musashi, Nassim Taleb, Elon Musk, Peter Thiel, Garry Tan, Andrej Karpathy, Li Ka-shing, Vitalik Buterin, Alan Turing, Benoit Mandelbrot, Claude Shannon |
| **Rare + Uncommon + Common (42)** | 42 more across all archetypes |

</details>

<details>
<summary><strong>10 Ghost Warnings</strong> -- cautionary apparitions from finance's fallen</summary>

They appear when you repeat their mistakes.

| Ghost | Trigger |
|-------|---------|
| Sam Bankman-Fried | Missing risk controls |
| Do Kwon | Ignoring alerts (arrogance) |
| Su Zhu / 3AC | Leverage >3x |
| Isaac Newton | FOMO buying after >20% pump |
| LTCM | Correlation collapse |
| Lehman Brothers | Cascade liquidation risk |
| Enron | Concentrated loser (>60% portfolio) |
| SVB | Duration mismatch (underwater hold) |
| BitMEX Rekt Trader | Overleveraged margin |
| Bill Hwang / Archegos | Concentrated leverage stack |

</details>

<details>
<summary><strong>Risk Engine</strong> -- 9 checks + circuit breaker + tilt detector</summary>

**Pre-Trade Gate** -- 9 checks + circuit breaker + ATR stop-loss advisor:

Circuit Breaker, Portfolio Heat, Single Position Risk, Concentration, Regime Alignment, Volume Confirmation, Stop-Loss Defined, Risk-Reward Ratio, Revenge Trade Detection

**Tilt Detector** -- 3+ consecutive losses or size escalation >150% triggers an emotional trading alert.

</details>

<details>
<summary><strong>Knowledge Base</strong> -- persistent, compounding trading wiki</summary>

A persistent, compounding trading knowledge base at `~/.vibe-sensei/`. Three layers:

1. **Event Store** -- JSONL persistence, 8 event types, append-only
2. **Wiki** -- LLM-compiled markdown articles (per-symbol stats, behavioral patterns, trader profile)
3. **WikiTool** -- 6 operations: compile, query, ingest, lint, browse, status

Includes morning brief, counterfactual tracking, anti-portfolio, milestones, and health auditor.

</details>

<details>
<summary><strong>Sentiment Layer</strong> -- 30-day cross-source sentiment brief</summary>

`/pulse` delivers a 30-day cross-source sentiment brief from Reddit, Hacker News, Polymarket, and YouTube. Synthesized in your guardian's voice. Auto-injected into pre-trade debate stances.

</details>

<details>
<summary><strong>Backtest Engine</strong> -- replay legendary strategies with braille equity curves</summary>

`/backtest` lets you replay strategies from legendary traders. Braille-rendered equity curves render directly in the terminal. Compare your approach against the masters.

</details>

## Slash Commands

| Command | What it does |
|---------|-------------|
| `/buy <sym> [qty]` | Pre-trade gate, confirm, order |
| `/sell <sym> [qty]` | Gate, close position |
| `/swap <from> <to> <amt>` | DEX swap with slippage warning |
| `/positions` | Open positions with P&L |
| `/balance` | Portfolio breakdown |
| `/risk <sym> <side> <qty>` | Dry-run risk check (no order) |
| `/chart <sym> [tf]` | Interactive candlestick chart |
| `/consult <master> <q>` | Ask any of the 68 masters |
| `/debate <topic>` | Two masters argue, then synthesis |
| `/pulse <sym>` | 30-day sentiment brief |
| `/master` | Guardian card + diary panel |
| `/summon` | Replay summoning ceremony |
| `/backtest <strategy>` | Backtest a legendary strategy |

<details>
<summary><strong>Architecture</strong></summary>

| Layer | Technology |
|-------|-----------|
| Runtime | Bun |
| CLI UI | React + Ink |
| Desktop | Electron + xterm.js + TradingView |
| TUI | Rust + ratatui + braille charts |
| Market Data | Hyperliquid REST API |
| Exchange | CCXT (paper mode default) |
| Knowledge | JSONL + LLM wiki compiler |
| Build | Bun bundler (~28MB single-file) |

```
src/
  buddy/           -- Guardian system (68 masters, debates, ghosts, diary)
  commands/        -- Slash command implementations
  tools/           -- 13 trading tools
  services/
    exchange/      -- Paper + live trading via CCXT
    knowledge/     -- Event store + wiki compiler
    trading/       -- Guardian observer + tilt detector
  components/      -- React/Ink terminal UI
  screens/REPL.tsx -- Main interactive loop
```

</details>

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The highest-impact first contribution: **add a new master guardian** or **draw sprites** for one of the 14 masters still missing PNG art.

## Roadmap

See [ROADMAP.md](ROADMAP.md) for shipped versions and what's next.

## Security

See [SECURITY.md](SECURITY.md). Paper mode by default. Fail-closed PreTradeGate on all order tools.

## License

[MIT](LICENSE)
