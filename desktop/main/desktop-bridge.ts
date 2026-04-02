/**
 * Desktop Bridge (Electron side) — polls a JSONL file written by the Bun process
 * and forwards parsed messages to the main process via a callback.
 *
 * The Bun child process appends JSON lines to a temp file; this bridge reads
 * only new content since last poll, parses each line, and emits events.
 *
 * Polling at 500ms provides near-real-time data flow without the complexity
 * of sockets or custom IPC protocols.
 */

import { openSync, readSync, closeSync, statSync, writeFileSync } from 'fs'

export interface BridgeMessage {
  type: 'trading_state' | 'guardian_alert' | 'master_info'
  data: unknown
  timestamp: number
}

type BridgeCallback = (message: BridgeMessage) => void

const POLL_INTERVAL_MS = 500

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
          const message = JSON.parse(trimmed) as BridgeMessage
          if (message.type && message.data !== undefined) {
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
