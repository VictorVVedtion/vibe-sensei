import { describe, it, expect, beforeEach } from 'vitest'
import {
  checkEventDiversification,
  predictionPortfolioValue,
  type PredictionCheckContext,
} from '../event-diversification'
import {
  checkProbabilityMispricing,
  type MispricingContext,
} from '../probability-mispricing'
import {
  checkEventExpiry,
  type ExpiryContext,
} from '../event-expiry'
import { checkIntradeTrigger } from '../../ghost-triggers'
import { TiltDetector, detectMartingalePattern, type TradeOutcome } from '../../../../services/trading/tilt-detector'
import { PaperPrediction } from '../../../../services/exchange/paper-prediction'
import { resetVenueRegistry } from '../../../../services/exchange/venue-registry'
import type { PredictionPosition, PredictionMarket } from '../../../../services/exchange/types'

// ── Helpers ────────────────────────────────────────────────────────────────

function makePosition(
  marketId: string,
  outcome: string,
  shares: number,
  avgPrice: number,
  currentPrice: number,
): PredictionPosition {
  return {
    marketId,
    outcome,
    shares,
    avgPrice,
    currentPrice,
    unrealizedPnl: shares * (currentPrice - avgPrice),
  }
}

function makeMarket(
  id: string,
  question: string,
  endDate: string,
): PredictionMarket {
  return {
    id,
    question,
    outcomes: ['YES', 'NO'],
    volume: 100_000,
    endDate,
    currentPrices: [0.50, 0.50],
  }
}

const MASTER = {
  masterId: 'nassim_taleb',
  masterName: 'Nassim Taleb',
  masterQuote: 'Wind extinguishes a candle and energizes fire. Be the fire.',
}

function trade(
  pnlPercent: number,
  positionSize: number,
  symbol = 'BTC/USDT',
): TradeOutcome {
  return { symbol, side: 'buy', pnlPercent, positionSize, timestamp: Date.now() }
}

// ── Event Diversification ──────────────────────────────────────────────────

describe('checkEventDiversification', () => {
  it('returns null when no positions', () => {
    const ctx: PredictionCheckContext = {
      positions: [],
      totalPredictionValue: 0,
      ...MASTER,
    }
    expect(checkEventDiversification(ctx)).toBeNull()
  })

  it('passes when single event is under 20%', () => {
    // Spread across 6 markets so no single one exceeds 20%
    const positions = [
      makePosition('market-a', 'YES', 100, 0.5, 0.5),
      makePosition('market-b', 'YES', 100, 0.5, 0.5),
      makePosition('market-c', 'YES', 100, 0.5, 0.5),
      makePosition('market-d', 'YES', 100, 0.5, 0.5),
      makePosition('market-e', 'YES', 100, 0.5, 0.5),
      makePosition('market-f', 'YES', 100, 0.5, 0.5),
    ]
    // Each market is 16.7% of total — all under 20%
    const total = predictionPortfolioValue(positions)
    const ctx: PredictionCheckContext = {
      positions,
      totalPredictionValue: total,
      ...MASTER,
    }
    expect(checkEventDiversification(ctx)).toBeNull()
  })

  it('warns when single event is 20-35%', () => {
    // market-a: 250 shares * 0.5 = 125, market-b: 375 shares * 0.5 = 187.5
    // ratio of a = 125/312.5 = 40% — wait, adjust
    // market-a: 150 * 0.5 = 75, market-b: 250 * 0.5 = 125. total = 200
    // ratio of b = 125/200 = 62.5% -> CRITICAL. Adjust.
    // For 25%: market-a: 250 * 0.4 = 100, market-b: 300 * 0.4 = 120. total = 220
    // ratio of b = 120/220 = 54.5% -> still CRITICAL.
    // Need exactly 4 markets of ~equal weight, one at 25%.
    const positions = [
      makePosition('market-a', 'YES', 75, 0.5, 0.5),
      makePosition('market-b', 'YES', 100, 0.5, 0.5),
      makePosition('market-c', 'YES', 100, 0.5, 0.5),
      makePosition('market-d', 'YES', 100, 0.5, 0.5),
    ]
    // a=37.5, b=50, c=50, d=50. total=187.5. b ratio = 50/187.5 = 26.7% -> WARNING
    const total = predictionPortfolioValue(positions)
    const ctx: PredictionCheckContext = {
      positions,
      totalPredictionValue: total,
      ...MASTER,
    }
    const alert = checkEventDiversification(ctx)
    // The groupByMarket checks each market's concentration against total.
    // Since no single market is >35%, but one is >20%, we should see WARNING.
    // Actually b, c, d are each 26.7% -> first one hit is b at 26.7% -> WARNING
    expect(alert).not.toBeNull()
    expect(alert!.severity).toBe('WARNING')
    expect(alert!.checkName).toBe('event-diversification')
  })

  it('critical when single event exceeds 35%', () => {
    const positions = [
      makePosition('market-a', 'YES', 10, 0.5, 0.5),
      makePosition('market-b', 'YES', 200, 0.5, 0.5),
    ]
    // a=5, b=100. total=105. b ratio = 100/105 = 95.2% -> CRITICAL
    const total = predictionPortfolioValue(positions)
    const ctx: PredictionCheckContext = {
      positions,
      totalPredictionValue: total,
      ...MASTER,
    }
    const alert = checkEventDiversification(ctx)
    expect(alert).not.toBeNull()
    expect(alert!.severity).toBe('CRITICAL')
  })
})

// ── Probability Mispricing ─────────────────────────────────────────────────

describe('checkProbabilityMispricing', () => {
  it('returns null when no positions', () => {
    const ctx: MispricingContext = { positions: [], ...MASTER }
    expect(checkProbabilityMispricing(ctx)).toBeNull()
  })

  it('passes when price is in safe range (10-90%)', () => {
    const ctx: MispricingContext = {
      positions: [makePosition('m1', 'YES', 100, 0.50, 0.55)],
      ...MASTER,
    }
    expect(checkProbabilityMispricing(ctx)).toBeNull()
  })

  it('warns at 5-10% range', () => {
    const ctx: MispricingContext = {
      positions: [makePosition('m1', 'YES', 100, 0.07, 0.08)],
      ...MASTER,
    }
    const alert = checkProbabilityMispricing(ctx)
    expect(alert).not.toBeNull()
    expect(alert!.severity).toBe('WARNING')
  })

  it('warns at 90-95% range', () => {
    const ctx: MispricingContext = {
      positions: [makePosition('m1', 'YES', 100, 0.92, 0.93)],
      ...MASTER,
    }
    const alert = checkProbabilityMispricing(ctx)
    expect(alert).not.toBeNull()
    expect(alert!.severity).toBe('WARNING')
  })

  it('critical below 5%', () => {
    const ctx: MispricingContext = {
      positions: [makePosition('m1', 'YES', 100, 0.03, 0.04)],
      ...MASTER,
    }
    const alert = checkProbabilityMispricing(ctx)
    expect(alert).not.toBeNull()
    expect(alert!.severity).toBe('CRITICAL')
  })

  it('critical above 95%', () => {
    const ctx: MispricingContext = {
      positions: [makePosition('m1', 'YES', 100, 0.97, 0.96)],
      ...MASTER,
    }
    const alert = checkProbabilityMispricing(ctx)
    expect(alert).not.toBeNull()
    expect(alert!.severity).toBe('CRITICAL')
  })
})

// ── Event Expiry ───────────────────────────────────────────────────────────

describe('checkEventExpiry', () => {
  it('returns null when no positions', () => {
    const ctx: ExpiryContext = {
      positions: [],
      markets: [],
      ...MASTER,
    }
    expect(checkEventExpiry(ctx)).toBeNull()
  })

  it('passes when event is >7 days away', () => {
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    const ctx: ExpiryContext = {
      positions: [makePosition('m1', 'YES', 100, 0.5, 0.5)],
      markets: [makeMarket('m1', 'Far future event?', futureDate)],
      ...MASTER,
    }
    expect(checkEventExpiry(ctx)).toBeNull()
  })

  it('warns when 1-7 days remaining', () => {
    const nearDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
    const ctx: ExpiryContext = {
      positions: [makePosition('m1', 'YES', 100, 0.5, 0.5)],
      markets: [makeMarket('m1', 'Soon event?', nearDate)],
      ...MASTER,
    }
    const alert = checkEventExpiry(ctx)
    expect(alert).not.toBeNull()
    expect(alert!.severity).toBe('WARNING')
    expect(alert!.checkName).toBe('event-expiry')
  })

  it('critical when <24h remaining', () => {
    const soonDate = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
    const ctx: ExpiryContext = {
      positions: [makePosition('m1', 'YES', 100, 0.5, 0.5)],
      markets: [makeMarket('m1', 'Imminent event?', soonDate)],
      ...MASTER,
    }
    const alert = checkEventExpiry(ctx)
    expect(alert).not.toBeNull()
    expect(alert!.severity).toBe('CRITICAL')
  })
})

// ── Intrade Ghost Trigger ──────────────────────────────────────────────────

describe('checkIntradeTrigger (Intrade ghost)', () => {
  it('returns null when no prediction positions', () => {
    expect(checkIntradeTrigger([], 10000)).toBeNull()
  })

  it('returns null when portfolio value is 0', () => {
    const pos = [makePosition('m1', 'YES', 100, 0.5, 0.6)]
    expect(checkIntradeTrigger(pos, 0)).toBeNull()
  })

  it('returns null when prediction is <= 50% of portfolio', () => {
    // 100 shares * 0.6 = 60. Total portfolio = 200. Ratio = 30%.
    const pos = [makePosition('m1', 'YES', 100, 0.5, 0.6)]
    expect(checkIntradeTrigger(pos, 200)).toBeNull()
  })

  it('triggers when prediction is >50% of portfolio', () => {
    // 100 shares * 0.6 = 60. Total portfolio = 100. Ratio = 60%.
    const pos = [makePosition('m1', 'YES', 100, 0.5, 0.6)]
    const ghost = checkIntradeTrigger(pos, 100)
    expect(ghost).not.toBeNull()
    expect(ghost!.ghostId).toBe('intrade')
    expect(ghost!.triggerReason).toContain('platform concentration risk')
  })
})

// ── Martingale Tilt Detection ──────────────────────────────────────────────

describe('Martingale detection (tilt-detector)', () => {
  it('detects Martingale pattern (doubling after losses)', () => {
    const trades: TradeOutcome[] = [
      trade(-2, 100),   // loss, $100
      trade(-3, 200),   // loss, $200 (2x)
      trade(-1, 400),   // loss, $400 (2x)
    ]
    expect(detectMartingalePattern(trades)).toBe(true)
  })

  it('does not trigger on normal loss sequence without doubling', () => {
    const trades: TradeOutcome[] = [
      trade(-2, 100),
      trade(-3, 110),
      trade(-1, 120),
    ]
    expect(detectMartingalePattern(trades)).toBe(false)
  })

  it('does not trigger with fewer than 3 trades', () => {
    const trades: TradeOutcome[] = [
      trade(-2, 100),
      trade(-3, 200),
    ]
    expect(detectMartingalePattern(trades)).toBe(false)
  })

  it('does not trigger when a win interrupts the streak', () => {
    const trades: TradeOutcome[] = [
      trade(-2, 100),
      trade(+1, 200),  // win breaks streak
      trade(-1, 400),
    ]
    expect(detectMartingalePattern(trades)).toBe(false)
  })

  it('TiltDetector.checkMartingale works end-to-end', () => {
    const detector = new TiltDetector()
    detector.recordTrade(trade(-2, 100))
    detector.recordTrade(trade(-3, 200))
    detector.recordTrade(trade(-1, 400))
    expect(detector.checkMartingale()).toBe(true)
  })

  it('TiltDetector.checkMartingale returns false when clean', () => {
    const detector = new TiltDetector()
    detector.recordTrade(trade(-1, 100))
    detector.recordTrade(trade(+2, 100))
    detector.recordTrade(trade(-1, 100))
    expect(detector.checkMartingale()).toBe(false)
  })
})

// ── Paper Prediction Buy/Sell/Resolve ──────────────────────────────────────

describe('PaperPrediction', () => {
  let paper: PaperPrediction

  beforeEach(() => {
    resetVenueRegistry()
    paper = new PaperPrediction(10_000)
  })

  it('connects and registers in venue registry', async () => {
    await paper.connect()
    const { getVenueRegistry } = await import('../../../../services/exchange/venue-registry')
    const registry = getVenueRegistry()
    const adapters = registry.getByVertical('prediction')
    expect(adapters.length).toBeGreaterThanOrEqual(1)
  })

  it('returns 5 sample markets', async () => {
    const markets = await paper.getMarkets()
    expect(markets.length).toBe(5)
  })

  it('filters markets by query', async () => {
    const markets = await paper.getMarkets('BTC')
    expect(markets.length).toBeGreaterThanOrEqual(1)
    expect(markets[0]!.question.toLowerCase()).toContain('btc')
  })

  it('places a bet and tracks position', async () => {
    const order = await paper.placeBet('btc-ath-2026', 'YES', 500)
    expect(order.status).toBe('filled')
    expect(order.shares).toBeGreaterThan(0)

    const positions = await paper.getPositions()
    expect(positions.length).toBe(1)
    expect(positions[0]!.marketId).toBe('btc-ath-2026')
    expect(positions[0]!.outcome).toBe('YES')
  })

  it('deducts balance on bet', async () => {
    await paper.placeBet('btc-ath-2026', 'YES', 500)
    const balances = await paper.getBalance()
    expect(balances[0]!.free).toBeLessThan(10_000)
    expect(balances[0]!.free).toBeCloseTo(9_500, 0)
  })

  it('throws on insufficient balance', async () => {
    await expect(
      paper.placeBet('btc-ath-2026', 'YES', 20_000),
    ).rejects.toThrow('Insufficient balance')
  })

  it('throws on invalid market', async () => {
    await expect(
      paper.placeBet('nonexistent', 'YES', 100),
    ).rejects.toThrow('Market not found')
  })

  it('throws on invalid outcome', async () => {
    await expect(
      paper.placeBet('btc-ath-2026', 'MAYBE', 100),
    ).rejects.toThrow('Invalid outcome')
  })

  it('sells shares and returns proceeds', async () => {
    await paper.placeBet('btc-ath-2026', 'YES', 500)
    const positions = await paper.getPositions()
    const shares = positions[0]!.shares

    const sellOrder = await paper.sellPosition('btc-ath-2026', 'YES', shares)
    expect(sellOrder.status).toBe('filled')

    const afterPositions = await paper.getPositions()
    expect(afterPositions.length).toBe(0)

    const balance = paper.getBalanceValue()
    expect(balance).toBeGreaterThan(9_400) // got some proceeds back
  })

  it('resolves market and pays out winners', async () => {
    await paper.placeBet('btc-ath-2026', 'YES', 500)
    const positionsBefore = await paper.getPositions()
    const shares = positionsBefore[0]!.shares

    paper.resolveMarket('btc-ath-2026', 'YES')

    // Winning position should be liquidated at $1/share
    const positionsAfter = await paper.getPositions()
    expect(positionsAfter.length).toBe(0)

    // Balance should be: 9500 (after bet) + shares * 1.0 (payout)
    const balance = paper.getBalanceValue()
    expect(balance).toBeCloseTo(9_500 + shares, 1)
  })

  it('resolves market — losing position gets nothing', async () => {
    await paper.placeBet('btc-ath-2026', 'YES', 500)
    paper.resolveMarket('btc-ath-2026', 'NO') // YES holders lose

    const positions = await paper.getPositions()
    expect(positions.length).toBe(0)

    // Balance should be ~9500 (no payout for losers)
    const balance = paper.getBalanceValue()
    expect(balance).toBeCloseTo(9_500, 0)
  })

  it('throws when resolving already-resolved market', () => {
    paper.resolveMarket('btc-ath-2026', 'YES')
    expect(() => paper.resolveMarket('btc-ath-2026', 'NO')).toThrow('already resolved')
  })

  it('does not allow betting on resolved markets', async () => {
    paper.resolveMarket('btc-ath-2026', 'YES')
    await expect(
      paper.placeBet('btc-ath-2026', 'YES', 100),
    ).rejects.toThrow('already resolved')
  })
})
