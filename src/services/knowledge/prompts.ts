/**
 * Knowledge Compiler — Gemini compilation prompts.
 *
 * Builds structured prompts for Gemini 2.5 Flash to analyze trading events
 * and generate/update wiki articles in Obsidian-compatible markdown.
 *
 * Token budget: ~4000 tokens for events, ~2000 for existing wiki context.
 */

import type { KBEventUnion } from './types.js'

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_EVENTS_CHARS = 12_000 // ~4000 tokens
const MAX_WIKI_CHARS = 6_000 // ~2000 tokens

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Build a compilation prompt for Gemini to analyze trading events.
 *
 * @param events - New events to compile
 * @param existingWiki - Optional existing wiki content for incremental updates
 * @returns The full prompt string
 */
export function buildCompilationPrompt(
  events: KBEventUnion[],
  existingWiki?: string,
): string {
  const eventsBlock = formatEventsBlock(events)
  const wikiBlock = existingWiki
    ? truncateToLimit(existingWiki, MAX_WIKI_CHARS)
    : ''

  return [
    SYSTEM_INSTRUCTIONS,
    '',
    '--- TRADING EVENTS ---',
    eventsBlock,
    ...(wikiBlock
      ? ['', '--- EXISTING WIKI CONTEXT ---', wikiBlock]
      : []),
    '',
    '--- OUTPUT FORMAT ---',
    OUTPUT_FORMAT_INSTRUCTIONS,
  ].join('\n')
}

// ── Prompt Fragments ─────────────────────────────────────────────────────────

const SYSTEM_INSTRUCTIONS = `You are a trading analyst compiling a knowledge base from trading event data.
Analyze the trading events below and generate wiki articles in markdown format.

Your tasks:
1. Identify behavioral patterns (revenge trading, FOMO, good discipline, etc.)
2. Compute per-symbol statistics (win rate, average PnL, trade frequency)
3. Build a trader profile (strengths, weaknesses, risk tolerance, biases)
4. Summarize session activity and key decisions
5. Cross-reference with existing wiki content if provided (update, don't duplicate)

Rules:
- Use [[wikilinks]] for cross-references between articles (Obsidian-compatible)
- Include YAML frontmatter with date, type, and tags
- Be concise but insightful — focus on actionable observations
- Never fabricate statistics — only use data from the events provided
- If data is insufficient for a section, omit it entirely`

const OUTPUT_FORMAT_INSTRUCTIONS = `Respond with a valid JSON array of articles. Each article has:
- "path": relative file path (e.g., "patterns/revenge-trading.md", "markets/BTC-USDT.md")
- "content": full markdown content including YAML frontmatter

Example:
[
  {
    "path": "patterns/overview.md",
    "content": "---\\ndate: 2026-04-02\\ntype: pattern\\ntags: [overview]\\n---\\n# Trading Patterns\\n\\n..."
  },
  {
    "path": "markets/BTC-USDT.md",
    "content": "---\\ndate: 2026-04-02\\ntype: market\\ntags: [BTC, USDT]\\n---\\n# BTC/USDT Analysis\\n\\n..."
  }
]

Generate articles for:
- patterns/overview.md (all detected patterns with counts)
- markets/<SYMBOL>.md for each traded symbol (stats, regime history)
- self/profile.md (trader profile: archetype, biases, strengths, weaknesses)
- sessions/latest.md (summary of the current batch of events)
- INDEX.md (master index linking all articles)

Only output the JSON array — no extra text before or after.`

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Format events into a compact text block, respecting token budget. */
function formatEventsBlock(events: KBEventUnion[]): string {
  const lines: string[] = []
  let totalChars = 0

  for (const event of events) {
    const line = formatSingleEvent(event)
    if (totalChars + line.length > MAX_EVENTS_CHARS) break
    lines.push(line)
    totalChars += line.length
  }

  return lines.join('\n')
}

/** Format a single event into a compact one-line representation. */
function formatSingleEvent(event: KBEventUnion): string {
  const ts = event.timestamp.slice(0, 16) // trim seconds
  const base = `[${ts}] ${event.type}`

  switch (event.type) {
    case 'trade_log':
      return `${base} | ${event.side} ${event.symbol} qty=${event.quantity} price=${event.price}${event.netPnL !== undefined ? ` pnl=${event.netPnL.toFixed(2)}` : ''}`
    case 'alert':
      return `${base} | ${event.severity} ${event.checkName}: ${event.message.slice(0, 100)}`
    case 'ghost':
      return `${base} | ${event.ghostName}: ${event.triggerReason.slice(0, 80)}`
    case 'regime_change':
      return `${base} | ${event.symbol} ${event.oldRegime}->${event.newRegime} (${(event.confidence * 100).toFixed(0)}%)`
    case 'circuit_breaker':
      return `${base} | ${event.breakerType}`
    case 'gate_check':
      return `${base} | ${event.symbol} ${event.side} ${event.status} fail=${event.failCount} warn=${event.warnCount}`
    case 'diary_pattern':
      return `${base} | ${event.symbol} ${event.side} pattern=${event.patternType}${event.outcome ? ` outcome=${event.outcome}` : ''}`
    default:
      return `${base} | ${JSON.stringify(event).slice(0, 120)}`
  }
}

/** Truncate text to a character limit, preserving complete lines. */
function truncateToLimit(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text

  const truncated = text.slice(0, maxChars)
  const lastNewline = truncated.lastIndexOf('\n')
  if (lastNewline > maxChars * 0.5) {
    return truncated.slice(0, lastNewline) + '\n[... truncated]'
  }
  return truncated + '\n[... truncated]'
}
