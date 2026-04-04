/**
 * Chart service entry point.
 * Exports startUdfServer / stopUdfServer for the TradingView UDF data feed.
 * Serves the web/ frontend at the root route.
 * Attaches a WebSocket server for real-time market data push.
 */

import type { Server } from 'http';
import { resolve as pathResolve } from 'path';
import express from 'express';
import { WebSocketServer, type WebSocket } from 'ws';
import { createUdfApp } from './udf-server.js';
import { getMarketFeed, type TickerUpdate } from '../market/feed.js';

let server: Server | null = null;
let wss: WebSocketServer | null = null;

/**
 * Start the TradingView UDF HTTP server on the specified port.
 * Serves UDF API routes and the web frontend from the web/ directory.
 * Attaches a WebSocket server on the same port for live price push.
 * Resolves once the server is listening.
 */
export function startUdfServer(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (server) {
      reject(new Error(`UDF server is already running`));
      return;
    }

    const app = createUdfApp();

    // Serve the web frontend from the web/ directory at the project root.
    // pathResolve walks up from this compiled file to the project root.
    const projectRoot = pathResolve(import.meta.dirname ?? __dirname, '..', '..', '..');
    const webDir = pathResolve(projectRoot, 'web');
    app.use(express.static(webDir));

    // Serve TradingView Charting Library static files for the desktop Electron app.
    // The charting_library directory contains the widget JS/CSS bundles.
    // The datafeeds directory contains the UDF-compatible datafeed adapter.
    const chartingLibDir = pathResolve(projectRoot, 'desktop', 'charting_library', 'charting_library');
    const datafeedsDir = pathResolve(projectRoot, 'desktop', 'charting_library', 'datafeeds');
    app.use('/charting_library', express.static(chartingLibDir));
    app.use('/datafeeds', express.static(datafeedsDir));

    server = app.listen(port, () => {
      console.log(`UDF server listening on http://localhost:${port}`);
      console.log(`Web frontend: http://localhost:${port}/`);
      resolve();
    });

    server.on('error', (error: Error) => {
      server = null;
      reject(new Error(`UDF server failed to start: ${error.message}`));
    });

    // --- WebSocket layer -------------------------------------------------
    attachWebSocket(server);
  });
}

/**
 * Attach a WebSocket server to the existing HTTP server.
 * Manages the market feed lifecycle: starts on first client, stops on last.
 */
function attachWebSocket(httpServer: Server): void {
  wss = new WebSocketServer({ server: httpServer });

  const feed = getMarketFeed();

  // Forward every ticker update to all connected clients.
  feed.onUpdate((update: TickerUpdate) => {
    broadcastTicker(update);
  });

  wss.on('connection', (ws: WebSocket) => {
    console.log('[WS] client connected');

    // Start the feed when the first client arrives.
    if (wss && wss.clients.size === 1) {
      feed.start();
      console.log('[WS] market feed started');
    }

    // Send latest cached prices immediately so the client doesn't wait
    // for the next poll cycle.
    sendLatestPrices(ws, feed);

    ws.on('close', () => {
      console.log('[WS] client disconnected');
      // Stop the feed when the last client leaves.
      if (wss && wss.clients.size === 0) {
        feed.stop();
        console.log('[WS] market feed stopped (no clients)');
      }
    });

    ws.on('error', (err: Error) => {
      console.error(`[WS] client error: ${err.message}`);
    });
  });

  console.log('[WS] WebSocket server attached');
}

/**
 * Send the most recent ticker snapshot for every tracked symbol to a
 * single WebSocket client.
 */
function sendLatestPrices(
  ws: WebSocket,
  feed: ReturnType<typeof getMarketFeed>,
): void {
  const symbols = ['BTC/USDT', 'ETH/USDT'];
  for (const symbol of symbols) {
    const latest = feed.getLatest(symbol);
    if (latest) {
      sendTicker(ws, latest);
    }
  }
}

/**
 * Broadcast a ticker update to every connected WebSocket client.
 */
function broadcastTicker(update: TickerUpdate): void {
  if (!wss) return;
  const message = JSON.stringify({ type: 'ticker', data: update });
  for (const client of wss.clients) {
    if (client.readyState === 1 /* WebSocket.OPEN */) {
      try {
        client.send(message);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[WS] send error: ${msg}`);
      }
    }
  }
}

/**
 * Send a single ticker message to one WebSocket client.
 */
function sendTicker(ws: WebSocket, update: TickerUpdate): void {
  if (ws.readyState !== 1 /* WebSocket.OPEN */) return;
  try {
    ws.send(JSON.stringify({ type: 'ticker', data: update }));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[WS] send error: ${msg}`);
  }
}

/**
 * Gracefully shut down the UDF server and WebSocket layer.
 * No-op if the server is not running.
 */
export function stopUdfServer(): void {
  // Stop the market feed first.
  const feed = getMarketFeed();
  feed.stop();

  // Close all WebSocket connections.
  if (wss) {
    for (const client of wss.clients) {
      try {
        client.close();
      } catch {
        // Ignore close errors during shutdown.
      }
    }
    wss.close();
    wss = null;
  }

  if (!server) {
    return;
  }

  server.close((error?: Error) => {
    if (error) {
      console.error(`[UDF] Error closing server: ${error.message}`);
    } else {
      console.log('[UDF] Server stopped');
    }
  });

  server = null;
}
