import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['src/evals/**'],  // evals need API keys; run via `pnpm test:baml`
    environment: 'node',
  },
})
