/**
 * Hyperliquid direct REST API client for market data.
 * No CCXT dependency — uses native fetch against https://api.hyperliquid.xyz/info.
 * Read-only: candles, tickers, and prices. Trading operations throw.
 */

import type {
  Balance,
  Candle,
  ExchangeInterface,
  Order,
  OrderRequest,
  Position,
  Ticker,
} from './types.js';

const API_URL = 'https://api.hyperliquid.xyz/info';
const REQUEST_TIMEOUT_MS = 10_000;

/** Raw candle shape returned by Hyperliquid candleSnapshot */
interface HyperliquidCandle {
  t: number;  // open time (ms)
  T: number;  // close time (ms)
  s: string;  // coin
  i: string;  // interval
  o: string;  // open
  h: string;  // high
  l: string;  // low
  c: string;  // close
  v: string;  // volume
  n: number;  // number of trades
}

/** Timeframe string to millisecond duration */
const TIMEFRAME_MS: Record<string, number> = {
  '1m':  60_000,
  '3m':  180_000,
  '5m':  300_000,
  '15m': 900_000,
  '30m': 1_800_000,
  '1h':  3_600_000,
  '4h':  14_400_000,
  '1d':  86_400_000,
  '1w':  604_800_000,
};

/**
 * POST a JSON body to the Hyperliquid info endpoint.
 * Returns the parsed JSON response. Throws on network/timeout/HTTP errors.
 */
async function postInfo<T>(body: Record<string, unknown>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const resp = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(
        `Hyperliquid API error ${resp.status}: ${text.slice(0, 200)}`,
      );
    }

    return (await resp.json()) as T;
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(
        `Hyperliquid API timeout after ${REQUEST_TIMEOUT_MS}ms`,
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Extract the base coin from a trading pair symbol.
 * "BTC/USDT" -> "BTC", "ETH/USD" -> "ETH", "SOL" -> "SOL"
 */
function extractCoin(symbol: string): string {
  const slash = symbol.indexOf('/');
  if (slash !== -1) {
    return symbol.slice(0, slash).toUpperCase();
  }
  // Strip trailing USDT/USD if present
  const upper = symbol.toUpperCase();
  if (upper.endsWith('USDT')) return upper.slice(0, -4);
  if (upper.endsWith('USD')) return upper.slice(0, -3);
  return upper;
}

/**
 * Lightweight Hyperliquid client implementing ExchangeInterface.
 * Provides real market data (candles, tickers) via direct REST calls.
 * Trading operations are not supported — this is a read-only data source.
 */
export class HyperliquidClient implements ExchangeInterface {
  private prices: Record<string, string> = {};
  private connected = false;

  async connect(): Promise<void> {
    // Verify connectivity by fetching all mid prices
    this.prices = await postInfo<Record<string, string>>({
      type: 'allMids',
    });
    this.connected = true;
  }

  async getCandles(
    symbol: string,
    timeframe: string,
    limit: number,
  ): Promise<Candle[]> {
    const coin = extractCoin(symbol);
    const intervalMs = TIMEFRAME_MS[timeframe];
    if (!intervalMs) {
      throw new Error(
        `Unsupported timeframe "${timeframe}". Supported: ${Object.keys(TIMEFRAME_MS).join(', ')}`,
      );
    }

    const now = Date.now();
    const startTime = now - limit * intervalMs;

    const raw = await postInfo<HyperliquidCandle[]>({
      type: 'candleSnapshot',
      req: {
        coin,
        interval: timeframe,
        startTime,
        endTime: now,
      },
    });

    if (!Array.isArray(raw)) {
      throw new Error(
        `Hyperliquid candleSnapshot returned non-array for ${coin}`,
      );
    }

    return raw.map((c) => ({
      timestamp: c.t,
      open: parseFloat(c.o),
      high: parseFloat(c.h),
      low: parseFloat(c.l),
      close: parseFloat(c.c),
      volume: parseFloat(c.v),
    }));
  }

  async getTicker(symbol: string): Promise<Ticker> {
    const coin = extractCoin(symbol);

    const mids = await postInfo<Record<string, string>>({
      type: 'allMids',
    });

    const midStr = mids[coin];
    if (!midStr) {
      throw new Error(
        `Hyperliquid: no price data for coin "${coin}" (from symbol "${symbol}")`,
      );
    }

    const price = parseFloat(midStr);
    return {
      symbol,
      last: price,
      bid: price,
      ask: price,
      high: price,
      low: price,
      volume: 0,
      timestamp: Date.now(),
    };
  }

  // ── Read-only stubs ────────────────────────────────────────────────────
  // These methods exist to satisfy ExchangeInterface but are not used
  // when this client serves as a market data source.

  async getBalance(): Promise<Balance[]> {
    return [];
  }

  async placeOrder(_req: OrderRequest): Promise<Order> {
    throw new Error('HyperliquidClient is read-only — trading not supported');
  }

  async cancelOrder(_id: string): Promise<Order> {
    throw new Error('HyperliquidClient is read-only — trading not supported');
  }

  async getOpenOrders(): Promise<Order[]> {
    return [];
  }

  async getPositions(): Promise<Position[]> {
    return [];
  }
}
