/**
 * Knowledge Query Router — reads the wiki INDEX.md and individual articles
 * to inject relevant trading knowledge into Guardian context.
 *
 * Routing strategy:
 *   1. Symbol match  (highest priority — user asking about a specific pair)
 *   2. Regime match  (current market conditions)
 *   3. Recency       (latest articles as fallback)
 *
 * Graceful degradation: returns null when wiki doesn't exist or is empty.
 * Zero external calls — reads local .md files only.
 */

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

// ── Constants ──────────────────────────────────────────────────────────────────

const WIKI_DIR = join(homedir(), '.vibe-sensei', 'wiki')
const INDEX_PATH = join(WIKI_DIR, 'INDEX.md')

/** Max content to inject into context (~100 tokens at ~4 chars/token). */
const MAX_CONTENT_CHARS = 400

/** Intent keywords that trigger wiki lookup. */
const INTENT_KEYWORDS = [
  'my history',
  'my pattern',
  'my trades',
  'my win rate',
  'my performance',
  'how do i trade',
  'how have i done',
  'my results',
  'my stats',
]

/** Negative keywords — skip wiki routing when these are present. */
const NEGATIVE_KEYWORDS = ['consult', 'ask', 'what would', 'summon']

/** Symbol detection pattern: "BTC/USDT", "ETH/BTC", etc. */
const SYMBOL_PATTERN = /[A-Z]{2,10}\/[A-Z]{2,10}/g

// ── Index Parsing ──────────────────────────────────────────────────────────────

interface IndexEntry {
  wikilink: string
  title: string
  path: string
}

/**
 * Parse INDEX.md content into structured entries.
 * Expects lines like: `- [[markets/BTC-USDT|BTC/USDT Trading History]]`
 */
function parseIndex(content: string): IndexEntry[] {
  const entries: IndexEntry[] = []
  const linkPattern = /\[\[([^|]+)\|([^\]]+)\]\]/g
  let match: RegExpExecArray | null

  while ((match = linkPattern.exec(content)) !== null) {
    const wikilink = match[1]!
    const title = match[2]!
    const path = wikilink.endsWith('.md') ? wikilink : `${wikilink}.md`
    entries.push({ wikilink, title, path })
  }
  return entries
}

// ── Intent Detection ───────────────────────────────────────────────────────────

/** Check if the question contains negative keywords that should skip wiki. */
function hasNegativeKeyword(question: string): boolean {
  const lower = question.toLowerCase()
  return NEGATIVE_KEYWORDS.some(kw => lower.includes(kw))
}

/** Check if the question indicates intent to query trading history. */
function hasHistoryIntent(question: string): boolean {
  const lower = question.toLowerCase()
  return INTENT_KEYWORDS.some(kw => lower.includes(kw))
}

/** Extract trading symbols from a question. */
function extractSymbols(question: string): string[] {
  const upper = question.toUpperCase()
  const matches = upper.match(SYMBOL_PATTERN)
  return matches ? [...new Set(matches)] : []
}

// ── Article Loading ────────────────────────────────────────────────────────────

/**
 * Read a wiki article by relative path, truncated to budget.
 * Returns null if the file doesn't exist or is empty.
 */
function loadArticle(relativePath: string): string | null {
  try {
    const fullPath = join(WIKI_DIR, relativePath)
    if (!existsSync(fullPath)) return null
    const content = readFileSync(fullPath, 'utf-8').trim()
    if (content.length === 0) return null
    return truncateContent(content)
  } catch {
    return null
  }
}

/**
 * Truncate article content to fit within MAX_CONTENT_CHARS.
 * Strips YAML frontmatter and keeps the most relevant lines.
 */
function truncateContent(raw: string): string {
  let content = raw

  // Strip YAML frontmatter
  if (content.startsWith('---')) {
    const endIdx = content.indexOf('---', 3)
    if (endIdx !== -1) {
      content = content.slice(endIdx + 3).trim()
    }
  }

  if (content.length <= MAX_CONTENT_CHARS) return content

  // Take first MAX_CONTENT_CHARS chars, break at last newline
  const truncated = content.slice(0, MAX_CONTENT_CHARS)
  const lastNewline = truncated.lastIndexOf('\n')
  if (lastNewline > MAX_CONTENT_CHARS * 0.5) {
    return truncated.slice(0, lastNewline).trim()
  }
  return truncated.trim()
}

// ── Matching Logic ─────────────────────────────────────────────────────────────

/**
 * Find the best matching article for symbols in the question.
 * Converts "BTC/USDT" to "markets/BTC-USDT.md" and loads it.
 */
function matchBySymbol(
  symbols: string[],
  entries: IndexEntry[],
): string | null {
  for (const symbol of symbols) {
    const safeName = symbol.replace(/\//g, '-')
    const marketPath = `markets/${safeName}.md`

    // Check if in index (may find it even if index is stale)
    const found = entries.some(
      e => e.path === marketPath || e.wikilink === `markets/${safeName}`,
    )
    if (found) {
      const content = loadArticle(marketPath)
      if (content) return content
    }

    // Try loading directly even if not in index
    const content = loadArticle(marketPath)
    if (content) return content
  }
  return null
}

/**
 * Find articles matching regime keywords in the question.
 */
function matchByRegime(
  question: string,
  entries: IndexEntry[],
): string | null {
  const lower = question.toLowerCase()
  const regimeKeywords = ['trending', 'ranging', 'volatile', 'bear', 'bull']
  const matchedRegime = regimeKeywords.find(kw => lower.includes(kw))
  if (!matchedRegime) return null

  for (const entry of entries) {
    const titleLower = entry.title.toLowerCase()
    if (titleLower.includes(matchedRegime) || titleLower.includes('regime')) {
      const content = loadArticle(entry.path)
      if (content) return content
    }
  }
  return null
}

/**
 * Fall back to self/profile > patterns/overview > first non-index entry.
 */
function matchByRecency(entries: IndexEntry[]): string | null {
  const priorityPaths = ['self/profile.md', 'patterns/overview.md']

  for (const path of priorityPaths) {
    const content = loadArticle(path)
    if (content) return content
  }

  for (const entry of entries) {
    if (entry.path === 'INDEX.md') continue
    const content = loadArticle(entry.path)
    if (content) return content
  }

  return null
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Query the wiki for content relevant to the user's question.
 *
 * Returns a truncated wiki excerpt (~100 tokens max) if relevant content
 * is found, or null if the wiki doesn't exist, question has negative
 * keywords, or no matching articles are found.
 */
export async function queryWiki(
  question: string,
): Promise<string | null> {
  try {
    if (!existsSync(INDEX_PATH)) return null

    const indexContent = readFileSync(INDEX_PATH, 'utf-8').trim()
    if (indexContent.length === 0) return null

    if (hasNegativeKeyword(question)) return null

    const entries = parseIndex(indexContent)
    if (entries.length === 0) return null

    // Priority 1: Symbol match
    const symbols = extractSymbols(question)
    if (symbols.length > 0) {
      const symbolContent = matchBySymbol(symbols, entries)
      if (symbolContent) return symbolContent
    }

    // Priority 2: Regime match
    const regimeContent = matchByRegime(question, entries)
    if (regimeContent) return regimeContent

    // Priority 3: Recency (only if user expressed history intent)
    if (hasHistoryIntent(question)) {
      return matchByRecency(entries)
    }

    return null
  } catch {
    return null
  }
}

/**
 * Quick symbol-only lookup for alert context injection.
 * Skips intent detection — always tries to find symbol data.
 */
export async function queryWikiBySymbol(
  symbol: string,
): Promise<string | null> {
  try {
    if (!existsSync(WIKI_DIR)) return null

    const safeName = symbol.replace(/\//g, '-')
    return loadArticle(`markets/${safeName}.md`)
  } catch {
    return null
  }
}
