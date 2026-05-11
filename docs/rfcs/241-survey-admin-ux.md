# Feature: Survey Admin UX — Technical Design

Issue: [#241](https://github.com/mathursrus/CustomerEQ/issues/241)
Spec: [`docs/feature-specs/241-survey-admin-ux.md`](../feature-specs/241-survey-admin-ux.md)
Mock: [`docs/feature-specs/mocks/241-survey-admin-ux.html`](../feature-specs/mocks/241-survey-admin-ux.html) (interactive)
Branch: `feature/241-rfc-survey-admin-ux` — spec + design ship together; implementation tracked under a follow-on umbrella issue filed when this RFC lands.
Depends on (already merged into `main`): #170 (lazy-upsert + identityProvider), #231 (`responsePolicy` + consent columns schema), #276 (`Survey.consentMode` columns), #291 (`BrandTheme` rename + thank-you columns), #277/#292 Slice 4 (RHF reference impl, audit-allowlist pattern, `OrganizationSwitcher` redirect target).
Owner: manohar.madhira@outlook.com
Status: Draft

---

## Customer & Problem

Same as spec — marketing manager (primary), brand admin (secondary), respondent (tertiary). The 2026-05-10 directive on #241 is explicit: collapse the three fragmented survey entry points into one section-tabbed editor, consolidate earning to programs, surface consent override in the editor, and replace the per-state detail-page templates with a single collapsible shell. This RFC translates that surface into the schema, API, web component tree, and migration plan.

## Scope

This RFC covers the implementation strategy for #241 V0 — every R-tagged requirement (`R1`–`R32` excluding gaps), every NFR (`NFR-P*`/`S*`/`R*`/`SC*`/`A*`/`O*`/`I*`/`B*`/`BC*`), the new `PATCH /v1/surveys/:id/consent-mode` endpoint absorbed from #283, and the schema deltas listed in the spec's "Schema and API Summary" handoff table.

**In scope:**

- Backend: 1 new endpoint (`PATCH /v1/surveys/:id/consent-mode`), 4 modified endpoints (`POST/PATCH/PATCH-status /v1/surveys/...`, `POST /v1/surveys/:id/responses` + public twin), audit-plugin extension (`requestIp` capture), worker-side no-op for D50.
- Schema: 3 deltas (`Survey.title` add nullable, `Survey.incentivePoints` + `Survey.showIncentivePoints` drop, `SurveyStatus.CLOSED → STOPPED` rename). One data migration for D50 fan-out of earning rules. Audit IP capture goes into the existing `AuditEvent.metadata` JSON via the per-route allowlist — no schema change.
- Frontend: 1 surveys list refresh + 1 thin `/admin/surveys/new` redirect handler (preserves ADR 0001 layout; POSTs then redirects to `/[id]/edit`) + 1 section-tabbed editor (`Basics → Questions → Look & Feel → Points & Thank You`) with **state-aware save mode** (auto-save in DRAFT; explicit per-tab Save in ACTIVE/PAUSED; read-only in STOPPED) + 1 detail-page shell (3 collapsible sections) + 1 reusable `<PreviewSurvey>` component used by both Look-&-Feel and the detail page's Configuration summary.
- Embed: 1 new `packages/embed/src/ceq-survey.ts` Web Component carrying the prefill API (D51 A1 + A2 patterns) and the channel-aware form-renderer.
- Vocabulary: list-page filters, badges, menu copy all converge to Draft / Active / Paused / Stopped.

**Out of scope** (per spec — carried verbatim):

- Sub-issue UIs for individual post-survey actions (#234 `send_message`, #242 `award_reward`, #246 wheel/scratch/mystery). The Rules tab is intentionally absent from the V0 editor.
- Response analytics surface on the detail page (sibling to #235). The Response section is a placeholder block.
- Per-survey override of the program's base earn rate (a future `Survey.pointsOverride` column; V1 hook).
- Brand-issued opaque distribution refs (Option B from OQ4 evaluation; deferred).
- Encrypted URL-token integration mode (fallback for brands whose stack precludes JS prefill; deferred).
- Theme creation/editing from inside the survey editor (RBAC — lives in Organization Settings per #277).
- Audit-log dashboard for consent-mode deviations across surveys.
- Native survey triggering (the type-card grid in Basics absorbs #79's guidance, but the trigger machinery itself is not part of #241).
- i18n string extraction (per NFR-I1 — deferred to a platform-wide i18n adoption).

## Design Overview

Five things change at architecture level; everything else is mechanical.

1. **One editor surface, four tabs, one row.** The PATCH `/v1/surveys/:id` endpoint becomes the only write path while editing. `+ New survey` navigates to `/admin/surveys/new` — a thin server-side handler that POSTs `/v1/surveys` once and redirects to `/[id]/edit?tab=basics` (preserves ADR 0001's four-route layout; no submit form on `/new`). Save behavior is state-aware: auto-save on blur in DRAFT (debounced 500ms), explicit per-tab Save in ACTIVE/PAUSED for production safety, fully read-only in STOPPED. Tab navigation never POSTs. The duplicate-draft surface is eliminated at the protocol level — not just at the UI level (R4).
2. **Earning consolidates by deletion, not by switch.** `Survey.incentivePoints` is dropped from the schema. The worker's existing exact-string-match evaluator (`apps/worker/src/processors/loyaltyEvents.ts:81`) already consumes the four CX events (`cx.nps_response` / `cx.csat_response` / `cx.ces_response` / `cx.survey_completed`) when an `EarningRule.triggerEvent` matches verbatim. A single data migration fans out brands' prior intent (both `Survey.incentivePoints > 0` rows and the dead `EarningRule(triggerEvent='survey_completion')` rows) to per-type EarningRule rows on the right programs, then drops the column and the dead rules. No worker code changes. No new event type. The `#225` reproduction passes because the rule's `triggerEvent` now matches the event the response handler already emits (R22, D50).
3. **Consent override is an endpoint, not a field on PATCH.** `PATCH /v1/surveys/:id/consent-mode` is the only path that writes `Survey.consentMode`, `consentSuppressedAttestedBy`, `consentSuppressedAttestedAt`, `consentReason`. The general `PATCH /v1/surveys/:id` ignores those fields (returns 422 if present). The dedicated endpoint enforces the attestation gate at the handler level (R10) and writes the audit row with attribution. This isolates the GDPR/SOC2-relevant write surface from the always-auto-saving general PATCH.
4. **Single survey row, channel-aware form-renderer.** A new `<PreviewSurvey channel="standalone"|"embedded" viewport="desktop"|"mobile">` React component renders the form the way each channel will render at runtime. The same component drives the Look & Feel previews (four wrappers — 2 channels × 2 viewports) and the detail page's Configuration summary section. The embed widget (`packages/embed/src/ceq-survey.ts`) is the production deployment of the same renderer compiled as a Web Component with Shadow-DOM style isolation, BrandTheme tokens piped in via CSS variables.
5. **Detail page is one shell with three chevrons.** No state-conditional templates. `Distribution / Response / Configuration summary` are three `<Collapsible>` sections; the only state-dependent thing is which sections start expanded vs. collapsed, computed once from `responsesCount` (R27 / R28 / R32). The Edit + More header chrome is identical for DRAFT / ACTIVE / PAUSED / STOPPED.

### High-level component map

```mermaid
graph TD
    subgraph apps/web
        L[/admin/surveys list/]
        E[/admin/surveys/[id]/edit/]
        D[/admin/surveys/[id] detail/]
        L -->|+ New survey: POST /v1/surveys, redirect| E
        L -->|row click| D
        D -->|Edit| E
    end

    subgraph apps/web shared components
        FORM[SurveyEditorForm — RHF]
        TABS[BasicsTab / QuestionsTab / LookFeelTab / PointsTab]
        CONSENT[ConsentCollectionSubBlock]
        PREVIEW[<PreviewSurvey/>]
        FORM --> TABS
        TABS --> CONSENT
        TABS --> PREVIEW
    end

    subgraph apps/api routes
        SURV[surveys.ts: GET/POST/PATCH]
        STATUS[surveys.ts PATCH /:id/status]
        CONS[surveys.ts PATCH /:id/consent-mode  ← NEW]
        RESP[surveys.ts + public.ts POST /:id/responses]
    end

    E -->|auto-save| SURV
    E -->|Activate / Pause / Stop / Restart| STATUS
    E -->|consent override| CONS
    PREVIEW -->|live render| FORM

    subgraph packages
        EMBED[packages/embed/src/ceq-survey.ts  ← NEW]
        RENDERER[apps/web/src/components/survey-form/  shared by PREVIEW + EMBED]
        CONSENTPKG[packages/consent-text  reused as-is]
    end

    EMBED -->|widget mount| RESP
    EMBED -.- RENDERER
    PREVIEW -.- RENDERER

    subgraph apps/worker
        LE[loyaltyEvents.ts:81 exact-string match — NO CHANGE]
        ST[campaignTriggers.ts — NO CHANGE]
    end

    RESP -->|enqueue cx.<type>_response| LE
    RESP -->|enqueue cx.survey_response| ST

    subgraph packages/database
        SC[schema.prisma — 4 deltas]
        MIG[migrations/<ts>_survey_admin_ux_241]
    end

    SURV --> SC
    CONS --> SC
```

## Schema Changes

All schema work lands in a single hand-edited Prisma migration following the `ADD COLUMN → BACKFILL UPDATE → DROP COLUMN` ordering established in `apps/web/architecture.md §3.4`. Reference examples in-tree: `20260430000000_patch_survey_distribution_gap/migration.sql` (idempotent guards) and the `_brandtheme_surveytheme_split` migration (rename + backfill + drop in one ordered diff).

### Prisma changes (`packages/database/prisma/schema.prisma`)

```prisma
// Already in schema today (verified at schema.prisma:73, :600-:642, :946):
//   enum SurveyStatus { DRAFT ACTIVE PAUSED CLOSED }           ← rename CLOSED → STOPPED
//   model Survey { ... incentivePoints Int?  ... }              ← drop
//   model Survey { ... responsePolicy ResponsePolicy ... }      ← keep (runtime gate not yet implemented)
//   model Survey { ... consentMode ConsentMode? ... consentReason String? @db.VarChar(500) ... }
//   model AuditEvent { id, brandId, actorId, action, resourceType, resourceId, metadata, createdAt }

enum SurveyStatus {
  DRAFT
  ACTIVE
  PAUSED
  STOPPED     // renamed from CLOSED per D5 / R25
}

model Survey {
  // ... all existing fields unchanged ...
  title             String?            // NEW — respondent-facing form heading per R7 / D16; nullable; backfilled to name
  // incentivePoints Int?              // REMOVED — earning consolidates to EarningRule per D40 / D50
  // showIncentivePoints Boolean       // REMOVED — points are never on the form per D19 / §2.4
  // ...
}

// AuditEvent is unchanged. NFR-S5's request-IP capture lands in the existing
// metadata Json column via the per-route auditAllowlist — verified at
// audit.ts:150 (the plugin writes metadata as a single Json field, not
// individual columns). No schema migration needed.
```

Notes:

- `Survey.thankYouMessage` and `Survey.thankYouRedirectUrl` already exist (#291). The default thank-you copy is widened in code (`packages/shared/src/zod/survey.schema.ts`) to the new V0 default (`"Thank you for your feedback! Your {{points}} {{pointCurrencyName}} are on their way to your account."`) — schema default is unchanged so existing rows are not affected.
- `Survey.showIncentivePoints` is removed alongside `Survey.incentivePoints` (D19 — points never appear on the form). `UpdateSurveySchema` drops both fields; PATCH bodies containing either return 422 with `details.fieldRemoved`.
- `SurveyStatus.CLOSED → STOPPED` uses Postgres' `ALTER TYPE … RENAME VALUE` (supported since PG10; CustomerEQ runs PG16 per architecture §2 + ADR-0002). The statement is wrapped in a PL/pgSQL guard so a raw psql replay against an already-renamed database is a no-op rather than an error (matches the idempotent-guard convention in `_patch_survey_distribution_gap`). Prisma's own `_prisma_migrations` table also prevents re-running under `migrate deploy`; the guard is defensive against direct-psql test replay.

### Migration plan — `<TIMESTAMP>_survey_admin_ux_241/migration.sql`

```sql
-- Issue #241 — Survey Admin UX. Single hand-edited forward migration.
-- All steps are idempotent under repeated `migrate deploy`; #270 lessons baked in.

BEGIN;

-- ─── Step 1: Add Survey.title, backfill from Survey.name ─────────────────────
ALTER TABLE "surveys" ADD COLUMN IF NOT EXISTS "title" TEXT;
UPDATE "surveys" SET "title" = "name" WHERE "title" IS NULL;
-- Column stays nullable: future surveys MAY have null title at draft time;
-- R7 gates activation when title is empty, not at column-level.

-- ─── (NFR-S5 IP capture is in-process — written to AuditEvent.metadata JSON
--     by the audit plugin via the per-route allowlist; no schema migration.) ─

-- ─── Step 2: Earning consolidation — D40 / D50 fan-out ───────────────────────
-- 2a. For brands with prior survey-points intent on Survey.incentivePoints,
--     create one EarningRule per (programId, cxEventForType(survey.type))
--     pair where at least one survey carries incentivePoints > 0.
--     pointsAwarded = mode() — most common intent in that program/type pair.
INSERT INTO "earning_rules" (
  id, "programId", "brandId", "name", "triggerEvent", "pointsAwarded",
  multiplier, status, priority, stackable, "budgetUsedPoints", "validFrom", "createdAt"
)
SELECT
  'er_' || encode(gen_random_bytes(12), 'hex'),
  s."programId",
  s."brandId",
  '[#241 migration] ' || CASE s.type
    WHEN 'NPS'    THEN 'NPS survey completion'
    WHEN 'CSAT'   THEN 'CSAT survey completion'
    WHEN 'CES'    THEN 'CES survey completion'
    ELSE                'Survey completion (Custom)'
  END,
  CASE s.type
    WHEN 'NPS'    THEN 'cx.nps_response'
    WHEN 'CSAT'   THEN 'cx.csat_response'
    WHEN 'CES'    THEN 'cx.ces_response'
    ELSE                'cx.survey_completed'
  END AS "triggerEvent",
  -- mode within (programId, type)
  MODE() WITHIN GROUP (ORDER BY s."incentivePoints") AS "pointsAwarded",
  1.0, 'ACTIVE', 0, FALSE, 0, NOW(), NOW()
FROM "surveys" s
WHERE s."incentivePoints" IS NOT NULL AND s."incentivePoints" > 0
GROUP BY s."programId", s."brandId", s.type
-- Skip pairs that already have a live EarningRule with the same cx triggerEvent —
-- the operator has already moved to the canonical shape; don't double-write.
ON CONFLICT DO NOTHING;

-- (The ON CONFLICT clause requires a unique constraint; we don't have one across
-- (programId, triggerEvent). The skip is enforced by a WHERE NOT EXISTS guard
-- in the actual migration — written here in INSERT … SELECT form for readability;
-- the real SQL uses NOT EXISTS subquery on (programId, triggerEvent).)

-- 2b. Fan-out the dead survey_completion EarningRule rows. For each dead rule,
--     create one rule per cx event type that the program's surveys actually use.
INSERT INTO "earning_rules" (
  id, "programId", "brandId", "name", "triggerEvent", "pointsAwarded",
  multiplier, conditions, "maxUsesPerMember", status, priority, stackable,
  "budgetCapPoints", "budgetUsedPoints", "validFrom", "validTo", "createdAt"
)
SELECT
  'er_' || encode(gen_random_bytes(12), 'hex'),
  dead."programId", dead."brandId",
  '[#241 migration] ' || dead.name || ' → ' || cx_event,
  cx_event,
  dead."pointsAwarded",
  dead.multiplier, dead.conditions, dead."maxUsesPerMember",
  dead.status, dead.priority, dead.stackable,
  dead."budgetCapPoints", 0, dead."validFrom", dead."validTo", NOW()
FROM "earning_rules" dead
JOIN LATERAL (
  SELECT DISTINCT CASE s.type
    WHEN 'NPS'  THEN 'cx.nps_response'
    WHEN 'CSAT' THEN 'cx.csat_response'
    WHEN 'CES'  THEN 'cx.ces_response'
    ELSE             'cx.survey_completed'
  END AS cx_event
  FROM "surveys" s
  WHERE s."programId" = dead."programId"
) types ON TRUE
WHERE dead."triggerEvent" = 'survey_completion';

-- 2c. Delete the dead survey_completion rules now that intent is preserved.
DELETE FROM "earning_rules" WHERE "triggerEvent" = 'survey_completion';

-- 2d. Drop the Survey.incentivePoints column and the Survey.showIncentivePoints toggle.
ALTER TABLE "surveys" DROP COLUMN IF EXISTS "incentivePoints";
ALTER TABLE "surveys" DROP COLUMN IF EXISTS "showIncentivePoints";

-- ─── Step 3: SurveyStatus enum rename CLOSED → STOPPED ───────────────────────
-- ALTER TYPE ... RENAME VALUE is supported on PG10+. Wrapped in PL/pgSQL guard
-- so a raw psql replay against an already-renamed enum is a no-op (matches the
-- _patch_survey_distribution_gap idempotent-guard pattern).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = '"SurveyStatus"'::regtype
      AND enumlabel = 'CLOSED'
  ) THEN
    ALTER TYPE "SurveyStatus" RENAME VALUE 'CLOSED' TO 'STOPPED';
  END IF;
END $$;

COMMIT;
```

**Drift detection.** `pnpm db:migrate` on second replay is a no-op for every step (column-exists guards, `RENAME VALUE` is idempotent under Prisma's `_prisma_migrations` table). `pnpm test:integration` is the gate (project rule §11 + `.github/workflows/ci.yml:75`).

**Fixture coverage.** Five per-brand fixtures, mapped to the spec's Validation Plan migration row:

| Fixture | Pre-migration state | Post-migration assertion |
|---|---|---|
| brand-only-survey-incentive | 3 NPS surveys with `incentivePoints=50`, no live EarningRule | 1 new `EarningRule(triggerEvent='cx.nps_response', pointsAwarded=50)` |
| brand-only-dead-earningrule | 1 `EarningRule(triggerEvent='survey_completion', pointsAwarded=25)`, mix of NPS/CSAT surveys, all `incentivePoints=null` | 2 new rules — one for each cx type used; original dead rule gone |
| brand-both | both of the above | superset of above; existing live cx-rule unchanged |
| brand-live-cx-only | live `EarningRule(triggerEvent='cx.nps_response', pointsAwarded=100)`, no `incentivePoints`, no dead rules | no new rules created (NOT EXISTS guard) |
| brand-neither | no `incentivePoints > 0`, no dead rules | no migration writes; editor renders "No points configured" per R20 |

A one-off Organization-Settings notice is surfaced in #277's settings page after deploy — text per spec §4 migration plan. The notice is implementation-time copy, not RFC scope.

## API Surface

### Modified — `apps/api/src/routes/surveys.ts`

| Route | Verb | Change | Test coverage |
|---|---|---|---|
| `/v1/surveys` | POST | Body: `CreateSurveyInput` extended with `title?: string`. `incentivePoints` and `showIncentivePoints` are removed from the schema (422 if present). Default `responsePolicy = 'MULTIPLE'`. Default `thankYouMessage` updated. | R1 — survey-admin.spec.ts |
| `/v1/surveys` | GET | Pagination unchanged. Response shape adds `title`. | R1 |
| `/v1/surveys/:id` | GET | Response shape adds `title`. | R2 |
| `/v1/surveys/:id` | PATCH | Body: `UpdateSurveyInput` adds `title`, `description?`, `responsePolicy`, `consentTextOverride`. **Rejects 422** with `details.fieldDisallowed` if body contains `consentMode`, `consentReason`, `consentSuppressedAttestedBy`, `consentSuppressedAttestedAt` (use dedicated endpoint). Per-field state-aware allowlist enforced per R29 / R30 — see §"State-aware field editability" below. | R4 / R7 / R8 / R29 / R30 |
| `/v1/surveys/:id/status` | PATCH | Body enum extended: `'DRAFT' \| 'ACTIVE' \| 'PAUSED' \| 'STOPPED'` (post-rename). Activation gates per R23: questions ≥1, required fields complete, consent attested if overridden. **Audit-row write extended** per R24 / NFR-O1 with `metadata.fromStatus`, `metadata.toStatus`, `metadata.requestIp`. | R23 / R24 / R25 |
| `/v1/surveys/:id/consent-mode` | **PATCH — NEW** | Absorbed from #283. Writes `Survey.consentMode`, `consentReason`, `consentSuppressedAttestedBy`, `consentSuppressedAttestedAt`. Gate: if the new mode is more permissive than `Brand.consentMode`, the body must carry `attestation: { confirmed: true, reason: string ≤500 }` — otherwise HTTP 422 with `details.attestationRequired`. Audit-row written via per-route `auditAction: 'survey.consent.update'` + `auditAllowlist: ['consentMode', 'consentReason']`. | R10 / R11 / NFR-O2 |
| `/v1/surveys/:id/responses` (auth) | POST | **Removes the second event emission** (lines 307–318 today). Emits exactly one event whose `eventType` is the cx event for the survey's type. Enforces `responsePolicy` per R8: `ONCE` second-submit returns HTTP 409; `LATEST_OVERWRITES` updates the prior row; `MULTIPLE` (default) writes a new row. **All live submissions resolve to a member** via `resolveOrEnrollMember` (#231 auto-enroll) — `SurveyResponse.memberId IS NULL` only occurs on **imported responses** (#262 historical imports, #113 external signals). Policy enforcement therefore always applies to live submissions; the spec's "anonymous bypasses policy" clause is an import-path semantic captured in the migration handlers, not a live-submission code path. **Request body**: `answers` is a `Record<questionId, value>` map (keyed by `SurveyQuestion.id`, verified at `survey.schema.ts:55`); skipped questions per `SkipRuleSchema` simply omit their key. **`score` is present only for surveys with at least one question marked as primary score** (see §"Primary score field resolution" below) — for Custom surveys with no primary-score question marked, `score` is omitted; `SurveyResponse.score = null`. | R8 / R22 / NFR-R2 |
| `/v1/public/surveys/:id/respond` | POST | Same emission + policy semantics as the auth path. The prefill body fields (`memberId`, `email`, `phone`, `firstName`, `lastName`, `externalId`) reach `resolveOrEnrollMember(...)` unchanged (verified at `apps/api/src/routes/public.ts:295`). **URL `?email=` / `?member_id=` params no longer wired** — query-string identifier extraction is removed from the page handler per D51; #209's privacy concern is fully addressed. | R16 / NFR-S4 |
| `/v1/surveys/:id/launch` | POST | Unchanged endpoint contract — #80's launch flow (Activate + create rule campaigns atomically) remains for future iterations on post-survey actions. **#241 V0 does not consume this** because Rules are deferred from V0; the survey editor's Activate button calls `PATCH /v1/surveys/:id/status` with `status: 'ACTIVE'` directly. The endpoint stays in the codebase, dormant for #241 surveys (rules.length always 0 from the editor). | n/a — #234 / #242 / #246 own. |

### Zod schema changes (`packages/shared/src/zod/survey.schema.ts`)

```ts
// CreateSurveySchema — additive
export const CreateSurveySchema = z.object({
  name: z.string().min(1).max(200),
  title: z.string().min(1).max(200).nullable().optional(),     // NEW — R7
  description: z.string().max(1000).nullable().optional(),     // NEW — D26 list-page meta
  programId: z.string().min(1),
  type: z.enum(['NPS', 'CSAT', 'CES', 'CUSTOM']),
  questions: z.array(SurveyQuestionSchema).default([]),         // CHANGED — empty array OK at create; R23 gates activation
  responsePolicy: z.enum(['MULTIPLE', 'ONCE', 'LATEST_OVERWRITES']).default('MULTIPLE'),
  consentTextOverride: z.string().max(5000).nullable().optional(),
  // incentivePoints removed
  // showIncentivePoints removed
  themeId: z.string().nullable().optional(),
  thankYouMessage: z.string().max(500).default(DEFAULT_THANKYOU_COPY),
  thankYouRedirectUrl: z.string().url().nullable().optional(),
  // Issue #79 trigger fields unchanged
})

// UpdateSurveySchema — same additive shape with all fields optional, plus disallow list
export const UpdateSurveySchema = CreateSurveySchema
  .partial()
  .strict()  // unknown keys → 422; consent override fields stay out by absence
```

**`UpdateSurveySchema.strict()` is the safety net** that returns 422 when a caller mistakenly PATCHes `consentMode` to `/v1/surveys/:id`. The dedicated endpoint is the only writer for those columns.

### State-aware field editability (R29 / R30)

The PATCH `/v1/surveys/:id` handler applies a per-state allowlist before persisting:

| Field | DRAFT | ACTIVE | PAUSED | STOPPED |
|---|---|---|---|---|
| `name` (internal) | ✓ | ✓ | ✓ | — |
| `title` | ✓ | ✓ | ✓ | — |
| `description` | ✓ | ✓ | ✓ | — |
| `type` | ✓ | — (R29 — would invalidate prior responses' interpretation) | — | — |
| `programId` | ✓ | — | — | — |
| `responsePolicy` | ✓ if responsesCount=0 (R30); else — | — (R30) | — | — |
| `questions` (text/list) | ✓ | — | — | — |
| `themeId` | ✓ | ✓ | ✓ | — |
| `settings.chromeMatrix` | ✓ | ✓ | ✓ | — |
| `thankYouMessage` | ✓ | ✓ | ✓ | — |
| `thankYouRedirectUrl` | ✓ | ✓ | ✓ | — |
| `consentTextOverride` | ✓ | ✓ (audit) | ✓ (audit) | — |
| `consentMode` (dedicated endpoint) | ✓ | ✓ (audit + attestation) | ✓ (audit + attestation) | — |

Disallowed PATCH returns HTTP 409 with body `{ code: "FIELD_NOT_EDITABLE_IN_STATE", field, currentState }`. The frontend `<SurveyEditorForm>` reads `Survey.status` + `Survey.responsesCount` and applies `disabled` to the matching `<input>`s so users never hit the 409 in normal flow — the 409 is the server-side safety net.

### Endpoint error contracts (Error States from spec)

| Scenario | HTTP | Body shape |
|---|---|---|
| Activate clicked with `questions.length === 0` | 422 | `{ error: 'Activation gate failed', code: 'NO_QUESTIONS' }` |
| Activate with required Basics fields empty | 422 | `{ error: 'Activation gate failed', code: 'MISSING_REQUIRED_FIELD', fields: [...] }` |
| Consent override PATCH without attestation | 422 | `{ error: 'Attestation required', code: 'ATTESTATION_REQUIRED', details: { brandMode, requestedMode } }` |
| Cross-brand PATCH attempt | 403 | `{ error: 'Not found' }` (return-404-on-cross-brand pattern from existing routes) |
| Disclosure-text override > 500 chars | 422 | Zod `details` (handled at parse) |
| Field not editable in current state | 409 | `{ code: 'FIELD_NOT_EDITABLE_IN_STATE', field, currentState }` |
| Response submit, `ONCE` + duplicate | 409 | `{ error: 'You have already responded.', code: 'POLICY_ONCE_DUPLICATE' }` |
| Disallowed field on general PATCH (e.g., `consentMode`) | 422 | `{ error: 'Unknown field', code: 'FIELD_DISALLOWED', field }` (from `.strict()`) |

## Audit Plugin Extension

`apps/api/src/plugins/audit.ts` (165 lines today) gains a `requestIp` capture into the existing `metadata` JSON column and three per-route config blocks. **No schema change** — verified at `audit.ts:150` that `metadata` is persisted as a single `Prisma.InputJsonValue` column.

```ts
// Inside the onResponse hook, the plugin already builds `metadata` from
// request.audit.metadata + the per-route allowlist. Add `requestIp` to the
// metadata object before allowlist filtering, and include 'requestIp' in
// every route's auditAllowlist that should capture it:
const enrichedMetadata = {
  ...request.audit?.metadata,
  requestIp: request.ip ?? null,   // NFR-S5; request.ip honors Fastify trust-proxy chain
}
// (existing per-route auditAllowlist filter runs after the spread)

// Per-route audit config on the survey routes:
// surveys.ts PATCH /:id
fastify.patch('/surveys/:id', {
  config: {
    auditAction: 'survey.update',
    auditResourceType: 'survey',
    auditAllowlist: ['title', 'description', 'responsePolicy', 'consentTextOverride',
                     'themeId', 'thankYouMessage', 'thankYouRedirectUrl', 'requestIp'],
  },
}, handler)

// surveys.ts PATCH /:id/status
fastify.patch('/surveys/:id/status', {
  config: {
    auditAction: 'survey.status_update',
    auditResourceType: 'survey',
    auditAllowlist: ['fromStatus', 'toStatus', 'requestIp'],
  },
}, handler)

// surveys.ts PATCH /:id/consent-mode  ← NEW
fastify.patch('/surveys/:id/consent-mode', {
  config: {
    auditAction: 'survey.consent.update',
    auditResourceType: 'survey',
    auditAllowlist: ['consentMode', 'consentReason', 'attestation', 'requestIp'],
  },
}, handler)
```

Within the `PATCH /:id/status` handler, `request.audit.metadata = { fromStatus, toStatus }` is set before reply. The plugin enriches with `requestIp`, filters via the allowlist, and persists the audit row. If the trust-proxy chain is misconfigured and `request.ip` is unavailable, `metadata.requestIp = null` and a structured-log warning fires (`{ event: 'audit.ip_unavailable', route, brandId }`). The audit row is never blocked on IP availability.

## Web UI Architecture

### File tree under `apps/web/src/app/(admin)/admin/surveys/`

```
surveys/
├── page.tsx                                    — list (rewrite — see §"Surveys list" below)
├── components/
│   ├── SurveysList.tsx                         — client component; filter chips + columns
│   ├── SurveyRowMenu.tsx                       — state-aware ⋯ menu
│   └── NewSurveyButton.tsx                     — POSTs /v1/surveys, navigates to /[id]/edit
├── [id]/
│   ├── page.tsx                                — detail (rewrite — 3 collapsible sections)
│   ├── components/
│   │   ├── SurveyDetailShell.tsx               — header chrome (breadcrumb, status pill, audit badge, Edit, More)
│   │   ├── DistributionSection.tsx             — 4-tile bar (share / embed / email / QR)
│   │   ├── ResponseSection.tsx                 — placeholder in V0
│   │   └── ConfigurationSummarySection.tsx    — wraps <PreviewSurvey/> + dl summary
│   └── edit/
│       └── page.tsx                            — editor entry (replaces redirect stub)
├── edit/
│   └── components/                             — colocated under [id]/edit
│       ├── SurveyEditorForm.tsx                — RHF top-level form; per-section dirty state
│       ├── TabHeader.tsx                       — 4-tab horizontal nav with auto-save indicator + Activate
│       ├── BasicsTab.tsx
│       ├── ConsentCollectionSubBlock.tsx      — dropdown + preview-card + disclosure editor (reuses .consent-toolbar)
│       ├── ConsentAttestationModal.tsx        — fires on save-with-more-permissive override
│       ├── QuestionsTab.tsx                   — Up/Down reorder buttons + per-question right-rail config (no drag-drop dep — see "Question canvas" below)
│       ├── LookFeelTab.tsx                    — channel tabs × viewport split, theme picker, chrome matrix
│       ├── PointsAndThankYouTab.tsx           — read-only program-rate display + thank-you variable picker
│       ├── ActivateModal.tsx                  — pre-activate summary + confirm
│       └── DiscardDraftModal.tsx
├── new/
│   └── page.tsx                                — REWRITE — thin Server Component: POST /v1/surveys + redirect() to /[id]/edit (preserves ADR 0001's four-route layout)
└── (existing) — to be DELETED:
    ├── new/components/                        — wizard step components (TriggerStep, RuleBuilderStep, ReviewLaunchStep) removed; only the route file remains as thin redirect
    ├── [id]/edit/page.tsx                     — current 552-byte redirect-to-survey-builder stub replaced
    └── apps/web/src/app/(admin)/admin/survey-builder/  — entire directory removed (R1)
```

The form-renderer lives inside `apps/web` for the admin previews + standalone respondent page; the embed widget keeps a **self-contained second copy** inside `packages/embed/src/` per the existing widget convention. **Why duplicate instead of extract?** `packages/embed/package.json` is empirically zero-dependency (verified: no `dependencies` block, no `peerDependencies`, only `vite` + `typescript` as devDeps), and the two existing widgets (`ceq-spin-wheel.ts`, `ceq-support-chat.ts`) are each fully self-contained TS files with no internal-package imports. Architecture §3.7's "No cross-package imports: Standalone at build time — does not import from `@customerEQ/shared` or other packages" is enforced at the package.json level today, not just by convention. A new `packages/survey-renderer` shared between web and embed would violate that invariant. The honest options are inline-duplicate (this RFC's default) or amend §3.7 to allow internal-package imports when Vite library mode bundles them inline at build (filed as **TQ5** below).

```
apps/web/src/components/survey-form/
├── PreviewSurvey.tsx             — channel/viewport-aware wrapper; reads chromeMatrix + theme
├── SurveyFormRenderer.tsx        — pure renderer; consumes a SurveyResolved + answers state
├── ConsentDisclosure.tsx         — wraps renderConsentTextReact() from @customereq/consent-text
├── QuestionRenderer.tsx          — switches on 11 question types per #35
└── MemberIdField.tsx             — standalone-only; reads Brand.memberIdentifierKind via SSR
```

`SurveyFormRenderer` is consumed by:
- `<PreviewSurvey/>` for Look & Feel previews + detail page Configuration summary.
- The standalone respondent page at `apps/web/src/app/survey/[id]/page.tsx`.

The embed widget's own renderer (see §"Embed Widget" below) reproduces the same visual + interaction contract in standalone TS inside `packages/embed/src/`. The two renderers are kept aligned through a **Playwright visual-regression gate** (slice 5 acceptance): the same survey config + answers state must produce visually-identical output in standalone vs. embedded modes. Drift detected at CI is a hard failure. See §Risks for the trade-off discussion.

### RHF form structure (BasicsTab and PointsAndThankYouTab as examples)

```ts
// SurveyEditorForm.tsx — top-level
const methods = useForm<SurveyEditorFormValues>({
  defaultValues: surveyToFormValues(survey),
  resolver: zodResolver(SurveyEditorFormSchema),
  mode: 'onBlur',
})

// Per-tab dirty state via dirtyFields — same shape as OrganizationSettingsForm's
// SECTION_FIELDS pattern (verified at OrganizationSettingsForm.tsx lines
// 174-177): a const map from section/tab IDs to the fields that contribute
// to that section's dirty state, evaluated via dirtyFields.
function isTabDirty(tab: TabId): boolean {
  const dirtyFields = methods.formState.dirtyFields
  return TAB_FIELDS[tab].some((f) => Boolean(dirtyFields[f as keyof SurveyEditorFormValues]))
}

// Save trigger is STATE-DEPENDENT — see "Save behavior by state" below.
// In DRAFT only: auto-save on blur, debounced, scoped to the dirty field.
// In ACTIVE/PAUSED: explicit Save button per tab — production safety.
const saveMode = survey.status === 'DRAFT' ? 'autosave' : 'explicit'
useAutoSave(methods, async (changedField, value) => {
  if (saveMode !== 'autosave') return  // no-op outside DRAFT
  await patchSurvey(survey.id, { [changedField]: value })  // ONE field per PATCH
})
```

`TAB_FIELDS` reuses the `SECTION_FIELDS` dirty-tracking shape from `OrganizationSettingsForm.tsx`. The **save trigger differs by state** (see §"Save behavior by state" below) — and differs from `OrganizationSettingsForm` (always explicit Save). RHF supports `mode: 'onBlur'` natively; the `useAutoSave` hook is a new utility this RFC introduces (slice 3). Architecture.md §2 Forms row mandates RHF + zodResolver + per-section dirty state — those three pieces match. The auto-save-in-DRAFT-only pattern is flagged for documentation under MA2.

### Save behavior by state

Per reviewer feedback on PR #317 (L758): auto-save in a live (ACTIVE/PAUSED) survey is dangerous — a typo in the thank-you message reaches the next respondent the second the field loses focus. Spec R29 explicitly allows edits in ACTIVE/PAUSED for certain fields; the right answer is to keep R29's allowance but change the save trigger by state:

| State | Save behavior | UX |
|---|---|---|
| **DRAFT** | Auto-save on blur (debounced 500ms per field) | Header indicator: "Saved · Xs ago"; no Save button per tab |
| **ACTIVE / PAUSED** | Explicit Save button at the bottom of each tab; per-tab dirty state (`isTabDirty(tab)`) controls the button's enabled state; Save calls `PATCH /v1/surveys/:id` with only the tab's dirty fields | Header indicator: "Unsaved changes in <tabName>"; Save button per tab body. The header also shows a banner: "This survey is live. Changes apply immediately on save." |
| **STOPPED** | Read-only. All fields disabled; no Save button rendered. | Header indicator: "Stopped — Restart to edit." |

The state-aware save mode is implemented inside the same `SurveyEditorForm` component — no parallel form trees. The auto-save hook short-circuits when `survey.status !== 'DRAFT'`; the `<TabSaveBar/>` chrome appears conditionally.

### Question canvas — reorder via Up/Down buttons

Per reviewer feedback on PR #317 (L494, L683): drag-drop is not in #241's spec scope (the `/admin/survey-builder` UX referenced in §2.2 is verified at `apps/web/src/app/(admin)/admin/survey-builder/page.tsx` to use `useState` with no drag-drop library — the spec's "drag-drop canvas" phrasing was inherited prose describing today's builder, not a new V0 requirement). **No `@dnd-kit` dependency added.**

Reorder UX: each question card in the Questions tab shows a small Up/Down arrow pair on the left edge. Clicking either reorders the question via a single state update; the underlying questions array is reordered and auto-saved (in DRAFT) or marked tab-dirty for explicit save (in ACTIVE/PAUSED — though R29 disallows question reordering in ACTIVE/PAUSED, so the buttons are disabled). NFR-A1 keyboard requirement is trivially met: Tab to focus a button, Enter/Space to activate. Zero new bundle weight.

### Surveys list (`/admin/surveys/page.tsx`)

Columns left-to-right: Name (with description + program in meta line) · Type (pill) · Status (badge) · Responses · Updated · row actions. Sortable header click is V1 (per §1 spec — the type-as-column shape *prepares* for sortability). Row click → `/admin/surveys/[id]`. Row-end `✎` → `/admin/surveys/[id]/edit`. Row-end `⋯` opens a state-aware menu rendered by `<SurveyRowMenu state={survey.status} responsesCount={survey.responsesCount} />`.

`+ New survey` navigates to `/admin/surveys/new` (per reviewer feedback on PR #317 — ADR 0001 unchanged; the `/new` route is preserved as a thin redirect handler). The `/admin/surveys/new/page.tsx` Server Component (a) POSTs `/v1/surveys` with the minimum valid body (`{ name: 'Untitled survey', programId: defaultOrFirstProgram, type: 'NPS' }`), (b) reads the returned `id`, and (c) `redirect()`s to `/admin/surveys/[id]/edit?tab=basics`. Server defaults `responsePolicy = 'MULTIPLE'`, `consentMode = null` (inherits brand), `thankYouMessage = DEFAULT_THANKYOU_COPY`. The user lands on Basics with all required fields highlighted in red until filled. No form to submit on `/new`; the route exists but renders nothing operator-visible — it's purely the POST + redirect handoff. This preserves ADR 0001's four-route layout while still eliminating the duplicate-draft surface at the protocol level (no per-Next POST; the row is created exactly once at the click of `+ New survey`).

### Detail page (`/admin/surveys/[id]/page.tsx`)

```
<SurveyDetailShell>                    — breadcrumb, status pill, audit badge, Edit, More menu
  <DistributionSection                 — chevron expanded if responsesCount===0
    expanded={responsesCount===0}
    surveyId={id} status={status} />
  <ResponseSection                     — chevron expanded if responsesCount>0
    expanded={responsesCount>0}
    placeholder={true} />
  <ConfigurationSummarySection          — chevron expanded if responsesCount===0
    expanded={responsesCount===0}>
    <PreviewSurvey channel="standalone" viewport="desktop"
      survey={survey} brand={brand} theme={theme} readOnly />
    <SurveyConfigDl survey={survey} />
  </ConfigurationSummarySection>
</SurveyDetailShell>
```

The `expanded` prop is the initial value; the section component owns its own toggle state thereafter (R27 / R28 / R32 — "admin SHALL be able to override either default via the chevron at any time").

## Embed Widget — `packages/embed/src/ceq-survey.ts`

New Web Component carrying the form renderer for the embedded distribution channel.

### Public API

**Identifier minimum**: the brand only needs to prefill the single field that corresponds to its `Brand.memberIdentifierKind` setting (per #277). Additional name/contact attributes (`firstName`, `lastName`, optional secondary identifiers) are accepted for member enrichment but are not required. At submit time the widget validates that the brand's configured identifier is present; if missing, it falls back to the in-form identification prompt (R16 graceful degradation).

```html
<!-- A1 — data-attribute prefill (server-rendered brand pages).
     Brand fills ONLY the data-prefill-<identifierKind> attribute that
     matches its memberIdentifierKind setting; name attributes optional. -->
<script
  src="https://cdn.customereq.io/embed/ceq-survey.js"
  data-survey="srv_abc123"
  data-prefill-email="{{user.email}}"        <!-- ← required if Brand.memberIdentifierKind = EMAIL -->
  data-prefill-first-name="{{user.firstName}}"  <!-- optional, for member enrichment -->
  data-prefill-last-name="{{user.lastName}}"    <!-- optional -->
></script>
<ceq-survey survey-id="srv_abc123"></ceq-survey>
```

For brands with `memberIdentifierKind = PHONE`, only `data-prefill-phone` is required. For `memberIdentifierKind = CUSTOMER_ID`, only `data-prefill-external-id`. The widget reads `Brand.memberIdentifierKind` from a public bootstrap endpoint at mount time (cached per brand) to know which attribute to require.

```js
// A2 — JS prefill API (SPA brands). Same identifier-minimum rule applies.
// Brand passes only the field matching their memberIdentifierKind, plus
// optional enrichment fields.
CustomerEQ.surveys.prefill('srv_abc123', {
  email: 'jane@example.com',   // ← required if Brand.memberIdentifierKind = EMAIL
  firstName: 'Jane',           // optional
  lastName: 'Doe',             // optional
})
// Returns Promise<void>; fires the prefill-applied DOM event when consumed.
// Throws if the configured identifier field is missing AND the widget is
// configured to error rather than fall back to in-form prompt.
```

### Internal structure

```
packages/embed/src/ceq-survey.ts          — Custom Element registration + Shadow DOM mount
                                            (single self-contained file matching the
                                             ceq-spin-wheel.ts / ceq-support-chat.ts shape:
                                             inline STYLES const, local type definitions,
                                             no internal-package imports)
```

The widget defines its own type interfaces for `SurveyQuestion`, `BrandTheme`, etc. inline — duplicated from `apps/web/src/components/survey-form/` for §3.7 compliance. `packages/embed/package.json` remains zero-dependency. Theme tokens are piped through CSS custom properties (`--ceq-primary-color`, `--ceq-background-color`, `--ceq-font-family`, etc.) per the spin-wheel precedent at architecture §3.7. Data-attribute + JS prefill APIs are implemented inline in the same file's `connectedCallback` and a window-attached `CustomerEQ.surveys.prefill` global.

**Visual parity with `apps/web`** is enforced at CI via Playwright visual regression: a fixture survey is rendered through both the standalone page handler (using `apps/web/src/components/survey-form/`) and through the embed widget; the resulting screenshots must match within tolerance. Drift = hard fail at PR time. This is the trade-off cost of inline duplication.

### Submission path

The widget POSTs `/v1/public/surveys/:surveyId/respond` with body:

```json5
{
  // Record<questionId, answer-value> per SurveyQuestion.id at survey.schema.ts:55.
  // Skipped questions (per SkipRuleSchema) simply omit their key.
  "answers": {
    "q_nps_root": 8,
    "q_followup_text": "Loved the new dashboard"
  },
  // Present only when the survey has a question marked as primary score
  // (see §"Primary score field resolution"). For Custom surveys with no
  // primary-score question marked, `score` is omitted entirely.
  "score": 8,
  "channel": "embedded",
  // Identity fields — only the one matching Brand.memberIdentifierKind is
  // required; others are optional enrichment. Server-side resolveOrEnrollMember
  // (public.ts:295) consumes what's provided.
  "email": "jane@example.com",
  "firstName": "Jane",
  "lastName": "Doe",
  "idempotencyKey": "survey:srv_abc123:<clientUuid>"
}
```

`resolveOrEnrollMember()` at `apps/api/src/routes/public.ts:295` consumes these POST fields unchanged — auto-enroll (#231) is unaffected because identifier reaches the server via POST body, not via URL (D51, NFR-S4).

**Fallback when neither prefill mechanism populates identity:** the widget renders the same member-identification field as the standalone path (R16). This is implemented as a single conditional in `SurveyFormRenderer`:

```tsx
const showMemberIdField = channel === 'standalone' ||
                          (channel === 'embedded' && !prefill?.hasIdentity)
{showMemberIdField && <MemberIdField kind={brand.memberIdentifierKind} />}
```

### Primary score field resolution

`SurveyResponse.score` (schema.prisma:757 — `Float?`, "NPS (0-10), CSAT (1-5), CES (1-7) numeric score") is a first-class column read by the campaign-rule evaluator (#80 `SurveyRule.scoreMin/scoreMax`), the cx-event payload (`nps_score`, `csat_score`, `ces_score`), analytics dashboards, and the response-detail surface. Surveys with multiple rating questions create ambiguity: which rating's answer becomes the score?

**Design (per reviewer feedback on PR #317 — Q4):** the operator explicitly designates one question per survey as the primary score by toggling a per-question config flag.

**Schema** (additive — no Prisma migration; `QuestionConfigSchema` is stored as JSON):

```ts
// packages/shared/src/zod/survey.schema.ts — additive field on QuestionConfigSchema
export const QuestionConfigSchema = z.object({
  // ... all existing fields unchanged ...
  isScoreField: z.boolean().optional(),    // NEW — operator-facing label: "Use as score"
}).optional()
```

**Defaults**:

| Survey type | Default `isScoreField` placement | Operator override |
|---|---|---|
| NPS preset | The standard 0–10 question carries `isScoreField: true` | Yes — toggle off; mark a different rating/slider question |
| CSAT preset | The standard 1–5 question carries `isScoreField: true` | Yes |
| CES preset | The standard 1–7 question carries `isScoreField: true` | Yes |
| Custom | No question marked by default | Operator may mark any `rating` or `slider` question; if none marked, `score` is omitted at submit and `SurveyResponse.score = null` |

**Server-side validation** (at `PATCH /v1/surveys/:id` and `POST /v1/surveys`):

- At most one question per survey may have `isScoreField: true` → else HTTP 422 with `{ code: 'MULTIPLE_SCORE_QUESTIONS', questionIds: [...] }`.
- `isScoreField: true` is only valid on questions whose `type ∈ { 'rating', 'slider' }` → else HTTP 422 with `{ code: 'SCORE_FIELD_NOT_RATEABLE', questionId, questionType }`. **`likert` is explicitly excluded** because Likert is a matrix of N statements × M rating points — there is no single answer to lift into `score`. If an operator needs a single primary score on a Likert-heavy survey, they add a separate `rating` or `slider` question and mark that one.

**UI contract** (in the Questions tab's right-rail config):

- Toggle label: **"Use as score"**.
- Help text: "The answer to this question is reported as the survey's score and used in post-response rules. Only one rating question per survey can be the score."
- Toggle is visible only when the right-rail's question type is `rating` or `slider`. Hidden for all other types including `likert`.
- A small inline hint surfaces on the question card in the canvas when `isScoreField: true`: "Score" badge in the corner so the operator can see at a glance which question feeds the score.

**At submission time** (form renderer in both `apps/web/src/components/survey-form/` and the embed widget):

- Find the question with `isScoreField: true`.
- Pull its answer value from the answers map.
- Send as top-level `score` in the POST body. If no question is marked, omit `score`.
- The existing campaign-rule evaluator (#80) and analytics pipelines continue to read `SurveyResponse.score` unchanged.

**Why not store score inside `answers`**: it would force the rule evaluator and analytics pipelines to look up the score-question's id from the survey's question array on every read. Top-level `score` keeps the read path O(1) and matches the existing schema/column shape.

### Legacy URL params

The page handler at `apps/web/src/app/survey/[id]/page.tsx` currently reads `?email=` and `?member_id=` from the URL (verified in spec D51 / R16 amendment). Both reads are removed in this RFC; legacy embed snippets that still pass `?email=` cause the standalone fallback prompt to render (graceful degradation, one-time docs nudge for brand integrators).

## Validation Plan

The spec's Validation Plan is authoritative; this RFC operationalizes each row into concrete test files. Same-row IDs preserved for traceability.

| Spec Validation Row | Layer | Concrete artifact | Owns |
|---|---|---|---|
| Browser E2E — create draft → edit every tab → activate → reach Detail | Playwright | `apps/web/test/e2e/survey-admin.spec.ts` (NEW). Scenarios: (a) NPS preset → activate → respond, (b) Custom blank-canvas → embed-via-widget → respond, (c) consent-override happy path with attestation, (d) detail page: 0 responses → first response submitted → Distribution auto-collapses on revisit | R1 / R2 / R3 / R23 / R26 / R27 |
| Browser regression — no duplicate drafts under back/forward | Playwright | Same spec; the create → edit → back → forward → edit scenario asserts `count(*)` = 1 | R4 |
| Browser regression — Activate gated on questions ≥ 1 | Playwright | Same spec; assert Activate button disabled state | R23 |
| API integration — all editor tab saves go through same PATCH endpoint, brand-scoped | Vitest | `apps/api/test/integration/surveys-admin.test.ts` (NEW). Each tab's PATCH path + unauthorized-cross-brand 403 | R4 / NFR-S1 |
| API integration — `PATCH /v1/surveys/:id/consent-mode` honors attestation gate | Vitest | `apps/api/test/integration/surveys-consent-override.test.ts` (NEW). (a) more-permissive no attestation → 422; (b) with attestation → 200 + audit row; (c) stricter without attestation → 200; (d) override clear → 200 + audit cols cleared | R10 / R11 / NFR-O2 |
| Migration — `SurveyStatus.CLOSED → STOPPED` | Direct psql | `packages/database/test/migrations/241-survey-admin-ux.test.ts` (NEW). Apply migration to a fixture DB containing CLOSED rows; assert post-migration `WHERE status='CLOSED'` = 0; grep UI strings | R25 |
| Migration — `Survey.incentivePoints` dropped; D50 fan-out | Direct psql | Same test. Five-fixture matrix from §"Migration plan" above. Assert idempotent on re-replay | R20 / D50 |
| Worker pipeline — #225 reproduction fixed | Vitest | `apps/worker/test/integration/survey-completion-earn.test.ts` (NEW). Seed program with `EarningRule(triggerEvent='cx.nps_response', pointsAwarded=50)`; seed consented member; submit NPS response; assert LoyaltyEvent + pointsBalance + atomicity | R22 / NFR-R1 |
| Migration — `Survey.title` add + backfill | Direct psql | Same migration test. Assert post-migration `WHERE title IS NULL` = 0 | R7 |
| Compliance smoke — #225 reproduction yields non-zero LoyaltyEvent | Staging smoke | Logged in post-deploy runbook | R22 |
| Perf NFR-P1 — auto-save PATCH p95 < 200ms | Vitest | `apps/api/test/perf/surveys-autosave-bench.test.ts` (NEW). 100 sequential field-saves; assert percentile bounds | NFR-P1 |
| Perf NFR-P3 — widget mount + first paint < 1s | Playwright | Sample host-page fixture; assert `performance.measure('widget-mount')` | NFR-P3 |
| A11y NFR-A1–A5 — WCAG 2.1 AA on editor + form | `@axe-core/playwright` | Wired into `survey-admin.spec.ts`; assert zero AA violations | NFR-A1–A5 |
| Security NFR-S3 — disclosure-text override blocks raw HTML | Vitest | `packages/consent-text/src/renderer.test.ts` (EXTEND existing). Feed `<script>`/`<img onerror>` payloads; assert escaped output | NFR-S3 |
| Reliability NFR-R2 — response submit idempotent | Vitest | Same `survey-completion-earn.test.ts`. Same `idempotencyKey` twice → exactly one LoyaltyEvent | NFR-R2 |
| Browser NFR-B2 — iOS Safari + Android Chrome | Playwright | Mobile projects in `playwright.config.ts`; existing matrix extended | NFR-B2 |

**Per-PR CI gate** is the existing `pnpm build && pnpm typecheck && pnpm lint && pnpm test:smoke` chain (project rule R11). Migration replay is part of `pnpm db:migrate` invoked by CI per `.github/workflows/ci.yml:75` (verified — this is the gate that pinned #270's regressions per NFR-BC1).

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| D50 fan-out migration creates duplicate EarningRules when re-replayed | Low | Medium — duplicate rules would double-award | The `NOT EXISTS (programId, triggerEvent)` guard in the INSERT statement makes the migration idempotent. Replay test in the migration fixture set asserts no duplicates after two `migrate deploy` invocations. |
| Auto-save PATCH stampedes the API under fast typing | Medium | Low — slowdown, no data loss | Debounce 500ms client-side per field; server-side `request.audit.metadata` is filtered through the allowlist so the audit table doesn't bloat. |
| Embed widget bundle exceeds the existing ~7 KB envelope | Medium | Low — slow first paint on slow networks | Vite library-mode build; tree-shake React (`react/jsx-runtime` only); measure post-build size in CI as a hard gate at < 30 KB gzipped. If `SurveyFormRenderer` import grows the bundle beyond budget, hoist heavy renderers behind a lazy import. |
| `Survey.title` backfill leaves the title equal to the (admin-facing) internal name | High initially | Low — operator confusion until they edit | The mock's Basics tab shows two inputs side-by-side with explicit "internal" / "respondent-facing" labels; the activate gate (R7) doesn't differentiate yet — a follow-up V0.1 may require title ≠ name. Out of scope here. |
| Consent override audit-row spam from auto-save loops | Low | Medium — log pollution + compliance noise | The consent-mode endpoint is **only** called by the explicit Save flow in `ConsentAttestationModal` — auto-save on the general PATCH never touches `consentMode` (returns 422 via `.strict()`). |
| Worker still processes the dead `survey_completion` event from in-flight queue items | Low | Low — dead rules are gone post-migration so no rule matches | Deploy ordering: schema migration runs before the new API/worker code. In-flight jobs encountering a missing rule silently no-op (per OQ1 resolution). |
| Auto-save in a live survey writes a typo immediately visible to the next respondent | Medium | Medium — operator-perceived "I broke production" moment if a typo or partial edit leaks | **Save mode is state-aware** (per Save Behavior by State above): auto-save runs ONLY in DRAFT; ACTIVE/PAUSED uses explicit Save buttons per tab. The header banner in ACTIVE/PAUSED states reads "This survey is live. Changes apply immediately on save." Operator gets explicit commit boundary for every live edit; no surprise broadcasts. |
| Page handler still reads `?email=` URL param after deploy | Low | High if it lingers — re-introduces #209's PII leak | Same-commit removal in `apps/web/src/app/survey/[id]/page.tsx`. E2E asserts the legacy URL falls through to the standalone prompt. |
| Migration mode() returns NULL for a (programId, type) group | Low | Low — INSERT skipped silently | Fixture asserts the brand-only-survey-incentive case produces the rule; if mode() is NULL the group has no `incentivePoints > 0` rows and the INSERT correctly writes nothing. |
| `request.ip` is `null` in prod because trust-proxy is misconfigured | Medium | Low — `metadata.requestIp = null`, structured-log warning fires | Per NFR-S5, the audit row is still written; the warning is observable in Application Insights and gives ops a clear signal to fix the proxy chain. The row is never blocked on IP availability. |
| **Renderer drift between `apps/web` and `packages/embed`** — inline-duplicated form-renderer code paths diverge over time, producing different visual/interactive behavior for the same survey config | Medium | Medium — embedded respondents see a different form than standalone respondents | Playwright visual-regression CI gate at slice 5 acceptance: same survey config renders pixel-identically (within tolerance) in standalone vs. embedded modes; hard fail on drift. Reviewer checklist on any embed-widget PR: cross-check the equivalent apps/web change landed in the same PR. The cleaner long-term answer (extract `packages/survey-renderer` after amending §3.7) is filed as a separate CustomerEQ issue with full why/when/risks; this RFC keeps inline-duplicate as the V0 trade-off. |

## ADR 0001 compliance (no deviation)

ADR 0001's four-route admin CRUD layout (`/admin/{entity}` · `/admin/{entity}/new` · `/admin/{entity}/[id]` · `/admin/{entity}/[id]/edit`) is preserved verbatim. Per reviewer feedback on PR #317, `/admin/surveys/new` remains as a route but is implemented as a thin redirect handler (see §"Surveys list" above): POST `/v1/surveys` with minimum body, then `redirect()` to `/admin/surveys/[id]/edit`. No form rendered on `/new`; no submit surface; no duplicate-draft pathway. Future entities follow ADR 0001 unchanged; no amendment is required.

## Implementation Slicing

The umbrella is large enough that landing as one PR will exceed reviewer attention budget. Per reviewer feedback on PR #317 (L672) — the editor isn't testable end-to-end without the Questions tab + detail page, so slices 3 and 4 from the prior draft are combined. Four slices total:

| Slice | Scope | Schema gate? |
|---|---|---|
| **1. Schema + migration** | Single Prisma migration: `Survey.title` add + backfill, `Survey.incentivePoints` + `Survey.showIncentivePoints` drop, `SurveyStatus.CLOSED → STOPPED` with PL/pgSQL guard, D50 fan-out. Migration tests with 5 brand fixtures. | YES — must land first |
| **2. API surface + consent-mode endpoint + audit extension** | `PATCH /v1/surveys/:id/consent-mode` new endpoint; `PATCH /v1/surveys/:id` schema update (`.strict()` + state-aware allowlist + `isScoreField` validation); `POST /v1/surveys/:id/responses` event emission cleanup + `responsePolicy` enforcement; audit-plugin `requestIp` capture into `metadata` JSON; per-route audit allowlists. API integration tests. | depends on 1 |
| **3. Surveys list page** | List rewrite: columns + state-aware ⋯ menu + filter chips. `+ New survey` button navigates to `/admin/surveys/new` redirect handler. `/admin/surveys/new/page.tsx` becomes the thin POST + redirect handler. Independent of the editor — testable as a standalone slice. | depends on 2 |
| **4. Full editor (all 4 tabs) + detail page + delete old survey-builder** | Build `apps/web/src/components/survey-form/` (SurveyFormRenderer family); migrate standalone respondent page to consume it; editor shell + RHF + `useAutoSave` hook + per-tab Save chrome (state-aware per §"Save behavior by state"); all four tabs (Basics + Questions with Up/Down reorder + Look & Feel + Points & Thank You) + ConsentCollectionSubBlock + ConsentAttestationModal + ActivateModal + DiscardDraftModal + `<PreviewSurvey/>`; detail page rewrite (3 collapsible sections); old `/admin/survey-builder/` directory deleted; `/admin/surveys/[id]/edit` redirect stub replaced; E2E suite. | depends on 3 |
| **5. Embed widget (`packages/embed/src/ceq-survey.ts`)** | Self-contained Web Component matching `ceq-spin-wheel.ts` / `ceq-support-chat.ts` shape (no internal-package imports; inline types + STYLES); data-attribute + JS prefill APIs (per Brand's `memberIdentifierKind`); theme bridge via CSS custom properties; widget Playwright on sample host page + visual-regression gate vs. standalone; remove `?email=` URL surface from `apps/web/src/app/survey/[id]/page.tsx`. | depends on 4 (drift baseline) |

Each slice is independently revertable. Slice 5 depends on slice 4 because the standalone form renderer in `apps/web` is the baseline the embed widget's visual-regression gate compares against.

## Open Questions

None remaining. All previously-open questions resolved by reviewer feedback on PR #317:

- **TQ1 (ADR 0001 amendment)**: RESOLVED — no amendment; `/new` route preserved as a thin POST+redirect handler. See §"ADR 0001 compliance" above.
- **TQ2 (`title ≠ name` enforcement)**: RESOLVED — not enforced; help text in the mock is sufficient.
- **TQ3 (`dnd-kit` bundle)**: RESOLVED — drag-drop is not in spec scope; Up/Down reorder buttons only. See §"Question canvas".
- **TQ4 (`/v1/surveys/:id/launch` deprecation)**: RESOLVED — leave as-is for #234/#242/#246 to reuse.
- **TQ5 (§3.7 amendment for `packages/embed` imports)**: RESOLVED — keep inline-duplicate for V0; the §3.7 amendment proposal is filed as [#319](https://github.com/mathursrus/CustomerEQ/issues/319) with full why/when/risks.

All OQs from the spec (OQ1–OQ5) are resolved in the spec's Decision Log (D49–D52); this RFC consumes those decisions directly and does not reopen them.

## Spike Findings

No spike was required for this RFC. All technical ambiguities resolved through code reading and primary-source verification:

- **Worker exact-string match** at `apps/worker/src/processors/loyaltyEvents.ts:81` confirmed — no worker code change needed for D50.
- **`resolveOrEnrollMember` POST-body signature** at `apps/api/src/routes/public.ts:295` accepts `memberId/email/phone/firstName/lastName/externalId` — D51's prefill patterns flow unchanged.
- **Schema state** of `Survey`, `BrandTheme`, `ConsentMode`, `ResponsePolicy`, `EarningRule`, `AuditEvent` verified at exact line numbers; the only delta surfaces are: add `Survey.title`, drop `Survey.incentivePoints` + `Survey.showIncentivePoints`, rename `SurveyStatus.CLOSED → STOPPED`. **No `AuditEvent` schema change** — verified `audit.ts:150` writes `metadata` as a single JSON column.
- **EarningRule.attribution column** does not exist; migration uses `EarningRule.name` prefixed with `[#241 migration]` for provenance — verified by reading `EarningRule` schema at `schema.prisma:291-314`.
- **Audit plugin extension** for `requestIp` is in-process only — `request.ip` is enriched onto `request.audit.metadata` and persisted via the existing JSON column. No schema migration; no plugin restructure.
- **`packages/embed/package.json`** has zero `dependencies` and zero `peerDependencies` (verified at `packages/embed/package.json`). Existing widgets (`ceq-spin-wheel.ts`, `ceq-support-chat.ts`) are each fully self-contained TS files. The new `ceq-survey.ts` follows the same shape; no `packages/survey-renderer` extraction is performed (would violate §3.7).

## Observability

Per NFR-O1 / NFR-O2 / NFR-O3:

- **Survey state transitions** — every `Survey.status` change writes an audit row with `metadata.fromStatus`, `metadata.toStatus`, `metadata.requestIp`, `actorId` from JWT. The route uses `auditAction: 'survey.status_update'`.
- **Consent override writes** — every `PATCH /v1/surveys/:id/consent-mode` writes an audit row with `metadata.consentMode`, `metadata.consentReason` (truncated to first 200 chars), `metadata.attestation.confirmed`, `metadata.requestIp`. Route uses `auditAction: 'survey.consent.update'`.
- **Disclosure-text changes** — every `consentTextOverride` change on the general PATCH writes the audit row through the standard `survey.update` path with `metadata.consentTextOverride` (truncated to first 200 chars).
- **BullMQ event metrics** — no new metrics; existing consumer-lag / success-count / failure-count on the `loyalty-events` queue continue to cover the cx event path.

Application Insights queries for the activity-view substrate (NFR-O5):

```kusto
audit_events
| where action startswith 'survey.'
| project createdAt, brandId, action, resourceId, actorId, metadata
| order by createdAt desc
```

## Confidence Level

**85/100.** The decomposition tracks the spec verbatim; every R# maps to a concrete artifact; every NFR has a validation row; every reviewer comment from PR #317 round 1 is addressed in this revision. Remaining risk is concentrated in:

- The D50 fan-out SQL — the migration is correct on paper but hasn't run against the fixture set yet (gated by Slice 1 acceptance).
- The embed widget bundle size — embedded TS file (no internal deps) grows by the renderer surface; size budget enforced in CI as the gate.
- **Renderer drift between `apps/web` and `packages/embed`** — inline duplication carries maintenance risk; mitigated by Playwright visual-regression CI gate at slice 5 (hard fail on drift). The §3.7-amendment alternative is filed as a separate CustomerEQ issue for independent evaluation.
- State-aware save mode adds branching complexity to the editor form; verified at implementation time via per-state E2E coverage of the save path.

The remaining 15 points reflect those four implementation-time validations, all of which have clear evidence checkpoints in the Validation Plan.

## Architecture Analysis

Comparing this RFC against `docs/architecture/architecture.md` (581 lines, last updated 2026-04-21) using the architecture-gap-detection skill. Patterns sorted into three buckets.

### Patterns Correctly Followed

| # | Pattern (architecture.md ref) | Where the RFC follows it |
|---|---|---|
| 1 | **RHF + zodResolver + per-section dirty state** (Tech Stack §2 — Forms row; the row names #241 as the natural rework window for survey-side forms) | §"RHF form structure" — uses `methods.formState.dirtyFields` filtered through `TAB_FIELDS` mirror of `OrganizationSettingsForm`'s `SECTION_FIELDS` |
| 2 | **Multi-tenant: brandId from JWT only** (§6 — Multi-Tenant Isolation; project rule R6) | `UpdateSurveySchema.strict()` rejects request-body `brandId` (multiTenant plugin already enforces); existing handler check `findFirst({ where: { brandId: request.brandId } })` retained on every survey route |
| 3 | **Append-only LoyaltyEvent + atomic Member.pointsBalance** (§6 — Append-Only Loyalty Ledger + Transactional Integrity; project rule R7) | RFC explicitly preserves the worker transaction at `loyaltyEvents.ts:251-267`; no API-layer direct write paths |
| 4 | **Idempotency in both queue modes** (§6 — Idempotency) | `idempotencyKey = survey:<surveyId>:<memberId>` retained; embedded widget includes client-generated suffix when memberId is unknown pre-enroll |
| 5 | **Event-driven loyalty actions** (project rule R5; architecture §6 Event-Driven Processing) | All loyalty earn paths go through BullMQ enqueue; no direct API-layer write to LoyaltyEvent / pointsBalance |
| 6 | **Hand-edited Prisma migration with ADD → BACKFILL → DROP ordering, idempotent guards** (§3.4 Data Layer) | Single migration in `<TIMESTAMP>_survey_admin_ux_241/` follows the reference examples (`_patch_survey_distribution_gap`, `_brandtheme_surveytheme_split`); IF NOT EXISTS column guards; NOT EXISTS subquery for the D50 fan-out replay-safety |
| 7 | **Per-route audit allowlist + auditAction/auditResourceType overrides** (§4.2 audit plugin; documented by #277 RFC) | Each of three survey PATCH routes carries a per-route config block; allowlist scoped to spec-named metadata fields only |
| 8 | **Domain-narrow runtime packages** (§3 introductory paragraph) | RFC reuses `packages/consent-text` as-is (no modification). RFC does NOT extract a new `packages/survey-renderer` — see IF1 below for why; that resolution preserves the §3.7 zero-dep invariant. |
| 13 | **Embed Layer zero-dependency invariant** (§3.7 — "No cross-package imports: Standalone at build time — does not import from `@customerEQ/shared` or other packages") | Verified at `packages/embed/package.json` (zero `dependencies`, zero `peerDependencies`). New `ceq-survey.ts` matches the `ceq-spin-wheel.ts` / `ceq-support-chat.ts` shape: single self-contained TS file, inline types + STYLES, no internal-package imports. Visual-regression CI gate compensates for the inline-duplication maintenance cost. |
| 9 | **Standard pagination envelope on list endpoints** (§4.1) | `GET /v1/surveys` shape unchanged — `{ data, total, page, pageSize, totalPages }` |
| 10 | **GDPR/CCPA baked in, not bolted on** (§6 + project rule R13) | Consent attestation captured at write time with actor + timestamp + reason; audit log feeds compliance reporting; PII not introduced into new columns (consent override metadata is operational, not PII) |
| 11 | **Centralized test infrastructure (`packages/config/src/test-utils/`)** (§9.2) | New test files (`survey-admin.spec.ts`, `surveys-admin.test.ts`, `surveys-consent-override.test.ts`, `survey-completion-earn.test.ts`) all import factories from `@customerEQ/config/test-utils` — no inline mocks |
| 12 | **CI gate: build + typecheck + lint + test:smoke + migration replay** (§7.4 + `.github/workflows/ci.yml:75`) | RFC's validation plan trips this gate at PR time; migration test asserts idempotent re-replay |

### Patterns Missing from Architecture

These are patterns the RFC introduces that aren't documented in `architecture.md` today. Each warrants an additive update to the architecture doc — but that update is deferred to the address-feedback phase per FRAIM's architecture-gap-review contract.

| # | New pattern | Why it's needed | Suggested resolution |
|---|---|---|---|
| **MA1** | **State-aware save mode for admin editor forms** — auto-save on blur in DRAFT; explicit per-tab Save in ACTIVE/PAUSED; read-only in STOPPED. The same `SurveyEditorForm` component switches save trigger based on `survey.status`. | Auto-save in a live (ACTIVE/PAUSED) survey would write a typo immediately visible to the next respondent — production-safety problem. R29 still allows edits in ACTIVE/PAUSED; the right answer is a state-aware save trigger, not narrowing R29. #292's `OrganizationSettingsForm` uses always-explicit-save; #241 is the first surface to mix modes by state. | Add a paragraph to architecture.md §3.1 under "Standard CRUD admin pattern" describing the state-aware save pattern: auto-save in entity-DRAFT states where the entity has not yet committed to operator-visible side effects; explicit per-section Save in entity-live states where edits propagate to downstream consumers. Future stateful entities pick this up consistently. |
| **MA2** | **State-aware PATCH field allowlist** — a PATCH handler enforces a per-(status, field) allowlist before persisting, returning HTTP 409 `{ code: 'FIELD_NOT_EDITABLE_IN_STATE', field, currentState }` on disallowed mutations. | R29 / R30 require the contract; today's surveys.ts has no such gate. This is the first time a CustomerEQ entity has state-conditional edit rules at the API boundary. | Document as a paragraph under architecture.md §4.1 "API Routes" (or §6 Design Patterns) — name the contract and the HTTP code + body shape so future stateful entities (Campaigns? Programs?) can adopt it consistently. |
| **MA3** | **Audit plugin `metadata.requestIp` capture** — audit plugin enriches `request.audit.metadata` with `requestIp` from `request.ip` (Fastify trust-proxy honored); null on misconfiguration with structured-log warning. Per-route `auditAllowlist` must include `'requestIp'` to persist. | NFR-S5 requires it; today the audit plugin doesn't persist IP at all. Verified `audit.ts:150` writes `metadata` as a single JSON column — no schema migration. | Document in architecture.md §4.2 audit plugin row: "audit row captures `actorId` plus per-route `metadata` filtered through `auditAllowlist`; routes that opt into `requestIp` get `request.ip` enriched into `metadata.requestIp` (null on trust-proxy misconfiguration, structured-log warning emitted)." |

### Patterns Incorrectly Followed

| # | Conflict | Architecture says | Original RFC draft said | Resolution applied |
|---|---|---|---|---|
| **IF1** | **Embed widget importing from `apps/web` or any internal package** | §3.7 Embed Layer: "**No cross-package imports**: Standalone at build time — does not import from `@customerEQ/shared` or other packages." Enforced at `packages/embed/package.json` (zero `dependencies`). | First draft proposed extracting `packages/survey-renderer` and having both `apps/web` and `packages/embed` import from it. Re-verification: `packages/embed/package.json` is empirically zero-dep; `ceq-spin-wheel.ts` and `ceq-support-chat.ts` are fully self-contained TS files. Extracting a shared package would itself violate §3.7 since `packages/embed` would have to declare `packages/survey-renderer` as a runtime dep. **My second-draft "resolution" was the same class of unverified assertion as the first draft.** | **Inline-duplicate the renderer inside `packages/embed/src/ceq-survey.ts`** matching the existing widget convention. `apps/web` keeps its own `survey-form/` for admin previews + standalone page handler. The two renderers must produce visually-identical output for the same survey config; **Playwright visual regression is the CI gate enforcing parity** (slice 5 acceptance). Trade-off is duplication maintenance cost — flagged as a risk in §Risks & Mitigations. The §3.7-amendment alternative (allow internal-package imports when Vite library mode inlines them at build) is filed as a **separate CustomerEQ issue** with full why/when/risks, independent of #241. |

No other Incorrectly Followed patterns identified. The remaining design decisions either follow existing patterns (table above) or introduce new patterns flagged as Missing from Architecture (deferred to address-feedback phase).

## Traceability Matrix

Every functional and non-functional requirement maps to one or more RFC sections + implementation slices.

| Req | RFC section | Slice |
|---|---|---|
| R1 — list page, single `+ New survey` CTA, `/new` as redirect | §Web UI / Surveys list | 3 (list) + 4 (survey-builder dir removal) |
| R2 — row click → detail page | §Web UI / Surveys list + §Web UI / Detail page | 3 / 4 |
| R3 — 4 horizontal tabs in named order | §Web UI / RHF form structure | 4 |
| R4 — no POST on tab nav; save behavior by state | §Web UI / RHF form structure + §API / PATCH /:id | 2 / 4 |
| R5 — Back/Continue + persistent Activate | §Web UI / RHF form structure | 4 |
| R6 — Type 4-card grid + type-change modal + preset places `isScoreField=true` on standard rating question | §Web UI / BasicsTab + §Primary score field resolution | 4 |
| R7 — Internal name + Survey title required | §Schema / Survey.title + §API / Zod | 1 / 2 / 4 |
| R8 — Response policy field + ONCE 409 (live submissions); imports bypass | §API / POST /:id/responses | 2 |
| R9 — Consent mode dropdown shows only differing override | §Web UI / ConsentCollectionSubBlock | 4 |
| R10 — Override-to-more-permissive requires attestation | §API / PATCH /:id/consent-mode + §Web UI / ConsentAttestationModal | 2 / 4 |
| R11 — Override-to-stricter no attestation, still audit | §API / PATCH /:id/consent-mode | 2 |
| R12 — `.consent-toolbar` editor with token insert; Terms link conditional | §Web UI / ConsentCollectionSubBlock; reuses `packages/consent-text` | 4 |
| R13 — Blank disclosure renders no consent block + audit | §Web UI / ConsentCollectionSubBlock + §Audit | 2 / 4 |
| R14 — Preview card renders disclosure as respondents will see | §Web UI / PreviewSurvey + ConsentDisclosure | 4 |
| R15 — Standalone renders member-ID field | §Web UI / MemberIdField | 4 |
| R16 — Embedded prefill A1/A2 (brand's configured kind only); URL identifier removed | §Embed Widget + §API / public.ts removal | 2 / 5 |
| R17 — Look & Feel preview channel-first × viewport | §Web UI / LookFeelTab | 4 |
| R18 — Per-channel chrome matrix | §Web UI / LookFeelTab + §Embed (theme-bridge) | 4 / 5 |
| R19 — Theme picker lists all brand themes; no Manage link | §Web UI / LookFeelTab | 4 |
| R20 — Points read-only display sourced from EarningRule | §Web UI / PointsAndThankYouTab | 4 |
| R21 — Thank-you variable picker: 3 V0 variables only | §Web UI / PointsAndThankYouTab | 4 |
| R22 — Response handler emits one cx event; LoyaltyEvent atomic; score sourced from primary-score question | §API / POST /:id/responses + §Primary score field resolution + Worker (no change) | 2 / 4 |
| R23 — Activate gating | §API / PATCH /:id/status + §Web UI / ActivateModal | 2 / 4 |
| R24 — Audit row on every state transition | §Audit + §API / PATCH /:id/status | 2 |
| R25 — Vocabulary; CLOSED→STOPPED rename; no "Launch"/"Close" | §Schema / Migration + §Web UI strings | 1 / 3 / 4 |
| R26 — Detail page 3 collapsible sections | §Web UI / Detail page | 4 |
| R27 — Distribution default-expanded when responsesCount=0 | §Web UI / Detail page | 4 |
| R28 — Configuration summary default-expanded when responsesCount=0; reuses PreviewSurvey | §Web UI / Detail page | 4 |
| R29 — State-aware editability + 409 on disallowed; save mode also state-aware | §API / State-aware field editability + §Save behavior by state | 2 / 4 |
| R30 — responsePolicy locks once responsesCount > 0 | §API / State-aware field editability | 2 |
| R31 — BrandTheme tokens applied to form-renderer (full coverage) | §Web UI / SurveyFormRenderer + §Embed (inline-duplicate renderer) | 4 / 5 |
| R32 — Response section default-collapsed when responsesCount=0 | §Web UI / Detail page | 4 |
| NFR-P1 auto-save p95 < 200ms (DRAFT) + explicit save p95 < 300ms (ACTIVE/PAUSED) | §Validation Plan / Perf | 2 |
| NFR-P2/P3 form/widget first paint | §Validation Plan / Perf | 4 / 5 |
| NFR-P4 response → LoyaltyEvent p95 < 30s | §API / POST /:id/responses (unchanged latency) | 2 |
| NFR-S1 brand-scoped | §API / existing brandId gate | 2 |
| NFR-S2 opaque ids | §Schema / unchanged (cuid) | n/a |
| NFR-S3 disclosure XSS guard | §Validation Plan / `packages/consent-text` | 2 |
| NFR-S4 embed widget privilege | §Embed Widget | 5 |
| NFR-S5 audit requestIp via metadata | §Audit Plugin Extension (no schema change) | 2 |
| NFR-R1/R2 atomicity + idempotency | §Validation Plan / Worker | 2 |
| NFR-R3 auto-save resilience (DRAFT) + explicit-save retry (ACTIVE/PAUSED) | §Web UI / RHF form structure | 4 |
| NFR-R4 single status endpoint | §API / PATCH /:id/status | 2 |
| NFR-R5 BullMQ backpressure | §API / response emission (unchanged) | 2 |
| NFR-SC1–4 scalability | §Web UI + §API (no new scale surface) | 4 |
| NFR-A1–5 a11y | §Validation Plan / a11y + Question canvas (Up/Down reorder = keyboard-trivial) | 4 |
| NFR-O1–5 audit observability | §Audit | 2 |
| NFR-I1–3 i18n | Deferred per spec; no change | n/a |
| NFR-B1–3 browser matrix | §Validation Plan / Browser | 4 / 5 |
| NFR-BC1–4 backcompat + migrations | §Schema / Migration; CI gate | 1 |

— End of RFC —
