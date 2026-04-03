---
author: sid.mathur@gmail.com
date: 2026-04-03
synthesized:
---

# Postmortem: CRM Core — Customer 360 API, Search, and KYC Synthesis (Technical Design) - Issue #98

**Date**: 2026-04-03
**Duration**: ~45 minutes
**Objective**: Produce a technical design RFC for Customer 360 API, member search with behavioral filters, and LLM-powered KYC synthesis via BAML
**Outcome**: Success

## Executive Summary

Technical design RFC completed for issue #98 with all 27 requirements mapped and met in the traceability matrix. The design required no schema migrations (all Prisma relations already existed), introduced no new auth patterns, and followed established codebase conventions throughout. One architectural deviation (offset pagination vs page-based pagination) was caught during the architecture gap review and corrected before submission.

## Architectural Impact

**Has Architectural Impact**: No

Two documentation gaps were identified (behavioral relational filtering pattern, in-memory post-query sort) but both are Low impact and will be addressed after PR approval. No changes to `docs/architecture/architecture.md` were made in this phase.

## Timeline of Events

### Phase 1: requirements-analysis
- Loaded GitHub issue #98, feature spec (from branch), architecture doc, Prisma schema, BAML files, existing members routes, MCP tools, existing RFC format
- Identified key observation: no schema changes needed, all relations already exist
- Identified CaseFollowUp has memberId but no Prisma relation to Member

### Phase 2: design-authoring
- No existing design feedback to address
- Assessed technical ambiguities: all Low/Medium uncertainty, no spike needed
- Wrote full RFC to `docs/rfcs/98-customer-360-search-kyc.md`
- Updated issue label to `phase:design`

### Phase 3: technical-spike
- Skipped (conditional phase) - no High uncertainty items

### Phase 4: architecture-gap-review
- Caught pagination deviation: RFC used `limit/offset` but architecture mandates `{ data, total, page, pageSize, totalPages }`
- Corrected RFC to use standard pagination envelope
- Documented 10 correctly followed patterns, 2 missing-from-architecture patterns, 0 incorrectly followed

### Phase 5: design-completeness-review
- Built traceability matrix: 27/27 requirements Met
- Created evidence file at `docs/evidence/98-technical-design-evidence.md`
- Review PASSED

### Phase 6: design-submission
- Committed RFC + evidence (6299e3f)
- Pushed to remote
- Added PR #102 comment with summary
- Updated issue labels to `phase:design` + `status:needs-review`

### Phase 7: address-feedback
- Checked PR #102: no reviews, no review comments
- No feedback to address

## Root Cause Analysis

### 1. Primary Cause
**Problem**: No significant problems encountered. The design was straightforward because the existing data model and codebase patterns were well-suited to the feature requirements.
**Impact**: Positive - design completed efficiently.

### 2. Contributing Factors
**Problem**: Initial pagination design used `limit/offset` (matching the feature spec's API schema) instead of the codebase's standard `page/pageSize` envelope.
**Impact**: Caught during architecture gap review and corrected. No downstream impact.

## What Went Wrong

1. **Pagination envelope deviation**: The feature spec's API response schema used `{ members, total, limit, offset }` which I initially followed in the RFC. The architecture doc and existing codebase use `{ data, total, page, pageSize, totalPages }`. This highlights a tension between spec fidelity and architecture conformance — architecture doc takes precedence.

## What Went Right

1. **No schema migration needed**: Thorough Prisma schema analysis revealed all necessary relations (Member -> LoyaltyEvent, SurveyResponse, Redemption, CampaignEvent, Tier) already existed. This significantly reduces implementation risk.
2. **BAML pattern reuse**: The `SynthesizeCustomerProfile` function follows the exact pattern of the existing `AnalyzeFeedback` function, making implementation highly predictable.
3. **Architecture gap review caught a real issue**: The systematic comparison against the architecture doc identified the pagination deviation before submission.
4. **Comprehensive traceability**: Mapping all 27 requirements ensured no spec requirement was missed in the design.
5. **PII handling design**: The decision to strip PII before BAML invocation (building `CustomerContext` without email/name/phone) satisfies C-GDPR-4 cleanly.

## Lessons Learned

1. **Architecture doc is authoritative over feature spec for conventions**: When the feature spec proposes a response format that differs from the established codebase convention, the architecture doc pattern takes precedence. The spec defines *what* data to return; the architecture defines *how* to structure the response envelope.
2. **Parallel Prisma queries scale well**: The `Promise.all` pattern with 10+ parallel queries is already proven in the analytics routes. The 360 endpoint can safely use this pattern.
3. **CaseFollowUp relation gap is a known debt**: The model has `memberId` but no Prisma relation to `Member`. A separate query works fine, but this should be tracked for a future schema cleanup.
4. **Sentiment sort limitation is acceptable**: In-memory sort for related model fields is a known Prisma limitation. Documenting the threshold (<100K members) where this remains acceptable prevents future over-engineering.

## Agent Rule Updates Made to avoid recurrence

1. No new rules needed. The existing project rule #4 ("Architecture Document is Authoritative") already covers the pagination deviation case. The gap review phase effectively enforced this rule.

## Enforcement Updates Made to avoid recurrence

1. No enforcement updates needed. The FRAIM technical-design job's architecture-gap-review phase effectively catches deviations from documented patterns. The phase worked as designed.
