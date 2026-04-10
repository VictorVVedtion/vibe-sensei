/**
 * Volume Confirmation gate check — verifies current volume against historical average.
 * Compares ticker volume to 20-period 4h average volume.
 * pass: > 1.0x | warn: 0.5-1.0x | fail: < 0.5x
 */

import type { Ticker, Candle } from '../../services/exchange/types.js'
import type { CheckResult } from '../../tools/PreTradeGateTool/types.js'

const PASS_RATIO = 1.0
const WARN_RATIO = 0.5

export function checkVolumeConfirmation(
  ticker: Ticker,
  candles: Candle[],
): CheckResult {
  if (candles.length === 0) {
    return {
      name: 'Volume',
      status: 'pass',
      message: 'no historical candles to compare',
    }
  }

  const avgVolume = candles.reduce((sum, c) => sum + c.volume, 0) / candles.length
  if (avgVolume <= 0) {
    return {
      name: 'Volume',
      status: 'pass',
      message: 'no volume history available',
    }
  }

  const ratio = ticker.volume / avgVolume
  const ratioStr = ratio.toFixed(1)

  if (ratio >= PASS_RATIO) {
    return {
      name: 'Volume',
      status: 'pass',
      message: `${ratioStr}x average volume`,
    }
  }

  if (ratio >= WARN_RATIO) {
    return {
      name: 'Volume',
      status: 'warn',
      message: `${ratioStr}x average — below normal volume`,
      recommendation: 'Low volume may cause slippage; consider smaller size or limit orders',
    }
  }

  return {
    name: 'Volume',
    status: 'fail',
    message: `${ratioStr}x average (min 0.5x)`,
    recommendation: 'Volume too thin for reliable execution; wait for more activity',
  }
}
