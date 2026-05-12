import { test, expect, type Page, type Route } from '@playwright/test'

/**
 * Survey Creation → Detail Redirect E2E Tests
 *
 * Verifies that after creating a survey, the admin is redirected to the
 * survey detail page (not the list page), where they can see survey info,
 * status controls, share links, and the responses table.
 *
 * API calls are intercepted with `page.route()` so the suite runs without
 * a live backend. Selector strategy: data-testid first, then role/text.
 */

const API = 'http://localhost:4000'

const MOCK_SURVEY_ID = 'survey-new-123'

const MOCK_PROGRAMS = [
  { id: 'prog-1', name: 'Gold Rewards' },
  { id: 'prog-2', name: 'Silver Tier' },
]

const MOCK_CREATED_SURVEY = {
  id: MOCK_SURVEY_ID,
  name: 'Post-Purchase NPS',
  type: 'NPS',
  status: 'DRAFT',
  createdAt: '2026-03-27T00:00:00Z',
  _count: { responses: 0 },
  responses: [],
}

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
      body: JSON.stringify({ programs: MOCK_PROGRAMS }),
    })
  })
}

/** Intercept survey creation (POST) and survey detail (GET) */
async function mockSurveysAPI(page: Page) {
  // POST /v1/surveys — creation returns the new survey with an id
  await page.route(`${API}/v1/surveys`, (route: Route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_CREATED_SURVEY),
      })
    }
    // GET /v1/surveys — list (not used in this test but handle gracefully)
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ surveys: [] }),
    })
  })

  // GET /v1/surveys/:id — detail page fetches this
  await page.route(`${API}/v1/surveys/*`, (route: Route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_CREATED_SURVEY),
    })
  })
}

// ===========================================================================
// Survey Creation → Detail Redirect
// ===========================================================================
test.describe('Survey Creation Redirect', () => {
  test.beforeEach(async ({ page }) => {
    await mockClerkAuth(page)
    await mockProgramsAPI(page)
    await mockSurveysAPI(page)
  })

  test('redirects to survey detail page after successful creation', async ({ page }) => {
    await page.goto('/admin/surveys/new')

    // Fill the survey creation form
    await page.getByTestId('survey-name-input').fill('Post-Purchase NPS')
    await page.getByTestId('survey-program-select').selectOption('prog-1')
    await page.getByTestId('survey-type-select').selectOption('NPS')
    await page.getByTestId('survey-incentive-input').fill('50')

    // Submit the form
    await page.getByTestId('survey-submit-btn').click()

    // Should redirect to the survey detail page, NOT the list page
    await page.waitForURL(`/admin/surveys/${MOCK_SURVEY_ID}`, { waitUntil: 'commit' })
    await expect(page).toHaveURL(`/admin/surveys/${MOCK_SURVEY_ID}`)

    // Verify the detail page renders the survey info
    await expect(page.getByRole('heading', { name: 'Post-Purchase NPS' })).toBeVisible()
    await expect(page.getByText('NPS', { exact: true })).toBeVisible()
    await expect(page.getByText('DRAFT', { exact: true })).toBeVisible()

    // Verify the responses table is present (empty state)
    await expect(page.getByTestId('survey-responses-table')).toBeVisible()
    await expect(page.getByText('No responses yet.')).toBeVisible()
  })

  test('shows survey status controls on the detail page after creation', async ({ page }) => {
    await page.goto('/admin/surveys/new')

    // Fill and submit
    await page.getByTestId('survey-name-input').fill('Post-Purchase NPS')
    await page.getByTestId('survey-program-select').selectOption('prog-1')
    await page.getByTestId('survey-submit-btn').click()

    // Wait for redirect to detail
    await page.waitForURL(`/admin/surveys/${MOCK_SURVEY_ID}`, { waitUntil: 'commit' })

    // DRAFT survey should show Activate and Close buttons (no Pause)
    await expect(page.getByRole('button', { name: 'Activate' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Close' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Pause' })).not.toBeVisible()
  })

  test('shows share link and embed widget on the detail page after creation', async ({ page }) => {
    await page.goto('/admin/surveys/new')

    // Fill and submit
    await page.getByTestId('survey-name-input').fill('Post-Purchase NPS')
    await page.getByTestId('survey-program-select').selectOption('prog-1')
    await page.getByTestId('survey-submit-btn').click()

    // Wait for redirect to detail
    await page.waitForURL(`/admin/surveys/${MOCK_SURVEY_ID}`, { waitUntil: 'commit' })

    // Verify Share Link section is visible and contains the survey ID
    await expect(page.getByText('Share Link')).toBeVisible()
    await expect(page.locator('code').filter({ hasText: MOCK_SURVEY_ID }).first()).toBeVisible()

    // Verify Embed Widget section is visible
    await expect(page.getByText('Embed Widget')).toBeVisible()
    await expect(page.locator('code').filter({ hasText: 'widget.js' })).toBeVisible()
  })
})
