/**
 * VenueRegistry — central registry for all trading venue adapters.
 *
 * Manages registration, lookup, and cross-venue aggregation for
 * multi-venue portfolio views. Uses Promise.allSettled() for error
 * isolation so one failing venue never blocks the rest.
 */

import type {
  Balance,
  ExchangeInterface,
  Position,
  TradingVertical,
  VenueAdapter,
} from './types.js'
import { VenueTypeMismatchError } from './types.js'

// ── Venue Entry ─────────────────────────────────────────────────────────────

interface VenueEntry {
  adapter: VenueAdapter
  connected: boolean
  lastHealthCheck: number
}

// ── Position with Vertical ──────────────────────────────────────────────────

interface PositionWithVertical extends Position {
  vertical: TradingVertical
}

// ── Registry ────────────────────────────────────────────────────────────────

export class VenueRegistry {
  private venues = new Map<string, VenueEntry>()
  private defaultVenueId = 'paper-spot'

  /** Register a venue adapter under a unique id. */
  register(id: string, adapter: VenueAdapter): void {
    this.venues.set(id, {
      adapter,
      connected: false,
      lastHealthCheck: 0,
    })
  }

  /** Remove a venue by id. */
  unregister(id: string): void {
    this.venues.delete(id)
  }

  /** Get a venue adapter by id, or undefined if not registered. */
  get(id: string): VenueAdapter | undefined {
    return this.venues.get(id)?.adapter
  }

  /** Get a venue adapter, throwing if not registered or not connected. */
  getConnected(id: string): VenueAdapter {
    const entry = this.venues.get(id)
    if (!entry) {
      throw new Error(`Venue not registered: ${id}`)
    }
    if (!entry.connected) {
      throw new Error(`Venue not connected: ${id}`)
    }
    return entry.adapter
  }

  /** Return all adapters matching a specific vertical. */
  getByVertical(vertical: TradingVertical): VenueAdapter[] {
    const result: VenueAdapter[] = []
    for (const entry of this.venues.values()) {
      if (entry.adapter.vertical === vertical) {
        result.push(entry.adapter)
      }
    }
    return result
  }

  /** Get the default venue adapter. Throws if not registered. */
  getDefault(): VenueAdapter {
    const entry = this.venues.get(this.defaultVenueId)
    if (!entry) {
      throw new Error(`Default venue not registered: ${this.defaultVenueId}`)
    }
    return entry.adapter
  }

  /** Set the default venue id. Throws if not registered. */
  setDefault(id: string): void {
    if (!this.venues.has(id)) {
      throw new Error(`Cannot set default: venue not registered: ${id}`)
    }
    this.defaultVenueId = id
  }

  /** Mark a venue as connected and update health check timestamp. */
  markConnected(id: string): void {
    const entry = this.venues.get(id)
    if (!entry) {
      throw new Error(`Venue not registered: ${id}`)
    }
    entry.connected = true
    entry.lastHealthCheck = Date.now()
  }

  /** Return all registered venue ids. */
  getVenueIds(): string[] {
    return [...this.venues.keys()]
  }

  /** Check if a venue is connected. */
  isConnected(id: string): boolean {
    return this.venues.get(id)?.connected ?? false
  }

  /**
   * Aggregate positions from all connected venues with error isolation.
   * Each position is tagged with its adapter's vertical.
   * Venues that error are captured separately, never blocking others.
   */
  async getAllPositions(): Promise<{
    positions: PositionWithVertical[]
    errors: Array<{ venueId: string; error: Error }>
  }> {
    const tasks = this.buildPositionTasks()
    const results = await Promise.allSettled(tasks.map(t => t.fetch()))
    return this.collectPositionResults(tasks, results)
  }

  /**
   * Aggregate balances from all connected venues with error isolation.
   * Venues that error are captured separately, never blocking others.
   */
  async getAllBalances(): Promise<{
    balances: Balance[]
    errors: Array<{ venueId: string; error: Error }>
  }> {
    const tasks = this.buildBalanceTasks()
    const results = await Promise.allSettled(tasks.map(t => t.fetch()))
    return this.collectBalanceResults(tasks, results)
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  private buildPositionTasks(): Array<{
    venueId: string
    vertical: TradingVertical
    fetch: () => Promise<PositionWithVertical[]>
  }> {
    const tasks: Array<{
      venueId: string
      vertical: TradingVertical
      fetch: () => Promise<PositionWithVertical[]>
    }> = []

    for (const [venueId, entry] of this.venues.entries()) {
      if (!entry.connected) continue
      tasks.push({
        venueId,
        vertical: entry.adapter.vertical,
        fetch: () => this.fetchPositionsForAdapter(entry.adapter),
      })
    }
    return tasks
  }

  private async fetchPositionsForAdapter(
    adapter: VenueAdapter,
  ): Promise<PositionWithVertical[]> {
    const vertical = adapter.vertical
    if (adapter.vertical === 'defi_dex') {
      const balances = await adapter.dex.getBalance()
      return balances.map(b => this.balanceToPosition(b, vertical))
    }
    if (adapter.vertical === 'prediction') {
      const predPositions = await adapter.prediction.getPositions()
      return predPositions.map(p => this.predictionToPosition(p, vertical))
    }
    const positions = await adapter.exchange.getPositions()
    return positions.map(p => ({ ...p, vertical }))
  }

  private balanceToPosition(
    b: Balance,
    vertical: TradingVertical,
  ): PositionWithVertical {
    return {
      symbol: b.currency,
      side: 'buy',
      quantity: b.total,
      entryPrice: 0,
      currentPrice: 0,
      unrealizedPnl: 0,
      unrealizedPnlPercent: 0,
      realizedPnl: 0,
      vertical,
    }
  }

  private predictionToPosition(
    p: { marketId: string; outcome: string; shares: number; avgPrice: number; currentPrice: number; unrealizedPnl: number },
    vertical: TradingVertical,
  ): PositionWithVertical {
    return {
      symbol: `${p.marketId}:${p.outcome}`,
      side: 'buy',
      quantity: p.shares,
      entryPrice: p.avgPrice,
      currentPrice: p.currentPrice,
      unrealizedPnl: p.unrealizedPnl,
      unrealizedPnlPercent: p.avgPrice > 0 ? (p.unrealizedPnl / (p.avgPrice * p.shares)) * 100 : 0,
      realizedPnl: 0,
      vertical,
    }
  }

  private collectPositionResults(
    tasks: Array<{ venueId: string; vertical: TradingVertical; fetch: () => Promise<PositionWithVertical[]> }>,
    results: PromiseSettledResult<PositionWithVertical[]>[],
  ): { positions: PositionWithVertical[]; errors: Array<{ venueId: string; error: Error }> } {
    const positions: PositionWithVertical[] = []
    const errors: Array<{ venueId: string; error: Error }> = []

    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      if (result.status === 'fulfilled') {
        positions.push(...result.value)
      } else {
        const err = result.reason instanceof Error
          ? result.reason
          : new Error(String(result.reason))
        errors.push({ venueId: tasks[i].venueId, error: err })
      }
    }
    return { positions, errors }
  }

  private buildBalanceTasks(): Array<{
    venueId: string
    fetch: () => Promise<Balance[]>
  }> {
    const tasks: Array<{ venueId: string; fetch: () => Promise<Balance[]> }> = []

    for (const [venueId, entry] of this.venues.entries()) {
      if (!entry.connected) continue
      tasks.push({
        venueId,
        fetch: () => this.fetchBalancesForAdapter(entry.adapter),
      })
    }
    return tasks
  }

  private async fetchBalancesForAdapter(adapter: VenueAdapter): Promise<Balance[]> {
    if (adapter.vertical === 'defi_dex') {
      return adapter.dex.getBalance()
    }
    if (adapter.vertical === 'prediction') {
      return adapter.prediction.getBalance()
    }
    return adapter.exchange.getBalance()
  }

  private collectBalanceResults(
    tasks: Array<{ venueId: string; fetch: () => Promise<Balance[]> }>,
    results: PromiseSettledResult<Balance[]>[],
  ): { balances: Balance[]; errors: Array<{ venueId: string; error: Error }> } {
    const balances: Balance[] = []
    const errors: Array<{ venueId: string; error: Error }> = []

    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      if (result.status === 'fulfilled') {
        balances.push(...result.value)
      } else {
        const err = result.reason instanceof Error
          ? result.reason
          : new Error(String(result.reason))
        errors.push({ venueId: tasks[i].venueId, error: err })
      }
    }
    return { balances, errors }
  }
}

// ── Module-level Singleton ──────────────────────────────────────────────────

let registry: VenueRegistry | null = null

export function getVenueRegistry(): VenueRegistry {
  if (!registry) {
    registry = new VenueRegistry()
  }
  return registry
}

/** Reset the singleton (for testing). */
export function resetVenueRegistry(): void {
  registry = null
}

/** Get first exchange adapter for a given vertical. Throws if none found. */
export function getExchangeByVertical(vertical: TradingVertical): ExchangeInterface {
  const venues = getVenueRegistry().getByVertical(vertical)
  if (venues.length === 0) {
    throw new Error(`No venue registered for vertical: ${vertical}`)
  }
  const adapter = venues[0]!
  if (adapter.vertical === 'defi_dex' || adapter.vertical === 'prediction') {
    throw new VenueTypeMismatchError('ExchangeInterface', adapter.vertical)
  }
  return adapter.exchange
}

/** Clear all venues (for testing). */
export function clearVenues(): void {
  resetVenueRegistry()
}
