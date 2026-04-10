/**
 * Bridge Client — deBridge REST API integration for cross-chain quotes.
 *
 * Advisory-only: fetches quotes showing fees and estimated transfer times.
 * Does NOT execute transfers. Supported chains: Ethereum, Polygon, BSC,
 * Avalanche, Arbitrum, Optimism, Solana.
 */

// ── Chain Registry ─────────────────────────────────────────────────────────

interface ChainInfo {
  id: number
  name: string
  nativeToken: string
}

const SUPPORTED_CHAINS: Record<string, ChainInfo> = {
  ethereum: { id: 1, name: 'Ethereum', nativeToken: 'ETH' },
  eth: { id: 1, name: 'Ethereum', nativeToken: 'ETH' },
  polygon: { id: 137, name: 'Polygon', nativeToken: 'MATIC' },
  matic: { id: 137, name: 'Polygon', nativeToken: 'MATIC' },
  bsc: { id: 56, name: 'BSC', nativeToken: 'BNB' },
  bnb: { id: 56, name: 'BSC', nativeToken: 'BNB' },
  avalanche: { id: 43114, name: 'Avalanche', nativeToken: 'AVAX' },
  avax: { id: 43114, name: 'Avalanche', nativeToken: 'AVAX' },
  arbitrum: { id: 42161, name: 'Arbitrum', nativeToken: 'ETH' },
  arb: { id: 42161, name: 'Arbitrum', nativeToken: 'ETH' },
  optimism: { id: 10, name: 'Optimism', nativeToken: 'ETH' },
  op: { id: 10, name: 'Optimism', nativeToken: 'ETH' },
  solana: { id: 7565164, name: 'Solana', nativeToken: 'SOL' },
  sol: { id: 7565164, name: 'Solana', nativeToken: 'SOL' },
}

// ── Common Token Addresses ─────────────────────────────────────────────────

/**
 * Native token zero-address convention used by deBridge.
 * EVM chains use 0x0...0, Solana uses 11111111111111111111111111111111.
 */
const NATIVE_ADDRESS_EVM =
  '0x0000000000000000000000000000000000000000'
const NATIVE_ADDRESS_SOLANA =
  '11111111111111111111111111111111'

/** Well-known stablecoin addresses per chain (USDC, USDT). */
export const TOKEN_ADDRESSES: Record<number, Record<string, string>> = {
  1: {
    usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    usdt: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  },
  137: {
    usdc: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    usdt: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
  },
  56: {
    usdc: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    usdt: '0x55d398326f99059fF775485246999027B3197955',
  },
  43114: {
    usdc: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    usdt: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
  },
  42161: {
    usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    usdt: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
  },
  10: {
    usdc: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
    usdt: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
  },
  7565164: {
    usdc: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    usdt: 'Es9vMFrzaCERmKfrRqGjhwLJPCv7V5UqVYMpqxaAjG3F',
  },
}

// ── Public Types ───────────────────────────────────────────────────────────

export interface BridgeQuoteParams {
  fromChain: string
  toChain: string
  fromToken: string
  toToken: string
  amount: number
}

export interface BridgeQuote {
  srcChain: string
  dstChain: string
  srcToken: string
  dstToken: string
  srcAmount: string
  dstAmount: string
  fees: {
    protocolFee: string
    executionFee: string
    totalFeeUSD: string
  }
  estimatedTime: string
  srcChainId: number
  dstChainId: number
}

/** Chain IDs export for testing. */
export const CHAIN_IDS = Object.fromEntries(
  Object.entries(SUPPORTED_CHAINS).map(([k, v]) => [k, v.id])
) as Record<string, number>

export class BridgeError extends Error {
  constructor(message: string) { super(message); this.name = 'BridgeError' }
}
export class UnsupportedChainError extends BridgeError {
  constructor(chain: string) { super(`Unsupported chain: ${chain}`); this.name = 'UnsupportedChainError' }
}
export class UnsupportedTokenError extends BridgeError {
  constructor(token: string, chain: string) { super(`Unsupported token ${token} on ${chain}`); this.name = 'UnsupportedTokenError' }
}

// ── Chain Resolution ───────────────────────────────────────────────────────

export function resolveChain(input: string): ChainInfo {
  const key = input.toLowerCase().trim()
  const chain = SUPPORTED_CHAINS[key]
  if (!chain) {
    const supported = listSupportedChains()
    throw new UnsupportedChainError(input)
  }
  return chain
}

export function listSupportedChains(): string[] {
  const seen = new Set<number>()
  const names: string[] = []
  for (const info of Object.values(SUPPORTED_CHAINS)) {
    if (!seen.has(info.id)) {
      seen.add(info.id)
      names.push(info.name)
    }
  }
  return names
}

/** Resolve chain name to chain ID. Convenience wrapper. */
export function resolveChainId(input: string): number {
  return resolveChain(input).id
}

// ── Token Resolution ───────────────────────────────────────────────────────

export function resolveTokenAddress(
  token: string,
  chainId: number,
): string {
  const lower = token.toLowerCase().trim()

  // Check if it's already an address
  if (lower.startsWith('0x') || lower.length > 20) {
    return token
  }

  // Native tokens
  const chain = Object.values(SUPPORTED_CHAINS).find(c => c.id === chainId)
  if (chain && lower === chain.nativeToken.toLowerCase()) {
    return chainId === 7565164 ? NATIVE_ADDRESS_SOLANA : NATIVE_ADDRESS_EVM
  }

  // Well-known stablecoins
  const chainTokens = TOKEN_ADDRESSES[chainId]
  if (chainTokens && chainTokens[lower]) {
    return chainTokens[lower]!
  }

  const chainName = chain?.name ?? `chain ${chainId}`
  if (!chainTokens) throw new UnsupportedChainError(chainName)
  throw new UnsupportedTokenError(token, chainName)
}

// ── API Client ─────────────────────────────────────────────────────────────

const API_BASE = 'https://api.dln.trade'
const QUOTE_ENDPOINT = '/v1.0/dln/order/quote'
const REQUEST_TIMEOUT_MS = 15_000

interface DeBridgeQuoteResponse {
  estimation: {
    srcChainTokenIn: {
      amount: string
      decimals: number
      symbol: string
    }
    dstChainTokenOut: {
      amount: string
      recommendedAmount: string
      decimals: number
      symbol: string
    }
    recommendedSlippage: number
  }
  fixFee: string
  percentFee: number
  tx?: {
    data: string
  }
  prependedOperatingExpenseCost?: string
  order?: {
    approximateFulfillmentDelay: number
  }
}

function buildQuoteUrl(params: {
  srcChainId: number
  dstChainId: number
  srcTokenAddress: string
  dstTokenAddress: string
  srcAmount: string
}): string {
  const qs = new URLSearchParams({
    srcChainId: String(params.srcChainId),
    dstChainId: String(params.dstChainId),
    srcChainTokenIn: params.srcTokenAddress,
    dstChainTokenOut: params.dstTokenAddress,
    srcChainTokenInAmount: params.srcAmount,
    prependOperatingExpenses: 'true',
  })
  return `${API_BASE}${QUOTE_ENDPOINT}?${qs.toString()}`
}

function parseDecimals(token: string, chainId: number): number {
  const lower = token.toLowerCase().trim()
  if (lower === 'usdc' || lower === 'usdt') return 6
  if (chainId === 7565164 && lower === 'sol') return 9
  return 18
}

function toSmallestUnit(amount: number, decimals: number): string {
  // Use BigInt for precision — avoid floating point
  const factor = 10n ** BigInt(decimals)
  const intPart = BigInt(Math.floor(amount))
  const fracStr = (amount % 1).toFixed(decimals).slice(2)
  const fracBig = BigInt(fracStr)
  return (intPart * factor + fracBig).toString()
}

function fromSmallestUnit(raw: string, decimals: number): string {
  if (raw === '0') return '0'
  const padded = raw.padStart(decimals + 1, '0')
  const intPart = padded.slice(0, padded.length - decimals) || '0'
  const fracPart = padded.slice(padded.length - decimals)
  const trimmed = fracPart.replace(/0+$/, '')
  return trimmed ? `${intPart}.${trimmed}` : intPart
}

function estimateTransferTime(response: DeBridgeQuoteResponse): string {
  const delaySec = response.order?.approximateFulfillmentDelay
  if (delaySec && delaySec > 0) {
    const mins = Math.ceil(delaySec / 60)
    return mins < 2 ? `~${delaySec}s` : `~${mins} min`
  }
  return '~1-5 min'
}

function parseFees(response: DeBridgeQuoteResponse): BridgeQuote['fees'] {
  const percentFee = response.percentFee ?? 0
  const fixFee = response.fixFee ?? '0'
  const opCost = response.prependedOperatingExpenseCost ?? '0'

  // Compute estimated fee from input/output difference (most accurate)
  const srcAmt = response.estimation?.srcChainTokenIn?.amount
  const dstAmt = response.estimation?.dstChainTokenOut?.recommendedAmount
    || response.estimation?.dstChainTokenOut?.amount
  const srcDec = response.estimation?.srcChainTokenIn?.decimals ?? 18
  const dstDec = response.estimation?.dstChainTokenOut?.decimals ?? 18

  let totalFeeDisplay = `${(percentFee * 100).toFixed(2)}%`
  if (srcAmt && dstAmt) {
    // Normalize both to human units and compute the difference
    const srcHuman = Number(BigInt(srcAmt)) / 10 ** srcDec
    const dstHuman = Number(BigInt(dstAmt)) / 10 ** dstDec
    const diff = srcHuman - dstHuman
    if (diff > 0) totalFeeDisplay = `~${diff.toFixed(4)} (${(percentFee * 100).toFixed(2)}%)`
  }

  return {
    protocolFee: `${(percentFee * 100).toFixed(2)}%`,
    executionFee: opCost !== '0' ? opCost : fixFee,
    totalFeeUSD: totalFeeDisplay,
  }
}

/**
 * Fetch a cross-chain bridge quote from deBridge.
 * Returns a structured quote with fee breakdown and estimated time.
 * Throws on network errors, unsupported pairs, or insufficient liquidity.
 */
export async function getBridgeQuote(
  params: BridgeQuoteParams,
): Promise<BridgeQuote> {
  const srcChain = resolveChain(params.fromChain)
  const dstChain = resolveChain(params.toChain)

  if (srcChain.id === dstChain.id) {
    throw new Error(
      `Source and destination chains are the same (${srcChain.name}). Use a DEX swap instead.`,
    )
  }

  const srcTokenAddr = resolveTokenAddress(params.fromToken, srcChain.id)
  const dstTokenAddr = resolveTokenAddress(params.toToken, dstChain.id)

  const srcDecimals = parseDecimals(params.fromToken, srcChain.id)
  const srcAmount = toSmallestUnit(params.amount, srcDecimals)

  const url = buildQuoteUrl({
    srcChainId: srcChain.id,
    dstChainId: dstChain.id,
    srcTokenAddress: srcTokenAddr,
    dstTokenAddress: dstTokenAddr,
    srcAmount,
  })

  const response = await fetchWithTimeout(url, REQUEST_TIMEOUT_MS)
  const data = (await response.json()) as DeBridgeQuoteResponse

  validateQuoteResponse(data)

  const dstDecimals = data.estimation.dstChainTokenOut.decimals
  const dstRaw = data.estimation.dstChainTokenOut.recommendedAmount
    || data.estimation.dstChainTokenOut.amount

  return {
    srcChain: srcChain.name,
    dstChain: dstChain.name,
    srcToken: params.fromToken.toUpperCase(),
    dstToken: params.toToken.toUpperCase(),
    srcAmount: String(params.amount),
    dstAmount: fromSmallestUnit(dstRaw, dstDecimals),
    fees: parseFees(data),
    estimatedTime: estimateTransferTime(data),
    srcChainId: srcChain.id,
    dstChainId: dstChain.id,
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const resp = await fetch(url, { signal: controller.signal })
    if (!resp.ok) {
      const body = await resp.text().catch(() => '')
      throw new Error(
        `deBridge API error (${resp.status}): ${body || resp.statusText}`,
      )
    }
    return resp
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(
        `deBridge API request timed out after ${timeoutMs / 1000}s`,
      )
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

function validateQuoteResponse(data: DeBridgeQuoteResponse): void {
  if (!data.estimation) {
    throw new Error(
      'deBridge returned an empty quote — the token pair may be unsupported or liquidity is insufficient.',
    )
  }
  if (!data.estimation.dstChainTokenOut) {
    throw new Error(
      'deBridge quote missing destination token data — check the token addresses.',
    )
  }
}
