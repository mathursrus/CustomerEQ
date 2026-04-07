# Implementation Work List - Issue #113 Social Review Ingestion

**Issue type**: feature
**Branch**: `feature/issue-113-social-review-ingestion-spec`
**RFC**: `docs/rfcs/113-social-review-ingestion.md`
**Spec**: `docs/feature-specs/113-social-review-ingestion.md`

---

## Phase 1: Data Model and Shared Contracts

- [x] `packages/database/prisma/schema.prisma` - Added external source/signal enums, models, and `Brand` / `Member` relations
- [x] Generated additive Prisma migration at `packages/database/prisma/migrations/20260407133000_add_external_signals/migration.sql`
- [x] `packages/shared/src/zod/externalSignal.schema.ts` - Added source CRUD, source test, list-query, and external-signal query schemas
- [x] `packages/shared/src/zod/member.schema.ts` - Extended Customer 360 query/response with `externalSignals`
- [x] `packages/shared/src/queues.ts` - Added external signal sync and ingestion queue constants
- [x] `packages/shared/src/index.ts` - Exported new schemas/constants

## Phase 2: API Routes and Queue Producers

- [x] `apps/api/src/routes/externalSignals.ts` - Added admin source registry CRUD, test, sync, and external-signal feed routes
- [x] `apps/api/src/routes/webhooks.ts` - Added generic external signal webhook receiver for source-scoped ingestion
- [x] `apps/api/src/routes/members.ts` - Extended `GET /v1/members/:id/360` with matched external signals
- [x] `apps/api/src/routes/analytics.ts` - Added external-signal feed endpoint and extended CX aggregate response
- [x] `apps/api/src/queues/bullmq.ts` - Added external signal sync/ingestion enqueue helpers and inline implementations
- [x] `apps/api/src/app.ts` - Registered the new external signal route module

## Phase 3: Worker Pipeline

- [x] `apps/worker/src/processors/externalSignalSync.ts` - Added source sync processor using configured sample payloads / seed signals
- [x] `apps/worker/src/processors/externalSignalIngestion.ts` - Added normalization, dedupe, persistence, and source health updates
- [x] `apps/worker/src/index.ts` - Registered external signal workers
- [x] Kept downstream behavior queue-first with no loyalty-side synchronous mutation introduced

## Phase 4: Frontend

- [x] `apps/web/src/app/(admin)/admin/integrations/page.tsx` - Added review/social source registry, source health, test, and sync UI
- [x] `apps/web/src/app/(admin)/admin/analytics/cx/page.tsx` - Added external signal counts, filters, and operator feed
- [x] `apps/web/src/app/(admin)/admin/members/[id]/page.tsx` - Added matched external signals section to Customer 360

## Phase 5: Tests and Validation

- [x] `packages/shared/src/zod/externalSignal.schema.test.ts` - Added schema validation coverage
- [x] `apps/worker/src/processors/externalSignalIngestion.test.ts` - Added normalization, dedupe, and conservative matching coverage
- [x] `apps/worker/src/processors/externalSignalSync.test.ts` - Added source sync queueing and source-health failure coverage
- [x] `apps/api/test/integration/external-signals.test.ts` - Added source CRUD, test, sync enqueue, and analytics feed coverage
- [x] `apps/api/test/integration/members.test.ts` - Extended Customer 360 coverage for matched external signals
- [x] `apps/api/test/integration/webhooks.test.ts` - Added generic external signal webhook coverage
- [x] `apps/web/test/e2e/workflows.spec.ts` - Added admin happy-path coverage for source creation and preview
- [x] Ran required repo validation commands after implementation

---

## Validation Run

### Typecheck

- [x] `pnpm typecheck`
- [x] `pnpm lint`
- [x] `pnpm test:smoke`

### Unit / Integration

- [x] `pnpm --filter @customerEQ/shared test -- externalSignal.schema.test.ts member.schema.test.ts`
- [x] `pnpm --filter @customerEQ/worker test -- src/processors/externalSignalIngestion.test.ts`
- [x] `pnpm --filter @customerEQ/api test:integration -- external-signals.test.ts webhooks.test.ts members.test.ts`

### Browser Validation

- [x] `pnpm --filter @customerEQ/web test:e2e -- --grep "Workflow 7: External Signal Sources"`
- [x] `pnpm --filter @customerEQ/web test:e2e -- external-signals-mobile.spec.ts`
- [x] Captured mobile evidence at `docs/evidence/ui-polish/113/integrations-iphone13-portrait.png`
- [x] Captured mobile evidence at `docs/evidence/ui-polish/113/analytics-cx-iphone13-portrait.png`
- [x] Captured mobile evidence at `docs/evidence/ui-polish/113/member-360-iphone13-portrait.png`

## Notes

- `prisma migrate dev --name add_external_signals` was blocked locally by Postgres shadow-database permissions (`P3014`), so the checked-in migration SQL was generated from the previous committed schema to the current schema using `prisma migrate diff --from-schema-datamodel ... --to-schema-datamodel ... --script`.
- The targeted desktop and iPhone 13 Playwright flows passed. During mobile validation, the CX analytics page exposed a loading-state bug when auth token resolution stalled under the mocked test environment, so the page now uses the shared `getAuthToken(getToken)` timeout helper instead of awaiting `getToken()` directly.
- The Next/Clerk dev server still emits pre-existing warnings about synchronous `headers()` usage during Playwright startup. Adding `CLERK_ENCRYPTION_KEY` to the Playwright web server environment removed the prior missing-key warning, and the remaining warnings did not block the new external-signal workflow.
- The implementation intentionally uses configured sample payloads / seed signals for v1 source testing and sync so the system stays repo-feasible without claiming live provider connector coverage that is not yet implemented.
