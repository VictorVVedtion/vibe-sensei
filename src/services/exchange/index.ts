/**
 * Exchange service factory.
 * Returns a PaperExchange for paper mode (default) or CcxtClient for live trading.
 * Market data sourced from Hyperliquid (no CCXT needed for read-only data).
 */

export { CcxtClient } from './ccxt-client.js';
export {
  ExchangeTimeoutError,
  InsufficientFundsError,
  InvalidSymbolError,
  RateLimitError,
  NetworkError,
} from './ccxt-client.js';
export { HyperliquidClient } from './hyperliquid-client.js';
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
import { HyperliquidClient } from './hyperliquid-client.js';
import { PaperExchange } from './paper-trading.js';

/**
 * Create the market data source — Hyperliquid direct API (no CCXT).
 * Used by PaperExchange for real candle/ticker data.
 */
function createMarketDataSource(): ExchangeInterface {
  return new HyperliquidClient();
}

/**
 * Create an exchange instance based on configuration.
 * Defaults to paper trading mode when no config is provided.
 * Paper mode uses Hyperliquid as the market data source for real prices.
 */
export function createExchange(config?: ExchangeConfig): ExchangeInterface {
  const resolvedConfig: ExchangeConfig = config ?? { mode: 'paper' };

  if (resolvedConfig.mode === 'live') {
    return new CcxtClient(resolvedConfig);
  }

  return new PaperExchange(undefined, createMarketDataSource());
}
