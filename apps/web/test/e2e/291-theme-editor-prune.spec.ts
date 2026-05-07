import { test, expect } from '@playwright/test'

/**
 * Issue #291 — Theme editor field prune
 *
 * The brand-level theme editor's existing layout is unchanged. #291 only
 * drops six input rows from the form:
 *   - "Logo URL" (Brand section)
 *   - "Brand Name" (Brand section)
 *   - "Message" (Thank You section — entire section gone)
 *   - "Redirect URL" (Thank You section — entire section gone)
 *   - "Show incentive points" checkbox (Thank You section — entire section gone)
 *   - "Set as default theme" form-level checkbox (replaced by row-level button)
 *
 * The "Set as Default" button (edit mode) stays — its handler now writes
 * Brand.defaultThemeId via the existing POST /v1/themes/:id/default endpoint.
 */

const API = 'http://localhost:4000'

const MOCK_THEME = {
  id: 'theme-1',
  name: 'Corporate Blue',
  isDefault: false,
  primaryColor: '#1a56db',
  secondaryColor: '#3b82f6',
  backgroundColor: '#ffffff',
  textColor: '#111827',
  buttonColor: '#1a56db',
  buttonTextColor: '#ffffff',
  accentColor: '#1a56db',
  fontFamily: 'Inter',
  headingSize: 'md',
  bodySize: 'md',
  cardStyle: 'shadow',
  borderRadius: 'md',
  maxWidth: 'md',
}

const MOCK_THEMES_LIST = { themes: [MOCK_THEME], defaultThemeId: null }

async function mockApi(page: import('@playwright/test').Page) {
  await page.route(`${API}/v1/themes`, async (route) => {
    await route.fulfill({ json: MOCK_THEMES_LIST })
  })
  await page.route(`${API}/v1/themes/${MOCK_THEME.id}`, async (route) => {
    await route.fulfill({ json: MOCK_THEME })
  })
}

test.describe('Theme editor — Issue #291 field prune', () => {
  test('CREATE mode: dropped fields absent, remaining sections intact', async ({ page }) => {
    await mockApi(page)
    await page.goto('/admin/settings/themes/new')

    // Theme Name field stays (heading + input).
    await expect(page.getByText('Theme Name', { exact: false })).toBeVisible()

    // Brand section header stays (Theme Name lives there).
    await expect(page.getByRole('heading', { name: /Brand/i })).toBeVisible()

    // Logo URL row dropped.
    await expect(page.getByText('Logo URL', { exact: false })).toHaveCount(0)
    // Brand Name (the input) dropped — distinct from the Brand section header.
    await expect(page.getByPlaceholder('Your Company')).toHaveCount(0)

    // Thank-you section dropped entirely (no header, no inputs).
    await expect(page.getByRole('heading', { name: /Thank You/i })).toHaveCount(0)
    await expect(page.getByText('Show incentive points', { exact: false })).toHaveCount(0)

    // Form-level "Set as default theme" checkbox dropped.
    await expect(page.getByText('Set as default theme', { exact: false })).toHaveCount(0)

    // Sections that retain inputs are still present.
    await expect(page.getByRole('heading', { name: /Colors/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Typography/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Layout/i })).toBeVisible()
  })

  // EDIT mode is structurally identical to CREATE for the prune surface
  // (same ThemeForm component, same dropped rows). Verifying via CREATE
  // is sufficient. The view + edit routes additionally exercise an
  // unauthenticated `getToken()` call that hangs under Playwright's
  // current setup (a pre-existing issue affecting `themes-crud-pattern.spec.ts`
  // on main as well — see test-results from origin/main run); fixing
  // that auth-bypass plumbing is out of scope for #291.
  //
  // The "Set as Default" button's behavior is validated end-to-end by the
  // integration test `themes-291-migration.test.ts` and the rewritten
  // `themes-templates.test.ts` set-default test.
})
