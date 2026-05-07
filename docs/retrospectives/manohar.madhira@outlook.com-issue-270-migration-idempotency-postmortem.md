---
author: manohar.madhira@outlook.com
date: 2026-05-04
synthesized: 2026-05-05
---

# Postmortem: Migration `20260430000000_patch_survey_distribution_gap` non-idempotent on fresh DB - Issue #270

**Date**: 2026-05-04
**Duration**: ~90 min from issue prep to PR open (split: ~30 min on issue #276 prep that surfaced #270 as a blocker; ~60 min on #270 itself: prep + scoping + repro + tests + code + validate + security + completeness + submission)
**Objective**: Make the recovery patch migration idempotent so a clean DB can apply it without P3018 / P3009, and add a CI gate that catches this regression class.
**Outcome**: success — PR #280 opened with the migration fix + CI migrate-deploy gate + pgvector image swap; AC1/AC2 demonstrated locally end-to-end; AC3 implemented and pre-validated locally for the failure mode.

## Executive Summary

The patch migration shipped with seven unguarded DDL blocks under the assumption it would only ever run on the half-broken DB it was authored to recover. On a clean DB the prior migration runs to completion and the patch then errors with `42P07 relation already exists`, after which `migrate deploy` cascades into P3009 forever. Wrapped each unguarded block in the same idempotency pattern already used by the FK constraints lower in the file, switched the CI postgres service to `pgvector/pgvector:pg16` to satisfy the pgvector precondition, and added a `Run migrations` step so future regressions of this shape fail at PR time, not on contributor laptops or in DR. The fix surface ended up larger than the issue body's two-block example (because the read of the file revealed five more unguarded blocks downstream of the first failure point); that scope expansion was surfaced explicitly in the work list so the technical-design traceability matrix stayed honest.

## Architectural Impact

**Has Architectural Impact**: No

The diff hardens an existing migration and propagates a previously-decided architectural choice (pgvector for postgres, ADR-0002) into CI. No new ADR. The `Run migrations` CI step is an operational gate, not a new architectural pattern.

## Timeline of Events

### Phase 1: discovery via #276 prep
- ✅ **Tripped over P3009** while running workspace-verification for #276 — `pnpm db:migrate` failed on `20260430000000_patch_survey_distribution_gap`.
- ✅ **Recognized the matching open issue (#270)** and surfaced the dependency to the user as a sequencing question instead of grinding past it.

### Phase 2: prep
- ✅ **Ran prep-issue.sh 270** — worktree at `C:\Github\mathurus\CustomerEQ - Issue 270`, branch `feature/270-…` pushed, npm install side-effect on `package-lock.json` discarded.
- ✅ **Copied `.env` to root + `packages/database/`** so Prisma loads the URL from the schema directory.

### Phase 3: implement-scoping
- ✅ **Read the actual migration.sql** and inventoried 7 unguarded DDL blocks (issue body's example covered 2; my read showed 5 more downstream).
- ✅ **Read CI yaml + ADR-0002** to confirm the pgvector image swap is required as a precondition for the migrate-deploy gate (otherwise migration #14 fails on `CREATE EXTENSION vector`).
- ✅ **Read mistake-pattern entry "Migration not validated against a real DB before PR submission" (#170 PR1)** — informed the work list's local fresh-DB verification requirement.
- ✅ **Wrote `docs/evidence/270-implement-work-list.md`** with explicit scope, file-level change list with verification, validation requirements, AC mapping, risks (Prisma checksum drift), and a one-time local recovery note.

### Phase 4: implement-repro
- ✅ **Confirmed P3009 live** against the shared dev DB; queried `_prisma_migrations` directly to show `finished_at=NULL`, `applied_steps_count=0`.
- ✅ **Spun up ephemeral pgvector/pgvector:pg16 on port 15432** to capture the underlying P3018 / 42P07 cleanly without touching the shared dev DB. Reproduced the exact error the issue body predicts.

### Phase 5: implement-tests
- ✅ **Added the CI gate first** (`Run migrations (regression gate for #270)`) plus the postgres image swap. The gate IS the durable failing test for this class of bug.

### Phase 6: implement-code
- ✅ **Wrapped the 7 unguarded blocks** with the same DO/EXCEPTION + IF NOT EXISTS pattern already used in the file.
- ✅ **Used `information_schema.columns` data_type check** to gate the cx_playbooks surveyType column-type swap so the recovery DROP+ADD only fires when the column is still TEXT.
- ✅ **Validated against a fresh ephemeral DB** — all 20 migrations apply cleanly.
- ✅ **Validated direct psql replay against the already-applied DB** with `ON_ERROR_STOP=1` — only NOTICE: skipping, no errors. Stronger than the Prisma "no pending migrations" check.

### Phase 7: implement-validate
- ✅ **R11 sanity gates**: build (11/11), typecheck (17/17), lint (4/4, 0 errors).
- ⚠️ **`pnpm test:smoke` 390/391**: lone redis-mock test pollution flake. Verified pre-existing, environment-specific, unrelated to my SQL+YAML diff (passes in isolation in this worktree, passes 391/391 in main, all 5 most recent CI runs on main are SUCCESS).

### Phase 8-10: security / quality / arch-update
- ✅ **Security review**: no surfaces matched (SQL DDL + GHA YAML + evidence MD); secrets / PII / GHA-action checks all clean.
- ✅ **Quality review**: no findings (pattern reuse from existing code, file sizes well under 500-line guidance, complexity ≤ 1 nesting).
- ✅ **Arch update**: none needed (ADR-0002 already documents pgvector; CI step is operational not architectural).

### Phase 11: implement-submission
- ✅ **Commit `fbfb121`** with conventional message tied to issue.
- ✅ **PR #280 opened** with summary, why, test plan, and evidence links.

## Root Cause Analysis

### 1. **Primary Cause**

**Problem**: The patch migration was authored as a one-off recovery script for a specific broken-state DB and shipped with unconditional DDL that assumes that broken state. The author's preamble explicitly enumerates the assumed pre-conditions ("survey_distributions MISSING", "cx_playbooks.surveyType still TEXT") but the SQL itself doesn't enforce those assumptions, so on any DB where those assumptions don't hold it errors.

**Impact**: Fresh contributor onboarding broke at first `pnpm db:migrate`; any future production DR rebuild from migrations would have failed at the same point; existing contributor DBs that hit it once entered a permanent P3009 state until manual `prisma migrate resolve`.

### 2. **Contributing Factor (CI blindspot)**

**Problem**: The CI workflow ran `prisma validate` and `pnpm db:generate` (both static / parse-only) and the test suite uses `prisma db push` (schema sync, not migration replay), so migration history was never exercised end-to-end in CI. A non-idempotent migration could land on `main` and only break on contributor or DR rebuild paths — exactly what happened.

**Impact**: The window between the patch's merge and the first contributor `db:reset` was the only signal that the migration didn't roll forward on a clean DB. By the time it was reported it had been latent for ~5 days.

## What Went Wrong

1. **Did not catch the wider scope from the issue body alone.** The issue body suggested wrapping the `CREATE TABLE` and `ALTER TABLE` blocks; on read, five more unguarded indexes/constraints downstream needed the same treatment. Caught by reading the file before drafting the work list (per the L0 raw signal "rfc-claimed-files-not-verified-against-codebase"), but worth noting that the issue body's surface example was incomplete.
2. **Test-pollution flake noise during the validate / regression gates.** `pnpm test:smoke` reported 390/391 with a redis-mock pollution failure that recurred deterministically on the full suite but disappeared in isolation. Cost a few minutes triaging "is this me?" before confirming it's pre-existing and environment-specific. CI on main is clean.

## What Went Right

1. **Surfaced the #270 dependency to the user when prepping #276** instead of trying to either work around the P3009 silently or sequence #276 first. The user picked the right ordering (270 → 276) in two short turns.
2. **Wrote the failing-test (the CI gate) before the fix and validated its failure mode locally** on an ephemeral pgvector container. P3018 / 42P07 reproduced as predicted, then went green after the fix. This is the test-driven shape the FRAIM `implement-repro` and `implement-tests` phases ask for, applied honestly to a SQL change where the "test" is a CI step.
3. **Two-pass idempotency validation**: not just `prisma migrate deploy` (which trusts its own history) but also direct `psql -v ON_ERROR_STOP=1 -f migration.sql` against an already-applied DB. The latter catches checksum-trust assumptions that the Prisma run would mask.
4. **Read ADR-0002 before swapping the CI postgres image** to verify pgvector is the canonical project decision, not an ad-hoc choice. The CI swap reads as "propagate an existing decision" rather than "introduce a new one".

## What I Almost Did Wrong But Caught

1. **Near-miss: blaming the redis test failure on my changes.** First reaction was to start grepping for connections between my SQL diff and `redis.test.ts`. Caught when re-reading the failure (`TypeError: Cannot read properties of null` on a redis-mock test) — there is no path from a Prisma migration to a fastify-redis-mock plugin. Switched to "is this pre-existing?" diagnostics (run in isolation, run in main workspace, check CI history) and got a clean answer in two minutes. The L1 pattern *Diagnose my own script before blaming externals* fired in the right direction here — the answer just happened to be "not me".

2. **Near-miss: skipping the AC2-strong-form psql-replay test.** First instinct was to call AC2 satisfied based on the second `prisma migrate deploy` returning "No pending migrations" — but that just proves Prisma's own history caching, not that the SQL is replay-safe. Caught by re-reading AC2 ("the new patch is a verified no-op") and recognizing that Prisma's own short-circuit isn't the verification the AC asks for. Ran the direct psql replay and got the real evidence.

## Where Past Learnings Actually Fired

1. **Pattern**: *Migration not validated against a real DB before PR submission* (#170 PR1 mistake-pattern). Fired during work-list authoring — added explicit fresh-DB and already-applied-DB validation rows to the validation-requirements section, executed both before phase 5 finished. The PR doesn't ship with passive language like "should apply on next migrate dev".

2. **Pattern**: *RFC claimed files not verified against codebase* (L0 raw signal, 2026-05-04). Fired before drafting the work list's file-level change table — read the actual migration.sql, the actual ci.yml, and verified `docs/architecture/architecture.md` exists, before claiming any modifications. The seven-unguarded-blocks finding came directly from this read.

3. **Pattern**: *Diagnose my own script before blaming externals* (#200 secrets-script L1). Fired when the redis test failed — instead of immediately filing an unrelated-test issue, I checked main / isolation / CI to confirm the diagnosis. Saved a wrong-direction debugging spiral.

4. **Pattern**: *FRAIM phase mentoring on a "small" fix* (#255 retro). The user explicitly asked me to "proceed to implementation considering it is small fix". Past me would have read that as "skip the FRAIM phase loop" and gone straight to commit. This time I ran the seekMentoring loop through all 13 phases, kept the evidence trail honest, and the small-fix didn't shortcut into a process-debt accumulation. Worth explicitly noting that "small fix" + "use FRAIM" are not in tension.

5. **Pattern**: *Issue before branch / one issue per branch* (R10 / R21). The shared dev DB's failed-migration state surfaced during #276 prep but I didn't bundle the #270 fix onto the #276 branch — surfaced as a dependency, got user approval to file #270 separately (already filed), prepped its own branch.

## Lessons Learned

1. **For SQL migrations, "idempotent" must be tested by replaying the SQL itself against an already-applied DB, not by running migrate deploy twice.** Prisma's own history cache will short-circuit the second migrate-deploy and tell you nothing about whether the underlying SQL is replay-safe. The strong-form test is `psql -v ON_ERROR_STOP=1 -f migration.sql` against a DB that already has the schema state.
2. **Recovery / patch migrations need an explicit pre-condition guard at the top of the file, not just a comment.** The original patch's preamble correctly enumerated the assumed broken state but didn't refuse to run when those assumptions failed. Two reasonable patterns: (a) wrap the whole patch in `IF (broken-state markers exist) THEN ... END IF;`, or (b) wrap each unsafe DDL with its own `EXCEPTION WHEN duplicate_*` / `IF EXISTS` guard. (b) is what the issue body asked for and what shipped — (a) would also work and be slightly clearer about intent.
3. **A new CI step that runs Prisma against a real DB needs the same image as local docker-compose.** Otherwise extension-dependent migrations (pgvector here) blow up before they reach the gate's actual purpose. ADR alignment is a precondition check, not an afterthought.

## Agent Rule Updates Made to avoid recurrence

1. **None at the rules layer**. The mistake here is a pattern at the SQL-migration-authoring layer (recovery migrations should be guarded), not a process miss at the agent-rule layer. Filing this as a learnings entry rather than a rule change.

## Enforcement Updates Made to avoid recurrence

1. **CI gate added** in this PR — `Run migrations (regression gate for #270)`. Any future migration that fails to roll forward on an empty postgres now fails the PR, not the contributor's `db:reset`.
2. **Pattern available for next migration author**: the file's existing FK-guard pattern (DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;) is now applied consistently across the file, so the next migration author copying this file as a template will inherit the safe shape by default.
3. **Out-of-scope deferral logged**: extracting `DATABASE_URL` to workflow-level env (carried over from #255 retro). Not blocking #270 but worth picking up next time someone is in `.github/workflows/ci.yml`.
