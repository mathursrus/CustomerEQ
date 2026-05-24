import { defineConfig } from '@playwright/test'

// Use 127.0.0.1 instead of `localhost` to avoid an ERR_NAME_NOT_RESOLVED
// in Chromium on Windows when `localhost` can't be resolved by Chromium's
// built-in DNS (IPv6 ordering, security-tool interference). Chromium
// resolves literal IPs without going through DNS at all.
const HOST = '127.0.0.1'
const PORT = 3098
const BASE_URL = `http://${HOST}:${PORT}`

export default defineConfig({
  testDir: './test/e2e',
  timeout: 60000,
  use: {
    baseURL: BASE_URL,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    // Run E2E against a production build. Next 15 dev mode emits
    // sync-dynamic-api `headers()` failures through Clerk that leave admin
    // pages blank under Playwright on Windows; the production server matches
    // the deployed runtime and avoids the dev-only failure mode.
    command: `pnpm build && node ./node_modules/next/dist/bin/next start --hostname ${HOST} --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 240000,
    env: {
      PLAYWRIGHT_TEST: 'true',
      NEXT_PUBLIC_PLAYWRIGHT_TEST: 'true',
      CLERK_ENCRYPTION_KEY: 'playwright-test-encryption-key-123456789012',
    },
  },
})
