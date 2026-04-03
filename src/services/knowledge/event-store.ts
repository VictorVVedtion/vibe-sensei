/**
 * Knowledge Base Event Store — JSONL persistence for trading events.
 *
 * Provides two entry points:
 * - appendEvent(): async — for use in async callers (guardian-observer, gate, regime)
 * - queueEvent(): sync-safe — for use in sync callers (ghost, circuit, diary)
 *
 * Events are stored as JSONL at ~/.vibe-sensei/events/YYYY-MM.jsonl
 * with 0o600 permissions and 10MB rotation.
 */

import { randomUUID } from 'crypto'
import {
  appendFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import type { KBEvent, KBEventUnion } from './types.js'
import { KBEventSchema } from './types.js'

// ── Constants ─────────────────────────────────────────────────────────────────

const EVENTS_DIR = join(homedir(), '.vibe-sensei', 'events')
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10MB

// ── Directory Bootstrap ───────────────────────────────────────────────────────

let dirEnsured = false

/** Ensure the events directory exists. Called once per process. */
function ensureDir(): void {
  if (dirEnsured) return
  try {
    mkdirSync(EVENTS_DIR, { recursive: true, mode: 0o700 })
    dirEnsured = true
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
      dirEnsured = true
      return
    }
    console.warn('[KB] failed to create events dir:', err)
  }
}

// ── File Path Resolution ──────────────────────────────────────────────────────

/** Get the YYYY-MM prefix for a given date. */
function monthPrefix(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

/**
 * Resolve the current JSONL file path for the given month.
 * Handles 10MB rotation by checking file size and creating
 * suffixed files (-02, -03, etc.) when needed.
 */
function resolveFilePath(prefix: string): string {
  const basePath = join(EVENTS_DIR, `${prefix}.jsonl`)

  try {
    const stat = statSync(basePath)
    if (stat.size < MAX_FILE_SIZE_BYTES) return basePath
  } catch {
    // File doesn't exist — use base path
    return basePath
  }

  // Base file is over 10MB — find or create a rotated file
  return findRotatedPath(prefix)
}

/** Find the next available rotated file path. */
function findRotatedPath(prefix: string): string {
  for (let i = 2; i <= 99; i++) {
    const suffix = String(i).padStart(2, '0')
    const path = join(EVENTS_DIR, `${prefix}-${suffix}.jsonl`)
    try {
      const stat = statSync(path)
      if (stat.size < MAX_FILE_SIZE_BYTES) return path
    } catch {
      // File doesn't exist — use it
      return path
    }
  }
  // Extreme fallback: overflow file
  return join(EVENTS_DIR, `${prefix}-overflow.jsonl`)
}

// ── Core Write ────────────────────────────────────────────────────────────────

/**
 * Write a single event as a JSONL line to the appropriate file.
 * Sets file permissions to 0o600 on creation.
 */
function writeEventLine(event: KBEvent): void {
  ensureDir()
  const now = new Date(event.timestamp)
  const prefix = monthPrefix(now)
  const filePath = resolveFilePath(prefix)
  const line = JSON.stringify(event) + '\n'

  try {
    appendFileSync(filePath, line, { encoding: 'utf-8', mode: 0o600 })
  } catch (err: unknown) {
    console.warn('[KB] append failed:', err)
  }
}

// ── Sync Queue ────────────────────────────────────────────────────────────────

const eventQueue: KBEvent[] = []
let flushScheduled = false

/** Flush all queued events to disk. */
function flushQueue(): void {
  flushScheduled = false
  while (eventQueue.length > 0) {
    const event = eventQueue.shift()!
    writeEventLine(event)
  }
}

/** Schedule a flush on the next event loop tick. */
function scheduleFlush(): void {
  if (flushScheduled) return
  flushScheduled = true

  if (typeof setImmediate === 'function') {
    setImmediate(flushQueue)
  } else {
    setTimeout(flushQueue, 0)
  }
}

// Flush remaining events before process exit
try {
  process.on('beforeExit', flushQueue)
} catch {
  // Non-Node environment — skip
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Stamp an event with id and timestamp if not already present.
 */
function stampEvent(event: KBEvent): KBEvent {
  return {
    ...event,
    id: event.id || randomUUID(),
    timestamp: event.timestamp || new Date().toISOString(),
  }
}

// ── Milestone Integration ────────────────────────────────────────────────────────

type MilestoneNotifyFn = (message: string) => void
let milestoneNotifier: MilestoneNotifyFn | null = null
let appendCounter = 0
const MILESTONE_CHECK_INTERVAL = 10

/**
 * Register a callback for milestone notifications.
 * Typically wired to companionReaction via AppState.
 */
export function registerMilestoneNotifier(cb: MilestoneNotifyFn): void {
  milestoneNotifier = cb
}

/** Fire milestone check every N events (async, best-effort). */
function maybeCheckMilestones(): void {
  appendCounter++
  if (appendCounter % MILESTONE_CHECK_INTERVAL !== 0) return
  if (!milestoneNotifier) return

  const notify = milestoneNotifier
  import('./milestones.js')
    .then(mod => mod.checkMilestones())
    .then(results => {
      for (const m of results) {
        try { notify(m.celebration) } catch { /* never propagate */ }
      }
    })
    .catch(() => { /* milestone check is best-effort */ })
}

/**
 * Append an event to the JSONL store (async-safe).
 * Use this from async callers like guardian-observer, gateEvaluator, regime.
 * Errors are swallowed — never propagates.
 */
export async function appendEvent(event: KBEvent): Promise<void> {
  try {
    const stamped = stampEvent(event)
    writeEventLine(stamped)
    maybeCheckMilestones()
  } catch {
    // Swallow all errors — event persistence must never block trading
  }
}

/**
 * Queue an event for deferred write (sync-safe).
 * Use this from sync callers like ghost-warnings, circuit-state, diary.
 * The event is written on the next event loop tick via setImmediate.
 */
export function queueEvent(event: KBEvent): void {
  try {
    const stamped = stampEvent(event)
    eventQueue.push(stamped)
    scheduleFlush()
    maybeCheckMilestones()
  } catch {
    // Swallow all errors — event persistence must never block trading
  }
}

/**
 * Read events from JSONL files.
 *
 * @param opts.month — Filter by month (YYYY-MM format). Reads all months if omitted.
 * @param opts.type — Filter by event type string.
 * @returns Parsed and validated events. Corrupted lines are skipped.
 */
export async function readEvents(
  opts?: { month?: string; type?: string },
): Promise<KBEventUnion[]> {
  ensureDir()

  const files = listEventFiles(opts?.month)
  const events: KBEventUnion[] = []

  for (const filePath of files) {
    const parsed = parseJsonlFile(filePath, opts?.type)
    for (const evt of parsed) {
      events.push(evt)
    }
  }

  return events
}

/** List JSONL files, optionally filtered by month prefix. */
function listEventFiles(month?: string): string[] {
  try {
    const entries = readdirSync(EVENTS_DIR)
    const jsonlFiles = entries.filter((f) => f.endsWith('.jsonl'))

    if (month) {
      return jsonlFiles
        .filter((f) => f.startsWith(month))
        .map((f) => join(EVENTS_DIR, f))
        .sort()
    }

    return jsonlFiles.map((f) => join(EVENTS_DIR, f)).sort()
  } catch {
    return []
  }
}

/** Parse a single JSONL file, skipping corrupted lines. */
function parseJsonlFile(
  filePath: string,
  typeFilter?: string,
): KBEventUnion[] {
  const events: KBEventUnion[] = []

  let content: string
  try {
    content = readFileSync(filePath, 'utf-8')
  } catch {
    return events
  }

  const lines = content.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.length === 0) continue

    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (typeFilter && (parsed as KBEvent).type !== typeFilter) continue

      const validated = KBEventSchema.safeParse(parsed)
      if (validated.success) {
        events.push(validated.data)
      } else {
        console.warn(`[KB] skipping invalid event in ${filePath}`)
      }
    } catch {
      console.warn(`[KB] skipping corrupted line in ${filePath}`)
    }
  }

  return events
}

// ── Migration ─────────────────────────────────────────────────────────────────

const MIGRATION_MARKER = join(homedir(), '.vibe-sensei', '.migration-complete')
const DEFAULT_DIARY_PATH = join(homedir(), '.vibe-sensei', 'diary.json')

/**
 * Migrate existing diary.json entries to JSONL event store.
 *
 * Only runs once: checks for .migration-complete marker.
 * Converts DiaryEntry to DiaryPatternEvent and TradeReport to TradeLogEvent.
 * On failure, keeps diary.json intact, logs warning, and continues.
 *
 * diary.ts continues using diary.json for its own read/write — NOT replaced.
 */
export async function migrateDiaryIfNeeded(): Promise<void> {
  try {
    // Check marker — already migrated?
    try {
      statSync(MIGRATION_MARKER)
      return
    } catch {
      // Marker doesn't exist — proceed
    }

    // Check diary.json exists
    let diaryRaw: string
    try {
      diaryRaw = readFileSync(DEFAULT_DIARY_PATH, 'utf-8')
    } catch {
      writeMigrationMarker()
      return
    }

    const diaryData = JSON.parse(diaryRaw) as DiaryFileShape
    if (!diaryData || !Array.isArray(diaryData.entries)) {
      writeMigrationMarker()
      return
    }

    convertDiaryEntries(diaryData)
    convertTradeReports(diaryData)

    renameSync(DEFAULT_DIARY_PATH, DEFAULT_DIARY_PATH + '.bak')
    writeMigrationMarker()
  } catch (err: unknown) {
    console.warn('[KB] diary migration failed, continuing:', err)
  }
}

/** Convert diary entries to DiaryPatternEvent JSONL lines. */
function convertDiaryEntries(data: DiaryFileShape): void {
  for (const entry of data.entries) {
    const event: KBEvent = {
      id: (entry.id as string) || randomUUID(),
      type: 'diary_pattern',
      timestamp: (entry.timestamp as string) || new Date().toISOString(),
      ...extractDiaryFields(entry),
    }
    writeEventLine(event)
  }
}

/** Convert trade reports to TradeLogEvent JSONL lines. */
function convertTradeReports(data: DiaryFileShape): void {
  if (!Array.isArray(data.tradeReports)) return

  for (const report of data.tradeReports) {
    const event: KBEvent = {
      id: randomUUID(),
      type: 'trade_log',
      timestamp: new Date((report.timestamp as number) || Date.now()).toISOString(),
      ...extractTradeReportFields(report),
    }
    writeEventLine(event)
  }
}

/** Write the migration-complete marker file. */
function writeMigrationMarker(): void {
  try {
    ensureDir()
    const markerDir = join(homedir(), '.vibe-sensei')
    mkdirSync(markerDir, { recursive: true })
    writeFileSync(MIGRATION_MARKER, new Date().toISOString(), {
      encoding: 'utf-8',
      mode: 0o600,
    })
  } catch {
    // Non-fatal
  }
}

/** Extract diary pattern fields from a serialized diary entry. */
function extractDiaryFields(entry: Record<string, unknown>): Record<string, unknown> {
  return {
    entryId: entry.id ?? '',
    symbol: entry.tradeSymbol ?? '',
    side: entry.tradeSide ?? '',
    patternType: entry.patternType ?? 'general',
    outcome: entry.outcome,
  }
}

/** Extract trade report fields for a TradeLogEvent. */
function extractTradeReportFields(report: Record<string, unknown>): Record<string, unknown> {
  return {
    symbol: report.symbol ?? '',
    side: report.side ?? '',
    quantity: report.quantity ?? 0,
    price: report.entryPrice ?? 0,
    orderType: 'market',
    grossPnL: report.grossPnL,
    netPnL: report.netPnL,
    rMultiple: report.rMultiple,
    holdDurationMs: report.holdDurationMs,
    fees: report.totalFees,
  }
}

/** Shape of the diary.json file for migration. */
interface DiaryFileShape {
  version?: number
  entries: Record<string, unknown>[]
  tradeReports?: Record<string, unknown>[]
}
