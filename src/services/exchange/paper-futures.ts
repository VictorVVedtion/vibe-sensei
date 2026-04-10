/**
 * Paper Futures Exchange — simulated perpetual futures with leverage.
 * Independent implementation (does NOT extend PaperExchange — spot engine is long-only).
 * Supports LONG and SHORT positions, isolated margin, liquidation tracking.
 * Funding rate is display-only in v1 (shown but not deducted from balance).
 */

import type {
  Balance,
  Candle,
  ExchangeInterface,
  FundingRateInfo,
  FuturesInterface,
  MarginMode,
  Order,
  OrderRequest,
  OrderSide,
  Position,
  Ticker,
} from './types.js';
import { getVenueRegistry } from './venue-registry.js';

const DEFAULT_INITIAL_BALANCE = 100_000;
const DEFAULT_FEE_RATE = 0.0005; // 0.05% taker fee (typical perp)
const DEFAULT_PRICE = 50_000;
const DEFAULT_LEVERAGE = 1;
const MAINTENANCE_MARGIN_RATE = 0.005; // 0.5%
const SIMULATED_FUNDING_RATE = 0.0001; // 0.01% per 8h
const FUNDING_INTERVAL_MS = 8 * 3_600_000;

interface FuturesPositionState {
  symbol: string;
  side: 'long' | 'short';
  quantity: number;
  entryPrice: number;
  leverage: number;
  margin: number; // isolated margin locked for this position
  realizedPnl: number;
}

function generateId(): string {
  return `paper-fut-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Calculate liquidation price for a futures position.
 * Long: liqPrice = entry * (1 - 1/(leverage * (1 + maintenanceMargin)))
 * Short: liqPrice = entry * (1 + 1/(leverage * (1 + maintenanceMargin)))
 */
export function calcLiquidationPrice(
  entryPrice: number,
  leverage: number,
  side: 'long' | 'short',
): number {
  const factor = 1 / (leverage * (1 + MAINTENANCE_MARGIN_RATE));
  if (side === 'long') {
    return entryPrice * (1 - factor);
  }
  return entryPrice * (1 + factor);
}

/**
 * Calculate unrealized PnL for a futures position.
 * Long: (currentPrice - entryPrice) * quantity
 * Short: (entryPrice - currentPrice) * quantity
 * Multiply by leverage for leveraged PnL on margin.
 */
function calcUnrealizedPnl(
  pos: FuturesPositionState,
  currentPrice: number,
): number {
  if (pos.side === 'long') {
    return (currentPrice - pos.entryPrice) * pos.quantity;
  }
  return (pos.entryPrice - currentPrice) * pos.quantity;
}

export class PaperFuturesExchange implements FuturesInterface {
  private balance: { free: number; used: number };
  private orders: Map<string, Order>;
  private positions: Map<string, FuturesPositionState>;
  private leverageSettings: Map<string, number>;
  private prices: Map<string, number>;
  private connected = false;
  private readonly feeRate: number;
  private readonly marketDataSource: ExchangeInterface | null;
  private marketDataConnected = false;

  constructor(
    initialBalance?: number,
    marketDataSource?: ExchangeInterface,
  ) {
    const bal = initialBalance ?? DEFAULT_INITIAL_BALANCE;
    this.balance = { free: bal, used: 0 };
    this.orders = new Map();
    this.positions = new Map();
    this.leverageSettings = new Map();
    this.prices = new Map();
    this.feeRate = DEFAULT_FEE_RATE;
    this.marketDataSource = marketDataSource ?? null;
  }

  async connect(): Promise<void> {
    this.connected = true;
    const registry = getVenueRegistry();
    registry.register('paper-futures', {
      vertical: 'perp_futures',
      exchange: this,
    });
    registry.markConnected('paper-futures');
  }

  async setLeverage(leverage: number, symbol: string): Promise<void> {
    this.ensureConnected();
    if (leverage < 1 || leverage > 125) {
      throw new Error(`Leverage must be between 1 and 125, got: ${leverage}`);
    }
    this.leverageSettings.set(symbol, leverage);
  }

  async getFundingRate(_symbol: string): Promise<FundingRateInfo> {
    this.ensureConnected();
    const now = Date.now();
    const nextFundingTime =
      Math.ceil(now / FUNDING_INTERVAL_MS) * FUNDING_INTERVAL_MS;
    return {
      rate: SIMULATED_FUNDING_RATE,
      nextTime: nextFundingTime,
    };
  }

  async setMarginMode(mode: MarginMode, _symbol: string): Promise<void> {
    this.ensureConnected();
    if (mode !== 'isolated') {
      throw new Error('Paper futures v1 only supports isolated margin mode');
    }
  }

  async getBalance(): Promise<Balance[]> {
    this.ensureConnected();
    return [
      {
        currency: 'USDT',
        free: this.balance.free,
        used: this.balance.used,
        total: this.balance.free + this.balance.used,
      },
    ];
  }

  async placeOrder(req: OrderRequest): Promise<Order> {
    this.ensureConnected();
    this.validateOrderRequest(req);
    const order = this.createOrderFromRequest(req);
    this.orders.set(order.id, order);

    if (req.type === 'market') {
      return this.executeMarketOrder(order);
    }

    // For limit/stop_loss: reserve margin and wait
    this.reserveMarginForOrder(order);
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
    this.releaseMarginForOrder(order);
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
      const currentPrice = this.resolveSymbolPrice(pos.symbol);
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
    if (await this.ensureMarketDataConnected()) {
      try {
        const candles = await this.marketDataSource!.getCandles(
          symbol,
          timeframe,
          limit,
        );
        if (candles.length > 0) {
          this.prices.set(symbol, candles[candles.length - 1]!.close);
          return candles;
        }
      } catch {
        // Fall back to synthetic candles
      }
    }
    const price = this.resolveSymbolPrice(symbol);
    return this.generateSyntheticCandles(price, limit);
  }

  async getTicker(symbol: string): Promise<Ticker> {
    this.ensureConnected();
    if (await this.ensureMarketDataConnected()) {
      try {
        const ticker = await this.marketDataSource!.getTicker(symbol);
        this.prices.set(symbol, ticker.last);
        return ticker;
      } catch {
        // Fall back to simulated ticker
      }
    }
    const price = this.resolveSymbolPrice(symbol);
    const spread = price * 0.0005;
    return {
      symbol,
      last: price,
      bid: price - spread,
      ask: price + spread,
      high: price * 1.02,
      low: price * 0.98,
      volume: 5000,
      timestamp: Date.now(),
    };
  }

  /**
   * Update a simulated price and check for liquidations + pending orders.
   */
  updatePrice(symbol: string, price: number): void {
    if (price <= 0) {
      throw new Error(`Price must be positive, got: ${price}`);
    }
    this.prices.set(symbol, price);
    this.checkLiquidations(symbol, price);
    this.checkPendingOrders(symbol, price);
  }

  // ── Private: Connection ──────────────────────────────────────────────────

  private ensureConnected(): void {
    if (!this.connected) {
      throw new Error(
        'Paper futures exchange not connected. Call connect() first.',
      );
    }
  }

  private async ensureMarketDataConnected(): Promise<boolean> {
    if (!this.marketDataSource) return false;
    if (this.marketDataConnected) return true;
    try {
      await this.marketDataSource.connect();
      this.marketDataConnected = true;
      return true;
    } catch {
      return false;
    }
  }

  // ── Private: Order Validation ────────────────────────────────────────────

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

  // ── Private: Order Execution ─────────────────────────────────────────────

  private executeMarketOrder(order: Order): Order {
    const price = this.resolveExecutionPrice(order);
    this.executeFill(order, price);
    return { ...order };
  }

  private resolveExecutionPrice(order: Order): number {
    if (order.price != null && order.price > 0) return order.price;
    return this.resolveSymbolPrice(order.symbol);
  }

  private resolveSymbolPrice(symbol: string): number {
    return this.prices.get(symbol) ?? DEFAULT_PRICE;
  }

  private executeFill(order: Order, price: number): void {
    const existingPos = this.positions.get(order.symbol);
    const isClosing = this.isClosingOrder(order, existingPos);

    if (isClosing && existingPos) {
      this.closePosition(order, existingPos, price);
    } else {
      this.openOrAddToPosition(order, price);
    }

    const cost = price * order.quantity;
    const fee = cost * this.feeRate;
    order.filledQuantity = order.quantity;
    order.avgFillPrice = price;
    order.fee = fee;
    order.status = 'filled';
    order.updatedAt = new Date();
  }

  /**
   * Determine if this order closes an existing position.
   * Buy closes short, sell closes long.
   */
  private isClosingOrder(
    order: Order,
    pos: FuturesPositionState | undefined,
  ): boolean {
    if (!pos || pos.quantity <= 0) return false;
    if (order.side === 'buy' && pos.side === 'short') return true;
    if (order.side === 'sell' && pos.side === 'long') return true;
    return false;
  }

  /**
   * Close (fully or partially) an existing position.
   * Calculates realized PnL based on leveraged notional.
   */
  private closePosition(
    order: Order,
    pos: FuturesPositionState,
    price: number,
  ): void {
    const closeQty = Math.min(order.quantity, pos.quantity);
    const pnl = this.calcRealizedPnl(pos, price, closeQty);
    const fee = price * closeQty * this.feeRate;

    // Release margin proportionally
    const marginRelease = pos.margin * (closeQty / pos.quantity);
    this.balance.free += marginRelease + pnl - fee;
    this.balance.used -= marginRelease;

    pos.realizedPnl += pnl;
    pos.quantity -= closeQty;
    pos.margin -= marginRelease;

    // If the order quantity exceeds position, open reverse position
    const remaining = order.quantity - closeQty;
    if (remaining > 0) {
      const reverseOrder: Order = { ...order, quantity: remaining };
      this.openOrAddToPosition(reverseOrder, price);
    }
  }

  private calcRealizedPnl(
    pos: FuturesPositionState,
    exitPrice: number,
    quantity: number,
  ): number {
    if (pos.side === 'long') {
      return (exitPrice - pos.entryPrice) * quantity;
    }
    return (pos.entryPrice - exitPrice) * quantity;
  }

  /**
   * Open a new position or add to an existing same-direction position.
   * Deducts isolated margin from free balance.
   */
  private openOrAddToPosition(order: Order, price: number): void {
    const leverage = this.leverageSettings.get(order.symbol) ?? DEFAULT_LEVERAGE;
    const notional = price * order.quantity;
    const margin = notional / leverage;
    const fee = notional * this.feeRate;
    const totalCost = margin + fee;

    if (this.balance.free < totalCost) {
      throw new Error(
        `Insufficient margin: need ${totalCost.toFixed(2)} USDT ` +
        `(${margin.toFixed(2)} margin + ${fee.toFixed(2)} fee), ` +
        `have ${this.balance.free.toFixed(2)} USDT`,
      );
    }

    this.balance.free -= totalCost;
    this.balance.used += margin;

    const side: 'long' | 'short' = order.side === 'buy' ? 'long' : 'short';
    const existing = this.positions.get(order.symbol);

    if (existing && existing.quantity > 0 && existing.side === side) {
      this.addToExistingPosition(existing, order.quantity, price, margin, leverage);
    } else {
      this.createNewPosition(order.symbol, side, order.quantity, price, margin, leverage);
    }
  }

  private addToExistingPosition(
    pos: FuturesPositionState,
    quantity: number,
    price: number,
    margin: number,
    leverage: number,
  ): void {
    const totalQty = pos.quantity + quantity;
    pos.entryPrice =
      (pos.entryPrice * pos.quantity + price * quantity) / totalQty;
    pos.quantity = totalQty;
    pos.margin += margin;
    pos.leverage = leverage;
  }

  private createNewPosition(
    symbol: string,
    side: 'long' | 'short',
    quantity: number,
    price: number,
    margin: number,
    leverage: number,
  ): void {
    this.positions.set(symbol, {
      symbol,
      side,
      quantity,
      entryPrice: price,
      leverage,
      margin,
      realizedPnl: 0,
    });
  }

  // ── Private: Margin Management ───────────────────────────────────────────

  private reserveMarginForOrder(order: Order): void {
    const leverage = this.leverageSettings.get(order.symbol) ?? DEFAULT_LEVERAGE;
    const price = order.price ?? order.stopPrice ?? this.resolveSymbolPrice(order.symbol);
    const notional = price * order.quantity;
    const margin = notional / leverage;
    const fee = notional * this.feeRate;
    const totalCost = margin + fee;

    if (this.balance.free < totalCost) {
      throw new Error(
        `Insufficient margin for order: need ${totalCost.toFixed(2)}, ` +
        `have ${this.balance.free.toFixed(2)}`,
      );
    }
    this.balance.free -= totalCost;
    this.balance.used += totalCost;
  }

  private releaseMarginForOrder(order: Order): void {
    const leverage = this.leverageSettings.get(order.symbol) ?? DEFAULT_LEVERAGE;
    const price = order.price ?? order.stopPrice ?? this.resolveSymbolPrice(order.symbol);
    const notional = price * order.quantity;
    const margin = notional / leverage;
    const fee = notional * this.feeRate;
    const totalCost = margin + fee;

    this.balance.used -= totalCost;
    this.balance.free += totalCost;
  }

  // ── Private: Liquidation ─────────────────────────────────────────────────

  private checkLiquidations(symbol: string, price: number): void {
    const pos = this.positions.get(symbol);
    if (!pos || pos.quantity <= 0) return;

    const liqPrice = calcLiquidationPrice(
      pos.entryPrice,
      pos.leverage,
      pos.side,
    );
    const isLiquidated =
      pos.side === 'long' ? price <= liqPrice : price >= liqPrice;

    if (isLiquidated) {
      this.liquidatePosition(pos);
    }
  }

  private liquidatePosition(pos: FuturesPositionState): void {
    // Full liquidation — margin is lost
    this.balance.used -= pos.margin;
    pos.realizedPnl -= pos.margin;
    pos.quantity = 0;
    pos.margin = 0;
  }

  // ── Private: Pending Orders ──────────────────────────────────────────────

  private checkPendingOrders(symbol: string, price: number): void {
    for (const order of this.orders.values()) {
      if (order.symbol !== symbol || order.status !== 'open') continue;
      if (this.shouldTriggerOrder(order, price)) {
        this.executeFill(order, price);
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
    // Stop-loss on a long (sell stop): triggers when price drops to stopPrice
    // Stop-loss on a short (buy stop): triggers when price rises to stopPrice
    if (order.side === 'sell') return price <= order.stopPrice;
    return price >= order.stopPrice;
  }

  // ── Private: Position Building ───────────────────────────────────────────

  private buildPosition(
    pos: FuturesPositionState,
    currentPrice: number,
  ): Position {
    const unrealizedPnl = calcUnrealizedPnl(pos, currentPrice);
    const costBasis = pos.entryPrice * pos.quantity;
    return {
      symbol: pos.symbol,
      side: pos.side === 'long' ? 'buy' : 'sell',
      quantity: pos.quantity,
      entryPrice: pos.entryPrice,
      currentPrice,
      unrealizedPnl,
      unrealizedPnlPercent:
        costBasis > 0 ? (unrealizedPnl / costBasis) * 100 : 0,
      realizedPnl: pos.realizedPnl,
    };
  }

  // ── Private: Synthetic Data ──────────────────────────────────────────────

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
        volume: Math.random() * 500 + 50,
      });
    }
    return candles;
  }
}
