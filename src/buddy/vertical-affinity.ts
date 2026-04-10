/**
 * Master Vertical Affinity — how well each of the 68 masters resonates
 * with each of the 7 trading verticals.
 *
 * Default score: 50 (neutral). Overrides for ~15 masters with clear
 * historical/philosophical associations to specific asset classes.
 *
 * Used by the debate engine to prefer contrarians with domain expertise
 * and by risk checks to weight vertical-specific warnings.
 */

import type { TradingVertical } from '../services/exchange/types.js'
import type { Master } from './types.js'

// ── Types ────────────────────────────────────────────────────────────────

type VerticalScores = Record<TradingVertical, number>

// ── Default (neutral = 50 for all verticals) ─────────────────────────────

const DEFAULT_SCORES: VerticalScores = {
  spot: 50,
  perp_futures: 50,
  crypto_options: 50,
  stocks: 50,
  prediction: 50,
  defi_dex: 50,
  forex: 50,
}

// ── Master Overrides ─────────────────────────────────────────────────────

const OVERRIDES: Partial<Record<Master, Partial<VerticalScores>>> = {
  arthur_hayes: {
    perp_futures: 95,
    crypto_options: 60,
  },
  warren_buffett: {
    stocks: 95,
    perp_futures: 5,
    defi_dex: 0,
  },
  vitalik_buterin: {
    defi_dex: 90,
    perp_futures: 30,
  },
  ed_thorp: {
    crypto_options: 90,
    stocks: 80,
  },
  nassim_taleb: {
    crypto_options: 85,
    forex: 70,
  },
  george_soros: {
    forex: 90,
    stocks: 85,
  },
  jesse_livermore: {
    stocks: 85,
    perp_futures: 70,
  },
  paul_tudor_jones: {
    forex: 85,
    perp_futures: 80,
  },
  ray_dalio: {
    forex: 80,
    stocks: 75,
  },
  jim_simons: {
    perp_futures: 80,
    stocks: 80,
    crypto_options: 75,
  },
  benjamin_graham: {
    stocks: 95,
    perp_futures: 5,
  },
  charlie_munger: {
    stocks: 90,
    prediction: 60,
  },
  stanley_druckenmiller: {
    forex: 85,
    perp_futures: 75,
  },
  john_paulson: {
    stocks: 80,
    prediction: 70,
  },
  michael_burry: {
    crypto_options: 80,
    stocks: 85,
  },
}

// ── Public API ───────────────────────────────────────────────────────────

/**
 * Get a master's affinity score (0-100) for a given trading vertical.
 *
 * Returns the overridden score if the master has one, otherwise 50 (neutral).
 * Unknown masters also return 50.
 */
export function getVerticalAffinity(
  masterId: string,
  vertical: TradingVertical,
): number {
  const masterOverrides = OVERRIDES[masterId as Master]
  if (!masterOverrides) return DEFAULT_SCORES[vertical]
  return masterOverrides[vertical] ?? DEFAULT_SCORES[vertical]
}

/**
 * Get all vertical affinity scores for a master.
 * Returns a complete VerticalScores record with defaults merged.
 */
export function getAllVerticalAffinities(
  masterId: string,
): VerticalScores {
  const masterOverrides = OVERRIDES[masterId as Master]
  if (!masterOverrides) return { ...DEFAULT_SCORES }
  return { ...DEFAULT_SCORES, ...masterOverrides }
}

/**
 * Find the top N masters with the highest affinity for a given vertical.
 * Useful for selecting debate participants with domain expertise.
 */
export function getTopMastersForVertical(
  vertical: TradingVertical,
  masterIds: readonly string[],
  topN: number = 5,
): Array<{ masterId: string; score: number }> {
  const scored = masterIds.map((id) => ({
    masterId: id,
    score: getVerticalAffinity(id, vertical),
  }))

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, topN)
}
