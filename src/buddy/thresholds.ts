/**
 * Dynamic check thresholds by Guardian archetype.
 *
 * Each of the 9 archetypes has a base threshold matrix for 4 risk checks
 * (leverage, position_size, concentration, drawdown). Thresholds are then
 * adjusted by stat modifiers (AGGRESSION/WISDOM) and market regime.
 *
 * Flow: archetype base → stat modifier → regime modifier → final thresholds
 */

import type { Archetype } from './persona.js'

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface ThresholdConfig {
  warn: number   // WARNING trigger threshold
  critical: number // CRITICAL trigger threshold
}

export type CheckName = 'leverage' | 'position_size' | 'concentration' | 'drawdown'

export type ThresholdMatrix = Record<CheckName, ThresholdConfig>

/**
 * Market regime classification.
 * Defined here since src/services/market/ does not yet exist.
 * When the market module is created, this type should be imported from there.
 */
export type MarketRegime = 'trending' | 'ranging' | 'compressing' | 'expanding'

// ─── Archetype Base Thresholds ──────────────────────────────────────────────────

/**
 * 9 archetype × 4 check threshold matrix.
 *
 * Design rationale:
 * - value_investor: ultra-conservative, low leverage, tight drawdown
 * - trend_follower: rides momentum, tolerates wider drawdown for trend capture
 * - macro_trader: moderate-aggressive, flexible sizing
 * - quant: systematic, moderate thresholds, balanced
 * - strategist: similar to quant, slightly tighter drawdown for discipline
 * - philosopher: conservative, emphasizes survival over profit
 * - first_principles: moderate-aggressive, conviction-based sizing
 * - crypto_native: high-risk tolerance, wide thresholds for volatile markets
 * - scientist: data-driven moderate, tight concentration
 */
export const ARCHETYPE_THRESHOLDS: Record<Archetype, ThresholdMatrix> = {
  value_investor: {
    leverage:      { warn: 1.2, critical: 3.0 },
    position_size: { warn: 0.20, critical: 0.40 },
    concentration: { warn: 0.30, critical: 0.50 },
    drawdown:      { warn: -8, critical: -15 },
  },
  trend_follower: {
    leverage:      { warn: 3.0, critical: 7.0 },
    position_size: { warn: 0.40, critical: 0.60 },
    concentration: { warn: 0.40, critical: 0.70 },
    drawdown:      { warn: -15, critical: -30 },
  },
  macro_trader: {
    leverage:      { warn: 2.5, critical: 6.0 },
    position_size: { warn: 0.35, critical: 0.55 },
    concentration: { warn: 0.35, critical: 0.60 },
    drawdown:      { warn: -12, critical: -25 },
  },
  quant: {
    leverage:      { warn: 2.0, critical: 5.0 },
    position_size: { warn: 0.30, critical: 0.50 },
    concentration: { warn: 0.30, critical: 0.55 },
    drawdown:      { warn: -10, critical: -20 },
  },
  strategist: {
    leverage:      { warn: 2.0, critical: 5.0 },
    position_size: { warn: 0.30, critical: 0.50 },
    concentration: { warn: 0.30, critical: 0.55 },
    drawdown:      { warn: -10, critical: -22 },
  },
  philosopher: {
    leverage:      { warn: 1.5, critical: 3.5 },
    position_size: { warn: 0.20, critical: 0.40 },
    concentration: { warn: 0.25, critical: 0.45 },
    drawdown:      { warn: -8, critical: -18 },
  },
  first_principles: {
    leverage:      { warn: 2.5, critical: 6.0 },
    position_size: { warn: 0.35, critical: 0.55 },
    concentration: { warn: 0.35, critical: 0.60 },
    drawdown:      { warn: -12, critical: -25 },
  },
  crypto_native: {
    leverage:      { warn: 4.0, critical: 10.0 },
    position_size: { warn: 0.45, critical: 0.65 },
    concentration: { warn: 0.45, critical: 0.75 },
    drawdown:      { warn: -20, critical: -40 },
  },
  scientist: {
    leverage:      { warn: 2.0, critical: 5.0 },
    position_size: { warn: 0.28, critical: 0.48 },
    concentration: { warn: 0.28, critical: 0.50 },
    drawdown:      { warn: -10, critical: -20 },
  },
}

// ─── Stat Modifiers ─────────────────────────────────────────────────────────────

/**
 * Apply stat-based modifiers to a threshold config.
 *
 * - AGGRESSION > 70: relax thresholds (warn *= 1.25, critical *= 1.20)
 * - WISDOM > 70: tighten thresholds (warn *= 0.85, critical *= 0.85)
 * - PATIENCE > 70: no threshold effect (affects cooldown, future implementation)
 *
 * Both modifiers stack multiplicatively when both stats exceed 70.
 * Results are rounded to 1 decimal place.
 */
export function applyStatModifiers(
  base: ThresholdConfig,
  stats: Record<string, number>,
): ThresholdConfig {
  let warnMultiplier = 1.0
  let critMultiplier = 1.0

  const aggression = stats['AGGRESSION'] ?? stats['aggression'] ?? 0
  const wisdom = stats['WISDOM'] ?? stats['wisdom'] ?? 0

  if (aggression > 70) {
    warnMultiplier *= 1.25
    critMultiplier *= 1.20
  }

  if (wisdom > 70) {
    warnMultiplier *= 0.85
    critMultiplier *= 0.85
  }

  return {
    warn: round1(base.warn * warnMultiplier),
    critical: round1(base.critical * critMultiplier),
  }
}

// ─── Regime Modifiers ───────────────────────────────────────────────────────────

/**
 * Apply market regime modifiers to a threshold config.
 *
 * - trending: concentration warn/crit *= 1.3 (trend allows concentration)
 * - ranging: position_size warn *= 0.85 (range-bound = smaller positions)
 * - compressing: position_size warn *= 0.80 (compression = reduce exposure)
 * - expanding: leverage warn *= 0.85 (expanding volatility = lower leverage)
 * - null regime: no modification
 *
 * Only the matching check is affected; other checks pass through unchanged.
 */
export function applyRegimeModifiers(
  base: ThresholdConfig,
  regime: MarketRegime | null,
  checkName: string,
): ThresholdConfig {
  if (regime === null) return base

  let warnMultiplier = 1.0
  let critMultiplier = 1.0

  switch (regime) {
    case 'trending':
      if (checkName === 'concentration') {
        warnMultiplier = 1.3
        critMultiplier = 1.3
      }
      break
    case 'ranging':
      if (checkName === 'position_size') {
        warnMultiplier = 0.85
      }
      break
    case 'compressing':
      if (checkName === 'position_size') {
        warnMultiplier = 0.80
      }
      break
    case 'expanding':
      if (checkName === 'leverage') {
        warnMultiplier = 0.85
      }
      break
  }

  return {
    warn: round1(base.warn * warnMultiplier),
    critical: round1(base.critical * critMultiplier),
  }
}

// ─── Main API ───────────────────────────────────────────────────────────────────

/**
 * Compute dynamic thresholds for all 4 checks.
 *
 * Pipeline: archetype base → stat modifiers → regime modifiers → final
 *
 * @param archetype - Guardian archetype (e.g. 'value_investor', 'crypto_native')
 * @param stats - Guardian stat values (AGGRESSION, WISDOM, etc.)
 * @param regime - Current market regime, or null if unknown
 * @returns Record of check name to ThresholdConfig
 */
export function getThresholds(
  archetype: string,
  stats: Record<string, number>,
  regime: MarketRegime | null,
): Record<string, ThresholdConfig> {
  const base = ARCHETYPE_THRESHOLDS[archetype as Archetype]
  if (!base) {
    // Unknown archetype — fall back to quant (balanced middle-ground)
    return getThresholds('quant', stats, regime)
  }

  const result: Record<string, ThresholdConfig> = {}
  const checkNames: CheckName[] = ['leverage', 'position_size', 'concentration', 'drawdown']

  for (const name of checkNames) {
    const afterStat = applyStatModifiers(base[name], stats)
    const afterRegime = applyRegimeModifiers(afterStat, regime, name)
    result[name] = afterRegime
  }

  return result
}

// ─── Vertical Modifiers ────────────────────────────────────────────────────────

/**
 * Multipliers applied to threshold values when trading a specific vertical.
 * Values < 1.0 tighten thresholds (stricter); 1.0 = no change.
 *
 * perp_futures: significantly tighter thresholds due to leverage + liquidation risk
 * spot: no modification (baseline)
 */
export function getVerticalModifier(
  vertical: import('../services/exchange/types.js').TradingVertical,
): Record<string, number> {
  const modifiers: Record<string, Record<string, number>> = {
    perp_futures: { leverage: 0.6, position_size: 0.7, concentration: 0.8, drawdown: 0.7 },
    spot: { leverage: 1.0, position_size: 1.0, concentration: 1.0, drawdown: 1.0 },
  }
  return modifiers[vertical] ?? modifiers.spot!
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

/** Round to 1 decimal place. */
function round1(n: number): number {
  return Math.round(n * 10) / 10
}
