# Feature: CRM Core — Customer 360 API, Search, and KYC Synthesis
Issue: #98
Feature Spec: `docs/feature-specs/98-customer-360-search-kyc.md` (on branch)
PR: #102

## Completeness Evidence
 - Issue tagged with label `phase:design`: Yes
 - Issue tagged with label `status:needs-review`: No (removed during phase transition)
 - All files committed/synced to branch: Pending (RFC written, needs commit)

| PR Comment | How Addressed |
|---|---|
| (No prior feedback) | N/A |

### Traceability Matrix

| Requirement/User Story | RFC Section/Data Model | Status | Validation Plan Alignment |
|---|---|---|---|
| **R1**: `GET /v1/members/:id/360` returns aggregated member profile with loyalty events, survey responses, redemptions, campaign events, tier details, and open cases | Section 3.1: Full endpoint implementation with Prisma `include` and `Promise.all` parallel queries | Met | API test: call 360 for active member, verify all sub-collections present |
| **R2**: 360 endpoint paginates sub-collections with configurable `limit` query params | Section 3.1: `Customer360QuerySchema` with `eventsLimit`, `surveysLimit`, `redemptionsLimit`, `campaignEventsLimit`; `take: limit + 1` pattern for `hasMore` detection | Met | API test: call 360 with `eventsLimit=5` for member with 20 events, verify 5 returned with `hasMore: true` |
| **R3**: `GET /v1/members` supports text search across firstName, lastName, email via `q` param | Section 3.2: Prisma `contains` with `mode: 'insensitive'` on `OR` clause across three fields | Met | API test: search with `q=ali`, verify matching members returned |
| **R4**: `GET /v1/members` supports behavioral filters: tier, sentimentMin/Max, npsMin/Max, balanceMin/Max, status, enrolledAfter/Before | Section 3.2: `SearchMembersQuerySchema` with all filters; Prisma `where` clause building; sentiment/NPS via relational `some` filter on `SurveyResponse` | Met | API test: search with `npsMin=9&sentimentMax=-0.3`, verify only at-risk promoters returned |
| **R5**: `SynthesizeCustomerProfile` BAML function produces structured output with engagementLevel, sentimentTrajectory, preferences, riskSignals, recommendedActions, summary | Section 5.1: Full BAML function definition with `CustomerContext` input and `CustomerProfileSynthesis` output classes | Met | BAML eval test: invoke with high-engagement member data, verify all 6 fields populated |
| **R6**: `get_customer_360` MCP tool registered and calls 360 API | Section 4.1: MCP tool with Zod schema, `apiFetch` to `/v1/members/:id/360` | Met | MCP tool test: invoke with valid memberId, verify formatted 360 data returned |
| **R7**: `search_members` MCP tool registered and supports all filter params | Section 4.2: MCP tool with Zod schema for all filter params, `apiFetch` to `/v1/members` | Met | MCP tool test: invoke with filters, verify matching results |
| **R8**: All endpoints scope queries by `brandId` from JWT | Section 3.3: Both endpoints use `request.brandId` from verified JWT; all Prisma queries include `brandId: request.brandId` | Met | API test: verify cross-brand access returns 404/empty |
| **R9**: All queries exclude soft-deleted records (`deletedAt IS NULL`) | Section 3.1 & 3.2: All member queries include `deletedAt: null` | Met | API test: soft-deleted member not returned in search or 360 |
| **R10**: Erased members have PII replaced with `[ERASED]` | Section 3.1: PII masking at response layer for 360; Section 3.2: PII masking in search results | Met | API test: call 360 and search for erased member, verify `[ERASED]` |
| **R11**: Search by sentiment/NPS aggregates from SurveyResponse table | Section 3.2: Prisma `surveyResponses: { some: surveyFilter }` relational filter | Met | API test: filter by sentiment/NPS, verify results based on actual survey data |
| **R12**: 360 response time under 500ms for typical member | Section 3.1: `Promise.all` parallel queries; existing indexes; Risks section documents monitoring plan | Met | Performance test: populated member, verify <500ms response |
| **R13**: Search supports page-based pagination with default 20, max 100 | Section 3.2: `SearchMembersQuerySchema` with `page` (default 1), `pageSize` (default 20, max 100); standard envelope `{ data, total, page, pageSize, totalPages }` | Met | API test: verify pagination with `page=3&pageSize=5` |
| **R14**: BAML KYC function uses GPT-4o client | Section 5.1: `client GPT4o` in BAML function definition | Met | BAML eval test: verify function uses GPT4o client |
| **C-GDPR-1**: Erased members have PII zeroed in responses | Section 3.1 & 3.2: PII masking for erased members | Met | API test: erased member returns `[ERASED]` |
| **C-GDPR-2**: Soft-deleted members excluded by default | Section 3.1 & 3.2: `deletedAt: null` in all queries | Met | API test: soft-deleted member not found |
| **C-GDPR-3**: Consent validated | Section 3.1: 360 response includes `consentGivenAt` and `consentVersion` | Met | API test: verify consent fields in 360 response |
| **C-GDPR-4**: KYC synthesis does not persist PII | Section 5.1 & 5.2: `CustomerContext` strips PII before BAML; BAML prompt contains no PII | Met | Unit test: `buildCustomerContext()` output contains no PII |
| **C-CCPA-1**: Search results do not expose PII of erased members | Section 3.2: Erased member PII masking in search | Met | API test: erased member in search shows `[ERASED]` |
| **C-CCPA-2**: Data access logging for 360 | Observability section: fire-and-forget `AuditEvent` creation for 360 access | Met | Integration test: verify AuditEvent created after 360 call |
| **UX Flow 1**: Customer 360 API | Section 3.1: Full endpoint implementation | Met | API integration tests (8 scenarios) |
| **UX Flow 2**: Customer Search | Section 3.2: Full endpoint implementation | Met | API integration tests (14 scenarios) |
| **UX Flow 3**: KYC Synthesis | Section 5.1 & 5.2: BAML function + TypeScript wrapper | Met | BAML eval tests (4 scenarios) |
| **Spec Validation Plan**: API validation (Supertest) | Test Matrix: Integration tests extend `members.test.ts` | Met | 22+ test scenarios mapped |
| **Spec Validation Plan**: MCP tool validation | Test Matrix: MCP tool tests for both tools | Met | 2 MCP test scenarios |
| **Spec Validation Plan**: BAML eval tests | Test Matrix: 4 BAML eval scenarios | Met | High-engagement, declining, minimal, dormant member contexts |
| **Spec Validation Plan**: Compliance validation | Test Matrix: Erased PII masking, soft-delete exclusion, brandId scoping, audit logging | Met | 4 compliance test scenarios |

**Traceability Matrix Result: PASS** — All 27 requirements (14 functional, 6 compliance, 3 UX flows, 4 validation plan items) are Met with corresponding RFC sections and test coverage.

### Architecture Gaps (for PR review)

| Gap | Category | Impact | Suggested Resolution |
|---|---|---|---|
| Behavioral search / relational filtering pattern not documented | Missing from Architecture | Low — pattern is standard Prisma, just undocumented | Add note to Section 4.1 about `some`/`every` relational filters for list endpoints |
| In-memory post-query sort for related model fields | Missing from Architecture | Low — only affects sentiment sort, acceptable for mid-market volumes | Document as known limitation with threshold for raw SQL migration |

Neither gap blocks the design. Both are documentation improvements to be made during address-feedback phase.

## Due Diligence Evidence
 - Reviewed feature spec in detail (if feature spec present): Yes (read full spec from branch)
 - Reviewed code base in detail to understand and repro the issue: Yes (read members.ts routes, MCP tools, Prisma schema, BAML files, architecture doc, test factories, integration tests, api-client)
 - Included detailed design, validation plan, test strategy in doc: Yes

## Prototype & Validation Evidence
 - [x] No prototype needed — all patterns used are proven in existing codebase
 - [ ] Built simple proof-of-concept that works end-to-end — N/A (design phase only)
 - [ ] Manually tested complete user flow (browser/curl) — N/A (design phase only)
 - [x] Verified solution actually works before designing architecture — all Prisma patterns validated against existing working code
 - [x] Identified minimal viable implementation — no schema changes, no new packages, purely additive
 - [x] Documented what works vs. what's overengineered — documented ILIKE vs tsvector, on-demand vs cached KYC decisions

## Continuous Learning

| Learning | Agent Rule Updates |
|---|---|
| Architecture doc mandates standard pagination envelope `{ data, total, page, pageSize, totalPages }` — caught deviation during gap review | N/A (existing rule in architecture doc) |
| CaseFollowUp has `memberId` field but no Prisma relation to Member — separate query is simpler than adding relation | N/A (documented in RFC for implementation phase) |
