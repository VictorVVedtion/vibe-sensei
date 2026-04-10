/**
 * Weekly Review Coach — template-based weekly performance review in guardian voice.
 *
 * Aggregates diary entries and trade reports for the past 7 days, computes
 * per-venue R-multiple stats, detects cross-vertical behavioral biases,
 * and formats everything through the assigned guardian's archetype voice.
 * Zero LLM calls — all text is template-driven.
 */

import type { DiaryEntry, CumulativeStats } from './diary.js'
import type { TradeReport } from './trade-report.js'
import type { Master } from './types.js'
import { MASTER_NAMES } from './types.js'
import type { Archetype } from './persona.js'
import { getMasterArchetype } from './persona.js'
import type { AssetVertical } from '../services/portfolio/valuation.js'

// ── Types ────────────────────────────────────────────────────────────────────

export interface VenueStats {
  venue: AssetVertical
  winRate: number
  avgR: number
  bestTrade: { symbol: string; rMultiple: number } | null
  worstTrade: { symbol: string; rMultiple: number } | null
  totalTrades: number
  totalPnL: number
}

export interface CrossVerticalInsight {
  type: 'aggression_mismatch' | 'venue_avoidance' | 'concentration'
  message: string
}

export interface WeeklyReviewReport {
  periodStart: Date
  periodEnd: Date
  masterName: string
  archetype: Archetype
  venueStats: VenueStats[]
  crossVerticalInsights: CrossVerticalInsight[]
  overallStats: CumulativeStats
  reviewText: string
  isQuietWeek: boolean
}

// ── Constants ────────────────────────────────────────────────────────────────

const MS_7_DAYS = 7 * 24 * 60 * 60 * 1000

const VENUE_LABELS: Record<AssetVertical, string> = {
  spot: 'Spot',
  perp_futures: 'Futures',
  crypto_options: 'Options',
  stocks: 'Stocks',
  prediction: 'Prediction',
  defi_dex: 'DeFi',
  forex: 'Forex',
}

// ── Archetype Quote Templates ────────────────────────────────────────────────

interface ArchetypeTemplates {
  weekIntro: string
  quietWeek: string
  winStreak: string
  lossStreak: string
  mixedWeek: string
  closing: string
}

const ARCHETYPE_TEMPLATES: Record<Archetype, ArchetypeTemplates> = {
  value_investor: {
    weekIntro: 'Let us review this week through the lens of intrinsic value.',
    quietWeek: 'A quiet week. Patience is not inaction — it is the highest form of action.',
    winStreak: 'The market rewarded discipline this week. Do not let it breed overconfidence.',
    lossStreak: 'Losses are tuition. The question is: did you buy quality at fair prices?',
    mixedWeek: 'A mixed week. Focus on the process, not the outcome.',
    closing: 'Remember: price is what you pay, value is what you get.',
  },
  trend_follower: {
    weekIntro: 'Weekly tape review — let the price tell the story.',
    quietWeek: 'No signals, no trades. The trend will return. Stay ready.',
    winStreak: 'The trend was your friend this week. Let the winners run further.',
    lossStreak: 'Whipsaws happen. Cut faster next time. The trend will set up again.',
    mixedWeek: 'Choppy price action this week. Tighten your filters.',
    closing: 'Follow the tape. It never lies.',
  },
  macro_trader: {
    weekIntro: 'Macro review — how did the regime shape your P&L this week?',
    quietWeek: 'Quiet macro week. Powder dry. The next regime shift is loading.',
    winStreak: 'You read the macro correctly. Size was right. Well done.',
    lossStreak: 'The macro shifted against you. Did you respect the stop? Sizing is everything.',
    mixedWeek: 'A transitional week. The macro picture is still forming.',
    closing: 'In macro, being early is the same as being wrong. Timing matters.',
  },
  quant: {
    weekIntro: 'Weekly performance metrics — let the numbers speak.',
    quietWeek: 'No edge detected. The model stayed flat. This is correct behavior.',
    winStreak: 'Positive expectancy held. The system is performing within parameters.',
    lossStreak: 'Drawdown within model bounds? If yes, trust the system. If no, recalibrate.',
    mixedWeek: 'Variance is normal. Sample size is still small. Continue.',
    closing: 'Trust the model. Override it at your peril.',
  },
  strategist: {
    weekIntro: 'Weekly battlefield assessment — terrain, timing, and positioning.',
    quietWeek: 'No battle this week. The wise general fights only when victory is certain.',
    winStreak: 'Superior positioning paid off. Do not pursue a retreating enemy too far.',
    lossStreak: 'A tactical defeat. Regroup. Reassess the terrain before re-engaging.',
    mixedWeek: 'Mixed results reveal unclear terrain. Gather more intelligence.',
    closing: 'Know the terrain. Know yourself. Victory follows.',
  },
  philosopher: {
    weekIntro: 'Weekly reflection — what did the market teach us about ourselves?',
    quietWeek: 'Stillness is strength. The antifragile trader waits.',
    winStreak: 'Profit is fragile. Do not mistake luck for skill this week.',
    lossStreak: 'Pain is information. What does this week reveal about your blind spots?',
    mixedWeek: 'The barbell held. Some chaos, some stability. This is the way.',
    closing: 'Survive first. Philosophize later.',
  },
  first_principles: {
    weekIntro: 'Weekly review from first principles — strip away the noise.',
    quietWeek: 'No conviction, no trade. First principles demand clarity.',
    winStreak: 'Your thesis was correct. But ask: was it the thesis or was it luck?',
    lossStreak: 'Go back to atoms. Which assumption broke? Fix the foundation.',
    mixedWeek: 'Mixed signals suggest your model needs refinement. Think harder.',
    closing: 'Reason from fundamentals. Everything else is noise.',
  },
  crypto_native: {
    weekIntro: 'Weekly on-chain review — narratives, flows, and alpha.',
    quietWeek: 'Bear market quiet. Build. The narrative cycle will rotate.',
    winStreak: 'You caught the narrative. Now the question: is it priced in yet?',
    lossStreak: 'Rekt this week. Lesson: leverage kills. Stay liquid.',
    mixedWeek: 'Mixed week in crypto. Par for the course. Manage your risk.',
    closing: 'Stay liquid. Stay paranoid. The next cycle rewards the survivors.',
  },
  scientist: {
    weekIntro: 'Weekly experimental results — hypothesis vs reality.',
    quietWeek: 'No experiment run. Observation period continues. Data collection in progress.',
    winStreak: 'Results support the hypothesis. But n=1 week is not statistically significant.',
    lossStreak: 'The experiment failed. Record observations. Adjust variables.',
    mixedWeek: 'Noisy data. Increase sample size before drawing conclusions.',
    closing: 'Data over narrative. Always.',
  },
}

// ── Venue Classification ─────────────────────────────────────────────────────

function classifyVenue(symbol: string): AssetVertical {
  const upper = symbol.toUpperCase()
  if (upper.includes('PERP') || upper.includes('-SWAP')) return 'perp_futures'
  if (upper.includes('CALL') || upper.includes('PUT') || upper.includes('-C-') || upper.includes('-P-')) return 'crypto_options'
  if (upper.includes('/USD') && !upper.includes('USDT') && !upper.includes('USDC')) return 'forex'
  if (upper.includes('POLYMARKET') || upper.includes('PRED')) return 'prediction'
  if (upper.includes('UNI-') || upper.includes('AAVE-') || upper.includes('LP')) return 'defi_dex'
  return 'spot'
}

// ── Per-Venue Stats Computation ──────────────────────────────────────────────

function computeVenueStats(reports: TradeReport[]): VenueStats[] {
  const byVenue = new Map<AssetVertical, TradeReport[]>()

  for (const report of reports) {
    const venue = classifyVenue(report.symbol)
    const list = byVenue.get(venue) ?? []
    list.push(report)
    byVenue.set(venue, list)
  }

  const result: VenueStats[] = []
  for (const [venue, venueReports] of byVenue) {
    result.push(buildSingleVenueStats(venue, venueReports))
  }

  return result.sort((a, b) => b.totalTrades - a.totalTrades)
}

function buildSingleVenueStats(venue: AssetVertical, reports: TradeReport[]): VenueStats {
  const total = reports.length
  const wins = reports.filter(r => r.netPnL > 0).length
  const winRate = total > 0 ? (wins / total) * 100 : 0

  const rValues = reports.map(r => r.rMultiple)
  const avgR = total > 0 ? rValues.reduce((s, v) => s + v, 0) / total : 0
  const totalPnL = reports.reduce((s, r) => s + r.netPnL, 0)

  let best: VenueStats['bestTrade'] = null
  let worst: VenueStats['worstTrade'] = null

  for (const r of reports) {
    if (!best || r.rMultiple > best.rMultiple) {
      best = { symbol: r.symbol, rMultiple: r.rMultiple }
    }
    if (!worst || r.rMultiple < worst.rMultiple) {
      worst = { symbol: r.symbol, rMultiple: r.rMultiple }
    }
  }

  return { venue, winRate, avgR, bestTrade: best, worstTrade: worst, totalTrades: total, totalPnL }
}

// ── Cross-Vertical Behavioral Analysis ───────────────────────────────────────

function detectCrossVerticalInsights(
  venueStats: VenueStats[],
  entries: DiaryEntry[],
): CrossVerticalInsight[] {
  const insights: CrossVerticalInsight[] = []

  detectAggressionMismatch(venueStats, entries, insights)
  detectVenueAvoidance(venueStats, insights)
  detectConcentration(venueStats, insights)

  return insights
}

function detectAggressionMismatch(
  venueStats: VenueStats[],
  entries: DiaryEntry[],
  insights: CrossVerticalInsight[],
): void {
  if (venueStats.length < 2) return

  // Group entries by venue to estimate avg position size per venue
  const venueSizes = new Map<AssetVertical, number[]>()
  for (const entry of entries) {
    if (entry.positionSizePercentile === undefined) continue
    const venue = classifyVenue(entry.tradeSymbol)
    const list = venueSizes.get(venue) ?? []
    list.push(entry.positionSizePercentile)
    venueSizes.set(venue, list)
  }

  const venueAvgs: Array<{ venue: AssetVertical; avgSize: number }> = []
  for (const [venue, sizes] of venueSizes) {
    if (sizes.length < 2) continue
    const avg = sizes.reduce((s, v) => s + v, 0) / sizes.length
    venueAvgs.push({ venue, avgSize: avg })
  }

  if (venueAvgs.length < 2) return

  const sorted = venueAvgs.sort((a, b) => b.avgSize - a.avgSize)
  const most = sorted[0]!
  const least = sorted[sorted.length - 1]!

  if (most.avgSize - least.avgSize > 30) {
    const mostLabel = VENUE_LABELS[most.venue]
    const leastLabel = VENUE_LABELS[least.venue]
    insights.push({
      type: 'aggression_mismatch',
      message: `Aggressive in ${mostLabel} (avg position ~${most.avgSize.toFixed(0)}th percentile) but conservative in ${leastLabel} (avg ~${least.avgSize.toFixed(0)}th percentile).`,
    })
  }
}

function detectVenueAvoidance(
  venueStats: VenueStats[],
  insights: CrossVerticalInsight[],
): void {
  for (const vs of venueStats) {
    if (vs.totalTrades >= 3 && vs.winRate < 30) {
      const label = VENUE_LABELS[vs.venue]
      insights.push({
        type: 'venue_avoidance',
        message: `${label}: ${vs.winRate.toFixed(0)}% win rate across ${vs.totalTrades} trades. Consider reducing exposure.`,
      })
    }
  }
}

function detectConcentration(
  venueStats: VenueStats[],
  insights: CrossVerticalInsight[],
): void {
  const totalTrades = venueStats.reduce((s, v) => s + v.totalTrades, 0)
  if (totalTrades < 5) return

  for (const vs of venueStats) {
    const pct = (vs.totalTrades / totalTrades) * 100
    if (pct > 80 && venueStats.length > 1) {
      const label = VENUE_LABELS[vs.venue]
      insights.push({
        type: 'concentration',
        message: `${pct.toFixed(0)}% of trades concentrated in ${label}. Diversify across venues.`,
      })
    }
  }
}

// ── Overall Stats ────────────────────────────────────────────────────────────

function computeOverallStats(reports: TradeReport[]): CumulativeStats {
  if (reports.length === 0) {
    return { winRate: 0, avgR: 0, expectancy: 0, totalTrades: 0 }
  }

  const total = reports.length
  const wins = reports.filter(r => r.netPnL > 0).length
  const winRate = (wins / total) * 100
  const avgR = reports.reduce((s, r) => s + r.rMultiple, 0) / total

  const avgWin = computeAvgRForSide(reports, true)
  const avgLoss = computeAvgRForSide(reports, false)
  const winProb = winRate / 100
  const expectancy = winProb * avgWin - (1 - winProb) * Math.abs(avgLoss)

  return { winRate, avgR, expectancy, totalTrades: total }
}

function computeAvgRForSide(reports: TradeReport[], isWin: boolean): number {
  const filtered = reports.filter(r => isWin ? r.netPnL > 0 : r.netPnL <= 0)
  if (filtered.length === 0) return 0
  return filtered.reduce((s, r) => s + r.rMultiple, 0) / filtered.length
}

// ── Review Text Generation ───────────────────────────────────────────────────

function generateReviewText(
  masterName: string,
  archetype: Archetype,
  venueStats: VenueStats[],
  overallStats: CumulativeStats,
  insights: CrossVerticalInsight[],
  isQuietWeek: boolean,
): string {
  const templates = ARCHETYPE_TEMPLATES[archetype]
  const parts: string[] = []

  parts.push(`[${masterName}] ${templates.weekIntro}`)

  if (isQuietWeek) {
    parts.push(templates.quietWeek)
    return parts.join('\n\n')
  }

  parts.push(buildStatsSection(overallStats))
  parts.push(buildMoodLine(templates, overallStats))
  parts.push(buildVenueSection(venueStats))

  if (insights.length > 0) {
    parts.push(buildInsightsSection(insights))
  }

  parts.push(templates.closing)

  return parts.join('\n\n')
}

function buildStatsSection(stats: CumulativeStats): string {
  const lines = [
    `Win Rate: ${stats.winRate.toFixed(1)}% | Avg R: ${stats.avgR.toFixed(2)} | Expectancy: ${stats.expectancy.toFixed(2)} | Trades: ${stats.totalTrades}`,
  ]
  return lines.join('\n')
}

function buildMoodLine(templates: ArchetypeTemplates, stats: CumulativeStats): string {
  if (stats.winRate >= 65) return templates.winStreak
  if (stats.winRate <= 35) return templates.lossStreak
  return templates.mixedWeek
}

function buildVenueSection(venueStats: VenueStats[]): string {
  if (venueStats.length === 0) return ''

  const lines = ['Per-Venue Breakdown:']
  for (const vs of venueStats) {
    const label = VENUE_LABELS[vs.venue]
    const bestStr = vs.bestTrade ? `best: ${vs.bestTrade.symbol} ${vs.bestTrade.rMultiple.toFixed(1)}R` : ''
    const worstStr = vs.worstTrade ? `worst: ${vs.worstTrade.symbol} ${vs.worstTrade.rMultiple.toFixed(1)}R` : ''
    const details = [bestStr, worstStr].filter(Boolean).join(', ')
    lines.push(`  ${label}: ${vs.winRate.toFixed(0)}% WR, ${vs.avgR.toFixed(2)}R avg, ${vs.totalTrades} trades${details ? ` (${details})` : ''}`)
  }
  return lines.join('\n')
}

function buildInsightsSection(insights: CrossVerticalInsight[]): string {
  const lines = ['Cross-Vertical Analysis:']
  for (const insight of insights) {
    lines.push(`  - ${insight.message}`)
  }
  return lines.join('\n')
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate a weekly review report from diary data.
 *
 * @param entries - All diary entries (will be filtered to past 7 days)
 * @param tradeReports - All trade reports (will be filtered to past 7 days)
 * @param masterId - The guardian master ID for personality
 * @param now - Optional override for current time (useful for testing)
 */
export function generateWeeklyReview(
  entries: DiaryEntry[],
  tradeReports: TradeReport[],
  masterId: Master,
  now?: Date,
): WeeklyReviewReport {
  const periodEnd = now ?? new Date()
  const periodStart = new Date(periodEnd.getTime() - MS_7_DAYS)

  const weekEntries = entries.filter(e => e.timestamp >= periodStart && e.timestamp <= periodEnd)
  const weekReports = tradeReports.filter(r => r.timestamp >= periodStart.getTime() && r.timestamp <= periodEnd.getTime())

  const masterName = MASTER_NAMES[masterId] ?? masterId
  const archetype = getMasterArchetype(masterId)
  const isQuietWeek = weekReports.length === 0

  const venueStats = computeVenueStats(weekReports)
  const crossVerticalInsights = detectCrossVerticalInsights(venueStats, weekEntries)
  const overallStats = computeOverallStats(weekReports)

  const reviewText = generateReviewText(
    masterName,
    archetype,
    venueStats,
    overallStats,
    crossVerticalInsights,
    isQuietWeek,
  )

  return {
    periodStart,
    periodEnd,
    masterName,
    archetype,
    venueStats,
    crossVerticalInsights,
    overallStats,
    reviewText,
    isQuietWeek,
  }
}

// ── Terminal Formatter ──────────────────────────────────────────────────────

/** Format a weekly review for terminal display using box-drawing characters. */
export function formatWeeklyReviewForTerminal(review: WeeklyReviewReport): string {
  const lines: string[] = []
  const hr = '\u2500'.repeat(52)
  const start = review.periodStart.toISOString().slice(0, 10)
  const end = review.periodEnd.toISOString().slice(0, 10)

  lines.push(`\u250C${hr}\u2510`)
  lines.push(`\u2502  Weekly Review: ${start} \u2192 ${end}`)
  lines.push(`\u2502  Guardian: ${review.masterName} (${review.archetype})`)
  lines.push(`\u251C${hr}\u2524`)

  const wr = review.overallStats.winRate.toFixed(0)
  const exp = review.overallStats.expectancy.toFixed(2)
  const avgR = review.overallStats.avgR.toFixed(2)
  lines.push(`\u2502  Trades: ${review.overallStats.totalTrades} | WR: ${wr}% | Exp: $${exp} | Avg R: ${avgR}`)

  if (review.venueStats.length > 0) {
    lines.push(`\u251C${hr}\u2524`)
    lines.push('\u2502  Per-Venue:')
    for (const v of review.venueStats) {
      const vwr = v.winRate.toFixed(0)
      const vr = v.avgR.toFixed(2)
      lines.push(`\u2502    ${v.venue}: ${v.totalTrades} trades, ${vwr}% WR, ${vr}R, $${v.totalPnL.toFixed(2)}`)
    }
  }

  if (review.crossVerticalInsights.length > 0) {
    lines.push(`\u251C${hr}\u2524`)
    lines.push('\u2502  Insights:')
    for (const insight of review.crossVerticalInsights) {
      lines.push(`\u2502    \u2022 ${insight.message}`)
    }
  }

  lines.push(`\u251C${hr}\u2524`)
  lines.push(`\u2502  ${review.reviewText}`)
  lines.push(`\u2514${hr}\u2518`)

  return lines.join('\n')
}

// ── Desktop Bridge Emission ─────────────────────────────────────────────────

/**
 * Emit a weekly review to the desktop bridge as a weekly_review message.
 * Silently swallows all errors.
 */
export async function emitWeeklyReview(review: WeeklyReviewReport): Promise<void> {
  try {
    const { isDesktopMode, emitToDesktop } = await import(
      '../services/desktop/bridge.js'
    )
    if (!isDesktopMode()) return

    emitToDesktop('weekly_review', {
      periodStart: review.periodStart.toISOString().slice(0, 10),
      periodEnd: review.periodEnd.toISOString().slice(0, 10),
      masterName: review.masterName,
      totalTrades: review.overallStats.totalTrades,
      overallWinRate: review.overallStats.winRate,
      overallExpectancy: review.overallStats.expectancy,
      perVenue: review.venueStats.map(v => {
        const vWins = Math.round((v.winRate / 100) * v.totalTrades)
        return {
          venue: v.venue,
          tradeCount: v.totalTrades,
          wins: vWins,
          losses: v.totalTrades - vWins,
          winRate: v.winRate,
          avgRMultiple: v.avgR,
          expectancy: v.totalTrades > 0 ? v.totalPnL / v.totalTrades : 0,
          totalPnl: v.totalPnL,
        }
      }),
      verticalTrends: review.crossVerticalInsights.map(i => ({
        vertical: i.type,
        currentWinRate: 0,
        previousWinRate: 0,
        trend: 'stable' as const,
      })),
      guardianCommentary: review.reviewText,
      timestamp: Date.now(),
    })
  } catch {
    // Bridge emission must never propagate
  }
}
