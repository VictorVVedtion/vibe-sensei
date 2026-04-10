/**
 * Sentiment brief synthesizer — turns a SentimentBrief from the aggregator
 * into a master-voice narrative that the REPL can render and the debate
 * engine can inject.
 *
 * Template-based, no LLM call. The "voice" comes from archetype-flavored
 * framing words (PreTradeGateTool already uses this pattern for debate
 * stances). v2 can swap in an LLM enrichment layer; v1 keeps zero-latency
 * parity with the rest of the buddy stack.
 */

import { getMasterArchetype, type Archetype } from '../../buddy/persona.js'
import { MASTER_NAMES, type Master } from '../../buddy/types.js'
import { setCachedBrief } from './cache.js'
import type { SentimentBrief, SourceResult } from './types.js'

// ── Archetype framing — terse opening / closing lines per archetype ────────

interface ArchetypeFraming {
  openingBuzz: string
  openingQuiet: string
  bullishLine: string
  bearishLine: string
  mixedLine: string
}

const ARCHETYPE_FRAMING: Record<Archetype, ArchetypeFraming> = {
  value_investor: {
    openingBuzz: 'The market is talking. Whether it should is another question.',
    openingQuiet: 'No one is talking about this. That is often when intrinsic value lives.',
    bullishLine: 'Consensus is bullish — exactly when margin of safety matters most.',
    bearishLine: 'Crowd fear creates opportunity for the patient buyer.',
    mixedLine: 'Mixed signals. The fundamentals are still the only honest tell.',
  },
  trend_follower: {
    openingBuzz: 'Volume in the chatter and volume in the tape — check both.',
    openingQuiet: 'Silence on the boards usually means the trend has not arrived yet.',
    bullishLine: 'Momentum across narratives. Let winners run, but trail your stop.',
    bearishLine: 'Crowd is leaning short. Trend may be your friend; respect it.',
    mixedLine: 'No clean trend in the noise. Stand aside or trade smaller.',
  },
  macro_trader: {
    openingBuzz: 'Reflexivity at work — narrative and price feed each other.',
    openingQuiet: 'Quiet on the wires. Macro setups often build in silence first.',
    bullishLine: 'The reflexive loop is bullish. Position size matters more than direction now.',
    bearishLine: 'Crowd consensus is bearish — perfect setup for a regime flip.',
    mixedLine: 'Cross-currents. Wait for the macro to confirm the chatter.',
  },
  quant: {
    openingBuzz: 'Sentiment is a feature, not a thesis. Read the numbers.',
    openingQuiet: 'Low signal. The model has nothing to chew on yet.',
    bullishLine: 'Engagement skewed positive. One factor among many — never override the system.',
    bearishLine: 'Negative tilt across sources. Note the prior, do not act on it alone.',
    mixedLine: 'Conflicting features. Trust the model, not the noise.',
  },
  strategist: {
    openingBuzz: 'Know the terrain before you engage. Here is the terrain.',
    openingQuiet: 'The battlefield is empty. That itself is information.',
    bullishLine: 'The crowd has chosen its side. Position yourself accordingly — or against.',
    bearishLine: 'Fear is the dominant terrain. Tactical retreat is not defeat.',
    mixedLine: 'Mixed terrain. Hold position and observe the next move.',
  },
  philosopher: {
    openingBuzz: 'The crowd is loud. Loudness is rarely a virtue.',
    openingQuiet: 'Quiet markets are antifragile markets. Pay attention.',
    bullishLine: 'Universal optimism is a stress test waiting to happen.',
    bearishLine: 'Universal fear has buried tail risk. Survival comes first.',
    mixedLine: 'Disagreement is healthy. Size like you might be wrong.',
  },
  first_principles: {
    openingBuzz: 'Strip away the noise. What does the data actually say?',
    openingQuiet: 'No consensus yet. That is when first-principles thinking pays.',
    bullishLine: 'Crowd agrees with you — verify the underlying thesis hardens, not the narrative.',
    bearishLine: 'Crowd disagrees. Either the thesis is wrong or the edge is here.',
    mixedLine: 'The noise has no signal. Return to the underlying mechanics.',
  },
  crypto_native: {
    openingBuzz: 'The timeline is loud. Narrative cycles eat fundamentals for breakfast.',
    openingQuiet: 'Quiet on Crypto Twitter. Alpha lives here.',
    bullishLine: 'Narrative is on. Ride it, but know the unwind will be fast.',
    bearishLine: 'Capitulation in the chat. Fear phases are accumulation phases.',
    mixedLine: 'Conflicting narratives. Stay liquid until one side wins.',
  },
  scientist: {
    openingBuzz: 'The error bars on social sentiment are wide. Treat as a hypothesis, not a result.',
    openingQuiet: 'Insufficient data to reject the null. Keep observing.',
    bullishLine: 'Positive skew across samples. Note the bias before acting on the mean.',
    bearishLine: 'Negative skew. Do not confuse correlation with causation.',
    mixedLine: 'High variance, low signal. The experiment is inconclusive.',
  },
}

// ── Source label / glyph map ──────────────────────────────────────────────

const SOURCE_LABELS: Record<SourceResult['source'], string> = {
  reddit: 'REDDIT',
  hackernews: 'HACKER NEWS',
  polymarket: 'POLYMARKET',
  youtube: 'YOUTUBE',
}

function signalGlyph(signal: number): string {
  if (signal > 0.4) return '▲▲'
  if (signal > 0.1) return '▲'
  if (signal < -0.4) return '▼▼'
  if (signal < -0.1) return '▼'
  return '─'
}

function signalLabel(signal: number): string {
  if (signal > 0.4) return 'strong bullish buzz'
  if (signal > 0.1) return 'mild bullish buzz'
  if (signal < -0.4) return 'strong bearish buzz'
  if (signal < -0.1) return 'mild bearish buzz'
  return 'neutral'
}

function archetypeOpening(archetype: Archetype, brief: SentimentBrief): string {
  const totalSnippets = brief.sources.reduce((acc, s) => acc + s.snippets.length, 0)
  const framing = ARCHETYPE_FRAMING[archetype]
  // 3+ snippets across all sources is enough signal to call it "buzz".
  // Below that, the brief has too little to chew on — frame it as "quiet".
  return totalSnippets >= 3 ? framing.openingBuzz : framing.openingQuiet
}

function archetypeClosing(archetype: Archetype, composite: number): string {
  const framing = ARCHETYPE_FRAMING[archetype]
  if (composite > 0.2) return framing.bullishLine
  if (composite < -0.2) return framing.bearishLine
  return framing.mixedLine
}

// ── Section renderers ────────────────────────────────────────────────────

function renderSourceSection(result: SourceResult): string {
  const label = SOURCE_LABELS[result.source]
  const glyph = signalGlyph(result.aggregateSignal)
  const tag = signalLabel(result.aggregateSignal)
  const header = `[${label}] ${glyph} ${tag}`

  if (result.snippets.length === 0) {
    const reason = result.error ?? 'no recent activity'
    return `${header}\n  · ${reason}`
  }

  const top = result.snippets.slice(0, 3)
  const rows = top.map(s => {
    const score = s.score > 0 ? `(${s.score})` : ''
    const title = s.title.length > 80 ? `${s.title.slice(0, 77)}...` : s.title
    return `  · ${title} ${score}`.trim()
  })
  return [header, ...rows].join('\n')
}

// ── Public API ────────────────────────────────────────────────────────────

export interface SynthesizeContext {
  master: Master
}

/**
 * Render the brief into a sectioned narrative in the user's master voice.
 * Mutates the brief in place (sets narrative + plainText) and re-caches it
 * so the debate engine can pick up the plain-text version.
 *
 * Returns the same brief reference.
 */
export function synthesizeBrief(
  brief: SentimentBrief,
  ctx: SynthesizeContext,
): SentimentBrief {
  const archetype = getMasterArchetype(ctx.master)
  const masterName = MASTER_NAMES[ctx.master]

  const opening = archetypeOpening(archetype, brief)
  const closing = archetypeClosing(archetype, brief.composite)

  const sourceSections = brief.sources.map(renderSourceSection).join('\n\n')

  const compositeLine = `[COMPOSITE] ${signalGlyph(brief.composite)} ${signalLabel(brief.composite)} (${brief.composite.toFixed(2)})`

  const narrative = [
    `${masterName} on ${brief.symbol} — last ${brief.lookbackDays} days:`,
    '',
    `  "${opening}"`,
    '',
    sourceSections,
    '',
    compositeLine,
    '',
    `  — ${masterName}: ${closing}`,
  ].join('\n')

  // Plain-text version for debate injection — strip section glyphs but keep
  // the substance. Debate stances are short, so we boil it down to one line.
  const plainText = buildPlainText(brief, masterName, closing)

  brief.narrative = narrative
  brief.plainText = plainText
  setCachedBrief(brief.symbol, brief)
  return brief
}

/**
 * Build the compact one-line summary that gets injected into debate stances.
 * Used by PreTradeGateTool to flavor the FOR/AGAINST template strings.
 */
function buildPlainText(
  brief: SentimentBrief,
  masterName: string,
  closing: string,
): string {
  const activeSources = brief.sources
    .filter(s => s.snippets.length > 0)
    .map(s => `${SOURCE_LABELS[s.source]} ${signalGlyph(s.aggregateSignal)}`)
    .join(' · ')

  const compositeWord = signalLabel(brief.composite)
  const head = activeSources
    ? `Sentiment (last ${brief.lookbackDays}d): ${compositeWord} — ${activeSources}.`
    : `Sentiment (last ${brief.lookbackDays}d): no recent signal across tracked sources.`

  return `${head} ${masterName} reads it: "${closing}"`
}
