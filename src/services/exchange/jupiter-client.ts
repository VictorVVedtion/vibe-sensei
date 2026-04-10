/**
 * Jupiter DEX Client — Solana DEX aggregator via Jupiter v6 REST API.
 *
 * Implements DEXInterface for token swaps on Solana.
 * Pure REST — NO npm SDK dependencies.
 *
 * Paper mode returns simulated swap results.
 * Live mode returns the unsigned transaction for external signing.
 */

import type {
  Balance,
  DEXInterface,
  SwapQuote,
  SwapQuoteRequest,
  SwapResult,
} from './types.js'
import { getVenueRegistry } from './venue-registry.js'
import { getExecutionTracker } from '../execution/index.js'

// ── Token Mint Addresses ────────────────────────────────────────────────────

export const SOLANA_MINTS: Record<string, string> = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
}

// ── Constants ───────────────────────────────────────────────────────────────

const JUPITER_QUOTE_URL = 'https://quote-api.jup.ag/v6/quote'
const JUPITER_SWAP_URL = 'https://quote-api.jup.ag/v6/swap'
const DEFAULT_SLIPPAGE_BPS = 50 // 0.5%
const FETCH_TIMEOUT_MS = 15_000

// ── Helpers ─────────────────────────────────────────────────────────────────

function resolveMint(token: string): string {
  const upper = token.toUpperCase()
  const mint = SOLANA_MINTS[upper]
  if (mint) return mint
  // Assume raw mint address if not in known list
  if (token.length >= 32) return token
  throw new Error(`Unknown Solana token: ${token}. Provide a mint address.`)
}

function toBaseUnits(amount: number, decimals: number): string {
  return Math.floor(amount * 10 ** decimals).toString()
}

function fromBaseUnits(raw: string | number, decimals: number): number {
  return Number(raw) / 10 ** decimals
}

function getDecimals(token: string): number {
  const upper = token.toUpperCase()
  if (upper === 'SOL') return 9
  if (upper === 'USDC' || upper === 'USDT') return 6
  return 6 // default for unknown SPL tokens
}

async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, { ...init, signal: controller.signal })
    return res
  } finally {
    clearTimeout(timer)
  }
}

// ── Client ──────────────────────────────────────────────────────────────────

export class JupiterClient implements DEXInterface {
  private readonly paperMode: boolean
  private readonly solRpcUrl: string
  private readonly userPublicKey: string

  constructor(opts?: {
    paperMode?: boolean
    solRpcUrl?: string
    userPublicKey?: string
  }) {
    this.paperMode = opts?.paperMode ?? true
    this.solRpcUrl = opts?.solRpcUrl ?? 'https://api.mainnet-beta.solana.com'
    this.userPublicKey = opts?.userPublicKey ?? ''
  }

  /** Validate endpoint reachability and register in VenueRegistry. */
  async connect(): Promise<void> {
    await this.validateEndpoint()
    const registry = getVenueRegistry()
    registry.register('jupiter-dex', { vertical: 'defi_dex', dex: this })
    registry.markConnected('jupiter-dex')
  }

  /** Fetch a swap quote from Jupiter v6. */
  async getQuote(params: SwapQuoteRequest): Promise<SwapQuote> {
    const inputMint = resolveMint(params.fromToken)
    const outputMint = resolveMint(params.toToken)
    const decimals = getDecimals(params.fromToken)
    const amount = toBaseUnits(params.amount, decimals)
    const slippageBps = params.slippageBps ?? DEFAULT_SLIPPAGE_BPS

    const url = new URL(JUPITER_QUOTE_URL)
    url.searchParams.set('inputMint', inputMint)
    url.searchParams.set('outputMint', outputMint)
    url.searchParams.set('amount', amount)
    url.searchParams.set('slippageBps', String(slippageBps))

    const res = await fetchWithTimeout(url.toString())
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Jupiter quote failed (${res.status}): ${body}`)
    }

    const data = await res.json() as JupiterQuoteResponse
    return this.mapQuoteResponse(data, params)
  }

  /** Execute a swap via Jupiter v6. Paper mode returns simulated result. */
  async executeSwap(quote: SwapQuote): Promise<SwapResult> {
    const tracker = getExecutionTracker()
    const record = tracker.create(
      'jupiter-dex', 'defi_dex',
      `${quote.fromToken}/${quote.toToken}`, 'sell',
    )

    if (this.paperMode) {
      return this.simulateSwap(quote, record.id, tracker)
    }

    return this.submitSwap(quote, record.id, tracker)
  }

  /** Fetch SOL balance via Solana RPC (simplified). */
  async getBalance(): Promise<Balance[]> {
    if (this.paperMode) {
      return [{ currency: 'SOL', free: 100, used: 0, total: 100 }]
    }

    if (!this.userPublicKey) {
      return [{ currency: 'SOL', free: 0, used: 0, total: 0 }]
    }

    const lamports = await this.fetchSolBalance()
    const sol = lamports / 1e9
    return [{ currency: 'SOL', free: sol, used: 0, total: sol }]
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  private async validateEndpoint(): Promise<void> {
    const testUrl = `${JUPITER_QUOTE_URL}?inputMint=${SOLANA_MINTS.SOL}&outputMint=${SOLANA_MINTS.USDC}&amount=1000000&slippageBps=50`
    const res = await fetchWithTimeout(testUrl)
    if (!res.ok) {
      throw new Error(`Jupiter endpoint unreachable (${res.status})`)
    }
  }

  private mapQuoteResponse(
    data: JupiterQuoteResponse,
    params: SwapQuoteRequest,
  ): SwapQuote {
    const outDecimals = getDecimals(params.toToken)
    const inDecimals = getDecimals(params.fromToken)
    const fromAmount = fromBaseUnits(data.inAmount, inDecimals)
    const toAmount = fromBaseUnits(data.outAmount, outDecimals)
    const price = fromAmount > 0 ? toAmount / fromAmount : 0
    const priceImpact = Number(data.priceImpactPct ?? 0)

    return {
      fromToken: params.fromToken,
      toToken: params.toToken,
      fromAmount,
      toAmount,
      price,
      priceImpact,
      estimatedGasUSD: 0.005, // Solana tx fee ~$0.005
      route: this.formatRoute(data),
      expiresAt: Date.now() + 30_000,
    }
  }

  private formatRoute(data: JupiterQuoteResponse): string {
    if (!data.routePlan || data.routePlan.length === 0) return 'Jupiter v6'
    const labels = data.routePlan.map(
      (r: { swapInfo?: { label?: string } }) => r.swapInfo?.label ?? 'unknown',
    )
    return labels.join(' → ')
  }

  private async simulateSwap(
    quote: SwapQuote,
    recordId: string,
    tracker: ReturnType<typeof getExecutionTracker>,
  ): Promise<SwapResult> {
    tracker.transition(recordId, 'CONFIRMED')
    tracker.transition(recordId, 'SETTLED')
    return {
      txHash: `paper-jupiter-${Date.now().toString(36)}`,
      fromAmount: quote.fromAmount,
      toAmount: quote.toAmount,
      gasUsed: 5000,
      status: 'confirmed',
    }
  }

  private async submitSwap(
    quote: SwapQuote,
    recordId: string,
    tracker: ReturnType<typeof getExecutionTracker>,
  ): Promise<SwapResult> {
    tracker.transition(recordId, 'BROADCAST')

    const body = JSON.stringify({
      quoteResponse: quote,
      userPublicKey: this.userPublicKey,
      wrapAndUnwrapSol: true,
    })

    const res = await fetchWithTimeout(JUPITER_SWAP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })

    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      tracker.transition(recordId, 'FAILED', {
        error: `Jupiter swap failed: ${errBody}`,
      })
      throw new Error(`Jupiter swap failed (${res.status}): ${errBody}`)
    }

    const data = (await res.json()) as { swapTransaction?: string }
    if (!data.swapTransaction) {
      tracker.transition(recordId, 'FAILED', {
        error: 'No swap transaction returned',
      })
      throw new Error('Jupiter returned no swap transaction')
    }

    tracker.transition(recordId, 'PENDING')
    // Return unsigned transaction — user signs externally
    return {
      txHash: `unsigned:${data.swapTransaction.slice(0, 16)}...`,
      fromAmount: quote.fromAmount,
      toAmount: quote.toAmount,
      gasUsed: 5000,
      status: 'pending',
    }
  }

  private async fetchSolBalance(): Promise<number> {
    const res = await fetchWithTimeout(this.solRpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getBalance',
        params: [this.userPublicKey],
      }),
    })

    if (!res.ok) {
      throw new Error(`Solana RPC failed (${res.status})`)
    }

    const data = (await res.json()) as {
      result?: { value?: number }
    }
    return data.result?.value ?? 0
  }
}

// ── Jupiter API Response Types ──────────────────────────────────────────────

interface JupiterQuoteResponse {
  inAmount: string
  outAmount: string
  priceImpactPct?: string
  routePlan?: Array<{
    swapInfo?: { label?: string }
  }>
}
