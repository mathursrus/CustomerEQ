import { test, expect } from '@playwright/test'

const API_URL = process.env.DEMO_API_URL ?? 'http://localhost:4000'
const BRAND_ID = process.env.DEMO_BRAND_ID ?? 'cmn689ibu000089tqad1g234t'

const TEST_HEADERS = {
  'Content-Type': 'application/json',
  'X-Test-Brand-Id': BRAND_ID,
  'X-Test-User-Id': 'demo-admin',
}

test.describe('Demo storefront checkout flow', () => {
  test.beforeAll(async () => {
    // Verify the API is reachable — fail loudly if not
    const res = await fetch(`${API_URL}/healthz`).catch(() => null)
    if (!res?.ok) {
      throw new Error(
        `API at ${API_URL} is not reachable. Start the local stack:\n` +
        '  docker compose up -d && pnpm db:migrate && pnpm dev',
      )
    }

    // Verify the demo seed exists (at least one persona enrolled)
    const membersRes = await fetch(
      `${API_URL}/v1/members?q=alex.chen@starbrew.demo&pageSize=1`,
      { headers: TEST_HEADERS },
    ).catch(() => null)
    const body = await membersRes?.json().catch(() => null) as { data?: unknown[] } | null
    if (!body?.data?.length) {
      throw new Error(
        'Demo seed data not found. Run:\n  pnpm seed:demo',
      )
    }
  })

  test('select persona → add item to cart → checkout → purchase event recorded in DB', async ({ page }) => {
    // 1. Load catalog
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /StarBrew/i })).toBeVisible()

    // 2. Select persona (Alex Chen — happy Gold member)
    const picker = page.getByLabel('Select demo persona')
    await picker.selectOption({ value: 'alex.chen@starbrew.demo' })

    // Wait for loyalty bar to reflect the persona
    await expect(page.getByTestId('ceq-widget')).toContainText('pts', { timeout: 10_000 })

    // Capture points before purchase
    const beforeText = await page.getByTestId('ceq-widget').textContent()
    const beforePoints = parseInt((beforeText ?? '0').replace(/[^0-9]/g, ''), 10)

    // 3. Add an item to cart
    await page.getByTestId('add-to-cart-oat-latte').click()

    // Verify cart badge increments
    await expect(page.getByTestId('cart-count')).toHaveText('1')

    // 4. Navigate to cart
    await page.getByTestId('cart-link').click()
    await expect(page.getByTestId('cart-total')).toContainText('5.25')
    await expect(page.getByTestId('checkout-btn')).toBeEnabled()

    // 5. Checkout
    await page.getByTestId('checkout-btn').click()

    // 6. Confirm page — order ID and points earned visible
    await expect(page.getByTestId('order-id')).toContainText('CEQ-', { timeout: 10_000 })
    await expect(page.getByTestId('points-earned')).toContainText('500')

    // 7. Verify purchase event was recorded in the CustomerEQ API
    const orderId = await page.getByTestId('order-id').textContent()
    expect(orderId).toBeTruthy()

    const memberRes = await fetch(
      `${API_URL}/v1/members?q=alex.chen@starbrew.demo&pageSize=1`,
      { headers: TEST_HEADERS },
    )
    const memberBody = await memberRes.json() as { data: Array<{ id: string; pointsBalance: number }> }
    const member = memberBody.data[0]
    expect(member).toBeTruthy()

    // Points balance should have increased (worker may take a few seconds)
    // Poll for up to 15 seconds
    let afterPoints = member.pointsBalance
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 1_000))
      const pollRes = await fetch(
        `${API_URL}/v1/members?q=alex.chen@starbrew.demo&pageSize=1`,
        { headers: TEST_HEADERS },
      )
      const pollBody = await pollRes.json() as { data: Array<{ pointsBalance: number }> }
      afterPoints = pollBody.data[0]?.pointsBalance ?? afterPoints
      if (afterPoints > beforePoints) break
    }

    expect(afterPoints).toBeGreaterThan(beforePoints)

    // 8. Navigate to account page and verify points display
    await page.goto('/account')
    await expect(page.getByTestId('points-balance')).toContainText(afterPoints.toLocaleString())
  })
})
