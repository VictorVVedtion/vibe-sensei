/**
 * Sentiment service type definitions.
 * Used by /pulse — pulls 30-day social/market signals about a trading symbol
 * from Reddit, Hacker News, Polymarket, and YouTube transcripts.
 */

export type SentimentSourceName = 'reddit' | 'hackernews' | 'polymarket' | 'youtube'

/**
 * A single piece of evidence pulled from one source.
 * Score is source-native (Reddit upvotes, HN points, Polymarket volume, etc.).
 */
export interface SentimentSnippet {
  source: SentimentSourceName
  title: string
  url: string
  /** Source-native engagement score (upvotes, points, volume). */
  score: number
  /** Unix ms when this item was created upstream. */
  ts: number
  /** Short excerpt — first 280 chars of the body / question / transcript. */
  snippet: string
  /** Optional secondary engagement metric (comment count, replies). */
  engagement?: number
}

/**
 * Result of fetching one source for one symbol.
 * `aggregateSignal` is in [-1, +1]: -1 strong bearish, 0 neutral, +1 strong bullish.
 * `error` is set when the fetcher gracefully degraded — `snippets` may still be empty.
 */
export interface SourceResult {
  source: SentimentSourceName
  snippets: SentimentSnippet[]
  aggregateSignal: number
  fetchedAt: number
  error?: string
}

/**
 * Full brief returned by gatherSentiment + synthesize.
 * `narrative` is the pre-rendered Ink-friendly multi-line text in the user's master voice.
 * `plainText` is the same content stripped of formatting, used for debate stance injection.
 */
export interface SentimentBrief {
  symbol: string
  lookbackDays: number
  sources: SourceResult[]
  /** Composite signal across all sources, weighted by snippet count. [-1, +1]. */
  composite: number
  synthesizedAt: number
  narrative: string
  plainText: string
}

/** Options accepted by gatherSentiment. */
export interface GatherOptions {
  lookbackDays?: number
  /** Per-source timeout in ms. Default 8000. */
  perSourceTimeoutMs?: number
  /** Overall hard cap in ms. Default 30000. */
  overallTimeoutMs?: number
  /** Bypass the cache and force fresh fetches. */
  noCache?: boolean
  /** Restrict to a subset of sources (default: all). */
  only?: SentimentSourceName[]
}
