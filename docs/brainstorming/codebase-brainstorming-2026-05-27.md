# Codebase Brainstorming: Switching a Brand's Member Identifier Kind After Members Exist

**Date:** 2026-05-27
**Filed as:** [#524](https://github.com/mathursrus/CustomerEQ/issues/524)
**Focus Area:** Member identification migration — letting a customer change their member identifier method (Email ↔ Phone ↔ Customer ID) once members are already enrolled, with full data migration, progress tracking, and catch-up of data that arrives mid-migration.

---

## Executive Summary

A brand picks **one** member identifier kind — `EMAIL`, `PHONE`, or `CUSTOMER_ID` — at onboarding. That choice becomes the canonical lookup key for every member (`Member.externalId`) and the shape every ingress path validates against. **Once a single member exists, the choice is hard-locked**: the API returns `409 MEMBER_IDENTIFIER_KIND_LOCKED` and the settings UI disables the radios and points the customer at a `mailto:` "request a managed migration" link — *a capability that does not exist.* No code re-keys members, no batch tracks progress, and no path reconciles data that lands during a switch.

This is **~0% built** as a switch/migration capability, but **~70% of the supporting scaffolding already exists**: a single member-resolution ingress, a batch+worker progress-tracking pattern (`SurveyImportBatch`), the BullMQ queue infrastructure, and an audit trail that already records `memberCountAtChange`. The work is to build the migration on top of these, not to invent new infrastructure.

**Key insight:** Because `externalId` is the *only* lookup key and inbound data never stops arriving (surveys auto-enroll, the API enroll endpoint, bulk import, distribution batches, Clerk OAuth), the hard part is not the bulk re-key — it is the **catch-up window**: data keyed by the *old* identifier that lands while the migration is in flight must still resolve, and must reconcile to the migrated identity afterward.

---

## What Currently Exists

| Capability | Evidence | Notes |
|---|---|---|
| Brand-level identifier kind | `packages/database/prisma/schema.prisma:203` — `Brand.memberIdentifierKind MemberIdentifierKind @default(EMAIL)` | Enum `EMAIL \| PHONE \| CUSTOMER_ID` (schema.prisma:167-171) |
| Canonical member lookup key | `schema.prisma:330,374` — `Member.externalId` (lowercased+trimmed), `@@unique([brandId, externalId])` | The single key all lookups use; `email`/`phone` are nullable PII sidecars |
| Single member-resolution ingress | `apps/api/src/services/memberResolution.ts:102-223` — `resolveOrEnrollMember()` | Shape-validates the identifier against the brand kind (`validateIdentifierShape`, lines 53-92), then `findUnique({ brandId_externalId })` |
| Identifier-kind selection at onboarding | `apps/api/src/routes/admin-brand-profile.ts:73,384-411` (PATCH) + `MemberIdentificationSection.tsx` | Settable freely **only before any member exists** |
| Hard lock when members exist (API) | `apps/api/src/routes/admin-brand-profile.ts:322-335` | Returns `409` with `code: 'MEMBER_IDENTIFIER_KIND_LOCKED'` and `memberCount` when `memberCount > 0` |
| Hard lock when members exist (UI) | `apps/web/src/app/(admin)/admin/settings/organization/components/sections/MemberIdentificationSection.tsx:40,89-102` | Radios disabled; renders "Contact CustomerEQ Support to request a managed migration" `mailto:` placeholder |
| Audit trail for the setting | `apps/api/src/routes/admin-brand-profile.ts:90-100` | `brand.profile.update` already records `changedFields`, `before`, `after`, `memberCountAtChange` |
| Progress-tracking batch pattern | `schema.prisma:910-931` — `SurveyImportBatch` | `status pending\|processing\|complete\|failed`, `totalRows`/`processedRows`/`failedRows`, `errors Json` — directly reusable shape |
| Async job infrastructure | `apps/api/src/queues/bullmq.ts:56-74` | BullMQ queues with `inline`/`redis` modes; established register-queue + worker-processor pattern |
| Design intent (why it's locked) | `docs/rfcs/231-survey-response-data-model-rework.md:375` | "identifier kind is a brand-level decision and is **V0-immutable per brand**" — switching was explicitly deferred, not forgotten |

### Ingress paths that key on `externalId` (the surfaces a migration must catch up)

| Ingress | Evidence | `enrolledVia` |
|---|---|---|
| Public survey response (auto-enroll) | `apps/api/src/routes/public.ts:457` → `resolveOrEnrollMember` | `SURVEY_RESPONSE` / `EMBEDDED_FORM` |
| Manual API enroll | `apps/api/src/routes/members.ts` → `resolveOrEnrollMember` | `MANUAL_API` |
| Bulk historical import | `apps/worker/src/processors/surveyImport.ts:23-31` | `BULK_IMPORT` |
| Distribution batch generation | `apps/api/src/routes/distributionBatches.ts` | `BULK_DISTRIBUTION` |
| Clerk OAuth signup webhook | (`MemberEnrolledVia.CLERK_OAUTH`, schema.prisma:183) | `CLERK_OAUTH` |

---

## Architectural Patterns This Builds On

- **Event-driven, async-batch processing** (project Rule 5; `bullmq.ts`): long-running re-key + reconciliation belongs on a worker job, surfaced via a status model — not a synchronous request.
- **Batch + status row for progress** (`SurveyImportBatch`): the canonical way this codebase exposes "how far along is my bulk operation," with row-level error capture.
- **Single resolution ingress** (`resolveOrEnrollMember`): there is exactly one place to teach about a dual-key (old + new) lookup window, which is what makes catch-up tractable.
- **Audit-on-change** (`brand.profile.update`): the migration is a high-stakes, irreversible-ish operation that already has an audit hook to extend.
- **Soft deletes + multi-tenant `brandId` scoping** (Rules 6, 13): re-keying must stay tenant-scoped and must not hard-delete or orphan PII.

---

## Gaps and Opportunities

### G1 — No mapping mechanism to translate identifiers (blocking)
An email cannot be algorithmically converted into a phone number or an opaque customer ID. Switching from `EMAIL` to `CUSTOMER_ID` requires the **brand to supply, per existing member, the new identifier value**. There is no model, endpoint, or upload path for this mapping today. *Builds on:* the bulk-import upload + `SurveyImportBatch` row-tracking pattern.

### G2 — No re-key of `Member.externalId` (blocking)
Nothing rewrites `externalId` (or the `email`/`phone` sidecars) for existing members. A naive change of `Brand.memberIdentifierKind` alone would leave every member keyed under the old scheme while new lookups validate/expect the new shape → shape-validation rejections or duplicate orphan members. *Builds on:* the `@@unique([brandId, externalId])` constraint (collisions in the supplied mapping must be detected, mirroring RFC #231's pre-migration collision guard).

### G3 — No catch-up for data arriving mid-migration (the hard part)
Across G1/G2's window, the five ingress paths above keep resolving on the **old** `externalId`. Without handling, mid-migration enrollments either (a) update the soon-to-be-migrated row under the old key, or (b) create a brand-new member under the old key that then gets stranded after the cutover. A solution needs a **dual-key resolution window** (resolve against old *and* new `externalId`) plus a **post-migration reconciliation pass** that merges any rows created on the old key into the migrated identity. *Builds on:* the single `resolveOrEnrollMember` ingress and the member soft-merge/last-write-wins semantics already in that file (lines 167-222).

### G4 — Surface the switch to the customer (replace the dead `mailto:`)
The UI already has the exact spot for this: the locked-state panel in `MemberIdentificationSection.tsx:89-102`. Today it dead-ends at support email. The opportunity is a self-serve (or admin-initiated, support-assisted) migration flow with upload + a progress view modeled on the existing import-batch UI. *Builds on:* the existing settings section and the import-batch progress page pattern.

### A1 — Architectural wrinkle: bulk import hardcodes EMAIL semantics
`apps/worker/src/processors/surveyImport.ts:23-31` inlines `externalId = email.toLowerCase().trim()` and `enrolledVia: 'BULK_IMPORT'` rather than going through `resolveOrEnrollMember` / honoring `memberIdentifierKind`. Any migration touching non-EMAIL brands must account for (and ideally fix) this divergence so catch-up via the import path keys correctly.

### A2 — Architectural wrinkle: no domain event for re-keying
Loyalty/event records (`LoyaltyEvent`, `SurveyResponse`, etc.) join members by the stable `Member.id` (a cuid), **not** by `externalId` — so a pure re-key of `externalId` does not strand historical loyalty data (good). But there is no emitted event when a member's identity changes; downstream consumers (webhooks, exports) that echo `externalId` get no notification. Worth deciding in design whether a `member.identifier.changed` signal is needed.

---

## Grounded Suggestion (ready to convert to an implementation issue)

**Build a managed "Switch Member Identifier Kind" migration** with four parts, each anchored to an existing pattern:

1. **Mapping intake** — a new migration-batch model (shape mirrors `SurveyImportBatch`: `status`, `totalRows`, `processedRows`, `failedRows`, `errors Json`, scoped by `brandId`) plus an upload endpoint accepting per-member `oldIdentifier → newIdentifier` rows. Pre-flight collision guard against `@@unique([brandId, externalId])` before any write (mirrors RFC #231's collision check). *Anchor:* `schema.prisma:910-931`, `apps/worker/src/processors/surveyImport.ts`.

2. **Async re-key worker** — a BullMQ job that, in `brandId`-scoped transactions, rewrites `externalId` + the relevant PII sidecar for each mapped member, advances the batch counters, and records row-level errors. Flips `Brand.memberIdentifierKind` only after the batch reaches a terminal success state. *Anchor:* `apps/api/src/queues/bullmq.ts:56-74`, Rule 5/7 (transactional writes).

3. **Catch-up / dual-key window** — teach `resolveOrEnrollMember` (and the bulk-import path, fixing A1) to resolve against both the pre- and post-migration key while a migration is `processing`, then run a reconciliation pass that merges any member created under the old key into the migrated row using the existing last-write-wins field logic. *Anchor:* `apps/api/src/services/memberResolution.ts:102-222`.

4. **Customer-facing surface + audit** — replace the dead `mailto:` in the locked-state panel with an initiate-migration + progress view (modeled on the import-batch progress page), and extend the existing `brand.profile.update` audit to capture the migration (batch id, before/after kind, counts). *Anchor:* `MemberIdentificationSection.tsx:89-102`, `admin-brand-profile.ts:90-100,322-335`.

**Expected impact:** removes a hard product dead-end (customers who outgrow their initial identifier choice are currently stuck), turns a manual support escalation into a tracked, auditable, idempotent operation, and does so without new infrastructure — every part extends a pattern already in the repo.

**Out of scope (deliberate):** other ideation surfaced during analysis is suppressed to keep this a single focused issue per project Rules 21/26. The bulk-import EMAIL-hardcoding (A1) is in scope only to the extent the migration's catch-up path depends on it; a broader refactor would be its own issue.
