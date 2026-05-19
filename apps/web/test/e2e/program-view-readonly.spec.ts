import { test, expect } from '@playwright/test'

/**
 * Program Read-Only View Navigation — Issue #122
 *
 * Reproduces: read-only program view is blocked by Start Date validation
 * on Step 2, making later steps unreachable without switching to Edit mode.
 *
 * All API calls are mocked — no running API server required.
 */

const API = 'http://localhost:4000'

const MOCK_PROGRAM_NO_START_DATE = {
  id: 'prog-view-1',
  name: 'Diamond Loyalty Club',
  description: 'Our flagship loyalty program',
  type: 'POINTS',
  status: 'ACTIVE',
  startDate: null,
  endDate: null,
  pointCurrencyName: 'Stars',
  budgetUsdCents: null,
}

const MOCK_PROGRAM_WITH_START_DATE = {
  ...MOCK_PROGRAM_NO_START_DATE,
  startDate: '2025-01-01T00:00:00.000Z',
}

test.describe('Program read-only view — step navigation', () => {
  async function setupMocks(page: import('@playwright/test').Page, program: typeof MOCK_PROGRAM_NO_START_DATE) {
    await page.route(`${API}/v1/programs/prog-view-1`, async (route) => {
      await route.fulfill({ json: program })
    })
  }

  test('can navigate from Step 2 to Step 3 in read-only mode when startDate is null', async ({ page }) => {
    await setupMocks(page, MOCK_PROGRAM_NO_START_DATE)
    await page.goto('/admin/programs/prog-view-1')

    // Should show view-only banner
    await expect(page.getByText(/You are viewing this program/i)).toBeVisible()

    // Step 1 — click Next to reach Step 2
    await page.getByRole('button', { name: /Next: Basic Info/i }).click()

    // Should be on Step 2 — Basic Information
    await expect(page.getByRole('heading', { name: 'Basic Information' })).toBeVisible()

    // Start Date field should be disabled (read-only mode)
    const startDateInput = page.locator('input[type="date"]').first()
    await expect(startDateInput).toBeDisabled()

    // Should NOT show the "Start date is required" validation error without clicking Next
    await expect(page.getByText('Start date is required.')).not.toBeVisible()

    // Click "Next: Earning Rules" — this was previously blocked by validation
    await page.getByRole('button', { name: /Next: Earning Rules/i }).click()

    // Should navigate to Step 3 — validation error must NOT appear
    await expect(page.getByText('Start date is required.')).not.toBeVisible()
    await expect(page.getByText(/Rule 1/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Next: Tiers/i })).toBeVisible()
  })

  test('can navigate from Step 2 to Step 3 in read-only mode when startDate is set', async ({ page }) => {
    await setupMocks(page, MOCK_PROGRAM_WITH_START_DATE)
    await page.goto('/admin/programs/prog-view-1')

    await expect(page.getByText(/You are viewing this program/i)).toBeVisible()

    await page.getByRole('button', { name: /Next: Basic Info/i }).click()
    await expect(page.getByRole('heading', { name: 'Basic Information' })).toBeVisible()

    await page.getByRole('button', { name: /Next: Earning Rules/i }).click()
    await expect(page.getByText(/Rule 1/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Next: Tiers/i })).toBeVisible()
  })

  test('stepper allows clicking any step in read-only mode', async ({ page }) => {
    await setupMocks(page, MOCK_PROGRAM_WITH_START_DATE)
    await page.goto('/admin/programs/prog-view-1')

    await expect(page.getByText(/You are viewing this program/i)).toBeVisible()

    // Advance to Step 2 via Next button
    await page.getByRole('button', { name: /Next: Basic Info/i }).click()
    await expect(page.getByRole('heading', { name: 'Basic Information' })).toBeVisible()

    // In view-only mode, clicking forward stepper steps should work.
    await page.getByText('Earning Rules', { exact: true }).click()
    await expect(page.getByText(/Rule 1/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Next: Tiers/i })).toBeVisible()
  })
})
