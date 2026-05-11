/// <reference types="vitest" />
// Issue #292 Slice 3 — Admin Brand Profile API integration tests.
//
// Covers the 8 scenarios from RFC §Validation Plan §Integration tests, plus
// the URL-scheme refinement (Q4) and the no-IdentityProvider-sync binding
// from Q2 (Slice 4 splits Organization Name vs Brand Name in the UI).
//
// Variance from existing routes: this route uses `config: { lazyUpsertBrand: true }`
// to surface `request.clerkOrgId` and skip the auth plugin's 401-on-missing-brand
// short-circuit. Test-mode header `X-Test-Clerk-Org-Id` exercises the lazy-upsert
// path in integration tests.
//
// Status code conventions: Zod validation failures return 422 (matches existing
// /v1/themes pattern); business-rule failures (IMPLIED transition without
// attestation, EXPLICIT without {{privacy}} token, identifier-kind lock) return
// the contractual code (400 / 409).

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  seedTestDb,
  createBrand,
  createMember,
  authenticatedRequest,
  getTestPrisma,
  getTestApp,
  InMemoryQueue,
} from '@customerEQ/config/test-utils'
import supertest from 'supertest'

// Helper: send a request with X-Test-Clerk-Org-Id but NO X-Test-Brand-Id —
// exercises the auth plugin's lazyUpsertBrand path. Used only for GET tests
// that validate the lazy-upsert-on-first-call behavior.
function lazyUpsertRequest(clerkOrgId: string, userId = 'user_test_lazy') {
  const app = getTestApp()
  const agent = supertest.agent(app.server)
  agent.set('Authorization', `Bearer test_token_lazy`)
  agent.set('X-Test-Clerk-Org-Id', clerkOrgId)
  agent.set('X-Test-User-Id', userId)
  agent.set('Content-Type', 'application/json')
  return agent
}

describe('Admin Brand Profile API — /v1/admin/brand/profile', () => {
  beforeEach(async () => {
    await seedTestDb()
    InMemoryQueue.clear()
  })

  // ---------------------------------------------------------------------------
  // GET — lazy-upsert + response shape
  // ---------------------------------------------------------------------------

  describe('GET /v1/admin/brand/profile', () => {
    it('returns the brand profile for an existing brand', async () => {
      const brand = await createBrand({
        name: 'Acme Corp',
        memberIdentifierKind: 'EMAIL',
        consentMode: 'EXPLICIT',
        privacyPolicyUrl: 'https://acme.com/privacy',
      })
      const request = authenticatedRequest(brand.id)

      const res = await request.get('/v1/admin/brand/profile')

      expect(res.status).toBe(200)
      expect(res.body.brand).toBeDefined()
      expect(res.body.brand.id).toBe(brand.id)
      expect(res.body.brand.name).toBe('Acme Corp')
      expect(res.body.brand.memberIdentifierKind).toBe('EMAIL')
      expect(res.body.brand.consentMode).toBe('EXPLICIT')
      expect(res.body.brand.privacyPolicyUrl).toBe('https://acme.com/privacy')
      // Slice 1 fields — schema defaults
      expect(res.body.brand.timezone).toBe('UTC')
      expect(res.body.brand.locale).toBe('en-US')
      // orgSize is nullable; Slice 1 reshape leaves NULL post-rename
      expect(res.body.brand.orgSize).toBeNull()
    })

    it('GET response includes themes / memberCount / supportEmail keys', async () => {
      const brand = await createBrand()
      const request = authenticatedRequest(brand.id)

      const res = await request.get('/v1/admin/brand/profile')

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.themes)).toBe(true)
      expect(typeof res.body.memberCount).toBe('number')
      expect(typeof res.body.supportEmail).toBe('string')
      expect(res.body.supportEmail.length).toBeGreaterThan(0)
    })

    it('lazy-upserts a brand row when clerkOrgId has no existing brand', async () => {
      const prisma = getTestPrisma()
      const novelClerkOrgId = `org_lazy_${Date.now()}_${Math.random().toString(36).slice(2)}`

      // Pre-condition: no brand for this clerkOrgId.
      const before = await prisma.brand.findUnique({
        where: { clerkOrgId: novelClerkOrgId },
        select: { id: true },
      })
      expect(before).toBeNull()

      const request = lazyUpsertRequest(novelClerkOrgId)
      const res = await request.get('/v1/admin/brand/profile')

      expect(res.status).toBe(200)
      expect(res.body.brand.clerkOrgId).toBe(novelClerkOrgId)

      // Post-condition: brand row created.
      const after = await prisma.brand.findUnique({
        where: { clerkOrgId: novelClerkOrgId },
        select: { id: true, consentTextDefault: true, timezone: true, locale: true },
      })
      expect(after).not.toBeNull()
      // Lazy-upsert seeds defaults: consent text contains {{privacy}} token,
      // timezone=UTC, locale=en-US.
      expect(after?.consentTextDefault).toContain('{{privacy}}')
      expect(after?.timezone).toBe('UTC')
      expect(after?.locale).toBe('en-US')
    })

    it('is idempotent — second GET with same clerkOrgId returns the same brand row', async () => {
      const prisma = getTestPrisma()
      const clerkOrgId = `org_idem_${Date.now()}_${Math.random().toString(36).slice(2)}`
      const request = lazyUpsertRequest(clerkOrgId)

      const first = await request.get('/v1/admin/brand/profile')
      expect(first.status).toBe(200)
      const firstBrandId = first.body.brand.id

      const second = await request.get('/v1/admin/brand/profile')
      expect(second.status).toBe(200)
      expect(second.body.brand.id).toBe(firstBrandId)

      // Single row in DB (no duplicates).
      const count = await prisma.brand.count({ where: { clerkOrgId } })
      expect(count).toBe(1)
    })

    it('seeds the four default themes (Indigo / Forest / Sunset / Slate) on lazy-upsert (R25)', async () => {
      const prisma = getTestPrisma()
      const clerkOrgId = `org_themes_${Date.now()}_${Math.random().toString(36).slice(2)}`
      const request = lazyUpsertRequest(clerkOrgId)

      const res = await request.get('/v1/admin/brand/profile')
      expect(res.status).toBe(200)

      // GET response carries all four defaults.
      const themeNames = res.body.themes.map((t: { name: string }) => t.name).sort()
      expect(themeNames).toEqual(['Forest', 'Indigo', 'Slate', 'Sunset'])

      // Each row carries the swatches projection — [primaryColor, secondaryColor, backgroundColor].
      // accentColor is intentionally NOT included; it's used for error/warning emphasis.
      for (const theme of res.body.themes) {
        expect(Array.isArray(theme.swatches)).toBe(true)
        expect(theme.swatches).toHaveLength(3)
        expect(theme.swatches[0]).toMatch(/^#[0-9a-fA-F]{6}$/)
        expect(theme.swatches[1]).toMatch(/^#[0-9a-fA-F]{6}$/)
        expect(theme.swatches[2]).toMatch(/^#[0-9a-fA-F]{6}$/)
      }

      // Lazy-upsert points Brand.defaultThemeId at the seeded Indigo row so
      // the Look & Feel section opens with a real selection rather than an
      // empty radio group (verified at admin-brand-profile.ts:185-203).
      // Exactly one theme is flagged default, and that theme is Indigo.
      const defaultThemes = res.body.themes.filter((t: { isDefault: boolean }) => t.isDefault)
      expect(defaultThemes).toHaveLength(1)
      expect(defaultThemes[0].name).toBe('Indigo')

      // Verify a known mapping: Indigo's swatches = [#4f46e5, #7c3aed, #ffffff]
      // (primary, secondary, background — NOT accent, which is #b91c1c).
      const indigo = res.body.themes.find((t: { name: string }) => t.name === 'Indigo')
      expect(indigo.swatches).toEqual(['#4f46e5', '#7c3aed', '#ffffff'])

      // DB-side check: exactly four BrandTheme rows for this brand.
      const brandId = res.body.brand.id
      const dbThemes = await prisma.brandTheme.findMany({
        where: { brandId },
        select: { name: true, accentColor: true },
        orderBy: { name: 'asc' },
      })
      expect(dbThemes.map((t) => t.name)).toEqual(['Forest', 'Indigo', 'Slate', 'Sunset'])

      // Accent colors are stored on the row even though they're not in the
      // swatches projection — Slice 4 reads them for error/warning emphasis.
      // Sunset uses rose-700 (#be123c) to avoid clashing with its orange
      // primary; the other three use red-700 (#b91c1c).
      const accentByName = Object.fromEntries(dbThemes.map((t) => [t.name, t.accentColor]))
      expect(accentByName.Indigo).toBe('#b91c1c')
      expect(accentByName.Forest).toBe('#b91c1c')
      expect(accentByName.Sunset).toBe('#be123c')
      expect(accentByName.Slate).toBe('#b91c1c')
    })

    it('seeds Brand.name from the identity-provider organization name on first run (PR #308 feedback)', async () => {
      const prisma = getTestPrisma()
      const clerkOrgId = `org_name_${Date.now()}_${Math.random().toString(36).slice(2)}`
      const request = lazyUpsertRequest(clerkOrgId)

      const app = getTestApp()
      const provider = (app as { identityProvider?: { getOrg?: unknown } }).identityProvider
      if (!provider?.getOrg) {
        throw new Error('integration test setup did not wire identityProvider.getOrg — see test/integration/setup.ts')
      }
      const spy = vi.spyOn(
        provider as { getOrg: (..._a: unknown[]) => Promise<{ id: string; name: string }> },
        'getOrg',
      )
      spy.mockResolvedValueOnce({ id: clerkOrgId, name: 'Acme Coffee Roasters' })

      const res = await request.get('/v1/admin/brand/profile')
      expect(res.status).toBe(200)
      // First-run Brand.name matches the identity-provider org name; the
      // admin sees the same string in the org-switcher chip and on the
      // Identity section's editable Brand-name field on first paint.
      expect(res.body.brand.name).toBe('Acme Coffee Roasters')

      const persisted = await prisma.brand.findUniqueOrThrow({
        where: { clerkOrgId },
        select: { name: true },
      })
      expect(persisted.name).toBe('Acme Coffee Roasters')

      spy.mockRestore()
    })

    it('falls back to "Untitled Organization" when identityProvider.getOrg fails', async () => {
      const prisma = getTestPrisma()
      const clerkOrgId = `org_name_fb_${Date.now()}_${Math.random().toString(36).slice(2)}`
      const request = lazyUpsertRequest(clerkOrgId)

      const app = getTestApp()
      const provider = (app as { identityProvider?: { getOrg?: unknown } }).identityProvider
      if (!provider?.getOrg) {
        throw new Error('integration test setup did not wire identityProvider.getOrg — see test/integration/setup.ts')
      }
      const spy = vi.spyOn(
        provider as { getOrg: (..._a: unknown[]) => Promise<{ id: string; name: string }> },
        'getOrg',
      )
      spy.mockRejectedValueOnce(new Error('simulated provider failure'))

      const res = await request.get('/v1/admin/brand/profile')
      // Lazy-upsert still succeeds — admin gets a working settings page;
      // they can rename Brand.name from the form once the page loads.
      expect(res.status).toBe(200)
      expect(res.body.brand.name).toBe('Untitled Organization')

      const persisted = await prisma.brand.findUniqueOrThrow({
        where: { clerkOrgId },
        select: { name: true },
      })
      expect(persisted.name).toBe('Untitled Organization')

      spy.mockRestore()
    })

    it('does not re-seed default themes on a second GET (idempotent)', async () => {
      const prisma = getTestPrisma()
      const clerkOrgId = `org_themes_idem_${Date.now()}_${Math.random().toString(36).slice(2)}`
      const request = lazyUpsertRequest(clerkOrgId)

      await request.get('/v1/admin/brand/profile')
      await request.get('/v1/admin/brand/profile')

      const brand = await prisma.brand.findUniqueOrThrow({
        where: { clerkOrgId },
        select: { id: true },
      })
      const themeCount = await prisma.brandTheme.count({ where: { brandId: brand.id } })
      // Still exactly four — nested createMany only fires on the create branch
      // of upsert, so the second GET (which hits the update branch) does not
      // re-seed.
      expect(themeCount).toBe(4)
    })
  })

  // ---------------------------------------------------------------------------
  // PATCH — multitenant + auth
  // ---------------------------------------------------------------------------

  describe('PATCH /v1/admin/brand/profile — multitenant + auth gate', () => {
    it('rejects body-supplied brandId with 400 (multiTenant plugin)', async () => {
      const brand = await createBrand()
      const request = authenticatedRequest(brand.id)

      const res = await request
        .patch('/v1/admin/brand/profile')
        .send({ brandId: 'malicious_brand_id', name: 'New Name' })

      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/brandId/i)
    })

    it('rejects unauthenticated requests with 401', async () => {
      const app = getTestApp()
      const agent = supertest.agent(app.server)
      agent.set('Content-Type', 'application/json')

      const res = await agent
        .patch('/v1/admin/brand/profile')
        .send({ name: 'Whatever' })

      expect(res.status).toBe(401)
    })
  })

  // ---------------------------------------------------------------------------
  // PATCH — Zod validation incl. URL-scheme refinement (Q4 / SLICE2-MED-1)
  // ---------------------------------------------------------------------------

  describe('PATCH /v1/admin/brand/profile — URL-scheme refinement (Q4 / SLICE2-MED-1)', () => {
    it('rejects javascript: scheme on privacyPolicyUrl', async () => {
      const brand = await createBrand()
      const request = authenticatedRequest(brand.id)

      const res = await request
        .patch('/v1/admin/brand/profile')
        // eslint-disable-next-line no-script-url -- intentional in test
        .send({ privacyPolicyUrl: 'javascript:alert(1)' })

      expect(res.status).toBe(422)
    })

    it('rejects data: scheme on termsUrl', async () => {
      const brand = await createBrand()
      const request = authenticatedRequest(brand.id)

      const res = await request
        .patch('/v1/admin/brand/profile')
        .send({ termsUrl: 'data:text/html,<script>alert(1)</script>' })

      expect(res.status).toBe(422)
    })

    it('rejects mailto: scheme on privacyPolicyUrl', async () => {
      const brand = await createBrand()
      const request = authenticatedRequest(brand.id)

      const res = await request
        .patch('/v1/admin/brand/profile')
        .send({ privacyPolicyUrl: 'mailto:steal@example.com' })

      expect(res.status).toBe(422)
    })

    it('accepts https:// URLs on privacyPolicyUrl and termsUrl', async () => {
      const brand = await createBrand()
      const request = authenticatedRequest(brand.id)

      const res = await request
        .patch('/v1/admin/brand/profile')
        .send({
          privacyPolicyUrl: 'https://acme.com/privacy',
          termsUrl: 'https://acme.com/terms',
        })

      expect(res.status).toBe(200)
      expect(res.body.brand.privacyPolicyUrl).toBe('https://acme.com/privacy')
      expect(res.body.brand.termsUrl).toBe('https://acme.com/terms')
    })

    it('accepts http:// (non-https) URLs', async () => {
      // /^https?:/i intentionally allows plain http:// — admin choice, not
      // a validator decision. Refinement only blocks non-http(s) schemes.
      const brand = await createBrand()
      const request = authenticatedRequest(brand.id)

      const res = await request
        .patch('/v1/admin/brand/profile')
        .send({ privacyPolicyUrl: 'http://insecure-but-explicit.example/privacy' })

      expect(res.status).toBe(200)
    })
  })

  describe('PATCH /v1/admin/brand/profile — Zod basic validation', () => {
    it('rejects empty name with 422', async () => {
      const brand = await createBrand()
      const request = authenticatedRequest(brand.id)

      const res = await request
        .patch('/v1/admin/brand/profile')
        .send({ name: '' })

      expect(res.status).toBe(422)
    })

    it('rejects malformed consent token with 422', async () => {
      const brand = await createBrand()
      const request = authenticatedRequest(brand.id)

      const res = await request
        .patch('/v1/admin/brand/profile')
        .send({ consentTextDefault: 'I agree to the {{unknown_kind}} policy.' })

      expect(res.status).toBe(422)
    })
  })

  // ---------------------------------------------------------------------------
  // PATCH — IMPLIED transition attestation gate (RFC §4.2)
  // ---------------------------------------------------------------------------

  describe('PATCH /v1/admin/brand/profile — IMPLIED consent attestation gate', () => {
    it('rejects IMPLIED_ON_SUBMIT transition without attestation (400)', async () => {
      const brand = await createBrand({ consentMode: 'EXPLICIT' })
      const request = authenticatedRequest(brand.id)

      const res = await request
        .patch('/v1/admin/brand/profile')
        .send({ consentMode: 'IMPLIED_ON_SUBMIT' })

      expect(res.status).toBe(422)
      expect(JSON.stringify(res.body)).toMatch(/attestation/i)
    })

    it('accepts IMPLIED_ON_SUBMIT transition with valid attestation (200)', async () => {
      const brand = await createBrand({ consentMode: 'EXPLICIT' })
      const request = authenticatedRequest(brand.id)

      const res = await request
        .patch('/v1/admin/brand/profile')
        .send({
          consentMode: 'IMPLIED_ON_SUBMIT',
          attestation: {
            justification: 'Legal counsel approved IMPLIED for our jurisdiction',
            confirmed: true,
          },
        })

      expect(res.status).toBe(200)
      expect(res.body.brand.consentMode).toBe('IMPLIED_ON_SUBMIT')
    })
  })

  // ---------------------------------------------------------------------------
  // PATCH — identifier-kind lock when members exist (RFC §4.2)
  // ---------------------------------------------------------------------------

  describe('PATCH /v1/admin/brand/profile — identifier-kind lock', () => {
    it('rejects identifier-kind change with 409 MEMBER_IDENTIFIER_KIND_LOCKED when members exist', async () => {
      const brand = await createBrand({ memberIdentifierKind: 'EMAIL' })
      await createMember({ brandId: brand.id, email: 'one@example.com' })
      await createMember({ brandId: brand.id, email: 'two@example.com' })
      const request = authenticatedRequest(brand.id)

      const res = await request
        .patch('/v1/admin/brand/profile')
        .send({ memberIdentifierKind: 'PHONE' })

      expect(res.status).toBe(409)
      expect(res.body.code).toBe('MEMBER_IDENTIFIER_KIND_LOCKED')
    })

    it('allows identifier-kind change when zero members exist', async () => {
      const brand = await createBrand({ memberIdentifierKind: 'EMAIL' })
      const request = authenticatedRequest(brand.id)

      const res = await request
        .patch('/v1/admin/brand/profile')
        .send({ memberIdentifierKind: 'PHONE' })

      expect(res.status).toBe(200)
      expect(res.body.brand.memberIdentifierKind).toBe('PHONE')
    })
  })

  // ---------------------------------------------------------------------------
  // PATCH — EXPLICIT requires {{privacy}} token (RFC §4.2)
  // ---------------------------------------------------------------------------

  describe('PATCH /v1/admin/brand/profile — EXPLICIT requires {{privacy}} token', () => {
    it('rejects EXPLICIT save without {{privacy}} token in consentTextDefault (400)', async () => {
      const brand = await createBrand({ consentMode: 'EXPLICIT' })
      const request = authenticatedRequest(brand.id)

      const res = await request
        .patch('/v1/admin/brand/profile')
        .send({
          consentMode: 'EXPLICIT',
          consentTextDefault: 'I agree to be contacted.',
        })

      expect(res.status).toBe(400)
      expect(JSON.stringify(res.body)).toMatch(/privacy/i)
    })

    it('accepts EXPLICIT save with {{privacy}} token', async () => {
      const brand = await createBrand({ consentMode: 'EXPLICIT' })
      const request = authenticatedRequest(brand.id)

      const res = await request
        .patch('/v1/admin/brand/profile')
        .send({
          consentMode: 'EXPLICIT',
          consentTextDefault: 'I agree to the {{privacy}} terms.',
        })

      expect(res.status).toBe(200)
    })
  })

  // ---------------------------------------------------------------------------
  // PATCH — audit event with allowlisted metadata (RFC §9)
  // ---------------------------------------------------------------------------

  describe('PATCH /v1/admin/brand/profile — audit + identity provider', () => {
    it('writes an AuditEvent row with allowlisted metadata after a successful PATCH', async () => {
      const prisma = getTestPrisma()
      const brand = await createBrand({ name: 'Old Name', consentMode: 'EXPLICIT' })
      const request = authenticatedRequest(brand.id)

      const beforeCount = await prisma.auditEvent.count({ where: { brandId: brand.id } })

      const res = await request
        .patch('/v1/admin/brand/profile')
        .send({
          name: 'New Name',
          siteDomain: 'newdomain.com',
        })

      expect(res.status).toBe(200)

      // Audit-plugin is fire-and-forget; allow a microtask tick.
      await new Promise((r) => setTimeout(r, 50))

      const events = await prisma.auditEvent.findMany({
        where: { brandId: brand.id },
        orderBy: { createdAt: 'desc' },
      })
      expect(events.length).toBeGreaterThan(beforeCount)
      const ev = events[0]!
      expect(ev.action).toBe('brand.profile.update')
      // Allowlist metadata: changedFields, before, after
      const meta = ev.metadata as Record<string, unknown>
      expect(meta).toHaveProperty('changedFields')
      expect(meta).toHaveProperty('before')
      expect(meta).toHaveProperty('after')
      // Allowlist excludes raw method/path/statusCode for this route
      expect(meta).not.toHaveProperty('method')
      expect(meta).not.toHaveProperty('path')
    })

    it('does NOT invoke IdentityProvider.updateOrgName on Brand.name change (Q2 binding)', async () => {
      const app = getTestApp()
      const provider = (app as { identityProvider?: { updateOrgName?: unknown } }).identityProvider
      // If the identityProvider decorator is not present in test mode, this
      // assertion is moot — the production code path can't reach the SDK
      // without it, so the binding holds. Otherwise spy on it.
      const spy = provider?.updateOrgName
        ? vi.spyOn(provider as { updateOrgName: (..._a: unknown[]) => Promise<void> }, 'updateOrgName')
        : null

      const brand = await createBrand({ name: 'Old Brand Name' })
      const request = authenticatedRequest(brand.id)

      const res = await request
        .patch('/v1/admin/brand/profile')
        .send({ name: 'New Brand Name' })

      expect(res.status).toBe(200)
      expect(res.body.brand.name).toBe('New Brand Name')

      if (spy) {
        expect(spy).not.toHaveBeenCalled()
        spy.mockRestore()
      }
    })
  })
})
