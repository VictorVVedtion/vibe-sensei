/**
 * PDT (Pattern Day Trader) compliance check for stock trading.
 * Tracks day trades and warns before triggering PDT restriction.
 *
 * PDT rule: 4+ day trades in a rolling 5-day period on accounts < $25k
 * triggers a 90-day restriction. We warn conservatively:
 *   pass:  0-1 day trades
 *   warn:  2 day trades
 *   fail:  3 day trades (next would trigger PDT)
 */

import type { VerticalContext } from '../../verticals.js'
import type { CheckResult } from '../../../tools/PreTradeGateTool/types.js'

// Module-level day trade counter — resets daily.
let dayTradeCount = 0
let lastResetDate = ''

/** Increment the day trade counter. Called externally after each round-trip. */
export function recordDayTrade(): void {
  resetIfNewDay()
  dayTradeCount++
}

/** Get the current day trade count. */
export function getDayTradeCount(): number {
  resetIfNewDay()
  return dayTradeCount
}

/** Reset counter for testing. */
export function resetDayTradeCounter(): void {
  dayTradeCount = 0
  lastResetDate = ''
}

function resetIfNewDay(): void {
  const today = new Date().toISOString().slice(0, 10)
  if (today !== lastResetDate) {
    dayTradeCount = 0
    lastResetDate = today
  }
}

export function checkPdtCompliance(ctx: VerticalContext): CheckResult {
  resetIfNewDay()
  const count = ctx.dayTradeCount ?? dayTradeCount

  if (count <= 1) {
    return {
      name: 'Stocks: PDT Compliance',
      status: 'pass',
      message: `${count} day trade(s) today — within safe range`,
    }
  }

  if (count === 2) {
    return {
      name: 'Stocks: PDT Compliance',
      status: 'warn',
      message: `${count} day trades today — approaching PDT limit`,
      recommendation: 'Accounts under $25k are restricted after 4 day trades in 5 days. Limit round-trips.',
    }
  }

  // count >= 3
  return {
    name: 'Stocks: PDT Compliance',
    status: 'fail',
    message: `${count} day trades today — one more triggers PDT restriction`,
    recommendation: 'STOP day trading. Next round-trip will flag your account for Pattern Day Trading (90-day restriction for <$25k accounts).',
  }
}
