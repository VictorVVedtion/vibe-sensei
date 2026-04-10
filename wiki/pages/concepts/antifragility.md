---
title: Antifragility
type: concept
tags: [risk-philosophy, taleb, optionality, survival]
sources: []
created: 2026-04-06
updated: 2026-04-06
---

# Antifragility

[[Nassim Taleb]]'s core framework. Beyond robustness — things that **gain** from disorder, stress, and volatility.

## The Triad

| Category | Response to Stress | Example |
|----------|-------------------|---------|
| **Fragile** | Breaks | A glass, overleveraged portfolio, [[three-arrows-capital]] |
| **Robust** | Unchanged | A rock, cash position, [[margin-of-safety]] |
| **Antifragile** | Gets stronger | Muscles, Taleb's barbell, long volatility positions |

The key insight: in a world of Black Swans and fat tails, **robustness isn't enough**. You need to benefit from the shocks you can't predict.

## The Barbell Strategy

Taleb's practical implementation:

```
[85-90% ultra-safe]  ←————————→  [10-15% ultra-speculative]
   T-bills, cash                   Deep OTM options, moonshots
        ↑                                    ↑
   Can't lose much                    Can gain massively
```

**Nothing in the middle.** The middle (corporate bonds, balanced portfolios, "moderate risk") is where you get the worst of both worlds: not safe enough to survive a crash, not risky enough to profit from one.

The barbell is antifragile because:
- Downside is capped (you can only lose the speculative portion)
- Upside is uncapped (options, moonshots have convex payoff)
- Volatility helps: more shocks → more chances for the speculative tail to pay off

## Application to Trading

### Portfolio Construction
- Don't aim for "moderate" risk across the board
- Separate your capital into "never lose this" and "OK to lose all of this"
- The speculative portion should be in **convex bets** — small downside, large upside

### Position Sizing ([[position-sizing]])
- Antifragile sizing: small bets on many high-upside trades
- Never risk ruin on any single position
- [[Kelly criterion]] at full size is fragile; fractional Kelly is robust; optionality-based is antifragile

### Response to Losses
- Fragile response: double down on losers, add to losing positions
- Robust response: cut losses at stop-loss, preserve capital
- Antifragile response: cut losses AND redeploy into fresh convex bets. Losses prune weak positions; capital flows to new opportunities.

## Via Negativa

Improvement by subtraction. In trading:
- Remove fragilities (excessive leverage, concentrated positions, correlated bets)
- Don't add complexity (more indicators, more screens, more data)
- Simplify until only the antifragile core remains

## Master Perspectives

| Master | Fragility Spectrum |
|--------|-------------------|
| [[nassim-taleb]] | Antifragile. The barbell. |
| [[warren-buffett]] | Robust → mildly antifragile. Cash pile enables buying during crashes. |
| [[jim-simons]] | Antifragile via diversification. Thousands of uncorrelated bets. |
| [[jesse-livermore]] | Fragile. Brilliant but no ruin protection. |
| [[george-soros]] | Antifragile when right (reflexive bets have convex payoff). Fragile when wrong and slow to cut. |

## Ghost Warnings as Fragility Examples

Every ghost in Vibe Sensei is a fragility failure:

| Ghost | Fragility |
|-------|-----------|
| [[ftx-collapse]] | Fragile: commingled funds, no risk controls |
| [[three-arrows-capital]] | Fragile: leveraged directional bet, no hedges |
| [[ltcm-collapse]] | Fragile: models assumed normal distributions, leverage amplified |
| LUNA/Do Kwon | Fragile: reflexive loop with no circuit breaker |

## See Also

- [[nassim-taleb]] — The philosopher
- [[margin-of-safety]] — The robust precursor
- [[position-sizing]] — Practical implementation
- [[kelly-criterion]] — Fractional Kelly as robustness
