/**
 * BridgeTool — Cross-chain bridge quote via deBridge.
 *
 * Advisory only: shows quote with fee breakdown and estimated time.
 * Does NOT execute the transfer. Supports Ethereum, Polygon, BSC,
 * Avalanche, Arbitrum, Optimism, and Solana.
 */

import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import type { BridgeQuote } from '../../services/bridge/bridge-client.js'

const inputSchema = z.strictObject({
  fromChain: z
    .string()
    .describe(
      'Source chain name (ethereum, polygon, bsc, avalanche, arbitrum, optimism, solana)',
    ),
  toChain: z
    .string()
    .describe(
      'Destination chain name (ethereum, polygon, bsc, avalanche, arbitrum, optimism, solana)',
    ),
  fromToken: z
    .string()
    .describe(
      'Source token symbol or address (e.g. "ETH", "USDC", or contract address)',
    ),
  toToken: z
    .string()
    .describe(
      'Destination token symbol or address (e.g. "USDC", "SOL", or contract address)',
    ),
  amount: z
    .number()
    .positive()
    .describe('Amount of source token to bridge'),
})

type InputSchema = typeof inputSchema
type Output = string

function formatQuote(quote: BridgeQuote): string {
  const divider = '─'.repeat(48)
  return [
    `Cross-Chain Bridge Quote`,
    divider,
    `  Route:    ${quote.srcChain} → ${quote.dstChain}`,
    `  Send:     ${quote.srcAmount} ${quote.srcToken}`,
    `  Receive:  ${quote.dstAmount} ${quote.dstToken}`,
    divider,
    `  Fees`,
    `    Protocol:  ${quote.fees.protocolFee}`,
    `    Execution: ${quote.fees.executionFee}`,
    `    Est. Total: ${quote.fees.totalFeeUSD}`,
    divider,
    `  Est. Time: ${quote.estimatedTime}`,
    `  Provider:  deBridge (DLN)`,
    divider,
    `  ⚠ Advisory only — quote not executed.`,
  ].join('\n')
}

function formatError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  return `Bridge quote failed: ${msg}`
}

export const BridgeTool = buildTool({
  name: 'GetBridgeQuote',
  searchHint: 'cross-chain bridge transfer quote deBridge multi-chain',
  maxResultSizeChars: 10_000,

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
    return 'Get a cross-chain bridge quote via deBridge. Shows fees, estimated time, and receive amount. Advisory only — does not execute the transfer.'
  },

  async prompt() {
    return [
      'Get a cross-chain bridge quote using deBridge.',
      'Requires: fromChain, toChain, fromToken, toToken, amount.',
      'Supported chains: Ethereum, Polygon, BSC, Avalanche, Arbitrum, Optimism, Solana.',
      'Common tokens: native tokens (ETH, SOL, BNB, MATIC, AVAX), USDC, USDT.',
      'For other tokens, provide the contract address directly.',
      'This tool only fetches a quote — it does NOT execute the bridge transfer.',
    ].join('\n')
  },

  toAutoClassifierInput(input) {
    return `bridge ${input.amount} ${input.fromToken} ${input.fromChain} to ${input.toToken} ${input.toChain}`
  },

  mapToolResultToToolResultBlockParam(content, toolUseID) {
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: String(content),
    }
  },

  renderToolUseMessage(input) {
    const amt = input.amount ?? '?'
    const from = input.fromToken ?? '?'
    const src = input.fromChain ?? '?'
    const to = input.toToken ?? '?'
    const dst = input.toChain ?? '?'
    return `GetBridgeQuote: ${amt} ${from} (${src}) → ${to} (${dst})`
  },

  async call(input) {
    try {
      const { getBridgeQuote } = await import(
        '../../services/bridge/bridge-client.js'
      )
      const quote = await getBridgeQuote({
        fromChain: input.fromChain,
        toChain: input.toChain,
        fromToken: input.fromToken,
        toToken: input.toToken,
        amount: input.amount,
      })
      return { data: formatQuote(quote) }
    } catch (err: unknown) {
      return { data: formatError(err) }
    }
  },
} satisfies ToolDef<InputSchema, Output>)
