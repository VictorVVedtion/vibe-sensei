/**
 * Bridge Client tests — chain resolution, token resolution, unit conversion,
 * same-chain error, getBridgeQuote with mocked fetch, error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  resolveChain,
  resolveChainId,
  resolveTokenAddress,
  listSupportedChains,
  getBridgeQuote,
  CHAIN_IDS,
  TOKEN_ADDRESSES,
  UnsupportedChainError,
  UnsupportedTokenError,
  BridgeError,
} from '../bridge-client'

// ── Chain Resolution ────────────────────────────────────────────────────────

describe('resolveChain', () => {
  it('resolves "ethereum" to Ethereum chain info', () => {
    const chain = resolveChain('ethereum')
    expect(chain.id).toBe(1)
    expect(chain.name).toBe('Ethereum')
    expect(chain.nativeToken).toBe('ETH')
  })

  it('resolves "eth" alias to Ethereum', () => {
    const chain = resolveChain('eth')
    expect(chain.id).toBe(1)
    expect(chain.name).toBe('Ethereum')
  })

  it('resolves "polygon" to chain 137', () => {
    expect(resolveChain('polygon').id).toBe(137)
  })

  it('resolves "matic" alias to Polygon', () => {
    const chain = resolveChain('matic')
    expect(chain.id).toBe(137)
    expect(chain.name).toBe('Polygon')
  })

  it('resolves "bsc" to chain 56', () => {
    expect(resolveChain('bsc').id).toBe(56)
  })

  it('resolves "bnb" alias to BSC', () => {
    expect(resolveChain('bnb').id).toBe(56)
  })

  it('resolves "avalanche" to chain 43114', () => {
    expect(resolveChain('avalanche').id).toBe(43114)
  })

  it('resolves "avax" alias to Avalanche', () => {
    expect(resolveChain('avax').id).toBe(43114)
  })

  it('resolves "arbitrum" to chain 42161', () => {
    expect(resolveChain('arbitrum').id).toBe(42161)
  })

  it('resolves "arb" alias to Arbitrum', () => {
    expect(resolveChain('arb').id).toBe(42161)
  })

  it('resolves "optimism" to chain 10', () => {
    expect(resolveChain('optimism').id).toBe(10)
  })

  it('resolves "op" alias to Optimism', () => {
    expect(resolveChain('op').id).toBe(10)
  })

  it('resolves "solana" to chain 7565164', () => {
    expect(resolveChain('solana').id).toBe(7565164)
  })

  it('resolves "sol" alias to Solana', () => {
    expect(resolveChain('sol').id).toBe(7565164)
  })

  it('is case-insensitive', () => {
    expect(resolveChain('Ethereum').id).toBe(1)
    expect(resolveChain('BSC').id).toBe(56)
    expect(resolveChain('POLYGON').id).toBe(137)
    expect(resolveChain('Solana').id).toBe(7565164)
  })

  it('throws UnsupportedChainError for unknown chain', () => {
    expect(() => resolveChain('fantom')).toThrow(UnsupportedChainError)
  })

  it('throws UnsupportedChainError for empty string', () => {
    expect(() => resolveChain('')).toThrow(UnsupportedChainError)
  })
})

// ── Chain ID Resolution (convenience wrapper) ───────────────────────────────

describe('resolveChainId', () => {
  it('resolves ethereum to 1', () => {
    expect(resolveChainId('ethereum')).toBe(1)
  })

  it('resolves bsc to 56', () => {
    expect(resolveChainId('bsc')).toBe(56)
  })

  it('resolves arbitrum to 42161', () => {
    expect(resolveChainId('arbitrum')).toBe(42161)
  })

  it('resolves solana to 7565164', () => {
    expect(resolveChainId('solana')).toBe(7565164)
  })
})

// ── listSupportedChains ─────────────────────────────────────────────────────

describe('listSupportedChains', () => {
  it('returns 7 unique chain names', () => {
    const chains = listSupportedChains()
    expect(chains).toHaveLength(7)
    expect(new Set(chains).size).toBe(7)
  })

  it('includes all expected chains', () => {
    const chains = listSupportedChains()
    expect(chains).toContain('Ethereum')
    expect(chains).toContain('Polygon')
    expect(chains).toContain('BSC')
    expect(chains).toContain('Avalanche')
    expect(chains).toContain('Arbitrum')
    expect(chains).toContain('Optimism')
    expect(chains).toContain('Solana')
  })
})

// ── Token Resolution ────────────────────────────────────────────────────────

describe('resolveTokenAddress', () => {
  it('resolves USDC on Ethereum', () => {
    const addr = resolveTokenAddress('USDC', 1)
    expect(addr).toBe('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')
  })

  it('resolves USDT on Ethereum', () => {
    const addr = resolveTokenAddress('USDT', 1)
    expect(addr).toBe('0xdAC17F958D2ee523a2206206994597C13D831ec7')
  })

  it('resolves USDC on BSC', () => {
    const addr = resolveTokenAddress('USDC', 56)
    expect(addr).toBe('0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d')
  })

  it('resolves USDC on Solana', () => {
    const addr = resolveTokenAddress('USDC', 7565164)
    expect(addr).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
  })

  it('resolves USDT on Polygon', () => {
    const addr = resolveTokenAddress('USDT', 137)
    expect(addr).toBe('0xc2132D05D31c914a87C6611C10748AEb04B58e8F')
  })

  it('is case-insensitive for token symbol', () => {
    const lower = resolveTokenAddress('usdc', 1)
    const upper = resolveTokenAddress('USDC', 1)
    const mixed = resolveTokenAddress('Usdc', 1)
    expect(lower).toBe(upper)
    expect(lower).toBe(mixed)
  })

  it('resolves native ETH to zero address on EVM chains', () => {
    const addr = resolveTokenAddress('ETH', 1)
    expect(addr).toBe('0x0000000000000000000000000000000000000000')
  })

  it('resolves native ETH on Arbitrum', () => {
    const addr = resolveTokenAddress('ETH', 42161)
    expect(addr).toBe('0x0000000000000000000000000000000000000000')
  })

  it('resolves native SOL to Solana system address', () => {
    const addr = resolveTokenAddress('SOL', 7565164)
    expect(addr).toBe('11111111111111111111111111111111')
  })

  it('resolves native MATIC on Polygon', () => {
    const addr = resolveTokenAddress('MATIC', 137)
    expect(addr).toBe('0x0000000000000000000000000000000000000000')
  })

  it('passes through raw addresses starting with 0x', () => {
    const raw = '0x1234567890abcdef1234567890abcdef12345678'
    const addr = resolveTokenAddress(raw, 1)
    expect(addr).toBe(raw)
  })

  it('passes through long addresses (Solana base58)', () => {
    const raw = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
    const addr = resolveTokenAddress(raw, 7565164)
    expect(addr).toBe(raw)
  })

  it('throws UnsupportedTokenError for unknown token', () => {
    expect(() => resolveTokenAddress('DAI', 1)).toThrow(UnsupportedTokenError)
  })

  it('throws for unknown token with correct message fragment', () => {
    expect(() => resolveTokenAddress('WBTC', 1)).toThrow(/Unsupported token/)
  })
})

// ── Constants Integrity ─────────────────────────────────────────────────────

describe('CHAIN_IDS', () => {
  it('contains all supported chain aliases', () => {
    // CHAIN_IDS includes all aliases (ethereum, eth, polygon, matic, etc.)
    expect(CHAIN_IDS.ethereum).toBe(1)
    expect(CHAIN_IDS.eth).toBe(1)
    expect(CHAIN_IDS.bsc).toBe(56)
    expect(CHAIN_IDS.polygon).toBe(137)
    expect(CHAIN_IDS.arbitrum).toBe(42161)
    expect(CHAIN_IDS.solana).toBe(7565164)
    expect(CHAIN_IDS.avalanche).toBe(43114)
    expect(CHAIN_IDS.optimism).toBe(10)
  })
})

describe('TOKEN_ADDRESSES', () => {
  it('has entries for all 7 chain IDs', () => {
    const expectedChainIds = [1, 137, 56, 43114, 42161, 10, 7565164]
    for (const chainId of expectedChainIds) {
      expect(TOKEN_ADDRESSES[chainId]).toBeDefined()
    }
  })

  it('every chain has both usdc and usdt', () => {
    const chainIds = [1, 137, 56, 43114, 42161, 10, 7565164]
    for (const chainId of chainIds) {
      const tokens = TOKEN_ADDRESSES[chainId]!
      expect(tokens.usdc).toBeDefined()
      expect(tokens.usdt).toBeDefined()
      expect(tokens.usdc.length).toBeGreaterThan(0)
      expect(tokens.usdt.length).toBeGreaterThan(0)
    }
  })

  it('EVM chains have 0x-prefixed addresses', () => {
    const evmChains = [1, 56, 137, 42161, 10, 43114]
    for (const chainId of evmChains) {
      const tokens = TOKEN_ADDRESSES[chainId]!
      expect(tokens.usdc).toMatch(/^0x[0-9a-fA-F]{40}$/)
      expect(tokens.usdt).toMatch(/^0x[0-9a-fA-F]{40}$/)
    }
  })

  it('Solana addresses are base58 (no 0x prefix)', () => {
    const sol = TOKEN_ADDRESSES[7565164]!
    expect(sol.usdc).not.toMatch(/^0x/)
    expect(sol.usdt).not.toMatch(/^0x/)
    expect(sol.usdc.length).toBeGreaterThan(30)
  })
})

// ── Error Classes ───────────────────────────────────────────────────────────

describe('error classes', () => {
  it('UnsupportedChainError has correct name and message', () => {
    const err = new UnsupportedChainError('fantom')
    expect(err.name).toBe('UnsupportedChainError')
    expect(err.message).toContain('fantom')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(BridgeError)
  })

  it('UnsupportedTokenError has correct name and message', () => {
    const err = new UnsupportedTokenError('WBTC', 'Ethereum')
    expect(err.name).toBe('UnsupportedTokenError')
    expect(err.message).toContain('WBTC')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(BridgeError)
  })

  it('BridgeError is the base class', () => {
    const err = new BridgeError('test error')
    expect(err.name).toBe('BridgeError')
    expect(err.message).toBe('test error')
    expect(err).toBeInstanceOf(Error)
  })
})

// ── getBridgeQuote with mocked fetch ────────────────────────────────────────

describe('getBridgeQuote', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('throws when source and destination chains are the same', async () => {
    await expect(
      getBridgeQuote({
        fromChain: 'ethereum',
        toChain: 'eth',
        fromToken: 'USDC',
        toToken: 'USDT',
        amount: 100,
      }),
    ).rejects.toThrow(/same/)
  })

  it('throws for same chain using different aliases', async () => {
    await expect(
      getBridgeQuote({
        fromChain: 'polygon',
        toChain: 'matic',
        fromToken: 'USDC',
        toToken: 'USDT',
        amount: 100,
      }),
    ).rejects.toThrow(/same/)
  })

  it('parses a successful deBridge quote response', async () => {
    const mockResponse = {
      estimation: {
        srcChainTokenIn: {
          amount: '100000000',
          decimals: 6,
          symbol: 'USDC',
        },
        dstChainTokenOut: {
          amount: '99500000',
          recommendedAmount: '99500000',
          decimals: 6,
          symbol: 'USDC',
        },
        recommendedSlippage: 0.5,
      },
      fixFee: '0',
      percentFee: 0.001,
      order: {
        approximateFulfillmentDelay: 120,
      },
    }

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    }) as unknown as typeof fetch

    const quote = await getBridgeQuote({
      fromChain: 'ethereum',
      toChain: 'polygon',
      fromToken: 'USDC',
      toToken: 'USDC',
      amount: 100,
    })

    expect(quote.srcChain).toBe('Ethereum')
    expect(quote.dstChain).toBe('Polygon')
    expect(quote.srcToken).toBe('USDC')
    expect(quote.dstToken).toBe('USDC')
    expect(quote.srcAmount).toBe('100')
    expect(quote.dstAmount).toBe('99.5')
    expect(quote.srcChainId).toBe(1)
    expect(quote.dstChainId).toBe(137)
    expect(quote.estimatedTime).toContain('~2 min')
    expect(quote.fees).toBeDefined()
    expect(quote.fees.protocolFee).toContain('0.10')
  })

  it('throws on API error (non-ok response)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: async () => 'Invalid token pair',
    }) as unknown as typeof fetch

    await expect(
      getBridgeQuote({
        fromChain: 'ethereum',
        toChain: 'arbitrum',
        fromToken: 'USDC',
        toToken: 'USDC',
        amount: 100,
      }),
    ).rejects.toThrow(/deBridge API error/)
  })

  it('throws on empty estimation response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ estimation: null }),
    }) as unknown as typeof fetch

    await expect(
      getBridgeQuote({
        fromChain: 'ethereum',
        toChain: 'polygon',
        fromToken: 'USDC',
        toToken: 'USDC',
        amount: 100,
      }),
    ).rejects.toThrow(/empty quote/)
  })

  it('throws on timeout (AbortError)', async () => {
    globalThis.fetch = vi.fn().mockImplementation(() => {
      const err = new DOMException('The operation was aborted', 'AbortError')
      return Promise.reject(err)
    }) as unknown as typeof fetch

    await expect(
      getBridgeQuote({
        fromChain: 'ethereum',
        toChain: 'polygon',
        fromToken: 'USDC',
        toToken: 'USDC',
        amount: 100,
      }),
    ).rejects.toThrow(/timed out/)
  })

  it('handles quote with no fulfillment delay', async () => {
    const mockResponse = {
      estimation: {
        srcChainTokenIn: {
          amount: '1000000000000000000',
          decimals: 18,
          symbol: 'ETH',
        },
        dstChainTokenOut: {
          amount: '990000000000000000',
          recommendedAmount: '990000000000000000',
          decimals: 18,
          symbol: 'ETH',
        },
        recommendedSlippage: 1,
      },
      fixFee: '1000000000000000',
      percentFee: 0.005,
    }

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    }) as unknown as typeof fetch

    const quote = await getBridgeQuote({
      fromChain: 'ethereum',
      toChain: 'arbitrum',
      fromToken: 'ETH',
      toToken: 'ETH',
      amount: 1,
    })

    expect(quote.estimatedTime).toBe('~1-5 min')
    expect(quote.srcToken).toBe('ETH')
    expect(quote.dstToken).toBe('ETH')
  })
})
