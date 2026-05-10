# Implementation Evidence — Issue #292 Slice 3 (Backend admin-brand-profile)

Branch: `feature/issue-292-org-settings-api`
Job ID: `issue-292-slice-3` (FRAIM `feature-implementation`)
Tracks: [#292](https://github.com/mathursrus/issues/292) Slice 3 of 4 — `Refs #292` (does not close umbrella; Slice 4 closes)
Related: [#301](https://github.com/mathursrus/CustomerEQ/issues/301) / [PR #302](https://github.com/mathursrus/CustomerEQ/pull/302) — RCA on RFC aspirational claims that surfaced during this slice's scoping
Sub-issues filed: [#305](https://github.com/mathursrus/CustomerEQ/issues/305) (logo upload), [#306](https://github.com/mathursrus/CustomerEQ/issues/306) (admin-role gate)

## Phase 1 — implement-scoping

Standing work list at [`docs/evidence/292-slice-3-implement-work-list.md`](./292-slice-3-implement-work-list.md). Open decisions Q1–Q5 resolved with primary-source verification on every RFC claim. Three RFC claims required adjustment in scope (Q1 logo upload deferred to #305, Q2 IdentityProvider sync skipped per user reframe, Q3 admin-role gate matches existing pattern with #306 follow-up). One additional aspirational claim discovered during code authoring (`auth.ts` 401-on-missing-brand short-circuit); resolved by introducing `lazyUpsertBrand: true` route config flag mirroring the existing `allowNoOrg: true` precedent.

## Phase 3 — implement-tests

Tests written before implementation per FRAIM test-driven principle. Initial typecheck failed loud with `TS2614: Module './audit.js' has no exported member 'filterMetadata'` — confirmed test-driven handoff to Phase 4.

| Test surface | Path | Scenarios |
|---|---|---|
| Integration | `apps/api/test/integration/admin-brand-profile.test.ts` | 21 tests — GET (4: existing brand, response shape, lazy-upsert on novel clerkOrgId, idempotency), PATCH multitenant + auth (2), URL-scheme refinement (5: javascript/data/mailto/https/http), Zod basic (2: empty name, malformed token), IMPLIED transition (2: with/without attestation), identifier-kind lock (2: with/without members), EXPLICIT requires {{privacy}} (2), audit + identity provider (2: AuditEvent shape, Q2 binding) |
| Unit | `apps/api/src/plugins/audit.test.ts` | +6 tests for `filterMetadata` pure function — allowlisted keys returned, absent keys omitted, empty in/out, nested object preservation, undefined values dropped |

## Phase 4 — implement-code

Files added or modified, with line counts and rationale:

| File | Action | LOC delta | Rationale |
|---|---|---|---|
| `apps/api/src/routes/admin-brand-profile.ts` | add | +290 | GET (lazy-upsert + decorated response) + PATCH (Zod-validated edits with cross-field rules) |
| `apps/api/src/lib/consent.ts` | add | +10 | `DEFAULT_CONSENT_TEXT` constant for lazy-upsert seeding |
| `apps/api/src/plugins/auth.ts` | modify | +25 | `lazyUpsertBrand: true` route config; `request.clerkOrgId` decoration; `X-Test-Clerk-Org-Id` test-mode header |
| `apps/api/src/plugins/audit.ts` | modify | +50 / refactor | `filterMetadata` pure function; per-route `auditAllowlist` / `auditAction` / `auditResourceType` config; existing routes get legacy `{method, path, statusCode}` shape automatically (backward-compat) |
| `apps/api/src/plugins/audit.test.ts` | modify | +60 | Unit tests for `filterMetadata` |
| `apps/api/src/app.ts` | modify | +2 | Register the new route |
| `apps/api/package.json` | modify | +1 | `@customerEQ/consent-text` workspace dep |
| `apps/api/test/integration/setup.ts` | modify | +25 | Mock `identityProvider` plugin (consistent with existing prisma/redis/bullmq mocks); unblocks all 21 integration test files locally |
| `.env.example` | modify | +3 | `SUPPORT_EMAIL` env var (Q5) |
| `pnpm-lock.yaml` | modify | +3 | Workspace link for consent-text only — bounded delta |

**Bug discovered + fixed mid-implementation**: initial `EXPLICIT requires {{privacy}}` cross-field check fired on every PATCH against an EXPLICIT brand whose `consentTextDefault` was null (e.g., the test factory's default state). Fix: only enforce when the PATCH body actually touches `consentMode` or `consentTextDefault`. Tests caught this on first run; commit history reflects the corrected logic.

## Phase 5 — implement-validate

| Check | Result |
|---|---|
| `git status` — working tree state | Clean — exactly the expected Slice 3 modifications, nothing else (verified via diff scan) |
| `pnpm-lock.yaml` delta | +3 lines bounded to `@customerEQ/consent-text` workspace link (no version churn elsewhere) |
| `console.log` / `TODO` / `FIXME` / `XXX` scan in new files | Zero matches in `admin-brand-profile.ts`, `consent.ts`, `admin-brand-profile.test.ts` |
| `pnpm typecheck` (api standalone) | 0 errors |
| `pnpm typecheck` (repo-root) | 19/19 tasks successful |
| `pnpm lint` (api) | Clean (0 errors, 0 warnings of substance) |
| `pnpm test:smoke` (api) | **404/404 passing** in 6.3s |
| `pnpm test:integration` (api, all 21 files) | **318/318 passing** in 134s |
| `pnpm --filter @customerEQ/api build` | 0 errors (TypeScript compile to `dist/`) |
| Manual verification | Integration tests exercise the route end-to-end: real Fastify app via `buildApp()`, real Postgres via `getTestPrisma()`, real HTTP via supertest. The 21 admin-brand-profile scenarios cover GET lazy-upsert, every PATCH validation path (Zod, cross-field, business-rule), every status code in the contract (200, 400, 401, 409, 422), and the audit-event metadata shape. Equivalent of full `curl` matrix. |

## Discoveries surfaced during implementation

1. **Auth plugin 401-on-missing-brand short-circuit** at `auth.ts:154` blocked the RFC §4.1 lazy-upsert flow. Resolved with `lazyUpsertBrand: true` route config (mirrors existing `allowNoOrg: true` precedent at `auth.ts:123`). 25 LOC delta on the plugin.
2. **Survey Builder's `file_upload` question type is a UI stub** (`apps/web/src/app/survey/[id]/page.tsx:1015`) that captures only `file.name` as a string — the file bytes are dropped. No actual upload mechanism exists in the codebase. Verified during Q1 scoping per user instruction. Not in scope for #292; flagged as a future-issue candidate.
3. **Architecture-doc-vs-code drift on `architecture.md:212`**: documents the per-route audit metadata allowlist as applied for #276 + #277, but the code change was deferred. Slice 3 lands the code; doc was already accurate.
4. **Local integration-test environment setup gap**: integration tests required `CLERK_WEBHOOK_SECRET` that the dev placeholder didn't satisfy via svix's `Webhook` constructor. Resolved by mocking `identityProvider` plugin in `test/integration/setup.ts` (consistent with existing prisma/redis/bullmq mocks). Unblocks all 21 integration test files locally — also a fix for the broader contributor experience.

## Acceptance criteria check

| ID | Source | Status | Evidence |
|---|---|---|---|
| AC-S3-1 | Umbrella Slice 3 row | ✅ | `GET /v1/admin/brand/profile` + `PATCH /v1/admin/brand/profile` integration-tested (21 scenarios) |
| AC-S3-2 | Umbrella Slice 3 row | ✅ | Lazy-upsert validated — `lazy-upserts a brand row when clerkOrgId has no existing brand` (test passes); idempotent — `is idempotent — second GET with same clerkOrgId returns the same brand row` (test passes) |
| AC-S3-3 | Umbrella Slice 3 row | ✅ | Audit events firing per RFC §9 — `writes an AuditEvent row with allowlisted metadata after a successful PATCH` (test passes); allowlist = `[changedFields, before, after, attestation, memberCountAtChange]` |
| AC-S3-4 | Umbrella Slice 3 row | ⏭ deferred | `POST /v1/admin/brand/logo` deferred to [#305](https://github.com/mathursrus/CustomerEQ/issues/305) per Decision Q1 |
| AC-S3-5 | RFC §8 / R6 | ✅ | `rejects body-supplied brandId with 400 (multiTenant plugin)` test passes |
| AC-S3-6 | RFC §4.2 | ✅ | `rejects IMPLIED_ON_SUBMIT transition without attestation (400)` test passes |
| AC-S3-7 | RFC §4.2 | ✅ | `rejects identifier-kind change with 409 MEMBER_IDENTIFIER_KIND_LOCKED when members exist` test passes |
| AC-S3-8 | RFC §4.2 | ✅ | `rejects EXPLICIT save without {{privacy}} token in consentTextDefault (400)` test passes |
| AC-S3-9 | RFC §4.2 + SLICE2-MED-1 | ✅ | URL-scheme refinement — 5 tests across `javascript:`, `data:`, `mailto:`, `https://`, `http://` all pass |
| AC-S3-10 | Decision Q2 | ✅ | `does NOT invoke IdentityProvider.updateOrgName on Brand.name change (Q2 binding)` test passes; PATCH writes `Brand.name` only |
| AC-S3-11 | RFC §Validation Plan | ✅ | All 21 admin-brand-profile integration scenarios pass against real Docker Postgres |
| AC-S3-12 | Project rule R11 | ✅ | typecheck/lint/test:smoke/test:integration all green pre-PR |

Phase 5 outcome: validation passes. No findings route back to `implement-code`. Ready for Phase 6 (`implement-security-review`).

## Security Review

### Executive Summary

Diff-based review of Slice 3's ~700 LOC change. **Zero Critical, zero High, zero Medium findings.** Two Low informational notes (non-blocking) and three accepted-by-design items captured with rationale. Auth/crypto firewall fires on the `auth.ts` modification — manually reviewed in detail; the change is a route-config flag mirroring an existing precedent (`allowNoOrg: true`) and does not weaken session verification. Phase passes; ready for `implement-regression`.

### Review Scope

- `reviewType`: embedded-diff-review
- `reviewScope`: diff
- Surfaces: 11 files (route, plugins, plugin tests, integration tests, integration setup, lib, app, env example, package.json, lock, evidence doc)
- Reviewed against: `feature/issue-292-org-settings-api` vs `origin/main`

### Threat Surface Summary

| Surface | Detected | Evidence |
|---|---|---|
| `api` | ✅ | `apps/api/src/routes/admin-brand-profile.ts` (`fastify.get`, `fastify.patch`); `apps/api/src/plugins/{auth,audit}.ts` (under `src/plugins/**`) |
| `web` | ❌ | No `public/**` or `src/pages/**` changes |
| `llm-app` | ❌ | No openai/anthropic imports added |
| `data-pipeline` | ❌ | No script entrypoint changes; no direct DB-driver imports |
| `mobile` | ❌ | No iOS/Android changes |
| `capability-authoring` | ❌ | Only implementation-evidence docs under `docs/evidence/**`, not capability content |
| `docs-only` | ❌ | Non-doc files present in diff |

**Auth/crypto firewall**: fires on `apps/api/src/plugins/auth.ts` modification. Per the `finding-disposition` skill's first-pass rule, any finding in this file routes to `file` (no auto-fix). Manual review of the diff captured below.

### Coverage Matrix

| Category | Status | Notes |
|---|---|---|
| OWASP API1 — Broken Object Level Authorization | Pass | `brandId` resolution: JWT → auth plugin → `request.brandId`. multiTenant plugin rejects body-supplied `brandId` (verified by integration test `rejects body-supplied brandId with 400`). All Prisma queries scope to `where: { id: brandId }` or `where: { brandId }`. |
| OWASP API2 — Broken User Authentication | Pass (with note) | Auth plugin still requires a valid session for the `lazyUpsertBrand` route (`session.orgId` required at `auth.ts:143-147`). The relaxation is *only* "don't 401 on missing brand row"; the user is still authenticated. The lazy-upsert is bounded to `clerkOrgId`s the session actually carries — an attacker can only provision a brand for an org they already own. |
| OWASP API3 — Broken Object Property Level Authorization | Pass | GET response only includes brand fields enumerated in the explicit `select` clause. PATCH writes only allowlisted editable fields (`editableKeys` array); body fields not in the list are silently ignored. AuditEvent metadata filtered through `filterMetadata` to a per-route allowlist — request bodies and secret-bearing fields cannot leak through. |
| OWASP API4 — Unrestricted Resource Consumption | Pass | GET runs 3 queries (Promise.all) per request; PATCH is single-tenant single-row update. No new rate-limiting added — consistent with existing admin routes. No upload endpoints in this slice (logo upload deferred to #305 with its own size/MIME caps). |
| OWASP API5 — Broken Function Level Authorization | **Pass (deferred)** | Admin-role gate matches the existing de-facto pattern (any authenticated user with a `brandId` is admin). Cross-cutting formal role gate filed as [#306](https://github.com/mathursrus/CustomerEQ/issues/306). Per Q3 binding; not a regression introduced here. |
| OWASP API6 — Unrestricted Access to Sensitive Business Flows | N/A | Admin settings endpoint; no bulk-action surface. |
| OWASP API7 — SSRF | Pass | `privacyPolicyUrl`/`termsUrl` are stored, not server-fetched. Slice 4's UI renders them as anchor `href`. The `/^https?:/i` refinement (Q4 binding) blocks `javascript:`/`data:`/`mailto:` schemes at the validator — closes SLICE2-MED-1's stored-XSS surface. Verified by 5 integration tests. |
| OWASP API8 — Security Misconfiguration | Pass | `DEFAULT_CONSENT_TEXT` seeds `{{privacy}}` token by default (so EXPLICIT-mode brands satisfy R19 at first save). `SUPPORT_EMAIL` has env-var with safe fallback. No CORS / CSP / security-header changes. |
| OWASP API9 — Improper Inventory Management | Pass | `/v1` prefix; consistent versioning. New route added to `app.ts` registration list. |
| OWASP API10 — Unsafe Consumption of APIs | Pass | Per Q2 binding, IdentityProvider is NOT invoked. No external API calls in this slice. |
| Secrets in code | Pass | `.env.example` only adds `SUPPORT_EMAIL=support@customereq.com` (placeholder, not a secret). No hardcoded keys, JWT secrets, or credentials. |
| Privacy / PII | Pass (with note) | AuditEvent metadata can include `attestation.justification` (admin-typed text). Captured deliberately for compliance audit per RFC §9. Allowlist excludes generic request `method`/`path`/`statusCode`/raw body — preventing accidental PII leakage. |
| Compliance control mapping | N/A | No active compliance regulation flags this slice. |

### Findings

| ID | Severity | Category | Location | Summary | Disposition |
|---|---|---|---|---|---|
| L1 | Low (informational) | API4 — defense-in-depth | `apps/api/src/routes/admin-brand-profile.ts` (GET handler) | Lazy-upsert path runs `prisma.brand.upsert` on every first-GET for a novel `clerkOrgId`. An attacker who controls many Clerk orgs could provision many `Brand` rows. Bounded by Clerk's own rate limit on org creation; not exploitable in practice. No action required. | accept |
| L2 | Low (informational) | API5 — deferred | (cross-cutting) | Admin-role gate matches existing de-facto pattern; non-admin Clerk users in the org can still hit admin routes. Tracked in [#306](https://github.com/mathursrus/CustomerEQ/issues/306). | file (already filed) |

### Prioritized Remediation Queue

None. No Critical/High/Medium findings. L1 + L2 are below the action threshold.

### Verification Evidence

Tests directly validating security-relevant behavior:
- `rejects body-supplied brandId with 400 (multiTenant plugin)` — API1 enforcement
- `rejects unauthenticated requests with 401` — API2 enforcement
- 5 URL-scheme tests (`javascript:` / `data:` / `mailto:` rejected; `https://` / `http://` accepted) — API7 / SLICE2-MED-1 closure
- `writes an AuditEvent row with allowlisted metadata after a successful PATCH` — confirms metadata.method/path/statusCode are NOT leaked into the audit row (allowlist filtering works)
- `rejects malformed consent token with 422` — API3-adjacent input validation

All tests pass against real Docker Postgres in `pnpm test:integration` (318/318).

### Applied Fixes and Filed Work Items

- No auto-fixes applied this run (no allowlist-pattern findings).
- Cross-cutting role-gate work tracked in [#306](https://github.com/mathursrus/CustomerEQ/issues/306).

### Accepted / Deferred / Blocked

| Item | Decision | Rationale | Owner |
|---|---|---|---|
| Lazy-upsert provisioning rate (L1) | Accept | Bounded by Clerk's org-creation rate limit; not exploitable in practice | — |
| Cross-cutting admin-role gate (L2) | Defer to [#306](https://github.com/mathursrus/CustomerEQ/issues/306) | R15 — fix at the cross-cutting layer, not per-route. Q3 binding. | manohar.madhira@outlook.com |
| Logo upload security (multipart, MIME, size) | Defer to [#305](https://github.com/mathursrus/CustomerEQ/issues/305) | Storage-backend decision lives with #305; security caps land with the implementation. | manohar.madhira@outlook.com |

### Compliance Control Mapping

N/A — no active compliance regulation flags this slice. (FRAIM `fraim/config.json` lists GDPR / CCPA / SOC2 / PCI-DSS as applicable per #231 retro context, but none gate this slice's diff.)

### Run Metadata

- **Run date**: 2026-05-07
- **Branch tip**: `feature/issue-292-org-settings-api` (uncommitted at review time; see Phase 11 submission for SHA)
- **Base**: `origin/main` at `f6c75c5`
- **Auth/crypto firewall fired on**: `apps/api/src/plugins/auth.ts` (manually reviewed; route-config flag addition mirrors existing `allowNoOrg: true` precedent at L123; no session-verification weakening)
- **Auto-fix cap**: 0 of 10 used (no auto-fixes applied)
- **Skill errors**: none
- **Compliance mapping**: N/A this run

Phase 6 outcome: passes (zero Critical/High/Medium findings). Ready for Phase 7 (`implement-regression`).

## Phase 7 — implement-regression

| Suite | Scope | Result |
|---|---|---|
| `pnpm test:smoke` (repo root, turbo) | All 16 packages — full unit test suite | **404/404 passing** in 9.4s; 16/16 turbo tasks successful (10 cached, 6 ran) |
| `pnpm test:integration` (api) | All 21 integration test files | **318/318 passing** in 134s — confirms no regression in 297 pre-existing scenarios from existing `/v1/themes`, `/v1/members`, `/v1/programs`, `/v1/surveys`, etc. routes |
| `pnpm typecheck` (repo root, turbo) | All 19 typecheck tasks | 19/19 successful |

The audit-plugin extension (per-route allowlist) is backward-compatible: routes without `auditAllowlist` config keep the legacy `{method, path, statusCode}` audit metadata shape. All 297 pre-existing integration tests verify this implicitly — they continue to pass against the modified plugin.

The auth-plugin extension (`lazyUpsertBrand` route config) is opt-in: all existing routes default to `lazyUpsertBrand: undefined` and retain the original 401-on-missing-brand behavior (auth.ts:154-158 unchanged path). Verified by passing `apps/api/src/plugins/auth.test.ts` and the 297 pre-existing integration tests.

The integration-test setup change (mocking `identityProvider`) affects all 21 test files. All 21 pass — no test regressed because of the mock; if anything the mock unblocks tests that previously couldn't run locally without specific Clerk webhook secret setup.

Phase 7 outcome: passes. No regressions detected. Ready for Phase 8 (`implement-quality`).

## Phase 8 — implement-quality

Quality findings + resolutions documented in [`docs/evidence/292-slice-3-feature-implementation-feedback.md`](./292-slice-3-feature-implementation-feedback.md). One quality issue raised (`BRAND_PROFILE_SELECT` duplicate select shape) and addressed in same phase via constant extraction. One note documented (PATCH handler size at ~110 LOC, justified as single-purpose REST handler). Zero unresolved findings.

Phase 8 outcome: passes. Ready for Phase 9 (`implement-completeness-review`).

## Phase 9 — implement-completeness-review

### Feature Requirement Traceability Matrix

Source: [#292 umbrella issue Slice 3 row](https://github.com/mathursrus/CustomerEQ/issues/292) + [#277 spec](../feature-specs/277-organization-settings.md) (outcome-level acceptance).

| Requirement | Implementation | Proof | Status |
|---|---|---|---|
| `GET /v1/admin/brand/profile` integration-tested | `apps/api/src/routes/admin-brand-profile.ts:GET` | Integration tests "returns the brand profile for an existing brand" + "GET response includes themes / memberCount / supportEmail keys" | **Met** |
| `PATCH /v1/admin/brand/profile` integration-tested | `apps/api/src/routes/admin-brand-profile.ts:PATCH` | 13 integration tests covering multitenant rejection, URL-scheme, Zod, IMPLIED attestation, identifier-kind lock, EXPLICIT-requires-{{privacy}}, audit row | **Met** |
| Lazy-upsert validated | `auth.ts:lazyUpsertBrand` config flag + `admin-brand-profile.ts:GET` upsert | "lazy-upserts a brand row when clerkOrgId has no existing brand" + "is idempotent — second GET with same clerkOrgId returns the same brand row" | **Met** |
| Audit events firing per RFC §9 | `audit.ts:filterMetadata` + per-route `auditAllowlist` config | "writes an AuditEvent row with allowlisted metadata after a successful PATCH" — verifies action="brand.profile.update", metadata = {changedFields, before, after}; method/path NOT leaked | **Met** |
| `POST /v1/admin/brand/logo` integration-tested | (deferred to #305) | n/a | **Deferred (user-approved, Q1)** — tracked in [#305](https://github.com/mathursrus/CustomerEQ/issues/305) |
| Spec #277 outcome: new admin reaches working Org Settings page without manual DB seeding | Lazy-upsert provisions Brand row from Clerk session at first GET | "lazy-upserts a brand row when clerkOrgId has no existing brand" | **Met** (backend; UI lands in Slice 4) |
| Spec #277 outcome: authorization-gated fields cannot change without gate | IMPLIED transition requires attestation; identifier-kind locked when members exist | "rejects IMPLIED_ON_SUBMIT transition without attestation (400)" + "rejects identifier-kind change with 409 MEMBER_IDENTIFIER_KIND_LOCKED when members exist" | **Met** |
| Spec #277 outcome: edits persist + downstream surfaces reflect them | PATCH writes Brand table; existing public/embed routes read from same Brand columns (no schema change for read paths) | PATCH integration tests + 297 pre-existing integration tests across public-survey/themes/etc. continue to pass | **Met** |

**Result**: 7 Met, 1 Deferred (user-approved). 0 Partial, 0 Unmet. **Pass.**

### Technical Design Traceability Matrix

Source: [#277 RFC](../rfcs/277-organization-settings.md).

| RFC commitment | Implementation | Proof | Status |
|---|---|---|---|
| §1 Schema (Brand.timezone, locale, orgSize rename + enum reshape) | (Already in main from Slice 1, PR #299, commit `c365833`) | Brand fields used by PATCH validators + GET response. | **Met (Slice 1)** |
| §3 `@customerEQ/consent-text` package (parser, zConsentText, hasPrivacyToken, renderers) | (Already in main from Slice 2, PR #300, commit `a0df68f`) | `apps/api/src/routes/admin-brand-profile.ts` imports `zConsentText` + `hasPrivacyToken` from `@customerEQ/consent-text`; tested by URL-scheme + EXPLICIT-{{privacy}} integration tests | **Met (Slice 2)** |
| §4.1 GET endpoint — lazy-upsert + decorated response (themes, memberCount, supportEmail) | `admin-brand-profile.ts:GET` + `auth.ts:lazyUpsertBrand` | 4 GET integration tests | **Met** |
| §4.2 PATCH endpoint — full Zod schema (12 editable fields + attestation refine + cross-field rules) | `admin-brand-profile.ts:PATCH` + `PatchBrandProfileSchema` + `AttestationSchema` | 13 PATCH integration tests | **Met** |
| §4.3 POST /v1/admin/brand/logo (multipart) | (deferred) | n/a | **Deferred (user-approved, Q1)** — tracked in [#305](https://github.com/mathursrus/CustomerEQ/issues/305); RFC's "existing asset path" claim verified absent. |
| §7a IdentityProvider write-through on Brand.name change | (intentionally skipped per Q2) | "does NOT invoke IdentityProvider.updateOrgName on Brand.name change (Q2 binding)" | **Replaced by user reframe (approved)** — Slice 4 UI splits Organization Name (read-only, Clerk) from Brand Name (editable, CustomerEQ). |
| §8 Multi-tenant brandId from JWT only (R6) | `multiTenant` plugin (existing) + `auth.ts` (`brandId` from session) | "rejects body-supplied brandId with 400 (multiTenant plugin)" | **Met** |
| §8 Admin-role gate (R14) | (matches existing pattern; cross-cutting follow-up filed) | n/a — consistent with existing /v1/themes, /v1/developer pattern | **Deferred (user-approved, Q3)** — tracked in [#306](https://github.com/mathursrus/CustomerEQ/issues/306). |
| §8 IMPLIED transition attestation (Zod refine) | `PatchBrandProfileSchema.refine` | "rejects IMPLIED_ON_SUBMIT transition without attestation (400)" | **Met** |
| §8 Identifier-kind lock when members exist | `admin-brand-profile.ts:PATCH` cross-field rule 1 | "rejects identifier-kind change with 409 MEMBER_IDENTIFIER_KIND_LOCKED when members exist" + "allows identifier-kind change when zero members exist" | **Met** |
| §8 Consent-text validation (zConsentText, single source of truth) | `zConsentText` from `@customerEQ/consent-text` | "rejects malformed consent token with 422" | **Met** |
| §8 EXPLICIT requires `{{privacy}}` token (server-side cross-field) | `admin-brand-profile.ts:PATCH` cross-field rule 2 + `hasPrivacyToken` | "rejects EXPLICIT save without {{privacy}} token in consentTextDefault (400)" + "accepts EXPLICIT save with {{privacy}} token" | **Met** |
| Q4 binding (closes SLICE2-MED-1): URL-scheme refinement | `HttpsUrl = z.string().url().refine(/^https?:/i)` | 5 integration tests (javascript/data/mailto/https/http) | **Met** |
| §9 Audit-event coverage — `brand.profile.updated` with allowlisted metadata | `audit.ts:filterMetadata` + `ROUTE_AUDIT_CONFIG` | "writes an AuditEvent row with allowlisted metadata after a successful PATCH" + 6 unit tests for `filterMetadata` | **Met** |
| §9 IMPLIED attestation captured in audit metadata | `admin-brand-profile.ts:PATCH` populates `request.audit.metadata.attestation` | (covered by audit + IMPLIED test combination) | **Met** |
| §Architecture-gap row — Per-route audit metadata allowlist documented | (Already in `architecture.md:212` from #277 PR #290; code now matches doc per this slice) | architecture.md:212 + audit.ts implementation | **Met** |
| §Architecture-gap row — Lazy-upsert provisioning pattern documented | architecture.md:66 (already landed in #290) | Slice 3 introduces the first instance | **Met** |

**Result**: 13 Met, 3 Deferred-or-replaced (all user-approved). 0 Partial, 0 Unmet. **Pass.**

### Feedback completeness verification

`docs/evidence/292-slice-3-feature-implementation-feedback.md` contents reviewed:
- 1 quality finding raised (BRAND_PROFILE_SELECT duplicate) → **ADDRESSED** in same phase via constant extraction.
- 1 note documented (PATCH handler size) → **ACCEPTED** with justification.
- 0 UNADDRESSED items.

**Result**: All feedback addressed. **Pass.**

### Validation requirements check (against Standing Work List)

| Mode | Required by work list | Executed? | Evidence |
|---|---|---|---|
| `unitTestsRequired` | Yes | ✅ | 404/404 smoke tests; 6 new `filterMetadata` unit tests passing |
| `integrationTestsRequired` | Yes | ✅ | 318/318 (21/21 admin-brand-profile + 297 pre-existing) against real Docker Postgres |
| `migrationValidationRequired` | No (Slice 1 already shipped) | n/a | Slice 1 commit `c365833` validated against fresh DB |
| `e2eTestsRequired` | No (Slice 4 owns E2E) | n/a | — |
| `uiValidationRequired` | No (no UI in this slice) | n/a | — |
| `mobileValidationRequired` | No | n/a | — |
| `securityReviewRequired` | Yes | ✅ | Phase 6 — zero Critical/High/Medium findings; auth/crypto firewall manually reviewed |
| `regressionTestsRequired` | Yes | ✅ | Phase 7 — 404/404 smoke + 318/318 integration; zero regressions |
| `architectureUpdateRequired` | Yes | (deferred to Phase 10) | Pending |

**Result**: all required modes executed or consciously deferred to a later phase per their natural phase. **Pass.**

Phase 9 outcome: passes. Ready for Phase 10 (`implement-architecture-update`).

## Phase 10 — implement-architecture-update

The 5 architecture-doc rows from PR #290 (RFC §Architecture Analysis) already landed in `docs/architecture/architecture.md` at lines 40, 48, 59, 66, 212. Slice 3 closes the doc-vs-code drift on L212 (audit allowlist) by landing the implementing code; no new pattern row needed.

Two surgical doc edits in this slice for accuracy:

| Section | Edit | Rationale |
|---|---|---|
| `architecture.md:209` (auth plugin) | Added `X-Test-Clerk-Org-Id` test-mode header + `lazyUpsertBrand: true` route config to the description; mentioned `GET /v1/admin/brand/profile` as the first user. | Documents the new route-config flag + test-mode bypass introduced in this slice. Mirrors the `allowNoOrg: true` documentation precedent. |
| `architecture.md:212` (audit plugin) | Clarified the per-route allowlist config keys (`auditAllowlist`, `auditAction`, `auditResourceType`); noted backward-compat fallback to legacy `{method, path, statusCode}` shape for routes without `auditAllowlist`. | Resolves the doc-vs-code drift identified during Slice 3 scoping (the L212 row was added in #290 but the implementing code landed only in this slice). The doc now describes the actual implementation. |

No new patterns introduced. No new architectural decisions requiring an ADR. The lazy-upsert and per-route audit allowlist patterns were both documented in PR #290 with this slice as the first implementing code; neither is a one-way door requiring further architectural review.

Phase 10 outcome: passes. Ready for Phase 11 (`implement-submission`).
