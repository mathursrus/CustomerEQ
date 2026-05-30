import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['baml_src/evals/**/*.eval.ts'],
    environment: 'node',
    pool: 'forks',
    fileParallelism: false,
    testTimeout: 60_000,  // LLM calls can be slow
  },
})
