import { test, expect, type Page, type Route } from '@playwright/test'

/**
 * CustomerEQ Critical Path E2E Tests
 *
 * Tests the admin program creation flow end-to-end using mocked APIs.
 * The serial mode ensures tests run in order.
 *
 * Tests 2–5 (member enrollment, CX events, redemption, analytics) require
 * a live backend with real data persistence and are marked skip until a
 * full integration test environment is available.
 */

const API = 'http://localhost:4000'

/** Stub Clerk auth so admin pages render without a real session */
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
  // ---------------------------------------------------------------------------
  // 1. Admin: create and activate a loyalty program via 7-step wizard
  // ---------------------------------------------------------------------------
  test('admin can create and activate a loyalty program', async ({ page }, testInfo) => {
    testInfo.setTimeout(120_000)
    await mockClerkAuth(page)
    const programName = 'E2E Test Program'

    // Mock programs API — list, create, and detail endpoints
    await page.route(`${API}/v1/programs*`, (route: Route) => {
      const url = route.request().url()
      // Detail endpoint — /v1/programs/<id> (no further sub-path slashes)
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
      // Sub-resource paths (/v1/programs/<id>/rules, /status, etc.)
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
      // GET — programs list after redirect
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [{ id: 'prog-e2e', name: programName, type: 'POINTS', status: 'ACTIVE', pointCurrencyName: 'Stars', startDate: null, endDate: null, budgetUsdCents: null, createdAt: new Date().toISOString(), _count: { members: 0 } }],
          total: 1,
          page: 1,
          pageSize: 25,
          totalPages: 1,
        }),
      })
    })

    // Mock rewards endpoint (used during activation)
    await page.route(`${API}/v1/rewards`, (route: Route) => {
      route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 'reward-1' }) })
    })

    // Mock all program sub-resource writes (rules, status, etc.)
    // Step 3 auto-adds a default earning rule, so rules POST must be mocked.
    await page.route(`${API}/v1/programs/*/*`, (route: Route) => {
      route.fulfill({
        status: route.request().url().includes('/status') ? 200 : 201,
        contentType: 'application/json',
        body: JSON.stringify(
          route.request().url().includes('/status')
            ? { id: 'prog-e2e', status: 'ACTIVE' }
            : { id: 'sub-1' }
        ),
      })
    })

    await page.goto('/admin/programs/new')

    // ── Step 1: Select program type ────────────────────────────────────────
    await page.getByTestId('type-points').click()
    await page.getByRole('button', { name: /Next: Basic Info/ }).click()

    // ── Step 2: Fill program name and start date ────────────────────────────
    await page.locator('input[placeholder*="Summer Rewards"]').fill(programName)
    await page.locator('input[type="date"]').first().fill('2026-06-01')
    await page.getByRole('button', { name: /Next: Earning Rules/ }).click()

    // ── Step 3: Skip earning rules (POINTS type) ───────────────────────────
    await page.getByRole('button', { name: /Next: Rewards/ }).click()

    // ── Step 4: Tiers not applicable ──────────────────────────────────────
    await page.getByRole('button', { name: /Next: Rewards/ }).click()

    // ── Step 5: Add a reward (required) then proceed ────────────────────────
    await page.getByRole('button', { name: /Add Reward/ }).click()
    await page.locator('input[placeholder*="10% Discount"]').fill('Welcome Reward')
    await page.locator('input[placeholder*="200"]').fill('100')
    await page.getByRole('button', { name: 'Save Reward' }).click()
    await page.getByRole('button', { name: /Next: Budget/ }).click()

    // ── Step 6: Set budget (required) then proceed ──────────────────────────
    await page.locator('input[placeholder*="10,000"]').fill('5000')
    await page.getByRole('button', { name: /Next: Preview/ }).click()

    // ── Step 7: Activate ───────────────────────────────────────────────────
    await page.getByRole('button', { name: /Activate Program/ }).click()

    // Confirm activation modal
    await expect(page.getByRole('heading', { name: 'Activate Program' })).toBeVisible()
    await page.getByPlaceholder(programName).fill(programName)
    await page.getByRole('button', { name: '🚀 Activate', exact: true }).click()

    // Verify redirect to program list
    await page.waitForURL('/admin/programs', { waitUntil: 'commit' })
    await expect(page).toHaveURL('/admin/programs')
    await expect(page.getByTestId('programs-table')).toBeVisible()
  })

  // ---------------------------------------------------------------------------
  // 2–5. Member-side and analytics flows require a live backend
  // ---------------------------------------------------------------------------

  test.skip('member can enroll in the loyalty program', async () => {
    // Requires /member/enroll page and a live API with real DB
  })

  test.skip('CX event triggers campaign and awards points to member', async () => {
    // Requires live API, real member record from test 2
  })

  test.skip('member can redeem a reward', async () => {
    // Requires live API, real points balance from test 3
  })

  test.skip('analytics dashboard shows updated metrics', async () => {
    // Requires live API, real data from tests 2–4
  })
})
