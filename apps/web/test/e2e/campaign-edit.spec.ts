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

const MOCK_PROGRAMS = [{ id: 'prog-1', name: 'Acme Rewards' }]

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
    await page.route(`${API}/v1/programs`, (route: Route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: MOCK_PROGRAMS }) })
    })
    await page.route(`${API}/v1/campaigns/${CAMPAIGN_ID}`, (route: Route) => {
      if (route.request().method() === 'PATCH') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...MOCK_CAMPAIGN, name: 'Updated Name' }) })
      } else {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_CAMPAIGN) })
      }
    })
  })

  test('edit page shows full form with segment builder and preview', async ({ page }) => {
    await page.goto(`/admin/campaigns/${CAMPAIGN_ID}/edit`)

    // Uses shared CampaignForm — same testids as creation page
    await expect(page.getByTestId('campaign-name')).toHaveValue('Holiday Spin & Win')
    await expect(page.getByTestId('campaign-trigger-type')).toHaveValue('purchase')
    // Spin wheel segment builder should be visible
    await expect(page.getByTestId('segment-label-0')).toBeVisible()
    await expect(page.getByTestId('segment-label-1')).toBeVisible()
    // Live preview should be visible
    await expect(page.getByText('Live Preview')).toBeVisible()
  })

  test('can change name and save', async ({ page }) => {
    await page.route(`${API}/v1/campaigns`, (route: Route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) })
    })

    await page.goto(`/admin/campaigns/${CAMPAIGN_ID}/edit`)
    await page.getByTestId('campaign-name').fill('Updated Campaign')
    await page.getByTestId('campaign-submit-btn').click()

    // Should redirect to campaigns list
    await page.waitForURL('**/admin/campaigns', { timeout: 5000 })
  })

  test('action type can be changed on DRAFT campaigns', async ({ page }) => {
    await page.goto(`/admin/campaigns/${CAMPAIGN_ID}/edit`)

    // Action type should be editable for DRAFT
    await expect(page.getByTestId('campaign-action-type')).toBeEnabled()
  })

  test('action type is locked on ACTIVE campaigns', async ({ page }) => {
    await page.route(`${API}/v1/campaigns/${CAMPAIGN_ID}`, (route: Route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...MOCK_CAMPAIGN, status: 'ACTIVE' }) })
      } else {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_CAMPAIGN) })
      }
    })

    await page.goto(`/admin/campaigns/${CAMPAIGN_ID}/edit`)
    await expect(page.getByTestId('campaign-action-type')).toBeDisabled()
  })

  test('title shows Edit Campaign', async ({ page }) => {
    await page.goto(`/admin/campaigns/${CAMPAIGN_ID}/edit`)
    await expect(page.getByRole('heading', { name: 'Edit Campaign' })).toBeVisible()
  })
})
