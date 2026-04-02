/**
 * Chart service entry point.
 * Exports startUdfServer / stopUdfServer for the TradingView UDF data feed.
 */

import type { Server } from 'http';
import { createUdfApp } from './udf-server.js';

let server: Server | null = null;

/**
 * Start the TradingView UDF HTTP server on the specified port.
 * Resolves once the server is listening.
 */
export function startUdfServer(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (server) {
      reject(new Error(`UDF server is already running`));
      return;
    }

    const app = createUdfApp();

    server = app.listen(port, () => {
      console.log(`UDF server listening on http://localhost:${port}`);
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
