/**
 * PaperPrediction — in-memory prediction market simulation.
 * Implements PredictionInterface for safe paper trading of prediction markets.
 * Registers as 'paper-prediction' vertical 'prediction' in VenueRegistry.
 */

import type {
  Balance,
  OrderStatus,
  PredictionInterface,
  PredictionMarket,
  PredictionOrder,
  PredictionPosition,
} from './types.js'
import { getVenueRegistry } from './venue-registry.js'

// ── Sample markets ─────────────────────────────────────────────────────────

interface SimulatedMarket extends PredictionMarket {
  resolved: boolean
  resolvedOutcome: string | null
}

function createSampleMarkets(): SimulatedMarket[] {
  return [
    {
      id: 'us-election-2028',
      question: 'Will the incumbent win the 2028 US Presidential Election?',
      outcomes: ['YES', 'NO'],
      volume: 5_200_000,
      endDate: '2028-11-03T00:00:00Z',
      currentPrices: [0.45, 0.55],
      resolved: false,
      resolvedOutcome: null,
    },
    {
      id: 'btc-ath-2026',
      question: 'Will BTC reach a new all-time high above $150k in 2026?',
      outcomes: ['YES', 'NO'],
      volume: 3_800_000,
      endDate: '2026-12-31T23:59:59Z',
      currentPrices: [0.62, 0.38],
      resolved: false,
      resolvedOutcome: null,
    },
    {
      id: 'fed-rate-cut-q3',
      question: 'Will the Fed cut rates by 50bps+ in Q3 2026?',
      outcomes: ['YES', 'NO'],
      volume: 1_900_000,
      endDate: '2026-09-30T23:59:59Z',
      currentPrices: [0.30, 0.70],
      resolved: false,
      resolvedOutcome: null,
    },
    {
      id: 'eth-pos-upgrade',
      question: 'Will Ethereum ship the Pectra upgrade by Q4 2026?',
      outcomes: ['YES', 'NO'],
      volume: 850_000,
      endDate: '2026-12-31T23:59:59Z',
      currentPrices: [0.78, 0.22],
      resolved: false,
      resolvedOutcome: null,
    },
    {
      id: 'spacex-mars-2030',
      question: 'Will SpaceX land a crewed mission on Mars by 2030?',
      outcomes: ['YES', 'NO'],
      volume: 2_400_000,
      endDate: '2030-12-31T23:59:59Z',
      currentPrices: [0.15, 0.85],
      resolved: false,
      resolvedOutcome: null,
    },
  ]
}

// ── Position tracking ──────────────────────────────────────────────────────

interface InternalPosition {
  marketId: string
  outcome: string
  shares: number
  totalCost: number // sum of (shares * price) for average cost basis
}

// ── PaperPrediction ────────────────────────────────────────────────────────

export class PaperPrediction implements PredictionInterface {
  private markets: SimulatedMarket[]
  private positions: Map<string, InternalPosition> = new Map()
  private orders: PredictionOrder[] = []
  private balance: number
  private nextOrderId = 1

  constructor(startingBalance = 10_000) {
    this.markets = createSampleMarkets()
    this.balance = startingBalance
  }

  async connect(): Promise<void> {
    const registry = getVenueRegistry()
    registry.register('paper-prediction', { vertical: 'prediction', prediction: this })
    registry.markConnected('paper-prediction')
  }

  async getMarkets(query?: string): Promise<PredictionMarket[]> {
    if (!query) return this.markets.filter(m => !m.resolved)
    const q = query.toLowerCase()
    return this.markets.filter(
      m => !m.resolved && m.question.toLowerCase().includes(q),
    )
  }

  async placeBet(
    marketId: string,
    outcome: string,
    amount: number,
    price?: number,
  ): Promise<PredictionOrder> {
    const market = this.markets.find(m => m.id === marketId)
    if (!market) throw new Error(`Market not found: ${marketId}`)
    if (market.resolved) throw new Error(`Market already resolved: ${marketId}`)

    const outcomeIdx = market.outcomes.indexOf(outcome)
    if (outcomeIdx === -1) {
      throw new Error(`Invalid outcome '${outcome}' for market ${marketId}`)
    }

    const fillPrice = this.clampPrice(price ?? market.currentPrices[outcomeIdx]!)
    const cost = amount
    if (cost > this.balance) {
      throw new Error(`Insufficient balance: need ${cost.toFixed(2)}, have ${this.balance.toFixed(2)}`)
    }

    const shares = cost / fillPrice
    this.balance -= cost

    // Update or create position
    const posKey = `${marketId}:${outcome}`
    const existing = this.positions.get(posKey)
    if (existing) {
      existing.shares += shares
      existing.totalCost += cost
    } else {
      this.positions.set(posKey, { marketId, outcome, shares, totalCost: cost })
    }

    // Drift market price slightly toward the traded direction
    this.driftPrice(market, outcomeIdx, shares)

    const order: PredictionOrder = {
      id: `paper-pred-${this.nextOrderId++}`,
      marketId,
      outcome,
      shares,
      price: fillPrice,
      status: 'filled' as OrderStatus,
      createdAt: new Date(),
    }
    this.orders.push(order)
    return order
  }

  async getPositions(): Promise<PredictionPosition[]> {
    const result: PredictionPosition[] = []
    for (const pos of this.positions.values()) {
      if (pos.shares <= 0) continue
      const market = this.markets.find(m => m.id === pos.marketId)
      if (!market) continue

      const outcomeIdx = market.outcomes.indexOf(pos.outcome)
      const currentPrice = outcomeIdx >= 0
        ? market.currentPrices[outcomeIdx]!
        : 0
      const avgPrice = pos.totalCost / pos.shares

      result.push({
        marketId: pos.marketId,
        outcome: pos.outcome,
        shares: pos.shares,
        avgPrice,
        currentPrice,
        unrealizedPnl: pos.shares * (currentPrice - avgPrice),
      })
    }
    return result
  }

  async getBalance(): Promise<Balance[]> {
    return [{
      currency: 'USDC',
      free: this.balance,
      used: 0,
      total: this.balance,
    }]
  }

  /**
   * Sell shares of a position back. Returns proceeds to balance.
   */
  async sellPosition(
    marketId: string,
    outcome: string,
    sharesToSell: number,
  ): Promise<PredictionOrder> {
    const posKey = `${marketId}:${outcome}`
    const pos = this.positions.get(posKey)
    if (!pos || pos.shares < sharesToSell) {
      throw new Error(`Insufficient shares to sell`)
    }

    const market = this.markets.find(m => m.id === marketId)
    if (!market) throw new Error(`Market not found: ${marketId}`)

    const outcomeIdx = market.outcomes.indexOf(outcome)
    const sellPrice = outcomeIdx >= 0 ? market.currentPrices[outcomeIdx]! : 0
    const proceeds = sharesToSell * sellPrice

    // Adjust position
    const costBasis = (pos.totalCost / pos.shares) * sharesToSell
    pos.shares -= sharesToSell
    pos.totalCost -= costBasis
    this.balance += proceeds

    if (pos.shares <= 0) {
      this.positions.delete(posKey)
    }

    // Drift price away from the sold direction
    this.driftPrice(market, outcomeIdx, -sharesToSell)

    const order: PredictionOrder = {
      id: `paper-pred-${this.nextOrderId++}`,
      marketId,
      outcome,
      shares: sharesToSell,
      price: sellPrice,
      status: 'filled' as OrderStatus,
      createdAt: new Date(),
    }
    this.orders.push(order)
    return order
  }

  /**
   * Resolve a market with a given outcome. Pays out winning positions at $1/share.
   */
  resolveMarket(marketId: string, winningOutcome: string): void {
    const market = this.markets.find(m => m.id === marketId)
    if (!market) throw new Error(`Market not found: ${marketId}`)
    if (market.resolved) throw new Error(`Market already resolved: ${marketId}`)

    market.resolved = true
    market.resolvedOutcome = winningOutcome

    // Pay out winning positions at $1/share, losing at $0
    for (const [key, pos] of this.positions.entries()) {
      if (pos.marketId !== marketId) continue
      if (pos.outcome === winningOutcome) {
        this.balance += pos.shares * 1.0 // $1 per winning share
      }
      // Losing shares pay $0 — just remove the position
      this.positions.delete(key)
    }
  }

  /** Get all orders for testing/inspection. */
  getOrders(): PredictionOrder[] {
    return [...this.orders]
  }

  /** Get internal balance value for testing. */
  getBalanceValue(): number {
    return this.balance
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  private clampPrice(price: number): number {
    return Math.max(0.01, Math.min(0.99, price))
  }

  /**
   * Drift market price after a trade. Buying pushes price up, selling down.
   * Keeps complementary outcomes summing to ~1.0.
   */
  private driftPrice(
    market: SimulatedMarket,
    outcomeIdx: number,
    shares: number,
  ): void {
    if (outcomeIdx < 0 || market.outcomes.length !== 2) return
    const drift = Math.min(0.03, Math.abs(shares) * 0.0001) * Math.sign(shares)
    const newPrice = this.clampPrice(market.currentPrices[outcomeIdx]! + drift)
    market.currentPrices[outcomeIdx] = newPrice
    // Complementary outcome
    const other = outcomeIdx === 0 ? 1 : 0
    market.currentPrices[other] = this.clampPrice(1 - newPrice)
  }
}

// ── Module-level singleton ─────────────────────────────────────────────────

let instance: PaperPrediction | null = null

export function getPaperPrediction(): PaperPrediction {
  if (!instance) {
    instance = new PaperPrediction()
  }
  return instance
}

export function resetPaperPrediction(): void {
  instance = null
}
