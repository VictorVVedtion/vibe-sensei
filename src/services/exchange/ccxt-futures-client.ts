/**
 * CCXT Futures Client — live perpetual futures trading via CCXT.
 * Implements FuturesInterface (ExchangeInterface + leverage/funding/margin).
 * Uses CCXT swap market symbols: BTC/USDT:USDT for linear perpetuals.
 * Auto-registers in VenueRegistry as perp_futures on connect.
 */

import ccxt, {
  type Exchange,
  type Order as CcxtOrder,
  type Position as CcxtPosition,
  type Ticker as CcxtTicker,
  type Balances as CcxtBalances,
  type OHLCV,
} from 'ccxt';
import type {
  Balance,
  Candle,
  ExchangeConfig,
  FundingRateInfo,
  FuturesInterface,
  MarginMode,
  Order,
  OrderRequest,
  OrderSide,
  OrderStatus,
  Position,
  Ticker,
} from './types.js';
import { getVenueRegistry } from './venue-registry.js';
import {
  ExchangeTimeoutError,
  InsufficientFundsError,
  InvalidSymbolError,
  RateLimitError,
  NetworkError,
} from './ccxt-client.js';

function mapOrderStatus(status: string | undefined): OrderStatus {
  const mapping: Record<string, OrderStatus> = {
    open: 'open',
    closed: 'filled',
    canceled: 'cancelled',
    cancelled: 'cancelled',
    expired: 'expired',
  };
  return mapping[status ?? ''] ?? 'open';
}

function mapOrderSide(side: string | undefined): OrderSide {
  return side === 'sell' ? 'sell' : 'buy';
}

function translateCcxtError(error: unknown): never {
  if (error instanceof ccxt.RequestTimeout) {
    throw new ExchangeTimeoutError(String(error));
  }
  if (error instanceof ccxt.InsufficientFunds) {
    throw new InsufficientFundsError(String(error));
  }
  if (error instanceof ccxt.BadSymbol) {
    throw new InvalidSymbolError(String(error));
  }
  if (error instanceof ccxt.RateLimitExceeded) {
    throw new RateLimitError(String(error));
  }
  if (error instanceof ccxt.NetworkError) {
    throw new NetworkError(String(error));
  }
  if (error instanceof Error) {
    throw error;
  }
  throw new Error(String(error));
}

const MARKETS_TTL_MS = 60 * 60 * 1000; // 1 hour
let marketsLoadedAt = 0;

export class CcxtFuturesClient implements FuturesInterface {
  private exchange: Exchange;
  private connected = false;

  constructor(config: ExchangeConfig) {
    const exchangeId = config.exchange ?? 'binance';
    const ExchangeClass = (ccxt as Record<string, unknown>)[
      exchangeId
    ] as new (params: Record<string, unknown>) => Exchange;

    if (!ExchangeClass) {
      throw new InvalidSymbolError(
        `Exchange "${exchangeId}" is not supported by ccxt`,
      );
    }

    this.exchange = new ExchangeClass({
      apiKey: config.apiKey,
      secret: config.secret,
      sandbox: config.testnet ?? false,
      enableRateLimit: true,
      options: { defaultType: 'swap' },
    });
  }

  async connect(): Promise<void> {
    try {
      const now = Date.now();
      if (now - marketsLoadedAt > MARKETS_TTL_MS) {
        await this.exchange.loadMarkets();
        marketsLoadedAt = now;
      }
      this.connected = true;
      getVenueRegistry().register('ccxt-futures', {
        vertical: 'perp_futures',
        exchange: this,
      });
    } catch (error: unknown) {
      translateCcxtError(error);
    }
  }

  async setLeverage(leverage: number, symbol: string): Promise<void> {
    this.ensureConnected();
    try {
      await this.exchange.setLeverage(leverage, symbol);
    } catch (error: unknown) {
      translateCcxtError(error);
    }
  }

  async getFundingRate(symbol: string): Promise<FundingRateInfo> {
    this.ensureConnected();
    try {
      const raw = await this.withRateLimitRetry(() =>
        this.exchange.fetchFundingRate(symbol),
      );
      return {
        rate: Number(raw.fundingRate ?? 0),
        nextTime: Number(raw.fundingTimestamp ?? Date.now() + 8 * 3_600_000),
      };
    } catch (error: unknown) {
      translateCcxtError(error);
    }
  }

  async setMarginMode(mode: MarginMode, symbol: string): Promise<void> {
    this.ensureConnected();
    try {
      await this.exchange.setMarginMode(mode, symbol);
    } catch (error: unknown) {
      translateCcxtError(error);
    }
  }

  async getBalance(): Promise<Balance[]> {
    this.ensureConnected();
    try {
      const raw = await this.withRateLimitRetry(() =>
        this.exchange.fetchBalance(),
      );
      return this.parseBalances(raw);
    } catch (error: unknown) {
      translateCcxtError(error);
    }
  }

  async placeOrder(req: OrderRequest): Promise<Order> {
    this.ensureConnected();
    try {
      const ccxtType = req.type === 'stop_loss' ? 'stop' : req.type;
      const params: Record<string, unknown> = {};
      if (req.stopPrice !== undefined) {
        params.stopPrice = req.stopPrice;
      }
      const raw = await this.exchange.createOrder(
        req.symbol,
        ccxtType,
        req.side,
        req.quantity,
        req.price,
        params,
      );
      return this.parseOrder(raw);
    } catch (error: unknown) {
      translateCcxtError(error);
    }
  }

  async cancelOrder(id: string, symbol?: string): Promise<Order> {
    this.ensureConnected();
    try {
      const raw = await this.exchange.cancelOrder(id, symbol);
      return this.parseOrder(raw);
    } catch (error: unknown) {
      translateCcxtError(error);
    }
  }

  async getOpenOrders(symbol?: string): Promise<Order[]> {
    this.ensureConnected();
    try {
      const raw = await this.exchange.fetchOpenOrders(symbol);
      return raw.map((o) => this.parseOrder(o));
    } catch (error: unknown) {
      translateCcxtError(error);
    }
  }

  async getPositions(): Promise<Position[]> {
    this.ensureConnected();
    try {
      const raw = await this.exchange.fetchPositions();
      return raw
        .filter((p) => Math.abs(Number(p.contracts ?? 0)) > 0)
        .map((p) => this.parsePosition(p));
    } catch (error: unknown) {
      translateCcxtError(error);
    }
  }

  async getCandles(
    symbol: string,
    timeframe: string,
    limit: number,
  ): Promise<Candle[]> {
    this.ensureConnected();
    try {
      const raw = await this.withRateLimitRetry(() =>
        this.exchange.fetchOHLCV(symbol, timeframe, undefined, limit),
      );
      return raw.map((c) => this.parseCandleArray(c));
    } catch (error: unknown) {
      translateCcxtError(error);
    }
  }

  async getTicker(symbol: string): Promise<Ticker> {
    this.ensureConnected();
    try {
      const raw = await this.withRateLimitRetry(() =>
        this.exchange.fetchTicker(symbol),
      );
      return this.parseTicker(raw, symbol);
    } catch (error: unknown) {
      translateCcxtError(error);
    }
  }

  private ensureConnected(): void {
    if (!this.connected) {
      throw new Error(
        'Futures exchange not connected. Call connect() before using the client.',
      );
    }
  }

  private async withRateLimitRetry<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error: unknown) {
      if (error instanceof ccxt.RateLimitExceeded) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return await fn();
      }
      throw error;
    }
  }

  private parseBalances(raw: CcxtBalances): Balance[] {
    const result: Balance[] = [];
    const free = (raw.free ?? {}) as Record<string, number>;
    const used = (raw.used ?? {}) as Record<string, number>;
    const total = (raw.total ?? {}) as Record<string, number>;
    for (const currency of Object.keys(total)) {
      const totalVal = Number(total[currency] ?? 0);
      if (totalVal > 0) {
        result.push({
          currency,
          free: Number(free[currency] ?? 0),
          used: Number(used[currency] ?? 0),
          total: totalVal,
        });
      }
    }
    return result;
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
    };
  }

  private parseOrderType(
    type: string | undefined,
  ): 'market' | 'limit' | 'stop_loss' {
    if (type === 'limit') return 'limit';
    if (type === 'stop' || type === 'stop_loss') return 'stop_loss';
    return 'market';
  }

  private extractFee(fee: CcxtOrder['fee']): number {
    if (fee == null) return 0;
    if (typeof fee === 'number') return fee;
    if (typeof fee === 'object') {
      return Number(fee.cost ?? 0);
    }
    return 0;
  }

  private parsePosition(raw: CcxtPosition): Position {
    const quantity = Math.abs(Number(raw.contracts ?? 0));
    const side: OrderSide =
      String(raw.side ?? 'long') === 'short' ? 'sell' : 'buy';
    const entryPrice = Number(raw.entryPrice ?? 0);
    const currentPrice = Number(raw.markPrice ?? raw.liquidationPrice ?? 0);
    const unrealizedPnl = Number(raw.unrealizedPnl ?? 0);
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
    };
  }

  private parseCandleArray(c: OHLCV): Candle {
    return {
      timestamp: Number(c[0] ?? 0),
      open: Number(c[1] ?? 0),
      high: Number(c[2] ?? 0),
      low: Number(c[3] ?? 0),
      close: Number(c[4] ?? 0),
      volume: Number(c[5] ?? 0),
    };
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
    };
  }
}
