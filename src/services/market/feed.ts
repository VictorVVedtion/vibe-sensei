/**
 * Real-time market data feed engine.
 * Polls CCXT fetchTicker() at a configurable interval and emits
 * TickerUpdate events via registered callbacks.
 */

import { getConnectedExchange } from '../exchange/singleton.js';
import type { Ticker } from '../exchange/types.js';

export interface TickerUpdate {
  symbol: string;
  last: number;
  bid: number;
  ask: number;
  high: number;
  low: number;
  volume: number;
  timestamp: number;
}

type TickerCallback = (ticker: TickerUpdate) => void;

const DEFAULT_INTERVAL = 5000;
const DEFAULT_SYMBOLS = ['BTC/USDT', 'ETH/USDT'];

export class MarketFeed {
  private symbols: string[];
  private interval: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private callbacks: TickerCallback[] = [];
  private latest: Map<string, TickerUpdate> = new Map();
  private running = false;

  constructor(symbols: string[] = DEFAULT_SYMBOLS) {
    this.symbols = symbols;
    this.interval = DEFAULT_INTERVAL;
  }

  /**
   * Register a callback for ticker updates.
   * Each callback fires once per symbol per poll cycle.
   */
  onUpdate(cb: TickerCallback): void {
    this.callbacks.push(cb);
  }

  /**
   * Return the most recent ticker snapshot for a symbol, if available.
   */
  getLatest(symbol: string): TickerUpdate | undefined {
    return this.latest.get(symbol);
  }

  /**
   * Start polling the exchange for ticker data.
   * Safe to call multiple times -- subsequent calls are no-ops.
   */
  start(interval?: number): void {
    if (this.running) return;
    this.interval = interval ?? DEFAULT_INTERVAL;
    this.running = true;
    // Fire an initial poll immediately, then repeat on the interval.
    this.poll();
    this.timer = setInterval(() => this.poll(), this.interval);
  }

  /**
   * Stop polling. Clears the interval timer but preserves cached data
   * and registered callbacks so the feed can be restarted later.
   */
  stop(): void {
    this.running = false;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  // --- Internal ---------------------------------------------------------

  private async poll(): Promise<void> {
    for (const symbol of this.symbols) {
      try {
        const exchange = await getConnectedExchange();
        const ticker: Ticker = await exchange.getTicker(symbol);
        const update: TickerUpdate = {
          symbol: ticker.symbol,
          last: ticker.last,
          bid: ticker.bid,
          ask: ticker.ask,
          high: ticker.high,
          low: ticker.low,
          volume: ticker.volume,
          timestamp: ticker.timestamp,
        };
        this.latest.set(symbol, update);
        this.emit(update);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[MarketFeed] poll error for ${symbol}: ${msg}`);
        // Continue polling -- never crash the feed loop.
      }
    }
  }

  private emit(update: TickerUpdate): void {
    for (const cb of this.callbacks) {
      try {
        cb(update);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[MarketFeed] callback error: ${msg}`);
      }
    }
  }
}

// --- Singleton factory ---------------------------------------------------

let feedInstance: MarketFeed | null = null;

/**
 * Get (or create) the shared MarketFeed singleton.
 * Optionally override the default symbol list on first creation.
 */
export function getMarketFeed(symbols?: string[]): MarketFeed {
  if (!feedInstance) {
    feedInstance = new MarketFeed(symbols ?? DEFAULT_SYMBOLS);
  }
  return feedInstance;
}
