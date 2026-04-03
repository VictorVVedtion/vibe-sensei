/**
 * Paper trading exchange: simulated order execution, position tracking,
 * and P&L calculation for risk-free practice.
 *
 * Optionally delegates market data (getTicker, getCandles) to a real
 * exchange via CCXT, falling back to synthetic data on failure.
 */

import type {
  Balance,
  Candle,
  ExchangeInterface,
  Fill,
  Order,
  OrderRequest,
  OrderSide,
  Position,
  Ticker,
} from './types.js';
import { InvalidSymbolError } from './ccxt-client.js';

const DEFAULT_INITIAL_BALANCE = 100_000;
const DEFAULT_FEE_RATE = 0.001;
const DEFAULT_PRICE = 50_000;

/**
 * Static allowlist for offline symbol validation when no market data
 * source is available. Covers major Binance spot pairs.
 */
const VALID_SYMBOLS = new Set([
  'BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT',
  'ADA/USDT', 'DOGE/USDT', 'AVAX/USDT', 'DOT/USDT', 'MATIC/USDT',
  'LINK/USDT', 'UNI/USDT', 'ATOM/USDT', 'LTC/USDT', 'NEAR/USDT',
  'APT/USDT', 'ARB/USDT', 'OP/USDT', 'SUI/USDT', 'PEPE/USDT',
]);

interface PaperConfig {
  initialBalance?: number;
  feeRate?: number;
}

interface PositionState {
  symbol: string;
  side: OrderSide;
  quantity: number;
  entryPrice: number;
  realizedPnl: number;
}

function generateId(): string {
  return `paper-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export class PaperExchange implements ExchangeInterface {
  private balances: Map<string, { free: number; used: number }>;
  private orders: Map<string, Order>;
  private fills: Fill[];
  private positions: Map<string, PositionState>;
  private prices: Map<string, number>;
  private connected: boolean;
  private readonly feeRate: number;
  private marketDataSource?: ExchangeInterface;
  private marketDataConnected: boolean;

  constructor(config?: PaperConfig, marketDataSource?: ExchangeInterface) {
    const initialBalance = config?.initialBalance ?? DEFAULT_INITIAL_BALANCE;
    this.feeRate = config?.feeRate ?? DEFAULT_FEE_RATE;
    this.balances = new Map([
      ['USDT', { free: initialBalance, used: 0 }],
    ]);
    this.orders = new Map();
    this.fills = [];
    this.positions = new Map();
    this.prices = new Map();
    this.connected = false;
    this.marketDataSource = marketDataSource;
    this.marketDataConnected = false;
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async getBalance(): Promise<Balance[]> {
    this.ensureConnected();
    const result: Balance[] = [];
    for (const [currency, bal] of this.balances) {
      result.push({
        currency,
        free: bal.free,
        used: bal.used,
        total: bal.free + bal.used,
      });
    }
    return result;
  }

  async placeOrder(req: OrderRequest): Promise<Order> {
    this.ensureConnected();
    await this.validateSymbol(req.symbol);
    this.validateOrderRequest(req);

    const order = this.createOrderFromRequest(req);
    this.orders.set(order.id, order);

    if (req.type === 'market') {
      return this.executeMarketOrder(order);
    }

    this.reserveFundsForOrder(order);
    return { ...order };
  }

  async cancelOrder(id: string): Promise<Order> {
    this.ensureConnected();
    const order = this.orders.get(id);
    if (!order) {
      throw new Error(`Order not found: ${id}`);
    }
    if (order.status === 'filled' || order.status === 'cancelled') {
      throw new Error(`Cannot cancel order with status: ${order.status}`);
    }
    this.releaseFundsForOrder(order);
    order.status = 'cancelled';
    order.updatedAt = new Date();
    return { ...order };
  }

  async getOpenOrders(symbol?: string): Promise<Order[]> {
    this.ensureConnected();
    const result: Order[] = [];
    for (const order of this.orders.values()) {
      if (order.status !== 'open') continue;
      if (symbol && order.symbol !== symbol) continue;
      result.push({ ...order });
    }
    return result;
  }

  async getPositions(): Promise<Position[]> {
    this.ensureConnected();
    const result: Position[] = [];
    for (const pos of this.positions.values()) {
      if (pos.quantity <= 0) continue;
      const currentPrice = this.prices.get(pos.symbol) ?? pos.entryPrice;
      result.push(this.buildPosition(pos, currentPrice));
    }
    return result;
  }

  async getCandles(
    symbol: string,
    timeframe: string,
    limit: number,
  ): Promise<Candle[]> {
    this.ensureConnected();
    const realCandles = await this.fetchRealCandles(symbol, timeframe, limit);
    if (realCandles) return realCandles;
    const price = this.prices.get(symbol) ?? DEFAULT_PRICE;
    return this.generateSyntheticCandles(price, limit);
  }

  async getTicker(symbol: string): Promise<Ticker> {
    this.ensureConnected();
    const realTicker = await this.fetchRealTicker(symbol);
    if (realTicker) return realTicker;
    return this.buildSyntheticTicker(symbol);
  }

  /**
   * Update the simulated price for a symbol.
   * Triggers pending limit/stop orders if their conditions are met.
   */
  updatePrice(symbol: string, price: number): void {
    if (price <= 0) {
      throw new Error(`Price must be positive, got: ${price}`);
    }
    this.prices.set(symbol, price);
    this.checkPendingOrders(symbol, price);
  }

  getFills(): Fill[] {
    return [...this.fills];
  }

  // ── Market data source (lazy connection) ──────────────────────────

  /**
   * Connect to the market data source on first use.
   * Returns true if connected, false if unavailable.
   * Connection is attempted only once; failure disables the source.
   */
  private async ensureMarketDataConnected(): Promise<boolean> {
    if (!this.marketDataSource) return false;
    if (this.marketDataConnected) return true;
    try {
      await this.marketDataSource.connect();
      this.marketDataConnected = true;
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[Paper] Market data source unavailable: ${msg}`);
      this.marketDataSource = undefined;
      return false;
    }
  }

  /**
   * Fetch real candle data from the market data source.
   * Returns null on failure so the caller can fall back to synthetic.
   */
  private async fetchRealCandles(
    symbol: string,
    timeframe: string,
    limit: number,
  ): Promise<Candle[] | null> {
    if (!(await this.ensureMarketDataConnected())) return null;
    try {
      return await this.marketDataSource!.getCandles(symbol, timeframe, limit);
    } catch {
      return null;
    }
  }

  /**
   * Fetch real ticker from the market data source and cache the price.
   * Returns null on failure so the caller can fall back to synthetic.
   */
  private async fetchRealTicker(symbol: string): Promise<Ticker | null> {
    if (!(await this.ensureMarketDataConnected())) return null;
    try {
      const ticker = await this.marketDataSource!.getTicker(symbol);
      this.prices.set(symbol, ticker.last);
      return ticker;
    } catch {
      return null;
    }
  }

  private buildSyntheticTicker(symbol: string): Ticker {
    const price = this.prices.get(symbol) ?? DEFAULT_PRICE;
    const spread = price * 0.0005;
    return {
      symbol,
      last: price,
      bid: price - spread,
      ask: price + spread,
      high: price * 1.02,
      low: price * 0.98,
      volume: 1000,
      timestamp: Date.now(),
    };
  }

  // ── Internals ─────────────────────────────────────────────────────

  private ensureConnected(): void {
    if (!this.connected) {
      throw new Error(
        'Paper exchange not connected. Call connect() first.',
      );
    }
  }

  /**
   * Validate that a symbol is a known trading pair.
   * If the market data source is available, it validates via getTicker().
   * Otherwise falls back to the static VALID_SYMBOLS allowlist.
   */
  private async validateSymbol(symbol: string): Promise<void> {
    if (await this.ensureMarketDataConnected()) {
      try {
        const ticker = await this.marketDataSource!.getTicker(symbol);
        this.prices.set(symbol, ticker.last);
        return;
      } catch (err: unknown) {
        if (err instanceof InvalidSymbolError) {
          throw new InvalidSymbolError(symbol);
        }
        // Network/timeout errors: fall through to static check
      }
    }
    if (!VALID_SYMBOLS.has(symbol)) {
      throw new InvalidSymbolError(symbol);
    }
  }

  private validateOrderRequest(req: OrderRequest): void {
    if (req.quantity <= 0) {
      throw new Error(`Quantity must be positive, got: ${req.quantity}`);
    }
    if (req.type === 'limit' && (req.price == null || req.price <= 0)) {
      throw new Error('Limit orders require a positive price');
    }
    if (
      req.type === 'stop_loss' &&
      (req.stopPrice == null || req.stopPrice <= 0)
    ) {
      throw new Error('Stop loss orders require a positive stopPrice');
    }
  }

  private createOrderFromRequest(req: OrderRequest): Order {
    return {
      id: generateId(),
      symbol: req.symbol,
      side: req.side,
      type: req.type,
      quantity: req.quantity,
      price: req.price,
      stopPrice: req.stopPrice,
      status: 'open',
      filledQuantity: 0,
      avgFillPrice: 0,
      fee: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  private async executeMarketOrder(order: Order): Promise<Order> {
    const price = await this.resolveExecutionPrice(order);
    this.executeFill(order, price, order.quantity);
    return { ...order };
  }

  /**
   * Resolve execution price for a market order:
   * 1. Explicit order price
   * 2. Cached price from previous ticker fetch
   * 3. Real-time price from market data source
   * 4. DEFAULT_PRICE fallback
   */
  private async resolveExecutionPrice(order: Order): Promise<number> {
    if (order.price != null && order.price > 0) return order.price;
    const cached = this.prices.get(order.symbol);
    if (cached) return cached;
    const ticker = await this.fetchRealTicker(order.symbol);
    if (ticker) return ticker.last;
    return DEFAULT_PRICE;
  }

  private executeFill(order: Order, price: number, quantity: number): void {
    const cost = price * quantity;
    const fee = cost * this.feeRate;
    this.deductCost(order.side, cost, fee, order.symbol, quantity);
    this.recordFill(order, price, quantity, fee);
    this.updatePositionFromFill(order.symbol, order.side, quantity, price, fee);
    order.filledQuantity = quantity;
    order.avgFillPrice = price;
    order.fee = fee;
    order.status = 'filled';
    order.updatedAt = new Date();
  }

  private deductCost(
    side: OrderSide,
    cost: number,
    fee: number,
    symbol: string,
    quantity: number,
  ): void {
    if (side === 'buy') {
      const usdt = this.getOrCreateBalance('USDT');
      const totalCost = cost + fee;
      if (usdt.free < totalCost) {
        throw new Error(
          `Insufficient USDT balance: need ${totalCost.toFixed(2)}, have ${usdt.free.toFixed(2)}`,
        );
      }
      usdt.free -= totalCost;
    } else {
      this.validateSellQuantity(symbol, quantity);
    }
  }

  private validateSellQuantity(symbol: string, quantity: number): void {
    const pos = this.positions.get(symbol);
    if (!pos || pos.quantity < quantity) {
      const available = pos?.quantity ?? 0;
      throw new Error(
        `Insufficient position: need ${quantity}, have ${available} of ${symbol}`,
      );
    }
  }

  private recordFill(
    order: Order,
    price: number,
    quantity: number,
    fee: number,
  ): void {
    this.fills.push({
      id: generateId(),
      orderId: order.id,
      symbol: order.symbol,
      side: order.side,
      price,
      quantity,
      fee,
      timestamp: new Date(),
    });
  }

  private updatePositionFromFill(
    symbol: string,
    side: OrderSide,
    quantity: number,
    price: number,
    fee: number,
  ): void {
    if (side === 'buy') {
      this.addToPosition(symbol, quantity, price);
    } else {
      this.reducePosition(symbol, quantity, price, fee);
    }
  }

  private addToPosition(
    symbol: string,
    quantity: number,
    price: number,
  ): void {
    const existing = this.positions.get(symbol);
    if (existing && existing.quantity > 0) {
      const totalQty = existing.quantity + quantity;
      existing.entryPrice =
        (existing.entryPrice * existing.quantity + price * quantity) / totalQty;
      existing.quantity = totalQty;
    } else {
      this.positions.set(symbol, {
        symbol,
        side: 'buy',
        quantity,
        entryPrice: price,
        realizedPnl: existing?.realizedPnl ?? 0,
      });
    }
  }

  private reducePosition(
    symbol: string,
    quantity: number,
    price: number,
    fee: number,
  ): void {
    const pos = this.positions.get(symbol);
    if (!pos) return;
    const pnl = (price - pos.entryPrice) * quantity - fee;
    pos.realizedPnl += pnl;
    pos.quantity -= quantity;
    const usdt = this.getOrCreateBalance('USDT');
    usdt.free += price * quantity - fee;
    if (pos.quantity <= 0) {
      pos.quantity = 0;
    }
  }

  private reserveFundsForOrder(order: Order): void {
    if (order.side !== 'buy') return;
    const price = order.price ?? order.stopPrice ?? DEFAULT_PRICE;
    const cost = price * order.quantity;
    const fee = cost * this.feeRate;
    const usdt = this.getOrCreateBalance('USDT');
    if (usdt.free < cost + fee) {
      throw new Error(
        `Insufficient USDT for order: need ${(cost + fee).toFixed(2)}, have ${usdt.free.toFixed(2)}`,
      );
    }
    usdt.free -= cost + fee;
    usdt.used += cost + fee;
  }

  private releaseFundsForOrder(order: Order): void {
    if (order.side !== 'buy') return;
    const price = order.price ?? order.stopPrice ?? DEFAULT_PRICE;
    const cost = price * order.quantity;
    const fee = cost * this.feeRate;
    const usdt = this.getOrCreateBalance('USDT');
    usdt.used -= cost + fee;
    usdt.free += cost + fee;
  }

  private checkPendingOrders(symbol: string, price: number): void {
    for (const order of this.orders.values()) {
      if (order.symbol !== symbol || order.status !== 'open') continue;
      if (this.shouldTriggerOrder(order, price)) {
        this.executeFill(order, price, order.quantity);
      }
    }
  }

  private shouldTriggerOrder(order: Order, price: number): boolean {
    if (order.type === 'limit') {
      return this.isLimitTriggered(order, price);
    }
    if (order.type === 'stop_loss' && order.stopPrice != null) {
      return this.isStopTriggered(order, price);
    }
    return false;
  }

  private isLimitTriggered(order: Order, price: number): boolean {
    if (order.price == null) return false;
    if (order.side === 'buy') return price <= order.price;
    return price >= order.price;
  }

  private isStopTriggered(order: Order, price: number): boolean {
    if (order.stopPrice == null) return false;
    if (order.side === 'sell') return price <= order.stopPrice;
    return price >= order.stopPrice;
  }

  private buildPosition(pos: PositionState, currentPrice: number): Position {
    const unrealizedPnl = (currentPrice - pos.entryPrice) * pos.quantity;
    const costBasis = pos.entryPrice * pos.quantity;
    return {
      symbol: pos.symbol,
      side: pos.side,
      quantity: pos.quantity,
      entryPrice: pos.entryPrice,
      currentPrice,
      unrealizedPnl,
      unrealizedPnlPercent: costBasis > 0 ? (unrealizedPnl / costBasis) * 100 : 0,
      realizedPnl: pos.realizedPnl,
    };
  }

  private generateSyntheticCandles(price: number, limit: number): Candle[] {
    const candles: Candle[] = [];
    const interval = 60_000;
    const now = Date.now();
    for (let i = limit - 1; i >= 0; i--) {
      const variation = 1 + (Math.random() - 0.5) * 0.02;
      const open = price * variation;
      const close = price * (1 + (Math.random() - 0.5) * 0.02);
      const high = Math.max(open, close) * (1 + Math.random() * 0.005);
      const low = Math.min(open, close) * (1 - Math.random() * 0.005);
      candles.push({
        timestamp: now - i * interval,
        open,
        high,
        low,
        close,
        volume: Math.random() * 100 + 10,
      });
    }
    return candles;
  }

  private getOrCreateBalance(
    currency: string,
  ): { free: number; used: number } {
    let bal = this.balances.get(currency);
    if (!bal) {
      bal = { free: 0, used: 0 };
      this.balances.set(currency, bal);
    }
    return bal;
  }
}
