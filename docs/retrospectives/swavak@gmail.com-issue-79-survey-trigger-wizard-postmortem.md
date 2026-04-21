---
author: swavak@gmail.com
date: 2026-04-07
synthesized: 2026-04-09
---

# Postmortem: Survey Trigger Wizard — Issue #79

**Date**: 2026-04-07
**Duration**: 3 sessions (spec → design → implementation)
**Objective**: Add decision-support layer to survey creation: Step 1 wizard recommends CSAT/NPS/CES based on trigger context, shows reach estimate, and captures override intent before the existing content form.
**Outcome**: Success — PR #112 merged on first review round with zero feedback.

## Executive Summary

Issue #79 was executed cleanly across all three FRAIM jobs (feature-specification, technical-design, feature-implementation). The feature added a 2-step survey creation wizard (TriggerStep + existing content form), two new API endpoints with documented architectural contracts, and a pure-function recommendation utility. 41 tests written, 17/17 requirements met, approved in first review with no changes requested. The one quality issue found (constants inside request handler) was caught and fixed during implement-quality before submission.

## Architectural Impact

**Has Architectural Impact**: Yes

**Sections Updated**: §3.1 (web-only utils convention), §4.1 (reach-estimate graceful-degradation contract + programs sub-resource convention), §4.4 (Survey model trigger fields)
**Changes Made**: 4 new patterns documented in `docs/architecture/architecture.md` during the technical-design phase. Implementation followed them without deviation.
**Rationale**: Three patterns were in use in the codebase but undocumented — surfaced during the RFC's architecture analysis and codified before implementation began.
**Updated in PR**: Yes — architecture.md updated in PR #111 (technical-design), not #112.

## Timeline of Events

### Phase 1: Feature Specification (PR #110)
- ✅ **Spec written**: R31–R37, error states, validation plan, alternatives, competitive analysis
- ✅ **Mock created**: Interactive HTML with 4 scenarios (happy path, validation, CX Risk + override, no earn rules)
- ✅ **Approved first round**: Zero feedback

### Phase 2: Technical Design (PR #111)
- ✅ **RFC written**: TriggerStep component, getTriggerRecommendation(), 2 new API endpoints, DB schema changes
- ✅ **Architecture gaps identified**: 3 undocumented patterns surfaced and added to architecture.md
- ✅ **Approved first round**: Zero feedback

### Phase 3: Feature Implementation (PR #112)
- ✅ **Tests written first**: 41 tests across unit / integration / E2E before production code
- ✅ **Production code written**: 10 files (3 new, 7 modified)
- ✅ **Quality issue caught**: TRIGGER_EVENT_MAP inside request handler → moved to module level
- ✅ **Approved first round**: Zero feedback, merged

## Root Cause Analysis

### 1. **Quality Issue: Constants inside request handler**
**Problem**: `TRIGGER_EVENT_MAP`, `SCHEDULED_KEYS`, `WINDOW_DAYS` initially defined inside the `GET /analytics/reach-estimate` handler, re-created on every request.
**Impact**: Minor runtime inefficiency; caught in implement-quality phase, fixed before submission.
**Root cause**: When writing new handler code rapidly, it is natural to define related constants locally for readability. The quality-check phase caught this correctly.

### 2. **DB migration required manual creation**
**Problem**: `DATABASE_URL` not available in shell — `prisma migrate dev` could not run automatically.
**Impact**: Had to manually create the migration SQL file following the existing pattern. No functional impact — structure identical to prior migrations.
**Root cause**: Dev environment constraint, expected for this project.

## What Went Wrong

1. **Constants in handler scope**: TRIGGER_EVENT_MAP and related constants initially placed inside the request handler instead of module level. Fixed in implement-quality before submission.
2. **Manual migration**: Automated `prisma migrate dev` unavailable without DATABASE_URL — required manual SQL authoring.

## What Went Right

1. **Test-driven approach**: Writing 41 tests before production code gave a concrete contract to implement against. Unit tests for `getTriggerRecommendation` made the pure function specification unambiguous.
2. **Architecture-first**: Identifying undocumented patterns in the RFC (before coding) prevented architectural drift and gave the implementation clear guardrails.
3. **Graceful-degradation contract**: Designing reach-estimate to always return 200+reason (never 5xx) meant the frontend never needed error handling — just reads `estimatedCount: null` and shows "unavailable".
4. **Backwards compatibility**: All trigger fields nullable + CreateSurveySchema optional — zero risk to existing surveys and API consumers.
5. **Quality phase caught the constant scope issue**: The FRAIM implement-quality phase added real value — caught a real issue before merge.
6. **Zero feedback rounds across all three PRs**: #110, #111, #112 all approved on first submission.

## Lessons Learned

1. **Place shared constants at module scope from the start**: Any constant in a Fastify handler that does not depend on request state belongs at module level. Default to module-level when writing new handler code — move into handler only if it genuinely depends on request context.
2. **Manual migrations are fine when DATABASE_URL is unavailable**: Follow the existing migration file pattern (simple DDL). Document the decision in the evidence file so reviewers understand.
3. **Graceful-degradation endpoints simplify frontend significantly**: When a non-critical read endpoint returns null+reason instead of failing, the frontend component becomes much simpler. Prefer this pattern for analytics/badge data endpoints.
4. **Spec mock HTML is worth the investment**: The 4-scenario interactive mock in the spec phase made TriggerStep design decisions obvious before any production code was written. The override picker behavior came directly from the mock.
5. **Architecture gap detection during RFC pays off**: Surfacing 3 undocumented patterns during technical-design and codifying them immediately prevents future implementers from reinventing or violating them.

## Agent Rule Updates Made to avoid recurrence

1. **Route handler constants rule**: When writing new Fastify route handlers, define any constants that do not depend on request/reply state at module level above the plugin function, not inside the handler.
2. **Manual migration checklist item**: When DATABASE_URL is unavailable, add "manually create migration SQL following prior migration pattern" as an explicit work list item and document in evidence file.

## Enforcement Updates Made to avoid recurrence

1. **Quality check for new API handlers**: The implement-quality grep for constants-inside-handlers should be standard for any new Fastify route handler.
2. **Graceful-degradation as default for badge/summary endpoints**: Any new endpoint that feeds a UI badge or summary widget should default to the 200+reason pattern rather than propagating errors to the frontend.
