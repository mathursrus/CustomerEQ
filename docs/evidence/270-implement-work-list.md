# Issue #270 — Implementation Work List

**Issue**: [#270 — Migration 20260430000000_patch_survey_distribution_gap is not idempotent on a fresh DB](https://github.com/mathursrus/CustomerEQ/issues/270)
**Type**: bug
**Branch**: `feature/270-migration-20260430000000-patch-survey-distribution-gap-is-not-idempotent-on-a-fresh-db`
**Worktree**: `C:\Github\mathurus\CustomerEQ - Issue 270`
**Job**: feature-implementation (FRAIM)

## Problem (verified against code)

`packages/database/prisma/migrations/20260430000000_patch_survey_distribution_gap/migration.sql` was authored as a one-shot recovery patch for the partial application of `20260427200452_add_survey_distribution`. The patch's preamble declares preconditions that hold only on the half-broken DB it was written for (cf. lines 6-14). On a clean DB the prior migration runs to completion, then the patch encounters a fully-built schema and the unconditional DDL it ships errors out:

| Block | Lines | Failure on clean DB |
|---|---|---|
| `ALTER TABLE "cx_playbooks" DROP COLUMN "surveyType", ADD COLUMN "surveyType" "SurveyType"…` | 19-25 | `42703 column "surveyType" already enum` (cannot drop enum-typed column the same way) — would error first |
| `CREATE INDEX "cx_playbooks_brandId_surveyType_idx"` (no IF NOT EXISTS) | 27-28 | `42P07 relation already exists` |
| `CREATE TABLE "survey_distributions"` (no guard) | 31-38 | `42P07 relation already exists` |
| `CREATE INDEX "survey_distributions_surveyId_memberId_sentAt_idx"` (no IF NOT EXISTS) | 40-41 | `42P07 relation already exists` |
| `CREATE UNIQUE INDEX "survey_distributions_surveyId_memberId_key"` (no IF NOT EXISTS) | 43-44 | `42P07 relation already exists` |
| `ADD CONSTRAINT "survey_distributions_surveyId_fkey"` (no DO/EXCEPTION) | 46-49 | `42710 constraint already exists` |
| `ADD CONSTRAINT "survey_distributions_memberId_fkey"` (no DO/EXCEPTION) | 51-54 | `42710 constraint already exists` |

After the first failure, every subsequent `prisma migrate deploy` returns P3009 until manual `prisma migrate resolve`. CI never runs `prisma migrate deploy` against the postgres service, so this is invisible to CI.

## Scope

### In scope

1. **Migration idempotency** — wrap every unguarded DDL block in `migration.sql` with the same idempotency pattern already used for the FK constraints at lines 95-142 (`DO $$ … EXCEPTION WHEN duplicate_object|duplicate_table THEN NULL; END $$;` for tables/constraints, `IF NOT EXISTS` for indexes, conditional check for the cx_playbooks ALTER TABLE column-type swap).
2. **CI gate** — add a `prisma migrate deploy` step in `.github/workflows/ci.yml` that runs against an empty postgres service so this regression class is caught at PR time.
3. **CI postgres image** — switch the `postgres` service from `postgres:16` to `pgvector/pgvector:pg16` so the migration deploy step can actually run migration `20260403000000_add_kb_articles` (which executes `CREATE EXTENSION IF NOT EXISTS vector`). Required by ADR-0002 / project rule R20.

### Out of scope (intentional deferrals)

- Refactor the patch migration into a "proper" forward migration. The patch is intentionally narrow recovery; rewriting is risky on prod where it already applied. Flagging only.
- Backfilling guards onto every historical migration. The cost-benefit is poor — only the patch migration is known to be non-idempotent. The new CI gate will surface any other instance.
- Extracting `DATABASE_URL` to workflow-level env (carried over from #255 retro). Out of #270's scope; not a regression.

## Files to change (verified to exist)

| Path | Change | Verified |
|---|---|---|
| `packages/database/prisma/migrations/20260430000000_patch_survey_distribution_gap/migration.sql` | Wrap 7 unguarded DDL blocks (CREATE TABLE, 3× CREATE INDEX, 2× ADD CONSTRAINT, 1× ALTER TABLE) in idempotency guards. | Read 2026-05-04 — file exists, 142 lines |
| `.github/workflows/ci.yml` | (a) Switch `postgres:16` → `pgvector/pgvector:pg16` on the `postgres` service. (b) Add `Run migrations (regression gate for #270)` step between `Validate Prisma schema` and `Generate Prisma client`. | Read 2026-05-04 — postgres service at line 16, sibling steps as model |

## Validation Requirements

- **uiValidationRequired**: NO — change is database/CI only, no UI surface.
- **mobileValidationRequired**: NO — same reason.
- **Browser/E2E**: NO.
- **Required**:
  - Local fresh-DB verification: drop + recreate the postgres volume, then `pnpm db:migrate` runs all 20 migrations cleanly with no P3018 / P3009.
  - Local already-applied verification: on a DB where the patch was previously applied (or marked-applied via `prisma migrate resolve`), re-running `pnpm db:migrate` is a no-op (no schema drift, no errors). Demonstrates AC2.
  - CI: the new `Run migrations` step is green on this PR. Demonstrates AC3.
  - Build/typecheck/lint/smoke unchanged — sanity gate per project rule R11.

## Acceptance Criteria mapping (issue body)

- [ ] AC1: `pnpm db:reset --force` against a fresh postgres container completes all 20 migrations cleanly. → Local verification + new CI step.
- [ ] AC2: On a DB that already had the patch applied in current broken-state form, the new patch is a verified no-op. → Local rerun against the existing dev DB after `prisma migrate resolve`.
- [ ] AC3: CI gains a `prisma migrate deploy` step against an empty postgres service. → `.github/workflows/ci.yml` change.

## Risks and mitigations

- **Checksum drift on already-applied DBs**: Prisma `migrate deploy` warns on modified migrations but does not refuse them once they are recorded as applied (`migrate dev` is stricter). Production already has the patch applied, so the new file content will warn-only on next deploy. Acceptable; documented here so a future agent doesn't see the warning and panic.
- **`pgvector/pgvector:pg16` image switch on CI**: tests already use the same image locally per ADR-0002. The image is a strict superset of `postgres:16` (same Postgres core + vector extension installed). No expected behavior change for existing CI steps.

## Pre-existing local-DB state

The current shared dev DB has migration `20260430000000_patch_survey_distribution_gap` recorded as **failed** in `_prisma_migrations` (P3009). To validate AC2 locally we must first `prisma migrate resolve --rolled-back 20260430000000_patch_survey_distribution_gap` to clear the failed record, then `prisma migrate deploy` to reapply the patched (now-idempotent) migration. This is a one-time local recovery step; nothing in the repo changes from it.

## References

- Issue #270 (this issue)
- Issue #231 (parent regression — the `add_survey_distribution` migration whose partial run prompted the patch)
- ADR-0002 — pgvector image pinning
- Project rule R20 — pgvector image is mandatory
- Project rule R11 / R11a — CI gates
- Mistake pattern `Migration not validated against a real DB before PR submission` (#170 PR1) — informs the local fresh-DB verification step in this work list
