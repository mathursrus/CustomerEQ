---
author: manohar.madhira@outlook.com
date: 2026-05-30
synthesized:
---

# Postmortem: Survey.sentCount historical backfill + tokenized respondent page flashes "Failed to load survey" — Issue #543

**Date**: 2026-05-30
**Duration**: Single session (continuous from #540 work-completion)
**Objective**: Fix two findings the user surfaced after the #540 PR shipped — (a) historical Survey.sentCount for SELF_SERVE batches never got backfilled, leaving the FRAIM org's flagship survey showing `Survey Sent: 2` against Loop Monitor's true `43`, and (b) clicking a survey link flashed a red "Failed to load survey" card for ~50–200ms before the survey rendered.
**Outcome**: Success. Both fixes shipped in PR #545. The relevant gap from #540 (backfill explicitly out-of-scope; turned out to be wrong call) is acknowledged.

## Executive Summary

Two-finding bug bundle on top of #540 / #531. F1 is a Prisma backfill migration that recomputes `Survey.sentCount` from the source-of-truth tables — directly addressing the "Are you FRAMING It?" reproduction. F2 is a one-line inner-`if` guard on the tokenized respondent page that routes the transient pre-fetch render to the existing Loading card instead of the red error card. The reflective lesson is structural rather than a near-miss: I explicitly deferred F1 in #540's work-list ("Backfill of `Survey.sentCount` for historical SELF_SERVE batches… Possible follow-up; current scope assumes 'from now on' semantics is acceptable") and that assumption was wrong from the user's perspective. The user-visible bug was *still* user-visible after #540 merged.

## Quick RCA Card

**What failed**: I shipped #540's F3 fix with `Survey.sentCount` semantics aligned going forward and labeled the backfill as out-of-scope. The user reasonably expected the bug they reported to be *gone*, not "fixed for new batches only." The denormalized field was already wrong; my fix made future writes correct without correcting the historical lie.

**Impact**: Bug remained user-visible from 2026-05-28 (#540 merge) to 2026-05-30 (this fix). Specifically, the operator-facing Survey Sent: N header continued to display 2 instead of 43 on the FRAIM brand's flagship survey. Small impact (one survey, one denormalized counter), but the user had to come back and re-prompt the fix — a signal I called the boundary wrong.

**What should have happened**: The backfill decision in #540's work-list should have been "backfill required" not "from-now-on is acceptable." A denormalized counter that's already wrong + a fix that only corrects future writes = a fix that doesn't fix the user-visible symptom. The test for "is the assumption acceptable?" is "does the operator see the right number after deploy?" — and that test had a clear answer (no, they still see the wrong number) that I didn't apply at scoping time.

**What changes next time**: When fixing a denormalized aggregate or any "field of record that drifted from truth," the default assumption is `backfill required` unless I can articulate a specific reason the historical data is also correct. "From now on" semantics is acceptable for counter resets / version bumps / opt-in migrations, not for "the field has been wrong, here's a fix that makes new writes correct."

**Example**: #540 work-list § 5 Out of scope said:
> *Backfill of `Survey.sentCount` for historical SELF_SERVE batches that minted before this fix and where the operator never called `mark-csv-downloaded`. Possible follow-up; current scope assumes "from now on" semantics is acceptable.*

User on 2026-05-29: "I don't see the totals (issue 3 originally reported) fixed on the site. Has the change really gone to production? I still see Survey Sent: 2..." The assumption was demonstrably wrong from the user's standpoint within 24 hours of merge.

## Architectural Impact

**Has Architectural Impact**: No

The Prisma migration follows the established #420 / #540 patterns (snake_case @@map tables + camelCase quoted columns per Rule 22a). The respondent-page inner-`if` guard is a one-line conditional on an existing component; no new pattern. Architecture doc already covers the relevant cross-cutting items (email rendering #420; runtime config #540; UI-resolved memberIds #531). No new entry warranted.

## Timeline of Events

### Phase 1: #540 work-completion → user discovers backfill gap
- [done] 2026-05-29 07:36 — #540 merged (cc0fd54), Deploy-to-Azure success.
- [done] 2026-05-29 — user spot-checks production: Survey Sent: 2 vs Loop Monitor's 43 on FRAIM survey. Bug *not visible* fixed.
- [done] User signals: "Has the change really gone to production?"
- [done] I trace through code, confirm fix shipped, explain that historical SELF_SERVE batches never had `Survey.sentCount` bumped (mark-csv-downloaded was the only bump path and operators frequently skipped it).
- [done] I acknowledge the assumption (`current scope assumes 'from now on' semantics is acceptable`) was wrong.

### Phase 2: User adds F2 to the same issue
- [done] User reports the respondent-page flash: "When I click the link to access the survey, first a message pops up: Failed to Load Survey and then the survey shows up."
- [done] I propose two paths for F1: (1) ad-hoc SQL against prod (fast, sloppy), or (2) Prisma migration (discipline matches the IaC argument from #540). User picks (2).
- [done] I investigate F2 root cause quickly: `apps/web/src/app/survey/[id]/r/[token]/page.tsx:188` error fall-through reachable in transient state where `tokenState='valid'` but form's `useEffect` hasn't fired (loading=false, resolvedSurvey=null, error=null).
- [done] User says: "Add this into the 543." Files don't intersect; reasonable bundle.
- [done] I update issue #543 title + body to reflect both findings.

### Phase 3: FRAIM issue-preparation + feature-implementation
- [done] `prep-issue.sh 543` ran (worktree pre-existed from an earlier interrupted call; re-verified env-files, deps, branch).
- [done] `implement-scoping` work-list with 4 files (migration + integration test + page.tsx + page unit test).
- [done] `implement-repro` — F1 4 integration tests + F2 3 unit tests. Failing tests written first.
- [done] **F1 SQL bug surfaced via test failure**: my initial SQL used `"Survey"` (PascalCase Prisma model name) but the actual DB tables are `surveys` (snake_case via `@@map`). Diagnosed via debug log showing `pg_tables WHERE tablename = 'Survey'` returned `[]`. Fixed by changing to `"surveys"`, `"survey_distribution_tokens"`, etc.
- [done] **F1 test-rig schema-qualification gap**: `prisma.$executeRawUnsafe` doesn't auto-qualify the per-test schema like the typed client does. Added a `getTestSchema()` helper that extracts the schema from `DATABASE_URL` and substitutes it into the SQL. Migration file ships without substitution (Prisma migrate runs against `public`).
- [done] All tests green after the fixes.
- [done] All remaining FRAIM phases through `implement-submission` complete.

### Phase 4: PR + approval
- [done] PR #545 opened as Draft.
- [done] User signals "proceed" → completing retrospective + work-completion now.

## Root Cause Analysis

### 1. **Primary Cause — "from now on" semantics applied to a denormalized counter that was already wrong**

**Problem**: I scoped F3 in #540 as "fix the bump-at-the-right-time logic" and explicitly deferred the historical backfill. That works for fields that are *fresh as of code-deploy* but not for denormalized aggregates that *were already drifting from truth*. The user observed the bug *because* the field was wrong; my fix made future writes correct without correcting that wrongness.

**What drove it**: A heuristic I'd internalized from earlier work — when you fix a counter/aggregator, you have a choice between (a) backfilling and (b) declaring "from now on" semantics. Option (b) is usually preferred for things like "we added a new metric we weren't tracking before" or "we changed how we count tier-points." But the user-visible symptom test is the discriminator: if "the operator sees N instead of N+k after the deploy" is wrong, then (b) is wrong, period. I didn't apply that test at scoping time in #540.

**Corpus conflict**: None directly — no learning-file entry guided me to "defer backfills." But the absence of a "denormalized counter fix → backfill required by default" rule is what let me skip the discriminator. This retrospective produces the signal for one.

**Impact**: User had to re-prompt to get the bug they reported actually fixed. Two-day window where the symptom persisted on production. Low magnitude (one survey, one number) but high signal — it's the exact failure mode the user explicitly held me accountable for in the #531 work ("user tests functionality; close mock-to-implementation drift proactively after the functional pass, no permission needed").

### 2. **Secondary cause — initial F1 SQL used PascalCase table names**

**Problem**: First draft of the migration SQL had `UPDATE "Survey" SET "sentCount" = ...`. Tests failed loudly with `relation "test_xxx.Survey" does not exist`. Diagnosed via debug log on `pg_tables`. Fixed by changing to the snake_case `@@map` names: `"surveys"`, `"survey_distribution_tokens"`, etc.

**What drove it**: Pattern-matched from the Prisma model names in `schema.prisma` (PascalCase: `model Survey`, `model SurveyDistribution`) rather than the `@@map` snake_case directives. The two namespaces (Prisma model vs DB table) are visually identical-looking in the schema file but they map to DIFFERENT identifiers in raw SQL — Prisma's typed client bridges them, raw SQL doesn't.

**Corpus conflict**: Project rule 22a explicitly says "Column identifiers must match Prisma's camelCase quoting" — that part I got right. But the *table* name vs *model* name distinction isn't called out in any rule I've seen. The existing migrations all use snake_case plural table names (I verified `20260523050000_add_managed_email_send` after the failure). I should have grepped the most recent migration for the convention before writing my own.

**Impact**: One test cycle to diagnose. ~5 minutes of debug-log + grep. Low-cost mistake, caught by tests.

## What Went Wrong

1. **Mis-scoped the #540 backfill as out-of-scope.** That assumption was the load-bearing decision behind the user-visible symptom persisting after merge. Primary cause above.

2. **First-pass F1 SQL used Prisma model names instead of DB table names.** Caught by integration test failure. Diagnosable but avoidable — should have grepped an existing migration first.

3. **First-pass F1 test infrastructure didn't account for `$executeRawUnsafe` schema qualification.** The typed Prisma client auto-qualifies the per-test schema (`?schema=test_xxx`); raw SQL doesn't. Added a helper that substitutes the schema; the migration file is unaffected (runs against `public` in prod).

## What Went Right

1. **Tests caught both raw-SQL mistakes loudly and quickly.** The "relation does not exist" error from #2 above gave me the exact diagnostic in <2 minutes via `pg_tables` debug log. The schema-qualification issue from #3 came up the same way. No "silent test pass" trap.

2. **Migration file documents itself thoroughly.** The header comment in `migration.sql` explains the truth-recompute reasoning, idempotency, no-double-count invariant, race-window magnitude, and `WHERE EXISTS` guard rationale. Future agents touching `Survey.sentCount` find the reasoning inline.

3. **F2 was a textbook race-condition diagnosis.** Three-render-cycle trace (tokenStatus resolves → tokenState=valid → form.enabled=true → loading still false from useState initial value → fall-through to error → useEffect fires → loading=true → re-render to Loading → data → render survey). The inner-`if` guard is the minimal fix; comment locks the reasoning so the next reader doesn't think it's redundant.

4. **Bundled into one issue per user directive without scope-creep.** F1 (database) and F2 (web client) don't intersect files; PR diff stays reviewable; matches the "files-disjoint" criterion I've established for bundling in #540.

5. **Filed the migration as a proper Prisma migration, not ad-hoc SQL.** User explicitly chose this path; I'd offered ad-hoc SQL as the fast alternative. Discipline matches the IaC argument from #540 ("why ad-hoc commands instead of code?").

## What I Almost Did Wrong But Caught

1. **Almost ran the backfill as ad-hoc `psql` against prod.** When I first proposed the fix, ad-hoc SQL was the fastest path to close the user-visible bug. I correctly raised it AND the Prisma-migration path together rather than just running the SQL. The user picked the disciplined path. Had I just executed the SQL without raising the alternative, the codebase would carry no record of the recompute and the next operator wouldn't know what state the field reflects.

2. **Almost extracted a `<LoadingCard>` component for F2.** Considered making the Loading state a reusable subcomponent. Rejected because (a) the chrome is locked by the R12 byte-identity invariant (#413) and inlining keeps the assertion straightforward to read, and (b) it's the SECOND loading state on the same file; the threshold for extraction is N=3 per my own internalized DRY heuristic. The inner-`if` block's 8 lines duplicate the chrome of the line-128 loading state; that's fine.

3. **Almost included the F2 race fix in the work-list as a "stretch" item.** The user added F2 mid-conversation and asked it be bundled into #543. I correctly updated the issue body, title, and work-list with both findings rather than treating F2 as informal.

## Where Past Learnings Actually Fired

1. **`Mock drift is my responsibility`** — relevant analogy: *operator-visible-drift is my responsibility*. The #540 work-list explicitly deferred backfill; user surfaced the consequence. The fix is to internalize "user-visible-state-is-still-wrong-after-merge = the fix isn't done" as a corollary of that learning.

2. **`Draft PR until work-completion`** — fired. PR opened as `--draft`. Will flip to Ready in resolution-merge.

3. **`Validate phase must run build`** — fired. Ran `pnpm turbo run build --concurrency=1`; 12/12 green.

4. **`One PR per issue (Rule 26)`** — fired. Both findings ship on one PR.

5. **`merit over ease`** — fired during the migration-vs-ad-hoc-SQL decision. Mentioned the ad-hoc path was faster but explicitly stated the migration path was the long-term-correct answer; user confirmed.

6. **`No internal refs on customer pages`** — fired by inference; nothing in the F2 fix surfaces issue numbers to the user. Loading copy is "Loading…" — neutral, no internal context.

## Lessons Learned

1. **Denormalized counter fix → backfill required by default.** "From now on" semantics is acceptable for fresh metrics or version-bumped policies, not for fields whose existing values reflect a drift from truth. The discriminator at scoping time: *"after deploy, will the operator see the correct number, or will they see the stale one until enough new events flow through?"* If the answer is "stale until N more events," backfill required.

2. **Prisma model name ≠ DB table name when writing raw SQL.** The `@@map` directives at the bottom of each `model` define the actual table identifier. Always grep an existing migration in the same area before writing a new one to confirm the convention. Took 5 minutes from "test fails with relation does not exist" → grep pg_tables → grep existing migration → fix. Could have been zero minutes by checking the existing migration first.

3. **`$executeRawUnsafe` doesn't auto-qualify the per-test schema.** Prisma's typed client uses `?schema=...` from the connection URL; raw SQL bypasses it. Tests that exercise migration SQL need a helper that substitutes the schema in the raw query. The migration file itself ships unsubstituted — it runs against `public` in prod and tests substitute per-process.

4. **The user's question pattern from #540 ("does this work in inline mode?") applies here too as "is the operator's view of state actually correct post-deploy?"** Both are the same structural review: *trace the data path from the bug report's symptom location all the way to the source-of-truth column, and verify each link has been fixed (not just one)*. The path for #543 F1: header strip → `Survey.sentCount` → mint-time bump (post-#540) AND historical state (needed backfill). I fixed link 1 in #540 and left link 2 unfixed. Self-review should have surfaced this.

5. **Migration test infrastructure pattern is now codified in the codebase.** The `getTestSchema()` helper in `apps/api/test/integration/distributionBatches.test.ts` is the second instance (first is `survey-admin-ux-slice1-migration.test.ts` using a different pattern). Future migration tests can copy from either; both work.

## Agent Rule Updates Made to avoid recurrence

1. **No FRAIM rule files modified for this issue.** Lessons above are candidates for `sleep-on-learnings` synthesis. Most-actionable: the "denormalized counter fix → backfill required" heuristic.

## Enforcement Updates Made to avoid recurrence

1. **F1 migration locks the truth-from-scratch invariant.** The `WHERE EXISTS` guard + idempotency property mean re-running the migration on later releases (if drift ever resumes) is safe. Future Prisma migrate runs see the migration in the lock and skip it; running the SQL manually against prod (or in a follow-up migration) is also safe.

2. **F2 inner-guard has an inline comment naming the race.** Next reader who sees `!form.error && !form.loadError` knows it's intentional and the test that locks it. Eliminates the "looks redundant, let me remove this" failure mode.

3. **F2 test file (`page.loading-vs-error.test.tsx`) sits beside the existing R12-byte-identity test on the same surface.** Two locked invariants on `/survey/[id]/r/[token]/page.tsx`: timing-attack token enumeration (R12) and now loading-vs-error discrimination. Both lock at unit-test layer.

4. **Issue body updated post-creation to add F2.** Demonstrates the "expand the issue body to match scope expansion" pattern (precedent: #540 mid-PR scope expansion → renamed + rewrote body). Available as reference for future bundles.
