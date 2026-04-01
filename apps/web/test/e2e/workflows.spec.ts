import { test, expect, type Page, type Route } from '@playwright/test'

/**
 * CustomerEQ User Workflow E2E Tests
 *
 * Tests real user interactions across four workflows:
 *   1. Demo Request Form (public, no auth)
 *   2. Program Creation Wizard (admin, M3 7-step wizard)
 *   3. Admin Sidebar Navigation
 *   4. Program List View
 *
 * API calls are intercepted with `page.route()` so the suite runs without
 * a live backend. Selector strategy: data-testid first, then role/text.
 */

// ---------------------------------------------------------------------------
// Helpers: intercept API calls so tests work without a running backend
// ---------------------------------------------------------------------------

const API = 'http://localhost:4000'

/** Intercept the demo-request POST and return a 200 OK */
async function mockDemoRequestAPI(page: Page) {
  await page.route(`${API}/v1/public/demo-requests`, (route: Route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' })
  })
}

/** Stub Clerk's auth-related requests so admin pages render without a real session */
async function mockClerkAuth(page: Page) {
  // Intercept Clerk's FAPI calls that would otherwise fail or redirect
  await page.route('**/clerk.**', (route: Route) => {
    // Let navigations through, mock API calls
    if (route.request().resourceType() === 'document') {
      return route.continue()
    }
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })
  await page.route('**/.well-known/**', (route: Route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })
}

const MOCK_PROGRAMS = [
  {
    id: 'prog-1',
    name: 'Gold Rewards',
    type: 'POINTS',
    status: 'ACTIVE',
    pointCurrencyName: 'Stars',
    pointToCurrencyRatio: 0.01,
    startDate: null,
    endDate: null,
    budgetUsdCents: null,
    createdAt: '2025-01-15T00:00:00Z',
    updatedAt: '2025-02-01T00:00:00Z',
    _count: { members: 42 },
  },
  {
    id: 'prog-2',
    name: 'Silver Tier',
    type: 'TIERED',
    status: 'DRAFT',
    pointCurrencyName: 'Points',
    pointToCurrencyRatio: null,
    startDate: null,
    endDate: null,
    budgetUsdCents: null,
    createdAt: '2025-03-01T00:00:00Z',
    updatedAt: '2025-03-01T00:00:00Z',
    _count: { members: 0 },
  },
]

/** Intercept programs API for list views */
async function mockProgramsAPI(page: Page) {
  // List endpoint — uses glob * (no slash) so it matches /v1/programs and
  // /v1/programs?page=1&pageSize=25 but NOT /v1/programs/:id sub-paths
  await page.route(`${API}/v1/programs*`, (route: Route) => {
    // Only handle requests that don't have a path segment after /programs
    if (route.request().url().includes('/v1/programs/')) {
      return route.continue()
    }
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'prog-new', name: 'Workflow Test Program' }),
      })
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: MOCK_PROGRAMS,
        total: 2,
        page: 1,
        pageSize: 25,
        totalPages: 1,
      }),
    })
  })
}

/** Intercept campaigns API */
async function mockCampaignsAPI(page: Page) {
  await page.route(`${API}/v1/campaigns`, (route: Route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        campaigns: [
          {
            id: 'camp-1',
            name: 'Welcome Bonus',
            status: 'ACTIVE',
            triggerType: 'signup',
            actionType: 'award_points',
            budgetSpent: 500,
            budgetCap: 10000,
            createdAt: '2025-01-20T00:00:00Z',
          },
        ],
      }),
    })
  })
}

/** Intercept analytics API */
async function mockAnalyticsAPI(page: Page) {
  await page.route(`${API}/v1/analytics/overview*`, (route: Route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        overview: { totalMembers: 1234, pointsIssued: 50000, pointsRedeemed: 12000, roi: 18.5 },
      }),
    })
  })
  await page.route(`${API}/v1/analytics/campaigns*`, (route: Route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        campaigns: [
          { id: 'c1', name: 'Welcome Bonus', status: 'ACTIVE', triggers: 420, pointsAwarded: 42000, budgetUsed: 420, avgResponseTimeMs: 1200 },
        ],
      }),
    })
  })
}

// ===========================================================================
// Workflow 1: Demo Request Form (public, no auth)
// ===========================================================================
test.describe('Workflow 1: Demo Request Form', () => {
  test.beforeEach(async ({ page }) => {
    await mockDemoRequestAPI(page)
    await page.goto('/request-demo')
  })

  test('shows all validation errors when submitting an empty form', async ({ page }) => {
    // Submit the form without filling any fields
    await page.getByTestId('demo-submit-btn').click()

    // All required-field errors must appear
    // The page shows inline error <p> elements below each required input
    const firstNameInput = page.getByTestId('demo-firstName')
    await expect(firstNameInput).toBeVisible()
    const firstNameError = firstNameInput.locator('..').locator('p')
    await expect(firstNameError).toBeVisible()
    await expect(firstNameError).toContainText('required')

    const lastNameError = page.getByTestId('demo-lastName').locator('..').locator('p')
    await expect(lastNameError).toBeVisible()
    await expect(lastNameError).toContainText('required')

    const emailError = page.getByTestId('demo-workEmail').locator('..').locator('p')
    await expect(emailError).toBeVisible()
    await expect(emailError).toContainText('required')

    const companyError = page.getByTestId('demo-companyName').locator('..').locator('p')
    await expect(companyError).toBeVisible()
    await expect(companyError).toContainText('required')

    // Success message must NOT be visible
    await expect(page.getByTestId('demo-success-msg')).not.toBeVisible()
  })

  test('submits successfully with valid data and shows success message', async ({ page }) => {
    // Fill all required fields
    await page.getByTestId('demo-firstName').fill('Alice')
    await page.getByTestId('demo-lastName').fill('Smith')
    await page.getByTestId('demo-workEmail').fill('alice@acme.com')
    await page.getByTestId('demo-companyName').fill('Acme Corp')
    await page.getByTestId('demo-companySize').selectOption('51-200')

    // Fill optional message
    await page.getByTestId('demo-message').fill('Looking to boost customer loyalty')

    // Submit the form
    await page.getByTestId('demo-submit-btn').click()

    // Success message should appear
    await expect(page.getByTestId('demo-success-msg')).toBeVisible()
    await expect(page.getByTestId('demo-success-msg')).toContainText('Thank you')

    // The form inputs should no longer be visible (replaced by success state)
    await expect(page.getByTestId('demo-firstName')).not.toBeVisible()
    await expect(page.getByTestId('demo-workEmail')).not.toBeVisible()
  })

  test('"Back to home" link navigates to homepage after successful submission', async ({ page }) => {
    // Fill and submit valid form
    await page.getByTestId('demo-firstName').fill('Bob')
    await page.getByTestId('demo-lastName').fill('Jones')
    await page.getByTestId('demo-workEmail').fill('bob@example.com')
    await page.getByTestId('demo-companyName').fill('Example Inc')
    await page.getByTestId('demo-companySize').selectOption('11-50')
    await page.getByTestId('demo-submit-btn').click()

    // Wait for success state
    await expect(page.getByTestId('demo-success-msg')).toBeVisible()

    // Click "Back to home" link
    const homeLink = page.getByRole('link', { name: 'Back to home' })
    await expect(homeLink).toBeVisible()
    await homeLink.click()

    // Should navigate to the homepage
    await page.waitForURL('/')
    await expect(page).toHaveURL('/')
  })
})

// ===========================================================================
// Workflow 2: Program Creation Wizard (admin, M3 7-step wizard)
// ===========================================================================
test.describe('Workflow 2: Program Creation Wizard', () => {
  test.beforeEach(async ({ page }) => {
    await mockClerkAuth(page)
    await mockProgramsAPI(page)
  })

  test('completes the full 7-step wizard and activates a program', async ({ page }) => {
    // Mock all program sub-resource writes (rules, status, etc.)
    // Step 3 auto-adds a default earning rule, so rules POST must be mocked.
    await page.route(`${API}/v1/programs/*/*`, (route: Route) => {
      route.fulfill({
        status: route.request().url().includes('/status') ? 200 : 201,
        contentType: 'application/json',
        body: JSON.stringify(
          route.request().url().includes('/status')
            ? { id: 'prog-new', status: 'ACTIVE' }
            : { id: 'sub-1' }
        ),
      })
    })

    await page.goto('/admin/programs/new')

    // ── Step 1: Select program type ────────────────────────────────────────
    await page.getByTestId('type-points').click()
    await page.getByRole('button', { name: /Next: Basic Info/ }).click()

    // ── Step 2: Fill program name ──────────────────────────────────────────
    const programName = 'Workflow Test Program'
    await page.locator('input[placeholder*="Summer Rewards"]').fill(programName)
    await page.getByRole('button', { name: /Next: Earning Rules/ }).click()

    // ── Step 3: Skip earning rules (POINTS → "Next: Rewards →") ───────────
    await page.getByRole('button', { name: /Next: Rewards/ }).click()

    // ── Step 4: Tiers not applicable for POINTS type ───────────────────────
    await expect(page.getByText('does not use tiers')).toBeVisible()
    await page.getByRole('button', { name: /Next: Rewards/ }).click()

    // ── Step 5: Skip rewards ───────────────────────────────────────────────
    await page.getByRole('button', { name: /Next: Budget/ }).click()

    // ── Step 6: Skip budget ────────────────────────────────────────────────
    await page.getByRole('button', { name: /Next: Preview/ }).click()

    // ── Step 7: Preview — click Activate Program ───────────────────────────
    await page.getByRole('button', { name: /Activate Program/ }).click()

    // ── Activate modal: type program name to confirm ───────────────────────
    await expect(page.getByRole('heading', { name: 'Activate Program' })).toBeVisible()
    await page.getByPlaceholder(programName).fill(programName)
    await page.getByRole('button', { name: '🚀 Activate', exact: true }).click()

    // Should redirect to the programs list
    await page.waitForURL('/admin/programs', { waitUntil: 'commit' })
    await expect(page).toHaveURL('/admin/programs')
  })
})

// ===========================================================================
// Workflow 3: Admin Sidebar Navigation
// ===========================================================================
test.describe('Workflow 3: Admin Sidebar Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await mockClerkAuth(page)
    await mockProgramsAPI(page)
    await mockCampaignsAPI(page)
    await mockAnalyticsAPI(page)
  })

  test('navigates through all admin sections via sidebar links', async ({ page }) => {
    // Start at /admin/programs
    await page.goto('/admin/programs')
    await expect(page.getByTestId('admin-layout')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Programs' })).toBeVisible()
    await expect(page.getByTestId('programs-table')).toBeVisible()

    // ── Click Campaigns in sidebar ─────────────────────────────────────────
    await page.getByRole('link', { name: 'Campaigns' }).click()
    await page.waitForURL('/admin/campaigns')
    await expect(page.getByRole('heading', { name: 'Campaigns' })).toBeVisible()
    // campaigns-table renders even with empty data (server component with fallback)
    await expect(page.getByTestId('campaigns-table')).toBeVisible()

    // ── Click Analytics in sidebar ─────────────────────────────────────────
    await page.getByRole('link', { name: 'Analytics' }).click()
    await page.waitForURL('/admin/analytics')
    await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible()
    await expect(page.getByTestId('analytics-date-range')).toBeVisible()

    // Verify KPI cards load with mocked data
    await expect(page.getByTestId('analytics-kpi-cards')).toBeVisible()
    await expect(page.getByTestId('analytics-total-members')).toBeVisible()
    await expect(page.getByTestId('analytics-points-issued')).toBeVisible()

    // ── Click Integrations in sidebar ──────────────────────────────────────
    await page.getByRole('link', { name: 'Integrations' }).click()
    await page.waitForURL('/admin/integrations')
    await expect(page.getByRole('heading', { name: 'Integrations' })).toBeVisible()

    // Verify webhook URLs and copy buttons are displayed
    await expect(page.getByTestId('webhook-url-salesforce')).toBeVisible()
    await expect(page.getByTestId('webhook-url-hubspot')).toBeVisible()
    await expect(page.getByTestId('copy-webhook-salesforce')).toBeVisible()
    await expect(page.getByTestId('copy-webhook-hubspot')).toBeVisible()

    // ── Click Programs to go back ──────────────────────────────────────────
    await page.getByRole('link', { name: 'Programs' }).click()
    await page.waitForURL('/admin/programs')
    await expect(page.getByRole('heading', { name: 'Programs' })).toBeVisible()
    await expect(page.getByTestId('programs-table')).toBeVisible()
  })
})

// ===========================================================================
// Workflow 4: Program List View
// ===========================================================================
test.describe('Workflow 4: Program List View', () => {
  test.beforeEach(async ({ page }) => {
    await mockClerkAuth(page)
    await mockProgramsAPI(page)
  })

  test('programs list displays loaded programs from API', async ({ page }) => {
    await page.goto('/admin/programs')
    await expect(page.getByTestId('programs-table')).toBeVisible()

    // Wait for client-side data load — programs should appear as links
    await expect(page.getByRole('link', { name: 'Gold Rewards' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Silver Tier' })).toBeVisible()
  })

  test('programs list shows empty state when no programs exist', async ({ page }) => {
    // Override the programs API to return an empty list for this test
    await page.route(`${API}/v1/programs*`, (route: Route) => {
      if (route.request().url().includes('/v1/programs/')) return route.continue()
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], total: 0, page: 1, pageSize: 25, totalPages: 0 }),
      })
    })

    await page.goto('/admin/programs')

    // Should show the empty state message
    await expect(page.getByText('No programs yet')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Create your first program' })).toBeVisible()
  })
})
