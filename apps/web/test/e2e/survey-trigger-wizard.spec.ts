import { test, expect } from '@playwright/test'

/**
 * Survey Trigger Wizard E2E Tests — Issue #79
 *
 * All API calls are mocked via page.route() — no running API server required.
 *
 * Covers:
 *   - Step 1 (trigger wizard) renders before survey content (R31)
 *   - Selecting Loyalty Moment shows sub-trigger pills from API (R37)
 *   - Selecting a sub-trigger shows recommendation box (R32)
 *   - Reach estimate badge renders (R33)
 *   - Override picker opens inline, rationale stays visible (R34)
 *   - Continue advances to Step 2 (existing content form)
 *   - Survey created with trigger fields → redirects to survey detail
 */

const API = 'http://localhost:4000'

const MOCK_PROGRAMS = [{ id: 'prog-1', name: 'Spring Rewards 2026' }]
const MOCK_TRIGGER_OPTIONS = {
  loyaltyMoments: [
    { key: 'tier_upgrade', label: 'Tier Upgrade', icon: '🏆' },
    { key: 'first_redemption', label: 'First Redemption', icon: '🎁' },
    { key: 'enrollment', label: 'Enrollment', icon: '✅' },
  ],
  hasEarnRules: true,
}
const MOCK_REACH_ESTIMATE = {
  estimatedCount: 47,
  channels: { email: 47, inApp: 38, sms: 12 },
  windowDays: 30,
}
const MOCK_SURVEY_CREATED = { id: 'survey-abc-123' }

test.describe('Survey Trigger Wizard — /admin/surveys/new', () => {
  test.beforeEach(async ({ page }) => {
    // Mock programs list
    await page.route(`${API}/v1/programs*`, async (route) => {
      await route.fulfill({ json: { data: MOCK_PROGRAMS, total: 1 } })
    })
    // Mock trigger options
    await page.route(`${API}/v1/programs/prog-1/trigger-options`, async (route) => {
      await route.fulfill({ json: MOCK_TRIGGER_OPTIONS })
    })
    // Mock reach estimate
    await page.route(`${API}/v1/analytics/reach-estimate*`, async (route) => {
      await route.fulfill({ json: MOCK_REACH_ESTIMATE })
    })
    // Mock survey creation
    await page.route(`${API}/v1/surveys`, async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 201, json: MOCK_SURVEY_CREATED })
      } else {
        await route.fulfill({ json: { data: [], total: 0 } })
      }
    })
  })

  test('Step 1 renders before survey content — no question editor visible', async ({ page }) => {
    await page.goto('/admin/surveys/new')

    // Trigger step should be visible
    await expect(page.getByTestId('trigger-step')).toBeVisible()
    // Content step should NOT be visible yet
    await expect(page.getByTestId('survey-content-step')).not.toBeVisible()
  })

  test('Three trigger category cards are displayed', async ({ page }) => {
    await page.goto('/admin/surveys/new')

    await expect(page.getByTestId('trigger-category-loyalty')).toBeVisible()
    await expect(page.getByTestId('trigger-category-cx_risk')).toBeVisible()
    await expect(page.getByTestId('trigger-category-scheduled')).toBeVisible()
  })

  test('Selecting Loyalty Moment shows sub-trigger pills from API', async ({ page }) => {
    await page.goto('/admin/surveys/new')

    await page.getByTestId('trigger-category-loyalty').click()

    // Pills loaded from mock trigger-options
    await expect(page.getByTestId('sub-trigger-tier_upgrade')).toBeVisible()
    await expect(page.getByTestId('sub-trigger-first_redemption')).toBeVisible()
    await expect(page.getByTestId('sub-trigger-enrollment')).toBeVisible()
  })

  test('Selecting Tier Upgrade shows CSAT recommendation with rationale', async ({ page }) => {
    await page.goto('/admin/surveys/new')

    await page.getByTestId('trigger-category-loyalty').click()
    await page.getByTestId('sub-trigger-tier_upgrade').click()

    // Recommendation box visible with CSAT
    await expect(page.getByTestId('recommendation-box')).toBeVisible()
    await expect(page.getByTestId('recommendation-type')).toContainText('CSAT')
    await expect(page.getByTestId('recommendation-rationale')).toBeVisible()
  })

  test('Reach estimate badge appears after sub-trigger selection', async ({ page }) => {
    await page.goto('/admin/surveys/new')

    await page.getByTestId('trigger-category-loyalty').click()
    await page.getByTestId('sub-trigger-tier_upgrade').click()

    await expect(page.getByTestId('reach-badge')).toBeVisible()
    await expect(page.getByTestId('reach-badge')).toContainText('47')
  })

  test('Override picker opens inline and rationale remains visible', async ({ page }) => {
    await page.goto('/admin/surveys/new')

    await page.getByTestId('trigger-category-loyalty').click()
    await page.getByTestId('sub-trigger-tier_upgrade').click()

    // Click override link
    await page.getByTestId('override-link').click()

    // Override picker visible inline
    await expect(page.getByTestId('override-picker')).toBeVisible()
    // Rationale still visible as note
    await expect(page.getByTestId('override-rationale-note')).toBeVisible()
  })

  test('Continue advances to Step 2 — survey content form visible', async ({ page }) => {
    await page.goto('/admin/surveys/new')

    // Select loyalty > tier_upgrade
    await page.getByTestId('trigger-category-loyalty').click()
    await page.getByTestId('sub-trigger-tier_upgrade').click()

    await page.getByTestId('trigger-continue-btn').click()

    // Step 2 should now be visible
    await expect(page.getByTestId('survey-content-step')).toBeVisible()
    await expect(page.getByTestId('survey-name-input')).toBeVisible()
    // Step 1 should be hidden
    await expect(page.getByTestId('trigger-step')).not.toBeVisible()
  })

  test('Clicking Continue without category shows validation error', async ({ page }) => {
    await page.goto('/admin/surveys/new')

    await page.getByTestId('trigger-continue-btn').click()

    await expect(page.getByTestId('trigger-validation-error')).toBeVisible()
    await expect(page.getByTestId('survey-content-step')).not.toBeVisible()
  })

  test('Happy path: complete wizard → submit → redirect to survey detail', async ({ page }) => {
    await page.goto('/admin/surveys/new')

    // Step 1: select trigger
    await page.getByTestId('trigger-category-loyalty').click()
    await page.getByTestId('sub-trigger-tier_upgrade').click()
    await page.getByTestId('trigger-continue-btn').click()

    // Step 2: fill name and select program
    await page.getByTestId('survey-name-input').fill('Tier Upgrade CSAT Survey')
    await page.getByTestId('survey-program-select').selectOption('prog-1')
    await page.getByTestId('survey-submit-btn').click()

    // Should redirect to survey detail
    await expect(page).toHaveURL(/\/admin\/surveys\/survey-abc-123/)
  })

  test('Reach estimate unavailable fallback renders gracefully', async ({ page }) => {
    // Override reach estimate route to return unavailable
    await page.route(`${API}/v1/analytics/reach-estimate*`, async (route) => {
      await route.fulfill({
        json: { estimatedCount: null, reason: 'insufficient_history', channels: null, windowDays: 30 },
      })
    })

    await page.goto('/admin/surveys/new')
    await page.getByTestId('trigger-category-loyalty').click()
    await page.getByTestId('sub-trigger-tier_upgrade').click()

    await expect(page.getByTestId('reach-badge')).toBeVisible()
    await expect(page.getByTestId('reach-badge')).toContainText('unavailable')
  })
})
