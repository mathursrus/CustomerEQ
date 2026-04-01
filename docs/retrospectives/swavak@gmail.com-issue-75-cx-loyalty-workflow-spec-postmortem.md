---
author: swavak@gmail.com
date: 2026-04-01
synthesized:
---

# Postmortem: Streamline End-to-End CX-to-Loyalty Workflows — Issue #75

**Date**: 2026-04-01
**Duration**: ~1 session
**Objective**: Create a PM spec mapping common CX-to-loyalty workflows, identify friction, and produce actionable improvements for the 7-issue MVP
**Outcome**: Success — spec merged to main (PR #76), 3 new P0 sub-issues filed

---

## Executive Summary

Issue #75 produced a comprehensive PM spec covering 9 member-facing and 4 operator-facing workflows, 40 requirements (R1–R40), 7 compliance requirements, 15 friction items, and a 5-competitor analysis. A key mid-session insight — that the initial spec was entirely member-facing and missed the operator perspective — was incorporated before submission, resulting in a significantly stronger artifact. The spec revealed 3 net-new P0 features not tracked in the backlog (unified dashboard, survey wizard, response-to-action rules), which were filed as issues after merge.

---

## Architectural Impact

**Has Architectural Impact**: No

This was a specification-only job. No production code was changed. Architecture doc not updated.

---

## Timeline of Events

### Phase 1: Context Gathering
- ✅ Read Issue #75, use-cases.md, implementation roadmap
- ✅ Identified GDPR/CCPA/SOC2/PCI compliance requirements from fraim/config.json
- ✅ Mapped 9 workflows to existing MVP issues (#2–#9)

### Phase 2: Spec Drafting (Member Workflows)
- ✅ Drafted 9 member-facing workflows (R1–R27) with SHALL requirements and acceptance criteria
- ✅ Created interactive HTML mock (75-member-onboarding-flow.html) with 3 scenarios
- ✅ Wrote compliance section (R-C1–R-C7)
- ✅ Created 10-item friction inventory (F1–F10)

### Phase 3: Mid-session Pivot — Operator Perspective Added
- ✅ User feedback identified gap: spec was entirely member-facing; portal feels like two disconnected tools
- ✅ Added Workflows 10–13 (W10: unified dashboard, W11: survey strategy, W12: response-to-action rules, W13: CX as loyalty signal)
- ✅ Added R28–R40 (13 new requirements)
- ✅ Added F11–F15 (5 new friction items, all P0/P1)
- ✅ Created second HTML mock (75-marketing-manager-flow.html) with 3 operator scenarios

### Phase 4: Competitor Analysis
- ✅ Researched 5 competitors (Annex Cloud, Yotpo, Smile.io, Loyalty Lion, Antavo)
- ✅ Updated spec with full competitive matrix, objection handling tracks, pain point table
- ✅ Confirmed: no competitor offers sub-15-min CX→loyalty automation out of the box

### Phase 5: Completeness Review + Validation
- ✅ Validated both HTML mocks in Playwright (all 6 scenarios passed)
- ✅ Confirmed all Issue #75 success criteria traceable to requirements

### Phase 6: Submission
- ✅ Created evidence doc, committed, pushed, opened PR #76
- ✅ User approved and merged PR #76 without changes requested

### Phase 7: Post-merge
- ✅ Filed 3 P0 sub-issues (#78 unified dashboard, #79 survey wizard, #80 response-to-action rules)
- ✅ Added R7/R8 note to Issue #6

---

## Root Cause Analysis

### 1. Initial Spec Was Member-Only

**Problem**: The first draft of the spec covered 9 workflows, all from the member's perspective. The operator (marketing manager) experience was not addressed despite being explicitly called out in the issue's goal ("map common workflows across all roles").

**Impact**: Required a significant mid-session addition (13 new requirements, a second HTML mock, 5 new friction items). If shipped without the operator perspective, the spec would have been incomplete for its stated purpose.

**Root Cause**: The FRAIM feature-specification job template focuses on "User Experience" in the singular — the natural tendency is to anchor on the end user (member) and treat the operator as secondary. When the issue mentions multiple roles, both must be actively scoped at the start of context-gathering.

### 2. P0 Gaps Discovered Late (Post-Spec)

**Problem**: Three net-new P0 features (unified dashboard, survey wizard, response-to-action rules) were identified by the spec but not filed as issues until after merge.

**Impact**: Delayed tracking. If implementation of Issue #6 had started before these were filed, the hero feature would have shipped without the operator UI needed to make it usable.

**Root Cause**: The spec-to-backlog handoff is not explicit in the FRAIM feature-specification job. The job ends with submission and retrospective — it does not include a step for "file sub-issues for P0 gaps discovered."

---

## What Went Wrong

1. **Operator perspective missed in first draft**: Required user to explicitly point out the gap ("this is from the end customer point of view"). Should have been caught in context-gathering by reviewing all roles listed in the issue.

2. **P0 sub-issues not filed proactively**: The spec identified 3 net-new P0 features, but these weren't filed until the user asked "what's the next step?" after merge. They should have been filed as part of the submission phase.

---

## What Went Right

1. **Mid-session pivot executed cleanly**: When the user identified the operator gap, the spec was extended with 13 new requirements, a full second HTML mock (3 interactive scenarios), and 5 new friction items — all in one round, without breaking the existing member-facing work.

2. **HTML mocks validated in Playwright**: Both mocks were validated with actual browser screenshots before submission. All 6 scenarios passed. This gave concrete, verifiable evidence rather than just describing what the mock would look like.

3. **Competitor research grounded in real data**: The 5-competitor analysis used web research (G2, official docs, Capterra) rather than assumptions. Two new competitors (Loyalty Lion, Antavo) were discovered and added. The objection handling tracks are directly usable in sales conversations.

4. **Compliance mapped to specific controls**: Rather than a generic "GDPR applies" statement, each compliance requirement was mapped to a specific code control (e.g., `Member.consentGivenAt`, query filter on `consentGivenAt IS NOT NULL`, Key Vault for CRM credentials). This is implementation-ready.

5. **Friction inventory with P0/P1/P2 priority**: All 15 friction items were explicitly prioritized and mapped to requirements. This prevents the P0 items (hero flow confirmation, consent gate) from being treated as polish.

---

## Lessons Learned

1. **At context-gathering, list all roles from the issue and ensure at least one workflow per role**: Issue #75 listed 6 roles. The spec initially covered only 1 (Loyalty Member). A checklist at context-gathering time — "does every role in the issue have at least one workflow?" — would have caught this before drafting.

2. **P0 gaps found in a spec should be filed as issues before or during submission, not after**: Add a step to the submission phase: scan the friction inventory for P0 items not covered by existing issues → file them before closing.

3. **Two-sided platform specs need two mocks**: When a feature has both an end-user side and an operator side, both need separate HTML mocks. A single mock defaults to the end-user perspective and misses the operator UX.

4. **The response-to-action rule builder (R35–R37) is the most novel UX in the spec**: No competitor offers inline survey-to-campaign rule definition in the same flow. This is a strong demo moment. Future agents implementing Issue #6 should be aware this is where CustomerEQ's differentiation is most visible to operators.

---

## Agent Rule Updates Made to Avoid Recurrence

1. **Multi-role specs**: When a spec issue mentions multiple user roles, explicitly verify that at least one workflow is drafted per role before moving from context-gathering to spec-drafting. If operator workflows are missing, draft them before writing member-facing workflows.

2. **P0 gap filing**: During spec submission, scan the friction inventory for P0 items not covered by an existing open GitHub issue. File sub-issues for any gaps found. Do not defer this to "next steps" after merge.

---

## Enforcement Updates Made to Avoid Recurrence

1. **Submission checklist addition**: Before calling `seekMentoring(status: "complete")` on `spec-submission`, verify: (a) all roles in the issue have at least one workflow, (b) all P0 friction items are tracked in an open GitHub issue.

2. **Mock requirement for two-sided features**: If a feature has both member-facing and operator-facing UX, the spec must include two HTML mocks — one per role — before spec-completeness-review passes.
