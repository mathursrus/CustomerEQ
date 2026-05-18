---
author: swavak@gmail.com
date: 2026-05-17
synthesized: 2026-05-18
---

# Postmortem: CD: add image SHA probe to verify deployed containers match expected revision - Issue #387

**Date**: 2026-05-17
**Duration**: ~1 session
**Objective**: Add a post-deploy step to `deploy.yml` that asserts each container app is running the expected image tag, failing loudly if any app is running the wrong revision.
**Outcome**: Success — PR #402 submitted and approved with no feedback rounds.

## Executive Summary

A single bash step was added to `.github/workflows/deploy.yml` after all four container deploy steps. The step queries `az containerapp show` for each of the four apps and asserts the running image tag matches the expected SHA. The implementation was clean, scoped correctly, and approved without revision. The only notable event was a disk-full condition during issue preparation that required removing stale worktrees before the worktree for #387 could be created.

## Architectural Impact

**Has Architectural Impact**: No

## Timeline of Events

### Phase 1: Issue Preparation
- ✅ **Connected FRAIM session** and fetched `issue-preparation` job
- ✅ **Read project rules** and learnings before acting
- ❌ **First prep-issue.sh run failed** — C: drive was 100% full (33 MB free); screenshot files in `docs/replicate/analysis/screenshots/` exhausted remaining space during worktree checkout
- ✅ **Identified root cause** — stale worktrees for closed issues 120, 121, 175 still on disk; removed them to free 4.1 GB
- ✅ **Second run succeeded** — worktree created, branch pushed, pnpm install + build completed

### Phase 2: Scoping (implement-scoping)
- ✅ **Loaded core rules** (constitution, testing-standards, architecture-standards) and local-development rule
- ✅ **Read issue body** — identified as single-file feature with issue body as spec (no feature-spec or RFC)
- ✅ **Pattern discovery** — confirmed app names are hardcoded throughout deploy.yml (established pattern)
- ✅ **Created work list** at `docs/evidence/387-implement-work-list.md`
- ✅ **Implemented code** during scoping (trivial change, no risk of scope creep)

### Phase 3: Implementation (implement-code)
- ✅ **Added `Verify deployed image SHAs` step** — 28 lines after Deploy Demo Storefront, before Verify API health
- ✅ **Chose FAILED=1 accumulator** over issue body's fail-fast loop — reports all mismatching apps before exit 1

### Phase 4: Validation & Quality Gates
- ✅ **Typecheck**: 19/19 passed
- ✅ **Lint**: 4/4 passed
- ⚠️ **Smoke tests blocked** — `pnpm test:smoke` runner unconditionally calls `pnpm db:migrate` before any tests; Docker not running locally. Ran sampled unit tests directly (shared: 9/9, ui: 7/7, consent-text: 23/23) to confirm no regression.
- ✅ **Security review**: 0 findings (surfaces: [])
- ✅ **Completeness review**: 4/4 ACs Met, 0 Partial/Unmet rows
- ✅ **Architecture update**: N/A — no new system component

### Phase 5: Submission
- ✅ **Committed, pushed, PR #402 created**
- ✅ **Approved with no feedback rounds**

## Root Cause Analysis

### 1. **Disk Full During Worktree Creation**
**Problem**: `prep-issue.sh` failed mid-checkout when writing screenshot PNGs from `docs/replicate/analysis/screenshots/` — C: drive had only 33 MB free.
**What drove it**: No disk-space pre-check in the issue-preparation workflow. The stale worktrees for issues 120, 121, and 175 (all closed) were never cleaned up after their PRs merged.
**Corpus conflict**: None — no L1 entry addresses disk-space management.
**Impact**: Required an unplanned detour to identify and remove stale worktrees before continuing. ~10 minutes of overhead.

### 2. **Smoke Tests Require Docker (Undocumented Dependency)**
**Problem**: `pnpm test:smoke` unconditionally runs `pnpm db:migrate` before unit tests. CLAUDE.md describes it as "all unit tests, no API keys needed" — implying it should be runnable without infrastructure. In practice it requires a running PostgreSQL.
**What drove it**: The `test-suite-runner.mjs` calls `pnpm db:migrate` at line 94 unconditionally, regardless of mode. This was not visible from the CLAUDE.md description.
**Corpus conflict**: None — the description in CLAUDE.md is aspirational, not reflective of the actual runner script.
**Impact**: Could not run the full smoke suite locally to satisfy the CI gate. Mitigated by running individual package unit tests that don't require DB and by noting that typecheck + lint passed. The actual CI run on the PR is the authoritative gate.

## What Went Wrong

1. **Disk full**: Three closed-issue worktrees (120, 121, 175) were never cleaned up, consuming ~4 GB of a drive at capacity.
2. **Smoke test suite misleadingly named**: `pnpm test:smoke` requires Docker and a running DB despite being described as infrastructure-free.

## What Went Right

1. **Correct recovery from disk-full**: Checked GitHub issue state before removing worktrees (120/121/175 closed, safe to remove); verified no uncommitted work in each before deletion.
2. **Improvement over issue body script**: Chose `FAILED=1` accumulator over fail-fast `exit 1` in the loop — catches all mismatching apps in one run, which is significantly more useful in an incident scenario.
3. **Clean single-file scope**: Resisted any temptation to touch adjacent concerns (e.g., pre-existing unpinned GHA actions). Change was surgical.
4. **Zero feedback rounds**: PR approved on first submission.
5. **Security surface correctly classified as empty**: Recognized that GHA-interpolated commit SHAs are GitHub-controlled values, not user-controlled input — no injection risk, no security findings to chase.

## What I Almost Did Wrong But Caught

1. **Running smoke tests as the CI gate proof**: I initially tried `pnpm test:smoke` without checking whether it needed Docker. After the failure I traced the root cause (db:migrate unconditional call in runner) rather than reporting the failure as a regression from my change. This kept the evidence clean.

## Where Past Learnings Actually Fired

1. **Branch verification before commit** (validated-patterns: "Branch verification before first commit fires correctly at session resume") — confirmed the issue 387 worktree was on the correct feature branch before staging any files.
2. **Worktree safety** (mistake-patterns: "Editing a file on the wrong branch") — explicitly verified the worktree path and branch before running any edits.

## Lessons Learned

1. **Worktree hygiene should be part of issue-preparation**: The prep-failure-due-to-disk-full was caused by orphaned worktrees. A simple check (list worktrees, flag ones for closed issues) would surface this before it blocks a new prep run.
2. **`pnpm test:smoke` requires Docker — document it accurately**: CLAUDE.md's description ("all unit tests, no API keys needed") does not match the runner's behavior. The runner calls `pnpm db:migrate` unconditionally. Either the runner should check for DB availability and skip migration gracefully, or CLAUDE.md should say "requires running PostgreSQL."
3. **CI/CD YAML changes have no local test surface**: For pipeline-only changes, the PR CI run is the only meaningful validation gate. Local typecheck + lint + sampled unit tests are the best available proxy.

## Agent Rule Updates Made to avoid recurrence

1. **Disk-space awareness in issue-preparation**: Before running `prep-issue.sh`, check `df -h` and flag if free space is below 2 GB. If below, list open worktrees and identify any for closed GitHub issues as cleanup candidates.

## Enforcement Updates Made to avoid recurrence

1. **Close-issue worktree cleanup**: After any PR merges (work-completion job), remove the corresponding worktree as part of the cleanup step — don't leave it to accumulate.
2. **Smoke test documentation fix**: Update CLAUDE.md description of `pnpm test:smoke` to note the Docker/PostgreSQL dependency, so future agents don't treat a DB-unavailable failure as a regression from their change.
