/**
 * Max Loss Check — monitors maximum loss relative to portfolio.
 *
 * pass: maxLoss < 3% of portfolio
 * warn: 3-5% of portfolio
 * fail: > 5% of portfolio or undefined max loss (naked shorts)
 */

import type { OptionsCheckResult } from './types.js'

const PASS_PERCENT = 3
const FAIL_PERCENT = 5

export function checkMaxLoss(
  maxLossPercent: number | null,
  portfolioValue: number,
  symbol: string,
): OptionsCheckResult {
  // Undefined max loss means naked/uncovered position
  if (maxLossPercent === null) {
    return {
      name: 'max-loss-check',
      severity: 'CRITICAL',
      message: `${symbol} has undefined max loss (naked/uncovered short) — unlimited risk exposure`,
      passed: false,
    }
  }

  if (portfolioValue <= 0) {
    return {
      name: 'max-loss-check',
      severity: 'WARNING',
      message: `Cannot compute max loss ratio — portfolio value is zero or negative`,
      passed: false,
    }
  }

  if (maxLossPercent > FAIL_PERCENT) {
    return {
      name: 'max-loss-check',
      severity: 'CRITICAL',
      message: `${symbol} max loss is ${maxLossPercent.toFixed(1)}% of portfolio (>${FAIL_PERCENT}%) — excessive risk per position`,
      passed: false,
    }
  }

  if (maxLossPercent >= PASS_PERCENT) {
    return {
      name: 'max-loss-check',
      severity: 'WARNING',
      message: `${symbol} max loss is ${maxLossPercent.toFixed(1)}% of portfolio — approaching risk limit`,
      passed: false,
    }
  }

  return {
    name: 'max-loss-check',
    severity: 'INFO',
    message: `${symbol} max loss ${maxLossPercent.toFixed(1)}% of portfolio — within safe range`,
    passed: true,
  }
}
