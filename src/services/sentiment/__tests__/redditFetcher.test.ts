/**
 * Tests for src/services/sentiment/redditFetcher.ts
 * Covers ticker normalization, subreddit selection, fetch shape, dedup, error handling.
 */

import { describe, it, expect, vi } from 'vitest'
import {
  fetchReddit,
  normalizeTicker,
  pickSubreddits,
  type FetchLike,
} from '../redditFetcher.js'

// ── Ticker normalization ──────────────────────────────────────────────────

describe('normalizeTicker', () => {
  it('strips slashes and pair suffixes', () => {
    expect(normalizeTicker('BTC/USDT')).toBe('btc')
    expect(normalizeTicker('ETH/USD')).toBe('eth')
  })

  it('lowercases plain stock tickers', () => {
    expect(normalizeTicker('AAPL')).toBe('aapl')
    expect(normalizeTicker('TSLA')).toBe('tsla')
  })

  it('strips non-alphanumerics', () => {
    expect(normalizeTicker('SOL-USD')).toBe('solusd')
  })
})

// ── Subreddit selection ───────────────────────────────────────────────────

describe('pickSubreddits', () => {
  it('uses the explicit map for known crypto majors', () => {
    expect(pickSubreddits('BTC/USDT')).toContain('Bitcoin')
    expect(pickSubreddits('ETH')).toContain('ethereum')
  })

  it('uses the explicit map for known stocks', () => {
    expect(pickSubreddits('TSLA')).toContain('teslainvestorsclub')
    expect(pickSubreddits('SPY')).toContain('wallstreetbets')
  })

  it('falls back to crypto subs for unknown crypto-shaped pairs', () => {
    const subs = pickSubreddits('LINK/USDT')
    expect(subs).toContain('CryptoCurrency')
  })

  it('falls back to stock subs for unknown letter-only tickers', () => {
    const subs = pickSubreddits('XYZ')
    expect(subs).toContain('wallstreetbets')
  })
})

// ── fetchReddit ───────────────────────────────────────────────────────────

function makeMockResponse(data: unknown, ok = true, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    statusText: ok ? 'OK' : 'Bad',
    headers: { 'content-type': 'application/json' },
  })
}

function makeRedditPayload(posts: Array<{ title: string; score: number; permalink: string; selftext?: string; num_comments?: number }>) {
  return {
    data: {
      children: posts.map(p => ({
        data: {
          title: p.title,
          score: p.score,
          permalink: p.permalink,
          selftext: p.selftext ?? '',
          num_comments: p.num_comments ?? 0,
          created_utc: 1700000000,
        },
      })),
    },
  }
}

describe('fetchReddit', () => {
  it('aggregates snippets across subreddits', async () => {
    const fetchImpl: FetchLike = vi.fn(async () =>
      makeMockResponse(
        makeRedditPayload([
          { title: 'BTC pump', score: 500, permalink: '/r/Bitcoin/c/abc' },
          { title: 'BTC dump', score: 200, permalink: '/r/Bitcoin/c/def' },
        ]),
      ),
    )

    const result = await fetchReddit('BTC/USDT', { fetchImpl })

    expect(result.source).toBe('reddit')
    expect(result.snippets.length).toBeGreaterThan(0)
    expect(result.snippets[0]!.title).toBe('BTC pump') // sorted by score desc
    expect(result.snippets[0]!.url).toContain('reddit.com')
    expect(result.aggregateSignal).toBeGreaterThan(0)
  })

  it('dedupes snippets across subreddits by URL', async () => {
    const fetchImpl: FetchLike = vi.fn(async () =>
      makeMockResponse(
        makeRedditPayload([
          { title: 'Same post', score: 100, permalink: '/r/A/c/dup' },
          { title: 'Same post', score: 100, permalink: '/r/A/c/dup' },
        ]),
      ),
    )

    const result = await fetchReddit('BTC', { fetchImpl })
    const dupCount = result.snippets.filter(s => s.url.endsWith('/dup')).length
    expect(dupCount).toBe(1)
  })

  it('returns empty result with error when all subs fail', async () => {
    const fetchImpl: FetchLike = vi.fn(async () =>
      makeMockResponse(null, false, 503),
    )

    const result = await fetchReddit('BTC', { fetchImpl })
    expect(result.snippets).toEqual([])
    expect(result.aggregateSignal).toBe(0)
    expect(result.error).toBeDefined()
  })

  it('survives partial failures across subs', async () => {
    let callCount = 0
    const fetchImpl: FetchLike = vi.fn(async () => {
      callCount += 1
      if (callCount === 1) return makeMockResponse(null, false, 500)
      return makeMockResponse(
        makeRedditPayload([{ title: 'survivor', score: 50, permalink: '/r/B/c/x' }]),
      )
    })

    const result = await fetchReddit('BTC', { fetchImpl })
    expect(result.snippets.length).toBeGreaterThan(0)
    expect(result.snippets[0]!.title).toBe('survivor')
  })

  it('caps results at 30', async () => {
    const manyPosts = Array.from({ length: 80 }, (_, i) => ({
      title: `post-${i}`,
      score: i,
      permalink: `/r/X/c/${i}`,
    }))
    const fetchImpl: FetchLike = vi.fn(async () =>
      makeMockResponse(makeRedditPayload(manyPosts)),
    )

    const result = await fetchReddit('UNKNOWN_TICKER', { fetchImpl })
    expect(result.snippets.length).toBeLessThanOrEqual(30)
  })

  it('aggregateSignal saturates with high engagement', async () => {
    const huge = [{ title: 'mega', score: 50_000, permalink: '/r/X/c/big' }]
    const fetchImpl: FetchLike = vi.fn(async () =>
      makeMockResponse(makeRedditPayload(huge)),
    )

    const result = await fetchReddit('UNKNOWN_TICKER', { fetchImpl })
    expect(result.aggregateSignal).toBeGreaterThan(0.9)
    expect(result.aggregateSignal).toBeLessThanOrEqual(1)
  })
})
