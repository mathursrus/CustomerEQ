import { defineConfig } from 'vitest/config'

// Match other monorepo packages: forks pool avoids native-binding crashes
// on Windows worker teardown (prisma, ioredis, bullmq DLLs crash when
// unloaded in vitest's default thread-pool teardown).
export default defineConfig({
  test: {
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
})
