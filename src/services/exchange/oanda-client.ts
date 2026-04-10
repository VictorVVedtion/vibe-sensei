/**
 * OANDA v20 REST API client for forex and commodities trading.
 * Pure REST implementation — no npm packages required.
 *
 * Supports practice (demo) and live environments.
 * Instruments use OANDA underscore format: EUR_USD, XAU_USD, etc.
 */

import type {
  Balance,
  Candle,
  ExchangeInterface,
  Order,
  OrderRequest,
  OrderSide,
  OrderStatus,
  Position,
  Ticker,
} from './types.js'
import { getVenueRegistry } from './venue-registry.js'

// ── Configuration ──────────────────────────────────────────────────────────

const PRACTICE_BASE = 'https://api-fxpractice.oanda.com'
const LIVE_BASE = 'https://api-fxtrade.oanda.com'

const TIMEFRAME_MAP: Record<string, string> = {
  '1m': 'M1',
  '5m': 'M5',
  '15m': 'M15',
  '30m': 'M30',
  '1h': 'H1',
  '4h': 'H4',
  '1d': 'D',
  '1w': 'W',
  '1M': 'M',
}

/** Supported FX pairs and commodities. */
export const FOREX_INSTRUMENTS = [
  'EUR_USD', 'GBP_USD', 'USD_JPY', 'USD_CHF', 'AUD_USD',
  'NZD_USD', 'USD_CAD', 'EUR_GBP', 'EUR_JPY', 'GBP_JPY',
] as const

export const COMMODITY_INSTRUMENTS = [
  'XAU_USD', // Gold
  'XAG_USD', // Silver
  'BCO_USD', // Brent Crude Oil
] as const

// ── Error Types ────────────────────────────────────────────────────────────

export class OandaApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(`OANDA API ${statusCode}: ${message}`)
    this.name = 'OandaApiError'
  }
}

export class OandaAuthError extends OandaApiError {
  constructor(message: string) {
    super(401, message)
    this.name = 'OandaAuthError'
  }
}

export class OandaInstrumentError extends OandaApiError {
  constructor(instrument: string) {
    super(400, `Invalid instrument: ${instrument}`)
    this.name = 'OandaInstrumentError'
  }
}

// ── Client ─────────────────────────────────────────────────────────────────

export class OandaClient implements ExchangeInterface {
  private readonly baseUrl: string
  private readonly token: string
  private readonly accountId: string

  constructor(mode: 'practice' | 'live' = 'practice') {
    const token = process.env.OANDA_TOKEN
    if (!token) {
      throw new Error('OANDA_TOKEN environment variable is required')
    }

    const accountId = process.env.OANDA_ACCOUNT_ID
    if (!accountId) {
      throw new Error('OANDA_ACCOUNT_ID environment variable is required')
    }

    this.token = token
    this.accountId = accountId
    this.baseUrl = mode === 'live' ? LIVE_BASE : PRACTICE_BASE
  }

  // ── HTTP Helper ────────────────────────────────────────────────────────

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json',
      'Accept-Datetime-Format': 'UNIX',
    }

    const init: RequestInit = { method, headers }
    if (body !== undefined) {
      init.body = JSON.stringify(body)
    }

    const response = await fetch(url, init)

    if (response.status === 401) {
      throw new OandaAuthError('Invalid OANDA token')
    }

    if (!response.ok) {
      const text = await response.text().catch(() => 'Unknown error')
      throw new OandaApiError(response.status, text)
    }

    return response.json() as Promise<T>
  }

  // ── ExchangeInterface Implementation ───────────────────────────────────

  async connect(): Promise<void> {
    const path = `/v3/accounts/${this.accountId}`
    await this.request<OandaAccountResponse>('GET', path)

    const registry = getVenueRegistry()
    registry.register('oanda-forex', { vertical: 'forex', exchange: this })
    registry.markConnected('oanda-forex')
  }

  async getBalance(): Promise<Balance[]> {
    const path = `/v3/accounts/${this.accountId}/summary`
    const data = await this.request<OandaAccountSummary>('GET', path)
    const acct = data.account

    return [
      {
        currency: acct.currency,
        free: parseFloat(acct.balance) - parseFloat(acct.marginUsed),
        used: parseFloat(acct.marginUsed),
        total: parseFloat(acct.balance),
      },
      {
        currency: `${acct.currency}_unrealizedPL`,
        free: parseFloat(acct.unrealizedPL),
        used: 0,
        total: parseFloat(acct.unrealizedPL),
      },
    ]
  }

  async placeOrder(req: OrderRequest): Promise<Order> {
    const instrument = toOandaInstrument(req.symbol)
    const units = req.side === 'sell' ? -Math.abs(req.quantity) : Math.abs(req.quantity)

    const orderBody = buildOrderBody(req.type, instrument, units, req.price, req.stopPrice)

    const path = `/v3/accounts/${this.accountId}/orders`
    const data = await this.request<OandaOrderResponse>('POST', path, orderBody)

    return mapOandaOrder(data, req.symbol, req.side)
  }

  async getPositions(): Promise<Position[]> {
    const path = `/v3/accounts/${this.accountId}/openPositions`
    const data = await this.request<OandaPositionsResponse>('GET', path)
    return data.positions.map(mapOandaPosition)
  }

  async getOpenOrders(symbol?: string): Promise<Order[]> {
    const path = `/v3/accounts/${this.accountId}/pendingOrders`
    const data = await this.request<OandaPendingOrdersResponse>('GET', path)

    let orders = data.orders
    if (symbol) {
      const instrument = toOandaInstrument(symbol)
      orders = orders.filter(o => o.instrument === instrument)
    }

    return orders.map(mapPendingOrder)
  }

  async cancelOrder(id: string): Promise<Order> {
    const path = `/v3/accounts/${this.accountId}/orders/${id}/cancel`
    const data = await this.request<OandaCancelResponse>('PUT', path)

    return {
      id: data.orderCancelTransaction.orderID,
      symbol: '',
      side: 'buy',
      type: 'limit',
      quantity: 0,
      status: 'cancelled',
      filledQuantity: 0,
      avgFillPrice: 0,
      fee: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  }

  async getTicker(symbol: string): Promise<Ticker> {
    const instrument = toOandaInstrument(symbol)
    const path = `/v3/instruments/${instrument}/candles?count=1&granularity=S5`
    const data = await this.request<OandaCandlesResponse>('GET', path)

    if (data.candles.length === 0) {
      return emptyTicker(symbol)
    }

    const candle = data.candles[0]!
    const mid = candle.mid
    const last = parseFloat(mid.c)

    return {
      symbol,
      last,
      bid: last * 0.9999, // Approximate from mid
      ask: last * 1.0001,
      high: parseFloat(mid.h),
      low: parseFloat(mid.l),
      volume: candle.volume,
      timestamp: parseFloat(candle.time) * 1000,
    }
  }

  async getCandles(
    symbol: string,
    timeframe: string,
    limit: number,
  ): Promise<Candle[]> {
    const instrument = toOandaInstrument(symbol)
    const granularity = TIMEFRAME_MAP[timeframe] ?? 'H1'
    const path = `/v3/instruments/${instrument}/candles?count=${limit}&granularity=${granularity}`
    const data = await this.request<OandaCandlesResponse>('GET', path)

    return data.candles.map(mapOandaCandle)
  }
}

// ── Instrument Conversion ──────────────────────────────────────────────────

/** Convert user-facing symbol (EUR/USD or EUR_USD) to OANDA format (EUR_USD). */
export function toOandaInstrument(symbol: string): string {
  return symbol.replace('/', '_')
}

/** Convert OANDA instrument (EUR_USD) to user-facing symbol (EUR/USD). */
export function fromOandaInstrument(instrument: string): string {
  return instrument.replace('_', '/')
}

// ── Order Body Builder ─────────────────────────────────────────────────────

function buildOrderBody(
  type: string,
  instrument: string,
  units: number,
  price?: number,
  stopPrice?: number,
): { order: Record<string, unknown> } {
  const order: Record<string, unknown> = {
    instrument,
    units: String(units),
  }

  if (type === 'market') {
    order.type = 'MARKET'
    order.timeInForce = 'FOK'
  } else if (type === 'limit') {
    order.type = 'LIMIT'
    order.price = String(price)
    order.timeInForce = 'GTC'
  } else if (type === 'stop_loss') {
    order.type = 'STOP'
    order.price = String(stopPrice ?? price)
    order.timeInForce = 'GTC'
  }

  if (stopPrice && type !== 'stop_loss') {
    order.stopLossOnFill = { price: String(stopPrice) }
  }

  return { order }
}

// ── Response Mappers ───────────────────────────────────────────────────────

function mapOandaOrder(
  data: OandaOrderResponse,
  symbol: string,
  side: OrderSide,
): Order {
  if (data.orderFillTransaction) {
    const fill = data.orderFillTransaction
    return {
      id: fill.id,
      symbol,
      side,
      type: 'market',
      quantity: Math.abs(parseFloat(fill.units)),
      status: 'filled',
      filledQuantity: Math.abs(parseFloat(fill.units)),
      avgFillPrice: parseFloat(fill.price),
      fee: parseFloat(fill.commission ?? '0'),
      createdAt: new Date(parseFloat(fill.time) * 1000),
      updatedAt: new Date(parseFloat(fill.time) * 1000),
    }
  }

  if (data.orderCreateTransaction) {
    const created = data.orderCreateTransaction
    return {
      id: created.id,
      symbol,
      side,
      type: created.type === 'LIMIT' ? 'limit' : 'market',
      quantity: Math.abs(parseFloat(created.units)),
      status: 'open',
      filledQuantity: 0,
      avgFillPrice: 0,
      fee: 0,
      createdAt: new Date(parseFloat(created.time) * 1000),
      updatedAt: new Date(parseFloat(created.time) * 1000),
    }
  }

  throw new OandaApiError(500, 'Unexpected order response format')
}

function mapOandaPosition(pos: OandaPosition): Position {
  const longUnits = parseFloat(pos.long.units)
  const shortUnits = parseFloat(pos.short.units)
  const isLong = longUnits > 0
  const side: OrderSide = isLong ? 'buy' : 'sell'
  const quantity = isLong ? longUnits : Math.abs(shortUnits)
  const detail = isLong ? pos.long : pos.short
  const avgPrice = parseFloat(detail.averagePrice ?? '0')
  const unrealizedPL = parseFloat(detail.unrealizedPL ?? '0')
  const entryValue = avgPrice * quantity

  return {
    symbol: fromOandaInstrument(pos.instrument),
    side,
    quantity,
    entryPrice: avgPrice,
    currentPrice: entryValue > 0
      ? avgPrice + unrealizedPL / quantity
      : avgPrice,
    unrealizedPnl: unrealizedPL,
    unrealizedPnlPercent: entryValue > 0
      ? (unrealizedPL / entryValue) * 100
      : 0,
    realizedPnl: parseFloat(pos.pl),
  }
}

function mapPendingOrder(o: OandaPendingOrder): Order {
  const units = parseFloat(o.units)
  const side: OrderSide = units > 0 ? 'buy' : 'sell'
  const typeMap: Record<string, 'market' | 'limit' | 'stop_loss'> = {
    LIMIT: 'limit',
    STOP: 'stop_loss',
    MARKET: 'market',
  }

  return {
    id: o.id,
    symbol: fromOandaInstrument(o.instrument),
    side,
    type: typeMap[o.type] ?? 'limit',
    quantity: Math.abs(units),
    price: o.price ? parseFloat(o.price) : undefined,
    status: 'open',
    filledQuantity: 0,
    avgFillPrice: 0,
    fee: 0,
    createdAt: new Date(parseFloat(o.createTime) * 1000),
    updatedAt: new Date(parseFloat(o.createTime) * 1000),
  }
}

function mapOandaCandle(c: OandaCandleRaw): Candle {
  return {
    timestamp: parseFloat(c.time) * 1000,
    open: parseFloat(c.mid.o),
    high: parseFloat(c.mid.h),
    low: parseFloat(c.mid.l),
    close: parseFloat(c.mid.c),
    volume: c.volume,
  }
}

function emptyTicker(symbol: string): Ticker {
  return {
    symbol,
    last: 0,
    bid: 0,
    ask: 0,
    high: 0,
    low: 0,
    volume: 0,
    timestamp: Date.now(),
  }
}

// ── OANDA API Response Types ───────────────────────────────────────────────

interface OandaAccountResponse {
  account: { id: string; currency: string }
}

interface OandaAccountSummary {
  account: {
    currency: string
    balance: string
    unrealizedPL: string
    marginUsed: string
  }
}

interface OandaOrderResponse {
  orderFillTransaction?: {
    id: string
    units: string
    price: string
    commission?: string
    time: string
  }
  orderCreateTransaction?: {
    id: string
    type: string
    units: string
    time: string
  }
}

interface OandaPositionsResponse {
  positions: OandaPosition[]
}

interface OandaPosition {
  instrument: string
  pl: string
  long: {
    units: string
    averagePrice?: string
    unrealizedPL?: string
  }
  short: {
    units: string
    averagePrice?: string
    unrealizedPL?: string
  }
}

interface OandaPendingOrdersResponse {
  orders: OandaPendingOrder[]
}

interface OandaPendingOrder {
  id: string
  type: string
  instrument: string
  units: string
  price?: string
  createTime: string
}

interface OandaCancelResponse {
  orderCancelTransaction: {
    orderID: string
  }
}

interface OandaCandlesResponse {
  candles: OandaCandleRaw[]
}

interface OandaCandleRaw {
  time: string
  mid: { o: string; h: string; l: string; c: string }
  volume: number
}
