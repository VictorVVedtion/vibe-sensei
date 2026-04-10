/**
 * PlaybookCardTool — Generates a trade plan card and sends it to the desktop UI.
 *
 * This tool does NOT execute trades. It:
 * 1. Runs PreTradeGate evaluation for the proposed trade
 * 2. Computes R:R ratio and portfolio percentage
 * 3. Emits a playbook_card bridge message to the desktop sidebar
 * 4. Returns confirmation text to the LLM
 *
 * The user can then review the card in the desktop sidebar and click EXECUTE
 * to trigger the trade through the full guardian pipeline.
 */

import { z } from 'zod/v4'
import { randomUUID } from 'crypto'
import { buildTool, type ToolDef } from '../../Tool.js'
import { evaluateGate } from '../PreTradeGateTool/gateEvaluator.js'
import type { GateInput, CheckResult, GateStatus } from '../PreTradeGateTool/types.js'
import { emitToDesktop } from '../../services/desktop/bridge.js'
import { getConnectedExchange } from '../../services/exchange/singleton.js'
import { totalPortfolioValue } from '../../buddy/checks/utils.js'

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
    .describe('Take-profit target price'),
  rationale: z
    .string()
    .optional()
    .describe('Guardian rationale or trade thesis explaining the setup'),
})

type InputSchema = typeof inputSchema
type Output = string

/** Compute risk:reward ratio from entry, stop, and target prices. */
function computeRiskReward(
  side: 'buy' | 'sell',
  entryPrice: number,
  stopPrice?: number,
  targetPrice?: number,
): { ratio: number; riskPct: number; rewardPct: number } | null {
  if (!stopPrice || !targetPrice || entryPrice <= 0) return null

  const risk = side === 'buy'
    ? entryPrice - stopPrice
    : stopPrice - entryPrice
  const reward = side === 'buy'
    ? targetPrice - entryPrice
    : entryPrice - targetPrice

  if (risk <= 0 || reward <= 0) return null

  return {
    ratio: reward / risk,
    riskPct: (risk / entryPrice) * 100,
    rewardPct: (reward / entryPrice) * 100,
  }
}

/** Map gate check status to a dot color for the desktop UI. */
function mapCheckToDot(check: CheckResult): 'green' | 'yellow' | 'red' {
  switch (check.status) {
    case 'pass': return 'green'
    case 'warn': return 'yellow'
    case 'fail': return 'red'
  }
}

export const PlaybookCardTool = buildTool({
  name: 'PlaybookCard',
  searchHint: 'create a trade plan card for the desktop sidebar without executing',
  maxResultSizeChars: 5_000,

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
    return 'Create a trade plan card (playbook) and send it to the desktop sidebar for user review. Does NOT execute the trade — the user clicks EXECUTE in the UI to confirm.'
  },

  async prompt() {
    return [
      'Create a playbook card — a visual trade plan sent to the desktop sidebar.',
      'The card shows: direction, symbol, entry/stop/target, R:R ratio, gate check results, and your rationale.',
      'This tool does NOT execute the trade. The user reviews the card and clicks EXECUTE to confirm.',
      'Use this instead of PlaceOrder when you want to propose a trade plan for user approval.',
      'Requires: symbol, side, type, quantity. Optional: price, stopPrice, targetPrice, rationale.',
    ].join('\n')
  },

  toAutoClassifierInput(input) {
    return `playbook ${input.side} ${input.quantity} ${input.symbol}`
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
    return `PlaybookCard: ${side} ${qty} ${sym}`
  },

  async call(input) {
    const cardId = randomUUID()

    // ── 1. Resolve entry price ────────────────────────────────────────────
    let entryPrice = input.price ?? 0
    if (entryPrice <= 0) {
      try {
        const exchange = await getConnectedExchange()
        const ticker = await exchange.getTicker(input.symbol)
        entryPrice = ticker.last > 0 ? ticker.last : ticker.ask
      } catch {
        // Fall through with 0 — gate checks will handle gracefully
      }
    }

    // ── 2. Run PreTradeGate evaluation ────────────────────────────────────
    const gateInput: GateInput = {
      symbol: input.symbol,
      side: input.side,
      type: input.type,
      quantity: input.quantity,
      price: entryPrice > 0 ? entryPrice : input.price,
      stopPrice: input.stopPrice,
      targetPrice: input.targetPrice,
    }

    let gateChecks: CheckResult[] = []
    let gateStatus: GateStatus = 'pass'
    try {
      const result = await evaluateGate(gateInput)
      gateChecks = result.checks
      gateStatus = result.status
    } catch {
      // Gate evaluation failure should not block card creation
      gateChecks = [{
        name: 'Gate Error',
        status: 'warn',
        message: 'Gate evaluation failed — proceed with caution',
      }]
      gateStatus = 'warn'
    }

    // ── 3. Compute R:R ratio ──────────────────────────────────────────────
    const rr = computeRiskReward(
      input.side,
      entryPrice,
      input.stopPrice,
      input.targetPrice,
    )

    // ── 4. Compute portfolio percentage ───────────────────────────────────
    let portfolioPct = 0
    try {
      const exchange = await getConnectedExchange()
      const balances = await exchange.getBalance()
      const equity = totalPortfolioValue(balances)
      if (equity > 0 && entryPrice > 0) {
        const positionValue = input.quantity * entryPrice
        portfolioPct = (positionValue / equity) * 100
      }
    } catch {
      // Portfolio calc failure is non-fatal
    }

    // ── 5. Build gate dots for UI ─────────────────────────────────────────
    const gateDots = gateChecks
      .filter(c => !c.name.startsWith('Circuit:') && c.name !== 'ATR Stop')
      .map(c => ({
        name: c.name,
        status: mapCheckToDot(c),
        message: c.message,
      }))

    // ── 6. Emit playbook_card bridge message ──────────────────────────────
    const cardData = {
      id: cardId,
      symbol: input.symbol,
      side: input.side,
      type: input.type,
      quantity: input.quantity,
      entryPrice,
      stopPrice: input.stopPrice ?? null,
      targetPrice: input.targetPrice ?? null,
      rationale: input.rationale ?? '',
      rrRatio: rr?.ratio ?? null,
      riskPct: rr?.riskPct ?? null,
      rewardPct: rr?.rewardPct ?? null,
      portfolioPct,
      gateStatus,
      gateDots,
      timestamp: Date.now(),
    }

    emitToDesktop('playbook_card', cardData)

    // ── 7. Return summary to LLM ─────────────────────────────────────────
    const lines: string[] = []
    lines.push(`Playbook card sent to desktop: ${input.side.toUpperCase()} ${input.quantity} ${input.symbol}`)
    if (entryPrice > 0) lines.push(`Entry: ${entryPrice.toFixed(2)}`)
    if (input.stopPrice) lines.push(`Stop: ${input.stopPrice.toFixed(2)}`)
    if (input.targetPrice) lines.push(`Target: ${input.targetPrice.toFixed(2)}`)
    if (rr) lines.push(`R:R = 1:${rr.ratio.toFixed(2)}`)
    if (portfolioPct > 0) lines.push(`Portfolio: ${portfolioPct.toFixed(1)}%`)
    lines.push(`Gate: ${gateStatus.toUpperCase()} (${gateDots.length} checks)`)
    lines.push('Card sent to desktop — awaiting user action.')

    return { data: lines.join('\n') }
  },
} satisfies ToolDef<InputSchema, Output>)
