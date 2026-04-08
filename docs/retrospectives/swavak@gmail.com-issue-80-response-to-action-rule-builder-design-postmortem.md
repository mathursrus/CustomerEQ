---
author: swavak@gmail.com
date: 2026-04-08
synthesized:
---

# Postmortem: Response-to-Action Rule Builder — Technical Design — Issue #80

**Date**: 2026-04-08
**Duration**: 1 session (requirements analysis → RFC → architecture gap review → completeness review → submission)
**Objective**: Design the Rule Builder wizard steps, CX Playbooks, Loop Monitor, and the wiring that makes rules actually execute when survey responses arrive.
**Outcome**: Success — RFC committed to `feature/80-response-to-action-rule-builder`, PR #118 opened, 30/30 requirements met, 4 architecture gaps documented and approved.

## Executive Summary

The design phase surfaced and resolved a critical gap not visible in the spec: the survey response submission handler (`POST /v1/public/surveys/:id/respond`) does not evaluate response-to-action rules — it only awards incentive points. The RFC extends this handler to evaluate `SurveyRule` records and enqueue campaign triggers via the existing `campaign-triggers` BullMQ queue, closing the full feedback-to-loyalty pipeline. All other design decisions followed existing patterns with high confidence (88/100). Architecture.md updated with 4 new patterns post-approval.

## Architectural Impact

**Has Architectural Impact**: Yes

**Sections Updated**: §4.1 (surveys route, cx-playbooks route, public/* survey response wiring, loop-monitor endpoint), §4.4 (Survey model additions, new SurveyRule model, new CxPlaybook model)
**Changes Made**: 4 new architectural patterns documented. All were already implicit in the RFC design — the architecture update makes them explicit and discoverable.
**Rationale**: The wiring pattern (survey response → campaign trigger) is structurally identical to event ingestion → campaign trigger. The `POST /:id/launch` pattern and brand-scoped playbook pattern are new conventions that will recur in future features.
**Updated in PR**: Yes — architecture.md updated in this PR (#118).

## Timeline of Events

### Phase 1: Requirements Analysis
- ✅ Read Issue #80, spec R35–R40, architecture.md, schema.prisma, worker/src/index.ts, campaignTriggers.ts, public.ts response handler
- ✅ **Identified wiring gap**: response submission handler has no rule evaluation path — campaigns never fire from survey responses

### Phase 2: Design Authoring
- ✅ RFC written: 2 new models (CxPlaybook, SurveyRule), 4 schema additions, 6 new endpoints, frontend component list, wiring extension, test matrix, risk table
- ✅ All patterns reuse existing infrastructure (BullMQ queue, campaign processor, graceful-degradation contract)

### Phase 3: Architecture Gap Review
- ✅ 8 patterns correctly followed, 4 missing from architecture.md, 0 incorrectly followed
- ✅ Gaps documented in RFC for PR reviewer decision

### Phase 4: Design Completeness Review
- ✅ 30/30 requirements traced to RFC sections — PASS
- ✅ Evidence file created: `docs/evidence/80-technical-design-evidence.md`

### Phase 5: Submission + Approval
- ✅ PR #118 opened, architecture.md updated post-approval

## Root Cause Analysis

### 1. **Wiring gap not visible in spec**
**Problem**: The spec (R35–R40) describes the Rule Builder UI and Loop Monitor but never states explicitly that the survey response submission path must be extended to evaluate rules. The "wiring gap" is a silent assumption — the spec assumes rules will fire, but doesn't specify where in the stack the evaluation happens.
**Impact**: If not caught in design, the feature would ship with rules that are visually configured but never execute — exactly the same problem as the #79 trigger metadata gap.
**Root cause**: Feature specs naturally focus on the operator-facing configuration UX. The execution side (which handler evaluates rules, which queue receives the trigger) is infrastructure that specs tend to leave implicit.

## What Went Wrong

1. **Nothing significant** — the design phase caught the wiring gap before implementation began, which is exactly the right time.

## What Went Right

1. **Wiring gap caught in design, not in QA**: Reading `public.ts` response handler during requirements analysis revealed the gap immediately. This prevented a repeat of the #79 situation where metadata was stored but never used.
2. **Zero new infrastructure**: The entire execution path reuses `campaignTriggers.ts` processor unchanged. The only change is adding rule evaluation + enqueue calls to the response submission handler. High-confidence, low-risk.
3. **`POST /:id/launch` pattern clearly named**: Naming the side-effect-bearing status transition pattern explicitly makes it easy to apply consistently in future features (e.g., if campaigns or programs ever get a similar "activate with side effects" flow).
4. **`CxPlaybook` brand-scoped decision documented**: Scoping playbooks to brand (not program) is non-obvious. Documenting the rationale ("survives program lifecycle changes") prevents future implementers from reversing the decision without context.
5. **30/30 traceability on first pass**: No unmet requirements discovered during completeness review.

## Lessons Learned

1. **Execution wiring is always implicit in specs** — during requirements analysis for any feature that configures automation, explicitly ask: "where in the stack does this configuration get evaluated?" If the answer is not obvious from reading the handler, the wiring is the design gap.
2. **`POST /:id/action` over `PATCH status` for side-effect transitions** — any time a status change creates other records, it belongs in a dedicated action endpoint. This prevents partial state and makes the side effects explicit in the URL.
3. **Brand-scope vs program-scope for reusable configuration** — ask this for every new "reusable operator config" entity. Brand-scope is usually right for anything that should survive program archival or recreation.

## Agent Rule Updates Made to avoid recurrence

1. **Wiring gap check**: During technical-design requirements analysis, for every feature that stores operator configuration (rules, triggers, playbooks), explicitly verify which handler evaluates that configuration and trace the full execution path before designing the data model.
2. **Side-effect status transitions**: When a status change creates other records, use `POST /:id/action` (not `PATCH status`). Document this in the RFC.

## Enforcement Updates Made to avoid recurrence

1. **Architecture gap review is load-bearing**: The 4 gaps caught in this phase (wiring, launch pattern, brand-scope, loop-monitor contract) will be used by the next implementer. Running the gap review before submission, not after, is what made them available for the architecture update.
