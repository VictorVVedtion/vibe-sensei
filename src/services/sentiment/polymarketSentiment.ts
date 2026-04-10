/**
 * Polymarket sentiment adapter for /pulse.
 *
 * Reuses the Sprint 98 PolymarketClient — does NOT make new HTTP calls.
 * Pulls related prediction markets for a symbol/topic and projects the
 * implied YES probability into a [-1, +1] sentiment scalar.
 *
 * The semantics are inverted from social buzz: a high YES probability for a
 * "BTC over $X by date" market is *bullish*, but YES on a "regulator bans X"
 * market is *bearish*. v1 is conservative — we only push the signal toward
 * +1 when the market question is unambiguously upside, and toward -1 only when
 * it's unambiguously downside. Everything else stays neutral but the market
 * still appears as a snippet so the user can read it.
 *
 * v2 will pass questions through the LLM for polarity classification.
 */

import type { PredictionInterface, PredictionMarket } from '../exchange/types.js'
import type { SentimentSnippet, SourceResult } from './types.js'

const DEFAULT_TIMEOUT_MS = 8_000

const BULLISH_TERMS = [
  'reach', 'exceed', 'above', 'over', 'hit', 'cross', 'all-time high',
  'ath', 'rally', 'surge', 'pump', 'breakout', 'moon',
]

const BEARISH_TERMS = [
  'fall', 'drop', 'below', 'under', 'crash', 'collapse', 'ban',
  'liquidate', 'bankruptcy', 'investigation', 'fraud', 'rug',
]

/**
 * Project a prediction market into a [-1, +1] polarity scalar.
 * yes-price 0.5 with no clear direction → 0.
 * yes-price 0.8 on a bullish question  → +0.6.
 * yes-price 0.8 on a bearish question  → -0.6.
 * Ambiguous question                   → 0 regardless of yes-price.
 */
export function classifyMarketPolarity(market: PredictionMarket): number {
  const question = market.question.toLowerCase()
  const yesIndex = market.outcomes.findIndex(o => o.toLowerCase() === 'yes')
  const yesPrice = yesIndex >= 0 ? market.currentPrices[yesIndex] ?? 0.5 : 0.5

  // Center on 0.5 → range becomes [-0.5, +0.5], double it → [-1, +1]
  const offset = (yesPrice - 0.5) * 2

  const hasBullish = BULLISH_TERMS.some(term => question.includes(term))
  const hasBearish = BEARISH_TERMS.some(term => question.includes(term))

  if (hasBullish && !hasBearish) return offset
  if (hasBearish && !hasBullish) return -offset
  // Ambiguous or both — refuse to project
  return 0
}

/**
 * Convert a single PredictionMarket into a SentimentSnippet.
 */
function marketToSnippet(market: PredictionMarket): SentimentSnippet {
  const yesIdx = market.outcomes.findIndex(o => o.toLowerCase() === 'yes')
  const yesPrice = yesIdx >= 0 ? market.currentPrices[yesIdx] ?? 0.5 : 0.5
  return {
    source: 'polymarket' as const,
    title: market.question,
    url: market.id ? `https://polymarket.com/event/${market.id}` : 'https://polymarket.com',
    score: market.volume,
    ts: market.endDate ? Date.parse(market.endDate) || Date.now() : Date.now(),
    snippet: `YES @ ${(yesPrice * 100).toFixed(0)}% · vol $${market.volume.toFixed(0)} · ends ${market.endDate || 'TBA'}`,
  }
}

/**
 * Compose a volume-weighted polarity scalar across an array of markets.
 * Returns a value clamped to [-1, +1].
 */
function composePolymarketSignal(markets: PredictionMarket[]): number {
  let weightedSum = 0
  let totalWeight = 0
  for (const market of markets) {
    const weight = Math.max(1, market.volume)
    weightedSum += classifyMarketPolarity(market) * weight
    totalWeight += weight
  }
  const aggregate = totalWeight > 0 ? weightedSum / totalWeight : 0
  return Math.max(-1, Math.min(1, aggregate))
}

interface PolymarketSentimentDeps {
  client: Pick<PredictionInterface, 'getMarkets'>
  timeoutMs?: number
}

/**
 * Fetch related Polymarket markets for a symbol and project them into a
 * SourceResult. Always resolves; never throws.
 */
export async function fetchPolymarketSentiment(
  symbol: string,
  deps: PolymarketSentimentDeps,
): Promise<SourceResult> {
  const { client, timeoutMs = DEFAULT_TIMEOUT_MS } = deps
  const base = symbol.split('/')[0] ?? symbol

  try {
    const markets = await Promise.race([
      client.getMarkets(base),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('polymarket timeout')), timeoutMs),
      ),
    ])

    if (!Array.isArray(markets) || markets.length === 0) {
      return {
        source: 'polymarket',
        snippets: [],
        aggregateSignal: 0,
        fetchedAt: Date.now(),
      }
    }

    const snippets: SentimentSnippet[] = markets
      .filter(market => market.question)
      .map(marketToSnippet)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)

    return {
      source: 'polymarket',
      snippets,
      aggregateSignal: composePolymarketSignal(markets),
      fetchedAt: Date.now(),
    }
  } catch (err) {
    return {
      source: 'polymarket',
      snippets: [],
      aggregateSignal: 0,
      fetchedAt: Date.now(),
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
