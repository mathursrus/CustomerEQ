import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/integration/**/*.test.ts'],
    setupFiles: ['test/integration/setup.ts'],
    fileParallelism: false,
    testTimeout: 15000,
    env: {
      NODE_ENV: 'test',
    },
  },
})
