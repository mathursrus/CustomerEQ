import { test, expect, type Page, type Route } from '@playwright/test'

const API = 'http://localhost:4000'
const CAMPAIGN_ID = 'camp-edit-123'

const MOCK_CAMPAIGN = {
  id: CAMPAIGN_ID,
  name: 'Holiday Spin & Win',
  programId: 'prog-1',
  triggerType: 'purchase',
  triggerCondition: {},
  actionType: 'spin_wheel',
  actionConfig: {
    segments: [
      { points: 500, probability: 40, label: '500 Points!', color: '#4F46E5' },
      { points: 100, probability: 60, label: '100 Points', color: '#10B981' },
    ],
    wheelStyle: 'classic',
  },
  budgetCap: 5000,
  budgetSpent: 150,
  startDate: '2026-04-15T00:00:00.000Z',
  endDate: null,
  status: 'DRAFT',
}

async function mockClerkAuth(page: Page) {
  await page.route('**/clerk.**', (route: Route) => {
    if (route.request().resourceType() === 'document') return route.continue()
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })
  await page.route('**/.well-known/**', (route: Route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })
}

test.describe('Campaign edit page', () => {
  test.beforeEach(async ({ page }) => {
    await mockClerkAuth(page)
    await page.route(`${API}/v1/campaigns/${CAMPAIGN_ID}`, (route: Route) => {
      if (route.request().method() === 'PATCH') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...MOCK_CAMPAIGN, name: 'Updated Name' }) })
      } else {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_CAMPAIGN) })
      }
    })
  })

  test('form is pre-filled with existing campaign values', async ({ page }) => {
    await page.goto(`/admin/campaigns/${CAMPAIGN_ID}/edit`)

    await expect(page.getByTestId('edit-campaign-name')).toHaveValue('Holiday Spin & Win')
    await expect(page.getByTestId('edit-budget-cap')).toHaveValue('5000')
    await expect(page.getByTestId('edit-trigger-type')).toHaveValue('purchase')
    await expect(page.getByText('Spin Wheel')).toBeVisible()
    await expect(page.getByText('500 Points!')).toBeVisible()
    await expect(page.getByText('100 Points')).toBeVisible()
  })

  test('can edit name and save', async ({ page }) => {
    await page.route(`${API}/v1/campaigns`, (route: Route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) })
    })

    await page.goto(`/admin/campaigns/${CAMPAIGN_ID}/edit`)
    await page.getByTestId('edit-campaign-name').fill('Updated Campaign Name')
    await page.getByTestId('edit-save-btn').click()

    await expect(page.getByText('Saved!')).toBeVisible({ timeout: 3000 })
  })

  test('shows DRAFT status and all fields editable', async ({ page }) => {
    await page.goto(`/admin/campaigns/${CAMPAIGN_ID}/edit`)

    await expect(page.getByText('DRAFT')).toBeVisible()
    await expect(page.getByTestId('edit-trigger-type')).toBeEnabled()
    await expect(page.getByTestId('edit-start-date')).toBeEnabled()
  })

  test('shows warning and locks fields for ACTIVE campaign', async ({ page }) => {
    await page.route(`${API}/v1/campaigns/${CAMPAIGN_ID}`, (route: Route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...MOCK_CAMPAIGN, status: 'ACTIVE' }) })
      } else {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_CAMPAIGN) })
      }
    })

    await page.goto(`/admin/campaigns/${CAMPAIGN_ID}/edit`)

    await expect(page.getByText('This campaign is active')).toBeVisible()
    await expect(page.getByTestId('edit-campaign-name')).toBeEnabled() // name still editable
    await expect(page.getByTestId('edit-budget-cap')).toBeEnabled() // budget still editable
    await expect(page.getByTestId('edit-trigger-type')).toBeDisabled() // locked
    await expect(page.getByTestId('edit-start-date')).toBeDisabled() // locked
  })

  test('shows cancel button that navigates back', async ({ page }) => {
    await page.route(`${API}/v1/campaigns`, (route: Route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) })
    })

    await page.goto(`/admin/campaigns/${CAMPAIGN_ID}/edit`)
    await page.getByText('Cancel').click()
    await page.waitForURL('**/admin/campaigns', { timeout: 3000 })
  })
})
