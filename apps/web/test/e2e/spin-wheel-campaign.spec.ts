import { test, expect, type Page, type Route } from '@playwright/test'

/**
 * Spin-the-Wheel Campaign E2E Tests
 *
 * Persona 1: Admin creates a spin wheel campaign via the real campaign creation form
 * Persona 2: Member plays the spin wheel via the real embeddable component page
 *
 * Tests run against the real Next.js app (port 3098, started by playwright config).
 * API calls intercepted with page.route() so no live backend required.
 */

const API = 'http://localhost:4000'

const MOCK_PROGRAMS = [
  { id: 'prog-1', name: 'Acme Rewards' },
]

const MOCK_CAMPAIGN_ID = 'camp-spin-123'

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

/** Intercept programs list API */
async function mockProgramsAPI(page: Page) {
  await page.route(`${API}/v1/programs`, (route: Route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_PROGRAMS }),
    })
  })
}

/** Intercept campaign creation API */
async function mockCampaignsAPI(page: Page) {
  await page.route(`${API}/v1/campaigns`, (route: Route) => {
    if (route.request().method() === 'POST') {
      const body = JSON.parse(route.request().postData() ?? '{}')
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: MOCK_CAMPAIGN_ID, ...body, status: 'DRAFT' }),
      })
    } else {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], total: 0, page: 1, pageSize: 25, totalPages: 0 }),
      })
    }
  })
}

// ─── Persona 1: Admin Creates Spin Wheel Campaign ───────────────────────────

test.describe('Persona 1: Admin creates spin wheel campaign', () => {
  test.beforeEach(async ({ page }) => {
    await mockClerkAuth(page)
    await mockProgramsAPI(page)
    await mockCampaignsAPI(page)
  })

  test('admin can select spin_wheel action type and see segment builder', async ({ page }) => {
    await page.goto('/admin/campaigns/new')

    // Fill campaign basics
    await page.getByTestId('campaign-name').fill('Holiday Spin & Win')
    await page.getByTestId('campaign-program-select').selectOption('prog-1')
    await page.getByTestId('campaign-trigger-type').selectOption('purchase')

    // Select spin wheel action type
    await page.getByTestId('campaign-action-type').selectOption('spin_wheel')

    // Verify segment builder appears with 2 default segments
    await expect(page.getByTestId('segment-label-0')).toBeVisible()
    await expect(page.getByTestId('segment-label-1')).toBeVisible()
    await expect(page.getByTestId('segment-prob-0')).toBeVisible()
    await expect(page.getByTestId('segment-prob-1')).toBeVisible()
    await expect(page.getByTestId('segment-points-0')).toBeVisible()
    await expect(page.getByTestId('segment-color-0')).toBeVisible()
  })

  test('admin can edit segment labels, points, and probabilities', async ({ page }) => {
    await page.goto('/admin/campaigns/new')
    await page.getByTestId('campaign-action-type').selectOption('spin_wheel')

    // Edit first segment
    await page.getByTestId('segment-label-0').fill('Grand Prize!')
    await page.getByTestId('segment-points-0').fill('1000')
    await page.getByTestId('segment-prob-0').fill('30')

    // Edit second segment
    await page.getByTestId('segment-label-1').fill('Consolation')
    await page.getByTestId('segment-points-1').fill('50')
    await page.getByTestId('segment-prob-1').fill('70')

    // Verify probability sum shows 100%
    await expect(page.getByText('100.0%')).toBeVisible()
    await expect(page.getByText('\u2713')).toBeVisible() // checkmark
  })

  test('admin sees probability validation error when sum is not 100%', async ({ page }) => {
    await page.goto('/admin/campaigns/new')
    await page.getByTestId('campaign-action-type').selectOption('spin_wheel')

    // Set probabilities that don't sum to 100
    await page.getByTestId('segment-prob-0').fill('30')
    await page.getByTestId('segment-prob-1').fill('30')

    // Should show "must be 100%" warning
    await expect(page.getByText('must be 100%')).toBeVisible()
  })

  test('admin can add and remove segments', async ({ page }) => {
    await page.goto('/admin/campaigns/new')
    await page.getByTestId('campaign-action-type').selectOption('spin_wheel')

    // Start with 2 default segments
    await expect(page.getByTestId('segment-label-0')).toBeVisible()
    await expect(page.getByTestId('segment-label-1')).toBeVisible()

    // Add segment (should now have 3)
    await page.getByTestId('add-segment-btn').click()
    await expect(page.getByTestId('segment-label-2')).toBeVisible()

    // Remove buttons appear when > 2 segments
    await expect(page.getByTestId('segment-remove-2')).toBeVisible()

    // Remove third segment
    await page.getByTestId('segment-remove-2').click()
    await expect(page.getByTestId('segment-label-2')).not.toBeVisible()
  })

  test('admin can select wheel style (classic, neon, minimal)', async ({ page }) => {
    await page.goto('/admin/campaigns/new')
    await page.getByTestId('campaign-action-type').selectOption('spin_wheel')

    // Style buttons should be visible
    await expect(page.getByRole('button', { name: 'classic' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'neon' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'minimal' })).toBeVisible()
  })

  test('admin can submit spin wheel campaign with valid config', async ({ page }) => {
    await page.goto('/admin/campaigns/new')

    // Fill all required fields
    await page.getByTestId('campaign-name').fill('Holiday Spin & Win')
    await page.getByTestId('campaign-program-select').selectOption('prog-1')
    await page.getByTestId('campaign-trigger-type').selectOption('purchase')
    await page.getByTestId('campaign-action-type').selectOption('spin_wheel')
    await page.getByTestId('campaign-start-date').fill('2026-04-15')

    // Set probabilities to sum to 100%
    await page.getByTestId('segment-prob-0').fill('60')
    await page.getByTestId('segment-prob-1').fill('40')

    // Submit
    await page.getByTestId('campaign-submit-btn').click()

    // Spin wheel campaigns show embed code page instead of redirecting
    await expect(page.getByRole('heading', { name: 'Campaign Created!' })).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('heading', { name: 'Embed Code' })).toBeVisible()
    await expect(page.getByTestId('copy-embed-btn')).toBeVisible()
    await expect(page.getByTestId('go-to-campaigns-btn')).toBeVisible()
    await expect(page.getByText('camp-spin-123')).toBeVisible() // campaign ID in embed code
  })

  test('segment builder is hidden when action type is not spin_wheel', async ({ page }) => {
    await page.goto('/admin/campaigns/new')

    // Select award_points — no segment builder
    await page.getByTestId('campaign-action-type').selectOption('award_points')
    await expect(page.getByTestId('segment-label-0')).not.toBeVisible()
    await expect(page.getByTestId('campaign-action-points')).toBeVisible()

    // Switch to spin_wheel — segment builder appears
    await page.getByTestId('campaign-action-type').selectOption('spin_wheel')
    await expect(page.getByTestId('segment-label-0')).toBeVisible()
    await expect(page.getByTestId('campaign-action-points')).not.toBeVisible()
  })
})
