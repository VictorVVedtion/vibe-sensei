/**
 * Tests for src/services/sentiment/youtubeFetcher.ts
 * Covers graceful absence, JSON parsing, sorting, error path.
 */

import { describe, it, expect, vi } from 'vitest'
import { fetchYouTube, type YtDlpRunner } from '../youtubeFetcher.js'

function makeRunner(opts: {
  available?: boolean
  output?: string
  shouldThrow?: boolean
}): YtDlpRunner {
  return {
    isAvailable: vi.fn(async () => opts.available ?? true),
    run: vi.fn(async () => {
      if (opts.shouldThrow) throw new Error('boom')
      return opts.output ?? ''
    }),
  }
}

describe('fetchYouTube', () => {
  it('returns empty with helpful error when yt-dlp is missing', async () => {
    const runner = makeRunner({ available: false })
    const result = await fetchYouTube('BTC', { runner })
    expect(result.snippets).toEqual([])
    expect(result.error).toContain('yt-dlp not installed')
  })

  it('parses NDJSON output from yt-dlp into snippets', async () => {
    const ndjson = [
      JSON.stringify({
        id: 'abc',
        title: 'BTC technical analysis',
        webpage_url: 'https://youtube.com/watch?v=abc',
        view_count: 100_000,
        upload_date: '20260101',
        description: 'Long form analysis of BTC trends',
      }),
      JSON.stringify({
        id: 'def',
        title: 'Bitcoin macro outlook',
        webpage_url: 'https://youtube.com/watch?v=def',
        view_count: 50_000,
        upload_date: '20260201',
      }),
    ].join('\n')

    const runner = makeRunner({ output: ndjson })
    const result = await fetchYouTube('BTC', { runner })

    expect(result.snippets).toHaveLength(2)
    expect(result.snippets[0]!.title).toBe('BTC technical analysis')
    expect(result.snippets[0]!.score).toBe(100_000) // sorted by views desc
    expect(result.snippets[0]!.url).toContain('youtube.com')
    expect(result.aggregateSignal).toBeGreaterThan(0)
  })

  it('skips malformed lines without crashing', async () => {
    const ndjson = [
      'not json',
      JSON.stringify({
        title: 'OK',
        webpage_url: 'https://youtube.com/x',
        view_count: 1,
      }),
      '{ broken',
    ].join('\n')

    const runner = makeRunner({ output: ndjson })
    const result = await fetchYouTube('BTC', { runner })
    expect(result.snippets).toHaveLength(1)
    expect(result.snippets[0]!.title).toBe('OK')
  })

  it('returns empty with error when yt-dlp throws', async () => {
    const runner = makeRunner({ shouldThrow: true })
    const result = await fetchYouTube('BTC', { runner })
    expect(result.snippets).toEqual([])
    expect(result.error).toBe('boom')
  })

  it('caps results at 5 videos', async () => {
    const lines = Array.from({ length: 10 }, (_, i) =>
      JSON.stringify({
        id: `v${i}`,
        title: `vid ${i}`,
        webpage_url: `https://youtube.com/v${i}`,
        view_count: 1000 - i,
      }),
    ).join('\n')

    const runner = makeRunner({ output: lines })
    const result = await fetchYouTube('BTC', { runner })
    expect(result.snippets.length).toBeLessThanOrEqual(5)
  })
})
