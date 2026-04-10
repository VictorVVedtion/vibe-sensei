/**
 * Vertical dispatcher for prediction market risk checks.
 * Routes prediction-vertical positions through event-diversification,
 * probability-mispricing, and event-expiry checks.
 */

import type { PredictionMarket, PredictionPosition } from '../../../services/exchange/types.js'
import type { RiskAlert } from '../../guardian.js'
import {
  checkEventDiversification,
  predictionPortfolioValue,
} from './event-diversification.js'
import { checkProbabilityMispricing } from './probability-mispricing.js'
import { checkEventExpiry } from './event-expiry.js'

export interface PredictionCheckInput {
  positions: PredictionPosition[]
  markets: PredictionMarket[]
  masterId: string
  masterName: string
  masterQuote: string
}

/**
 * Run all prediction-vertical risk checks and return the highest-severity alert.
 * Returns null when all checks pass.
 */
export function runPredictionChecks(
  input: PredictionCheckInput,
): RiskAlert | null {
  const totalValue = predictionPortfolioValue(input.positions)

  const diversificationAlert = checkEventDiversification({
    positions: input.positions,
    totalPredictionValue: totalValue,
    masterId: input.masterId,
    masterName: input.masterName,
    masterQuote: input.masterQuote,
  })

  const mispricingAlert = checkProbabilityMispricing({
    positions: input.positions,
    masterId: input.masterId,
    masterName: input.masterName,
    masterQuote: input.masterQuote,
  })

  const expiryAlert = checkEventExpiry({
    positions: input.positions,
    markets: input.markets,
    masterId: input.masterId,
    masterName: input.masterName,
    masterQuote: input.masterQuote,
  })

  // Return highest severity alert (CRITICAL > WARNING > null)
  const SEVERITY_RANK: Record<string, number> = {
    EMERGENCY: 3,
    CRITICAL: 2,
    WARNING: 1,
    INFO: 0,
  }

  const alerts = [diversificationAlert, mispricingAlert, expiryAlert]
    .filter((a): a is RiskAlert => a !== null)
    .sort((a, b) => (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0))

  return alerts[0] ?? null
}
