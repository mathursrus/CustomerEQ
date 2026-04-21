---
author: swavak@gmail.com
date: 2026-04-07
synthesized: 2026-04-09
---

# Postmortem: Response-to-Action Rule Builder and Loop Monitor Spec — Issue #80

**Date**: 2026-04-07
**Duration**: 1 session (spec + mock + evidence + PR submission)
**Objective**: Write a complete feature specification for Issue #80 — the Rule Builder (Step 3 of the survey wizard), CX Playbooks, Loop Monitor pipeline view, 48-hour warning, Review & Launch step, and latency metrics — before any code is written.
**Outcome**: Success — spec and interactive HTML mock committed to PR #116, no feedback received.

## Executive Summary

Issue #80 spec was completed in a single resumed session (previous session ran out of context mid-work). The feature adds Steps 3 and 4 to the survey wizard established in #79, plus a post-launch Loop Monitor view on the survey detail page. Six requirements (R35–R40) were specified with full Given/When/Then acceptance criteria, eight error states documented, compliance requirements explicit (GDPR/CCPA consent gate inheritance, SOC2 audit trail), and an interactive HTML mock produced covering all key scenarios. The spec was committed, pushed, and submitted as PR #116 with zero feedback received.

## Architectural Impact

**Has Architectural Impact**: No

No architecture.md changes required at spec phase. The technical-design phase for #80 will determine the CxPlaybook model schema, loop-monitor API response shape, and background worker scheduling approach — all of which may require ADR entries.

## Timeline of Events

### Phase 1: Context Gathering + Spec Drafting (resumed session)
- ✅ **Context read**: Issue #80, Issue #79 (wizard chrome), Issue #75 (R35–R38 origin), Issue #6 (pipeline architecture)
- ✅ **Spec written**: R35–R40 with Given/When/Then ACs, 8 error states, compliance section, validation plan, alternatives table, competitive analysis (6 competitors)
- ✅ **Mock created**: Interactive HTML covering wizard Step 3 (rule builder), Step 4 (review & launch), Loop Monitor (healthy), Loop Monitor (48h warning), Loop Monitor (latency SLA breach)

### Phase 2: Spec Submission
- ✅ **Evidence document created**: `docs/evidence/80-spec-evidence.md`
- ✅ **Committed and pushed**: 3 files, PR #116 opened
- ✅ **Issue labeled**: `status:needs-review` applied to #80
- ✅ **No feedback received**: PR approved without changes requested

## Root Cause Analysis

### 1. **Session continuity break**
**Problem**: The previous session ran out of context while writing the spec, requiring a fresh session to resume. On resume, the spec and mock files were already present as untracked files but had not yet been committed or submitted.
**Impact**: Minor — no work was lost. Resume required reading the spec and mock to verify completeness before proceeding to submission.
**Root cause**: Long spec + mock sessions with extensive competitive analysis consume significant context. The previous session completed all five phases but ran out of context before committing.

## What Went Wrong

1. **Session continuity break before commit**: The prior session completed all spec work but ran out of context before reaching the spec-submission phase. The resume session had to reconstruct state from git status and file contents rather than having explicit phase state.

## What Went Right

1. **Resumability from file state**: Because the spec and mock were fully written and only uncommitted, the resume session could determine exactly where to pick up (phase 5: spec-submission) by reading git status and the files. No rework required.
2. **#79 wizard chrome as a foundation**: Having the established wizard chrome from #79 (step indicator, sidebar, indigo/zinc design language) meant the #80 spec could precisely specify the visual integration — Step 3 and Step 4 fit into the existing four-step stepper without design ambiguity.
3. **Issue #6 pipeline as Loop Monitor foundation**: The real-time CX-to-loyalty pipeline from Issue #6 provided a clear five-stage model for the Loop Monitor. No architectural invention was needed — the spec mapped directly onto an existing pipeline.
4. **48-hour warning clock from first response, not launch**: Defining the 48-hour window from the first SurveyResponse timestamp (not the survey launch date) was an important correctness decision. A launch-date clock would fire false positives for surveys that go live but receive no responses for days.
5. **Brand-scoped playbooks (not program-scoped)**: Scoping CX Playbooks to brandId (not programId) allows operators who run multiple loyalty programs under one brand to reuse rule sets — a non-obvious but important design decision for mid-market customers with multiple programs.
6. **Competitive analysis revealed clear differentiation**: All six competitors analyzed (Delighted, Typeform, Medallia, Qualtrics, LoyaltyLion, Yotpo) lack the in-context rule builder + loop monitor combination. This confirmed the spec is building genuinely novel capability, not feature parity.

## Lessons Learned

1. **Commit spec work at end of each major phase, not just at submission**: If the previous session had committed after completing spec-drafting (phase 2) or spec-completeness-review (phase 4), the resume session would have had a clean git log to read rather than needing to infer phase state from untracked files.
2. **48-hour warning windows should be anchored to first-event timestamps**: Any "X hours after activity begins" warning should anchor to the first relevant record timestamp, not the entity creation date. This prevents false positives during slow-start periods.
3. **Playbook scope decisions have compounding consequences**: Scoping a reusable artifact to brand vs. program vs. user is an early decision that affects data model, API surface, and UI affordances. Document the rationale explicitly in the spec (which this one does in R36) to prevent downstream scope confusion during implementation.
4. **Loop Monitor belongs on the survey detail page, not the analytics dashboard**: The key insight is that the Loop Monitor is survey-scoped, not program-scoped. Placing it on the analytics dashboard would recreate the survey detail page with filtering — net zero benefit. Survey detail page gives zero-navigation access from the context where the operator already is.

## Agent Rule Updates Made to avoid recurrence

1. **Commit at phase boundaries, not only at submission**: For long spec sessions (competitive analysis + full mock), commit after completing spec-drafting and again after spec-completeness-review, not only at spec-submission. This prevents context loss from consuming all resume work.
2. **Warning window anchoring rule**: Document the anchor point for any time-based warning explicitly in the requirement AC. "48 hours after X" must specify what X is — launch date and first-response timestamp are meaningfully different.

## Enforcement Updates Made to avoid recurrence

1. **Phase-boundary commit checklist**: The spec-completeness-review phase should end with a commit of the spec + mock files before proceeding to spec-submission. This makes the resume path trivial.
2. **Playbook scope decision documented as explicit AC**: Any spec introducing a reusable artifact (playbook, template, ruleset) should explicitly state the scope (brand/program/user) in the data model section of the requirement, not just in prose.
