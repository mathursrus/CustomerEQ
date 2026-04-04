---
author: sid.mathur@gmail.com
date: 2026-04-03
synthesized:
---

# Postmortem: Customer Health Score (Phase B: CRM Intelligence) - Issue #99

**Date**: 2026-04-03
**Duration**: Single session (~45 minutes)
**Objective**: Implement a computed Customer Health Score (0-100) synthesizing recency, frequency, sentiment, NPS, and engagement into a single metric for proactive customer management.
**Outcome**: Success

## Executive Summary

Successfully implemented the Customer Health Score feature following the RFC precisely. All 10 production files modified/created, 42 new unit tests written, 635 total tests passing across the codebase. Architecture document updated to reflect new patterns. PR #103 submitted for review.

## Architectural Impact

**Has Architectural Impact**: Yes

**Sections Updated**: 3.3 (Event Processing Layer), 4.1 (API Routes), 4.3 (BullMQ Workers), 4.4 (Database Models)
**Changes Made**: Added health-score-computation worker, updated Member model docs, documented Customer 360 endpoint, added missing worker entries for sentiment/clustering/alert queues
**Rationale**: The RFC identified 4 gaps in architecture documentation. This implementation introduced new patterns (batch-computed derived fields, Customer 360 aggregation endpoint) that needed documentation.
**Updated in PR**: Yes

## Timeline of Events

### Phase 1: Scoping
- Scoping was already completed in a prior session
- Work list existed at docs/evidence/99-implement-work-list.md
- Partial progress: shared types and queue constant already created

### Phase 2: Tests (implement-tests)
- Wrote 20 unit tests for pure health score computation formula
- Wrote 8 tests for endpoint schemas
- Wrote 14 tests for Zod schemas
- All tests passing immediately

### Phase 3: Code (implement-code)
- Implemented all production code alongside tests
- Schema changes, queue infrastructure, API endpoints, worker, MCP tool
- Build/typecheck/lint all passed on first attempt
- One fix needed: .js extension on test imports (ESM module resolution)

### Phase 4: Validate (implement-validate)
- No console.log/TODO/FIXME found
- All CI gates passed (build, typecheck, lint, smoke tests)

### Phase 5: Regression (implement-regression)
- Full suite: 635 tests, 42 files, 0 failures across 7 packages

### Phase 6: Quality (implement-quality)
- No hardcoded values, no complexity issues
- Sub-score duplication in worker follows established codebase pattern

### Phase 7: Completeness Review
- 29/29 traceability matrix rows Met
- All feedback addressed
- Evidence document created

### Phase 8: Architecture Update
- 4 sections updated in architecture.md

### Phase 9: Submission
- Committed, pushed, PR commented, issue labeled

## Root Cause Analysis

No significant issues encountered. The implementation proceeded smoothly because:

### 1. **Primary Success Factor**
**Factor**: Well-defined RFC with precise formula, file locations, and patterns
**Impact**: Zero ambiguity in implementation -- every file, function, and formula was specified

### 2. **Contributing Factor**
**Factor**: Established codebase patterns (6 existing queues, worker processors, Zod schemas)
**Impact**: Could follow exact patterns without inventing new approaches

## What Went Wrong

1. **ESM Import Extension**: Forgot .js extensions on test file imports for healthScore.ts. The build caught it immediately but this is a recurring pattern on this codebase.
2. **Prisma Version Mismatch**: Global npx prisma was v7 but project uses v5. Had to use version-specific invocation. Minor friction.

## What Went Right

1. **RFC Precision**: The technical design RFC was extremely detailed with exact file paths, function signatures, and formula. This eliminated all guesswork.
2. **Test-First Approach**: Writing pure function tests first validated the formula before wiring up the full system.
3. **Pattern Following**: The existing 6-queue pattern made adding queue #7 mechanical and low-risk.
4. **Parallel Queries**: The 360 endpoint uses Promise.all() for 11 parallel DB queries, keeping latency low.
5. **Clean First Pass**: Build, typecheck, lint, and all tests passed without iteration (after the ESM fix).

## Lessons Learned

1. **Always use .js extensions in imports for ESM TypeScript projects**: This is a known pattern in this codebase and should be muscle memory by now.
2. **Pure function extraction pays off**: The computeHealthScore() and sub-score functions being pure (no DB, no side effects) made testing trivial and the code highly reusable.
3. **RFC-driven implementation is fast**: When the RFC specifies exact files, functions, and formulas, implementation is essentially translation rather than design.
4. **Architecture doc maintenance scales**: Adding entries to the architecture doc during implementation prevents documentation drift.

## Agent Rule Updates Made to avoid recurrence

1. None needed -- existing project rules were sufficient and followed correctly.

## Enforcement Updates Made to avoid recurrence

1. None needed -- the ESM import extension issue is caught by the build step, which is already a required CI gate.
