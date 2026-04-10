/**
 * VenueRegistry tests — CRUD, vertical filtering, cross-venue aggregation,
 * error isolation, and backward-compatible singleton.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  VenueRegistry,
  resetVenueRegistry,
  getVenueRegistry,
} from '../venue-registry.js'
import type {
  Balance,
  DEXInterface,
  ExchangeInterface,
  Position,
  PredictionInterface,
  PredictionPosition,
  SwapQuote,
  SwapQuoteRequest,
  SwapResult,
  VenueAdapter,
} from '../types.js'
import { VenueTypeMismatchError } from '../types.js'

// ── Stub factories ──────────────────────────────────────────────────────────

function stubExchange(overrides?: Partial<ExchangeInterface>): ExchangeInterface {
  return {
    connect: async () => {},
    getBalance: async () => [],
    placeOrder: async () => { throw new Error('not implemented') },
    cancelOrder: async () => { throw new Error('not implemented') },
    getOpenOrders: async () => [],
    getPositions: async () => [],
    getCandles: async () => [],
    getTicker: async () => { throw new Error('not implemented') },
    ...overrides,
  }
}

function stubDex(overrides?: Partial<DEXInterface>): DEXInterface {
  return {
    connect: async () => {},
    getQuote: async (_params: SwapQuoteRequest): Promise<SwapQuote> => {
      throw new Error('not implemented')
    },
    executeSwap: async (_quote: SwapQuote): Promise<SwapResult> => {
      throw new Error('not implemented')
    },
    getBalance: async () => [],
    ...overrides,
  }
}

function stubPrediction(overrides?: Partial<PredictionInterface>): PredictionInterface {
  return {
    connect: async () => {},
    getMarkets: async () => [],
    placeBet: async () => { throw new Error('not implemented') },
    getPositions: async () => [],
    getBalance: async () => [],
    ...overrides,
  }
}

function makePosition(symbol: string, pnl: number): Position {
  return {
    symbol,
    side: 'buy',
    quantity: 1,
    entryPrice: 100,
    currentPrice: 100 + pnl,
    unrealizedPnl: pnl,
    unrealizedPnlPercent: pnl,
    realizedPnl: 0,
  }
}

function makeBalance(currency: string, total: number): Balance {
  return { currency, free: total, used: 0, total }
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('VenueRegistry', () => {
  let registry: VenueRegistry

  beforeEach(() => {
    registry = new VenueRegistry()
  })

  // ── CRUD ────────────────────────────────────────────────────────────────

  describe('CRUD', () => {
    it('registers and retrieves a venue', () => {
      const adapter: VenueAdapter = { vertical: 'spot', exchange: stubExchange() }
      registry.register('binance', adapter)
      expect(registry.get('binance')).toBe(adapter)
    })

    it('returns undefined for unknown venue', () => {
      expect(registry.get('nonexistent')).toBeUndefined()
    })

    it('unregisters a venue', () => {
      const adapter: VenueAdapter = { vertical: 'spot', exchange: stubExchange() }
      registry.register('binance', adapter)
      registry.unregister('binance')
      expect(registry.get('binance')).toBeUndefined()
    })

    it('overwrites existing registration', () => {
      const adapter1: VenueAdapter = { vertical: 'spot', exchange: stubExchange() }
      const adapter2: VenueAdapter = { vertical: 'perp_futures', exchange: stubExchange() }
      registry.register('venue', adapter1)
      registry.register('venue', adapter2)
      expect(registry.get('venue')?.vertical).toBe('perp_futures')
    })

    it('lists all venue ids', () => {
      registry.register('a', { vertical: 'spot', exchange: stubExchange() })
      registry.register('b', { vertical: 'forex', exchange: stubExchange() })
      expect(registry.getVenueIds().sort()).toEqual(['a', 'b'])
    })
  })

  // ── Vertical filtering ────────────────────────────────────────────────

  describe('getByVertical', () => {
    it('returns adapters matching the vertical', () => {
      registry.register('spot1', { vertical: 'spot', exchange: stubExchange() })
      registry.register('spot2', { vertical: 'spot', exchange: stubExchange() })
      registry.register('perp1', { vertical: 'perp_futures', exchange: stubExchange() })
      const spots = registry.getByVertical('spot')
      expect(spots).toHaveLength(2)
      expect(spots.every(a => a.vertical === 'spot')).toBe(true)
    })

    it('returns empty array for unmatched vertical', () => {
      registry.register('spot1', { vertical: 'spot', exchange: stubExchange() })
      expect(registry.getByVertical('forex')).toHaveLength(0)
    })
  })

  // ── Default venue ─────────────────────────────────────────────────────

  describe('default venue', () => {
    it('throws when default venue is not registered', () => {
      expect(() => registry.getDefault()).toThrow('Default venue not registered')
    })

    it('returns the default venue when registered', () => {
      const adapter: VenueAdapter = { vertical: 'spot', exchange: stubExchange() }
      registry.register('paper-spot', adapter)
      expect(registry.getDefault()).toBe(adapter)
    })

    it('allows changing the default', () => {
      registry.register('paper-spot', { vertical: 'spot', exchange: stubExchange() })
      const liveAdapter: VenueAdapter = { vertical: 'perp_futures', exchange: stubExchange() }
      registry.register('binance-perp', liveAdapter)
      registry.setDefault('binance-perp')
      expect(registry.getDefault()).toBe(liveAdapter)
    })

    it('throws when setting default to unregistered venue', () => {
      expect(() => registry.setDefault('unknown')).toThrow('venue not registered')
    })
  })

  // ── Connection tracking ───────────────────────────────────────────────

  describe('connection tracking', () => {
    it('tracks connected state', () => {
      registry.register('v1', { vertical: 'spot', exchange: stubExchange() })
      expect(registry.isConnected('v1')).toBe(false)
      registry.markConnected('v1')
      expect(registry.isConnected('v1')).toBe(true)
    })

    it('getConnected throws when not connected', () => {
      registry.register('v1', { vertical: 'spot', exchange: stubExchange() })
      expect(() => registry.getConnected('v1')).toThrow('not connected')
    })

    it('getConnected returns adapter when connected', () => {
      const adapter: VenueAdapter = { vertical: 'spot', exchange: stubExchange() }
      registry.register('v1', adapter)
      registry.markConnected('v1')
      expect(registry.getConnected('v1')).toBe(adapter)
    })

    it('getConnected throws for unknown venue', () => {
      expect(() => registry.getConnected('unknown')).toThrow('not registered')
    })

    it('isConnected returns false for unknown venue', () => {
      expect(registry.isConnected('unknown')).toBe(false)
    })
  })

  // ── Cross-venue getAllPositions ────────────────────────────────────────

  describe('getAllPositions', () => {
    it('aggregates positions from multiple exchange venues', async () => {
      const pos1 = makePosition('BTC/USDT', 500)
      const pos2 = makePosition('ETH/USDT', -100)
      registry.register('v1', {
        vertical: 'spot',
        exchange: stubExchange({ getPositions: async () => [pos1] }),
      })
      registry.register('v2', {
        vertical: 'perp_futures',
        exchange: stubExchange({ getPositions: async () => [pos2] }),
      })
      registry.markConnected('v1')
      registry.markConnected('v2')

      const { positions, errors } = await registry.getAllPositions()
      expect(errors).toHaveLength(0)
      expect(positions).toHaveLength(2)
      expect(positions[0].vertical).toBe('spot')
      expect(positions[1].vertical).toBe('perp_futures')
    })

    it('captures errors without blocking other venues', async () => {
      const pos1 = makePosition('BTC/USDT', 500)
      registry.register('good', {
        vertical: 'spot',
        exchange: stubExchange({ getPositions: async () => [pos1] }),
      })
      registry.register('bad', {
        vertical: 'perp_futures',
        exchange: stubExchange({
          getPositions: async () => { throw new Error('connection timeout') },
        }),
      })
      registry.markConnected('good')
      registry.markConnected('bad')

      const { positions, errors } = await registry.getAllPositions()
      expect(positions).toHaveLength(1)
      expect(positions[0].symbol).toBe('BTC/USDT')
      expect(errors).toHaveLength(1)
      expect(errors[0].venueId).toBe('bad')
      expect(errors[0].error.message).toBe('connection timeout')
    })

    it('returns empty when no venues are connected', async () => {
      registry.register('v1', { vertical: 'spot', exchange: stubExchange() })
      const { positions, errors } = await registry.getAllPositions()
      expect(positions).toHaveLength(0)
      expect(errors).toHaveLength(0)
    })

    it('maps DEX balances to positions', async () => {
      const bal = makeBalance('WETH', 5.5)
      registry.register('uniswap', {
        vertical: 'defi_dex',
        dex: stubDex({ getBalance: async () => [bal] }),
      })
      registry.markConnected('uniswap')

      const { positions, errors } = await registry.getAllPositions()
      expect(errors).toHaveLength(0)
      expect(positions).toHaveLength(1)
      expect(positions[0].symbol).toBe('WETH')
      expect(positions[0].quantity).toBe(5.5)
      expect(positions[0].vertical).toBe('defi_dex')
    })

    it('maps prediction positions correctly', async () => {
      const predPos: PredictionPosition = {
        marketId: 'pres-2028',
        outcome: 'YES',
        shares: 100,
        avgPrice: 0.6,
        currentPrice: 0.75,
        unrealizedPnl: 15,
      }
      registry.register('polymarket', {
        vertical: 'prediction',
        prediction: stubPrediction({ getPositions: async () => [predPos] }),
      })
      registry.markConnected('polymarket')

      const { positions, errors } = await registry.getAllPositions()
      expect(errors).toHaveLength(0)
      expect(positions).toHaveLength(1)
      expect(positions[0].symbol).toBe('pres-2028:YES')
      expect(positions[0].quantity).toBe(100)
      expect(positions[0].unrealizedPnl).toBe(15)
      expect(positions[0].vertical).toBe('prediction')
    })
  })

  // ── Cross-venue getAllBalances ─────────────────────────────────────────

  describe('getAllBalances', () => {
    it('aggregates balances from multiple venues', async () => {
      registry.register('v1', {
        vertical: 'spot',
        exchange: stubExchange({
          getBalance: async () => [makeBalance('USDT', 50000)],
        }),
      })
      registry.register('v2', {
        vertical: 'defi_dex',
        dex: stubDex({
          getBalance: async () => [makeBalance('ETH', 10)],
        }),
      })
      registry.markConnected('v1')
      registry.markConnected('v2')

      const { balances, errors } = await registry.getAllBalances()
      expect(errors).toHaveLength(0)
      expect(balances).toHaveLength(2)
    })

    it('isolates balance errors', async () => {
      registry.register('good', {
        vertical: 'prediction',
        prediction: stubPrediction({
          getBalance: async () => [makeBalance('USD', 1000)],
        }),
      })
      registry.register('bad', {
        vertical: 'spot',
        exchange: stubExchange({
          getBalance: async () => { throw new Error('rate limited') },
        }),
      })
      registry.markConnected('good')
      registry.markConnected('bad')

      const { balances, errors } = await registry.getAllBalances()
      expect(balances).toHaveLength(1)
      expect(balances[0].currency).toBe('USD')
      expect(errors).toHaveLength(1)
      expect(errors[0].venueId).toBe('bad')
    })
  })

  // ── VenueTypeMismatchError ────────────────────────────────────────────

  describe('VenueTypeMismatchError', () => {
    it('formats error message correctly', () => {
      const err = new VenueTypeMismatchError('spot', 'defi_dex')
      expect(err.message).toBe('Expected spot venue, got defi_dex')
      expect(err.name).toBe('VenueTypeMismatchError')
      expect(err).toBeInstanceOf(Error)
    })
  })

  // ── Singleton ─────────────────────────────────────────────────────────

  describe('singleton', () => {
    beforeEach(() => {
      resetVenueRegistry()
    })

    it('returns the same instance on repeated calls', () => {
      const r1 = getVenueRegistry()
      const r2 = getVenueRegistry()
      expect(r1).toBe(r2)
    })

    it('resets to a new instance', () => {
      const r1 = getVenueRegistry()
      resetVenueRegistry()
      const r2 = getVenueRegistry()
      expect(r1).not.toBe(r2)
    })
  })
})
