---
author: sid.mathur@gmail.com
date: 2026-04-03
synthesized:
---

# Postmortem: CRM Core — Customer 360 API, Search, and KYC Synthesis - Issue #98

**Date**: 2026-04-03
**Duration**: ~45 minutes
**Objective**: Implement Customer 360 API, Member Search, and KYC Synthesis endpoints
**Outcome**: Success

## Executive Summary

Implemented all Phase A CRM Core features as specified in the RFC. The implementation added two new API endpoints (360 view and search), a BAML KYC synthesis function, two MCP tools, and comprehensive tests. All validation gates passed on the first attempt with zero regressions.

## Architectural Impact

**Has Architectural Impact**: No

All implementation followed existing architectural patterns documented in `docs/architecture/architecture.md`. No new patterns, technologies, or architectural decisions were introduced.

## Timeline of Events

### Phase 1: Scoping
- ✅ Read RFC, feature spec, project rules, and architecture doc
- ✅ Identified all files to modify/create
- ✅ Created implementation work list

### Phase 2: Tests
- ✅ Wrote 16 Zod schema unit tests
- ✅ Wrote 5 buildCustomerContext unit tests
- ✅ Wrote 14 integration tests (6 for 360, 8 for search)
- ✅ Added createErasedMember and createCampaignEvent test factories

### Phase 3: Implementation
- ✅ Added Zod schemas (SearchMembersQuerySchema, Customer360QuerySchema, Customer360Response)
- ✅ Created BAML SynthesizeCustomerProfile function
- ✅ Created TypeScript wrapper with buildCustomerContext
- ✅ Implemented GET /v1/members/:id/360 endpoint
- ✅ Implemented GET /v1/members search endpoint
- ✅ Added get_customer_360 and search_members MCP tools

### Phase 4: Validation
- ✅ Build: 9/9 tasks pass
- ✅ Typecheck: 13/13 tasks pass
- ✅ Lint: 3/3 tasks pass
- ✅ Smoke tests: 11/11 tasks, 577 tests
- ✅ Integration tests: 5/5 tasks, 179 tests

## Root Cause Analysis

### 1. **Primary Cause**
No issues encountered. The RFC was thorough and precise, which enabled a clean implementation.

### 2. **Contributing Factors**
- BAML generated types had a slightly different function signature (direct params vs named object) than the RFC showed. Required a small fix during build verification.
- The worktree needed `pnpm install` and `prisma generate` before building.

## What Went Wrong

1. **BAML function call signature mismatch**: The RFC showed `b.SynthesizeCustomerProfile({ context: { ... } })` but the generated BAML types take the context fields directly as params. Caught by TypeScript build.
2. **Prisma Json type for campaign event result**: The `createCampaignEvent` factory initially used `Record<string, unknown> | null` for the `result` field, but Prisma expects `Prisma.InputJsonValue`. Caught by TypeScript build.

## What Went Right

1. **RFC precision**: The RFC included exact code snippets for every file, making implementation straightforward translation.
2. **Existing patterns**: All new code follows patterns already established in the codebase (Fastify routes, Prisma queries, BAML functions, MCP tools, test factories).
3. **No schema migration**: All Prisma relations already existed, avoiding migration complexity.
4. **Parallel query pattern**: The Promise.all approach for 360 sub-collections was clean and efficient.
5. **Test-alongside-code approach**: Writing tests alongside implementation caught the BAML signature issue early.
6. **Comprehensive test coverage**: 35 total new tests covering happy paths, edge cases, PII masking, tenant isolation, pagination.

## Lessons Learned

1. **Always check BAML generated types**: The generated TypeScript types may differ from what the RFC describes. Build verification catches this.
2. **Worktrees need their own setup**: Git worktrees share the git history but not node_modules or generated files. Always run `pnpm install` and `prisma generate` in a new worktree.
3. **CaseFollowUp without Prisma relation works fine**: Using `findMany({ where: { memberId } })` without a formal Prisma relation is a clean pattern for cross-model queries.

## Agent Rule Updates Made to avoid recurrence

1. No rule updates needed — existing patterns and rules were sufficient.

## Enforcement Updates Made to avoid recurrence

1. No enforcement updates needed — TypeScript strict mode and the build step caught both issues before they reached tests.
