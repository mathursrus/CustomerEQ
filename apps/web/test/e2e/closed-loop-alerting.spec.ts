import { test, expect, type Page, type Route } from '@playwright/test'

/**
 * Closed-Loop Alerting E2E Tests
 *
 * Tests the alert rules management and case management workflows:
 *   1. Alert rules list (empty state + creation)
 *   2. Case dashboard with stats and table
 *   3. Case detail with timeline and actions
 *   4. Case status updates
 *
 * API calls are intercepted with `page.route()` so the suite runs without
 * a live backend. Selector strategy: data-testid first, then role/text.
 */

// ---------------------------------------------------------------------------
// Constants & Mock Data
// ---------------------------------------------------------------------------

const API = 'http://localhost:4000'

const MOCK_ALERT_RULES = [
  {
    id: 'rule-1',
    name: 'NPS Detractor Alert',
    metric: 'NPS',
    condition: 'LESS_THAN',
    threshold: 7,
    slaHours: 4,
    assignee: 'Sarah K.',
    status: 'ACTIVE',
    createdAt: '2026-03-20T08:00:00Z',
  },
  {
    id: 'rule-2',
    name: 'CSAT Low Score',
    metric: 'CSAT',
    condition: 'LESS_THAN',
    threshold: 3,
    slaHours: 24,
    assignee: 'Mike T.',
    status: 'ACTIVE',
    createdAt: '2026-03-22T14:30:00Z',
  },
]

const MOCK_CASES = [
  {
    id: 'case-1',
    status: 'OPEN',
    assignee: 'Sarah K.',
    priority: 'HIGH',
    memberId: 'member-1',
    surveyResponseId: 'resp-1',
    slaDeadline: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    slaStatus: 'ON_TRACK',
    alertRule: { name: 'NPS Detractor Alert', slaHours: 4 },
    notes: [
      { text: 'Case opened — Alert triggered by rule "NPS Detractor Alert"', author: 'system', timestamp: '2026-03-27T10:14:00Z' },
    ],
    createdAt: '2026-03-27T10:14:00Z',
  },
  {
    id: 'case-2',
    status: 'CONTACTED',
    assignee: 'Mike T.',
    priority: 'MEDIUM',
    memberId: 'member-2',
    surveyResponseId: 'resp-2',
    slaDeadline: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    slaStatus: 'ON_TRACK',
    alertRule: { name: 'CSAT Low Score', slaHours: 24 },
    notes: [
      { text: 'Case opened — Alert triggered by rule "CSAT Low Score"', author: 'system', timestamp: '2026-03-26T09:00:00Z' },
      { text: 'Reached out via email', author: 'Mike T.', timestamp: '2026-03-26T11:30:00Z' },
    ],
    createdAt: '2026-03-26T09:00:00Z',
  },
  {
    id: 'case-3',
    status: 'RESOLVED',
    assignee: 'Sarah K.',
    priority: 'LOW',
    memberId: 'member-3',
    surveyResponseId: 'resp-3',
    slaDeadline: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    slaStatus: 'MET',
    alertRule: { name: 'NPS Detractor Alert', slaHours: 4 },
    notes: [
      { text: 'Case opened — Alert triggered by rule "NPS Detractor Alert"', author: 'system', timestamp: '2026-03-25T08:00:00Z' },
      { text: 'Issue resolved after phone call', author: 'Sarah K.', timestamp: '2026-03-25T10:00:00Z' },
    ],
    createdAt: '2026-03-25T08:00:00Z',
  },
]

const MOCK_CASE_DETAIL = MOCK_CASES[0]

const MOCK_CASE_STATS = {
  open: 1,
  contacted: 1,
  resolved: 1,
  overdue: 0,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

/** Intercept GET and POST for /v1/alert-rules */
async function mockAlertRulesAPI(page: Page, rules = MOCK_ALERT_RULES) {
  // List endpoint
  await page.route(`${API}/v1/alert-rules`, (route: Route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ alertRules: rules }),
      })
    }
    // POST — rule creation
    return route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'rule-new',
        name: 'New Alert Rule',
        metric: 'NPS',
        condition: 'LESS_THAN',
        threshold: 5,
        slaHours: 8,
        assignee: 'Sarah K.',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      }),
    })
  })

  // Detail endpoint (matches /v1/alert-rules/<id>)
  await page.route(`${API}/v1/alert-rules/*`, (route: Route) => {
    const url = route.request().url()
    const id = url.split('/v1/alert-rules/')[1]?.split('?')[0]
    const rule = rules.find((r) => r.id === id)
    if (rule) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(rule),
      })
    }
    route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"Not found"}' })
  })
}

/** Intercept GET /v1/cases, GET /v1/cases/:id, PATCH status, POST notes */
async function mockCasesAPI(page: Page, cases = MOCK_CASES) {
  // Stats endpoint
  await page.route(`${API}/v1/cases/stats`, (route: Route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_CASE_STATS),
    })
  })

  // List endpoint
  await page.route(`${API}/v1/cases`, (route: Route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ cases }),
      })
    }
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })

  // Detail / PATCH / POST notes (matches /v1/cases/<id> and /v1/cases/<id>/notes)
  await page.route(`${API}/v1/cases/*`, (route: Route) => {
    const url = route.request().url()
    const method = route.request().method()

    // POST notes — /v1/cases/:id/notes
    if (url.includes('/notes') && method === 'POST') {
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ text: 'New note added', author: 'Sarah K.', timestamp: new Date().toISOString() }),
      })
    }

    // PATCH status — /v1/cases/:id
    if (method === 'PATCH') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...MOCK_CASE_DETAIL, status: 'CONTACTED' }),
      })
    }

    // GET detail — /v1/cases/:id
    if (method === 'GET') {
      const id = url.split('/v1/cases/')[1]?.split('?')[0]?.split('/')[0]
      const found = cases.find((c) => c.id === id)
      if (found) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(found),
        })
      }
      return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"Not found"}' })
    }

    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })
}

// ===========================================================================
// Closed-Loop Alerting Tests
// ===========================================================================
test.describe('Closed-Loop Alerting', () => {
  // =========================================================================
  // Alert Rules
  // =========================================================================

  test.describe('Alert Rules', () => {
    test('displays alert rules list with empty state', async ({ page }) => {
      await mockClerkAuth(page)
      // Override to return empty rules
      await mockAlertRulesAPI(page, [])

      await page.goto('/admin/alerts/rules')

      // Should show empty state message
      await expect(page.getByText('No alert rules yet')).toBeVisible()

      // Should show a link/button to create a new rule
      const createLink = page.getByRole('link', { name: /Create Rule/i })
      await expect(createLink).toBeVisible()
    })

    test('creates an alert rule and redirects to list', async ({ page }) => {
      await mockClerkAuth(page)
      await mockAlertRulesAPI(page)

      await page.goto('/admin/alerts/rules/new')

      // Fill the alert rule creation form
      await page.getByTestId('alert-rule-name').fill('New Alert Rule')
      await page.getByTestId('alert-rule-metric').selectOption('NPS')
      await page.getByTestId('alert-rule-condition').selectOption('LESS_THAN')
      await page.getByTestId('alert-rule-threshold').fill('5')
      await page.getByTestId('alert-rule-sla-hours').fill('8')
      await page.getByTestId('alert-rule-assignee').fill('Sarah K.')

      // Submit the form
      await page.getByTestId('alert-rule-submit-btn').click()

      // Should redirect back to the alert rules list
      await page.waitForURL('/admin/alerts/rules')
      await expect(page).toHaveURL('/admin/alerts/rules')

      // The rules list should be visible with the mocked rules
      await expect(page.getByText('NPS Detractor Alert')).toBeVisible()
      await expect(page.getByText('CSAT Low Score')).toBeVisible()
    })
  })

  // =========================================================================
  // Case Management
  // =========================================================================

  test.describe('Case Management', () => {
    test.beforeEach(async ({ page }) => {
      await mockClerkAuth(page)
      await mockAlertRulesAPI(page)
      await mockCasesAPI(page)
    })

    test('displays case dashboard with stats and table', async ({ page }) => {
      await page.goto('/admin/alerts/cases')

      // Verify stats cards are visible
      await expect(page.getByTestId('case-stat-open')).toBeVisible()
      await expect(page.getByTestId('case-stat-contacted')).toBeVisible()
      await expect(page.getByTestId('case-stat-resolved')).toBeVisible()
      await expect(page.getByTestId('case-stat-overdue')).toBeVisible()

      // Verify stats values from mock data
      await expect(page.getByTestId('case-stat-open')).toContainText('1')
      await expect(page.getByTestId('case-stat-contacted')).toContainText('1')
      await expect(page.getByTestId('case-stat-resolved')).toContainText('1')
      await expect(page.getByTestId('case-stat-overdue')).toContainText('0')

      // Verify the cases table is visible with rows
      await expect(page.getByTestId('cases-table')).toBeVisible()

      // Verify table rows show case data with status badges
      await expect(page.getByText('OPEN')).toBeVisible()
      await expect(page.getByText('CONTACTED')).toBeVisible()
      await expect(page.getByText('RESOLVED')).toBeVisible()

      // Verify assignee names appear in the table
      await expect(page.getByText('Sarah K.').first()).toBeVisible()
      await expect(page.getByText('Mike T.')).toBeVisible()

      // Verify alert rule names appear
      await expect(page.getByText('NPS Detractor Alert').first()).toBeVisible()
      await expect(page.getByText('CSAT Low Score')).toBeVisible()
    })

    test('navigates to case detail and shows timeline', async ({ page }) => {
      await page.goto('/admin/alerts/cases')

      // Click on the first case to go to its detail page
      await page.getByRole('link', { name: /case-1/i }).click()
      await page.waitForURL('/admin/alerts/cases/case-1')

      // Verify case detail page renders respondent info
      await expect(page.getByText('Sarah K.')).toBeVisible()
      await expect(page.getByText('HIGH')).toBeVisible()
      await expect(page.getByText('OPEN')).toBeVisible()
      await expect(page.getByText('NPS Detractor Alert')).toBeVisible()

      // Verify timeline entries are displayed
      await expect(page.getByText('Case opened')).toBeVisible()
      await expect(page.getByText(/Alert triggered by rule/)).toBeVisible()

      // Verify action buttons are visible
      await expect(page.getByRole('button', { name: /Mark Contacted/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /Resolve/i })).toBeVisible()
    })

    test('updates case status via action buttons', async ({ page }) => {
      await page.goto('/admin/alerts/cases/case-1')

      // Verify the case is currently OPEN
      await expect(page.getByText('OPEN')).toBeVisible()

      // Click "Mark Contacted" to update status
      await page.getByRole('button', { name: /Mark Contacted/i }).click()

      // After the PATCH response, the status should update to CONTACTED
      await expect(page.getByText('CONTACTED')).toBeVisible()
    })
  })
})
