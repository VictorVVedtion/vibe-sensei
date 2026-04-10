/**
 * Tests for src/services/sentiment/synthesize.ts
 * Covers narrative shape, archetype framing, plain-text shape, cache write.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { synthesizeBrief } from '../synthesize.js'
import { clearSentimentCache, getBriefPlainText, getCachedBrief } from '../cache.js'
import type { SentimentBrief, SentimentSnippet, SourceResult, SentimentSourceName } from '../types.js'

function makeSnippet(source: SentimentSourceName, title: string, score = 100): SentimentSnippet {
  return {
    source,
    title,
    url: `https://example.com/${title.replace(/\s/g, '-')}`,
    score,
    ts: Date.now(),
    snippet: 'body text',
  }
}

function makeSource(
  source: SentimentSourceName,
  signal: number,
  snippetCount: number,
): SourceResult {
  return {
    source,
    snippets: Array.from({ length: snippetCount }, (_, i) =>
      makeSnippet(source, `${source} post ${i}`, 100 - i),
    ),
    aggregateSignal: signal,
    fetchedAt: Date.now(),
  }
}

function makeBrief(opts: {
  symbol?: string
  composite?: number
  sources?: SourceResult[]
} = {}): SentimentBrief {
  return {
    symbol: opts.symbol ?? 'BTC',
    lookbackDays: 30,
    sources: opts.sources ?? [
      makeSource('reddit', 0.5, 4),
      makeSource('hackernews', 0.2, 2),
      makeSource('polymarket', -0.1, 3),
      makeSource('youtube', 0.3, 1),
    ],
    composite: opts.composite ?? 0.3,
    synthesizedAt: Date.now(),
    narrative: '',
    plainText: '',
  }
}

describe('synthesizeBrief', () => {
  beforeEach(() => clearSentimentCache())
  afterEach(() => clearSentimentCache())

  it('renders sections for every source', () => {
    const brief = makeBrief()
    synthesizeBrief(brief, { master: 'warren_buffett' })

    expect(brief.narrative).toContain('REDDIT')
    expect(brief.narrative).toContain('HACKER NEWS')
    expect(brief.narrative).toContain('POLYMARKET')
    expect(brief.narrative).toContain('YOUTUBE')
  })

  it('uses the assigned master name in narrative and plain-text', () => {
    const brief = makeBrief()
    synthesizeBrief(brief, { master: 'warren_buffett' })

    expect(brief.narrative).toContain('Warren Buffett')
    expect(brief.plainText).toContain('Warren Buffett')
  })

  it('includes a composite line and signal glyph', () => {
    const brief = makeBrief({ composite: 0.6 })
    synthesizeBrief(brief, { master: 'jesse_livermore' })

    expect(brief.narrative).toContain('COMPOSITE')
    // Strong bullish glyph
    expect(brief.narrative).toContain('▲▲')
  })

  it('renders the bearish closing for negative composite', () => {
    const brief = makeBrief({ composite: -0.6 })
    synthesizeBrief(brief, { master: 'warren_buffett' })

    // value_investor bearish framing
    expect(brief.narrative.toLowerCase()).toContain('crowd fear')
  })

  it('renders the bullish closing for positive composite', () => {
    const brief = makeBrief({ composite: 0.6 })
    synthesizeBrief(brief, { master: 'jesse_livermore' })

    // trend_follower bullish framing
    expect(brief.narrative.toLowerCase()).toContain('momentum')
  })

  it('renders the mixed/quiet framing for ~zero composite with few snippets', () => {
    const brief = makeBrief({
      composite: 0.0,
      sources: [
        makeSource('reddit', 0, 0),
        makeSource('hackernews', 0, 0),
        makeSource('polymarket', 0, 0),
        makeSource('youtube', 0, 0),
      ],
    })
    synthesizeBrief(brief, { master: 'nassim_taleb' })

    // philosopher quiet/mixed framing
    expect(brief.narrative.toLowerCase()).toContain('quiet')
  })

  it('shows error reason when a source returned no snippets', () => {
    const brief = makeBrief({
      sources: [
        makeSource('reddit', 0.5, 3),
        {
          source: 'youtube',
          snippets: [],
          aggregateSignal: 0,
          fetchedAt: Date.now(),
          error: 'yt-dlp not installed',
        },
        makeSource('hackernews', 0.2, 2),
        makeSource('polymarket', 0.1, 1),
      ],
    })
    synthesizeBrief(brief, { master: 'jim_simons' })

    expect(brief.narrative).toContain('yt-dlp not installed')
  })

  it('plainText is a single-line debate-friendly summary', () => {
    const brief = makeBrief({ composite: 0.4 })
    synthesizeBrief(brief, { master: 'jesse_livermore' })

    expect(brief.plainText).toBeTruthy()
    expect(brief.plainText.length).toBeLessThan(400)
    expect(brief.plainText).toContain('Sentiment')
    expect(brief.plainText).toContain('30d')
  })

  it('caches the brief so getBriefPlainText returns it', () => {
    const brief = makeBrief()
    synthesizeBrief(brief, { master: 'warren_buffett' })

    expect(getCachedBrief(brief.symbol)).toBeDefined()
    expect(getBriefPlainText(brief.symbol)).toBe(brief.plainText)
  })

  it('handles a brief where every source is empty', () => {
    const brief = makeBrief({
      sources: [
        makeSource('reddit', 0, 0),
        makeSource('hackernews', 0, 0),
        makeSource('polymarket', 0, 0),
        makeSource('youtube', 0, 0),
      ],
      composite: 0,
    })
    synthesizeBrief(brief, { master: 'warren_buffett' })

    expect(brief.narrative).toContain('Warren Buffett')
    expect(brief.plainText).toContain('no recent signal')
  })
})
