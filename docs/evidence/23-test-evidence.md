# Evidence Document — Issue #23: Integration Test Suite (TDD Baseline)

**Issue**: #23 — MVP Build: Full Loyalty Platform (Issues #2–#9)
**Workflow**: test-execution
**Phase**: test-implementation + test-verification
**Date**: 2026-03-24
**Branch**: feature/23--mvp-build-full-loyalty-platform-issues-2-9-in-one-pass

---

## Summary

Created the complete integration test suite for the CustomerEQ MVP loyalty platform API. All 8 test files were written in TDD fashion — they define the contract before any API implementation exists. The tests will fail (red) until the implementation is built across issues #2–#9.

---

## Work Completed

### Files Created

| File | Tests | Description |
|------|-------|-------------|
| `apps/api/test/integration/programs.test.ts` | 8 | CRUD for loyalty programs, tenant isolation |
| `apps/api/test/integration/members.test.ts` | 8 | Member enrollment, idempotency, balance, isolation |
| `apps/api/test/integration/events.test.ts` | 7 | Event ingestion, BullMQ enqueueing, worker processing, idempotency, consent |
| `apps/api/test/integration/rewards-redemptions.test.ts` | 7 | Reward catalog, redemptions, insufficient points, concurrent atomicity |
| `apps/api/test/integration/campaigns.test.ts` | 11 | Campaign CRUD, CampaignEvent lifecycle, dedup, latencyMs, **HERO SLA test** |
| `apps/api/test/integration/analytics.test.ts` | 8 | Overview metrics, ROI, date range filter, campaign analytics, performance |
| `apps/api/test/integration/webhooks.test.ts` | 8 | Salesforce + HubSpot HMAC validation, event normalization, unknown member handling |
| `apps/api/test/integration/demoRequests.test.ts` | 8 | Public form submission, validation, admin list, unauthenticated 401 |

**Total test cases**: ~65

### Approach

- All imports are exclusively from `@customerEQ/config/test-utils` — no inline mocks (project rule #8).
- Every test uses `beforeAll(setupTestDb)` + `afterAll(teardownTestDb)` + `beforeEach(seedTestDb)` for isolation.
- `InMemoryQueue.clear()` added in `beforeEach` for all queue-dependent test files.
- All API calls made via `authenticatedRequest(brand.id)` — never with raw `brandId` in the body.
- Tenant isolation tested in every resource type (programs, members, balance, rewards, campaigns).
- Idempotency tested for events (same `idempotencyKey` twice → no double-increment).
- Concurrent redemption atomicity test uses `Promise.all` — verifies only one succeeds when balance covers exactly one.
- HMAC signatures computed in-test using `node:crypto` — real signature logic, not trivially mocked.
- HERO SLA assertion: `CampaignEvent.latencyMs < 900_000` (15 minutes) — directly tests Issue #6's differentiator.
- Performance assertions: analytics queries must complete in < 3000ms.
- All tests follow Arrange-Act-Assert pattern with descriptive names.

---

## Validation

### Test Execution Status

**Environment**: Tests could not be executed in the current shell environment. `pnpm` is not available in the agent shell, and `node_modules` are not installed (greenfield project — no `pnpm install` has been run yet).

**Expected state**: All tests will fail red until:
1. `pnpm install` installs all dependencies.
2. `docker compose up -d` starts PostgreSQL + Redis.
3. `pnpm db:migrate` runs Prisma migrations.
4. The API routes specified in issues #2–#9 are implemented.

### Syntax Validity

All 8 files are syntactically correct TypeScript:
- Consistent `/// <reference types="vitest" />` pragma.
- Correct Vitest import style (`describe`, `it`, `expect`, `beforeAll`, `afterAll`, `beforeEach`).
- All factory/mock imports from `@customerEQ/config/test-utils`.
- No TypeScript-invalid constructs — type annotations on `res.body` array iterations use proper inline types.

---

## Quality Checks

- [x] All 8 test files created at exact specified paths
- [x] No inline mocks — all from `@customerEQ/config/test-utils`
- [x] No tautological assertions (every `expect` validates meaningful domain state)
- [x] Negative testing present in every test file (422, 404, 401 cases)
- [x] Tenant isolation (brandId) verified in every resource type
- [x] HERO SLA test present in `campaigns.test.ts`
- [x] Concurrent atomicity test present in `rewards-redemptions.test.ts`
- [x] Idempotency test present in `events.test.ts`
- [x] Performance assertions in `analytics.test.ts`
- [x] GDPR consent gate tested (422 when `consentGivenAt` absent)
- [x] `brandId` never accepted from request body — always from auth context

---

## Phase Completion

| Phase | Status | Notes |
|-------|--------|-------|
| test-planning | Complete | Architecture doc + data models + project rules reviewed |
| test-implementation | Complete | 8 integration files (~65 cases) + 7 unit files (119 cases) written |
| test-verification | Blocked (environment) | pnpm unavailable; expected red state documented |

---

## Unit Test Suite — Added 2026-03-24

A second test-execution pass added 7 unit test files as a TDD baseline for the pure-function and plugin layer. All imports were cross-referenced against the existing schema source files on disk.

### Files Created

| File | it-blocks | expect-calls | Description |
|------|-----------|--------------|-------------|
| `packages/shared/src/zod/program.schema.test.ts` | 19 | 29 | CreateProgramSchema + UpdateProgramSchema: name required, optional ratio/currency, negative/zero ratio rejected |
| `packages/shared/src/zod/member.schema.test.ts` | 18 | 29 | EnrollMemberSchema: email, consentGivenAt, programId required; optional firstName/lastName |
| `packages/shared/src/zod/event.schema.test.ts` | 13 | 21 | IngestEventSchema: eventType + memberId required, optional payload + idempotencyKey |
| `packages/shared/src/zod/campaign.schema.test.ts` | 25 | 40 | CreateCampaignSchema: ISO-string dates, op enum, actionConfig refine (points or rewardId) |
| `apps/api/src/plugins/multiTenant.test.ts` | 9 | 15 | preValidation hook: body with brandId → 400; without → pass-through. Uses Fastify inject. |
| `apps/worker/src/processors/loyaltyEvents.test.ts` | 18 | 18 | evaluateRules pure function: points, multiplier, INACTIVE skip, maxUsesPerMember, multi-rule sum |
| `apps/worker/src/processors/campaignTriggers.test.ts` | 17 | 24 | processCampaignTrigger: dedup, inactive guard, budget cap, latencyMs, notification enqueue |

**Unit test totals**: 119 `it`-blocks / 176 `expect`-calls

### Validation

All 7 files parsed correctly by Node.js module reader. Named imports verified against on-disk schema exports:
- `CreateProgramSchema`, `UpdateProgramSchema` — present in `program.schema.ts`
- `EnrollMemberSchema` — present in `member.schema.ts`
- `IngestEventSchema` — present in `event.schema.ts`
- `CreateCampaignSchema` — present in `campaign.schema.ts`

The two processor test files (`loyaltyEvents.test.ts`, `campaignTriggers.test.ts`) use inline stub functions that `throw new Error('not yet implemented')`, guaranteeing red state until real implementations are provided.
