# Issue #389 — Implementation Work List

**Issue**: Drop erroneous `survey_responses_live_dedup` unique index (#262 migration follow-up)
**Type**: Bug fix (schema / migration)
**Branch**: `feature/389-fix-drop-erroneous-survey-responses-live-dedup-unique-index-262-migration-follow-up`
**Last updated**: 2026-05-15

---

## Context

Migration `20260505000000_survey_import_batch` Step 4 created a partial unique index
(`survey_responses_live_dedup`) that contradicts `Survey.responsePolicy = MULTIPLE`.

Current state on main:
- `20260514120000_drop_live_dedup_unique` already exists and drops the index (done in #336 Phase 11)
- `20260505000000_survey_import_batch` still contains Step 4 (CREATE UNIQUE INDEX) — creates then immediately drops on fresh DBs
- Production `_prisma_migrations` record for `20260505000000_survey_import_batch` is in a failed state (Step 4 failed; Steps 5–7 were applied manually)

---

## Checklist

- [ ] `packages/database/prisma/migrations/20260505000000_survey_import_batch/migration.sql`
  — Remove Step 4 (`CREATE UNIQUE INDEX "survey_responses_live_dedup" ...`); add a comment explaining it was removed and where the drop lives
- [ ] `docs/runbooks/389-resolve-migration-failed-record.md`
  — Production runbook: SQL to resolve the `_prisma_migrations` failed record for `20260505000000_survey_import_batch`
- [ ] `pnpm typecheck && pnpm test:smoke && pnpm test:integration` pass in the worktree

---

## Validation Requirements

- `uiValidationRequired`: false (no UI changes)
- `mobileValidationRequired`: false
- Integration tests: verify `pnpm test:integration` passes (survey import suite)
- Typecheck: `pnpm typecheck` zero errors

---

## Deferrals / Out of Scope

- No schema.prisma changes needed (the non-unique `@@index([surveyId, memberId])` is already correct)
- No API handler changes (responsePolicy enforcement is already in place per #336)
- `20260514120000_drop_live_dedup_unique` is correct as-is — no changes needed
