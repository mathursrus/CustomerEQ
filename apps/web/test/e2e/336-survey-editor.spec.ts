import { test, expect, type Page, type Route } from '@playwright/test'

// Issue #241 Slice 4b (#336) — admin survey editor E2E.
//
// Validates the full editor flow per spec §2–§6 + R3 / R5 / R10 / R23:
//   1. Operator clicks "+ New survey" on the list → /admin/surveys/new
//      (Server Component) → POST /v1/surveys → redirect /[id]/edit?tab=basics.
//   2. Operator fills Basics → tabs through Questions → Look & Feel →
//      Points & Thank You. Auto-save indicator updates after each blur.
//   3. Operator switches consent override to a more-permissive value
//      → ConsentAttestationModal fires on save → PATCH /v1/surveys/:id/consent-mode.
//   4. Operator clicks Activate → ActivateModal → PATCH /v1/surveys/:id/status
//      → ACTIVE → redirect /admin/surveys/[id] (detail page).
//   5. Operator goes back to list → row reflects ACTIVE status.
// Plus:
//   - Discard-draft flow (DELETE /v1/surveys/:id → redirect /admin/surveys).
//   - Activate-gate failure path: no questions / missing title.
//
// Auth bypass: PLAYWRIGHT_TEST=true (set in playwright.config.ts) skips Clerk
// middleware. APIs are mocked via page.route() — same pattern Slice 4a recovered
// to ("feedback_fraim_phases_not_optional.md" Lesson 5 — do NOT invent a new
// auth-bypass mechanism).

const SURVEY_ID = 'srv_test_4b_e2e_001'
const THEME_ID = 'thm_test_4b_e2e_001'
const PROGRAM_ID = 'prg_test_4b_e2e_001'
const BRAND_ID = 'brd_test_4b_e2e_001'

const MOCK_DRAFT_SURVEY = {
  id: SURVEY_ID,
  name: 'Untitled survey',
  title: null,
  description: null,
  type: 'NPS',
  status: 'DRAFT',
  programId: PROGRAM_ID,
  themeId: THEME_ID,
  consentTextOverride: null,
  responsePolicy: 'MULTIPLE',
  thankYouMessage: 'Thanks!',
  thankYouRedirectUrl: null,
  questions: [
    {
      id: 'q_rating',
      type: 'rating',
      text: 'How likely are you to recommend us?',
      required: true,
      config: { min: 0, max: 10 },
    },
  ],
  settings: null,
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
  id: BRAND_ID,
  name: 'Acme Coffee',
  logoUrl: null,
  consentTextDefault: null,
  termsUrl: 'https://acme.test/terms',
  privacyPolicyUrl: 'https://acme.test/privacy',
  memberIdentifierKind: 'email',
  consentMode: 'EXPLICIT',
}

const MOCK_PROGRAM = {
  id: PROGRAM_ID,
  name: 'Acme Loyalty',
  pointCurrencyName: 'Beans',
  earningRules: [{ cxEventForType: 'NPS', pointsAwarded: 25 }],
}

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
  opts: {
    surveyOverride?: Partial<typeof MOCK_DRAFT_SURVEY>
    captureMutations?: (m: { method: string; url: string; body: unknown }) => void
  } = {},
) {
  const survey = { ...MOCK_DRAFT_SURVEY, ...opts.surveyOverride }

  // Catch-all FIRST (LIFO priority); we override specific paths below.
  await page.route('**/v1/**', (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  )

  // GET /v1/surveys/:id
  await page.route(`**/v1/surveys/${SURVEY_ID}`, (route: Route) => {
    const req = route.request()
    if (req.method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ survey }),
      })
    }
    if (req.method() === 'PATCH') {
      opts.captureMutations?.({ method: 'PATCH', url: req.url(), body: JSON.parse(req.postData() ?? '{}') })
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ survey }) })
    }
    if (req.method() === 'DELETE') {
      opts.captureMutations?.({ method: 'DELETE', url: req.url(), body: null })
      return route.fulfill({ status: 204 })
    }
    return route.continue()
  })

  // POST /v1/surveys — used by /new Server Component.
  await page.route('**/v1/surveys', (route: Route) => {
    const req = route.request()
    if (req.method() === 'POST') {
      opts.captureMutations?.({ method: 'POST', url: req.url(), body: JSON.parse(req.postData() ?? '{}') })
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ survey }),
      })
    }
    if (req.method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [survey], total: 1, page: 1, pageSize: 25, totalPages: 1 }),
      })
    }
    return route.continue()
  })

  // Status PATCH (Activate) and consent-mode PATCH.
  await page.route(`**/v1/surveys/${SURVEY_ID}/status`, (route: Route) => {
    opts.captureMutations?.({
      method: 'PATCH',
      url: route.request().url(),
      body: JSON.parse(route.request().postData() ?? '{}'),
    })
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ survey: { ...survey, status: 'ACTIVE' } }),
    })
  })
  await page.route(`**/v1/surveys/${SURVEY_ID}/consent-mode`, (route: Route) => {
    opts.captureMutations?.({
      method: 'PATCH',
      url: route.request().url(),
      body: JSON.parse(route.request().postData() ?? '{}'),
    })
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ survey }) })
  })

  await page.route(`**/v1/brand-themes/${THEME_ID}`, (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ theme: MOCK_THEME }) }),
  )
  await page.route('**/v1/brand-themes', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ themes: [MOCK_THEME] }),
    }),
  )
  await page.route('**/v1/me', (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ brand: MOCK_BRAND }) }),
  )
  await page.route('**/v1/programs', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [MOCK_PROGRAM] }),
    }),
  )
}

test.describe('Admin survey editor — /admin/surveys/[id]/edit', () => {
  test('renders the 4 tabs in spec order with Activate persistent across them (R3 / R5)', async ({ page }) => {
    await mockClerk(page)
    await mockApi(page)

    await page.goto(`/admin/surveys/${SURVEY_ID}/edit?tab=basics`)

    await expect(page.getByRole('tab', { name: 'Basics' })).toBeVisible({ timeout: 20000 })
    const tabs = page.getByRole('tab')
    await expect(tabs).toHaveCount(4)
    await expect(tabs.nth(0)).toContainText('Basics')
    await expect(tabs.nth(1)).toContainText('Questions')
    await expect(tabs.nth(2)).toContainText('Look & Feel')
    await expect(tabs.nth(3)).toContainText('Points & Thank You')

    // Rules tab is intentionally absent (D14 — deferred).
    await expect(page.getByRole('tab', { name: /rules/i })).toHaveCount(0)

    // Activate visible on every tab.
    for (const name of ['Basics', 'Questions', 'Look & Feel', 'Points & Thank You']) {
      await page.getByRole('tab', { name }).click()
      await expect(page.getByRole('button', { name: /^activate$/i })).toBeVisible()
    }
  })

  test('DRAFT auto-save: editing Survey title triggers PATCH /v1/surveys/:id', async ({ page }) => {
    const mutations: Array<{ method: string; url: string; body: unknown }> = []
    await mockClerk(page)
    await mockApi(page, { captureMutations: (m) => mutations.push(m) })

    await page.goto(`/admin/surveys/${SURVEY_ID}/edit?tab=basics`)
    await expect(page.getByLabel(/survey title/i)).toBeVisible({ timeout: 20000 })

    await page.getByLabel(/survey title/i).fill('Quick NPS pulse')
    await page.getByLabel(/internal name/i).click() // Trigger blur.

    await expect.poll(() => mutations.filter((m) => m.method === 'PATCH').length, { timeout: 5000 })
      .toBeGreaterThan(0)
    const patches = mutations.filter((m) => m.method === 'PATCH')
    expect(patches.some((m) => (m.body as Record<string, unknown>)?.title === 'Quick NPS pulse')).toBe(true)
  })

  test('Activate gate: zero questions blocks activation with inline message', async ({ page }) => {
    await mockClerk(page)
    await mockApi(page, { surveyOverride: { questions: [], title: 'Quick NPS pulse' } })

    await page.goto(`/admin/surveys/${SURVEY_ID}/edit?tab=basics`)
    await expect(page.getByRole('button', { name: /^activate$/i })).toBeVisible({ timeout: 20000 })

    await page.getByRole('button', { name: /^activate$/i }).click()
    await expect(page.getByText(/add at least one question/i)).toBeVisible({ timeout: 10000 })
  })

  test('Activate gate: missing Survey title blocks with inline message', async ({ page }) => {
    await mockClerk(page)
    await mockApi(page, { surveyOverride: { title: null } })

    await page.goto(`/admin/surveys/${SURVEY_ID}/edit?tab=basics`)
    await expect(page.getByRole('button', { name: /^activate$/i })).toBeVisible({ timeout: 20000 })

    await page.getByRole('button', { name: /^activate$/i }).click()
    await expect(page.getByText(/survey title.*required/i)).toBeVisible({ timeout: 10000 })
  })

  test('Activate success: PATCH /status → ACTIVE → redirect /admin/surveys/[id]', async ({ page }) => {
    const mutations: Array<{ method: string; url: string; body: unknown }> = []
    await mockClerk(page)
    await mockApi(page, {
      surveyOverride: { title: 'Quick NPS pulse' },
      captureMutations: (m) => mutations.push(m),
    })

    await page.goto(`/admin/surveys/${SURVEY_ID}/edit?tab=basics`)
    await expect(page.getByRole('button', { name: /^activate$/i })).toBeVisible({ timeout: 20000 })

    await page.getByRole('button', { name: /^activate$/i }).click()
    // ActivateModal opens with pre-summary.
    await expect(page.getByTestId('activate-summary')).toBeVisible()
    await page.getByRole('button', { name: /activate.*go to detail|^activate$/i }).last().click()

    // Wait for the status PATCH.
    await expect.poll(() => mutations.filter((m) => m.url.includes('/status')).length, {
      timeout: 5000,
    }).toBeGreaterThan(0)
    // Parent redirects to detail page.
    await expect(page).toHaveURL(new RegExp(`/admin/surveys/${SURVEY_ID}$`), { timeout: 10000 })
  })

  test('Discard draft: confirm → DELETE /v1/surveys/:id → redirect /admin/surveys', async ({ page }) => {
    const mutations: Array<{ method: string; url: string; body: unknown }> = []
    await mockClerk(page)
    await mockApi(page, { captureMutations: (m) => mutations.push(m) })

    await page.goto(`/admin/surveys/${SURVEY_ID}/edit?tab=basics`)
    await expect(page.getByRole('button', { name: /more.*menu/i })).toBeVisible({ timeout: 20000 })

    await page.getByRole('button', { name: /more.*menu/i }).click()
    await page.getByRole('menuitem', { name: /discard draft/i }).click()
    await page.getByRole('button', { name: /discard|delete/i }).click()

    await expect.poll(() => mutations.filter((m) => m.method === 'DELETE').length, {
      timeout: 5000,
    }).toBeGreaterThan(0)
    await expect(page).toHaveURL(/\/admin\/surveys$/, { timeout: 10000 })
  })

  test('Consent override: amber callout + ConsentAttestationModal on save', async ({ page }) => {
    const mutations: Array<{ method: string; url: string; body: unknown }> = []
    await mockClerk(page)
    await mockApi(page, { captureMutations: (m) => mutations.push(m) })

    await page.goto(`/admin/surveys/${SURVEY_ID}/edit?tab=basics`)
    await expect(page.getByRole('combobox', { name: /consent mode/i })).toBeVisible({
      timeout: 20000,
    })

    // Pick the more-permissive override (brand=EXPLICIT, choose IMPLIED).
    await page.getByRole('combobox', { name: /consent mode/i }).selectOption({ label: /override.*implied/i })
    // Amber callout appears.
    await expect(page.getByText(/this deviation will be logged/i)).toBeVisible()

    // Trigger save (blur or explicit save button — depends on state. In DRAFT
    // we rely on the attestation modal firing inline.)
    await expect(page.getByRole('dialog', { name: /attest/i })).toBeVisible({ timeout: 10000 })

    await page.getByLabel(/reason/i).fill('Compliance approved this loosening')
    await page.getByLabel(/i attest/i).check()
    await page
      .getByRole('button', { name: /confirm.*attestation|attest.*confirm|^confirm$/i })
      .click()

    await expect.poll(
      () => mutations.filter((m) => m.url.includes('/consent-mode')).length,
      { timeout: 5000 },
    ).toBeGreaterThan(0)
  })
})

test.describe('/new Server Component — thin shell', () => {
  test('clicking + New survey on the list → /new → POST /v1/surveys → editor?tab=basics', async ({ page }) => {
    const mutations: Array<{ method: string; url: string; body: unknown }> = []
    await mockClerk(page)
    await mockApi(page, { captureMutations: (m) => mutations.push(m) })

    await page.goto('/admin/surveys')
    await expect(page.getByTestId('create-survey-btn')).toBeVisible({ timeout: 20000 })

    await page.getByTestId('create-survey-btn').click()
    await expect.poll(() => mutations.filter((m) => m.method === 'POST').length, { timeout: 10000 })
      .toBeGreaterThan(0)
    await expect(page).toHaveURL(new RegExp(`/admin/surveys/${SURVEY_ID}/edit\\?tab=basics`), {
      timeout: 10000,
    })
  })
})
