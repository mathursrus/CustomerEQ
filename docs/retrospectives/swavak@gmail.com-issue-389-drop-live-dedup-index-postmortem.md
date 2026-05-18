---
author: swavak@gmail.com
date: 2026-05-15
synthesized: 2026-05-18
---

# Postmortem: Drop Erroneous survey_responses_live_dedup Unique Index — Issue #389

**Date**: 2026-05-15
**Duration**: ~1 hour (scoping + implementation + PR)
**Objective**: Remove the erroneous `CREATE UNIQUE INDEX "survey_responses_live_dedup"` from migration `20260505000000_survey_import_batch` and provide a production runbook to resolve the `_prisma_migrations` failed record
**Outcome**: Success — PR #390 approved, all ACs met

## Executive Summary

Issue #389 was filed to fix the root cause of a production migration failure from #262: a partial unique index that contradicted `Survey.responsePolicy = MULTIPLE`. Scoping discovered that the drop migration already existed on main (#336 Phase 11), reducing the implementation to (1) removing the DDL from the original migration and (2) writing a production runbook. PR approved in one round with no feedback iterations.

## Architectural Impact

**Has Architectural Impact**: No

The change is a DDL comment replacement in an existing migration file. No new patterns, components, or integration points were introduced. The `responsePolicy`-based dedup enforcement in the API handler (already in place from #336) remains the correct and unchanged authority.

## Timeline of Events

### Phase 1: Scoping
- ✅ **Discovery**: Read migration `20260505000000_survey_import_batch` and `schema.prisma`
- ✅ **Key find**: Migration `20260514120000_drop_live_dedup_unique` already existed on main — drop work already done in #336 Phase 11
- ✅ **Scope reduced**: Implementation narrowed to removing Step 4 DDL + production runbook only
- ✅ **Work list created**: `docs/evidence/389-implement-work-list.md`

### Phase 2: Implementation
- ✅ **Migration edited**: Step 4 `CREATE UNIQUE INDEX` replaced with explanatory comment (commit 07cce27)
- ✅ **Runbook written**: `docs/runbooks/389-resolve-migration-failed-record.md` — pre-flight checks, resolution SQL, rollback
- ✅ **Typecheck**: 19/19 pass
- ✅ **Lint**: 0 errors

### Phase 3: Submission
- ✅ **PR #390 created** and approved in one round, zero feedback iterations

## Root Cause Analysis

### 1. Primary Cause
**Problem**: The original `20260505000000_survey_import_batch` migration included a `CREATE UNIQUE INDEX` that enforced one-response-per-member semantics globally, contradicting `Survey.responsePolicy = MULTIPLE`.
**Impact**: The index failed in production (duplicate rows), leaving `_prisma_migrations` in a failed state; subsequent `prisma migrate deploy` runs would be blocked until resolved.

### 2. Contributing Factors
**Problem**: The index was framed as "preserving original deduplication behaviour" without cross-referencing `Survey.responsePolicy`, which was introduced in the same era (#231).
**Impact**: A design invariant (`responsePolicy` is the dedup authority) was violated at the DB layer without the author being aware of the conflict.

## What Went Wrong

1. **Original index design (#262)**: The partial unique index was added to preserve a behaviour that `responsePolicy = MULTIPLE` explicitly disallows. The two features were designed in parallel without a cross-check.
2. **Production failure not caught in CI**: The migration passed on a clean test DB (no pre-existing duplicate rows) but failed in production where real duplicates existed.

## What Went Right

1. **Scoping discovered existing fix**: Before writing any code, reading the schema.prisma comment revealed that `20260514120000_drop_live_dedup_unique` was already on main. This prevented duplicating work already done in #336.
2. **Minimal change**: The fix was exactly as narrow as the problem — one DDL block replaced with a comment, plus a markdown runbook. No TypeScript touched, no API changes, no risk of regressions.
3. **Runbook quality**: The production runbook includes pre-flight verification queries (confirming the index doesn't exist, confirming Steps 5–7 artifacts are present) before the resolution UPDATE — prevents applying the fix blindly.
4. **Zero feedback rounds**: PR approved immediately — scope was exactly right.

## What I Almost Did Wrong But Caught

1. **Almost wrote a new drop migration unnecessarily**: Initial plan included "new migration: `DROP INDEX IF EXISTS`". Scoping revealed this was already done in `20260514120000_drop_live_dedup_unique`. Reading the schema first saved writing a duplicate migration.

## Where Past Learnings Actually Fired

1. **Validated pattern: Proactive flagging of data model incompatibility during Q&A** — recognised that `responsePolicy = MULTIPLE` is the authoritative constraint and that the index contradicted it, rather than just removing the index mechanically without explaining why. This framing shaped the PR description and runbook rationale.
2. **Validated pattern: Read codebase before designing** — reading `schema.prisma` before writing code surfaced the existing drop migration, avoiding redundant work.

## Lessons Learned

1. **When filing a migration fix issue, always check main for an existing remediation first**: #336 Phase 11 had already dropped the index. Issue #389 was still valid (the original migration SQL still had Step 4), but the scope was narrower than expected. Pre-scoping the codebase before writing the issue body would have surfaced this earlier.
2. **Production runbooks belong in `docs/runbooks/`**: This is the right home for ops-facing SQL scripts tied to a specific migration fix. The pattern is worth reusing for any future migration remediation.

## Agent Rule Updates Made to avoid recurrence

No new project rules needed — Rules 22a/22b/22c already cover migration hygiene. This issue was a consequence of a pre-existing design gap, not a process gap in the current rules.

## Enforcement Updates Made to avoid recurrence

1. **Issue #386** (migration pipeline stage) is the systemic fix: running `prisma migrate deploy` as a gating CI step would have caught this class of failure at deploy time rather than post-deploy.
