/**
 * Tests for PaperFuturesExchange — perpetual futures paper trading engine.
 * Covers: long/short positions, leverage, liquidation, PnL, margin, stop-loss, funding rate.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  PaperFuturesExchange,
  calcLiquidationPrice,
} from '../paper-futures.js';
import { clearVenues, getExchangeByVertical } from '../venue-registry.js';

let exchange: PaperFuturesExchange;

beforeEach(async () => {
  clearVenues();
  exchange = new PaperFuturesExchange(100_000);
  await exchange.connect();
});

describe('PaperFuturesExchange', () => {
  describe('long positions', () => {
    it('opens a long position and tracks entry price + leverage', async () => {
      await exchange.setLeverage(10, 'BTC/USDT:USDT');
      exchange.updatePrice('BTC/USDT:USDT', 50_000);

      await exchange.placeOrder({
        symbol: 'BTC/USDT:USDT',
        side: 'buy',
        type: 'market',
        quantity: 1,
      });

      const positions = await exchange.getPositions();
      expect(positions.length).toBe(1);
      expect(positions[0]!.symbol).toBe('BTC/USDT:USDT');
      expect(positions[0]!.side).toBe('buy');
      expect(positions[0]!.quantity).toBe(1);
      expect(positions[0]!.entryPrice).toBe(50_000);

      // With 10x leverage, margin should be 50000/10 = 5000
      const balances = await exchange.getBalance();
      const usdt = balances.find((b) => b.currency === 'USDT')!;
      // 100000 - 5000 margin - 25 fee (50000 * 0.0005)
      expect(usdt.free).toBeCloseTo(94_975, 0);
    });

    it('closes a long position with positive PnL', async () => {
      await exchange.setLeverage(5, 'BTC/USDT:USDT');
      exchange.updatePrice('BTC/USDT:USDT', 50_000);

      await exchange.placeOrder({
        symbol: 'BTC/USDT:USDT',
        side: 'buy',
        type: 'market',
        quantity: 1,
      });

      // Price moves up
      exchange.updatePrice('BTC/USDT:USDT', 55_000);

      // Close long by selling
      await exchange.placeOrder({
        symbol: 'BTC/USDT:USDT',
        side: 'sell',
        type: 'market',
        quantity: 1,
      });

      const positions = await exchange.getPositions();
      expect(positions.length).toBe(0);

      // PnL: (55000 - 50000) * 1 = 5000
      // Balance should reflect profit minus fees
      const balances = await exchange.getBalance();
      const usdt = balances.find((b) => b.currency === 'USDT')!;
      // 100000 + 5000 pnl - 25 open fee - 27.5 close fee
      expect(usdt.total).toBeCloseTo(104_947.5, 0);
    });
  });

  describe('short positions', () => {
    it('opens a short position', async () => {
      await exchange.setLeverage(10, 'ETH/USDT:USDT');
      exchange.updatePrice('ETH/USDT:USDT', 3_000);

      await exchange.placeOrder({
        symbol: 'ETH/USDT:USDT',
        side: 'sell',
        type: 'market',
        quantity: 10,
      });

      const positions = await exchange.getPositions();
      expect(positions.length).toBe(1);
      expect(positions[0]!.side).toBe('sell');
      expect(positions[0]!.quantity).toBe(10);
      expect(positions[0]!.entryPrice).toBe(3_000);
    });

    it('closes a short position with positive PnL when price drops', async () => {
      await exchange.setLeverage(5, 'ETH/USDT:USDT');
      exchange.updatePrice('ETH/USDT:USDT', 3_000);

      await exchange.placeOrder({
        symbol: 'ETH/USDT:USDT',
        side: 'sell',
        type: 'market',
        quantity: 10,
      });

      // Price drops — good for short
      exchange.updatePrice('ETH/USDT:USDT', 2_700);

      // Close short by buying
      await exchange.placeOrder({
        symbol: 'ETH/USDT:USDT',
        side: 'buy',
        type: 'market',
        quantity: 10,
      });

      const positions = await exchange.getPositions();
      expect(positions.length).toBe(0);

      // PnL: (3000 - 2700) * 10 = 3000
      const balances = await exchange.getBalance();
      const usdt = balances.find((b) => b.currency === 'USDT')!;
      // 100000 + 3000 - opening fee (30000*0.0005=15) - closing fee (27000*0.0005=13.5)
      expect(usdt.total).toBeCloseTo(102_971.5, 0);
    });
  });

  describe('liquidation price calculation', () => {
    it('calculates correct liquidation price for long at 10x', () => {
      const liqPrice = calcLiquidationPrice(50_000, 10, 'long');
      // liqPrice = 50000 * (1 - 1/(10 * 1.005))
      // = 50000 * (1 - 1/10.05)
      // = 50000 * (1 - 0.09950...)
      // = 50000 * 0.90049...
      // ≈ 45024.88
      expect(liqPrice).toBeCloseTo(45_024.88, 0);
    });

    it('calculates correct liquidation price for short at 10x', () => {
      const liqPrice = calcLiquidationPrice(50_000, 10, 'short');
      // liqPrice = 50000 * (1 + 1/(10 * 1.005))
      // = 50000 * (1 + 0.09950...)
      // = 50000 * 1.09950...
      // ≈ 54975.12
      expect(liqPrice).toBeCloseTo(54_975.12, 0);
    });

    it('liquidation price at 1x is far from entry', () => {
      const longLiq = calcLiquidationPrice(50_000, 1, 'long');
      // 1x: liqPrice = 50000 * (1 - 1/(1 * 1.005)) ≈ 50000 * 0.00498 ≈ 248.76
      expect(longLiq).toBeLessThan(1_000);
    });
  });

  describe('close position with PnL and leverage', () => {
    it('leveraged long amplifies PnL on margin', async () => {
      await exchange.setLeverage(10, 'BTC/USDT:USDT');
      exchange.updatePrice('BTC/USDT:USDT', 50_000);

      await exchange.placeOrder({
        symbol: 'BTC/USDT:USDT',
        side: 'buy',
        type: 'market',
        quantity: 1,
      });

      // 10% price increase
      exchange.updatePrice('BTC/USDT:USDT', 55_000);

      const positions = await exchange.getPositions();
      // Unrealized PnL: (55000 - 50000) * 1 = 5000
      expect(positions[0]!.unrealizedPnl).toBeCloseTo(5_000, 0);
      // As percentage of notional: 5000/50000 = 10%
      expect(positions[0]!.unrealizedPnlPercent).toBeCloseTo(10, 0);
    });
  });

  describe('insufficient margin rejection', () => {
    it('rejects order when margin is insufficient', async () => {
      await exchange.setLeverage(1, 'BTC/USDT:USDT');
      exchange.updatePrice('BTC/USDT:USDT', 50_000);

      // Try to open a 3 BTC position at 1x = 150000 USDT margin > 100000
      await expect(
        exchange.placeOrder({
          symbol: 'BTC/USDT:USDT',
          side: 'buy',
          type: 'market',
          quantity: 3,
        }),
      ).rejects.toThrow('Insufficient margin');
    });

    it('allows large position with high leverage', async () => {
      await exchange.setLeverage(100, 'BTC/USDT:USDT');
      exchange.updatePrice('BTC/USDT:USDT', 50_000);

      // 3 BTC at 100x = 1500 USDT margin, well within 100000
      const order = await exchange.placeOrder({
        symbol: 'BTC/USDT:USDT',
        side: 'buy',
        type: 'market',
        quantity: 3,
      });

      expect(order.status).toBe('filled');
    });
  });

  describe('stop-loss order execution', () => {
    it('triggers stop-loss on long when price drops', async () => {
      await exchange.setLeverage(10, 'BTC/USDT:USDT');
      exchange.updatePrice('BTC/USDT:USDT', 50_000);

      // Open long
      await exchange.placeOrder({
        symbol: 'BTC/USDT:USDT',
        side: 'buy',
        type: 'market',
        quantity: 1,
      });

      // Place stop-loss (sell stop at 48000)
      await exchange.placeOrder({
        symbol: 'BTC/USDT:USDT',
        side: 'sell',
        type: 'stop_loss',
        quantity: 1,
        stopPrice: 48_000,
      });

      const openOrders = await exchange.getOpenOrders();
      expect(openOrders.length).toBe(1);

      // Price drops below stop
      exchange.updatePrice('BTC/USDT:USDT', 47_500);

      // Stop should have triggered — position closed
      const positions = await exchange.getPositions();
      expect(positions.length).toBe(0);

      const remainingOrders = await exchange.getOpenOrders();
      expect(remainingOrders.length).toBe(0);
    });
  });

  describe('multiple positions on different symbols', () => {
    it('tracks independent positions per symbol', async () => {
      await exchange.setLeverage(10, 'BTC/USDT:USDT');
      await exchange.setLeverage(5, 'ETH/USDT:USDT');
      exchange.updatePrice('BTC/USDT:USDT', 50_000);
      exchange.updatePrice('ETH/USDT:USDT', 3_000);

      await exchange.placeOrder({
        symbol: 'BTC/USDT:USDT',
        side: 'buy',
        type: 'market',
        quantity: 1,
      });

      await exchange.placeOrder({
        symbol: 'ETH/USDT:USDT',
        side: 'sell',
        type: 'market',
        quantity: 10,
      });

      const positions = await exchange.getPositions();
      expect(positions.length).toBe(2);

      const btcPos = positions.find((p) => p.symbol === 'BTC/USDT:USDT')!;
      const ethPos = positions.find((p) => p.symbol === 'ETH/USDT:USDT')!;

      expect(btcPos.side).toBe('buy');
      expect(btcPos.quantity).toBe(1);

      expect(ethPos.side).toBe('sell');
      expect(ethPos.quantity).toBe(10);
    });
  });

  describe('funding rate', () => {
    it('returns simulated funding rate', async () => {
      const funding = await exchange.getFundingRate('BTC/USDT:USDT');
      expect(funding.rate).toBe(0.0001);
      expect(funding.nextTime).toBeGreaterThan(Date.now() - 1000);
    });
  });

  describe('venue registry integration', () => {
    it('auto-registers as perp_futures on connect', () => {
      const futuresExchange = getExchangeByVertical('perp_futures');
      expect(futuresExchange).toBe(exchange);
    });
  });

  describe('margin mode', () => {
    it('accepts isolated margin mode', async () => {
      await expect(
        exchange.setMarginMode('isolated', 'BTC/USDT:USDT'),
      ).resolves.toBeUndefined();
    });

    it('rejects cross margin mode in v1', async () => {
      await expect(
        exchange.setMarginMode('cross', 'BTC/USDT:USDT'),
      ).rejects.toThrow('isolated');
    });
  });

  describe('liquidation via price update', () => {
    it('liquidates long position when price drops past liquidation', async () => {
      await exchange.setLeverage(10, 'BTC/USDT:USDT');
      exchange.updatePrice('BTC/USDT:USDT', 50_000);

      await exchange.placeOrder({
        symbol: 'BTC/USDT:USDT',
        side: 'buy',
        type: 'market',
        quantity: 1,
      });

      // Calculate exact liquidation price and drop below it
      const liqPrice = calcLiquidationPrice(50_000, 10, 'long');
      exchange.updatePrice('BTC/USDT:USDT', liqPrice - 100);

      const positions = await exchange.getPositions();
      expect(positions.length).toBe(0);

      // Margin is lost on liquidation
      const balances = await exchange.getBalance();
      const usdt = balances.find((b) => b.currency === 'USDT')!;
      // Started at 100000, lost 5000 margin + 25 fee
      expect(usdt.total).toBeCloseTo(94_975, 0);
    });
  });
});
