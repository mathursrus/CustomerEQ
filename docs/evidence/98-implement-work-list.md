# Implementation Work List — Issue #98: CRM Core (Customer 360, Search, KYC Synthesis)

## Issue Type: Feature

## Implementation Checklist

### 1. Zod Schemas (packages/shared/src/zod/member.schema.ts)
- [ ] Add `SearchMembersQuerySchema` with all query params (q, tier, sentimentMin/Max, npsMin/Max, balanceMin/Max, status, date range, page/pageSize, sortBy/sortOrder)
- [ ] Add `Customer360QuerySchema` with sub-collection limits (eventsLimit, surveysLimit, redemptionsLimit, campaignEventsLimit)
- [ ] Export `Customer360Response` type for BAML wrapper consumption
- [ ] Export types from `packages/shared/src/index.ts` (already re-exports member.schema)

### 2. BAML Function (packages/ai/baml_src/synthesize_profile.baml)
- [ ] Define `CustomerContext` class
- [ ] Define `CustomerProfileSynthesis` class
- [ ] Define `SynthesizeCustomerProfile` function with GPT4o client
- [ ] Run `pnpm baml generate` to update generated types

### 3. BAML TypeScript Wrapper (packages/ai/src/analysis/synthesize-profile.ts)
- [ ] Define `CustomerContext` and `CustomerProfileSynthesis` interfaces
- [ ] Implement `buildCustomerContext()` — transforms 360 response, strips PII
- [ ] Implement `synthesizeCustomerProfile()` — calls BAML function
- [ ] Export from packages/ai/src/index.ts (if needed)

### 4. API: GET /v1/members/:id/360 (apps/api/src/routes/members.ts)
- [ ] Add Customer360QuerySchema parse
- [ ] Fetch member with tier include
- [ ] PII masking for erased members
- [ ] Promise.all for parallel sub-collection queries (events, surveys, redemptions, campaign events, open cases, stats)
- [ ] Compute summary stats (totalPointsEarned, totalPointsRedeemed, avgSentiment)
- [ ] Build response with hasMore flags
- [ ] Audit log for 360 access (fire-and-forget)
- [ ] Pino log: member.360.fetched, member.360.erased

### 5. API: GET /v1/members (apps/api/src/routes/members.ts)
- [ ] Add SearchMembersQuerySchema parse
- [ ] Build Prisma where clause with text search (ILIKE), tier, status, balance, date range filters
- [ ] Survey filter via Prisma `some` relational filter
- [ ] Sort mapping with post-query sentiment sort
- [ ] Pagination (page/pageSize)
- [ ] PII masking for erased members in results
- [ ] Pino log: member.search.executed

### 6. MCP Tools (apps/mcp-server/src/tools/members.ts)
- [ ] Add `get_customer_360` tool
- [ ] Add `search_members` tool

### 7. Tests
- [ ] Unit tests: SearchMembersQuerySchema + Customer360QuerySchema validation (packages/shared)
- [ ] Unit tests: buildCustomerContext() transforms (packages/ai)
- [ ] Integration tests: GET /v1/members/:id/360 (apps/api/test/integration/members.test.ts)
- [ ] Integration tests: GET /v1/members search (apps/api/test/integration/members.test.ts)
- [ ] Test factory: createMemberWith360Data in packages/config/src/test-utils/factories/member.factory.ts

## Validation Requirements
- uiValidationRequired: false (no UI components)
- mobileValidationRequired: false
- API validation via integration tests + manual curl
- BAML eval tests (requires OPENAI_API_KEY, runs in test:baml)

## Known Deferrals
- Health score field in 360 response: deferred to Phase B
- KYC caching: deferred (on-demand for now)
- tsvector search: deferred unless performance degrades
- Denormalized latestSentiment column: deferred unless needed

## Dependencies
- No schema migration needed
- All Prisma relations already exist
- BAML generated types needed after .baml file creation
