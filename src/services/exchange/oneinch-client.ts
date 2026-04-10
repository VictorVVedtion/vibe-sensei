/**
 * 1inch DEX Client — EVM DEX aggregator via 1inch Swap API v6.
 *
 * Implements DEXInterface for token swaps on Ethereum, Polygon, BSC, Arbitrum.
 * Pure REST — NO npm SDK dependencies.
 *
 * Paper mode returns simulated swap results.
 * Requires ONEINCH_API_KEY env var for live mode.
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

// ── Chain Configuration ─────────────────────────────────────────────────────

export const SUPPORTED_CHAINS: Record<string, number> = {
  ethereum: 1,
  polygon: 137,
  bsc: 56,
  arbitrum: 42161,
}

export const CHAIN_NATIVE_TOKENS: Record<number, string> = {
  1: 'ETH',
  137: 'MATIC',
  56: 'BNB',
  42161: 'ETH',
}

/** Common ERC-20 addresses per chain (native token represented as 0xEEE...) */
export const COMMON_TOKENS: Record<number, Record<string, string>> = {
  1: {
    ETH: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  },
  137: {
    MATIC: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
  },
  56: {
    BNB: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    USDT: '0x55d398326f99059fF775485246999027B3197955',
    USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
  },
  42161: {
    ETH: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
  },
}

// ── Constants ───────────────────────────────────────────────────────────────

const API_BASE = 'https://api.1inch.dev/swap/v6.0'
const DEFAULT_SLIPPAGE = 1 // 1%
const FETCH_TIMEOUT_MS = 15_000

// ── Helpers ─────────────────────────────────────────────────────────────────

function resolveTokenAddress(
  token: string,
  chainId: number,
): string {
  const upper = token.toUpperCase()
  const chainTokens = COMMON_TOKENS[chainId]
  if (chainTokens) {
    const addr = chainTokens[upper]
    if (addr) return addr
  }
  // Assume raw address if starts with 0x
  if (token.startsWith('0x') && token.length === 42) return token
  throw new Error(
    `Unknown token "${token}" on chain ${chainId}. Provide a contract address.`,
  )
}

async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

function getApiKey(): string {
  return process.env.ONEINCH_API_KEY ?? ''
}

// ── Client ──────────────────────────────────────────────────────────────────

export class OneInchClient implements DEXInterface {
  private readonly chainId: number
  private readonly paperMode: boolean
  private readonly walletAddress: string

  constructor(opts?: {
    chainId?: number
    paperMode?: boolean
    walletAddress?: string
  }) {
    this.chainId = opts?.chainId ?? 1
    this.paperMode = opts?.paperMode ?? true
    this.walletAddress = opts?.walletAddress ?? ''
  }

  /** Validate API reachability and register in VenueRegistry. */
  async connect(): Promise<void> {
    await this.validateEndpoint()
    const registry = getVenueRegistry()
    registry.register('1inch-dex', { vertical: 'defi_dex', dex: this })
    registry.markConnected('1inch-dex')
  }

  /** Fetch a swap quote from 1inch v6 API. */
  async getQuote(params: SwapQuoteRequest): Promise<SwapQuote> {
    const src = resolveTokenAddress(params.fromToken, this.chainId)
    const dst = resolveTokenAddress(params.toToken, this.chainId)
    const amount = this.toWei(params.amount)

    const url = new URL(`${API_BASE}/${this.chainId}/quote`)
    url.searchParams.set('src', src)
    url.searchParams.set('dst', dst)
    url.searchParams.set('amount', amount)

    const res = await this.apiRequest(url.toString())
    const data = (await res.json()) as OneInchQuoteResponse
    this.validateQuoteResponse(data)
    return this.mapQuoteResponse(data, params)
  }

  /** Execute a swap via 1inch v6 API. Paper mode returns simulated result. */
  async executeSwap(quote: SwapQuote): Promise<SwapResult> {
    const tracker = getExecutionTracker()
    const record = tracker.create(
      '1inch-dex', 'defi_dex',
      `${quote.fromToken}/${quote.toToken}`, 'sell',
    )

    if (this.paperMode) {
      return this.simulateSwap(quote, record.id, tracker)
    }

    return this.submitSwap(quote, record.id, tracker)
  }

  /** Fetch native token balance (simplified). */
  async getBalance(): Promise<Balance[]> {
    const native = CHAIN_NATIVE_TOKENS[this.chainId] ?? 'ETH'
    if (this.paperMode) {
      return [{ currency: native, free: 10, used: 0, total: 10 }]
    }
    // Live balance would require an RPC call — return zero for now
    return [{ currency: native, free: 0, used: 0, total: 0 }]
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  private async validateEndpoint(): Promise<void> {
    // Health check — test with a minimal quote request
    const src = resolveTokenAddress('ETH', this.chainId)
    const dst = resolveTokenAddress('USDC', this.chainId)
    const url = `${API_BASE}/${this.chainId}/quote?src=${src}&dst=${dst}&amount=1000000000000000`

    const res = await this.apiRequest(url)
    if (!res.ok) {
      throw new Error(`1inch endpoint unreachable (${res.status})`)
    }
  }

  private async apiRequest(url: string): Promise<Response> {
    const apiKey = getApiKey()
    const headers: Record<string, string> = {
      Accept: 'application/json',
    }
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`
    }

    const res = await fetchWithTimeout(url, { headers })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`1inch API error (${res.status}): ${body}`)
    }
    return res
  }

  private validateQuoteResponse(data: OneInchQuoteResponse): void {
    if (!data.dstAmount) {
      throw new Error('1inch returned invalid quote: missing dstAmount')
    }
  }

  private mapQuoteResponse(
    data: OneInchQuoteResponse,
    params: SwapQuoteRequest,
  ): SwapQuote {
    const fromAmount = params.amount
    const toAmount = this.fromWei(data.dstAmount)
    const price = fromAmount > 0 ? toAmount / fromAmount : 0
    const gasUsd = data.gas ? Number(data.gas) * 0.00003 : 0.5 // rough estimate

    return {
      fromToken: params.fromToken,
      toToken: params.toToken,
      fromAmount,
      toAmount,
      price,
      priceImpact: 0, // 1inch quote endpoint does not return price impact
      estimatedGasUSD: gasUsd,
      route: data.protocols ? '1inch Aggregation' : '1inch Direct',
      expiresAt: Date.now() + 30_000,
    }
  }

  private async simulateSwap(
    quote: SwapQuote,
    recordId: string,
    tracker: ReturnType<typeof getExecutionTracker>,
  ): Promise<SwapResult> {
    tracker.transition(recordId, 'CONFIRMED')
    tracker.transition(recordId, 'SETTLED')
    return {
      txHash: `paper-1inch-${Date.now().toString(36)}`,
      fromAmount: quote.fromAmount,
      toAmount: quote.toAmount,
      gasUsed: 150_000,
      status: 'confirmed',
    }
  }

  private async submitSwap(
    quote: SwapQuote,
    recordId: string,
    tracker: ReturnType<typeof getExecutionTracker>,
  ): Promise<SwapResult> {
    tracker.transition(recordId, 'BROADCAST')
    const slippage = DEFAULT_SLIPPAGE
    const src = resolveTokenAddress(quote.fromToken, this.chainId)
    const dst = resolveTokenAddress(quote.toToken, this.chainId)
    const amount = this.toWei(quote.fromAmount)

    const url = new URL(`${API_BASE}/${this.chainId}/swap`)
    url.searchParams.set('src', src)
    url.searchParams.set('dst', dst)
    url.searchParams.set('amount', amount)
    url.searchParams.set('from', this.walletAddress)
    url.searchParams.set('slippage', String(slippage))

    const res = await this.apiRequest(url.toString())
    const data = (await res.json()) as OneInchSwapResponse

    if (!data.tx) {
      tracker.transition(recordId, 'FAILED', {
        error: 'No transaction returned from 1inch',
      })
      throw new Error('1inch returned no transaction data')
    }

    tracker.transition(recordId, 'PENDING')
    return {
      txHash: `unsigned:${data.tx.data?.slice(0, 16) ?? 'unknown'}...`,
      fromAmount: quote.fromAmount,
      toAmount: quote.toAmount,
      gasUsed: Number(data.tx.gas ?? 150_000),
      status: 'pending',
    }
  }

  /** Convert human-readable amount to wei (18 decimals). */
  private toWei(amount: number): string {
    return Math.floor(amount * 1e18).toString()
  }

  /** Convert wei string to human-readable amount. */
  private fromWei(wei: string): number {
    return Number(wei) / 1e18
  }
}

// ── 1inch API Response Types ────────────────────────────────────────────────

interface OneInchQuoteResponse {
  dstAmount: string
  gas?: string
  protocols?: unknown[]
}

interface OneInchSwapResponse {
  tx?: {
    data?: string
    gas?: string
    to?: string
    value?: string
  }
}
