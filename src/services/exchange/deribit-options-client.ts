/**
 * Deribit Options Client — CCXT-based adapter for crypto options trading.
 *
 * Implements OptionsInterface (extends ExchangeInterface) for Deribit options.
 * Supports testnet via sandbox mode. Registers itself in VenueRegistry
 * as 'deribit-options' under the 'crypto_options' vertical on connect().
 */

import ccxt, {
  type Exchange,
  type Order as CcxtOrder,
  type Ticker as CcxtTicker,
  type Balances as CcxtBalances,
  type OHLCV,
} from 'ccxt'
import type {
  Balance,
  Candle,
  ExchangeConfig,
  Greeks,
  OptionsChainEntry,
  OptionsInterface,
  Order,
  OrderRequest,
  OrderSide,
  OrderStatus,
  Position,
  Ticker,
} from './types.js'
import { getVenueRegistry } from './venue-registry.js'

// ── Error helpers (reuse from ccxt-client) ─────────────────────────────────

function translateCcxtError(error: unknown): never {
  if (error instanceof ccxt.RequestTimeout) {
    throw new Error(`Deribit timeout: ${error}`)
  }
  if (error instanceof ccxt.InsufficientFunds) {
    throw new Error(`Insufficient funds: ${error}`)
  }
  if (error instanceof ccxt.BadSymbol) {
    throw new Error(`Invalid option symbol: ${error}`)
  }
  if (error instanceof ccxt.RateLimitExceeded) {
    throw new Error(`Rate limit exceeded: ${error}`)
  }
  if (error instanceof Error) throw error
  throw new Error(String(error))
}

// ── Mappers ────────────────────────────────────────────────────────────────

function mapOrderStatus(status: string | undefined): OrderStatus {
  const mapping: Record<string, OrderStatus> = {
    open: 'open',
    closed: 'filled',
    canceled: 'cancelled',
    cancelled: 'cancelled',
    expired: 'expired',
  }
  return mapping[status ?? ''] ?? 'open'
}

function mapOrderSide(side: string | undefined): OrderSide {
  return side === 'sell' ? 'sell' : 'buy'
}

// ── Client ─────────────────────────────────────────────────────────────────

const VENUE_ID = 'deribit-options'
const MARKETS_TTL_MS = 60 * 60 * 1000

export class DeribitOptionsClient implements OptionsInterface {
  private exchange: Exchange
  private connected = false
  private marketsLoadedAt = 0

  constructor(config: ExchangeConfig) {
    const DeribitClass = (ccxt as Record<string, unknown>)[
      'deribit'
    ] as new (params: Record<string, unknown>) => Exchange

    if (!DeribitClass) {
      throw new Error('Deribit exchange not available in CCXT')
    }

    this.exchange = new DeribitClass({
      apiKey: config.apiKey,
      secret: config.secret,
      sandbox: config.testnet ?? false,
      enableRateLimit: true,
    })
  }

  async connect(): Promise<void> {
    try {
      const now = Date.now()
      if (now - this.marketsLoadedAt > MARKETS_TTL_MS) {
        await this.exchange.loadMarkets()
        this.marketsLoadedAt = now
      }
      this.exchange.options['defaultType'] = 'option'
      this.connected = true

      const registry = getVenueRegistry()
      registry.register(VENUE_ID, {
        vertical: 'crypto_options',
        exchange: this,
      })
      registry.markConnected(VENUE_ID)
    } catch (error: unknown) {
      translateCcxtError(error)
    }
  }

  async getOptionsChain(
    underlying: string,
    expiry?: string,
  ): Promise<OptionsChainEntry[]> {
    this.ensureConnected()
    try {
      const markets = this.exchange.markets
      const entries: OptionsChainEntry[] = []

      for (const [, market] of Object.entries(markets)) {
        if (market.type !== 'option') continue
        if (!market.base || market.base !== underlying.toUpperCase()) continue
        if (expiry && market.expiry !== expiry) continue

        entries.push(this.mapMarketToChainEntry(market))
      }

      return entries
    } catch (error: unknown) {
      translateCcxtError(error)
    }
  }

  async getGreeks(symbol: string): Promise<Greeks> {
    this.ensureConnected()
    try {
      const ticker = await this.exchange.fetchTicker(symbol)
      return this.extractGreeksFromTicker(ticker)
    } catch (error: unknown) {
      translateCcxtError(error)
    }
  }

  async getBalance(): Promise<Balance[]> {
    this.ensureConnected()
    try {
      const raw = await this.exchange.fetchBalance()
      return this.parseBalances(raw)
    } catch (error: unknown) {
      translateCcxtError(error)
    }
  }

  async placeOrder(req: OrderRequest): Promise<Order> {
    this.ensureConnected()
    try {
      const ccxtType = req.type === 'stop_loss' ? 'stop' : req.type
      const params: Record<string, unknown> = {}
      if (req.stopPrice !== undefined) {
        params.stopPrice = req.stopPrice
      }
      const raw = await this.exchange.createOrder(
        req.symbol,
        ccxtType,
        req.side,
        req.quantity,
        req.price,
        params,
      )
      return this.parseOrder(raw)
    } catch (error: unknown) {
      translateCcxtError(error)
    }
  }

  async cancelOrder(id: string, symbol?: string): Promise<Order> {
    this.ensureConnected()
    try {
      const raw = await this.exchange.cancelOrder(id, symbol)
      return this.parseOrder(raw)
    } catch (error: unknown) {
      translateCcxtError(error)
    }
  }

  async getOpenOrders(symbol?: string): Promise<Order[]> {
    this.ensureConnected()
    try {
      const raw = await this.exchange.fetchOpenOrders(symbol)
      return raw.map((o) => this.parseOrder(o))
    } catch (error: unknown) {
      translateCcxtError(error)
    }
  }

  async getPositions(): Promise<Position[]> {
    this.ensureConnected()
    try {
      const raw = await this.exchange.fetchPositions()
      return raw
        .filter((p) => Math.abs(Number(p.contracts ?? 0)) > 0)
        .map((p) => this.parsePosition(p))
    } catch (error: unknown) {
      translateCcxtError(error)
    }
  }

  async getCandles(
    symbol: string,
    timeframe: string,
    limit: number,
  ): Promise<Candle[]> {
    this.ensureConnected()
    try {
      const raw = await this.exchange.fetchOHLCV(
        symbol,
        timeframe,
        undefined,
        limit,
      )
      return raw.map((c) => this.parseCandleArray(c))
    } catch (error: unknown) {
      translateCcxtError(error)
    }
  }

  async getTicker(symbol: string): Promise<Ticker> {
    this.ensureConnected()
    try {
      const raw = await this.exchange.fetchTicker(symbol)
      return this.parseTicker(raw, symbol)
    } catch (error: unknown) {
      translateCcxtError(error)
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  private ensureConnected(): void {
    if (!this.connected) {
      throw new Error(
        'Deribit options client not connected. Call connect() first.',
      )
    }
  }

  private mapMarketToChainEntry(market: Record<string, unknown>): OptionsChainEntry {
    const symbol = String(market.symbol ?? '')
    const strike = Number(market.strike ?? 0)
    const expiry = String(market.expiry ?? '')
    const optionType = String(market.optionType ?? '').toLowerCase()

    return {
      symbol,
      strike,
      expiry,
      type: optionType === 'put' ? 'put' : 'call',
      bid: 0,
      ask: 0,
      iv: 0,
      volume: 0,
      openInterest: 0,
    }
  }

  private extractGreeksFromTicker(ticker: CcxtTicker): Greeks {
    const info = (ticker.info ?? {}) as Record<string, unknown>
    return {
      delta: Number(info.delta ?? info.greeks_delta ?? 0),
      gamma: Number(info.gamma ?? info.greeks_gamma ?? 0),
      theta: Number(info.theta ?? info.greeks_theta ?? 0),
      vega: Number(info.vega ?? info.greeks_vega ?? 0),
      rho: Number(info.rho ?? info.greeks_rho ?? 0),
    }
  }

  private parseBalances(raw: CcxtBalances): Balance[] {
    const result: Balance[] = []
    const free = (raw.free ?? {}) as Record<string, number>
    const used = (raw.used ?? {}) as Record<string, number>
    const total = (raw.total ?? {}) as Record<string, number>
    for (const currency of Object.keys(total)) {
      const totalVal = Number(total[currency] ?? 0)
      if (totalVal > 0) {
        result.push({
          currency,
          free: Number(free[currency] ?? 0),
          used: Number(used[currency] ?? 0),
          total: totalVal,
        })
      }
    }
    return result
  }

  private parseOrder(raw: CcxtOrder): Order {
    return {
      id: String(raw.id ?? ''),
      symbol: String(raw.symbol ?? ''),
      side: mapOrderSide(raw.side),
      type: this.parseOrderType(raw.type),
      quantity: Number(raw.amount ?? 0),
      price: raw.price != null ? Number(raw.price) : undefined,
      stopPrice: raw.stopPrice != null ? Number(raw.stopPrice) : undefined,
      status: mapOrderStatus(raw.status),
      filledQuantity: Number(raw.filled ?? 0),
      avgFillPrice: Number(raw.average ?? raw.price ?? 0),
      fee: this.extractFee(raw.fee),
      createdAt: new Date(String(raw.datetime ?? new Date().toISOString())),
      updatedAt: new Date(),
    }
  }

  private parseOrderType(
    type: string | undefined,
  ): 'market' | 'limit' | 'stop_loss' {
    if (type === 'limit') return 'limit'
    if (type === 'stop' || type === 'stop_loss') return 'stop_loss'
    return 'market'
  }

  private extractFee(fee: CcxtOrder['fee']): number {
    if (fee == null) return 0
    if (typeof fee === 'number') return fee
    if (typeof fee === 'object') return Number(fee.cost ?? 0)
    return 0
  }

  private parsePosition(raw: Record<string, unknown>): Position {
    const quantity = Math.abs(Number(raw.contracts ?? 0))
    const side: OrderSide =
      String(raw.side ?? 'long') === 'short' ? 'sell' : 'buy'
    const entryPrice = Number(raw.entryPrice ?? 0)
    const currentPrice = Number(raw.markPrice ?? raw.liquidationPrice ?? 0)
    const unrealizedPnl = Number(raw.unrealizedPnl ?? 0)
    return {
      symbol: String(raw.symbol ?? ''),
      side,
      quantity,
      entryPrice,
      currentPrice,
      unrealizedPnl,
      unrealizedPnlPercent:
        entryPrice > 0 ? (unrealizedPnl / (entryPrice * quantity)) * 100 : 0,
      realizedPnl: Number(raw.realizedPnl ?? 0),
    }
  }

  private parseCandleArray(c: OHLCV): Candle {
    return {
      timestamp: Number(c[0] ?? 0),
      open: Number(c[1] ?? 0),
      high: Number(c[2] ?? 0),
      low: Number(c[3] ?? 0),
      close: Number(c[4] ?? 0),
      volume: Number(c[5] ?? 0),
    }
  }

  private parseTicker(raw: CcxtTicker, symbol: string): Ticker {
    return {
      symbol,
      last: Number(raw.last ?? 0),
      bid: Number(raw.bid ?? 0),
      ask: Number(raw.ask ?? 0),
      high: Number(raw.high ?? 0),
      low: Number(raw.low ?? 0),
      volume: Number(raw.baseVolume ?? 0),
      timestamp: Number(raw.timestamp ?? Date.now()),
    }
  }
}
