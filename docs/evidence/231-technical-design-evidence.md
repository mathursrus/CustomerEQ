# Technical Design Evidence: Survey response data model rework — Issue #231

PR: *(will be added at submission — same branch / PR #259 includes spec + RFC)*
Branch: `feature/issue-231-survey-response-data-model-rework`
Date: 2026-05-03
Agent: manohar.madhira@outlook.com (Claude, FRAIM `technical-design` job)

---

## Completeness Evidence

- Spec read and traced: `docs/feature-specs/231-survey-response-data-model-rework.md` ✅
- RFC committed/synced to branch: **Yes** (`docs/rfcs/231-survey-response-data-model-rework.md`)
- Traceability Matrix: All R1-R18 mapped — see below ✅
- Architecture gaps surfaced: 5 missing + 3 incorrectly-followed; all in RFC § Architecture Analysis ✅
- Spike outcome: No spike needed (no high-uncertainty technical risks identified) ✅
- User question answered: SURVEY_RESPONSE vs EMBEDDED_FORM distinguishable server-side via URL-query-vs-body identifier source — see RFC § Channel attribution ✅

### Traceability Matrix

Every functional requirement in `docs/feature-specs/231-survey-response-data-model-rework.md` mapped to its implementing RFC section.

| Requirement | RFC Section / Data Model | Status |
|---|---|---|
| **R1** — `SurveyResponse.memberId` stays NOT NULL | § Channel attribution + § API endpoints (auto-enroll runs before insert; § Failure modes covers auto-enroll race) | Met |
| **R2** — Drop `@@unique([surveyId, memberId])` | § Schema migration step 7 | Met |
| **R3** — `Survey.responsePolicy` enum + endpoint enforcement (`ONCE` → 409, `MULTIPLE` → insert, `LATEST_OVERWRITES` → upsert) | § API endpoints `POST /v1/public/surveys/:id/respond` 409 logic; § Schema migration step 6; § Failure modes table | Met |
| **R4** — `Member.externalId` NOT NULL + `Brand.memberIdentifierKind` enum + `@@unique([brandId, externalId])` | § Schema migration steps 1, 2, 4, 5; § File-level change list | Met |
| **R5** — `externalId` normalized (lowercased + trimmed); uniformly case-insensitive in V0; future `Brand.identifierCaseSensitive` deferred | § Schema migration step 4 (`LOWER(TRIM(email))`); § File-level `services/memberResolution.ts`; § Risks (LOWER expression-index scaling) | Met |
| **R6** — Late-arriving idempotent upsert via existing enroll endpoint; identifier change unsupported | § API endpoints `POST /v1/members/enroll` (200 idempotent response shape; 409 on identifier change); § Validation Plan row | Met |
| **R7** — All non-identifier `Member` fields optional | § Schema migration step 4 (email/phone already nullable; firstName/lastName/opt-ins remain optional in EnrollMemberSchema) | Met |
| **R8** — `consentGivenAt` optional in `EnrollMemberSchema`, server-stamp fallback | § API endpoints request schema; § File-level `apps/api/src/schemas/EnrollMemberSchema.ts` | Met |
| **R9** — New `POST /v1/public/surveys/:surveyId/respond` endpoint | § API endpoints (full request/response contract); § File-level `apps/api/src/routes/surveys/respond.ts` | Met |
| **R10** — Auto-enrollment sets `consentGivenAt=now()`, `status=ACTIVE`, `programId=survey.programId`, `enrolledVia` per channel attribution (`EMBEDDED_FORM` for URL-supplied identity, `SURVEY_RESPONSE` for form-body-supplied identity) | § Channel attribution; § API endpoints; § File-level `routes/surveys/respond.ts` | Met |
| **R11** — Brand admin picks `memberIdentifierKind` once during brand setup; surface owned by #225/#239 | RFC explicitly delegates UI to #225/#239; documents the data model the UI consumes | Met (delegated by spec) |
| **R12** — `responsePolicy` picker UI; surface owned by #241 | RFC adds the schema column; UI delegated to #241 per spec | Met (delegated by spec) |
| **R13** — Acme demo flow works unchanged | § Validation Plan row "Demo flow (Maya enrolls...)"; § Test Matrix `acme-demo-flow.spec.ts` E2E | Met |
| **R14** — Existing surveys migrate to `MULTIPLE` | § Schema migration step 6 (existing rows take the new default); reversal of original spec position; rationale in spec | Met |
| **R15** — `Member.enrolledVia` enum (`MANUAL_API \| BULK_IMPORT \| SURVEY_RESPONSE \| EMBEDDED_FORM \| CLERK_OAUTH`) | § Schema migration steps 2, 4 (backfill as `MANUAL_API`); § Channel attribution rule for SURVEY_RESPONSE vs EMBEDDED_FORM | Met |
| **R16** — Brand-default + per-survey override consent text; URL fields on Brand | § Schema migration steps 1, 6; § File-level `services/consentResolver.ts` (resolves `override ?? default`) | Met |
| **R17** — Empty-string `Survey.consentTextOverride` suppresses on-form consent UI; per-survey written attestation | § Schema migration step 6 (`consentSuppressedAttestedBy`, `consentSuppressedAttestedAt` columns); § Validation Plan row "Brand admin saves a survey with `consentTextOverride = ''`..." | Met |
| **R18** — Audit-only IP-derived enrollment-signal capture (SHA-256 hashed IP + ISO country) on `LoyaltyEvent.payload.enrollmentSignals` for `SURVEY_RESPONSE` / `EMBEDDED_FORM` paths | § Enrollment-signal capture (audit-only, no schema change); RFC documents shape, IP source order, geo-provider candidates, hero #6 SLA budget, erasure path, forward-compat to future `Member.location` | Met |

**Result**: 18 / 18 Met. Zero Unmet. No "wave-hands" coverage.

### Validation Alignment

Each spec validation requirement covered by RFC's § Validation Plan + § Test Matrix:

| Spec validation requirement | RFC coverage |
|---|---|
| Unit tests for R1-R18 (P0 → unit + integration + E2E) | § Test Matrix § Unit (5 test files listed by name) |
| Integration tests against real Postgres+Redis (auto-enroll flow, responsePolicy, case-insensitive lookup, race) | § Test Matrix § Integration (5 test files listed by name) |
| E2E for Acme demo + ArtistOS-style flow | § Test Matrix § E2E (3 spec files; capped at 3 per repo pattern) |
| Synthetic load test, p99 < 1s synchronous; <15min downstream BullMQ (hero #6) | § Validation Plan + § Risks "Hero #6 SLA regression"; § Observability metric `survey_response_persist_duration_seconds` + alert `survey_response_persist_p99_above_2s` |
| GDPR erasure including `externalId` | § Validation Plan row + § Test Matrix `gdpr-erasure-with-external-id.test.ts` |
| Migration collision-detection runs as CI gate | § Validation Plan row + § File-level `packages/database/scripts/check-identifier-collisions.ts` |

### User Question Resolution

The user explicitly asked: *"Technical design should clarify whether or not it is possible to capture difference between Survey Response vs Embedded form."*

**Answered**: Yes, server-side, deterministically. RFC § Channel attribution gives the rule, the rationale, what it is NOT, and a future hardening path (signed URL params). The `MemberEnrolledVia` enum stays at five values per spec R15.

### Architecture Gaps for User Review

5 patterns missing from `docs/architecture/architecture.md` (RFC § Architecture Analysis details each):

1. Synchronous-fork-of-event-driven-default (§6 has the AI exception; auto-enrollment is a sibling exception)
2. Polymorphic identifier with brand-level identifier kind (§4 Member component currently describes email-as-identifier)
3. Brand-default-with-survey-override storage hierarchy for consent text (§6 candidate)
4. Audit log via dedicated row vs separate table (§6 candidate, rule-of-thumb)
5. Server-detectable channel attribution rule (§6 candidate)

3 places where `architecture.md` will go stale post-#231 (must be fixed in implementation PR):

1. §5.3 Webhook Ingestion sequence diagram references `Lookup member by email + brandId` → becomes `externalId + brandId`
2. §5.1 Event Ingestion sequence diagram references `Validate member exists + consent given` as a precondition → survey-respond path *creates* the member when missing
3. §4 Member component description needs the polymorphic-identifier update

No security-critical gaps. None block design submission.

### PR Comment History

| PR Comment | How Addressed |
|---|---|
| *(No prior PR comments on the RFC — initial design submission. Spec round 1 feedback already addressed in commit `867fdaf` per `docs/evidence/231-feature-specification-feedback.md`.)* | N/A |

---

## Phase Completion

| Phase | Status | Evidence |
|---|---|---|
| `requirements-analysis` | ✅ | seekMentoring complete; spec + architecture + schema + compliance config all reviewed |
| `design-authoring` | ✅ | RFC `docs/rfcs/231-survey-response-data-model-rework.md` written; spike not needed (low uncertainty) |
| `architecture-gap-review` | ✅ | RFC § Architecture Analysis added with 5 missing + 3 incorrectly-followed patterns documented |
| `design-completeness-review` | 🔄 | This document (Traceability Matrix all-Met; user-question-resolution captured; architecture gaps surfaced for PR review) |
| `design-submission` | ⏳ | Next phase |
| `address-feedback` | ⏳ | Awaiting PR review |
| `retrospective` | ⏳ | Post-merge |
