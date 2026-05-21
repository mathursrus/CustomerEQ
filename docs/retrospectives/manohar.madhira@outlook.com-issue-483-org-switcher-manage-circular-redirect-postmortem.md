---
author: manohar.madhira@outlook.com
date: 2026-05-20
synthesized:
---

# Postmortem: Org Switcher → Manage Circular Redirect - Issue #483

**Date**: 2026-05-20
**Duration**: ~1 session (file → prep → impl → submit → merge → retro)
**Objective**: Production admins reported they cannot rename their Clerk Organization or invite members. The "Manage" action in the OrganizationSwitcher routes them to our internal `/admin/settings/organization` page, where Organization name is read-only and the helper text sends them back to "Manage" — a circular dead end. Restore the path to rename and invite.
**Outcome**: success (merged as PR #486 → main commit on `feature/483-...` cd7d323; merged 2026-05-21T02:19:16Z by `swavaktp`).

## Executive Summary

A two-prop misconfiguration on `<OrganizationSwitcher />` in the admin layout (`organizationProfileMode="navigation"` + `organizationProfileUrl="/admin/settings/organization"`) hijacked Clerk's Manage dropdown action to our internal Brand-settings page, where rename is read-only. The fix removed both override props so Clerk's default `"modal"` mode renders the hosted Organization Profile (rename + members + invitations) on Manage click. `afterCreateOrganizationUrl` was preserved so the Issue #292 first-run forward-to-Brand-setup behavior stayed intact. The bug originated as a substitution during Issue #292 Slice 4 implementation — RFC #277 §7 specified `organizationProfileMode="redirect"`, which is not a valid value in Clerk 5.7.6, and the impl agent chose `"navigation"` instead of the closer-to-intent default `"modal"`.

## Quick RCA Card

**What failed**: A Clerk SDK prop substitution made during a prior issue's implementation (RFC literal didn't exist; impl picked a different value with worse UX consequences) was never re-validated against the user-facing acceptance criteria of either issue, so it shipped to production and removed the only UI path to rename the org / invite members.

**Impact**: Every production admin lost the ability to rename their organization or invite teammates after onboarding. The bug was discovered via customer report; no automated test or RFC traceability matrix caught it because RFC #277's text said "Manage deep-links to settings page" *and* "the Clerk-hosted org-profile UI for renames is the rename surface — accessed via Clerk's own UI affordances inside the switcher dropdown" — but Clerk 5.x has no second affordance once `organizationProfileMode` is set to `"navigation"`. Both halves of the RFC sentence were treated as compatible; they weren't.

**What should have happened**: When the impl agent for #292 Slice 4 encountered the unrealizable `organizationProfileMode="redirect"` value, the substitution should have been validated against the *user behavior* RFC §7a was actually trying to describe ("Manage opens Clerk's hosted rename UI"), not just the prop-naming intent. The closest realization in Clerk 5.x is the default `"modal"` — i.e., **not** setting the prop at all.

**What changes next time**: When an RFC names a primitive value (string, mode, enum) that turns out not to exist in the current dependency version, treat that as a design conflict that must be **escalated**, not silently substituted. The agent should either pick the realization that matches the RFC's stated end-state UX, or flag a question back to the design-doc owner. A literal-vs-intent mismatch in an SDK version is a structural change that needs documentation, not a quiet swap.

**Example**: RFC #277 §7 line 385–386 wrote `organizationProfileMode="redirect"` + `organizationProfileUrl="/admin/settings/organization"`. Clerk 5.7.6 has no `"redirect"` value (only `"navigation"` and the default `"modal"`). The PR #313 impl agent substituted `"navigation"`, which routes Manage to an internal URL *and removes Clerk's hosted Organization Profile from the UI entirely*. The RFC §7a description ("Clerk's own UI affordances inside the switcher dropdown" as the rename surface) was incompatible with that substitution, but the contradiction was never surfaced.

## Architectural Impact

**Has Architectural Impact**: No

The fix is a two-prop removal on a third-party React component (`<OrganizationSwitcher />`). The `IdentityProvider` boundary documented in `docs/architecture/architecture.md` §4.2 / ADR 0004 is unchanged — no new `@clerk/*` imports in route handlers, no new tenant-scope logic, no schema change. The change actually reverts a non-default override back to Clerk's default behavior, which is the canonical posture described in RFC #277 §7a.

## Timeline of Events

### Phase 0: Issue triage and filing
- [done] **Action**: User described the customer-reported symptom (Manage routes to Settings > Organization, which is circular).
- [done] **Action**: Codebase exploration identified the two-prop misconfiguration in `apps/web/src/app/(admin)/layout.tsx:57–69` and the RFC #277 §7a context behind it.
- [done] **Action**: Filed Issue #483 with reproduction, root cause, proposed fix, and acceptance criteria.

### Phase 1: issue-preparation (FRAIM)
- [done] **Action**: Ran `~/.fraim/scripts/prep-issue.sh 483` from main worktree. Script created isolated worktree at `C:\Github\mathursrus\CustomerEQ - Issue 483`, branch `feature/483-...`, pushed branch, copied .env files, ran `pnpm install` and `pnpm build`.

### Phase 2: implement-scoping
- [done] **Action**: Wrote `docs/evidence/483-implement-work-list.md` with single-file fix scope, validation requirements (uiValidationRequired = true; mobileValidationRequired = false), and AC mapping.

### Phase 3: implement-repro
- [done] **Action**: Wrote a failing-first Vitest+RTL test at `apps/web/src/app/(admin)/layout.test.tsx` that mocks `@clerk/nextjs.OrganizationSwitcher` to capture the props, asserts the hijack is gone, and asserts the Issue #292 contract (`afterCreateOrganizationUrl`) is preserved. Test failed on the right assertion: `expected 'navigation' not to be 'navigation'`.

### Phase 4: implement-code
- [done] **Action**: Removed `organizationProfileMode="navigation"` and `organizationProfileUrl="/admin/settings/organization"` from the OrganizationSwitcher in `layout.tsx`. Added a 5-line WHY comment (trimmed from 8 during Phase 8) explaining why these props are intentionally absent.

### Phase 5: implement-validate
- [done] **Action**: `pnpm --filter @customerEQ/web typecheck/lint/build` — green. Targeted vitest 2/2 pass. Documented manual reviewer steps for the Clerk-modal-side ACs that cannot be automated.

### Phase 6: implement-security-review
- [done] **Action**: Diff-scoped review against OWASP Top 10 (web), secrets-in-code, privacy/PII. 0 findings. Embedded in evidence doc.

### Phase 7: implement-regression
- [done] **Action**: `pnpm test:smoke` EXIT=0 across all 12 smoke suites. Full apps/web vitest had 2 pre-existing surveys-page timeouts unrelated to this branch (clean diff to main on those files, clean pass with --testTimeout=30000 in isolation) — explicitly noted as out-of-scope per project Rule 21.

### Phase 8: implement-quality
- [done] **Action**: Quality scan — 0 unaddressed findings. One in-phase fix: trimmed the explanatory comment in layout.tsx from 8 lines to 5 (re-ran test green).

### Phase 9: implement-completeness-review
- [done] **Action**: Wrote two traceability matrices — Feature Requirements (6 rows, all Met) and Technical Design (7 rows, all Met). One row flagged as "intentional tradeoff": RFC's `organizationProfileMode="redirect"` reverted to Clerk's default `"modal"` because the RFC literal doesn't exist in Clerk 5.7.6.

### Phase 10: implement-architecture-update
- [done] **Action**: No architecture-doc updates required. Confirmed inline.

### Phase 11: implement-submission
- [done] **Action**: Committed `cd7d323`, pushed, opened PR #486 with manual test plan in the body.

### Phase 12: address-feedback
- [done] **Action**: Held at the hold-point per Rule 25a (do not auto-complete) and project memory `feedback_fraim_phase11_stay_on_pr`. User brought up local test env via this agent (`pnpm dev` for web + api, worker exited cleanly in inline mode), tested manually, then merged PR #486 externally (by `swavaktp` at 2026-05-21T02:19:16Z). 0 review comments — merge is the approval signal.

### Phase 13: retrospective
- [done] **Action**: This document.

## Root Cause Analysis

### 1. **Primary Cause**

**Problem**: During Issue #292 Slice 4 implementation (PR #313, commit `90d2068`, 2026-05-10), the impl agent substituted `organizationProfileMode="navigation"` for the RFC-specified `"redirect"` because `"redirect"` doesn't exist in Clerk 5.7.6's `<OrganizationSwitcher />` API. The substitution looked like a syntactically-equivalent prop-name change, but the *semantic* outcome — completely suppressing Clerk's hosted Organization Profile UI from the admin app — silently removed the rename + invite-members affordance.

**What drove it**: An RFC-vs-SDK literal mismatch was treated as a substitution problem rather than a design-conflict problem. The agent picked the closest-spelled valid value (`"navigation"` is one of two valid values; the other is the default `"modal"`) and added the `organizationProfileUrl` to keep the prop pair "consistent". This was reasonable surface-level reasoning — the RFC literally said *"Manage deep-links to /admin/settings/organization"* in §7a line 423 — but it ignored the same paragraph's later half: *"the Clerk-hosted org-profile UI for renames is the rename surface — accessed via Clerk's own UI affordances inside the switcher dropdown."* Clerk 5.x exposes no second affordance once `organizationProfileMode="navigation"` is set, so the second half of the RFC sentence became unrealizable.

**Corpus conflict**: None. No L1 or L2 learning entry endorsed silent SDK-literal substitution. The miss was upstream of the corpus — at the spec-vs-implementation reconciliation layer, where Rule 25c ("Spec / RFC / work-list 'deferred' or 'remove' instructions require project-rule cross-reference before commit") almost applies but doesn't: 25c is scoped to "deferred / remove" instructions; this was a "change literal value because SDK doesn't accept it" instruction. The rule needs a sibling for **SDK-literal substitution discipline**, which is captured below under Agent Rule Updates.

**Impact**: Production admins onboarded between 2026-05-10 (merge of #292 Slice 4) and 2026-05-21 (merge of #486) had no UI path to rename their organization or invite teammates. The bug surface was discovered by customer report on or before 2026-05-20.

### 2. **Contributing Factors**

**Problem**: The Issue #292 Slice 4 traceability matrix did not catch the literal-vs-intent gap, because both halves of RFC §7a were marked Met against the same impl change.

**What drove it**: The implementation-vs-design-review skill checks each commitment against an implemented file/function and a passing test/curl proof. A test that asserts *the prop is set* trivially passes; a test that asserts *the user-facing rename UX still works* requires either a real-Clerk E2E (not currently in CI per project Rule 18 limitations) or a unit-level check that the OrganizationProfile-affordance prop pair is NOT in "hijack" configuration. The latter is exactly the test added in this issue (`layout.test.tsx`). The lesson: when a third-party SDK prop has both a "happy default" and an "override that suppresses a UI surface," the override should be pinned by a test, not just commented.

**Corpus conflict**: None. This is a structural gap.

**Impact**: A 10-day-plus production bug window between when the regression shipped (#292 Slice 4, 2026-05-10) and when this fix shipped (#486, 2026-05-21).

## What Went Wrong

1. **Literal RFC value substituted without reconciling to RFC's stated end-state UX**: PR #313 picked `"navigation"` for a value the SDK didn't accept, instead of returning to RFC §7a's stated intent ("Clerk's hosted org-profile UI is the rename surface") and recognizing that intent is realized by Clerk's *default* `"modal"` mode — i.e., not setting the prop at all.
2. **Traceability matrix for #292 Slice 4 marked the RFC §7a row Met against a test that only proved the prop was present**, not that the user-facing rename/invite UX still worked.

## What Went Right

1. **Failing-first repro discipline (FRAIM Phase 2) worked exactly as designed**: the test was written *before* the fix, and the failing assertion was `expected 'navigation' not to be 'navigation'` — i.e., it failed because the bug existed, not because the test was wrong. The test continued to be load-bearing as a regression pin after the fix landed.
2. **Issue body documented the user's hypothesis correctly and the codebase exploration confirmed it on the first pass**: no detour through wrong root causes. The hypothesis "the redirect was wired to fire on Manage clicks too, not just at end of New Organization" matched the actual prop pair exactly.
3. **Surface-area discipline held**: a 2-prop bug fix landed in one PR, one branch, one issue, one worktree, with two phase-aligned commits' worth of evidence in a single commit (`cd7d323`) plus a retrospective commit (this one) — per Rule 26.
4. **Validation honesty held under Rule 18**: the PR explicitly enumerated what could not be automated (Clerk's hosted modal cannot be inspected under `PLAYWRIGHT_TEST=true`) and what the human reviewer needed to manually verify, rather than overstating coverage.
5. **The user-driven `pnpm dev` verification flow worked**: when the user asked to test locally, the agent stood up web + api dev servers in the issue worktree, the user verified manually, and the PR merged with no review comments.

## What I Almost Did Wrong But Caught

1. **Near-miss 1**: When 2 surveys tests in the full apps/web vitest run timed out under contention, I almost treated them as in-scope regressions. The signal that caught it was the work-list / Rule 21 discipline — *check the diff against `origin/main` for those files first.* `git diff` was empty for the surveys files; the timeouts happened on `main` too. The right call was to flag them as pre-existing flakes (and note them in Phase 7 evidence), not to bundle a fix into this branch. This matched memory `feedback_fraim_phase11_stay_on_pr` (don't split unrelated work) and Rule 21 (one issue per branch).
2. **Near-miss 2**: In the initial Phase 4 commit I wrote an 8-line block comment citing both Issue #483 *and* the Issue #292 contract *and* recapping the bug history. CLAUDE.md says "Default to writing no comments. Only add one when the WHY is non-obvious." Trimmed to 5 lines during Phase 8 quality scan — the WHY of "why are two natural-looking props missing" is genuinely non-obvious to a future reader, but the bug history belongs in the commit message and PR, not the source file.

## Where Past Learnings Actually Fired

1. **Pattern**: `feedback_validate_phase_must_run_build` — "FRAIM implement-validate needs `pnpm build` (or at least the web-app lint pass), not just typecheck; lint-as-error only fires inside `next build`." Fired in Phase 5: I ran the full `pnpm --filter @customerEQ/web build` (which runs `next build` → lint-as-error gate), not just `pnpm typecheck`. The build trace confirmed the change emits at unchanged route sizes (43/43 static pages, `/admin/settings/organization` at 21.9 kB). Without this entry I would likely have stopped at `typecheck + lint` and missed the build-time lint-as-error pass.
2. **Pattern**: `feedback_fraim_phase11_stay_on_pr` — "during Phase 11 manual verification, fix reported defects on the same PR/branch; don't split into follow-up PRs unless unrelated." Fired throughout: when the agent considered bundling the surveys-test-timeout fixes onto this branch, the entry plus Rule 21 made the decision easy ("unrelated → don't bundle"). Also fired against the retrospective itself: this retro lands as a follow-up commit on the *same* `feature/483-...` branch (per Rule 26), not as a chore-issue.
3. **Pattern**: `feedback_merit_over_ease` — "never optimize for development time, diff size, or 'drop-in swap' framing; recommend long-term-best on merit first." Fired when I considered whether to change `organizationProfileMode="navigation"` to `"modal"` *explicitly* (a 1-line edit) vs. removing the prop entirely (a 0-line residual). The merit answer is to remove the prop and let Clerk's default apply — it documents the right thing (no override needed) rather than a defensive setting that looks like it could be re-overridden later. Chose the merit answer; commit + comment reflect that.

## Lessons Learned

1. **SDK-literal substitution discipline**: When an RFC names a primitive value (string, mode, enum) that turns out not to exist in the current dependency version, the implementation agent must reconcile the substitution against the RFC's *stated end-state UX*, not just the prop-name spelling. If reconciliation isn't possible without surfacing a question to the design-doc owner, flag the conflict; don't silently pick the spelling-closest valid value.
2. **Third-party-SDK prop-override regression-pinning**: For props on third-party React/SDK components that have a "happy default" and an "override that suppresses a UI surface," write a unit-level test that captures the props at mount and asserts the *suppression configuration is NOT in effect*. The test in this PR (`apps/web/src/app/(admin)/layout.test.tsx`) is the template: 22 lines, mocks the SDK component to record props, asserts both the bug-shape (no hijack) and the contract (the post-create forward stays).
3. **Traceability matrices need *behavioral* proof rows, not *presence* proof rows, for SDK integration commitments**: a row marked "Met" against "the prop is set to the expected value" is a tautology if the prop's *effect* is the actual commitment. For Clerk and similar UI SDKs, the proof column should cite a test that exercises the user-visible behavior (or a documented manual reviewer step under Rule 18 if the behavior is inside the SDK's own UI).
4. **The dev-env startup pattern in this repo works well from an agent**: `docker compose` for Postgres + Redis + `pnpm --filter <app> dev` per-app in background tasks + `until grep -qE "Ready in" <log>` poller is reliable. Worker exited cleanly in `QUEUE_MODE=inline` (the dev default) — this is correct behavior, not a failure mode.

## Agent Rule Updates Made to avoid recurrence

1. **Proposed: a new sibling to Rule 25c — "RFC/Spec literal-value substitution discipline"**: when an implementation finds that an RFC names a primitive value (string / mode / enum / version) the current dependency version doesn't accept, the implementation agent must (a) identify what user-visible behavior the RFC value was intended to produce, (b) name the realization that matches that behavior in the current SDK version, and (c) if (b) isn't possible without ambiguity, file the conflict back to the RFC owner via a PR-blocking comment on the original design doc. The agent must not silently pick the spelling-closest valid value. This is a strict sibling of Rule 25c (which covers "deferred / remove" instructions); the new rule covers "substitute because value doesn't exist."
2. **Proposed: a strengthened mandate in `implementation-vs-design-review` skill**: when a commitment touches a third-party SDK prop with a known "happy default" and "override that suppresses UI," the matrix's Proof column must cite a *behavioral* test (or documented Rule-18 manual reviewer step), not a *presence* test. A regex like `expect(props.organizationProfileMode).toBe('modal')` is not behavioral; `expect(props.organizationProfileMode).not.toBe('navigation')` paired with the contract assertion is.

## Enforcement Updates Made to avoid recurrence

1. **Regression pin already shipped in this PR**: `apps/web/src/app/(admin)/layout.test.tsx` will fail any future re-introduction of `organizationProfileMode="navigation"` or `organizationProfileUrl="/admin/settings/organization"` on the admin OrganizationSwitcher. The pin runs as part of `pnpm --filter @customerEQ/web test` and (in smoke form) under `pnpm test:smoke`'s web-unit step. No follow-up enforcement code needed for this specific surface.
2. **Open follow-up (not in scope of #483)**: the surveys-pages vitest timeout under full-suite contention (`apps/web/src/app/(admin)/admin/surveys/[id]/page.test.tsx` + `…/edit/page.test.tsx`) is a pre-existing infrastructure flake. Pass with `--testTimeout=30000` isolation, fail with default 5s under contention. Not from this issue; should be its own issue filed by whoever next encounters it as a CI flake (per Rule 21).
