import { defineConfig, devices } from '@playwright/test'

const HOST = '127.0.0.1'
const PORT = 3022
const API_PORT = 4010
const BASE_URL = `http://${HOST}:${PORT}`
const API_URL = process.env.DEMO_API_URL ?? `http://${HOST}:${API_PORT}`
const STOREFRONT_READY_URL = `${BASE_URL}/api/healthz`
const WEB_SERVER_TIMEOUT = process.env.CI ? 180_000 : 60_000
const STOREFRONT_SERVER_COMMAND = `pnpm exec next dev -p ${PORT} --hostname ${HOST}`
const REUSE_STOREFRONT_SERVER = process.env.PLAYWRIGHT_REUSE_DEMO_STOREFRONT_SERVER === 'true'

process.env.DEMO_API_URL = API_URL
process.env.API_PORT = process.env.API_PORT ?? String(API_PORT)
process.env.NEXT_PUBLIC_DEMO_BRAND_NAME = process.env.NEXT_PUBLIC_DEMO_BRAND_NAME ?? 'StarBrew Coffee'
process.env.NEXT_PUBLIC_DEMO_BRAND_PRIMARY_COLOR =
  process.env.NEXT_PUBLIC_DEMO_BRAND_PRIMARY_COLOR ?? '#00704A'
process.env.NEXT_PUBLIC_DEMO_BRAND_SECONDARY_COLOR =
  process.env.NEXT_PUBLIC_DEMO_BRAND_SECONDARY_COLOR ?? '#CBA258'

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  reporter: process.env.CI ? 'github' : 'list',
  globalSetup: './test/e2e/global-setup.cjs',

  use: {
    baseURL: process.env.DEMO_STOREFRONT_URL ?? BASE_URL,
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: [
    {
      command: 'pnpm --filter @customerEQ/api dev:inline',
      url: `${API_URL}/healthz`,
      reuseExistingServer: true,
      timeout: WEB_SERVER_TIMEOUT,
    },
    {
      command: STOREFRONT_SERVER_COMMAND,
      url: STOREFRONT_READY_URL,
      reuseExistingServer: REUSE_STOREFRONT_SERVER || !process.env.CI,
      timeout: WEB_SERVER_TIMEOUT,
      env: {
        ...process.env,
        HOSTNAME: HOST,
        PORT: String(PORT),
      },
    },
  ],
})
