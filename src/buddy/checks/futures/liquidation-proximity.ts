/**
 * Liquidation Proximity check for perpetual futures.
 * Measures distance from current price to liquidation price as a percentage.
 *
 * Thresholds:
 *   pass:      distance > 15%
 *   warn:      5% < distance <= 15%
 *   fail:      2% < distance <= 5%
 *   emergency: distance <= 2%
 */

import type { VerticalContext } from '../../verticals.js'
import type { CheckResult } from '../../../tools/PreTradeGateTool/types.js'

const PASS_MIN = 15
const WARN_MIN = 5
const FAIL_MIN = 2

export function checkLiquidationProximity(
  ctx: VerticalContext,
  currentPrice: number,
): CheckResult {
  const liquidationPrice = ctx.liquidationPrice

  if (
    liquidationPrice === undefined ||
    liquidationPrice <= 0 ||
    currentPrice <= 0
  ) {
    return {
      name: 'Futures: Liquidation',
      status: 'pass',
      message: 'No liquidation price available — skipping check',
    }
  }

  const distance =
    (Math.abs(currentPrice - liquidationPrice) / currentPrice) * 100
  const pct = distance.toFixed(1)

  if (distance > PASS_MIN) {
    return {
      name: 'Futures: Liquidation',
      status: 'pass',
      message: `${pct}% from liquidation (safe above ${PASS_MIN}%)`,
    }
  }

  if (distance > WARN_MIN) {
    return {
      name: 'Futures: Liquidation',
      status: 'warn',
      message: `${pct}% from liquidation — getting close (safe above ${PASS_MIN}%)`,
      recommendation: 'Add margin or reduce position size to increase liquidation distance',
    }
  }

  if (distance > FAIL_MIN) {
    return {
      name: 'Futures: Liquidation',
      status: 'fail',
      message: `${pct}% from liquidation — critical proximity`,
      recommendation: 'Reduce position or add margin immediately to avoid liquidation',
    }
  }

  return {
    name: 'Futures: Liquidation',
    status: 'emergency',
    message: `EMERGENCY: ${pct}% from liquidation — wipeout imminent`,
    recommendation: 'Close position or add margin NOW. Liquidation is seconds away.',
  }
}
