import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: [
      'desktop/**',
      'node_modules/**',
      // These specific tests use bun:test natively (Rust TUI backend), skip in Vitest.
      // Other tests in src/services/backend/__tests__ are vitest-compatible.
      'src/services/backend/__tests__/event-stream.test.ts',
      'src/services/backend/__tests__/lifecycle.test.ts',
      'src/services/backend/__tests__/uds-server.test.ts',
    ],
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: {
      src: resolve(__dirname, 'src'),
      // Polyfill bun:bundle for Vitest (Node) — mirrors cli.tsx runtime polyfill
      'bun:bundle': resolve(__dirname, 'src/__mocks__/bun-bundle.ts'),
    },
  },
})
