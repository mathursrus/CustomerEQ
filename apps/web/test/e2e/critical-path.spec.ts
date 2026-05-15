import { test, expect, type Page, type Route } from '@playwright/test'

/**
 * CustomerEQ Critical Path E2E Tests
 *
 * Tests the admin program creation flow end-to-end using mocked APIs.
 * Member enrollment, event pipelines, redemption, and analytics are covered
 * by dedicated integration and UI suites instead of placeholder skipped tests.
 */

const API = 'http://localhost:4000'

/** Stub Clerk auth so admin pages render without a real session. */
async function mockClerkAuth(page: Page) {
  await page.route('**/clerk.**', (route: Route) => {
    if (route.request().resourceType() === 'document') return route.continue()
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })
  await page.route('**/.well-known/**', (route: Route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })
}

test.describe.configure({ mode: 'serial' })

test.describe('CustomerEQ Critical Path', () => {
  test('admin can create and activate a loyalty program', async ({ page }, testInfo) => {
    testInfo.setTimeout(120_000)
    await mockClerkAuth(page)
    const programName = 'E2E Test Program'

    // Mock programs API list, create, and detail endpoints.
    await page.route(`${API}/v1/programs*`, (route: Route) => {
      const url = route.request().url()

      if (url.includes('/v1/programs/') && !url.split('/v1/programs/')[1]?.includes('/')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'prog-e2e',
            name: programName,
            type: 'POINTS',
            status: 'DRAFT',
            pointCurrencyName: 'Points',
            startDate: null,
            endDate: null,
            budgetUsdCents: null,
            createdAt: new Date().toISOString(),
            tiers: [],
            rewards: [],
            earningRules: [],
          }),
        })
      }

      if (url.includes('/v1/programs/')) return route.continue()

      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'prog-e2e', name: programName }),
        })
      }

      if (route.request().method() === 'PATCH') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'prog-e2e', name: programName }),
        })
      }

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'prog-e2e',
              name: programName,
              type: 'POINTS',
              status: 'ACTIVE',
              pointCurrencyName: 'Stars',
              startDate: null,
              endDate: null,
              budgetUsdCents: null,
              createdAt: new Date().toISOString(),
              _count: { members: 0 },
            },
          ],
          total: 1,
          page: 1,
          pageSize: 25,
          totalPages: 1,
        }),
      })
    })

    await page.route(`${API}/v1/rewards`, (route: Route) => {
      route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 'reward-1' }) })
    })

    // Step 3 auto-adds a default earning rule, so program sub-resource writes must be mocked.
    await page.route(`${API}/v1/programs/*/*`, (route: Route) => {
      route.fulfill({
        status: route.request().url().includes('/status') ? 200 : 201,
        contentType: 'application/json',
        body: JSON.stringify(route.request().url().includes('/status') ? { id: 'prog-e2e', status: 'ACTIVE' } : { id: 'sub-1' }),
      })
    })

    await page.goto('/admin/programs/new')

    await page.getByTestId('type-points').click()
    await page.getByRole('button', { name: /Next: Basic Info/ }).click()

    await page.locator('input[placeholder*="Summer Rewards"]').fill(programName)
    await page.locator('input[type="date"]').first().fill('2026-06-01')
    await page.getByRole('button', { name: /Next: Earning Rules/ }).click()

    await page.getByRole('button', { name: /Next: Tiers/ }).click()
    await page.getByRole('button', { name: /Next: Rewards/ }).click()

    await page.getByRole('button', { name: /Add Reward/ }).click()
    await page.locator('input[placeholder*="10% Discount"]').fill('Welcome Reward')
    await page.locator('input[placeholder*="200"]').fill('100')
    await page.getByRole('button', { name: 'Save Reward' }).click()
    await page.getByRole('button', { name: /Next: Budget/ }).click()

    await page.locator('input[placeholder*="10,000"]').fill('5000')
    await page.getByRole('button', { name: /Next: Preview/ }).click()

    await page.getByRole('button', { name: /Activate Program/ }).click()
    await expect(page.getByRole('heading', { name: 'Activate Program' })).toBeVisible()
    await page.getByPlaceholder(programName).fill(programName)
    await page.getByRole('button', { name: '🚀 Activate', exact: true }).click()

    await page.waitForURL('/admin/programs', { waitUntil: 'commit' })
    await expect(page).toHaveURL('/admin/programs')
    await expect(page.getByTestId('programs-table')).toBeVisible()
  })
})
