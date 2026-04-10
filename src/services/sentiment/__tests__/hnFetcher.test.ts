/**
 * Tests for src/services/sentiment/hnFetcher.ts
 * Covers Algolia URL shape, hit mapping, score sorting, error handling.
 */

import { describe, it, expect, vi } from 'vitest'
import { fetchHackerNews } from '../hnFetcher.js'
import type { FetchLike } from '../redditFetcher.js'

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText: ok ? 'OK' : 'Bad',
    headers: { 'content-type': 'application/json' },
  })
}

describe('fetchHackerNews', () => {
  it('maps Algolia hits into SentimentSnippets sorted by points', async () => {
    const fetchImpl: FetchLike = vi.fn(async () =>
      jsonResponse({
        hits: [
          {
            objectID: '1',
            title: 'AI breakthrough at OpenAI',
            url: 'https://example.com/1',
            points: 200,
            num_comments: 80,
            created_at_i: Math.floor(Date.now() / 1000) - 100,
            story_text: 'Lots of detail here.',
          },
          {
            objectID: '2',
            title: 'Smaller story',
            url: 'https://example.com/2',
            points: 50,
            num_comments: 5,
            created_at_i: Math.floor(Date.now() / 1000) - 1000,
          },
        ],
      }),
    )

    const result = await fetchHackerNews('OPENAI', { fetchImpl })

    expect(result.source).toBe('hackernews')
    expect(result.snippets).toHaveLength(2)
    expect(result.snippets[0]!.title).toBe('AI breakthrough at OpenAI')
    expect(result.snippets[0]!.score).toBe(200)
    expect(result.snippets[0]!.engagement).toBe(80)
    expect(result.aggregateSignal).toBeGreaterThan(0)
  })

  it('encodes the lookback window into the numericFilters query param', async () => {
    let capturedUrl = ''
    const fetchImpl: FetchLike = vi.fn(async (url: string) => {
      capturedUrl = url
      return jsonResponse({ hits: [] })
    })

    await fetchHackerNews('BTC', { lookbackDays: 7, fetchImpl })

    expect(capturedUrl).toContain('hn.algolia.com')
    expect(capturedUrl).toContain('numericFilters=created_at_i')
    expect(capturedUrl).toContain('query=BTC')
  })

  it('strips HTML tags from story_text snippets', async () => {
    const fetchImpl: FetchLike = vi.fn(async () =>
      jsonResponse({
        hits: [{
          objectID: '1',
          title: 'Title',
          url: 'https://example.com',
          points: 1,
          created_at_i: 1700000000,
          story_text: '<p>Hello <b>world</b></p>',
        }],
      }),
    )

    const result = await fetchHackerNews('X', { fetchImpl })
    expect(result.snippets[0]!.snippet).toBe('Hello world')
  })

  it('returns empty result with error on HTTP failure', async () => {
    const fetchImpl: FetchLike = vi.fn(async () =>
      jsonResponse(null, false, 503),
    )

    const result = await fetchHackerNews('BTC', { fetchImpl })
    expect(result.snippets).toEqual([])
    expect(result.error).toBeDefined()
  })

  it('falls back to news.ycombinator.com URL when hit lacks url', async () => {
    const fetchImpl: FetchLike = vi.fn(async () =>
      jsonResponse({
        hits: [{
          objectID: '12345',
          title: 'Ask HN: thoughts',
          url: null,
          points: 10,
          created_at_i: 1700000000,
        }],
      }),
    )

    const result = await fetchHackerNews('X', { fetchImpl })
    expect(result.snippets[0]!.url).toBe('https://news.ycombinator.com/item?id=12345')
  })

  it('handles empty hits gracefully', async () => {
    const fetchImpl: FetchLike = vi.fn(async () => jsonResponse({ hits: [] }))

    const result = await fetchHackerNews('NEVER_MENTIONED', { fetchImpl })
    expect(result.snippets).toEqual([])
    expect(result.aggregateSignal).toBe(0)
    expect(result.error).toBeUndefined()
  })
})
