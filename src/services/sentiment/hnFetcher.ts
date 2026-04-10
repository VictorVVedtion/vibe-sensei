/**
 * Hacker News fetcher for /pulse.
 *
 * Uses the public Algolia HN search API (no key required, no rate limit
 * concerns at our volumes). Filters to the configurable lookback window.
 */

import type { SentimentSnippet, SourceResult } from './types.js'
import type { FetchLike } from './redditFetcher.js'

const DEFAULT_TIMEOUT_MS = 8_000
const HN_SEARCH = 'https://hn.algolia.com/api/v1/search'

interface HnHit {
  objectID?: string
  title?: string | null
  story_title?: string | null
  url?: string | null
  story_url?: string | null
  points?: number | null
  num_comments?: number | null
  created_at_i?: number | null
  story_text?: string | null
  comment_text?: string | null
}

interface HnResponse {
  hits?: HnHit[]
}

function tanhSaturating(total: number): number {
  return Math.tanh(total / 600)
}

/**
 * Build a search query that biases for ticker mentions.
 * Algolia treats space as AND; quoting forces phrase match.
 */
function buildQuery(symbol: string): string {
  // Strip the pair side, keep the base symbol
  const base = symbol.split('/')[0] ?? symbol
  return base.trim()
}

/**
 * Build the URLSearchParams for the HN Algolia search endpoint with the
 * configured lookback window applied as a numericFilters cutoff.
 */
function buildHnParams(symbol: string, lookbackDays: number): URLSearchParams {
  const cutoff = Math.floor(Date.now() / 1000) - lookbackDays * 24 * 60 * 60
  return new URLSearchParams({
    query: buildQuery(symbol),
    tags: 'story',
    numericFilters: `created_at_i>${cutoff}`,
    hitsPerPage: '20',
  })
}

/**
 * Map a single Algolia hit into a SentimentSnippet, choosing the best
 * available URL and stripping HTML from the body excerpt.
 */
function hitToSnippet(hit: HnHit): SentimentSnippet {
  const title = hit.title ?? hit.story_title ?? ''
  const url =
    hit.url
    ?? hit.story_url
    ?? (hit.objectID ? `https://news.ycombinator.com/item?id=${hit.objectID}` : '')
  const body = hit.story_text ?? hit.comment_text ?? ''
  return {
    source: 'hackernews' as const,
    title,
    url,
    score: hit.points ?? 0,
    ts: (hit.created_at_i ?? 0) * 1000,
    snippet: body.replace(/<[^>]+>/g, '').slice(0, 280),
    engagement: hit.num_comments ?? 0,
  }
}

/**
 * Extract, filter, and sort Algolia hits into the final SentimentSnippet array.
 */
function hitsToSnippets(json: HnResponse): SentimentSnippet[] {
  const hits = json.hits ?? []
  return hits
    .map(hitToSnippet)
    .filter(snippet => snippet.title && snippet.url)
    .sort((a, b) => b.score - a.score)
}

/**
 * Build a "no results" SourceResult tagged with the given error reason.
 */
function emptyHnResult(error: string): SourceResult {
  return {
    source: 'hackernews',
    snippets: [],
    aggregateSignal: 0,
    fetchedAt: Date.now(),
    error,
  }
}

/**
 * Fetch the most engaged Hacker News posts from the lookback window for `symbol`.
 * Always resolves; never throws.
 */
export async function fetchHackerNews(
  symbol: string,
  opts: {
    lookbackDays?: number
    timeoutMs?: number
    fetchImpl?: FetchLike
  } = {},
): Promise<SourceResult> {
  const fetchImpl = opts.fetchImpl ?? (globalThis.fetch as FetchLike)
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const lookbackDays = opts.lookbackDays ?? 30

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetchImpl(`${HN_SEARCH}?${buildHnParams(symbol, lookbackDays)}`, {
      signal: controller.signal,
    })
    if (!res.ok) return emptyHnResult(`hn ${res.status}`)

    const snippets = hitsToSnippets((await res.json()) as HnResponse)
    const totalScore = snippets.reduce((acc, snippet) => acc + Math.max(0, snippet.score), 0)

    return {
      source: 'hackernews',
      snippets,
      aggregateSignal: tanhSaturating(totalScore),
      fetchedAt: Date.now(),
    }
  } catch (err) {
    return emptyHnResult(err instanceof Error ? err.message : String(err))
  } finally {
    clearTimeout(timer)
  }
}
