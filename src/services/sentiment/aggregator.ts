/**
 * Sentiment aggregator — fan out to all 4 fetchers in parallel, merge into a
 * SentimentBrief, and populate the cache.
 *
 * Latency budget: 30 seconds overall (last30days takes 2-8 minutes; we'd
 * never run that inside a debate flow). Each source has its own per-source
 * timeout (default 8s) and we wrap the whole thing in a hard overall cap so
 * one slow fetcher can't sink the brief.
 *
 * Cache strategy: per-source results live for 15 minutes. A re-call within
 * that window short-circuits to the cached entries — only stale sources
 * re-fetch. The fully-synthesized brief is also cached so the debate-stance
 * injector can grab a plain-text summary without re-running anything.
 */

import {
  getCachedBrief,
  getCachedSource,
  setCachedBrief,
  setCachedSource,
} from './cache.js'
import { fetchHackerNews } from './hnFetcher.js'
import { fetchPolymarketSentiment } from './polymarketSentiment.js'
import { fetchReddit } from './redditFetcher.js'
import { fetchYouTube } from './youtubeFetcher.js'
import type {
  GatherOptions,
  SentimentBrief,
  SentimentSourceName,
  SourceResult,
} from './types.js'

const DEFAULT_PER_SOURCE_TIMEOUT_MS = 8_000
const DEFAULT_OVERALL_TIMEOUT_MS = 30_000

const ALL_SOURCES: SentimentSourceName[] = [
  'reddit',
  'hackernews',
  'polymarket',
  'youtube',
]

/**
 * Fetcher dependency surface. Lets the aggregator be tested without touching
 * real network or yt-dlp. In production, the default impls are wired in
 * gatherSentiment(); tests pass mocks.
 */
export interface FetcherDeps {
  reddit?: (symbol: string, opts: { timeoutMs: number }) => Promise<SourceResult>
  hackernews?: (symbol: string, opts: { timeoutMs: number; lookbackDays: number }) => Promise<SourceResult>
  polymarket?: (symbol: string, opts: { timeoutMs: number }) => Promise<SourceResult>
  youtube?: (symbol: string, opts: { timeoutMs: number }) => Promise<SourceResult>
}

/**
 * Wrap a fetch promise in a hard timeout so one slow source can't pin the
 * Promise.all. Returns an empty SourceResult on timeout — never throws.
 */
function withTimeout(
  source: SentimentSourceName,
  fetchPromise: Promise<SourceResult>,
  timeoutMs: number,
): Promise<SourceResult> {
  return new Promise(resolve => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      resolve({
        source,
        snippets: [],
        aggregateSignal: 0,
        fetchedAt: Date.now(),
        error: `${source} timeout`,
      })
    }, timeoutMs)

    fetchPromise.then(
      result => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(result)
      },
      err => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve({
          source,
          snippets: [],
          aggregateSignal: 0,
          fetchedAt: Date.now(),
          error: err instanceof Error ? err.message : String(err),
        })
      },
    )
  })
}

/**
 * Compose the per-source results into a single composite signal in [-1, +1].
 *
 * Weighting:
 *   - sources with snippets vote (count weight = log(1 + snippets.length))
 *   - sources that errored or returned 0 snippets are ignored
 *
 * This means a single high-volume Polymarket signal can't drown out 30 Reddit
 * threads, and a Reddit-only fetch with no other sources still produces a
 * meaningful number.
 */
function composeSignal(results: SourceResult[]): number {
  let weightedSum = 0
  let totalWeight = 0
  for (const result of results) {
    if (result.snippets.length === 0) continue
    const weight = Math.log(1 + result.snippets.length)
    weightedSum += result.aggregateSignal * weight
    totalWeight += weight
  }
  if (totalWeight === 0) return 0
  return Math.max(-1, Math.min(1, weightedSum / totalWeight))
}

/**
 * Build a default fetcher set bound to the live PolymarketClient.
 * Lazy-loaded so unit tests that pass their own deps never instantiate the
 * real client.
 */
async function defaultFetchers(): Promise<Required<FetcherDeps>> {
  const { PolymarketClient } = await import('../exchange/polymarket-client.js')
  const polymarketClient = new PolymarketClient()

  return {
    reddit: (symbol, opts) => fetchReddit(symbol, { timeoutMs: opts.timeoutMs }),
    hackernews: (symbol, opts) =>
      fetchHackerNews(symbol, { timeoutMs: opts.timeoutMs, lookbackDays: opts.lookbackDays }),
    polymarket: (symbol, opts) =>
      fetchPolymarketSentiment(symbol, { client: polymarketClient, timeoutMs: opts.timeoutMs }),
    youtube: (symbol, opts) => fetchYouTube(symbol, { timeoutMs: opts.timeoutMs }),
  }
}

/**
 * Per-source dispatch context shared across the routing helpers below.
 * Bundles the symbol, options, and the resolved fetcher set so we can pass a
 * single value through `routeFetcher` instead of a long argument list.
 */
interface DispatchContext {
  symbol: string
  lookbackDays: number
  perSourceTimeoutMs: number
  fetchers: FetcherDeps
}

/**
 * Route a single source to its corresponding fetcher in the FetcherDeps map.
 * Returns an "fetcher not configured" SourceResult if the entry is missing,
 * which keeps the aggregator's call site straight-line.
 */
function routeFetcher(
  source: SentimentSourceName,
  ctx: DispatchContext,
): Promise<SourceResult> {
  const { symbol, lookbackDays, perSourceTimeoutMs, fetchers } = ctx
  switch (source) {
    case 'reddit':
      return fetchers.reddit
        ? fetchers.reddit(symbol, { timeoutMs: perSourceTimeoutMs })
        : Promise.resolve(emptyResult('reddit', 'fetcher not configured'))
    case 'hackernews':
      return fetchers.hackernews
        ? fetchers.hackernews(symbol, { timeoutMs: perSourceTimeoutMs, lookbackDays })
        : Promise.resolve(emptyResult('hackernews', 'fetcher not configured'))
    case 'polymarket':
      return fetchers.polymarket
        ? fetchers.polymarket(symbol, { timeoutMs: perSourceTimeoutMs })
        : Promise.resolve(emptyResult('polymarket', 'fetcher not configured'))
    case 'youtube':
      return fetchers.youtube
        ? fetchers.youtube(symbol, { timeoutMs: perSourceTimeoutMs })
        : Promise.resolve(emptyResult('youtube', 'fetcher not configured'))
  }
}

/**
 * Fetch one source, honoring the cache first and writing back on success.
 * Wraps the underlying fetcher in a per-source timeout so a slow source can
 * never pin the parallel fan-out.
 */
function fetchOneSource(
  source: SentimentSourceName,
  ctx: DispatchContext,
  noCache: boolean,
): Promise<SourceResult> {
  if (!noCache) {
    const cached = getCachedSource(ctx.symbol, source)
    if (cached) return Promise.resolve(cached)
  }
  const fetchPromise = routeFetcher(source, ctx)
  return withTimeout(source, fetchPromise, ctx.perSourceTimeoutMs).then(result => {
    if (result.snippets.length > 0) setCachedSource(ctx.symbol, result)
    return result
  })
}

/**
 * Race the parallel fan-out against the overall timeout guard. Sources that
 * haven't finished by then are reported as timed out via withTimeout above.
 */
function raceWithOverallTimeout(
  requested: SentimentSourceName[],
  ctx: DispatchContext,
  noCache: boolean,
  overallTimeoutMs: number,
): Promise<SourceResult[]> {
  const fanout = Promise.all(requested.map(source => fetchOneSource(source, ctx, noCache)))
  const overallGuard = new Promise<SourceResult[]>(resolve => {
    setTimeout(() => {
      resolve(requested.map(source => emptyResult(source, 'overall timeout')))
    }, overallTimeoutMs)
  })
  return Promise.race([fanout, overallGuard])
}

/**
 * Fan out to all (or selected) fetchers in parallel, respect cache, and
 * compose into a SentimentBrief. The narrative is left empty here — the
 * synthesizer in synthesize.ts populates it. Aggregator is purely about
 * orchestration and caching.
 */
export async function gatherSentiment(
  symbol: string,
  opts: GatherOptions = {},
  deps?: FetcherDeps,
): Promise<SentimentBrief> {
  const lookbackDays = opts.lookbackDays ?? 30
  const perSourceTimeoutMs = opts.perSourceTimeoutMs ?? DEFAULT_PER_SOURCE_TIMEOUT_MS
  const overallTimeoutMs = opts.overallTimeoutMs ?? DEFAULT_OVERALL_TIMEOUT_MS
  const requested = opts.only && opts.only.length > 0 ? opts.only : ALL_SOURCES

  // Reuse cached brief when nothing has been requested explicitly and the
  // brief is fresh — this is the hot path for the debate injection callsite.
  if (!opts.noCache && !opts.only) {
    const cachedBrief = getCachedBrief(symbol)
    if (cachedBrief) return cachedBrief
  }

  const fetchers = deps ?? (await defaultFetchers())
  const ctx: DispatchContext = { symbol, lookbackDays, perSourceTimeoutMs, fetchers }

  const results = await raceWithOverallTimeout(requested, ctx, opts.noCache ?? false, overallTimeoutMs)
  const composite = composeSignal(results)

  const brief: SentimentBrief = {
    symbol,
    lookbackDays,
    sources: results,
    composite,
    synthesizedAt: Date.now(),
    narrative: '', // synthesizer will populate
    plainText: '', // synthesizer will populate
  }

  setCachedBrief(symbol, brief)
  return brief
}

function emptyResult(source: SentimentSourceName, error: string): SourceResult {
  return {
    source,
    snippets: [],
    aggregateSignal: 0,
    fetchedAt: Date.now(),
    error,
  }
}
