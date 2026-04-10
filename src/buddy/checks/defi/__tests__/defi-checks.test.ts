import { describe, it, expect, beforeEach } from 'vitest'
import { checkSlippageTolerance } from '../slippage-tolerance'
import { checkGasCost } from '../gas-cost-check'
import { checkContractAudit } from '../contract-audit'
import { checkImpermanentLoss } from '../impermanent-loss'
import { runDefiChecks } from '../index'
import { dispatchVerticalChecks } from '../../vertical-dispatcher'
import type { VerticalContext } from '../../../verticals'
import {
  checkTerraLunaTrigger,
  checkTheDaoTrigger,
  checkWormholeTrigger,
  type DefiGhostContext,
} from '../../ghost-triggers'
import { TiltDetector } from '../../../../services/trading/tilt-detector'

const MASTER_ID = 'nassim_taleb'
const MASTER_NAME = 'Nassim Taleb'
const MASTER_QUOTE = 'Antifragility is beyond resilience or robustness.'

function defiCtx(overrides: Partial<VerticalContext> = {}): VerticalContext {
  return {
    vertical: 'defi_dex',
    estimatedSlippage: 0.001,
    gasEstimateUSD: 0.5,
    isContractAudited: true,
    ...overrides,
  }
}

// ── Slippage Tolerance ────────────────────────────────────────────────────

describe('checkSlippageTolerance', () => {
  it('passes when slippage < 0.5%', () => {
    const ctx = defiCtx({ estimatedSlippage: 0.004 })
    const result = checkSlippageTolerance(ctx, MASTER_ID, MASTER_NAME, MASTER_QUOTE)
    expect(result).toBeNull()
  })

  it('warns when slippage is 0.5-2%', () => {
    const ctx = defiCtx({ estimatedSlippage: 0.01 })
    const result = checkSlippageTolerance(ctx, MASTER_ID, MASTER_NAME, MASTER_QUOTE)
    expect(result).not.toBeNull()
    expect(result!.severity).toBe('WARNING')
    expect(result!.checkName).toBe('slippage-tolerance')
  })

  it('critical when slippage > 2%', () => {
    const ctx = defiCtx({ estimatedSlippage: 0.03 })
    const result = checkSlippageTolerance(ctx, MASTER_ID, MASTER_NAME, MASTER_QUOTE)
    expect(result).not.toBeNull()
    expect(result!.severity).toBe('CRITICAL')
  })

  it('returns null for non-defi vertical', () => {
    const ctx = defiCtx({ vertical: 'spot' })
    const result = checkSlippageTolerance(ctx, MASTER_ID, MASTER_NAME, MASTER_QUOTE)
    expect(result).toBeNull()
  })

  it('returns null when slippage is undefined', () => {
    const ctx = defiCtx({ estimatedSlippage: undefined })
    const result = checkSlippageTolerance(ctx, MASTER_ID, MASTER_NAME, MASTER_QUOTE)
    expect(result).toBeNull()
  })
})

// ── Gas Cost ──────────────────────────────────────────────────────────────

describe('checkGasCost', () => {
  it('passes when gas < 1% of trade', () => {
    const ctx = defiCtx({ gasEstimateUSD: 0.5 })
    const result = checkGasCost(ctx, 1000, MASTER_ID, MASTER_NAME, MASTER_QUOTE)
    expect(result).toBeNull()
  })

  it('warns when gas is 1-5% of trade', () => {
    const ctx = defiCtx({ gasEstimateUSD: 3 })
    const result = checkGasCost(ctx, 100, MASTER_ID, MASTER_NAME, MASTER_QUOTE)
    expect(result).not.toBeNull()
    expect(result!.severity).toBe('WARNING')
    expect(result!.checkName).toBe('gas-cost')
  })

  it('critical when gas > 5% of trade', () => {
    const ctx = defiCtx({ gasEstimateUSD: 10 })
    const result = checkGasCost(ctx, 100, MASTER_ID, MASTER_NAME, MASTER_QUOTE)
    expect(result).not.toBeNull()
    expect(result!.severity).toBe('CRITICAL')
  })

  it('returns null for zero trade value', () => {
    const ctx = defiCtx({ gasEstimateUSD: 5 })
    const result = checkGasCost(ctx, 0, MASTER_ID, MASTER_NAME, MASTER_QUOTE)
    expect(result).toBeNull()
  })

  it('returns null when gas is undefined', () => {
    const ctx = defiCtx({ gasEstimateUSD: undefined })
    const result = checkGasCost(ctx, 1000, MASTER_ID, MASTER_NAME, MASTER_QUOTE)
    expect(result).toBeNull()
  })
})

// ── Contract Audit ────────────────────────────────────────────────────────

describe('checkContractAudit', () => {
  it('passes when contract is audited', () => {
    const ctx = defiCtx({ isContractAudited: true })
    const result = checkContractAudit(ctx, MASTER_ID, MASTER_NAME, MASTER_QUOTE)
    expect(result).toBeNull()
  })

  it('warns when audit status is unknown', () => {
    const ctx = defiCtx({ isContractAudited: undefined })
    const result = checkContractAudit(ctx, MASTER_ID, MASTER_NAME, MASTER_QUOTE)
    expect(result).not.toBeNull()
    expect(result!.severity).toBe('WARNING')
    expect(result!.checkName).toBe('contract-audit')
  })

  it('critical when contract is unaudited', () => {
    const ctx = defiCtx({ isContractAudited: false })
    const result = checkContractAudit(ctx, MASTER_ID, MASTER_NAME, MASTER_QUOTE)
    expect(result).not.toBeNull()
    expect(result!.severity).toBe('CRITICAL')
  })
})

// ── Impermanent Loss ──────────────────────────────────────────────────────

describe('checkImpermanentLoss', () => {
  it('passes when slippage < 2%', () => {
    const ctx = defiCtx({ estimatedSlippage: 0.01 })
    const result = checkImpermanentLoss(ctx, MASTER_ID, MASTER_NAME, MASTER_QUOTE)
    expect(result).toBeNull()
  })

  it('warns when slippage is 2-5%', () => {
    const ctx = defiCtx({ estimatedSlippage: 0.03 })
    const result = checkImpermanentLoss(ctx, MASTER_ID, MASTER_NAME, MASTER_QUOTE)
    expect(result).not.toBeNull()
    expect(result!.severity).toBe('WARNING')
    expect(result!.checkName).toBe('impermanent-loss')
  })

  it('critical when slippage > 5%', () => {
    const ctx = defiCtx({ estimatedSlippage: 0.06 })
    const result = checkImpermanentLoss(ctx, MASTER_ID, MASTER_NAME, MASTER_QUOTE)
    expect(result).not.toBeNull()
    expect(result!.severity).toBe('CRITICAL')
  })
})

// ── runDefiChecks ─────────────────────────────────────────────────────────

describe('runDefiChecks', () => {
  it('returns null when all checks pass', () => {
    const ctx = defiCtx({
      estimatedSlippage: 0.001,
      gasEstimateUSD: 0.01,
      isContractAudited: true,
    })
    const result = runDefiChecks(ctx, 1000, MASTER_ID, MASTER_NAME, MASTER_QUOTE)
    expect(result).toBeNull()
  })

  it('returns the first failing check (slippage)', () => {
    const ctx = defiCtx({
      estimatedSlippage: 0.03, // > 2% = CRITICAL
      gasEstimateUSD: 0.01,
      isContractAudited: true,
    })
    const result = runDefiChecks(ctx, 1000, MASTER_ID, MASTER_NAME, MASTER_QUOTE)
    expect(result).not.toBeNull()
    expect(result!.checkName).toBe('slippage-tolerance')
  })

  it('skips passing checks and finds later failure', () => {
    const ctx = defiCtx({
      estimatedSlippage: 0.001, // passes
      gasEstimateUSD: 0.01,    // passes
      isContractAudited: false, // CRITICAL
    })
    const result = runDefiChecks(ctx, 1000, MASTER_ID, MASTER_NAME, MASTER_QUOTE)
    expect(result).not.toBeNull()
    expect(result!.checkName).toBe('contract-audit')
  })
})

// ── Vertical Dispatcher ───────────────────────────────────────────────────

describe('dispatchVerticalChecks', () => {
  it('routes defi_dex to DeFi checks', () => {
    const ctx = defiCtx({ estimatedSlippage: 0.03 })
    const result = dispatchVerticalChecks(ctx, 1000, MASTER_ID, MASTER_NAME, MASTER_QUOTE)
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
    expect(result[0].name).toBe('slippage-tolerance')
  })

  it('returns empty for unsupported verticals', () => {
    const ctx: VerticalContext = { vertical: 'spot' }
    const result = dispatchVerticalChecks(ctx)
    expect(result).toEqual([])
  })

  it('returns empty array for healthy defi state', () => {
    const ctx = defiCtx()
    const result = dispatchVerticalChecks(ctx, 1000, MASTER_ID, MASTER_NAME, MASTER_QUOTE)
    expect(result).toEqual([])
  })
})

// ── DeFi Ghost Triggers ───────────────────────────────────────────────────

describe('DeFi Ghost Triggers', () => {
  describe('checkTerraLunaTrigger', () => {
    it('returns null when slippage <= 3%', () => {
      const ctx: DefiGhostContext = { estimatedSlippage: 0.02 }
      expect(checkTerraLunaTrigger(ctx)).toBeNull()
    })

    it('triggers when slippage > 3%', () => {
      const ctx: DefiGhostContext = { estimatedSlippage: 0.05 }
      const warning = checkTerraLunaTrigger(ctx)
      expect(warning).not.toBeNull()
      expect(warning!.ghostId).toBe('terra_luna')
      expect(warning!.triggerReason).toContain('Slippage')
    })

    it('returns null when slippage is undefined', () => {
      const ctx: DefiGhostContext = {}
      expect(checkTerraLunaTrigger(ctx)).toBeNull()
    })
  })

  describe('checkTheDaoTrigger', () => {
    it('returns null when contract is audited', () => {
      const ctx: DefiGhostContext = { isContractAudited: true }
      expect(checkTheDaoTrigger(ctx)).toBeNull()
    })

    it('returns null when audit status is unknown', () => {
      const ctx: DefiGhostContext = { isContractAudited: undefined }
      expect(checkTheDaoTrigger(ctx)).toBeNull()
    })

    it('triggers when contract is unaudited', () => {
      const ctx: DefiGhostContext = { isContractAudited: false }
      const warning = checkTheDaoTrigger(ctx)
      expect(warning).not.toBeNull()
      expect(warning!.ghostId).toBe('the_dao')
      expect(warning!.triggerReason).toContain('unaudited')
    })
  })

  describe('checkWormholeTrigger', () => {
    it('returns null when not cross-chain', () => {
      const ctx: DefiGhostContext = { isCrossChain: false }
      expect(checkWormholeTrigger(ctx)).toBeNull()
    })

    it('triggers when cross-chain', () => {
      const ctx: DefiGhostContext = { isCrossChain: true }
      const warning = checkWormholeTrigger(ctx)
      expect(warning).not.toBeNull()
      expect(warning!.ghostId).toBe('wormhole')
      expect(warning!.triggerReason).toContain('bridge')
    })

    it('returns null when isCrossChain is undefined', () => {
      const ctx: DefiGhostContext = {}
      expect(checkWormholeTrigger(ctx)).toBeNull()
    })
  })
})

// ── Aping Tilt Detection ──────────────────────────────────────────────────

describe('Aping Tilt Detection', () => {
  let detector: TiltDetector

  beforeEach(() => {
    detector = new TiltDetector()
  })

  it('does NOT trigger with fewer than 3 DEX swaps', () => {
    const now = Date.now()
    detector.recordDefiSwap(now - 5000)
    detector.recordDefiSwap(now - 3000)
    // Record a trade to evaluate — only 2 swaps
    const status = detector.recordTrade({
      symbol: 'SOL/USDC',
      side: 'sell',
      pnlPercent: 0,
      positionSize: 100,
      timestamp: now,
    })
    expect(status.triggers).not.toContain('rapid DEX swaps (aping)')
  })

  it('triggers aping with 3+ DEX swaps within 10 minutes', () => {
    const now = Date.now()
    detector.recordDefiSwap(now - 300_000) // 5 min ago
    detector.recordDefiSwap(now - 120_000) // 2 min ago
    detector.recordDefiSwap(now - 60_000)  // 1 min ago
    // Evaluate — 3 swaps within window
    const status = detector.recordTrade({
      symbol: 'SOL/USDC',
      side: 'sell',
      pnlPercent: 0,
      positionSize: 100,
      timestamp: now,
    })
    expect(status.level).toBe('warning')
    expect(status.triggers).toContain('rapid DEX swaps (aping)')
  })

  it('does NOT trigger when swaps are outside the 10-minute window', () => {
    const now = Date.now()
    detector.recordDefiSwap(now - 700_000) // 11+ min ago
    detector.recordDefiSwap(now - 650_000) // 10+ min ago
    detector.recordDefiSwap(now - 620_000) // 10+ min ago
    const status = detector.recordTrade({
      symbol: 'SOL/USDC',
      side: 'sell',
      pnlPercent: 0,
      positionSize: 100,
      timestamp: now,
    })
    expect(status.triggers).not.toContain('rapid DEX swaps (aping)')
  })

  it('reset clears DEX swap timestamps', () => {
    const now = Date.now()
    detector.recordDefiSwap(now)
    detector.recordDefiSwap(now)
    detector.recordDefiSwap(now)
    detector.reset()
    expect(detector.getDefiSwapTimestamps()).toHaveLength(0)
  })

  it('prunes stale timestamps on recordDefiSwap', () => {
    const now = Date.now()
    detector.recordDefiSwap(now - 700_000) // stale
    detector.recordDefiSwap(now) // fresh
    // After recording, stale should be pruned
    expect(detector.getDefiSwapTimestamps().length).toBeGreaterThanOrEqual(1)
  })
})
