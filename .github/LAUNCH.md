# Launch Day Playbook

## Timeline (Tuesday)

| Time (PT) | Action |
|-----------|--------|
| 7:45am | Tweet thread goes live |
| 8:05am | Show HN submission |
| 8:06am | Post first comment on HN |
| 9:00am | DM friends with the link |
| 10:00am | Reddit posts (3 subs) |
| 11:00am | Lobste.rs submission |
| All day | Reply to every HN comment within 10 min |

---

## Hacker News

### Title (58 chars)

```
Show HN: Vibe Sensei – 68 dead investors yelling at your trades
```

### First Comment

```
Hi HN! I built Vibe Sensei because every "AI trading tool" I tried felt like
talking to a spreadsheet. I wanted something with personality.

The idea: what if 68 real historical traders — Buffett, Soros, Livermore, Sun Tzu,
even SBF's ghost — actually watched your trades and reacted in character?

How it works:
- You get assigned a guardian master deterministically (mulberry32 seeded PRNG)
- Every trade runs through a 9-check PreTradeGate before execution
- Your guardian warns you in their actual voice ("Be fearful when others are greedy...")
- If you do something really stupid, ghost warnings fire (SBF appears when you touch leverage)
- Two masters can debate your trade before you commit (Soros FOR, Graham AGAINST)

Technical bits that might interest you:
- Terminal-native: React + Ink for CLI, Rust ratatui TUI with braille candlestick charts
- Paper trading sandbox (100K USDT via CCXT) — no real money by default
- Demo mode needs zero API keys: `bun run dev -- --demo`
- 9 personality archetypes × 5 stat dimensions generate unique guardian behavior
- Deterministic assignment means your guardian is always the same (no randomness per session)

It's MIT-licensed and the easiest first contribution is adding a new master —
there's a PR template in CONTRIBUTING.md with exact code snippets.

Would love feedback on the guardian system design. Is character-voiced risk
management useful, or just a gimmick? I genuinely don't know yet.
```

---

## X/Twitter Thread (5 tweets)

### Tweet 1 (hook + GIF)

```
I built a trading terminal where 68 dead investors watch your every trade.

Warren Buffett judges your entries.
Jesse Livermore roasts your stops.
SBF's ghost haunts your leverage.

It's called Vibe Sensei. Open source. MIT licensed.

[attach demo.gif]
```

### Tweet 2 (masters + sprite grid)

```
68 guardian masters across 5 rarity tiers.

Legendary: Livermore, Soros, Buffett, Graham, Simons, Sun Tzu, Satoshi, von Neumann
Epic: Druckenmiller, Burry, Munger, Dalio, Thorp, Taleb, Turing, Mandelbrot...

Your guardian is assigned deterministically. You don't pick — they pick you.

[attach master-roster.png]
```

### Tweet 3 (ghost warnings — the viral piece)

```
The best part: ghost warnings.

Do something reckless and the ghosts of crypto's fallen appear:

🔮 SBF: "I too thought leverage was just a number"
🌙 Do Kwon: appears when you ignore alerts
💀 3AC: triggers at >3x leverage
🍎 Newton: fires on FOMO buying after 20% pumps

They fade away smelling of bad decisions.
```

### Tweet 4 (differentiation)

```
"Isn't this just another AI trading bot?"

No. ai-hedge-fund writes reports. TradingAgents runs simulations.

Vibe Sensei's masters actually yell at you. In character. Then two of them
debate your trade. Then your guardian writes a diary entry about your habits.

Different game entirely.
```

### Tweet 5 (CTA)

```
Try it in 60 seconds. No API key needed:

bun install
bun run dev -- --demo

Warren Buffett greets you. Type "100x leverage yolo" and watch what happens.

github.com/VictorVVedtion/vibe-sensei

Stars appreciated. Master contributions even more.
```

---

## Reddit Posts

### r/algotrading — Technical angle

**Title:** I built an AI trading terminal where historical traders watch your trades and warn you in character (open source)

```
Been working on Vibe Sensei — a terminal-native AI trading copilot with
68 historical trader "guardians" (Livermore, Soros, Buffett, etc.) that
evaluate your trades in real-time.

The interesting technical bits:

- Pre-Trade Gate: 9 risk checks (position size, drawdown, leverage,
  concentration, fat-finger, behavioral, circuit breaker, regime, R:R)
  run synchronously before every order. Fail-closed design.

- Guardian system: deterministic assignment via mulberry32(hash(userId)).
  Each guardian has 5 stats (Precision, Patience, Aggression, Wisdom, Sass)
  and one of 9 archetypes that influence their risk tolerance and warnings.

- Paper trading sandbox: 100K USDT via CCXT. Zero real money at risk
  unless you explicitly configure live mode.

- Debate engine: before big trades, two masters argue for/against.
  Soros brings macro reflexivity, Graham brings margin-of-safety analysis.

- Braille equity charts render directly in the terminal (Rust ratatui TUI).

Demo mode needs zero API keys: `bun run dev -- --demo`

MIT licensed. The easiest contribution is adding a new master — the repo
has a PR template with exact code snippets.

github.com/VictorVVedtion/vibe-sensei

Curious what this community thinks about character-voiced risk management.
Is it useful or just noise?
```

### r/commandline — Terminal UX angle

**Title:** Vibe Sensei: a terminal trading copilot with braille charts, ASCII portraits, and ghost warnings (React Ink + Rust ratatui)

```
Built a terminal-first AI trading tool with some fun rendering:

- Braille candlestick charts (⣿⣷⣶) via Rust ratatui — full OHLCV
  rendered in Unicode braille characters
- ASCII master portraits in the CLI (68 different characters)
- HalfBlock sprite rendering in the TUI (▀▄ with true-color)
- Ghost warnings with kaomoji faces: (╬ Ò ‸ Ó) AWOOO!
- Box-drawing trade cards for sharing on Twitter/X

The stack: Bun + React Ink for the main REPL, Rust ratatui for the
optional TUI, connected via Unix Domain Socket with MessagePack framing.

Deep-sea green color scheme (#00FF41 on black). No web browser needed.

`bun run dev -- --demo` to try it. Zero config.

github.com/VictorVVedtion/vibe-sensei
```

### r/CryptoCurrency — Paper trading + safety angle

**Title:** I built a free paper trading terminal where AI versions of Buffett, Soros, and SBF's ghost watch your crypto trades

```
Vibe Sensei is a free, open-source paper trading terminal (100K USDT
simulated balance) with a twist: 68 historical investor "guardians"
watch your trades and react in character.

What happens when you trade:
1. You type /buy BTC 50000
2. A 9-check risk gate evaluates the trade
3. Your assigned guardian warns you in their actual voice
4. If you're overleveraged, SBF's ghost literally appears:
   "I too thought I was the smartest person in the room..."
5. Two masters debate your trade (Soros FOR, Graham AGAINST)
6. You confirm or back off

It's paper mode by default — no real money, no exchange keys needed.
The guardian system includes a diary that learns your trading patterns
over time and adjusts warnings.

Zero-key demo mode: `bun run dev -- --demo` (needs Bun runtime)

Not financial advice. Not a trading bot. It's a risk-awareness tool
that uses character voice to make you actually listen to warnings.

github.com/VictorVVedtion/vibe-sensei — MIT licensed, free forever.
```

---

## Discord Channels

| Channel | Purpose |
|---------|---------|
| #announcements | Launch news, releases, milestones |
| #help | Setup issues, bug reports |
| #show-and-tell | Screenshots of guardian reactions, trade cards |
| #add-a-master | Coordinate new master submissions |
| #strategy | Trading strategy discussion |
| #masters-debate | Share the best debate outputs |
| #ghost-stories | Funniest ghost warning screenshots |

---

## Days 10-14 Content Cadence

| Day | Content |
|-----|---------|
| 10 | "What people built with Vibe Sensei in 24 hours" thread + launch retro |
| 11 | Master spotlight: "Why Jesse Livermore is the most savage guardian" |
| 12 | Ghost warning deep dive: "We made SBF haunt your terminal" (most viral) |
| 13 | First community master merge — credit the contributor publicly |
| 14 | Two-week retro + roadmap reveal (v0.4.0 debate council) + Discord invite |
