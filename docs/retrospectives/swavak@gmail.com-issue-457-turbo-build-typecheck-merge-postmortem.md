---
author: swavak@gmail.com
date: 2026-05-22
synthesized:
---

# Postmortem: Merge build+typecheck into single Turbo invocation - Issue #457

**Date**: 2026-05-22
**Duration**: ~1 session (within a larger CI optimization session)
**Objective**: Replace sequential `pnpm build` + `pnpm typecheck` CI steps with a single `pnpm turbo run build typecheck` invocation to eliminate the sequential barrier and reduce CI time.
**Outcome**: Success — PR #506 merged, CI passed on the first attempt using the merged step.

## Executive Summary

Issue #457 was a clean 2-line CI YAML change with no code or config changes beyond `ci.yml`. The implementation was straightforward once the scope was clear. The main complexity in this session was upstream: diagnosing and fixing the broken Turbo remote cache (wrong env var name `ABS_CONNECTION_STRING` and wrong container name via `STORAGE_PATH`) before this issue could even be evaluated. Once the cache was working, #457 was scoped, implemented, and merged without incident.

## Quick RCA Card

**What failed**: Nothing failed in this issue — clean implementation.
**Impact**: N/A
**What should have happened**: Exactly what did happen.
**What changes next time**: N/A
**Example**: N/A

## Architectural Impact

**Has Architectural Impact**: Yes

**Sections Updated**: `docs/architecture/cicd-pipeline.md` — step table (lines 105–106) and performance baseline table
**Changes Made**: Merged the separate "Build" and "Type check" rows into a single "Build & type check" row reflecting the unified Turbo invocation
**Rationale**: The architecture doc explicitly listed the two steps as separate entries; updating it keeps the doc accurate and avoids future confusion about why CI has a "Build & type check" step instead of two separate ones
**Updated in PR**: Yes — committed in the same PR as the ci.yml change

## Timeline of Events

### Phase 1: implement-scoping
- [done] **Read issue #457**: Confirmed 2-line YAML change scope
- [done] **Closed stale #493 and #494**: Prior combined issue/PR for #457+#458 were stale after #458 was closed; cleaned them up before creating the fresh branch
- [done] **Created branch**: `feature/457-turbo-build-typecheck-merge` off latest main
- [done] **Created work-list**: `docs/evidence/457-implement-work-list.md`

### Phase 2: implement-tests (N/A)
- [done] **Marked N/A**: CI YAML change with no production code; documented in work-list

### Phase 3: implement-code
- [done] **Merged steps**: Replaced Build + Type check with single `pnpm turbo run build typecheck` step
- [done] **Moved BAML verification**: Placed immediately after merged step with updated comment explaining ordering guarantee

### Phase 4: implement-validate
- [done] **Structural checks**: Verified merged step present, old steps removed, BAML step still in place
- [done] **Evidence doc created**: `docs/evidence/457-feature-implementation-evidence.md`

### Phase 5: implement-security-review
- [done] **Threat surface classification**: `surfaces: []` — pure CI config restructuring, no OWASP surfaces
- [done] **Security section appended to evidence doc**

### Phase 6: implement-regression
- [done] **Ran pnpm test:smoke on branch and on main**: Identical failure (missing date-fns module) — pre-existing environment issue, not introduced by this change

### Phase 7–10: Quality, Completeness, Architecture, Submission
- [done] **All traceability matrix rows: Met**
- [done] **Architecture doc updated**
- [done] **PR #506 created as draft, marked ready, CI passed, auto-merged**

## Root Cause Analysis

### 1. No mistakes in this issue
**Problem**: N/A — implementation went cleanly from scoping through merge on first attempt.
**What drove it**: Clear, minimal scope; prior discussion (earlier in the session) had already resolved the key question about silent failure risk.
**Corpus conflict**: None.
**Impact**: None — positive outcome.

### 2. Contributing Factor: Upstream cache fix was prerequisite
**Problem**: This issue could not be meaningfully evaluated for CI time savings until the Turbo remote cache was actually working. The cache had been broken since 2026-05-18 due to wrong env var names on the Container App.
**What drove it**: The turbo-cache Container App was deployed with `AZURE_STORAGE_ACCOUNT` + `AZURE_STORAGE_ACCESS_KEY` (wrong names); then `AZURE_STORAGE_CONNECTION_STRING` (still wrong); the correct name per `src/env.ts` is `ABS_CONNECTION_STRING`. Additionally, the container name was hardcoded via `STORAGE_PATH` defaulting to `turborepocache` instead of `turbo-cache`.
**Corpus conflict**: None — this was a new discovery.
**Impact**: Delayed the #457 work by ~1 session while the cache fix was investigated and applied.

## What Went Wrong

1. Nothing in issue #457 itself went wrong.
2. **Pre-session**: The Turbo remote cache Container App had been broken since initial deploy with two wrong env vars. This required significant diagnosis time before #457 could be evaluated.

## What Went Right

1. **Clean scoping**: Identified the BAML verification step ordering concern during scoping and addressed it proactively in the work-list before writing code.
2. **Stale artifact cleanup**: Recognized that #493 (combined issue) and #494 (draft PR) were stale and closed them cleanly before creating a fresh branch for #457 — avoided confusion about which issue/PR to target.
3. **Silent failure analysis**: Pre-discussed the failure-mode question with the user before implementing, which led to a clear understanding and user confidence before the code was written.
4. **First-pass CI success**: The merged step passed CI on the first attempt, confirming the BAML ordering analysis was correct.
5. **Architecture doc updated in same PR**: Kept `cicd-pipeline.md` accurate without needing a separate follow-up.

## What I Almost Did Wrong But Caught

1. **BAML step position**: Initially could have placed BAML verification after typecheck (at the end) rather than immediately after the merged step. Caught during scoping — the correct position is between the merged step and Playwright install, mirroring the original position between Build and Type check.

## Where Past Learnings Actually Fired

1. **VP-HIGH: Read codebase before designing**: Read `ci.yml` fully before drafting the change, which surfaced the BAML verification step as a dependency that needed explicit handling in the work-list. Prevented a missed step placement.
2. **VP-HIGH: Branch verification before first commit**: Verified branch was `feature/457-turbo-build-typecheck-merge` (not the stale `feature/493-*` branch) before staging any files.

## Lessons Learned

1. **turborepo-remote-cache env vars are non-obvious**: The library uses `ABS_CONNECTION_STRING` (not `AZURE_STORAGE_CONNECTION_STRING`) and `STORAGE_PATH` (not `AZURE_STORAGE_CONTAINER`) for Azure Blob Storage configuration. These names are defined in `src/env.ts` in the library source and must be verified from source before deployment. The deployed Container App had wrong env var names for its entire life until this session.
2. **Single Turbo invocation is safe for build+typecheck**: A merged `turbo run build typecheck` exits non-zero on any failure, and `dependsOn: ["^build"]` guarantees correct ordering. The only behavioral difference from two sequential steps is that some typechecks may run in parallel with other builds — which is the desired improvement.
3. **STORAGE_PATH controls blob container name**: In `turborepo-remote-cache`, the `STORAGE_PATH` env var (not `AZURE_STORAGE_CONTAINER`) sets the blob container name for Azure Blob Storage. The default is `turborepocache`.

## Agent Rule Updates Made to avoid recurrence

1. **Cache infrastructure verification**: Before declaring a self-hosted Turbo remote cache "working," verify blob storage is actually receiving artifacts (not just that the Container App is `Healthy`) by checking blob count after a CI run.

## Enforcement Updates Made to avoid recurrence

1. **Document correct turborepo-remote-cache env vars**: The correct env vars for Azure Blob Storage are `ABS_CONNECTION_STRING` and `STORAGE_PATH`. This is now captured in this retrospective and should be referenced if the cache is ever redeployed or reconfigured.
