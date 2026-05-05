# Feature: Survey-level consent override + IMPLIED_ON_SUBMIT data migration — Technical Design

Issue: [#276](https://github.com/mathursrus/CustomerEQ/issues/276)
Spec: [`docs/feature-specs/276-survey-level-consent-override.md`](../feature-specs/276-survey-level-consent-override.md)
Owner: manohar.madhira@outlook.com
Status: Draft round 1

## Customer

The data + backend change unblocks the **marketing manager / survey owner** persona's existing surveys (which today return 400 on every response submit because of #231 PR1's `Brand.consentMode = EXPLICIT` default). The override surface (PATCH endpoint contract + schema fields + audit-log payload) is what the **#241 Survey Admin UX epic** will bind its survey-editor consent panel to once shipped.

## Customer Problem being solved

Per spec §"Customer Problem being solved": #231 PR1 introduced a brand-wide consent toggle but no per-survey override. Production is blocked because pre-existing surveys can't accept responses; future operator agility requires a per-survey override gated by audit-quality attestation (WHO + WHEN + WHY).

## User Experience that will solve the problem

This RFC ships **the data model, backend resolver, PATCH endpoint contract, audit-log payload, and one-shot data migration**. The survey-editor UX itself (settings panel + attestation modal + audit-trail badge) is owned by **#241** and binds to the API contract defined here.

**API caller flow** (this is what #241's UI binds to; same shape for any other client that wants to set the override programmatically):

1. Caller authenticates with a Clerk session (brand-scoped).
2. Caller PATCHes `/v1/surveys/:id` with one of:
   - `{ "consentMode": null }` → revert to inherit. Backend clears `consentMode`, `consentReason`, `consentSuppressedAttestedBy`, `consentSuppressedAttestedAt`. 200.
   - `{ "consentMode": "<mode-same-as-or-stricter-than-brand>" }` → no attestation needed. Backend sets `consentMode` and clears `consentReason`/`consentSuppressedAttested*`. 200.
   - `{ "consentMode": "<mode-more-permissive-than-brand>", "consentReason": "<non-empty text>" }` → attestation required. Backend sets all four columns atomically using the authenticated user as the attester. 200.
   - Same as above but missing `consentReason` → 422 with structured error.
3. Subsequent `POST /v1/public/surveys/:id/respond` calls resolve via the resolver: if `Survey.consentMode` is non-null, it overrides; if null, the brand default applies.
4. Audit log captures every consent-mode write with `metadata.consentMode`, `metadata.consentReason`, `metadata.previousConsentMode`, `actorUserId`, timestamp.

**Migration flow** (one-shot, runs in CI/CD with `prisma migrate deploy`): every `Survey` row across all brands and all organizations where `consentMode IS NULL` is set to `IMPLIED_ON_SUBMIT` with `__migration_276__` as the attester and a fixed reason text naming the migration. Idempotent via `WHERE consentMode IS NULL`.

## Technical Details

### Schema changes (`packages/database/prisma/schema.prisma`)

Two nullable column adds on the existing `Survey` model. No new enum (reuses `ConsentMode` from #231 PR1).

```prisma
model Survey {
  // ... existing fields ...

  // Issue #231 PR1 (existing)
  responsePolicy                ResponsePolicy @default(MULTIPLE)
  consentTextOverride           String?
  consentSuppressedAttestedBy   String?
  consentSuppressedAttestedAt   DateTime?

  // Issue #276 (new)
  consentMode                   ConsentMode?  // null = inherit Brand.consentMode
  consentReason                 String?       // free-text justification when override is set
}
```

No index needed — `consentMode` is read alongside the survey row in the resolver path; no standalone query filters on it.

### Schema migration

New migration `packages/database/prisma/migrations/<TIMESTAMP>_add_survey_consent_override/migration.sql`:

```sql
-- Issue #276 — survey-level consent mode override + reason text.
-- Both columns are nullable additions; no data backfill in this migration.
-- The data migration (UPDATE existing rows to IMPLIED_ON_SUBMIT) lives in a
-- separate migration file so the schema change can land independently and
-- the data migration can be re-run safely (WHERE consentMode IS NULL).
--
-- Idempotency follows the patterns established in #270 + #281: ALTER TABLE
-- ADD COLUMN with IF NOT EXISTS so a `db push`-then-`migrate deploy` flow
-- (where the column may already exist via push) does not error.

ALTER TABLE "surveys"
  ADD COLUMN IF NOT EXISTS "consentMode" "ConsentMode",
  ADD COLUMN IF NOT EXISTS "consentReason" TEXT;
```

### Data migration

Separate migration `packages/database/prisma/migrations/<TIMESTAMP+1>_backfill_survey_consent_implied/migration.sql`:

```sql
-- Issue #276 — backfill all NULL consentMode rows to IMPLIED_ON_SUBMIT so
-- pre-existing surveys accept responses again (production hotfix). The
-- WHERE clause makes this idempotent: a second run touches zero rows.
-- All brands, all organizations — per round-1 reviewer scope decision.
--
-- Audit columns get a fixed system identifier (__migration_276__) so the
-- audit-trail surface (#241) can distinguish "machine-set by hotfix" from
-- "human-set by survey owner".

UPDATE "surveys"
SET
  "consentMode"                  = 'IMPLIED_ON_SUBMIT',
  "consentSuppressedAttestedBy"  = '__migration_276__',
  "consentSuppressedAttestedAt"  = NOW(),
  "consentReason"                = 'Production hotfix #276 — pre-existing survey defaulting to IMPLIED_ON_SUBMIT to restore response collection. Override may be tightened by survey owner via #241 UX once shipped.'
WHERE "consentMode" IS NULL;
```

The two migrations land together in the implementation PR, in the correct timestamp order. Splitting them makes the schema-vs-data concerns inspectable separately and keeps each file's purpose obvious.

### Resolver change (`apps/api/src/services/consentResolver.ts`)

Single field add to `SurveyConsentInput` plus three string substitutions in the existing branches. The `isSuppressed` branch is unchanged (suppression already implies `requiresExplicitConsent: false`).

```typescript
// Before
export interface SurveyConsentInput {
  consentTextOverride: string | null
}

// After
export interface SurveyConsentInput {
  consentTextOverride: string | null
  consentMode: 'EXPLICIT' | 'IMPLIED_ON_SUBMIT' | null  // new — null = inherit brand
}
```

In each of the 3 non-suppressed branches (currently lines 71, 82, 96), replace:

```typescript
requiresExplicitConsent: brand.consentMode === 'EXPLICIT',
```

with:

```typescript
requiresExplicitConsent: (survey.consentMode ?? brand.consentMode) === 'EXPLICIT',
```

The resolver's existing return shape doesn't need to change — `requiresExplicitConsent` is the only external-facing decision. The `survey-override` / `brand-default` source label remains accurate for the **text** sourcing (which is the field's purpose); we don't add a `consent-mode-source` label because consumers don't currently use it.

### PATCH endpoint contract (`apps/api/src/routes/surveys.ts:145`)

The existing `PATCH /v1/surveys/:id` route accepts `UpdateSurveySchema` and applies a single `prisma.survey.update`. We extend the schema with the two new fields and inject a server-side validation step that:

1. Reads the survey + its brand (single query joined on `surveyId`).
2. Computes `attestationRequired = (newConsentMode !== null) && morePermissiveThan(brand.consentMode, newConsentMode)` where the relation is `EXPLICIT < IMPLIED_ON_SUBMIT` (lower = stricter).
3. If `attestationRequired` AND `consentReason` is missing/empty/whitespace-only → 422 with `{error: 'attestation_required', missing: ['consentReason']}`.
4. If the request authenticated user is absent (shouldn't happen behind the auth middleware, but defense in depth) → 422 with `{error: 'attestation_required', missing: ['authenticatedUser']}`.
5. Constructs the `data` object for the update:
   - **Override → more permissive**: set `consentMode`, set `consentReason`, set `consentSuppressedAttestedBy = request.user.id`, set `consentSuppressedAttestedAt = new Date()`.
   - **Override → same-as-or-stricter**: set `consentMode`, clear the other three to `null`.
   - **Revert (`consentMode = null`)**: clear all four to `null`.
6. Wraps the consent-mode-related write columns in a single Prisma `update` (Prisma's update is already atomic; no need for `$transaction` since there's only one row touched).

Schema delta (Zod):

```typescript
const ConsentModeOverrideSchema = z.object({
  consentMode: z.enum(['EXPLICIT', 'IMPLIED_ON_SUBMIT']).nullable().optional(),
  consentReason: z.string().min(1).max(2000).optional(),
})

const UpdateSurveySchema = ExistingUpdateSurveySchema.merge(ConsentModeOverrideSchema)
```

`max(2000)` on the reason text — generous but bounded; prevents pathological audit-trail bloat. `min(1)` covers empty-string; we additionally trim-and-recheck server-side to catch whitespace-only.

### Audit log payload (`apps/api/src/plugins/audit.ts`)

The existing audit plugin auto-captures `survey.update` actions via `inferAction`. The change here is to make sure the consent-mode-related fields end up in `metadata`. Two options:

- **Option A (recommended)**: extend the audit plugin's metadata-extraction to include the request-body fields it cares about + the previous values for those fields. This is the cleanest path for any future field that wants audit visibility — opt-in by name.
- **Option B**: add the metadata in the route handler itself before/after the prisma update. More targeted; doesn't require touching the plugin.

Recommendation: **Option A** with a per-route allowlist. Plugin gains a `survey.update.metadata: ['consentMode', 'consentReason', 'previousConsentMode']` config. Route handler computes `previousConsentMode` from the read-before-write (already in the flow per step 1 above). Plugin merges the allowlisted fields into `metadata`.

If the plugin shape doesn't accommodate this cleanly during implementation, fall back to Option B (small inline call to `request.audit.log({ action: 'survey.update', metadata: {...} })` after the prisma write).

### UI changes

None in this RFC. The survey-editor consent panel + attestation modal + audit-trail badge are owned by #241 (per spec §"Scope split"). The mock at `docs/feature-specs/mocks/276-view.html` is informational input to #241.

### Failure modes & timeouts

| Failure | Behavior |
|---|---|
| Caller PATCHes more-permissive override without `consentReason` | 422 `{error: 'attestation_required', missing: ['consentReason']}` — caller (likely #241's modal) re-prompts. |
| Caller PATCHes with whitespace-only `consentReason` | 422 same error — server trims before validation. |
| Caller PATCHes a survey under a different brand | 404 (existing brand-scoped lookup at line 156-158 already filters; no change). |
| Caller PATCHes with invalid `consentMode` value (typo) | 422 from Zod — existing failure path. |
| `Brand.consentMode` is itself `null` (shouldn't happen — column is `NOT NULL DEFAULT 'EXPLICIT'`, but defensively) | The "more permissive than brand" check fires conservatively (treats null brand as `EXPLICIT`); attestation required. Documented as defensive-only. |
| Audit log write fails after prisma write succeeds | Existing audit plugin behavior — log a warn, don't fail the request. The audit gap is observable via warn count; the survey row update is the source of truth. |
| Migration runs on a DB that already has `consentMode` column from `db push` | `ADD COLUMN IF NOT EXISTS` is a no-op. (Lessons from #270 + #281.) |
| Migration runs twice | `WHERE consentMode IS NULL` clause makes the second run a no-op (zero rows touched). |

No new timeouts — same Fastify request lifecycle as the existing PATCH endpoint.

### Telemetry & analytics

| Metric | Source | Use |
|---|---|---|
| Count of `survey.update` audit-log rows where `metadata.consentMode` differs from `metadata.previousConsentMode` | Audit log table | Ops view of override frequency per brand. |
| Count of pre-existing surveys still at `consentMode IS NULL` immediately after the data migration | Postgres query (one-shot, run as part of migration verification) | Confirms AC1: zero rows should remain NULL. |
| Pino log line at warn level when the resolver sees a survey with `consentMode != null` resolving differently from brand | `consentResolver.ts` | Optional, low-volume; flag for observability if/when we want override-per-survey traffic counts. |

No new dashboards or alerts; existing audit-feed observability covers the surface.

## Confidence Level

**92 / 100.** Schema delta is two nullable adds (Prisma idiom, well-tested pattern). Resolver change is one field + three substitutions in proven code. PATCH endpoint extension is a Zod schema merge + a guard that mirrors the existing 422 patterns in the same file. Migration is idempotent by construction. The 8-point haircut covers: (a) audit-plugin Option A vs B may need to flip during implementation if the plugin's existing shape doesn't accommodate per-route metadata allowlists; (b) the `previousConsentMode` capture in the route handler depends on the read-before-write pattern not introducing a TOCTOU window — Prisma's update by `where: { id }` is single-row and brand-scoped, so the window is real but the brand-isolation guarantee holds.

## Validation Plan

| User Scenario | Expected outcome | Validation method |
|---|---|---|
| Survey owner PATCHes a survey to a more permissive mode with a non-empty reason | 200; `consentMode`, `consentReason`, `consentSuppressedAttestedBy`, `consentSuppressedAttestedAt` all set; audit-log row with full metadata | Vitest API integration test against real DB |
| Survey owner PATCHes a survey to a more permissive mode without a reason | 422 `{error: 'attestation_required', missing: ['consentReason']}`; row is unchanged | Same |
| Survey owner PATCHes a survey to the brand's mode (no deviation) | 200; `consentMode` set; the other three columns cleared to NULL | Same |
| Survey owner PATCHes `consentMode: null` (revert) | 200; all four columns cleared to NULL | Same |
| Public submit endpoint receives a response on a survey whose `consentMode = IMPLIED_ON_SUBMIT` under a brand whose `consentMode = EXPLICIT`, without the `consent` field | 200; response persisted | Vitest API integration test against real DB |
| Public submit endpoint receives a response on a survey whose `consentMode = EXPLICIT` under a brand whose `consentMode = IMPLIED_ON_SUBMIT`, without the `consent` field | 400; response rejected | Same |
| `prisma migrate deploy` on a fresh DB applies both new migrations cleanly | All migrations green; CI gate from #270 catches any regression | CI on the implementation PR |
| Data migration re-run (idempotency) | First run sets every NULL row; second run is a no-op (no `Survey.updatedAt` advances) | Local psql replay + assertion query |
| Embedded widget continues to work for any consent mode | Widget renders + submits successfully against test survey under each consent mode | Manual smoke (or Playwright if #241's E2E infra is in scope by impl time) |

## Test Matrix

### Unit

| Suite | What | Where |
|---|---|---|
| Resolver — survey override | 4 cases: brand=EXPLICIT/survey=null/EXPLICIT/IMPLIED_ON_SUBMIT × the 3 non-suppressed branches | `apps/api/src/services/consentResolver.test.ts` (existing file; new `describe` block) |
| PATCH validation logic | Pure function `morePermissiveThan(brandMode, newMode)` covers all 4 mode pairs + null cases | New `apps/api/src/routes/surveys.consent.test.ts` (or co-located) |
| Audit metadata extraction (Option A) | The plugin extracts the allowlisted `consentMode` + `consentReason` from the request body and includes the previous value | `apps/api/src/plugins/audit.test.ts` extension |

### Integration (real DB, real audit table)

| Suite | What | Where |
|---|---|---|
| PATCH endpoint contract | All 4 PATCH scenarios from the Validation Plan above | `apps/api/test/integration/surveys-consent-override.test.ts` (new) |
| Survey-response endpoint with override | The 2 public-submit scenarios from the Validation Plan | `apps/api/test/integration/public-survey-response.test.ts` (extend existing) |
| Audit-log payload | Assert the audit row exists with full metadata after a more-permissive PATCH | Same as PATCH endpoint suite |
| Migration | Run both migrations against a real ephemeral pgvector DB; assert idempotency | The CI gate from #270 + a one-shot local script that `psql ON_ERROR_STOP=1` replays the data migration twice |

### E2E

None added in this RFC. The end-to-end UX flow lives in #241 once that ships its consent panel — at that point #241 owns the Playwright spec. Pre-shipping #276 gets validated end-to-end via the integration tests + a manual smoke against the embedded widget.

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| New schema migration is non-idempotent on `db push`-then-`migrate deploy` (the #270 / #281 class) | Low — `ADD COLUMN IF NOT EXISTS` is the documented idempotency-safe pattern | High — repeats production-blocking incidents | Use `IF NOT EXISTS` on the column add; CI gate from #270 catches regressions on every PR |
| Data migration clobbers a deliberate post-#231 operator-set `consentMode` value | Very low | Medium | `WHERE consentMode IS NULL` clause preserves any pre-set value. The reviewer accepted this scope on round 1 of the spec. |
| Audit-plugin Option A doesn't compose cleanly with the existing plugin shape | Medium | Low — falls back to inline call (Option B) | Implementation phase decides; either option satisfies R8's audit requirement |
| TOCTOU between read-before-write (`previousConsentMode` capture) and the prisma update | Low — single-row update, brand-scoped | Low — worst case is a stale `previousConsentMode` in audit metadata, not data corruption | Acceptable; if it matters later, wrap in `$transaction` with `findUnique` inside |
| Prisma checksum-drift warning on the existing dev DBs whose schema was synced via `db push` | Low — `migrate deploy` warns only, doesn't fail | Low — operator just sees a warning | Document; the #270 retro covered the same shape |
| Reason field is too short to be meaningful in audit | Medium | Low | `min(1)` validation catches empty/whitespace; #241's modal will likely add a placeholder + minimum-length nudge in UI; max(2000) caps pathological size |

## Spike Findings

Not applicable. No spike was run for this RFC. All surfaces are proven patterns: nullable Prisma column, Zod schema merge, single-row Prisma update, idempotent SQL migration. Confidence rationale lives in the §"Confidence Level" section.

## Observability

### Logs

- `consentResolver` already logs at debug level when the override branch is taken (no change). Promote to info-level at most a small percentage of the time if traffic visibility becomes useful (deferred).
- PATCH endpoint emits a structured info log on every successful override-set: `{event: 'survey.consent_mode.override_set', surveyId, brandId, oldMode, newMode, attesterId, hasReason: boolean}`. (Reason text NOT logged at info level — privacy posture for the audit trail; the audit plugin already captures it.)
- Audit plugin emits the existing `survey.update` event with the new metadata fields.

### Metrics

No new metrics in this RFC. The audit-log table is the source of truth; counts can be derived via SQL queries when the operations team wants a dashboard.

### Alerts

None. Override frequency is not an alertable signal — it's a normal operator action. If the migration runs and leaves any row with `consentMode IS NULL` after the fact, that's an investigate-worthy state, but it's caught by the migration's own success criterion in CI, not a post-deploy alert.

## Architecture Analysis

Following the 3-bucket pattern from #231's RFC (per project rule on architecture-doc surgery in implementation PRs).

### Patterns Correctly Followed

- **Multi-Tenant Isolation** (architecture.md §6): PATCH endpoint preserves the existing `brandId`-scoped lookup (line 156-158); the new fields don't change the tenant boundary.
- **GDPR/CCPA by Default** (architecture.md §6): the audit columns + reason field strengthen the consent-handling story without adding new PII collection.
- **Centralized Test Infrastructure** (architecture.md §6): all new tests use `@customerEQ/config/test-utils` factories; no inline mocks.
- **Idempotency** (architecture.md §6): both migrations are idempotent by construction (`IF NOT EXISTS` schema, `WHERE consentMode IS NULL` data).

### Missing from Architecture (defer to implementation PR's address-feedback)

- **Brand-default-with-survey-override storage hierarchy**: this pattern was already implicit in #231 PR1 (`Brand.consentTextDefault` + `Survey.consentTextOverride`); #276 extends it for `consentMode`. Architecture.md §6 should call this out as a named pattern. **Carried over** from the #231 retro queue (one of the 5 missing-from-architecture entries the #231 implementation PR was supposed to land but didn't).
- **Attestation columns as a unified audit-shape**: `consentSuppressedAttestedBy/At/Reason` is now serving two semantically related but distinct attestation reasons (R17 suppression from #231, override from #276). Worth a one-paragraph note in architecture.md §6 documenting the shared shape.

### Incorrectly Followed

None identified.

---

## Decisions for the reviewer

A short numbered set so reviewer can answer in one chat turn.

| # | Decision | Recommended | Alternative |
|---|---|---|---|
| 1 | **Migration split**: ship the schema migration and the data migration as **two** separate timestamped files (recommended), or **one** combined file? | Two files — schema vs data concerns are inspectable separately; the data migration is the one that's idempotent-by-WHERE; the schema migration is idempotent-by-IF-NOT-EXISTS. | One file with both ALTER TABLE and UPDATE under a single `BEGIN; … COMMIT;`. Simpler diff, but less inspectable. |
| 2 | **Audit-plugin extension shape**: Option A (per-route metadata allowlist in the plugin) ← recommended; Option B (inline call in route handler). | A. Reusable for any future field that wants audit visibility. | B. Smaller surface; doesn't touch the plugin. |
| 3 | **`consentReason` max length**: 2000 chars (recommended) vs 500 vs unbounded TEXT. | 2000. Generous; bounded enough to prevent pathological audit-trail bloat; short enough to render in a badge tooltip without truncation logic. | 500 (tighter UX) or unbounded (zero implementation cost, slightly more risk). |
| 4 | **Resolver source label**: keep the existing `'survey-override' / 'brand-default'` labels on the **text** field (recommended), or also add a `consentModeSource` label? | Don't add. Consumers don't currently use a source label for the mode; only the `text` benefits because the text branches. Adding now is YAGNI. | Add `consentModeSource: 'survey-override' / 'brand-default'` for symmetry. |

If the reviewer prefers different answers, only Migration Split and Audit Plugin Option affect the implementation shape. The other two are local choices that the implementation can flex on.
