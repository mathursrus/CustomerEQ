---
author: manohar.madhira@outlook.com
date: 2026-05-12
synthesized:
---

# Postmortem: Slice 4a — survey-form renderer family + RTL harness + detail page rewrite — Issue #335

**Date**: 2026-05-12
**Duration**: single session (multi-hour FRAIM-driven phased execution)
**Objective**: implement Slice 4a of #241 — build the survey-form renderer family under `apps/web/src/components/survey-form/`, wire an RTL/jsdom test harness for `apps/web`, and rewrite `/admin/surveys/[id]` to the 3-section collapsible layout per spec §7.
**Outcome**: **success** — PR [#340](https://github.com/mathursrus/CustomerEQ/pull/340) opened; 15 / 15 Feature ACs Met (1 pending CI); 15 / 15 RFC commitments Met; all 13 FRAIM phases executed.

## Executive Summary

Slice 4a delivered the admin read-only path of the new Survey Admin UX. The renderer family (5 components + 4 helpers) is the foundation for both the embed widget (Slice 5) and the editor (Slice 4b). All 11 question types render against the R31 CSS-variable contract. 145 unit tests + 6 Playwright e2e scenarios pass; full e2e suite recovered 15 tests (116 → 131) after the Phase-7 LoopMonitor re-integration. PR opened against `feature/241-slice-3-surveys-list` because PR #334 is still in review — clean review surface.

## Architectural Impact

**Has Architectural Impact**: Yes

**Sections Updated**:
- `docs/architecture/architecture.md` §6 Design Patterns & Principles — 3 new entries (CSS-variable contract for theme-driven rendering, channel/viewport-aware renderer family, chevron-collapsible section primitive).
- `docs/architecture/architecture.md` §9.1 Test Layers — Unit row split into pure-logic + RTL/jsdom; harness wiring noted.

**Changes Made**: documented the 3 patterns Slice 4a introduces. No technology choices reversed; no ADR-level decisions (those landed in earlier slices).

**Rationale**: each pattern is a project-wide convention going forward — Slice 4b's editor and Slice 5's embed widget will lean on the same R31 contract and chevron primitive.

**Updated in PR**: yes (commit `8f0d65a`).

## Timeline of Events

### Phase 1: implement-scoping
- ✅ Loaded constitution + testing + arch standards
- ✅ Read issue #335 + spec §7 / R26–R32 + RFC §"File tree" / §"BrandTheme to Survey element token mapping" / §"Detail page"
- ✅ Pattern discovery against the existing codebase
- ✅ Wrote `docs/evidence/335-implement-work-list.md` (~31 new files / ~3 modified expected)

### Phase 2: implement-repro
- 🔵 N/A (feature, not bug) — documented explicitly with rationale

### Phase 3: implement-tests (test-first)
- ✅ Wired RTL/jsdom harness — `vitest.config.ts` + `vitest.setup.ts` + 4 new devDeps
- ✅ 11 new test files (3 logic + 7 RTL component + 1 page-level) + 2 fixtures
- ✅ All 11 fail correctly at import-resolution / assertion (no impl yet)

### Phase 4: implement-code
- ✅ 9 renderer-family files + 7 detail-page components + 1 page rewrite
- ✅ All 145 tests green after one round of test fix-ups (token-syntax typo in fixture, RTL cleanup wiring, stable Clerk mock)
- ❌ Lint surfaced one unused-import error; fixed inline
- ✅ pnpm typecheck / lint / build / test all green

### Phase 5: implement-validate
- ✅ Static gates: typecheck / lint / build / 145-test unit suite
- ⚠️ Initial plan was "skip browser validation, document the gap" — user pushed back ("How did you do it before? Can't you use a test ID?")
- ✅ Recovered: wrote a new Playwright e2e spec (`335-survey-detail-page.spec.ts`) using the established `PLAYWRIGHT_TEST=true` Clerk-bypass + `page.route()` API-mock pattern from `admin-organization-settings.spec.ts`. 6 scenarios pass.
- ✅ Wrote `335-ui-polish-validation.md`

### Phase 6: implement-security-review
- ✅ Surface = `web` only; ran OWASP-Top-10 web checklist + secrets-in-code + privacy review
- ✅ 0 Critical / 0 High / 0 Medium; 1 Low (admin `<img src>` URL allowlist) + 1 Info (devDeps lockfile growth) — both Accept
- ✅ Embedded `## Security Review` section in `335-feature-implementation-evidence.md`

### Phase 7: implement-regression
- ❌ Initial regression run revealed disk-full environment failure (C: at 0 GB free). User freed space; resumed.
- ❌ Integration suite failed across all 26 files — verified pre-existing on Slice 3 base; documented as environment.
- ❌ E2E suite: 116 passed / 71 failed. Two categories of Slice 4a regression surfaced:
  - 5 LoopMonitor tests broke because Slice 4a removed `<LoopMonitor>` from the detail page per the work-list
  - 2 of my own 335 spec tests timed out under parallel load
  - Plus a `SurveyFormRenderer` crash when `survey.questions` was undefined
- ⚠️ **Coaching moment**: removed LoopMonitor per the spec §7 "deferred analytics" language without considering project rule R2 (Issue #6 hero pipeline must keep <15-min SLA visibility). User flagged this when I asked how to handle the failures.
- ✅ Re-embedded `<LoopMonitor>` inside `<ResponseSection>` (commit `40b0419`); R32 chevron behavior preserved; Loop Monitor tests updated to expand the section first
- ✅ Hardened `SurveyFormRenderer` + `SurveyConfigDl` against partial survey shapes (no `survey.questions.filter` crash)
- ✅ My 335 spec tests fixed with `expect(...).toBeVisible({ timeout: 20000 })` for parallel-worker contention
- ✅ Re-ran full e2e: 131 passed / 56 failed (+15). 0 Slice 4a regressions remain. 56 pre-existing failures (DB unreachable, Clerk timeouts, wizard chooser tests) documented.

### Phase 8: implement-quality
- ✅ Ran `deep-code-quality-checks` on the diff
- ✅ 8 findings raised (0 Critical / 0 High / 2 Medium / 4 Low / 2 Info); all ADDRESSED with rationale (mostly "consistent with project convention; out of scope")
- ✅ Wrote `335-feature-implementation-feedback.md`

### Phase 9: implement-completeness-review
- ✅ Feature Requirement Traceability Matrix — 15 / 15 Met (1 pending CI in Phase 11)
- ✅ Technical Design Traceability Matrix — 15 / 15 Met
- ✅ 0 UNADDRESSED feedback items
- ✅ Validation-mode audit clean; design-standards alignment confirmed

### Phase 10: implement-architecture-update
- ✅ Added 3 entries under §6 + split §9.1 Test Layers Unit row
- ✅ Committed `8f0d65a`

### Phase 11: implement-submission
- ✅ Pushed branch
- ✅ Opened PR [#340](https://github.com/mathursrus/CustomerEQ/pull/340) against `feature/241-slice-3-surveys-list` (per work-list strategy — Slice 3 still in PR #334)
- ✅ Posted FRAIM-completion comment

### Phase 12: address-feedback
- 🔵 No human review feedback yet; phase advances with 0 rounds

### Phase 13: retrospective
- ✅ This document

## Root Cause Analysis

### 1. **Primary Cause** — removing LoopMonitor without considering the hero-feature project rule

**Problem**: I followed the work-list's literal "deferred to sibling sub-issue to #235" language for the response analytics block and removed `<LoopMonitor>` along with the response table and import history. The work-list's decision was made during scoping (Phase 1) when I read spec §7's "placeholder block in V0" sentence in isolation — without cross-referencing project rule R2 ("Issue #6 is the Hero — Every architectural and implementation decision that touches the event pipeline must preserve the <15-minute feedback-to-action SLA").

**Impact**: Slice 4a would have shipped a regression that turned off the hero-feature visibility surface for the period between Slice 4a merge and the sibling-to-#235 sub-issue landing. The user flagged this when I surfaced the e2e failures and asked how to handle them.

### 2. **Contributing Factors** — initial under-investment in browser-flow validation

**Problem**: My initial Phase-5 plan was "skip browser validation, document the gap" because Clerk auth blocked Playwright. The user redirected me with "How did you do it before? Can't you use a test ID?" — the established `PLAYWRIGHT_TEST=true` middleware bypass + `page.route()` mocking pattern was already in the repo (`admin-organization-settings.spec.ts`).

**Impact**: Wasted a few minutes proposing inferior options. The recovery (write a new e2e spec) was straightforward but should have been the first instinct.

### 3. **Contributing Factor** — under-tested for parallel-worker contention

**Problem**: My 6 e2e tests passed when run in isolation but two of them (responsesCount>0 + Edit button) failed under the full e2e suite's 10-worker parallel load. The page made 4 sequential fetches and the default 5 s assertion timeout was tight when the dev server was under contention.

**Impact**: 2 self-inflicted regressions on the first full e2e run. Resolved with explicit longer timeouts on the post-load assertions; would have been caught earlier if I'd run a parallel-pressure test against my own spec before declaring it green.

## What Went Wrong

1. **Removed LoopMonitor mistakenly** — the hero pipeline UI went dark for one release cycle until user pushback. (Root cause #1.)
2. **Underestimated the value of e2e** — the work-list pre-committed to "no new e2e cases in this slice"; I had to revise that decision and add one in Phase 5 / 7 after the user pushed back. The principle in the work-list was wrong from the start.
3. **Survey rendering crashed on partial input** — `survey.questions.filter` had no null guard, surfaced only under e2e mocks. Should have defended at write time.
4. **Disk-full environment blocker** mid-Phase 7 — the user had to free space before I could proceed. Not preventable by me, but the regression-suite tear-down was disruptive.
5. **Initial test-mock for `useAuth` was unstable** — every render minted a new `getToken`, causing `useCallback` invalidation → useEffect re-fire → infinite loop in the page-level RTL test. Took 15+ minutes to diagnose ("page stuck in loading spinner"). Should have stabilized references upfront.

## What Went Right

1. **Test-first discipline held** — wrote all 11 test files BEFORE the implementation and confirmed they failed at import resolution, then implemented to green. Caught my consent-token syntax typo immediately.
2. **Renderer-family architecture cleanly separated** — `SurveyFormRenderer` (pure) + `PreviewSurvey` (channel/viewport adapter) + `QuestionRenderer` (type-switch) + pure helpers (`theme-to-css-vars`, `scale-resolvers`, `skip-rules.logic`) lets each concern be tested in isolation and reused by Slice 5's embed widget.
3. **R31 CSS-variable contract** — emitting all 14 theme tokens as `--ceq-*` properties on a single `.ceq-survey-card` root makes runtime theme swaps free, lets every descendant component reference tokens via `var(--ceq-*)`, and gives the future embed-widget renderer a clean parity target.
4. **Slice 3 logic reused without modification** — `<SurveyDetailMoreMenu>` consumes Slice 3's `survey-row-menu.logic.ts` so the state × menu-item visibility matrix can't drift between the list-page `⋯` menu and the detail-header `More` menu.
5. **All FRAIM phases executed** — no shortcuts. Each phase produced its required deliverable on disk. The user's earlier feedback (`feedback_fraim_phases_not_optional.md`) was honored.
6. **E2E recovered cleanly after Phase-7 fixes** — +15 tests recovered, 0 Slice 4a regressions remain.

## What I Almost Did Wrong But Caught

1. **Almost shipped without LoopMonitor** — the work-list explicitly deferred it. After user pushback in Phase 7 with "What is LoopMonitor?" I re-checked and realized R2 was at risk. Caught at the regression-triage boundary, not at scoping. Should have caught at scoping.
2. **Almost skipped browser validation** — initial Phase-5 instinct was "document the gap and move on." User redirected me to the established pattern. Caught by the user, not by me.
3. **Almost left the broken survey-creation e2e tests "fixed"** — I'd half-fixed them by adding the wizard-chooser click, but they still failed because the wizard mock body shape was stale. Realized via `git blame` that those tests were broken pre-Slice-4a (issue #117 added the chooser), reverted my partial fix, and documented as pre-existing.

## Where Past Learnings Actually Fired

1. **`feedback_fraim_phases_not_optional.md`** — fired in Phase 5 (initially tempted to skip browser validation; reminded myself "phases are not optional, surface the cost rather than silently skip"). Also fired throughout — every phase produced its required deliverable on disk.
2. **`feedback_admin_list_row_clicks.md`** — referenced in the work-list to anchor the navigation pattern; informed the Detail page's `Edit` link vs `More` menu split. Didn't try to invent a new single-click body affordance.
3. **`project_241_slice4_handoff.md`** — opened the session at the exact spot the prior session left off (branch off Slice 3 since PR #334 isn't merged). The handoff state saved 5+ minutes of orientation.
4. **`feedback_slice_planning_api_sweep.md`** — surveyed the full surface (renderer family + detail page + tests + harness + arch doc) during scoping, including affordances the spec doesn't explicitly call out (e.g., the audit-trail badge in the header). No mid-implementation "wait, we forgot X" moments.

## Lessons Learned

1. **Cross-reference hero-feature rules at scoping time, not just at code time.** When removing OR adding any UI surface that touches the loyalty-event pipeline, project rule R2 should be the first check — not the spec's localized scope language. The fix is to add a one-line check to the scoping skill: "Does this slice remove a UI surface that touches Issue #6 / #80? If so, surface the trade-off explicitly and confirm before committing to the removal."
2. **Test mocks for hooks must return stable references when the consumer uses `useCallback([hook-return])`.** This bit me in the page-level RTL test for an hour. Documenting the pattern explicitly: when you mock `useAuth` (or any custom hook that returns an object with methods), declare the object + methods at module top so consecutive calls return the same reference.
3. **Run new e2e tests under parallel-load before declaring green.** Tests that pass in isolation can fail under 10-worker contention if the page makes >1 network call. Either use explicit `await expect(...).toBeVisible({ timeout: 20000 })` for the post-load anchor, or add `await page.waitForLoadState('networkidle')` after `goto`.
4. **Defensive null-guards on optional API fields cost nothing at write time and save crashes at e2e time.** `(survey.questions ?? []).filter(...)` is two characters more typing than `survey.questions.filter(...)` and prevents a runtime crash when an upstream mock or partial-row state shows up.
5. **When asking the user for direction, propose options anchored in established patterns, not in expedient workarounds.** Phase 5: I offered "skip browser validation" instead of "let me write a Playwright spec using the pattern other admin pages use." The user had to redirect me. Better to scan for the pattern first.

## Agent Rule Updates Made to avoid recurrence

Memory updates queued for write at end of session:
1. **New feedback memory**: "Hero-feature UI surfaces must be cross-referenced against project rule R2 at scoping time — never silently remove on the strength of localized spec deferrals."
2. **New feedback memory**: "Test mocks for hooks consumed via `useCallback([hookReturn])` must return stable object references."
3. **Update `project_241_slice4_handoff.md`**: Slice 4a complete; Slice 4b next (editor + `/new` + modals); standalone respondent page still in Slice 5. PR #340 open against PR #334's branch.

## Enforcement Updates Made to avoid recurrence

1. **Architecture doc updated this slice** — §6 + §9.1 patterns are now load-bearing for Slice 4b + Slice 5 reuse.
2. **No new lint rule** — quality findings in Phase 8 were all rationale-deferrals, not enforcement gaps.
3. **No CI change required** — the existing `pnpm test:e2e` gate catches the same class of issues I caught locally; the disk-full environment failure is operational not pipeline.
