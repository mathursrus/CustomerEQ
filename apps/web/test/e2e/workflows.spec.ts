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
  // List, create, and detail endpoints
  await page.route(`${API}/v1/programs*`, (route: Route) => {
    const url = route.request().url()
    // Detail endpoint — /v1/programs/<id> (no further sub-path)
    if (url.includes('/v1/programs/') && !url.split('/v1/programs/')[1]?.includes('/')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'prog-new',
          name: 'Workflow Test Program',
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
        body: JSON.stringify({ id: 'prog-new', name: 'Workflow Test Program' }),
      })
    }
    if (route.request().method() === 'PATCH') {
      return route.fulfill({
        status: 200,
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
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'camp-new', name: 'New Campaign', status: 'DRAFT' }),
      })
    }
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
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
        total: 1,
        page: 1,
        pageSize: 25,
        totalPages: 1,
      }),
    })
  })
}

/** Intercept alert rules API */
async function mockAlertRulesAPI(page: Page) {
  await page.route(`${API}/v1/alert-rules`, (route: Route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'rule-new',
          name: 'New Rule',
          status: 'ACTIVE',
          surveyTypes: ['NPS'],
          slackWebhookUrl: null,
          emailRecipients: [],
          teamsWebhookUrl: null,
          defaultAssignee: 'team@example.com',
          slaHours: 24,
          createdAt: '2025-03-01T00:00:00Z',
        }),
      })
    }
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        rules: [
          {
            id: 'rule-1',
            name: 'Low NPS Alert',
            status: 'ACTIVE',
            slackWebhookUrl: 'https://hooks.slack.com/services/xxx',
            emailRecipients: ['team@example.com'],
            teamsWebhookUrl: null,
            slaHours: 24,
            createdAt: '2025-02-15T00:00:00Z',
            _count: { cases: 5 },
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

  test('completes the full 7-step wizard and activates a program', async ({ page }, testInfo) => {
    testInfo.setTimeout(120_000)

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
            ? { id: 'prog-new', status: 'ACTIVE' }
            : { id: 'sub-1' }
        ),
      })
    })

    await page.goto('/admin/programs/new')

    // ── Step 1: Select program type ────────────────────────────────────────
    await page.getByTestId('type-points').click()
    await page.getByRole('button', { name: /Next: Basic Info/ }).click()

    // ── Step 2: Fill program name and start date ────────────────────────────
    const programName = 'Workflow Test Program'
    await page.locator('input[placeholder*="Summer Rewards"]').fill(programName)
    await page.locator('input[type="date"]').first().fill('2026-06-01')
    await page.getByRole('button', { name: /Next: Earning Rules/ }).click()

    // ── Step 3: Skip earning rules (POINTS → "Next: Rewards →") ───────────
    await page.getByRole('button', { name: /Next: Rewards/ }).click()

    // ── Step 4: Tiers not applicable for POINTS type ───────────────────────
    await expect(page.getByText('does not use tiers')).toBeVisible()
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

// ===========================================================================
// Workflow 5: Alert Rules — List & Create
// ===========================================================================
test.describe('Workflow 5: Alert Rules', () => {
  test.beforeEach(async ({ page }) => {
    await mockClerkAuth(page)
    await mockAlertRulesAPI(page)
  })

  test('alert rules list renders rules from API', async ({ page }) => {
    await page.goto('/admin/alerts/rules')

    await expect(page.getByRole('heading', { name: 'Alert Rules' })).toBeVisible()

    // Rule from mock should render in the table
    await expect(page.getByText('Low NPS Alert')).toBeVisible()
    await expect(page.getByText('ACTIVE')).toBeVisible()
    await expect(page.getByText('24h')).toBeVisible()
  })

  test('alert rules list shows channel icons correctly', async ({ page }) => {
    await page.goto('/admin/alerts/rules')

    // Slack and Email icons should render (rule has slackWebhookUrl + emailRecipients)
    await expect(page.locator('[title="Slack"]')).toBeVisible()
    await expect(page.locator('[title*="Email"]')).toBeVisible()
  })

  test('create alert rule form renders and validates', async ({ page }) => {
    await page.goto('/admin/alerts/rules/new')

    await expect(page.getByRole('heading', { name: 'Create Alert Rule' })).toBeVisible()

    // Submit empty form — should show validation errors
    await page.getByRole('button', { name: 'Save Alert Rule' }).click()
    await expect(page.getByText('Rule name is required')).toBeVisible()
    await expect(page.getByText('Select at least one survey type')).toBeVisible()
  })

  test('create alert rule submits successfully with valid data', async ({ page }) => {
    await page.goto('/admin/alerts/rules/new')

    // Fill required fields
    await page.locator('#ruleName').fill('Test NPS Rule')
    await page.getByLabel('NPS').check()
    await page.locator('#defaultAssignee').fill('team@example.com')

    // Submit the form
    await page.getByRole('button', { name: 'Save Alert Rule' }).click()

    // Should redirect to list page on success
    await page.waitForURL('/admin/alerts/rules')
  })
})

// ===========================================================================
// Workflow 6: Campaign Create Form
// ===========================================================================
test.describe('Workflow 6: Campaign Create', () => {
  test.beforeEach(async ({ page }) => {
    await mockClerkAuth(page)
    await mockProgramsAPI(page)
    await mockCampaignsAPI(page)
  })

  test('campaign create form loads programs dropdown without crashing', async ({ page }) => {
    await page.goto('/admin/campaigns/new')

    await expect(page.getByRole('heading', { name: 'Create Campaign' })).toBeVisible()

    // Programs dropdown should load from API and render options
    const programSelect = page.getByTestId('campaign-program-select')
    await expect(programSelect).toBeVisible()
    await expect(programSelect.locator('option')).toHaveCount(3) // placeholder + 2 programs
  })

  test('campaign create form validates required fields', async ({ page }) => {
    await page.goto('/admin/campaigns/new')

    // Submit empty form
    await page.getByTestId('campaign-submit-btn').click()

    await expect(page.getByText('Campaign name is required')).toBeVisible()
    await expect(page.getByText('Please select a program')).toBeVisible()
    await expect(page.getByText('Please select a trigger type')).toBeVisible()
    await expect(page.getByText('Please select an action type')).toBeVisible()
    await expect(page.getByText('Start date is required')).toBeVisible()
  })

  test('campaign create submits successfully with valid data', async ({ page }) => {
    await page.goto('/admin/campaigns/new')

    // Fill all required fields
    await page.getByTestId('campaign-name').fill('Test Recovery Campaign')
    await page.getByTestId('campaign-program-select').selectOption('prog-1')
    await page.getByTestId('campaign-trigger-type').selectOption('cx.nps_submitted')
    await page.getByTestId('campaign-action-type').selectOption('award_points')
    await page.getByTestId('campaign-action-points').fill('500')
    await page.getByTestId('campaign-start-date').fill('2026-05-01')

    // Submit
    await page.getByTestId('campaign-submit-btn').click()

    // Should redirect to campaigns list on success
    await page.waitForURL('/admin/campaigns')
  })
})
