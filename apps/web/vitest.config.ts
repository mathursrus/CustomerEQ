import path from 'node:path'
import { defineConfig } from 'vitest/config'

// Issue #241 Slice 3 — vitest setup for apps/web unit tests.
// Pure-logic unit tests only (no React/jsdom). Playwright e2e tests live
// under test/e2e/ and are run via `pnpm test:e2e`.

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['test/e2e/**', 'node_modules/**', '.next/**'],
  },
})
