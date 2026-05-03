# RFC: Survey response data model rework — auto-enrollment, polymorphic identifier, recurring responses

Issue: #231
Owner: Claude (FRAIM technical-design job)
Date: 2026-05-03
Status: Draft
Spec: `docs/feature-specs/231-survey-response-data-model-rework.md`

---

## Customer

Brand admin / integrator embedding CustomerEQ surveys; survey responder; bulk-migration importer. (Full personas in the spec.)

## Customer Problem Being Solved

Today every survey responder must be a pre-existing `Member` keyed by case-sensitive `email`, with `(surveyId, memberId)` unique. This excludes the most common feedback patterns (NPS quarterly, post-support CSAT, embedded surveys for non-members) and forces customers like ArtistOS to gate behind feature flags. (Full pain analysis in the spec.)

## User Experience That Will Solve the Problem

This is mostly a data-plane change; the spec covers the two visible touchpoints (brand-setup picker + survey form). This RFC is about *how* — file layout, request/response contracts, migration ordering, the synchronous-vs-async split that protects hero #6, and how the server distinguishes the two enrollment channels (`SURVEY_RESPONSE` vs `EMBEDDED_FORM`).

---

## Technical Details

### File-level change list

| File | Change |
|---|---|
| `packages/database/prisma/schema.prisma` | Add fields to `Brand` (5), `Member` (2 + retype `enrolledVia`), `Survey` (4); add 3 enums (`MemberIdentifierKind`, `ConsentMode`, `MemberEnrolledVia`, `ResponsePolicy`); change `Member` and `SurveyResponse` unique constraints. |
| `packages/database/prisma/migrations/{ts}_survey_response_rework/migration.sql` | Single transactional migration — see §Schema migration. |
| `packages/database/scripts/check-identifier-collisions.ts` | New pre-migration guard. Runs against `DATABASE_URL`, fails non-zero with a CSV of `(brandId, lower(email))` collisions if any exist. Wired into CI as a pre-migration gate. |
| `apps/api/src/routes/members/enroll.ts` | Existing enroll endpoint; relax `consentGivenAt` to optional with server-stamp fallback (R8); switch member lookup from `(brandId, email)` to `(brandId, externalId)`; implement idempotent upsert with last-write-wins on non-identifier fields (R6); set `enrolledVia = MANUAL_API` (R15). |
| `apps/api/src/routes/surveys/respond.ts` | **NEW**. `POST /v1/public/surveys/:surveyId/respond` (no auth — public endpoint, brand inferred from survey). Auto-enrolls if not found. Sets `enrolledVia = SURVEY_RESPONSE` or `EMBEDDED_FORM` per the rule in §Channel attribution. |
| `apps/api/src/services/memberResolution.ts` | **NEW**. `resolveOrEnrollMember(brandId, identifier, opts)` — single call site for all auto-enroll paths. Validates identifier shape per `Brand.memberIdentifierKind`. |
| `apps/api/src/services/consentResolver.ts` | **NEW**. `getConsentTextForSurvey(surveyId)` returns `{ text, isSuppressed, sourcedFrom: 'override' | 'brand-default' }` — encapsulates R16/R17 hierarchy. |
| `apps/api/src/schemas/EnrollMemberSchema.ts` | Make `consentGivenAt` optional. Drop `email` requirement; introduce `memberId: string` (the identifier value) + optional `email`/`phone` PII fields. |
| `apps/web/src/app/(member)/enroll/page.tsx` (existing) | If brand is in `EXPLICIT` consentMode, render brand's `consentTextDefault` with privacy/terms links (replaces hard-coded copy). |
| `apps/worker/src/jobs/erasure.ts` | Add `externalId` to the field-zero list (GDPR Art. 17 / CCPA §1798.105). |
| `apps/api/src/services/dataExport.ts` | Add `externalId` and `enrolledVia` to the export payload (GDPR Art. 15 / CCPA §1798.110). |

### API endpoints (OpenAPI deltas)

#### `POST /v1/members/enroll` (modified)

Request:
```typescript
{
  programId: string;
  memberId: string;          // the identifier value — interpreted per Brand.memberIdentifierKind
  email?: string;            // PII sidecar; required when identifierKind = EMAIL and memberId is not already an email shape
  phone?: string;            // PII sidecar; required when identifierKind = PHONE in E.164 form
  firstName?: string;
  lastName?: string;
  emailOptIn?: boolean;
  smsOptIn?: boolean;
  consentGivenAt?: string;   // ISO 8601; preserved verbatim if present, server-stamps now() if absent (R8)
}
```

Response 201:
```typescript
{ memberId: string; pointsBalance: number; enrolledVia: 'MANUAL_API'; programName: string; }
```

Response 200 (idempotent re-enroll, R6 — same `(brandId, externalId)` already exists):
```typescript
{ memberId: string; pointsBalance: number; enrolledVia: <existing-value>; programName: string; updated: true; updatedFields: string[]; }
```

Response 409: identifier change attempted on existing member (different `externalId` for an otherwise-matching context — V0 unsupported).

#### `POST /v1/public/surveys/:surveyId/respond` (NEW)

Public — no auth. Brand resolved from `survey.brandId`.

Request:
```typescript
{
  memberId?: string;         // identifier value; OPTIONAL because URL query may carry it (see Channel attribution)
  email?: string; phone?: string;  // optional PII sidecar collected on form
  firstName?: string; lastName?: string;
  consent?: boolean;         // required when Brand.consentMode = EXPLICIT and survey.consentTextOverride !== ''
  answers: Record<string, unknown>;
  channel?: 'email' | 'in_app' | 'link' | 'sms';  // existing field on SurveyResponse
}
```

Query string:
```
?member_id={value}    // OPTIONAL — when present, the URL-supplied identifier wins
```

Response 201: `{ surveyResponseId, memberId, autoEnrolled: boolean, enrolledVia: 'SURVEY_RESPONSE' | 'EMBEDDED_FORM' | null }`

Response 409 (`responsePolicy = ONCE` + prior response exists): `{ error: 'RESPONSE_ALREADY_EXISTS', priorResponseId }`.

Response 400: missing identifier (neither URL query nor body), missing required `consent` when EXPLICIT mode, identifier shape doesn't match `Brand.memberIdentifierKind`.

### Channel attribution: SURVEY_RESPONSE vs EMBEDDED_FORM (the user's design question)

**Yes — the server can distinguish these deterministically.** The rule:

```
if (request.query.member_id is present and non-empty)
    enrolledVia = 'SURVEY_RESPONSE'        // host knew the responder
else if (request.body.memberId is present and non-empty)
    enrolledVia = 'EMBEDDED_FORM'          // responder self-identified on the form
else
    return 400 NO_IDENTIFIER
```

Why this rule is the right one:

- **It's a real semantic difference.** A URL-supplied `member_id` is evidence that *something authoritative* (the host's SDK, a personalized email-send pipeline, a logged-in app session) knew the responder before the form rendered. A form-body `memberId` is just text the responder typed — could be their email, could be anyone's. The trust surface differs.
- **It's verifiable server-side without client cooperation.** The handler simply inspects `request.query` vs `request.body`. No `X-Source: ...` header that the client could lie about; no Origin/Referer dependency.
- **It survives round-tripping.** Embedded-widget JS that receives `memberId` from its host SDK can choose to put it in the URL query when navigating to the survey URL — that's the integrator's deliberate signal "I knew this person." Forms that collect identifier as a field stay on the form-body path.
- **The branch closes cleanly when both sources are present.** URL query wins (more authoritative). The body's `memberId` is then ignored for attribution.

What this rule is NOT:

- **Not a security gate.** A URL query is still client-supplied; nothing stops a malicious party from forging `?member_id=victim@example.com`. The rule is about *attribution and traceability*, not *authentication*. R10 still server-stamps `consentGivenAt = now()` so the consent signal is system-supplied either way.
- **Not "embedded vs hosted" in the deployment sense.** A survey rendered inside an iframe on the brand's site can still receive `member_id` via URL query — that's still SURVEY_RESPONSE, not EMBEDDED_FORM. The distinction is about identifier provenance, not the rendering surface.

Future hardening (out of V0): signed `member_id` query param (HMAC over `(surveyId, memberId, timestamp)` with a brand-specific shared secret). When present and verified, set `enrolledVia = SURVEY_RESPONSE` *and* tag a separate `memberIdentitySignedBy` field with the verifying brand. Open as a follow-up if/when a customer needs the higher-trust signal — not in V0.

The `MemberEnrolledVia` enum stays at five values: `MANUAL_API | BULK_IMPORT | SURVEY_RESPONSE | EMBEDDED_FORM | CLERK_OAUTH`. Spec R15 is preserved.

### Schema migration (single transactional file)

```sql
-- BEGIN tx

-- 1. Brand additions (R4, R16)
ALTER TABLE brands ADD COLUMN "memberIdentifierKind" "MemberIdentifierKind" NOT NULL DEFAULT 'EMAIL';
ALTER TABLE brands ADD COLUMN "consentMode" "ConsentMode" NOT NULL DEFAULT 'EXPLICIT';
ALTER TABLE brands ADD COLUMN "consentTextDefault" TEXT;
ALTER TABLE brands ADD COLUMN "privacyPolicyUrl" TEXT;
ALTER TABLE brands ADD COLUMN "termsUrl" TEXT;

-- 2. Member additions (R4, R7, R15)
ALTER TABLE members ADD COLUMN "externalId" TEXT;       -- NULL temporarily, backfilled in step 4
ALTER TABLE members ADD COLUMN "enrolledVia" "MemberEnrolledVia";  -- NULL temporarily

-- 3. Pre-migration collision guard runs as a CI step BEFORE this SQL; if collisions exist the migration never starts.

-- 4. Backfill externalId from email (lowercased, trimmed). enrolledVia = MANUAL_API for pre-existing rows.
UPDATE members SET
  "externalId" = LOWER(TRIM("email")),
  "enrolledVia" = 'MANUAL_API';

-- 5. Promote to NOT NULL + new unique constraint (R4)
ALTER TABLE members ALTER COLUMN "externalId" SET NOT NULL;
ALTER TABLE members ALTER COLUMN "enrolledVia" SET NOT NULL;
CREATE UNIQUE INDEX "members_brandId_externalId_key" ON members("brandId", "externalId");
DROP INDEX "members_brandId_email_key";   -- old constraint
CREATE INDEX "members_brandId_externalId_idx" ON members("brandId", "externalId");

-- 6. Survey additions (R3, R16, R17)
ALTER TABLE surveys ADD COLUMN "responsePolicy" "ResponsePolicy" NOT NULL DEFAULT 'MULTIPLE';
ALTER TABLE surveys ADD COLUMN "consentTextOverride" TEXT;
ALTER TABLE surveys ADD COLUMN "consentSuppressedAttestedBy" TEXT;
ALTER TABLE surveys ADD COLUMN "consentSuppressedAttestedAt" TIMESTAMP(3);
-- Existing rows take the default (MULTIPLE) per R14 — no UPDATE needed.

-- 7. SurveyResponse: drop old unique, add index (R2)
DROP INDEX "survey_responses_surveyId_memberId_key";
CREATE INDEX "survey_responses_surveyId_memberId_idx" ON survey_responses("surveyId", "memberId");

-- COMMIT tx
```

Rollback: every step is reversible. If something fails mid-migration, Postgres aborts the tx; no partial state. Out-of-tx rollback (after a successful migration that's later regretted) requires a separate `down` migration: drop `externalId`-based indices, restore `email`-based unique, drop new columns. Backwards-compat tested in CI on a snapshot of staging data.

### Enrollment-signal capture (R18) — audit-only, no schema change

Per spec R18: when a `SURVEY_RESPONSE` or `EMBEDDED_FORM` auto-enroll fires, the `LoyaltyEvent.payload` JSON gets an `enrollmentSignals` object. **No schema change** — `LoyaltyEvent.payload` is already `Json?` (existing column at `schema.prisma:416`, described as "raw event payload"). This is exactly the right semantic.

**Shape:**
```typescript
LoyaltyEvent.payload = {
  // ... existing payload fields (survey answers, scores, etc.)
  enrollmentSignals?: {
    ipHash: string;        // SHA-256 hex; salted with brandId
    ipCountryIso: string | null;  // 2-letter ISO; null if geo lookup failed or skipped
    capturedAt: string;    // ISO 8601
  };
}
```

`enrollmentSignals` is present **only on the loyalty event for the auto-enroll moment**. Subsequent events for the same member do not include it (that's the audit-trail point — capture once, at enrollment, not every interaction).

**IP source order:**
1. `request.headers['cf-connecting-ip']` (if behind Cloudflare; CF strips spoofed values)
2. `request.headers['x-forwarded-for']` (first hop, if behind a trusted reverse proxy)
3. `request.ip` (Fastify's default, falls back to the socket peer)

The selected IP is hashed before storage — raw IP is **never** persisted, even in logs. Hash salt is `Brand.id` so the same IP across brands does not collide (prevents cross-tenant correlation).

**IP-geo provider:**
Pick at implementation time; deferred decision (out of RFC scope). Candidates:
- **Cloudflare `CF-IPCountry` header** — free if behind CF; pre-resolved by the edge; zero added latency
- **MaxMind GeoLite2 self-hosted** — free, ~25MB DB embedded in the API container; ~5ms lookup
- **ip-api.com free tier** — external HTTP call; adds 100-200ms; rate-limited
- Default fallback: if no provider is configured, write `ipCountryIso: null` and proceed

**Hero #6 SLA:** the IP-hash + country-lookup path adds <10ms when CF or MaxMind is used; <250ms with ip-api fallback. Always within the <1s p99 budget. If lookup fails or times out (>500ms), the handler proceeds with `ipCountryIso: null` — never block the submit on geo-lookup.

**Erasure (GDPR Art. 17 / CCPA §1798.105):** `LoyaltyEvent.payload.enrollmentSignals` is zeroed alongside other PII when a member's erasure runs. The existing erasure job already walks `LoyaltyEvent` rows scoped to the erased `memberId`; just extend the payload-zeroing logic to scrub the `enrollmentSignals` sub-object.

**Forward-compatible to a future `Member.location` (or `Member.country`) field:** when a real feature lands that needs a structured location column on `Member`, a one-time backfill batch job populates the new column from `LoyaltyEvent.payload.enrollmentSignals.ipCountryIso` (joining on `(brandId, memberId)`, taking the earliest event). No schema choice is forced now; the data exists when the choice is made.

### Failure modes & timeouts

| Failure | Behavior |
|---|---|
| Submit endpoint, identifier shape doesn't match `Brand.memberIdentifierKind` (e.g., PHONE brand receives a non-E.164 string) | 400 `IDENTIFIER_SHAPE_INVALID` with the expected shape in the message. |
| Submit endpoint, brand is in `EXPLICIT` mode and `consent: true` is missing from body | 400 `CONSENT_REQUIRED` (unless `Survey.consentTextOverride === ''` → R17 path; then no checkbox required). |
| Auto-enroll race: two concurrent submits for the same `(brandId, externalId)` | The second insert hits the unique constraint, catches the error, retries the SELECT; both submits succeed and produce two `SurveyResponse` rows tied to the same auto-enrolled `Member`. Idempotent at the Member level. |
| `responsePolicy = ONCE` and a prior response exists | 409 with `{ priorResponseId }` — endpoint does not auto-enroll a new member if the resolved member already has a response on this survey. |
| BullMQ event publish fails after the response is persisted | Response succeeds (return 201); the event is retried by BullMQ's standard retry policy. Hero #6 SLA is on the worker side; the synchronous path's job is to persist + enqueue. |
| Migration collision-detection fails on staging | Migration aborts; CI fails the deploy; the engineer reads the CSV report and decides whether to merge duplicates manually before proceeding. No automatic merge — too risky. |
| IP-geo lookup fails or times out (R18) | Submit succeeds with `enrollmentSignals.ipCountryIso = null`. Never blocks the submit. Logged at `warn` level. |

Timeouts: synchronous submit handler aims for p99 < 1s. Hard timeout 5s. The auto-enrollment path adds one DB insert + one BullMQ enqueue; total ~3 round-trips on local Postgres.

### Telemetry & analytics

Logs (existing pino logger):
- `member.auto_enrolled` `{ brandId, memberId, enrolledVia, surveyId?, ipCountryIso? }`  (raw IP never logged — only ISO country if R18 capture succeeded)
- `survey.response_persisted` `{ surveyId, memberId, responsePolicy, autoEnrolled }`
- `survey.consent_suppressed_attestation` `{ surveyId, attestedBy, attestedAt }` — emitted on save, not on submit

Metrics (existing Prometheus surface):
- `survey_response_persist_duration_seconds` (histogram, label: `auto_enrolled`)
- `member_auto_enroll_total` (counter, label: `enrolled_via`)
- `survey_response_rejected_total` (counter, label: `reason` — `IDENTIFIER_SHAPE_INVALID | CONSENT_REQUIRED | RESPONSE_ALREADY_EXISTS`)

Alerts (existing Grafana stack):
- `survey_response_persist_p99_above_2s` for 5 min — pages oncall (hero #6 protection)
- `survey_response_rejected_total{reason="IDENTIFIER_SHAPE_INVALID"} > 100/hr` — likely a misconfigured brand integration; warn channel

---

## Confidence Level

**85**. Schema patterns are standard, migration is bounded, channel-attribution rule is unambiguous and server-detectable. The 15% uncertainty:
- Real-world consent UX of the embedded-form widget — design will need iteration with #241 once the survey-creator UX is sketched.
- Whether the bulk-migration `consentGivenAt` preservation handles edge-case timezone-stripped strings; unit tests cover the common shapes but legacy data may surprise us.
- Performance of the `LOWER(externalId)` expression index at scale — fine for V0 (test customers only), but worth re-measuring when we onboard a brand with millions of members.

## Validation Plan

| User Scenario | Expected Outcome | Validation method |
|---|---|---|
| Brand admin sets `memberIdentifierKind = PHONE`; submits enroll API with phone in E.164 | Member created with `externalId` = lowercased phone; `phone` column populated; `enrolledVia = MANUAL_API` | API + DB validation |
| Embedded survey form: responder visits `/surveys/abc?member_id=user@x.com` (URL param), submits | Member resolved (or auto-enrolled with `enrolledVia = SURVEY_RESPONSE`); response persisted | API + DB validation |
| Embedded survey form: responder visits `/surveys/abc` (no URL param), types email into form, submits | Member auto-enrolled with `enrolledVia = EMBEDDED_FORM` | API + DB validation |
| Two concurrent submissions, same identifier, same survey, `responsePolicy = MULTIPLE` | Both succeed; one `Member` row; two `SurveyResponse` rows; no unique-constraint violation | Integration test with concurrent fetch |
| `responsePolicy = ONCE`, second submission | 409 with `priorResponseId` | API validation |
| Bulk-migration script POSTs 1000 enrolls with integrator-supplied `consentGivenAt` | All preserved verbatim; rerunning the import is idempotent (no duplicate members, late-arriving fields update) | Integration test with fixture CSV |
| Demo flow (Maya enrolls, then submits survey) | Unchanged behavior; `enrolledVia = MANUAL_API` for Maya | E2E (Playwright) |
| Brand in `EXPLICIT` mode, survey form submitted without `consent: true` | 400 `CONSENT_REQUIRED` | API validation |
| Brand admin saves a survey with `consentTextOverride = ''` and admin attestation | Save succeeds; `consentSuppressedAttestedBy` and `consentSuppressedAttestedAt` populated; subsequent submit doesn't render checkbox | E2E + DB validation |
| GDPR erasure runs against an auto-enrolled member | All PII fields zeroed including `externalId`; survey responses retain `memberId` reference but no recoverable PII | Integration test |
| Pre-migration collision guard finds 5 `(brandId, lower(email))` collisions in fixture | Migration aborts; CSV report printed; CI fails | CI step validation |

## Test Matrix

### Unit (`apps/api/src/**/*.test.ts`, Vitest, mocks OK)

- `services/memberResolution.test.ts` — identifier-shape validation per `MemberIdentifierKind`; idempotent upsert behavior; case-insensitive lookup; handling of integrator-supplied vs server-stamped `consentGivenAt`.
- `services/consentResolver.test.ts` — R16 hierarchy resolution; R17 empty-string suppression; null brand default + non-null override behavior.
- `routes/surveys/respond.test.ts` — channel attribution rule: URL query → `SURVEY_RESPONSE`; body only → `EMBEDDED_FORM`; both present → URL wins; neither → 400. `responsePolicy` enforcement at all three values. R18 enrollment-signal capture: assert `LoyaltyEvent.payload.enrollmentSignals` populated on auto-enroll paths only, never on resolved-existing-member paths; assert raw IP never persisted; assert IP-geo failure → null country, not error.
- `routes/members/enroll.test.ts` — `consentGivenAt` optional with server-stamp fallback; integrator-supplied value preserved; idempotent on `(brandId, externalId)`.
- `schemas/EnrollMemberSchema.test.ts` — Zod schema accepts new shape; rejects malformed identifier values per kind.

Modified: `apps/api/src/routes/members/enroll.test.ts` (existing — re-shape for new schema).

### Integration (`apps/api/test/integration/**/*.test.ts`, real Postgres+Redis, no mocks)

- `survey-response-auto-enroll.test.ts` — full submit-to-persist flow; verifies `Member.enrolledVia` set correctly per channel; verifies BullMQ event published.
- `survey-response-policy-enforcement.test.ts` — ONCE / MULTIPLE / LATEST_OVERWRITES against a real DB.
- `bulk-migration-import-idempotency.test.ts` — re-runs the same 100-row import twice; asserts no duplicates, late-arriving fields updated, audit log captured.
- `concurrent-auto-enroll-race.test.ts` — fires N concurrent requests with same `(brandId, externalId)`; asserts exactly one Member row created, all responses persisted.
- `gdpr-erasure-with-external-id.test.ts` — runs erasure job; asserts `externalId`, `email`, `phone`, names all zeroed; survey responses retained.

Modified: `apps/api/test/integration/earn-points-flow.test.ts` (uses Member.email — adapt to new schema).

### E2E (`apps/web/test/e2e/*.spec.ts`, Playwright, no mocks)

- `acme-demo-flow.spec.ts` — Maya enrolls → submits survey. Existing test, retargeted at the new schema.
- `embedded-survey-non-member.spec.ts` — fresh browser, navigate to survey URL with no member_id, fill identifier on form, submit; verify auto-enrolled.
- `embedded-survey-with-url-param.spec.ts` — navigate with `?member_id=`, verify form skips identifier field, submit; verify `SURVEY_RESPONSE` attribution.

Cap at 3 E2E tests — per the existing project pattern (most flows are integration-tested).

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Migration collision detection misses a row | Low | High (corrupted lookup post-migration) | Pre-migration script enumerates *all* `(brandId, lower(email))` pairs; not a sampled check. Validates count matches `members` table count. CI fails if any collision row found. |
| `LOWER(externalId)` expression index slower than B-tree at scale | Medium (at >1M members per brand) | Medium (lookup latency) | Postgres expression indices have well-known overhead; benchmark when first brand crosses 100k members. Mitigation: switch to a stored normalized column (`externalIdLower`) with a regular index — forward-compatible. |
| Brand admin enables `IMPLIED_ON_SUBMIT` without legal review and ships GDPR-violating consent | Medium | High (legal liability) | Brand-setup UI requires explicit attestation checkbox before `IMPLIED_ON_SUBMIT` saves. Telemetry: log `brand.consent_mode_changed_to_implied` events; quarterly compliance audit reviews them. |
| Auto-enrollment race creates orphan member rows | Low | Low | Unique constraint on `(brandId, externalId)` prevents duplicate Member rows. The orphan case (Member created, response insert fails) is handled by transaction wrapping the auto-enroll + response insert. |
| `EMBEDDED_FORM` vs `SURVEY_RESPONSE` attribution lies (forged URL params) | Medium | Low (attribution-only, not security) | Documented limitation. The rule is for traceability, not auth. Future signed-param hardening filed as a follow-up if/when a customer needs higher-trust attribution. |
| Hero #6 SLA regression from synchronous auto-enroll | Low | High (differentiator) | Synthetic load test in CI: 100 concurrent submits → p99 < 1s. Alert on `survey_response_persist_p99_above_2s`. Auto-enroll adds ~1 DB insert; budget is well-protected. |
| Erasure job fails to zero `externalId` (forgotten field) | Low | High (GDPR violation) | Erasure job test (integration) explicitly asserts `externalId` is zeroed. CI gate. |

## Spike Findings

None — no high-uncertainty technical risks identified. All patterns are standard (Prisma upsert, Postgres expression-index, BullMQ enqueue, transactional migration with pre-flight guard).

## Observability

- Logs: see §Telemetry above. All structured pino, with `brandId`, `memberId`, `surveyId` correlation keys.
- Metrics: histogram + counters listed in §Telemetry.
- Alerts: 2 listed in §Telemetry — one paging (hero #6 SLA), one warn (integration health).
- Dashboards: existing CustomerEQ Grafana board adds three panels: auto-enroll rate by `enrolledVia`, response-persist p99, identifier-validation reject rate. Owned by oncall rotation.

---

## Architecture Analysis

Cross-checked the RFC against `docs/architecture/architecture.md` (the project's authoritative architecture doc).

### Patterns Correctly Followed

- **Multi-tenant `brandId` scoping** (architecture §4 Key Components, project rule R6): Every new field and query in this RFC is `brandId`-scoped (`Brand`, `Member.externalId` unique-by-brand, `Brand.consentTextDefault`, etc.). `brandId` is never accepted from request body — it's derived from `survey.brandId` for public endpoints and from the verified JWT for authenticated ones.
- **Event-driven loyalty actions via BullMQ** (architecture §5.1 + project rule R5): Survey submit handler enqueues to the existing `loyalty-events` queue *after* persisting the response. The synchronous handler does only auto-enroll + persist; rule evaluation, points award, and campaign triggers stay in workers (hero #6 SLA preserved).
- **Soft-delete + erasure** (architecture §10 Compliance Architecture): RFC explicitly extends the erasure-job field-zero list to include `externalId`. Survey responses retain `memberId` reference (the existing pattern) but PII is wiped.
- **Prisma + PostgreSQL with transactional migrations** (architecture §2 Tech Stack, §11 ADRs): Single transactional migration with pre-flight collision guard matches existing patterns in the repo (e.g., `packages/database/scripts/check-enum-migrations.sh`).
- **Public endpoints — current convention** (architecture §5.3 Webhook Ingestion, §5.4 External Signal Ingestion): RFC's new `POST /v1/public/surveys/:surveyId/respond` follows the `/v1/public/...` URL prefix the repo already uses for unauthenticated routes, with `brandId` derived from a server-validated path id.
- **Auth via Clerk** (architecture §2): The `CLERK_OAUTH` `enrolledVia` value pre-populates members created by the Clerk webhook (#239) without changing the auth boundary.

### Patterns Missing from Architecture (candidates to add)

These are real patterns the RFC depends on but the architecture doc doesn't currently document. Each is a candidate for an architecture-doc update — I have not made any changes to `architecture.md` in this phase per FRAIM workflow; documenting here for discussion.

1. **Synchronous-fork-of-event-driven-default** (§6 Design Patterns currently lists one exception — the synchronous AI on note creation). RFC's auto-enrollment in the survey-submit handler is a second such exception: the auto-enroll DB insert and consent stamping must happen synchronously *before* the BullMQ event is published, otherwise downstream rule-evaluation has no `Member` to attribute the response to. Suggested addition to architecture §6: a third bullet documenting "Synchronous auto-enrollment on first survey response" as a sibling exception, with the rationale that the event pipeline requires a `memberId` and creating it post-hoc would race with rule evaluation.

2. **Polymorphic identifier with brand-level identifier kind** (architecture §4 Member component currently describes email-as-identifier). RFC introduces `Brand.memberIdentifierKind` + `Member.externalId` as the canonical lookup. Suggested addition: §4 Member section documents the new model — `externalId` is the canonical lookup column; `email` and `phone` are PII sidecars; identifier kind is a brand-level decision and is V0-immutable per brand.

3. **Brand-default-with-survey-override storage hierarchy for consent text** (compliance / R16). Pattern: brand-wide setting + per-resource override resolved as `override ?? default`. Suggested addition to §6 Design Patterns: "Brand-default with per-resource override" as a named pattern, since this same shape will likely apply to other future settings (rate limits, branding, etc.).

4. **Audit log via dedicated row on the source entity** (R17's `consentSuppressedAttestedBy` + `consentSuppressedAttestedAt` columns, plus the spec's mention of a future `member_profile_audit` table). The existing pattern in the repo varies: some audit data is denormalized onto the row (e.g., `Member.consentVersion`), some lives in separate tables (e.g., `WebhookDeliveryLog`). Suggested addition: a §6 entry calling out the rule-of-thumb — denormalize audit attestations when there's exactly one event per row; use a separate audit table when N events per row are expected.

5. **Server-detectable channel attribution rule** (RFC's §Channel attribution). The general pattern of "signal source = URL query vs body" is currently undocumented; this RFC is the first to use it. If we ever introduce a similar attribution problem on another endpoint, the same rule should apply consistently. Suggested addition to §6: this could be a one-liner that just records the choice as a default convention for any future "host-supplied vs responder-supplied" attribution decisions.

### Patterns Incorrectly Followed (design corrections needed in *architecture*, not in RFC)

These are places where the architecture doc itself will become stale once #231 lands. The RFC is correct; the architecture doc needs updating during the address-feedback phase.

1. **§5.3 Webhook Ingestion sequence diagram** says `API->>DB: Lookup member by email + brandId`. Post-#231 this becomes `Lookup member by externalId + brandId`. The diagram and surrounding text need updating.

2. **§5.1 Event Ingestion sequence diagram** says `API->>DB: Validate member exists + consent given` as a precondition before enqueueing. Post-#231 the survey-submit path *creates* the member when missing instead of rejecting. The hero-flow diagram needs a small fork annotation: "for survey-response events, member is auto-enrolled if not found."

3. **§4 Member component description** likely needs the polymorphic-identifier update (gap #2 above).

None of these are bugs in the RFC — they're downstream documentation updates that need to land alongside #231's implementation, in the same PR as the migration. Calling them out so they don't get forgotten when implementation starts.

### Recommendation

Treat gaps 1-5 (Patterns Missing from Architecture) as items for user review on PR #259. Treat the three Incorrectly Followed items as part of the implementation PR's deliverables (not separate work). I'll capture these in the spec's cross-issue table during the design-completeness-review phase if they're not already there.
