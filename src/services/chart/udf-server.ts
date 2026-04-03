/**
 * TradingView UDF (Universal Data Feed) HTTP server.
 * Serves OHLCV chart data via Express endpoints conforming to the UDF protocol.
 * Start with --web flag on port 3456.
 */

import type { Request, Response, Express } from 'express';
import express from 'express';
import { LRUCache } from 'lru-cache';
import { getConnectedExchange } from '../exchange/singleton.js';
import type { Candle } from '../exchange/types.js';

type CandleResponse = { s: string; t: number[]; o: number[]; h: number[]; l: number[]; c: number[]; v: number[] };

// ── Screenshot Buffer ────────────────────────────────────────────────────
// The browser-side chart periodically POSTs a PNG screenshot here.
// GET /api/screenshot returns the latest stored image.

let latestScreenshot: Buffer | null = null;
let screenshotTimestamp: number = 0;
const SCREENSHOT_MAX_AGE_MS = 60_000; // 1 minute staleness threshold
const SCREENSHOT_MAX_SIZE = 5 * 1024 * 1024; // 5MB max

const candleCache = new LRUCache<string, CandleResponse>({
  max: 200,
  ttl: 3 * 60 * 1000, // 3 minutes
});

const inflight = new Map<string, Promise<CandleResponse | null>>();

const SUPPORTED_RESOLUTIONS = ['1', '5', '15', '30', '60', '240', '1D', '1W'];

const POPULAR_PAIRS = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
  'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'DOTUSDT', 'MATICUSDT',
  'LINKUSDT', 'UNIUSDT', 'ATOMUSDT', 'LTCUSDT', 'NEARUSDT',
  'APTUSDT', 'ARBUSDT', 'OPUSDT', 'SUIUSDT', 'PEPEUSDT',
];

const RESOLUTION_TO_TIMEFRAME: Record<string, string> = {
  '1': '1m',
  '5': '5m',
  '15': '15m',
  '30': '30m',
  '60': '1h',
  '240': '4h',
  '1D': '1d',
  '1W': '1w',
};



function symbolToExchangeFormat(symbol: string): string {
  const upper = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (upper.endsWith('USDT')) {
    const base = upper.slice(0, -4);
    return `${base}/USDT`;
  }
  if (upper.endsWith('USD')) {
    const base = upper.slice(0, -3);
    return `${base}/USD`;
  }
  return `${upper.slice(0, 3)}/${upper.slice(3)}`;
}

function pricescaleForSymbol(symbol: string): number {
  const upper = symbol.toUpperCase();
  if (upper.startsWith('BTC') || upper.startsWith('ETH')) return 100;
  if (upper.startsWith('DOGE') || upper.startsWith('PEPE')) return 100000;
  return 10000;
}

function descriptionForSymbol(symbol: string): string {
  const upper = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (upper.endsWith('USDT')) {
    return `${upper.slice(0, -4)}/USDT`;
  }
  return upper;
}

/** GET /config — Datafeed configuration */
function handleConfig(_req: Request, res: Response): void {
  res.json({
    supported_resolutions: SUPPORTED_RESOLUTIONS,
    supports_search: true,
    supports_group_request: false,
    supports_marks: true,
    supports_timescale_marks: false,
    supports_time: true,
    exchanges: [{ value: '', name: 'All Exchanges', desc: '' }],
  });
}

/** GET /time — Current server unix timestamp in seconds */
function handleTime(_req: Request, res: Response): void {
  res.send(String(Math.floor(Date.now() / 1000)));
}

/** GET /search — Search symbols by query string */
function handleSearch(req: Request, res: Response): void {
  const query = String(req.query.query ?? '').toUpperCase();
  const limit = Math.min(Number(req.query.limit) || 10, 30);

  const matches = POPULAR_PAIRS
    .filter((pair) => pair.includes(query))
    .slice(0, limit)
    .map((pair) => ({
      symbol: pair,
      full_name: pair,
      description: descriptionForSymbol(pair),
      exchange: 'Binance',
      ticker: pair,
      type: 'crypto',
    }));

  res.json(matches);
}

/** GET /symbols — Symbol info for a specific symbol */
function handleSymbols(req: Request, res: Response): void {
  const symbol = String(req.query.symbol ?? '').toUpperCase();
  if (!symbol) {
    res.status(400).json({ s: 'error', errmsg: 'Missing symbol parameter' });
    return;
  }

  res.json({
    name: symbol,
    ticker: symbol,
    description: descriptionForSymbol(symbol),
    type: 'crypto',
    session: '24x7',
    timezone: 'Etc/UTC',
    minmov: 1,
    pricescale: pricescaleForSymbol(symbol),
    has_intraday: true,
    supported_resolutions: SUPPORTED_RESOLUTIONS,
    has_daily: true,
  });
}

async function fetchCandles(
  symbol: string,
  resolution: string,
  timeframe: string,
  from: number,
  to: number,
): Promise<CandleResponse | null> {
  const ex = await getConnectedExchange();
  const exchangeSymbol = symbolToExchangeFormat(symbol);
  const limit = computeCandleLimit(from, to, resolution);

  let candles: Candle[];
  try {
    candles = await ex.getCandles(exchangeSymbol, timeframe, limit);
  } catch (originalError: unknown) {
    // Retry once after 500ms on transient errors
    await new Promise(resolve => setTimeout(resolve, 500));
    try {
      candles = await ex.getCandles(exchangeSymbol, timeframe, limit);
    } catch {
      throw originalError;
    }
  }

  const filtered = filterCandlesByRange(candles, from, to);

  if (filtered.length === 0) {
    return null;
  }

  return formatCandlesResponse(filtered);
}

/** GET /history — OHLCV bars for charting */
async function handleHistory(req: Request, res: Response): Promise<void> {
  const symbol = String(req.query.symbol ?? '');
  const resolution = String(req.query.resolution ?? '60');
  const from = Number(req.query.from) || 0;
  const to = Number(req.query.to) || Math.floor(Date.now() / 1000);

  if (!symbol) {
    res.status(400).json({ s: 'error', errmsg: 'Missing symbol parameter' });
    return;
  }

  const timeframe = RESOLUTION_TO_TIMEFRAME[resolution];
  if (!timeframe) {
    res.status(400).json({ s: 'error', errmsg: `Unsupported resolution: ${resolution}` });
    return;
  }

  const cacheKey = `${symbol}:${resolution}:${from}:${to}`;

  const cached = candleCache.get(cacheKey);
  if (cached) {
    res.json(cached);
    return;
  }

  try {
    let pending = inflight.get(cacheKey);
    if (!pending) {
      pending = fetchCandles(symbol, resolution, timeframe, from, to).finally(() => {
        inflight.delete(cacheKey);
      });
      inflight.set(cacheKey, pending);
    }

    const result = await pending;

    if (result === null) {
      res.json({ s: 'no_data', nextTime: null });
      return;
    }

    candleCache.set(cacheKey, result);
    res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[UDF] /history error for ${symbol}: ${message}`);
    res.status(500).json({ s: 'error', errmsg: message });
  }
}

function computeCandleLimit(from: number, to: number, resolution: string): number {
  const resolutionSeconds: Record<string, number> = {
    '1': 60, '5': 300, '15': 900, '30': 1800,
    '60': 3600, '240': 14400, '1D': 86400, '1W': 604800,
  };
  const interval = resolutionSeconds[resolution] ?? 3600;
  const span = to - from;
  const estimated = Math.ceil(span / interval);
  return Math.max(10, Math.min(estimated + 5, 1000));
}

function filterCandlesByRange(candles: Candle[], from: number, to: number): Candle[] {
  const fromMs = from * 1000;
  const toMs = to * 1000;
  return candles.filter((c) => c.timestamp >= fromMs && c.timestamp <= toMs);
}

function formatCandlesResponse(candles: Candle[]): {
  s: string;
  t: number[];
  o: number[];
  h: number[];
  l: number[];
  c: number[];
  v: number[];
} {
  return {
    s: 'ok',
    t: candles.map((c) => Math.floor(c.timestamp / 1000)),
    o: candles.map((c) => c.open),
    h: candles.map((c) => c.high),
    l: candles.map((c) => c.low),
    c: candles.map((c) => c.close),
    v: candles.map((c) => c.volume),
  };
}

/** GET /marks — Placeholder for trade markers (future sprint) */
function handleMarks(_req: Request, res: Response): void {
  res.json([]);
}

/** GET /api/screenshot — Return the latest chart screenshot as PNG */
function handleScreenshotGet(_req: Request, res: Response): void {
  if (!latestScreenshot) {
    res.status(404).json({ error: 'No screenshot available. Is the chart frontend open?' });
    return;
  }

  // Check staleness
  const age = Date.now() - screenshotTimestamp;
  if (age > SCREENSHOT_MAX_AGE_MS) {
    res.status(404).json({ error: 'Screenshot is stale. Open the chart frontend to refresh.' });
    return;
  }

  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Content-Length', String(latestScreenshot.byteLength));
  res.setHeader('X-Screenshot-Age-Ms', String(age));
  res.send(latestScreenshot);
}

/** POST /api/screenshot — Receive a chart screenshot from the browser frontend */
function handleScreenshotPost(req: Request, res: Response): void {
  const chunks: Buffer[] = [];
  let totalSize = 0;

  req.on('data', (chunk: Buffer) => {
    totalSize += chunk.length;
    if (totalSize > SCREENSHOT_MAX_SIZE) {
      res.status(413).json({ error: 'Screenshot too large' });
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });

  req.on('end', () => {
    if (totalSize === 0) {
      res.status(400).json({ error: 'Empty screenshot body' });
      return;
    }
    const buf = Buffer.concat(chunks);

    // Validate PNG magic bytes: \x89PNG\r\n\x1a\n
    const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    if (buf.length < 8 || !buf.subarray(0, 8).equals(PNG_MAGIC)) {
      res.status(400).json({ error: 'Invalid image: not a PNG file' });
      return;
    }

    latestScreenshot = buf;
    screenshotTimestamp = Date.now();
    res.json({ ok: true, size: latestScreenshot.byteLength });
  });

  req.on('error', (err: Error) => {
    console.error(`[UDF] Screenshot upload error: ${err.message}`);
    res.status(500).json({ error: 'Upload failed' });
  });
}

/** Attach all UDF routes to an Express app instance */
export function mountUdfRoutes(app: Express): void {
  app.get('/config', handleConfig);
  app.get('/time', handleTime);
  app.get('/search', handleSearch);
  app.get('/symbols', handleSymbols);
  app.get('/history', (req, res) => {
    handleHistory(req, res).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[UDF] Unhandled error in /history: ${message}`);
      res.status(500).json({ s: 'error', errmsg: 'Internal server error' });
    });
  });
  app.get('/marks', handleMarks);
  app.get('/api/screenshot', handleScreenshotGet);
  app.post('/api/screenshot', handleScreenshotPost);
}

/** Create a configured Express app with CORS and UDF routes */
export function createUdfApp(): Express {
  const app = express();

  app.use((_req: Request, res: Response, next: () => void) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
  });

  app.options('*', (_req: Request, res: Response) => {
    res.sendStatus(204);
  });

  mountUdfRoutes(app);

  return app;
}
