---
author: sid.mathur@gmail.com
date: 2026-04-02
synthesized:
---

# Postmortem: Quality Milestone — Codebase-Wide Quality Assessment & Fixes

**Date**: 2026-04-02
**Duration**: ~1 session
**Objective**: Systematically evaluate codebase quality across code quality, broken windows, test coverage, and test standards — then fix all approved issues.
**Outcome**: Success — PR #97 merged to main.

## Executive Summary

Ran the quality-milestone-management job across all four quality dimensions. Discovered ESLint was not configured despite project rules claiming it was, found 32 inline mock violations, 3 backend files using console.* instead of Pino, and significant test coverage gaps. Fixed all P0/P1 items and most P2 items. ESLint caught a real bug (constant binary expression in spin wheel page). Test count went from ~400 to 582+, test files from 25 to 40.

## Architectural Impact

**Has Architectural Impact**: No

## Timeline of Events

### Phase 1: Evaluate All Quality Dimensions
- ✅ Ran build, typecheck, lint — all passed (but lint was misleading)
- ✅ Ran smoke tests — 79 pass across 9 files
- ✅ Identified ESLint gap, inline mock violations, console.* usage, test coverage gaps
- ✅ Used parallel agents for codebase exploration — efficient

### Phase 2: Report and Prioritize
- ✅ Created QUALITY-MILESTONE-REPORT-2026-04-02.md with P0/P1/P2 categorization
- ✅ User approved all P0, P1, and P2-2 items

### Phase 3: Iterative Fix Cycle
- ✅ P0-1: ESLint setup — found and fixed 5 real issues including a bug
- ✅ P0-2: Extracted inline mocks — learned async vi.mock pattern for hoisting
- ✅ P1-1: Replaced console.* with Pino in 3 files
- ✅ P1-2: Added 5 route test files — had to re-read schemas after initial failures
- ✅ P1-3: Added 3 plugin test files
- ✅ P2-2: Added tests for 3 previously untested packages

### Phase 4: Verify Milestone
- ✅ Full regression passed — build, typecheck, lint, 582+ tests

### Phase 5: Submission
- ✅ PR #97 created and merged

## Root Cause Analysis

### 1. **Primary Cause: ESLint Never Configured**
**Problem**: Project rules documented ESLint as a CI gate but lint scripts only ran `tsc --noEmit`.
**Impact**: No code style enforcement, dead code accumulated, a real bug went undetected.

### 2. **Contributing Factors: Test Coverage Gaps**
**Problem**: Rapid feature development outpaced test writing for new routes/plugins.
**Impact**: 11 of 15 routes and 3 of 5 plugins had no unit tests.

## What Went Wrong

1. **Wrote tests against guessed schemas**: Initial campaign, member, and alert rule tests failed because I guessed schema shapes instead of reading the actual Zod schemas first. This is a known pattern from the learnings file ("Read implementation files before writing tests").
2. **vi.mock hoisting issue**: First attempt at extracting mocks used top-level `const` references which `vi.mock` can't access due to hoisting. Required switching to async factory pattern.

## What Went Right

1. **Parallel exploration agents**: Using Explore agents to inventory the codebase while running build/tests saved significant time.
2. **ESLint caught a real bug**: The `!data?.winningIndex === undefined` constant binary expression in spin wheel would have caused the spin button to never work correctly. ESLint paid for itself immediately.
3. **Shared mock factories**: The `databaseMockFactory()` and `pinoMockFactory()` patterns are clean and reusable — future test files can use them with zero inline mocks.
4. **Integration test fix**: Caught `INACTIVE` (not a valid ProgramStatus) in the integration test factory call.

## Lessons Learned

1. **Always read the actual schema/implementation before writing tests** — guessing schema shapes wastes a full test-run cycle. This was already in the learnings file but I didn't follow it for the first batch.
2. **vi.mock hoisting requires async factory imports** — when using shared mock factories with vitest, use `vi.mock('module', async () => { const { factory } = await import('...'); return factory() })` to avoid "cannot access before initialization" errors.
3. **ESLint on a TypeScript codebase pays off immediately** — even the recommended rules (no-unused-vars, no-constant-binary-expression) caught real issues on first run.

## Agent Rule Updates Made to avoid recurrence

1. **Updated project_rules.md**: Changed Rule 11 lint description from "ESLint — zero errors" to "ESLint (typescript-eslint) — zero errors, warnings OK" to accurately reflect the new setup.

## Enforcement Updates Made to avoid recurrence

1. **ESLint now runs in CI**: `pnpm lint` across api, worker, web runs real ESLint with typescript-eslint rules. New code with unused vars or dead imports will fail CI.
2. **Shared mock factories available**: `databaseMockFactory`, `pinoMockFactory`, and `createMockPrisma` are exported from `@customerEQ/config/test-utils` — new test files should use these instead of inline mocks.
