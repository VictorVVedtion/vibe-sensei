/**
 * News Poller — position-aware news alerts via CryptoPanic API.
 *
 * Polls every 5 minutes for hot crypto news relevant to the user's
 * current positions. Falls back to BTC,ETH when no positions are open.
 * Emits news_alert bridge messages for the desktop renderer.
 *
 * If CRYPTOPANIC_TOKEN is not set, falls back to CoinDesk RSS.
 * If both sources fail, the poller silently skips — never crashes.
 *
 * Rate limit: max 1 news_alert emission per 5-minute poll cycle.
 */

import { getConnectedExchange } from '../exchange/singleton.js'
import { isDesktopMode, emitToDesktop } from '../desktop/bridge.js'

// ── Constants ──────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes
const NEWS_MAX_AGE_MS = 60 * 60 * 1000 // 1 hour
const DEFAULT_SYMBOLS = ['BTC', 'ETH']
const CRYPTOPANIC_BASE = 'https://cryptopanic.com/api/v1/posts/'
const COINDESK_RSS = 'https://www.coindesk.com/arc/outboundfeeds/rss/'
const FETCH_TIMEOUT_MS = 15_000

// ── Module State ───────────────────────────────────────────────────────────

let timer: ReturnType<typeof setInterval> | null = null
let polling = false
let lastEmittedId: string | null = null
let tokenWarningLogged = false

// ── Types ──────────────────────────────────────────────────────────────────

interface CryptoPanicPost {
  id: number
  title: string
  published_at: string
  source: { title: string }
  currencies?: Array<{ code: string }>
  votes: {
    positive: number
    negative: number
    important: number
    liked: number
    disliked: number
  }
}

interface CryptoPanicResponse {
  results: CryptoPanicPost[]
}

interface NewsItem {
  id: string
  headline: string
  source: string
  sentiment: 'bullish' | 'bearish' | 'neutral'
  relevantSymbols: string[]
  timestamp: number
}

// ── Symbol Extraction ──────────────────────────────────────────────────────

/**
 * Extract base currency symbols from open positions.
 * Returns DEFAULT_SYMBOLS when no positions are found.
 */
async function resolveSymbols(): Promise<string[]> {
  try {
    const exchange = await getConnectedExchange()
    const positions = await exchange.getPositions()
    if (positions.length === 0) return DEFAULT_SYMBOLS

    const symbols = new Set<string>()
    for (const pos of positions) {
      // Extract base currency from pair (e.g. "BTC/USDT" -> "BTC")
      const base = pos.symbol.split('/')[0]
      if (base) symbols.add(base)
    }
    return symbols.size > 0 ? [...symbols] : DEFAULT_SYMBOLS
  } catch {
    return DEFAULT_SYMBOLS
  }
}

// ── CryptoPanic Fetch ──────────────────────────────────────────────────────

/**
 * Derive sentiment from CryptoPanic vote data.
 * Positive votes dominate -> bullish, negative dominate -> bearish, else neutral.
 */
function deriveSentiment(votes: CryptoPanicPost['votes']): 'bullish' | 'bearish' | 'neutral' {
  const bullScore = votes.positive + votes.liked
  const bearScore = votes.negative + votes.disliked
  if (bullScore > bearScore && bullScore >= 2) return 'bullish'
  if (bearScore > bullScore && bearScore >= 2) return 'bearish'
  return 'neutral'
}

/**
 * Fetch hot news from CryptoPanic API for the given currency symbols.
 * Returns an empty array on any failure.
 */
async function fetchCryptoPanic(token: string, symbols: string[]): Promise<NewsItem[]> {
  const currencies = symbols.join(',')
  const url = `${CRYPTOPANIC_BASE}?auth_token=${token}&currencies=${currencies}&filter=hot`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) return []

    const data = (await response.json()) as CryptoPanicResponse
    if (!data.results || !Array.isArray(data.results)) return []

    const now = Date.now()
    const items: NewsItem[] = []

    for (const post of data.results) {
      const publishedAt = new Date(post.published_at).getTime()
      if (isNaN(publishedAt)) continue
      if (now - publishedAt > NEWS_MAX_AGE_MS) continue

      const postSymbols = post.currencies
        ? post.currencies.map(c => c.code)
        : symbols

      items.push({
        id: `cp-${post.id}`,
        headline: post.title,
        source: post.source?.title ?? 'CryptoPanic',
        sentiment: deriveSentiment(post.votes),
        relevantSymbols: postSymbols,
        timestamp: publishedAt,
      })
    }

    return items
  } catch {
    return []
  } finally {
    clearTimeout(timeout)
  }
}

// ── CoinDesk RSS Fallback ──────────────────────────────────────────────────

/**
 * Parse a minimal RSS feed for news items. Extracts title, pubDate, link.
 * Only returns items less than 1 hour old. Best-effort XML parsing.
 */
function parseRssItems(xml: string, symbols: string[]): NewsItem[] {
  const items: NewsItem[] = []
  const now = Date.now()

  // Simple regex-based RSS item extraction (no XML parser dependency)
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  let match: RegExpExecArray | null

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1]!
    const title = block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1]
      ?? block.match(/<title>(.*?)<\/title>/)?.[1]
    const pubDate = block.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]

    if (!title || !pubDate) continue

    const publishedAt = new Date(pubDate).getTime()
    if (isNaN(publishedAt)) continue
    if (now - publishedAt > NEWS_MAX_AGE_MS) continue

    // Check if any tracked symbol appears in the title
    const titleUpper = title.toUpperCase()
    const matched = symbols.filter(s => titleUpper.includes(s.toUpperCase()))
    if (matched.length === 0) continue

    // Generate deterministic ID from title hash
    let hash = 0
    for (let i = 0; i < title.length; i++) {
      hash = ((hash << 5) - hash + title.charCodeAt(i)) | 0
    }

    items.push({
      id: `cd-${Math.abs(hash)}`,
      headline: title,
      source: 'CoinDesk',
      sentiment: 'neutral', // RSS has no vote data
      relevantSymbols: matched,
      timestamp: publishedAt,
    })
  }

  return items
}

/**
 * Fetch news from CoinDesk RSS feed as a fallback.
 * Returns an empty array on any failure.
 */
async function fetchCoinDeskRss(symbols: string[]): Promise<NewsItem[]> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(COINDESK_RSS, { signal: controller.signal })
    if (!response.ok) return []

    const xml = await response.text()
    return parseRssItems(xml, symbols)
  } catch {
    return []
  } finally {
    clearTimeout(timeout)
  }
}

// ── Poll Logic ─────────────────────────────────────────────────────────────

async function poll(): Promise<void> {
  if (polling) return
  polling = true

  try {
    const symbols = await resolveSymbols()
    const token = process.env.CRYPTOPANIC_TOKEN

    let items: NewsItem[]

    if (token) {
      items = await fetchCryptoPanic(token, symbols)
      // Fallback to CoinDesk if CryptoPanic returned nothing
      if (items.length === 0) {
        items = await fetchCoinDeskRss(symbols)
      }
    } else {
      items = await fetchCoinDeskRss(symbols)
    }

    if (items.length === 0) return

    // Sort by recency, pick the most recent
    items.sort((a, b) => b.timestamp - a.timestamp)
    const top = items[0]!

    // Rate limit: don't re-emit the same news item
    if (top.id === lastEmittedId) return
    lastEmittedId = top.id

    emitToDesktop('news_alert', {
      id: top.id,
      headline: top.headline,
      source: top.source,
      sentiment: top.sentiment,
      relevantSymbols: top.relevantSymbols,
      timestamp: top.timestamp,
    })
  } catch {
    // Silent degradation — poll failures never propagate
  } finally {
    polling = false
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/** Start the news poller. Only activates in desktop mode. Safe to call multiple times. */
export function startNewsPoller(): void {
  if (timer !== null) return
  if (!isDesktopMode()) return

  const token = process.env.CRYPTOPANIC_TOKEN
  if (!token && !tokenWarningLogged) {
    tokenWarningLogged = true
    console.error('[NewsPoller] No CRYPTOPANIC_TOKEN set — using CoinDesk RSS fallback')
  }

  // Fire an initial poll immediately (non-blocking)
  void poll()

  timer = setInterval(() => {
    void poll()
  }, POLL_INTERVAL_MS)
}

/** Stop the news poller. Clears the interval but preserves last-emitted state. */
export function stopNewsPoller(): void {
  if (timer !== null) {
    clearInterval(timer)
    timer = null
  }
}

/** Get current poller status for debugging / diagnostics. */
export function getNewsPollerStatus(): {
  active: boolean
  source: string
  lastEmittedId: string | null
} {
  return {
    active: timer !== null,
    source: process.env.CRYPTOPANIC_TOKEN ? 'cryptopanic' : 'coindesk-rss',
    lastEmittedId,
  }
}
