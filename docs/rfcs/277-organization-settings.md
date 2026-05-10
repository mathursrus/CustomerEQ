# Feature: Organization Settings page — Technical Design

Issue: [#277](https://github.com/mathursrus/CustomerEQ/issues/277)
Spec: [`docs/feature-specs/277-organization-settings.md`](../feature-specs/277-organization-settings.md)
PR: [#290](https://github.com/mathursrus/CustomerEQ/pull/290) (spec + design ship together)
Implementation tracking: [#292](https://github.com/mathursrus/CustomerEQ/issues/292) (4 PR slices under one umbrella)
Depends on: [#291](https://github.com/mathursrus/CustomerEQ/issues/291) (`BrandTheme` model split — already merged; this RFC consumes the post-#291 schema directly. Theme *seeding* now lands in Slice 3 — see §5.)
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
- Backend: 2 endpoints under `/v1/admin/brand/profile/*` (`GET` + `PATCH`), one schema migration, one shared package (`@customereq/consent-text`). The originally-planned third endpoint, `POST /v1/admin/brand/logo` (multipart), is deferred to [#305](https://github.com/mathursrus/CustomerEQ/issues/305) per Q1 — see §4.3.
- Frontend: 1 admin page (`/admin/settings/organization`) + 1 shared admin component (`AdminPendingBanner`) + 1 `OrganizationSwitcher` prop change in the admin layout.
- Provisioning: lazy-upsert at GET, belt-and-suspenders at PATCH, redirect-on-org-create via Clerk's built-in prop.

**Out of scope** (per spec): the Clerk webhook (#239 — additive), the GDPR erasure job (#264 — already its own issue), multi-brand-per-org (#44), and the future Survey-creation simplification module (which consumes the package this RFC creates but is itself a separate epic).

## Technical Details

### 1. Schema changes (`packages/database/prisma/schema.prisma`)

**Already in the schema** (from #170 spec work + #231 implementation): `Brand.clerkOrgId`, `name`, `siteDomain`, `logoUrl`, `memberIdentifierKind`, `consentMode`, `consentTextDefault`, `privacyPolicyUrl`, `termsUrl`, `defaultThemeId`, `sizeCategory`. The columns exist; only the UI was missing.

**This RFC adds / changes:**

```prisma
// Reshaped enum — drop pre-#277 superseded values (SIZE_51_200, SIZE_201_PLUS) since
// no production rows hold them (no UI ever wrote to sizeCategory). Resulting set is
// the six buckets per spec F5: 1–10 / 11–50 / 51–300 / 301–5000 / 5000+ / Prefer not to say.
enum OrgSizeCategory {
  SIZE_1_10
  SIZE_11_50
  SIZE_51_300
  SIZE_301_5000
  SIZE_5000_PLUS
  PREFER_NOT_TO_SAY
}

model Brand {
  // ... existing fields unchanged ...

  // Issue #277 — column rename + 2 new columns.
  // Column physically renamed in the migration (sizeCategory → orgSize); no @map needed
  // post-migration because the Prisma field name matches the SQL column name.
  orgSize     OrgSizeCategory?                        // R24 — renamed from sizeCategory; matches schema element ("the organization's size") rather than the ambiguous "team"
  timezone    String           @default("UTC")        // R23 — IANA tz; resolved from browser hint at first save with UTC fallback
  locale      String           @default("en-US")      // R23 — BCP 47; resolved from navigator.language with en-US fallback
}
```

**Why drop the superseded enum values rather than keep them as deprecated:** PR #290 review (L45) directed removal — there is no production data, so the additive-keep-for-compat hedge buys nothing. A clean six-value enum reads correctly to anyone arriving at the schema later, and the type-recreate migration is one-time work bounded by the empty-data state. Postgres `ALTER TYPE … DROP VALUE` doesn't exist, so the migration uses the standard create-new-type-and-swap pattern (§2 below).

### 2. Schema migration

New migration: `packages/database/prisma/migrations/<TIMESTAMP>_org_settings_277/migration.sql`. Single migration, all changes additive or rename-only.

```sql
-- Issue #277 — Organization Settings schema additions.
-- All changes are forward-only. Safe under repeated `migrate deploy` because the
-- column-rename and enum-recreate steps are one-shot (Prisma migration framework
-- records them in `_prisma_migrations` and won't re-run). New columns use IF NOT EXISTS.

-- 1. Rename column sizeCategory → orgSize (no data loss; column is unindexed and unconstrained).
ALTER TABLE "brands" RENAME COLUMN "sizeCategory" TO "orgSize";

-- 2. Reshape OrgSizeCategory enum: drop pre-#277 superseded values (SIZE_51_200, SIZE_201_PLUS),
--    keep the six canonical buckets. Postgres lacks ALTER TYPE … DROP VALUE so this is
--    a create-new-type-and-swap migration. Safe because no production rows hold OrgSizeCategory
--    (UI never wrote to sizeCategory; pre-#277 column was always NULL).
ALTER TABLE "brands" ALTER COLUMN "orgSize" TYPE TEXT;
ALTER TYPE "OrgSizeCategory" RENAME TO "OrgSizeCategory_old";
CREATE TYPE "OrgSizeCategory" AS ENUM (
  'SIZE_1_10',
  'SIZE_11_50',
  'SIZE_51_300',
  'SIZE_301_5000',
  'SIZE_5000_PLUS',
  'PREFER_NOT_TO_SAY'
);
ALTER TABLE "brands"
  ALTER COLUMN "orgSize" TYPE "OrgSizeCategory" USING "orgSize"::"OrgSizeCategory";
DROP TYPE "OrgSizeCategory_old";

-- 3. Add new columns with safe defaults.
ALTER TABLE "brands"
  ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS "locale"   TEXT NOT NULL DEFAULT 'en-US';

-- (Default-theme seeding support — `survey_themes.isStockDefault` column and
--  `@@unique([brandId, name])` constraint — moved to #291's BrandTheme split RFC.
--  See §5 for rationale.)
```

No data backfill is needed — every existing Brand row gets `'UTC'` and `'en-US'` from the column default. The `orgSize` column is empty post-rename (no row ever held a value), so the enum-swap `USING` cast handles only NULL → NULL.

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

Two new endpoints (the third — multipart logo upload — is deferred to [#305](https://github.com/mathursrus/CustomerEQ/issues/305); see §4.3). Routes file: `apps/api/src/routes/admin-brand-profile.ts`. All routes auth-gated by the `auth` plugin (extracts `brandId` from JWT) and the `multiTenant` plugin (rejects body-supplied `brandId`). **Admin-role gate matches the existing `/v1/*` pattern: any authenticated user with a verified `brandId` is admin.** Slice 3 scoping verified that no per-route role check exists in `apps/api/src/routes` today; the original "auth-gated to admin role" framing was aspirational. Cross-cutting formal admin-role gate is filed as [#306](https://github.com/mathursrus/CustomerEQ/issues/306) (Q3 per PR #307); when it lands, every `/v1/*` admin route inherits it without per-route changes.

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
    orgSize: OrgSizeCategory | null       // R24
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
1. Fastify `auth` plugin verifies JWT. If `clerkOrgId` is present, the handler:
   - Calls `fastify.identityProvider.getOrg(clerkOrgId)` to fetch the organization name from the identity provider, so the seeded `Brand.name` matches the string the admin sees in the org-switcher chip on first paint. Best-effort: if the provider call fails (transient network, dev test bypass without `getOrg` wired up), fall back to a generic placeholder so first-run UX still completes — the admin can always rename `Brand.name` from the settings form.
   - Runs the upsert with that name + the seeded defaults + the four stock `BrandTheme` rows (R25):
   ```typescript
   let initialBrandName = 'Untitled Organization'
   try {
     const org = await fastify.identityProvider.getOrg(clerkOrgId)
     if (org?.name) initialBrandName = org.name
   } catch (err) {
     fastify.log.warn({ err, clerkOrgId }, 'identityProvider.getOrg failed; using default Brand.name')
   }

   const brand = await prisma.brand.upsert({
     where: { clerkOrgId },
     update: {},
     create: {
       clerkOrgId,
       name: initialBrandName,                            // PR #308 review: seeded from identity provider on first run; editable thereafter
       consentTextDefault: DEFAULT_CONSENT_TEXT,          // R21 — sensible default with {{privacy}} token
       timezone: req.headers['x-timezone-hint'] ?? 'UTC',
       locale:   req.headers['x-locale-hint']   ?? 'en-US',
       brandThemes: { createMany: { data: [...DEFAULT_THEMES] } },  // R25 — atomic with Brand creation; only fires on the create branch of upsert
     },
   })
   ```
2. After upsert, run the additional read paths in `Promise.all` (architecture pattern §6):
   - `prisma.brandTheme.findMany({ where: { brandId } })` — full theme list (now non-empty for first-run brands thanks to the nested seed in step 1)
   - `prisma.member.count({ where: { brandId } })` — for locked-state computation
   - `process.env.SUPPORT_EMAIL ?? 'support@customereq.wellnessatwork.me'` — env resolution
3. **First-run theme seeding** (R25) lands in the GET handler's lazy-upsert via the nested `brandThemes.createMany` shown above. Atomic with Brand creation, race-safe via the unique `clerkOrgId` constraint (the nested write only fires on the create branch). The `BrandTheme` model itself was introduced under [#291](https://github.com/mathursrus/CustomerEQ/issues/291); the seed *content* (Indigo / Forest / Sunset / Slate, with brand-vibe colors + an error-emphasis accent decoupled from the primary/secondary family) lives in `apps/api/src/lib/default-themes.ts`. See §5.
4. **The response intentionally returns `brand.name` (CustomerEQ Brand.name) only and does NOT carry the identity provider's organization name on subsequent reads.** Slice 4's frontend reads the identity-provider organization name directly from the auth library's session hook (already cached client-side) for the read-only Identity row. The first-run seed flows through `Brand.name` once via `getOrg` (step 1), but the steady-state read path stays single-source-of-truth on the Brand row. See §7a for the full Q2 reframe.

#### 4.2 `PATCH /v1/admin/brand/profile`

```typescript
// HttpsUrl — Q4 refinement (closes Slice 2 SLICE2-MED-1). Rejects javascript:/data:/mailto:
// schemes that would otherwise reach the React renderer's anchor href.
const HttpsUrl = z.string().url().refine(u => /^https?:/i.test(u), { message: 'must use http(s) scheme' })

const PatchBrandProfileBodySchema = z.object({
  name:                  z.string().trim().min(1).max(120).optional(),
  siteDomain:            z.string().regex(/^[a-z0-9.-]+$/).optional().nullable(),
  logoUrl:               HttpsUrl.optional().nullable(),               // Q1 — URL paste only in v0; #305 retrofits the upload endpoint
  orgSize:               zOrgSizeCategory.optional().nullable(),       // six canonical buckets (1–10 / 11–50 / 51–300 / 301–5000 / 5000+ / PREFER_NOT_TO_SAY)
  timezone:              z.string().regex(/^[A-Za-z_/+-]+$/).optional(),
  locale:                z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/).optional(),
  defaultThemeId:        z.string().cuid().optional().nullable(),
  memberIdentifierKind:  z.nativeEnum(MemberIdentifierKind).optional(),
  consentMode:           z.nativeEnum(ConsentMode).optional(),
  consentTextDefault:    zConsentText.optional().nullable(),           // imported from @customereq/consent-text
  privacyPolicyUrl:      HttpsUrl.optional().nullable(),               // Q4
  termsUrl:              HttpsUrl.optional().nullable(),               // Q4
  attestation:           z.object({                                     // required only when consentMode → IMPLIED_ON_SUBMIT
    justification: z.string().min(1).max(500),
    confirmed:     z.literal(true),
  }).optional(),
}).refine(
  body => !(body.consentMode === 'IMPLIED_ON_SUBMIT' && !body.attestation),
  { message: 'attestation required when switching to IMPLIED_ON_SUBMIT', path: ['attestation'] },
)
```

**Status-code conventions** (mirrors the existing `/v1/themes` route pattern — see `apps/api/src/routes/admin-brand-profile.ts` header comment):
- **422** — Zod validation failures (shape, type, regex, scheme refinement, `attestation`-required `.refine`, empty trimmed `name`, `consentTextDefault` outside the inner-string allowlist).
- **400** — cross-field business-rule failures (`consentMode = EXPLICIT` without a `{{privacy}}` token in `consentTextDefault`; body-supplied `brandId` rejected by the `multiTenant` plugin; generic 400 path).
- **409** — `MEMBER_IDENTIFIER_KIND_LOCKED` (identifier-kind change while `Member.count > 0`).
- **401** — no `brandId` resolvable for the session.

**Server-side cross-field validation** (in addition to Zod):
- `consentMode === 'EXPLICIT'` AND `consentTextDefault` lacks a `{{privacy}}` token → **400** (R19).
- `memberIdentifierKind` change AND `Member.count(brandId) > 0` → **409 `MEMBER_IDENTIFIER_KIND_LOCKED`** (R10) — short-circuits before any other validation so the client gets a precise error code.
- `orgSize` — enum reshape (§2) drops superseded values, so Zod accepts only the six canonical buckets and Postgres rejects anything else at the type-cast boundary; no app-layer legacy-value check needed.

**`name` writes are Prisma-only — no IdentityProvider sync.** A PATCH that includes `name` validates and persists to `Brand.name` and stops there. The route handler does not invoke `fastify.identityProvider.*`; the Clerk Organization name is a separate surface managed via the Clerk-hosted Manage flow (deep-linked from the `OrganizationSwitcher` per §7). See §7a for the full Q2 reframe and the integration-test contract that asserts zero IdentityProvider invocations.

**Audit-event payload** (per-route metadata allowlist, pattern from #276 RFC):
```typescript
// In apps/api/src/plugins/audit.ts config:
'admin-brand-profile.update.metadata': ['changedFields', 'before', 'after', 'attestation', 'memberCountAtChange']
```
- For an IMPLIED transition, `metadata.attestation = { admin, justification, attestedAt }` is included (R9).
- For an identifier-kind change, the route is rejected before audit fires; the data-ops migration pathway writes `metadata.memberCountAtChange` with `actor: 'data-ops'`.

#### 4.3 `POST /v1/admin/brand/logo` — **deferred to [#305](https://github.com/mathursrus/CustomerEQ/issues/305) (Q1 per PR #307)**

The earlier draft of this RFC scoped a multipart upload endpoint that wrote PNG / SVG / JPEG (≤2 MB, min 64×64) to "the existing asset path". Slice 3 scoping verified that there is no asset-storage backend, no `@fastify/multipart` dependency, and no upload endpoint anywhere in the repo today; the Survey Builder's `file_upload` question type is a UI stub that captures only `file.name` (`apps/web/src/app/survey/[id]/page.tsx:1015`). The endpoint, the storage-backend choice (Azure Blob recommended per the Production Secrets Policy), and the file-picker UX therefore move wholesale to **#305**.

In v0 (this RFC + Slices 3 + 4): PATCH `/v1/admin/brand/profile` accepts `logoUrl` as an `https://` URL string. Admins host their logo on their own CDN / asset bucket and paste the URL. When #305 ships, the `logoUrl` PATCH contract does not change — only the upstream UI path that produces the URL changes (a file picker writes through #305's upload endpoint, the URL is chained into the next PATCH).

### 5. Default-theme seeding — implemented in Slice 3 (revised from prior "deferred to #291" disposition)

**Decision: lazy-seed the four stock themes (Indigo / Forest / Sunset / Slate) inside the GET handler's lazy-upsert via a nested `brandThemes.createMany`. Seed *content* lives in `apps/api/src/lib/default-themes.ts`. The `BrandTheme` *model* was introduced by [#291](https://github.com/mathursrus/CustomerEQ/issues/291); the seed mechanism that #291's RFC deferred lands here.**

#### How it works (atomic, race-safe)

The nested write fires only on the `create` branch of the upsert — Prisma evaluates the `create:` block when the row didn't exist, never on the `update: {}` no-op. Together with the unique `clerkOrgId` constraint on `Brand`, this closes the race window for two simultaneous first GETs: whichever request wins the unique-constraint check creates both the Brand row and the four theme rows in one atomic write; the other observes the existing row and skips theme seeding entirely. No `@@unique([brandId, name])` constraint on `BrandTheme` is required — the dedup is structural via the parent.

```typescript
brandThemes: {
  createMany: { data: [...DEFAULT_THEMES] },  // four rows, one per stock theme
}
```

#### Seed content — what's in `default-themes.ts`

`DEFAULT_THEMES` defines four `BrandTheme` rows. Color decisions:

- **Primary + secondary** mirror the swatches shown in the spec mock (`docs/feature-specs/mocks/277-organization-settings.html`).
- **Background** stays white (`#ffffff`) for all four; **text** stays dark (`#111827`, or `#0f172a` for Slate).
- **Button** = primary; **buttonText** = white.
- **Accent** is intentionally **NOT** in the same hue family as primary/secondary — accent is used to emphasize error / warning text and must contrast cleanly with body copy on a white background. Indigo / Forest / Slate use red-700 (`#b91c1c`); Sunset uses rose-700 (`#be123c`) so the accent doesn't clash with the warm orange primary. All four pass WCAG AAA on white.
- **Typography + layout fields** (`fontFamily`, `headingSize`, `bodySize`, `cardStyle`, `borderRadius`, `maxWidth`, `backgroundImageUrl`) are omitted from the constant — `BrandTheme` schema defaults apply, with no per-theme variation in v0.

#### Swatches projection in the GET response

`themes: Array<{ id, name, isDefault, swatches }>` — `swatches` is a `[primaryColor, secondaryColor, backgroundColor]` triple, **not** `[primary, secondary, accent]`. Accent is the error-emphasis hue and would mislead admins into reading it as part of the brand vibe on the picker chip strip. Schema defaults are unchanged.

#### Why this no longer blocks Slice 4 on a separate seed mechanism

The earlier draft of this section deferred the seed mechanism to #291's RFC. #291 shipped only the model split (no seeding), which left R25 ("all four pickable from first paint") aspirational at the design layer. PR #307 closes the gap by landing the seed at the natural integration point — the same lazy-upsert that already creates the Brand row. Slice 4 is no longer blocked on a separate seed PR; it consumes the populated `themes` array directly.

The earlier alternatives (per-brand seed at provisioning, global-shared stock themes, hybrid) are documented in the *Alternatives considered* table at the end of this RFC; the chosen path here is "per-brand at lazy-upsert", which avoids cross-tenant coupling and tracks per-brand customizations without surprising admins who edit a stock theme.

### 6. Frontend page architecture

#### 6.1 Routes

```
apps/web/src/app/(admin)/admin/settings/organization/
  page.tsx                  // RSC entry, fetches GET /v1/admin/brand/profile server-side, hydrates client form
  components/
    OrganizationSettingsForm.tsx     // top-level form (RHF), composes 6 sections
    sections/
      IdentitySection.tsx            // R8 — read-only Clerk org name (from useOrganization()) + editable Brand name + logo + siteDomain + orgSize
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

The admin layout at `apps/web/src/app/(admin)/layout.tsx` currently has (line 56):
```tsx
<OrganizationSwitcher
  hidePersonal
  afterSelectOrganizationUrl="/admin/members"
  appearance={...}
/>
```

The `afterSelectOrganizationUrl="/admin/members"` prop pre-dates #277. Per Clerk's docs, it sets *"the full URL or path to navigate to after a successful Organization switch"* — i.e., when a returning admin uses the dropdown to switch between orgs, Clerk drops them on `/admin/members` (the existing admin home). #277 leaves this prop unchanged; new admins land on `/admin/settings/organization` via the new `afterCreateOrganizationUrl` prop, returning admins continue to land on `/admin/members` per existing behavior.

Three changes for #277:
```tsx
<OrganizationSwitcher
  hidePersonal
  afterCreateOrganizationUrl="/admin/settings/organization"   // R26 — post-create landing for new orgs (NEW in #277)
  afterSelectOrganizationUrl="/admin/members"                 // existing — unchanged; returning-admin landing
  organizationProfileMode="redirect"                          // R6 — opt out of Clerk-hosted org profile (NEW)
  organizationProfileUrl="/admin/settings/organization"       // R6 — "Manage" link deep-links to our settings page (NEW)
  appearance={...}
/>
```

That is the entire redirect / Manage-link implementation. No webhook, no middleware, no race conditions — Clerk handles the redirect client-side after its create-org flow completes, and the redirect target's first GET runs the lazy-upsert (§4.1). The `organizationProfileMode="redirect"` opt-out tells Clerk not to render its hosted org-profile modal; the `organizationProfileUrl` tells Clerk where to send the admin instead.

**Verifying artifact for `afterCreateOrganizationUrl`:** Clerk's official component reference ([clerk.com/docs/react/reference/components/organization/organization-switcher](https://clerk.com/docs/react/reference/components/organization/organization-switcher)) describes the prop verbatim as *"The full URL or path to navigate to after creating a new Organization."* PR #290 review (L495) flagged this as a row needing a spike before adoption; the documentation re-read + a codebase grep (apps/web has zero existing `afterCreateOrganizationUrl` usage to conflict with) clears the spike. End-to-end browser validation is owned by #292 Slice 4's E2E tests.

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

### 7a. Organization name vs Brand name — Q2 reframe (R8)

**Decision: PATCH writes `Brand.name` only. No IdentityProvider call. The Clerk Organization name and the CustomerEQ Brand name are intentionally decoupled, and the Identity section renders both — the Clerk name read-only at the top, the Brand name editable below.** Implemented in [PR #307](https://github.com/mathursrus/CustomerEQ/pull/307) (Slice 3); `apps/api/src/routes/admin-brand-profile.ts` makes zero `fastify.identityProvider.*` calls, and the integration test at `apps/api/test/integration/admin-brand-profile.test.ts` ("does NOT invoke IdentityProvider.updateOrgName on Brand.name change (Q2 binding)") asserts the contract.

**Why the prior write-through draft was scoped out (during #292 Slice 3 implementation):**

The earlier draft of this section routed `Brand.name` saves through `fastify.identityProvider.updateOrgName({ orgId, newName })` — DB-first, then a best-effort provider call with retry-via-event-pipeline if the provider failed. Three problems surfaced when actually implementing it:

1. **Conceptual conflation.** The Clerk Organization is the legal/auth boundary; the CustomerEQ Brand is the customer-facing display surface. Coupling them via auto-sync forces them into lockstep when the actual product use case wants them divergent — the legal entity ("Acme Inc.") and the consumer brand ("Acme Coffee Roasters") are routinely different strings. A sync model means every Brand-name edit silently overwrites the Clerk chip every admin sees, which is the opposite of what most renames want.
2. **Footgun on retry semantics.** The "best-effort with retry-on-fail" model introduces a `syncing-with-identity-provider` UI state that has to be surfaced for every Brand-name save and reasoned about for every reader of the audit trail (was the Clerk side updated yet?). The state space adds work without delivering value — admins who actually want to rename their Clerk org should do it through the Clerk-hosted flow, where Clerk's own validation/permission/audit chain is the single source of truth for that side.
3. **No load-bearing consumer.** Audit of consumers of `Brand.name` (member portal header, survey embed brand line, email sender display, embed snippet, consent text rendering): none of them read the Clerk Organization name. The Clerk org name surfaces in exactly one place that admins see — the `OrganizationSwitcher` chip in the admin nav — and it is sourced from the Clerk session, not from `Brand.name`. Syncing the two makes the chip mirror the Brand name, which is information overload, not value.

**Replacement contract (Slice 3 + Slice 4):**

- `PATCH /v1/admin/brand/profile` body MAY include `name`; the handler validates (≥1 char trimmed, ≤120 chars) and persists to Prisma only. Zero IdentityProvider calls (verified by an integration test).
- The Identity section renders **two name rows**: a read-only Organization name row at the top (sourced from `useOrganization().organization.name` on the client), and the editable Brand name input below it. The read-only row's helper directs the admin to the `OrganizationSwitcher` → **Manage** flow if they want to rename their Clerk org.
- The `OrganizationSwitcher`'s `organizationProfileMode="redirect"` + `organizationProfileUrl="/admin/settings/organization"` props (§7) deep-link the **Manage** action to this same settings page so admins land somewhere productive, but the Clerk-hosted org-profile UI for renames is the rename surface — accessed via Clerk's own UI affordances inside the switcher dropdown.
- No retry queue, no syncing badge, no event-pipeline entry for IdentityProvider writes from this route. The `enqueueIdentityProviderRetry` helper referenced by the prior draft is not introduced by #277.

**What this changes for the architecture-doc commitment in §11 below:** the *IdentityProvider boundary* pattern from architecture §4.2 / ADR 0004 is unaffected — no direct `@clerk/*` imports in route handlers is still the rule. This RFC simply does not exercise the boundary because no Clerk-side write is needed. The pattern remains in force for any future route that does need to write to the identity provider (e.g., user invites, future SCIM provisioning).

**Webhook + Manage redirect — unchanged (split out from prior table):**

The four-row alternatives table from the earlier draft of this section evaluated mechanisms for the **redirect-on-create** problem and the **Manage-link deep-link** problem (R6, R26). Those decisions and their rationale are unchanged and live in §7 above (`afterCreateOrganizationUrl`, `organizationProfileMode="redirect"`, `organizationProfileUrl`). The Clerk webhook (#239) remains valuable for background-flow provisioning (a CLI hitting `/v1/members/enroll` before any admin has visited the web app) but is not a #277 dependency.

### 8. Authorization & validation summary

| Concern | Mechanism |
|---|---|
| `brandId` from JWT only | `multiTenant` plugin (existing) — rejects `brandId` in body. |
| Admin-role gate | Matches the existing `/v1/*` pattern — any authenticated user with a verified `brandId` is admin. Cross-cutting formal gate tracked in [#306](https://github.com/mathursrus/CustomerEQ/issues/306) (Q3 per PR #307). |
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
- PATCH without a verified `brandId` returns **401**. (No separate "non-admin → 403" assertion in v0; admin-role gating matches the existing `/v1/*` pattern per Q3 — see §8 + cross-cutting follow-up [#306](https://github.com/mathursrus/CustomerEQ/issues/306).)
- PATCH rejects `privacyPolicyUrl` / `termsUrl` / `logoUrl` with non-http(s) schemes → **422** (Q4 — closes Slice 2 SLICE2-MED-1).
- PATCH writing IMPLIED without attestation → **422** (Zod `.refine`).
- PATCH identifier-kind change with `Member.count > 0` → 409 `MEMBER_IDENTIFIER_KIND_LOCKED`.
- PATCH consent text with token outside allowlist → **422** (Zod regex / inner-string allowlist).
- PATCH EXPLICIT save without `{{privacy}}` token → **400** (cross-field business rule — checked after Zod passes).

### E2E tests (Playwright)

`apps/web/test/e2e/admin-organization-settings.spec.ts` — 12 scenarios from spec § Validation Plan, items 1–12. The path matches the apps/web Playwright config (`apps/web/playwright.config.ts` `testDir: './test/e2e'`); the prior repo-root `tests/e2e/` referenced in earlier drafts has no Playwright wiring — the workspace boundary is that each app owns its UI E2E. Existing apps/web E2E specs (e.g. `themes-crud-pattern.spec.ts`, `admin-nav-scrollable.spec.ts`) use `PLAYWRIGHT_TEST=true` middleware-bypass + `page.route()` to mock `**/clerk.**` and `**/v1/**`; Slice 4's spec follows the same pattern.

### Compliance tests

- Integration test: AuditEvent for IMPLIED transition contains full `metadata.attestation`.
- Snapshot test: rendered consent UI on the embedded survey form for an EXPLICIT brand contains exact text + working `{{privacy}}` link + zero `<script>`-equivalent injection.
- Cross-package import-graph check (script in `tools/check-consent-text-imports.ts`): asserts that brand-level + #276 survey-level + (when shipped) Survey-creation simplification module all import from `@customereq/consent-text`. Forward-looking on the third consumer; CI step gates on this.

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Postgres enum recreate (drop superseded values) breaks an existing dependent query plan | Low | The `OrgSizeCategory` column is unindexed and unconstrained; the type-swap pattern (cast to TEXT, recreate type, cast back) is standard. Migration tested in dev compose first; integration tests in #292 Slice 1 verify the post-migration enum shape. |
| Clerk's `afterCreateOrganizationUrl` prop is not honored on every Clerk plan / configuration | Low | Documented Clerk feature ([reference](https://clerk.com/docs/react/reference/components/organization/organization-switcher)). Pre-flight: an E2E Playwright test in #292 Slice 4 drives the OrganizationSwitcher create flow and asserts the redirect target. If Clerk changes the prop name, it's caught at PR time. |
| Default-theme seed creates duplicate rows on simultaneous first GETs | Low | Nested `brandThemes.createMany` only fires on the `create` branch of `prisma.brand.upsert`; the unique `clerkOrgId` constraint on `Brand` serializes parallel first-GETs so only one wins the create branch. The other observes the row and skips seeding. No application-level deduplication needed. |
| `@customereq/consent-text` placement choice locks in import surface for #276 + future module | Medium | The package can be moved later (`@customereq/shared/consent-text` is a renaming, not a redesign). Choosing `packages/consent-text` is the lowest-friction starting point; moving is cheap. |
| Member-count query on every GET — could be slow on large brands | Low | `prisma.member.count({ where: { brandId } })` uses the existing `(brandId)` index; sub-millisecond at any reasonable member count. If a brand grows to millions, switch to a cached counter. Not a v0 concern. |
| Admins miss that "Brand name" doesn't rename their Clerk org (Q2 reframe — §7a) | Medium | The Identity section renders the Clerk Organization name as a clearly-labelled read-only row at the top with helper copy ("Managed in your identity provider. To rename, click your organization in the top-left switcher and choose Manage."). The editable Brand name field's helper explicitly calls out the decoupling ("How your organization appears to your customers — independent of your identity-provider organization name."). E2E test #6 asserts both rows render with the right semantics on first paint. If admin confusion surfaces in usage telemetry post-launch, the next iteration is a one-time inline tooltip on first edit, not a re-coupling of the two surfaces. |

## Alternatives considered

| Decision | Chosen | Alternative considered |
|---|---|---|
| Default-theme seeding | Lazy-seed at first GET, atomically with the Brand row, via nested `brandThemes.createMany` inside `prisma.brand.upsert`'s `create` block (§5). Seed content in `apps/api/src/lib/default-themes.ts`. | (a) Defer to #291 entirely — rejected because #291 shipped only the model split, leaving R25 unmet at the design layer (PR #308 review). (b) Migration-time INSERTs — rejected because new brands created post-migration would still need a runtime hook. (c) Global stock-themes table + clone-on-pick — rejected as overkill for v0; per-brand seed covers the use case and admins can edit any stock theme without cross-tenant coupling. |
| Brand name vs Clerk Organization name | Two decoupled surfaces — read-only Clerk org name + editable `Brand.name`; PATCH writes Brand only ([§7a](#7a-organization-name-vs-brand-name--q2-reframe-r8); PR #307 Q2 reframe) | (a) IdentityProvider write-through with retry queue — the prior draft of this RFC; rejected during Slice 3 implementation because no consumer reads Clerk's org name and the sync model creates a footgun. (b) Hide the Clerk org name from the settings page entirely — rejected because admins lose the connection between the OrganizationSwitcher chip they see and the page they're configuring. |
| Consent-text package placement | New `packages/consent-text` | Inside `@customereq/shared` (rejected for blast radius — DOM-adjacent code in worker bundles) |
| Migration strategy for OrgSizeCategory | Recreate enum (drop 2 superseded values, keep 6 canonical buckets) — see §2 | Additive ADD VALUE keeping legacy values (rejected per PR #290 L45 — no data, additive hedge buys nothing) |
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
| Fastify route module per resource (`apps/api/src/routes/<resource>.ts`) | architecture §3.2 + §4.1 | §4 — single `apps/api/src/routes/admin-brand-profile.ts` for the v0 endpoints (`GET` + `PATCH`); multipart logo endpoint deferred to #305 per §4.3 |
| Standard CRUD admin pattern (list / new / view / edit) | architecture §3.1 (Issue #157) | §6.1 — Organization Settings is **not** standard CRUD (it's a singleton-resource page, not a list); the four-route layout is correctly **not** applied here. Settings page mirrors the existing `apps/web/src/app/(admin)/admin/settings/themes/page.tsx` + `webhooks/page.tsx` shape, which is the right reference. |
| `brandId` from JWT enforced by `multiTenant` plugin (R6 of project rules) | architecture §3.2 + repo project rule #6 | §8 — explicitly called out |

### Patterns Missing from Architecture

These are patterns the RFC introduces or relies on that are not yet documented in `docs/architecture/architecture.md`. PR #290 review resolved direction on each row; the **Status** column reflects the resolution and the architecture-doc updates land in the same commit as this RFC revision.

| Pattern | Why it's needed | Architecture update | Status (PR #290 review) |
|---|---|---|---|
| **Per-route audit metadata allowlist** | Architecture §3.2 says the audit plugin does "fire-and-forget logging of mutations to AuditEvent table" but doesn't document how route-specific metadata (e.g., `attestation`, `memberCountAtChange`, `changedFields`) gets into the row. #276 RFC introduced the per-route allowlist pattern (`audit.ts` config keyed by `{routeId}.metadata: [allowedKeys]`); this RFC reuses it (§9). | Add to architecture §4.2 audit-plugin row: "Per-route metadata allowlist via `<route-id>.metadata` config keys; route handlers populate `request.audit.metadata`; the plugin filters to the allowlist before persisting." | **Agreed** — applied (L491). |
| **Lazy-upsert provisioning at GET** | Architecture documents `multiTenant` rejection of body-supplied `brandId` and the existing webhook-driven provisioning at `/api/webhooks/identity-provider`, but doesn't document GET-side lazy-upsert as a pattern. #277 establishes it (§4.1) for the org-settings tenant-bootstrap flow. | Add to architecture §3.2: "**Lazy-upsert provisioning pattern:** GET endpoints that are the canonical landing target for newly-created tenants may upsert their tenant resource row keyed by JWT-extracted identifier (e.g. `clerkOrgId`). This is the redirect-target counterpart to the webhook-driven provisioning at `/api/webhooks/identity-provider` and survives webhook delivery failures. First seen in #277 (`GET /v1/admin/brand/profile`)." | **Agreed** — applied (L492). |
| **Shared cross-package validator/renderer module** | Architecture documents `packages/embed` and `packages/shared` but doesn't describe the pattern of "extract a narrowly-scoped reusable runtime module into its own package consumed by web + api." `packages/consent-text` (this RFC §3) is a third instance of the pattern. | Add to architecture §3 (Architectural Layers): a brief subsection naming the pattern (alongside `embed` and the `consent-text` package added by #277): "Domain-narrow runtime packages — single-purpose packages with parser / validator / renderer triplets that web and api both consume; kept out of `packages/shared` to avoid bundle bloat in the worker." | **Agreed** — applied (L493). |
| **React Hook Form + Zod resolver as the form-state convention** | Architecture §2 lists shadcn/ui + Tailwind v4 but doesn't name the form-state library. Existing #170 RFC + the existing `apps/web/src/app/(admin)/admin/settings/themes/page.tsx` use RHF + `@hookform/resolvers/zod`. This RFC §6.3 follows that convention. | Add a row to architecture §2 tech stack: "**Forms** | React Hook Form 7.x + `@hookform/resolvers/zod` | Standard for admin-portal forms — single source of truth for validation between API and frontend (Zod schemas reused). Per-section dirty state via RHF `formState.dirtyFields`." | **No reviewer objection** — applied (L494; assumed agreed by silence on this row). |
| **Clerk's `afterCreateOrganizationUrl` as the post-create landing mechanism** | Architecture mentions Clerk OrganizationSwitcher implicitly (via the `/api/webhooks/identity-provider` row in §4.1) but doesn't document the `afterCreateOrganizationUrl` redirect contract. #277 §7 makes this central to first-run UX. | Add to architecture §3.1 admin-portal subsection: "Post-create landing for new Clerk organizations is set via `<OrganizationSwitcher afterCreateOrganizationUrl="..." />` in the admin shell layout. The redirect target's first GET is the lazy-upsert site (§3.2 lazy-upsert pattern)." | **Spike-then-apply** — Clerk docs verify `afterCreateOrganizationUrl` semantics ([reference link](https://clerk.com/docs/react/reference/components/organization/organization-switcher)); apps/web grep finds zero existing usage; documentation-verified (L495). Applied. |

### Patterns Incorrectly Followed

None identified. The RFC follows established patterns; the gaps above are documentation gaps, not violations.

### Architecture-doc updates — applied

PR #290 review resolved all five rows above (4 agreed, 1 spike-cleared, 1 silent-as-agreed). The architecture-doc edits land in the same commit as this RFC revision (`docs/architecture/architecture.md`) — see commit message for the per-row update map. No further gating needed.

## Implementation breakdown

This is the input to the **implementation issue scoping** decision. The work breaks down as follows:

| Slice | Files | Approx LOC | Dependencies |
|---|---|---|---|
| **Slice 1: Schema migration** | `packages/database/prisma/schema.prisma` + 1 migration file | ~30 | None — can land first |
| **Slice 2: Shared package** | `packages/consent-text/*` (new package, 6 src files + tests) | ~250 | None — can land in parallel with Slice 1 |
| **Slice 3: Backend** | `apps/api/src/routes/admin-brand-profile.ts` + audit-plugin allowlist + integration tests | ~400 | Slices 1 + 2 |
| **Slice 4: Frontend** | `apps/web/src/app/(admin)/admin/settings/organization/*` + `apps/web/src/components/admin/AdminPendingBanner.tsx` + 1-prop layout edit + E2E tests | ~600 | Slice 3 (#291's `BrandTheme` model is already on main; theme seeding now lands in Slice 3 — see §5) |

**Decision: 4 PRs / 4 branches under a single implementation issue ([#292](https://github.com/mathursrus/CustomerEQ/issues/292)).** PR #290 review (L516) directed away from 4 separate top-level implementation issues to avoid traceability fragmentation. The umbrella-issue pattern preserves R10 (every branch tied to an issue) while keeping spec → implementation traceability in one place: each branch is named `feature/issue-292-org-settings-<slice>`, the first three PRs use "Refs #292" in the body, and Slice 4 uses "Closes #292."

The alternative — one mega-PR — was rejected as an unreviewable bundle (~1300 LOC, four distinct concerns: schema, package, backend, frontend). The 4-slice split keeps each PR focused on one concern and lets Slices 1 + 2 land in parallel.

## Forward-looking notes

- **#239 (Clerk webhook)** lands additively; when it does, the webhook's `organization.created` handler also runs the same lazy-upsert SQL. The redirect-on-create flow keeps working unchanged.
- **#264 (GDPR erasure job)** — when filed, its scope explicitly excludes `Brand` rows (no member PII). The compliance section of the spec has the forward-looking AC.
- **#170 (onboarding epic)** — when broken down, its Step 1.5 wizard reuses the same `Brand.timezone`, `Brand.locale`, `Brand.orgSize` columns. No re-migration needed.
- **#44 (multi-brand-per-org)** — when filed, this page becomes the per-Brand settings page with a Brand picker added above the section list. The field set does not change.
- **Future Survey-creation simplification module** — imports `@customereq/consent-text` for live preview at survey-builder scope (R18). Cross-package import-graph check fails at PR time if the module duplicates the regex / validator.

## References

- Spec: [`docs/feature-specs/277-organization-settings.md`](../feature-specs/277-organization-settings.md)
- Mock: [`docs/feature-specs/mocks/277-organization-settings.html`](../feature-specs/mocks/277-organization-settings.html)
- Architecture: [`docs/architecture/architecture.md`](../architecture/architecture.md) — §3.2 API Layer, §4.2 Plugins, §6 Patterns
- Sibling RFC pattern: [`docs/rfcs/276-survey-level-consent-override.md`](./276-survey-level-consent-override.md) — established the per-route audit-allowlist pattern reused here
- Existing settings reference: `apps/web/src/app/(admin)/admin/settings/themes/page.tsx`, `apps/web/src/app/(admin)/admin/settings/webhooks/page.tsx`
- Brand schema: `packages/database/prisma/schema.prisma` (model `Brand`, enums `MemberIdentifierKind`, `ConsentMode`, `OrgSizeCategory`)
