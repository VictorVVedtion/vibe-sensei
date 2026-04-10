/**
 * Central Bank Event Check — warns when trading near major CB events.
 * Uses VerticalContext.centralBankEventDays to assess proximity risk.
 *
 * CB events (rate decisions, minutes, press conferences) create
 * extreme volatility spikes that can blow through stop-losses.
 */

import type { VerticalContext } from '../../verticals.js'
import type { CheckResult, GateStatus } from '../../../tools/PreTradeGateTool/types.js'

/** Days thresholds for event proximity. */
const FAIL_DAYS = 2
const WARN_DAYS = 7

/**
 * Evaluate central bank event proximity risk.
 * @param daysToEvent - Days until next major CB event (undefined = unknown)
 * @returns Risk assessment: pass (>7d), warn (2-7d), fail (<2d)
 */
export function evaluateEventRisk(
  daysToEvent: number | undefined,
): { status: GateStatus; daysToEvent: number | undefined } {
  if (daysToEvent === undefined) {
    return { status: 'pass', daysToEvent: undefined }
  }

  if (daysToEvent < FAIL_DAYS) {
    return { status: 'fail', daysToEvent }
  }

  if (daysToEvent <= WARN_DAYS) {
    return { status: 'warn', daysToEvent }
  }

  return { status: 'pass', daysToEvent }
}

/**
 * Pre-trade gate check: central bank event proximity.
 */
export function checkCentralBankEvent(
  symbol: string,
  verticalContext?: VerticalContext,
): CheckResult {
  if (!verticalContext || verticalContext.centralBankEventDays === undefined) {
    return {
      name: 'CB Event',
      status: 'pass' as GateStatus,
      message: 'No central bank event data available — check skipped',
    }
  }

  const { status, daysToEvent } = evaluateEventRisk(
    verticalContext.centralBankEventDays,
  )

  if (status === 'fail') {
    return {
      name: 'CB Event',
      status: 'fail',
      message: `Major CB event in ${daysToEvent} day(s) for ${symbol} — extreme volatility risk`,
      recommendation: 'Wait until after the event or use very tight position size',
    }
  }

  if (status === 'warn') {
    return {
      name: 'CB Event',
      status: 'warn',
      message: `CB event in ${daysToEvent} day(s) for ${symbol} — elevated volatility expected`,
      recommendation: 'Reduce position size and widen stops for event risk',
    }
  }

  return {
    name: 'CB Event',
    status: 'pass',
    message: daysToEvent !== undefined
      ? `Next CB event in ${daysToEvent} day(s) — safe window`
      : 'No imminent CB events detected',
  }
}
