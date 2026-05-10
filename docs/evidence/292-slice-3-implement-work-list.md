# Issue #292 — Slice 3 of 4: Backend (admin-brand-profile)

Branch: `feature/issue-292-org-settings-api`
Job ID: `issue-292-slice-3` (FRAIM `feature-implementation`)
RFC §: 4 (API design), 7a (IdentityProvider write-through), 9 (Audit-event coverage)
Spec §: F1–F12, R6 (multi-tenant), R8 (shared test utils), R11a (tests fail-loud), R18 (consent-text imports)
Prereq slices on main: #299 (Slice 1, schema), #300 (Slice 2, `@customerEQ/consent-text`)
PR target: `Refs #292` (does not close umbrella; Slice 4 closes)

---

## Scope

### In scope (this slice)

1. New route file `apps/api/src/routes/admin-brand-profile.ts`:
   - `GET /v1/admin/brand/profile` — lazy-upsert + decorated response (themes, memberCount, supportEmail).
   - `PATCH /v1/admin/brand/profile` — Zod-validated edits + cross-field validation + IdentityProvider write-through on `name` change + audit-event metadata.
2. Audit-plugin extension (`apps/api/src/plugins/audit.ts`):
   - Add per-route metadata-allowlist pattern (introduces `request.audit.metadata` decoration; allowlist filters it before persist).
   - Allowlist row for `admin-brand-profile.update`.
3. Register the new route in `apps/api/src/app.ts`.
4. Add `DEFAULT_CONSENT_TEXT` constant (with `{{privacy}}` token) for lazy-upsert seeding.
5. Integration tests at `apps/api/test/integration/admin-brand-profile.test.ts` (per RFC Validation Plan, post Q1–Q5 resolution):
   - GET lazy-upsert + idempotency + response shape (themes/memberCount/supportEmail keys present).
   - PATCH 400 on `brandId` in body (R6 multiTenant plugin).
   - PATCH 400 on Zod validation failure (incl. URL-scheme refinement Q4 — `javascript:` / `data:` / `mailto:` rejected).
   - PATCH 400 IMPLIED transition without `attestation`.
   - PATCH 409 `MEMBER_IDENTIFIER_KIND_LOCKED` when `Member.count > 0` and identifier-kind change.
   - PATCH 400 EXPLICIT save without `{{privacy}}` token in `consentTextDefault`.
   - PATCH success → AuditEvent row written with allowlisted metadata (`changedFields`, `before`, `after`, `attestation`).
   - PATCH `name` writes Brand.name only — **assert IdentityProvider is NOT invoked** (Q2 binding: no sync, ownership split).
6. Unit tests for the new audit-allowlist filter (`apps/api/src/plugins/audit.test.ts` extension).

### Out of scope (deferred)

| Item | Why deferred | Where it lands |
|---|---|---|
| Frontend page `/admin/settings/organization` | Slice 4 owns UI | Slice 4 of #292 |
| `BrandTheme`-shaped Look & Feel response detail | Already on main from #291 — GET handler reads `prisma.brandTheme.findMany` directly | (no work) |
| `POST /v1/admin/brand/logo` (multipart) | **Verified aspirational.** No `@fastify/multipart` dep; Survey Builder's `file_upload` question type is a UI stub that captures only `file.name` (`apps/web/src/app/survey/[id]/page.tsx:1015`); no asset-storage backend, no upload endpoint anywhere in the repo. | **Decision Q1 below** — recommend file follow-up issue and defer |
| `enqueueIdentityProviderRetry` queue + worker job | **Verified aspirational.** RFC §7a referenced this BullMQ queue; zero matches across `apps/api/src` and `packages/shared/src`. The synchronous `IdentityProvider.updateOrgName` exists (clerk-identity-provider.ts:223, tested at clerk-identity-provider.test.ts:482) and can be invoked best-effort post-DB-commit | **Decision Q2 below** |
| Default-theme seeding at first GET | Owned by #291 (already merged); GET handler trusts whatever themes exist | (no work) |
| Formal admin-role gate | **Verified aspirational.** RFC §8 references "existing pattern" but no per-route role check exists in `apps/api/src/routes`. All `/v1/themes`, `/v1/developer`, `/v1/apiKeys` treat any authenticated user with a `brandId` as admin (de-facto pattern). | **Decision Q3 below** — recommend match existing pattern, file follow-up |
| Per-route audit metadata allowlist | **Code aspirational, doc-vs-code drift.** `apps/api/src/plugins/audit.ts` has zero allowlist logic (only logs method+path+statusCode). `docs/architecture/architecture.md:212` documents the pattern *as applied* for #276 + #277 — the doc landed without the code. This slice introduces the code; the doc is already accurate at L212. | In scope — net-new code work, doc unchanged |
| `SUPPORT_EMAIL` env var | **Verified aspirational.** RFC §4.1 references `process.env.SUPPORT_EMAIL`; zero matches across `apps/api/src`. Slice 3 introduces it with the literal fallback `'support@customereq.com'`. | In scope — single env-var addition |

---

## Files to add / modify

| Path | Action | Notes |
|---|---|---|
| `apps/api/src/routes/admin-brand-profile.ts` | **add** | GET + PATCH; ~250 LOC |
| `apps/api/src/plugins/auth.ts` | **modify** | Add new route config flag `lazyUpsertBrand: true` (mirrors existing `allowNoOrg: true` precedent at L123). When set: surface `request.clerkOrgId = session.orgId`, surface `request.clerkUserId`, **do not 401** on missing brand. Test-mode bypass also reads `X-Test-Clerk-Org-Id` header. ~15 LOC delta. Plus declaring `clerkOrgId: string \| undefined` on `FastifyRequest`. **Why net-new**: current auth plugin rejects 401 when no brand exists for the clerkOrgId (L154–158); RFC §4.1's lazy-upsert can't run without this flag because the auth plugin never reaches the handler. |
| `apps/api/src/plugins/auth.test.ts` | **modify** | Unit test for the new `lazyUpsertBrand: true` config; ~30 LOC delta |
| `apps/api/src/plugins/audit.ts` | **modify** | Add `request.audit.metadata` decoration + per-route allowlist filter; ~50 LOC delta |
| `apps/api/src/plugins/audit.test.ts` | **modify** | Unit tests for the allowlist filter; ~60 LOC delta |
| `apps/api/src/app.ts` | **modify** | One import + one `register(...)`; ~2 LOC delta |
| `apps/api/src/lib/consent.ts` | **add** | `DEFAULT_CONSENT_TEXT` constant only; ~10 LOC |
| `apps/api/test/integration/admin-brand-profile.test.ts` | **add** | Integration tests; ~400 LOC |
| `docs/evidence/292-slice-3-implement-work-list.md` | **add** (this file) | Standing work list |
| `docs/evidence/292-slice-3-feature-implementation-evidence.md` | add later | Per-phase evidence (validate, security, regression, quality, completeness) |
| `docs/evidence/292-slice-3-feature-implementation-feedback.md` | add later | Quality-feedback findings |

**Approx total:** ~700 LOC across 7 files (umbrella issue estimate was ~400; the gap is the audit-plugin extension + integration tests, which were under-counted there).

**Phase-Splitting check:** 6 file modifications × 1 logical change each = under the 15-file threshold for splitting. Single PR is the right size.

---

## Decisions — RESOLVED (2026-05-07)

User answered the four open decisions. Resolutions are binding for Slice 3 implementation; sub-issues filed where deferral was chosen.

### Q1 — POST /v1/admin/brand/logo: **DEFER**

Filed as **[#305 — Logo upload — multipart endpoint + storage-backend decision](https://github.com/mathursrus/CustomerEQ/issues/305)**. Slice 3 keeps PATCH `/profile` accepting `logoUrl` as `z.string().url()` — admins paste a hosted URL today; #305 retrofits the file-picker UX in Slice 4 once it ships. Storage-backend choice (Azure Blob recommended per Production Secrets Policy) is part of #305's design.

### Q2 — Brand.name editing + IdentityProvider sync: **SKIP SYNC + UI SPLITS THE FIELDS** (user reframe — reversal of original recommendation)

Implementation:
- **Slice 3 (this slice):** PATCH `/profile` keeps `name` editable as `Brand.name` only. Zero IdentityProvider calls. No sync. No retry queue. The integration test for "name change → IdentityProvider invoked" is dropped from the test plan.
- **Slice 4 (UI, binding decision carried forward):** Show two distinct fields in the Identity section:
  - **Organization Name** — read-only, sourced from Clerk session / org context. Helper text: "Edit your organization name in Clerk." Links out to the Clerk OrganizationSwitcher's Manage modal (or its `organizationProfileUrl` deep-link).
  - **Brand Name** — separately editable, maps to `Brand.name`. Helper text: "Used on customer-facing surfaces — emails, surveys, member portals."
- **Spec/RFC follow-on (low priority):** the spec §F1 "Organization name" should be split into "Organization Name (Clerk, read-only)" + "Brand Name (CustomerEQ, editable)". Bundle into Slice 4's spec-update commit, not its own issue.

**Rationale (user's words):** *"This will keep it visible to the user as two different entries in system - and more importantly not set false expectation for the admin in case of failure. Organization name can be changed today from the Clerk UI, we will keep it that way."* Captures explicit one-way ownership rather than best-effort sync that can fail. Removes the partial-failure UX surface entirely.

### Q3 — Admin-role gate: **MATCH EXISTING PATTERN**

Slice 3 treats any authenticated user with a `brandId` as admin — consistent with all current `/v1/*` admin routes. Follow-up filed as **[#306 — Cross-cutting formal admin-role gate for /v1/* admin routes](https://github.com/mathursrus/CustomerEQ/issues/306)**.

### Q4 — URL-scheme refinement on privacyPolicyUrl / termsUrl: **APPLY**

PATCH validator adds `.refine(u => /^https?:/i.test(u), { message: 'must be http(s)' })` after `.url()` on both fields. Closes SLICE2-MED-1 carry-forward from Slice 2's security review.

### Q5 — supportEmail in GET response: **APPLY** (no user input requested; recommended option chosen by default)

`process.env.SUPPORT_EMAIL ?? 'support@customereq.com'` in the GET response. Add `SUPPORT_EMAIL=support@customereq.com` to `.env.example`.

---

## Validation Requirements (per FRAIM scoping skill)

| Mode | Required for Slice 3? | Notes |
|---|---|---|
| `unitTestsRequired` | ✅ Yes | Audit-allowlist filter behavior (R8 — shared test utils, no inline mocks). |
| `integrationTestsRequired` | ✅ Yes | All 8 scenarios from RFC §Validation Plan §Integration tests. Must hit real Docker-backed Postgres (R11a — tests fail loud, never skip). |
| `migrationValidationRequired` | ❌ No (no migration in this slice) | Slice 1 owned the migration; it's already on main as commit `c365833`. Slice 3 reads `Brand.timezone`, `Brand.locale`, `Brand.orgSize` against the live schema. |
| `e2eTestsRequired` | ❌ No | Slice 4 owns E2E. |
| `uiValidationRequired` | ❌ No | No UI in this slice. |
| `mobileValidationRequired` | ❌ No | No UI. |
| `securityReviewRequired` | ✅ Yes | Phase 6 of FRAIM. R6 (brandId-from-JWT), R12 (no secrets), R13 (PII handling — Brand.name is mildly sensitive). |
| `regressionTestsRequired` | ✅ Yes | Phase 7. Adjacent admin routes (`/v1/themes`, `/v1/developer`, `/v1/apiKeys`) must still pass after audit-plugin extension. |
| `architectureUpdateRequired` | ✅ Yes | Phase 10. Per RFC §Architecture Analysis, the architecture-doc updates were already applied in PR #290; this slice triggers a re-verification that the doc still reflects what the code does. |

---

## Acceptance Criteria (mapped to umbrella + RFC)

| ID | Source | Slice 3 deliverable |
|---|---|---|
| AC-S3-1 | Umbrella issue Slice 3 row | `GET /v1/admin/brand/profile`, `PATCH /v1/admin/brand/profile` integration-tested |
| AC-S3-2 | Umbrella issue Slice 3 row | Lazy-upsert validated (GET on first call creates the row, second call is idempotent) |
| AC-S3-3 | Umbrella issue Slice 3 row | Audit events firing per RFC §9 (`brand.profile.updated` with allowlisted metadata) |
| AC-S3-4 | Umbrella issue Slice 3 row | `POST /v1/admin/brand/logo` integration-tested — **deferred to [#305](https://github.com/mathursrus/CustomerEQ/issues/305)** per Decision Q1 |
| AC-S3-5 | RFC §8 / repo R6 | PATCH rejects body-supplied `brandId` (multiTenant plugin enforced) |
| AC-S3-6 | RFC §4.2 | PATCH 400 on IMPLIED transition without `attestation` (Zod refine) |
| AC-S3-7 | RFC §4.2 | PATCH 409 `MEMBER_IDENTIFIER_KIND_LOCKED` when changing identifier kind with members present |
| AC-S3-8 | RFC §4.2 | PATCH 400 EXPLICIT save without `{{privacy}}` token (uses `hasPrivacyToken` from `@customerEQ/consent-text`) |
| AC-S3-9 | RFC §4.2 + Slice 2 SLICE2-MED-1 | PATCH validator rejects `javascript:` / `data:` / `mailto:` URLs on `privacyPolicyUrl` and `termsUrl` (Decision Q4) |
| AC-S3-10 | Decision Q2 (replaces RFC §7a) | PATCH `name` writes `Brand.name` only; IdentityProvider is NOT invoked. Slice 4 UI shows "Organization Name" (read-only, Clerk) + "Brand Name" (editable, CustomerEQ) as distinct fields. |
| AC-S3-11 | RFC §Validation Plan | All 8 integration test scenarios pass against real Docker Postgres |
| AC-S3-12 | Project rule R11 | `pnpm typecheck`, `pnpm lint`, `pnpm test:smoke`, `pnpm test:integration` all green pre-PR |

---

## Pattern discovery (skill output)

| Category | Pattern found | Reused |
|---|---|---|
| Auth | `apps/api/src/plugins/auth.ts` — sets `request.brandId` + `request.clerkUserId` from JWT/API key/dev bypass | Yes — handler reads `request.brandId` only |
| Multi-tenant | `apps/api/src/plugins/multiTenant.ts` — rejects body `brandId` with 400 | Yes — registered globally in `app.ts` |
| Audit | `apps/api/src/plugins/audit.ts` — current shape: method+path+statusCode only, no per-route metadata | Extending — adding `request.audit.metadata` decoration + allowlist filter |
| Route module shape | `apps/api/src/routes/themes.ts` — `FastifyPluginAsync`, `fastify.<verb>('/<path>', handler)`, Zod parse via `safeParse` with 422 on failure | Mirrored for `admin-brand-profile.ts` |
| Validation status code | Existing routes return **422** for Zod validation failures (themes.ts:29, themes.ts:71). RFC says **400**. **Variance**: align with existing `422` for Zod failures; reserve **400** for cross-field/business-rule failures. Cite this in the route-file header comment. |
| Identity provider | `apps/api/src/plugins/identityProvider.ts` decorates `fastify.identityProvider`; `updateOrgName` exists | Reuse |
| Test pattern | `apps/api/test/integration/<feature>.spec.ts` (verify path; if no `test/integration` exists, fall back to `<route>.test.ts` co-located with the route in `routes/` per existing pattern) | Verify in implement-tests phase |
| Constants placement | No `apps/api/src/constants/` folder exists; `apps/api/src/lib/` has shared utilities (verify) | `DEFAULT_CONSENT_TEXT` lands at `apps/api/src/lib/consent.ts` |

---

## Validated patterns from L1 to apply

| Pattern | Where it applies in Slice 3 |
|---|---|
| Tests fail loud (R11a) | Integration tests must connect to a real Docker Postgres; if DB unreachable, test fails with clear error, never skips |
| Migration validated against real DB | N/A this slice (no migration), but the slice depends on Slice 1's migration being applied; first integration test must `prisma generate` against the live schema and hit the new `timezone`/`locale`/`orgSize` columns |
| Per-thread PR replies at resolution time | Phase 12 — every reviewer comment thread gets a reply citing resolving commit SHA |
| Decisions block at PR body bottom | Phase 11 — any binding decisions surface as a numbered block in the PR description |
| File issue before bundling unrelated fixes (R21) | Any off-scope issue discovered mid-slice (e.g., the role-gate gap, the multipart upload missing) → new issue, not a side-commit on this branch |
| Three-bucket architecture-gap classification | Phase 10 — Patterns Correctly Followed / Missing from Architecture / Incorrectly Followed |
| Filing backlog issues proactively for deferred work | Decisions Q1 + Q2 + Q3 each result in a tracking issue if the recommended option is chosen |

---

## Path forward — decisions resolved, ready for Phase 3

All five decisions resolved (Q1–Q5). Sub-issues filed:
- **[#305](https://github.com/mathursrus/CustomerEQ/issues/305)** — Logo upload + storage-backend (deferred; Slice 4 ships with paste-URL, #305 retrofits file picker)
- **[#306](https://github.com/mathursrus/CustomerEQ/issues/306)** — Cross-cutting formal admin-role gate (not blocking #292)
- **#301 / PR #302** — RCA on aspirational RFC claims (in review on its own branch)

Slice 3 binding decisions:
- PATCH `/profile` accepts `name` editable as Brand.name only; **NO IdentityProvider sync** (Q2 reframe — UI splits Organization Name read-only / Brand Name editable; carried as binding for Slice 4).
- PATCH validator adds `/^https?:/i` refinement on `privacyPolicyUrl` + `termsUrl` (Q4 — closes SLICE2-MED-1).
- GET response includes `supportEmail` from `process.env.SUPPORT_EMAIL ?? 'support@customereq.com'`; add to `.env.example` (Q5).
- Audit-plugin gets the per-route metadata-allowlist pattern (in scope; doc at `architecture.md:212` is already accurate).
- Admin-role gate matches existing pattern (any authenticated user with brandId is admin) per Q3.

Next phase: **Phase 3 — implement-tests** (FRAIM `feature-implementation`). Write the 8 integration test scenarios + audit-allowlist unit tests against the live schema. Tests fail-loud per R11a; integration tests connect to Docker-backed Postgres.
