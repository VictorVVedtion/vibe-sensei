/**
 * Guardian Debates — before big trades, two masters argue for and against.
 * Picks a contrarian master with opposing philosophy and formats a structured debate.
 */

import type { Master } from './types.js'
import { MASTERS, MASTER_NAMES, MASTER_RARITY } from './types.js'
import { getMasterArchetype, type Archetype } from './persona.js'
import type { OrderRequest, Position, Balance } from '../services/exchange/types.js'
import { isDesktopMode, emitToDesktop } from '../services/desktop/bridge.js'
import { getBackendEventStream } from '../services/backend/event-stream.js'

// ─── Types ───────────────────────────────────────────────────────────────────

export type DebateResult = {
  shouldDebate: boolean
  masterFor: Master
  masterAgainst: Master
  forPrompt: string
  againstPrompt: string
}

// ─── Archetype Opposition Map ────────────────────────────────────────────────

const ARCHETYPE_OPPOSITION: Record<Archetype, Archetype[]> = {
  value_investor: ['trend_follower', 'macro_trader', 'crypto_native'],
  trend_follower: ['value_investor', 'philosopher', 'scientist'],
  macro_trader: ['value_investor', 'quant', 'philosopher'],
  quant: ['philosopher', 'first_principles', 'strategist'],
  strategist: ['quant', 'crypto_native', 'scientist'],
  philosopher: ['trend_follower', 'quant', 'crypto_native'],
  first_principles: ['strategist', 'value_investor', 'macro_trader'],
  crypto_native: ['value_investor', 'philosopher', 'scientist'],
  scientist: ['trend_follower', 'strategist', 'crypto_native'],
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** FNV-1a hash to get a deterministic number from a master ID. */
function hashMasterId(master: Master): number {
  let h = 2166136261
  for (let i = 0; i < master.length; i++) {
    h ^= master.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Compute total portfolio value from balances (sum of all total fields). */
function totalPortfolioValue(balances: Balance[]): number {
  return balances.reduce((sum, b) => sum + b.total, 0)
}

/**
 * Estimate the notional value of an order.
 * For market orders (no price), uses lastPrice fallback.
 * Returns 0 only when neither order.price nor lastPrice is available.
 */
function estimateOrderValue(order: OrderRequest, lastPrice?: number): number {
  const price = order.price ?? lastPrice ?? 0
  return order.quantity * price
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Returns true if the order value exceeds 5% of total portfolio.
 * For market orders without a price, uses lastPrice to estimate value.
 * If lastPrice is also unavailable, falls back to a quantity-based heuristic:
 * triggers debate when quantity * portfolio / 1000 exceeds the threshold,
 * which catches large-quantity market orders conservatively.
 */
export function shouldTriggerDebate(
  order: OrderRequest,
  _positions: Position[],
  balances: Balance[],
  lastPrice?: number,
): boolean {
  const portfolio = totalPortfolioValue(balances)
  if (portfolio <= 0) return false

  const orderValue = estimateOrderValue(order, lastPrice)

  // When we have a usable order value, apply the standard 5% threshold
  if (orderValue > 0) return orderValue / portfolio > 0.05

  // Fallback for market orders with no price info at all:
  // conservatively assume the order is significant if quantity > 0
  // (better to debate unnecessarily than to skip a large market order)
  if (!order.price && !lastPrice && order.quantity > 0) return true

  return false
}

/**
 * Pick a master with an opposing philosophy to serve as contrarian.
 * Uses archetype opposition map; falls back to a different-archetype master
 * selected deterministically from the user master's ID hash.
 */
export function selectContrarian(userMaster: Master): Master {
  const userArchetype = getMasterArchetype(userMaster)
  const opposingArchetypes = ARCHETYPE_OPPOSITION[userArchetype]
  const seed = hashMasterId(userMaster)

  // Gather all masters from opposing archetypes (excluding the user master)
  const candidates = MASTERS.filter((m) => {
    if (m === userMaster) return false
    return opposingArchetypes.includes(getMasterArchetype(m))
  })

  if (candidates.length > 0) {
    return candidates[seed % candidates.length]!
  }

  // Fallback: pick any master from a different archetype
  const fallback = MASTERS.filter((m) => {
    if (m === userMaster) return false
    return getMasterArchetype(m) !== userArchetype
  })

  return fallback[seed % fallback.length] ?? MASTERS[0]!
}

/**
 * Build the debate prompts for the FOR and AGAINST sides.
 * Each prompt instructs the master to argue their position in 2-3 sentences.
 */
export function buildDebatePrompts(
  order: OrderRequest,
  userMaster: Master,
  contrarian: Master,
  tradingContext: string,
): { forPrompt: string; againstPrompt: string } {
  const orderDesc = `${order.side.toUpperCase()} ${order.quantity} ${order.symbol}`
    + (order.price ? ` @ ${order.price}` : ' at market')

  const forPrompt = [
    `You are ${MASTER_NAMES[userMaster]}, a trading guardian.`,
    `Argue FOR this trade in 2-3 sentences, using your known philosophy.`,
    `Trade: ${orderDesc}.`,
    `Context: ${tradingContext}`,
    `Be concise, confident, and in character.`,
  ].join(' ')

  const againstPrompt = [
    `You are ${MASTER_NAMES[contrarian]}, a trading guardian.`,
    `Argue AGAINST this trade in 2-3 sentences, using your known philosophy.`,
    `Trade: ${orderDesc}.`,
    `Context: ${tradingContext}`,
    `Be concise, skeptical, and in character.`,
  ].join(' ')

  return { forPrompt, againstPrompt }
}

/**
 * Format the debate as a structured card for terminal display.
 * Also emits the debate to the desktop bridge for the DebateRoom overlay.
 */
export function formatDebateOutput(
  masterFor: Master,
  argumentFor: string,
  masterAgainst: Master,
  argumentAgainst: string,
  orderDesc?: string,
): string {
  const forName = MASTER_NAMES[masterFor]
  const forRarity = MASTER_RARITY[masterFor]
  const againstName = MASTER_NAMES[masterAgainst]
  const againstRarity = MASTER_RARITY[masterAgainst]

  // Emit to desktop bridge for DebateRoom overlay
  emitDebateToDesktop(
    masterFor, forName, argumentFor,
    masterAgainst, againstName, argumentAgainst,
    orderDesc,
  )

  // Emit DebateStart to BackendEventStream (fire-and-forget)
  try {
    getBackendEventStream().emitEvent({
      type: 'DebateStart',
      forMaster: masterFor,
      againstMaster: masterAgainst,
      topic: orderDesc ?? 'Trade Decision',
      timestamp: Date.now(),
    })
  } catch {
    // Backend event emission must never propagate
  }

  const W = 44
  const innerW = W - 4 // usable content width inside "║ " and " ║"

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
    return `\u2551 ${content}${' '.repeat(padding)} \u2551`
  }

  const headerLabel = '[GUARDIAN_DEBATE]'
  const headerFill = W - 4 - headerLabel.length // 4 for ╔═ and ═╗
  const top = `\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550${headerLabel}${'═'.repeat(Math.max(1, headerFill - 9))}\u2557`
  const bottom = `\u255A${'═'.repeat(W - 2)}\u255D`
  const emptyRow = pad('')

  const forHeader = `[FOR] ${forName} (${forRarity})`
  const forLines = wrapText(argumentFor, innerW - 2) // -2 for "┃ " prefix
  const againstHeader = `[AGAINST] ${againstName} (${againstRarity})`
  const againstLines = wrapText(argumentAgainst, innerW - 2)

  const lines: string[] = [top]
  lines.push(pad(forHeader))
  for (const fl of forLines) lines.push(pad(`\u2503 "${fl}"`))
  lines.push(emptyRow)
  lines.push(pad(againstHeader))
  for (const al of againstLines) lines.push(pad(`\u2503 "${al}"`))
  lines.push(bottom)

  return lines.join('\n')
}

/**
 * Convert a master ID to a sprite file ID.
 * Matches the naming convention in assets/sprites/ (lowercase, underscored).
 */
function masterToSpriteId(master: Master): string {
  return master.toLowerCase().replace(/\s+/g, '_')
}

/**
 * Emit the debate result to the desktop bridge for the DebateRoom overlay.
 * Silently swallows all errors — bridge failure must never block trading.
 */
function emitDebateToDesktop(
  masterFor: Master,
  forName: string,
  argumentFor: string,
  masterAgainst: Master,
  againstName: string,
  argumentAgainst: string,
  orderDesc?: string,
): void {
  try {
    if (!isDesktopMode()) return

    emitToDesktop('council_debate', {
      topic: orderDesc ?? 'Trade Decision',
      participants: [
        {
          masterName: forName,
          position: 'for' as const,
          argument: argumentFor,
          spriteId: masterToSpriteId(masterFor),
        },
        {
          masterName: againstName,
          position: 'against' as const,
          argument: argumentAgainst,
          spriteId: masterToSpriteId(masterAgainst),
        },
      ],
      verdict: 'Your call.',
      source: 'debate' as const,
      timestamp: Date.now(),
    })
  } catch {
    // Bridge emission must never propagate
  }
}
