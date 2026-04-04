---
author: sid.mathur@gmail.com
date: 2026-04-03
synthesized:
---

# Postmortem: Customer Health Score Bug Bash - Issue #99

**Date**: 2026-04-03
**Duration**: ~30 minutes
**Objective**: Quality validation (ui-polish-validation + user-testing-and-bug-bash) for Customer Health Score feature
**Outcome**: Success -- 2 P1 bugs fixed, 6 P2 items documented

## Executive Summary

Ran ui-polish-validation and user-testing-and-bug-bash jobs against the Customer Health Score backend implementation. Found that the feature was a backend-only change, making visual UI validation N/A. Code-level review uncovered 8 issues: 2 P1 bugs (code duplication creating drift risk, MCP enrollment tool broken) were fixed immediately. 6 P2 items (performance, validation gaps, GDPR filter gap) were documented as follow-ups.

## Architectural Impact

**Has Architectural Impact**: No

The fixes moved pure computation functions to `@customerEQ/shared`, which is consistent with the existing architecture of shared types/utilities in that package.

## Timeline of Events

### Phase 1: UI Polish Validation
- N/A All 12 phases assessed -- backend-only feature, no visual UI to validate
- Found 4 code-level issues during static review (2 P1, 2 P2)
- Fixed D1 (code duplication) and D2 (MCP consent bug)
- Verified: build passes, typecheck passes, 29/29 health score tests pass

### Phase 2: User Testing and Bug Bash
- Thorough code-level exploratory testing across all 15 changed TypeScript files
- Found 4 additional P2 issues (N+1 queries, missing validation, ERASED filter, performance)
- Documented all 8 issues in bug bash report
- Committed and pushed fixes

## Root Cause Analysis

### 1. **Primary Cause: Code Duplication Between Apps**
**Problem**: The worker processor duplicated all computation logic from the API module instead of sharing it
**Impact**: Two independent copies of the same business logic. If one is updated, the other silently drifts. The pure functions were identical but the batch DB logic was also duplicated.

### 2. **Contributing Factors**
**Problem**: MCP tool was implemented without running it against the actual API validation schema
**Impact**: The `enroll_member` MCP tool was broken from day one -- every call would fail with 422 because `consentGiven: true` was missing

## What Went Wrong

1. **Code duplication across app boundaries**: The worker copied computation logic rather than importing it, likely because cross-app imports seemed complicated
2. **MCP tool not integration-tested**: The enroll_member tool was never tested against the real API, so the missing field went unnoticed
3. **GET /v1/members missing ERASED filter**: Inconsistency between the list endpoint (no ERASED filter) and the recompute endpoint (has ERASED filter)

## What Went Right

1. **Clean separation of pure vs impure logic**: The sub-score functions were pure with no DB dependencies, making them easy to extract to shared
2. **Comprehensive test coverage**: 29 unit tests covering all sub-scores, composite scores, custom weights, edge cases, and boundary conditions
3. **Good schema validation**: Zod schemas with coercion, range validation, and refinements for weights summing to 1.0
4. **Parallel DB queries**: All signal-fetching queries run via Promise.all for efficiency
5. **Proper error handling**: Individual member failures in batch processing are caught and logged without stopping the batch

## Lessons Learned

1. **Cross-app logic should live in shared packages from day one**: When the same business logic is needed in both the API and worker, it should be in `@customerEQ/shared` from the start, not copy-pasted
2. **MCP tools need schema-level validation tests**: Any tool that calls an API endpoint should have a test verifying the request body matches the Zod schema
3. **GDPR filters must be consistent**: Any query returning member data should include ERASED/deleted filters. This should be enforced at the Prisma middleware level.

## Agent Rule Updates Made to avoid recurrence

1. **No rule updates needed**: Existing project rules (Rule 8: shared test utils, Rule 13: GDPR compliance) already cover these patterns. The issue was non-compliance with existing rules, not missing rules.

## Enforcement Updates Made to avoid recurrence

1. **Consider Prisma middleware for ERASED filter**: Instead of relying on each query to remember `status: { not: 'ERASED' }`, add middleware that automatically filters ERASED members on all findMany/findFirst calls
2. **MCP tool integration test**: Add a smoke test that validates MCP tool request bodies against API Zod schemas
