import { getGlobalConfig } from '../utils/config.js'
import {
  type Companion,
  type CompanionBones,
  EYES,
  EMBLEMS,
  MASTERS,
  MASTER_RARITY,
  MASTER_NAMES,
  MASTER_QUOTES,
  RARITIES,
  RARITY_WEIGHTS,
  type Rarity,
  type Master,
  STAT_NAMES,
  type StatName,
} from './types.js'

// Mulberry32 — tiny seeded PRNG, good enough for picking masters
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashString(s: string): number {
  if (typeof Bun !== 'undefined') {
    return Number(BigInt(Bun.hash(s)) & 0xffffffffn)
  }
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]!
}

// Roll a master weighted by rarity tier.
// First roll rarity, then pick randomly from masters of that rarity.
function rollMaster(rng: () => number): { master: Master; rarity: Rarity } {
  const total = Object.values(RARITY_WEIGHTS).reduce((a, b) => a + b, 0)
  let roll = rng() * total
  let targetRarity: Rarity = 'common'
  for (const rarity of RARITIES) {
    roll -= RARITY_WEIGHTS[rarity]
    if (roll < 0) { targetRarity = rarity; break }
  }

  // Filter masters of this rarity
  const candidates = MASTERS.filter(m => MASTER_RARITY[m] === targetRarity)
  if (candidates.length === 0) {
    // Fallback: pick any master
    return { master: pick(rng, MASTERS), rarity: targetRarity }
  }
  return { master: pick(rng, candidates), rarity: targetRarity }
}

const RARITY_FLOOR: Record<Rarity, number> = {
  common: 5,
  uncommon: 15,
  rare: 25,
  epic: 35,
  legendary: 50,
}

// One peak stat, one dump stat, rest scattered. Rarity bumps the floor.
function rollStats(
  rng: () => number,
  rarity: Rarity,
): Record<StatName, number> {
  const floor = RARITY_FLOOR[rarity]
  const peak = pick(rng, STAT_NAMES)
  let dump = pick(rng, STAT_NAMES)
  while (dump === peak) dump = pick(rng, STAT_NAMES)

  const stats = {} as Record<StatName, number>
  for (const name of STAT_NAMES) {
    if (name === peak) {
      stats[name] = Math.min(100, floor + 50 + Math.floor(rng() * 30))
    } else if (name === dump) {
      stats[name] = Math.max(1, floor - 10 + Math.floor(rng() * 15))
    } else {
      stats[name] = floor + Math.floor(rng() * 40)
    }
  }
  return stats
}

const SALT = 'sensei-2026-401'

export type Roll = {
  bones: CompanionBones
  inspirationSeed: number
}

function rollFrom(rng: () => number): Roll {
  const { master, rarity } = rollMaster(rng)
  const bones: CompanionBones = {
    rarity,
    species: master,
    eye: pick(rng, EYES),
    hat: rarity === 'common' ? 'none' : pick(rng, EMBLEMS),
    shiny: rng() < 0.01,
    stats: rollStats(rng, rarity),
  }
  return { bones, inspirationSeed: Math.floor(rng() * 1e9) }
}

// Called from hot paths with the same userId → cache the deterministic result.
let rollCache: { key: string; value: Roll } | undefined
export function roll(userId: string): Roll {
  const key = userId + SALT
  if (rollCache?.key === key) return rollCache.value
  const value = rollFrom(mulberry32(hashString(key)))
  rollCache = { key, value }
  return value
}

export function rollWithSeed(seed: string): Roll {
  return rollFrom(mulberry32(hashString(seed)))
}

export function companionUserId(): string {
  const config = getGlobalConfig()
  return config.oauthAccount?.accountUuid ?? config.userID ?? 'anon'
}

// Get the user's assigned master guardian
export function getCompanion(): Companion | undefined {
  const stored = getGlobalConfig().companion
  if (!stored) return undefined
  const { bones } = roll(companionUserId())
  return { ...stored, ...bones }
}

// Get display name for current master
export function getMasterName(master: Master): string {
  return MASTER_NAMES[master] ?? master
}

// Get iconic quote for current master
export function getMasterQuote(master: Master): string {
  return MASTER_QUOTES[master] ?? ''
}

// Get the system prompt prefix for the guardian persona
export function getGuardianPrompt(master: Master): string {
  const name = MASTER_NAMES[master]
  const quote = MASTER_QUOTES[master]
  return `You are ${name}, acting as a trading risk guardian. Stay in character. Your iconic philosophy: "${quote}". Respond to trading decisions with your known trading style and risk philosophy. Be concise, opinionated, and true to your historical personality.`
}
