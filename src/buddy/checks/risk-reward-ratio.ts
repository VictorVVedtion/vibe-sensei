/**
 * Risk/Reward Ratio gate check — validates that reward justifies the risk.
 * R:R = |targetPrice - entryPrice| / |entryPrice - stopPrice|
 * pass: >= 1.5 | warn: 1.0-1.5 | fail: < 1.0
 * If stop or target is missing: pass (cannot calculate, don't penalize).
 */

import type { CheckResult, GateInput } from '../../tools/PreTradeGateTool/types.js'

const PASS_RATIO = 1.5
const WARN_RATIO = 1.0

export function checkRiskRewardRatio(
  input: GateInput,
  entryPrice: number,
): CheckResult {
  if (
    input.stopPrice === undefined ||
    input.targetPrice === undefined ||
    input.stopPrice <= 0 ||
    input.targetPrice <= 0
  ) {
    return {
      name: 'R:R Ratio',
      status: 'pass',
      message: 'N/A (no target or stop defined)',
    }
  }

  const risk = Math.abs(entryPrice - input.stopPrice)
  if (risk === 0) {
    return {
      name: 'R:R Ratio',
      status: 'warn',
      message: 'stop price equals entry price',
      recommendation: 'Set a meaningful stop-loss distance',
    }
  }

  const reward = Math.abs(input.targetPrice - entryPrice)
  const ratio = reward / risk
  const ratioStr = ratio.toFixed(2)

  if (ratio >= PASS_RATIO) {
    return {
      name: 'R:R Ratio',
      status: 'pass',
      message: `${ratioStr}:1`,
    }
  }

  if (ratio >= WARN_RATIO) {
    return {
      name: 'R:R Ratio',
      status: 'warn',
      message: `${ratioStr}:1 — below ideal 1.5:1`,
      recommendation: 'Widen target or tighten stop for better reward-to-risk',
    }
  }

  return {
    name: 'R:R Ratio',
    status: 'fail',
    message: `${ratioStr}:1 — risk exceeds reward`,
    recommendation: 'Risk outweighs potential reward; adjust target or stop',
  }
}
