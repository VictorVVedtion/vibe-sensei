import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['main/__tests__/**/*.test.ts'],
    globals: false,
  },
})
