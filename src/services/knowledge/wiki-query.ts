/**
 * Wiki Query — user-facing search, synthesis, and file-back for the wiki.
 *
 * Distinct from query-router.ts which injects 400-char context into guardian
 * alerts. This module provides rich, user-facing wiki search results.
 *
 * Three operations:
 * - searchWiki(): keyword match against all articles, returns top excerpts
 * - synthesizeAnswer(): combine excerpts into a coherent answer
 * - fileBackAnswer(): save a good answer back into the wiki (compounding loop)
 */

import { readFileSync } from 'fs'
import {
  WIKI_DIR,
  ensureWikiDirs,
  listWikiArticles,
  readArticle,
  extractTitle,
  stripFrontmatter,
  writeArticleAtomic,
  appendLog,
} from './wiki-utils.js'
import { appendEvent } from './event-store.js'

// ── Types ────────────────────────────────────────────────────────────────────

export interface WikiSearchResult {
  /** Relative path of the matched article. */
  path: string
  /** Article title (from H1 heading). */
  title: string
  /** Relevant excerpt from the article (stripped of frontmatter). */
  excerpt: string
  /** Match score (higher = more relevant). */
  score: number
}

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_EXCERPT_CHARS = 1500
const MAX_RESULTS = 5

// ── Search ───────────────────────────────────────────────────────────────────

/**
 * Search the wiki for articles relevant to a question.
 *
 * Uses keyword matching against article titles and content.
 * Returns up to MAX_RESULTS articles sorted by relevance score.
 */
export function searchWiki(question: string): WikiSearchResult[] {
  ensureWikiDirs()

  const articles = listWikiArticles()
  if (articles.length === 0) return []

  const keywords = extractKeywords(question)
  if (keywords.length === 0) return []

  const scored: WikiSearchResult[] = []

  for (const absPath of articles) {
    const relativePath = absPath.replace(WIKI_DIR + '/', '')
    if (relativePath === 'INDEX.md' || relativePath === 'log.md') continue

    let content: string
    try {
      content = readFileSync(absPath, 'utf-8')
    } catch {
      continue
    }

    const title = extractTitle(content)
    const body = stripFrontmatter(content)
    const score = computeRelevanceScore(keywords, title, body, relativePath)

    if (score > 0) {
      const excerpt = extractExcerpt(body, keywords)
      scored.push({ path: relativePath, title, excerpt, score })
    }
  }

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, MAX_RESULTS)
}

// ── Synthesis ────────────────────────────────────────────────────────────────

/**
 * Synthesize an answer from wiki search results.
 *
 * In template mode (no external LLM), formats the excerpts as a
 * structured answer with citations. The calling LLM (Claude) can
 * further refine this in its response.
 */
export function synthesizeAnswer(
  question: string,
  results: WikiSearchResult[],
): string {
  if (results.length === 0) {
    return 'No relevant articles found in the wiki. The knowledge base may need to be compiled first (use compile operation).'
  }

  const sections: string[] = [
    `**Wiki search**: "${question}"`,
    `**${results.length} article${results.length === 1 ? '' : 's'} found**:`,
    '',
  ]

  for (const result of results) {
    sections.push(
      `### [[${result.path.replace(/\.md$/, '')}|${result.title}]]`,
      '',
      result.excerpt,
      '',
    )
  }

  // Log the query
  appendLog(`query: "${question}" → ${results.length} results from ${results.map(r => r.path).join(', ')}`)
  appendEvent({
    id: '',
    type: 'wiki_operation',
    timestamp: '',
    operation: 'query',
    details: `"${question}" → ${results.length} results`,
  } as any).catch(() => {})

  return sections.join('\n')
}

// ── File-Back ────────────────────────────────────────────────────────────────

/**
 * File a good answer back into the wiki as a new article.
 * This is the compounding loop — queries generate new wiki content.
 */
export function fileBackAnswer(
  question: string,
  answer: string,
  category: string = 'notes',
): string {
  const today = new Date().toISOString().slice(0, 10)
  const slug = question
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'analysis'

  const dir = category === 'lesson' ? 'lessons'
    : category === 'strategy' ? 'strategies'
    : category === 'thesis' ? 'theses'
    : 'notes'

  const relativePath = `${dir}/${slug}.md`

  const article = [
    '---',
    `date: ${today}`,
    `type: ${category}`,
    `tags: [${category}, filed-from-query]`,
    'source: query-synthesis',
    '---',
    `# ${question}`,
    '',
    answer,
    '',
    `*Filed from wiki query on ${today}.*`,
    '',
  ].join('\n')

  writeArticleAtomic(relativePath, article)
  appendLog(`file-back: "${question}" → ${relativePath}`)

  return `Answer filed to wiki: ${relativePath}`
}

// ── Scoring ──────────────────────────────────────────────────────────────────

/** Extract meaningful keywords from a question. */
function extractKeywords(question: string): string[] {
  const stopWords = new Set([
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been',
    'do', 'does', 'did', 'have', 'has', 'had', 'will', 'would',
    'could', 'should', 'may', 'might', 'can', 'shall',
    'i', 'me', 'my', 'we', 'our', 'you', 'your',
    'what', 'how', 'when', 'where', 'why', 'which', 'who',
    'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from',
    'and', 'or', 'but', 'not', 'no', 'if', 'then', 'so',
    'this', 'that', 'these', 'those', 'it', 'its',
    'about', 'show', 'tell', 'give', 'get',
  ])

  return question
    .toLowerCase()
    .replace(/[^a-z0-9/\s-]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 1 && !stopWords.has(w))
}

/** Compute a relevance score for an article against keywords. */
function computeRelevanceScore(
  keywords: string[],
  title: string,
  body: string,
  path: string,
): number {
  const titleLower = title.toLowerCase()
  const bodyLower = body.toLowerCase()
  const pathLower = path.toLowerCase()
  let score = 0

  for (const kw of keywords) {
    // Title match (highest weight)
    if (titleLower.includes(kw)) score += 10

    // Path match (e.g., "btc" matching "markets/BTC-USDT.md")
    if (pathLower.includes(kw)) score += 5

    // Body match (count occurrences, capped)
    const bodyMatches = countOccurrences(bodyLower, kw)
    score += Math.min(bodyMatches, 5) * 2

    // Symbol match (e.g., "BTC/USDT" in content)
    if (kw.includes('/') && bodyLower.includes(kw)) score += 8
  }

  return score
}

/** Count non-overlapping occurrences of a substring. */
function countOccurrences(haystack: string, needle: string): number {
  let count = 0
  let pos = 0
  while ((pos = haystack.indexOf(needle, pos)) !== -1) {
    count++
    pos += needle.length
  }
  return count
}

// ── Excerpt Extraction ───────────────────────────────────────────────────────

/**
 * Extract the most relevant excerpt from an article body.
 * Finds the paragraph with the most keyword matches.
 */
function extractExcerpt(body: string, keywords: string[]): string {
  if (body.length <= MAX_EXCERPT_CHARS) return body

  // Split into paragraphs
  const paragraphs = body.split(/\n\n+/).filter(p => p.trim().length > 0)
  if (paragraphs.length === 0) return body.slice(0, MAX_EXCERPT_CHARS)

  // Score each paragraph
  const scored = paragraphs.map(p => {
    const lower = p.toLowerCase()
    let score = 0
    for (const kw of keywords) {
      if (lower.includes(kw)) score += 1
    }
    return { paragraph: p, score }
  })

  scored.sort((a, b) => b.score - a.score)

  // Take top paragraphs until we hit the char limit
  const result: string[] = []
  let chars = 0
  for (const { paragraph } of scored) {
    if (chars + paragraph.length > MAX_EXCERPT_CHARS) break
    result.push(paragraph)
    chars += paragraph.length
  }

  return result.length > 0 ? result.join('\n\n') : body.slice(0, MAX_EXCERPT_CHARS)
}
