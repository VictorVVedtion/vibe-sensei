/**
 * Revenge Trade gate check — detects trading too quickly after a loss.
 * Reads the guardian diary for recent loss entries.
 * pass: no recent loss | warn: 5-15 min since loss | fail: < 2 min since loss
 */

import { GuardianDiary } from '../diary.js'
import type { CheckResult } from '../../tools/PreTradeGateTool/types.js'

const FAIL_WINDOW_MS = 2 * 60 * 1000      // 2 minutes
const WARN_WINDOW_MS = 15 * 60 * 1000     // 15 minutes

export function checkRevengeTrade(): CheckResult {
  let diary: GuardianDiary
  try {
    diary = new GuardianDiary()
  } catch {
    return {
      name: 'Revenge',
      status: 'pass',
      message: 'no trade diary available',
    }
  }

  const recent = diary.getRecentEntries(20)
  const now = Date.now()

  const recentLoss = recent.find(e => e.outcome === 'loss')
  if (!recentLoss) {
    return {
      name: 'Revenge',
      status: 'pass',
      message: 'no recent loss',
    }
  }

  const msSinceLoss = now - recentLoss.timestamp.getTime()
  const minsSinceLoss = Math.round(msSinceLoss / 60_000)

  if (msSinceLoss < FAIL_WINDOW_MS) {
    return {
      name: 'Revenge',
      status: 'fail',
      message: `loss ${minsSinceLoss}min ago — likely revenge trade`,
      recommendation: 'Wait at least 15 minutes after a loss before trading again',
    }
  }

  if (msSinceLoss < WARN_WINDOW_MS) {
    return {
      name: 'Revenge',
      status: 'warn',
      message: `loss ${minsSinceLoss}min ago — cool down period`,
      recommendation: 'Recent loss detected; trade with extra caution',
    }
  }

  return {
    name: 'Revenge',
    status: 'pass',
    message: 'no recent loss',
  }
}
