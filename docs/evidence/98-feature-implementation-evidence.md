# Feature Implementation Evidence — Issue #98: CRM Core (Customer 360, Search, KYC Synthesis)

## Summary

Implemented Customer 360 API, Member Search, and KYC Synthesis (BAML) as specified in RFC `docs/rfcs/98-customer-360-search-kyc.md`. All code follows existing architectural patterns. No schema migration required.

## Files Changed

| File | Change |
|---|---|
| `packages/shared/src/zod/member.schema.ts` | Added `SearchMembersQuerySchema`, `Customer360QuerySchema`, `Customer360Response` type |
| `packages/ai/baml_src/synthesize_profile.baml` | New BAML function `SynthesizeCustomerProfile` with `CustomerContext` and `CustomerProfileSynthesis` classes |
| `packages/ai/src/analysis/synthesize-profile.ts` | TypeScript wrapper: `buildCustomerContext()`, `synthesizeCustomerProfile()` |
| `apps/api/src/routes/members.ts` | Added `GET /v1/members/:id/360` and `GET /v1/members` endpoints |
| `apps/mcp-server/src/tools/members.ts` | Added `get_customer_360` and `search_members` MCP tools |
| `packages/config/src/test-utils/factories/member.factory.ts` | Added `createErasedMember()` factory |
| `packages/config/src/test-utils/factories/campaign.factory.ts` | Added `createCampaignEvent()` factory |
| `packages/config/src/test-utils/index.ts` | Exported new factories |

## Traceability Matrix

| Requirement | Implemented File/Function | Proof (Test/Evidence) | Status |
|---|---|---|---|
| GET /v1/members/:id/360 endpoint | `apps/api/src/routes/members.ts` (line 254) | Integration: "returns 200 with all sub-collections populated" | Met |
| 360: Parallel sub-collection queries via Promise.all | `apps/api/src/routes/members.ts` (line 268) | Integration: verified response includes events, surveys, redemptions, campaigns, cases | Met |
| 360: Configurable limits with hasMore pagination | `apps/api/src/routes/members.ts` (line 255) | Integration: "respects eventsLimit parameter and sets hasMore" | Met |
| 360: PII masking for erased members | `apps/api/src/routes/members.ts` (line 262) | Integration: "masks PII for erased members" — email/name/phone=[ERASED] | Met |
| 360: 404 for non-existent member | `apps/api/src/routes/members.ts` (line 260) | Integration: "returns 404 for non-existent member" | Met |
| 360: Brand isolation (tenant scoping) | `apps/api/src/routes/members.ts` (line 258) | Integration: "returns 404 when accessing member from different brand" | Met |
| 360: Audit log for access | `apps/api/src/routes/members.ts` (line 315) | Code review: fire-and-forget auditEvent.create() | Met |
| 360: Pino logging | `apps/api/src/routes/members.ts` (lines 322-328) | Log output in integration test runs | Met |
| GET /v1/members search endpoint | `apps/api/src/routes/members.ts` (line 339) | Integration: "returns paginated results with default params" | Met |
| Search: Text search (q param, ILIKE) | `apps/api/src/routes/members.ts` (line 349) | Integration: "searches by name", "searches by email" | Met |
| Search: Tier filter | `apps/api/src/routes/members.ts` (line 358) | Integration: "filters by tier name" | Met |
| Search: Status filter | `apps/api/src/routes/members.ts` (line 361) | Integration: "filters by status" | Met |
| Search: Balance range filter | `apps/api/src/routes/members.ts` (line 362) | Integration: "filters by points balance range" | Met |
| Search: NPS range filter (via survey) | `apps/api/src/routes/members.ts` (line 373) | Integration: "filters by NPS score range via survey responses" | Met |
| Search: Pagination (page/pageSize) | `apps/api/src/routes/members.ts` (line 392) | Integration: "paginates correctly with page and pageSize" | Met |
| Search: Sort by columns | `apps/api/src/routes/members.ts` (line 384) | Integration: "sorts by pointsBalance ascending" | Met |
| Search: PII masking for erased | `apps/api/src/routes/members.ts` (line 402) | Integration: "filters by status" verifies [ERASED] PII | Met |
| Search: Brand isolation | `apps/api/src/routes/members.ts` (line 345) | Integration: "enforces brand isolation in search" | Met |
| Search: Soft-deleted exclusion | `apps/api/src/routes/members.ts` (line 346) | Integration: "excludes soft-deleted members" | Met |
| SearchMembersQuerySchema Zod | `packages/shared/src/zod/member.schema.ts` | Unit: 11 tests in member.schema.test.ts | Met |
| Customer360QuerySchema Zod | `packages/shared/src/zod/member.schema.ts` | Unit: 5 tests in member.schema.test.ts | Met |
| Customer360Response type | `packages/shared/src/zod/member.schema.ts` | TypeScript compile check (typecheck 13/13) | Met |
| BAML SynthesizeCustomerProfile | `packages/ai/baml_src/synthesize_profile.baml` | BAML generate successful, types generated | Met |
| buildCustomerContext() strips PII | `packages/ai/src/analysis/synthesize-profile.ts` | Unit: "output contains no PII fields" | Met |
| buildCustomerContext() transforms correctly | `packages/ai/src/analysis/synthesize-profile.ts` | Unit: 5 tests in synthesize-profile.test.ts | Met |
| MCP get_customer_360 tool | `apps/mcp-server/src/tools/members.ts` | Code review + build pass | Met |
| MCP search_members tool | `apps/mcp-server/src/tools/members.ts` | Code review + build pass | Met |
| createErasedMember factory | `packages/config/src/test-utils/factories/member.factory.ts` | Used in 3 integration tests | Met |
| createCampaignEvent factory | `packages/config/src/test-utils/factories/campaign.factory.ts` | Used in 360 integration test | Met |

## Validation Results

| Check | Result |
|---|---|
| `pnpm build` | 9/9 tasks pass |
| `pnpm typecheck` | 13/13 tasks pass |
| `pnpm lint` | 3/3 tasks pass |
| `pnpm test:smoke` | 11/11 tasks, 577 tests pass |
| `pnpm test:integration` | 5/5 tasks, 179 tests pass |

## Known Deferrals

- Health score field in 360 response: deferred to Phase B
- KYC caching: deferred (on-demand for now)
- tsvector search: deferred unless performance degrades
- Denormalized latestSentiment column: deferred unless needed
- BAML eval tests (SynthesizeCustomerProfile): require OPENAI_API_KEY, not run locally

## Feedback Status

No unaddressed feedback. Quality check file at `docs/evidence/98-feature-implementation-feedback.md` — all items PASS.
