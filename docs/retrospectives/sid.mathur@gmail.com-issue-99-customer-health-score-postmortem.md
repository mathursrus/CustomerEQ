---
author: sid.mathur@gmail.com
date: 2026-04-03
synthesized:
---

# Postmortem: Customer Health Score Feature Specification - Issue #99

**Date**: 2026-04-03
**Duration**: ~45 minutes
**Objective**: Create comprehensive feature specification for Customer Health Score (0-100) combining recency, frequency, sentiment, NPS, and engagement signals
**Outcome**: Success — spec, mocks, and evidence delivered; PR #103 created

## Executive Summary

Completed the feature-specification job for issue #99, producing a comprehensive spec document with 11 functional requirements, 6 edge cases, 5 compliance controls, a detailed scoring formula, competitive analysis of 4 competitors, 2 HTML/CSS UI mocks, and a data flow diagram. The spec was submitted via PR #103 and is awaiting human review.

## Architectural Impact

**Has Architectural Impact**: No

This is a specification-only deliverable. Architectural decisions (new BullMQ queue, Member schema change) are proposed in the spec but not implemented. Architecture doc updates will happen during the design/implementation phases.

## Timeline of Events

### Phase 1: Context Gathering
- Loaded issue #99 description from GitHub
- Read Prisma schema to understand Member model and related models (LoyaltyEvent, SurveyResponse, Redemption, CampaignEvent)
- Read existing BullMQ queue pattern in `apps/api/src/queues/bullmq.ts` (6 queues, inline/Redis dual mode)
- Read member routes in `apps/api/src/routes/members.ts`
- Confirmed Customer 360 endpoint does not exist yet (Phase A dependency)
- Reviewed brainstorming document for gap analysis context
- Extracted 11 requirements with SHALL-style language and acceptance criteria

### Phase 2: Spec Drafting
- Fetched FRAIM spec template
- Created comprehensive spec at `docs/feature-specs/99-customer-health-score.md`
- Designed scoring formula with 5 weighted components and weight redistribution logic
- Created 2 HTML/CSS mocks (360 view and member list)
- Documented compliance controls for GDPR, CCPA, multi-tenant, consent, audit

### Phase 3: Competitor Analysis
- Web-researched Gainsight (Scorecards), Totango (SuccessBLOCs), ChurnZero (ChurnScores), Annex Cloud (RFM)
- Updated spec with sourced competitive analysis and differentiation strategy
- Identified key differentiator: unified CX + loyalty signals in single health score

### Phase 4: Completeness Review
- Verified all 7 issue acceptance criteria mapped to requirements
- Confirmed mock files exist
- Confirmed compliance and design standards sections present

### Phase 5: Submission
- Committed 4 files, pushed to feature branch
- Created PR #103
- Updated issue labels (phase:spec, status:needs-review)
- Added PR comment with evidence link

## Root Cause Analysis

No failures occurred. The spec was produced smoothly.

### 1. **Primary Risk: Phase A Dependency**
**Problem**: Customer 360 endpoint (`GET /v1/members/:id/360`) does not exist yet. The spec assumes Phase A creates it.
**Impact**: If Phase A is delayed, the health score feature needs a fallback plan (adding to existing `GET /v1/members/:id` instead).

### 2. **Contributing Factor: No Competitors in Config**
**Problem**: `fraim/config.json` does not have a `competitors` section configured.
**Impact**: Competitive analysis was done via web research rather than leveraging a pre-configured competitor list. This is adequate but less efficient.

## What Went Wrong

1. **Nothing significant** — the spec workflow executed cleanly with all phases completing on first attempt.

## What Went Right

1. **Existing BullMQ pattern is well-established**: The codebase already has 6 queues following the same inline/Redis dual-mode pattern, making it straightforward to specify the 7th queue for health score computation.
2. **Rich data model**: All five scoring signals (LoyaltyEvent, SurveyResponse, Redemption, CampaignEvent, Member) already exist in the schema with the fields needed for health scoring.
3. **Comprehensive brainstorming doc**: The `codebase-brainstorming-2026-04-03.md` provided excellent gap analysis context, accelerating the context-gathering phase.
4. **Web research yielded specific competitor details**: Gainsight Scorecards documentation, Totango health modes, and ChurnZero ChurnScores were all well-documented publicly.

## Lessons Learned

1. **Document Phase dependencies explicitly**: The spec correctly calls out that Phase A is a prerequisite, but the issue itself could benefit from a "Blocked by" label linking to the Phase A issue.
2. **Weight redistribution for missing data is essential**: The scoring formula needed explicit handling for members with partial data (e.g., events but no surveys). This was a design decision that should be validated during implementation.
3. **Competitor analysis benefits from web research even without config**: While FRAIM flagged missing competitor config, conducting live web research produced more current and detailed findings than a static config would.

## Agent Rule Updates Made to avoid recurrence

1. No rule updates needed — existing rules and patterns were sufficient for this task.

## Enforcement Updates Made to avoid recurrence

1. No enforcement updates needed — the feature-specification workflow phases provided adequate structure.
