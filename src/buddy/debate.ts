/**
 * Guardian Debates — before big trades, two masters argue for and against.
 * Picks a contrarian master with opposing philosophy and formats a structured debate.
 */

import type { Master } from './types.js'
import { MASTERS, MASTER_NAMES, MASTER_RARITY } from './types.js'
import { getMasterArchetype, type Archetype } from './persona.js'
import type { OrderRequest, Position, Balance } from '../services/exchange/types.js'

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

/** Estimate the notional value of an order. */
function estimateOrderValue(order: OrderRequest): number {
  const price = order.price ?? 0
  return order.quantity * price
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Returns true if the order value exceeds 5% of total portfolio.
 * Orders without a price (pure market orders) return false — caller
 * should enrich with current market price before calling.
 */
export function shouldTriggerDebate(
  order: OrderRequest,
  _positions: Position[],
  balances: Balance[],
): boolean {
  const portfolio = totalPortfolioValue(balances)
  if (portfolio <= 0) return false
  const orderValue = estimateOrderValue(order)
  if (orderValue <= 0) return false
  return orderValue / portfolio > 0.05
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
 */
export function formatDebateOutput(
  masterFor: Master,
  argumentFor: string,
  masterAgainst: Master,
  argumentAgainst: string,
): string {
  const forName = MASTER_NAMES[masterFor]
  const forRarity = MASTER_RARITY[masterFor]
  const againstName = MASTER_NAMES[masterAgainst]
  const againstRarity = MASTER_RARITY[masterAgainst]

  return [
    `\u2550\u2550\u2550 GUARDIAN DEBATE \u2550\u2550\u2550`,
    ``,
    `\u{1F4C8} FOR \u2014 ${forName} (${forRarity}):`,
    `"${argumentFor}"`,
    ``,
    `\u{1F4C9} AGAINST \u2014 ${againstName} (${againstRarity}):`,
    `"${argumentAgainst}"`,
    ``,
    `\u2550\u2550\u2550 Your call. \u2550\u2550\u2550`,
  ].join('\n')
}
