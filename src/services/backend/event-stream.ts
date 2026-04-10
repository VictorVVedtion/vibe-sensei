/**
 * BackendEventStream — typed EventEmitter singleton for backend events.
 *
 * The query engine and guardian systems emit events here. Consumers
 * (Rust TUI via UDS server in Sprint 126, or any other subscriber)
 * listen via the typed `on` method.
 *
 * Design:
 * - Singleton pattern via getBackendEventStream()
 * - Extends Node.js EventEmitter (built-in, no dependencies)
 * - Fire-and-forget emission (emit never throws, never blocks)
 * - Typed API via BackendEventMap for type-safe emit/on
 */

import { EventEmitter } from 'events'
import type { BackendEvent, BackendEventMap, BackendEventType } from './types.js'

export class BackendEventStream extends EventEmitter {
  /**
   * Emit a typed backend event. Fire-and-forget: errors from listeners
   * are caught and silently swallowed to prevent side-effect failures
   * from breaking the query loop.
   */
  emitEvent<T extends BackendEventType>(event: BackendEventMap[T]): void {
    try {
      this.emit(event.type, event)
    } catch {
      // Fire-and-forget — listener errors must never propagate
    }
  }

  /**
   * Subscribe to a specific event type with a typed handler.
   */
  onEvent<T extends BackendEventType>(
    type: T,
    handler: (event: BackendEventMap[T]) => void,
  ): this {
    return this.on(type, handler)
  }

  /**
   * Subscribe to all backend events regardless of type.
   * Useful for the UDS server that forwards everything.
   */
  onAnyEvent(handler: (event: BackendEvent) => void): this {
    const types: BackendEventType[] = [
      'StreamChunk',
      'ToolCallStart',
      'ToolCallEnd',
      'GuardianAlert',
      'DebateStart',
      'GhostWarning',
      'BalanceUpdate',
      'PriceUpdate',
      'StateSync',
    ]
    for (const type of types) {
      this.on(type, handler)
    }
    return this
  }

  /**
   * Remove a handler from all event types (for cleanup).
   */
  offAnyEvent(handler: (event: BackendEvent) => void): this {
    const types: BackendEventType[] = [
      'StreamChunk',
      'ToolCallStart',
      'ToolCallEnd',
      'GuardianAlert',
      'DebateStart',
      'GhostWarning',
      'BalanceUpdate',
      'PriceUpdate',
      'StateSync',
    ]
    for (const type of types) {
      this.off(type, handler)
    }
    return this
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

let instance: BackendEventStream | null = null

/**
 * Returns the singleton BackendEventStream instance.
 * Safe to call from anywhere — returns the same instance across all imports.
 */
export function getBackendEventStream(): BackendEventStream {
  if (!instance) {
    instance = new BackendEventStream()
    // Raise the default listener limit to avoid warnings in long sessions
    // where many consumers subscribe (UDS server, desktop bridge, tests, etc.)
    instance.setMaxListeners(50)
  }
  return instance
}

/**
 * Reset the singleton (for testing only).
 * Removes all listeners and creates a fresh instance on next access.
 */
export function resetBackendEventStream(): void {
  if (instance) {
    instance.removeAllListeners()
    instance = null
  }
}
