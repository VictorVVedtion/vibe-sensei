/**
 * Greeks Exposure Check — monitors portfolio net delta exposure.
 *
 * pass: |netDelta| < 0.8
 * warn: 0.8 <= |netDelta| <= 1.5
 * fail: |netDelta| > 1.5
 */

import type { OptionsCheckResult } from './types.js'

const PASS_THRESHOLD = 0.8
const FAIL_THRESHOLD = 1.5

export function checkGreeksExposure(netDelta: number): OptionsCheckResult {
  const absDelta = Math.abs(netDelta)

  if (absDelta > FAIL_THRESHOLD) {
    return {
      name: 'greeks-exposure',
      severity: 'CRITICAL',
      message: `Net delta ${netDelta.toFixed(4)} exceeds safe range (|delta| > ${FAIL_THRESHOLD}) — portfolio is dangerously directional`,
      passed: false,
    }
  }

  if (absDelta >= PASS_THRESHOLD) {
    return {
      name: 'greeks-exposure',
      severity: 'WARNING',
      message: `Net delta ${netDelta.toFixed(4)} is elevated (|delta| >= ${PASS_THRESHOLD}) — consider hedging directional exposure`,
      passed: false,
    }
  }

  return {
    name: 'greeks-exposure',
    severity: 'INFO',
    message: `Net delta ${netDelta.toFixed(4)} within safe range`,
    passed: true,
  }
}
