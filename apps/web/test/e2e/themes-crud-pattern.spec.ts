import { test, expect } from '@playwright/test'

/**
 * Themes list → view → edit navigation pattern — Issue #157 PR 4
 *
 * Exercises the three CRUD modes of the shared ThemeForm:
 *   - create: /admin/settings/themes/new  (no banner, Save button present)
 *   - view:   /admin/settings/themes/[id] (ViewOnlyBanner, fields disabled, no Save)
 *   - edit:   /admin/settings/themes/[id]/edit (no banner, Save button present)
 *
 * Also verifies the banner's "Edit Theme" action navigates from view → edit.
 *
 * All API calls are mocked — no running API server required.
 */

const API = 'http://localhost:4000'

const MOCK_THEME = {
  id: 'theme-1',
  name: 'Holiday Brand',
  isDefault: false,
  logoUrl: null,
  brandName: 'Acme Co',
  primaryColor: '#6366f1',
  secondaryColor: '#8b5cf6',
  backgroundColor: '#ffffff',
  textColor: '#1f2937',
  buttonColor: '#6366f1',
  buttonTextColor: '#ffffff',
  accentColor: '#f59e0b',
  fontFamily: 'Inter',
  headingSize: 'md',
  bodySize: 'md',
  cardStyle: 'shadow',
  borderRadius: 'md',
  maxWidth: 'md',
  // Issue #291 — thankYouMessage / thankYouRedirectUrl / showIncentivePoints
  // moved to Survey columns; no longer part of the BrandTheme fixture.
}

test.describe('Themes CRUD pattern — list → view → edit', () => {
  async function mockThemeGet(page: import('@playwright/test').Page) {
    await page.route(`${API}/v1/themes/${MOCK_THEME.id}`, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ json: MOCK_THEME })
      } else {
        await route.fulfill({ json: MOCK_THEME })
      }
    })
  }

  test('view mode: banner visible, theme-name input disabled, no Save button', async ({ page }) => {
    await mockThemeGet(page)
    await page.goto(`/admin/settings/themes/${MOCK_THEME.id}`)

    // ViewOnlyBanner copy (PR 1 widening uses entityLabel.toLowerCase())
    await expect(page.getByText(/read.only mode/i)).toBeVisible()
    await expect(page.getByText(/Click Edit to make changes/i)).toBeVisible()

    // Theme Name input should be disabled
    const nameInput = page.getByLabel(/Theme Name/i)
    await expect(nameInput).toBeDisabled()
    await expect(nameInput).toHaveValue(MOCK_THEME.name)

    // Save button should NOT be present in view mode
    await expect(page.getByRole('button', { name: /Save Changes|Save Theme/i })).toHaveCount(0)
    // Delete button should NOT be present either
    await expect(page.getByRole('button', { name: /Delete Theme/i })).toHaveCount(0)
  })

  test('view mode: banner "Edit Theme" button navigates to /edit', async ({ page }) => {
    await mockThemeGet(page)
    await page.goto(`/admin/settings/themes/${MOCK_THEME.id}`)

    await page.getByRole('button', { name: /Edit Theme/i }).click()
    await expect(page).toHaveURL(new RegExp(`/admin/settings/themes/${MOCK_THEME.id}/edit$`))
  })

  test('edit mode: theme-name input enabled, Save Changes button present', async ({ page }) => {
    await mockThemeGet(page)
    await page.goto(`/admin/settings/themes/${MOCK_THEME.id}/edit`)

    const nameInput = page.getByLabel(/Theme Name/i)
    await expect(nameInput).toBeEnabled()
    await expect(nameInput).toHaveValue(MOCK_THEME.name)

    await expect(page.getByRole('button', { name: /Save Changes/i })).toBeVisible()
    // No view-only banner on edit route
    await expect(page.getByText(/read.only mode/i)).toHaveCount(0)
  })

  test('create mode: empty form, Save Theme button present, no banner', async ({ page }) => {
    await page.goto('/admin/settings/themes/new')

    const nameInput = page.getByLabel(/Theme Name/i)
    await expect(nameInput).toBeEnabled()
    await expect(nameInput).toHaveValue('')

    await expect(page.getByRole('button', { name: /Save Theme/i })).toBeVisible()
    await expect(page.getByText(/read.only mode/i)).toHaveCount(0)
  })
})
