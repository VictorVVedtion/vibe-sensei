/**
 * Forex vertical check dispatcher — runs all forex-specific risk checks.
 */

import type { Position } from '../../../services/exchange/types.js'
import type { VerticalContext } from '../../verticals.js'
import type { CheckResult } from '../../../tools/PreTradeGateTool/types.js'
import { checkCorrelation } from './correlation-check.js'
import { checkCarryCost } from './carry-cost.js'
import { checkCentralBankEvent } from './central-bank-event.js'

export interface ForexCheckInput {
  symbol: string
  quantity: number
  positions: Position[]
  verticalContext?: VerticalContext
}

/**
 * Run all 3 forex-specific risk checks and return results.
 */
export function runForexChecks(input: ForexCheckInput): CheckResult[] {
  return [
    checkCorrelation(input.symbol, input.positions),
    checkCarryCost(input.quantity, input.verticalContext),
    checkCentralBankEvent(input.symbol, input.verticalContext),
  ]
}
