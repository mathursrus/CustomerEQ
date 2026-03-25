import { test, expect } from '@playwright/test'

/**
 * CustomerEQ Critical Path E2E Tests
 *
 * Hero feature: CX event automatically triggers a loyalty campaign, awarding
 * points to a member. Tests are order-dependent (serial mode):
 *   1. Admin creates & activates a program
 *   2. Member enrolls in the program
 *   3. CX event triggers campaign → points awarded
 *   4. Member redeems a reward
 *   5. Analytics dashboard reflects updated metrics
 *
 * Selector strategy: data-testid attributes are the primary handle.
 * All ids referenced here must be present in the implementation.
 */

test.describe.configure({ mode: 'serial' })

test.describe('CustomerEQ Critical Path', () => {
  // ---------------------------------------------------------------------------
  // 1. Admin: create and activate a loyalty program
  // ---------------------------------------------------------------------------
  test('admin can create and activate a loyalty program', async ({ page }) => {
    await page.goto('/admin/programs/new')

    // ── Step 1: Basic details ──────────────────────────────────────────────
    await page.getByTestId('program-name-input').fill('E2E Test Program')
    await page.getByTestId('program-wizard-next').click()

    // ── Step 2: Point currency settings ───────────────────────────────────
    await page.getByTestId('point-currency-name-input').fill('Stars')
    await page.getByTestId('points-to-currency-ratio-input').fill('100')
    await page.getByTestId('program-wizard-next').click()

    // ── Step 3: Campaign defaults (accept defaults) ────────────────────────
    await page.getByTestId('program-wizard-next').click()

    // ── Step 4: Review & submit ────────────────────────────────────────────
    await expect(page.getByTestId('program-wizard-review-name')).toHaveText('E2E Test Program')
    await expect(page.getByTestId('program-wizard-review-currency')).toHaveText('Stars')
    await page.getByTestId('program-wizard-submit').click()

    // Verify redirect to program list and program appears as ACTIVE
    await page.waitForURL('/admin/programs')
    await expect(page.getByTestId('program-list-item').filter({ hasText: 'E2E Test Program' })).toBeVisible()
    await expect(
      page
        .getByTestId('program-list-item')
        .filter({ hasText: 'E2E Test Program' })
        .getByTestId('program-status-badge'),
    ).toHaveText('ACTIVE')
  })

  // ---------------------------------------------------------------------------
  // 2. Member: enroll in the loyalty program
  // ---------------------------------------------------------------------------
  test('member can enroll in the loyalty program', async ({ page }) => {
    await page.goto('/member/enroll')

    await page.getByTestId('enroll-first-name-input').fill('Jane')
    await page.getByTestId('enroll-last-name-input').fill('Doe')
    await page.getByTestId('enroll-email-input').fill('jane.doe+e2e@example.com')
    await page.getByTestId('enroll-consent-checkbox').check()
    await page.getByTestId('enroll-submit-btn').click()

    // Redirect to member dashboard after successful enrollment
    await page.waitForURL('/member/dashboard')

    // Balance must start at zero
    await expect(page.getByTestId('points-balance')).toHaveText('0')
  })

  // ---------------------------------------------------------------------------
  // 3. CX event triggers campaign and awards points
  // ---------------------------------------------------------------------------
  test('CX event triggers campaign and awards points to member', async ({ page, request }) => {
    // Resolve the member id that was created during enrollment.
    // The implementation must expose it on the dashboard as a data attribute so
    // tests can read it without hard-coding an id.
    await page.goto('/member/dashboard')
    const memberId = await page.getByTestId('member-id').getAttribute('data-member-id')
    expect(memberId).toBeTruthy()

    // Post a CX NPS event through the public API
    const response = await request.post('/v1/events', {
      data: {
        type: 'cx.nps_submitted',
        memberId,
        payload: { nps_score: 4 },
      },
    })
    expect(response.ok()).toBeTruthy()

    // Poll member dashboard until points balance updates (max 10 s)
    await page.goto('/member/dashboard')
    await expect(page.getByTestId('points-balance')).not.toHaveText('0', { timeout: 10_000 })

    // Confirm a positive integer balance
    const balanceText = await page.getByTestId('points-balance').textContent()
    expect(parseInt(balanceText ?? '0', 10)).toBeGreaterThan(0)

    // Campaign activity should appear in the history list
    await expect(
      page.getByTestId('activity-history-list').getByTestId('activity-history-item').first(),
    ).toBeVisible()
  })

  // ---------------------------------------------------------------------------
  // 4. Member: redeem a reward
  // ---------------------------------------------------------------------------
  test('member can redeem a reward', async ({ page }) => {
    await page.goto('/member/dashboard')
    const balanceBefore = parseInt(
      (await page.getByTestId('points-balance').textContent()) ?? '0',
      10,
    )
    expect(balanceBefore).toBeGreaterThan(0)

    await page.goto('/member/rewards')

    // Pick the first available reward and note its cost
    const firstReward = page.getByTestId('reward-card').first()
    await expect(firstReward).toBeVisible()
    const costText = await firstReward.getByTestId('reward-cost').textContent()
    const rewardCost = parseInt(costText ?? '0', 10)

    // Click redeem and confirm
    await firstReward.getByTestId('reward-redeem-btn').click()
    await expect(page.getByTestId('redeem-confirm-dialog')).toBeVisible()
    await page.getByTestId('redeem-confirm-btn').click()

    // Dialog should close and a success indicator appear
    await expect(page.getByTestId('redeem-confirm-dialog')).not.toBeVisible()
    await expect(page.getByTestId('redeem-success-toast')).toBeVisible()

    // Balance must have decreased by the reward cost
    await page.goto('/member/dashboard')
    const balanceAfter = parseInt(
      (await page.getByTestId('points-balance').textContent()) ?? '0',
      10,
    )
    expect(balanceAfter).toBe(balanceBefore - rewardCost)

    // Redemption must appear in the activity history
    await expect(
      page
        .getByTestId('activity-history-list')
        .getByTestId('activity-history-item')
        .filter({ hasText: 'Redemption' })
        .first(),
    ).toBeVisible()
  })

  // ---------------------------------------------------------------------------
  // 5. Admin analytics: verify metrics are updated
  // ---------------------------------------------------------------------------
  test('analytics dashboard shows updated metrics', async ({ page }) => {
    await page.goto('/admin/analytics')

    // At least one member should be enrolled
    const totalMembers = parseInt(
      (await page.getByTestId('analytics-total-members').textContent()) ?? '0',
      10,
    )
    expect(totalMembers).toBeGreaterThanOrEqual(1)

    // Points must have been issued
    const totalPointsIssued = parseInt(
      (await page.getByTestId('analytics-total-points-issued').textContent()) ?? '0',
      10,
    )
    expect(totalPointsIssued).toBeGreaterThan(0)

    // Campaign row must show at least one triggered event
    const campaignRow = page.getByTestId('analytics-campaign-row').first()
    await expect(campaignRow).toBeVisible()
    const triggeredCount = parseInt(
      (await campaignRow.getByTestId('analytics-campaign-events-triggered').textContent()) ?? '0',
      10,
    )
    expect(triggeredCount).toBeGreaterThan(0)

    // Date range filter: changing the range causes metrics to refresh
    const dateRangePicker = page.getByTestId('analytics-date-range-picker')
    await expect(dateRangePicker).toBeVisible()

    // Select "Last 7 days" preset
    await dateRangePicker.click()
    await page.getByTestId('date-range-option-last-7-days').click()

    // Metrics container must still be present (may differ in value but not vanish)
    await expect(page.getByTestId('analytics-total-members')).toBeVisible()
    await expect(page.getByTestId('analytics-total-points-issued')).toBeVisible()
  })
})
