import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './test/e2e',
  timeout: 60000,
  use: {
    baseURL: 'http://localhost:3098',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'node ./node_modules/next/dist/bin/next dev --port 3098',
    url: 'http://localhost:3098',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      PLAYWRIGHT_TEST: 'true',
      NEXT_PUBLIC_PLAYWRIGHT_TEST: 'true',
      CLERK_ENCRYPTION_KEY: 'playwright-test-encryption-key-123456789012',
    },
  },
})
