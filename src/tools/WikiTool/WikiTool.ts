/**
 * WikiTool — user-facing interface to the trading knowledge wiki.
 *
 * Inspired by Karpathy's LLM Wiki pattern: a persistent, interlinked
 * markdown knowledge base that compounds trading knowledge over time.
 *
 * 6 operations:
 *   compile  — Build/update wiki articles from JSONL trading events
 *   query    — Search wiki and synthesize an answer
 *   ingest   — File external knowledge (strategies, lessons, theses, etc.)
 *   lint     — Health check: broken links, missing articles, coverage
 *   browse   — Read INDEX or a specific article
 *   status   — Quick health summary
 */

import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'

const inputSchema = z.strictObject({
  operation: z
    .enum(['compile', 'query', 'ingest', 'lint', 'browse', 'status'])
    .describe('Wiki operation to perform'),
  // compile
  full: z
    .boolean()
    .optional()
    .describe('Full recompile from scratch (default: incremental)'),
  // query
  question: z
    .string()
    .optional()
    .describe('Question to search the wiki for (query operation)'),
  fileBack: z
    .boolean()
    .optional()
    .describe('File the synthesized answer back into the wiki'),
  // ingest
  title: z
    .string()
    .optional()
    .describe('Title for the ingested article'),
  content: z
    .string()
    .optional()
    .describe('Content to file into the wiki'),
  category: z
    .enum(['strategy', 'lesson', 'thesis', 'playbook', 'note', 'research'])
    .optional()
    .describe('Category for ingested content'),
  tags: z
    .array(z.string())
    .optional()
    .describe('Optional tags for the ingested article'),
  // browse
  path: z
    .string()
    .optional()
    .describe('Relative path of a wiki article to read (browse operation)'),
})

type InputSchema = typeof inputSchema
type Output = string

export const WikiTool = buildTool({
  name: 'Wiki',
  searchHint: 'knowledge base wiki trading history patterns compile query ingest browse',
  maxResultSizeChars: 50_000,

  get inputSchema(): InputSchema {
    return inputSchema
  },

  isReadOnly(input) {
    const op = (input as { operation?: string }).operation
    return op === 'query' || op === 'browse' || op === 'status' || op === 'lint'
  },

  isDestructive() {
    return false
  },

  isConcurrencySafe() {
    return true
  },

  async description() {
    return 'Interact with the persistent trading knowledge wiki: compile events into articles, search for insights, file strategies/lessons, audit health, or browse articles.'
  },

  async prompt() {
    return [
      'You have a persistent trading knowledge wiki at ~/.vibe-sensei/wiki/.',
      'The wiki compiles trading events into structured markdown articles with cross-references.',
      '',
      'Operations:',
      '  compile  — Build/update wiki from JSONL trading events. Use full=true for complete rebuild.',
      '  query    — Search wiki for an answer. Set fileBack=true to save good answers back.',
      '  ingest   — File external knowledge. Requires title, content, and category.',
      '             Categories: strategy, lesson, thesis, playbook, note, research.',
      '  lint     — Audit wiki health: broken links, missing articles, pattern discovery.',
      '  browse   — Read INDEX.md (no path) or a specific article (with path).',
      '  status   — Quick health summary: article count, freshness, coverage.',
      '',
      'Best practices:',
      '  - Use "query" before answering questions about trading history or patterns.',
      '  - After generating an insightful analysis, use "ingest" to file it back.',
      '  - Use "compile" when the user asks to update or rebuild the knowledge base.',
      '  - The wiki grows richer with every ingest and compile — knowledge compounds.',
    ].join('\n')
  },

  toAutoClassifierInput(input) {
    const op = input.operation ?? 'status'
    const q = input.question ?? input.title ?? ''
    return `Wiki ${op} ${q}`.trim()
  },

  mapToolResultToToolResultBlockParam(content, toolUseID) {
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: String(content),
    }
  },

  renderToolUseMessage(input) {
    const op = input.operation ?? 'status'
    const detail = input.question ?? input.title ?? input.path ?? ''
    return detail ? `Wiki: ${op} — ${detail}` : `Wiki: ${op}`
  },

  async call(input) {
    const op = input.operation

    switch (op) {
      case 'compile':
        return handleCompile(input.full ?? false)
      case 'query':
        return handleQuery(input.question, input.fileBack)
      case 'ingest':
        return handleIngest(input.title, input.content, input.category, input.tags)
      case 'lint':
        return handleLint()
      case 'browse':
        return handleBrowse(input.path)
      case 'status':
        return handleStatus()
      default:
        return { data: `Unknown wiki operation: ${op}` }
    }
  },
} satisfies ToolDef<InputSchema, Output>)

// ── Operation Handlers ───────────────────────────────────────────────────────

async function handleCompile(full: boolean): Promise<{ data: string }> {
  try {
    const { compile } = await import('../../services/knowledge/compiler.js')
    const result = await compile({ full })

    const lines = [
      `Wiki compiled: ${result.articlesUpdated} articles updated`,
      `Mode: ${result.mode} | Events processed: ${result.eventsProcessed}`,
    ]
    if (result.warnings.length > 0) {
      lines.push(`Warnings: ${result.warnings.join('; ')}`)
    }
    return { data: lines.join('\n') }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { data: `Compile failed: ${msg}` }
  }
}

async function handleQuery(
  question: string | undefined,
  fileBack: boolean | undefined,
): Promise<{ data: string }> {
  if (!question) {
    return { data: 'Missing "question" parameter for query operation.' }
  }

  try {
    const { searchWiki, synthesizeAnswer, fileBackAnswer } = await import(
      '../../services/knowledge/wiki-query.js'
    )

    const results = searchWiki(question)
    const answer = synthesizeAnswer(question, results)

    if (fileBack && results.length > 0) {
      const filed = fileBackAnswer(question, answer)
      return { data: `${answer}\n\n---\n${filed}` }
    }

    return { data: answer }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { data: `Query failed: ${msg}` }
  }
}

async function handleIngest(
  title: string | undefined,
  content: string | undefined,
  category: string | undefined,
  tags: string[] | undefined,
): Promise<{ data: string }> {
  if (!title || !content || !category) {
    return {
      data: 'Missing required parameters for ingest: title, content, and category are all required.',
    }
  }

  try {
    const { ingestArticle } = await import(
      '../../services/knowledge/wiki-ingest.js'
    )

    const result = ingestArticle({
      title,
      content,
      category: category as any,
      tags,
    })

    const lines = [`Article ingested: ${result.path}`]
    if (result.linkedSymbols.length > 0) {
      lines.push(`Auto-linked symbols: ${result.linkedSymbols.join(', ')}`)
    }
    return { data: lines.join('\n') }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { data: `Ingest failed: ${msg}` }
  }
}

async function handleLint(): Promise<{ data: string }> {
  try {
    const { auditWiki } = await import(
      '../../services/knowledge/auditor.js'
    )

    const result = await auditWiki()
    const h = result.healthScore

    const lines = [
      '═══ Wiki Audit Report ═══',
      '',
      `Health: ${h.overall}% | Completeness: ${h.completeness}% | Coverage: ${h.coverage}%`,
      `Events: ${h.totalEvents} total, ${h.compiledEvents} compiled`,
      `Symbols: ${h.totalSymbols} traded, ${h.coveredSymbols.length} with articles`,
      `Freshness: ${h.freshness >= 0 ? `${h.freshness} days since last compile` : 'never compiled'}`,
    ]

    if (h.uncoveredSymbols.length > 0) {
      lines.push(`Missing market articles: ${h.uncoveredSymbols.join(', ')}`)
    }
    if (result.brokenLinks.length > 0) {
      lines.push('')
      lines.push(`Broken links (${result.brokenLinks.length}):`)
      for (const bl of result.brokenLinks.slice(0, 10)) {
        lines.push(`  ${bl.sourcePath} → [[${bl.targetLink}]]`)
      }
    }
    if (result.missingArticles.length > 0) {
      lines.push('')
      lines.push(`Suggested articles (${result.missingArticles.length}):`)
      for (const ma of result.missingArticles.slice(0, 10)) {
        lines.push(`  ${ma.suggestedPath}: ${ma.reason}`)
      }
    }
    if (result.discoveredPatterns.length > 0) {
      lines.push('')
      lines.push(`Discovered patterns (${result.discoveredPatterns.length}):`)
      for (const dp of result.discoveredPatterns) {
        lines.push(`  ${dp.name}: ${dp.description.slice(0, 80)}`)
      }
    }
    if (result.warnings.length > 0) {
      lines.push('')
      lines.push(`Warnings: ${result.warnings.join('; ')}`)
    }

    return { data: lines.join('\n') }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { data: `Lint failed: ${msg}` }
  }
}

async function handleBrowse(path: string | undefined): Promise<{ data: string }> {
  try {
    const { readArticle, ensureWikiDirs, listWikiArticlesRelative } = await import(
      '../../services/knowledge/wiki-utils.js'
    )
    ensureWikiDirs()

    if (!path) {
      // Return INDEX.md or article listing
      const index = readArticle('INDEX.md')
      if (index) return { data: index }

      // No INDEX — list what exists
      const articles = listWikiArticlesRelative()
      if (articles.length === 0) {
        return { data: 'Wiki is empty. Use compile to build articles from trading events, or ingest to add content.' }
      }
      return {
        data: `No INDEX.md yet. ${articles.length} articles exist:\n${articles.map(a => `  ${a}`).join('\n')}\n\nRun compile to generate the index.`,
      }
    }

    // Read specific article
    const normalizedPath = path.endsWith('.md') ? path : `${path}.md`
    const content = readArticle(normalizedPath)
    if (!content) {
      return { data: `Article not found: ${normalizedPath}` }
    }
    return { data: content }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { data: `Browse failed: ${msg}` }
  }
}

async function handleStatus(): Promise<{ data: string }> {
  try {
    const { getWikiHealthScore } = await import(
      '../../services/knowledge/auditor.js'
    )
    const { listWikiArticlesRelative } = await import(
      '../../services/knowledge/wiki-utils.js'
    )

    const health = await getWikiHealthScore()
    const articles = listWikiArticlesRelative()

    const lines = [
      `Wiki Status`,
      `  Articles: ${articles.length}`,
      `  Health: ${health.overall}%`,
      `  Events: ${health.totalEvents} total, ${health.compiledEvents} compiled`,
      `  Coverage: ${health.coverage}% (${health.coveredSymbols.length}/${health.totalSymbols} symbols)`,
      `  Freshness: ${health.freshness >= 0 ? `${health.freshness}d` : 'never compiled'}`,
    ]

    if (health.totalEvents > 0 && health.compiledEvents === 0) {
      lines.push('')
      lines.push('→ Events exist but wiki has never been compiled. Run compile to build it.')
    }

    return { data: lines.join('\n') }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { data: `Status failed: ${msg}` }
  }
}
