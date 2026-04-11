import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['test/integration/**'],
    // Prisma client's native engine bindings crash vitest's worker threads on
    // Windows during teardown (0xC0000005 access violation). Forking into a
    // child process isolates the native lifecycle.
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
})
