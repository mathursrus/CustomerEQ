import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './test/e2e',
  timeout: 60000,
  use: {
    baseURL: 'http://localhost:3099',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --port 3099',
    url: 'http://localhost:3099',
    reuseExistingServer: false,
    timeout: 120000,
    env: { PLAYWRIGHT_TEST: 'true', NEXT_PUBLIC_PLAYWRIGHT_TEST: 'true' },
  },
})
