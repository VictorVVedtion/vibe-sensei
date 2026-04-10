---
title: "Value vs. Momentum — Buffett vs. Livermore"
type: comparison
tags: [strategy, debate, value-investing, trend-following]
sources: []
created: 2026-04-06
updated: 2026-04-06
---

# Value vs. Momentum

The oldest debate in markets. Buy cheap and wait ([[warren-buffett]]) or buy expensive and ride ([[jesse-livermore]])?

## The Two Schools

### Value: Buy What's Cheap
**Champions**: [[benjamin-graham]], [[warren-buffett]], [[charlie-munger]], [[michael-burry]]

Core belief: Assets have intrinsic value. When price < value, buy. When price > value, sell (or at least don't buy). The market eventually recognizes value — your job is to be patient.

**Edge source**: Behavioral — other people panic, get bored, or can't wait. You can.

**Time horizon**: Months to years (Buffett: "forever").

**Risk profile**: Bounded downside (you bought cheap), but can be wrong for a long time. Value traps exist.

### Momentum: Buy What's Rising
**Champions**: [[jesse-livermore]], [[nicolas-darvas]], [[richard-dennis]], [[linda-raschke]]

Core belief: Trends exist and persist. Price action contains information. Don't argue with the tape. The trend is your friend until it ends.

**Edge source**: [[Reflexivity]] — rising prices attract more buyers, which raises prices further.

**Time horizon**: Days to months.

**Risk profile**: Cut losses fast (the trend broke = you're wrong). But whipsaws and false breakouts create friction.

## Head-to-Head

| Dimension | Value | Momentum |
|-----------|-------|----------|
| Entry signal | Undervaluation (fundamentals) | Breakout / trend confirmation (price) |
| Exit signal | Fair value reached or thesis broken | Trend reversal or stop-loss hit |
| Holding period | Long (months-years) | Short-medium (days-months) |
| Win rate | Lower (many value traps) | Higher (riding trends) |
| Payoff per win | Higher (mean reversion from deep discount) | Varies (some trends run far, many fizzle) |
| Worst enemy | Value trap (cheap gets cheaper) | Whipsaw (false breakout, stopped out, trend resumes) |
| Psychology required | Patience, conviction, contrarianism | Discipline, speed, loss acceptance |
| Market regime | Wins in mean-reverting markets | Wins in trending markets |

## The Synthesis

The masters who combine both tend to outperform pure practitioners of either:

- **[[George Soros]]**: Uses fundamental analysis (value) to identify the thesis, then uses [[reflexivity]] (momentum) to time the entry and size the bet.
- **[[Stanley Druckenmiller]]**: "I've learned many things from George, but the most significant is that it's not whether you're right or wrong but how much you make when right." Fundamental + momentum sizing.
- **[[Michael Burry]]**: Deep value thesis (subprime was overpriced) but waited for the momentum trigger (the actual default wave) to pay off.
- **[[Ed Thorp]]**: Mathematical edge (value) + systematic execution (momentum-like discipline).

## In Crypto

Crypto markets amplify both effects:
- **Value**: Hard to define intrinsic value for most tokens. But network fundamentals (TVL, users, revenue) provide some grounding.
- **Momentum**: Extremely strong due to narrative cycles, social media, and 24/7 trading. [[Reflexivity]] is amplified.
- **Ghost warning**: Pure momentum in crypto without risk management → [[three-arrows-capital]]. Pure "value" holding without stop-loss → countless -90% bags.

## The Vibe Sensei Angle

The guardian debate system (`src/buddy/debate.ts`) stages adversarial arguments between masters before big trades. A value master and a momentum master debating the same trade is the most common and useful setup:

> **Buffett**: "This is overpriced. Where's the margin of safety?"
> **Livermore**: "The trend says it's going higher. Let the tape speak."

The user hears both sides. That's the point.

## See Also

- [[warren-buffett]] — Value champion
- [[jesse-livermore]] — Momentum champion
- [[george-soros]] — The synthesizer
- [[reflexivity]] — Why momentum works
- [[margin-of-safety]] — Why value works
