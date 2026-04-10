/**
 * runPreTradeGate — unit tests for the shared fail-closed gate helper.
 *
 * These exist as REGRESSION TESTS for the v0.2.1 security patch fix
 * (Sprint 143). If you are refactoring trade tools, do NOT skip these —
 * they encode the fail-closed contract that every order tool depends on.
 *
 *   THREAT: v0.2.0-sensei (verified by /autoplan dual voices on 2026-04-06)
 *   shipped a fail-OPEN trade path. Every order tool called the exchange
 *   directly without first running the deterministic risk gate. The gate
 *   was exposed as a separate LLM-callable tool, meaning the LLM (or
 *   anyone with UDS access via desktop/services/desktop/execute-listener.ts:119)
 *   could place orders bypassing all 6 risk checks.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { GateInput, RiskGateResult } from '../../PreTradeGateTool/types.js'

// Mock the gate evaluator at module-load time so runPreTradeGate sees the stub
vi.mock('../../PreTradeGateTool/gateEvaluator.js', () => ({
  evaluateGate: vi.fn(),
  formatGateResult: vi.fn(
    (input: GateInput, result: RiskGateResult) =>
      `[FORMATTED] status=${result.status} symbol=${input.symbol}`,
  ),
}))

import { runPreTradeGate } from '../runPreTradeGate.js'
import { evaluateGate, formatGateResult } from '../../PreTradeGateTool/gateEvaluator.js'

const mockEvaluate = vi.mocked(evaluateGate)
const mockFormat = vi.mocked(formatGateResult)

function input(overrides?: Partial<GateInput>): GateInput {
  return {
    symbol: 'BTC/USDT',
    side: 'buy',
    type: 'market',
    quantity: 0.1,
    price: 50_000,
    ...overrides,
  }
}

function gateResult(status: 'pass' | 'warn' | 'fail' | 'emergency'): RiskGateResult {
  return {
    status,
    checks: [{ name: 'TestCheck', status, message: `${status} marker` }],
    summary: `${status} summary`,
  }
}

describe('runPreTradeGate', () => {
  beforeEach(() => {
    mockEvaluate.mockReset()
    mockFormat.mockClear()
  })

  it('allows the trade when status is pass', async () => {
    mockEvaluate.mockResolvedValueOnce(gateResult('pass'))

    const outcome = await runPreTradeGate(input())

    expect(outcome.allowed).toBe(true)
    if (outcome.allowed) {
      expect(outcome.result.status).toBe('pass')
    }
    expect(mockFormat).not.toHaveBeenCalled()
  })

  it('allows the trade when status is warn (warnings are advisory, not blocking)', async () => {
    mockEvaluate.mockResolvedValueOnce(gateResult('warn'))

    const outcome = await runPreTradeGate(input())

    expect(outcome.allowed).toBe(true)
    expect(mockFormat).not.toHaveBeenCalled()
  })

  it('REGRESSION — blocks the trade when status is fail', async () => {
    mockEvaluate.mockResolvedValueOnce(gateResult('fail'))

    const outcome = await runPreTradeGate(input())

    expect(outcome.allowed).toBe(false)
    if (!outcome.allowed) {
      expect(outcome.formattedRejection).toContain('[FORMATTED]')
      expect(outcome.formattedRejection).toContain('status=fail')
      expect(outcome.formattedRejection).toContain('symbol=BTC/USDT')
    }
    expect(mockFormat).toHaveBeenCalledOnce()
  })

  it('REGRESSION — blocks the trade when status is emergency', async () => {
    mockEvaluate.mockResolvedValueOnce(gateResult('emergency'))

    const outcome = await runPreTradeGate(input())

    expect(outcome.allowed).toBe(false)
    if (!outcome.allowed) {
      expect(outcome.formattedRejection).toContain('status=emergency')
    }
  })

  it('passes the input through to evaluateGate unchanged', async () => {
    mockEvaluate.mockResolvedValueOnce(gateResult('pass'))
    const i = input({ symbol: 'ETH/USDT', side: 'sell', quantity: 2.5 })

    await runPreTradeGate(i)

    expect(mockEvaluate).toHaveBeenCalledWith(i)
  })

  it('propagates evaluator errors instead of fail-opening on them', async () => {
    // CRITICAL: if the evaluator throws, callers must NOT silently allow the
    // trade. The error must propagate so the user sees a real failure.
    mockEvaluate.mockRejectedValueOnce(new Error('exchange unreachable'))

    await expect(runPreTradeGate(input())).rejects.toThrow('exchange unreachable')
  })

  it('REGRESSION — does not call format on success path (allocation hygiene)', async () => {
    mockEvaluate.mockResolvedValueOnce(gateResult('pass'))

    await runPreTradeGate(input())

    expect(mockFormat).not.toHaveBeenCalled()
  })

  it('REGRESSION — calls format exactly once on rejection', async () => {
    mockEvaluate.mockResolvedValueOnce(gateResult('fail'))

    await runPreTradeGate(input())

    expect(mockFormat).toHaveBeenCalledTimes(1)
  })
})
