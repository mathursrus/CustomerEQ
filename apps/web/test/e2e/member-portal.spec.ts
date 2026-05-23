import { test, expect, type Page, type Route } from '@playwright/test'

/**
 * Member Portal E2E Tests — Closes #228
 *
 * Covers /dashboard, /history, and /rewards pages.
 * API calls intercepted with page.route(); no live backend required.
 * NEXT_PUBLIC_PLAYWRIGHT_TEST=true (set in playwright.config.ts) bypasses
 * the Clerk user guard so pages proceed to fetch and render with mocked data.
 */

const API = 'http://localhost:4000'

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_BALANCE = { pointsBalance: 1250, balance: 1250 }

const MOCK_DASHBOARD = {
  pointsBalance: 1250,
  currencyEquivalent: 12.5,
  currencyName: 'Stars',
  tier: { id: 'tier-1', name: 'Gold', rank: 2, icon: '⭐' },
  tierProgress: { nextTierName: 'Platinum', minPoints: 2000, pointsToNext: 750, pct: 62 },
  affordableReward: null,
  onboarding: { hasFirstPurchase: true },
  recentActivity: [
    { id: 'act-1', date: '2026-04-28T10:00:00Z', event: 'Purchase', points: 100, balance: 1250 },
    { id: 'act-2', date: '2026-04-27T09:00:00Z', event: 'Sign-up Bonus', points: 50, balance: 1150 },
  ],
}

const MOCK_DASHBOARD_EMPTY = {
  ...MOCK_DASHBOARD,
  recentActivity: [],
  affordableReward: null,
  onboarding: { hasFirstPurchase: false },
}

const MOCK_HISTORY = {
  items: [
    { id: 'ev-1', date: '2026-04-28T10:00:00Z', event: 'Purchase', points: 100, balance: 1250 },
    { id: 'ev-2', date: '2026-04-27T09:00:00Z', event: 'Sign-up Bonus', points: 50, balance: 1150 },
    { id: 'ev-3', date: '2026-04-26T08:00:00Z', event: 'Redemption', points: -500, balance: 1100 },
  ],
  total: 3,
  page: 1,
  limit: 25,
  totalPages: 1,
}

const MOCK_REWARDS = {
  rewards: [
    { id: 'rwd-1', name: '$10 Gift Card', description: 'Redeem for store credit', pointsCost: 1000, stock: null },
    { id: 'rwd-2', name: 'Free Coffee', description: 'One free drink', pointsCost: 500, stock: 5 },
    { id: 'rwd-3', name: 'Premium Box', description: 'Luxury selection', pointsCost: 3000, stock: null },
  ],
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function mockMemberAPI(page: Page, opts: {
  dashboard?: object
  history?: object
  rewards?: object
  balance?: object
} = {}) {
  const dashboard = opts.dashboard ?? MOCK_DASHBOARD
  const history = opts.history ?? MOCK_HISTORY
  const rewards = opts.rewards ?? MOCK_REWARDS
  const balance = opts.balance ?? MOCK_BALANCE

  await page.route(`${API}/v1/members/me/dashboard`, (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(dashboard) })
  )
  await page.route(`${API}/v1/members/me/events*`, (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(history) })
  )
  await page.route(`${API}/v1/rewards`, (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rewards) })
  )
  await page.route(`${API}/v1/members/me/balance`, (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(balance) })
  )
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

test.describe('Member Portal — Dashboard (/dashboard)', () => {
  test('renders points balance and currency name', async ({ page }) => {
    await mockMemberAPI(page)
    await page.goto('/dashboard')

    await expect(page.getByTestId('points-balance')).toBeVisible()
    await expect(page.getByTestId('points-balance')).toContainText('1,250')
    await expect(page.getByText('Stars')).toBeVisible()
  })

  test('renders tier name and progress bar', async ({ page }) => {
    await mockMemberAPI(page)
    await page.goto('/dashboard')

    await expect(page.getByText('Gold')).toBeVisible()
    await expect(page.getByText('750 more points')).toBeVisible()
    await expect(page.getByText('Platinum')).toBeVisible()
  })

  test('renders recent activity table with earn and burn rows', async ({ page }) => {
    await mockMemberAPI(page)
    await page.goto('/dashboard')

    const table = page.getByTestId('activity-table')
    await expect(table).toBeVisible()
    await expect(table.getByText('Purchase')).toBeVisible()
    await expect(table.getByText('Sign-up Bonus')).toBeVisible()
    await expect(table.getByText('+100')).toBeVisible()
  })

  test('shows empty activity state when no recent events', async ({ page }) => {
    await mockMemberAPI(page, { dashboard: MOCK_DASHBOARD_EMPTY })
    await page.goto('/dashboard')

    await expect(page.getByText('No activity yet.')).toBeVisible()
  })

  test('shows getting-started checklist when first purchase not yet made', async ({ page }) => {
    await mockMemberAPI(page, { dashboard: MOCK_DASHBOARD_EMPTY })
    await page.goto('/dashboard')

    await expect(page.getByText('Getting Started')).toBeVisible()
    await expect(page.getByText('Make your first purchase')).toBeVisible()
  })

  test('header shows points balance from balance endpoint', async ({ page }) => {
    await mockMemberAPI(page)
    await page.goto('/dashboard')

    await expect(page.getByTestId('member-points-balance')).toBeVisible()
    await expect(page.getByTestId('member-points-balance')).toContainText('1,250')
  })

  test('nav links to rewards and history are visible', async ({ page }) => {
    await mockMemberAPI(page)
    await page.goto('/dashboard')

    await expect(page.getByRole('link', { name: 'Rewards', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'History', exact: true })).toBeVisible()
  })

  test('browse rewards button is shown when no affordable reward', async ({ page }) => {
    await mockMemberAPI(page)
    await page.goto('/dashboard')

    await expect(page.getByTestId('browse-rewards-btn')).toBeVisible()
  })

  test('is usable at 375px mobile viewport', async ({ page }) => {
    await mockMemberAPI(page)
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/dashboard')

    await expect(page.getByTestId('member-balance-card')).toBeVisible()
    await expect(page.getByTestId('activity-table')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

test.describe('Member Portal — History (/history)', () => {
  test('renders history table with earn and burn entries', async ({ page }) => {
    await mockMemberAPI(page)
    await page.goto('/history')

    const table = page.getByTestId('history-table')
    await expect(table).toBeVisible()
    await expect(table.getByText('Purchase')).toBeVisible()
    await expect(table.getByText('Sign-up Bonus')).toBeVisible()
    await expect(table.getByText('Redemption')).toBeVisible()
  })

  test('shows positive points in green and negative in red styling', async ({ page }) => {
    await mockMemberAPI(page)
    await page.goto('/history')

    await expect(page.getByText('+100')).toBeVisible()
    await expect(page.getByText('-500')).toBeVisible()
  })

  test('shows empty state when no history exists', async ({ page }) => {
    await mockMemberAPI(page, {
      history: { items: [], total: 0, page: 1, limit: 25, totalPages: 0 },
    })
    await page.goto('/history')

    await expect(page.getByText('No activity yet.')).toBeVisible()
  })

  test('does not show pagination when only one page of results', async ({ page }) => {
    await mockMemberAPI(page)
    await page.goto('/history')

    await expect(page.getByRole('button', { name: 'Previous' })).not.toBeVisible()
  })

  test('is usable at 375px mobile viewport', async ({ page }) => {
    await mockMemberAPI(page)
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/history')

    await expect(page.getByTestId('history-table')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Rewards
// ---------------------------------------------------------------------------

test.describe('Member Portal — Rewards (/rewards)', () => {
  test('renders affordable rewards grid with redeem buttons', async ({ page }) => {
    await mockMemberAPI(page)
    await page.goto('/rewards')

    // Balance is 1250 — rwd-1 (1000 pts) and rwd-2 (500 pts) are affordable
    await expect(page.getByTestId('rewards-grid')).toBeVisible()
    await expect(page.getByTestId('reward-redeem-btn-rwd-1')).toBeVisible()
    await expect(page.getByTestId('reward-redeem-btn-rwd-2')).toBeVisible()
  })

  test('shows unaffordable rewards with points-needed label', async ({ page }) => {
    await mockMemberAPI(page)
    await page.goto('/rewards')

    // rwd-3 costs 3000 pts, balance is 1250 — shows "1,750 more pts needed"
    await expect(page.getByText('1,750 more pts needed')).toBeVisible()
  })

  test('shows current balance in header', async ({ page }) => {
    await mockMemberAPI(page)
    await page.goto('/rewards')

    await expect(page.getByText('1,250 pts available')).toBeVisible()
  })

  test('clicking redeem opens confirmation dialog', async ({ page }) => {
    await mockMemberAPI(page)
    await page.goto('/rewards')

    await page.getByTestId('reward-redeem-btn-rwd-2').click()

    await expect(page.getByRole('heading', { name: 'Confirm Redemption' })).toBeVisible()
    await expect(page.getByText('Redeem Free Coffee for 500 points?')).toBeVisible()
    await expect(page.getByTestId('confirm-redeem-btn')).toBeVisible()
    await expect(page.getByTestId('cancel-redeem-btn')).toBeVisible()
  })

  test('cancel button dismisses the confirmation dialog', async ({ page }) => {
    await mockMemberAPI(page)
    await page.goto('/rewards')

    await page.getByTestId('reward-redeem-btn-rwd-2').click()
    await expect(page.getByText('Confirm Redemption')).toBeVisible()

    await page.getByTestId('cancel-redeem-btn').click()
    await expect(page.getByText('Confirm Redemption')).not.toBeVisible()
  })

  test('successful redemption shows reward-redeemed confirmation', async ({ page }) => {
    await mockMemberAPI(page)
    await page.route(`${API}/v1/redemptions`, (route: Route) =>
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'rdm-1', memberId: 'm-1', rewardId: 'rwd-2', pointsSpent: 500, status: 'PENDING' }),
      })
    )
    await page.goto('/rewards')

    await page.getByTestId('reward-redeem-btn-rwd-2').click()
    await page.getByTestId('confirm-redeem-btn').click()

    await expect(page.getByRole('heading', { name: 'Reward Redeemed!' })).toBeVisible()
    await expect(page.getByText('Digital delivery')).toBeVisible()
    await expect(page.getByText('500 points deducted')).toBeVisible()
  })

  test('insufficient points error banner shown on 422', async ({ page }) => {
    await mockMemberAPI(page)
    await page.route(`${API}/v1/redemptions`, (route: Route) =>
      route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Insufficient points balance' }),
      })
    )
    await page.goto('/rewards')

    await page.getByTestId('reward-redeem-btn-rwd-2').click()
    await page.getByTestId('confirm-redeem-btn').click()

    await expect(page.getByText('Insufficient points balance')).toBeVisible()
  })

  test('shows empty state when no rewards exist', async ({ page }) => {
    await mockMemberAPI(page, { rewards: { rewards: [] } })
    await page.goto('/rewards')

    await expect(page.getByText('No rewards available yet.')).toBeVisible()
  })

  test('is usable at 375px mobile viewport', async ({ page }) => {
    await mockMemberAPI(page)
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/rewards')

    await expect(page.getByText('Rewards Catalog')).toBeVisible()
    await expect(page.getByTestId('rewards-grid')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

test.describe('Member Portal — Navigation', () => {
  test('nav Rewards link navigates to /rewards', async ({ page }) => {
    await mockMemberAPI(page)
    await page.goto('/dashboard')

    await page.getByRole('link', { name: 'Rewards' }).first().click()
    await page.waitForURL('/rewards')
    await expect(page).toHaveURL('/rewards')
  })

  test('nav History link navigates to /history', async ({ page }) => {
    await mockMemberAPI(page)
    await page.goto('/dashboard')

    await page.getByRole('link', { name: 'History' }).first().click()
    await page.waitForURL('/history')
    await expect(page).toHaveURL('/history')
  })

  test('View all link on dashboard navigates to /history', async ({ page }) => {
    await mockMemberAPI(page)
    await page.goto('/dashboard')

    await page.getByRole('link', { name: 'View all →' }).click()
    await page.waitForURL('/history')
    await expect(page).toHaveURL('/history')
  })
})
