---
author: manohar.madhira@outlook.com
date: 2026-04-26
synthesized: 2026-04-27
---

# Postmortem: Onboarding & First-Run Experience — feature spec — Issue #170

**Date**: 2026-04-25 → 2026-04-26
**Duration**: ~2 working sessions across 2 calendar days. Phase 1 → Phase 5 took roughly half a session; two rounds of reviewer feedback + a mock-sync follow-up + merge took the other ~1.5 sessions.
**Objective**: Produce the FRAIM `feature-specification` artifact for the Onboarding & First-Run Experience epic — the shared spine that the three archetype sub-issues (#171 API/SDK, #172 static-site, #173 multi-app) plug into.
**Outcome**: Success. PR #187 merged to `main` 2026-04-26 18:25 UTC after 2 review rounds (14 + 5 comments) and a small mock-sync follow-up. Issue #170 remains open by design — the spec is the artifact; implementation continues as a separate phase. Two new follow-up issues filed during review (#189 team-management, #190 brand-settings).

## Executive Summary

A clean run through the 7-phase FRAIM `feature-specification` job. The spec covers the shared spine only — sign-up auto-provisioning, use-case picker, 5-step first-run checklist, install-verification shell, and TTFV instrumentation — and explicitly defers archetype-specific connect flows to the three sub-issues. Two reviewer rounds drove substantive scope additions: Round 1 added a CustomerEQ-owned signup page (Step 0), an org-profile capture step (Step 1.5), an IdentityProvider abstraction (OD-5), and reversed OD-4 from `AuditEvent` piggyback to a dedicated `OnboardingActivationEvent` model. Round 2 added social OAuth support to Step 0, tied themes to the existing CRUD entity, filed two follow-up issues (#189 team-management and #190 brand-settings), and replaced a hand-wavy theme-preview claim with a concrete spec + mock panel. A 4th commit landed three mock-vs-spec sync gaps caught only when the reviewer asked "is the mock in sync completely?" — an avoidable miss documented in detail below.

The session benefited materially from learning memories saved at the end of the prior #179 retrospective: the FRAIM-first / issue-first / push-PR-default / pricing-forward-compat memories all fired correctly and shaped behavior without re-derivation.

## Architectural Impact

**Has Architectural Impact**: Yes — the spec defines five open architectural decisions (OD-1 to OD-5) that the RFC phase will pin:

| OD | Decision | Spec recommendation |
| :-- | :--- | :--- |
| OD-1 | Clerk → Brand auto-provisioning: webhook vs middleware | Both — webhook primary, middleware fallback |
| OD-2 | Multi-app data model: new `Application` vs extend `ExternalSignalSource` | Extend `ExternalSignalSource.sourceType` with `APPLICATION` |
| OD-3 | `OnboardingState` persistence: new model vs `Brand` fields | New 1:1 model |
| OD-4 | Activation funnel: `AuditEvent` piggyback vs dedicated model | **Dedicated `OnboardingActivationEvent` model** (reversed in Round 1) |
| OD-5 | IdentityProvider abstraction (NEW from Round 1; extended in Round 2) | Define an 8-method (later 12-method) interface; `ClerkIdentityProvider` is the only implementation |

**Updated in PR**: No code changes; spec only. The decisions land in code via the RFC and implementation phases.

## Timeline of Events

### Phase 1: context-gathering
- ✅ Read issue #170 + sub-issues #171/#172/#173 + hero-workflow #6 + business-validation report + replication analysis + relevant code via the Explore agent.
- ✅ FRAIM session connected first thing (per saved memory) before any spec writing.
- ⚠️ FRAIM mentor reported `designSystem` and `compliance` as "not configured" despite both landing on `main` via #183. Treated as server-side cache and proceeded with local truth.

### Phase 2: spec-drafting
- ✅ Fetched `templates/specs/FEATURESPEC-TEMPLATE.md` and authored the spec to match the repo pattern from `41-closed-loop-alerting.md`.
- ✅ Created a single HTML/CSS mock file with three anchor-linked scenes (use-case picker, checklist, activated state).
- ✅ Browser-validated at 1440×900 in Playwright; 1 console error (favicon 404 — harmless).
- ✅ Captured the 2026-04-24 paywall constraint as a "Forward-compatibility: pricing / subscription tiering" section per the `project_pricing_not_finalized.md` memory.

### Phase 3: competitor-analysis
- ✅ Analyzed Annex Cloud, Qualtrics, Yotpo/Smile.io, and the "do-nothing fragmented stack" alternative using only `docs/replicate/` and `docs/business-development/` sources.
- ✅ Honestly flagged Yotpo/Smile.io as "disk evidence thin" (no live web research performed); proposed a follow-up.
- ✅ Drafted a `fraim/config.json` competitors-block addition; deferred to Phase 4 for batched user approval.

### Phase 4: spec-completeness-review
- ✅ Built a 12-row traceability matrix mapping every #170 AC + scope item + sub-issue contract + the 2026-04-24 user constraint to specific spec sections.
- ⚠️ **Caught a real gap**: the initial Step 5 checklist used 5 rows that didn't match #170's named milestones verbatim. Rewrote to match (`brand created → data source connected → first event received → first survey live → first action triggered`); demoted "Choose how you use CustomerEQ" to a step-2 precondition; re-validated the updated mock.

### Phase 5: spec-submission
- ✅ Wrote evidence doc, committed (1 commit, 949 insertions), pushed, opened PR #187 with the open-decisions table front-and-center.
- ✅ Added evidence-link comment + `status:needs-review` label.

### Phase 6: address-feedback — Round 1 (14 comments)
- ✅ Read all 14 inline review threads + the review summary.
- ✅ Captured every comment in `docs/evidence/170-spec-feedback.md` with theme grouping (A through G).
- ✅ Pre-execution-confirmed two scope questions with the user (plan-selection slot, OD-4 reversal) before doing the rewrite.
- ✅ Executed the seven-theme rewrite in a single batch: Step 0 + Step 1.5 added; OD-5 added; OD-4 reversed; Step 2 reframed; Step 5 row-5 precondition; path-specific dashboard sub-section; expanded edge cases.
- ✅ Updated mocks (2 new scenes + 1 reframed + 1 sub-state update) and re-validated in Playwright.
- ✅ Posted 14 inline replies + 1 top-level summary comment.
- ⚠️ FRAIM session expired during the long async reply batch; reconnected and continued.

### Phase 6: address-feedback — Round 2 (5 comments)
- ✅ Triaged the 5 new comments into 5 themes; pre-confirmed the OAuth-providers approach + issue titles with the user.
- ✅ Filed #189 (team-management) and #190 (brand-settings) before referencing them in the spec.
- ✅ Edited spec for OAuth (Step 0), theme continuity (Step 1.5), and concrete theme preview spec; added preview panel to Mock Scene 2.
- ❌ **Forgot to update Mock Scene 1 with the OAuth provider buttons** even though the spec text added them. Caught only when the reviewer asked "for Step 0 should I be seeing something different in the mock?"
- ✅ Reactively fixed the OAuth row in Scene 1 + confirmed via screenshot.
- ❌ Reviewer then asked "Is mock in sync completely with the spec now?" — a fresh audit found two more gaps: missing "Custom (set later)" 5th theme swatch, and Scene 4 dashboard CTAs showing the generic-archetype copy instead of the api-archetype copy that row 2 implied.
- ✅ Fixed both, re-validated, committed `6858ce5`. PR approved + merged.

### Phase 7: retrospective
- ✅ This document.

## Root Cause Analysis

### 1. Mock-vs-spec sync was treated as one-shot, not continuous

**Problem**: When Round 2 added the social OAuth sub-section to the spec text, I did not enumerate the mocks impacted by that section. The mock change was forgotten until the reviewer asked. Same root cause produced the "Custom (set later)" missing swatch and the Scene 4 archetype mismatch — when I changed spec text I didn't sweep the mock for downstream consequences.

**Impact**: One extra commit per gap (3 total), one extra reviewer round-trip per question. ~15 minutes of avoidable churn. More importantly, the reviewer had to spend their own time spotting mismatches that should not have shipped.

**Category**: Skill — missing a "what mocks does this change touch?" checkpoint when editing a spec section that has corresponding visual content.

### 2. Phase 4 completeness review didn't include a mock-vs-spec audit

**Problem**: The completeness-review phase produced a thorough requirement-traceability matrix but the audit was unidirectional: it checked spec coverage against #170's source requirements, not mock coverage against the spec itself. The checklist-milestone gap was caught because it was a spec-vs-source mismatch, but the mock-vs-spec gaps slipped past because they were a different axis.

**Impact**: Multiple sync gaps shipped to PR review and were caught only by the human reviewer (Round 2 + the post-Round-2 sweep).

**Category**: Process — the completeness-review phase needs to include a "for each visual element in the spec, does the corresponding mock element exist and match?" pass.

## What Went Wrong

1. **Mock-vs-spec sync failures (×3)**: as detailed in RCA #1. OAuth providers, "Custom (set later)" theme, Scene 4 archetype CTAs — all caught reactively, not proactively.
2. **Initial checklist milestones diverged from #170 verbatim**: caught in Phase 4 (so this was a "process working" moment), but the gap existed in the first draft because I treated #170's milestone list as descriptive rather than prescriptive.

## What Went Right

1. **FRAIM-first execution**: started with `fraim_connect`, read `project_rules.md`, called `get_fraim_job` for `feature-specification` before any drafting. The `feedback_fraim_before_plan_mode.md` memory fired correctly and shaped the entire session.
2. **Issue-first branching**: filed #189 and #190 *before* referencing them in the spec edits. The `feedback_issue_before_branch.md` memory fired without re-derivation. No retroactive issue-mapping like the #178/#179 mess.
3. **Push + PR was the standard flow**: the `feedback_push_pr_always_merge_with_review.md` memory prevented the previous over-gating pattern; pushed/PR'd each round without asking.
4. **Pricing forward-compat baked in from day one**: the `project_pricing_not_finalized.md` memory shaped Step 0's plan-selection slot, the multi-app count cap, OD-4's orthogonality note, and the "no SKUs invented" guardrail throughout. Reviewer never had to flag a pricing-coupling concern because there wasn't one.
5. **Open decisions framed with recommended defaults**: every OD landed in one round. OD-1, OD-2, OD-3 came back as "Agreed" / "Agree with the recommendation"; OD-4 was reversed cleanly with a one-line rationale; OD-5 was added in Round 1 in response to the Clerk-decoupling theme.
6. **Phase 4 completeness review caught the checklist-milestone gap**: the matrix process worked exactly as intended on the spec-vs-source axis. The fix landed before the reviewer ever saw the broken version.
7. **Pre-execution confirmation on big rewrites**: before the Round 1 multi-section rewrite (and again before Round 2's), I asked two pre-execution questions and waited. Both rounds got cleaner answers and faster execution because of it.
8. **Browser validation at every mock change**: every mock edit got a Playwright screenshot before commit. Caught zero functional bugs but is also why the layout/contrast quality was high.
9. **Concrete inline replies on every thread**: each of the 19 review comments got an inline reply pointing at the specific section + commit where the change landed. No generic "Done" responses.
10. **Honest "is the mock in sync?" answer**: when the reviewer asked, I did a real audit and surfaced the gaps explicitly rather than answering "yes, fully synced" as a reflex.

## What I Almost Did Wrong But Caught

1. **Almost edited inside the FRAIM_AGENT_ADAPTER markers** (this was actually #179's session, not #170 — but the same instinct surfaced again here when editing AGENTS-side files). Caught by recognizing the `<!-- ... START -->` / `<!-- ... END -->` convention as auto-managed.
2. **Almost over-scoped on "add all the later items now"**: in Round 1, after a "yes to all" answer, the first instinct was to start hand-generating per-archetype mocks and exhaustive edge-case coverage. Pushed back with a triage table proposing what was actually in scope for the spec phase vs. RFC vs. follow-up issues.
3. **Almost left the FRAIM stale-config warning as a blocker**: at session start the FRAIM mentor reported `designSystem` and `compliance` as "not configured" despite both landing in #183. Resisted the urge to re-run `project-onboarding` and instead treated it as server cache; proceeded with local truth and noted in evidence.

## Where Past Learnings Actually Fired

1. **`feedback_fraim_before_plan_mode.md`** (broadened from #179): fired immediately on the user's first message. FRAIM-first discovery preceded any tool calls, and the saved memory's specific call-out that "operational/dev-env tasks are not exempt" generalized correctly to "spec writing also needs FRAIM discovery."
2. **`feedback_issue_before_branch.md`** (from #179): fired during Round 2 when the reviewer asked for two new issues. Filed #189 + #190 before referencing them, not retroactively.
3. **`feedback_push_pr_always_merge_with_review.md`** (from #179): fired after Round 1 and Round 2 work was committed locally. No "do you want me to push?" gating round-trip; just pushed and reported.
4. **`project_pricing_not_finalized.md`** (from #179): fired throughout drafting. Step 0's plan-selection slot, the multi-app count cap, OD-4's orthogonality note, the explicit "no SKUs invented" framing — all directly traceable to this memory.
5. **`feedback_user_does_not_manually_close.md`** (from #179): not directly fired this session, but informed the merge step (used `gh pr merge --squash` and explicitly verified that #170 stayed open per `Refs #170` rather than `Closes #170`).
6. **The `traceability matrix catches gaps` validated-pattern** (from sid.mathur@gmail.com's L1): fired in Phase 4 and caught the checklist-milestone gap before submit. Same matrix grew 12 → 22 → 27 rows across rounds and is the single artifact most useful for future retrospectives on this spec.
7. **`recognize good work` ethos** (the reverse of `analyze why you messed up`): the reviewer's "single-question pushback" pattern was on full display this session ("for Step 0 should I be seeing something different in the mock?"). I treated it as a full stop-and-reconsider per the existing manager-coaching pattern; reversed quickly without defending. That worked.

## Lessons Learned

1. **Spec-edit batches must include a "mock impact" sweep**. Whenever a spec section that has corresponding visual content is edited, the mock for that section needs to be updated in the same commit. Don't separate spec text edits from mock edits across commits — they desynchronize and the desync is invisible until someone looks.
2. **Phase 4 completeness review is a single-axis audit today**. It catches spec-vs-source gaps but not mock-vs-spec gaps. Add a second pass: walk every mock scene, and for each visual element check that the corresponding spec section says the same thing. Cheap to run at the end of every round.
3. **Pre-execution confirmation pays for itself on multi-section rewrites**. Both Round 1 and Round 2's pre-execution questions converted what would have been 30+ message round-trips into single-message answers ("yes to all", "1b/2a/3b" style). Don't dive into a multi-section rewrite without pre-confirmed direction.
4. **Open decisions with `← recommended` get one-round answers**. Every OD-1 through OD-5 was answered in a single review pass. The framing matters — without the explicit recommendation, the reviewer would have had to pick between options without knowing which one I'd already concluded was right.
5. **Memory retrieval is doing real work for this user**. Five memories from the #179 session each fired correctly here without being explicitly recalled. The compounding effect is significant — Round 1 of #170 was visibly cleaner than the start of #179, and the difference is mostly memory-driven.
6. **The "single-question pushback" reviewer pattern is real and consistent**. "Are you following FRAIM?" / "Have you tested these?" / "Is the mock in sync?" — same shape, same trigger, same correct response (full stop + reverse, not defend). The manager-coaching learning from #179 captured this exactly; it was useful again here.

## Agent Rule Updates Made to avoid recurrence

1. **None added at the project-rules level.** The mock-vs-spec sync issue is a process gap inside the agent's spec-editing flow, not a project-wide rule. Capturing as a feedback memory instead.
2. **Saved feedback memory candidate**: "When editing a spec section that has corresponding mock content, update the mock in the same commit. Audit mock-vs-spec at the end of every spec round." (Will be drafted at the next memory-update pass.)

## Enforcement Updates Made to avoid recurrence

1. **None in this PR.** The feedback file (`docs/evidence/170-spec-feedback.md`) and the per-thread inline replies act as the structured record of what landed where, and the traceability matrix in the spec itself is the durable mock-vs-source map.
2. **Phase 7 retrospective itself is the enforcement update for the next #170 phase.** It captures the "mock-vs-spec audit at the end of every round" lesson so the RFC phase doesn't repeat the same miss against the schema spec it produces.
