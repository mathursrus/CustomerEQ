---
author: swavak@gmail.com
date: 2026-04-03
synthesized:
---

# Postmortem: Unified CX+Loyalty Operator Dashboard — Issue #78

**Date**: 2026-04-03
**Duration**: ~1 session
**Objective**: Technical design for the Unified CX+Loyalty Operator Dashboard — RFC authoring, architecture gap review, evidence documentation, submission
**Outcome**: Success — PR #106 merged (approved by owner). RFC committed at `835a802`, evidence at `4e6c389`.

---

## Executive Summary

Technical design for Issue #78 completed in a single session with no major obstacles. The RFC covers a new `/admin` home dashboard with CX Health + Loyalty Health panels, a deterministic rule-based insights engine, and click-through navigation to the pre-filtered campaign builder. All 3 requirements (R28–R30) and 5 acceptance criteria (AC1–AC5) are fully addressed. The design required no spike and no new Prisma models — 88% confidence. Architecture doc updated with 3 missing patterns.

---

## Architectural Impact

**Has Architectural Impact**: Yes

**Sections Updated**: `§3.1 Presentation Layer` (admin home entry point, context-aware navigation), `§4.1 API Routes` (`/v1/analytics` row — program-health endpoint + computeInsights pattern)
**Changes Made**: Added admin home entry point note, `searchParams` pre-fill pattern, `GET /v1/analytics/program-health` endpoint description, in-process insights rule engine note
**Rationale**: RFC identified 3 patterns missing from architecture doc — resolved as part of retrospective cleanup
**Updated in PR**: Yes — committed with retrospective commit

---

## Timeline of Events

### Phase 1: design-research
- ✅ Read Issue #78 from GitHub (R28/R29/R30 + 5 ACs extracted)
- ✅ Read Issue #75 spec for CX-to-Loyalty Workflows context
- ✅ Read existing codebase — `analytics.ts`, `analytics/page.tsx`, `architecture.md`
- ✅ No spike needed — all data computable from existing schema

### Phase 2: design-authoring
- ✅ Full RFC authored: `docs/rfcs/78-unified-cx-loyalty-dashboard.md`
- ✅ 3 insights rules specified: `detractors-no-redemption`, `survey-completers-earn-more`, `low-response-rate`
- ✅ Response shape, component tree, DB query mapping, failure modes, observability all documented
- ✅ Validation plan and test matrix defined
- ✅ Confidence level: 88/100

### Phase 3: design-architecture-gap-review
- ✅ 6 patterns correctly followed (RSC fetch, `/v1/analytics/*` route, `Promise.all`, `brandId` from JWT, Tailwind, additive schema)
- ✅ 3 missing patterns identified (admin home route, insights engine, URL-state-to-form pattern)
- ✅ 0 patterns incorrectly followed

### Phase 4: design-completeness-review
- ✅ Traceability matrix: R28/R29/R30 + AC1–AC5 all Met
- ✅ Evidence file created: `docs/evidence/78-technical-design-evidence.md`

### Phase 5: design-submission
- ✅ RFC and evidence committed and pushed
- ✅ PR #106 created: `design(#78): unified CX+loyalty operator dashboard RFC`
- ✅ Evidence comment added to PR
- ✅ Issue #78 labeled `status:needs-review`

### Phase 6: address-feedback
- ✅ PR approved by owner — no feedback rounds needed

### Phase 7: retrospective
- ✅ Architecture doc updated with 3 missing patterns
- ✅ This document

---

## Root Cause Analysis

### 1. No blocking issues encountered
**Problem**: N/A — design was clean, no spikes, no ambiguities requiring clarification
**Impact**: Session completed in one pass

### 2. 3 architecture gaps identified (minor)
**Problem**: The architecture doc did not document the admin home entry point, the `computeInsights()` pattern, or the `searchParams` pre-fill pattern — all introduced by Issue #78.
**Impact**: Required targeted updates to `§3.1` and `§4.1` in the retrospective phase. Low effort.
**Root Cause**: Architecture doc is updated per-issue; new patterns naturally appear in gaps between issue cycles. The RFC's architecture gap analysis section surfaced all three cleanly.

---

## What Went Wrong

1. **Nothing significant** — the technical design job ran cleanly end-to-end in one session with no rework.

---

## What Went Right

1. **No spike needed**: The RFC's data model section confirmed all required fields exist in `SurveyResponse`, `Member`, `LoyaltyEvent`, `Redemption`, `Campaign`. Existing `analytics.ts` raw query pattern was directly reusable. Confidence was high from the start.
2. **Architecture gap analysis was thorough**: Identified all 3 missing patterns before submission. RFC's "Patterns Missing from Architecture" section made the retrospective architecture update straightforward.
3. **`computeInsights()` as a pure function**: Designing the insights engine as a pure function with mocked inputs makes unit testing trivial — no DB required for the rule logic tests.
4. **Partial-failure design upfront**: Specifying `warnings[]` array behavior before implementation prevents a common pattern of 5xx on unavailable stats being discovered during review.
5. **`searchParams` pre-fill framing**: Documenting this as a UX convenience pattern (not security-relevant) in the RFC removes a potential review question before it's asked.

---

## Lessons Learned

1. **RFC architecture gap analysis should explicitly propose the doc update text**, not just name the gap. This makes the retrospective architecture update a copy-paste, not a re-authoring.
2. **Deterministic rule engines with configurable thresholds are the right MVP default** for insights. The `atRiskCount ≥ 5` and `multiplier ≥ 1.5` thresholds are surfaced as constants in the RFC — document these as configurable from the start so they don't become magic numbers in implementation.
3. **Response denominator choices should be explicitly called out at design time** — the `responseRate = responses / activeMembers` approximation is documented in OQ-3 and the RFC's risks table. This prevents the "why are you using activeMembers?" review comment.

---

## Agent Rule Updates Made to avoid recurrence

1. **In RFC "Patterns Missing from Architecture" section, include proposed doc update text** (the exact sentence to add) alongside the gap description. This makes architecture doc updates during retrospective trivial.
2. **Always document configurable thresholds as named constants in the RFC** (not inline numbers) so implementation treats them as configuration, not magic values.

---

## Enforcement Updates Made to avoid recurrence

1. **Add to design-architecture-gap-review checklist**: "Does each missing pattern entry include the proposed architecture doc text to add?" If not, draft it before seekMentoring.
