/**
 * Chart service entry point.
 * Exports startUdfServer / stopUdfServer for the TradingView UDF data feed.
 * Serves the web/ frontend at the root route.
 */

import type { Server } from 'http';
import { resolve as pathResolve } from 'path';
import express from 'express';
import { createUdfApp } from './udf-server.js';

let server: Server | null = null;

/**
 * Start the TradingView UDF HTTP server on the specified port.
 * Serves UDF API routes and the web frontend from the web/ directory.
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
    const webDir = pathResolve(import.meta.dirname ?? __dirname, '..', '..', '..', 'web');
    app.use(express.static(webDir));

    server = app.listen(port, () => {
      console.log(`UDF server listening on http://localhost:${port}`);
      console.log(`Web frontend: http://localhost:${port}/`);
      resolve();
    });

    server.on('error', (error: Error) => {
      server = null;
      reject(new Error(`UDF server failed to start: ${error.message}`));
    });
  });
}

/**
 * Gracefully shut down the UDF server.
 * No-op if the server is not running.
 */
export function stopUdfServer(): void {
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
