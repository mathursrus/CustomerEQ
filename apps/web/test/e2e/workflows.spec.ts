import { test, expect, type Page, type Route } from '@playwright/test'

/**
 * CustomerEQ User Workflow E2E Tests
 *
 * Tests real user interactions across four workflows:
 *   1. Demo Request Form (public, no auth)
 *   2. Program Creation Wizard (admin, auth mocked)
 *   3. Admin Sidebar Navigation
 *   4. Program Detail View
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
    status: 'ACTIVE',
    pointCurrencyName: 'Stars',
    pointToCurrencyRatio: 0.01,
    createdAt: '2025-01-15T00:00:00Z',
    updatedAt: '2025-02-01T00:00:00Z',
    description: 'Our flagship loyalty program',
    earningRules: [
      { id: 'rule-1', name: 'Purchase', triggerEvent: 'purchase', pointsAwarded: 100, multiplier: 1, status: 'ACTIVE' },
    ],
  },
  {
    id: 'prog-2',
    name: 'Silver Tier',
    status: 'DRAFT',
    pointCurrencyName: 'Points',
    pointToCurrencyRatio: null,
    createdAt: '2025-03-01T00:00:00Z',
    updatedAt: '2025-03-01T00:00:00Z',
    description: null,
    earningRules: [],
  },
]

/** Intercept programs API for list + detail views */
async function mockProgramsAPI(page: Page) {
  // List endpoint
  await page.route(`${API}/v1/programs`, (route: Route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ programs: MOCK_PROGRAMS }),
      })
    }
    // POST — program creation
    return route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'prog-new', name: 'Workflow Test Program' }),
    })
  })

  // Detail endpoint (matches /v1/programs/<id>)
  await page.route(`${API}/v1/programs/*`, (route: Route) => {
    const url = route.request().url()
    const id = url.split('/v1/programs/')[1]?.split('?')[0]
    const program = MOCK_PROGRAMS.find((p) => p.id === id)
    if (route.request().method() === 'PATCH') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...program, status: 'ACTIVE' }),
      })
    }
    if (program) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(program),
      })
    }
    route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"Not found"}' })
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
    // First name error
    const firstNameInput = page.getByTestId('demo-firstName')
    await expect(firstNameInput).toBeVisible()
    const firstNameError = firstNameInput.locator('..').locator('p')
    await expect(firstNameError).toBeVisible()
    await expect(firstNameError).toContainText('required')

    // Last name error
    const lastNameError = page.getByTestId('demo-lastName').locator('..').locator('p')
    await expect(lastNameError).toBeVisible()
    await expect(lastNameError).toContainText('required')

    // Work email error
    const emailError = page.getByTestId('demo-workEmail').locator('..').locator('p')
    await expect(emailError).toBeVisible()
    await expect(emailError).toContainText('required')

    // Company name error
    const companyError = page.getByTestId('demo-companyName').locator('..').locator('p')
    await expect(companyError).toBeVisible()
    await expect(companyError).toContainText('required')

    // Company size error
    const sizeError = page.getByTestId('demo-companySize').locator('..').locator('p')
    await expect(sizeError).toBeVisible()

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
// Workflow 2: Program Creation Wizard (admin)
// ===========================================================================
test.describe('Workflow 2: Program Creation Wizard', () => {
  test.beforeEach(async ({ page }) => {
    await mockClerkAuth(page)
    await mockProgramsAPI(page)
  })

  test('validates name is required on step 1, then completes the full wizard', async ({ page }) => {
    await page.goto('/admin/programs/new')

    // ── Step 1: Leave name empty, click Next → expect validation error ─────
    const nextBtn = page.getByTestId('wizard-next-btn')
    await nextBtn.click()

    // Validation error should appear below the program name input
    const nameError = page.getByTestId('wizard-program-name').locator('..').locator('p')
    await expect(nameError).toBeVisible()
    await expect(nameError).toContainText('required')

    // The wizard should still be on step 1 (heading visible)
    await expect(page.getByRole('heading', { name: 'Basic Information' })).toBeVisible()

    // Now fill the name and proceed
    await page.getByTestId('wizard-program-name').fill('Workflow Test Program')
    await nextBtn.click()

    // ── Step 2: Point Settings ─────────────────────────────────────────────
    await expect(page.getByRole('heading', { name: 'Point Settings' })).toBeVisible()

    // Change currency name to "Stars"
    const currencyInput = page.getByTestId('wizard-currency-name')
    await currencyInput.clear()
    await currencyInput.fill('Stars')

    // Change points per dollar to 50
    const pointsInput = page.getByTestId('wizard-points-per-dollar')
    await pointsInput.clear()
    await pointsInput.fill('50')

    await page.getByTestId('wizard-next-btn').click()

    // ── Step 3: Earning Rules (skip) ───────────────────────────────────────
    await expect(page.getByRole('heading', { name: 'Earning Rules' })).toBeVisible()
    await expect(page.getByText('No earning rules added')).toBeVisible()

    // Skip without adding rules
    await page.getByTestId('wizard-next-btn').click()

    // ── Step 4: Review & Activate ──────────────────────────────────────────
    await expect(page.getByRole('heading', { name: 'Review & Activate' })).toBeVisible()

    // Verify the review displays the values we entered
    await expect(page.getByText('Workflow Test Program')).toBeVisible()
    await expect(page.getByText('Stars')).toBeVisible()
    await expect(page.getByText('50')).toBeVisible()
    await expect(page.getByText('0 rule(s)')).toBeVisible()

    // Click Create Program
    await page.getByTestId('wizard-submit-btn').click()

    // Should redirect to the programs list
    await page.waitForURL('/admin/programs')
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

    // Verify webhook URLs are displayed
    await expect(page.getByTestId('webhook-url-salesforce')).toBeVisible()
    await expect(page.getByTestId('webhook-url-hubspot')).toBeVisible()

    // Verify copy buttons are present
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
// Workflow 4: Program Detail View
// ===========================================================================
test.describe('Workflow 4: Program Detail View', () => {
  test.beforeEach(async ({ page }) => {
    await mockClerkAuth(page)
    await mockProgramsAPI(page)
  })

  test('clicks a program in the list, views detail, and navigates back', async ({ page }) => {
    // Navigate to the programs list
    await page.goto('/admin/programs')
    await expect(page.getByTestId('programs-table')).toBeVisible()

    // The table should have our mock programs listed
    await expect(page.getByRole('link', { name: 'Gold Rewards' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Silver Tier' })).toBeVisible()

    // Click on "Gold Rewards" to go to its detail page
    await page.getByRole('link', { name: 'Gold Rewards' }).click()
    await page.waitForURL('/admin/programs/prog-1')

    // Verify detail page content
    await expect(page.getByRole('heading', { name: 'Gold Rewards' })).toBeVisible()
    await expect(page.getByText('Our flagship loyalty program')).toBeVisible()
    await expect(page.getByText('Stars')).toBeVisible()
    await expect(page.getByText('ACTIVE')).toBeVisible()

    // Verify earning rules table shows the mocked rule
    await expect(page.getByText('Purchase')).toBeVisible()
    await expect(page.getByText('purchase')).toBeVisible()

    // Click "Back to Programs" link
    const backLink = page.getByRole('link', { name: /Back to Programs/ })
    await expect(backLink).toBeVisible()
    await backLink.click()

    // Should return to the programs list
    await page.waitForURL('/admin/programs')
    await expect(page.getByTestId('programs-table')).toBeVisible()
  })

  test('programs list shows empty state when no programs exist', async ({ page }) => {
    // Override the programs API to return an empty list for this test
    await page.route(`${API}/v1/programs`, (route: Route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ programs: [] }),
      })
    })

    await page.goto('/admin/programs')

    // Should show the empty state message
    await expect(page.getByText('No programs yet')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Create your first program' })).toBeVisible()
  })
})
