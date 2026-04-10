/**
 * Morning Brief — personalized daily startup summary from the wiki.
 *
 * Generates a 5-line briefing on the first startup of each day:
 *   1. Current market regime + historical win rate in that regime
 *   2. Top behavioral pattern reminder
 *   3. Discipline streak count
 *   4. Advice accuracy highlight
 *
 * Speaks in the Guardian’s personality voice. Uses LLM (Flash model) for
 * personalized voice when API key is available, falls back to template.
 *
 * Graceful degradation: returns null if wiki doesn’t exist, data is
 * insufficient, or brief was already shown today.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { readEvents } from './event-store.js'
import { callGemini } from './gemini-client.js'
import { getWikiHealthScore } from './auditor.js'
import { getAdviceAccuracy } from './counterfactual.js'
import type { KBEventUnion, TradeLogEvent, DiaryPatternEvent } from './types.js'

// Constants
const VIBE_DIR = join(homedir(), '.vibe-sensei')
const LAST_BRIEF_PATH = join(VIBE_DIR, '.last-brief-date')
const WIKI_DIR = join(VIBE_DIR, 'wiki')

function todayString(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function alreadyShownToday(): boolean {
  try {
    const last = readFileSync(LAST_BRIEF_PATH, 'utf-8').trim()
    return last === todayString()
  } catch {
    return false
  }
}

function markShownToday(): void {
  try {
    mkdirSync(VIBE_DIR, { recursive: true })
    writeFileSync(LAST_BRIEF_PATH, todayString(), {
      encoding: 'utf-8',
      mode: 0o600,
    })
  } catch {
    // Non-fatal
  }
}

interface BriefData {
  regimeLine: string
  patternLine: string
  disciplineLine: string
  accuracyLine: string
  healthLine: string
}

async function collectBriefData(): Promise<BriefData | null> {
  const events = await readEvents()
  if (events.length < 3) return null
  const regimeLine = buildRegimeLine(events)
  const patternLine = buildPatternLine(events)
  const disciplineLine = buildDisciplineLine(events)
  const accuracyLine = await buildAccuracyLine()
  const healthLine = await buildHealthLine()
  return { regimeLine, patternLine, disciplineLine, accuracyLine, healthLine }
}

function buildRegimeLine(events: KBEventUnion[]): string {
  const regimeEvents = events.filter(e => e.type === 'regime_change')
  const trades = events.filter(
    (e): e is TradeLogEvent => e.type === 'trade_log',
  )
  const winRate = computeWinRate(trades)
  if (regimeEvents.length === 0) {
    return `Overall win rate: ${winRate}%`
  }
  const latest = regimeEvents[regimeEvents.length - 1]!
  const regime = (latest as { newRegime: string }).newRegime
  return `Market regime: ${regime}. Your win rate: ${winRate}%`
}

function computeWinRate(trades: TradeLogEvent[]): number {
  if (trades.length === 0) return 0
  let wins = 0
  let decided = 0
  for (const t of trades) {
    const pnl = t.netPnL ?? t.grossPnL ?? 0
    if (pnl > 0) { wins++; decided++ }
    else if (pnl < 0) { decided++ }
  }
  return decided > 0 ? Math.round((wins / decided) * 100) : 0
}

function buildPatternLine(events: KBEventUnion[]): string {
  const patterns = events.filter(
    (e): e is DiaryPatternEvent => e.type === 'diary_pattern',
  )
  if (patterns.length === 0) return 'No behavioral patterns detected yet'
  const counts: Record<string, number> = {}
  for (const p of patterns) {
    const pt = p.patternType ?? 'general'
    if (pt === 'general') continue
    counts[pt] = (counts[pt] ?? 0) + 1
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
  if (sorted.length === 0) return 'Building pattern history...'
  const [topPattern, topCount] = sorted[0]!
  const label = topPattern.replace(/_/g, ' ')
  return `Top pattern: ${label} (${topCount}x). Stay aware of this tendency`
}

function buildDisciplineLine(events: KBEventUnion[]): string {
  const patterns = events.filter(
    (e): e is DiaryPatternEvent => e.type === 'diary_pattern',
  )
  const daySet = new Set<string>()
  for (const p of patterns) {
    if (p.patternType === 'good_discipline') {
      daySet.add(p.timestamp.slice(0, 10))
    }
  }
  if (daySet.size === 0) return 'Discipline streak: building...'
  const days = Array.from(daySet).sort().reverse()
  const today = todayString()
  const yesterday = shiftDate(today, -1)
  const checkStart = days[0]!
  if (checkStart !== today && checkStart !== yesterday) {
    return `Discipline: ${daySet.size} days total with good discipline`
  }
  let streak = 0
  let expected = checkStart
  for (const day of days) {
    if (day === expected) {
      streak++
      expected = shiftDate(day, -1)
    } else {
      break
    }
  }
  if (streak >= 7) {
    return `Discipline streak: ${streak} days! Outstanding consistency`
  }
  if (streak >= 3) {
    return `Discipline streak: ${streak} days. Keep it going`
  }
  return `Discipline streak: ${streak} day${streak === 1 ? '' : 's'}`
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

async function buildAccuracyLine(): Promise<string> {
  try {
    const accuracy = await getAdviceAccuracy()
    if (accuracy.totalAlerts === 0) return 'Advice accuracy: no alerts yet'
    const heededPct = Math.round(accuracy.heededRate * 100)
    const trendLabel =
      accuracy.trend === 'improving' ? '(improving)'
        : accuracy.trend === 'declining' ? '(declining)' : ''
    return `Advice heeded: ${heededPct}% of ${accuracy.totalAlerts} alerts ${trendLabel}`.trim()
  } catch {
    return 'Advice accuracy: calculating...'
  }
}

async function buildHealthLine(): Promise<string> {
  try {
    const health = await getWikiHealthScore()
    if (health.totalEvents === 0) return 'Knowledge base: empty'
    return `Knowledge base: ${health.overall}% health (${health.totalEvents} events, ${health.completeness}% compiled)`
  } catch {
    return 'Knowledge base: not yet initialized'
  }
}

async function rephraseWithLLM(
  briefData: BriefData,
  masterName: string,
  archetype: string,
  _apiKey: string,
): Promise<string | null> {
  const rawBrief = [
    briefData.regimeLine, briefData.patternLine,
    briefData.disciplineLine, briefData.accuracyLine,
    briefData.healthLine,
  ].join('\n')
  const prompt = [
    `You are ${masterName}, a ${archetype} trading guardian.`,
    'Rephrase this morning brief in your distinctive voice and personality.',
    'Keep it exactly 5 lines, concise and motivational. Stay in character.',
    'Do not add markdown formatting or bullet points. Plain text only.',
    '', rawBrief,
  ].join('\n')
  const result = await callGemini({
    prompt,
    temperature: 0.7,
    maxTokens: 300,
    timeoutMs: 15_000,
  })
  if (!result) return null
  const text = result.text.trim()
  return text.length > 10 ? text : null
}

function formatTemplateBrief(briefData: BriefData, masterName: string): string {
  return [
    `${masterName} \u2014 Morning Brief`,
    briefData.regimeLine, briefData.patternLine,
    briefData.disciplineLine, briefData.accuracyLine,
  ].join('\n')
}

export async function generateMorningBrief(
  masterName: string,
  archetype: string,
): Promise<string | null> {
  try {
    if (alreadyShownToday()) return null

    // Auto-compile wiki if events exist but wiki hasn't been built yet
    const compileStatePath = join(WIKI_DIR, '.compile-state.json')
    if (!existsSync(compileStatePath)) {
      try {
        const events = await readEvents()
        if (events.length >= 3) {
          const { compile } = await import('./compiler.js')
          await compile()
        }
      } catch {
        // Auto-compile is best-effort — never block morning brief
      }
    }

    if (!existsSync(WIKI_DIR)) return null
    const briefData = await collectBriefData()
    if (!briefData) return null
    const apiKey = process.env.GEMINI_API_KEY ?? ''
    let brief: string
    if (apiKey.length > 0) {
      const voiced = await rephraseWithLLM(briefData, masterName, archetype, apiKey)
      brief = voiced ?? formatTemplateBrief(briefData, masterName)
    } else {
      brief = formatTemplateBrief(briefData, masterName)
    }
    markShownToday()
    return brief
  } catch {
    return null
  }
}
