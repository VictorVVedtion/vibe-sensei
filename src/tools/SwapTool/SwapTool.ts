/**
 * SwapTool — DEX token swap via Jupiter (Solana) or 1inch (EVM).
 *
 * Gets the DEX adapter from VenueRegistry by vertical 'defi_dex'.
 * Shows quote first (slippage, price impact, gas estimate), then
 * executes on confirmation.
 */

import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { ensureDex } from '../../services/exchange/venue-bootstrap.js'
import type { DEXInterface, SwapQuote } from '../../services/exchange/types.js'
import { runPreTradeGate } from '../_shared/runPreTradeGate.js'

const inputSchema = z.strictObject({
  fromToken: z.string().describe('Source token symbol or address (e.g. "SOL", "ETH", "USDC")'),
  toToken: z.string().describe('Destination token symbol or address'),
  amount: z.number().positive().describe('Amount of source token to swap'),
  venue: z
    .enum(['jupiter', '1inch'])
    .optional()
    .describe('DEX venue: "jupiter" (Solana) or "1inch" (EVM). Auto-detects if omitted.'),
  execute: z
    .boolean()
    .optional()
    .describe('Set true to execute after quote. Default false (quote only).'),
})

type InputSchema = typeof inputSchema
type Output = string

function formatQuote(quote: SwapQuote): string {
  const lines = [
    `Swap Quote`,
    `  ${quote.fromAmount} ${quote.fromToken} -> ${quote.toAmount.toFixed(6)} ${quote.toToken}`,
    `  Price: ${quote.price.toFixed(8)}`,
    `  Price Impact: ${(quote.priceImpact * 100).toFixed(3)}%`,
    `  Est. Gas: $${quote.estimatedGasUSD.toFixed(4)}`,
    `  Route: ${quote.route}`,
    `  Expires: ${new Date(quote.expiresAt).toISOString()}`,
  ]
  return lines.join('\n')
}

function formatResult(
  quote: SwapQuote,
  result: import('../../services/exchange/types.js').SwapResult,
): string {
  const lines = [
    `Swap Executed`,
    `  ${result.fromAmount} ${quote.fromToken} -> ${result.toAmount.toFixed(6)} ${quote.toToken}`,
    `  Tx: ${result.txHash}`,
    `  Gas Used: ${result.gasUsed}`,
    `  Status: ${result.status}`,
  ]
  return lines.join('\n')
}

async function resolveDex(venue?: string): Promise<DEXInterface> {
  if (venue === 'jupiter') {
    return ensureDex('jupiter-dex')
  }
  if (venue === '1inch') {
    return ensureDex('1inch-dex')
  }
  // Auto-detect: pick first available defi_dex adapter
  return ensureDex()
}

export const SwapTool = buildTool({
  name: 'SwapDEX',
  searchHint: 'swap tokens on a decentralized exchange DEX Jupiter 1inch Solana EVM',
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
    return 'Swap tokens on a decentralized exchange (Jupiter for Solana, 1inch for EVM chains). Shows quote first, then executes on confirmation.'
  },

  async prompt() {
    return [
      'Swap tokens on a DEX.',
      'Requires: fromToken, toToken, amount.',
      'Optional: venue (jupiter/1inch), execute (true to swap after quote).',
      'Default behavior: returns a quote only. Set execute=true to swap.',
      'Jupiter handles Solana tokens (SOL, USDC, USDT).',
      '1inch handles EVM tokens (ETH, MATIC, BNB + ERC-20s).',
    ].join('\n')
  },

  toAutoClassifierInput(input) {
    return `swap ${input.amount} ${input.fromToken} to ${input.toToken}`
  },

  mapToolResultToToolResultBlockParam(content, toolUseID) {
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: String(content),
    }
  },

  renderToolUseMessage(input) {
    return `SwapDEX: ${input.amount ?? '?'} ${input.fromToken ?? '?'} -> ${input.toToken ?? '?'}`
  },

  async call(input) {
    const dex = await resolveDex(input.venue)
    const quote = await dex.getQuote({
      fromToken: input.fromToken,
      toToken: input.toToken,
      amount: input.amount,
    })

    let output = formatQuote(quote)

    if (input.execute) {
      // SECURITY: fail-closed pre-trade gate. See _shared/runPreTradeGate.ts.
      // DEX swap has no native side/symbol — map to gate vocabulary so the
      // shared risk checks (daily loss limit, circuit breaker, portfolio
      // heat) and DeFi-specific checks (slippage, gas, contract audit,
      // impermanent loss) still trigger. Gate ONLY runs on execute=true;
      // quote-only calls bypass since they don't move funds.
      const gate = await runPreTradeGate({
        symbol: `${input.fromToken}/${input.toToken}`,
        side: 'buy',
        type: 'market',
        quantity: input.amount,
      })
      if (!gate.allowed) {
        return { data: gate.formattedRejection }
      }

      const result = await dex.executeSwap(quote)
      output += '\n\n' + formatResult(quote, result)

      // Notify tilt detector about DEX swap (fire-and-forget)
      notifyDefiTrade(quote).catch(() => {})
    }

    return { data: output }
  },
} satisfies ToolDef<InputSchema, Output>)

/**
 * Record DEX swap timestamp for aping tilt detection.
 * Failure is silently swallowed.
 */
async function notifyDefiTrade(quote: SwapQuote): Promise<void> {
  try {
    const { getTiltDetector } = await import(
      '../../services/trading/tilt-detector.js'
    )
    const detector = getTiltDetector()
    const now = Date.now()

    // Record as DEX swap for aping detection
    detector.recordDefiSwap(now)

    // Also record as a general trade for other tilt checks
    detector.recordTrade({
      symbol: `${quote.fromToken}/${quote.toToken}`,
      side: 'sell',
      pnlPercent: 0, // Swaps don't have PnL at execution time
      positionSize: quote.fromAmount * quote.price,
      timestamp: now,
    })
  } catch {
    // Tilt tracking must never block swap execution
  }
}
