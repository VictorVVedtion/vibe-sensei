/**
 * PreTradeGateTool — 9 pre-flight risk checks before placing an order.
 * Independent tool: does not modify OrderTool.
 * Returns structured text results for the LLM to decide whether to proceed.
 */

import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { evaluateGate, formatGateResult } from './gateEvaluator.js'
import type { GateInput } from './types.js'

const inputSchema = z.strictObject({
  symbol: z.string().describe('Trading pair symbol, e.g. "BTC/USDT"'),
  side: z.enum(['buy', 'sell']).describe('Order side'),
  type: z
    .enum(['market', 'limit', 'stop_loss'])
    .describe('Order type'),
  quantity: z.number().positive().describe('Order quantity'),
  price: z
    .number()
    .positive()
    .optional()
    .describe('Entry price (required for limit orders, derived from market for market orders)'),
  stopPrice: z
    .number()
    .positive()
    .optional()
    .describe('Stop-loss price for risk calculation'),
  targetPrice: z
    .number()
    .positive()
    .optional()
    .describe('Target price for risk/reward ratio calculation'),
  acceptWarnings: z
    .boolean()
    .optional()
    .describe('If true, warnings are noted but do not flag the trade'),
})

type InputSchema = typeof inputSchema
type Output = string

export const PreTradeGateTool = buildTool({
  name: 'PreTradeGate',
  searchHint: 'pre-trade risk check gate validation before order',
  maxResultSizeChars: 10_000,

  get inputSchema(): InputSchema {
    return inputSchema
  },

  isReadOnly() {
    return true
  },

  isDestructive() {
    return false
  },

  isConcurrencySafe() {
    return true
  },

  async description() {
    return 'Run 9 pre-trade risk checks (portfolio heat, position risk, concentration, regime, volume, stop-loss, R:R ratio, revenge trade, daily loss) before placing an order.'
  },

  async prompt() {
    return [
      'Run pre-trade risk gate checks before placing an order.',
      'Call this BEFORE PlaceOrder to validate the trade against 9 risk dimensions.',
      'Returns PASS/WARN/FAIL for each check with actionable recommendations.',
      'The gate result is advisory — use your judgment on whether to proceed.',
      'If all checks pass, proceed with PlaceOrder. If any fail, consider adjustments.',
    ].join('\n')
  },

  toAutoClassifierInput(input) {
    return `gate ${input.side} ${input.quantity} ${input.symbol}`
  },

  mapToolResultToToolResultBlockParam(content, toolUseID) {
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: String(content),
    }
  },

  renderToolUseMessage(input) {
    const side = input.side?.toUpperCase() ?? '?'
    const qty = input.quantity ?? '?'
    const sym = input.symbol ?? '?'
    return `PreTradeGate: ${side} ${qty} ${sym}`
  },

  async call(input) {
    const gateInput: GateInput = {
      symbol: input.symbol,
      side: input.side,
      type: input.type,
      quantity: input.quantity,
      price: input.price,
      stopPrice: input.stopPrice,
      targetPrice: input.targetPrice,
    }

    try {
      const result = await evaluateGate(gateInput)

      // If acceptWarnings is set, downgrade warnings to pass in the summary
      if (input.acceptWarnings && result.status === 'warn') {
        result.status = 'pass'
        result.summary = 'Warnings accepted — proceeding'
      }

      let output = formatGateResult(gateInput, result)

      // Trigger guardian debate for large orders (>5% portfolio)
      try {
        const { shouldTriggerDebate, selectContrarian, formatDebateOutput } = await import('../../buddy/debate.js')
        const { getCompanion } = await import('../../buddy/companion.js')
        const { getConnectedExchange } = await import('../../services/exchange/singleton.js')
        const { getMasterArchetype } = await import('../../buddy/persona.js')
        const { getBriefPlainText } = await import('../../services/sentiment/cache.js')

        const companion = getCompanion()
        if (companion) {
          const exchange = await getConnectedExchange()
          const balances = await exchange.getBalance()
          const positions = await exchange.getPositions()
          const master = companion.species as import('../../buddy/types.js').Master

          const shouldDebate = shouldTriggerDebate(
            { symbol: input.symbol, side: input.side, type: input.type, quantity: input.quantity, price: input.price },
            positions, balances, input.price,
          )
          if (shouldDebate) {
            const contrarian = selectContrarian(master)
            const masterArchetype = getMasterArchetype(master)
            const contrarianArchetype = getMasterArchetype(contrarian)

            // If a fresh /pulse brief exists for this symbol (15min TTL), splice
            // the one-line sentiment summary into both stances. The cache key
            // normalizes case, so BTC and BTC/USDT both hit BTC.
            const sentimentBase = (input.symbol.split('/')[0] ?? input.symbol).toUpperCase()
            const sentimentLine = getBriefPlainText(sentimentBase)
            const sentimentSuffix = sentimentLine ? ` Sentiment context: ${sentimentLine}` : ''

            // Template-based stances — no LLM call, zero latency
            const forArg = `As a ${masterArchetype.replace(/_/g, ' ')}, this trade aligns with my philosophy. The risk-reward is defined, the stop is set. Conviction with discipline.${sentimentSuffix}`
            const againstArg = `As a ${contrarianArchetype.replace(/_/g, ' ')}, I see concentration risk. Volatility may work against you. Consider sizing down or waiting for a better entry.${sentimentSuffix}`

            const orderDesc = `${input.side.toUpperCase()} ${input.quantity} ${input.symbol}`
            output += '\n\n' + formatDebateOutput(master, forArg, contrarian, againstArg, orderDesc)
          }
        }
      } catch {
        // Debate must never block the gate result
      }

      return { data: output }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      return { data: `Pre-trade gate error: ${msg}` }
    }
  },
} satisfies ToolDef<InputSchema, Output>)
