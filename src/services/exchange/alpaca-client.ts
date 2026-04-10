/**
 * Alpaca Markets REST API v2 client for stock trading.
 * No @alpacahq/alpaca-trade-api dependency — uses native fetch.
 * Supports paper trading (default) and live trading.
 * Registers as 'alpaca-stocks' with vertical 'stocks' in VenueRegistry.
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

const PAPER_BASE = 'https://paper-api.alpaca.markets'
const LIVE_BASE = 'https://api.alpaca.markets'
const DATA_BASE = 'https://data.alpaca.markets'
const REQUEST_TIMEOUT_MS = 15_000

// ── Response Interfaces ────────────────────────────────────────────────────

interface AlpacaAccount {
  id: string
  status: string
  equity: string
  cash: string
  buying_power: string
  portfolio_value: string
}

interface AlpacaOrder {
  id: string
  symbol: string
  side: string
  type: string
  qty: string
  filled_qty: string
  filled_avg_price: string | null
  status: string
  created_at: string
  updated_at: string
  limit_price: string | null
  stop_price: string | null
}

interface AlpacaPosition {
  symbol: string
  side: string
  qty: string
  avg_entry_price: string
  current_price: string
  unrealized_pl: string
  unrealized_plpc: string
  market_value: string
}

interface AlpacaQuote {
  ap: number  // ask price
  bp: number  // bid price
  as: number  // ask size
  bs: number  // bid size
  t: string   // timestamp
}

interface AlpacaBar {
  t: string   // timestamp
  o: number   // open
  h: number   // high
  l: number   // low
  c: number   // close
  v: number   // volume
}

interface AlpacaClock {
  is_open: boolean
  next_open: string
  next_close: string
  timestamp: string
}

// ── Error Classes ──────────────────────────────────────────────────────────

export class AlpacaAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AlpacaAuthError'
  }
}

export class AlpacaApiError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message)
    this.name = 'AlpacaApiError'
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function mapOrderStatus(alpacaStatus: string): OrderStatus {
  const mapping: Record<string, OrderStatus> = {
    new: 'open',
    accepted: 'open',
    pending_new: 'open',
    partially_filled: 'partially_filled',
    filled: 'filled',
    canceled: 'cancelled',
    cancelled: 'cancelled',
    expired: 'expired',
    replaced: 'cancelled',
    pending_cancel: 'open',
    pending_replace: 'open',
  }
  return mapping[alpacaStatus] ?? 'open'
}

function mapOrderSide(side: string): OrderSide {
  return side === 'sell' ? 'sell' : 'buy'
}

function parseAlpacaOrder(raw: AlpacaOrder): Order {
  const parseType = (t: string): 'market' | 'limit' | 'stop_loss' => {
    if (t === 'limit') return 'limit'
    if (t === 'stop' || t === 'stop_limit') return 'stop_loss'
    return 'market'
  }

  return {
    id: raw.id,
    symbol: raw.symbol,
    side: mapOrderSide(raw.side),
    type: parseType(raw.type),
    quantity: parseFloat(raw.qty || '0'),
    price: raw.limit_price ? parseFloat(raw.limit_price) : undefined,
    stopPrice: raw.stop_price ? parseFloat(raw.stop_price) : undefined,
    status: mapOrderStatus(raw.status),
    filledQuantity: parseFloat(raw.filled_qty || '0'),
    avgFillPrice: parseFloat(raw.filled_avg_price || '0'),
    fee: 0, // Alpaca commission-free
    createdAt: new Date(raw.created_at),
    updatedAt: new Date(raw.updated_at),
  }
}

function parseAlpacaPosition(raw: AlpacaPosition): Position {
  const qty = parseFloat(raw.qty || '0')
  return {
    symbol: raw.symbol,
    side: raw.side === 'short' ? 'sell' : 'buy',
    quantity: Math.abs(qty),
    entryPrice: parseFloat(raw.avg_entry_price || '0'),
    currentPrice: parseFloat(raw.current_price || '0'),
    unrealizedPnl: parseFloat(raw.unrealized_pl || '0'),
    unrealizedPnlPercent: parseFloat(raw.unrealized_plpc || '0') * 100,
    realizedPnl: 0,
  }
}

// ── Client ─────────────────────────────────────────────────────────────────

export class AlpacaClient implements ExchangeInterface {
  private readonly baseUrl: string
  private readonly dataUrl: string
  private readonly keyId: string
  private readonly secretKey: string
  private connected = false

  constructor(mode: 'paper' | 'live' = 'paper') {
    this.baseUrl = mode === 'live' ? LIVE_BASE : PAPER_BASE
    this.dataUrl = DATA_BASE

    const keyId = process.env.ALPACA_KEY_ID ?? ''
    const secretKey = process.env.ALPACA_SECRET_KEY ?? ''

    if (!keyId || !secretKey) {
      throw new AlpacaAuthError(
        'Missing ALPACA_KEY_ID or ALPACA_SECRET_KEY environment variables',
      )
    }

    this.keyId = keyId
    this.secretKey = secretKey
  }

  // ── ExchangeInterface ─────────────────────────────────────────────────

  async connect(): Promise<void> {
    const account = await this.fetchApi<AlpacaAccount>('/v2/account')

    if (account.status !== 'ACTIVE') {
      throw new AlpacaAuthError(
        `Alpaca account is not active (status: ${account.status})`,
      )
    }

    // Register in VenueRegistry
    const registry = getVenueRegistry()
    registry.register('alpaca-stocks', { vertical: 'stocks', exchange: this })
    registry.markConnected('alpaca-stocks')

    this.connected = true
  }

  async getBalance(): Promise<Balance[]> {
    this.ensureConnected()
    const account = await this.fetchApi<AlpacaAccount>('/v2/account')

    return [
      {
        currency: 'USD',
        free: parseFloat(account.buying_power || '0'),
        used: parseFloat(account.equity || '0') - parseFloat(account.cash || '0'),
        total: parseFloat(account.equity || '0'),
      },
    ]
  }

  async placeOrder(req: OrderRequest): Promise<Order> {
    this.ensureConnected()

    const alpacaType = req.type === 'stop_loss' ? 'stop' : req.type
    const body: Record<string, unknown> = {
      symbol: req.symbol,
      qty: String(req.quantity),
      side: req.side,
      type: alpacaType,
      time_in_force: 'day',
    }

    if (req.price != null && req.type === 'limit') {
      body.limit_price = String(req.price)
    }
    if (req.stopPrice != null) {
      body.stop_price = String(req.stopPrice)
    }

    const raw = await this.fetchApi<AlpacaOrder>('/v2/orders', {
      method: 'POST',
      body: JSON.stringify(body),
    })

    return parseAlpacaOrder(raw)
  }

  async cancelOrder(id: string): Promise<Order> {
    this.ensureConnected()
    await this.fetchApi<void>(`/v2/orders/${id}`, { method: 'DELETE' })

    // Alpaca DELETE returns 204, fetch order status after cancellation
    const raw = await this.fetchApi<AlpacaOrder>(`/v2/orders/${id}`)
    return parseAlpacaOrder(raw)
  }

  async getOpenOrders(): Promise<Order[]> {
    this.ensureConnected()
    const raw = await this.fetchApi<AlpacaOrder[]>('/v2/orders?status=open')
    return raw.map(parseAlpacaOrder)
  }

  async getPositions(): Promise<Position[]> {
    this.ensureConnected()
    const raw = await this.fetchApi<AlpacaPosition[]>('/v2/positions')
    return raw.map(parseAlpacaPosition)
  }

  async getTicker(symbol: string): Promise<Ticker> {
    this.ensureConnected()
    const raw = await this.fetchData<AlpacaQuote>(
      `/v2/stocks/${encodeURIComponent(symbol)}/quotes/latest`,
    )

    const mid = (raw.ap + raw.bp) / 2
    return {
      symbol,
      last: mid,
      bid: raw.bp,
      ask: raw.ap,
      high: mid,
      low: mid,
      volume: 0,
      timestamp: new Date(raw.t).getTime(),
    }
  }

  async getCandles(
    symbol: string,
    timeframe: string,
    limit: number,
  ): Promise<Candle[]> {
    this.ensureConnected()
    const tf = normalizeTimeframe(timeframe)
    const url = `/v2/stocks/${encodeURIComponent(symbol)}/bars?timeframe=${tf}&limit=${limit}`
    const raw = await this.fetchData<{ bars: AlpacaBar[] }>(url)

    if (!raw.bars || !Array.isArray(raw.bars)) return []

    return raw.bars.map((b) => ({
      timestamp: new Date(b.t).getTime(),
      open: b.o,
      high: b.h,
      low: b.l,
      close: b.c,
      volume: b.v,
    }))
  }

  // ── Market Hours ──────────────────────────────────────────────────────

  async getMarketClock(): Promise<{
    isOpen: boolean
    nextOpen: string
    nextClose: string
  }> {
    const clock = await this.fetchApi<AlpacaClock>('/v2/clock')
    return {
      isOpen: clock.is_open,
      nextOpen: clock.next_open,
      nextClose: clock.next_close,
    }
  }

  // ── Private Helpers ───────────────────────────────────────────────────

  private ensureConnected(): void {
    if (!this.connected) {
      throw new Error(
        'Alpaca client not connected. Call connect() first.',
      )
    }
  }

  private async fetchApi<T>(
    path: string,
    init?: RequestInit,
  ): Promise<T> {
    return this.doFetch<T>(`${this.baseUrl}${path}`, init)
  }

  private async fetchData<T>(
    path: string,
    init?: RequestInit,
  ): Promise<T> {
    return this.doFetch<T>(`${this.dataUrl}${path}`, init)
  }

  private async doFetch<T>(
    url: string,
    init?: RequestInit,
  ): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
      const resp = await fetch(url, {
        ...init,
        headers: {
          'APCA-API-KEY-ID': this.keyId,
          'APCA-API-SECRET-KEY': this.secretKey,
          'Content-Type': 'application/json',
          ...(init?.headers as Record<string, string> | undefined),
        },
        signal: controller.signal,
      })

      // 204 No Content (e.g. DELETE)
      if (resp.status === 204) return undefined as unknown as T

      if (resp.status === 401 || resp.status === 403) {
        const text = await resp.text().catch(() => '')
        throw new AlpacaAuthError(
          `Alpaca auth failed (${resp.status}): ${text.slice(0, 200)}`,
        )
      }

      if (!resp.ok) {
        const text = await resp.text().catch(() => '')
        throw new AlpacaApiError(
          resp.status,
          `Alpaca API error ${resp.status}: ${text.slice(0, 200)}`,
        )
      }

      return (await resp.json()) as T
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new AlpacaApiError(
          408,
          `Alpaca API timeout after ${REQUEST_TIMEOUT_MS}ms`,
        )
      }
      throw error
    } finally {
      clearTimeout(timer)
    }
  }
}

// ── Timeframe Normalization ────────────────────────────────────────────────

function normalizeTimeframe(tf: string): string {
  const mapping: Record<string, string> = {
    '1m': '1Min',
    '5m': '5Min',
    '15m': '15Min',
    '30m': '30Min',
    '1h': '1Hour',
    '4h': '4Hour',
    '1d': '1Day',
    '1w': '1Week',
  }
  return mapping[tf] ?? tf
}
