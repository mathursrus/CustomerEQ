---
author: sid.mathur@gmail.com
date: 2026-04-03
synthesized: 2026-04-09
---

# Postmortem: Support Widget — Embeddable Chat with Rule-Based Response Engine - Issue #101

**Date**: 2026-04-03
**Duration**: ~45 minutes (implementation phase)
**Objective**: Implement Phase D support chat widget with rule-based response engine, server-side orchestration pipeline, and admin API for managing conversations and support rules.
**Outcome**: Success

## Executive Summary

Implemented the full Phase D support widget feature across 27 files (+2335 lines) in a single session. The implementation followed the approved RFC precisely, with graceful degradation for Phase A-C dependencies that don't exist yet. All CI gates passed (build, typecheck, lint, smoke tests) with 67 new unit tests and zero regressions.

## Architectural Impact

**Has Architectural Impact**: Yes

**Sections Updated**: Data Layer (model count 11->14), Shared Layer (added supportRules.ts), Embed Layer (added ceq-support-chat.ts)
**Changes Made**: Added 3 new Prisma models, new shared evaluation logic, new embed component
**Rationale**: Phase D feature adds new domain (support/chat) to the platform
**Updated in PR**: Yes

## Timeline of Events

### Phase 1: Scoping
- Loaded RFC, architecture doc, project rules, codebase patterns
- Work list already existed from previous design session
- Identified 4 implementation phases with ~25 file changes

### Phase 2: Tests
- Created 67 unit tests across 3 test files
- Test factories for Conversation, Message, SupportRule
- All tests passed on first run (after fixing Zod refine/partial issue)

### Phase 3: Implementation
- Parallel work on schema, shared code, AI integration, API routes, web component
- Single lint error fixed (no-useless-assignment in bullmq.ts)
- All CI gates passed after fix

### Phase 4: Validation & Submission
- All 43 test files across 7 packages pass (zero regressions)
- Committed and pushed to feature branch
- PR #105 comment added with evidence

## Root Cause Analysis

### 1. **Primary Cause**
No major issues encountered. The RFC was detailed enough to implement directly.

### 2. **Contributing Factors**
**Problem**: Zod's `.refine()` returns `ZodEffects` which doesn't support `.partial()`
**Impact**: Support schema test file failed to load. Required restructuring to use a base schema object before applying `.refine()`.

## What Went Wrong

1. **Zod schema structure**: Initially applied `.refine()` directly on the schema object, then tried `.partial()` on the result. Had to introduce `CreateSupportRuleBaseSchema` intermediate to support both `CreateSupportRuleSchema` (with refine) and `UpdateSupportRuleSchema` (with partial).
2. **Lint error**: Used mutable variables with reassignment pattern for try/catch result handling, triggering `no-useless-assignment`. Restructured to use IIFE pattern.

## What Went Right

1. **RFC precision**: The technical design RFC had exact Prisma schema, exact TypeScript interfaces, exact API route signatures, and exact file paths. This eliminated all ambiguity during implementation.
2. **Existing patterns**: Every component followed an established codebase pattern (BullMQ inline mode, Fastify route plugins, Zod schemas, Web Components, test factories), making implementation fast and consistent.
3. **Graceful degradation design**: The RFC explicitly specified fallback behavior for each Phase A-C dependency, which translated directly into try/catch blocks and fallback functions.
4. **Test-first approach**: Writing tests alongside implementation caught the Zod schema issue immediately.
5. **Single-pass CI success**: After the two minor fixes (Zod + lint), all 4 CI gates passed in a single run.

## Lessons Learned

1. **Zod refine + partial pattern**: When a schema needs both `.refine()` validation and `.partial()` for update schemas, always create a base `z.object()` first, then derive both from it. The refined version cannot be made partial.
2. **IIFE for complex try/catch**: When ESLint flags `no-useless-assignment` in try/catch result patterns, restructure using an async IIFE that returns a result object from both branches.
3. **RFC-driven implementation is efficient**: When the RFC specifies exact file paths, exact schemas, and exact function signatures, implementation becomes primarily mechanical. The RFC was the correct level of investment for this feature's complexity.

## Agent Rule Updates Made to avoid recurrence

1. **None required**: The two issues encountered were minor and self-correcting during the implementation flow.

## Enforcement Updates Made to avoid recurrence

1. **None required**: Existing CI gates (typecheck, lint, tests) caught both issues before submission.
