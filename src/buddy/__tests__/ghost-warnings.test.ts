/**
 * Tests for src/buddy/ghost-warnings.ts + ghost-triggers.ts
 * Covers: all 8 ghost triggers, cooldown behavior, checkAll priority, formatForTerminal
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GhostEngine } from '../ghost-warnings.js'
import type { GhostContext } from '../ghost-warnings.js'
import type { Position, Order, Balance } from '../../services/exchange/types.js'

// ── Helpers ────────────────────────────────────────────────────────────────

function makePosition(
  symbol: string,
  quantity: number,
  entryPrice: number,
  currentPrice: number,
): Position {
  const pnlPct = entryPrice > 0 ? ((currentPrice - entryPrice) / entryPrice) * 100 : 0
  return {
    symbol,
    side: quantity >= 0 ? 'buy' : 'sell',
    quantity,
    entryPrice,
    currentPrice,
    unrealizedPnl: (currentPrice - entryPrice) * quantity,
    unrealizedPnlPercent: pnlPct,
    realizedPnl: 0,
  }
}

function makeOrder(type: 'market' | 'limit' | 'stop_loss', status: 'open' | 'filled'): Order {
  return {
    id: 'ord-1',
    symbol: 'BTC/USDT',
    side: 'buy',
    type,
    quantity: 1,
    status,
    filledQuantity: 0,
    avgFillPrice: 0,
    fee: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function makeBalance(total: number): Balance {
  return { currency: 'USDT', free: total * 0.8, used: total * 0.2, total }
}

function baseContext(): GhostContext {
  return {
    positions: [],
    orders: [],
    balances: [makeBalance(100_000)],
    ignoredAlertCount: 0,
    lastBuyPrice: 0,
    price24hAgo: 0,
    currentBtcPrice: 50_000,
    btcPrice24hAgo: 50_000,
  }
}

// ── Ghost Engine ───────────────────────────────────────────────────────────

describe('GhostEngine', () => {
  let engine: GhostEngine

  beforeEach(() => {
    engine = new GhostEngine()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ── SBF trigger ────────────────────────────────────────────────────────

  describe('SBF trigger — missing stop-loss', () => {
    it('triggers when positions exist without stop-loss orders', () => {
      const ctx = baseContext()
      ctx.positions = [makePosition('BTC/USDT', 1, 48_000, 50_000)]
      ctx.orders = [makeOrder('limit', 'open')]  // no stop_loss
      const warning = engine.checkAll(ctx)
      expect(warning).not.toBeNull()
      expect(warning!.ghostId).toBe('sbf')
      expect(warning!.triggerReason).toContain('no stop-loss')
    })

    it('does not trigger when stop-loss order exists', () => {
      const ctx = baseContext()
      ctx.positions = [makePosition('BTC/USDT', 1, 48_000, 50_000)]
      ctx.orders = [makeOrder('stop_loss', 'open')]
      const warning = engine.checkAll(ctx)
      // SBF won't trigger, but another ghost might (check not SBF specifically)
      if (warning) {
        expect(warning.ghostId).not.toBe('sbf')
      }
    })

    it('does not trigger when no positions', () => {
      const ctx = baseContext()
      ctx.orders = []
      const warning = engine.checkAll(ctx)
      expect(warning).toBeNull()
    })
  })

  // ── Do Kwon trigger ────────────────────────────────────────────────────

  describe('Do Kwon trigger — ignored warnings', () => {
    it('triggers when > 3 warnings ignored', () => {
      const ctx = baseContext()
      ctx.ignoredAlertCount = 5
      const warning = engine.checkAll(ctx)
      expect(warning).not.toBeNull()
      expect(warning!.ghostId).toBe('do_kwon')
      expect(warning!.triggerReason).toContain('5 consecutive warnings ignored')
    })

    it('does not trigger at exactly 3 warnings', () => {
      const ctx = baseContext()
      ctx.ignoredAlertCount = 3
      const warning = engine.checkAll(ctx)
      // Do Kwon requires > 3, not >= 3
      if (warning) {
        expect(warning.ghostId).not.toBe('do_kwon')
      }
    })
  })

  // ── Su Zhu trigger ─────────────────────────────────────────────────────

  describe('Su Zhu trigger — excessive leverage', () => {
    it('triggers when effective leverage > 3x', () => {
      const ctx = baseContext()
      // 400,000 notional / 100,000 balance = 4x leverage
      ctx.positions = [makePosition('BTC/USDT', 8, 48_000, 50_000)]
      const warning = engine.checkAll(ctx)
      expect(warning).not.toBeNull()
      // SBF triggers first (no stop-loss), so check engine returns SBF
      // Su Zhu would be checked only if SBF doesn't trigger
      expect(warning!.ghostId).toBe('sbf') // SBF has higher priority
    })

    it('triggers Su Zhu when SBF is suppressed by stop-loss', () => {
      const ctx = baseContext()
      ctx.positions = [makePosition('BTC/USDT', 8, 48_000, 50_000)]
      ctx.orders = [makeOrder('stop_loss', 'open')]
      const warning = engine.checkAll(ctx)
      expect(warning).not.toBeNull()
      expect(warning!.ghostId).toBe('su_zhu')
      expect(warning!.triggerReason).toContain('4.0x')
    })

    it('does not trigger at exactly 3x leverage', () => {
      const ctx = baseContext()
      ctx.positions = [makePosition('BTC/USDT', 6, 48_000, 50_000)] // 300,000 / 100,000 = 3x
      ctx.orders = [makeOrder('stop_loss', 'open')]
      const warning = engine.checkAll(ctx)
      if (warning) {
        expect(warning.ghostId).not.toBe('su_zhu')
      }
    })
  })

  // ── Newton trigger ─────────────────────────────────────────────────────

  describe('Newton trigger — FOMO buying', () => {
    it('triggers when buying after > 20% price increase', () => {
      const ctx = baseContext()
      ctx.lastBuyPrice = 130
      ctx.price24hAgo = 100  // 30% increase
      const warning = engine.checkAll(ctx)
      expect(warning).not.toBeNull()
      expect(warning!.ghostId).toBe('newton_ghost')
      expect(warning!.triggerReason).toContain('30.0%')
    })

    it('does not trigger at exactly 20% increase', () => {
      const ctx = baseContext()
      ctx.lastBuyPrice = 120
      ctx.price24hAgo = 100  // exactly 20%
      const warning = engine.checkAll(ctx)
      if (warning) {
        expect(warning.ghostId).not.toBe('newton_ghost')
      }
    })

    it('does not trigger when price24hAgo is 0', () => {
      const ctx = baseContext()
      ctx.lastBuyPrice = 130
      ctx.price24hAgo = 0
      const warning = engine.checkAll(ctx)
      if (warning) {
        expect(warning.ghostId).not.toBe('newton_ghost')
      }
    })
  })

  // ── LTCM trigger ───────────────────────────────────────────────────────

  describe('LTCM trigger — correlation collapse', () => {
    it('triggers when one position wildly deviates from others', () => {
      const ctx = baseContext()
      ctx.orders = [makeOrder('stop_loss', 'open')]
      // 3 positions: 2 at ~+5%, 1 at -40% (outlier)
      ctx.positions = [
        makePosition('BTC/USDT', 1, 100, 105),   // +5%
        makePosition('ETH/USDT', 1, 100, 104),   // +4%
        makePosition('SOL/USDT', 1, 100, 60),    // -40% (outlier)
      ]
      const warning = engine.checkAll(ctx)
      expect(warning).not.toBeNull()
      expect(warning!.ghostId).toBe('ltcm')
      expect(warning!.triggerReason).toContain('correlation collapse')
    })

    it('does not trigger with < 3 positions', () => {
      const ctx = baseContext()
      ctx.orders = [makeOrder('stop_loss', 'open')]
      ctx.positions = [
        makePosition('BTC/USDT', 1, 100, 105),
        makePosition('ETH/USDT', 1, 100, 60),
      ]
      const warning = engine.checkAll(ctx)
      if (warning) {
        expect(warning.ghostId).not.toBe('ltcm')
      }
    })

    it('does not trigger when all positions move similarly', () => {
      const ctx = baseContext()
      ctx.orders = [makeOrder('stop_loss', 'open')]
      ctx.positions = [
        makePosition('BTC/USDT', 1, 100, 105),
        makePosition('ETH/USDT', 1, 100, 106),
        makePosition('SOL/USDT', 1, 100, 104),
      ]
      const warning = engine.checkAll(ctx)
      if (warning) {
        expect(warning.ghostId).not.toBe('ltcm')
      }
    })
  })

  // ── Lehman trigger ─────────────────────────────────────────────────────

  describe('Lehman trigger — cascade liquidation', () => {
    it('triggers when leverage > 2x AND market down > 5%', () => {
      const ctx = baseContext()
      ctx.orders = [makeOrder('stop_loss', 'open')]
      // 250,000 notional / 100,000 balance = 2.5x leverage
      ctx.positions = [makePosition('BTC/USDT', 5, 48_000, 50_000)]
      ctx.currentBtcPrice = 47_000
      ctx.btcPrice24hAgo = 50_000  // -6% market drop
      const warning = engine.checkAll(ctx)
      expect(warning).not.toBeNull()
      expect(warning!.ghostId).toBe('lehman')
      expect(warning!.triggerReason).toContain('cascade liquidation')
    })

    it('does not trigger when leverage <= 2x', () => {
      const ctx = baseContext()
      ctx.orders = [makeOrder('stop_loss', 'open')]
      ctx.positions = [makePosition('BTC/USDT', 2, 48_000, 50_000)] // 100,000 / 100,000 = 1x
      ctx.currentBtcPrice = 47_000
      ctx.btcPrice24hAgo = 50_000
      const warning = engine.checkAll(ctx)
      if (warning) {
        expect(warning.ghostId).not.toBe('lehman')
      }
    })

    it('does not trigger when market drop <= 5%', () => {
      const ctx = baseContext()
      ctx.orders = [makeOrder('stop_loss', 'open')]
      ctx.positions = [makePosition('BTC/USDT', 5, 48_000, 50_000)]
      ctx.currentBtcPrice = 48_000  // -4% only
      ctx.btcPrice24hAgo = 50_000
      const warning = engine.checkAll(ctx)
      if (warning) {
        expect(warning.ghostId).not.toBe('lehman')
      }
    })
  })

  // ── Enron trigger ──────────────────────────────────────────────────────

  describe('Enron trigger — concentrated loser', () => {
    it('triggers when single position > 60% portfolio AND losing', () => {
      const ctx = baseContext()
      ctx.orders = [makeOrder('stop_loss', 'open')]
      // 70,000 / 100,000 = 70% concentration, at -10% loss
      ctx.positions = [makePosition('BTC/USDT', 1, 77_777, 70_000)]
      const warning = engine.checkAll(ctx)
      expect(warning).not.toBeNull()
      expect(warning!.ghostId).toBe('enron')
      expect(warning!.triggerReason).toContain('concentrated loser')
    })

    it('does not trigger when position is profitable', () => {
      const ctx = baseContext()
      ctx.orders = [makeOrder('stop_loss', 'open')]
      ctx.positions = [makePosition('BTC/USDT', 1, 60_000, 70_000)]  // +16.7%, profitable
      const warning = engine.checkAll(ctx)
      if (warning) {
        expect(warning.ghostId).not.toBe('enron')
      }
    })

    it('does not trigger when concentration < 60%', () => {
      const ctx = baseContext()
      ctx.orders = [makeOrder('stop_loss', 'open')]
      ctx.positions = [makePosition('BTC/USDT', 1, 55_000, 50_000)]  // 50% concentration
      const warning = engine.checkAll(ctx)
      if (warning) {
        expect(warning.ghostId).not.toBe('enron')
      }
    })
  })

  // ── SVB trigger ────────────────────────────────────────────────────────

  describe('SVB trigger — duration mismatch', () => {
    it('triggers when position down > 15% with price ratio < 0.85', () => {
      const ctx = baseContext()
      ctx.orders = [makeOrder('stop_loss', 'open')]
      // Entry 100, current 80 → -20%, ratio 0.80 < 0.85
      ctx.positions = [makePosition('BTC/USDT', 1, 100, 80)]
      const warning = engine.checkAll(ctx)
      expect(warning).not.toBeNull()
      expect(warning!.ghostId).toBe('svb')
      expect(warning!.triggerReason).toContain('held too long')
    })

    it('does not trigger when loss < 15%', () => {
      const ctx = baseContext()
      ctx.orders = [makeOrder('stop_loss', 'open')]
      ctx.positions = [makePosition('BTC/USDT', 1, 100, 90)] // -10%
      const warning = engine.checkAll(ctx)
      if (warning) {
        expect(warning.ghostId).not.toBe('svb')
      }
    })
  })

  // ── Cooldown behavior ──────────────────────────────────────────────────

  describe('cooldown behavior (60 min)', () => {
    it('same ghost does not re-trigger within 60 minutes', () => {
      const ctx = baseContext()
      ctx.ignoredAlertCount = 5  // Do Kwon trigger
      const first = engine.checkAll(ctx)
      expect(first).not.toBeNull()
      expect(first!.ghostId).toBe('do_kwon')

      // Immediately check again — should be on cooldown
      const second = engine.checkAll(ctx)
      // Do Kwon is on cooldown, but no other ghosts trigger
      expect(second).toBeNull()
    })

    it('ghost triggers again after 60 minutes', () => {
      const ctx = baseContext()
      ctx.ignoredAlertCount = 5
      const first = engine.checkAll(ctx)
      expect(first!.ghostId).toBe('do_kwon')

      // Advance time by 61 minutes
      vi.advanceTimersByTime(61 * 60 * 1000)

      const second = engine.checkAll(ctx)
      expect(second).not.toBeNull()
      expect(second!.ghostId).toBe('do_kwon')
    })

    it('different ghosts can trigger independently despite cooldowns', () => {
      const ctx = baseContext()
      ctx.ignoredAlertCount = 5  // Do Kwon
      const first = engine.checkAll(ctx)
      expect(first!.ghostId).toBe('do_kwon')

      // Now trigger Newton (Do Kwon is on cooldown)
      ctx.ignoredAlertCount = 0
      ctx.lastBuyPrice = 150
      ctx.price24hAgo = 100  // 50% increase
      const second = engine.checkAll(ctx)
      expect(second).not.toBeNull()
      expect(second!.ghostId).toBe('newton_ghost')
    })
  })

  // ── checkAll returns null when no triggers ─────────────────────────────

  describe('checkAll returns null when no match', () => {
    it('returns null for a clean context', () => {
      const ctx = baseContext()
      const warning = engine.checkAll(ctx)
      expect(warning).toBeNull()
    })
  })

  // ── formatForTerminal ──────────────────────────────────────────────────

  describe('formatForTerminal', () => {
    it('formats with ANSI codes by default', () => {
      const ctx = baseContext()
      ctx.ignoredAlertCount = 5
      const warning = engine.checkAll(ctx)!
      const formatted = engine.formatForTerminal(warning)
      expect(formatted).toContain(warning.ghostName)
      expect(formatted).toContain('┌─[GHOST_WARNING]')
    })

    it('formats plain text when NO_COLOR is set', () => {
      const original = process.env.NO_COLOR
      process.env.NO_COLOR = '1'
      try {
        const ctx = baseContext()
        ctx.ignoredAlertCount = 5
        // Need a fresh engine since previous one has cooldown
        const freshEngine = new GhostEngine()
        const warning = freshEngine.checkAll(ctx)!
        const formatted = freshEngine.formatForTerminal(warning)
        expect(formatted).not.toContain('\x1b[')
        expect(formatted).toContain(warning.ghostName)
      } finally {
        if (original === undefined) {
          delete process.env.NO_COLOR
        } else {
          process.env.NO_COLOR = original
        }
      }
    })
  })

  // ── hasTriggered ──────────────────────────────────────────────────────

  describe('hasTriggered', () => {
    it('returns false initially', () => {
      expect(engine.hasTriggered).toBe(false)
    })

    it('returns true after a ghost triggers', () => {
      const ctx = baseContext()
      ctx.ignoredAlertCount = 5
      engine.checkAll(ctx)
      expect(engine.hasTriggered).toBe(true)
    })

    it('returns false after cooldown expires', () => {
      const ctx = baseContext()
      ctx.ignoredAlertCount = 5
      engine.checkAll(ctx)
      vi.advanceTimersByTime(61 * 60 * 1000)
      expect(engine.hasTriggered).toBe(false)
    })
  })
})
