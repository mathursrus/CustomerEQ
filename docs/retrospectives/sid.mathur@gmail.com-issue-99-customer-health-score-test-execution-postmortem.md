---
author: sid.mathur@gmail.com
date: 2026-04-03
synthesized:
---

# Postmortem: Customer Health Score Test Execution - Issue #99

**Date**: 2026-04-03
**Duration**: ~15 minutes
**Objective**: Verify test coverage and add tests for deduplicated shared health score functions
**Outcome**: Success -- 37 new tests added, 640 total tests passing

## Executive Summary

After moving pure computation functions from API and worker to `@customerEQ/shared` (fixing code duplication), added comprehensive unit tests in the shared package to ensure the relocated functions remain correct. The existing 29 API tests continued to pass via re-exports. Total smoke test count increased to 640 across 3 packages, all passing.

## Architectural Impact

**Has Architectural Impact**: No

Tests validate existing logic; no architectural changes were made in this phase.

## Timeline of Events

### Phase 1: Test Planning
- Reviewed existing test coverage (29 API + 9 route schema + 42 member schema = 80 health-score-related tests)
- Identified gaps: no tests in shared package after dedup, missing boundary cases
- Planned 37 new tests for shared pure functions

### Phase 2: Test Implementation
- Created `packages/shared/src/types/health-score.test.ts` with 37 tests
- Covered all 5 sub-score functions + composite score + properties

### Phase 3: Test Verification
- All 37 new tests pass (11ms)
- Full suite: 320 shared + 192 API + 128 worker = 640 passing
- Build and typecheck both clean

### Phase 4: Test Submission
- Committed and pushed with evidence documentation

## Root Cause Analysis

### 1. **Primary Cause: Shared Functions Had No Direct Tests**
**Problem**: After deduplication, the shared package had the authoritative copy of computation functions but no tests
**Impact**: If the shared code were accidentally modified, the only safety net was the API tests (which re-export the functions). The worker had no test coverage for its usage at all.

## What Went Wrong

1. **Original implementation had no shared-level tests**: The computation functions were only tested via the API's test file, creating an implicit coupling between test location and code location

## What Went Right

1. **Deduplication made test gaps obvious**: Moving code to shared immediately highlighted the lack of shared-level tests
2. **Fast test execution**: 37 tests run in 11ms, keeping the feedback loop tight
3. **Tests verify real logic**: All assertions test specific numeric outputs, boundary conditions, and mathematical properties -- no tautologies

## Lessons Learned

1. **When moving code, move (or add) tests too**: Deduplication should always be accompanied by tests at the new location
2. **Pure functions are ideal test targets**: The health score functions being pure (no DB, no side effects) made them trivial to test comprehensively
3. **Property-based assertions catch more bugs**: Testing invariants like "score is always 0-100" and "weights sum to 1.0" is more robust than testing individual values

## Agent Rule Updates Made to avoid recurrence

1. **No rule updates needed**: Testing standards (Rule 11a) and shared test utils (Rule 8) already cover these patterns adequately

## Enforcement Updates Made to avoid recurrence

1. **Consider coverage checks for shared package**: Add a CI step that verifies the shared package has test coverage for all exported functions
