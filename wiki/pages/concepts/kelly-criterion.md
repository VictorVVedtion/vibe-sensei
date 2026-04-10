---
title: Kelly Criterion
type: concept
tags: [position-sizing, mathematics, quant, probability]
sources: []
created: 2026-04-06
updated: 2026-04-06
---

# Kelly Criterion

The mathematically optimal bet size for maximizing long-term geometric growth rate of capital. Developed by John Kelly at Bell Labs in 1956, applied to gambling by [[ed-thorp]] and to markets by the quant community.

## The Formula

```
f* = (bp - q) / b
```

Where:
- `f*` = fraction of capital to bet
- `b` = net odds received (e.g., 2:1 → b = 2)
- `p` = probability of winning
- `q` = probability of losing (= 1 - p)

For a trade with 60% win rate and 2:1 reward-risk:
```
f* = (2 × 0.6 - 0.4) / 2 = 0.8 / 2 = 40%
```

40% of capital on a single trade. This is why **nobody uses full Kelly**.

## Why It Works (In Theory)

Kelly maximizes the **expected logarithm** of wealth, which is equivalent to maximizing the geometric growth rate. Over infinite trials, a Kelly bettor will outgrow any other fixed-fraction strategy.

Key property: Kelly never bets so much that ruin is possible (f* is always < 1 for positive-expectancy bets).

## Why It's Dangerous (In Practice)

1. **You don't know your true edge** — The formula assumes known probabilities. In markets, you're estimating. Overestimate your edge → over-bet → ruin.
2. **Volatility is brutal** — Full Kelly produces ~50% drawdowns routinely. Psychologically unbearable for most humans.
3. **Assumes independent trials** — Real trades are correlated. One market crash hits all your positions simultaneously.
4. **No model risk accounting** — Kelly assumes the model is correct. [[nassim-taleb]] would say: the model is never correct.

## Fractional Kelly

The practical solution: bet a fraction of Kelly (typically 1/4 to 1/2).

- **Half Kelly**: 50% of f*. Achieves ~75% of Kelly's growth rate with dramatically lower drawdowns.
- **Quarter Kelly**: 25% of f*. Very conservative. Growth is slow but survival is nearly guaranteed.

[[Ed Thorp]] popularized fractional Kelly. [[Jim Simons]]'s Renaissance likely uses a version internally across thousands of small bets.

## The Connection Chain

```
Shannon (information theory) → Kelly (optimal betting) → Thorp (casino + markets) → Simons (industrialized)
```

All four are in the Vibe Sensei roster. [[Claude Shannon]] developed information theory. Kelly applied it to betting at Bell Labs (where Shannon worked). [[Ed Thorp]] used Kelly to beat blackjack, then beat markets. [[Jim Simons]] scaled it to thousands of signals.

## Master Perspectives

| Master | Kelly Stance |
|--------|-------------|
| [[ed-thorp]] | The practitioner. Used Kelly in casinos and markets. Always fractional. |
| [[jim-simons]] | Kelly across thousands of uncorrelated bets = low per-bet risk, high aggregate edge |
| [[nassim-taleb]] | Distrusts Kelly because you never truly know the parameters. Use barbell instead. |
| [[george-soros]] | Doesn't use the formula, but "go for the jugular" = super-Kelly when conviction is extreme |
| [[warren-buffett]] | Implicitly uses Kelly logic — concentrate in your best ideas where the edge is highest |

## See Also

- [[position-sizing]] — The parent concept
- [[ed-thorp]] — The practitioner
- [[jim-simons]] — Industrialized Kelly
- [[john-von-neumann]] — Expected utility foundations
