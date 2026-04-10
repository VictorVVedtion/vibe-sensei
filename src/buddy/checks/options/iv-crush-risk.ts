/**
 * IV Crush Risk Check — monitors implied volatility rank and event proximity.
 *
 * pass: IV rank < 60%
 * warn: 60-80% with event within 7 days
 * fail: > 80% with event within 3 days
 */

import type { OptionsCheckResult } from './types.js'

const WARN_IV_RANK = 60
const FAIL_IV_RANK = 80
const WARN_EVENT_DAYS = 7
const FAIL_EVENT_DAYS = 3

export function checkIvCrushRisk(
  ivRankPercent: number,
  daysToEvent: number,
  symbol: string,
): OptionsCheckResult {
  if (ivRankPercent > FAIL_IV_RANK && daysToEvent <= FAIL_EVENT_DAYS) {
    return {
      name: 'iv-crush-risk',
      severity: 'CRITICAL',
      message: `${symbol} IV rank ${ivRankPercent.toFixed(0)}% with event in ${daysToEvent} day(s) — extreme IV crush risk after event`,
      passed: false,
    }
  }

  if (ivRankPercent >= WARN_IV_RANK && daysToEvent <= WARN_EVENT_DAYS) {
    return {
      name: 'iv-crush-risk',
      severity: 'WARNING',
      message: `${symbol} IV rank ${ivRankPercent.toFixed(0)}% with event in ${daysToEvent} day(s) — elevated IV crush risk`,
      passed: false,
    }
  }

  return {
    name: 'iv-crush-risk',
    severity: 'INFO',
    message: `${symbol} IV rank ${ivRankPercent.toFixed(0)}% — IV crush risk is manageable`,
    passed: true,
  }
}
