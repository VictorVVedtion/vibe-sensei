import type { VerticalContext } from '../../verticals.js'
import type { CheckResult } from '../../../tools/PreTradeGateTool/types.js'
import { checkPdtCompliance } from './pdt-compliance.js'
import { checkMarketHours } from './market-hours.js'
import { checkEarningsProximity } from './earnings-proximity.js'

export function runStockChecks(ctx: VerticalContext): CheckResult[] {
  return [
    checkPdtCompliance(ctx),
    checkMarketHours(ctx),
    checkEarningsProximity(ctx),
  ]
}

export { checkPdtCompliance, checkMarketHours, checkEarningsProximity }
