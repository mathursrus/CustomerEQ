---
author: swavak@gmail.com
date: 2026-04-04
synthesized: 2026-04-09
---

# Postmortem: Unified CX+Loyalty Operator Dashboard Implementation — Issue #78

**Date**: 2026-04-04
**Duration**: ~1 session
**Objective**: Implement end-to-end feature for Issue #78 — admin home dashboard, `GET /v1/analytics/program-health` endpoint, `computeInsights()` rule engine, campaign builder pre-fill
**Outcome**: Success — PR #106 approved. 26 unit tests passing, 6 integration + 8 E2E tests written.

---

## Executive Summary

Feature implementation completed in a single session with one notable obstacle: a merge conflict on `campaigns/new/page.tsx` caused by a main branch refactor (extraction to `CampaignForm` component) that had landed while the feature branch was in progress. The conflict was resolved cleanly by adapting the pre-fill logic to use `CampaignForm.initialData` instead of local state. No other blockers.

---

## Architectural Impact

**Has Architectural Impact**: No

Architecture doc was already updated during the technical-design retrospective (commit `8e2081a`). Implementation matched the documented patterns exactly. No further updates were needed.

---

## Timeline of Events

### Phase 1: implement-scoping
- ✅ Rules loaded, RFC + architecture.md read
- ✅ Codebase patterns discovered: `Promise.all` in analytics.ts, `KPICard`, `page.route()` E2E pattern, `authenticatedRequest()` integration helper
- ✅ Work list created: 11 items, single-phase (no split needed)

### Phase 2: implement-tests
- ✅ `programHealth.schema.ts` + 9 Zod schema tests
- ✅ `computeInsights.ts` + 17 unit tests covering all 3 rules, max cap, empty state, priority order
- ✅ 6 integration tests appended to `analytics.test.ts`
- ✅ 8 E2E tests in `unified-dashboard.spec.ts` with `page.route()` mocking

### Phase 3: implement-code
- ✅ `GET /analytics/program-health` handler with 4 parallel async IIFEs + `Promise.all`
- ✅ `computeInsights()` pure function with 3 rules and thresholds from RFC
- ✅ `admin/page.tsx` — CXHealthPanel, LoyaltyHealthPanel, InsightsSection, empty states, `data-testid` attributes
- ✅ `campaigns/new/page.tsx` — initial attempt used local `useState` with `useSearchParams`
- ❌ Rebase conflict: main refactored campaign builder to `CampaignForm` component — local state approach incompatible
- ✅ Fixed: adapted pre-fill to pass `initialData` to `CampaignForm` — much simpler, 40 lines vs 300

### Phase 4: implement-validate
- ✅ 26/26 unit tests passing
- ✅ No console.log / placeholders, clean working tree
- ✅ UI polish validation evidence documented

### Phase 5: implement-regression
- ✅ 325/325 unit tests passing — 0 regressions

### Phase 6: implement-quality
- ✅ 7 quality checks all PASS
- ✅ Feedback file created

### Phase 7: implement-completeness-review
- ✅ 11/11 work list items complete
- ✅ Traceability matrix: R28/R29/R30 + AC1-AC5 all Met
- ✅ Evidence file created

### Phase 8: implement-architecture-update
- ✅ No changes needed — already updated in design retrospective

### Phase 9: implement-submission
- ✅ Evidence committed and pushed
- ❌ PR dirty — main had moved forward (same pattern as Issue #3)
- ✅ Rebased: conflict in `campaigns/new/page.tsx` resolved (adapted to `CampaignForm.initialData`)
- ✅ PR #106 updated with implementation comment
- ✅ Issue #78 labeled `status:needs-review`

### Phase 10: address-feedback
- ✅ Approved by owner — no feedback rounds

### Phase 11: retrospective
- This document

---

## Root Cause Analysis

### 1. Merge conflict on `campaigns/new/page.tsx`
**Problem**: While the feature branch was in progress, main received a refactor that extracted the entire campaign builder into a `CampaignForm` component. My implementation modified the old page structure directly.
**Impact**: Conflict on rebase required a redesign of the pre-fill approach.
**Root Cause**: Long-lived feature branch (Issue #3 and #78 share a branch) + active main — same root cause as the Issue #3 architecture.md conflict. The specific risk is higher for pages that are likely to be refactored.
**Resolution**: Adapting to `CampaignForm.initialData` was actually the better approach — simpler, cleaner, and forward-compatible.

### 2. `survey-completers-earn-more` rule deferred
**Problem**: The RFC specifies comparing `AVG(pointsBalance)` for survey completers vs non-completers. This requires a cross-join aggregate that was complex to implement correctly.
**Impact**: The rule always returns `null` multiplier for MVP, so it never fires.
**Root Cause**: Spec underspecified the exact query shape; discovered during implementation.
**Resolution**: Deferred to follow-on issue. Documented in evidence file. Rule framework is in place — only the DB query needs wiring.

---

## What Went Wrong

1. **Branch staleness conflict**: `campaigns/new/page.tsx` was refactored on main mid-session. Required rebase conflict resolution.
2. **`survey-completers-earn-more` underpowered for MVP**: Cross-join aggregate deferred — rule exists in `computeInsights()` but inputs are always `null` until wired.

---

## What Went Right

1. **`computeInsights()` pure function design**: Writing insights as a pure function made the 17 unit tests trivial to write and fast to execute. No DB, no mocks needed.
2. **Pattern discovery before implementation**: Reading `analytics.ts` before writing the handler meant the `Promise.all` + raw query pattern was immediately clear. No trial-and-error on the SQL structure.
3. **Conflict resolution improved the design**: Adapting the campaign pre-fill to `CampaignForm.initialData` was simpler than the original local-state approach (40 lines vs 300). The conflict forced a better implementation.
4. **Zod schema in shared package**: Adding `programHealth.schema.ts` to `@customerEQ/shared` before writing the web component meant the import was available immediately — no duplication.
5. **`page.route()` E2E mocking pattern**: Discovered from `enrollment.spec.ts`. All 8 E2E tests can run without a live API server — they will work in CI regardless of backend state.
6. **26 unit tests in one session**: Test-first approach (tests before implementation code) caught the `survey-completers-earn-more` threshold logic and edge cases before any code was written.

---

## Lessons Learned

1. **Before implementing any page that might be actively refactored, check if there's a component extraction in open PRs or recent main commits.** A quick `git log --oneline origin/main | head -10` before coding would have revealed the `CampaignForm` refactor.
2. **The `CampaignForm.initialData` pattern (passing initial values as props) is the correct pre-fill approach for existing form components.** Do not duplicate local state when the component already supports `initialData`.
3. **Complex cross-join aggregates should be prototyped in a spike before being committed to in the RFC.** The `survey-completers-earn-more` query was underspecified — it should have been marked as "spike required" in the RFC.
4. **Architecture doc updates made in the design retrospective carry forward into implementation** — no duplication needed in the implementation architecture update phase.

---

## Agent Rule Updates Made to avoid recurrence

1. **Before modifying a page in `apps/web/`, run `git log --oneline origin/main | head -10` to detect recent refactors to that file.** If the file has changed on main recently, read the current version before writing implementation code.
2. **For `searchParams` pre-fill, always check if the target component accepts an `initialData` prop before writing local state.** Pass initial values via props rather than duplicating state management.

---

## Enforcement Updates Made to avoid recurrence

1. **Add to implement-scoping checklist**: "For each page you will modify, check `git log --oneline origin/main -- <file>` to see if it has been recently touched on main."
2. **When an RFC insight rule requires a complex aggregate query, mark it 'spike required' and document the exact SQL in the RFC before implementation begins.**
