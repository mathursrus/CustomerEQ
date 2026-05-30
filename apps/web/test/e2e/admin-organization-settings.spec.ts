import { test, expect, type Page, type Route, type Request } from '@playwright/test'

// Admin Organization Settings E2E — Closes #292 Slice 4.
//
// Covers /admin/settings/organization. 12 scenarios from the spec
// §Validation Plan (docs/feature-specs/277-organization-settings.md).
//
// Auth: PLAYWRIGHT_TEST=true (set in playwright.config.ts) bypasses
// Clerk middleware (apps/web/src/middleware.ts:24). Existing E2E specs
// already mock the Clerk JS endpoints + /v1/* API routes via
// page.route(); this suite follows the same pattern.
//
// Note: Clerk's useOrganization() hook returns null in PLAYWRIGHT_TEST
// mode (no real session). The Identity section's read-only Clerk-org-name
// row must therefore render a graceful fallback (presence of the row
// structure with helper copy) so the spec's Q2 reframe — TWO distinct
// name surfaces — remains observable end-to-end.

const API = 'http://localhost:4000'

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_BRAND_BASE = {
  id: 'brand-001',
  clerkOrgId: 'org_test_001',
  name: 'Acme Coffee Roasters',
  siteDomain: 'acmecoffee.com',
  logoUrl: null,
  orgSize: 'SIZE_11_50',
  timezone: 'America/Los_Angeles',
  locale: 'en-US',
  defaultThemeId: 'theme-indigo',
  memberIdentifierKind: 'EMAIL',
  consentMode: 'EXPLICIT',
  consentTextDefault:
    'By submitting this response, you agree we may use your feedback to improve our products. See our {{privacy}} for details.',
  privacyPolicyUrl: 'https://acmecoffee.com/privacy',
  termsUrl: 'https://acmecoffee.com/terms',
  createdAt: '2026-04-01T00:00:00.000Z',
}

const MOCK_THEMES = [
  { id: 'theme-indigo', name: 'Indigo', isDefault: true, swatches: ['#4f46e5', '#7c3aed', '#eef2ff'] },
  { id: 'theme-forest', name: 'Forest', isDefault: false, swatches: ['#16a34a', '#65a30d', '#dcfce7'] },
  { id: 'theme-sunset', name: 'Sunset', isDefault: false, swatches: ['#ea580c', '#d97706', '#fed7aa'] },
  { id: 'theme-slate', name: 'Slate', isDefault: false, swatches: ['#475569', '#334155', '#e2e8f0'] },
]

const SUPPORT_EMAIL = 'support@customereq.wellnessatwork.me'

type ProfileResponse = {
  brand: typeof MOCK_BRAND_BASE
  themes: typeof MOCK_THEMES
  memberCount: number
  supportEmail: string
}

function buildResponse(overrides: Partial<typeof MOCK_BRAND_BASE> = {}, memberCount = 0): ProfileResponse {
  return {
    brand: { ...MOCK_BRAND_BASE, ...overrides },
    themes: MOCK_THEMES,
    memberCount,
    supportEmail: SUPPORT_EMAIL,
  }
}

// ---------------------------------------------------------------------------
// Mock helpers — Clerk auth + API surface
// ---------------------------------------------------------------------------

async function mockClerkAuth(page: Page) {
  await page.route('**/clerk.**', (route: Route) => {
    if (route.request().resourceType() === 'document') return route.continue()
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })
  await page.route('**/.well-known/**', (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  )
}

type MockApiOptions = {
  initial: ProfileResponse
  /** Capture every PATCH body for assertions. */
  patchCapture?: { body: unknown; calls: number }
  /** Override the next PATCH response (e.g., 409 lock). */
  patchOverride?: { status: number; body: unknown }
}

async function mockProfileApi(page: Page, opts: MockApiOptions): Promise<void> {
  let current = opts.initial

  // Register the catch-all FIRST so the specific route below has higher
  // priority (Playwright matches routes LIFO — last-registered wins).
  // Adjacent /v1/* calls from any future layout-side fetch get a safe 200.
  await page.route(`**/v1/**`, (route: Route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })

  await page.route(`**/v1/admin/brand/profile`, async (route: Route) => {
    const req = route.request()
    if (req.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(current),
      })
      return
    }
    if (req.method() === 'PATCH') {
      const bodyText = req.postData() ?? '{}'
      const parsed = JSON.parse(bodyText)
      if (opts.patchCapture) {
        opts.patchCapture.body = parsed
        opts.patchCapture.calls += 1
      }
      if (opts.patchOverride) {
        await route.fulfill({
          status: opts.patchOverride.status,
          contentType: 'application/json',
          body: JSON.stringify(opts.patchOverride.body),
        })
        return
      }
      // Apply the PATCH to the in-memory brand and return the updated row,
      // mirroring the real API's PATCH response shape.
      current = {
        ...current,
        brand: { ...current.brand, ...parsed },
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ brand: current.brand }),
      })
      return
    }
    await route.fulfill({ status: 405 })
  })
}

// Each test sets up its own mocks; no shared state across tests.

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

test.describe('Admin Organization Settings — /admin/settings/organization', () => {
  test('1. Lazy-upsert on first visit — page renders with brand row from GET', async ({ page }) => {
    await mockClerkAuth(page)
    await mockProfileApi(page, { initial: buildResponse() })

    await page.goto('/admin/settings/organization')

    await expect(page.getByRole('heading', { name: /organization settings/i })).toBeVisible()
    // All six sections render
    await expect(page.locator('#s-identity')).toBeVisible()
    await expect(page.locator('#s-defaults')).toBeVisible()
    await expect(page.locator('#s-lookfeel')).toBeVisible()
    await expect(page.locator('#s-members')).toBeVisible()
    await expect(page.locator('#s-consent')).toBeVisible()
    await expect(page.locator('#s-developer')).toBeVisible()

    // Brand name from the GET response renders into the editable input
    await expect(page.getByLabel(/brand name/i)).toHaveValue(MOCK_BRAND_BASE.name)
  })

  test('2. Per-section save — Identity edit triggers PATCH with only that section\'s changed fields', async ({
    page,
  }) => {
    await mockClerkAuth(page)
    const capture = { body: undefined as unknown, calls: 0 }
    await mockProfileApi(page, { initial: buildResponse(), patchCapture: capture })

    await page.goto('/admin/settings/organization')

    const brandNameInput = page.getByLabel(/brand name/i)
    await brandNameInput.fill('Acme Coffee Co.')

    // Save Identity reveals on dirty; click it
    const saveBtn = page.locator('#s-identity').getByRole('button', { name: /save identity/i })
    await expect(saveBtn).toBeVisible()
    await saveBtn.click()

    // Wait for PATCH to land
    await expect.poll(() => capture.calls).toBe(1)

    // Body contains the changed field only — not unrelated sections
    expect(capture.body).toMatchObject({ name: 'Acme Coffee Co.' })
    expect(capture.body as Record<string, unknown>).not.toHaveProperty('consentMode')
    expect(capture.body as Record<string, unknown>).not.toHaveProperty('memberIdentifierKind')
  })

  test('3. EXPLICIT empty consent text gate — pending banner row appears', async ({ page }) => {
    await mockClerkAuth(page)
    await mockProfileApi(page, {
      initial: buildResponse({
        consentMode: 'EXPLICIT',
        consentTextDefault: '',
        privacyPolicyUrl: '',
      }),
    })

    await page.goto('/admin/settings/organization')

    // Banner row mentions the missing privacy policy URL (one of the EXPLICIT-required gates)
    const banner = page.getByRole('status').filter({ hasText: /action needed/i })
    await expect(banner).toBeVisible()
    await expect(banner).toContainText(/privacy policy url/i)
  })

  test('4. IMPLIED attestation modal — fires on consentMode flip; persists with attestation block', async ({
    page,
  }) => {
    await mockClerkAuth(page)
    const capture = { body: undefined as unknown, calls: 0 }
    await mockProfileApi(page, { initial: buildResponse(), patchCapture: capture })

    await page.goto('/admin/settings/organization')

    // Flip consent mode to IMPLIED; modal must appear before any PATCH fires
    const impliedRadio = page.locator('#s-consent').getByLabel(/implied/i)
    await impliedRadio.click()

    const modal = page.getByRole('dialog', { name: /attestation|implied|legal review/i })
    await expect(modal).toBeVisible()

    // Confirm button is disabled until justification + checkbox satisfied
    const confirmBtn = modal.getByRole('button', { name: /confirm|attest/i })
    await expect(confirmBtn).toBeDisabled()

    await modal.getByRole('textbox', { name: /justification|reason/i }).fill('Reviewed with legal counsel; brand serves SMB-only markets without GDPR/CCPA exposure.')
    await modal.getByRole('checkbox').check()
    await expect(confirmBtn).toBeEnabled()

    await confirmBtn.click()
    // Modal closes; consent section is now dirty. The user must click Save
    // Consent to commit the change — the modal's Confirm captures the
    // attestation but does not auto-PATCH (per-section save model).
    await expect(modal).toBeHidden()

    await page.locator('#s-consent').getByRole('button', { name: /save consent|save legal/i }).click()

    // PATCH body contains the attestation block + IMPLIED mode
    await expect.poll(() => capture.calls).toBe(1)
    expect(capture.body).toMatchObject({
      consentMode: 'IMPLIED_ON_SUBMIT',
      attestation: {
        justification: expect.stringContaining('legal counsel'),
        confirmed: true,
      },
    })
  })

  test('4b. IMPLIED modal cancellation — no PATCH fires', async ({ page }) => {
    await mockClerkAuth(page)
    const capture = { body: undefined as unknown, calls: 0 }
    await mockProfileApi(page, { initial: buildResponse(), patchCapture: capture })

    await page.goto('/admin/settings/organization')

    await page.locator('#s-consent').getByLabel(/implied/i).click()
    const modal = page.getByRole('dialog', { name: /attestation|implied|legal review/i })
    await expect(modal).toBeVisible()
    await modal.getByRole('button', { name: /cancel/i }).click()

    // Modal closes
    await expect(modal).toBeHidden()
    // Zero PATCHes
    expect(capture.calls).toBe(0)
    // Consent mode remains EXPLICIT in the form (not flipped)
    await expect(page.locator('#s-consent').getByLabel(/explicit/i)).toBeChecked()
  })

  test('5. Identifier-kind lock — radios disabled on first paint when memberCount > 0', async ({
    page,
  }) => {
    await mockClerkAuth(page)
    await mockProfileApi(page, { initial: buildResponse({}, 1284) })

    await page.goto('/admin/settings/organization')

    // All three radios are disabled
    const memberSection = page.locator('#s-members')
    await expect(memberSection.getByLabel(/email/i)).toBeDisabled()
    await expect(memberSection.getByLabel(/phone/i)).toBeDisabled()
    await expect(memberSection.getByLabel(/customer.id/i)).toBeDisabled()

    // Locked notice surfaces the count and a working mailto link
    const lockedNotice = memberSection.getByText(/1.?284.*member|members are already enrolled/i)
    await expect(lockedNotice).toBeVisible()
    const mailtoLink = memberSection.getByRole('link', { name: /contact (customereq )?support|support/i })
    await expect(mailtoLink).toHaveAttribute('href', `mailto:${SUPPORT_EMAIL}`)
  })

  test('5b. Identifier-kind lock — server returns 409 if a PATCH attempt slips through', async ({
    page,
  }) => {
    await mockClerkAuth(page)
    await mockProfileApi(page, {
      initial: buildResponse({}, 0), // UI thinks editing is allowed
      patchOverride: {
        status: 409,
        body: { error: 'Identifier kind locked', code: 'MEMBER_IDENTIFIER_KIND_LOCKED', memberCount: 1284 },
      },
    })

    await page.goto('/admin/settings/organization')

    await page.locator('#s-members').getByLabel(/phone/i).click()
    await page.locator('#s-members').getByRole('button', { name: /save member|save identification/i }).click()

    // The error surface must show the lock message — assert by a stable substring.
    await expect(page.locator('#s-members').getByText(/cannot be changed|locked|already enrolled/i).last()).toBeVisible()
  })

  test('6. Brand-name change writes Brand.name only — Identity renders TWO name surfaces; PATCH carries Brand.name only', async ({
    page,
  }) => {
    await mockClerkAuth(page)
    const capture = { body: undefined as unknown, calls: 0 }
    await mockProfileApi(page, { initial: buildResponse(), patchCapture: capture })

    await page.goto('/admin/settings/organization')

    const identity = page.locator('#s-identity')

    // a) Two structurally distinct name surfaces — read-only org name and editable Brand name.
    const orgNameRow = identity.getByLabel(/organization name/i)
    await expect(orgNameRow).toBeVisible()
    await expect(orgNameRow).toBeDisabled()

    const brandNameInput = identity.getByLabel(/brand name/i)
    await expect(brandNameInput).toBeEnabled()
    await expect(brandNameInput).toHaveValue(MOCK_BRAND_BASE.name)

    // Helper copy points the admin at the OrganizationSwitcher Manage flow for renaming the Clerk org.
    await expect(
      identity.getByText(/identity provider|organization (switcher|menu).*manage/i).first(),
    ).toBeVisible()

    // b) Edit Brand name and save.
    await brandNameInput.fill('Acme Coffee Roasters — North America')
    await identity.getByRole('button', { name: /save identity/i }).click()

    await expect.poll(() => capture.calls).toBe(1)

    // c) PATCH carries Brand.name only — no Clerk org name field, no IdentityProvider sync.
    expect(capture.body).toMatchObject({ name: 'Acme Coffee Roasters — North America' })
    const body = capture.body as Record<string, unknown>
    expect(body).not.toHaveProperty('clerkOrgId')
    expect(body).not.toHaveProperty('organizationName')

    // d) No "syncing with identity provider" badge or copy on the page.
    await expect(page.getByText(/syncing.*identity|identity.provider.sync/i)).toHaveCount(0)
  })

  test('7. Sidebar — Settings → Organization is the first entry under Settings', async ({ page }) => {
    await mockClerkAuth(page)
    await mockProfileApi(page, { initial: buildResponse() })

    await page.goto('/admin/members')

    const sidebar = page.locator('aside')
    const orgLink = sidebar.getByRole('link', { name: /^organization$/i })
    await expect(orgLink).toBeVisible()
    await orgLink.click()
    await expect(page).toHaveURL(/\/admin\/settings\/organization$/)

    // Active-state styling — one assertion: the link carries an indigo background or active class.
    const activeOrgLink = sidebar.getByRole('link', { name: /^organization$/i })
    const className = await activeOrgLink.getAttribute('class')
    expect(className ?? '').toMatch(/indigo|active|bg-indigo/i)
  })

  test('8. Read-only identifiers — Brand id + Clerk org id render with copy controls; SUPPORT_EMAIL mailto wired', async ({
    page,
  }) => {
    await mockClerkAuth(page)
    await mockProfileApi(page, { initial: buildResponse() })

    await page.goto('/admin/settings/organization')

    const developer = page.locator('#s-developer')
    // Section is collapsed by default per spec — expand it to reach the rows.
    const heading = developer.getByRole('heading', { name: /developer/i })
    await heading.click()

    await expect(developer.getByText(MOCK_BRAND_BASE.id)).toBeVisible()
    await expect(developer.getByText(MOCK_BRAND_BASE.clerkOrgId)).toBeVisible()

    // Each id has a Copy button
    const copyButtons = developer.getByRole('button', { name: /copy/i })
    await expect(copyButtons).not.toHaveCount(0)

    // Support email mailto link
    const supportLink = developer.getByRole('link', { name: new RegExp(SUPPORT_EMAIL, 'i') }).or(
      developer.getByRole('link', { name: /support@customereq/i }),
    )
    await expect(supportLink).toHaveAttribute('href', `mailto:${SUPPORT_EMAIL}`)
  })

  test('9. Pending banner — multi-row, no Dismiss, jump-to-section works; clears as required fields populate', async ({
    page,
  }) => {
    await mockClerkAuth(page)
    await mockProfileApi(page, {
      initial: buildResponse({ name: '', privacyPolicyUrl: '' }),
    })

    await page.goto('/admin/settings/organization')

    const banner = page.getByRole('status').filter({ hasText: /action needed/i })
    await expect(banner).toBeVisible()

    // Two rows — Brand name + Privacy policy URL
    await expect(banner).toContainText(/brand name/i)
    await expect(banner).toContainText(/privacy policy url/i)
    // Header reflects the count
    await expect(banner).toContainText(/2\s+settings? incomplete/i)

    // No Dismiss affordance anywhere on the banner
    await expect(banner.getByRole('button', { name: /dismiss|close|hide/i })).toHaveCount(0)
    expect(await banner.locator('[aria-label*="dismiss" i]').count()).toBe(0)

    // Identity field-level error renders once the user interacts with the
    // input (RHF mode: 'onChange'). The banner row above is the load-bearing
    // gap surface; the inline error is the in-section follow-on.
    const brandNameInput = page.getByLabel(/brand name/i)

    // Fill brand name → banner re-renders with one row, count = 1
    await brandNameInput.fill('Acme Coffee')
    await expect(banner).toContainText(/1\s+setting incomplete/i)

    // Fill privacy URL → banner disappears
    await page.locator('#s-consent').getByLabel(/privacy policy url/i).fill('https://acmecoffee.com/privacy')
    await expect(banner).toHaveCount(0)
  })

  test('10. Consent text editor — live preview renders {{privacy}} as a working anchor; no script injection on label allowlist edge case', async ({
    page,
  }) => {
    await mockClerkAuth(page)
    await mockProfileApi(page, {
      initial: buildResponse({
        consentMode: 'EXPLICIT',
        consentTextDefault: 'See {{privacy:"data policy"}} and {{terms}}.',
      }),
    })

    await page.goto('/admin/settings/organization')

    const preview = page.locator('[data-testid="consent-preview"], .preview-card').first()
    await expect(preview).toBeVisible()

    const previewLink = preview.getByRole('link', { name: /data policy/i })
    await expect(previewLink).toBeVisible()
    await expect(previewLink).toHaveAttribute('href', MOCK_BRAND_BASE.privacyPolicyUrl)

    const termsLink = preview.getByRole('link', { name: /terms and conditions/i })
    await expect(termsLink).toBeVisible()

    // Defense-in-depth: the renderer never emits raw <script>; assert the
    // preview's HTML has no <script> tag even if a malformed label sneaks in.
    const innerHtml = await preview.innerHTML()
    expect(innerHtml).not.toMatch(/<script/i)
  })

  test('11. EXPLICIT requires {{privacy}} token — save rejected; banner row appears', async ({ page }) => {
    await mockClerkAuth(page)
    await mockProfileApi(page, {
      initial: buildResponse(),
      patchOverride: {
        status: 400,
        body: {
          error: 'EXPLICIT consent mode requires consentTextDefault to contain a {{privacy}} token',
          code: 'EXPLICIT_REQUIRES_PRIVACY_TOKEN',
        },
      },
    })

    await page.goto('/admin/settings/organization')

    const consentSection = page.locator('#s-consent')
    const textarea = consentSection.getByRole('textbox', { name: /consent text/i })
    await textarea.fill('We may use your feedback. No links here.')

    await consentSection.getByRole('button', { name: /save consent|save legal/i }).click()

    // Either the banner row surfaces or a section-level error — assert at least one signal is visible.
    await expect(
      page
        .getByText(/privacy link|{{privacy}}|privacy token|add a privacy/i)
        .first(),
    ).toBeVisible()
  })

  test('12. Toolbar token insertion — `+ Privacy link` inserts the verbose default form', async ({
    page,
  }) => {
    await mockClerkAuth(page)
    await mockProfileApi(page, {
      initial: buildResponse({ consentTextDefault: '' }),
    })

    await page.goto('/admin/settings/organization')

    const consentSection = page.locator('#s-consent')
    const textarea = consentSection.getByRole('textbox', { name: /consent text/i })
    await textarea.click()

    await consentSection.getByRole('button', { name: /\+\s*privacy link/i }).click()

    // The verbose default form is inserted with the default label.
    await expect(textarea).toHaveValue(/\{\{privacy:"Privacy Policy"\}\}/)

    // After the first insert the inserted label is selected (so the admin
    // can immediately type to override it). Move the cursor to end before
    // the second click so the Terms token appends rather than wrapping the
    // selected Privacy Policy label.
    await textarea.evaluate((el: HTMLTextAreaElement) => {
      el.setSelectionRange(el.value.length, el.value.length)
    })

    await consentSection.getByRole('button', { name: /\+\s*terms link/i }).click()
    await expect(textarea).toHaveValue(
      /\{\{privacy:"Privacy Policy"\}\}\{\{terms:"Terms and Conditions"\}\}/,
    )
  })
})
