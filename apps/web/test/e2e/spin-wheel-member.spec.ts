import { test, expect, type Page, type Route } from '@playwright/test'

/**
 * Spin-the-Wheel Member Experience E2E Tests
 *
 * Tests the public /spin/:id page against the real Next.js app.
 * API calls intercepted with page.route() — no live backend required.
 */

const API = 'http://localhost:4000'
const CAMPAIGN_ID = 'camp-test-spin'

const MOCK_PLAY_FIRST_TIME = {
  alreadyPlayed: false,
  campaignType: 'spin_wheel',
  segments: [
    { label: '500 Points!', color: '#4F46E5', index: 0 },
    { label: '100 Points', color: '#10B981', index: 1 },
    { label: 'Coffee', color: '#F59E0B', index: 2 },
  ],
  winningIndex: 0,
  wheelStyle: 'classic',
  reward: { type: 'points', points: 500, label: '500 Points!', rewardId: null },
}

const MOCK_PLAY_ALREADY_PLAYED = {
  alreadyPlayed: true,
  reward: { type: 'points', points: 500, label: '500 Points!', rewardId: null },
}

function mockPlayEndpoint(page: Page, response: object, statusCode = 200) {
  return page.route(`${API}/v1/public/campaigns/${CAMPAIGN_ID}/play`, (route: Route) => {
    route.fulfill({
      status: statusCode,
      contentType: 'application/json',
      body: JSON.stringify(response),
    })
  })
}

// ─── Email Entry Page ────────────────────────────────────────────────────────

test.describe('Member spin: email entry page', () => {
  test('shows email input and claim button', async ({ page }) => {
    await page.goto(`/spin/${CAMPAIGN_ID}`)

    await expect(page.getByText('Spin & Win!')).toBeVisible()
    await expect(page.getByText('Enter your email to claim your spin')).toBeVisible()
    await expect(page.getByTestId('member-email-input')).toBeVisible()
    await expect(page.getByTestId('member-claim-spin-btn')).toBeVisible()
    await expect(page.getByText('Powered by CustomerEQ')).toBeVisible()
  })

  test('shows error for invalid email', async ({ page }) => {
    await page.goto(`/spin/${CAMPAIGN_ID}`)

    await page.getByTestId('member-email-input').fill('not-an-email')
    await page.getByTestId('member-claim-spin-btn').click()

    await expect(page.getByText('Enter a valid email')).toBeVisible()
  })

  test('shows API error message when play endpoint fails', async ({ page }) => {
    await mockPlayEndpoint(page, { error: 'Campaign not found' }, 404)
    await page.goto(`/spin/${CAMPAIGN_ID}`)

    await page.getByTestId('member-email-input').fill('nobody@example.com')
    await page.getByTestId('member-claim-spin-btn').click()

    await expect(page.getByText('Campaign not found')).toBeVisible()
  })

  test('shows error when member has no consent', async ({ page }) => {
    await mockPlayEndpoint(page, { error: 'Consent required' }, 403)
    await page.goto(`/spin/${CAMPAIGN_ID}`)

    await page.getByTestId('member-email-input').fill('noconsent@example.com')
    await page.getByTestId('member-claim-spin-btn').click()

    await expect(page.getByText('Consent required')).toBeVisible()
  })

  test('shows error when campaign has ended', async ({ page }) => {
    await mockPlayEndpoint(page, { error: 'Campaign has ended' }, 410)
    await page.goto(`/spin/${CAMPAIGN_ID}`)

    await page.getByTestId('member-email-input').fill('late@example.com')
    await page.getByTestId('member-claim-spin-btn').click()

    await expect(page.getByText('Campaign has ended')).toBeVisible()
  })
})

// ─── First Play: Spin the Wheel ──────────────────────────────────────────────

test.describe('Member spin: first play flow', () => {
  test('shows wheel with SPIN button after entering email', async ({ page }) => {
    await mockPlayEndpoint(page, MOCK_PLAY_FIRST_TIME)
    await page.goto(`/spin/${CAMPAIGN_ID}`)

    await page.getByTestId('member-email-input').fill('bob@example.com')
    await page.getByTestId('member-claim-spin-btn').click()

    await expect(page.getByText('Tap SPIN to reveal your reward')).toBeVisible()
    await expect(page.getByTestId('member-spin-btn')).toBeVisible()
    await expect(page.getByTestId('member-spin-btn')).toContainText('SPIN')
  })

  test('spinning shows congratulations with winning prize', async ({ page }) => {
    await mockPlayEndpoint(page, MOCK_PLAY_FIRST_TIME)
    await page.goto(`/spin/${CAMPAIGN_ID}`)

    await page.getByTestId('member-email-input').fill('bob@example.com')
    await page.getByTestId('member-claim-spin-btn').click()

    await page.getByTestId('member-spin-btn').click()

    // Wait for 5s animation + result
    await expect(page.getByText('Congratulations!')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('500 Points!')).toBeVisible()
    await expect(page.getByText('Your reward has been added to your account.')).toBeVisible()
  })

  test('spin button shows checkmark after spinning', async ({ page }) => {
    await mockPlayEndpoint(page, MOCK_PLAY_FIRST_TIME)
    await page.goto(`/spin/${CAMPAIGN_ID}`)

    await page.getByTestId('member-email-input').fill('bob@example.com')
    await page.getByTestId('member-claim-spin-btn').click()
    await page.getByTestId('member-spin-btn').click()

    await expect(page.getByText('Congratulations!')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('member-spin-btn')).toContainText('✓')
    await expect(page.getByTestId('member-spin-btn')).toBeDisabled()
  })
})

// ─── Already Played ──────────────────────────────────────────────────────────

test.describe('Member spin: already played', () => {
  test('shows previous prize without wheel when already played', async ({ page }) => {
    await mockPlayEndpoint(page, MOCK_PLAY_ALREADY_PLAYED)
    await page.goto(`/spin/${CAMPAIGN_ID}`)

    await page.getByTestId('member-email-input').fill('alice@example.com')
    await page.getByTestId('member-claim-spin-btn').click()

    await expect(page.getByText('You already played!')).toBeVisible()
    await expect(page.getByText('Your Prize')).toBeVisible()
    await expect(page.getByText('500 Points!')).toBeVisible()
    await expect(page.getByText('You already claimed this reward.')).toBeVisible()
    // No SPIN button shown for already-played
    await expect(page.getByTestId('member-spin-btn')).not.toBeVisible()
  })
})

// ─── Spin Not Ready (Race Condition) ─────────────────────────────────────────

test.describe('Member spin: not ready yet', () => {
  test('shows retry message when trigger has not been processed', async ({ page }) => {
    await mockPlayEndpoint(page, { error: 'Spin not ready yet. Please try again in a moment.' }, 404)
    await page.goto(`/spin/${CAMPAIGN_ID}`)

    await page.getByTestId('member-email-input').fill('eager@example.com')
    await page.getByTestId('member-claim-spin-btn').click()

    await expect(page.getByText('Spin not ready yet')).toBeVisible()
  })
})
