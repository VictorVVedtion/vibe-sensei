/**
 * Sprint 149: Validation tests for PaperExchange.
 *
 * Covers the 6 RAMPAGE findings against fail-open parameter validation in
 * src/services/exchange/paper-trading.ts. Each describe pairs the bad input
 * (which previously slipped through silently) with the matching valid input
 * to prove the fix is targeted, not a blanket rejection.
 *
 *   RAMPAGE-009 — negative initialBalance
 *   RAMPAGE-010 — NaN initialBalance
 *   RAMPAGE-011 — invalid order type
 *   RAMPAGE-012 — NaN price in updatePrice
 *   RAMPAGE-013 — Infinity price in updatePrice
 *   RAMPAGE-016 — symbol with NUL/BEL/ANSI control chars (terminal injection)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PaperExchange } from '../paper-trading.js';

let exchange: PaperExchange;

beforeEach(async () => {
  exchange = new PaperExchange();
  await exchange.connect();
});

describe('RAMPAGE-009: negative initialBalance', () => {
  it('rejects negative initialBalance with a clear error', () => {
    expect(() => new PaperExchange({ initialBalance: -1_000_000 })).toThrow(
      /initialBalance must be a finite non-negative number/,
    );
  });

  it('accepts zero initialBalance (boundary)', async () => {
    const ex = new PaperExchange({ initialBalance: 0 });
    await ex.connect();
    const balances = await ex.getBalance();
    const usdt = balances.find((b) => b.currency === 'USDT')!;
    expect(usdt.free).toBe(0);
  });

  it('accepts a positive initialBalance', async () => {
    const ex = new PaperExchange({ initialBalance: 50_000 });
    await ex.connect();
    const balances = await ex.getBalance();
    const usdt = balances.find((b) => b.currency === 'USDT')!;
    expect(usdt.free).toBe(50_000);
  });
});

describe('RAMPAGE-010: NaN / non-finite initialBalance', () => {
  it('rejects NaN initialBalance', () => {
    expect(() => new PaperExchange({ initialBalance: NaN })).toThrow(
      /initialBalance must be a finite non-negative number/,
    );
  });

  it('rejects Infinity initialBalance', () => {
    expect(() => new PaperExchange({ initialBalance: Infinity })).toThrow(
      /initialBalance must be a finite non-negative number/,
    );
  });

  it('also validates feeRate (NaN, negative, >= 1)', () => {
    expect(() => new PaperExchange({ feeRate: NaN })).toThrow(
      /feeRate must be a finite number/,
    );
    expect(() => new PaperExchange({ feeRate: -0.01 })).toThrow(
      /feeRate must be a finite number/,
    );
    expect(() => new PaperExchange({ feeRate: 1 })).toThrow(
      /feeRate must be a finite number/,
    );
  });

  it('still accepts a sensible feeRate', () => {
    expect(() => new PaperExchange({ feeRate: 0.001 })).not.toThrow();
    expect(() => new PaperExchange({ feeRate: 0 })).not.toThrow();
  });
});

describe('RAMPAGE-011: invalid order type', () => {
  it('rejects unknown order type with whitelist error', async () => {
    await expect(
      exchange.placeOrder({
        symbol: 'BTC/USDT',
        side: 'buy',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        type: 'INVALID_TYPE' as any,
        quantity: 1,
      }),
    ).rejects.toThrow(
      /Invalid order type: INVALID_TYPE\. Must be one of: market, limit, stop_loss/,
    );
  });

  it('rejects NaN quantity (previously fell through `quantity <= 0`)', async () => {
    await expect(
      exchange.placeOrder({
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        quantity: NaN,
      }),
    ).rejects.toThrow(/Quantity must be a finite positive number/);
  });

  it('rejects Infinity quantity', async () => {
    await expect(
      exchange.placeOrder({
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        quantity: Infinity,
      }),
    ).rejects.toThrow(/Quantity must be a finite positive number/);
  });

  it('still accepts a valid market order', async () => {
    exchange.updatePrice('BTC/USDT', 50_000);
    const order = await exchange.placeOrder({
      symbol: 'BTC/USDT',
      side: 'buy',
      type: 'market',
      quantity: 0.001,
    });
    expect(order.status).toBe('filled');
    expect(order.type).toBe('market');
  });
});

describe('RAMPAGE-012: NaN price in updatePrice', () => {
  it('rejects NaN price', () => {
    expect(() => exchange.updatePrice('BTC/USDT', NaN)).toThrow(
      /Price must be a finite positive number/,
    );
  });

  it('still accepts a finite positive price', () => {
    expect(() => exchange.updatePrice('BTC/USDT', 50_000)).not.toThrow();
  });
});

describe('RAMPAGE-013: Infinity price in updatePrice', () => {
  it('rejects positive Infinity price', () => {
    expect(() => exchange.updatePrice('BTC/USDT', Infinity)).toThrow(
      /Price must be a finite positive number/,
    );
  });

  it('rejects negative Infinity price', () => {
    expect(() => exchange.updatePrice('BTC/USDT', -Infinity)).toThrow(
      /Price must be a finite positive number/,
    );
  });

  it('rejects zero and negative prices (existing behavior preserved)', () => {
    expect(() => exchange.updatePrice('BTC/USDT', 0)).toThrow(
      /Price must be a finite positive number/,
    );
    expect(() => exchange.updatePrice('BTC/USDT', -42)).toThrow(
      /Price must be a finite positive number/,
    );
  });
});

describe('RAMPAGE-016: symbol with control / ANSI escape chars', () => {
  it('rejects NUL byte in symbol on placeOrder', async () => {
    await expect(
      exchange.placeOrder({
        symbol: 'BTC\x00/USDT',
        side: 'buy',
        type: 'market',
        quantity: 0.001,
      }),
    ).rejects.toThrow(/Invalid symbol/);
  });

  it('rejects BEL + ANSI escape combo (terminal injection vector)', async () => {
    await expect(
      exchange.placeOrder({
        symbol: 'BTC\x07\x1b[31m/USDT',
        side: 'buy',
        type: 'market',
        quantity: 0.001,
      }),
    ).rejects.toThrow(/Invalid symbol/);
  });

  it('rejects control chars in updatePrice symbol', () => {
    expect(() => exchange.updatePrice('BTC\x00/USDT', 50_000)).toThrow(
      /Invalid symbol/,
    );
  });

  it('accepts standard pair formats: BTC/USDT, BTC-USDT, BTC/USDT:USDT', async () => {
    expect(() => exchange.updatePrice('BTC/USDT', 50_000)).not.toThrow();
    expect(() => exchange.updatePrice('BTC-USDT', 50_000)).not.toThrow();
    expect(() => exchange.updatePrice('BTC/USDT:USDT', 50_000)).not.toThrow();

    const order = await exchange.placeOrder({
      symbol: 'BTC/USDT',
      side: 'buy',
      type: 'market',
      quantity: 0.001,
    });
    expect(order.status).toBe('filled');
  });
});
