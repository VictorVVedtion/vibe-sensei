/**
 * Exchange service factory.
 * Returns a PaperExchange for paper mode (default) or CcxtClient for live trading.
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
 * Create an exchange instance based on configuration.
 * Defaults to paper trading mode when no config is provided.
 */
export function createExchange(config?: ExchangeConfig): ExchangeInterface {
  const resolvedConfig: ExchangeConfig = config ?? { mode: 'paper' };

  if (resolvedConfig.mode === 'live') {
    return new CcxtClient(resolvedConfig);
  }

  return new PaperExchange();
}
