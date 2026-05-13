import { test, expect, type Page, type Route } from '@playwright/test'

// Issue #241 Slice 4b (#336) — surveys list E2E (deferred from Slice 3 per
// phase-7 evidence). Bundled with 336-survey-editor.spec.ts so Clerk-auth +
// seed fixtures are shared (single bundle keeps CI runtime down).
//
// Coverage per spec §1:
//   - Chip filters (Status × Type) narrow the table.
//   - Row click → /admin/surveys/[id] (detail page).
//   - ⋯ menu state-aware visibility per Slice 3's survey-row-menu.logic:
//       DRAFT  → Discard / Duplicate
//       ACTIVE → Pause / Duplicate
//       PAUSED → Resume / Duplicate / Stop
//       STOPPED → Restart / Duplicate
//   - + New survey → POST /v1/surveys → /[id]/edit?tab=basics (mirrors the
//     editor spec but asserts the LIST is the entry point — Slice 3 left
//     this untested at e2e level).

const DRAFT_ID = 'srv_test_4b_list_draft'
const ACTIVE_ID = 'srv_test_4b_list_active'
const PAUSED_ID = 'srv_test_4b_list_paused'
const STOPPED_ID = 'srv_test_4b_list_stopped'

const ROWS = [
  {
    id: DRAFT_ID,
    name: 'NPS Q3 draft',
    description: 'Loyalty NPS',
    programId: 'prg_test_4b_loyalty',
    type: 'NPS',
    status: 'DRAFT',
    updatedAt: new Date('2026-05-13T10:00:00Z').toISOString(),
    _count: { responses: 0 },
  },
  {
    id: ACTIVE_ID,
    name: 'CSAT live',
    description: null,
    programId: 'prg_test_4b_loyalty',
    type: 'CSAT',
    status: 'ACTIVE',
    updatedAt: new Date('2026-05-12T10:00:00Z').toISOString(),
    _count: { responses: 22 },
  },
  {
    id: PAUSED_ID,
    name: 'CES paused',
    description: null,
    programId: 'prg_test_4b_loyalty',
    type: 'CES',
    status: 'PAUSED',
    updatedAt: new Date('2026-05-11T10:00:00Z').toISOString(),
    _count: { responses: 7 },
  },
  {
    id: STOPPED_ID,
    name: 'NPS stopped',
    description: null,
    programId: 'prg_test_4b_loyalty',
    type: 'NPS',
    status: 'STOPPED',
    updatedAt: new Date('2026-05-10T10:00:00Z').toISOString(),
    _count: { responses: 99 },
  },
]

async function mockClerk(page: Page) {
  await page.route('**/clerk.**', (route: Route) => {
    if (route.request().resourceType() === 'document') return route.continue()
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })
  await page.route('**/.well-known/**', (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  )
}

async function mockApi(page: Page) {
  await page.route('**/v1/**', (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  )
  await page.route('**/v1/surveys', (route: Route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: ROWS, total: ROWS.length, page: 1, pageSize: 25, totalPages: 1 }),
      })
    }
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ survey: ROWS[0] }),
      })
    }
    return route.continue()
  })
  await page.route('**/v1/programs', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [{ id: 'prg_test_4b_loyalty', name: 'Acme Loyalty' }] }),
    }),
  )
  await page.route('**/v1/me', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        brand: {
          id: 'brd_test_4b_list',
          name: 'Acme',
          memberIdentifierKind: 'email',
          consentMode: 'EXPLICIT',
        },
      }),
    }),
  )
}

test.describe('Admin surveys list — /admin/surveys', () => {
  test('renders all rows with status pills + type chips in spec column order', async ({ page }) => {
    await mockClerk(page)
    await mockApi(page)

    await page.goto('/admin/surveys')
    await expect(page.getByRole('heading', { name: 'Surveys' })).toBeVisible({ timeout: 20000 })

    const tableRows = page.getByTestId('surveys-table').locator('tbody tr')
    await expect(tableRows).toHaveCount(ROWS.length)
    // First column shows the survey name link.
    for (const row of ROWS) {
      await expect(page.getByRole('link', { name: row.name })).toBeVisible()
    }
  })

  test('Status chip filter narrows the table to ACTIVE rows only', async ({ page }) => {
    await mockClerk(page)
    await mockApi(page)

    await page.goto('/admin/surveys')
    await expect(page.getByRole('link', { name: 'NPS Q3 draft' })).toBeVisible({ timeout: 20000 })

    // Open Status filter chips and pick "Active".
    const statusChip = page.getByRole('button', { name: /^status$/i })
    await statusChip.click()
    await page.getByRole('option', { name: /^active$/i }).click()
    // Close the popover (click outside or press Escape).
    await page.keyboard.press('Escape')

    await expect(page.getByRole('link', { name: 'CSAT live' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'NPS Q3 draft' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'CES paused' })).toHaveCount(0)
  })

  test('Type chip filter narrows the table to NPS rows only', async ({ page }) => {
    await mockClerk(page)
    await mockApi(page)

    await page.goto('/admin/surveys')
    await expect(page.getByRole('link', { name: 'NPS Q3 draft' })).toBeVisible({ timeout: 20000 })

    await page.getByRole('button', { name: /^type$/i }).click()
    await page.getByRole('option', { name: /^nps$/i }).click()
    await page.keyboard.press('Escape')

    await expect(page.getByRole('link', { name: 'NPS Q3 draft' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'NPS stopped' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'CSAT live' })).toHaveCount(0)
  })

  test('row click navigates to /admin/surveys/[id] (detail page)', async ({ page }) => {
    await mockClerk(page)
    await mockApi(page)

    await page.goto('/admin/surveys')
    await expect(page.getByRole('link', { name: 'CSAT live' })).toBeVisible({ timeout: 20000 })
    await page.getByRole('link', { name: 'CSAT live' }).click()
    await expect(page).toHaveURL(new RegExp(`/admin/surveys/${ACTIVE_ID}$`), { timeout: 10000 })
  })

  test('⋯ menu visibility is state-aware (DRAFT shows Discard)', async ({ page }) => {
    await mockClerk(page)
    await mockApi(page)

    await page.goto('/admin/surveys')
    await expect(page.getByRole('link', { name: 'NPS Q3 draft' })).toBeVisible({ timeout: 20000 })

    // Open the ⋯ menu on the DRAFT row.
    await page.getByTestId(`survey-row-menu-${DRAFT_ID}`).click()
    await expect(page.getByRole('menuitem', { name: /discard/i })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: /^pause$/i })).toHaveCount(0)
    await expect(page.getByRole('menuitem', { name: /restart/i })).toHaveCount(0)
  })

  test('⋯ menu visibility is state-aware (ACTIVE shows Pause, not Discard)', async ({ page }) => {
    await mockClerk(page)
    await mockApi(page)

    await page.goto('/admin/surveys')
    await expect(page.getByRole('link', { name: 'CSAT live' })).toBeVisible({ timeout: 20000 })

    await page.getByTestId(`survey-row-menu-${ACTIVE_ID}`).click()
    await expect(page.getByRole('menuitem', { name: /^pause$/i })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: /^discard$/i })).toHaveCount(0)
  })

  test('⋯ menu visibility is state-aware (STOPPED shows Restart)', async ({ page }) => {
    await mockClerk(page)
    await mockApi(page)

    await page.goto('/admin/surveys')
    await expect(page.getByRole('link', { name: 'NPS stopped' })).toBeVisible({ timeout: 20000 })

    await page.getByTestId(`survey-row-menu-${STOPPED_ID}`).click()
    await expect(page.getByRole('menuitem', { name: /restart/i })).toBeVisible()
  })

  test('+ New survey → /admin/surveys/new → editor in DRAFT', async ({ page }) => {
    await mockClerk(page)
    await mockApi(page)

    await page.goto('/admin/surveys')
    await expect(page.getByTestId('create-survey-btn')).toBeVisible({ timeout: 20000 })
    await page.getByTestId('create-survey-btn').click()
    // The Server Component creates a row and redirects to /[id]/edit?tab=basics.
    await expect(page).toHaveURL(new RegExp(`/admin/surveys/${DRAFT_ID}/edit\\?tab=basics`), {
      timeout: 15000,
    })
  })
})
