---
title: "Three Arrows Capital — The Supercycle That Wasn't"
type: ghost
tags: [crypto, leverage, liquidation, hedge-fund, cautionary]
sources: []
created: 2026-04-06
updated: 2026-04-06
---

# Three Arrows Capital (3AC)

**Ghosts**: Su Zhu, Kyle Davies | **Trigger**: Excessive leverage / Conviction without risk controls
**Ghost Quotes**:
- Su Zhu: "Each cycle, the floor moves up — until it doesn't."
- Kyle Davies: "Conviction without risk controls is just velocity into a wall."

3AC was a $10B+ crypto hedge fund that went from peak to insolvency in weeks, triggering a cascade of failures across the entire crypto lending ecosystem.

## What Happened

1. **The thesis**: Su Zhu and Kyle Davies believed in the "supercycle" — that crypto would never have a traditional bear market again because institutional adoption created a permanent bid.

2. **The leverage**: 3AC borrowed aggressively from every major crypto lender (Celsius, Voyager, BlockFi, Genesis). Used the borrowed capital to make concentrated directional bets — long BTC, long ETH, long LUNA, long GBTC.

3. **The LUNA collapse (May 2022)**: 3AC had a ~$600M position in LUNA/UST. When the algorithmic stablecoin depegged and spiraled to zero ([[reflexivity]] in reverse), 3AC lost the entire position.

4. **The margin calls (June 2022)**: BTC dropped from $40K to $20K. Every lender called in their loans simultaneously. 3AC couldn't meet the calls because their collateral had collapsed.

5. **The cascade**: 3AC's insolvency destroyed its lenders. Celsius, Voyager, and BlockFi all went bankrupt. ~$40B in value evaporated across the ecosystem.

## The Supercycle Fallacy

Su Zhu's thesis was that each crypto cycle had a higher floor:
```
2014 bottom: ~$200
2018 bottom: ~$3,200
2022 bottom: therefore > $30,000 (the "supercycle floor")
```

The logic: institutional adoption, ETFs, sovereign interest = permanent demand floor.

The flaw: **sample size of 2 cycles is not a pattern**. And even if the long-term trend is up, leverage doesn't survive the interim drawdowns. Being "eventually right" doesn't help if you're margin-called today.

## Why It Connects to Everything

| Connection | How |
|---|---|
| [[jesse-livermore]] | Same pattern: brilliant thesis, fatal leverage. Livermore went bankrupt multiple times for the same reason. |
| [[position-sizing]] | 3AC had no position limits. Individual positions exceeded their total equity. |
| [[reflexivity]] | Their LUNA position was destroyed by reflexive collapse. Their own liquidations accelerated the broader crash. |
| [[antifragility]] | Maximally fragile — concentrated, leveraged, correlated. A single shock destroyed everything. |
| [[nassim-taleb]] | "The cemetery of dead traders" — 3AC is the latest headstone. |
| [[ltcm-collapse]] | Same structure: brilliant people, concentrated bets, leverage, correlation surprise. |

## Lessons

1. **Conviction ≠ sizing** — You can be right about the direction and still go bankrupt from sizing.
2. **Leverage kills at the worst moment** — Margin calls come when the market is falling fastest, forcing liquidation at the worst prices.
3. **Correlated bets aren't diversified** — BTC, ETH, LUNA, GBTC all went down together. This isn't diversification.
4. **Lender due diligence failed** — No lender understood 3AC's total leverage across all counterparties. The system's risk management was as bad as 3AC's.

## See Also

- [[ftx-collapse]] — The other shoe that dropped in the same cycle
- [[ltcm-collapse]] — The TradFi predecessor
- [[position-sizing]] — What they didn't do
- [[reflexivity]] — The mechanism that accelerated the collapse
