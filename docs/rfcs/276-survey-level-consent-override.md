# Feature: Survey-level consent override + IMPLIED_ON_SUBMIT data migration — Technical Design

Issue: [#276](https://github.com/mathursrus/CustomerEQ/issues/276)
Spec: [`docs/feature-specs/276-survey-level-consent-override.md`](../feature-specs/276-survey-level-consent-override.md)
Owner: manohar.madhira@outlook.com
Status: Draft round 2 (re-scoped per round-1 review)

## Customer

The data + backend change unblocks the **marketing manager / survey owner** persona's existing surveys (which today return 400 on every response submit because of #231 PR1's `Brand.consentMode = EXPLICIT` default). The schema columns this RFC adds are what the **#241 Survey Admin UX epic** will bind its survey-editor consent panel to once shipped — including the PATCH endpoint that writes them.

## Customer Problem being solved

Per spec §"Customer Problem being solved": #231 PR1 introduced a brand-wide consent toggle but no per-survey override. Production is blocked because pre-existing surveys can't accept responses; future operator agility requires a per-survey override gated by audit-quality attestation (WHO + WHEN + WHY).

## User Experience that will solve the problem

This RFC ships **schema (the new columns) + backend resolver (the read path) + one-shot data migration (the production unblock)**. The PATCH endpoint that *writes* the new columns, the per-route audit-plugin extension, and the survey-editor UX (settings panel + attestation modal + audit-trail badge) all belong to **#241** — they ship as one end-to-end flow rather than as field-by-field plumbing accreted across two issues.

This re-scope is the same logic that put the UX in #241: anything the survey-editor UI is the only caller of belongs with the UI. Spec R5/R6 (PATCH attestation contract) and R8 (audit-log payload) were originally drafted into #276 to make the API surface available before the UI; round-1 review correctly pointed out that no other caller needs them.

**Migration flow** (one-shot, runs in CI/CD with `prisma migrate deploy`): every `Survey` row across all brands and all organizations where `consentMode IS NULL` is set to `IMPLIED_ON_SUBMIT` with `__migration_276__` as the attester and a fixed reason text naming the migration. Idempotent via `WHERE consentMode IS NULL`.

**Read flow** (every survey-response submit, immediately after this RFC ships): the existing `POST /v1/public/surveys/:id/respond` endpoint already calls `getConsentTextForSurvey()`. The resolver gains the new survey-level field and uses it to compute `requiresExplicitConsent`. Behavior change is opt-out: if `survey.consentMode` is null, behavior is unchanged from #231 PR1.

**Operational escape hatch until #241 ships**: survey owners who urgently need to tighten a specific survey to `EXPLICIT` (after the data migration sets it to `IMPLIED_ON_SUBMIT`) can:
- Wait for #241 (per round-1 reviewer: prioritized immediately).
- Or use ad-hoc admin SQL — the same path admins use today to set brand defaults via #277's Organization Settings landing.

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
  consentMode                   ConsentMode?                 // null = inherit Brand.consentMode
  consentReason                 String?       @db.VarChar(500)  // override justification (cap 500 per round-1 decision #3)
}
```

No index needed — `consentMode` is read alongside the survey row in the resolver path; no standalone query filters on it. The 500-char cap on `consentReason` is enforced at the column level so any future writer (the #241 PATCH endpoint, ad-hoc admin SQL, the data migration) is bounded by the same limit.

### Schema migration

New migration `packages/database/prisma/migrations/<TIMESTAMP>_add_survey_consent_override/migration.sql`. Schema change is permanent; data backfill lives in a separate file (per round-1 decision #1) so each file's purpose is inspectable in isolation.

```sql
-- Issue #276 — survey-level consent mode override + reason text.
-- Both columns are nullable additions; no data backfill in this migration.
-- Idempotency follows the patterns established in #270 + #281: ALTER TABLE
-- ADD COLUMN with IF NOT EXISTS so a `db push`-then-`migrate deploy` flow
-- (where the column may already exist via push) does not error.

ALTER TABLE "surveys"
  ADD COLUMN IF NOT EXISTS "consentMode" "ConsentMode",
  ADD COLUMN IF NOT EXISTS "consentReason" VARCHAR(500);
```

### Data migration

Separate migration `packages/database/prisma/migrations/<TIMESTAMP+1>_backfill_survey_consent_implied/migration.sql`. One-time activity (per round-1 decision #1).

```sql
-- Issue #276 — backfill all NULL consentMode rows to IMPLIED_ON_SUBMIT so
-- pre-existing surveys accept responses again (production hotfix). The
-- WHERE clause makes this idempotent: a second run touches zero rows.
-- All brands, all organizations — per round-1 reviewer spec decision (Q3).
--
-- Audit columns get a fixed system identifier (__migration_276__) so the
-- audit-trail surface (#241) can distinguish "machine-set by hotfix" from
-- "human-set by survey owner". The reason text fits within the 500-char
-- column cap (191 chars).

UPDATE "surveys"
SET
  "consentMode"                  = 'IMPLIED_ON_SUBMIT',
  "consentSuppressedAttestedBy"  = '__migration_276__',
  "consentSuppressedAttestedAt"  = NOW(),
  "consentReason"                = 'Production hotfix #276 — pre-existing survey defaulting to IMPLIED_ON_SUBMIT to restore response collection. Override may be tightened by survey owner via #241 UX once shipped.'
WHERE "consentMode" IS NULL;
```

Both migrations land together in the implementation PR, in the correct timestamp order.

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

### PATCH endpoint contract — DEFERRED to #241

The PATCH endpoint that *writes* `Survey.consentMode` and `Survey.consentReason` (with the attestation guard, the 422-on-missing-reason error shape, and the same-vs-stricter-vs-more-permissive branching) belongs with the survey-editor UI in #241. No other caller writes these columns programmatically; coupling the API contract to the UI it serves is the right unit of work.

**Binding decisions for #241 to honor when they design the PATCH endpoint** (so #241 doesn't re-litigate):
- The four columns the PATCH writes/clears: `consentMode`, `consentReason`, `consentSuppressedAttestedBy`, `consentSuppressedAttestedAt`. Reuse pattern (Q2 from spec round 1) is already in #231 PR1's schema.
- More-permissive override requires both attestation AND a non-empty reason — see spec R5.
- Same-or-stricter transitions (and revert to null) must clear all four columns to NULL — see spec R6.
- 500-char column cap on `consentReason` is enforced at the schema level (this RFC), so the PATCH's Zod max can match (`z.string().min(1).max(500).optional()` after server-side trim-and-recheck for whitespace-only).

### Audit-log payload — DEFERRED to #241

Same reasoning as the PATCH endpoint: the audit metadata extraction is bound to the writer. When #241 ships the PATCH, it should also ship the audit-plugin extension that captures `consentMode`, `consentReason`, `previousConsentMode` into `metadata`.

**Decisions to honor**:
- Reviewer round-1 confirmed **Option A** (per-route metadata allowlist in the plugin) over inline calls in the route handler. The plugin gains a `survey.update.metadata: ['consentMode', 'consentReason', 'previousConsentMode']` config; the route handler computes `previousConsentMode` from a read-before-write (single-row, brand-scoped — TOCTOU window is acceptable; see Risks below for the same-shape rationale).
- A small spike against the existing audit plugin's shape is recommended before committing to Option A — reviewer round-1 explicitly suggested this. If the plugin doesn't accommodate per-route allowlists cleanly, fall back to Option B (inline `request.audit.log(...)` call).
- Test that the audit row carries `metadata.consentMode` and `metadata.consentReason` after every override write — see #241's design.

The data migration (R7 below) writes to the same columns but does **not** go through the audit plugin (it runs at deploy time, not request time). The `__migration_276__` attribution in the column itself is the audit signal for those rows.

### UI changes

None in this RFC. The survey-editor consent panel + attestation modal + audit-trail badge are owned by #241 (per spec §"Scope split"). The mock at `docs/feature-specs/mocks/276-view.html` is informational input to #241.

### Failure modes & timeouts

| Failure | Behavior |
|---|---|
| Migration runs on a DB that already has `consentMode` column from `db push` | `ADD COLUMN IF NOT EXISTS` is a no-op. (Lessons from #270 + #281.) |
| Migration runs twice (re-run after a partial CI failure, or twice on a contributor laptop) | `WHERE consentMode IS NULL` clause makes the second run a no-op (zero rows touched; no `Survey.updatedAt` advances). |
| `Brand.consentMode` is null (shouldn't happen — column is `NOT NULL DEFAULT 'EXPLICIT'` per #231 PR1) | Resolver treats null as `EXPLICIT` defensively (the existing `=== 'EXPLICIT'` check returns false for null, which today already correctly defaults to "explicit consent required"). No new failure path. |
| Resolver receives a survey row with `consentMode = 'IMPLIED_ON_SUBMIT'` but `consentReason IS NULL` | Resolver doesn't read `consentReason`; the field is purely audit metadata. No failure. |

No new timeouts — same Fastify request lifecycle as the existing public-submit endpoint. PATCH endpoint failure modes belong with the PATCH endpoint design in #241.

### Telemetry & analytics

| Metric | Source | Use |
|---|---|---|
| Count of pre-existing surveys still at `consentMode IS NULL` immediately after the data migration runs in CI | Postgres query (one-shot, part of migration verification in the CI gate from #270) | Confirms AC1: zero rows should remain NULL post-migration. |
| Pino log line at info level when the resolver sees a survey with `consentMode != null` resolving differently from brand | `consentResolver.ts` (added in this RFC's resolver change) | Low-volume; surfaces override traffic without needing the audit-log table. Useful pre-#241 because the audit plugin doesn't yet capture override writes. |

Audit-log-derived metrics (override frequency by brand, attestation patterns) are #241's once the audit-plugin extension lands. No new dashboards or alerts in #276.

## Confidence Level

**95 / 100.** Schema delta is two nullable adds (Prisma idiom, well-tested pattern). Resolver change is one field + three substitutions in proven code. Migrations are idempotent by construction (schema via `IF NOT EXISTS`, data via `WHERE consentMode IS NULL`). The 5-point haircut covers: (a) the column-level `VARCHAR(500)` constraint must be applied via Prisma's `@db.VarChar(500)` annotation cleanly — proven idiom but worth verifying the generated SQL on first migrate; (b) the resolver's behavior change is opt-out (null = unchanged behavior) so blast radius is bounded to surveys whose `consentMode` is actually set, all of which are touched by the data migration in this same RFC; (c) the data migration touches every survey row in the system once — for a small number of brands today it's a one-shot UPDATE, but if/when the row count grows to many millions before this ships, an explicit batch-with-IDs loop may be preferable.

Confidence went up vs round 1 (was 92) because the round-1 re-scope removed the PATCH/audit surface where the `previousConsentMode` TOCTOU and audit-plugin Option-A-vs-B uncertainty lived; both moved cleanly to #241.

## Validation Plan

| User Scenario | Expected outcome | Validation method |
|---|---|---|
| Public submit endpoint receives a response on a survey whose `consentMode = IMPLIED_ON_SUBMIT` under a brand whose `consentMode = EXPLICIT`, without the `consent` field | 200; response persisted | Vitest API integration test against real DB |
| Public submit endpoint receives a response on a survey whose `consentMode = EXPLICIT` under a brand whose `consentMode = IMPLIED_ON_SUBMIT`, without the `consent` field | 400; response rejected | Same |
| Public submit endpoint receives a response on a survey whose `consentMode = NULL` under any brand | Behavior unchanged from #231 PR1 (driven by `brand.consentMode` only) | Same |
| `prisma migrate deploy` on a fresh DB applies both new migrations cleanly | All migrations green; CI gate from #270 catches any regression | CI on the implementation PR |
| Data migration re-run (idempotency) | First run sets every NULL row; second run is a no-op (no `Survey.updatedAt` advances; row count of touched rows is 0) | Local psql replay + assertion query (same shape as #270's psql-replay validation) |
| Data migration preserves existing operator-set values | Seed three surveys (NULL, EXPLICIT, IMPLIED); run migration; assert only the NULL one is touched | Same |
| Embedded widget continues to work for any consent mode | Widget renders + submits successfully against a test survey under each consent mode | Manual smoke (Playwright deferred to #241) |

PATCH endpoint validation scenarios (more-permissive override, attestation guard, revert) are owned by #241 — they validate the contract that #241 ships.

## Test Matrix

### Unit

| Suite | What | Where |
|---|---|---|
| Resolver — survey override | 4 cases: `(brand=EXPLICIT, survey=null)`, `(brand=EXPLICIT, survey=IMPLIED_ON_SUBMIT)`, `(brand=IMPLIED_ON_SUBMIT, survey=null)`, `(brand=IMPLIED_ON_SUBMIT, survey=EXPLICIT)` × the 3 non-suppressed branches in `consentResolver.ts`. The R17-suppressed branch is unchanged and re-asserts no behavior change. | `apps/api/src/services/consentResolver.test.ts` (existing file; new `describe` block) |

### Integration (real DB)

| Suite | What | Where |
|---|---|---|
| Survey-response endpoint with override | The 3 public-submit scenarios from the Validation Plan above | `apps/api/test/integration/public-survey-response.test.ts` (extend existing) |
| Migration idempotency | Run both migrations against a real ephemeral pgvector DB; replay the data migration via psql `ON_ERROR_STOP=1` and assert second run is a no-op | The CI gate from #270 + a one-shot local script (same pattern as the #270 fix verification) |
| Migration preservation | Seed three rows (NULL, EXPLICIT, IMPLIED); run; assert only NULL touched | Same suite |
| Migration column constraint | Insert a row with a 501-char `consentReason` (post-migration) and assert it errors with the VARCHAR(500) constraint | Same suite |

### E2E

None in #276. End-to-end UX flow ships with #241's PATCH endpoint + UI — #241 owns the Playwright spec for the override flow. The data migration's smoke is "existing surveys accept responses again" — covered by the survey-response integration test suite above against migrated rows.

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| New schema migration is non-idempotent on `db push`-then-`migrate deploy` (the #270 / #281 class) | Low — `ADD COLUMN IF NOT EXISTS` is the documented idempotency-safe pattern | High — repeats production-blocking incidents | Use `IF NOT EXISTS` on both column adds; CI gate from #270 catches regressions on every PR |
| Data migration clobbers a deliberate post-#231 operator-set `consentMode` value | Very low | Medium | `WHERE consentMode IS NULL` clause preserves any pre-set value. The reviewer accepted this scope on round 1 of the spec. |
| Resolver behavior changes for surveys whose `consentMode` is null in unexpected ways | Very low — the change is opt-out (null = unchanged) | Medium | The resolver's null path is byte-for-byte equivalent to today's code (`brand.consentMode === 'EXPLICIT'`). Unit test suite asserts the 4 NULL-survey cases all resolve to the existing brand-only behavior. |
| Prisma checksum-drift warning on existing dev DBs whose schema was synced via `db push` | Low — `migrate deploy` warns only, doesn't fail | Low — operator sees a warning | Document; the #270 retro covered the same shape |
| Reason text inserted by a future writer (via #241 PATCH or admin SQL) exceeds 500 chars | Medium pre-#241; very low after | Low | Column-level `VARCHAR(500)` cap is enforced by Postgres; offending writes fail with a clean error. The data migration's text is 191 chars — well under. |
| Data migration locks the surveys table during the UPDATE in a way that delays incoming response writes | Low — single UPDATE on a small table at deploy time | Low — brief lock, runs at off-hours; `migrate deploy` is the existing release cadence | Acceptable. If row count grows to many millions before this ships, switch to a batched ID-range UPDATE — flagged for the implementation PR's pre-flight to check the row count against a 1M threshold. |

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

## Resolved Decisions (round 1)

All four reviewer decisions answered on round 1. Captured here so the implementation PR has a single source of truth.

| # | Decision | Resolution |
|---|---|---|
| 1 | Migration split | **Two timestamped files** — schema permanent, data migration is one-time. Implemented as written above. |
| 2 | Audit-plugin extension shape | **Option A** (per-route metadata allowlist). **Deferred to #241** along with the PATCH endpoint. A spike against the existing audit plugin's shape is recommended before #241's design author commits — fall back to Option B if the plugin doesn't accommodate cleanly. |
| 3 | `consentReason` max length | **500 chars**. Enforced at the schema level via `@db.VarChar(500)` (this RFC) so any future writer is bounded by the same limit. The data migration's system-reason text is 191 chars. |
| 4 | Resolver source label | **Don't add** `consentModeSource`. The existing source label on `text` is unchanged. |

## Round 1 Scope Decision

The original RFC included a PATCH endpoint contract + audit-log payload section. Round 1 reviewer (PR #282 line 20) asked: "Why is the API part of a one-time migration spec? Wouldn't this API design also be part of #241 for end-to-end flow?"

**Resolution**: agreed. The PATCH endpoint and the audit-plugin extension are bound to the survey-editor UI in #241 — no other caller writes those columns programmatically. Moving both to #241 lets them ship as one end-to-end vertical slice rather than as field-by-field plumbing accreted across two issues.

#276 now ships only:
- Schema columns (`consentMode`, `consentReason VARCHAR(500)`)
- Resolver field add + 3 substitutions
- Schema migration (idempotent ALTER TABLE)
- Data migration (idempotent UPDATE all NULL → IMPLIED_ON_SUBMIT)

#241 will own:
- PATCH endpoint extension (validation, attestation guard, 422 contract, atomic write)
- Audit-plugin Option A extension
- Survey-editor UX (panel, modal, badge)
