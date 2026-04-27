---
author: swavak@gmail.com
date: 2026-04-06
synthesized: 2026-04-09
---

# Postmortem: Survey Trigger Wizard Technical Design — Issue #79

**Date**: 2026-04-06
**Duration**: ~1 session
**Objective**: Translate the #79 feature spec (R31–R37) into a concrete implementable RFC — 2-step survey creation wizard, reach-estimate API, dynamic sub-triggers from earn rules, Survey schema extension.
**Outcome**: Success — design approved first review, no feedback rounds required

## Executive Summary

The #79 technical design was completed in one session with no revision cycles. The key architectural decisions were straightforward because all patterns were already established by prior issues: the wizard refactor mirrors the CampaignForm pattern (#78), the reach estimate follows the computeInsights() query pattern (#78), and the nullable migration follows the Issue #3 precedent. The main design value-add was identifying and documenting three architecture patterns that were being used but not documented — these were captured in the RFC's Architecture Analysis section and then applied to the architecture doc upon approval.

## Architectural Impact

**Has Architectural Impact**: Yes

**Sections Updated**:
- §3.1 Presentation Layer — added `apps/web/src/utils/` convention for web-only pure functions
- §4.1 API Routes — added `GET /v1/analytics/reach-estimate` with graceful-degradation convention; updated `/v1/programs` row with `trigger-options` sub-resource convention
- §4.4 Database Models — Survey model updated with 3 new nullable trigger fields

**Changes Made**: Three undocumented patterns formalized — (1) web-only utility location, (2) analytics graceful-degradation contract (200+reason vs 5xx), (3) GET sub-resource convention for derived program config.

**Rationale**: These patterns were already in use in the codebase (Issue #78 set the graceful-degradation precedent with `computeInsights`). Formalizing them prevents future implementers from choosing 5xx responses for non-critical analytics reads.

**Updated in PR**: Yes — committed to `feature/79-survey-trigger-wizard` branch, merged after retrospective.

## Timeline of Events

### Phase 1: requirements-analysis
- ✅ **Read**: Feature spec `docs/feature-specs/79-survey-trigger-wizard.md` (R31–R37)
- ✅ **Read**: `apps/web/src/app/(admin)/admin/surveys/new/page.tsx` — confirmed single-step form, no wizard
- ✅ **Read**: `packages/database/prisma/schema.prisma` Survey model — no trigger fields
- ✅ **Read**: `apps/api/src/routes/surveys.ts` — confirmed POST endpoint and CreateSurveySchema shape
- ✅ **Read**: `apps/api/src/routes/analytics.ts` — confirmed computeInsights pattern for reach estimate
- ✅ **Read**: Architecture doc — identified 3 undocumented patterns

### Phase 2: design-authoring
- ✅ **No spike needed**: all patterns established from prior issues
- ✅ **Created**: `docs/rfcs/79-survey-trigger-wizard.md` with full design
- ✅ **Applied**: `phase:design` label to issue #79

### Phase 3: architecture-gap-review
- ✅ **Identified**: 3 patterns missing from architecture doc, 0 incorrectly followed
- ✅ **Documented**: Architecture Analysis section appended to RFC

### Phase 4: design-completeness-review
- ✅ **Traceability matrix**: 16/16 requirements Met
- ✅ **Created**: `docs/evidence/79-technical-design-evidence.md`

### Phase 5: design-submission
- ✅ **Committed and pushed**: branch `feature/79-survey-trigger-wizard`
- ✅ **Created**: PR #111
- ✅ **Approved**: no feedback, first review

### Phase 6: retrospective + architecture update
- ✅ **Updated**: `docs/architecture/architecture.md` with 3 new patterns

## Root Cause Analysis

### 1. Primary Cause
**Problem**: N/A — no problems encountered. Approved on first review.

### 2. Contributing Factors
The design was straightforward because Issue #78 had already established the key patterns (wizard refactor, analytics query with graceful fallback, nullable migration). This is the benefit of building features incrementally on an established codebase.

## What Went Wrong

1. **No issues**: Clean first-pass design and approval.

## What Went Right

1. **Pattern reuse from #78**: The CampaignForm wizard refactor and computeInsights() query pattern from Issue #78 directly informed the TriggerStep component and reach estimate endpoint design. Reading prior issue implementations before designing is the right approach.

2. **Pure function for recommendations**: `getTriggerRecommendation()` is a pure client-side function with a static map — no API call, no async, instantly testable. This is the right design for deterministic lookups. Avoided the temptation to make it an API endpoint.

3. **Graceful-degradation contract explicitly stated**: The reach estimate endpoint returns 200+reason on failure (not 5xx). Calling this out explicitly in the RFC — and then formalizing it as an architecture convention — prevents future implementers from returning 5xx for non-critical analytics reads.

4. **Architecture gap detection as a named phase**: Having an explicit architecture-gap-review phase surfaced 3 undocumented patterns that were already in use. Without this phase, the patterns would have remained implicit, making future implementation inconsistent.

5. **16/16 traceability on first pass**: No requirements were missed. Grounding the RFC section-by-section in R31–R37 (not writing free-form then checking coverage afterward) is the right order.

## Lessons Learned

1. **Read prior issue RFCs before designing**: Issue #78's RFC established the computeInsights() pattern that directly maps to the reach estimate endpoint. Reading prior RFCs saves re-discovery time.

2. **Pure functions for deterministic lookups**: When a feature needs a recommendation/routing function that is deterministic (same input → same output, no side effects), implement it as a pure client-side function — not an API endpoint. Simpler, faster, more testable.

3. **Architecture gaps discovered in design should be formalized immediately on approval**: The 3 patterns identified (web-only utils location, analytics graceful-degradation, GET sub-resources) were being used inconsistently because they weren't documented. The architecture-gap-review → address-feedback → architecture update loop closes this.

4. **Nullable columns are the right default for schema extensions**: Adding `triggerCategory`, `triggerKey`, `surveyTypeOverride` as nullable means existing surveys are unaffected and no backfill migration is needed. Always prefer nullable for opt-in feature additions.

## Agent Rule Updates Made to avoid recurrence

1. **Read prior issue RFCs before designing**: Before starting `design-authoring` for any feature, check `docs/rfcs/` for prior RFCs on related issues. For survey/campaign/analytics features, #78 and #79 RFCs are the primary references.

2. **Prefer pure client-side functions for deterministic lookups**: When designing a recommendation or routing feature, default to a pure function in `apps/web/src/utils/` unless the data requires server-side computation or must be audited.

## Enforcement Updates Made to avoid recurrence

1. **Architecture gap review is not optional**: Every RFC must include an Architecture Analysis section with the three-bucket classification (correctly followed, missing, incorrectly followed). Missing this section is a blocking completeness issue.

2. **Architecture doc update is part of approval**: When a design is approved and Architecture Analysis contains "Patterns Missing from Architecture" items, those updates must be committed in the same PR as the retrospective — not deferred to implementation.
