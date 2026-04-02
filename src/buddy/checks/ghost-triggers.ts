/**
 * Ghost trigger detection — 4 cautionary apparitions from crypto's fallen.
 * Each function checks whether the user is repeating a dangerous pattern
 * associated with a notorious figure.
 */

import type { Position, Order, Balance } from '../../services/exchange/types.js'
import type { GhostWarning } from '../ghost-warnings.js'
import { GHOST_WARNINGS } from '../types.js'

const SBF = GHOST_WARNINGS[0]
const DO_KWON = GHOST_WARNINGS[1]
const SU_ZHU = GHOST_WARNINGS[2]
const NEWTON = GHOST_WARNINGS[3]

/**
 * SBF trigger: has open positions but zero stop_loss orders.
 * Pattern: operating without risk controls, just like FTX.
 */
export function checkSbfTrigger(
  positions: Position[],
  orders: Order[],
): GhostWarning | null {
  if (positions.length === 0) return null

  const hasStopLoss = orders.some(
    (o) => o.type === 'stop_loss' && o.status === 'open',
  )

  if (hasStopLoss) return null

  return {
    ghostId: SBF.id,
    ghostName: SBF.name,
    quote: SBF.quote,
    triggerReason: `${positions.length} open position(s) with no stop-loss orders — missing risk controls`,
    timestamp: new Date(),
  }
}

/**
 * Do Kwon trigger: more than 3 consecutive warnings ignored.
 * Pattern: arrogance — dismissing risk signals until collapse.
 */
export function checkDoKwonTrigger(
  ignoredAlertCount: number,
): GhostWarning | null {
  if (ignoredAlertCount <= 3) return null

  return {
    ghostId: DO_KWON.id,
    ghostName: DO_KWON.name,
    quote: DO_KWON.quote,
    triggerReason: `${ignoredAlertCount} consecutive warnings ignored — arrogance`,
    timestamp: new Date(),
  }
}

/**
 * Su Zhu / 3AC trigger: effective leverage exceeds 3x.
 * Effective leverage = total position notional / total balance value.
 * Pattern: overleveraged into a supercycle thesis that never ends.
 */
export function checkSuZhuTrigger(
  positions: Position[],
  balances: Balance[],
): GhostWarning | null {
  if (positions.length === 0) return null

  const totalBalance = balances.reduce((sum, b) => sum + b.total, 0)
  if (totalBalance <= 0) return null

  const totalNotional = positions.reduce(
    (sum, p) => sum + Math.abs(p.quantity) * p.currentPrice,
    0,
  )

  const effectiveLeverage = totalNotional / totalBalance
  if (effectiveLeverage <= 3) return null

  return {
    ghostId: SU_ZHU.id,
    ghostName: SU_ZHU.name,
    quote: SU_ZHU.quote,
    triggerReason: `Effective leverage ${effectiveLeverage.toFixed(1)}x (>${3}x threshold) — excessive leverage`,
    timestamp: new Date(),
  }
}

/**
 * Newton trigger: buying after a >20% price increase in 24h.
 * Pattern: FOMO — Sir Isaac Newton bought South Sea Company at the top.
 */
export function checkNewtonTrigger(
  lastBuyPrice: number,
  price24hAgo: number,
): GhostWarning | null {
  if (price24hAgo <= 0) return null
  if (lastBuyPrice <= 0) return null

  const changePercent = ((lastBuyPrice - price24hAgo) / price24hAgo) * 100
  if (changePercent <= 20) return null

  return {
    ghostId: NEWTON.id,
    ghostName: NEWTON.name,
    quote: NEWTON.quote,
    triggerReason: `Buying after ${changePercent.toFixed(1)}% price increase in 24h — FOMO`,
    timestamp: new Date(),
  }
}
