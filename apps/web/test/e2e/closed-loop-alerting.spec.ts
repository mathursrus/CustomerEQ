import { test, expect, type Page, type Route } from '@playwright/test'

/**
 * Closed-Loop Alerting E2E Tests
 *
 * Tests the alert rules management and case management workflows:
 *   1. Alert rules list (empty state + creation)
 *   2. Alert rules list — edit action (#120)
 *   3. Alert rule edit page — pre-population and PATCH submission (#120)
 *   4. Case dashboard with stats and table
 *   5. Case detail with timeline and actions
 *   6. Case status updates
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
    status: 'ACTIVE',
    surveyTypes: ['NPS'],
    slackWebhookUrl: 'https://hooks.slack.com/services/xxx',
    emailRecipients: ['sarah@example.com'],
    teamsWebhookUrl: null,
    defaultAssignee: 'Sarah K.',
    slaHours: 4,
    createdAt: '2026-03-20T08:00:00Z',
    _count: { cases: 3 },
  },
  {
    id: 'rule-2',
    name: 'CSAT Low Score',
    status: 'ACTIVE',
    surveyTypes: ['CSAT'],
    slackWebhookUrl: null,
    emailRecipients: [],
    teamsWebhookUrl: null,
    defaultAssignee: 'Mike T.',
    slaHours: 24,
    createdAt: '2026-03-22T14:30:00Z',
    _count: { cases: 1 },
  },
]

const MOCK_CASES = [
  {
    id: 'case-1',
    caseNumber: 101,
    score: 3,
    surveyName: 'Post-Purchase NPS',
    feedback: 'Very unhappy with the delivery time.',
    status: 'OPEN',
    assignee: 'Sarah K.',
    slaTarget: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    createdAt: '2026-03-27T10:14:00Z',
  },
  {
    id: 'case-2',
    caseNumber: 102,
    score: 2,
    surveyName: 'Support CSAT',
    feedback: 'Support agent was unhelpful.',
    status: 'CONTACTED',
    assignee: 'Mike T.',
    slaTarget: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    createdAt: '2026-03-26T09:00:00Z',
  },
  {
    id: 'case-3',
    caseNumber: 103,
    score: 4,
    surveyName: 'Post-Purchase NPS',
    feedback: 'Product was okay but packaging was damaged.',
    status: 'RESOLVED',
    assignee: 'Sarah K.',
    slaTarget: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    createdAt: '2026-03-25T08:00:00Z',
  },
]

const MOCK_CASE_STATS = {
  open: 1,
  contacted: 1,
  resolved: 1,
  overdue: 0,
}

const MOCK_CASE_DETAIL = {
  id: 'case-1',
  caseNumber: 101,
  memberId: 'member-1',
  score: 3,
  surveyName: 'Post-Purchase NPS',
  sentiment: -0.6,
  topics: ['delivery', 'shipping'],
  feedback: 'Very unhappy with the delivery time.',
  status: 'OPEN',
  assignee: 'Sarah K.',
  priority: 'HIGH',
  slaTarget: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  alertRuleName: 'NPS Detractor Alert',
  channelsNotified: [
    { channel: 'SLACK', sentAt: '2026-03-27T10:14:00Z', status: 'SENT' },
    { channel: 'EMAIL', sentAt: '2026-03-27T10:14:01Z', status: 'SENT' },
  ],
  notes: [
    { id: 'n1', text: 'Case opened — Alert triggered by rule "NPS Detractor Alert"', author: 'system', type: 'STATUS_CHANGE', createdAt: '2026-03-27T10:14:00Z' },
  ],
  createdAt: '2026-03-27T10:14:00Z',
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
  await page.route(`${API}/v1/alert-rules`, (route: Route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'rule-new',
          name: 'New Alert Rule',
          status: 'ACTIVE',
          surveyTypes: ['NPS'],
          slackWebhookUrl: null,
          emailRecipients: [],
          teamsWebhookUrl: null,
          defaultAssignee: 'Sarah K.',
          slaHours: 8,
          createdAt: new Date().toISOString(),
        }),
      })
    }
    // GET — return { rules } to match actual API shape
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ rules }),
    })
  })
}

// Mock data for GET /v1/alert-rules/:id — simulates what the API returns,
// including masked webhook URLs (the real endpoint masks them with ****).
const MOCK_RULE_DETAIL = {
  ...MOCK_ALERT_RULES[0],
  slackWebhookUrl: '****ices/xxx',  // masked as the real API would return
  topicFilters: ['nps', 'detractor'],
  scoreMin: 0,
  scoreMax: 6,
  sentimentThreshold: null,
  assignmentRules: [{ topic: 'shipping', assignee: 'logistics@example.com' }],
}

/** Intercept GET /v1/alert-rules/:id and PATCH /v1/alert-rules/:id */
async function mockAlertRuleDetailAPI(page: Page, ruleId = 'rule-1') {
  await page.route(`${API}/v1/alert-rules/${ruleId}`, (route: Route) => {
    if (route.request().method() === 'PATCH') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...MOCK_RULE_DETAIL, name: 'NPS Detractor Alert (Updated)' }),
      })
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_RULE_DETAIL),
    })
  })
}

/** Intercept GET /v1/cases and GET /v1/cases/:id */
async function mockCasesAPI(page: Page) {
  // List endpoint — returns cases + stats in one response
  await page.route(`${API}/v1/cases`, (route: Route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ cases: MOCK_CASES, stats: MOCK_CASE_STATS }),
      })
    }
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })

  // Detail + PATCH + POST notes (matches /v1/cases/<id>*)
  await page.route(`${API}/v1/cases/*`, (route: Route) => {
    const url = route.request().url()
    const method = route.request().method()

    // POST notes
    if (url.includes('/notes') && method === 'POST') {
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'n-new', text: 'New note', author: 'Sarah K.', type: 'NOTE', createdAt: new Date().toISOString() }),
      })
    }

    // PATCH status — return updated case detail
    if (url.includes('/status') && method === 'PATCH') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...MOCK_CASE_DETAIL, status: 'CONTACTED' }),
      })
    }

    // GET detail
    if (method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_CASE_DETAIL),
      })
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
      await mockAlertRulesAPI(page, [])

      await page.goto('/admin/alerts/rules')

      await expect(page.getByText('No alert rules yet')).toBeVisible()
      await expect(page.getByRole('link', { name: 'Create Rule' })).toBeVisible()
    })

    test('creates an alert rule and redirects to list', async ({ page }) => {
      await mockClerkAuth(page)
      await mockAlertRulesAPI(page)

      await page.goto('/admin/alerts/rules/new')

      // Fill the form using actual element IDs from the create page
      await page.locator('#ruleName').fill('New Alert Rule')
      await page.getByLabel('NPS').check()
      await page.locator('#defaultAssignee').fill('Sarah K.')
      await page.locator('#slaHours').fill('8')

      // Submit the form
      await page.getByRole('button', { name: 'Save Alert Rule' }).click()

      // Should redirect back to the alert rules list
      await page.waitForURL('/admin/alerts/rules')
      await expect(page).toHaveURL('/admin/alerts/rules')

      // The rules list should be visible with the mocked rules
      await expect(page.getByText('NPS Detractor Alert')).toBeVisible()
      await expect(page.getByText('CSAT Low Score')).toBeVisible()
    })

    // ── Issue #120: edit action ──────────────────────────────────────────────

    test('shows Edit link on each rule row in the list', async ({ page }) => {
      await mockClerkAuth(page)
      await mockAlertRulesAPI(page)

      await page.goto('/admin/alerts/rules')

      // Both rules should have an Edit link pointing to their edit pages
      await expect(page.getByRole('link', { name: 'Edit' }).first()).toBeVisible()
      const editLinks = page.getByRole('link', { name: 'Edit' })
      await expect(editLinks).toHaveCount(2)

      // First Edit link should point to the first rule's edit URL
      const firstHref = await editLinks.nth(0).getAttribute('href')
      expect(firstHref).toBe('/admin/alerts/rules/rule-1/edit')
    })

    test('edit page pre-populates form with existing rule data', async ({ page }) => {
      await mockClerkAuth(page)
      await mockAlertRulesAPI(page)
      await mockAlertRuleDetailAPI(page)

      await page.goto('/admin/alerts/rules/rule-1/edit')

      // Rule name should be pre-populated
      await expect(page.locator('#ruleName')).toHaveValue('NPS Detractor Alert')

      // SLA hours should be pre-populated
      await expect(page.locator('#slaHours')).toHaveValue('4')

      // NPS survey type should be checked
      await expect(page.getByLabel('NPS')).toBeChecked()

      // Masked Slack webhook should show helper text, not the masked value
      await expect(page.locator('#slackWebhookUrl')).toHaveValue('')
      await expect(page.getByText(/A Slack webhook URL is already configured/)).toBeVisible()
    })

    test('edit page submits PATCH and redirects to list', async ({ page }) => {
      await mockClerkAuth(page)
      await mockAlertRulesAPI(page)
      await mockAlertRuleDetailAPI(page)

      await page.goto('/admin/alerts/rules/rule-1/edit')

      // Update the rule name
      await page.locator('#ruleName').fill('NPS Detractor Alert (Updated)')

      // Submit
      await page.getByRole('button', { name: 'Save Changes' }).click()

      // Should redirect back to the rules list
      await page.waitForURL('/admin/alerts/rules')
      await expect(page).toHaveURL('/admin/alerts/rules')
    })

    test('edit page shows Cancel link back to rules list', async ({ page }) => {
      await mockClerkAuth(page)
      await mockAlertRuleDetailAPI(page)

      await page.goto('/admin/alerts/rules/rule-1/edit')

      await expect(page.getByRole('link', { name: 'Cancel' })).toBeVisible()
      const cancelHref = await page.getByRole('link', { name: 'Cancel' }).getAttribute('href')
      expect(cancelHref).toBe('/admin/alerts/rules')
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

      // Verify the cases table is visible
      await expect(page.getByTestId('cases-table')).toBeVisible()

      // Verify status badges in the table
      const table = page.getByTestId('cases-table')
      await expect(table.getByText('OPEN')).toBeVisible()
      await expect(table.getByText('CONTACTED')).toBeVisible()
      await expect(table.getByText('RESOLVED')).toBeVisible()
    })

    test('navigates to case detail and shows timeline', async ({ page }) => {
      await page.goto('/admin/alerts/cases')

      // Click on the first case (renders as #101 link)
      await page.getByRole('link', { name: '#101' }).click()
      await page.waitForURL('/admin/alerts/cases/case-1')

      // Verify case detail renders
      await expect(page.getByText('Sarah K.').first()).toBeVisible()
      await expect(page.getByText('HIGH')).toBeVisible()
      await expect(page.getByText('OPEN').first()).toBeVisible()
      await expect(page.getByText('NPS Detractor Alert').first()).toBeVisible()

      // Verify timeline entries
      await expect(page.getByText(/Alert triggered by rule/)).toBeVisible()

      // Verify action buttons
      await expect(page.getByRole('button', { name: /Mark Contacted/ })).toBeVisible()
      await expect(page.getByRole('button', { name: /Mark Resolved/ })).toBeVisible()
    })

    test('updates case status via action buttons', async ({ page }) => {
      await page.goto('/admin/alerts/cases/case-1')

      // Verify the case is currently OPEN
      await expect(page.getByText('OPEN').first()).toBeVisible()

      // Click "Mark Contacted"
      await page.getByRole('button', { name: /Mark Contacted/ }).click()

      // After the PATCH, the page reloads case data — mock returns CONTACTED
      await expect(page.getByText('CONTACTED')).toBeVisible()
    })
  })
})
