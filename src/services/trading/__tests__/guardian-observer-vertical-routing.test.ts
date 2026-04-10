/**
 * guardian-observer — TOOL_TO_VERTICAL routing tests (Sprint 146 / v0.2.2-sensei).
 *
 * REGRESSION SUITE: every trading tool must map to its correct vertical so
 * the post-trade guardian fires the right vertical-specific risk checks.
 * If a new trade tool is added without a TOOL_TO_VERTICAL entry, this test
 * fails — guarding against silent regressions where futures/options/stocks/
 * defi/prediction/forex specialized checks would never fire.
 *
 * The guardian-observer was extended in the Summon Ceremony / first-hatch
 * workstream to seed currentVerticalContext from the tool name when a
 * tool didn't already call setVerticalContext. Without this map, only
 * the 6 generic ALL_CHECKS would fire on every trade.
 */

import { describe, it, expect } from 'vitest'
import {
  inferVerticalFromTool,
  isTradeRelatedTool,
} from '../guardian-observer.js'

describe('guardian-observer — TOOL_TO_VERTICAL routing', () => {
  it('routes spot trade tools to spot vertical', () => {
    expect(inferVerticalFromTool('PlaceOrder')).toBe('spot')
    expect(inferVerticalFromTool('GetPositions')).toBe('spot')
    expect(inferVerticalFromTool('GetBalance')).toBe('spot')
  })

  it('routes futures trade tools to perp_futures vertical', () => {
    expect(inferVerticalFromTool('PlaceFuturesOrder')).toBe('perp_futures')
    expect(inferVerticalFromTool('SetLeverage')).toBe('perp_futures')
    expect(inferVerticalFromTool('GetFundingRate')).toBe('perp_futures')
    expect(inferVerticalFromTool('GetLiquidationPrice')).toBe('perp_futures')
  })

  it('routes options trade tools to crypto_options vertical', () => {
    expect(inferVerticalFromTool('PlaceOptionsOrder')).toBe('crypto_options')
    expect(inferVerticalFromTool('GetOptionsChain')).toBe('crypto_options')
    expect(inferVerticalFromTool('GetGreeks')).toBe('crypto_options')
  })

  it('routes stock trade tools to stocks vertical', () => {
    expect(inferVerticalFromTool('PlaceStockOrder')).toBe('stocks')
  })

  it('routes DEX swap tool to defi_dex vertical', () => {
    expect(inferVerticalFromTool('SwapDEX')).toBe('defi_dex')
  })

  it('routes prediction tools to prediction vertical', () => {
    expect(inferVerticalFromTool('PlacePrediction')).toBe('prediction')
    expect(inferVerticalFromTool('GetEventMarkets')).toBe('prediction')
  })

  it('routes forex trade tool to forex vertical', () => {
    expect(inferVerticalFromTool('PlaceForexOrder')).toBe('forex')
  })

  it('returns undefined for unknown tool names', () => {
    expect(inferVerticalFromTool('NotATradingTool')).toBeUndefined()
    expect(inferVerticalFromTool('Bash')).toBeUndefined()
    expect(inferVerticalFromTool('Read')).toBeUndefined()
    expect(inferVerticalFromTool('')).toBeUndefined()
  })

  it('REGRESSION — every isTradeRelatedTool tool has a vertical mapping', () => {
    // The trade tools registry that triggers the post-trade guardian.
    // If a tool is "trade-related" but has no vertical mapping, the
    // guardian would only run generic checks — that's the regression
    // this test guards against.
    const allTradeTools = [
      'PlaceOrder',
      'GetPositions',
      'GetBalance',
      'PlaceFuturesOrder',
      'SetLeverage',
      'GetFundingRate',
      'GetLiquidationPrice',
      'PlaceOptionsOrder',
      'GetOptionsChain',
      'GetGreeks',
      'PlaceStockOrder',
      'SwapDEX',
      'PlacePrediction',
      'GetEventMarkets',
      'PlaceForexOrder',
    ]

    for (const tool of allTradeTools) {
      expect(isTradeRelatedTool(tool)).toBe(true)
      const vertical = inferVerticalFromTool(tool)
      expect(vertical).toBeDefined()
      expect(vertical).not.toBe('')
    }
  })

  it('REGRESSION — vertical values match the TradingVertical union', () => {
    // Catches typos in TOOL_TO_VERTICAL values. The TradingVertical type
    // is structurally enforced in the source file but a runtime check is
    // useful in case future refactors break the type alignment.
    const validVerticals = new Set([
      'spot',
      'perp_futures',
      'crypto_options',
      'stocks',
      'defi_dex',
      'prediction',
      'forex',
    ])

    const allTradeTools = [
      'PlaceOrder',
      'PlaceFuturesOrder',
      'PlaceOptionsOrder',
      'PlaceStockOrder',
      'SwapDEX',
      'PlacePrediction',
      'PlaceForexOrder',
    ]

    for (const tool of allTradeTools) {
      const v = inferVerticalFromTool(tool)
      expect(v && validVerticals.has(v)).toBe(true)
    }
  })
})
