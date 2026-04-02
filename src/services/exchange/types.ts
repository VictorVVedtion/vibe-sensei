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
