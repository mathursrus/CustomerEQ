---
author: swavak@gmail.com
date: 2026-04-21
synthesized: 2026-05-08
---

# Postmortem: Left nav pane has no scrollbar when window is resized — Issue #155

**Date**: 2026-04-21  
**Duration**: ~30 minutes  
**Objective**: Fix the admin sidebar nav so it scrolls independently when the viewport height is smaller than the nav content  
**Outcome**: Success — PR #169 merged, CI green, no feedback rounds

## Executive Summary

A single missing Tailwind class (`overflow-y-auto`) on the `<nav>` element in the admin layout caused all lower menu items to be unreachable when the browser window was resized to a small height. The fix was a one-word change in one file, completed in a single CI-passing PR with no feedback rounds.

## Architectural Impact

**Has Architectural Impact**: No

## Timeline of Events

### Phase 1: Scoping
- ✅ Created branch `feature/issue-155-left-nav-scrollbar` from updated main
- ✅ Identified root cause by reading `apps/web/src/app/(admin)/layout.tsx` — `<nav>` had `flex-1` but no `overflow-y-auto`
- ✅ Created `docs/evidence/155-implement-work-list.md`

### Phase 2: Repro
- ✅ Root cause confirmed analytically — `<aside>` constrained to `inset-y-0`, `<nav>` fills height with `flex-1` but clips without overflow control

### Phase 3: Tests
- ✅ Authored `apps/web/test/e2e/admin-nav-scrollable.spec.ts` — two assertions at 600px viewport: computed `overflow-y` and Developer link reachability

### Phase 4: Code
- ✅ Added `overflow-y-auto` to `<nav>` className — one word, one file

### Phase 5: Validate & CI
- ✅ 542 unit tests pass; lint 0 errors; CI Build+Lint+Test green on both PR runs

### Phase 6: Submission
- ✅ PR #169 merged, evidence docs committed, PR comment posted

## Root Cause Analysis

### 1. Primary Cause
**Problem**: `overflow-y-auto` missing from the `<nav>` element inside a flex-column sidebar whose height is constrained by `inset-y-0`  
**Impact**: Content below the visible area clipped; users on small viewports or with DevTools open cannot access lower nav items

### 2. Contributing Factors
**Problem**: The adjacent `<main>` element already had `overflow-y-auto` (correct), but the pattern was not applied to the nav when it was first authored  
**Impact**: Asymmetric overflow handling between the two flex children was easy to miss during initial code review

## What Went Wrong

1. **Original implementation oversight**: The `<nav>` was styled as a flex-fill child but the scrollability contract was never established — likely because at full viewport heights it looked fine.

## What Went Right

1. **Fast root cause identification**: Reading the layout file directly revealed the issue immediately — no bisection or debugging needed.
2. **Correct fix level**: Followed project rule #15 (fix at the right abstraction level) — the fix lives in the shared layout, not per-page.
3. **Branch hygiene**: Caught the branch mismatch early (was on issue-156 branch) and created a clean issue-155 branch before touching any code.
4. **CI passed first try**: No iteration needed on the implementation or tests.

## What I Almost Did Wrong But Caught

1. **Committing to the wrong branch**: Session started on `feature/issue-156-webhook-delivery-impl`. Before staging anything, checked current branch and created `feature/issue-155-left-nav-scrollbar`. Mistake-pattern L1 entry `[P-HIGH] Committing to old branch on session resume` fired correctly.

## Where Past Learnings Actually Fired

1. **[P-HIGH] Committing to old branch on session resume** — triggered by the git status check at session start; I verified the branch explicitly before creating any commits, switched cleanly, and never staged issue-155 work on the issue-156 branch.

## Lessons Learned

1. **Flex-column containers need explicit overflow on every scrollable child**: When a flex container constrains height (via `h-screen`, `inset-y-0`, etc.), every child that can overflow must declare its own overflow behavior. `flex-1` fills space but does not scroll — these are orthogonal concerns.
2. **CSS-only bugs are trivially reproducible from the source**: For layout/overflow bugs there is no need to spin up a browser for the repro phase — reading the className string is sufficient to confirm the cause.

## Agent Rule Updates Made to avoid recurrence

1. None required — this was a one-off authoring gap, not a systemic rule problem. The existing project rule #15 (fix at the right abstraction level) already covers this class of issue.

## Enforcement Updates Made to avoid recurrence

1. The E2E test now provides a permanent regression guard: if `overflow-y-auto` is accidentally removed from the nav in future, `admin-nav-scrollable.spec.ts` will fail CI.
