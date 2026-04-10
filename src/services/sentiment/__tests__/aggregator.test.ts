/**
 * Tests for src/services/sentiment/aggregator.ts
 * Covers parallel fan-out, per-source timeout, partial failure, cache hit/miss,
 * composite signal computation, and `only` source filter.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { gatherSentiment, type FetcherDeps } from '../aggregator.js'
import { clearSentimentCache, getCachedSource } from '../cache.js'
import type { SentimentSnippet, SourceResult, SentimentSourceName } from '../types.js'

function makeSnippet(
  source: SentimentSourceName,
  overrides: Partial<SentimentSnippet> = {},
): SentimentSnippet {
  return {
    source,
    title: 'mock',
    url: `https://example.com/${source}`,
    score: 100,
    ts: Date.now(),
    snippet: 'mock body',
    ...overrides,
  }
}

function ok(source: SentimentSourceName, signal = 0.5, snippetCount = 3): SourceResult {
  return {
    source,
    snippets: Array.from({ length: snippetCount }, (_, i) =>
      makeSnippet(source, { url: `https://example.com/${source}/${i}` }),
    ),
    aggregateSignal: signal,
    fetchedAt: Date.now(),
  }
}

function fakeDeps(overrides: Partial<FetcherDeps> = {}): FetcherDeps {
  return {
    reddit: vi.fn(async () => ok('reddit', 0.5)),
    hackernews: vi.fn(async () => ok('hackernews', 0.3)),
    polymarket: vi.fn(async () => ok('polymarket', -0.2)),
    youtube: vi.fn(async () => ok('youtube', 0.1)),
    ...overrides,
  }
}

describe('gatherSentiment', () => {
  beforeEach(() => {
    clearSentimentCache()
  })

  afterEach(() => {
    clearSentimentCache()
  })

  it('fans out to all 4 fetchers in parallel', async () => {
    const deps = fakeDeps()
    const brief = await gatherSentiment('BTC', {}, deps)

    expect(brief.sources).toHaveLength(4)
    expect(deps.reddit).toHaveBeenCalledTimes(1)
    expect(deps.hackernews).toHaveBeenCalledTimes(1)
    expect(deps.polymarket).toHaveBeenCalledTimes(1)
    expect(deps.youtube).toHaveBeenCalledTimes(1)
  })

  it('caches per-source results so a second call short-circuits', async () => {
    const deps = fakeDeps()
    await gatherSentiment('BTC', {}, deps)
    expect(getCachedSource('BTC', 'reddit')).toBeDefined()

    // Second call should reuse cached brief entirely
    await gatherSentiment('BTC', {}, deps)
    expect(deps.reddit).toHaveBeenCalledTimes(1) // not called again
  })

  it('honors noCache by re-fetching even when cache is fresh', async () => {
    const deps = fakeDeps()
    await gatherSentiment('BTC', {}, deps)
    await gatherSentiment('BTC', { noCache: true }, deps)
    expect(deps.reddit).toHaveBeenCalledTimes(2)
  })

  it('honors `only` to restrict source set', async () => {
    const deps = fakeDeps()
    const brief = await gatherSentiment('BTC', { only: ['reddit', 'hackernews'] }, deps)

    expect(brief.sources).toHaveLength(2)
    expect(deps.reddit).toHaveBeenCalledTimes(1)
    expect(deps.hackernews).toHaveBeenCalledTimes(1)
    expect(deps.polymarket).not.toHaveBeenCalled()
    expect(deps.youtube).not.toHaveBeenCalled()
  })

  it('survives a per-source timeout without breaking the brief', async () => {
    const slow: FetcherDeps['reddit'] = () =>
      new Promise(resolve => setTimeout(() => resolve(ok('reddit')), 5_000))
    const deps = fakeDeps({ reddit: vi.fn(slow) })

    const brief = await gatherSentiment(
      'BTC',
      { perSourceTimeoutMs: 50, overallTimeoutMs: 1000 },
      deps,
    )

    const reddit = brief.sources.find(s => s.source === 'reddit')
    expect(reddit?.snippets).toEqual([])
    expect(reddit?.error).toContain('timeout')
    // Other sources still ran successfully
    const hn = brief.sources.find(s => s.source === 'hackernews')
    expect(hn?.snippets.length).toBeGreaterThan(0)
  })

  it('survives a fetcher that throws', async () => {
    const blowup: FetcherDeps['polymarket'] = vi.fn(async () => {
      throw new Error('polymarket exploded')
    })
    const deps = fakeDeps({ polymarket: blowup })

    const brief = await gatherSentiment('BTC', {}, deps)
    const pm = brief.sources.find(s => s.source === 'polymarket')
    expect(pm?.snippets).toEqual([])
    expect(pm?.error).toBe('polymarket exploded')
  })

  it('composite signal is in [-1, +1]', async () => {
    const deps = fakeDeps()
    const brief = await gatherSentiment('BTC', {}, deps)
    expect(brief.composite).toBeGreaterThanOrEqual(-1)
    expect(brief.composite).toBeLessThanOrEqual(1)
  })

  it('composite signal ignores empty/errored sources', async () => {
    const deps: FetcherDeps = {
      reddit: vi.fn(async () => ok('reddit', 0.8, 5)),
      hackernews: vi.fn(async () => ({
        source: 'hackernews',
        snippets: [],
        aggregateSignal: 0,
        fetchedAt: Date.now(),
        error: 'no hits',
      })),
      polymarket: vi.fn(async () => ({
        source: 'polymarket',
        snippets: [],
        aggregateSignal: 0,
        fetchedAt: Date.now(),
        error: 'down',
      })),
      youtube: vi.fn(async () => ({
        source: 'youtube',
        snippets: [],
        aggregateSignal: 0,
        fetchedAt: Date.now(),
        error: 'no yt-dlp',
      })),
    }

    const brief = await gatherSentiment('BTC', {}, deps)
    // Only reddit had snippets — composite should be Reddit's signal
    expect(brief.composite).toBeCloseTo(0.8, 1)
  })

  it('returns composite=0 when every source is empty', async () => {
    const empty = (source: SentimentSourceName): SourceResult => ({
      source, snippets: [], aggregateSignal: 0, fetchedAt: Date.now(),
    })
    const deps: FetcherDeps = {
      reddit: vi.fn(async () => empty('reddit')),
      hackernews: vi.fn(async () => empty('hackernews')),
      polymarket: vi.fn(async () => empty('polymarket')),
      youtube: vi.fn(async () => empty('youtube')),
    }
    const brief = await gatherSentiment('UNKNOWN', {}, deps)
    expect(brief.composite).toBe(0)
  })
})
