/**
 * Desktop Bridge (Electron side) — polls a JSONL file written by the Bun process
 * and forwards parsed messages to the main process via a callback.
 *
 * The Bun child process appends JSON lines to a temp file; this bridge reads
 * only new content since last poll, parses each line, and emits events.
 *
 * Polling at 200ms provides near-real-time data flow without the complexity
 * of sockets or custom IPC protocols.
 */

import { openSync, readSync, closeSync, statSync, writeFileSync } from 'fs'
import type { ZodSchema } from 'zod'
import {
  TradingStateSchema,
  GuardianAlertSchema,
  MasterInfoSchema,
  CompanionEmotionSchema,
  CompanionSpeechSchema,
  TiltStateSchema,
  PlaybookCardSchema,
  TradeReviewSchema,
  AntiPortfolioSchema,
  CouncilDebateSchema,
  NewsAlertSchema,
  TradeHistorySchema,
} from '../shared/ipc-channels'

export interface BridgeMessage {
  type:
    | 'trading_state'
    | 'guardian_alert'
    | 'master_info'
    | 'companion_emotion'
    | 'companion_speech'
    | 'tilt_state'
    | 'playbook_card'
    | 'trade_review'
    | 'anti_portfolio'
    | 'council_debate'
    | 'news_alert'
    | 'trade_history'
  data: unknown
  timestamp: number
}

/** Map message types to their Zod validation schemas */
const MESSAGE_SCHEMAS: Partial<Record<BridgeMessage['type'], ZodSchema>> = {
  trading_state: TradingStateSchema,
  guardian_alert: GuardianAlertSchema,
  master_info: MasterInfoSchema,
  companion_emotion: CompanionEmotionSchema,
  companion_speech: CompanionSpeechSchema,
  tilt_state: TiltStateSchema,
  playbook_card: PlaybookCardSchema,
  trade_review: TradeReviewSchema,
  anti_portfolio: AntiPortfolioSchema,
  council_debate: CouncilDebateSchema,
  news_alert: NewsAlertSchema,
  trade_history: TradeHistorySchema,
}

/**
 * Validate a parsed bridge message against the Zod schema for its type.
 * Returns the validated BridgeMessage if the schema passes, or if no schema
 * exists for the type (backward compat). Returns null if validation fails.
 */
function validateBridgeMessage(parsed: Record<string, unknown>): BridgeMessage | null {
  const type = parsed.type as BridgeMessage['type']
  const schema = MESSAGE_SCHEMAS[type]

  if (!schema) {
    // No schema for this type — pass through with basic structural check
    if (typeof type === 'string' && parsed.data !== undefined) {
      return parsed as unknown as BridgeMessage
    }
    return null
  }

  const result = schema.safeParse(parsed.data)
  if (!result.success) {
    console.warn(
      `[DesktopBridge] Validation failed for "${type}": ${result.error.issues.map((i) => i.message).join(', ')}`,
    )
    return null
  }

  return { type, data: result.data, timestamp: parsed.timestamp as number }
}

type BridgeCallback = (message: BridgeMessage) => void

const POLL_INTERVAL_MS = 200

export class DesktopBridge {
  private readonly filePath: string
  private lastReadPosition = 0
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private callback: BridgeCallback | null = null

  constructor(filePath: string) {
    this.filePath = filePath
  }

  /**
   * Register a callback for incoming bridge messages.
   * Only one callback is supported — subsequent calls replace the previous.
   */
  onData(cb: BridgeCallback): void {
    this.callback = cb
  }

  /**
   * Begin polling the bridge file for new JSON lines.
   * Creates the file (empty) if it does not exist, ensuring the Bun side
   * can append to it immediately on startup.
   */
  start(): void {
    // Ensure bridge file exists so the Bun process can write to it
    try {
      writeFileSync(this.filePath, '', { flag: 'a' })
    } catch {
      // Non-fatal — the Bun side will create it on first write
    }

    this.lastReadPosition = this.getFileSize()
    this.pollTimer = setInterval(() => this.poll(), POLL_INTERVAL_MS)
  }

  /** Stop polling and release resources. */
  stop(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }

  /**
   * Read new content from the bridge file since last poll.
   * Parses each complete JSON line and dispatches to the callback.
   */
  private poll(): void {
    try {
      const currentSize = this.getFileSize()

      // Nothing new to read
      if (currentSize <= this.lastReadPosition) {
        // File was truncated or replaced — reset position
        if (currentSize < this.lastReadPosition) {
          this.lastReadPosition = 0
        }
        return
      }

      // Read only the new bytes
      const buffer = Buffer.alloc(currentSize - this.lastReadPosition)
      const fd = openSync(this.filePath, 'r')
      try {
        readSync(fd, buffer, 0, buffer.length, this.lastReadPosition)
      } finally {
        closeSync(fd)
      }

      this.lastReadPosition = currentSize

      const chunk = buffer.toString('utf-8')
      const lines = chunk.split('\n')

      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.length === 0) continue

        try {
          const parsed = JSON.parse(trimmed)
          if (typeof parsed !== 'object' || parsed === null || typeof parsed.type !== 'string') {
            continue
          }
          const message = validateBridgeMessage(parsed as Record<string, unknown>)
          if (message) {
            this.callback?.(message)
          }
        } catch {
          // Malformed JSON line — skip silently
        }
      }
    } catch {
      // File read error — skip this poll cycle
    }
  }

  /** Get the current file size, returning 0 if file doesn't exist. */
  private getFileSize(): number {
    try {
      return statSync(this.filePath).size
    } catch {
      return 0
    }
  }
}
