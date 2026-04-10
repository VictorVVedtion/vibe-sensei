/**
 * Exchange service type definitions for trading operations.
 * Covers orders, positions, balances, market data, and configuration.
 */

export type OrderSide = 'buy' | 'sell';

export type OrderType = 'market' | 'limit' | 'stop_loss';

export type OrderStatus =
  | 'open'
  | 'filled'
  | 'partially_filled'
  | 'cancelled'
  | 'expired';

export interface Order {
  id: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  price?: number;
  stopPrice?: number;
  status: OrderStatus;
  filledQuantity: number;
  avgFillPrice: number;
  fee: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Position {
  symbol: string;
  side: OrderSide;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  realizedPnl: number;
}

export interface Balance {
  currency: string;
  free: number;
  used: number;
  total: number;
}

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Fill {
  id: string;
  orderId: string;
  symbol: string;
  side: OrderSide;
  price: number;
  quantity: number;
  fee: number;
  timestamp: Date;
}

export interface ExchangeConfig {
  mode: 'paper' | 'live';
  exchange?: string;
  apiKey?: string;
  secret?: string;
  testnet?: boolean;
}

export interface OrderRequest {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  price?: number;
  stopPrice?: number;
}

export interface Ticker {
  symbol: string;
  last: number;
  bid: number;
  ask: number;
  high: number;
  low: number;
  volume: number;
  timestamp: number;
}

export interface ExchangeInterface {
  connect(): Promise<void>;
  getBalance(): Promise<Balance[]>;
  placeOrder(req: OrderRequest): Promise<Order>;
  cancelOrder(id: string, symbol?: string): Promise<Order>;
  getOpenOrders(symbol?: string): Promise<Order[]>;
  getPositions(): Promise<Position[]>;
  getCandles(
    symbol: string,
    timeframe: string,
    limit: number,
  ): Promise<Candle[]>;
  getTicker(symbol: string): Promise<Ticker>;
}

// ── Multi-Venue Vertical Types (Sprint 92) ──────────────────────────────────

export type TradingVertical =
  | 'spot' | 'perp_futures' | 'crypto_options'
  | 'stocks' | 'defi_dex' | 'prediction' | 'forex'

export interface FuturesInterface extends ExchangeInterface {
  setLeverage(symbol: string, leverage: number): Promise<void>
  getFundingRate(symbol: string): Promise<{ rate: number; nextTime: number }>
  setMarginMode(symbol: string, mode: 'cross' | 'isolated'): Promise<void>
}

export interface OptionsInterface extends ExchangeInterface {
  getOptionsChain(underlying: string, expiry?: string): Promise<OptionsChainEntry[]>
  getGreeks(symbol: string): Promise<Greeks>
}

export interface OptionsChainEntry {
  symbol: string; strike: number; expiry: string; type: 'call' | 'put'
  bid: number; ask: number; iv: number; volume: number; openInterest: number
}

export interface Greeks {
  delta: number; gamma: number; theta: number; vega: number; rho: number
}

export interface SwapQuoteRequest {
  fromToken: string; toToken: string; amount: number; slippageBps?: number
}

export interface SwapQuote {
  fromToken: string; toToken: string; fromAmount: number; toAmount: number
  price: number; priceImpact: number; estimatedGasUSD: number; route: string
  expiresAt: number
}

export interface SwapResult {
  txHash: string; fromAmount: number; toAmount: number; gasUsed: number
  status: 'confirmed' | 'pending' | 'failed'
}

export interface DEXInterface {
  connect(): Promise<void>
  getQuote(params: SwapQuoteRequest): Promise<SwapQuote>
  executeSwap(quote: SwapQuote): Promise<SwapResult>
  getBalance(): Promise<Balance[]>
}

export interface PredictionMarket {
  id: string; question: string; outcomes: string[]; volume: number
  endDate: string; currentPrices: number[]
}

export interface PredictionOrder {
  id: string; marketId: string; outcome: string; shares: number
  price: number; status: OrderStatus; createdAt: Date
}

export interface PredictionPosition {
  marketId: string; outcome: string; shares: number; avgPrice: number
  currentPrice: number; unrealizedPnl: number
}

export interface PredictionInterface {
  connect(): Promise<void>
  getMarkets(query?: string): Promise<PredictionMarket[]>
  placeBet(marketId: string, outcome: string, amount: number, price?: number): Promise<PredictionOrder>
  getPositions(): Promise<PredictionPosition[]>
  getBalance(): Promise<Balance[]>
}

// Discriminated VenueAdapter union
export type VenueAdapter =
  | { vertical: 'spot' | 'perp_futures' | 'crypto_options' | 'stocks' | 'forex'; exchange: ExchangeInterface }
  | { vertical: 'defi_dex'; dex: DEXInterface }
  | { vertical: 'prediction'; prediction: PredictionInterface }

export class VenueTypeMismatchError extends Error {
  constructor(expected: string, actual: string) {
    super(`Expected ${expected} venue, got ${actual}`)
    this.name = 'VenueTypeMismatchError'
  }
}
