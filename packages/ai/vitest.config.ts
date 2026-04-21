import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['src/evals/**'],  // evals need API keys; run via `pnpm test:baml`
    environment: 'node',
    // BAML runtime ships native Node bindings. On Windows, vitest's default thread pool
    // crashes with a 0xC0000005 access violation during teardown because the native
    // module isn't released cleanly from the worker thread. Forking each test file into
    // its own child process isolates the native lifecycle from the vitest parent.
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
})
