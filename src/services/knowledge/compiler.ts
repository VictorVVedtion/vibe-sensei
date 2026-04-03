/**
 * Knowledge Compiler — reads JSONL events and generates a human-readable
 * Markdown wiki. Supports two modes:
 *
 * 1. **Gemini mode**: LLM-powered analysis via Gemini 2.5 Flash REST API
 * 2. **Template mode**: Pure statistical summaries without any API calls
 *
 * Template mode is the fallback when GEMINI_API_KEY is missing, the user
 * declines consent, or API calls fail. It always produces a valid wiki.
 *
 * All writes are atomic (write .tmp, rename to final path).
 * File permissions are 0o600 for all wiki files.
 */

import {
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'fs'
import { dirname, join } from 'path'
import { homedir } from 'os'
import { readEvents } from './event-store.js'
import { callGemini } from './gemini-client.js'
import { buildCompilationPrompt } from './prompts.js'
import type { KBEventUnion, TradeLogEvent } from './types.js'

// ── Types ────────────────────────────────────────────────────────────────────

export interface CompileResult {
  articlesUpdated: number
  eventsProcessed: number
  mode: 'gemini' | 'template'
  warnings: string[]
}

interface CompileState {
  lastEventId: string | null
  lastEventTimestamp: string | null
  eventsCompiled: number
  tradeCount: number
}

interface WikiArticle {
  path: string
  content: string
}

// ── Constants ────────────────────────────────────────────────────────────────

const WIKI_DIR = join(homedir(), '.vibe-sensei', 'wiki')
const COMPILE_STATE_PATH = join(WIKI_DIR, '.compile-state.json')
const CONSENT_PATH = join(homedir(), '.vibe-sensei', '.gemini-consent')
const AUTO_COMPILE_INTERVAL = 5 // trades between auto-compiles

// ── Directory Bootstrap ──────────────────────────────────────────────────────

const WIKI_SUBDIRS = ['patterns', 'markets', 'self', 'sessions', 'reports']

/** Ensure wiki directory and subdirectories exist. */
function ensureWikiDirs(): void {
  try {
    mkdirSync(WIKI_DIR, { recursive: true, mode: 0o700 })
    for (const sub of WIKI_SUBDIRS) {
      mkdirSync(join(WIKI_DIR, sub), { recursive: true, mode: 0o700 })
    }
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== 'EEXIST') {
      console.warn('[KB Compiler] failed to create wiki dirs:', err)
    }
  }
}

// ── Compile State ────────────────────────────────────────────────────────────

/** Load compile state from disk. Returns defaults if missing/corrupted. */
function loadCompileState(): CompileState {
  try {
    const raw = readFileSync(COMPILE_STATE_PATH, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<CompileState>
    return {
      lastEventId: parsed.lastEventId ?? null,
      lastEventTimestamp: parsed.lastEventTimestamp ?? null,
      eventsCompiled: parsed.eventsCompiled ?? 0,
      tradeCount: parsed.tradeCount ?? 0,
    }
  } catch {
    return { lastEventId: null, lastEventTimestamp: null, eventsCompiled: 0, tradeCount: 0 }
  }
}

/** Save compile state to disk atomically. */
function saveCompileState(state: CompileState): void {
  const json = JSON.stringify(state, null, 2)
  const tmpPath = COMPILE_STATE_PATH + '.tmp'
  writeFileSync(tmpPath, json, { encoding: 'utf-8', mode: 0o600 })
  renameSync(tmpPath, COMPILE_STATE_PATH)
}

/** Delete compile state for full recompile. */
function deleteCompileState(): void {
  try {
    unlinkSync(COMPILE_STATE_PATH)
  } catch {
    // Already absent — fine
  }
}

// ── Consent Management ───────────────────────────────────────────────────────

/** Check if user has given LLM consent. */
function hasLLMConsent(): boolean {
  try {
    const value = readFileSync(CONSENT_PATH, 'utf-8').trim()
    return value === 'granted'
  } catch {
    return false
  }
}

/** Record consent decision. */
function saveLLMConsent(granted: boolean): void {
  const dir = dirname(CONSENT_PATH)
  mkdirSync(dir, { recursive: true })
  writeFileSync(CONSENT_PATH, granted ? 'granted' : 'declined', {
    encoding: 'utf-8',
    mode: 0o600,
  })
}

// ── Atomic File Write ────────────────────────────────────────────────────────

/**
 * Validate that a relative article path is safe (no path traversal).
 * Rejects paths containing '..', absolute paths, and resolved paths
 * that escape WIKI_DIR.
 */
function isSafeArticlePath(relativePath: string): boolean {
  if (relativePath.startsWith('/')) return false
  if (relativePath.includes('..')) return false
  const resolved = join(WIKI_DIR, relativePath)
  // Ensure the resolved path is still within WIKI_DIR
  // Use WIKI_DIR + '/' to prevent prefix collisions (e.g., wiki-evil/)
  if (!resolved.startsWith(WIKI_DIR + '/') && resolved !== WIKI_DIR) return false
  return true
}

/** Write a wiki article atomically. Creates parent dirs as needed. */
function writeArticle(relativePath: string, content: string): void {
  if (!isSafeArticlePath(relativePath)) {
    console.warn(`[KB Compiler] rejected unsafe article path: ${relativePath}`)
    return
  }
  const fullPath = join(WIKI_DIR, relativePath)
  const dir = dirname(fullPath)
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  const tmpPath = fullPath + '.tmp'
  writeFileSync(tmpPath, content, { encoding: 'utf-8', mode: 0o600 })
  renameSync(tmpPath, fullPath)
}

/** Read an existing wiki article, or return undefined if missing. */
function readArticle(relativePath: string): string | undefined {
  try {
    return readFileSync(join(WIKI_DIR, relativePath), 'utf-8')
  } catch {
    return undefined
  }
}

/** Parse LLM response as JSON array of wiki articles. */
function parseLLMArticles(text: string): WikiArticle[] | null {
  const direct = tryParseArticles(text)
  if (direct) return direct

  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (codeBlockMatch?.[1]) {
    const fromBlock = tryParseArticles(codeBlockMatch[1])
    if (fromBlock) return fromBlock
  }

  const bracketStart = text.indexOf('[')
  const bracketEnd = text.lastIndexOf(']')
  if (bracketStart >= 0 && bracketEnd > bracketStart) {
    const slice = text.slice(bracketStart, bracketEnd + 1)
    return tryParseArticles(slice)
  }

  return null
}

/** Attempt to parse a string as WikiArticle[]. Returns null on failure. */
function tryParseArticles(raw: string): WikiArticle[] | null {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return null
    const articles: WikiArticle[] = []
    for (const item of parsed) {
      if (isValidArticle(item)) articles.push(item)
    }
    return articles.length > 0 ? articles : null
  } catch {
    return null
  }
}

/** Type guard for a valid wiki article shape. Rejects unsafe paths. */
function isValidArticle(item: unknown): item is WikiArticle {
  if (typeof item !== 'object' || item === null) return false
  const obj = item as Record<string, unknown>
  if (typeof obj.path !== 'string' || typeof obj.content !== 'string') return false
  if (obj.path.length === 0 || obj.content.length === 0) return false
  // Reject path traversal attempts from LLM output
  if (!isSafeArticlePath(obj.path)) {
    console.warn(`[KB Compiler] rejected unsafe article path: ${obj.path}`)
    return false
  }
  return true
}

// ── LLM Compilation ─────────────────────────────────────────────────────────

let consecutiveLLMFailures = 0

/** Collect existing wiki content to pass as LLM context. */
function collectExistingWikiContext(): string | undefined {
  const sections: string[] = []
  const index = readArticle('INDEX.md')
  if (index) sections.push('## INDEX.md\n' + index)
  const profile = readArticle('self/profile.md')
  if (profile) sections.push('## self/profile.md\n' + profile)
  const overview = readArticle('patterns/overview.md')
  if (overview) sections.push('## patterns/overview.md\n' + overview)
  return sections.length > 0 ? sections.join('\n\n') : undefined
}

/** Compile events using the LLM. Returns articles or null on failure. */
async function compileWithLLM(
  events: KBEventUnion[],
  _apiKey: string,
): Promise<{ articles: WikiArticle[]; warnings: string[] } | null> {
  const existingWiki = collectExistingWikiContext()
  const prompt = buildCompilationPrompt(events, existingWiki)

  const result = await callGemini({ prompt, temperature: 0.3 })
  const responseText = result?.text ?? null
  if (!responseText) {
    consecutiveLLMFailures++
    return null
  }

  const articles = parseLLMArticles(responseText)
  if (!articles) {
    consecutiveLLMFailures++
    return null
  }

  consecutiveLLMFailures = 0
  const warnings: string[] = []
  return { articles, warnings }
}

// ── Template Mode ────────────────────────────────────────────────────────────

/** Generate wiki articles from pure statistics — no API needed. */
function compileWithTemplate(events: KBEventUnion[]): WikiArticle[] {
  const today = new Date().toISOString().slice(0, 10)
  const articles: WikiArticle[] = []

  const trades = events.filter((e): e is TradeLogEvent => e.type === 'trade_log')
  const patterns = events.filter(e => e.type === 'diary_pattern')
  const alerts = events.filter(e => e.type === 'alert')
  const regimes = events.filter(e => e.type === 'regime_change')

  articles.push(buildPatternsOverview(patterns, today))
  const symbolArticles = buildMarketArticles(trades, regimes, today)
  for (const a of symbolArticles) articles.push(a)
  articles.push(buildProfileArticle(trades, patterns, alerts, today))
  articles.push(buildIndexArticle(articles, today))

  return articles
}

/** Build the patterns overview article. */
function buildPatternsOverview(patterns: KBEventUnion[], date: string): WikiArticle {
  const counts: Record<string, number> = {}
  for (const p of patterns) {
    const pt = (p as { patternType?: string }).patternType ?? 'unknown'
    counts[pt] = (counts[pt] ?? 0) + 1
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
  const lines = sorted.map(([type, count]) => `| ${type} | ${count} |`)
  const content = [
    '---', `date: ${date}`, 'type: pattern', 'tags: [overview, patterns]', '---',
    '# Trading Patterns Overview', '', `Total pattern observations: ${patterns.length}`, '',
    '| Pattern | Count |', '|---------|-------|', ...lines, '',
    'See [[self/profile]] for how these patterns affect your trading profile.',
  ].join('\n')
  return { path: 'patterns/overview.md', content }
}

/** Build per-symbol market articles. */
function buildMarketArticles(trades: TradeLogEvent[], regimes: KBEventUnion[], date: string): WikiArticle[] {
  const bySymbol: Record<string, TradeLogEvent[]> = {}
  for (const t of trades) {
    if (!bySymbol[t.symbol]) bySymbol[t.symbol] = []
    bySymbol[t.symbol].push(t)
  }
  const articles: WikiArticle[] = []
  for (const [symbol, symbolTrades] of Object.entries(bySymbol)) {
    const stats = computeSymbolStats(symbolTrades)
    const symbolRegimes = regimes.filter(r => (r as { symbol?: string }).symbol === symbol)
    const safeName = symbol.replace(/\//g, '-')
    articles.push({ path: `markets/${safeName}.md`, content: formatMarketArticle(symbol, stats, symbolRegimes, date) })
  }
  return articles
}

interface SymbolStats {
  tradeCount: number; buyCount: number; sellCount: number
  winCount: number; lossCount: number; winRate: number
  totalPnL: number; avgPnL: number; bestTrade: number; worstTrade: number
}

/** Compute statistics for a set of trades on one symbol. */
function computeSymbolStats(trades: TradeLogEvent[]): SymbolStats {
  let winCount = 0, lossCount = 0, totalPnL = 0
  let bestTrade = -Infinity, worstTrade = Infinity
  let buyCount = 0, sellCount = 0
  for (const t of trades) {
    const pnl = t.netPnL ?? t.grossPnL ?? 0
    totalPnL += pnl
    if (pnl > 0) winCount++
    else if (pnl < 0) lossCount++
    if (pnl > bestTrade) bestTrade = pnl
    if (pnl < worstTrade) worstTrade = pnl
    if (t.side === 'buy') buyCount++; else sellCount++
  }
  const decided = winCount + lossCount
  return {
    tradeCount: trades.length, buyCount, sellCount, winCount, lossCount,
    winRate: decided > 0 ? (winCount / decided) * 100 : 0,
    totalPnL, avgPnL: trades.length > 0 ? totalPnL / trades.length : 0,
    bestTrade: bestTrade === -Infinity ? 0 : bestTrade,
    worstTrade: worstTrade === Infinity ? 0 : worstTrade,
  }
}

/** Format a market article from stats. */
function formatMarketArticle(symbol: string, stats: SymbolStats, regimes: KBEventUnion[], date: string): string {
  const lines = [
    '---', `date: ${date}`, 'type: market', `tags: [${symbol.replace(/\//g, ', ')}]`, '---',
    `# ${symbol} Analysis`, '', '## Statistics', '',
    '| Metric | Value |', '|--------|-------|',
    `| Total Trades | ${stats.tradeCount} |`, `| Buys | ${stats.buyCount} |`,
    `| Sells | ${stats.sellCount} |`, `| Win Rate | ${stats.winRate.toFixed(1)}% |`,
    `| Total PnL | ${stats.totalPnL.toFixed(2)} |`, `| Avg PnL | ${stats.avgPnL.toFixed(2)} |`,
    `| Best Trade | ${stats.bestTrade.toFixed(2)} |`, `| Worst Trade | ${stats.worstTrade.toFixed(2)} |`,
  ]
  if (regimes.length > 0) {
    lines.push('', '## Regime History', '')
    for (const r of regimes) {
      const rc = r as { oldRegime: string; newRegime: string; confidence: number }
      lines.push(`- ${r.timestamp.slice(0, 10)}: ${rc.oldRegime} -> ${rc.newRegime} (${(rc.confidence * 100).toFixed(0)}% confidence)`)
    }
  }
  lines.push('', 'See [[patterns/overview]] for behavioral patterns.', '')
  return lines.join('\n')
}

/** Build the trader profile article. */
function buildProfileArticle(trades: TradeLogEvent[], patterns: KBEventUnion[], alerts: KBEventUnion[], date: string): WikiArticle {
  const stats = computeSymbolStats(trades)
  const patternCounts: Record<string, number> = {}
  for (const p of patterns) {
    const pt = (p as { patternType?: string }).patternType ?? 'unknown'
    patternCounts[pt] = (patternCounts[pt] ?? 0) + 1
  }
  const topPatterns = Object.entries(patternCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const alertSeverities: Record<string, number> = {}
  for (const a of alerts) {
    const sev = (a as { severity?: string }).severity ?? 'UNKNOWN'
    alertSeverities[sev] = (alertSeverities[sev] ?? 0) + 1
  }
  const strengths = deriveStrengths(stats, patternCounts)
  const weaknesses = deriveWeaknesses(stats, patternCounts)
  const content = [
    '---', `date: ${date}`, 'type: profile', 'tags: [self, profile, risk]', '---',
    '# Trader Profile', '', '## Overview', '',
    `- **Total Trades**: ${trades.length}`, `- **Overall Win Rate**: ${stats.winRate.toFixed(1)}%`,
    `- **Total PnL**: ${stats.totalPnL.toFixed(2)}`, `- **Alerts Received**: ${alerts.length}`, '',
    '## Top Patterns', '', ...topPatterns.map(([type, count]) => `- **${type}**: ${count} occurrences`), '',
    '## Strengths', '', ...strengths.map(s => `- ${s}`), '',
    '## Areas for Improvement', '', ...weaknesses.map(w => `- ${w}`), '',
    '## Alert History', '', ...Object.entries(alertSeverities).map(([sev, count]) => `- **${sev}**: ${count} alerts`), '',
    'See [[patterns/overview]] for detailed pattern analysis.', '',
  ].join('\n')
  return { path: 'self/profile.md', content }
}

/** Derive strengths from trading stats and patterns. */
function deriveStrengths(stats: SymbolStats, patterns: Record<string, number>): string[] {
  const strengths: string[] = []
  if (stats.winRate >= 60) strengths.push('Strong win rate above 60%')
  if (stats.avgPnL > 0) strengths.push('Positive average PnL per trade')
  if (patterns.good_discipline && patterns.good_discipline >= 3) strengths.push('Consistent trading discipline observed')
  if (patterns.pyramid_good && patterns.pyramid_good >= 2) strengths.push('Effective position pyramiding')
  if (strengths.length === 0) strengths.push('Building trading history...')
  return strengths
}

/** Derive weaknesses from trading stats and patterns. */
function deriveWeaknesses(stats: SymbolStats, patterns: Record<string, number>): string[] {
  const weaknesses: string[] = []
  if (stats.winRate < 40 && stats.tradeCount >= 5) weaknesses.push('Win rate below 40% — review entry criteria')
  if (stats.avgPnL < 0) weaknesses.push('Negative average PnL — tighten risk management')
  if (patterns.revenge_trade && patterns.revenge_trade >= 2) weaknesses.push('Revenge trading pattern detected — add cooldown periods')
  if (patterns.fomo && patterns.fomo >= 2) weaknesses.push('FOMO entries detected — use limit orders instead')
  if (patterns.oversize && patterns.oversize >= 2) weaknesses.push('Position oversizing — reduce to 1-2% risk per trade')
  if (weaknesses.length === 0) weaknesses.push('No significant weaknesses detected yet')
  return weaknesses
}

/** Build the master INDEX.md article. */
function buildIndexArticle(articles: WikiArticle[], date: string): WikiArticle {
  const links: string[] = []
  for (const a of articles) {
    if (a.path === 'INDEX.md') continue
    const title = extractTitleFromContent(a.content)
    const wikilink = a.path.replace(/\.md$/, '')
    links.push(`- [[${wikilink}|${title}]]`)
  }
  const content = [
    '---', `date: ${date}`, 'type: index', 'tags: [index, wiki]', '---',
    '# Vibe Sensei Knowledge Base', '',
    'Your personal trading knowledge base, compiled from trading events.', '',
    '## Articles', '', ...links, '', `*Last compiled: ${date}*`, '',
  ].join('\n')
  return { path: 'INDEX.md', content }
}

/** Extract the first H1 title from markdown content. */
function extractTitleFromContent(content: string): string {
  const match = content.match(/^# (.+)$/m)
  return match?.[1] ?? 'Untitled'
}

// ── Main Compile Function ────────────────────────────────────────────────────

export async function compile(opts?: { full?: boolean }): Promise<CompileResult> {
  ensureWikiDirs()
  if (opts?.full) deleteCompileState()

  const state = loadCompileState()
  const allEvents = await readEvents()
  const newEvents = filterNewEvents(allEvents, state)

  if (newEvents.length === 0) {
    return { articlesUpdated: 0, eventsProcessed: 0, mode: 'template', warnings: ['No new events to compile'] }
  }

  const apiKey = process.env.GEMINI_API_KEY ?? ''
  const hasKey = apiKey.length > 0
  const hasConsent = hasLLMConsent()
  let mode: 'gemini' | 'template' = 'template'
  let articles: WikiArticle[] = []
  const warnings: string[] = []

  if (hasKey && hasConsent) {
    mode = 'gemini'
    // Pass ALL events to LLM so it has full context for analysis.
    // The LLM prompt includes existing wiki content for incremental updates.
    const llmResult = await compileWithLLM(allEvents, apiKey)
    if (llmResult) {
      articles = llmResult.articles
      warnings.push(...llmResult.warnings)
    } else {
      mode = 'template'
      warnings.push('LLM compilation failed, using template mode')
      if (consecutiveLLMFailures >= 3) {
        warnings.push('WARNING: 3+ consecutive LLM failures — check API key and quota')
      }
      // Template mode does statistical aggregation — must use ALL events
      // to avoid erasing historical data with only new events.
      articles = compileWithTemplate(allEvents)
    }
  } else {
    // Template mode does statistical aggregation — must use ALL events
    // to avoid erasing historical data with only new events.
    articles = compileWithTemplate(allEvents)
  }

  for (const article of articles) writeArticle(article.path, article.content)

  const lastEvent = newEvents[newEvents.length - 1]!
  saveCompileState({
    lastEventId: lastEvent.id,
    lastEventTimestamp: lastEvent.timestamp,
    eventsCompiled: state.eventsCompiled + newEvents.length,
    tradeCount: state.tradeCount + newEvents.filter(e => e.type === 'trade_log').length,
  })

  return { articlesUpdated: articles.length, eventsProcessed: newEvents.length, mode, warnings }
}

/** Filter events to only those after the last compiled event. */
function filterNewEvents(allEvents: KBEventUnion[], state: CompileState): KBEventUnion[] {
  if (!state.lastEventTimestamp) return allEvents
  const lastId = state.lastEventId
  let startIdx = -1
  for (let i = 0; i < allEvents.length; i++) {
    if (allEvents[i]!.id === lastId) { startIdx = i; break }
  }
  if (startIdx >= 0) return allEvents.slice(startIdx + 1)
  return allEvents.filter(e => e.timestamp > state.lastEventTimestamp!)
}

// ── Consent Flow ─────────────────────────────────────────────────────────────

export async function requestLLMConsent(): Promise<boolean> {
  if (hasLLMConsent()) return true

  console.log('Vibe Sensei will send anonymized trading data to Gemini for analysis. Continue? (y/n)')

  const isInteractive = process.stdin.isTTY ?? false
  if (!isInteractive) { saveLLMConsent(false); return false }

  return new Promise<boolean>((resolve) => {
    const onData = (data: Buffer) => {
      const answer = data.toString().trim().toLowerCase()
      process.stdin.removeListener('data', onData)
      process.stdin.pause()
      if (answer === 'y' || answer === 'yes') { saveLLMConsent(true); resolve(true) }
      else { saveLLMConsent(false); resolve(false) }
    }
    process.stdin.resume()
    process.stdin.once('data', onData)
    setTimeout(() => {
      process.stdin.removeListener('data', onData)
      process.stdin.pause()
      saveLLMConsent(false)
      resolve(false)
    }, 30_000)
  })
}

// ── Auto-Trigger ─────────────────────────────────────────────────────────────

export function shouldAutoCompile(): boolean {
  try {
    const state = loadCompileState()
    const nextCount = state.tradeCount + 1
    return nextCount > 0 && nextCount % AUTO_COMPILE_INTERVAL === 0
  } catch { return false }
}

export async function autoCompile(): Promise<string | null> {
  try {
    const result = await compile()
    if (result.articlesUpdated > 0) {
      return `[KB] Knowledge base updated: ${result.articlesUpdated} articles (${result.mode} mode)`
    }
    return null
  } catch { return null }
}

export function incrementTradeCount(): void {
  try {
    const state = loadCompileState()
    state.tradeCount = (state.tradeCount ?? 0) + 1
    saveCompileState(state)
  } catch {
    // Non-fatal — never block trading
  }
}
