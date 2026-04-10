---
title: Position Sizing
type: concept
tags: [risk-management, core, kelly, survival]
sources: []
created: 2026-04-06
updated: 2026-04-06
---

# Position Sizing

The most important decision in every trade. Not *what* to buy, but *how much*.

## Core Principle

Position sizing determines the gap between a winning strategy and a blown account. A strategy with 60% win rate and 2:1 reward-risk will make money over time — **unless** the position sizes are wrong. Bet too big, and a normal losing streak wipes you out before the edge plays out.

> Position sizing is the only universal risk control. It works across every strategy, every asset, every timeframe.

## Approaches

### Fixed Fractional
Risk a fixed % of capital per trade (typically 1-2%). Simple, effective, prevents ruin.
- **Pro**: Automatically scales with account size. Can never lose 100%.
- **Con**: Slow capital growth. Doesn't optimize for edge quality.

### [[Kelly Criterion]]
Mathematically optimal sizing: `f* = (bp - q) / b` where b = odds, p = win probability, q = loss probability. Maximizes long-term geometric growth.
- **Pro**: Mathematically optimal for known edges.
- **Con**: Assumes you know your true edge (you don't). Full Kelly is extremely volatile. Most practitioners use half-Kelly or less.

### Volatility-Based (ATR)
Size positions inversely to volatility. More volatile assets → smaller position. Used by [[richard-dennis]]'s Turtle system.
- **Pro**: Equalizes risk contribution across different assets.
- **Con**: Historical volatility ≠ future volatility (see: [[ltcm-collapse]]).

## Master Perspectives

| Master | View |
|--------|------|
| [[george-soros]] | "Go for the jugular." Size up massively when conviction is highest. |
| [[warren-buffett]] | Concentrate in your best ideas. 5-10 positions, not 50. |
| [[nassim-taleb]] | Barbell: 85% safe, 15% speculative. Nothing in the middle. |
| [[jim-simons]] | Thousands of small bets. No single position matters. |
| [[jesse-livermore]] | Pyramid into winners. But his lack of max-loss rules killed him. |
| [[ed-thorp]] | Kelly criterion, always. But use fractional Kelly for safety. |

## The Ruin Equation

The only unrecoverable trading outcome is ruin (account → 0 or margin call). Position sizing is the primary defense against ruin.

- Lose 10% → need 11% to recover
- Lose 25% → need 33% to recover
- Lose 50% → need 100% to recover
- Lose 90% → need 900% to recover

The math is asymmetric. Losses are always harder to recover from than gains are to accumulate. This is why [[benjamin-graham]]'s Rule #1 ("never lose money") and [[nassim-taleb]]'s "survive first" are not conservative platitudes — they're mathematical necessities.

## Vibe Sensei Implementation

The `RiskGuardian` system (`src/buddy/checks/position_size.ts`) monitors position sizing after every trade. Alerts trigger when:
- Single position exceeds threshold % of portfolio
- Position size is inconsistent with account drawdown state
- Leverage creates effective position sizes beyond risk tolerance

## See Also

- [[kelly-criterion]] — The math of optimal sizing
- [[margin-of-safety]] — Buy at a discount (risk reduction at entry)
- [[antifragility]] — Survive first, profit second
