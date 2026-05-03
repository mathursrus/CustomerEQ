import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL: process.env.DEMO_STOREFRONT_URL ?? 'http://localhost:3002',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: process.env.CI
    ? {
        command: 'pnpm start',
        url: 'http://localhost:3002',
        reuseExistingServer: false,
        timeout: 60_000,
      }
    : undefined,
})
