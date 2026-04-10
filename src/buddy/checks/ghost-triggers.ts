/**
 * Ghost trigger detection — 8 cautionary apparitions from finance's fallen.
 * Each function checks whether the user is repeating a dangerous pattern
 * associated with a notorious figure.
 */

import type { Position, Order, Balance, PredictionPosition } from '../../services/exchange/types.js'
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

const LTCM = GHOST_WARNINGS[4]
const LEHMAN = GHOST_WARNINGS[5]
const ENRON = GHOST_WARNINGS[6]
const SVB = GHOST_WARNINGS[7]

/**
 * LTCM trigger: correlation collapse — one position deviates wildly from the pack.
 * Requires 3+ positions. Computes percent change (currentPrice vs entryPrice)
 * for each position, finds the median, and triggers if any position's change
 * deviates from the median by more than 3x the median absolute deviation.
 * Pattern: "diversified" portfolio where correlations break down simultaneously.
 */
export function checkLtcmTrigger(
  positions: Position[],
): GhostWarning | null {
  if (positions.length < 3) return null

  const changes = positions.map((p) => {
    if (p.entryPrice <= 0) return 0
    return ((p.currentPrice - p.entryPrice) / p.entryPrice) * 100
  })

  const sorted = [...changes].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median =
    sorted.length % 2 === 0
      ? (sorted[mid - 1]! + sorted[mid]!) / 2
      : sorted[mid]!

  const absDeviations = changes.map((c) => Math.abs(c - median))
  const sortedDevs = [...absDeviations].sort((a, b) => a - b)
  const madMid = Math.floor(sortedDevs.length / 2)
  const mad =
    sortedDevs.length % 2 === 0
      ? (sortedDevs[madMid - 1]! + sortedDevs[madMid]!) / 2
      : sortedDevs[madMid]!

  if (mad <= 0) return null

  const outlierIdx = absDeviations.findIndex((d) => d > mad * 3)
  if (outlierIdx === -1) return null

  const outlier = positions[outlierIdx]!
  const outlierChange = changes[outlierIdx]!

  return {
    ghostId: LTCM.id,
    ghostName: LTCM.name,
    quote: LTCM.quote,
    triggerReason: `${outlier.symbol} moved ${outlierChange.toFixed(1)}% vs median ${median.toFixed(1)}% — correlation collapse across ${positions.length} positions`,
    timestamp: new Date(),
  }
}

/**
 * Lehman trigger: cascade liquidation risk — leverage >2x AND market dropping >5%.
 * Leverage = total position notional / total balance.
 * Market drop = (currentBtcPrice - btcPrice24hAgo) / btcPrice24hAgo.
 * Pattern: overleveraged into a falling market, cascade liquidation imminent.
 */
export function checkLehmanTrigger(
  positions: Position[],
  balances: Balance[],
  currentBtcPrice: number,
  btcPrice24hAgo: number,
): GhostWarning | null {
  if (positions.length === 0) return null
  if (btcPrice24hAgo <= 0 || currentBtcPrice <= 0) return null

  const totalBalance = balances.reduce((sum, b) => sum + b.total, 0)
  if (totalBalance <= 0) return null

  const totalNotional = positions.reduce(
    (sum, p) => sum + Math.abs(p.quantity) * p.currentPrice,
    0,
  )

  const leverage = totalNotional / totalBalance
  if (leverage <= 2) return null

  const marketDrop =
    ((btcPrice24hAgo - currentBtcPrice) / btcPrice24hAgo) * 100
  if (marketDrop <= 5) return null

  return {
    ghostId: LEHMAN.id,
    ghostName: LEHMAN.name,
    quote: LEHMAN.quote,
    triggerReason: `Leverage ${leverage.toFixed(1)}x with market down ${marketDrop.toFixed(1)}% in 24h — cascade liquidation risk`,
    timestamp: new Date(),
  }
}

/**
 * Enron trigger: concentrated loser — single position >60% of portfolio AND losing.
 * Pattern: believing your own story too deeply while the position bleeds out.
 */
export function checkEnronTrigger(
  positions: Position[],
  balances: Balance[],
): GhostWarning | null {
  if (positions.length === 0) return null

  const totalBalance = balances.reduce((sum, b) => sum + b.total, 0)
  if (totalBalance <= 0) return null

  for (const pos of positions) {
    const positionValue = Math.abs(pos.quantity) * pos.currentPrice
    const concentration = positionValue / totalBalance

    if (concentration > 0.6 && pos.unrealizedPnlPercent < 0) {
      return {
        ghostId: ENRON.id,
        ghostName: ENRON.name,
        quote: ENRON.quote,
        triggerReason: `${pos.symbol} is ${(concentration * 100).toFixed(0)}% of portfolio at ${pos.unrealizedPnlPercent.toFixed(1)}% loss — concentrated loser`,
        timestamp: new Date(),
      }
    }
  }

  return null
}

/**
 * SVB trigger: duration mismatch — holding a losing position too long.
 * Since Position doesn't have an entryTime field, we use a heuristic:
 * if unrealizedPnlPercent < -15%, the position has been held long enough
 * to accumulate significant losses, resembling SVB's duration mismatch.
 * For positions with large negative PnL, the slow bleed indicates prolonged holding.
 * We use entryPrice vs currentPrice distance as a proxy for time held.
 * Pattern: holding underwater positions hoping rates/prices will turn around.
 */
const BITMEX_REKT = GHOST_WARNINGS[8]
const BILL_HWANG = GHOST_WARNINGS[9]

/**
 * BitMEX Rekt Trader trigger: leverage > 20x AND margin utilization > 75%.
 * Pattern: overleveraged with thin margin buffer — the classic BitMEX liquidation cascade.
 */
export function checkBitmexRektTrigger(
  leverage: number,
  marginUtilization: number,
): GhostWarning | null {
  if (leverage <= 20 || marginUtilization <= 75) return null

  return {
    ghostId: BITMEX_REKT.id,
    ghostName: BITMEX_REKT.name,
    quote: BITMEX_REKT.quote,
    triggerReason: `${leverage}x leverage with ${marginUtilization.toFixed(0)}% margin used — overleveraged margin, classic rekt setup`,
    timestamp: new Date(),
  }
}

/**
 * Bill Hwang / Archegos trigger: single leveraged position > 40% of total portfolio.
 * Pattern: concentrated leveraged bet — exactly how Archegos imploded $36B.
 */
export function checkBillHwangTrigger(
  positions: Position[],
  balances: Balance[],
  leverage: number,
): GhostWarning | null {
  if (positions.length === 0 || leverage <= 1) return null

  const totalBalance = balances.reduce((sum, b) => sum + b.total, 0)
  if (totalBalance <= 0) return null

  for (const pos of positions) {
    const leveragedValue = Math.abs(pos.quantity) * pos.currentPrice * leverage
    const concentration = leveragedValue / totalBalance

    if (concentration > 0.4) {
      return {
        ghostId: BILL_HWANG.id,
        ghostName: BILL_HWANG.name,
        quote: BILL_HWANG.quote,
        triggerReason: `${pos.symbol} at ${leverage}x = ${(concentration * 100).toFixed(0)}% of portfolio — concentrated leverage, Archegos-style`,
        timestamp: new Date(),
      }
    }
  }

  return null
}

export function checkSvbTrigger(
  positions: Position[],
): GhostWarning | null {
  if (positions.length === 0) return null

  for (const pos of positions) {
    if (pos.unrealizedPnlPercent >= -15) continue

    // Heuristic: a slow, grinding loss >15% suggests prolonged holding.
    // Rapid crashes produce different PnL profiles (high volume, stop-losses fire).
    // A sustained -15%+ with the position still open strongly suggests duration mismatch.
    const priceRatio = pos.entryPrice > 0
      ? pos.currentPrice / pos.entryPrice
      : 1

    // Price ratio < 0.85 confirms the -15% threshold from a different angle
    if (priceRatio >= 0.85) continue

    return {
      ghostId: SVB.id,
      ghostName: SVB.name,
      quote: SVB.quote,
      triggerReason: `${pos.symbol} down ${Math.abs(pos.unrealizedPnlPercent).toFixed(1)}% (entry ${pos.entryPrice.toFixed(2)} → ${pos.currentPrice.toFixed(2)}) — held too long, duration mismatch`,
      timestamp: new Date(),
    }
  }

  return null
}

// ── DeFi Ghost Triggers ───────────────────────────────────────────────────

const TERRA_LUNA = { id: 'terra_luna', name: 'Terra/Luna', quote: 'The algorithm will maintain the peg.' }
const THE_DAO = { id: 'the_dao', name: 'The DAO', quote: 'Code is law until the code has a bug.' }
const WORMHOLE = { id: 'wormhole', name: 'Wormhole Exploit', quote: 'Cross-chain bridges are trustless, right?' }

/**
 * DeFi ghost context — carries DeFi-specific signals for ghost evaluation.
 */
export interface DefiGhostContext {
  /** Estimated slippage of the swap (0-1 scale). */
  estimatedSlippage?: number
  /** Whether the contract has been audited. */
  isContractAudited?: boolean
  /** Whether the swap involves a cross-chain bridge. */
  isCrossChain?: boolean
  /** Number of DEX swaps in the last 10 minutes. */
  recentSwapCount?: number
}

/**
 * Terra/Luna trigger: trusting algorithmic stability — slippage > 3%
 * indicates depegging risk, the same faith that killed UST.
 * Pattern: blind trust in an algorithm to maintain a peg.
 */
export function checkTerraLunaTrigger(
  defiCtx: DefiGhostContext,
): GhostWarning | null {
  if (defiCtx.estimatedSlippage === undefined) return null
  if (defiCtx.estimatedSlippage <= 0.03) return null

  const pct = (defiCtx.estimatedSlippage * 100).toFixed(1)
  return {
    ghostId: TERRA_LUNA.id,
    ghostName: TERRA_LUNA.name,
    quote: TERRA_LUNA.quote,
    triggerReason: `Slippage at ${pct}% — algorithmic peg trust, price deviation`,
    timestamp: new Date(),
  }
}

/**
 * The DAO trigger: interacting with unaudited contracts.
 * Pattern: trusting code that hasn't been reviewed — the original DAO hack.
 */
export function checkTheDaoTrigger(
  defiCtx: DefiGhostContext,
): GhostWarning | null {
  if (defiCtx.isContractAudited !== false) return null

  return {
    ghostId: THE_DAO.id,
    ghostName: THE_DAO.name,
    quote: THE_DAO.quote,
    triggerReason: 'Interacting with an unaudited contract — code-is-law risk',
    timestamp: new Date(),
  }
}

/**
 * Wormhole trigger: cross-chain bridge operations are high-risk.
 * Pattern: bridge exploits from Wormhole ($320M), Ronin, Nomad.
 */
export function checkWormholeTrigger(
  defiCtx: DefiGhostContext,
): GhostWarning | null {
  if (!defiCtx.isCrossChain) return null

  return {
    ghostId: WORMHOLE.id,
    ghostName: WORMHOLE.name,
    quote: WORMHOLE.quote,
    triggerReason: 'Cross-chain bridge interaction — bridge exploit risk',
    timestamp: new Date(),
  }
}

const INTRADE = { id: 'intrade', name: 'Intrade Shutdown', quote: 'The market was right, but the platform was gone.' }

/**
 * Intrade trigger: platform concentration — >50% of portfolio value on
 * a single prediction platform.
 * Pattern: trusting one platform with everything, then it shuts down.
 * Takes prediction positions' total value and overall portfolio value.
 */
export function checkIntradeTrigger(
  predictionPositions: PredictionPosition[],
  totalPortfolioValue: number,
): GhostWarning | null {
  if (predictionPositions.length === 0) return null
  if (totalPortfolioValue <= 0) return null

  const predictionValue = predictionPositions.reduce(
    (sum, p) => sum + p.shares * p.currentPrice,
    0,
  )

  const ratio = predictionValue / totalPortfolioValue
  if (ratio <= 0.5) return null

  return {
    ghostId: INTRADE.id,
    ghostName: INTRADE.name,
    quote: INTRADE.quote,
    triggerReason: `${(ratio * 100).toFixed(0)}% of portfolio on prediction markets — platform concentration risk`,
    timestamp: new Date(),
  }
}


const SNB_FRANC_SHOCK = { id: 'snb_franc_shock', name: 'SNB Franc Shock (2015)', quote: "The peg is forever. Until it isn't." }
const ASIAN_CRISIS = { id: 'asian_crisis_1997', name: '1997 Asian Currency Crisis', quote: 'Cheap funding currencies never go up. Until they do.' }

/**
 * SNB Franc Shock (2015) trigger: large forex position + central bank event within 2 days.
 * Pattern: the Swiss National Bank abandoned the EUR/CHF floor without warning,
 * causing a 30% move in 4 minutes. Brokers went bankrupt, accounts went negative.
 * Trigger: large position (>50k units) AND centralBankEventDays < 2.
 */
export function checkSnbFrancShockTrigger(
  positions: Position[],
  centralBankEventDays: number | undefined,
): GhostWarning | null {
  if (centralBankEventDays === undefined || centralBankEventDays >= 2) return null
  if (positions.length === 0) return null

  // Check for any large forex position (notional > 50,000)
  const largePosition = positions.find(p => {
    const notional = Math.abs(p.quantity) * p.currentPrice
    return Math.abs(p.quantity) > 50_000 || notional > 50_000
  })

  if (!largePosition) return null

  return {
    ghostId: SNB_FRANC_SHOCK.id,
    ghostName: SNB_FRANC_SHOCK.name,
    quote: SNB_FRANC_SHOCK.quote,
    triggerReason: `Large ${largePosition.symbol} position (${Math.abs(largePosition.quantity).toLocaleString()} units) with CB event in ${centralBankEventDays} day(s) — central bank surprise risk`,
    timestamp: new Date(),
  }
}

/**
 * Asian Currency Crisis (1997) trigger: multiple positive-carry positions.
 * Pattern: carry trade unwind — borrowing cheap in one currency to earn yield
 * in another. When sentiment shifts, all carry trades unwind simultaneously.
 * Trigger: 3+ forex positions (pairs with / or _ separator).
 */
export function checkAsianCrisisTrigger(
  positions: Position[],
): GhostWarning | null {
  const forexPositions = positions.filter(p =>
    p.symbol.includes('/') || p.symbol.includes('_'),
  )

  if (forexPositions.length < 3) return null

  const symbols = forexPositions.map(p => p.symbol).join(', ')

  return {
    ghostId: ASIAN_CRISIS.id,
    ghostName: ASIAN_CRISIS.name,
    quote: ASIAN_CRISIS.quote,
    triggerReason: `${forexPositions.length} currency positions (${symbols}) — carry trade unwind risk if sentiment reverses`,
    timestamp: new Date(),
  }
}
