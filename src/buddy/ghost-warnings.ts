/**
 * Ghost Warning Engine — cautionary apparitions from crypto's fallen.
 * When users repeat dangerous patterns, the ghosts of SBF, Do Kwon,
 * Su Zhu, and Newton appear to warn them.
 *
 * Only 1 ghost per session to prevent alert fatigue.
 */

import type { Position, Order, Balance } from '../services/exchange/types.js'
import {
  checkSbfTrigger,
  checkDoKwonTrigger,
  checkSuZhuTrigger,
  checkNewtonTrigger,
} from './checks/ghost-triggers.js'

export interface GhostWarning {
  ghostId: string
  ghostName: string
  quote: string
  triggerReason: string
  timestamp: Date
}

export interface GhostContext {
  positions: Position[]
  orders: Order[]
  balances: Balance[]
  ignoredAlertCount: number
  lastBuyPrice: number
  price24hAgo: number
}

export class GhostEngine {
  private triggeredThisSession: boolean = false

  /**
   * Check all ghost triggers in priority order.
   * Returns at most 1 ghost per session.
   */
  checkAll(context: GhostContext): GhostWarning | null {
    if (this.triggeredThisSession) return null

    const checks: Array<() => GhostWarning | null> = [
      () => checkSbfTrigger(context.positions, context.orders),
      () => checkDoKwonTrigger(context.ignoredAlertCount),
      () => checkSuZhuTrigger(context.positions, context.balances),
      () => checkNewtonTrigger(context.lastBuyPrice, context.price24hAgo),
    ]

    for (const check of checks) {
      const warning = check()
      if (warning !== null) {
        this.triggeredThisSession = true
        return warning
      }
    }

    return null
  }

  /**
   * Format a ghost warning for terminal display with ANSI escape codes.
   * Respects NO_COLOR environment variable for plain text fallback.
   */
  formatForTerminal(warning: GhostWarning): string {
    if (process.env.NO_COLOR) {
      return `WARNING GHOST: ${warning.ghostName} -- "${warning.quote}" [${warning.triggerReason}]`
    }

    const dim = '\x1b[2m'
    const dimItalic = '\x1b[2;3m'
    const reset = '\x1b[0m'

    return (
      `${dim}\u26a0\ufe0f GHOST: ${warning.ghostName}${reset}\n` +
      `${dimItalic}"${warning.quote}"${reset}\n` +
      `${dim}[${warning.triggerReason}]${reset}`
    )
  }

  /** Whether a ghost has already appeared this session. */
  get hasTriggered(): boolean {
    return this.triggeredThisSession
  }
}

/**
 * Convenience function — create engine, check all triggers, return result.
 * Exported for single-call usage from guardian or other modules.
 */
export function checkGhostTriggers(context: GhostContext): GhostWarning | null {
  const engine = new GhostEngine()
  return engine.checkAll(context)
}
