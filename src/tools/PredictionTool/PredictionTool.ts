/**
 * PredictionTool — Place prediction market bets (YES/NO shares).
 * Finds prediction venue from VenueRegistry by vertical 'prediction'.
 * Supports both paper and live Polymarket execution.
 */

import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import type { PredictionInterface, PredictionOrder } from '../../services/exchange/types.js'
import { runPreTradeGate } from '../_shared/runPreTradeGate.js'

const inputSchema = z.strictObject({
  market: z.string().describe('Market search query or exact market ID'),
  outcome: z.enum(['YES', 'NO']).describe('Outcome to bet on'),
  amount: z.number().positive().describe('Amount in USDC to spend'),
  price: z
    .number()
    .min(0.01)
    .max(0.99)
    .optional()
    .describe('Limit price (probability 0.01-0.99). Omit for market price.'),
})

type InputSchema = typeof inputSchema
type Output = string

function formatOrder(order: PredictionOrder, question: string): string {
  return [
    `Prediction Order ${order.id}`,
    `  Market: ${question}`,
    `  Outcome: ${order.outcome}`,
    `  Shares: ${order.shares.toFixed(2)}`,
    `  Price: ${order.price.toFixed(4)}`,
    `  Status: ${order.status}`,
    `  Time: ${order.createdAt.toISOString()}`,
  ].join('\n')
}

async function resolvePredictionVenue(): Promise<PredictionInterface> {
  const { ensurePrediction } = await import('../../services/exchange/venue-bootstrap.js')
  return ensurePrediction()
}

async function findMarketByQuery(
  venue: PredictionInterface,
  query: string,
): Promise<{ id: string; question: string } | null> {
  const markets = await venue.getMarkets(query)
  if (markets.length === 0) return null
  // Prefer exact ID match, then first result
  const exact = markets.find(m => m.id === query)
  const best = exact ?? markets[0]!
  return { id: best.id, question: best.question }
}

export const PredictionTool = buildTool({
  name: 'PlacePrediction',
  searchHint: 'bet prediction market YES NO polymarket event outcome shares',
  maxResultSizeChars: 10_000,

  get inputSchema(): InputSchema {
    return inputSchema
  },

  isReadOnly() {
    return false
  },

  isDestructive() {
    return true
  },

  isConcurrencySafe() {
    return false
  },

  async description() {
    return 'Place a bet on a prediction market (YES/NO shares). Uses paper prediction by default.'
  },

  async prompt() {
    return [
      'Place a prediction market bet.',
      'Requires: market (search query or ID), outcome (YES/NO), amount (USDC).',
      'Optional: price (probability 0.01-0.99 for limit orders).',
      'Paper trading mode by default. Connects to Polymarket in live mode.',
    ].join('\n')
  },

  toAutoClassifierInput(input) {
    return `prediction ${input.outcome} ${input.market}`
  },

  mapToolResultToToolResultBlockParam(content, toolUseID) {
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: String(content),
    }
  },

  renderToolUseMessage(input) {
    return `PlacePrediction: ${input.outcome} on "${input.market}" ($${input.amount})`
  },

  async call(input) {
    // SECURITY: fail-closed pre-trade gate. See _shared/runPreTradeGate.ts.
    // Prediction markets have no native side/symbol — map to gate
    // vocabulary. Side YES → buy, NO → sell. Type=limit when explicit
    // probability set, market otherwise. Vertical-dispatcher routes to
    // prediction-specific checks (event diversification, expiry,
    // probability mispricing).
    const gate = await runPreTradeGate({
      symbol: input.market,
      side: input.outcome === 'YES' ? 'buy' : 'sell',
      type: input.price !== undefined ? 'limit' : 'market',
      quantity: input.amount,
      price: input.price,
    })
    if (!gate.allowed) {
      return { data: gate.formattedRejection }
    }

    try {
      const venue = await resolvePredictionVenue()
      const match = await findMarketByQuery(venue, input.market)

      if (!match) {
        return { data: `No markets found matching "${input.market}"` }
      }

      const order = await venue.placeBet(
        match.id,
        input.outcome,
        input.amount,
        input.price,
      )

      return { data: formatOrder(order, match.question) }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[PredictionTool] Error: ${msg}`)
      return { data: `Error placing prediction: ${msg}` }
    }
  },
} satisfies ToolDef<InputSchema, Output>)
