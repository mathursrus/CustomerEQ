# Implementation Work List — Issue #99: Customer Health Score

Issue: #99 (Phase B: CRM Intelligence — Customer Health Score)
RFC: `docs/rfcs/99-customer-health-score.md`
Branch: `feature/99-phase-b-crm-intelligence-customer-health-score`
Type: feature

---

## Scoped Implementation Checklist

### 1. Schema Changes
- [x] `packages/database/prisma/schema.prisma` — Add `healthScore Int?` and `healthScoreUpdatedAt DateTime?` to Member model
- [x] `packages/database/prisma/schema.prisma` — Add composite index `@@index([brandId, healthScore])`
- [ ] Run `prisma migrate dev` to generate migration (requires DATABASE_URL)

### 2. Shared Types & Schemas
- [x] `packages/shared/src/types/health-score.ts` — New file: `HealthScoreComputationPayload`, `HealthScoreWeights`, `HealthScoreBreakdown` interfaces
- [x] `packages/shared/src/types/index.ts` — Re-export health-score types
- [x] `packages/shared/src/queues.ts` — Add `HEALTH_SCORE_COMPUTATION: 'health-score-computation'`
- [x] `packages/shared/src/zod/member.schema.ts` — Add `HealthScoreWeightsSchema`, `HealthScoreFilterSchema`, `RecomputeHealthScoreSchema`
- [x] `packages/shared/src/index.ts` — Exports accessible (already exports member.schema.ts)

### 3. Health Score Computation Logic (Pure Function)
- [x] `apps/api/src/queues/healthScore.ts` — Pure `computeHealthScore()` + sub-score helpers + DB signal fetchers + batch processor

### 4. Queue Infrastructure
- [x] `apps/api/src/queues/bullmq.ts` — Add `_healthScoreQueue`, `getHealthScoreQueue()`, `enqueueHealthScoreComputation()`, inline fallback

### 5. API Endpoints
- [x] `apps/api/src/routes/members.ts` — Add `GET /v1/members/:id/360` endpoint (Customer 360 view)
- [x] `apps/api/src/routes/members.ts` — Add `GET /v1/members` with `healthScoreMin`/`healthScoreMax` filters
- [x] `apps/api/src/routes/healthScores.ts` — New file: `POST /v1/admin/health-scores/recompute`
- [x] `apps/api/src/app.ts` — Register healthScores routes

### 6. Worker Processor
- [x] `apps/worker/src/processors/healthScore.ts` — New file: BullMQ processor
- [x] `apps/worker/src/index.ts` — Register health score worker

### 7. MCP Tool
- [x] `apps/mcp-server/src/tools/members.ts` — Add `get_member_360` tool

### 8. Tests
- [x] `apps/api/src/queues/healthScore.test.ts` — 20 unit tests for score computation formula
- [x] `apps/api/src/routes/healthScores.test.ts` — 8 tests for recompute endpoint schema and health filter
- [x] `packages/shared/src/zod/member.schema.test.ts` — 14 new tests for health score Zod schemas

---

## Validation Requirements

- `uiValidationRequired`: false (no UI changes in scope)
- `mobileValidationRequired`: false
- `unitTestsRequired`: true (P1 feature — unit + integration)
- `integrationTestsRequired`: true
- `e2eTestsRequired`: false (no UI)

## Discovered Patterns

- **Queue pattern**: 6 existing queues in `bullmq.ts` with `QUEUE_MODE=inline` fallback — followed exactly
- **Worker pattern**: `apps/worker/src/processors/` with Job<Payload> signature — followed exactly
- **Shared constants**: Queue names in `packages/shared/src/queues.ts` — followed
- **Type exports**: `packages/shared/src/types/index.ts` re-exports all types — followed
- **Zod schemas**: Co-located with tests in `packages/shared/src/zod/` — followed
- **Test mocks**: All in `packages/config/src/test-utils/` — no new mocks needed (pure function tests)
- **Route registration**: `apps/api/src/app.ts` registers with `/v1` prefix — followed
- **MCP tools**: `apiFetch` wrapper pattern in `apps/mcp-server/src/tools/` — followed

## Deferrals / Open Questions

- Configurable per-brand weights deferred to future issue
- Admin dashboard visualization deferred to future issue
- Cron scheduling (daily 2 AM) deferred — requires worker infrastructure running
- Prisma migration generation deferred — requires DATABASE_URL connection
