# Bug Bash Report - Issue #113: External Signal Hub

Issue: `113`
Branch: `feature/issue-113-social-review-ingestion-spec`

## Bug Summary

| Severity | Found | Fixed | Deferred |
|---|---|---|---|
| P0 | 3 | 3 | 0 |
| P1 | 6 | 5 | 1 |
| P2 | 7 | 2 | 5 |

## P0 Fixes Applied

| ID | File | Bug | Fix |
|---|---|---|---|
| BUG-1 | `routes/externalSignals.ts:81-108` | `search + date` filter OR-mutation corrupts query — date clauses merged into search OR, making combined filter nearly always true | Moved date filter into `where.AND` so search and date are independent |
| BUG-2 | `processors/externalSignalIngestion.ts:78-170` | Non-atomic find+create/update causes P2002 unique constraint crash under concurrent webhook deliveries | Replaced with Prisma `upsert` on `sourceId_externalId` unique key |
| BUG-3 | `processors/externalSignalIngestion.ts:93-101` | `statusHistory` JSON array grows unbounded — no cap or trim | Added `MAX_STATUS_HISTORY = 50` cap via `.slice(-MAX_STATUS_HISTORY)` |

## P1 Fixes Applied

| ID | File | Bug | Fix |
|---|---|---|---|
| BUG-6 | `routes/webhooks.ts:65-74` | `safeSecretEquals` leaks secret length via timing — returns early on length mismatch before `timingSafeEqual` | Replaced with HMAC-based comparison that normalizes both values to 32 bytes |
| BUG-7 | `routes/webhooks.ts:114,205` | Empty `SALESFORCE_WEBHOOK_SECRET`/`HUBSPOT_WEBHOOK_SECRET` allows HMAC bypass with empty-key computation | Added guard: return 500 with error log if secret env var is empty |
| BUG-8 | `routes/webhooks.ts:145,236` | `x-brand-id` header fallback allows brand injection when env var not set | Removed header fallback; require env var, return 500 if not configured |
| BUG-12 | `externalSignal.schema.ts:34` | `samplePayloads` array has no length limit — attacker can POST 100k items for sync normalization | Added `.max(50)` to schema |
| BUG-15 | `externalSignal.schema.ts:54` | `search` query has no max length — 1MB search triggers expensive LIKE scans | Added `.max(200)` to schema |

## P1 Deferred

| ID | File | Bug | Reason |
|---|---|---|---|
| BUG-4 | `routes/webhooks.ts:286-294` | Source existence oracle via 404 before secret check | Low practical risk; would require restructuring auth flow |

## P2 Deferred

| ID | File | Bug | Reason |
|---|---|---|---|
| BUG-5 | `routes/webhooks.ts:290-295` | No-credential sources accept unauthenticated payloads | By design for some sources; needs rate-limiting strategy |
| BUG-9 | `processors/externalSignalIngestion.ts:131` | `postedAt` accepts invalid date strings | Edge case; Prisma coerces to null |
| BUG-10 | `routes/analytics.ts:374-386` | Hard-coded 1000-row in-memory aggregation | Performance concern; needs DB-level aggregation redesign |
| BUG-11 | `shared/externalSignals.ts:99-106` | 32-bit hash fallback externalId has collision risk at ~65k items | Low volume in v1; needs UUID-based fallback for scale |
| BUG-13 | `queues/bullmq.ts:901-911` | Inline sync errors not reflected in source health | Known inline-mode limitation |
| BUG-14 | `externalSignal.schema.ts:25` | PATCH silently clears credentialRef | Needs audit log infrastructure |
| BUG-16 | `routes/webhooks.ts:286` | Disabled source returns 404 causing sender to stop retrying | Needs 503 response; requires sender-side awareness |

## Test Coverage Gaps Identified

30 coverage gaps documented across 7 test files. Key gaps:
- No cross-brand tenant isolation tests for external signal sources
- No HubSpot happy-path integration test
- No test for source update/delete operations
- No member lookup miss path in ingestion tests
- Mobile e2e tests are screenshot-only with no behavioral assertions

## Infrastructure Changes

| File | Change |
|---|---|
| `packages/config/src/test-utils/mocks/database.mock.ts` | Added `upsert` to `externalSignal` mock |
| `apps/worker/src/processors/externalSignalIngestion.test.ts` | Updated tests to assert on `upsert` instead of `create`/`update` |
