/**
 * Execution service — singleton access to the ExecutionTracker.
 */

export {
  ExecutionTracker,
  ALLOWED_TRANSITIONS,
  TERMINAL_STATES,
  type ExecutionState,
  type ExecutionRecord,
  type StateTransition,
  type TransitionLogEntry,
  type TransitionOpts,
} from './state-machine.js'

import { ExecutionTracker } from './state-machine.js'

let instance: ExecutionTracker | null = null

/** Get or create the global ExecutionTracker singleton. */
export function getExecutionTracker(): ExecutionTracker {
  if (!instance) {
    instance = new ExecutionTracker()
    instance.recoverFromLog()
  }
  return instance
}

/** Reset the singleton (useful for testing). */
export function resetExecutionTracker(): void {
  instance = null
}
