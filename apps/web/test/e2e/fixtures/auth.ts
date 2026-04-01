import { test as base } from '@playwright/test'

// Extend test with authenticated contexts for admin and member
export const test = base.extend<{
  adminPage: import('@playwright/test').Page
  memberPage: import('@playwright/test').Page
}>({
  adminPage: async ({ browser }, use) => {
    // Create admin context with Clerk auth cookie
    const context = await browser.newContext()
    const page = await context.newPage()
    // In real tests, Clerk session would be set up here
    await use(page)
    await context.close()
  },
  memberPage: async ({ browser }, use) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await use(page)
    await context.close()
  },
})

export { expect } from '@playwright/test'
