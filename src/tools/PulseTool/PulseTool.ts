/**
 * PulseTool — 30-day cross-source sentiment brief for a trading symbol.
 *
 * Pulls Reddit / Hacker News / Polymarket / YouTube in parallel via the
 * sentiment aggregator, then synthesizes a master-voice narrative. The
 * narrative is cached so PreTradeGateTool can pick up the plain-text version
 * for debate stance injection without re-running anything.
 *
 * Inspired by github.com/mvanhorn/last30days-skill but trading-focused and
 * tied into vibe-sensei's existing guardian/debate stack.
 */

import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { gatherSentiment } from '../../services/sentiment/aggregator.js'
import { synthesizeBrief } from '../../services/sentiment/synthesize.js'
import { getCompanion } from '../../buddy/companion.js'
import type { Master } from '../../buddy/types.js'

const inputSchema = z.strictObject({
  symbol: z.string().min(1).describe('Trading symbol or ticker (e.g. BTC, BTC/USDT, TSLA, SPY)'),
  lookbackDays: z.number().int().positive().max(90).optional().describe('How many days of history to scan. Default 30.'),
})

type InputSchema = typeof inputSchema
type Output = string

const FALLBACK_MASTER: Master = 'warren_buffett'

export const PulseTool = buildTool({
  name: 'pulse',
  searchHint: 'social sentiment reddit hackernews polymarket youtube last 30 days',
  maxResultSizeChars: 50_000,

  get inputSchema(): InputSchema {
    return inputSchema
  },

  isReadOnly() {
    return true
  },

  isConcurrencySafe() {
    return true
  },

  async description() {
    return 'Fetch the last 30 days of cross-source sentiment (Reddit, Hacker News, Polymarket, YouTube) for a trading symbol and synthesize a master-voice brief.'
  },

  async prompt() {
    return [
      'Fetch a multi-source sentiment brief for a trading symbol.',
      'Pulls the last 30 days from Reddit, Hacker News, Polymarket, and YouTube in parallel.',
      'Synthesizes a narrative in the user\'s assigned guardian master voice.',
      '',
      'When to call:',
      '- The user explicitly asks "what\'s the vibe", "any chatter", "anyone talking about X", "social pulse".',
      '- Before suggesting any trade exceeding 3% of portfolio (gives the debate engine context).',
      '- When the user asks about a symbol they have not mentioned in this session.',
      '',
      'Inputs:',
      '- symbol: required. Examples: BTC, BTC/USDT, TSLA, SPY, ETH/USD',
      '- lookbackDays: optional, defaults to 30, max 90.',
      '',
      'Output: a sectioned text brief with one block per source, a composite signal,',
      'and an opening + closing line in the assigned master\'s voice.',
      '',
      'The brief is cached for 15 minutes so back-to-back calls are instant.',
    ].join('\n')
  },

  toAutoClassifierInput(input) {
    return `pulse ${input.symbol}`
  },

  mapToolResultToToolResultBlockParam(content, toolUseID) {
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: String(content),
    }
  },

  renderToolUseMessage(input) {
    const sym = input?.symbol ?? '?'
    return `pulse ${sym}`
  },

  getActivityDescription(input) {
    const sym = input?.symbol ?? 'symbol'
    return `Reading the vibe on ${sym}`
  },

  async call(input) {
    try {
      const symbol = input.symbol.trim().toUpperCase()
      const lookbackDays = input.lookbackDays ?? 30

      const brief = await gatherSentiment(symbol, { lookbackDays })

      const companion = getCompanion()
      const master = (companion?.species as Master | undefined) ?? FALLBACK_MASTER
      synthesizeBrief(brief, { master })

      return { data: brief.narrative }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[PulseTool] Error: ${msg}`)
      return { data: `Pulse error: ${msg}` }
    }
  },
} satisfies ToolDef<InputSchema, Output>)
