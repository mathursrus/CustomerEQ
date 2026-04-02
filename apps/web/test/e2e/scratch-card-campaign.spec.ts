import { test, expect, type Page, type Route } from '@playwright/test'

/**
 * Scratch Card Campaign E2E Tests — Admin + Member
 * Tests against real Next.js app with mocked API.
 */

const API = 'http://localhost:4000'
const MOCK_PROGRAMS = [{ id: 'prog-1', name: 'Acme Rewards' }]
const CAMPAIGN_ID = 'camp-scratch-123'

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

// ─── Admin: Scratch Card Campaign ────────────────────────────────────────────

test.describe('Admin creates scratch card campaign', () => {
  test.beforeEach(async ({ page }) => {
    await mockClerkAuth(page)
    await mockAPIs(page)
  })

  test('selecting scratch_card shows prize pool builder', async ({ page }) => {
    await page.goto('/admin/campaigns/new')
    await page.getByTestId('campaign-action-type').selectOption('scratch_card')

    await expect(page.getByTestId('prize-label-0')).toBeVisible()
    await expect(page.getByTestId('prize-label-1')).toBeVisible()
    await expect(page.getByTestId('prize-prob-0')).toBeVisible()
    await expect(page.getByTestId('add-prize-btn')).toBeVisible()
    await expect(page.getByTestId('scratch-text-input')).toBeVisible()
  })

  test('probability sum validation works', async ({ page }) => {
    await page.goto('/admin/campaigns/new')
    await page.getByTestId('campaign-action-type').selectOption('scratch_card')

    await page.getByTestId('prize-prob-0').fill('20')
    await page.getByTestId('prize-prob-1').fill('20')

    await expect(page.getByText('must be 100%')).toBeVisible()
  })

  test('can add and remove prizes', async ({ page }) => {
    await page.goto('/admin/campaigns/new')
    await page.getByTestId('campaign-action-type').selectOption('scratch_card')

    await page.getByTestId('add-prize-btn').click()
    await expect(page.getByTestId('prize-label-2')).toBeVisible()

    await page.getByTestId('prize-remove-2').click()
    await expect(page.getByTestId('prize-label-2')).not.toBeVisible()
  })

  test('shows embed code after successful creation', async ({ page }) => {
    await page.goto('/admin/campaigns/new')

    await page.getByTestId('campaign-name').fill('Holiday Scratch & Win')
    await page.getByTestId('campaign-program-select').selectOption('prog-1')
    await page.getByTestId('campaign-trigger-type').selectOption('purchase')
    await page.getByTestId('campaign-action-type').selectOption('scratch_card')
    await page.getByTestId('campaign-start-date').fill('2026-04-15')
    await page.getByTestId('prize-prob-0').fill('40')
    await page.getByTestId('prize-prob-1').fill('60')

    await page.getByTestId('campaign-submit-btn').click()

    await expect(page.getByRole('heading', { name: 'Campaign Created!' })).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('heading', { name: 'Embed Code' })).toBeVisible()
    await expect(page.getByTestId('copy-embed-btn')).toBeVisible()
    await expect(page.getByText(CAMPAIGN_ID).first()).toBeVisible()
  })

  test('scratch card preview shows in side panel', async ({ page }) => {
    await page.goto('/admin/campaigns/new')
    await page.getByTestId('campaign-action-type').selectOption('scratch_card')

    await expect(page.getByTestId('scratch-preview')).toBeVisible()
    await expect(page.getByText('Live Preview')).toBeVisible()
  })
})

// ─── Member: Scratch Card ────────────────────────────────────────────────────

test.describe('Member scratches card', () => {
  const MOCK_PLAY_FIRST = {
    alreadyPlayed: false,
    campaignType: 'scratch_card',
    cardStyle: 'gold',
    scratchText: 'Scratch to reveal!',
    prize: { type: 'points', points: 500, label: '500 Points!' },
  }

  const MOCK_PLAY_ALREADY = {
    alreadyPlayed: true,
    prize: { type: 'points', points: 500, label: '500 Points!' },
  }

  test('shows email entry page', async ({ page }) => {
    await page.goto(`/scratch/${CAMPAIGN_ID}`)
    await expect(page.getByText('Scratch & Win!')).toBeVisible()
    await expect(page.getByTestId('member-email-input')).toBeVisible()
    await expect(page.getByTestId('member-claim-btn')).toBeVisible()
  })

  test('shows scratch card after email entry', async ({ page }) => {
    await page.route(`${API}/v1/public/campaigns/${CAMPAIGN_ID}/play`, (route: Route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PLAY_FIRST) })
    })
    await page.goto(`/scratch/${CAMPAIGN_ID}`)
    await page.getByTestId('member-email-input').fill('bob@example.com')
    await page.getByTestId('member-claim-btn').click()

    await expect(page.getByText('Scratch the card to reveal your prize')).toBeVisible()
    await expect(page.getByTestId('scratch-canvas')).toBeVisible()
  })

  test('shows already-played state', async ({ page }) => {
    await page.route(`${API}/v1/public/campaigns/${CAMPAIGN_ID}/play`, (route: Route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PLAY_ALREADY) })
    })
    await page.goto(`/scratch/${CAMPAIGN_ID}`)
    await page.getByTestId('member-email-input').fill('alice@example.com')
    await page.getByTestId('member-claim-btn').click()

    await expect(page.getByText('already scratched')).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('heading', { name: 'Your Prize' })).toBeVisible()
  })

  test('shows error for invalid email', async ({ page }) => {
    await page.goto(`/scratch/${CAMPAIGN_ID}`)
    await page.getByTestId('member-email-input').fill('not-email')
    await page.getByTestId('member-claim-btn').click()

    await expect(page.getByText('Enter a valid email')).toBeVisible()
  })

  test('shows API error', async ({ page }) => {
    await page.route(`${API}/v1/public/campaigns/${CAMPAIGN_ID}/play`, (route: Route) => {
      route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'Campaign not found' }) })
    })
    await page.goto(`/scratch/${CAMPAIGN_ID}`)
    await page.getByTestId('member-email-input').fill('test@example.com')
    await page.getByTestId('member-claim-btn').click()

    await expect(page.getByText('Campaign not found')).toBeVisible()
  })
})
