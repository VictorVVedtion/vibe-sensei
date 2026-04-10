/**
 * Chart service entry point.
 * Exports startUdfServer / stopUdfServer for the TradingView UDF data feed.
 * Serves the web/ frontend at the root route.
 * Attaches WebSocket servers for real-time market data and AI chat.
 *
 * WebSocket routing:
 *   /ws/market — live ticker feed (TradingView)
 *   /ws/chat   — AI chat streaming (desktop ChatPanel)
 *   (default)  — market feed (backward compat)
 */

import type { Server, IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import { resolve as pathResolve } from 'path';
import express from 'express';
import { WebSocketServer, type WebSocket } from 'ws';
import { createUdfApp, getChartToken } from './udf-server.js';
import { isLocalOrigin } from './origin-utils.js';
import { getMarketFeed, type TickerUpdate } from '../market/feed.js';
import { handleChatConnection } from '../chat/chat-ws.js';

let server: Server | null = null;
let marketWss: WebSocketServer | null = null;
let chatWss: WebSocketServer | null = null;

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
    const projectRoot = process.cwd();
    const webDir = pathResolve(projectRoot, 'web');
    app.use(express.static(webDir));

    // Serve TradingView Charting Library static files for the desktop Electron app.
    // The charting_library directory contains the widget JS/CSS bundles.
    // The datafeeds directory contains the UDF-compatible datafeed adapter.
    const chartingLibDir = pathResolve(projectRoot, 'desktop', 'charting_library', 'charting_library');
    const datafeedsDir = pathResolve(projectRoot, 'desktop', 'charting_library', 'datafeeds');
    app.use('/charting_library', express.static(chartingLibDir));
    app.use('/datafeeds', express.static(datafeedsDir));

    // Custom 404 handler — must be AFTER all static file serving
    app.use((_req: any, res: any) => {
      res.status(404).json({ error: 'Not found' });
    });

    // SECURITY: bind to loopback only. Without an explicit host, Node defaults
    // to all interfaces (::), which exposes the chat WebSocket and screenshot
    // endpoints to the entire LAN. The chat WS feeds the AI agent directly,
    // so an unauthenticated LAN attacker could drive trades.
    server = app.listen(port, '127.0.0.1', () => {
      console.log(`UDF server listening on http://127.0.0.1:${port}`);
      console.log(`Web frontend: http://127.0.0.1:${port}/`);
      console.log(`Chart screenshot token: ${getChartToken()}`);
      resolve();
    });

    server.on('error', (error: Error) => {
      server = null;
      reject(new Error(`UDF server failed to start: ${error.message}`));
    });

    // --- WebSocket layer -------------------------------------------------
    attachWebSockets(server);
  });
}

/**
 * Attach path-routed WebSocket servers to the HTTP server.
 * /ws/market (or bare /) → market ticker feed
 * /ws/chat → AI chat streaming
 */
function attachWebSockets(httpServer: Server): void {
  // Create two independent WSS instances with noServer — we handle upgrade manually.
  marketWss = new WebSocketServer({ noServer: true });
  chatWss = new WebSocketServer({ noServer: true });

  // ── Market feed WSS ──────────────────────────────────────────────────
  const feed = getMarketFeed();

  feed.onUpdate((update: TickerUpdate) => {
    broadcastTicker(update);
  });

  marketWss.on('connection', (ws: WebSocket) => {
    console.log('[WS:market] client connected');

    if (marketWss && marketWss.clients.size === 1) {
      feed.start();
      console.log('[WS:market] feed started');
    }

    sendLatestPrices(ws, feed);

    ws.on('close', () => {
      console.log('[WS:market] client disconnected');
      if (marketWss && marketWss.clients.size === 0) {
        feed.stop();
        console.log('[WS:market] feed stopped (no clients)');
      }
    });

    ws.on('error', (err: Error) => {
      console.error(`[WS:market] error: ${err.message}`);
    });
  });

  // ── Chat WSS ─────────────────────────────────────────────────────────
  chatWss.on('connection', (ws: WebSocket) => {
    handleChatConnection(ws);
  });

  // SECURITY: chat WebSocket feeds user text directly into the AI agent,
  // which has access to all trading tools. Defence-in-depth on top of the
  // loopback bind: reject upgrades from non-local origins so a malicious
  // page in the user's browser cannot do fetch('http://localhost:3456/ws/chat').
  httpServer.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const origin = req.headers.origin as string | undefined;
    if (!isLocalOrigin(origin ?? '')) {
      console.warn(`[WS] Rejected upgrade from non-local origin: ${origin}`);
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }

    const pathname = new URL(req.url ?? '/', `http://${req.headers.host}`).pathname;

    if (pathname === '/ws/chat') {
      chatWss!.handleUpgrade(req, socket, head, (ws) => {
        chatWss!.emit('connection', ws, req);
      });
    } else {
      // /ws/market or bare connection (backward compat for TradingView)
      marketWss!.handleUpgrade(req, socket, head, (ws) => {
        marketWss!.emit('connection', ws, req);
      });
    }
  });

  console.log('[WS] WebSocket servers attached (market + chat)');
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
  if (!marketWss) return;
  const message = JSON.stringify({ type: 'ticker', data: update });
  for (const client of marketWss.clients) {
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

  // Close all WebSocket connections (both market and chat).
  for (const wss of [marketWss, chatWss]) {
    if (wss) {
      for (const client of wss.clients) {
        try {
          client.close();
        } catch {
          // Ignore close errors during shutdown.
        }
      }
      wss.close();
    }
  }
  marketWss = null;
  chatWss = null;

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
