/**
 * Vertical-specific context for guardian risk evaluation.
 *
 * Each trading vertical carries unique risk dimensions the guardian
 * system needs to assess. This context is passed alongside standard
 * trade parameters so guardians can give vertical-aware advice.
 */

import type { TradingVertical, Greeks, Position, PredictionPosition, PredictionMarket } from '../services/exchange/types.js'

export interface VerticalContext {
  vertical: TradingVertical

  // ── Common ───────────────────────────────────────────────────────────────
  symbol?: string
  quantity?: number
  tradeValueUSD?: number

  // ── Futures ───────────────────────────────────────────────────────────────
  leverage?: number
  liquidationPrice?: number
  fundingRate?: number
  marginUtilization?: number

  // ── Options ───────────────────────────────────────────────────────────────
  greeks?: Greeks
  iv?: number
  daysToExpiry?: number
  strikePrice?: number
  optionType?: 'call' | 'put'

  // ── Stocks ────────────────────────────────────────────────────────────────
  dayTradeCount?: number
  isMarketHours?: boolean
  daysToEarnings?: number

  // ── DeFi ──────────────────────────────────────────────────────────────────
  estimatedSlippage?: number
  gasEstimateUSD?: number
  isContractAudited?: boolean
  mevRisk?: 'low' | 'medium' | 'high'

  // ── Prediction ────────────────────────────────────────────────────────────
  eventExpiry?: Date
  impliedProbability?: number
  eventCorrelationCount?: number
  predictionPositions?: PredictionPosition[]
  predictionMarkets?: PredictionMarket[]

  // ── Forex ─────────────────────────────────────────────────────────────────
  currencyCorrelation?: number
  swapRate?: number
  centralBankEventDays?: number
  forexPositions?: Position[]
}
