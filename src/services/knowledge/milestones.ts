/**
 * Knowledge Milestones \u2014 achievement system for trading progress.
 *
 * Tracks milestone thresholds and celebrates newly achieved ones
 * through the Guardian's voice via companionReaction.
 *
 * Milestone categories:
 *   - Event count: 10, 50, 100, 250, 500
 *   - Discipline streaks: 7, 14, 30 days consecutive
 *   - First pattern discovery
 *   - First wiki compile
 *   - First month of data
 *
 * State persisted in ~/.vibe-sensei/.milestones.json
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { readEvents } from './event-store.js'
import type { KBEventUnion, DiaryPatternEvent } from './types.js'

// \u2500\u2500 Constants \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

const VIBE_DIR = join(homedir(), '.vibe-sensei')
const MILESTONES_PATH = join(VIBE_DIR, '.milestones.json')
const WIKI_DIR = join(VIBE_DIR, 'wiki')
const COMPILE_STATE_PATH = join(WIKI_DIR, '.compile-state.json')

// \u2500\u2500 Types \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

export interface MilestoneResult {
  /** Unique milestone identifier. */
  id: string
  /** Human-readable milestone name. */
  name: string
  /** Description of what was achieved. */
  description: string
  /** Celebration message (to be voiced by guardian). */
  celebration: string
}

interface MilestoneState {
  achieved: string[]
  lastCheck: string | null
}

type MilestoneChecker = (events: KBEventUnion[]) => MilestoneResult | null

// \u2500\u2500 State Management \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

/** Load achieved milestones from disk. */
function loadState(): MilestoneState {
  try {
    const raw = readFileSync(MILESTONES_PATH, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<MilestoneState>
    return {
      achieved: Array.isArray(parsed.achieved) ? parsed.achieved : [],
      lastCheck: parsed.lastCheck ?? null,
    }
  } catch {
    return { achieved: [], lastCheck: null }
  }
}

/** Save milestone state to disk atomically. */
function saveState(state: MilestoneState): void {
  try {
    mkdirSync(VIBE_DIR, { recursive: true })
    const tmpPath = MILESTONES_PATH + '.tmp'
    writeFileSync(tmpPath, JSON.stringify(state, null, 2), {
      encoding: 'utf-8',
      mode: 0o600,
    })
    renameSync(tmpPath, MILESTONES_PATH)
  } catch {
    // Non-fatal \u2014 milestone persistence should never block trading
  }
}

// \u2500\u2500 Milestone Definitions \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

const EVENT_COUNT_THRESHOLDS = [10, 50, 100, 250, 500] as const
const DISCIPLINE_STREAK_THRESHOLDS = [7, 14, 30] as const

/** Check event count milestones (10, 50, 100, 250, 500). Returns highest unachieved. */
function checkEventCount(events: KBEventUnion[]): MilestoneResult | null {
  const count = events.length
  let best: MilestoneResult | null = null
  for (const threshold of EVENT_COUNT_THRESHOLDS) {
    if (count >= threshold) {
      best = {
        id: `events_${threshold}`,
        name: `${threshold} Events Recorded`,
        description: `You have ${count} trading events in your knowledge base.`,
        celebration: `Milestone unlocked: ${threshold} events! Your trading history grows stronger.`,
      }
    }
  }
  return best
}

/** Check discipline streak milestones (7, 14, 30 days). */
function checkDisciplineStreak(events: KBEventUnion[]): MilestoneResult | null {
  const patterns = events.filter(
    (e): e is DiaryPatternEvent => e.type === 'diary_pattern',
  )

  const daySet = new Set<string>()
  for (const p of patterns) {
    if (p.patternType === 'good_discipline') {
      daySet.add(p.timestamp.slice(0, 10))
    }
  }

  if (daySet.size === 0) return null

  const days = Array.from(daySet).sort().reverse()
  let streak = 1
  for (let i = 1; i < days.length; i++) {
    const expected = shiftDate(days[i - 1]!, -1)
    if (days[i] === expected) {
      streak++
    } else {
      break
    }
  }

  let best: MilestoneResult | null = null
  for (const threshold of DISCIPLINE_STREAK_THRESHOLDS) {
    if (streak >= threshold) {
      best = {
        id: `discipline_${threshold}`,
        name: `${threshold}-Day Discipline Streak`,
        description: `${streak} consecutive days following stop-loss advice.`,
        celebration: `${threshold} days of discipline! The master approves of your consistency.`,
      }
    }
  }
  return best
}

/** Check first pattern discovery milestone. */
function checkFirstPattern(events: KBEventUnion[]): MilestoneResult | null {
  const hasPattern = events.some(e => e.type === 'diary_pattern')
  if (!hasPattern) return null

  return {
    id: 'first_pattern',
    name: 'First Pattern Discovered',
    description: 'Your guardian detected your first behavioral pattern.',
    celebration: 'Your first pattern has been revealed! Self-awareness is the first step to mastery.',
  }
}

/** Check first wiki compile milestone. */
function checkFirstCompile(_events: KBEventUnion[]): MilestoneResult | null {
  try {
    if (!existsSync(COMPILE_STATE_PATH)) return null
    const raw = readFileSync(COMPILE_STATE_PATH, 'utf-8')
    const state = JSON.parse(raw) as { eventsCompiled?: number }
    if ((state.eventsCompiled ?? 0) > 0) {
      return {
        id: 'first_compile',
        name: 'Knowledge Base Born',
        description: 'Your trading wiki has been compiled for the first time.',
        celebration: 'Your knowledge base is alive! Your trading wisdom is now preserved.',
      }
    }
  } catch {
    // Compile state unreadable
  }
  return null
}

/** Check first month of data milestone. */
function checkFirstMonth(events: KBEventUnion[]): MilestoneResult | null {
  if (events.length < 2) return null

  const sorted = events
    .map(e => new Date(e.timestamp).getTime())
    .filter(t => !isNaN(t))
    .sort((a, b) => a - b)

  if (sorted.length < 2) return null

  const firstMs = sorted[0]!
  const lastMs = sorted[sorted.length - 1]!
  const daySpan = (lastMs - firstMs) / (1000 * 60 * 60 * 24)

  if (daySpan >= 30) {
    return {
      id: 'first_month',
      name: 'One Month of Trading Data',
      description: `${Math.floor(daySpan)} days of trading history accumulated.`,
      celebration: 'One month of data! Your guardian now has meaningful patterns to analyze.',
    }
  }
  return null
}

/** Shift a YYYY-MM-DD date string by N days. */
function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// \u2500\u2500 Milestone Registry \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

/** All milestone checkers, ordered by importance. */
const MILESTONE_CHECKERS: MilestoneChecker[] = [
  checkEventCount,
  checkDisciplineStreak,
  checkFirstPattern,
  checkFirstCompile,
  checkFirstMonth,
]

// \u2500\u2500 Public API \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

/**
 * Check all milestone thresholds and return newly achieved ones.
 *
 * Only returns milestones that haven't been achieved before.
 * Saves state after checking so milestones are only reported once.
 *
 * Call periodically (e.g. every 10th event) to avoid checking on every event.
 */
export async function checkMilestones(): Promise<MilestoneResult[]> {
  try {
    const state = loadState()
    const achievedSet = new Set(state.achieved)
    const events = await readEvents()

    if (events.length === 0) return []

    const newMilestones: MilestoneResult[] = []

    for (const checker of MILESTONE_CHECKERS) {
      const result = checker(events)
      if (result && !achievedSet.has(result.id)) {
        newMilestones.push(result)
        achievedSet.add(result.id)
      }
    }

    if (newMilestones.length > 0) {
      saveState({
        achieved: Array.from(achievedSet),
        lastCheck: new Date().toISOString(),
      })
    }

    return newMilestones
  } catch {
    return []
  }
}

/**
 * Get all achieved milestone IDs.
 * Useful for displaying progress.
 */
export function getAchievedMilestones(): string[] {
  try {
    return loadState().achieved
  } catch {
    return []
  }
}

// \u2500\u2500 Event Count Tracking \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

let eventCounter = 0
const CHECK_INTERVAL = 10

/**
 * Increment the event counter and check milestones periodically.
 * Returns newly achieved milestones or empty array.
 *
 * Called from event-store after appendEvent/queueEvent.
 * Only triggers a full milestone check every 10th event.
 */
export async function onEventAppended(): Promise<MilestoneResult[]> {
  eventCounter++
  if (eventCounter % CHECK_INTERVAL !== 0) return []
  return checkMilestones()
}
