/**
 * Pre-Trade Gate type definitions.
 * Shared by all 9 risk gate checks and the gate evaluator.
 */

export type GateStatus = 'pass' | 'warn' | 'fail'

export interface CheckResult {
  name: string
  status: GateStatus
  message: string
  recommendation?: string
}

export interface RiskGateResult {
  status: GateStatus
  checks: CheckResult[]
  summary: string
  recommendation?: string
}

/** Input parameters forwarded to each individual gate check. */
export interface GateInput {
  symbol: string
  side: 'buy' | 'sell'
  type: 'market' | 'limit' | 'stop_loss'
  quantity: number
  price?: number
  stopPrice?: number
  targetPrice?: number
}
