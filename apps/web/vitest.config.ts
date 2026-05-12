import path from 'node:path'
import { defineConfig } from 'vitest/config'

// Issue #241 Slice 4a — vitest config for apps/web.
// Slice 3 left this pure-logic only. Slice 4a adds jsdom + RTL matchers so the
// renderer family and detail-page sections can be tested via React Testing
// Library. Playwright e2e tests still live under test/e2e/ and are run via
// `pnpm test:e2e` — they are excluded here.

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  esbuild: {
    // React 17+ automatic JSX runtime; matches Next's tsconfig "jsx": "preserve"
    // for production builds and "jsx-runtime" injection at test time.
    jsx: 'automatic',
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['test/e2e/**', 'node_modules/**', '.next/**'],
  },
})
