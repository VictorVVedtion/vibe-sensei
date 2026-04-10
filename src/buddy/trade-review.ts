/**
 * Trade Review — template-based post-trade review in the guardian's archetype voice.
 * Takes a TradeReport + diary patterns. Generates review text with zero LLM calls.
 * Emits trade_review bridge message to the desktop sidebar.
 */

import type { TradeReport } from './trade-report.js'
import type { Archetype } from './persona.js'
import { getMasterArchetype } from './persona.js'
import type { Master } from './types.js'
import { MASTER_NAMES } from './types.js'
import type { PatternType, DiaryEntry } from './diary.js'
import { isDesktopMode, emitToDesktop } from '../services/desktop/bridge.js'

// ─── Achievement Definitions ────────────────────────────────────────────────

export type AchievementId =
  | 'disciplined_trader'
  | 'first_blood'
  | 'iron_hands'
  | 'sniper'
  | 'journey_begins'

export interface Achievement {
  id: AchievementId
  name: string
  description: string
  icon: string
}

const ACHIEVEMENTS: Record<AchievementId, Achievement> = {
  disciplined_trader: {
    id: 'disciplined_trader',
    name: 'Disciplined Trader',
    description: '5 trades with good discipline',
    icon: '\u{1F3AF}',
  },
  first_blood: {
    id: 'first_blood',
    name: 'First Blood',
    description: 'First positive R close',
    icon: '\u{1FA78}',
  },
  iron_hands: {
    id: 'iron_hands',
    name: 'Iron Hands',
    description: '3 stop-loss holds without panic selling',
    icon: '\u{1F91C}',
  },
  sniper: {
    id: 'sniper',
    name: 'Sniper',
    description: '>2R trade',
    icon: '\u{1F3AF}',
  },
  journey_begins: {
    id: 'journey_begins',
    name: 'Journey Begins',
    description: '10 trades completed',
    icon: '\u{1F6A9}',
  },
}

// ─── Achievement State ──────────────────────────────────────────────────────

interface AchievementState {
  unlocked: AchievementId[]
  counters: {
    discipline_count: number
    positive_r_count: number
    stop_hold_count: number
    total_trades: number
  }
}

let achievementState: AchievementState | null = null

function getAchievementState(): AchievementState {
  if (achievementState) return achievementState

  // Try to load from localStorage-compatible storage
  try {
    const { readFileSync } = require('fs') as typeof import('fs')
    const { join } = require('path') as typeof import('path')
    const { homedir } = require('os') as typeof import('os')
    const filePath = join(homedir(), '.vibe-sensei', 'achievements.json')
    const raw = readFileSync(filePath, 'utf-8')
    achievementState = JSON.parse(raw) as AchievementState
    return achievementState
  } catch {
    achievementState = {
      unlocked: [],
      counters: {
        discipline_count: 0,
        positive_r_count: 0,
        stop_hold_count: 0,
        total_trades: 0,
      },
    }
    return achievementState
  }
}

function saveAchievementState(): void {
  try {
    const { writeFileSync, mkdirSync } = require('fs') as typeof import('fs')
    const { join, dirname } = require('path') as typeof import('path')
    const { homedir } = require('os') as typeof import('os')
    const filePath = join(homedir(), '.vibe-sensei', 'achievements.json')
    mkdirSync(dirname(filePath), { recursive: true })
    writeFileSync(filePath, JSON.stringify(achievementState, null, 2), 'utf-8')
  } catch {
    // Achievement persistence is optional — never propagate
  }
}

// ─── Archetype Review Templates ─────────────────────────────────────────────

interface ReviewTemplates {
  goodEntry: string    // MAE < 0.5R
  okEntry: string      // 0.5R <= MAE < 1R
  badEntry: string     // MAE >= 1R
  goodExit: string     // R > 1
  breakeven: string    // -0.3R < R < 0.3R
  loss: string         // R < -0.3R
  discipline: string   // held through drawdown
  impatient: string    // exited too early (low efficiency)
}

const ARCHETYPE_TEMPLATES: Record<Archetype, ReviewTemplates> = {
  value_investor: {
    goodEntry: 'Solid entry. Margin of safety preserved.',
    okEntry: 'Acceptable entry, though a wider margin would be ideal.',
    badEntry: 'Entry was imprecise. Waited for a better price next time.',
    goodExit: 'Patient holding rewarded. This is the way.',
    breakeven: 'Flat outcome. Capital preserved, which matters.',
    loss: 'Loss taken. Review your thesis before re-entering.',
    discipline: 'Held through volatility. Conviction tested and proven.',
    impatient: 'Exited before the thesis played out. Patience pays.',
  },
  trend_follower: {
    goodEntry: 'Caught the move early. Timing was sharp.',
    okEntry: 'Entry was ok. Could have waited for a cleaner signal.',
    badEntry: 'Chased the move. Wait for pullbacks to the trend.',
    goodExit: 'Let the winner run. This is how you trade.',
    breakeven: 'Scratched it. No harm, no edge. Next.',
    loss: 'Cut quickly. The trend was not your friend here.',
    discipline: 'Rode the trend through noise. Well done.',
    impatient: 'Jumped off too early. The trend had more to give.',
  },
  macro_trader: {
    goodEntry: 'Positioned ahead of the macro move. Excellent read.',
    okEntry: 'Decent entry. The thesis was right, timing was loose.',
    badEntry: 'Forced the entry. Wait for the regime to confirm.',
    goodExit: 'Sized correctly and extracted. Professional execution.',
    breakeven: 'Flat. The macro picture was ambiguous here.',
    loss: 'Wrong side of the regime. Reduce and reassess.',
    discipline: 'Held conviction through the noise. Macro clarity wins.',
    impatient: 'Exited before the macro thesis resolved. Trust your read.',
  },
  quant: {
    goodEntry: 'Entry within model parameters. Signal confirmed.',
    okEntry: 'Entry acceptable. Slippage within tolerance.',
    badEntry: 'Entry deviated from the model. Review signal quality.',
    goodExit: 'Positive expectancy realized. System is performing.',
    breakeven: 'Outcome within variance. No action needed.',
    loss: 'Loss within risk budget. The system handles this.',
    discipline: 'Followed the model through drawdown. System integrity maintained.',
    impatient: 'Override detected. Trust the model, not your gut.',
  },
  strategist: {
    goodEntry: 'Terrain assessed, position taken at advantage. Good.',
    okEntry: 'Adequate positioning. Room for sharper timing.',
    badEntry: 'Engaged without advantage. Choose your battles.',
    goodExit: 'Tactical objective achieved. Well executed.',
    breakeven: 'Inconclusive engagement. Forces preserved.',
    loss: 'Strategic withdrawal. Learn the terrain for next time.',
    discipline: 'Held position under pressure. The battle-tested prevail.',
    impatient: 'Withdrew before the decisive moment. Patience is strategy.',
  },
  philosopher: {
    goodEntry: 'Entered with clarity. The mind was calm.',
    okEntry: 'Acceptable. But question if emotion influenced the timing.',
    badEntry: 'Entered from noise, not signal. Cultivate stillness.',
    goodExit: 'Gains harvested with equanimity. This is the practice.',
    breakeven: 'Neither gain nor loss. The market taught nothing new.',
    loss: 'Loss is tuition. The question is: what did you learn?',
    discipline: 'Endured the storm without flinching. Antifragile.',
    impatient: 'Fled from uncertainty. Sit with discomfort longer.',
  },
  first_principles: {
    goodEntry: 'First principles confirmed. Entry was rational.',
    okEntry: 'Entry was reasonable. Verify assumptions held.',
    badEntry: 'Entered on narrative, not fundamentals. Decompose the thesis.',
    goodExit: 'Thesis played out. Conviction rewarded.',
    breakeven: 'Null result. Was the thesis testable?',
    loss: 'Thesis invalidated. Update your model.',
    discipline: 'Held through noise because the fundamentals were sound.',
    impatient: 'Abandoned a valid thesis too early. Trust your analysis.',
  },
  crypto_native: {
    goodEntry: 'Aped in at the right moment. Based.',
    okEntry: 'Entry was fine. Could have been more degen about it.',
    badEntry: 'Bought the top. NGMI if this keeps up.',
    goodExit: 'Took profit. Most forget to do this. WAGMI.',
    breakeven: 'Flat. At least you did not get rekt.',
    loss: 'Rekt. It happens. Size down and survive.',
    discipline: 'Diamond hands through the dump. Respect.',
    impatient: 'Paper hands. The move was still cooking.',
  },
  scientist: {
    goodEntry: 'Entry within confidence interval. Data supported the trade.',
    okEntry: 'Entry acceptable. Sample size remains small.',
    badEntry: 'Entry lacked empirical basis. Collect more data first.',
    goodExit: 'Hypothesis confirmed with positive outcome.',
    breakeven: 'Result within noise. Insufficient data to conclude.',
    loss: 'Hypothesis rejected. Adjust the model parameters.',
    discipline: 'Maintained position despite noise. Data over emotion.',
    impatient: 'Terminated experiment prematurely. Let the data speak.',
  },
}

// ─── Review Text Generation ─────────────────────────────────────────────────

/**
 * Generates a template-based trade review in the guardian's archetype voice.
 * Zero LLM calls. Returns structured review text.
 */
export function generateTradeReview(
  report: TradeReport,
  masterId: Master,
  recentPatterns: DiaryEntry[],
): TradeReviewResult {
  const archetype = getMasterArchetype(masterId)
  const masterName = MASTER_NAMES[masterId]
  const templates = ARCHETYPE_TEMPLATES[archetype]

  const lines: string[] = []

  // 1. Hold duration
  lines.push(`Held for ${report.holdDurationHuman}.`)

  // 2. Entry quality based on MAE (max adverse excursion)
  const maeR = report.initialRisk > 0
    ? Math.abs(report.mae / 100 * report.entryPrice * report.quantity) / report.initialRisk
    : 0
  if (maeR < 0.5) {
    lines.push(templates.goodEntry)
  } else if (maeR < 1) {
    lines.push(templates.okEntry)
  } else {
    lines.push(templates.badEntry)
  }

  // 3. Exit quality based on R-multiple
  if (report.rMultiple > 1) {
    lines.push(`${report.rMultiple.toFixed(1)}R exit. ${templates.goodExit}`)
  } else if (report.rMultiple > -0.3 && report.rMultiple < 0.3) {
    lines.push(templates.breakeven)
  } else if (report.rMultiple < -0.3) {
    lines.push(templates.loss)
  } else {
    // Small positive (0.3-1R)
    lines.push(`${report.rMultiple.toFixed(1)}R. Decent, but the move had more.`)
  }

  // 4. Efficiency commentary
  if (report.efficiencyRatio < 30 && report.mfe > 0) {
    lines.push(templates.impatient)
  } else if (report.efficiencyRatio > 70) {
    lines.push(templates.discipline)
  }

  // 5. Pattern-based observations from diary
  const patternComments = getPatternComments(recentPatterns, archetype)
  if (patternComments) {
    lines.push(patternComments)
  }

  // 6. Check and emit achievements
  const newAchievements = checkAchievements(report, recentPatterns)

  const review: TradeReviewResult = {
    text: lines.join(' '),
    masterName,
    masterId,
    archetype,
    report,
    achievements: newAchievements,
  }

  // Emit to desktop bridge
  emitTradeReviewToDesktop(review)

  // Play achievement sound on macOS
  if (newAchievements.length > 0) {
    playAchievementSound()
  }

  return review
}

export interface TradeReviewResult {
  text: string
  masterName: string
  masterId: Master
  archetype: Archetype
  report: TradeReport
  achievements: Achievement[]
}

// ─── Pattern Comments ───────────────────────────────────────────────────────

function getPatternComments(
  recentPatterns: DiaryEntry[],
  archetype: Archetype,
): string | null {
  if (recentPatterns.length === 0) return null

  // Count recent pattern types
  const counts: Partial<Record<PatternType, number>> = {}
  for (const entry of recentPatterns.slice(0, 10)) {
    if (entry.patternType === 'general') continue
    counts[entry.patternType] = (counts[entry.patternType] ?? 0) + 1
  }

  // Find dominant pattern
  let topType: PatternType | null = null
  let topCount = 0
  for (const [type, count] of Object.entries(counts) as [PatternType, number][]) {
    if (count > topCount) {
      topCount = count
      topType = type
    }
  }

  if (!topType || topCount < 2) return null

  const PATTERN_COMMENTS: Partial<Record<PatternType, string>> = {
    early_exit: 'Pattern: exiting winners early. Let the trade breathe.',
    revenge_trade: 'Pattern: revenge trading detected. Step away after losses.',
    fomo: 'Pattern: FOMO entries. Set the position and walk away.',
    oversize: 'Pattern: oversizing. Spread risk across more positions.',
    good_discipline: 'Pattern: strong discipline. Keep this edge sharp.',
    late_entry: 'Pattern: late entries. Wait for pullbacks.',
  }

  return PATTERN_COMMENTS[topType] ?? null
}

// ─── Achievement Checking ───────────────────────────────────────────────────

function checkAchievements(
  report: TradeReport,
  recentPatterns: DiaryEntry[],
): Achievement[] {
  const state = getAchievementState()
  const newlyUnlocked: Achievement[] = []

  // Update counters
  state.counters.total_trades++

  if (report.rMultiple > 0) {
    state.counters.positive_r_count++
  }

  // Count good_discipline patterns in recent entries
  const disciplineCount = recentPatterns.filter(
    (e) => e.patternType === 'good_discipline',
  ).length
  state.counters.discipline_count = disciplineCount

  // Check each achievement
  // First Blood: first positive R close
  if (
    !state.unlocked.includes('first_blood') &&
    report.rMultiple > 0
  ) {
    state.unlocked.push('first_blood')
    newlyUnlocked.push(ACHIEVEMENTS.first_blood)
  }

  // Sniper: >2R trade
  if (
    !state.unlocked.includes('sniper') &&
    report.rMultiple > 2
  ) {
    state.unlocked.push('sniper')
    newlyUnlocked.push(ACHIEVEMENTS.sniper)
  }

  // Disciplined Trader: 5 good_discipline patterns
  if (
    !state.unlocked.includes('disciplined_trader') &&
    state.counters.discipline_count >= 5
  ) {
    state.unlocked.push('disciplined_trader')
    newlyUnlocked.push(ACHIEVEMENTS.disciplined_trader)
  }

  // Iron Hands: 3 stop-loss holds (trades where MAE > 3% but still positive)
  if (report.mae < -3 && report.netPnL > 0) {
    state.counters.stop_hold_count++
  }
  if (
    !state.unlocked.includes('iron_hands') &&
    state.counters.stop_hold_count >= 3
  ) {
    state.unlocked.push('iron_hands')
    newlyUnlocked.push(ACHIEVEMENTS.iron_hands)
  }

  // Journey Begins: 10 trades
  if (
    !state.unlocked.includes('journey_begins') &&
    state.counters.total_trades >= 10
  ) {
    state.unlocked.push('journey_begins')
    newlyUnlocked.push(ACHIEVEMENTS.journey_begins)
  }

  // Persist state
  saveAchievementState()

  return newlyUnlocked
}

// ─── Desktop Bridge Emission ────────────────────────────────────────────────

function emitTradeReviewToDesktop(review: TradeReviewResult): void {
  try {
    if (!isDesktopMode()) return

    emitToDesktop('trade_review', {
      tradeId: `${review.report.symbol}-${review.report.timestamp}`,
      symbol: review.report.symbol,
      side: review.report.side,
      entryPrice: review.report.entryPrice,
      exitPrice: review.report.exitPrice,
      pnl: review.report.netPnL,
      pnlPercent: review.report.netPnLPercent,
      rMultiple: review.report.rMultiple,
      holdDuration: review.report.holdDurationHuman,
      mae: review.report.mae,
      mfe: review.report.mfe,
      efficiencyRatio: review.report.efficiencyRatio,
      masterName: review.masterName,
      masterVerdict: review.text,
      archetype: review.archetype,
      lessons: extractLessons(review),
      achievements: review.achievements.map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        icon: a.icon,
      })),
      timestamp: review.report.timestamp,
    })
  } catch {
    // Bridge emission must never propagate
  }
}

function extractLessons(review: TradeReviewResult): string[] {
  const lessons: string[] = []
  const r = review.report

  if (r.rMultiple > 1.5) {
    lessons.push('Strong R-multiple. This setup works.')
  } else if (r.rMultiple < -0.5) {
    lessons.push('Negative R. Review entry criteria.')
  }

  if (r.efficiencyRatio < 30 && r.mfe > 0) {
    lessons.push('Low efficiency. Exited far from MFE.')
  }

  if (r.mae < -5) {
    lessons.push('Deep drawdown during hold. Tighten stops or size down.')
  }

  return lessons
}

// ─── Sound Effect ───────────────────────────────────────────────────────────

function playAchievementSound(): void {
  try {
    if (process.platform !== 'darwin') return
    const { execSync } = require('child_process') as typeof import('child_process')
    execSync('afplay /System/Library/Sounds/Glass.aiff 2>/dev/null &', {
      stdio: 'ignore',
      timeout: 2000,
    })
  } catch {
    // Sound is optional — never propagate
  }
}

// ─── Format for Terminal ────────────────────────────────────────────────────

/**
 * Formats a trade review for terminal display.
 * Used alongside the existing formatTradeReport output.
 */
export function formatTradeReviewForTerminal(review: TradeReviewResult): string {
  const lines: string[] = []
  const ruler = '\u2501'.repeat(40)

  lines.push(`${ruler}`)
  lines.push(`\u{1F4CB} ${review.masterName}'s Review`)
  lines.push(review.text)

  if (review.achievements.length > 0) {
    lines.push('')
    for (const a of review.achievements) {
      lines.push(`${a.icon} Achievement Unlocked: ${a.name} \u2014 ${a.description}`)
    }
  }

  lines.push(ruler)
  return lines.join('\n')
}
