/**
 * Wiki Ingest — files external knowledge into the trading wiki.
 *
 * Accepts user-provided content (strategies, lessons, trade theses,
 * playbooks, notes, research) and writes them as structured markdown
 * articles with YAML frontmatter, auto-linking to existing market pages.
 *
 * Part of the Karpathy LLM Wiki pattern: the wiki compounds knowledge
 * from both internal trading events AND external sources.
 */

import {
  ensureWikiDirs,
  writeArticleAtomic,
  readArticle,
  listWikiArticlesRelative,
  extractTitle,
  appendLog,
  WIKI_DIR,
} from './wiki-utils.js'
import { appendEvent } from './event-store.js'
import { existsSync } from 'fs'
import { join } from 'path'

// ── Types ────────────────────────────────────────────────────────────────────

export interface IngestOpts {
  title: string
  content: string
  category: 'strategy' | 'lesson' | 'thesis' | 'playbook' | 'note' | 'research'
  tags?: string[]
}

export interface IngestResult {
  path: string
  title: string
  linkedSymbols: string[]
}

// ── Category → Directory ─────────────────────────────────────────────────────

const CATEGORY_DIR: Record<IngestOpts['category'], string> = {
  strategy: 'strategies',
  lesson: 'lessons',
  thesis: 'theses',
  playbook: 'playbooks',
  note: 'notes',
  research: 'notes',
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Ingest external content into the wiki as a new article.
 *
 * - Generates a safe filename from the title
 * - Adds YAML frontmatter (date, type, tags, source: user)
 * - Auto-links symbol references to existing market pages
 * - Appends to wiki log
 * - Emits wiki_operation event to KB event store
 * - Returns the relative path of the created article
 */
export function ingestArticle(opts: IngestOpts): IngestResult {
  ensureWikiDirs()

  const dir = CATEGORY_DIR[opts.category]
  const slug = slugify(opts.title)
  const relativePath = `${dir}/${slug}.md`
  const today = new Date().toISOString().slice(0, 10)

  // Auto-link: find symbol references and add wikilinks
  const linkedSymbols = detectSymbols(opts.content)
  const linkedContent = addWikiLinks(opts.content, linkedSymbols)

  // Build article with frontmatter
  const tags = [
    opts.category,
    ...(opts.tags ?? []),
    ...linkedSymbols.map(s => s.replace('/', '')),
  ]
  const article = [
    '---',
    `date: ${today}`,
    `type: ${opts.category}`,
    `tags: [${tags.join(', ')}]`,
    'source: user',
    '---',
    `# ${opts.title}`,
    '',
    linkedContent,
    '',
  ].join('\n')

  writeArticleAtomic(relativePath, article)

  // Log and emit event
  appendLog(`ingest: "${opts.title}" filed to ${relativePath}`)
  appendEvent({
    id: '',
    type: 'wiki_operation',
    timestamp: '',
    operation: 'ingest',
    details: `"${opts.title}" → ${relativePath}`,
    articlesAffected: 1,
  } as any).catch(() => {})

  // Regenerate INDEX.md to include the new article
  regenerateIndex(today)

  return { path: relativePath, title: opts.title, linkedSymbols }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Convert a title to a URL-safe slug. */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'untitled'
}

/** Detect trading symbol references like BTC/USDT, ETH/BTC etc. */
function detectSymbols(content: string): string[] {
  const matches = content.toUpperCase().match(/[A-Z]{2,10}\/[A-Z]{2,10}/g)
  return matches ? [...new Set(matches)] : []
}

/**
 * Add [[wikilinks]] for detected symbols that have existing market pages.
 * Only links symbols that haven't already been linked.
 */
function addWikiLinks(content: string, symbols: string[]): string {
  let result = content
  for (const symbol of symbols) {
    const safeName = symbol.replace(/\//g, '-')
    const marketPath = `markets/${safeName}.md`
    const fullPath = join(WIKI_DIR, marketPath)

    if (existsSync(fullPath)) {
      // Only link the first occurrence that isn't already a wikilink
      const escapedSymbol = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const re = new RegExp(`(?<!\\[\\[)\\b${escapedSymbol}\\b(?!\\]\\])`)
      result = result.replace(re, `[[markets/${safeName}|${symbol}]]`)
    }
  }
  return result
}

/**
 * Regenerate INDEX.md to include all wiki articles.
 * Lightweight version — reads article titles from disk.
 */
function regenerateIndex(date: string): void {
  try {
    const allPaths = listWikiArticlesRelative()
    const categories: Record<string, string[]> = {}

    for (const path of allPaths) {
      if (path === 'INDEX.md' || path === 'log.md') continue
      const dir = path.includes('/') ? path.split('/')[0]! : '_root'
      if (!categories[dir]) categories[dir] = []

      const content = readArticle(path)
      const title = content ? extractTitle(content) : path.replace(/\.md$/, '')
      const wikilink = path.replace(/\.md$/, '')
      categories[dir]!.push(`- [[${wikilink}|${title}]]`)
    }

    const sectionOrder: [string, string][] = [
      ['markets', 'Markets'],
      ['patterns', 'Patterns'],
      ['self', 'Self'],
      ['strategies', 'Strategies'],
      ['lessons', 'Lessons'],
      ['theses', 'Trade Theses'],
      ['playbooks', 'Playbooks'],
      ['notes', 'Notes'],
      ['sessions', 'Sessions'],
      ['reports', 'Reports'],
    ]

    const sections: string[] = []
    for (const [dir, label] of sectionOrder) {
      const items = categories[dir]
      if (!items || items.length === 0) continue
      sections.push(`## ${label}`, '', ...items.sort(), '')
    }

    for (const [dir, items] of Object.entries(categories)) {
      if (sectionOrder.some(([d]) => d === dir)) continue
      if (items.length === 0) continue
      const label = dir === '_root' ? 'Other' : dir.charAt(0).toUpperCase() + dir.slice(1)
      sections.push(`## ${label}`, '', ...items.sort(), '')
    }

    const indexContent = [
      '---', `date: ${date}`, 'type: index', 'tags: [index, wiki]', '---',
      '# Vibe Sensei Knowledge Base', '',
      'Your personal trading knowledge base, compiled from trading events.', '',
      ...sections,
      `*Last compiled: ${date}*`, '',
    ].join('\n')

    writeArticleAtomic('INDEX.md', indexContent)
  } catch {
    // INDEX regeneration is best-effort
  }
}
