# Feature: Organization Settings page — Technical Design

Issue: [#277](https://github.com/mathursrus/CustomerEQ/issues/277)
Spec: [`docs/feature-specs/277-organization-settings.md`](../feature-specs/277-organization-settings.md)
PR: [#290](https://github.com/mathursrus/CustomerEQ/pull/290) (spec + design ship together)
Owner: manohar.madhira@outlook.com
Status: Draft

## Customer

Same as spec — a new admin who just created a Clerk organization and any returning admin who needs to revisit org-level configuration. This RFC turns the spec's six-section UI into concrete schema, endpoints, components, and migrations.

## Customer Problem being solved

Same as spec. The implementation work this RFC governs unblocks:
- **First-run self-serve.** Today: admin creates a Clerk org → empty CustomerEQ shell → CustomerEQ engineer must `INSERT INTO brands` by hand. After this RFC ships: admin creates a Clerk org → redirect to `/admin/settings/organization` → row lazy-upserts on first GET → admin configures and saves.
- **Discoverability.** All Brand-row-backed org-level fields converge on one page with a non-dismissible action banner pointing at any incomplete required field.
- **Future Survey-creation simplification module** (R18): the consent-text shared package lands here so that future module imports it, not duplicates it.

## Scope

This RFC covers the implementation strategy for **all** spec deliverables in #277 v0:
- Backend: 3 endpoints under `/v1/admin/brand/profile/*`, one schema migration, one shared package (`@customereq/consent-text`).
- Frontend: 1 admin page (`/admin/settings/organization`) + 1 shared admin component (`AdminPendingBanner`) + 1 `OrganizationSwitcher` prop change in the admin layout.
- Provisioning: lazy-upsert at GET, belt-and-suspenders at PATCH, redirect-on-org-create via Clerk's built-in prop.

**Out of scope** (per spec): the Clerk webhook (#239 — additive), the GDPR erasure job (#264 — already its own issue), multi-brand-per-org (#44), and the future Survey-creation simplification module (which consumes the package this RFC creates but is itself a separate epic).

## Technical Details

### 1. Schema changes (`packages/database/prisma/schema.prisma`)

**Already in the schema** (from #170 spec work + #231 implementation): `Brand.clerkOrgId`, `name`, `siteDomain`, `logoUrl`, `memberIdentifierKind`, `consentMode`, `consentTextDefault`, `privacyPolicyUrl`, `termsUrl`, `defaultThemeId`, `sizeCategory`. The columns exist; only the UI was missing.

**This RFC adds / changes:**

```prisma
// Existing enum — additive change. Old values kept for historical compatibility
// (no production rows exist with the old values because #170 never shipped a UI
// that wrote to sizeCategory; defensive only). New values land alongside.
enum OrgSizeCategory {
  // Legacy values — kept for compat, never produced by new UI / API.
  SIZE_1_10
  SIZE_11_50
  SIZE_51_200       // legacy — superseded by SIZE_51_300
  SIZE_201_PLUS     // legacy — superseded by SIZE_301_5000 / SIZE_5000_PLUS
  // New values (Issue #277)
  SIZE_51_300
  SIZE_301_5000
  SIZE_5000_PLUS
  PREFER_NOT_TO_SAY
}

model Brand {
  // ... existing fields unchanged ...

  // Issue #277 — column rename + 2 new columns
  // (Prisma `@map` on the renamed column avoids a destructive SQL ALTER COLUMN
  // RENAME and lets the migration be a pure-rename migration.)
  teamSize    OrgSizeCategory? @map("sizeCategory")  // was `sizeCategory` — column physically renamed in migration; @map kept temporarily to ease forward-only deployment, then dropped in the next migration cycle once the rename is canonical
  timezone    String           @default("UTC")        // R23 — IANA tz; resolved from browser hint at first save with UTC fallback
  locale      String           @default("en-US")      // R23 — BCP 47; resolved from navigator.language with en-US fallback
}
```

**Why keep legacy enum values:** Postgres `ALTER TYPE … RENAME VALUE` and `DROP VALUE` are destructive and require recreating the type for non-trivial reshape. Since (a) zero production rows are expected to hold `SIZE_51_200` or `SIZE_201_PLUS` (no UI ever wrote to the column) and (b) the migration cost of a clean reshape (recreate enum, migrate column, drop old enum) is real but the value of removing the legacy values is zero, we keep them as deprecated-but-allowed and gate on application code never producing them. This also means `prisma migrate deploy` runs as a single, additive ALTER TYPE that can't fail mid-way.

**Why `@map("sizeCategory")` then drop later:** A column rename via `prisma migrate` generates a `ALTER TABLE … RENAME COLUMN` SQL — clean and forward-only. The `@map` is **not** needed because we are renaming. (Drop the `@map` annotation from the Prisma model in the same migration.) The above schema snippet is the post-rename state; the migration SQL below does the actual rename.

### 2. Schema migration

New migration: `packages/database/prisma/migrations/<TIMESTAMP>_org_settings_277/migration.sql`. Single migration, all changes additive or rename-only.

```sql
-- Issue #277 — Organization Settings schema additions.
-- All changes are forward-only and idempotent under repeated `migrate deploy`.

-- 1. Rename column sizeCategory → teamSize (no data loss; column is unindexed and unconstrained).
ALTER TABLE "brands" RENAME COLUMN "sizeCategory" TO "teamSize";

-- 2. Add new enum values (non-destructive; old values remain for historical compat).
ALTER TYPE "OrgSizeCategory" ADD VALUE IF NOT EXISTS 'SIZE_51_300';
ALTER TYPE "OrgSizeCategory" ADD VALUE IF NOT EXISTS 'SIZE_301_5000';
ALTER TYPE "OrgSizeCategory" ADD VALUE IF NOT EXISTS 'SIZE_5000_PLUS';

-- 3. Add new columns with safe defaults.
ALTER TABLE "brands"
  ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS "locale"   TEXT NOT NULL DEFAULT 'en-US';

-- 4. Default-theme seeding support (§5). Add isStockDefault column + composite
--    unique constraint that doubles as the seed-race guard.
ALTER TABLE "survey_themes"
  ADD COLUMN IF NOT EXISTS "isStockDefault" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS "survey_themes_brandId_name_key"
  ON "survey_themes" ("brandId", "name");
```

Note: `ALTER TYPE … ADD VALUE` cannot run inside an existing transaction in older Postgres versions, but Postgres 12+ (we're on 16) lifts that restriction. `prisma migrate deploy` runs each migration file in its own transaction; this migration is safe.

No data backfill is needed — every existing Brand row gets `'UTC'` and `'en-US'` from the column default. No row currently sets `sizeCategory`, so the rename is metadata-only.

### 3. Shared package — `@customereq/consent-text`

**Decision: new package at `packages/consent-text/`** (not under `@customereq/config` and not under `@customereq/shared`).

| Frame | Position |
|---|---|
| **Reuse `@customereq/shared`** | Shared has Zod schemas + types — the consent-text validator fits the shape. Pros: zero new package overhead. Cons: shared bundles into both web + api + worker, so adding a HTML renderer (DOM-adjacent) bloats the worker / API bundle with code they don't run. |
| **Reuse `@customereq/config`** | Config holds test-utils + constants. Pros: lower friction. Cons: config is for build-time / test-time concerns; runtime parser/validator/renderer mismatches the package's intent. |
| **New `packages/consent-text` (chosen)** | One package, three exports (parser, Zod validator, HTML renderer). Web app + API both import only what they need; worker doesn't import any of it. Aligns with the precedent set by `packages/embed` (also runtime-narrow, exported separately to keep blast radius small). |

**Module structure:**
```
packages/consent-text/
  src/
    index.ts          // re-exports
    parser.ts         // tokenize() — returns array of { kind, customLabel, raw }
    validator.ts      // zConsentText, validateConsentText() — Zod schema + helper
    renderer.ts       // renderConsentTextHTML() + renderConsentTextReact() — both inject labels via textContent-equivalent (R18)
    tokens.ts         // regex + allowlist constants
    types.ts          // ConsentToken, ConsentTextRenderOptions
  package.json
  tsconfig.json
```

**Three required consumers** (R18):
1. `apps/api/src/routes/admin-brand-profile.ts` (this RFC) — imports `zConsentText` for PATCH validation.
2. `apps/api/src/routes/surveys.ts` PATCH path (#276) — imports `zConsentText` for survey-level override validation. **Implementation note:** #276 currently inlines its own validation; switching to the shared module is a follow-up tracked under R18's import-graph check.
3. The future Survey-creation simplification module — imports `renderConsentTextReact` for live preview.

**Token regex** (single source of truth, exported from `tokens.ts`):
```typescript
export const CONSENT_TOKEN_RE = /\{\{(privacy|terms)(?::"([^"<>}{]{1,80})")?\}\}/g
export const TOKEN_KINDS = ['privacy', 'terms'] as const
export const DEFAULT_LABEL_BY_KIND = { privacy: 'Privacy Policy', terms: 'Terms and Conditions' } as const
```

Renderer never uses `dangerouslySetInnerHTML` / `innerHTML`; the React renderer returns `ReactNode[]` (text nodes + `<a>` elements with `{label}` as children); the HTML renderer uses `document.createTextNode` / DOM APIs and returns a string assembled by `outerHTML` of a fragment. No string concatenation of `innerHTML` is permitted (R18, defense-in-depth — Compliance section of spec).

### 4. API design

Three new endpoints under the existing `/v1/admin/*` surface. Routes file: `apps/api/src/routes/admin-brand-profile.ts`. All routes auth-gated to admin role (existing pattern; `auth` plugin extracts `brandId` from JWT, `multiTenant` plugin rejects body-supplied `brandId`).

#### 4.1 `GET /v1/admin/brand/profile`

```typescript
// Response shape
type GetBrandProfileResponse = {
  brand: {
    id: string
    clerkOrgId: string
    name: string
    siteDomain: string | null
    logoUrl: string | null
    teamSize: OrgSizeCategory | null      // R24
    timezone: string                       // R23 — never null, has default
    locale: string                         // R23 — never null, has default
    defaultThemeId: string | null
    memberIdentifierKind: MemberIdentifierKind
    consentMode: ConsentMode
    consentTextDefault: string | null
    privacyPolicyUrl: string | null
    termsUrl: string | null
    createdAt: string                       // ISO
  }
  themes: Array<{ id: string; name: string; isDefault: boolean; swatches: [string, string, string] }>  // R25 — full set incl. the 4 defaults seeded for this brand
  memberCount: number                       // R22 — used by client to render Member-identification locked state on first paint (R10)
  supportEmail: string                      // R20 — env-derived
}
```

**Lazy-upsert** (R2 + R26):
1. Fastify `auth` plugin verifies JWT. If `clerkOrgId` is present, the handler runs an `upsert`:
   ```typescript
   const brand = await prisma.brand.upsert({
     where: { clerkOrgId },
     update: {},
     create: {
       clerkOrgId,
       name: jwtClaims.org_name ?? 'Untitled Organization',
       consentTextDefault: DEFAULT_CONSENT_TEXT,    // R21 — sensible default with {{privacy}} token
       timezone: req.headers['x-timezone-hint'] ?? 'UTC',     // optional hint from client
       locale: req.headers['x-locale-hint']     ?? 'en-US',
     },
   })
   ```
2. After upsert, run the additional read paths in `Promise.all` (architecture pattern §6):
   - `prisma.theme.findMany({ where: { brandId } })` — full theme list
   - `prisma.member.count({ where: { brandId } })` — for locked-state computation
   - `process.env.SUPPORT_EMAIL ?? 'support@customereq.com'` — env resolution
3. **First-run theme seeding** (R25): if the upsert created the brand (`brand.createdAt` was just now) AND `themes.length === 0`, the handler also creates the four default `SurveyTheme` rows (Indigo / Forest / Sunset / Slate) in the same `Promise.all`. Idempotent on the new `@@unique([brandId, name])` composite added in §5; concurrent inserts produce a `unique_violation` (Prisma P2002) that the seed code catches and treats as "already seeded by a sibling request." This is the **per-brand seed** decision (see §5 below).

#### 4.2 `PATCH /v1/admin/brand/profile`

```typescript
const PatchBrandProfileBodySchema = z.object({
  name:                  z.string().trim().min(1).max(120).optional(),
  siteDomain:            z.string().regex(/^[a-z0-9.-]+$/).optional().nullable(),
  logoUrl:               z.string().url().optional().nullable(),
  teamSize:              zOrgSizeCategoryNew.optional().nullable(),  // only the 5 new values + PREFER_NOT_TO_SAY accepted from clients
  timezone:              z.string().regex(/^[A-Za-z_/+-]+$/).optional(),
  locale:                z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/).optional(),
  defaultThemeId:        z.string().cuid().optional().nullable(),
  memberIdentifierKind:  z.nativeEnum(MemberIdentifierKind).optional(),
  consentMode:           z.nativeEnum(ConsentMode).optional(),
  consentTextDefault:    zConsentText.optional().nullable(),         // imported from @customereq/consent-text
  privacyPolicyUrl:      z.string().url().optional().nullable(),
  termsUrl:              z.string().url().optional().nullable(),
  attestation:           z.object({                                   // required only when consentMode → IMPLIED_ON_SUBMIT
    justification: z.string().min(1).max(500),
    confirmed:     z.literal(true),
  }).optional(),
}).refine(
  body => !(body.consentMode === 'IMPLIED_ON_SUBMIT' && !body.attestation),
  { message: 'attestation required when switching to IMPLIED_ON_SUBMIT', path: ['attestation'] },
)
```

**Server-side cross-field validation** (additional to Zod):
- `consentMode === 'EXPLICIT'` AND `consentTextDefault` lacks a `{{privacy}}` token → **400** (R19).
- `memberIdentifierKind` change AND `Member.count(brandId) > 0` → **409 `MEMBER_IDENTIFIER_KIND_LOCKED`** (R10) — short-circuits before any other validation so the client gets a precise error code.
- `teamSize` legacy values (`SIZE_51_200`, `SIZE_201_PLUS`) — server rejects with 400 even though the enum allows them, since they are deprecated (the Zod schema `zOrgSizeCategoryNew` only contains the new 5 values + PREFER_NOT_TO_SAY).

**Audit-event payload** (per-route metadata allowlist, pattern from #276 RFC):
```typescript
// In apps/api/src/plugins/audit.ts config:
'admin-brand-profile.update.metadata': ['changedFields', 'before', 'after', 'attestation', 'memberCountAtChange']
```
- For an IMPLIED transition, `metadata.attestation = { admin, justification, attestedAt }` is included (R9).
- For an identifier-kind change, the route is rejected before audit fires; the data-ops migration pathway writes `metadata.memberCountAtChange` with `actor: 'data-ops'`.

#### 4.3 `POST /v1/admin/brand/logo`

Multipart upload. Validates PNG / SVG / JPEG (≤2 MB, min 64×64). Persists to existing asset path. Returns the URL; the client chains it into the next PATCH so the upload + the field write are one user-visible save (per spec). No audit event for upload-without-write — the audit happens when the URL is patched onto the brand.

### 5. Default-theme seeding decision

**Decision: per-brand seed at provisioning** — the 4 default themes are written as 4 `SurveyTheme` rows for the brand on first lazy-upsert. Implemented in the GET handler (§4.1, step 3). Each row has `isStockDefault: true` (new boolean column added in this migration) so admin-edit-detection is straightforward.

| Frame | Position |
|---|---|
| **Per-brand seed (chosen)** | Pros: each brand owns its themes — admin can edit Indigo's accent color and that change is brand-local; theme-list query is a simple `findMany({ where: { brandId } })` with no cross-brand fallback logic. Cons: 4× row count on `themes` table (negligible at any reasonable brand count). Storage cost is microscopic; query simplicity wins. |
| **Global rows shared across brands** | Pros: 4 rows total instead of 4 × N. Cons: every "edit a default theme" becomes a copy-on-write to a brand-specific override; theme-list query becomes `(global stock themes) UNION (brand custom)` with awkward identity semantics; deleting a custom theme that overrides a global default has surprising fallback behavior. The complexity isn't worth saving 4 × N rows. |
| **Hybrid (global stock + per-brand customizations)** | Pros: lowest storage. Cons: most complex of the three; copy-on-write semantics bleed into every theme-edit path; the existing `apps/web/src/app/(admin)/admin/settings/themes/` page would need refactoring to support the override concept. |

**Schema additions for this decision** (on the existing `SurveyTheme` model — `Theme` was a placeholder name in earlier RFC drafts; the actual model is `SurveyTheme`):

```prisma
model SurveyTheme {
  // ... existing fields, including `isDefault Boolean @default(false)` —
  // distinct from `isStockDefault`: `isDefault` is the brand's chosen default
  // (mutually exclusive per brand); `isStockDefault` is "shipped with the brand
  // at provisioning" (4 rows per brand). ...

  // Issue #277 — true for the 4 seeded stock themes (Indigo / Forest / Sunset / Slate);
  // false for admin-created custom themes. Used by the Look & Feel UI to label "Stock"
  // vs "Custom" in the theme picker.
  isStockDefault Boolean @default(false)

  // Issue #277 — enables the seed race-mitigation strategy (§7 Risks): concurrent
  // first-GETs hit a unique-constraint violation that's safe to swallow. The model
  // had no name unique constraint pre-#277.
  @@unique([brandId, name])
}
```

Migration adds the column **and** the composite unique constraint; first-run seeding sets `isStockDefault: true` on the 4 seed rows. The unique constraint is the seed-race guard.

### 6. Frontend page architecture

#### 6.1 Routes

```
apps/web/src/app/(admin)/admin/settings/organization/
  page.tsx                  // RSC entry, fetches GET /v1/admin/brand/profile server-side, hydrates client form
  components/
    OrganizationSettingsForm.tsx     // top-level form (RHF), composes 6 sections
    sections/
      IdentitySection.tsx
      DefaultsSection.tsx            // timezone + locale (R23)
      LookAndFeelSection.tsx
      MemberIdentificationSection.tsx
      ConsentLegalSection.tsx
      DeveloperSupportSection.tsx
    ImpliedAttestationModal.tsx       // R9
    ConsentTextEditor.tsx             // wraps the @customereq/consent-text renderer for live preview
```

#### 6.2 Shared admin component (R16) — `AdminPendingBanner`

Lives at `apps/web/src/components/admin/AdminPendingBanner.tsx`. Reusable across future settings pages with cross-section required fields.

```typescript
type PendingItem = {
  field: string
  label: string                   // e.g. "Organization name"
  consequence: string             // e.g. "required to identify your organization across CustomerEQ"
  jumpToSectionId: string         // e.g. "s-identity"
}

interface AdminPendingBannerProps {
  items: PendingItem[]            // empty array → render nothing
}
```

The banner is data-state-driven (R16 — no Dismiss / Snooze affordance). Computed client-side from form state on every change. Vanishes automatically when `items.length === 0`.

#### 6.3 Form-state management

**React Hook Form** (RHF) with Zod resolver via `@hookform/resolvers/zod` — same pattern as the existing `apps/web/src/app/(admin)/admin/settings/themes/page.tsx`. Per-section dirty state via RHF's `formState.dirtyFields` filtered by section field paths; Save / Cancel revealed when the section has any dirty field.

**Pending-fields computation:**
```typescript
const pendingItems = useMemo(() => {
  const items: PendingItem[] = []
  if (!values.name?.trim())                             items.push({ field: 'name', ... })
  if (values.consentMode === 'EXPLICIT' && !values.privacyPolicyUrl) items.push({ field: 'privacyPolicyUrl', ... })
  if (values.consentMode === 'EXPLICIT' && !hasPrivacyToken(values.consentTextDefault)) items.push({ field: 'consentTextDefault', ... })
  // ...
  return items
}, [values])
```

`hasPrivacyToken` imported from `@customereq/consent-text/parser` so the client uses the same regex as the server validator (R18).

#### 6.4 TOC + sticky right rail

Six entries; the `pending` style applies when any of the section's fields appear in `pendingItems`. CSS `position: sticky` with `top: 80px` (matches the existing settings page layout per the mock).

### 7. Redirect-on-org-create + OrganizationSwitcher integration

**Decision: Clerk's built-in props on `<OrganizationSwitcher>`** (no Clerk webhook dependency, no Next.js middleware, no client-side `useEffect` redirect).

The admin layout at `apps/web/src/app/(admin)/layout.tsx` currently has:
```tsx
<OrganizationSwitcher
  hidePersonal
  afterSelectOrganizationUrl="/admin/members"
  appearance={...}
/>
```

Three changes for #277:
```tsx
<OrganizationSwitcher
  hidePersonal
  afterCreateOrganizationUrl="/admin/settings/organization"   // R26 — post-create landing for new orgs
  afterSelectOrganizationUrl="/admin/members"
  organizationProfileMode="redirect"                          // R6 — opt out of Clerk-hosted org profile
  organizationProfileUrl="/admin/settings/organization"       // R6 — "Manage" link deep-links to our settings page
  appearance={...}
/>
```

That is the entire redirect / Manage-link implementation. No webhook, no middleware, no race conditions — Clerk handles the redirect client-side after its create-org flow completes, and the redirect target's first GET runs the lazy-upsert (§4.1). The `organizationProfileMode="redirect"` opt-out tells Clerk not to render its hosted org-profile modal; the `organizationProfileUrl` tells Clerk where to send the admin instead.

**Sidebar entry (R5):** the existing admin sidebar in `layout.tsx` adds one entry under the **Settings** group as the **first item**:
```tsx
const navLinks: { href: string; label: string; section?: string }[] = [
  // ...existing entries...
  // ── Settings ──
  { href: '/admin/settings/organization', label: 'Organization', section: 'Settings' },  // NEW (R5) — first item under Settings
  { href: '/admin/settings/themes',       label: 'Themes',       section: 'Settings' },
  { href: '/admin/settings/webhooks',     label: 'Webhooks',     section: 'Settings' },
  // ...
]
```

### 7a. IdentityProvider write-through for name changes (R8)

When PATCH writes a new `Brand.name`, the route handler:
1. Writes the DB row first inside the existing `prisma.$transaction` (DB is source of truth — architecture §6 "Append-Only" / "Transactional Integrity" patterns; same write-first principle).
2. After the transaction commits, calls `fastify.identityProvider.updateOrgName({ orgId: brand.clerkOrgId, newName })` outside the transaction (best-effort, decoupled).
3. If the provider call fails, the failure is queued for retry via the existing event pipeline (`enqueueIdentityProviderRetry({ orgId, newName, op: 'updateOrgName' })`) — fire-and-forget, with a `syncing-with-identity-provider` badge surfacing on the admin's name field until the retry succeeds.

This follows the existing `IdentityProvider` boundary pattern from architecture §4.2 (introduced in #170 OD-5; ADR 0004): no direct `@clerk/*` imports in route handlers; `fastify.identityProvider` is the only entry point. The write-through is identical in shape to the `createUserWithOrg` retry pattern already shipped under #170 PR 2.

| Frame | Position |
|---|---|
| **Clerk webhook (#239)** | Server-side, robust to client-side navigation interruptions. But: independent work stream, no SLA from Clerk on delivery, requires svix signature verification path (we have it, see /api/webhooks/identity-provider per architecture.md), and most importantly **does not actually solve the redirect problem** — the webhook fires server-side; redirecting the admin's browser still requires a client-side mechanism. The webhook is an additive optimization for *background* flows hitting the API before the admin has visited, not for the admin's own first-load redirect. |
| **Next.js middleware** | Would inspect every request and redirect new-org admins to settings. But: there's no signal in the JWT that distinguishes "just created" from "navigated to /admin"; the middleware would have to query the DB for `Brand.createdAt < 30s ago` which is hacky. |
| **Client-side `useEffect` in `/admin/page.tsx`** | Detect "just-created" by checking GET response. But: forces an extra round-trip and doesn't help the admin who lands on `/admin/members` from `afterSelectOrganizationUrl`. |
| **Clerk `afterCreateOrganizationUrl` (chosen)** | One-prop change. Built-in. Immediate. No race conditions because Clerk only navigates after the org is fully created. |

The redirect-on-create requirement (R26) is satisfied by this prop. The webhook (#239) remains valuable for background-flow provisioning (a CLI hitting `/v1/members/enroll` before any admin has visited the web app), but is **not a dependency** for #277.

### 8. Authorization & validation summary

| Concern | Mechanism |
|---|---|
| `brandId` from JWT only | `multiTenant` plugin (existing) — rejects `brandId` in body. |
| Admin-role gate | `auth` plugin (existing) — rejects non-admin with 403 (R14). |
| IMPLIED transition attestation | Zod `.refine` on body shape (PATCH §4.2). |
| Identifier-kind lock when members exist | Server-side count + 409 short-circuit (PATCH §4.2). |
| Consent-text validation | `zConsentText` from `@customereq/consent-text` (single source of truth, R18). |
| EXPLICIT requires `{{privacy}}` token | Server-side cross-field check; client mirrors via `hasPrivacyToken` from same package. |
| Inner-string allowlist (no `<` `>` `"` `}` `{`, ≤80 chars) | Enforced at the regex level in `tokens.ts`; renderer additionally never injects raw HTML (R18 defense-in-depth). |

### 9. Audit-event coverage

Three audit-relevant operations:
- `brand.profile.updated` — every PATCH that successfully writes any field. `metadata: { changedFields, before, after }` (per-route allowlist).
- `brand.consent.mode_changed_to_implied` — PATCH that flips consentMode to IMPLIED. `metadata.attestation: { admin, justification, attestedAt }` added.
- `brand.identifier_kind_changed` — only via the data-ops out-of-band pathway (UI is locked). `metadata: { before, after, memberCountAtChange, actor: 'data-ops' }`.

Pattern matches #276 RFC's per-route allowlist (audit plugin reads the allowlist from a route-config object).

## Validation Plan

Maps spec's validation plan (12 functional E2E + 8 API integration + 4 compliance) to concrete files. All tests follow project rule R8 (shared test utils, no inline mocks) and R11a (tests fail loudly, never skip).

### Unit tests

Co-located with the new package and components.

| Test file | Coverage |
|---|---|
| `packages/consent-text/src/parser.test.ts` | tokenize() across bare / labeled / mixed inputs; allowlist rejection; ≤80-char cap |
| `packages/consent-text/src/validator.test.ts` | zConsentText accept / reject matrix |
| `packages/consent-text/src/renderer.test.ts` | textContent injection — assert no `innerHTML` / `dangerouslySetInnerHTML` paths exist (regex test on renderer source) |
| `apps/web/src/components/admin/AdminPendingBanner.test.tsx` | banner renders / hides based on items prop; no Dismiss affordance present |

### Integration tests (apps/api)

`apps/api/test/integration/admin-brand-profile.spec.ts`:
- GET lazy-upserts on first call; second call is idempotent.
- GET response shape includes `themes`, `memberCount`, `supportEmail`.
- PATCH rejects `brandId` in body (R6 of repo).
- PATCH rejects non-admin role (403).
- PATCH writing IMPLIED without attestation → 400.
- PATCH identifier-kind change with `Member.count > 0` → 409 `MEMBER_IDENTIFIER_KIND_LOCKED`.
- PATCH consent text with token outside allowlist → 400.
- PATCH EXPLICIT save without `{{privacy}}` token → 400.

### E2E tests (Playwright)

`tests/e2e/admin-organization-settings.spec.ts` — 12 scenarios from spec § Validation Plan, items 1–12. Hits the real dev server with a Clerk test session (existing pattern from `themes` page tests).

### Compliance tests

- Integration test: AuditEvent for IMPLIED transition contains full `metadata.attestation`.
- Snapshot test: rendered consent UI on the embedded survey form for an EXPLICIT brand contains exact text + working `{{privacy}}` link + zero `<script>`-equivalent injection.
- Cross-package import-graph check (script in `tools/check-consent-text-imports.ts`): asserts that brand-level + #276 survey-level + (when shipped) Survey-creation simplification module all import from `@customereq/consent-text`. Forward-looking on the third consumer; CI step gates on this.

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Postgres `ALTER TYPE … ADD VALUE` semantics differ across versions | Low | We're on Postgres 16 (architecture.md §2). PG12+ allows ADD VALUE outside transactions; PG16's behavior is documented. Migration tested in dev compose first. |
| Clerk's `afterCreateOrganizationUrl` prop is not honored on every Clerk plan / configuration | Low | Documented Clerk feature, present in current SDK version. Pre-flight: a small Playwright test that drives the OrganizationSwitcher create flow and asserts the redirect target. If Clerk changes the prop name, it's caught at PR time. |
| Default-theme seeding race: two concurrent first-GETs both seed 4 rows (8 total) | Low | The `@@unique([brandId, name])` constraint added to `SurveyTheme` in this RFC's schema diff (§5) is the guard: concurrent inserts produce a Postgres `unique_violation` (Prisma P2002) that the seed code catches and treats as "already seeded by a sibling request." No transaction with `SELECT ... FOR UPDATE` needed. |
| `@customereq/consent-text` placement choice locks in import surface for #276 + future module | Medium | The package can be moved later (`@customereq/shared/consent-text` is a renaming, not a redesign). Choosing `packages/consent-text` is the lowest-friction starting point; moving is cheap. |
| Member-count query on every GET — could be slow on large brands | Low | `prisma.member.count({ where: { brandId } })` uses the existing `(brandId)` index; sub-millisecond at any reasonable member count. If a brand grows to millions, switch to a cached counter. Not a v0 concern. |
| `OrgSizeCategory` legacy values leak into UI selectors via stale caches | Low | Server validates incoming `teamSize` against `zOrgSizeCategoryNew` (only the 5 new values + PREFER_NOT_TO_SAY); legacy values reject with 400. UI only renders new values. Defense-in-depth at both layers. |

## Alternatives considered

| Decision | Chosen | Alternative considered |
|---|---|---|
| Default-theme seeding | Per-brand seed at provisioning (4 rows) | Global stock + per-brand override (rejected for query / identity complexity) |
| Consent-text package placement | New `packages/consent-text` | Inside `@customereq/shared` (rejected for blast radius — DOM-adjacent code in worker bundles) |
| Migration strategy for OrgSizeCategory | Additive: ADD VALUE for 3 new values, keep 2 legacy values for compat, gate at app layer | Destructive: recreate enum + migrate column (rejected — needless complexity since no production rows hold the legacy values) |
| Redirect-on-org-create | Clerk `afterCreateOrganizationUrl` prop | Webhook (#239) — rejected as a dependency; remains additive optimization. Next.js middleware — rejected for hackiness. Client-side useEffect — rejected for round-trip cost. |
| API surface | One PATCH endpoint for the whole row | Per-section PATCH endpoints — rejected because the audit / validation logic duplicates and the section-vs-field boundary is a UI concern, not an API one. |
| Form state mgmt | React Hook Form + Zod resolver | Uncontrolled forms with manual state — rejected for inconsistency with the existing themes page pattern. |

## Architecture Analysis

Comparison of this RFC against `docs/architecture/architecture.md`. Pattern classification per the FRAIM technical-design phase 4 contract: **Correctly Followed** (architecture documents the pattern, RFC uses it correctly), **Missing from Architecture** (pattern used in RFC, not yet documented in architecture — candidate for an architecture-doc update during address-feedback), **Incorrectly Followed** (pattern documented but RFC violates it).

### Patterns Correctly Followed

| Pattern | Architecture reference | RFC use |
|---|---|---|
| Multi-tenant `brandId` from JWT only, never from request body | architecture §3.2 (`multiTenant` plugin) + §6 (Multi-Tenant Isolation) | §4 + §8 — all routes auth-gated; PATCH body has no `brandId`; rejected by `multiTenant` plugin if attempted |
| Append-only `AuditEvent` writes for mutations | architecture §3.2 (`audit` plugin onResponse) | §9 — three audit events (`brand.profile.updated`, `brand.consent.mode_changed_to_implied`, `brand.identifier_kind_changed`) |
| Zod 3.23 shared validation between API and frontend | architecture §2 + §3.5 | §4.2 + §6.3 — `zConsentText` exported from `packages/consent-text` consumed by both API PATCH validation and the frontend `pendingItems` computation |
| Prisma 5.13 migrations forward-only and idempotent | architecture §2 + the `IF NOT EXISTS`-guarded SQL pattern from #276 RFC | §2 — `ADD COLUMN IF NOT EXISTS`, `ADD VALUE IF NOT EXISTS`, `CREATE UNIQUE INDEX IF NOT EXISTS` |
| Fastify route module per resource (`apps/api/src/routes/<resource>.ts`) | architecture §3.2 + §4.1 | §4 — single `apps/api/src/routes/admin-brand-profile.ts` for all three endpoints |
| Standard CRUD admin pattern (list / new / view / edit) | architecture §3.1 (Issue #157) | §6.1 — Organization Settings is **not** standard CRUD (it's a singleton-resource page, not a list); the four-route layout is correctly **not** applied here. Settings page mirrors the existing `apps/web/src/app/(admin)/admin/settings/themes/page.tsx` + `webhooks/page.tsx` shape, which is the right reference. |
| `brandId` from JWT enforced by `multiTenant` plugin (R6 of project rules) | architecture §3.2 + repo project rule #6 | §8 — explicitly called out |

### Patterns Missing from Architecture

These are patterns the RFC introduces or relies on that are not yet documented in `docs/architecture/architecture.md`. Each is a candidate for an architecture-doc update during the `address-feedback` phase, pending user direction.

| Pattern | Why it's needed | Suggested architecture update |
|---|---|---|
| **Per-route audit metadata allowlist** | Architecture §3.2 says the audit plugin does "fire-and-forget logging of mutations to AuditEvent table" but doesn't document how route-specific metadata (e.g., `attestation`, `memberCountAtChange`, `changedFields`) gets into the row. #276 RFC introduced the per-route allowlist pattern (`audit.ts` config keyed by `{routeId}.metadata: [allowedKeys]`); this RFC reuses it (§9). | Add to architecture §4.2 audit-plugin row: "Per-route metadata allowlist via `<route-id>.metadata` config keys; route handlers populate `request.audit.metadata`; the plugin filters to the allowlist before persisting." |
| **Lazy-upsert provisioning at GET** | Architecture documents `multiTenant` rejection of body-supplied `brandId` and the existing webhook-driven provisioning at `/api/webhooks/identity-provider`, but doesn't document GET-side lazy-upsert as a pattern. #277 establishes it (§4.1) for the org-settings tenant-bootstrap flow. | Add to architecture §3.2: "**Lazy-upsert provisioning pattern:** GET endpoints that are the canonical landing target for newly-created tenants may upsert their tenant resource row keyed by JWT-extracted identifier (e.g. `clerkOrgId`). This is the redirect-target counterpart to the webhook-driven provisioning at `/api/webhooks/identity-provider` and survives webhook delivery failures. First seen in #277 (`GET /v1/admin/brand/profile`)." |
| **Shared cross-package validator/renderer module** | Architecture documents `packages/embed` and `packages/shared` but doesn't describe the pattern of "extract a narrowly-scoped reusable runtime module into its own package consumed by web + api." `packages/consent-text` (this RFC §3) is a third instance of the pattern. | Add to architecture §3 (Architectural Layers): a brief subsection naming the pattern (alongside `embed` and the `consent-text` package added by #277): "Domain-narrow runtime packages — single-purpose packages with parser / validator / renderer triplets that web and api both consume; kept out of `packages/shared` to avoid bundle bloat in the worker." |
| **React Hook Form + Zod resolver as the form-state convention** | Architecture §2 lists shadcn/ui + Tailwind v4 but doesn't name the form-state library. Existing #170 RFC + the existing `apps/web/src/app/(admin)/admin/settings/themes/page.tsx` use RHF + `@hookform/resolvers/zod`. This RFC §6.3 follows that convention. | Add a row to architecture §2 tech stack: "**Forms** | React Hook Form 7.x + `@hookform/resolvers/zod` | Standard for admin-portal forms — single source of truth for validation between API and frontend (Zod schemas reused). Per-section dirty state via RHF `formState.dirtyFields`." |
| **Clerk's `afterCreateOrganizationUrl` as the post-create landing mechanism** | Architecture mentions Clerk OrganizationSwitcher implicitly (via the `/api/webhooks/identity-provider` row in §4.1) but doesn't document the `afterCreateOrganizationUrl` redirect contract. #277 §7 makes this central to first-run UX. | Add to architecture §3.1 admin-portal subsection: "Post-create landing for new Clerk organizations is set via `<OrganizationSwitcher afterCreateOrganizationUrl="..." />` in the admin shell layout. The redirect target's first GET is the lazy-upsert site (§3.2 lazy-upsert pattern)." |

### Patterns Incorrectly Followed

None identified. The RFC follows established patterns; the gaps above are documentation gaps, not violations.

### Architecture-doc updates — gating

Per the FRAIM technical-design phase 4 contract: **no architecture document updates are made in this phase.** Updates land in the `address-feedback` phase, gated by user direction (e.g., "yes, codify the per-route audit allowlist in architecture.md" vs. "leave it in the RFC body for now"). The five gaps above are flagged here for that decision.

## Implementation breakdown

This is the input to the **implementation issue scoping** decision. The work breaks down as follows:

| Slice | Files | Approx LOC | Dependencies |
|---|---|---|---|
| **Slice 1: Schema migration** | `packages/database/prisma/schema.prisma` + 1 migration file | ~30 | None — can land first |
| **Slice 2: Shared package** | `packages/consent-text/*` (new package, 6 src files + tests) | ~250 | None — can land in parallel with Slice 1 |
| **Slice 3: Backend** | `apps/api/src/routes/admin-brand-profile.ts` + audit-plugin allowlist + integration tests | ~400 | Slices 1 + 2 |
| **Slice 4: Frontend** | `apps/web/src/app/(admin)/admin/settings/organization/*` + `apps/web/src/components/admin/AdminPendingBanner.tsx` + 1-prop layout edit + E2E tests | ~600 | Slice 3 |

**Recommendation: split into 4 implementation issues**, one per slice. Slices 1 + 2 land in parallel; Slice 3 unblocks once they're merged; Slice 4 unblocks once Slice 3 is merged. This preserves R10 (Branch + PR convention: one issue per branch) and lets reviewers focus on one concern per PR (schema, package, backend, frontend) instead of one ~1300-LOC bundle.

The alternative — single umbrella issue — keeps spec→implementation traceability tight in one PR but creates an unreviewable bundle. The 4-slice split has equally tight traceability (each implementation PR's title and body link back to #277) without the review-fatigue cost.

## Forward-looking notes

- **#239 (Clerk webhook)** lands additively; when it does, the webhook's `organization.created` handler also runs the same lazy-upsert SQL. The redirect-on-create flow keeps working unchanged.
- **#264 (GDPR erasure job)** — when filed, its scope explicitly excludes `Brand` rows (no member PII). The compliance section of the spec has the forward-looking AC.
- **#170 (onboarding epic)** — when broken down, its Step 1.5 wizard reuses the same `Brand.timezone`, `Brand.locale`, `Brand.teamSize` columns. No re-migration needed.
- **#44 (multi-brand-per-org)** — when filed, this page becomes the per-Brand settings page with a Brand picker added above the section list. The field set does not change.
- **Future Survey-creation simplification module** — imports `@customereq/consent-text` for live preview at survey-builder scope (R18). Cross-package import-graph check fails at PR time if the module duplicates the regex / validator.

## References

- Spec: [`docs/feature-specs/277-organization-settings.md`](../feature-specs/277-organization-settings.md)
- Mock: [`docs/feature-specs/mocks/277-organization-settings.html`](../feature-specs/mocks/277-organization-settings.html)
- Architecture: [`docs/architecture/architecture.md`](../architecture/architecture.md) — §3.2 API Layer, §4.2 Plugins, §6 Patterns
- Sibling RFC pattern: [`docs/rfcs/276-survey-level-consent-override.md`](./276-survey-level-consent-override.md) — established the per-route audit-allowlist pattern reused here
- Existing settings reference: `apps/web/src/app/(admin)/admin/settings/themes/page.tsx`, `apps/web/src/app/(admin)/admin/settings/webhooks/page.tsx`
- Brand schema: `packages/database/prisma/schema.prisma` (model `Brand`, enums `MemberIdentifierKind`, `ConsentMode`, `OrgSizeCategory`)
