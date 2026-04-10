---
title: "FTX Collapse — The SBF Cautionary Tale"
type: ghost
tags: [crypto, fraud, risk-controls, leverage, cautionary]
sources: []
created: 2026-04-06
updated: 2026-04-06
---

# FTX Collapse

**Ghost**: Sam Bankman-Fried | **Trigger**: Missing risk controls
**Ghost Quote**: "I used to think risk management was optional too."

The fastest rise and most spectacular collapse in crypto history. FTX went from $32B valuation to bankruptcy in 10 days (November 2-11, 2022).

## What Happened

1. **The build (2019-2022)**: SBF built FTX into the #2 crypto exchange globally. Effective altruism branding, political donations, celebrity endorsements, stadium naming rights. Projected competence and trustworthiness.

2. **The hidden rot**: Alameda Research (SBF's trading firm) had a secret back door to FTX customer funds. ~$8B in customer deposits were funneled to Alameda to cover trading losses and venture investments.

3. **The trigger (Nov 2, 2022)**: CoinDesk reported that Alameda's balance sheet was mostly FTT tokens (FTX's own exchange token). Circular value — FTX's collateral was its own stock, essentially.

4. **The bank run (Nov 6-8)**: Binance's CZ announced selling his FTT holdings. Customers rushed to withdraw. FTX couldn't meet redemptions because the money was gone.

5. **The collapse (Nov 11)**: FTX filed for bankruptcy. $8B+ customer funds missing. SBF arrested, convicted, sentenced to 25 years.

## Why It Matters

FTX violated every principle in the Vibe Sensei wiki:

| Principle Violated | How |
|---|---|
| [[margin-of-safety]] | No safety buffer — all-in on FTT and illiquid tokens |
| [[position-sizing]] | Alameda's positions were larger than FTX's total customer deposits |
| [[reflexivity]] | FTT price depended on FTX success, which depended on FTT price. Classic reflexive loop. |
| [[antifragility]] | Maximally fragile — any stress test (the CoinDesk article) caused total collapse |
| Satoshi's "trustless" | FTX re-centralized trust. Users trusted SBF. That was the vulnerability. |

## Lessons

1. **Counterparty risk is real** — [[gary-gensler]]'s quote: "If you don't know who's the counterparty, you are the counterparty."
2. **Commingled funds = fraud** — Customer deposits and trading capital must be segregated. Always.
3. **Circular collateral = zero collateral** — If your collateral is your own token, you have no collateral.
4. **Charisma ≠ competence** — SBF's public persona masked complete operational chaos. No accounting, no risk management, no board oversight.

## [[Reflexivity]] Autopsy

FTX/Alameda was a textbook [[reflexivity]] failure:
```
FTT price up → Alameda balance sheet looks healthy → FTX raises more money
→ More trust → More deposits → More FTT demand → FTT price up
...until...
FTT price down → Alameda insolvent → FTX can't cover withdrawals
→ Bank run → More selling → FTT collapses → Total ruin
```

The same feedback loop that [[george-soros]] exploits in currencies destroyed FTX from the inside.

## See Also

- [[three-arrows-capital]] — Leverage collapse in the same cycle
- [[ltcm-collapse]] — The TradFi parallel
- [[satoshi-nakamoto]] — The trustless vision FTX betrayed
- [[reflexivity]] — The mechanism of collapse
