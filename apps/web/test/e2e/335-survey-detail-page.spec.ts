import { test, expect, type Page, type Route } from '@playwright/test'

// Issue #241 Slice 4a — admin /admin/surveys/[id] detail page E2E.
//
// Validates the 3 collapsible sections per spec §7 + R26 / R27 / R28 / R32:
//   - Distribution    — default expanded when responsesCount === 0
//   - Response        — default expanded when responsesCount > 0 (inverse)
//   - Configuration   — default expanded when responsesCount === 0
//
// Auth: PLAYWRIGHT_TEST=true (playwright.config.ts) bypasses Clerk
// middleware. APIs are mocked at the page level — same pattern as
// admin-organization-settings.spec.ts.

const SURVEY_ID = 'srv_test_4a_001'
const THEME_ID = 'thm_test_4a_001'
const PROGRAM_ID = 'prg_test_4a_001'

const MOCK_SURVEY_BASE = {
  id: SURVEY_ID,
  name: 'NPS check-in — Q2',
  title: 'Quick NPS pulse',
  description: 'Loyalty NPS — 0-to-10 + verbatim follow-up',
  type: 'NPS',
  status: 'DRAFT',
  programId: PROGRAM_ID,
  themeId: THEME_ID,
  consentTextOverride: null,
  responsePolicy: 'MULTIPLE',
  thankYouMessage: 'Thanks for the feedback!',
  thankYouRedirectUrl: null,
  questions: [
    {
      id: 'q_rating',
      type: 'rating',
      text: 'How likely are you to recommend us?',
      required: true,
      config: { min: 0, max: 10 },
    },
    {
      id: 'q_text',
      type: 'text',
      text: 'Tell us why.',
      required: false,
      config: { multiline: true, placeholder: 'Your thoughts…' },
    },
  ],
  settings: {
    chromeMatrix: {
      standalone: { logo: true, name: true, title: true },
      embedded: { logo: false, name: false, title: true },
    },
  },
}

const MOCK_THEME = {
  id: THEME_ID,
  name: 'Indigo · default',
  primaryColor: '#6366f1',
  secondaryColor: '#818cf8',
  backgroundColor: '#ffffff',
  textColor: '#111827',
  buttonColor: '#6366f1',
  buttonTextColor: '#ffffff',
  accentColor: '#6366f1',
  fontFamily: 'system-ui',
  headingSize: 'md',
  bodySize: 'md',
  maxWidth: 'md',
  borderRadius: 'md',
  cardStyle: 'shadow',
  backgroundImageUrl: null,
}

const MOCK_BRAND = {
  id: 'brd_test_4a_001',
  name: 'Acme Coffee Roasters',
  logoUrl: null,
  consentTextDefault: null,
  termsUrl: null,
  privacyPolicyUrl: null,
  memberIdentifierKind: 'email',
}

const MOCK_PROGRAM = { id: PROGRAM_ID, name: 'Acme Coffee Loyalty' }

async function mockClerk(page: Page) {
  await page.route('**/clerk.**', (route: Route) => {
    if (route.request().resourceType() === 'document') return route.continue()
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })
  await page.route('**/.well-known/**', (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  )
}

async function mockApi(
  page: Page,
  opts: { responsesCount?: number; surveyOverride?: Partial<typeof MOCK_SURVEY_BASE> } = {},
) {
  const responsesCount = opts.responsesCount ?? 0
  const survey = { ...MOCK_SURVEY_BASE, ...opts.surveyOverride, _count: { responses: responsesCount } }

  // Register a catch-all FIRST (LIFO route priority).
  await page.route('**/v1/**', (route: Route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })

  await page.route(`**/v1/surveys/${SURVEY_ID}`, (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ survey }) }),
  )
  await page.route(`**/v1/brand-themes/${THEME_ID}`, (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ theme: MOCK_THEME }) }),
  )
  await page.route('**/v1/me', (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ brand: MOCK_BRAND }) }),
  )
  await page.route('**/v1/programs', (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [MOCK_PROGRAM] }) }),
  )
}

test.describe('Admin survey detail page — /admin/surveys/[id]', () => {
  test('renders the 4 sections in spec order with breadcrumb + status pill (responsesCount=0)', async ({ page }) => {
    await mockClerk(page)
    await mockApi(page, { responsesCount: 0 })

    await page.goto(`/admin/surveys/${SURVEY_ID}`)

    // Breadcrumb back-link
    await expect(page.getByLabel('Breadcrumb').getByRole('link', { name: 'Surveys' })).toBeVisible()
    // h1 with survey name
    await expect(page.getByRole('heading', { level: 1, name: MOCK_SURVEY_BASE.name })).toBeVisible()
    // Status badge
    await expect(page.getByText('Draft', { exact: true }).first()).toBeVisible()

    // All four section headings in spec order. Loop Monitor is a first-class
    // section between Distribution and Response, keeping pipeline visibility
    // above the default-collapsed Response section.
    // All four section headings in spec order. Loop Monitor was promoted to its
    // own first-class section between Distribution and Response in Slice 4a
    // Round-2 (R32b) per LoopMonitorSection.tsx:5-8 — keeps hero pipeline (#80)
    // visibility above the default-collapsed Response section.
    const sectionButtons = page.getByRole('button').filter({ has: page.locator('h2') })
    await expect(sectionButtons.nth(0)).toContainText('Distribution')
    await expect(sectionButtons.nth(1)).toContainText('Loop Monitor')
    await expect(sectionButtons.nth(2)).toContainText('Response')
    await expect(sectionButtons.nth(3)).toContainText('Configuration summary')
  })

  test('responsesCount=0: Distribution + Configuration expanded, Response collapsed', async ({ page }) => {
    await mockClerk(page)
    await mockApi(page, { responsesCount: 0 })

    await page.goto(`/admin/surveys/${SURVEY_ID}`)
    await expect(page.getByRole('heading', { level: 1, name: MOCK_SURVEY_BASE.name })).toBeVisible({ timeout: 10000 })

    // Distribution body visible (Share link tile)
    await expect(page.getByRole('heading', { level: 3, name: 'Share link' })).toBeVisible()
    // Configuration body visible (the embedded PreviewSurvey renders the survey title)
    await expect(page.getByRole('heading', { name: 'Quick NPS pulse' })).toBeVisible()
    // Response body hidden (placeholder copy not rendered)
    await expect(page.getByText(/Response analytics/i)).toHaveCount(0)
  })

  test('responsesCount>0: Distribution + Configuration collapsed, Response expanded', async ({ page }) => {
    await mockClerk(page)
    await mockApi(page, { responsesCount: 12 })

    await page.goto(`/admin/surveys/${SURVEY_ID}`)

    // Wait for the page to finish its 4-fetch load sequence — under parallel-worker
    // load the dev server takes longer to respond than the default 5s assertion timeout.
    await expect(page.getByRole('heading', { level: 1, name: MOCK_SURVEY_BASE.name })).toBeVisible({ timeout: 20000 })

    // Response body visible with the real v1 empty/auth state.
    await expect(page.getByText('Sign in to load responses')).toBeVisible({ timeout: 10000 })
    // Distribution body hidden (no Share link tile rendered)
    await expect(page.getByRole('heading', { level: 3, name: 'Share link' })).toHaveCount(0)
    // Configuration body hidden (the preview's survey-title heading is not rendered)
    await expect(page.getByRole('heading', { name: 'Quick NPS pulse' })).toHaveCount(0)
  })

  test('chevron click toggles each section independently', async ({ page }) => {
    await mockClerk(page)
    await mockApi(page, { responsesCount: 0 })

    await page.goto(`/admin/surveys/${SURVEY_ID}`)
    await expect(page.getByRole('heading', { level: 1, name: MOCK_SURVEY_BASE.name })).toBeVisible({ timeout: 10000 })

    // Distribution starts expanded — click toggles to collapsed
    const distributionToggle = page.getByRole('button', { name: /Distribution/i })
    await expect(page.getByRole('heading', { level: 3, name: 'Share link' })).toBeVisible()
    await distributionToggle.click()
    await expect(page.getByRole('heading', { level: 3, name: 'Share link' })).toHaveCount(0)
    // Click again — back to expanded
    await distributionToggle.click()
    await expect(page.getByRole('heading', { level: 3, name: 'Share link' })).toBeVisible()
  })

  test('share link tile copies the canonical URL', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await mockClerk(page)
    await mockApi(page, { responsesCount: 0 })

    await page.goto(`/admin/surveys/${SURVEY_ID}`)
    await page.getByRole('button', { name: /copy share link/i }).click()

    const clipboardText = await page.evaluate(() => navigator.clipboard.readText())
    expect(clipboardText.endsWith(`/survey/${SURVEY_ID}`)).toBe(true)
  })

  test('Edit button navigates to /admin/surveys/[id]/edit (Slice 4b will replace the redirect stub)', async ({ page }) => {
    await mockClerk(page)
    await mockApi(page, { responsesCount: 0 })

    await page.goto(`/admin/surveys/${SURVEY_ID}`)

    // Wait for full page load under contention before locating the header link
    await expect(page.getByRole('heading', { level: 1, name: MOCK_SURVEY_BASE.name })).toBeVisible({ timeout: 20000 })

    const editLink = page.getByRole('link', { name: 'Edit' })
    await expect(editLink).toBeVisible({ timeout: 10000 })
    await expect(editLink).toHaveAttribute('href', `/admin/surveys/${SURVEY_ID}/edit`)
  })
})
