---
author: swavak@gmail.com
date: 2026-05-10
synthesized:
---

# Postmortem: Historical Survey Data Import — Implementation — Issue #262

**Date**: 2026-05-10  
**Duration**: ~3 sessions across 2026-05-08 to 2026-05-10  
**Objective**: Implement end-to-end bulk historical survey import (CSV adapters, queue, worker, API routes, web UI)  
**Outcome**: Success — merged via PR #263, squash commit 5e3ce2a on main

---

## Executive Summary

Implementation of #262 was completed successfully but required four successive CI fixes after the first push: a duplicate draft migration, wrong column names in the migration SQL, a migration timestamp collision with a concurrent #231 migration, and three lint errors. A consent-gate design flaw was also caught via a user question mid-implementation and fixed before merge. The feature itself is clean; the rework was entirely in migration hygiene and branch synchronisation.

---

## Architectural Impact

**Has Architectural Impact**: Yes

**Sections Updated**: Source adapter pattern, queue pipeline, worker processor registry  
**Changes Made**: Added `SurveyImportBatch` model; introduced per-source adapter library (`excelAdapter`, `googleReviewsAdapter`); added `SURVEY_IMPORT` BullMQ queue with `QUEUE_MODE=inline` fallback; made `SurveyResponse.memberId` nullable  
**Rationale**: Adapter pattern required to handle fundamentally different column schemas per source (Google Reviews has no email); nullable memberId required for anonymous Google Reviews responses  
**Updated in PR**: Yes — schema.prisma and migration committed in the PR

---

## Timeline of Events

### Phase 1: Implementation
- ✅ **Source adapter library built**: `excelAdapter` (flexible header matching) and `googleReviewsAdapter` (star→0-10 normalisation, anonymous records) — adapter pattern from spec proved correct
- ✅ **Queue wiring**: `enqueueSurveyImportRow` + `inlineSurveyImportRow` for QUEUE_MODE=inline; `getSurveyImportQueue()` for redis mode
- ✅ **Worker processor**: `createSurveyImportProcessor` with dedup, auto-enrollment, sentiment enqueue
- ✅ **API routes**: POST /import, GET /imports, GET /imports/:batchId — all secured by brand tenancy
- ✅ **Web UI**: Import modal, batch history section, amber "historical" badge on imported responses, anonymous display for null memberId
- ✅ **Integration test suite**: 13 tests in surveyImport.test.ts covering happy path, validation errors, batch detail
- ❌ **Draft migration left on disk**: `20260503000000_survey_import_batch` not deleted when canonical `20260504000000` was written
- ❌ **Migration column names wrong**: Used `"member_id"` (snake_case) — Prisma uses `"memberId"` (camelCase) throughout
- ❌ **Consent gate wrong**: Both processors gated `memberId` assignment on `member.consentGivenAt` — incorrect for bulk imports where integrator has already verified consent

### Phase 2: Merge with Main (#231)
- ✅ **Merge conflict resolved**: `public.ts` and `surveys.ts` conflicts resolved correctly; took main's full auto-enrollment block
- ✅ **Worker cross-import fixed**: Worker cannot import from API package; rewrote member resolution inline using Prisma directly
- ✅ **Prisma/shared rebuilt**: `pnpm --filter @customerEQ/shared build` + `npx prisma generate` after schema changes
- ❌ **Working directory confusion**: Consent gate fix was applied to `main` branch working tree where `surveyImport.ts` doesn't exist — edits were no-ops; had to re-apply on feature branch after switching

### Phase 3: CI Fixes (4 rounds)
- ❌ **Round 1 — Duplicate migration**: `20260503` and `20260504` both `CREATE TABLE survey_import_batches` → P3018 `relation already exists`
- ❌ **Round 2 — Wrong column names**: `ALTER COLUMN "member_id"` failed with `column does not exist`; also `DROP CONSTRAINT` on what is actually an index; partial index used `"survey_id"/"member_id"` instead of `"surveyId"/"memberId"`
- ❌ **Round 3 — Timestamp collision + DROP INDEX without IF EXISTS**: Renamed migration to `20260505000000` to run after `#231`'s `20260504000000_survey_response_data_model_rework`; removed duplicate `DROP INDEX` step (already handled by #231)
- ❌ **Round 4 — Lint + security audit**: `\-` useless escape in 3 regex literals; `fast-uri` CVE on branch not yet patched — fixed by merging current main

### Phase 4: Merge
- ✅ **All CI checks green**: Build, Lint, Test pass on both matrix runs
- ✅ **PR #263 squash-merged**: Merge commit 5e3ce2a on main 2026-05-10T08:34:25Z
- ✅ **Feature branch deleted**: Local and remote cleaned up
- ✅ **Issue #262 closed**

---

## Root Cause Analysis

### 1. Primary Cause — Draft Migration Not Deleted
**Problem**: `20260503000000_survey_import_batch` was created as a first draft during an implementation spike (before the spec-phase correction). When the canonical `20260504000000` was written later, the draft was never deleted.  
**Impact**: Caused the first CI failure (duplicate `CREATE TABLE`). Required a discovery round to understand what was happening.

### 2. Contributing Factor — Manual Migration Bypasses Prisma Name Generation
**Problem**: The migration was written by hand rather than generated via `prisma migrate dev`. Prisma's generated SQL always uses the quoted camelCase identifiers from the schema. Hand-written SQL used snake_case (`member_id`, `survey_id`) which don't match.  
**Impact**: Second CI failure (`column "member_id" does not exist`). Three separate occurrences across two files.

### 3. Contributing Factor — Timestamp Coordination Gap Between Concurrent PRs
**Problem**: No mechanism exists to coordinate migration timestamps when two PRs are in flight simultaneously. Both #231 and #262 independently chose `20260504000000` as their timestamp. Alphabetically our migration ran first, dropped the unique index, then #231's migration tried to drop the same index without `IF EXISTS` and aborted.  
**Impact**: Third CI failure, required renaming the entire migration directory.

### 4. Contributing Factor — Consent Gate Logic Wrong for Bulk Imports
**Problem**: Both the inline processor and the worker were written with `if (member.consentGivenAt)` gating `memberId` assignment. This logic is correct for live survey responses (we wait for explicit consent) but wrong for bulk imports, where the integrator has already verified consent before exporting.  
**Impact**: Would have silently left all bulk import responses unlinked from their members, breaking the analytics backfill purpose of the entire feature. Caught via user question, not a test.

### 5. Contributing Factor — Working Directory / Branch Confusion
**Problem**: When the consent gate fix was applied, the session was on the `main` branch. `surveyImport.ts` doesn't exist on main (it's only on the feature branch). The Edit tool reported success but the file was a no-op. The fix had to be re-applied after switching to the feature branch.  
**Impact**: One wasted fix attempt; minor delay. The mistake pattern for "branch verification before commit" partially applies here — the inverse: verifying that the file you're editing actually exists on the current branch before editing it.

---

## What Went Wrong

1. **Draft migration never cleaned up**: The `20260503` spike artifact persisted to CI and caused the first failure.
2. **Hand-written SQL column names**: Three `member_id` / `survey_id` references that should have been `memberId` / `surveyId`.
3. **Migration timestamp collision**: Two concurrent PRs picked the same `20260504000000` timestamp with no coordination.
4. **Consent gate wrong for import context**: `consentGivenAt` gating was copied from live-response logic without adapting it for the bulk import contract.
5. **Edits on wrong branch**: Consent gate fix applied to main's working tree, not the feature branch — no-op.

---

## What Went Right

1. **Adapter library design held up**: The spec's source adapter pattern handled Excel and Google Reviews cleanly with no architectural changes at implementation time.
2. **QUEUE_MODE=inline**: Synchronous inline processing made local testing feasible without Redis — a practical dev experience win.
3. **Integration test suite**: 13 tests written before implementation covering happy path, all validation errors, batch listing, and batch detail — gave confidence during the CI debugging rounds.
4. **Consent gate caught before merge**: The design flaw was surfaced by a user question and fixed on the feature branch before merge — not discovered post-merge.
5. **Merge with main (#231) resolved cleanly**: Four merge conflicts across schema, routes, and public endpoint all resolved correctly; no regressions in the 456 smoke tests.
6. **Each CI failure was a distinct, fixable root cause**: No failure required architectural changes — purely migration hygiene and sync issues.

---

## What I Almost Did Wrong But Caught

1. **Almost merged with stale (failing) CI**: PR #263's CI runs from May 5 showed as the latest status — both failing — because no new push had been made since the rebase. Before proposing a merge, the CI status was checked and a new push was made to re-trigger. The P-HIGH mistake pattern for "merging PR with failing CI" fired correctly.
2. **Almost applied the consent gate fix to main's bullmq.ts permanently**: bullmq.ts does exist on main (without the import queue code). The `consentGivenAt` change was applied there, which would have been a no-op for the import feature but could have caused confusion. Realised the actual target was the feature branch version.

---

## Where Past Learnings Actually Fired

1. **P-HIGH: Merging PR with failing CI** — before proposing to merge PR #263, CI status was explicitly checked. The stale failed runs were identified, a new push was made, and CI was watched until both runs were green. This is exactly the scenario the pattern was written for.
2. **P-HIGH: Committing to old branch on session resume** — when resuming on main, branch was verified before any edits. However the inverse wasn't checked: confirming that files to be edited actually exist on the current branch. Led to the no-op consent gate edit on main.

---

## Lessons Learned

1. **Migration drafts must be deleted the moment a canonical replacement is written**: If you create a migration file as a spike and later rewrite it, delete the draft immediately. The filesystem doesn't know which one is authoritative — only the author does, and only in that moment.
2. **Hand-written migrations must match Prisma's quoting conventions**: Prisma uses quoted camelCase (`"memberId"`, `"surveyId"`) everywhere. Any hand-written DDL should grep an existing generated migration for the exact identifier casing before writing a new one.
3. **Concurrent PRs need timestamp coordination for migrations**: When two features are in flight simultaneously, they should compare migration timestamps before pushing. A simple convention (e.g., sort alphabetically by feature name within a shared date prefix) would prevent collisions.
4. **Bulk import consent contract differs from live-response consent contract**: Live responses wait for consent before linking. Bulk imports assume consent was verified by the integrator at export time. These are different contracts and should not share the same conditional.
5. **Verify target file exists on current branch before editing**: Before applying a fix, confirm `git show HEAD:<path>` returns content. A successful Edit on a file that doesn't exist in HEAD creates an untracked orphan that won't be staged normally and won't appear in git status for tracked files.
6. **Migration timestamp = coordination contract between PRs**: Timestamps are not just ordering metadata — they are implicit coordination signals. Two PRs picking the same timestamp will collide during `migrate deploy` if their operations overlap.

---

## Missed-First-Pass Scan

Items that failed on first pass and were only caught on a later pass. Each is a candidate for the mistake-pattern learning pipeline.

| Item | First-pass result | Caught by | Category |
|------|-------------------|-----------|----------|
| Consent gate logic (`consentGivenAt` gating `memberId`) wrong for bulk import | UNADDRESSED — written as a copy of live-response logic | User question mid-implementation (not a test, not a review) | Skill — domain knowledge gap: different ingestion contexts have different consent contracts |
| Migration column names (snake_case `member_id` instead of camelCase `memberId`) | UNADDRESSED — written by hand without checking convention | CI failure Round 2 | Repo Clarity — no documented convention for hand-written migration DDL column naming |
| Draft migration `20260503000000` not deleted when canonical `20260504000000` was written | UNADDRESSED — draft left on disk | CI failure Round 1 | Empowerment — no checklist item for draft cleanup when rewriting a migration |
| Spec missing explicit Acceptance Criteria header | NOTED GAP — completeness review flagged it | Spec completeness review (same session, before submission) | Repo Clarity — spec template does not enforce an AC header; validation plan covered the role |

**Key pattern**: All three implementation-phase misses (consent gate, column naming, draft cleanup) were caught by external signals (user question, CI failure) rather than by pre-commit checks or review. This indicates a structural gap: there is no review step between "write the code/migration" and "push to CI" that would catch these classes of error.

---

## Agent Rule Updates Made to Avoid Recurrence

1. **New rule — migration draft cleanup**: When a migration is superseded by a canonical replacement, delete the draft in the same commit that creates the replacement. Never leave two migrations that touch the same table in the migrations directory simultaneously.
2. **New rule — hand-written migration column names**: Before writing any DDL column reference by hand, grep an existing generated migration for the exact quoted identifier. Prisma always uses camelCase with double-quotes.
3. **New rule — branch-file existence check**: Before editing a file to fix a bug on a feature branch, verify the file exists on the current branch (`git show HEAD:<path>`). If it doesn't, switch to the correct branch first.
4. **New rule — bulk import consent contract**: Bulk import processors must not gate `memberId` assignment on `consentGivenAt`. The integrator is responsible for consent at export time. Only live-response processors apply the consent gate.

---

## Enforcement Updates Made to Avoid Recurrence

1. **Migration naming convention**: Add to project rules — manual migrations must grep an existing Prisma-generated migration for exact column identifier casing before writing any DDL column references.
2. **Draft cleanup checklist**: When writing `feat` commits that include a migration, include a step: "confirm only one migration directory exists for this feature in `prisma/migrations/`."
3. **Timestamp coordination**: When a feature branch has been in flight for more than one sprint cycle (risk of concurrent migrations on main), check `git log origin/main --oneline -- packages/database/prisma/migrations/` before pushing a new migration.
