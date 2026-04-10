/**
 * Ghost Warning Engine — cautionary apparitions from finance's fallen.
 * When users repeat dangerous patterns, the ghosts of SBF, Do Kwon,
 * Su Zhu, Newton, LTCM, Lehman, Enron, SVB, BitMEX Rekt, and
 * Bill Hwang appear to warn them.
 *
 * Per-ghost 60-minute cooldown prevents alert fatigue while allowing
 * different ghosts to trigger independently.
 */

import type { Position, Order, Balance } from '../services/exchange/types.js'
import { getBackendEventStream } from '../services/backend/event-stream.js'
import {
  checkSbfTrigger,
  checkDoKwonTrigger,
  checkSuZhuTrigger,
  checkNewtonTrigger,
  checkLtcmTrigger,
  checkLehmanTrigger,
  checkEnronTrigger,
  checkSvbTrigger,
  checkBitmexRektTrigger,
  checkBillHwangTrigger,
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
  /** Current effective leverage (for BitMEX Rekt trigger). */
  leverage?: number
  /** Margin utilization percentage 0-100 (for BitMEX Rekt trigger). */
  marginUtilization?: number
}

/** Per-ghost cooldown period in milliseconds (60 minutes). */
const GHOST_COOLDOWN_MS = 60 * 60 * 1000

export class GhostEngine {
  private readonly ghostCooldowns: Map<string, number> = new Map()

  /**
   * Check all 10 ghost triggers in priority order.
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
      // New 2 ghosts (leverage-aware, graceful skip when data unavailable)
      () => context.leverage != null && context.marginUtilization != null
        ? checkBitmexRektTrigger(context.leverage, context.marginUtilization)
        : null,
      () => context.leverage != null
        ? checkBillHwangTrigger(context.positions, context.balances, context.leverage)
        : null,
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

        // Emit GhostWarning to BackendEventStream (fire-and-forget)
        try {
          getBackendEventStream().emitEvent({
            type: 'GhostWarning',
            ghostId: warning.ghostId,
            ghostName: warning.ghostName,
            triggerReason: warning.triggerReason,
            quote: warning.quote,
            timestamp: Date.now(),
          })
        } catch {
          // Backend event emission must never propagate
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
   * Format a ghost warning for terminal display as a framed card.
   * Respects NO_COLOR environment variable for plain text fallback.
   */
  formatForTerminal(warning: GhostWarning): string {
    if (process.env.NO_COLOR) {
      return `...${warning.quote.toLowerCase()}... - ${warning.ghostName} [${warning.triggerReason}]`
    }

    const W = 44
    const innerW = W - 4 // usable content width inside "│  " and " │"

    const wrapText = (text: string, width: number): string[] => {
      const words = text.split(' ')
      const lines: string[] = []
      let cur = ''
      for (const w of words) {
        if (cur.length + w.length + 1 > width && cur) {
          lines.push(cur)
          cur = w
        } else {
          cur = cur ? `${cur} ${w}` : w
        }
      }
      if (cur) lines.push(cur)
      return lines
    }

    const pad = (content: string): string => {
      const padding = Math.max(0, innerW - content.length)
      return `│  ${content}${' '.repeat(padding)} │`
    }

    const emptyRow = pad('')
    const headerLabel = '[GHOST_WARNING]'
    const headerDash = W - 4 - headerLabel.length - 5 // 5 for " ⚠ ─"
    const top = `┌─${headerLabel}${'─'.repeat(Math.max(1, headerDash))} ⚠ ─┐`
    const bottom = `└${'─'.repeat(W - 2)}┘`

    const quoteLines = wrapText(`"${warning.quote}"`, innerW)
    const nameRight = `— ${warning.ghostName}`
    const triggerText = `[TRIGGER] ${warning.triggerReason}`
    const triggerLines = wrapText(triggerText, innerW)

    const lines: string[] = [top]
    for (const ql of quoteLines) lines.push(pad(ql))
    lines.push(pad(`${' '.repeat(Math.max(0, innerW - nameRight.length))}${nameRight}`))
    for (const tl of triggerLines) lines.push(pad(tl))
    lines.push(bottom)

    return lines.join('\n')
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

// Module-level singleton — preserves per-ghost cooldown state across calls.
let defaultEngine: GhostEngine | null = null

/**
 * Convenience function — uses a module-level singleton engine so that
 * per-ghost cooldowns persist across calls. Previously created a new
 * engine each call, resetting cooldowns and causing alert spam.
 */
export function checkGhostTriggers(context: GhostContext): GhostWarning | null {
  if (!defaultEngine) defaultEngine = new GhostEngine()
  return defaultEngine.checkAll(context)
}
