/**
 * Exchange service factory.
 * Returns a PaperExchange for paper mode (default) or CcxtClient for live trading.
 * Paper mode injects a read-only Binance CCXT client for real market prices.
 */

export { CcxtClient } from './ccxt-client.js';
export {
  ExchangeTimeoutError,
  InsufficientFundsError,
  InvalidSymbolError,
  RateLimitError,
  NetworkError,
} from './ccxt-client.js';
export { PaperExchange } from './paper-trading.js';
export type {
  Balance,
  Candle,
  ExchangeConfig,
  ExchangeInterface,
  Fill,
  Order,
  OrderRequest,
  OrderSide,
  OrderStatus,
  OrderType,
  Position,
  Ticker,
} from './types.js';

import type { ExchangeConfig, ExchangeInterface } from './types.js';
import { CcxtClient } from './ccxt-client.js';
import { PaperExchange } from './paper-trading.js';

/**
 * Create a read-only CCXT client for public market data.
 * Uses OKX public API (no API key required) for getTicker and getCandles.
 * Connection is deferred — PaperExchange connects lazily on first use.
 */
function createMarketDataSource(): ExchangeInterface {
  return new CcxtClient({
    mode: 'live',
    exchange: 'okx',
  });
}

/**
 * Create an exchange instance based on configuration.
 * Defaults to paper trading mode when no config is provided.
 * Paper mode receives a OKX market data source for real prices.
 */
export function createExchange(config?: ExchangeConfig): ExchangeInterface {
  const resolvedConfig: ExchangeConfig = config ?? { mode: 'paper' };

  if (resolvedConfig.mode === 'live') {
    return new CcxtClient(resolvedConfig);
  }

  const marketData = createMarketDataSource();
  return new PaperExchange(undefined, marketData);
}
