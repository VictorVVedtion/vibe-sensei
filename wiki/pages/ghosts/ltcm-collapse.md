---
title: "LTCM Collapse — When Genius Failed"
type: ghost
tags: [tradfi, leverage, correlation, hedge-fund, cautionary]
sources: []
created: 2026-04-06
updated: 2026-04-06
---

# LTCM Collapse

**Ghost**: Long-Term Capital Management | **Trigger**: Correlation collapse
**Ghost Quote**: "We thought diversification would save us. It didn't."

The most famous hedge fund failure in traditional finance history. Two Nobel Prize winners, a legendary bond trader, and the most sophisticated models on Wall Street — all brought down by leverage and a misunderstanding of correlation.

## What Happened

1. **The team (1994)**: John Meriwether (Salomon Brothers legend), Myron Scholes and Robert Merton (Black-Scholes formula, Nobel Prize 1997), and a team of PhDs and quants.

2. **The strategy**: Convergence trades — betting that price gaps between similar bonds would close. Government bonds, corporate bonds, mortgage bonds. Small spreads, massive leverage.

3. **The leverage**: LTCM leveraged ~25:1 on balance sheet, with derivatives notional of ~$1.25 trillion on $4.7B equity. The model said diversification across many convergence trades made the overall portfolio safe.

4. **The Russian crisis (August 1998)**: Russia defaulted on its debt. Global flight to quality. Every "safe" convergence trade moved in the wrong direction simultaneously. The "diversified" bets were all correlated in a crisis.

5. **The collapse**: LTCM lost $4.6B in months. The Fed orchestrated a $3.6B bailout by 14 banks to prevent systemic contagion. The fund was liquidated.

## The Core Failure: Correlation Is Not Constant

LTCM's models assumed:
- Correlations between trades were low in normal times → TRUE
- Correlations would stay low in a crisis → FALSE

In a crisis, **everything correlates to 1**. Flight to quality means every risk asset sells, every safe asset rallies. The "diversification" that looked robust in backtests evaporated in the one scenario where it mattered most.

This is the fundamental critique [[nassim-taleb]] levels at quantitative finance: models calibrated on normal conditions fail catastrophically in the fat tails.

## The Leverage Trap

```
Normal: 25:1 leverage × 1% edge = 25% return. Excellent.
Crisis: 25:1 leverage × -5% move = -125% of equity. Bankrupt.
```

At 25:1 leverage, a 4% adverse move wipes out all equity. The Russian crisis moved spreads far more than 4%.

## Why It Echoes Across Eras

| LTCM (1998) | [[Three Arrows Capital]] (2022) |
|---|---|
| Nobel Prize winners | "Supercycle" thesis |
| Bond convergence trades | Crypto directional bets |
| 25:1 leverage | Unknown but massive leverage |
| "Diversified" but correlated | BTC/ETH/LUNA/GBTC all correlated |
| Russian crisis trigger | LUNA collapse trigger |
| Fed-orchestrated bailout | No bailout (crypto) |

The pattern is identical across 24 years and two completely different markets. Smart people, leverage, correlation surprise, ruin.

## Lessons

1. **Leverage + model risk = ruin** — If your model underestimates tail risk, leverage guarantees you'll blow up in the tail.
2. **Past correlations don't predict crisis correlations** — Everything that was uncorrelated becomes correlated when everyone runs for the exit.
3. **Prestige ≠ correctness** — Nobel Prizes don't make your model right. [[nassim-taleb]]: "Never trust a risk model that its creator hasn't survived a crisis with."
4. **Size is a risk factor** — LTCM's positions were so large that they couldn't exit without moving the market against themselves.

## See Also

- [[three-arrows-capital]] — The crypto mirror image
- [[ftx-collapse]] — Different mechanism, same outcome
- [[reflexivity]] — Crisis-mode feedback loops
- [[position-sizing]] — The defense they didn't have
- [[nassim-taleb]] — The critic who called it
