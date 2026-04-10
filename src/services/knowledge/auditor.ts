/**
 * Wiki Auditor — periodic health check and LLM-powered pattern discovery.
 *
 * Provides two main capabilities:
 *
 * 1. **Wiki Health Score**: Measures completeness, freshness, and coverage
 *    of the compiled wiki. Exported for use by Morning Brief (Sprint 62).
 *
 * 2. **Pattern Discovery**: Uses Gemini 2.5 Flash to find trading patterns
 *    beyond the 13 built-in PatternType types in diary.ts. Discovered
 *    patterns are written to ~/.vibe-sensei/wiki/patterns/discovered/.
 *
 * If no GEMINI_API_KEY is present, LLM discovery is skipped — only the
 * statistical health check runs. All file writes are atomic.
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { readEvents } from './event-store.js'
import { callGemini } from './gemini-client.js'
import type { KBEventUnion, TradeLogEvent } from './types.js'

// ── Types ───────────────────────────────────────────────────────────────────

export interface WikiHealthScore {
  /** Percentage of events that have been compiled into wiki articles (0-100). */
  completeness: number
  /** Days since the last successful compilation. -1 if never compiled. */
  freshness: number
  /** Percentage of traded symbols that have market articles (0-100). */
  coverage: number
  /** Weighted composite health score (0-100). Higher is better. */
  overall: number
  /** Total number of events in the event store. */
  totalEvents: number
  /** Number of events that have been compiled. */
  compiledEvents: number
  /** Total unique traded symbols. */
  totalSymbols: number
  /** Symbols with existing market articles. */
  coveredSymbols: string[]
  /** Symbols missing market articles. */
  uncoveredSymbols: string[]
}

export interface AuditResult {
  healthScore: WikiHealthScore
  /** Articles referencing non-existent wiki links. */
  brokenLinks: BrokenLink[]
  /** Events that lack corresponding wiki articles. */
  missingArticles: MissingArticle[]
  /** Newly discovered patterns from LLM analysis (empty if no API key). */
  discoveredPatterns: DiscoveredPattern[]
  /** Any warnings or errors encountered during audit. */
  warnings: string[]
}

interface BrokenLink {
  /** The wiki article containing the broken link. */
  sourcePath: string
  /** The broken wikilink target. */
  targetLink: string
}

interface MissingArticle {
  /** Suggested article path. */
  suggestedPath: string
  /** Reason for suggestion. */
  reason: string
}

export interface DiscoveredPattern {
  /** Human-readable pattern name. */
  name: string
  /** Description of the pattern. */
  description: string
  /** Evidence from the events that support this pattern. */
  evidence: string
  /** Suggested action for the trader. */
  advice: string
}

// ── Constants ───────────────────────────────────────────────────────────────

const WIKI_DIR = join(homedir(), '.vibe-sensei', 'wiki')
const COMPILE_STATE_PATH = join(WIKI_DIR, '.compile-state.json')
const DISCOVERED_DIR = join(WIKI_DIR, 'patterns', 'discovered')

/** The 13 built-in PatternType values from diary.ts. */
const KNOWN_PATTERN_TYPES = [
  'early_exit', 'late_entry', 'oversize', 'revenge_trade',
  'good_discipline', 'fomo', 'general', 'time_of_day_bias',
  'holding_period_bias', 'instrument_bias', 'position_size_bad',
  'averaging_down_bad', 'pyramid_good',
] as const

// ── Notification Callback ───────────────────────────────────────────────────

type NotifyCallback = (message: string) => void
let notifyCallback: NotifyCallback | null = null

/**
 * Register a notification callback for pattern discovery alerts.
 * Typically wired to companionReaction via AppState.
 */
export function registerAuditNotifier(cb: NotifyCallback): void {
  notifyCallback = cb
}

// ── Health Score ─────────────────────────────────────────────────────────────

/**
 * Compute a WikiHealthScore snapshot.
 * Exported for use by Morning Brief (Sprint 62) and auditor.
 */
export async function getWikiHealthScore(): Promise<WikiHealthScore> {
  const allEvents = await readEvents()
  const compiledCount = getCompiledEventCount()
  const completeness = computeCompleteness(allEvents.length, compiledCount)
  const freshness = computeFreshness()
  const { totalSymbols, coveredSymbols, uncoveredSymbols } =
    computeCoverage(allEvents)
  const coverage = totalSymbols > 0
    ? Math.round((coveredSymbols.length / totalSymbols) * 100)
    : 100 // No symbols = vacuously complete

  const overall = computeOverall(completeness, freshness, coverage)

  return {
    completeness,
    freshness,
    coverage,
    overall,
    totalEvents: allEvents.length,
    compiledEvents: compiledCount,
    totalSymbols,
    coveredSymbols,
    uncoveredSymbols,
  }
}

/** Read the compiled event count from compile state. */
function getCompiledEventCount(): number {
  try {
    const raw = readFileSync(COMPILE_STATE_PATH, 'utf-8')
    const state = JSON.parse(raw) as { eventsCompiled?: number }
    return state.eventsCompiled ?? 0
  } catch {
    return 0
  }
}

/** Completeness: % of events compiled. Capped at 100. */
function computeCompleteness(total: number, compiled: number): number {
  if (total === 0) return 100
  return Math.min(100, Math.round((compiled / total) * 100))
}

/** Freshness: days since last compile. -1 if never compiled. */
function computeFreshness(): number {
  try {
    const raw = readFileSync(COMPILE_STATE_PATH, 'utf-8')
    const state = JSON.parse(raw) as { lastEventTimestamp?: string }
    if (!state.lastEventTimestamp) return -1
    const lastDate = new Date(state.lastEventTimestamp)
    const now = new Date()
    const diffMs = now.getTime() - lastDate.getTime()
    return Math.round(diffMs / (1000 * 60 * 60 * 24))
  } catch {
    return -1
  }
}

/** Coverage: count traded symbols and check which have market articles. */
function computeCoverage(events: KBEventUnion[]): {
  totalSymbols: number
  coveredSymbols: string[]
  uncoveredSymbols: string[]
} {
  const symbols = new Set<string>()
  for (const e of events) {
    if (e.type === 'trade_log') {
      symbols.add((e as TradeLogEvent).symbol)
    }
  }

  const coveredSymbols: string[] = []
  const uncoveredSymbols: string[] = []

  for (const symbol of symbols) {
    const safeName = symbol.replace(/\//g, '-')
    const articlePath = join(WIKI_DIR, 'markets', `${safeName}.md`)
    if (existsSync(articlePath)) {
      coveredSymbols.push(symbol)
    } else {
      uncoveredSymbols.push(symbol)
    }
  }

  return { totalSymbols: symbols.size, coveredSymbols, uncoveredSymbols }
}

/** Weighted composite: 40% completeness, 30% freshness, 30% coverage. */
function computeOverall(
  completeness: number,
  freshnessDays: number,
  coverage: number,
): number {
  let freshnessScore: number
  if (freshnessDays < 0) {
    freshnessScore = 0
  } else if (freshnessDays <= 1) {
    freshnessScore = 100
  } else if (freshnessDays <= 7) {
    freshnessScore = 80
  } else if (freshnessDays <= 14) {
    freshnessScore = 50
  } else if (freshnessDays <= 30) {
    freshnessScore = 25
  } else {
    freshnessScore = 10
  }

  return Math.round(
    completeness * 0.4 + freshnessScore * 0.3 + coverage * 0.3,
  )
}

// ── Broken Link Detection ───────────────────────────────────────────────────

/** Scan wiki articles for broken [[wikilinks]]. */
function findBrokenLinks(): BrokenLink[] {
  const broken: BrokenLink[] = []
  const articles = listWikiArticles()

  for (const articlePath of articles) {
    const content = safeReadFile(articlePath)
    if (!content) continue

    const links = extractWikiLinks(content)
    for (const link of links) {
      if (!wikiLinkExists(link)) {
        const rel = articlePath.replace(WIKI_DIR + '/', '')
        broken.push({ sourcePath: rel, targetLink: link })
      }
    }
  }

  return broken
}

/** Extract [[wikilinks]] from markdown content. */
function extractWikiLinks(content: string): string[] {
  const matches = content.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)
  const links: string[] = []
  for (const m of matches) {
    if (m[1]) links.push(m[1])
  }
  return links
}

/** Check if a wikilink target resolves to an existing file. */
function wikiLinkExists(link: string): boolean {
  const withMd = link.endsWith('.md') ? link : `${link}.md`
  return existsSync(join(WIKI_DIR, withMd))
}

/** List all .md files in the wiki directory recursively. */
function listWikiArticles(): string[] {
  const result: string[] = []
  collectMarkdownFiles(WIKI_DIR, result)
  return result
}

/** Recursively collect .md files from a directory. */
function collectMarkdownFiles(dir: string, out: string[]): void {
  try {
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        collectMarkdownFiles(fullPath, out)
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        out.push(fullPath)
      }
    }
  } catch {
    // Directory doesn't exist or is unreadable
  }
}

// ── Missing Article Detection ───────────────────────────────────────────────

/** Find events that should have corresponding wiki articles but don't. */
function findMissingArticles(events: KBEventUnion[]): MissingArticle[] {
  const missing: MissingArticle[] = []
  const symbols = collectTradedSymbols(events)

  for (const symbol of symbols) {
    const safeName = symbol.replace(/\//g, '-')
    const path = join(WIKI_DIR, 'markets', `${safeName}.md`)
    if (!existsSync(path)) {
      missing.push({
        suggestedPath: `markets/${safeName}.md`,
        reason: `Traded symbol ${symbol} has no market article`,
      })
    }
  }

  checkMissingOverview(events, missing)
  checkMissingProfile(events, missing)
  checkMissingIndex(missing)

  return missing
}

/** Collect unique traded symbols from events. */
function collectTradedSymbols(events: KBEventUnion[]): Set<string> {
  const symbols = new Set<string>()
  for (const e of events) {
    if (e.type === 'trade_log') symbols.add((e as TradeLogEvent).symbol)
  }
  return symbols
}

/** Check if pattern overview article is missing. */
function checkMissingOverview(
  events: KBEventUnion[],
  missing: MissingArticle[],
): void {
  if (existsSync(join(WIKI_DIR, 'patterns', 'overview.md'))) return
  const patternCount = events.filter(e => e.type === 'diary_pattern').length
  if (patternCount > 0) {
    missing.push({
      suggestedPath: 'patterns/overview.md',
      reason: `${patternCount} pattern events with no overview article`,
    })
  }
}

/** Check if trader profile article is missing. */
function checkMissingProfile(
  events: KBEventUnion[],
  missing: MissingArticle[],
): void {
  if (existsSync(join(WIKI_DIR, 'self', 'profile.md'))) return
  if (events.length >= 5) {
    missing.push({
      suggestedPath: 'self/profile.md',
      reason: `${events.length} events with no trader profile article`,
    })
  }
}

/** Check if INDEX.md is missing. */
function checkMissingIndex(missing: MissingArticle[]): void {
  if (existsSync(join(WIKI_DIR, 'INDEX.md'))) return
  const existingArticles = listWikiArticles()
  if (existingArticles.length > 0) {
    missing.push({
      suggestedPath: 'INDEX.md',
      reason: `${existingArticles.length} articles exist but no index`,
    })
  }
}

// ── LLM Pattern Discovery ───────────────────────────────────────────────────

/** Build the pattern discovery prompt for the LLM. */
function buildDiscoveryPrompt(events: KBEventUnion[]): string {
  const formatted = formatEventBatch(events)
  return [
    'You are a trading behavior analyst. The trader has an automated diary that',
    'detects these 13 known pattern types:',
    '',
    KNOWN_PATTERN_TYPES.map(p => `- ${p}`).join('\n'),
    '',
    'Analyze the following trading events and find behavioral patterns NOT covered',
    'by the 13 types above. Look for:',
    '- Correlation-based patterns (e.g., always trades after big market moves)',
    '- Emotional sequences (e.g., loss -> larger bet -> larger loss)',
    '- Timing clusters (e.g., trades cluster in specific windows)',
    '- Regime-specific behavior (e.g., only buys in downtrends)',
    '- Risk escalation or de-escalation patterns',
    '- Symbol rotation habits',
    '',
    'Respond ONLY with a JSON array. Each element:',
    '{ "name": "snake_case_name", "description": "...", "evidence": "...", "advice": "..." }',
    '',
    'If no novel patterns found, respond with [].',
    'Only output the JSON array — no extra text.',
    '',
    '--- TRADING EVENTS ---',
    formatted,
  ].join('\n')
}

/** Format an event batch for the LLM prompt, respecting token budget. */
function formatEventBatch(events: KBEventUnion[]): string {
  const lines: string[] = []
  let chars = 0
  const budget = 10_000

  for (const event of events) {
    const line = formatEventLine(event)
    if (chars + line.length > budget) break
    lines.push(line)
    chars += line.length
  }

  return lines.join('\n')
}

/** Format a single event into a compact one-line representation. */
function formatEventLine(event: KBEventUnion): string {
  const ts = event.timestamp.slice(0, 16)
  const base = `[${ts}] ${event.type}`

  switch (event.type) {
    case 'trade_log': {
      const t = event as TradeLogEvent
      const pnl = t.netPnL !== undefined ? ` pnl=${t.netPnL.toFixed(2)}` : ''
      return `${base} | ${t.side} ${t.symbol} qty=${t.quantity} price=${t.price}${pnl}`
    }
    case 'alert':
      return `${base} | ${event.severity} ${event.checkName}`
    case 'diary_pattern':
      return `${base} | ${event.symbol} pattern=${event.patternType}`
    case 'regime_change':
      return `${base} | ${event.symbol} ${event.oldRegime}->${event.newRegime}`
    case 'ghost':
      return `${base} | ${event.ghostName}`
    case 'gate_check':
      return `${base} | ${event.symbol} ${event.status}`
    default:
      return base
  }
}

/** Call LLM for pattern discovery. Returns patterns or empty array. */
async function discoverPatternsWithLLM(
  events: KBEventUnion[],
  _apiKey: string,
): Promise<DiscoveredPattern[]> {
  const prompt = buildDiscoveryPrompt(events)
  const result = await callGemini({ prompt, temperature: 0.4 })
  if (!result) return []

  return parseDiscoveredPatterns(result.text)
}

/** Parse the LLM response into DiscoveredPattern[]. Multi-layer extraction. */
function parseDiscoveredPatterns(text: string): DiscoveredPattern[] {
  const direct = tryParsePatterns(text)
  if (direct) return direct

  const codeBlock = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (codeBlock?.[1]) {
    const fromBlock = tryParsePatterns(codeBlock[1])
    if (fromBlock) return fromBlock
  }

  const bracketStart = text.indexOf('[')
  const bracketEnd = text.lastIndexOf(']')
  if (bracketStart >= 0 && bracketEnd > bracketStart) {
    const slice = text.slice(bracketStart, bracketEnd + 1)
    return tryParsePatterns(slice) ?? []
  }

  return []
}

/** Attempt to parse a string as DiscoveredPattern[]. */
function tryParsePatterns(raw: string): DiscoveredPattern[] | null {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return null
    const patterns: DiscoveredPattern[] = []
    for (const item of parsed) {
      if (isValidPattern(item)) patterns.push(item)
    }
    // Return empty array if LLM returned [] (no patterns found)
    if (parsed.length === 0) return []
    return patterns.length > 0 ? patterns : null
  } catch {
    return null
  }
}

/** Type guard for a valid DiscoveredPattern shape. */
function isValidPattern(item: unknown): item is DiscoveredPattern {
  if (typeof item !== 'object' || item === null) return false
  const obj = item as Record<string, unknown>
  return (
    typeof obj.name === 'string' && obj.name.length > 0 &&
    typeof obj.description === 'string' && obj.description.length > 0 &&
    typeof obj.evidence === 'string' &&
    typeof obj.advice === 'string'
  )
}

// ── Write Discovered Patterns ───────────────────────────────────────────────

/** Write discovered patterns to wiki/patterns/discovered/. */
function writeDiscoveredPatterns(patterns: DiscoveredPattern[]): void {
  if (patterns.length === 0) return

  mkdirSync(DISCOVERED_DIR, { recursive: true, mode: 0o700 })
  const today = new Date().toISOString().slice(0, 10)

  for (const pattern of patterns) {
    const safeName = pattern.name.replace(/[^a-z0-9_-]/g, '-')
    const content = formatPatternArticle(pattern, today)
    writeAtomically(join(DISCOVERED_DIR, `${safeName}.md`), content)
  }
}

/** Format a discovered pattern as a wiki article. */
function formatPatternArticle(
  pattern: DiscoveredPattern,
  date: string,
): string {
  return [
    '---',
    `date: ${date}`,
    'type: discovered_pattern',
    `tags: [pattern, discovered, ${pattern.name}]`,
    '---',
    `# ${humanize(pattern.name)}`,
    '',
    '**Type**: discovered (not in diary.ts built-in types)',
    '',
    '## Description',
    '',
    pattern.description,
    '',
    '## Evidence',
    '',
    pattern.evidence,
    '',
    '## Recommended Action',
    '',
    pattern.advice,
    '',
    `*Discovered by LLM audit on ${date}.*`,
    '',
    'See [[patterns/overview]] for all known patterns.',
    '',
  ].join('\n')
}

/** Convert snake_case to Title Case. */
function humanize(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

// ── File Utilities ──────────────────────────────────────────────────────────

/** Read a file, returning null on any error. */
function safeReadFile(path: string): string | null {
  try {
    return readFileSync(path, 'utf-8')
  } catch {
    return null
  }
}

/** Write a file atomically via .tmp + rename. */
function writeAtomically(path: string, content: string): void {
  const tmpPath = path + '.tmp'
  writeFileSync(tmpPath, content, { encoding: 'utf-8', mode: 0o600 })
  renameSync(tmpPath, path)
}

// ── Main Audit Function ─────────────────────────────────────────────────────

/**
 * Run a full wiki audit.
 *
 * 1. Compute wiki health score
 * 2. Scan for broken [[wikilinks]]
 * 3. Find events without corresponding articles
 * 4. Optionally discover new patterns via LLM
 *
 * Returns an AuditResult with all findings.
 */
export async function auditWiki(): Promise<AuditResult> {
  ensureWikiDirs()

  const allEvents = await readEvents()
  const healthScore = await getWikiHealthScore()
  const brokenLinks = findBrokenLinks()
  const missingArticles = findMissingArticles(allEvents)
  const warnings: string[] = []

  let discoveredPatterns: DiscoveredPattern[] = []
  const apiKey = process.env.GEMINI_API_KEY ?? ''

  if (apiKey.length > 0 && allEvents.length >= 5) {
    try {
      discoveredPatterns = await discoverPatternsWithLLM(allEvents, apiKey)
      if (discoveredPatterns.length > 0) {
        writeDiscoveredPatterns(discoveredPatterns)
        notifyPatterns(discoveredPatterns)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      warnings.push(`Pattern discovery failed: ${msg}`)
    }
  } else if (apiKey.length === 0) {
    warnings.push('No GEMINI_API_KEY — skipping LLM pattern discovery')
  } else if (allEvents.length < 5) {
    warnings.push('Fewer than 5 events — skipping pattern discovery')
  }

  if (brokenLinks.length > 0) {
    warnings.push(`${brokenLinks.length} broken wikilinks found`)
  }
  if (missingArticles.length > 0) {
    warnings.push(`${missingArticles.length} suggested articles missing`)
  }

  return {
    healthScore,
    brokenLinks,
    missingArticles,
    discoveredPatterns,
    warnings,
  }
}

/** Push a notification about discovered patterns via the registered callback. */
function notifyPatterns(patterns: DiscoveredPattern[]): void {
  if (!notifyCallback || patterns.length === 0) return

  const names = patterns.map(p => humanize(p.name)).join(', ')
  const message = patterns.length === 1
    ? `discovered a new pattern: ${names}`
    : `discovered ${patterns.length} new patterns: ${names}`

  try {
    notifyCallback(message)
  } catch {
    // Notification is best-effort — never block audit
  }
}

/** Ensure wiki directory structure exists. */
function ensureWikiDirs(): void {
  const subdirs = [
    'patterns', 'patterns/discovered', 'markets',
    'self', 'sessions', 'reports',
  ]
  try {
    mkdirSync(WIKI_DIR, { recursive: true, mode: 0o700 })
    for (const sub of subdirs) {
      mkdirSync(join(WIKI_DIR, sub), { recursive: true, mode: 0o700 })
    }
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== 'EEXIST') {
      console.warn('[KB Auditor] failed to create wiki dirs:', err)
    }
  }
}
