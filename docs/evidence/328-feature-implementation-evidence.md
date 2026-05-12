# Issue #328 — Feature Implementation Evidence

Slice 2 of #241 (umbrella #324). API surface + consent-mode endpoint + audit extension.

Branch: `feature/241-slice-2-api-surface`
Work-list: [`325-implement-work-list.md`](./328-implement-work-list.md) (sic — 328-implement-work-list.md)

---

## Security Review

### Executive Summary

- **Findings**: 0
- **Severity counts**: Critical 0, High 0, Medium 0, Low 0
- **Outcome**: Pass — proceed to `implement-regression`.

Slice 2 adds a new authenticated PATCH endpoint, tightens the existing PATCH with `.strict()` + state-aware allowlist, and captures `request.ip` into audit metadata. The new endpoint's attestation gate, server-stamped attestedBy/attestedAt, and per-route audit allowlists all *reduce* the attack surface relative to the prior state. No new dependencies; no new secrets; no auth/crypto code touched. The migration is a single ALTER TABLE ADD COLUMN — no data movement.

### Review Scope

- **reviewType**: `embedded-diff-review`
- **reviewScope**: `diff`
- **Diff target**: `feature/241-slice-2-api-surface` vs `main` (commit `93b92d4`)
- **surfaceAreaPaths**: schema.prisma (Survey.description add), Slice 2 migration SQL, Zod schemas (CreateSurveySchema/UpdateSurveySchema additions + UpdateConsentModeSchema new + isScoreField superRefine), `apps/api/src/plugins/audit.ts` (requestIp enrichment), `apps/api/src/routes/surveys.ts` (PATCH /:id strict+allowlist, new /:id/consent-mode handler, response-handler policy enforcement), `apps/api/src/routes/public.ts` (channel-attribution swap, ONCE error contract), one new test file + 2 updated test files

### Threat Surface Summary

| Surface | Detected | Evidence |
|---|---|---|
| `api` | yes | Multiple route handlers modified; one new endpoint. No new authentication code (auth plugin unchanged). |
| `web` | no | No `apps/web/**` changes. |
| `data-pipeline` | yes (minor) | One small additive migration: `ALTER TABLE "surveys" ADD COLUMN IF NOT EXISTS "description" TEXT`. No user-controlled input. |
| `llm-app`, `mobile`, `capability-authoring` | no | — |

### Coverage Matrix

| Category | Result | Notes |
|---|---|---|
| A01 Broken Access Control | **Pass** | All routes preserve the existing `request.brandId` brand-scoping + cross-brand 404 pattern. The new PATCH /:id/consent-mode does the same `findFirst({ where: { id, brandId } })` lookup. |
| A03 Injection — SQL | **Pass** | All DB writes go through Prisma typed client; no `$executeRawUnsafe` outside tests. Migration SQL is static text. |
| A04 Insecure Design — mass assignment | **Pass / reduced** | `UpdateSurveySchema.strict()` rejects unknown keys (including the four consent-override fields). The dedicated `/consent-mode` endpoint is now the *only* writer for those columns. `consentSuppressedAttestedBy` and `consentSuppressedAttestedAt` are server-stamped, never accepted from the client body. |
| A05 Misconfiguration — secrets in code | **Pass** | No new hardcoded credentials or tokens. `request.audit.metadata` is filtered by per-route allowlists before persistence; `requestIp` only appears in audit rows where the route explicitly includes it. |
| API1 Broken Object Level Auth | **Pass** | New endpoint enforces brand scoping. State-aware allowlist (R29 / R30) prevents writes that would invalidate prior responses' interpretation (`type`, `programId`, `questions` lock outside DRAFT). |
| API2 Broken Authentication | **N/A** | No auth code paths touched (paths under `auth/`, `session/`, `jwt/`, `oauth/`, `mfa/` not in diff). |
| API3 Broken Object Property Level Auth | **Pass** | `.strict()` rejects writes to fields outside the documented schema. State-aware allowlist enforces per-state field editability per RFC §"State-aware field editability". |
| API8 Security Misconfiguration | **Pass** | Audit row is fire-and-forget — never blocks the response, but the `request.ip` missing case logs a structured WARN rather than silently swallowing. Migration replay is a no-op (`IF NOT EXISTS`). |
| Privacy / PII | **Pass** | `request.ip` is captured into `AuditEvent.metadata.requestIp` only for routes whose allowlist explicitly includes it; not added to general request logs. Audit metadata stays inside `metadata` JSON column (existing data structure; not surfaced in public APIs). |
| Secrets in code (full scan) | **Pass** | Grep for `AKIA*`, `sk_*`, bearer/password/token literals in diff returned only pre-existing fixture/placeholder strings. |

### Findings

None.

### Verification Evidence

- `pnpm typecheck` clean across all packages.
- `pnpm lint` clean (warnings unchanged).
- `pnpm build` clean.
- `pnpm test` → unit suite green (1556+ tests; shared 584, api 460, ai 35, others unchanged).
- `pnpm test:integration` → 367 tests green (16 new consent-mode + 1 updated channel-attribution + 1 updated ONCE error code + 1 updated MULTIPLE behavior + the rest unchanged).
- Manual `pnpm db:migrate` against a fresh `slice2_test` DB applies all 27 migrations cleanly; second `db:migrate` reports "No pending migrations to apply" (idempotency verified).
- Grep of `apps/api/src/routes/public.ts` confirms no remaining `queryMemberId` / `?member_id=` URL-query identifier extraction.

### Run Metadata

- Date: 2026-05-11
- Diff target: `feature/241-slice-2-api-surface` vs `main` @ `93b92d4`
- Skill errors: none
- Auto-fix cap: 0/10 (no findings)
- Environment: Windows 11 + Docker Desktop + pgvector/pgvector:pg16 + Node 22 + pnpm 11.1.0

---

## Feature Requirement Traceability Matrix

Source of truth: issue [#328](https://github.com/mathursrus/CustomerEQ/issues/328) Acceptance section.

| Requirement / Acceptance Criterion | Implemented | Proof | Status |
|---|---|---|---|
| PATCH /:id/consent-mode endpoint exists; writes the four consent-override columns | `apps/api/src/routes/surveys.ts` (new route) + `UpdateConsentModeSchema` | `survey-consent-mode.test.ts` "allows override-to-stricter" + "allows override-to-more-permissive with attestation" + "clears the override (consentMode: null)" → 3 passing tests | Met |
| Attestation gate fires (R10) | Handler computes `isMorePermissive = requested==='IMPLIED_ON_SUBMIT' && brandMode==='EXPLICIT'`; missing attestation → 422 ATTESTATION_REQUIRED with `{ brandMode, requestedMode }` | "rejects override-to-more-permissive without attestation (422)" + "rejects attestation with confirmed=false" + "rejects attestation with empty reason" → 3 passing tests | Met |
| `consentSuppressedAttestedBy`/`At` server-stamped | Handler sets from `request.clerkUserId` + `new Date()` on any override write | "allows override-to-stricter without attestation" asserts attestedBy/At populated | Met |
| Audit row written with allowlist for consent-mode | Per-route `auditAction: 'survey.consent.update'` + allowlist `['consentMode', 'consentReason', 'attestation', 'requestIp']`; handler populates `request.audit.metadata` | "writes an AuditEvent row with allowlisted metadata" passes; checks `metadata.consentMode`, `metadata.consentReason`, `metadata.requestIp` | Met |
| PATCH /:id `.strict()` rejects consent fields with FIELD_DISALLOWED | `UpdateSurveySchema.strict()` + handler translates `unrecognized_keys` → 422 `{ code: 'FIELD_DISALLOWED', field }` | "rejects consentMode on general PATCH" + "rejects consentSuppressedAttestedBy" → 2 passing | Met |
| PATCH /:id state-aware allowlist returns 409 FIELD_NOT_EDITABLE_IN_STATE | `FIELD_EDITABILITY` table + handler iterates over body keys | "rejects type change on ACTIVE", "rejects programId on PAUSED", "rejects questions on ACTIVE", "rejects responsePolicy on DRAFT with responsesCount > 0", "rejects any field change on STOPPED" → 5 passing | Met |
| CreateSurveySchema + UpdateSurveySchema accept new fields | Both schemas extended with `title?`, `description?`, `responsePolicy?`, `consentTextOverride?` | "accepts title, description, responsePolicy, consentTextOverride on PATCH" + "accepts the new Slice 2 fields" Zod tests | Met |
| Single cx event emit per submission | `surveys.ts` response handler emits one `eventTypeMap[survey.type]` event | Existing `public-survey.test.ts` "submits a response, enqueues one CX event" unchanged | Met |
| ONCE policy → 409 POLICY_ONCE_DUPLICATE | surveys.ts auth path + public.ts public path both emit `code: 'POLICY_ONCE_DUPLICATE'` | `public-survey.test.ts` "responsePolicy = ONCE — second submission returns 409 POLICY_ONCE_DUPLICATE" | Met |
| LATEST_OVERWRITES updates prior row | Auth path branches on `wasOverwrite`; public path already had `priorResponse` branch | Existing public-survey LATEST_OVERWRITES test passes | Met |
| MULTIPLE inserts new row | Default path; surveys.ts test updated to assert two rows persisted | "responsePolicy MULTIPLE (default) — same member can submit twice; both rows persisted" | Met |
| `enrolledVia` channel attribution swap | public.ts: removed `queryMemberId` branch; `enrolledVia = data.channel === 'in_app' ? 'EMBEDDED_FORM' : 'SURVEY_RESPONSE'` | "auto-enrolls a new member when channel = in_app — enrolledVia = EMBEDDED_FORM" + "URL query is no longer consulted — channel field is the sole signal" | Met |
| `isScoreField` Zod validation (at-most-one, rateable only) | `SurveyQuestionSchema.isScoreField?` + `validateScoreFields` superRefine on Create + Update | 6 isScoreField unit tests covering happy path + two-marked + Likert reject + text reject + slider accept + no-marked accept | Met |
| AuditEvent.metadata.requestIp populated | `audit.ts` onResponse enriches `request.audit.metadata` with `requestIp: request.ip` before allowlist filter | consent-mode audit-row test checks `meta.requestIp` | Met |
| Missing-IP doesn't block, logs warn | `try/catch` around `request.ip`; null path logs structured warn | Inspected at `audit.ts:131-150` — falls through to `requestIp: null`, audit row still writes | Met |
| Per-route audit allowlists | Three new/changed configs (PATCH /:id, PATCH /:id/status, PATCH /:id/consent-mode) | Inspected at `surveys.ts` route options blocks | Met |
| `pnpm audit --audit-level=high` still 0 highs | No new dependencies introduced | Inherited from #321 baseline | Met |

### Deviations

- **Scope addition: `Survey.description` column** — The RFC's API surface row mentioned `description` as a PATCH body field but Slice 1's schema deltas didn't add a column for it. Slice 2 adds it via a tiny additive migration (`20260513000000_survey_admin_ux_241_slice_2_description`). This unblocks R26 (list-page meta) for Slice 3. Approved during phase-4 implementation (one column, no data movement, no idempotency complexity).
- **Error contract alignment** — Pre-existing `RESPONSE_ALREADY_EXISTS` error code in public.ts replaced with the RFC's documented `POLICY_ONCE_DUPLICATE`. Existing `public-survey.test.ts` test updated to match. The `error` field text also changed to the RFC's human-readable copy. Justified as a design-driven test mutation (FRAIM testing-standards mandate 1 allows existing tests to change when required by a design change; the RFC is that design change for #241).
- **Pre-existing public.ts responsePolicy logic** — public.ts already had `responsePolicy` enforcement from #231 PR2; Slice 2 didn't rewrite that section but did update the ONCE error contract and remove the URL-query branch. The LATEST_OVERWRITES/MULTIPLE behavior on the public path was already correct.

---

## Technical Design Traceability Matrix

Source of truth: [`docs/rfcs/241-survey-admin-ux.md`](../rfcs/241-survey-admin-ux.md) §API Surface, §"State-aware field editability", §"Endpoint error contracts", §Audit Plugin Extension, §Implementation slicing row 2 (post-#327 clarification).

| Design Commitment | Implementation | Proof | Status |
|---|---|---|---|
| `PATCH /v1/surveys/:id/consent-mode` new endpoint (absorbs #283) | New route in `surveys.ts` + `UpdateConsentModeSchema` in shared/zod | 11 consent-mode integration tests pass | Met |
| `UpdateSurveySchema.strict()` rejects unknown keys with `details.fieldDisallowed` | `.strict()` added in shared/zod; handler maps `unrecognized_keys` → 422 `{ code: 'FIELD_DISALLOWED' }` | 2 strict-rejection integration tests | Met |
| Per-field state-aware allowlist per RFC table | `FIELD_EDITABILITY` const table + handler iterates | 5 state-aware integration tests + 1 allow-in-state test | Met |
| `POST /:id/responses` emits one cx event (matching survey type) | `eventTypeMap` in surveys.ts response handler | Existing test passes | Met |
| `responsePolicy` enforcement (ONCE 409 / LATEST_OVERWRITES upsert / MULTIPLE insert) | Auth path: branch on existing+policy; public path: pre-existing logic with updated error code | survey-lifecycle + public-survey policy tests | Met |
| `enrolledVia` channel-attribution swap (RFC §API surface clarified in #327) | `enrolledVia = data.channel === 'in_app' ? 'EMBEDDED_FORM' : 'SURVEY_RESPONSE'`; URL-query path removed | 2 channel-attribution tests in public-survey.test.ts | Met |
| `isScoreField` per-question Zod validation (at-most-one + rateable types only; Likert excluded) | `validateScoreFields` superRefine on Create + Update | 6 isScoreField unit tests | Met |
| Audit-plugin `requestIp` capture via Fastify trust-proxy chain | `audit.ts` enriches `request.audit.metadata` with `requestIp: request.ip` before allowlist filter | consent-mode audit-row test checks `meta.requestIp` | Met |
| Per-route audit configs for the three changed/new PATCH routes | `surveys.ts` route options with `auditAction` + `auditAllowlist` | Inspected at routes; consent-mode audit-row test verifies allowlist persistence | Met |

### Deviations

- **`description` column migration** — added in Slice 2 even though the RFC's schema-deltas list didn't include it. This is a documentation gap in the RFC, not an intentional deferral. Filed inline in this slice rather than as a separate follow-up since it's two lines of SQL.
- **`UpdateSurveySchema` type/programId fields** — added to the schema (in addition to the four already documented in the RFC). They needed to be acceptable to PATCH so the state-aware allowlist could be the source of truth for "type only editable in DRAFT" rather than absence-from-schema. The strict() + state-aware allowlist combination is the documented mechanism per RFC §"State-aware field editability".

---

## Feedback Verification

| Source | Items | Status |
|---|---|---|
| `docs/evidence/328-feature-implementation-feedback.md` (quality) | 0 unaddressed | Quality sweep pass — see feedback doc |
| Human review feedback (PR comments) | N/A | PR not yet opened (Phase 11) |

---

## Standing Work List → Evidence Promotion

- **Validation modes**: `uiValidationRequired = false`, `mobileValidationRequired = false` (Slice 2 is API surface only; UI changes belong to Slices 3/4).
- **Key decisions**:
  - Added `Survey.description` column inline in Slice 2 to unblock R26 rather than deferring (small additive migration, no data movement).
  - Auth-route PATCH /:id keeps flat response shape; new PATCH /:id/consent-mode wraps in `{ survey }` (no existing callers).
  - Updated `RESPONSE_ALREADY_EXISTS` → `POLICY_ONCE_DUPLICATE` in public.ts to align with RFC §"Endpoint error contracts".
- **Deferrals**: All UI work (editor, ConsentCollectionSubBlock, ConsentAttestationModal, state-aware disabling of inputs) → Slice 4. Embed widget → Slice 5. `?email=`/`?member_id=` page-handler removal → Slice 5.
- **Architecture-doc updates** (decided in phase 10): MA2 (state-aware PATCH field allowlist, HTTP 409 contract) is concrete enough now to be worth documenting; MA3 (`AuditEvent.metadata.requestIp` via Fastify trust-proxy chain) is also concrete. File a follow-up doc-only PR to update `apps/web/architecture.md` §4.2 with these patterns; not blocking Slice 2 merge.
