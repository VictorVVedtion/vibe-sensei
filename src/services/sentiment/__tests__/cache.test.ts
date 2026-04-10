/**
 * Tests for src/services/sentiment/cache.ts
 * Covers TTL expiry, brief plain-text accessor, and clear behavior.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearSentimentCache,
  getBriefPlainText,
  getCachedBrief,
  getCachedSource,
  setCachedBrief,
  setCachedSource,
} from '../cache.js'
import type { SentimentBrief, SourceResult } from '../types.js'

function makeSourceResult(): SourceResult {
  return {
    source: 'reddit',
    snippets: [],
    aggregateSignal: 0.4,
    fetchedAt: Date.now(),
  }
}

function makeBrief(symbol = 'BTC'): SentimentBrief {
  return {
    symbol,
    lookbackDays: 30,
    sources: [makeSourceResult()],
    composite: 0.4,
    synthesizedAt: Date.now(),
    narrative: 'Reddit is leaning bullish.',
    plainText: 'Reddit is leaning bullish.',
  }
}

describe('sentiment cache', () => {
  beforeEach(() => {
    clearSentimentCache()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    clearSentimentCache()
  })

  it('stores and retrieves a SourceResult by symbol+source', () => {
    setCachedSource('btc', makeSourceResult())
    const out = getCachedSource('BTC', 'reddit')
    expect(out).toBeDefined()
    expect(out?.aggregateSignal).toBe(0.4)
  })

  it('normalizes symbol case so btc and BTC share an entry', () => {
    setCachedSource('btc', makeSourceResult())
    expect(getCachedSource('BTC', 'reddit')).toBeDefined()
    expect(getCachedSource('Btc', 'reddit')).toBeDefined()
  })

  it('normalizes pair suffix so BTC/USDT and BTC share an entry', () => {
    // Regression: PreTradeGateTool's debate-stance injector reads with
    // (symbol.split('/')[0]).toUpperCase(), so the cache write side must
    // match — otherwise /pulse BTC/USDT stores under BTC/USDT and the
    // subsequent debate lookup on BTC/USDT (which strips to BTC) misses.
    setCachedBrief('BTC/USDT', makeBrief('BTC/USDT'))
    expect(getCachedBrief('BTC')).toBeDefined()
    expect(getBriefPlainText('BTC')).toBe('Reddit is leaning bullish.')
  })

  it('normalizes pair suffix on source cache too', () => {
    setCachedSource('eth/usdt', makeSourceResult())
    expect(getCachedSource('ETH', 'reddit')).toBeDefined()
    expect(getCachedSource('eth', 'reddit')).toBeDefined()
  })

  it('returns undefined after the TTL expires', () => {
    setCachedSource('BTC', makeSourceResult(), 1000)
    expect(getCachedSource('BTC', 'reddit')).toBeDefined()
    vi.advanceTimersByTime(1001)
    expect(getCachedSource('BTC', 'reddit')).toBeUndefined()
  })

  it('stores and retrieves a full brief', () => {
    setCachedBrief('ETH', makeBrief('ETH'))
    const out = getCachedBrief('eth')
    expect(out).toBeDefined()
    expect(out?.symbol).toBe('ETH')
  })

  it('exposes plain-text via getBriefPlainText for debate injection', () => {
    setCachedBrief('SOL', makeBrief('SOL'))
    expect(getBriefPlainText('SOL')).toBe('Reddit is leaning bullish.')
  })

  it('returns null from getBriefPlainText when no fresh brief exists', () => {
    expect(getBriefPlainText('NEVER_CACHED')).toBeNull()
  })

  it('expires briefs independently of source results', () => {
    setCachedBrief('BTC', makeBrief('BTC'), 500)
    setCachedSource('BTC', makeSourceResult(), 5000)
    vi.advanceTimersByTime(600)
    expect(getCachedBrief('BTC')).toBeUndefined()
    expect(getCachedSource('BTC', 'reddit')).toBeDefined()
  })

  it('clearSentimentCache wipes both maps', () => {
    setCachedBrief('BTC', makeBrief())
    setCachedSource('BTC', makeSourceResult())
    clearSentimentCache()
    expect(getCachedBrief('BTC')).toBeUndefined()
    expect(getCachedSource('BTC', 'reddit')).toBeUndefined()
  })
})
