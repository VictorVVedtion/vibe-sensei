/**
 * Cross-cutting regression test — ALL 7 trade tools fail-close.
 *
 * This is the v0.2.1 security patch's authoritative test (Sprint 143). It
 * verifies that every order tool calls runPreTradeGate() BEFORE the exchange
 * and returns the rejection without touching the exchange when the gate
 * fails. If a future refactor removes the gate call from any tool, this
 * test fails.
 *
 * Strategy: mock the shared runPreTradeGate helper to return
 * {allowed: false, formattedRejection: '<MARKER>'}, then call each tool's
 * .call() method. The expected output for every tool is the rejection
 * marker. If a tool calls the exchange instead, the test fails because
 * the exchange mock is never called and the marker is missing from the
 * output.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const REJECT_MARKER = '<<GATE_REJECTED_MARKER_v0.2.1>>'

// Mock runPreTradeGate FIRST so every trade tool that imports it gets the stub
vi.mock('../runPreTradeGate.js', () => ({
  runPreTradeGate: vi.fn(async () => ({
    allowed: false,
    result: { status: 'fail', checks: [], summary: 'mocked fail' },
    formattedRejection: REJECT_MARKER,
  })),
}))

// Mock all the exchange singletons so that if a tool DOES bypass the gate,
// we'd still see a clear failure (rather than a real network call). Each
// mock returns an exchange whose placeOrder throws so we'd notice instantly.
const placeOrderSpy = vi.fn(async () => {
  throw new Error('FAIL: tool bypassed gate and called placeOrder')
})

vi.mock('../../../services/exchange/singleton.js', () => ({
  getConnectedExchange: vi.fn(async () => ({
    placeOrder: placeOrderSpy,
    getPositions: vi.fn(async () => []),
    getBalance: vi.fn(async () => []),
  })),
}))

vi.mock('../../../services/exchange/venue-bootstrap.js', () => ({
  ensureFutures: vi.fn(async () => ({ placeOrder: placeOrderSpy, setLeverage: vi.fn() })),
  ensureOptions: vi.fn(async () => ({ placeOrder: placeOrderSpy })),
  ensureStocks: vi.fn(async () => ({ placeOrder: placeOrderSpy, getClock: vi.fn(async () => ({ is_open: true })) })),
  ensureForex: vi.fn(async () => ({ placeOrder: placeOrderSpy })),
  ensureDex: vi.fn(async () => ({
    getQuote: vi.fn(async () => ({
      fromToken: 'SOL',
      toToken: 'USDC',
      fromAmount: 10,
      toAmount: 145.123456,
      price: 14.5123,
      priceImpact: 0.0012,
      estimatedGasUSD: 0.0023,
      route: 'Jupiter v6',
      expiresAt: Date.now() + 60_000,
      raw: {},
    })),
    executeSwap: vi.fn(async () => {
      throw new Error('FAIL: SwapTool bypassed gate and called executeSwap')
    }),
  })),
  ensurePrediction: vi.fn(async () => ({
    findMarketByQuery: vi.fn(async () => ({ id: 'm1', question: 'mocked' })),
    placeBet: vi.fn(async () => {
      throw new Error('FAIL: PredictionTool bypassed gate and called placeBet')
    }),
  })),
}))

import { runPreTradeGate } from '../runPreTradeGate.js'
const mockGate = vi.mocked(runPreTradeGate)

beforeEach(() => {
  mockGate.mockClear()
  placeOrderSpy.mockClear()
})

describe('Sprint 143 — all 7 trade tools fail-closed (REGRESSION)', () => {
  it('OrderTool refuses to place an order when the gate fails', async () => {
    const { OrderTool } = await import('../../OrderTool/OrderTool.js')

    const out = await OrderTool.call(
      { symbol: 'BTC/USDT', side: 'buy', type: 'market', quantity: 0.1 },
      // @ts-expect-error — test stub for ToolUseContext
      {} as any,
      // @ts-expect-error — test stub for canUseTool
      undefined as any,
    )

    expect(mockGate).toHaveBeenCalledOnce()
    expect(placeOrderSpy).not.toHaveBeenCalled()
    expect(String(out.data ?? '')).toContain(REJECT_MARKER)
  })

  it('FuturesOrderTool refuses to place an order when the gate fails', async () => {
    const { FuturesOrderTool } = await import('../../FuturesOrderTool/FuturesOrderTool.js')

    const out = await FuturesOrderTool.call(
      { symbol: 'BTC/USDT:USDT', side: 'buy', type: 'market', quantity: 0.1 },
      // @ts-expect-error
      {} as any,
      // @ts-expect-error
      undefined as any,
    )

    expect(mockGate).toHaveBeenCalledOnce()
    expect(placeOrderSpy).not.toHaveBeenCalled()
    expect(String(out.data ?? '')).toContain(REJECT_MARKER)
  })

  it('OptionsOrderTool refuses to place an order when the gate fails', async () => {
    const { OptionsOrderTool } = await import('../../OptionsOrderTool/OptionsOrderTool.js')

    const out = await OptionsOrderTool.call(
      { symbol: 'BTC-28JUN24-70000-C', side: 'buy', type: 'market', quantity: 1 },
      // @ts-expect-error
      {} as any,
      // @ts-expect-error
      undefined as any,
    )

    expect(mockGate).toHaveBeenCalledOnce()
    expect(placeOrderSpy).not.toHaveBeenCalled()
    expect(String(out.data ?? '')).toContain(REJECT_MARKER)
  })

  it('StockOrderTool refuses to place an order when the gate fails', async () => {
    const { StockOrderTool } = await import('../../StockOrderTool/StockOrderTool.js')

    const out = await StockOrderTool.call(
      { symbol: 'AAPL', side: 'buy', type: 'market', quantity: 10 },
      // @ts-expect-error
      {} as any,
      // @ts-expect-error
      undefined as any,
    )

    expect(mockGate).toHaveBeenCalledOnce()
    expect(placeOrderSpy).not.toHaveBeenCalled()
    expect(String(out.data ?? '')).toContain(REJECT_MARKER)
  })

  it('ForexOrderTool refuses to place an order when the gate fails', async () => {
    const { ForexOrderTool } = await import('../../ForexOrderTool/ForexOrderTool.js')

    const out = await ForexOrderTool.call(
      { symbol: 'EUR_USD', side: 'buy', type: 'market', quantity: 100000 },
      // @ts-expect-error
      {} as any,
      // @ts-expect-error
      undefined as any,
    )

    expect(mockGate).toHaveBeenCalledOnce()
    expect(placeOrderSpy).not.toHaveBeenCalled()
    expect(String(out.data ?? '')).toContain(REJECT_MARKER)
  })

  it('SwapTool refuses to execute a swap when the gate fails (execute=true)', async () => {
    const { SwapTool } = await import('../../SwapTool/SwapTool.js')

    const out = await SwapTool.call(
      { fromToken: 'SOL', toToken: 'USDC', amount: 10, execute: true },
      // @ts-expect-error
      {} as any,
      // @ts-expect-error
      undefined as any,
    )

    expect(mockGate).toHaveBeenCalledOnce()
    expect(String(out.data ?? '')).toContain(REJECT_MARKER)
  })

  it('SwapTool quote-only path (execute=false) does NOT call the gate', async () => {
    // Quote-only is read-only — no gate needed.
    mockGate.mockClear()
    const { SwapTool } = await import('../../SwapTool/SwapTool.js')

    await SwapTool.call(
      { fromToken: 'SOL', toToken: 'USDC', amount: 10, execute: false },
      // @ts-expect-error
      {} as any,
      // @ts-expect-error
      undefined as any,
    )

    expect(mockGate).not.toHaveBeenCalled()
  })

  it('PredictionTool refuses to place a bet when the gate fails', async () => {
    const { PredictionTool } = await import('../../PredictionTool/PredictionTool.js')

    const out = await PredictionTool.call(
      { market: 'will BTC hit 100k', outcome: 'YES', amount: 10 },
      // @ts-expect-error
      {} as any,
      // @ts-expect-error
      undefined as any,
    )

    expect(mockGate).toHaveBeenCalledOnce()
    expect(String(out.data ?? '')).toContain(REJECT_MARKER)
  })
})
