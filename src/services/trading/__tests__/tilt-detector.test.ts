import { describe, it, expect, beforeEach } from 'vitest'
import { TiltDetector, type TradeOutcome } from '../tilt-detector'

/** Helper to create a trade outcome with sensible defaults. */
function trade(
  pnlPercent: number,
  positionSize = 1000,
  symbol = 'BTC/USDT',
): TradeOutcome {
  return {
    symbol,
    side: 'buy',
    pnlPercent,
    positionSize,
    timestamp: Date.now(),
  }
}

describe('TiltDetector', () => {
  let detector: TiltDetector

  beforeEach(() => {
    detector = new TiltDetector()
  })

  describe('3 consecutive losses trigger warning', () => {
    it('does NOT trigger on 2 consecutive losses', () => {
      detector.recordTrade(trade(-1.5))
      const status = detector.recordTrade(trade(-2.0))
      expect(status.level).toBe('none')
    })

    it('triggers warning on exactly 3 consecutive losses', () => {
      detector.recordTrade(trade(-1.5))
      detector.recordTrade(trade(-2.0))
      const status = detector.recordTrade(trade(-0.5))
      expect(status.level).toBe('warning')
      expect(status.triggers).toContain('3 consecutive losses')
    })

    it('triggers warning on 4 consecutive losses', () => {
      detector.recordTrade(trade(-1.0))
      detector.recordTrade(trade(-1.5))
      detector.recordTrade(trade(-2.0))
      const status = detector.recordTrade(trade(-0.5))
      expect(status.level).toBe('warning')
      expect(status.triggers).toContain('4 consecutive losses')
    })

    it('does NOT trigger when a win breaks the streak', () => {
      detector.recordTrade(trade(-1.5))
      detector.recordTrade(trade(+0.5)) // win breaks streak
      const status = detector.recordTrade(trade(-2.0))
      expect(status.level).toBe('none')
    })
  })

  describe('2 losses + size escalation trigger warning', () => {
    it('triggers when latest trade size >150% of prior average', () => {
      // Prior trades: avg size = 1000
      detector.recordTrade(trade(-1.0, 1000))
      // Latest trade: size = 1600 (160% of avg) — should trigger
      const status = detector.recordTrade(trade(-0.5, 1600))
      expect(status.level).toBe('warning')
      expect(status.triggers).toContain('position size escalation during losses')
    })

    it('does NOT trigger when size is within 150% of average', () => {
      // Prior trades: avg size = 1000
      detector.recordTrade(trade(-1.0, 1000))
      // Latest trade: size = 1400 (140% of avg) — below threshold
      const status = detector.recordTrade(trade(-0.5, 1400))
      expect(status.level).toBe('none')
    })

    it('does NOT trigger escalation when only 1 loss exists', () => {
      detector.recordTrade(trade(+2.0, 1000))
      // Only 1 loss, even with large size
      const status = detector.recordTrade(trade(-0.5, 5000))
      expect(status.level).toBe('none')
    })
  })

  describe('normal scalping (3 small stops) should NOT trigger', () => {
    it('does NOT trigger when losses are interrupted by wins', () => {
      // Scalper pattern: loss, win, loss, win, loss
      detector.recordTrade(trade(-0.3, 500))
      detector.recordTrade(trade(+0.5, 500))
      detector.recordTrade(trade(-0.2, 500))
      detector.recordTrade(trade(+0.4, 500))
      const status = detector.recordTrade(trade(-0.1, 500))
      expect(status.level).toBe('none')
    })

    it('does NOT trigger on 2 losses then a win', () => {
      detector.recordTrade(trade(-0.5, 500))
      detector.recordTrade(trade(-0.3, 500))
      const status = detector.recordTrade(trade(+1.0, 500))
      expect(status.level).toBe('none')
    })
  })

  describe('window slides correctly', () => {
    it('only keeps the last 5 trades', () => {
      // Fill 5 trades: 3 wins then 2 losses
      detector.recordTrade(trade(+1.0))
      detector.recordTrade(trade(+2.0))
      detector.recordTrade(trade(+0.5))
      detector.recordTrade(trade(-1.0))
      detector.recordTrade(trade(-0.5))
      expect(detector.getWindow().length).toBe(5)

      // Add 6th trade — window should still be 5
      detector.recordTrade(trade(-0.3))
      expect(detector.getWindow().length).toBe(5)

      // The oldest win should have been evicted.
      // Window: [+2.0, +0.5, -1.0, -0.5, -0.3] — 3 consecutive losses
      const status = detector.getStatus()
      expect(status.level).toBe('warning')
    })

    it('old losses slide out of the window', () => {
      // 3 consecutive losses
      detector.recordTrade(trade(-1.0))
      detector.recordTrade(trade(-1.5))
      detector.recordTrade(trade(-2.0))
      expect(detector.getStatus().level).toBe('warning')

      // Add 3 wins — the losses should slide out
      detector.recordTrade(trade(+1.0)) // auto-dismisses on first win
      detector.recordTrade(trade(+2.0))
      detector.recordTrade(trade(+0.5))
      expect(detector.getStatus().level).toBe('none')
      // Window: [-1.5, -2.0, +1.0, +2.0, +0.5]
      expect(detector.getWindow().length).toBe(5)
    })
  })

  describe('auto-dismiss on profitable trade', () => {
    it('clears warning when a profitable trade is recorded', () => {
      detector.recordTrade(trade(-1.0))
      detector.recordTrade(trade(-1.5))
      detector.recordTrade(trade(-2.0))
      expect(detector.getStatus().level).toBe('warning')

      const status = detector.recordTrade(trade(+0.5))
      expect(status.level).toBe('none')
      expect(status.triggers).toHaveLength(0)
    })

    it('break-even trade (0%) does NOT clear warning', () => {
      detector.recordTrade(trade(-1.0))
      detector.recordTrade(trade(-1.5))
      detector.recordTrade(trade(-2.0))
      expect(detector.getStatus().level).toBe('warning')

      // pnl = 0 is not profitable, should not auto-dismiss
      const status = detector.recordTrade(trade(0))
      expect(status.level).toBe('warning')
    })
  })

  describe('reset()', () => {
    it('clears all state', () => {
      detector.recordTrade(trade(-1.0))
      detector.recordTrade(trade(-1.5))
      detector.recordTrade(trade(-2.0))
      expect(detector.getStatus().level).toBe('warning')

      detector.reset()
      expect(detector.getStatus().level).toBe('none')
      expect(detector.getWindow()).toHaveLength(0)
    })
  })

  describe('combined triggers', () => {
    it('fires both triggers simultaneously', () => {
      // 2 normal-sized losses
      detector.recordTrade(trade(-1.0, 1000))
      detector.recordTrade(trade(-1.5, 1000))
      // 3rd loss with size escalation (2000 = 200% of avg 1000)
      const status = detector.recordTrade(trade(-2.0, 2000))
      expect(status.level).toBe('warning')
      expect(status.triggers).toContain('3 consecutive losses')
      expect(status.triggers).toContain('position size escalation during losses')
    })
  })
})
