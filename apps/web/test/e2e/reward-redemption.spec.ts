import { test, expect, type Page, type Route } from '@playwright/test'

/**
 * Reward Redemption E2E Tests — Closes #227 (Playwright layer)
 *
 * Tests the /rewards page redemption flow against mocked APIs.
 * The backend transaction correctness (balance decrement + LoyaltyEvent burn
 * record atomicity) is verified separately in:
 *   apps/api/test/integration/rewards-redemptions.test.ts
 *
 * NEXT_PUBLIC_PLAYWRIGHT_TEST=true (playwright.config.ts) bypasses the
 * Clerk user guard so the page proceeds with mocked API responses.
 */

const API = 'http://localhost:4000'

const REWARD_COFFEE = { id: 'rwd-coffee', name: 'Free Coffee', description: 'One free drink', pointsCost: 500, stock: 10 }
const REWARD_GIFT_CARD = { id: 'rwd-gift', name: '$10 Gift Card', description: 'Store credit', pointsCost: 1000, stock: null }
const REWARD_PREMIUM = { id: 'rwd-premium', name: 'Premium Box', pointsCost: 5000, stock: null }

const BALANCE_1250 = { pointsBalance: 1250, balance: 1250 }
const BALANCE_0 = { pointsBalance: 0, balance: 0 }

async function mockRewardsPage(
  page: Page,
  opts: { rewards?: object[]; balance?: object } = {},
) {
  const rewards = opts.rewards ?? [REWARD_COFFEE, REWARD_GIFT_CARD, REWARD_PREMIUM]
  const balance = opts.balance ?? BALANCE_1250

  await page.route(`${API}/v1/rewards`, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ rewards }),
    })
  )
  await page.route(`${API}/v1/members/me/balance`, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(balance),
    })
  )
}

function mockRedemption(page: Page, status: number, body: object) {
  return page.route(`${API}/v1/redemptions`, (route: Route) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  )
}

// ---------------------------------------------------------------------------
// Catalog rendering
// ---------------------------------------------------------------------------

test.describe('Rewards catalog', () => {
  test('shows affordable rewards with Redeem buttons', async ({ page }) => {
    await mockRewardsPage(page)
    await page.goto('/rewards')

    await expect(page.getByTestId('rewards-grid')).toBeVisible()
    await expect(page.getByTestId(`reward-redeem-btn-${REWARD_COFFEE.id}`)).toBeVisible()
    await expect(page.getByTestId(`reward-redeem-btn-${REWARD_GIFT_CARD.id}`)).toBeVisible()
  })

  test('shows unaffordable reward with points-needed label, no Redeem button', async ({ page }) => {
    await mockRewardsPage(page)
    await page.goto('/rewards')

    // REWARD_PREMIUM costs 5000, balance is 1250 → needs 3750 more
    await expect(page.getByText('3,750 more pts needed')).toBeVisible()
    await expect(page.getByTestId(`reward-redeem-btn-${REWARD_PREMIUM.id}`)).not.toBeVisible()
  })

  test('displays current balance in header', async ({ page }) => {
    await mockRewardsPage(page)
    await page.goto('/rewards')

    await expect(page.getByText('1,250 pts available')).toBeVisible()
  })

  test('shows empty state when no rewards exist', async ({ page }) => {
    await mockRewardsPage(page, { rewards: [] })
    await page.goto('/rewards')

    await expect(page.getByText('No rewards available yet.')).toBeVisible()
    await expect(page.getByTestId('rewards-grid')).not.toBeVisible()
  })

  test('shows all rewards as unaffordable when balance is 0', async ({ page }) => {
    await mockRewardsPage(page, { balance: BALANCE_0 })
    await page.goto('/rewards')

    await expect(page.getByText('0 pts available')).toBeVisible()
    await expect(page.getByTestId(`reward-redeem-btn-${REWARD_COFFEE.id}`)).not.toBeVisible()
    await expect(page.getByText('500 more pts needed')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Confirmation dialog
// ---------------------------------------------------------------------------

test.describe('Redemption confirmation dialog', () => {
  test('clicking Redeem opens confirmation dialog with reward name and cost', async ({ page }) => {
    await mockRewardsPage(page)
    await page.goto('/rewards')

    await page.getByTestId(`reward-redeem-btn-${REWARD_COFFEE.id}`).click()

    await expect(page.getByText('Confirm Redemption')).toBeVisible()
    await expect(page.getByText(/Redeem Free Coffee for 500 points\?/i)).toBeVisible()
    await expect(page.getByTestId('confirm-redeem-btn')).toBeVisible()
    await expect(page.getByTestId('cancel-redeem-btn')).toBeVisible()
  })

  test('Cancel button dismisses dialog without calling the API', async ({ page }) => {
    await mockRewardsPage(page)
    let redemptionCalled = false
    await page.route(`${API}/v1/redemptions`, () => { redemptionCalled = true })
    await page.goto('/rewards')

    await page.getByTestId(`reward-redeem-btn-${REWARD_COFFEE.id}`).click()
    await page.getByTestId('cancel-redeem-btn').click()

    await expect(page.getByText('Confirm Redemption')).not.toBeVisible()
    expect(redemptionCalled).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Successful redemption
// ---------------------------------------------------------------------------

test.describe('Successful redemption', () => {
  test('shows Reward Redeemed confirmation after successful POST /v1/redemptions', async ({ page }) => {
    await mockRewardsPage(page)
    await mockRedemption(page, 201, {
      id: 'rdm-1', memberId: 'm-1', rewardId: REWARD_COFFEE.id, pointsSpent: 500, status: 'PENDING',
    })
    await page.goto('/rewards')

    await page.getByTestId(`reward-redeem-btn-${REWARD_COFFEE.id}`).click()
    await page.getByTestId('confirm-redeem-btn').click()

    await expect(page.getByText('Reward Redeemed!')).toBeVisible()
    await expect(page.getByText(/Digital delivery/i)).toBeVisible()
    await expect(page.getByText('500 points deducted')).toBeVisible()
  })

  test('balance decrements in the UI after redemption', async ({ page }) => {
    await mockRewardsPage(page)
    await mockRedemption(page, 201, {
      id: 'rdm-1', memberId: 'm-1', rewardId: REWARD_COFFEE.id, pointsSpent: 500, status: 'PENDING',
    })
    await page.goto('/rewards')

    await page.getByTestId(`reward-redeem-btn-${REWARD_COFFEE.id}`).click()
    await page.getByTestId('confirm-redeem-btn').click()

    // After redemption UI updates balance: 1250 - 500 = 750
    await expect(page.getByText('Reward Redeemed!')).toBeVisible()
    await expect(page.getByText(/500 points deducted .* New balance: 750 pts/i)).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Error states
// ---------------------------------------------------------------------------

test.describe('Redemption error states', () => {
  test('shows insufficient-points error banner on 422', async ({ page }) => {
    await mockRewardsPage(page)
    await mockRedemption(page, 422, { error: 'Insufficient points balance' })
    await page.goto('/rewards')

    await page.getByTestId(`reward-redeem-btn-${REWARD_COFFEE.id}`).click()
    await page.getByTestId('confirm-redeem-btn').click()

    await expect(page.getByText('Insufficient points balance')).toBeVisible()
    await expect(page.getByText('Reward Redeemed!')).not.toBeVisible()
  })

  test('shows out-of-stock error banner when reward is unavailable', async ({ page }) => {
    await mockRewardsPage(page)
    await mockRedemption(page, 422, { error: 'Reward is no longer available.' })
    await page.goto('/rewards')

    await page.getByTestId(`reward-redeem-btn-${REWARD_COFFEE.id}`).click()
    await page.getByTestId('confirm-redeem-btn').click()

    await expect(page.getByText('Reward is no longer available.')).toBeVisible()
  })

  test('Dismiss button clears the error banner', async ({ page }) => {
    await mockRewardsPage(page)
    await mockRedemption(page, 422, { error: 'Insufficient points balance' })
    await page.goto('/rewards')

    await page.getByTestId(`reward-redeem-btn-${REWARD_COFFEE.id}`).click()
    await page.getByTestId('confirm-redeem-btn').click()

    await expect(page.getByText('Insufficient points balance')).toBeVisible()
    await page.getByRole('button', { name: 'Dismiss' }).click()
    await expect(page.getByText('Insufficient points balance')).not.toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Responsive
// ---------------------------------------------------------------------------

test.describe('Responsive layout', () => {
  test('rewards catalog is usable at 375px mobile viewport', async ({ page }) => {
    await mockRewardsPage(page)
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/rewards')

    await expect(page.getByText('Rewards Catalog')).toBeVisible()
    await expect(page.getByText('1,250 pts available')).toBeVisible()
    await expect(page.getByTestId(`reward-redeem-btn-${REWARD_COFFEE.id}`)).toBeVisible()
  })
})
