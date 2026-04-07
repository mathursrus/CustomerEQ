---
author: swavak@gmail.com
date: 2026-04-06
synthesized:
---

# Postmortem: Survey Trigger Wizard — Issue #79

**Date**: 2026-04-06
**Duration**: ~1 session
**Objective**: Write the feature specification for the Survey Trigger Wizard (R31–R34 from Issue #75): a Step 1 wizard that guides marketing managers to select when to send a survey, recommends a survey type with rationale, shows estimated reach, and allows inline override.
**Outcome**: Success — spec approved first review, no feedback rounds required

## Executive Summary

The #79 feature spec was written end-to-end in one session with no revision cycles. The existing mock in `75-marketing-manager-flow.html` Scenario 5 provided a strong foundation — the spec fleshed it out with 7 testable requirements, 6 error states, competitive analysis, and a standalone interactive mock. The main value-add beyond what the issue already specified was three additional requirements (R35–R37) covering persistence, graceful reach-estimate fallback, and dynamic sub-trigger loading from earn rules.

## Architectural Impact

**Has Architectural Impact**: No

This is a spec-only deliverable. No code was written. Architectural implications (new reach-estimate API endpoint, dynamic sub-trigger loading from earn rules) are documented in the spec's Validation Plan for the implementation phase to pick up.

## Timeline of Events

### Phase 1: context-gathering
- ✅ **Read**: Issue #79 requirements (R31–R34)
- ✅ **Read**: Issue #75 spec (R31–R34 source, Workflow 11 section)
- ✅ **Read**: `75-marketing-manager-flow.html` Scenario 5 — confirmed mock already existed for Step 1 UI
- ✅ **Read**: Issue #35 survey-builder spec — confirmed Step 2 context
- ✅ **Identified**: Three open questions (reach estimate API, dynamic sub-triggers, override UX) — resolved as R35–R37

### Phase 2: spec-drafting
- ✅ **Created**: `docs/feature-specs/79-survey-trigger-wizard.md` with R31–R37, AC, error states, compliance, validation plan, alternatives, competitive analysis
- ✅ **Created**: `docs/feature-specs/mocks/79-survey-trigger-wizard.html` — 4 interactive scenarios
- ✅ **Designed**: Trigger-to-type mapping table (11 trigger combinations, 3 survey types)

### Phase 3: competitor-analysis
- ✅ **Analyzed**: 6 competitors (Qualtrics, Typeform, SurveyMonkey, Medallia, Delighted, Yotpo)
- ✅ **Documented**: 4 differentiation pillars — loyalty-moment context, rationale transparency, reach estimate before commitment, inline override with preserved rationale

### Phase 4: spec-completeness-review
- ✅ **Verified**: All 7 requirements have Given/When/Then AC
- ✅ **Verified**: 6 error states documented in table format
- ✅ **Verified**: Compliance section, design standards section, validation plan all present

### Phase 5: spec-submission
- ✅ **Created**: `docs/evidence/79-spec-evidence.md`
- ✅ **Committed and pushed**: branch `feature/79-survey-trigger-wizard`
- ✅ **Created**: PR #110
- ✅ **Updated**: Issue #79 label to `status:needs-review`

### Phase 6: address-feedback
- ✅ **Approved**: No feedback, approved first review

## Root Cause Analysis

### 1. **Primary Cause**
**Problem**: N/A — no problems encountered. The spec was approved without revisions.

### 2. **Contributing Factors**
**No issues surfaced.** The main risk going in was that the existing mock (Scenario 5 in the #75 HTML) already depicted the UI well, so the spec needed to add testable requirements rather than re-invent the design. This was handled correctly.

## What Went Wrong

1. **No issues**: The spec was delivered and approved in one pass.

## What Went Right

1. **Reused existing mock as foundation**: Rather than re-reading the mock from scratch, recognizing that Scenario 5 in `75-marketing-manager-flow.html` already depicted the trigger wizard allowed the spec to reference and extend it rather than duplicate it. This saved time and kept the mock files consistent.

2. **Proactive gap-filling with R35–R37**: The issue only explicitly stated R31–R34. Identifying three implicit requirements during drafting (persistence, reach-estimate fallback, dynamic sub-triggers) prevented those gaps from surfacing as implementation surprises.

3. **11-row trigger-to-type mapping table**: Writing out all 11 trigger combinations explicitly (rather than just the 4 category-level rules) gave the implementation team a complete, unambiguous lookup table. This pattern is reusable for any recommendation engine spec.

4. **4-scenario interactive mock**: Covering happy path, validation errors, CX risk + override, and empty program state in one HTML file gave reviewers a complete picture without requiring a running server. The scenario switcher pattern (already used in the #75 mock) is the right format for this kind of multi-state UI.

5. **Zero feedback rounds**: Clean first submission — attributable to complete requirements coverage and explicit error state documentation.

## Lessons Learned

1. **Check for pre-existing mocks before creating new ones**: The #75 mock already had the trigger wizard UI in Scenario 5. Always scan `docs/feature-specs/mocks/` for prior work that covers the same feature before starting a new mock — reference and extend, don't duplicate.

2. **Push beyond stated requirements to identify implicit ones**: R31–R34 were explicit. R35 (persistence), R36 (reach fallback), R37 (dynamic sub-triggers) were discoverable by asking "what happens when..." for each edge case. This should be a standard part of the requirement extraction step for every spec.

3. **11-combination lookup tables beat 4-category rules for recommendation engines**: When a feature involves a mapping function (trigger → survey type), an exhaustive table at the leaf level is more implementable than a summary at the category level. Apply this pattern whenever speccing any recommendation or routing logic.

4. **Scenario D (empty program state) is easy to forget**: The "no earn rules configured" state is an important empty state for any feature that reads from program configuration. Add it as a default scenario whenever speccing features that depend on program setup.

## Agent Rule Updates Made to avoid recurrence

1. **Check for pre-existing mocks first**: Before writing a new mock, grep `docs/feature-specs/mocks/` for files related to the same issue or parent issue. If found, read it and reference/extend rather than duplicate.

2. **Requirement expansion protocol**: For any spec with N stated requirements, always ask "what is the persistence story?", "what is the fallback/error story?", and "what happens if upstream data is missing?" as a standard closing step — these generate the R(N+1)+ requirements that prevent implementation gaps.

## Enforcement Updates Made to avoid recurrence

1. **Mock scenario checklist**: Every interactive mock should cover at minimum: (1) happy path, (2) one validation error state, (3) one empty/unconfigured state. The 4-scenario structure used in this mock is the minimum bar going forward.

2. **Competitive analysis at the leaf level**: For any feature involving a recommendation, decision support, or type selection, always include a competitor row for "Delighted" (the closest single-type analog) to benchmark the simplest viable alternative. This forces explicit articulation of why we offer more choice.
