# Issue #276 — Implementation Work List (TIGHT)

**Issue**: [#276 — \[P0\] Production hotfix: survey-level consent override + migrate existing surveys to IMPLIED_ON_SUBMIT](https://github.com/mathursrus/CustomerEQ/issues/276)
**Type**: bug (P0 production hotfix)
**Branch**: `feature/276-p0-production-hotfix-survey-level-consent-override-migrate-existing-surveys-to-implied-on-submit`
**Spec**: [`docs/feature-specs/276-survey-level-consent-override.md`](../feature-specs/276-survey-level-consent-override.md) (round-1 closed)
**RFC**: [`docs/rfcs/276-survey-level-consent-override.md`](../rfcs/276-survey-level-consent-override.md) (round-1 closed; scope re-cut to schema + resolver + migration only)
**Job**: feature-implementation (FRAIM)

## Scope (TIGHT — minimum diff that unblocks production)

Per round-2 reviewer coaching: production bug fixes ship the smallest diff that makes the bug stop happening. Anything that only enables a downstream surface (PATCH endpoint, audit-plugin extension, UI) belongs with that downstream issue. For #276, the downstream owner is **#241**.

### In scope (this PR)

1. **Schema columns** — add to `Survey` in `packages/database/prisma/schema.prisma`:
   - `consentMode  ConsentMode?`
   - `consentReason String? @db.VarChar(500)`
2. **Schema migration** — `packages/database/prisma/migrations/<TS>_add_survey_consent_override/migration.sql` with `ALTER TABLE … ADD COLUMN IF NOT EXISTS x2` (idempotent across fresh DB and `db push`'d DB per #270/#281).
3. **Data migration** — `packages/database/prisma/migrations/<TS+1>_backfill_survey_consent_implied/migration.sql` — `UPDATE … SET consentMode = 'IMPLIED_ON_SUBMIT', consentSuppressedAttestedBy = '__migration_276__', consentSuppressedAttestedAt = NOW(), consentReason = '<191-char system reason>' WHERE consentMode IS NULL`. Idempotent.
4. **Resolver** — `apps/api/src/services/consentResolver.ts`:
   - Add `consentMode: 'EXPLICIT' | 'IMPLIED_ON_SUBMIT' | null` to `SurveyConsentInput`.
   - In each of 3 non-suppressed branches (lines 71, 82, 96): replace `brand.consentMode === 'EXPLICIT'` with `(survey.consentMode ?? brand.consentMode) === 'EXPLICIT'`.
5. **Resolver unit tests** — extend `apps/api/src/services/consentResolver.test.ts` with the 4 override cases.

### Out of scope (DEFERRED to #241)

- PATCH endpoint contract for writing the new columns (`apps/api/src/routes/surveys.ts`).
- Audit-plugin per-route metadata allowlist (`apps/api/src/plugins/audit.ts`).
- Survey-editor UI (panel, attestation modal, audit-trail badge).
- Integration tests for PATCH/422 attestation path.
- E2E tests for the survey-editor flow.

### Out of scope (intentional non-deferral)

- Architecture.md §6 update for the brand-default-with-survey-override pattern. Carry-over from #231 retro queue; not blocking #276 production unblock; remains on the architecture-doc todo list.
- Resolver call sites that consume `SurveyConsentInput` — they already pass survey rows through to the resolver via the existing `getConsentTextForSurvey()` call chain. Adding the new field to the TypeScript interface forces those call sites to pass `consentMode` in the survey shape; the call sites query the survey row from Prisma which now has the column. Code already structured correctly; no call-site refactor expected.

## Files to change (verified to exist)

| Path | Change | Verified |
|---|---|---|
| `packages/database/prisma/schema.prisma` | Add 2 fields to `Survey` model | Read 2026-05-04 — Survey model at line 599; #231 PR1 fields at 617-621 (existing `consentTextOverride` + `consentSuppressedAttestedBy/At` columns to extend pattern from). |
| `packages/database/prisma/migrations/<NEW>_add_survey_consent_override/migration.sql` | NEW — `ALTER TABLE` schema add | Following the same pattern as #270's idempotency-fixed migration. |
| `packages/database/prisma/migrations/<NEW>_backfill_survey_consent_implied/migration.sql` | NEW — `UPDATE` data backfill | Same pattern. |
| `apps/api/src/services/consentResolver.ts` | Field add to interface + 3 branch substitutions | Read in design phase; lines 19-21 (interface), 71/82/96 (branches). |
| `apps/api/src/services/consentResolver.test.ts` | New `describe` block with 4 cases | Existing test file (verified during implement-scoping for #270; same package). |

## Validation Requirements

- **uiValidationRequired**: NO — change is database/backend only, no UI surface.
- **mobileValidationRequired**: NO — same reason.
- **Required**:
  - Local fresh-DB migration run: ephemeral pgvector container, both new migrations apply cleanly. (CI gate from #270 will catch on PR.)
  - Local already-applied DB run: re-running data migration is a no-op (`Survey.updatedAt` does not advance for the affected rows).
  - Resolver unit tests: 4 new cases pass alongside existing tests.
  - Sanity gates per project rule R11: `pnpm build` / `pnpm typecheck` / `pnpm lint` / `pnpm test:smoke` all green.

## Acceptance Criteria mapping (issue body, post-spec round 1)

- [ ] AC1 — "Existing test surveys accept responses without code or admin action after the migration runs." → Data migration sets every NULL consentMode row to `IMPLIED_ON_SUBMIT`. Resolver honors it. Survey-response endpoint already calls the resolver, so no endpoint change.
- [ ] AC2 — "An admin can set a single survey to a different consent mode than its brand, gated by authorization." → **DEFERRED to #241** per round-2 RFC scope re-cut. Schema columns and 500-char cap that #241's PATCH binds to ship in this PR.
- [ ] AC3 — "The override is honored end-to-end: survey-response endpoint, embedded form, consent-resolver service." → Resolver change + endpoint already calls it + widget transparently works (no widget change needed).

## Risks (carried from RFC)

- **Idempotent migration on `db push`'d DB**: `ADD COLUMN IF NOT EXISTS` handles it. CI gate from #270 catches regressions.
- **Data migration locks the surveys table briefly**: small-table UPDATE at deploy time; acceptable. Pre-flight check: row count threshold (1M) for switching to batched UPDATE — not crossed today.
- **Prisma checksum-drift warning on dev DBs**: `migrate deploy` warn-only; document.

## Pre-existing local-DB state (housekeeping)

The shared dev DB is currently at the post-#231 state (we recovered from the P3009 earlier today via `prisma migrate resolve --applied`). Both new migrations should apply cleanly here without further intervention.

## References

- #276 (this issue)
- #231 PR1 (parent — added `Brand.consentMode` default + `consentSuppressedAttestedBy/At` placeholder columns)
- #241 (Survey Admin UX epic — owns PATCH + audit-plugin extension + UI)
- #270 (closed — established schema-migration idempotency patterns)
- #281 (open — same idempotency lessons applied to #231 PR1's CREATE TYPE blocks)
- L0 coaching moment 2026-05-05: production-bug-fix-scope-minimum
