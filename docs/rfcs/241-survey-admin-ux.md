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
- Schema: 4 deltas (`Survey.title` add nullable, `Survey.incentivePoints` drop, `SurveyStatus.CLOSED → STOPPED` rename, `AuditEvent.ipAddress` add nullable). One data migration for D50 fan-out of earning rules.
- Frontend: 1 surveys list refresh + 1 section-tabbed editor (`Basics → Questions → Look & Feel → Points & Thank You`) + 1 detail-page shell (3 collapsible sections) + 1 reusable `<PreviewSurvey>` component used by both Look-&-Feel and the detail page's Configuration summary.
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

1. **One editor surface, four tabs, one row.** The PATCH `/v1/surveys/:id` endpoint becomes the only write path while editing. `+ New survey` POSTs once, immediately, and redirects to `/[id]/edit?tab=basics`. Auto-save-on-blur (debounced 500ms) updates the same row. Tab navigation never touches the API. This eliminates the duplicate-draft surface at the protocol level — not just at the UI level (R4).
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

model AuditEvent {
  // ... all existing fields unchanged ...
  ipAddress    String?    // NEW — Fastify request.ip captured by audit plugin per NFR-S5; null when proxy chain misconfigured
}
```

Notes:

- `Survey.thankYouMessage` and `Survey.thankYouRedirectUrl` already exist (#291). The default thank-you copy is widened in code (`packages/shared/src/zod/survey.schema.ts`) to the new V0 default (`"Thank you for your feedback! Your {{points}} {{pointCurrencyName}} are on their way to your account."`) — schema default is unchanged so existing rows are not affected.
- `Survey.showIncentivePoints` is removed alongside `Survey.incentivePoints` (D19 — points never appear on the form). `UpdateSurveySchema` drops both fields; PATCH bodies containing either return 422 with `details.fieldRemoved`.
- `SurveyStatus` enum reshape uses Postgres' standard create-new-type-and-swap pattern (no `ALTER TYPE … RENAME VALUE` because we want migrations to be replayable on databases that had pre-rename data). See SQL below.

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

-- ─── Step 2: Add AuditEvent.ipAddress (nullable; null when proxy unavailable) ─
ALTER TABLE "audit_events" ADD COLUMN IF NOT EXISTS "ipAddress" TEXT;

-- ─── Step 3: Earning consolidation — D40 / D50 fan-out ───────────────────────
-- 3a. For brands with prior survey-points intent on Survey.incentivePoints,
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

-- 3b. Fan-out the dead survey_completion EarningRule rows. For each dead rule,
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

-- 3c. Delete the dead survey_completion rules now that intent is preserved.
DELETE FROM "earning_rules" WHERE "triggerEvent" = 'survey_completion';

-- 3d. Drop the Survey.incentivePoints column and the Survey.showIncentivePoints toggle.
ALTER TABLE "surveys" DROP COLUMN IF EXISTS "incentivePoints";
ALTER TABLE "surveys" DROP COLUMN IF EXISTS "showIncentivePoints";

-- ─── Step 4: SurveyStatus enum rename CLOSED → STOPPED ───────────────────────
-- Postgres ALTER TYPE ... RENAME VALUE works on PG10+. Single statement.
ALTER TYPE "SurveyStatus" RENAME VALUE 'CLOSED' TO 'STOPPED';

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
| `/v1/surveys/:id/status` | PATCH | Body enum extended: `'DRAFT' \| 'ACTIVE' \| 'PAUSED' \| 'STOPPED'` (post-rename). Activation gates per R23: questions ≥1, required fields complete, consent attested if overridden. **Audit-row write extended** per R24 / NFR-O1 with `metadata.fromStatus`/`toStatus` and the new `ipAddress` column. | R23 / R24 / R25 |
| `/v1/surveys/:id/consent-mode` | **PATCH — NEW** | Absorbed from #283. Writes `Survey.consentMode`, `consentReason`, `consentSuppressedAttestedBy`, `consentSuppressedAttestedAt`. Gate: if the new mode is more permissive than `Brand.consentMode`, the body must carry `attestation: { confirmed: true, reason: string ≤500 }` — otherwise HTTP 422 with `details.attestationRequired`. Audit-row written via per-route `auditAction: 'survey.consent.update'` + `auditAllowlist: ['consentMode', 'consentReason']`. | R10 / R11 / NFR-O2 |
| `/v1/surveys/:id/responses` (auth) | POST | **Removes the second event emission** (lines 307–318 today). Emits exactly one event whose `eventType` is the cx event for the survey's type. Enforces `responsePolicy` per R8: `ONCE` second-submit returns HTTP 409; `LATEST_OVERWRITES` updates the prior row; `MULTIPLE` (default) writes a new row. Anonymous responses (memberId IS NULL) bypass policy enforcement. | R8 / R22 / NFR-R2 |
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

`apps/api/src/plugins/audit.ts` (165 lines today) gains one capture and one new per-route config block.

```ts
// Inside the onResponse hook, alongside existing actorId / action / resourceType writes:
ipAddress: request.ip ?? null,   // NFR-S5; request.ip honors Fastify trust-proxy chain

// Per-route audit config on the survey routes:
// surveys.ts PATCH /:id
fastify.patch('/surveys/:id', {
  config: {
    auditAction: 'survey.update',
    auditResourceType: 'survey',
    auditAllowlist: ['title', 'description', 'responsePolicy', 'consentTextOverride',
                     'themeId', 'thankYouMessage', 'thankYouRedirectUrl'],
  },
}, handler)

// surveys.ts PATCH /:id/status
fastify.patch('/surveys/:id/status', {
  config: {
    auditAction: 'survey.status_update',
    auditResourceType: 'survey',
    auditAllowlist: ['fromStatus', 'toStatus'],
  },
}, handler)

// surveys.ts PATCH /:id/consent-mode  ← NEW
fastify.patch('/surveys/:id/consent-mode', {
  config: {
    auditAction: 'survey.consent.update',
    auditResourceType: 'survey',
    auditAllowlist: ['consentMode', 'consentReason', 'attestation'],
  },
}, handler)
```

Within the `PATCH /:id/status` handler, `request.audit.metadata = { fromStatus, toStatus }` is set before reply. The plugin filters via the allowlist and persists the audit row with `ipAddress` populated from `request.ip`. If the trust-proxy chain is misconfigured and `request.ip` is unavailable, the row is still written with `ipAddress: null` and a structured-log warning fires (`{ event: 'audit.ip_unavailable', route, brandId }`).

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
│       ├── QuestionsTab.tsx                   — drag/keyboard reorder canvas (single dnd-kit dep — see "Question canvas" below)
│       ├── LookFeelTab.tsx                    — channel tabs × viewport split, theme picker, chrome matrix
│       ├── PointsAndThankYouTab.tsx           — read-only program-rate display + thank-you variable picker
│       ├── ActivateModal.tsx                  — pre-activate summary + confirm
│       └── DiscardDraftModal.tsx
└── (existing) — to be DELETED in this PR:
    ├── new/                                   — entire directory removed (R1)
    ├── [id]/edit/page.tsx                     — current 552-byte redirect stub replaced
    └── apps/web/src/app/(admin)/admin/survey-builder/  — entire directory removed (R1)
```

The shared form-renderer lives in a new domain-narrow package `packages/survey-renderer/` (see Architecture Analysis MA3 / IF1):

```
packages/survey-renderer/
├── package.json                  — name: @customereq/survey-renderer; peerDeps: react, react-dom
├── src/
│   ├── index.ts                  — re-exports
│   ├── SurveyFormRenderer.tsx    — pure renderer; consumes a SurveyResolved + answers state
│   ├── ConsentDisclosure.tsx     — wraps renderConsentTextReact() from @customereq/consent-text
│   ├── QuestionRenderer.tsx      — switches on 11 question types per #35
│   ├── MemberIdField.tsx         — standalone-only; reads Brand.memberIdentifierKind from props
│   └── theme.ts                  — BrandTheme token → CSS custom property mapping
└── tsconfig.json
```

The web app provides the channel/viewport wrapper that's specific to the admin preview surface:

```
apps/web/src/components/survey-preview/
└── PreviewSurvey.tsx             — channel/viewport-aware wrapper; reads chromeMatrix + theme;
                                    delegates rendering to @customereq/survey-renderer
```

Three apps consume `@customereq/survey-renderer`:
- `apps/web` — Look & Feel previews + detail page Configuration summary section, both via `<PreviewSurvey/>`.
- `apps/web` — the standalone respondent page at `apps/web/src/app/survey/[id]/page.tsx`.
- `packages/embed/src/ceq-survey.ts` — the production Web Component widget.

This keeps `packages/embed`'s no-cross-package-imports invariant (architecture §3.7) intact: it imports from `@customereq/survey-renderer` and `@customereq/consent-text`, both of which are domain-narrow runtime packages per §3 introductory paragraph. It does not import from `apps/web` or `@customereq/shared`. Bundle math: the widget today is ~7 KB gzipped; survey-renderer adds ~15 KB gzipped per the spin-wheel envelope precedent — comfortably under the < 30 KB CI gate.

### RHF form structure (BasicsTab and PointsAndThankYouTab as examples)

```ts
// SurveyEditorForm.tsx — top-level
const methods = useForm<SurveyEditorFormValues>({
  defaultValues: surveyToFormValues(survey),
  resolver: zodResolver(SurveyEditorFormSchema),
  mode: 'onBlur',
})

// Per-tab dirty state via dirtyFields (matches OrganizationSettingsForm pattern at lines 174-177)
function isTabDirty(tab: TabId): boolean {
  const dirtyFields = methods.formState.dirtyFields
  return TAB_FIELDS[tab].some((f) => Boolean(dirtyFields[f as keyof SurveyEditorFormValues]))
}

// Auto-save on blur — debounced, scoped to the dirty field
useAutoSave(methods, async (changedField, value) => {
  // ONE field per PATCH — keeps the request body minimal and prevents
  // accidental overwrites across tabs.
  await patchSurvey(survey.id, { [changedField]: value })
})
```

`TAB_FIELDS` maps tab IDs to the field names that contribute to "dirty" state for that tab — exact analogue to `SECTION_FIELDS` in `OrganizationSettingsForm.tsx`. This is the pattern architecture.md §2 mandates (`React Hook Form 7.x + @hookform/resolvers/zod` with "per-section dirty state via RHF formState.dirtyFields").

### Question canvas — keyboard-accessible reorder

NFR-A1 mandates keyboard alternatives for drag-drop. Two options were considered:

- **A. Up/Down arrow buttons only.** Zero new dependencies. Loses pointer ergonomics of drag.
- **B. `@dnd-kit/core` + `@dnd-kit/sortable`.** Native keyboard support (Arrow keys after Tab-focusing a question); pointer drag for power users. ~40 KB minified added to the admin bundle.

**Decision: B (`@dnd-kit`).** Rationale: matches the platform's accessibility-first posture and the spec's NFR-A1 explicit guidance; the bundle hit is on the admin route only (not the public form-renderer or the embed widget). `@dnd-kit` is React-18-compatible and treeshakeable.

### Surveys list (`/admin/surveys/page.tsx`)

Columns left-to-right: Name (with description + program in meta line) · Type (pill) · Status (badge) · Responses · Updated · row actions. Sortable header click is V1 (per §1 spec — the type-as-column shape *prepares* for sortability). Row click → `/admin/surveys/[id]`. Row-end `✎` → `/admin/surveys/[id]/edit`. Row-end `⋯` opens a state-aware menu rendered by `<SurveyRowMenu state={survey.status} responsesCount={survey.responsesCount} />`.

`+ New survey` is a single button that calls `POST /v1/surveys` with the minimum valid body (`{ name: 'Untitled survey', programId: defaultOrFirstProgram, type: 'NPS' }`), then `router.push(`/admin/surveys/${id}/edit?tab=basics`)`. Server defaults `responsePolicy = 'MULTIPLE'`, `consentMode = null` (inherits brand), `thankYouMessage = DEFAULT_THANKYOU_COPY`. The user lands on Basics with all required fields highlighted in red until filled — same UX shape as creating an empty Program.

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

```html
<!-- A1 — data-attribute prefill (server-rendered brand pages) -->
<script
  src="https://cdn.customereq.io/embed/ceq-survey.js"
  data-survey="srv_abc123"
  data-prefill-email="{{user.email}}"
  data-prefill-external-id="{{user.id}}"
  data-prefill-first-name="{{user.firstName}}"
  data-prefill-last-name="{{user.lastName}}"
  data-prefill-phone="{{user.phone}}"
></script>
<ceq-survey survey-id="srv_abc123"></ceq-survey>
```

```js
// A2 — JS prefill API (SPA brands)
CustomerEQ.surveys.prefill('srv_abc123', {
  email: 'jane@example.com',
  externalId: 'usr_xyz',
  firstName: 'Jane',
  lastName: 'Doe',
  phone: '+15551234',
})
// Returns Promise<void>; fires the prefill-applied DOM event when consumed
```

### Internal structure

```
packages/embed/src/ceq-survey.ts          — Custom Element registration + Shadow DOM mount
packages/embed/src/survey/
├── widget-bootstrap.ts                    — reads data-* attrs, exposes CustomerEQ.surveys.prefill
├── survey-mount.tsx                       — imports SurveyFormRenderer from @customereq/survey-renderer
├── theme-bridge.ts                        — pipes BrandTheme tokens → CSS variables on the Shadow root
└── prefill-store.ts                       — Map<surveyId, MemberPrefill>; consumed at submit
```

`packages/embed`'s `package.json` adds `@customereq/survey-renderer` and `@customereq/consent-text` as `dependencies` (already-published runtime packages). No `apps/web` imports.

### Submission path

The widget POSTs `/v1/public/surveys/:surveyId/respond` with body:

```json
{
  "answers": { ... },
  "score": 8,
  "channel": "embedded",
  "memberId": null,                          // when only externalId is known
  "email": "jane@example.com",               // from prefill or in-form fallback
  "externalId": "usr_xyz",                   // from prefill
  "firstName": "Jane",
  "lastName": "Doe",
  "phone": null,
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
| `dnd-kit` adds 40 KB to the admin bundle | Low | Low — admin bundle, not respondent-facing | Treeshake — only `core` + `sortable` (skip `modifiers` / `accessibility-overlay`). Lazy-load the Questions tab if first-screen budget is hit. |
| Page handler still reads `?email=` URL param after deploy | Low | High if it lingers — re-introduces #209's PII leak | Same-commit removal in `apps/web/src/app/survey/[id]/page.tsx`. E2E asserts the legacy URL falls through to the standalone prompt. |
| Migration mode() returns NULL for a (programId, type) group | Low | Low — INSERT skipped silently | Fixture asserts the brand-only-survey-incentive case produces the rule; if mode() is NULL the group has no `incentivePoints > 0` rows and the INSERT correctly writes nothing. |
| `request.ip` is `null` in prod because trust-proxy is misconfigured | Medium | Low — `ipAddress = null`, structured-log warning fires | Per NFR-S5, the audit row is still written; the warning is observable in Application Insights and gives ops a clear signal to fix the proxy chain. The row is never blocked on IP availability. |

## Deviation from ADR 0001

ADR 0001 establishes the standard four-route admin CRUD layout: `/admin/{entity}` (list) · `/admin/{entity}/new` (create) · `/admin/{entity}/[id]` (view) · `/admin/{entity}/[id]/edit` (edit). #241 V0 deliberately deletes the `/new` route (R1). Two routes shrink to three.

**Rationale.** The duplicate-draft surface is the root cause #241 is designed to eliminate. ADR 0001's `/new` route hosts a "Create" form that POSTs at submit; that's a wizard, and wizards POST-on-every-Next is what produced the duplicate-draft bug in the first place. Moving creation to "+ New survey button immediately POSTs and routes to `/[id]/edit`" eliminates the surface protocol-level — there is no form to submit, only auto-save edits to an already-created row.

**Pattern proposed.** A new exception class, "section-tabbed-create surfaces", added to ADR 0001 as an amendment. The exception applies when:

- The entity's create form would have ≥ 3 fields **and** the natural editing experience is multi-section (not linear).
- The fields cluster into independent semantic sections (Basics / Look & Feel / etc.).
- The defaults for required fields are good enough to land the operator on the editor with a sane row (`name='Untitled survey'`, `type='NPS'`, etc.).
- The operator's first edit is much more likely to be a section save than a one-shot fill-and-submit.

**Decision.** This RFC files an amendment to ADR 0001 as a small companion commit on the same branch, adding the exception. Future entities matching the four criteria may follow the same pattern; entities that don't (Programs, Alert Rules, Webhooks) continue with `/new`. Open question: whether the amendment is in scope for #241's PR or filed separately. Recommend in-scope so the deviation lands documented; ADR amendments are cheap.

## Implementation Slicing

The umbrella is large enough that landing as one PR will exceed reviewer attention budget. Recommended split into 5 slices (file the implementation issue with these as sub-issues / checkboxes):

| Slice | Scope | Schema gate? |
|---|---|---|
| **1. Schema + migration** | Single Prisma migration, `Survey.title` add + backfill, `Survey.incentivePoints` + `Survey.showIncentivePoints` drop, `SurveyStatus.CLOSED → STOPPED`, `AuditEvent.ipAddress` add, D50 fan-out. Migration tests. | YES — must land first |
| **2. API surface + consent-mode endpoint + audit extension** | `PATCH /v1/surveys/:id/consent-mode` new endpoint; `PATCH /v1/surveys/:id` schema update (`.strict()` + state-aware allowlist); `POST /v1/surveys/:id/responses` event emission cleanup + responsePolicy enforcement; audit-plugin `ipAddress` capture; per-route audit allowlists. API integration tests. | depends on 1 |
| **3a. Extract `packages/survey-renderer`** | New domain-narrow package hosting `SurveyFormRenderer`, `ConsentDisclosure`, `QuestionRenderer`, `MemberIdField`, theme token mapping. Pure React, no app-state coupling. Per architecture §3 introductory paragraph criteria (consumed by ≥2 apps; no value in worker; clear shape stability). Standalone-page handler at `apps/web/src/app/survey/[id]/page.tsx` migrated to import from new package as a smoke verification that the package is wire-correct. | depends on 2 |
| **3b. Web editor — list + Basics + Look & Feel + Points & Thank You** | List page rewrite; editor shell + RHF; BasicsTab + ConsentCollectionSubBlock + ConsentAttestationModal; LookFeelTab + PreviewSurvey (uses `@customereq/survey-renderer` from 3a); PointsAndThankYouTab; ActivateModal; DiscardDraftModal. `/admin/surveys/new` + `/admin/surveys/[id]/edit` redirect stub deleted in this slice. | depends on 3a |
| **4. Web editor — QuestionsTab + detail page + delete old survey-builder** | QuestionsTab with dnd-kit; detail page rewrite (3 collapsible sections; reuses `<PreviewSurvey/>`); old `/admin/survey-builder/` directory deleted; E2E tests | depends on 3b |
| **5. Embed widget (`packages/embed/src/ceq-survey.ts`)** | Web Component; data-attribute + JS prefill APIs; theme bridge; imports `@customereq/survey-renderer` from 3a; widget Playwright on sample host page; remove `?email=` URL surface from page handler | depends on 3a (the package) |

Slices 4 and 5 can run in parallel after 3 lands. Each slice is independently revertable. The "delete the old survey-builder" step is intentionally in slice 4 (not 3) so the rollout has a one-PR window where both old and new editors exist on `main` — gives QA a side-by-side compare without a feature flag.

## Open Questions

| # | Question | Default | Decided by |
|---|---|---|---|
| **TQ1** | Does the ADR 0001 amendment ship with #241's PR or as a separate one? | In-scope (this PR) | Reviewer signoff on this RFC |
| **TQ2** | Should `Survey.title` enforce `title ≠ name` to prevent the admin-name-leaking-to-respondent footgun? | No in V0 — the labels in Basics are enough; revisit if customer feedback surfaces the issue | Implementation phase QA |
| **TQ3** | Is the `dnd-kit` bundle hit acceptable, or do we ship Up/Down buttons only in V0 and add drag later? | dnd-kit in V0 | Implementation phase if bundle budget is a concern |
| **TQ4** | The `/v1/surveys/:id/launch` endpoint (#80's atomic rule-launch) remains in code but is unused by #241. Do we mark it deprecated, or leave it as-is for #234/#242/#246 to reuse? | Leave as-is; sub-issues for actions own the decision | Implementation phase |

All other OQs from the spec (OQ1–OQ5) are resolved in the spec's Decision Log (D49–D52); this RFC consumes those decisions directly and does not reopen them.

## Spike Findings

No spike was required for this RFC. All technical ambiguities resolved through code reading and primary-source verification:

- **Worker exact-string match** at `apps/worker/src/processors/loyaltyEvents.ts:81` confirmed — no worker code change needed for D50.
- **`resolveOrEnrollMember` POST-body signature** at `apps/api/src/routes/public.ts:295` accepts `memberId/email/phone/firstName/lastName/externalId` — D51's prefill patterns flow unchanged.
- **Schema state** of `Survey`, `BrandTheme`, `ConsentMode`, `ResponsePolicy`, `EarningRule`, `AuditEvent` verified at exact line numbers; the only delta surfaces are: add `Survey.title`, drop `Survey.incentivePoints` + `Survey.showIncentivePoints`, rename `SurveyStatus.CLOSED → STOPPED`, add `AuditEvent.ipAddress`.
- **EarningRule.attribution column** does not exist; migration uses `EarningRule.name` prefixed with `[#241 migration]` for provenance — verified by reading `EarningRule` schema at `schema.prisma:291-314`.
- **Audit plugin extension** `ipAddress: request.ip` is additive — Fastify exposes `request.ip` natively; no plugin restructure required.

## Observability

Per NFR-O1 / NFR-O2 / NFR-O3:

- **Survey state transitions** — every `Survey.status` change writes an audit row with `metadata.fromStatus`, `metadata.toStatus`, `actorId` from JWT, `ipAddress` from `request.ip`. The route uses `auditAction: 'survey.status_update'`.
- **Consent override writes** — every `PATCH /v1/surveys/:id/consent-mode` writes an audit row with `metadata.consentMode`, `metadata.consentReason` (truncated to first 200 chars), `metadata.attestation.confirmed`. Route uses `auditAction: 'survey.consent.update'`.
- **Disclosure-text changes** — every `consentTextOverride` change on the general PATCH writes the audit row through the standard `survey.update` path with `metadata.consentTextOverride` (truncated to first 200 chars).
- **BullMQ event metrics** — no new metrics; existing consumer-lag / success-count / failure-count on the `loyalty-events` queue continue to cover the cx event path.

Application Insights queries for the activity-view substrate (NFR-O5):

```kusto
audit_events
| where action startswith 'survey.'
| project createdAt, brandId, action, resourceId, actorId, ipAddress, metadata
| order by createdAt desc
```

## Confidence Level

**85/100.** The decomposition tracks the spec verbatim; every R# maps to a concrete artifact; every NFR has a validation row. Remaining risk is concentrated in:

- The D50 fan-out SQL — the migration is correct on paper but hasn't run against the fixture set yet (gated by Slice 1 acceptance).
- The embed widget bundle size — depends on how cleanly `SurveyFormRenderer` tree-shakes; size budget enforced in CI as the gate.
- The `dnd-kit` accessibility behavior on Safari iOS — needs verification in the Playwright mobile matrix as part of Slice 4.

The remaining 15 points reflect those three implementation-time validations, all of which have clear evidence checkpoints in the Validation Plan.

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
| 8 | **Domain-narrow runtime packages** (§3 introductory paragraph) | RFC reuses `packages/consent-text` as-is (no modification); see "Missing from Architecture" #1 below for the new package this RFC adds |
| 9 | **Standard pagination envelope on list endpoints** (§4.1) | `GET /v1/surveys` shape unchanged — `{ data, total, page, pageSize, totalPages }` |
| 10 | **GDPR/CCPA baked in, not bolted on** (§6 + project rule R13) | Consent attestation captured at write time with actor + timestamp + reason; audit log feeds compliance reporting; PII not introduced into new columns (consent override metadata is operational, not PII) |
| 11 | **Centralized test infrastructure (`packages/config/src/test-utils/`)** (§9.2) | New test files (`survey-admin.spec.ts`, `surveys-admin.test.ts`, `surveys-consent-override.test.ts`, `survey-completion-earn.test.ts`) all import factories from `@customerEQ/config/test-utils` — no inline mocks |
| 12 | **CI gate: build + typecheck + lint + test:smoke + migration replay** (§7.4 + `.github/workflows/ci.yml:75`) | RFC's validation plan trips this gate at PR time; migration test asserts idempotent re-replay |

### Patterns Missing from Architecture

These are patterns the RFC introduces that aren't documented in `architecture.md` today. Each warrants an additive update to the architecture doc — but that update is deferred to the address-feedback phase per FRAIM's architecture-gap-review contract.

| # | New pattern | Why it's needed | Suggested resolution |
|---|---|---|---|
| **MA1** | **Section-tabbed-create exception to ADR 0001** — entities whose create form has ≥3 fields clustering into independent semantic sections may skip `/admin/{entity}/new` and route "+ New {entity}" directly to POST + `/[id]/edit`. | Wizards POST-on-every-Next produced the duplicate-draft surface #241 is built to eliminate. Forcing the section-tabbed editor through a `/new` first would re-introduce the same surface in a new costume. | Amend ADR 0001 in a companion commit on this branch (TQ1) adding the exception class with the four criteria from §"Deviation from ADR 0001". Update architecture.md §3.1 "Standard CRUD admin pattern" bullet with a pointer to the amendment. |
| **MA2** | **Auto-save on blur for admin forms** — RHF `mode: 'onBlur'` + 500ms debounce per dirty field; one PATCH per blur with the single changed field in the body. | #292 Slice 4's `OrganizationSettingsForm` uses per-section Save buttons; #241 is the first admin surface to auto-save. The pattern needs a documented contract so future entities can pick it up consistently. | Add a paragraph to architecture.md §3.1 under "Standard CRUD admin pattern" describing when auto-save vs. explicit-save applies (rule of thumb: auto-save when the editing surface is multi-section and the operator's mental model is "tweak fields and walk away", explicit-save when the operator's intent is a discrete commit boundary like a status change or webhook re-test). |
| **MA3** | **Channel-aware form-renderer as a shared runtime package** — `packages/survey-renderer` (NEW) hosts the pure React component that both apps/web (admin previews + standalone page handler) and packages/embed (Web Component widget) import at build time. | The embed package's existing "No cross-package imports" invariant (§3.7) needs an explicit-extraction pattern when a renderer is reused across the standalone host + the embedded widget. `packages/consent-text` is the precedent: parser + validator + renderer in one domain-narrow package consumed by ≥2 apps. | Create `packages/survey-renderer` (the RFC's slice 3 + 5 both update to import from this new package). Add a row to architecture.md §3 introductory paragraph naming the package alongside `packages/consent-text` and `packages/embed`. See "Incorrectly Followed" IF1 below for the conflict this resolves. |
| **MA4** | **State-aware PATCH field allowlist** — a PATCH handler enforces a per-(status, field) allowlist before persisting, returning HTTP 409 `{ code: 'FIELD_NOT_EDITABLE_IN_STATE', field, currentState }` on disallowed mutations. | R29 / R30 require the contract; today's surveys.ts has no such gate. This is the first time a CustomerEQ entity has state-conditional edit rules at the API boundary. | Document as a paragraph under architecture.md §4.1 "API Routes" (or §6 Design Patterns) — name the contract and the HTTP code + body shape so future stateful entities (Campaigns? Programs?) can adopt it consistently. |
| **MA5** | **AuditEvent.ipAddress capture via Fastify request.ip** — additive column on AuditEvent; audit plugin reads `request.ip` (which honors the Fastify trust-proxy chain); null on misconfiguration with structured-log warning. | NFR-S5 requires it; today the audit plugin doesn't persist IP. | Document the additive contract in architecture.md §4.2 audit plugin row: "audit row captures `actorId`, `ipAddress` (from `request.ip`, honoring trust-proxy; null on misconfiguration with structured log warning), and per-route metadata filtered through `auditAllowlist`." |

### Patterns Incorrectly Followed

| # | Conflict | Architecture says | Original RFC draft said | Resolution applied |
|---|---|---|---|---|
| **IF1** | **Embed widget importing from apps/web** | §3.7 Embed Layer: "**No cross-package imports**: Standalone at build time — does not import from `@customerEQ/shared` or other packages." | First draft said `ceq-survey.ts` "imports `apps/web/src/components/survey-form/SurveyFormRenderer` at build time via Vite's library mode" — a direct violation. | **Extract `packages/survey-renderer`** (MA3 above). Both apps/web and packages/embed import from the new domain-narrow package. The embed widget remains build-time-standalone with respect to `apps/web` and `@customerEQ/shared`. The new package is consumed by both the admin previews and the production widget, satisfying the "consumed by ≥2 apps" criterion the introductory §3 paragraph specifies for domain-narrow packages. Sections §"Web UI Architecture", §"Embed Widget", and §"Implementation Slicing" of this RFC are updated to reference `@customerEQ/survey-renderer` rather than the `apps/web` path. |

No other Incorrectly Followed patterns identified. The remaining design decisions either follow existing patterns (table above) or introduce new patterns flagged as Missing from Architecture (deferred to address-feedback phase).

## Traceability Matrix

Every functional and non-functional requirement maps to one or more RFC sections + implementation slices.

| Req | RFC section | Slice |
|---|---|---|
| R1 — list page, single `+ New survey` CTA, deleted old routes | §Web UI / Surveys list | 3 (then 4 for survey-builder dir removal) |
| R2 — row click → detail page | §Web UI / Surveys list | 3 |
| R3 — 4 horizontal tabs in named order | §Web UI / RHF form structure | 3 / 4 |
| R4 — auto-save on blur, no POST on tab nav | §Web UI / RHF form structure + §API / PATCH /:id | 2 / 3 |
| R5 — Back/Continue + persistent Activate | §Web UI / RHF form structure | 3 |
| R6 — Type 4-card grid + type-change modal | §Web UI / BasicsTab | 3 |
| R7 — Internal name + Survey title required | §Schema / Survey.title + §API / Zod | 1 / 2 / 3 |
| R8 — Response policy field + ONCE 409 + anonymous bypass | §API / POST /:id/responses | 2 |
| R9 — Consent mode dropdown shows only differing override | §Web UI / ConsentCollectionSubBlock | 3 |
| R10 — Override-to-more-permissive requires attestation | §API / PATCH /:id/consent-mode + §Web UI / ConsentAttestationModal | 2 / 3 |
| R11 — Override-to-stricter no attestation, still audit | §API / PATCH /:id/consent-mode | 2 |
| R12 — `.consent-toolbar` editor with token insert; Terms link conditional | §Web UI / ConsentCollectionSubBlock; reuses `packages/consent-text` | 3 |
| R13 — Blank disclosure renders no consent block + audit | §Web UI / ConsentCollectionSubBlock + §Audit | 2 / 3 |
| R14 — Preview card renders disclosure as respondents will see | §Web UI / PreviewSurvey + ConsentDisclosure | 3 |
| R15 — Standalone renders member-ID field | §Web UI / MemberIdField | 3 |
| R16 — Embedded prefill A1/A2; URL identifier removed | §Embed Widget + §API / public.ts removal | 2 / 5 |
| R17 — Look & Feel preview channel-first × viewport | §Web UI / LookFeelTab | 3 |
| R18 — Per-channel chrome matrix | §Web UI / LookFeelTab + §Embed (theme-bridge) | 3 / 5 |
| R19 — Theme picker lists all brand themes; no Manage link | §Web UI / LookFeelTab | 3 |
| R20 — Points read-only display sourced from EarningRule | §Web UI / PointsAndThankYouTab | 3 |
| R21 — Thank-you variable picker: 3 V0 variables only | §Web UI / PointsAndThankYouTab | 3 |
| R22 — Response handler emits one cx event; LoyaltyEvent atomic | §API / POST /:id/responses + Worker (no change) | 2 |
| R23 — Activate gating | §API / PATCH /:id/status + §Web UI / ActivateModal | 2 / 3 |
| R24 — Audit row on every state transition | §Audit + §API / PATCH /:id/status | 2 |
| R25 — Vocabulary; CLOSED→STOPPED rename; no "Launch"/"Close" | §Schema / Migration + §Web UI strings | 1 / 3 |
| R26 — Detail page 3 collapsible sections | §Web UI / Detail page | 4 |
| R27 — Distribution default-expanded when responsesCount=0 | §Web UI / Detail page | 4 |
| R28 — Configuration summary default-expanded when responsesCount=0; reuses PreviewSurvey | §Web UI / Detail page | 4 |
| R29 — State-aware editability + 409 on disallowed | §API / State-aware field editability | 2 / 3 |
| R30 — responsePolicy locks once responsesCount > 0 | §API / State-aware field editability | 2 |
| R31 — BrandTheme tokens applied to form-renderer (full coverage) | §Web UI / SurveyFormRenderer + §Embed / theme-bridge | 3 / 5 |
| R32 — Response section default-collapsed when responsesCount=0 | §Web UI / Detail page | 4 |
| NFR-P1 auto-save p95 < 200ms | §Validation Plan / Perf | 2 |
| NFR-P2/P3 form/widget first paint | §Validation Plan / Perf | 3 / 5 |
| NFR-P4 response → LoyaltyEvent p95 < 30s | §API / POST /:id/responses (unchanged latency) | 2 |
| NFR-S1 brand-scoped | §API / existing brandId gate | 2 |
| NFR-S2 opaque ids | §Schema / unchanged (cuid) | n/a |
| NFR-S3 disclosure XSS guard | §Validation Plan / `packages/consent-text` | 2 |
| NFR-S4 embed widget privilege | §Embed Widget | 5 |
| NFR-S5 audit ipAddress | §Audit + §Schema / AuditEvent.ipAddress | 1 / 2 |
| NFR-R1/R2 atomicity + idempotency | §Validation Plan / Worker | 2 |
| NFR-R3 auto-save resilience | §Web UI / RHF form structure | 3 |
| NFR-R4 single status endpoint | §API / PATCH /:id/status | 2 |
| NFR-R5 BullMQ backpressure | §API / response emission (unchanged) | 2 |
| NFR-SC1–4 scalability | §Web UI + §API (no new scale surface) | 3 / 4 |
| NFR-A1–5 a11y | §Validation Plan / a11y + Question canvas | 3 / 4 |
| NFR-O1–5 audit observability | §Audit | 2 |
| NFR-I1–3 i18n | Deferred per spec; no change | n/a |
| NFR-B1–3 browser matrix | §Validation Plan / Browser | 3 / 4 / 5 |
| NFR-BC1–4 backcompat + migrations | §Schema / Migration; CI gate | 1 |

— End of RFC —
