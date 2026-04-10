/**
 * Carry Cost Check — warns when negative swap/carry rate exceeds $1/day/lot.
 * Uses VerticalContext.swapRate from the forex vertical context.
 *
 * A standard lot in forex = 100,000 units of base currency.
 * Negative swap means you pay to hold the position overnight.
 */

import type { VerticalContext } from '../../verticals.js'
import type { CheckResult, GateStatus } from '../../../tools/PreTradeGateTool/types.js'

/** Threshold: warn if negative swap cost exceeds $1/day/lot. */
const CARRY_COST_WARN_PER_LOT = 1.0

/** Threshold: fail if negative swap cost exceeds $5/day/lot. */
const CARRY_COST_FAIL_PER_LOT = 5.0

/** Units per standard lot in forex. */
const UNITS_PER_LOT = 100_000

/**
 * Calculate daily carry cost per lot from the swap rate.
 * SwapRate is expressed as daily cost per lot (standard convention).
 * Returns absolute cost (positive number) when rate is negative.
 */
export function calculateCarryCostPerLot(swapRate: number): number {
  return Math.abs(swapRate)
}

/**
 * Calculate total daily carry cost for a given position size.
 * @param swapRate - Daily swap rate per lot (negative = you pay)
 * @param quantity - Position size in units
 */
export function calculateTotalCarryCost(
  swapRate: number,
  quantity: number,
): number {
  if (swapRate >= 0) return 0 // Positive carry = you earn, no cost
  const lots = quantity / UNITS_PER_LOT
  return Math.abs(swapRate) * lots
}

/**
 * Pre-trade gate check: warn on excessive carry/swap costs.
 */
export function checkCarryCost(
  quantity: number,
  verticalContext?: VerticalContext,
): CheckResult {
  if (!verticalContext || verticalContext.swapRate === undefined) {
    return {
      name: 'Carry Cost',
      status: 'pass' as GateStatus,
      message: 'Swap rate data not available — check skipped',
    }
  }

  const swapRate = verticalContext.swapRate

  // Positive swap = you earn carry, no concern
  if (swapRate >= 0) {
    return {
      name: 'Carry Cost',
      status: 'pass' as GateStatus,
      message: `Positive carry: +$${swapRate.toFixed(2)}/day/lot`,
    }
  }

  const costPerLot = calculateCarryCostPerLot(swapRate)
  const totalCost = calculateTotalCarryCost(swapRate, quantity)

  if (costPerLot > CARRY_COST_FAIL_PER_LOT) {
    return {
      name: 'Carry Cost',
      status: 'fail' as GateStatus,
      message: `High negative swap: -$${costPerLot.toFixed(2)}/day/lot (total -$${totalCost.toFixed(2)}/day)`,
      recommendation: 'Consider shorter hold period or opposite carry direction',
    }
  }

  if (costPerLot > CARRY_COST_WARN_PER_LOT) {
    return {
      name: 'Carry Cost',
      status: 'warn' as GateStatus,
      message: `Negative swap: -$${costPerLot.toFixed(2)}/day/lot (total -$${totalCost.toFixed(2)}/day)`,
      recommendation: 'Factor carry cost into profit target',
    }
  }

  return {
    name: 'Carry Cost',
    status: 'pass' as GateStatus,
    message: `Swap cost within limits: -$${costPerLot.toFixed(2)}/day/lot`,
  }
}
