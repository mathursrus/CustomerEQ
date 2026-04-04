# Bug Bash Report - Issue #100

## Summary
Phase C: Support Foundation - Knowledge Base with RAG and Intent Classification
Date: 2026-04-03
Type: Backend-only feature (no UI)

## Issues Found

### BUG-1: KB audit events use wrong property for actorId [CRITICAL - FIXED]
- **Category**: Functionality / Data Integrity
- **Severity**: Critical
- **Impact**: All KB article audit events would have undefined/null actorId, breaking the audit trail
- **Root Cause**: `kb.ts` used `(request as unknown as { auth: { userId: string } }).auth.userId` instead of `request.clerkUserId`. The auth plugin sets `clerkUserId` on the request, not `auth.userId`. This was a copy-paste error from a different auth pattern.
- **Affected Code**: `apps/api/src/routes/kb.ts` lines 43, 141, 174 (create, update, delete)
- **Evidence**: All other routes (e.g., `programs.ts`) correctly use `request.clerkUserId`
- **Fix Applied**: Replaced all 3 instances with `request.clerkUserId`

### BUG-2: List endpoint category/status query params unvalidated [MEDIUM - FIXED]
- **Category**: Input Validation / Error Handling
- **Severity**: Medium
- **Impact**: Invalid category or status values (e.g., `?category=INVALID`) would cause Prisma to throw an enum validation error, resulting in an unhandled 500 response
- **Root Cause**: GET /v1/kb/articles accepted raw query params for category/status without validating against the enum values
- **Fix Applied**: Added validation against `KB_CATEGORIES` and `KB_STATUSES` constants with 422 response for invalid values

### BUG-3: Inline mocks in test files violate project rule #8 [LOW - NOTED]
- **Category**: Code Quality
- **Severity**: Low
- **Impact**: Mock drift risk; violates project convention
- **Affected Files**:
  - `packages/ai/src/analysis/embeddings.test.ts` (inline mock for `openai`)
  - `packages/ai/src/analysis/classify-intent.test.ts` (inline mock for BAML client)
  - `apps/worker/src/processors/embeddingGeneration.test.ts` (inline mocks for `@customerEQ/ai` and `@customerEQ/database`)
- **Note**: Shared mocks already exist in `packages/config/src/test-utils/mocks/ai.mock.ts` (`mockGenerateEmbedding`, `mockClassifyIntent`)

## Security Review

| Check | Result | Notes |
|-------|--------|-------|
| SQL Injection | PASS | All raw SQL uses parameterized queries ($1, $2, $3). Vector strings from number[] arrays only. |
| Auth Enforcement | PASS | Routes under /v1 prefix with auth plugin. brandId from JWT only. |
| Multi-tenant Isolation | PASS | All queries filter by brandId. Multi-tenant plugin blocks brandId in body. |
| Input Validation | PASS | Zod schemas with reasonable limits on all POST/PUT endpoints. |
| Soft Delete | PASS | DELETE uses soft-delete (sets deletedAt). Queries filter deletedAt: null. |
| Error Leakage | LOW RISK | No custom error handler, but @fastify/sensible provides baseline. |

## Architecture Review

| Aspect | Assessment |
|--------|-----------|
| Route patterns | Consistent with existing routes (programs, surveys, etc.) |
| Queue integration | Follows BullMQ pattern with inline fallback. Retry config (3 attempts, exponential backoff). |
| Worker registration | Properly registered in worker/src/index.ts with error handlers and graceful shutdown. |
| BAML function | Clean prompt template with Jinja2 conditionals for KB article context. |
| Schema design | KBArticle model follows conventions (brandId, soft delete, timestamps, indexes). |
| Test coverage | Unit tests for all schemas, embeddings, classify-intent, and worker processor. |

## Result: PASS (with fixes applied)
- 1 Critical bug fixed (actorId in audit events)
- 1 Medium bug fixed (query param validation)
- 1 Low-severity code quality note documented
