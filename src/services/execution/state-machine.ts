/**
 * Execution Lifecycle State Machine for multi-venue trading.
 *
 * Tracks every order through a deterministic state graph from QUOTE to
 * a terminal state (SETTLED, EXPIRED, REJECTED, FAILED, TX_LOST, REVERTED).
 * Persists transitions to a JSONL log and recovers active records on startup.
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'

// ── Types ────────────────────────────────────────────────────────────────────

export type ExecutionState =
  | 'QUOTE' | 'APPROVE' | 'SIGN' | 'BROADCAST' | 'PENDING'
  | 'CONFIRMED' | 'SETTLED' | 'EXPIRED' | 'REJECTED'
  | 'FAILED' | 'TX_LOST' | 'REVERTED' | 'PARTIAL'

export interface StateTransition {
  from: ExecutionState
  to: ExecutionState
  timestamp: number
}

export interface ExecutionRecord {
  id: string
  venueId: string
  vertical: string
  symbol: string
  side: 'buy' | 'sell'
  state: ExecutionState
  txHash?: string
  error?: string
  createdAt: number
  updatedAt: number
  transitions: StateTransition[]
}

export interface TransitionLogEntry {
  id: string
  from: ExecutionState
  to: ExecutionState
  txHash?: string
  error?: string
  timestamp: number
}

// ── Allowed Transitions ──────────────────────────────────────────────────────

export const ALLOWED_TRANSITIONS: Record<ExecutionState, ExecutionState[]> = {
  QUOTE:     ['APPROVE', 'CONFIRMED', 'EXPIRED', 'REJECTED'],
  APPROVE:   ['SIGN', 'REJECTED'],
  SIGN:      ['BROADCAST', 'FAILED'],
  BROADCAST: ['PENDING', 'FAILED', 'TX_LOST'],
  PENDING:   ['CONFIRMED', 'REVERTED', 'TX_LOST'],
  CONFIRMED: ['SETTLED', 'PARTIAL'],
  // Terminal states — no outgoing transitions
  SETTLED:  [],
  EXPIRED:  [],
  REJECTED: [],
  FAILED:   [],
  TX_LOST:  [],
  REVERTED: [],
  PARTIAL:  [],
}

export const TERMINAL_STATES: ReadonlySet<ExecutionState> = new Set([
  'SETTLED', 'EXPIRED', 'REJECTED', 'FAILED', 'TX_LOST', 'REVERTED',
])

// ── Default log path ─────────────────────────────────────────────────────────

const DEFAULT_LOG_DIR = join(homedir(), '.vibe-sensei')
const DEFAULT_LOG_PATH = join(DEFAULT_LOG_DIR, 'execution-log.jsonl')

// ── Tracker ──────────────────────────────────────────────────────────────────

export interface TransitionOpts {
  txHash?: string
  error?: string
}

const TX_LOST_THRESHOLD_MS = 5 * 60 * 1000 // 5 minutes

export class ExecutionTracker {
  private records = new Map<string, ExecutionRecord>()
  private readonly logPath: string

  constructor(logPath?: string) {
    this.logPath = logPath ?? DEFAULT_LOG_PATH
    this.ensureLogDir()
  }

  /** Create a new execution record in QUOTE state. */
  create(
    venueId: string,
    vertical: string,
    symbol: string,
    side: 'buy' | 'sell',
  ): ExecutionRecord {
    const now = Date.now()
    const record: ExecutionRecord = {
      id: crypto.randomUUID(),
      venueId,
      vertical,
      symbol,
      side,
      state: 'QUOTE',
      createdAt: now,
      updatedAt: now,
      transitions: [],
    }
    this.records.set(record.id, record)
    return record
  }

  /** Transition a record to a new state, validating the transition is allowed. */
  transition(
    id: string,
    newState: ExecutionState,
    opts?: TransitionOpts,
  ): ExecutionRecord {
    const record = this.records.get(id)
    if (!record) {
      throw new Error(`ExecutionRecord not found: ${id}`)
    }
    const allowed = ALLOWED_TRANSITIONS[record.state]
    if (!allowed.includes(newState)) {
      throw new Error(
        `Invalid transition: ${record.state} → ${newState} ` +
        `(allowed: ${allowed.join(', ') || 'none — terminal state'})`,
      )
    }
    const now = Date.now()
    const from = record.state
    record.state = newState
    record.updatedAt = now
    if (opts?.txHash) record.txHash = opts.txHash
    if (opts?.error) record.error = opts.error
    record.transitions.push({ from, to: newState, timestamp: now })
    this.appendLog({ id, from, to: newState, txHash: opts?.txHash, error: opts?.error, timestamp: now })
    return record
  }

  /** Return all records NOT in a terminal state. */
  getActive(): ExecutionRecord[] {
    return [...this.records.values()].filter(r => !TERMINAL_STATES.has(r.state))
  }

  /** Return all records in BROADCAST or PENDING state. */
  getPending(): ExecutionRecord[] {
    return [...this.records.values()].filter(
      r => r.state === 'BROADCAST' || r.state === 'PENDING',
    )
  }

  /** Get a single record by id. */
  get(id: string): ExecutionRecord | undefined {
    return this.records.get(id)
  }

  /**
   * Recover state from the JSONL log file.
   * Reconstructs active records and flags stale BROADCAST/PENDING as TX_LOST.
   */
  recoverFromLog(): void {
    if (!existsSync(this.logPath)) return
    const content = readFileSync(this.logPath, 'utf-8').trim()
    if (!content) return
    const lines = content.split('\n')
    this.replayLogLines(lines)
    this.flagStalePending()
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private replayLogLines(lines: string[]): void {
    for (const line of lines) {
      if (!line.trim()) continue
      let entry: TransitionLogEntry
      try {
        entry = JSON.parse(line) as TransitionLogEntry
      } catch {
        continue // skip malformed lines
      }
      this.applyLogEntry(entry)
    }
  }

  private applyLogEntry(entry: TransitionLogEntry): void {
    let record = this.records.get(entry.id)
    if (!record) {
      record = {
        id: entry.id,
        venueId: '',
        vertical: '',
        symbol: '',
        side: 'buy',
        state: entry.from,
        createdAt: entry.timestamp,
        updatedAt: entry.timestamp,
        transitions: [],
      }
      this.records.set(entry.id, record)
    }
    record.state = entry.to
    record.updatedAt = entry.timestamp
    if (entry.txHash) record.txHash = entry.txHash
    if (entry.error) record.error = entry.error
    record.transitions.push({
      from: entry.from,
      to: entry.to,
      timestamp: entry.timestamp,
    })
  }

  private flagStalePending(): void {
    const now = Date.now()
    for (const record of this.records.values()) {
      if (record.state !== 'BROADCAST' && record.state !== 'PENDING') continue
      if (now - record.updatedAt < TX_LOST_THRESHOLD_MS) continue
      const from = record.state
      record.state = 'TX_LOST'
      record.updatedAt = now
      record.transitions.push({ from, to: 'TX_LOST', timestamp: now })
      this.appendLog({ id: record.id, from, to: 'TX_LOST', timestamp: now })
    }
  }

  private ensureLogDir(): void {
    const dir = dirname(this.logPath)
    mkdirSync(dir, { recursive: true })
  }

  private appendLog(entry: TransitionLogEntry): void {
    const json = JSON.stringify(entry) + '\n'
    const tmpPath = this.logPath + '.tmp'
    try {
      // Append: read existing, concat, write atomically
      const existing = existsSync(this.logPath)
        ? readFileSync(this.logPath, 'utf-8')
        : ''
      writeFileSync(tmpPath, existing + json, 'utf-8')
      renameSync(tmpPath, this.logPath)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new Error(`Failed to write execution log: ${msg}`)
    }
  }
}
