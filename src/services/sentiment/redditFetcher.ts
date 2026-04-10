/**
 * Reddit fetcher for /pulse.
 *
 * Hits Reddit's public JSON endpoints (no API key required) for trader-relevant
 * subreddits. Picks subreddits via a ticker→sub map with sensible crypto/stock
 * heuristic fallbacks for unknown symbols.
 *
 * No new dependency: uses the global fetch (Bun + Node 18+) with an
 * AbortController for the per-source timeout.
 */

import type { SentimentSnippet, SourceResult } from './types.js'

const USER_AGENT = 'vibe-sensei/0.2 (research)'
const DEFAULT_TIMEOUT_MS = 8_000
const PER_SUB_LIMIT = 12

/**
 * Subreddit map keyed by lowercase symbol.
 * Crypto: communities that actually discuss the asset.
 * Stocks: r/wallstreetbets and r/stocks dominate; r/options for derivatives.
 */
const TICKER_SUBREDDITS: Record<string, string[]> = {
  // Crypto majors
  btc: ['Bitcoin', 'CryptoMarkets', 'CryptoCurrency'],
  bitcoin: ['Bitcoin', 'CryptoMarkets', 'CryptoCurrency'],
  eth: ['ethereum', 'ethfinance', 'CryptoCurrency'],
  ethereum: ['ethereum', 'ethfinance', 'CryptoCurrency'],
  sol: ['solana', 'CryptoCurrency'],
  solana: ['solana', 'CryptoCurrency'],
  doge: ['dogecoin', 'CryptoCurrency'],
  xrp: ['Ripple', 'XRP', 'CryptoCurrency'],

  // Stocks / ETFs
  spy: ['wallstreetbets', 'stocks', 'options'],
  qqq: ['wallstreetbets', 'stocks', 'options'],
  tsla: ['wallstreetbets', 'teslainvestorsclub', 'stocks'],
  nvda: ['wallstreetbets', 'stocks', 'investing'],
  aapl: ['wallstreetbets', 'stocks', 'investing'],
  msft: ['wallstreetbets', 'stocks', 'investing'],
  meta: ['wallstreetbets', 'stocks'],
  amzn: ['wallstreetbets', 'stocks'],
  gme: ['wallstreetbets', 'Superstonk'],
  amc: ['wallstreetbets', 'amcstock'],
}

/**
 * Strip pair suffix and slashes — "BTC/USDT" → "btc", "AAPL" → "aapl".
 */
export function normalizeTicker(symbol: string): string {
  const base = symbol.split('/')[0] ?? symbol
  return base.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
}

/**
 * Pick subreddits for a symbol. Falls back to broad crypto subs for crypto-shaped
 * tickers and broad stock subs for letter-only tickers.
 */
export function pickSubreddits(symbol: string): string[] {
  const norm = normalizeTicker(symbol)
  if (TICKER_SUBREDDITS[norm]) return TICKER_SUBREDDITS[norm]!

  // Crypto heuristic: pair contained USDT/USDC/BTC/ETH/USD denominators
  const looksCrypto = /(usdt|usdc|btc|eth|usd)$/i.test(symbol.replace(/[^a-zA-Z]/g, ''))
  if (looksCrypto) return ['CryptoCurrency', 'CryptoMarkets']

  // Stock heuristic: 1-5 uppercase letters
  if (/^[a-z]{1,5}$/.test(norm)) return ['wallstreetbets', 'stocks', 'investing']

  // Catch-all
  return ['CryptoCurrency', 'wallstreetbets']
}

// ── Reddit JSON shape (minimal, only fields we read) ──────────────────────

interface RedditChild {
  data: {
    title?: string
    selftext?: string
    permalink?: string
    score?: number
    num_comments?: number
    created_utc?: number
  }
}

interface RedditSearchResponse {
  data?: {
    children?: RedditChild[]
  }
}

/**
 * Inject a custom fetch for testing. The default uses globalThis.fetch
 * (Bun and Node 18+ both expose it).
 */
export type FetchLike = (
  url: string,
  init?: RequestInit,
) => Promise<Response>

/**
 * Map an upvote-weighted score over the snippets into a [-1, +1] aggregate.
 *
 * No NLP. The signal is derived purely from engagement intensity:
 *   - Lots of high-score posts → +1 (treated as bullish-ish "buzz")
 *   - Few/low-score posts     → 0  (no signal)
 *
 * This is intentionally crude for v1. Real polarity scoring lives in v2 once
 * the framework can call an LLM here. For now we surface SIGNAL STRENGTH, not
 * direction — and the synthesizer adds an explicit "this is buzz, not polarity"
 * caveat.
 */
function computeAggregateSignal(snippets: SentimentSnippet[]): number {
  if (snippets.length === 0) return 0
  const totalScore = snippets.reduce((acc, snippet) => acc + Math.max(0, snippet.score), 0)
  // Saturating curve: 0 → 0, 100 → ~0.5, 1000 → ~0.9
  return Math.tanh(totalScore / 800)
}

/**
 * Build the Reddit search URL for a single subreddit.
 */
function buildSubredditUrl(sub: string, query: string): string {
  return `https://www.reddit.com/r/${sub}/search.json?q=${encodeURIComponent(query)}&restrict_sr=on&sort=top&t=month&limit=${PER_SUB_LIMIT}`
}

/**
 * Fetch one subreddit's top posts and convert to SentimentSnippets.
 * Throws on HTTP failure so the caller's allSettled can capture it.
 */
async function fetchOneSubreddit(
  sub: string,
  query: string,
  fetchImpl: FetchLike,
  signal: AbortSignal,
): Promise<SentimentSnippet[]> {
  const res = await fetchImpl(buildSubredditUrl(sub, query), {
    signal,
    headers: { 'User-Agent': USER_AGENT },
  })
  if (!res.ok) throw new Error(`reddit ${sub} ${res.status}`)
  const json = (await res.json()) as RedditSearchResponse
  const children = json.data?.children ?? []
  return children
    .map(child => child.data)
    .filter(post => typeof post.title === 'string' && typeof post.permalink === 'string')
    .map<SentimentSnippet>(post => ({
      source: 'reddit',
      title: post.title!,
      url: `https://www.reddit.com${post.permalink}`,
      score: post.score ?? 0,
      ts: (post.created_utc ?? 0) * 1000,
      snippet: (post.selftext ?? '').slice(0, 280),
      engagement: post.num_comments ?? 0,
    }))
}

/**
 * Sort snippets by score desc, drop duplicates by URL, cap at 30.
 */
function dedupeAndCap(snippets: SentimentSnippet[]): SentimentSnippet[] {
  const seen = new Set<string>()
  const deduped: SentimentSnippet[] = []
  for (const snippet of snippets.sort((a, b) => b.score - a.score)) {
    if (seen.has(snippet.url)) continue
    seen.add(snippet.url)
    deduped.push(snippet)
    if (deduped.length >= 30) break
  }
  return deduped
}

/**
 * Collapse Promise.allSettled results into a flat snippet array plus the
 * first encountered error message (if any). Lets the caller surface a
 * rejection reason without coupling to the SettledResult shape.
 */
function collectSubredditResults(
  perSubResults: PromiseSettledResult<SentimentSnippet[]>[],
): { snippets: SentimentSnippet[]; firstError?: string } {
  const snippets: SentimentSnippet[] = []
  let firstError: string | undefined
  for (const result of perSubResults) {
    if (result.status === 'fulfilled') {
      snippets.push(...result.value)
    } else if (!firstError) {
      firstError = result.reason instanceof Error ? result.reason.message : String(result.reason)
    }
  }
  return firstError ? { snippets, firstError } : { snippets }
}

/**
 * Fetch Reddit posts for a symbol across its mapped subreddits.
 * Always resolves — never throws — and degrades gracefully on per-sub failures.
 */
export async function fetchReddit(
  symbol: string,
  opts: {
    timeoutMs?: number
    fetchImpl?: FetchLike
  } = {},
): Promise<SourceResult> {
  const fetchImpl = opts.fetchImpl ?? (globalThis.fetch as FetchLike)
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const subs = pickSubreddits(symbol)
  const query = normalizeTicker(symbol)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const perSubResults = await Promise.allSettled(
      subs.map(sub => fetchOneSubreddit(sub, query, fetchImpl, controller.signal)),
    )
    const { snippets, firstError } = collectSubredditResults(perSubResults)
    const deduped = dedupeAndCap(snippets)

    return {
      source: 'reddit',
      snippets: deduped,
      aggregateSignal: computeAggregateSignal(deduped),
      fetchedAt: Date.now(),
      ...(deduped.length === 0 && firstError ? { error: firstError } : {}),
    }
  } catch (err) {
    return {
      source: 'reddit',
      snippets: [],
      aggregateSignal: 0,
      fetchedAt: Date.now(),
      error: err instanceof Error ? err.message : String(err),
    }
  } finally {
    clearTimeout(timer)
  }
}
