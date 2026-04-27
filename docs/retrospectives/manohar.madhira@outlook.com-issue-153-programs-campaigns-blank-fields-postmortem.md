---
author: manohar.madhira@outlook.com
date: 2026-04-20
synthesized: 2026-04-27
---

# Postmortem: Programs and Campaigns blank fields fix - Issue #153

**Date**: 2026-04-20
**Duration**: ~3 hours (including environment setup and browser validation)
**Objective**: Fix blank fields when opening Programs or Campaigns in edit/view mode, plus related issues #133 (step label) and #134 (hardcoded eligibleTiers)
**Outcome**: Success — all four fixes verified in browser

## Executive Summary

Programs and Campaigns showed blank fields when opened because React form state was initialized once on mount and never re-synced when API data arrived. The fix adds `useEffect` hooks to dispatch state updates when data becomes available. Browser testing confirmed all fields populate correctly for both Programs (server component data flow) and Campaigns (client-side async fetch). Two related minor bugs (#133, #134) were fixed in the same PR.

## Architectural Impact

**Has Architectural Impact**: No

## Timeline of Events

### Phase 1: Issue Preparation
- ✅ Created isolated worktree via `prep-issue.sh`
- ✅ Reviewed 2 retrospectives (issue #2 technical design, issue #71 text visibility)
- ✅ Reviewed project rules — especially Rule #15 (fix at the right abstraction level)

### Phase 2: Scoping
- ✅ Identified 4 files to modify, classified as bug fix
- ✅ Created implementation work list at `docs/evidence/153-implement-work-list.md`
- ✅ No spec or RFC needed — root cause was clear from code analysis

### Phase 3: Repro
- ✅ Confirmed root cause via code analysis (no test framework available for component testing)
- ✅ Identified that `LOAD` reducer action existed but was never dispatched
- ✅ Explained browser-specific behavior: Next.js router cache preserves RSC payload in creating browser

### Phase 4: Implementation
- ✅ Fix 1: ProgramWizard — added useEffect + useRef JSON comparison to dispatch LOAD
- ✅ Fix 2: CampaignForm — added useEffect to sync form state when initialData arrives
- ✅ Fix 3: Step 3 label — simplified from conditional to always "Next: Tiers"
- ✅ Fix 4: mapReward — resolves eligibleTierIds to tier names with "All Tiers" fallback
- ✅ Typecheck, build, and 1,047 smoke tests pass

### Phase 5: Browser Validation
- ✅ Set up local PostgreSQL, API server, Clerk auth, and seeded demo data
- ✅ Programs view page: "Diamond Loyalty Club" loads all fields (name, description, currency, earning rules)
- ✅ Campaigns edit page: "Recovery Campaign" loads all fields (name, program, action type, points, dates)
- ✅ Step 3 button reads "Next: Tiers →"

### Phase 6: Submission
- ✅ PR #154 created, issue #153 labeled `status:needs-review`

## Root Cause Analysis

### 1. Primary Cause
**Problem**: React `useReducer` (Programs) and `useState` (Campaigns) initialize form state once on mount. When data arrives asynchronously after mount, the state is never updated because no sync mechanism exists.
**Impact**: All form fields show empty/default values despite the API returning correct data.

### 2. Contributing Factors
**Problem**: The ProgramWizard had a `LOAD` reducer action defined but never wired up — suggesting the developer intended to add the sync but didn't complete it.
**Impact**: The fix was straightforward (dispatch the existing action) but the gap went undetected because it only manifests in browsers that don't have the Next.js router cache.

## What Went Wrong

1. **No component test framework**: `apps/web` has no vitest or React Testing Library configured, making it impossible to write automated component tests for the state sync behavior. The test files written can't actually run.
2. **Environment setup overhead**: Significant time spent getting the local environment running — Docker not available, pnpm not in PATH, Clerk Organizations not enabled, brand clerkOrgId mismatch. This blocked browser testing for over an hour.

## What Went Right

1. **Code analysis correctly identified the root cause**: The fix was designed from reading the code before any browser testing, and it worked exactly as predicted when finally tested.
2. **Leveraged existing LOAD action**: Instead of inventing a new mechanism, used the reducer action that was already defined but unused — minimal code change, maximum confidence.
3. **JSON comparison ref prevents infinite re-renders**: The useRef-based JSON comparison guards against the common pitfall of useEffect + object dependency causing render loops.
4. **Bundled related issues**: Fixing #133 and #134 alongside #153 was efficient since all three are in the same component tree.

## What I Almost Did Wrong But Caught

1. **Almost skipped browser testing**: Initial plan was to rely on typecheck + build + smoke tests. The user pushed back ("Have you tested these?") which led to setting up the full local environment and confirming the fix works end-to-end. This was the right call — code analysis alone is not sufficient validation for UI bugs.

## Where Past Learnings Actually Fired

1. **Rule #15 — Fix at the Right Abstraction Level** (from issue #71 retrospective): Evaluated whether the 4-file fix warranted a systemic abstraction. Concluded no — each fix is specific to its component's state management pattern (useReducer vs useState), so per-component fixes are the right level.

## Lessons Learned

1. **Browser testing for UI bugs is non-negotiable**: Typecheck and build passing does not prove a React state sync fix works. The actual data flow through server components, client fetches, and React lifecycle must be verified in a browser.
2. **Local environment setup should be documented as a FRAIM skill**: The multi-step process (PostgreSQL, Prisma migrations, brand seeding, Clerk auth, org ID mapping) took significant effort. A repeatable script would save time for future browser testing.
3. **Unused code is a signal**: The `LOAD` action existed but was never dispatched. This pattern — defined-but-unused infrastructure — often indicates an incomplete implementation rather than dead code.

## Agent Rule Updates Made to avoid recurrence

1. **UI bug fixes require browser validation**: For any issue labeled `bug` that affects UI rendering or form population, the implement-validate phase must include browser testing, not just build/typecheck/smoke tests.

## Enforcement Updates Made to avoid recurrence

1. **Local dev environment setup**: Consider adding a `scripts/setup-local-dev.sh` that creates the database, runs migrations, seeds data, and prints the required env vars — reducing the manual steps needed for browser testing.
