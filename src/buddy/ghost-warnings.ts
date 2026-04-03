/**
 * Ghost Warning Engine — cautionary apparitions from finance's fallen.
 * When users repeat dangerous patterns, the ghosts of SBF, Do Kwon,
 * Su Zhu, Newton, LTCM, Lehman, Enron, and SVB appear to warn them.
 *
 * Per-ghost 60-minute cooldown prevents alert fatigue while allowing
 * different ghosts to trigger independently.
 */

import type { Position, Order, Balance } from '../services/exchange/types.js'
import {
  checkSbfTrigger,
  checkDoKwonTrigger,
  checkSuZhuTrigger,
  checkNewtonTrigger,
  checkLtcmTrigger,
  checkLehmanTrigger,
  checkEnronTrigger,
  checkSvbTrigger,
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
  /** Current BTC price for Lehman cascade liquidation check. */
  currentBtcPrice: number
  /** BTC price 24h ago for Lehman cascade liquidation check. */
  btcPrice24hAgo: number
}

/** Per-ghost cooldown period in milliseconds (60 minutes). */
const GHOST_COOLDOWN_MS = 60 * 60 * 1000

export class GhostEngine {
  private readonly ghostCooldowns: Map<string, number> = new Map()

  /**
   * Check all 8 ghost triggers in priority order.
   * Returns at most 1 ghost per call, respecting per-ghost cooldowns.
   */
  checkAll(context: GhostContext): GhostWarning | null {
    const checks: Array<() => GhostWarning | null> = [
      // Original 4 ghosts (unchanged trigger logic)
      () => checkSbfTrigger(context.positions, context.orders),
      () => checkDoKwonTrigger(context.ignoredAlertCount),
      () => checkSuZhuTrigger(context.positions, context.balances),
      () => checkNewtonTrigger(context.lastBuyPrice, context.price24hAgo),
      // New 4 financial ghosts
      () => checkLtcmTrigger(context.positions),
      () =>
        checkLehmanTrigger(
          context.positions,
          context.balances,
          context.currentBtcPrice,
          context.btcPrice24hAgo,
        ),
      () => checkEnronTrigger(context.positions, context.balances),
      () => checkSvbTrigger(context.positions),
    ]

    for (const check of checks) {
      const warning = check()
      if (warning !== null && !this.isOnCooldown(warning.ghostId)) {
        this.ghostCooldowns.set(warning.ghostId, Date.now())

        // Emit GhostEvent to Knowledge Base (sync-safe, fire-and-forget)
        try {
          const { queueEvent } = require('../services/knowledge/event-store.js') as typeof import('../services/knowledge/event-store.js')
          queueEvent({
            id: '',
            type: 'ghost',
            timestamp: new Date().toISOString(),
            ghostId: warning.ghostId,
            ghostName: warning.ghostName,
            triggerReason: warning.triggerReason,
          })
        } catch {
          // KB event emission must never propagate
        }

        return warning
      }
    }

    return null
  }

  /**
   * Check whether a ghost is still within its 60-minute cooldown window.
   */
  private isOnCooldown(ghostId: string): boolean {
    const lastTriggered = this.ghostCooldowns.get(ghostId)
    if (lastTriggered === undefined) return false
    return Date.now() - lastTriggered < GHOST_COOLDOWN_MS
  }

  /**
   * Format a ghost warning for terminal display with ANSI escape codes.
   * Respects NO_COLOR environment variable for plain text fallback.
   */
  formatForTerminal(warning: GhostWarning): string {
    if (process.env.NO_COLOR) {
      return `...${warning.quote.toLowerCase()}... - ${warning.ghostName} [${warning.triggerReason}]`
    }

    const dim = '\x1b[2m'
    const dimItalic = '\x1b[2;3m'
    const reset = '\x1b[0m'

    return (
      `${dimItalic}...${warning.quote.toLowerCase()}...${reset}\n` +
      `${dim}- ${warning.ghostName}${reset}\n` +
      `${dim}[${warning.triggerReason}]${reset}`
    )
  }

  /** Whether any ghost has triggered (checking cooldowns). */
  get hasTriggered(): boolean {
    const now = Date.now()
    for (const [, lastTime] of this.ghostCooldowns) {
      if (now - lastTime < GHOST_COOLDOWN_MS) return true
    }
    return false
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
