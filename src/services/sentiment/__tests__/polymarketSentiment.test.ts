/**
 * Tests for src/services/sentiment/polymarketSentiment.ts
 * Covers polarity classification and adapter behavior.
 */

import { describe, it, expect, vi } from 'vitest'
import { fetchPolymarketSentiment, classifyMarketPolarity } from '../polymarketSentiment.js'
import type { PredictionMarket } from '../../exchange/types.js'

function makeMarket(opts: {
  question: string
  yesPrice?: number
  volume?: number
  id?: string
}): PredictionMarket {
  const yesPrice = opts.yesPrice ?? 0.5
  return {
    id: opts.id ?? 'mkt_1',
    question: opts.question,
    outcomes: ['Yes', 'No'],
    currentPrices: [yesPrice, 1 - yesPrice],
    volume: opts.volume ?? 10_000,
    endDate: '2026-12-31T00:00:00Z',
  }
}

describe('classifyMarketPolarity', () => {
  it('treats bullish-keyword markets with high YES as positive', () => {
    const market = makeMarket({
      question: 'Will BTC reach $200,000 by Dec 2026?',
      yesPrice: 0.8,
    })
    const polarity = classifyMarketPolarity(market)
    expect(polarity).toBeGreaterThan(0.4)
    expect(polarity).toBeLessThanOrEqual(1)
  })

  it('treats bearish-keyword markets with high YES as negative', () => {
    const market = makeMarket({
      question: 'Will the SEC ban Bitcoin ETFs by year-end?',
      yesPrice: 0.7,
    })
    const polarity = classifyMarketPolarity(market)
    expect(polarity).toBeLessThan(-0.2)
  })

  it('refuses to project ambiguous questions', () => {
    const market = makeMarket({
      question: 'Will Trump win the 2028 election?',
      yesPrice: 0.65,
    })
    expect(classifyMarketPolarity(market)).toBe(0)
  })

  it('returns 0 for centered YES prices', () => {
    const market = makeMarket({
      question: 'Will BTC reach $100k?',
      yesPrice: 0.5,
    })
    expect(classifyMarketPolarity(market)).toBe(0)
  })
})

describe('fetchPolymarketSentiment', () => {
  it('maps markets to snippets sorted by volume', async () => {
    const client = {
      getMarkets: vi.fn(async () => [
        makeMarket({ question: 'Will BTC hit $150k?', yesPrice: 0.4, volume: 50_000, id: 'a' }),
        makeMarket({ question: 'Will BTC fall below $40k?', yesPrice: 0.2, volume: 100_000, id: 'b' }),
      ]),
    }

    const result = await fetchPolymarketSentiment('BTC', { client })

    expect(result.source).toBe('polymarket')
    expect(result.snippets).toHaveLength(2)
    expect(result.snippets[0]!.score).toBe(100_000) // sorted by volume
    expect(result.snippets[0]!.url).toContain('polymarket.com')
  })

  it('strips pair suffix before querying', async () => {
    let capturedQuery = ''
    const client = {
      getMarkets: vi.fn(async (q?: string) => {
        capturedQuery = q ?? ''
        return []
      }),
    }

    await fetchPolymarketSentiment('BTC/USDT', { client })
    expect(capturedQuery).toBe('BTC')
  })

  it('returns empty result on getMarkets throw', async () => {
    const client = {
      getMarkets: vi.fn(async () => {
        throw new Error('network down')
      }),
    }

    const result = await fetchPolymarketSentiment('BTC', { client })
    expect(result.snippets).toEqual([])
    expect(result.error).toBe('network down')
  })

  it('returns empty result with no error when no markets match', async () => {
    const client = { getMarkets: vi.fn(async () => []) }
    const result = await fetchPolymarketSentiment('OBSCURE', { client })
    expect(result.snippets).toEqual([])
    expect(result.error).toBeUndefined()
  })

  it('aggregateSignal is in [-1, +1] range', async () => {
    const client = {
      getMarkets: vi.fn(async () => [
        makeMarket({ question: 'Will BTC reach $300k?', yesPrice: 0.95, volume: 100_000 }),
        makeMarket({ question: 'Will BTC crash below $20k?', yesPrice: 0.05, volume: 50_000 }),
      ]),
    }
    const result = await fetchPolymarketSentiment('BTC', { client })
    expect(result.aggregateSignal).toBeGreaterThanOrEqual(-1)
    expect(result.aggregateSignal).toBeLessThanOrEqual(1)
  })

  it('honors a per-source timeout', async () => {
    const client = {
      getMarkets: vi.fn(
        () => new Promise(resolve => setTimeout(() => resolve([]), 200)),
      ),
    }
    const result = await fetchPolymarketSentiment('BTC', { client, timeoutMs: 50 })
    expect(result.error).toContain('timeout')
  })
})
