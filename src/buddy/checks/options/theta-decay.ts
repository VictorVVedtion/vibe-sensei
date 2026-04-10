/**
 * Theta Decay Check — monitors days to expiry for bought options.
 *
 * pass: DTE > 14
 * warn: 3 < DTE <= 14
 * fail: DTE <= 3
 */

import type { OptionsCheckResult } from './types.js'

const PASS_DTE = 14
const FAIL_DTE = 3

export function checkThetaDecay(
  daysToExpiry: number,
  symbol: string,
): OptionsCheckResult {
  if (daysToExpiry <= FAIL_DTE) {
    return {
      name: 'theta-decay',
      severity: 'CRITICAL',
      message: `${symbol} expires in ${daysToExpiry} day(s) — theta decay is accelerating rapidly, close or roll`,
      passed: false,
    }
  }

  if (daysToExpiry <= PASS_DTE) {
    return {
      name: 'theta-decay',
      severity: 'WARNING',
      message: `${symbol} expires in ${daysToExpiry} day(s) — entering theta decay zone, consider rolling out`,
      passed: false,
    }
  }

  return {
    name: 'theta-decay',
    severity: 'INFO',
    message: `${symbol} has ${daysToExpiry} days to expiry — safe from accelerated decay`,
    passed: true,
  }
}
