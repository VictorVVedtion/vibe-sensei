/**
 * BackendEvent — discriminated union of all events emitted by the Node.js backend.
 *
 * These types define the contract between the query engine and any consumer
 * (Rust TUI via UDS in Sprint 126, or the existing Ink REPL which ignores them).
 *
 * All variants are plain serializable objects — no functions, no circular refs,
 * no class instances. This makes them safe for JSON serialization over IPC.
 */

// ─── Event Variants ─────────────────────────────────────────────────────────

export type StreamChunkEvent = {
  type: 'StreamChunk'
  text: string
  timestamp: number
}

export type ToolCallStartEvent = {
  type: 'ToolCallStart'
  id: string
  name: string
  input: Record<string, unknown>
  timestamp: number
}

export type ToolCallEndEvent = {
  type: 'ToolCallEnd'
  id: string
  output: string
  isError: boolean
  timestamp: number
}

export type GuardianAlertEvent = {
  type: 'GuardianAlert'
  severity: string
  message: string
  emotion: string
  masterName: string
  timestamp: number
}

export type DebateStartEvent = {
  type: 'DebateStart'
  forMaster: string
  againstMaster: string
  topic: string
  timestamp: number
}

export type GhostWarningEvent = {
  type: 'GhostWarning'
  ghostId: string
  ghostName: string
  triggerReason: string
  quote: string
  timestamp: number
}

export type BalanceUpdateEvent = {
  type: 'BalanceUpdate'
  balances: Array<{
    currency: string
    free: number
    used: number
    total: number
  }>
  timestamp: number
}

export type PriceUpdateEvent = {
  type: 'PriceUpdate'
  symbol: string
  ohlcv: {
    open: number
    high: number
    low: number
    close: number
    volume: number
  }
  timestamp: number
}

export type StateSyncEvent = {
  type: 'StateSync'
  fullState: Record<string, unknown>
  timestamp: number
}

// ─── Discriminated Union ────────────────────────────────────────────────────

export type BackendEvent =
  | StreamChunkEvent
  | ToolCallStartEvent
  | ToolCallEndEvent
  | GuardianAlertEvent
  | DebateStartEvent
  | GhostWarningEvent
  | BalanceUpdateEvent
  | PriceUpdateEvent
  | StateSyncEvent

// ─── Type Guard Helpers ─────────────────────────────────────────────────────

export type BackendEventType = BackendEvent['type']

/** Map from event type string to the corresponding event shape. */
export type BackendEventMap = {
  StreamChunk: StreamChunkEvent
  ToolCallStart: ToolCallStartEvent
  ToolCallEnd: ToolCallEndEvent
  GuardianAlert: GuardianAlertEvent
  DebateStart: DebateStartEvent
  GhostWarning: GhostWarningEvent
  BalanceUpdate: BalanceUpdateEvent
  PriceUpdate: PriceUpdateEvent
  StateSync: StateSyncEvent
}
