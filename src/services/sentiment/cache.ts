/**
 * In-memory TTL cache for sentiment results.
 *
 * Two cache layers:
 *   - Per-source results (key: `<symbol>:<source>`) so a re-fetch after N
 *     minutes can reuse fresh sources and only re-pull the stale ones.
 *   - Full briefs (key: `pulse:<symbol>`) so the debate engine in
 *     PreTradeGateTool can grab a one-shot plain-text summary without
 *     re-running the synthesizer.
 *
 * No persistence — process restarts clear the cache. That's intentional;
 * "what's the vibe right now" loses meaning across process boundaries.
 */

import type { SentimentBrief, SentimentSourceName, SourceResult } from './types.js'

const DEFAULT_TTL_MS = 15 * 60 * 1000 // 15 minutes

interface SourceEntry {
  result: SourceResult
  expiresAt: number
}

interface BriefEntry {
  brief: SentimentBrief
  expiresAt: number
}

const sourceCache = new Map<string, SourceEntry>()
const briefCache = new Map<string, BriefEntry>()

/**
 * Normalize a trading symbol to its base ticker for cache keys.
 * Strips any pair suffix and uppercases — `BTC/USDT`, `btc`, and `BTC`
 * all collapse to `BTC`. This must match the lookup convention used by
 * any cache read site (notably PreTradeGateTool's debate-stance injector,
 * which calls `(symbol.split('/')[0] ?? symbol).toUpperCase()`).
 */
function normalizeSymbolKey(symbol: string): string {
  const base = symbol.split('/')[0] ?? symbol
  return base.toUpperCase()
}

function sourceKey(symbol: string, source: SentimentSourceName): string {
  return `${normalizeSymbolKey(symbol)}:${source}`
}

function briefKey(symbol: string): string {
  return `pulse:${normalizeSymbolKey(symbol)}`
}

/** Get a cached SourceResult, or undefined if missing or expired. */
export function getCachedSource(
  symbol: string,
  source: SentimentSourceName,
): SourceResult | undefined {
  const entry = sourceCache.get(sourceKey(symbol, source))
  if (!entry) return undefined
  if (Date.now() >= entry.expiresAt) {
    sourceCache.delete(sourceKey(symbol, source))
    return undefined
  }
  return entry.result
}

/** Store a SourceResult with the default TTL. */
export function setCachedSource(
  symbol: string,
  result: SourceResult,
  ttlMs: number = DEFAULT_TTL_MS,
): void {
  sourceCache.set(sourceKey(symbol, result.source), {
    result,
    expiresAt: Date.now() + ttlMs,
  })
}

/** Get a cached full SentimentBrief. */
export function getCachedBrief(symbol: string): SentimentBrief | undefined {
  const entry = briefCache.get(briefKey(symbol))
  if (!entry) return undefined
  if (Date.now() >= entry.expiresAt) {
    briefCache.delete(briefKey(symbol))
    return undefined
  }
  return entry.brief
}

/** Store a full SentimentBrief. */
export function setCachedBrief(
  symbol: string,
  brief: SentimentBrief,
  ttlMs: number = DEFAULT_TTL_MS,
): void {
  briefCache.set(briefKey(symbol), {
    brief,
    expiresAt: Date.now() + ttlMs,
  })
}

/**
 * Convenience accessor used by the debate-stance injector in PreTradeGateTool.
 * Returns just the plain-text version of the brief, or null if no fresh entry exists.
 */
export function getBriefPlainText(symbol: string): string | null {
  const brief = getCachedBrief(symbol)
  return brief ? brief.plainText : null
}

/** Clear everything. Used by tests and explicit /pulse --refresh. */
export function clearSentimentCache(): void {
  sourceCache.clear()
  briefCache.clear()
}
