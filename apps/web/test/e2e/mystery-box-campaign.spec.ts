import { test, expect, type Page, type Route } from '@playwright/test'

const API = 'http://localhost:4000'
const CAMPAIGN_ID = 'camp-mystery-123'
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

async function mockAPIs(page: Page) {
  await page.route(`${API}/v1/programs`, (route: Route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: MOCK_PROGRAMS }) })
  })
  await page.route(`${API}/v1/campaigns`, (route: Route) => {
    if (route.request().method() === 'POST') {
      route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: CAMPAIGN_ID, status: 'DRAFT' }) })
    } else {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) })
    }
  })
}

// ─── Admin ───────────────────────────────────────────────────────────────────

test.describe('Admin creates mystery box campaign', () => {
  test.beforeEach(async ({ page }) => { await mockClerkAuth(page); await mockAPIs(page) })

  test('selecting mystery_box shows prize pool builder', async ({ page }) => {
    await page.goto('/admin/campaigns/new')
    await page.getByTestId('campaign-action-type').selectOption('mystery_box')
    await expect(page.getByTestId('prize-label-0')).toBeVisible()
    await expect(page.getByTestId('prize-label-1')).toBeVisible()
    await expect(page.getByTestId('add-prize-btn')).toBeVisible()
  })

  test('shows embed code with ceq-mystery-box after creation', async ({ page }) => {
    await page.goto('/admin/campaigns/new')
    await page.getByTestId('campaign-name').fill('Mystery Box Test')
    await page.getByTestId('campaign-program-select').selectOption('prog-1')
    await page.getByTestId('campaign-trigger-type').selectOption('purchase')
    await page.getByTestId('campaign-action-type').selectOption('mystery_box')
    await page.getByTestId('campaign-start-date').fill('2026-04-15')
    await page.getByTestId('prize-prob-0').fill('40')
    await page.getByTestId('prize-prob-1').fill('60')

    await page.getByTestId('campaign-submit-btn').click()
    await expect(page.getByRole('heading', { name: 'Campaign Created!' })).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('/mystery/')).toBeVisible()
  })
})

// ─── Member ──────────────────────────────────────────────────────────────────

test.describe('Member opens mystery box', () => {
  const MOCK_PLAY_FIRST = {
    alreadyPlayed: false, campaignType: 'mystery_box', boxStyle: 'gift',
    prize: { type: 'points', points: 500, label: '500 Points!' },
  }
  const MOCK_PLAY_ALREADY = {
    alreadyPlayed: true,
    prize: { type: 'points', points: 500, label: '500 Points!' },
  }

  test('shows email entry page', async ({ page }) => {
    await page.goto(`/mystery/${CAMPAIGN_ID}`)
    await expect(page.getByText('Mystery Reward')).toBeVisible()
    await expect(page.getByTestId('member-email-input')).toBeVisible()
    await expect(page.getByTestId('member-claim-btn')).toBeVisible()
  })

  test('shows mystery box after email entry', async ({ page }) => {
    await page.route(`${API}/v1/public/campaigns/${CAMPAIGN_ID}/play`, (route: Route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PLAY_FIRST) })
    })
    await page.goto(`/mystery/${CAMPAIGN_ID}`)
    await page.getByTestId('member-email-input').fill('bob@example.com')
    await page.getByTestId('member-claim-btn').click()

    await expect(page.getByText("Tap the box to discover what's inside")).toBeVisible()
    await expect(page.getByTestId('mystery-box')).toBeVisible()
  })

  test('opening box reveals prize', async ({ page }) => {
    await page.route(`${API}/v1/public/campaigns/${CAMPAIGN_ID}/play`, (route: Route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PLAY_FIRST) })
    })
    await page.goto(`/mystery/${CAMPAIGN_ID}`)
    await page.getByTestId('member-email-input').fill('bob@example.com')
    await page.getByTestId('member-claim-btn').click()

    await page.getByTestId('mystery-box').click()
    await expect(page.getByText('Congratulations!')).toBeVisible({ timeout: 3000 })
    await expect(page.getByText('500 Points!')).toBeVisible()
  })

  test('already-opened shows prize without animation', async ({ page }) => {
    await page.route(`${API}/v1/public/campaigns/${CAMPAIGN_ID}/play`, (route: Route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PLAY_ALREADY) })
    })
    await page.goto(`/mystery/${CAMPAIGN_ID}`)
    await page.getByTestId('member-email-input').fill('alice@example.com')
    await page.getByTestId('member-claim-btn').click()

    await expect(page.getByText('already opened')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Your Prize' })).toBeVisible()
    await expect(page.getByText('500 Points!')).toBeVisible()
  })

  test('shows error for API failure', async ({ page }) => {
    await page.route(`${API}/v1/public/campaigns/${CAMPAIGN_ID}/play`, (route: Route) => {
      route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'Campaign not found' }) })
    })
    await page.goto(`/mystery/${CAMPAIGN_ID}`)
    await page.getByTestId('member-email-input').fill('test@example.com')
    await page.getByTestId('member-claim-btn').click()

    await expect(page.getByText('Campaign not found')).toBeVisible()
  })
})
