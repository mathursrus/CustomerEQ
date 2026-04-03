# Feature Specification: CRM Core — Customer 360 API, Search, and KYC Synthesis
Issue: #98
PR: https://github.com/mathursrus/CustomerEQ/pull/102

## Summary
- **Issue:** #98 — Phase A: CRM Core — Customer 360 API, Search, and KYC Synthesis
- **Workflow type:** Feature specification (spec)
- **Description:** Created comprehensive product specification for three capabilities: Customer 360 API endpoint, member search with behavioral filters, and LLM-powered KYC synthesis via BAML.

## Work Completed
- **Spec document:** `docs/feature-specs/98-customer-360-search-kyc.md`
- **Approach:** Analyzed existing codebase (members routes, MCP tools, BAML functions, Prisma schema), reviewed architecture docs, conducted web-based competitive research, and drafted spec following FRAIM template.
- **Key deliverables in spec:**
  - 14 SHALL-style requirements (7 functional, 4 data/state constraints, 3 non-functional)
  - All requirements have Given/When/Then acceptance criteria
  - 3 UX flows documented (360 API, Search, KYC Synthesis)
  - Full API response schemas for all endpoints
  - Mermaid data flow diagram
  - GDPR (4 controls) and CCPA (2 controls) compliance section
  - 6 competitors researched with web-sourced evidence (Annex Cloud, Salesforce, Yotpo, Brierley/Capillary, Open Loyalty, HubSpot)
  - 5 alternatives evaluated and discarded with rationale
  - 4 open questions documented for human review
  - Comprehensive validation plan (API, MCP, BAML evals, compliance)

## Completeness Evidence
- Issue tagged with label `phase:spec`: Pending (will be set on submission)
- Issue tagged with label `status:needs-review`: Pending (will be set on submission)
- All specification documents committed/synced to branch: Yes

| Customer Research Area | Sources of Information |
|------------------------|----------------------|
| Existing codebase capabilities | `apps/api/src/routes/members.ts`, `apps/mcp-server/src/tools/members.ts`, `packages/ai/baml_src/*.baml`, `packages/database/prisma/schema.prisma` |
| Architecture and tech stack | `docs/architecture/architecture.md` |
| Feature gap analysis | `docs/brainstorming/codebase-brainstorming-2026-04-03.md` |
| Competitor: Annex Cloud | [GetApp listing](https://www.getapp.com/customer-management-software/a/annex-cloud/), [Capabilities page](https://www.annexcloud.com/capabilities-overview/) |
| Competitor: Salesforce Einstein | [Einstein Customer 360](https://www.itechcloudsolution.com/blogs/salesforce-einstein-customer-360/), [Einstein Overview](https://www.salesforce.com/products/einstein/overview/) |
| Competitor: Yotpo | [Loyalty API Reference](https://loyaltyapi.yotpo.com/reference/fetch-customer-details), [Platform page](https://www.yotpo.com/) |
| Competitor: Brierley/Capillary | [Intelligent Loyalty Platform](https://www.brierley.com/intelligent-loyalty) |
| Competitor: Open Loyalty | [Comparison guide](https://www.openloyalty.io/insider/best-loyalty-software-comparison-guide) |
| Market trends (Customer 360 in 2026) | [Treasure Data blog](https://www.treasuredata.com/blog/customer-360), [Composio API patterns](https://composio.dev/content/apis-ai-agents-integration-patterns) |
| Compliance requirements | `fraim/config.json` (gdpr=true, ccpa=true), project rules #6 and #13 |

| PR Comment | How Addressed |
|------------|---------------|
| (No feedback yet) | N/A |

## Validation
- All 6 issue acceptance criteria mapped to specific requirements (R1-R14)
- Compliance section covers GDPR and CCPA with specific controls
- Edge cases documented: empty data, erased members, soft deletes, cross-brand access, non-existent members
- Spec reviewed for completeness against FRAIM feature-spec template

## Quality Checks
- All deliverables complete (spec document with all template sections)
- Documentation clear and professional
- No UI mocks needed (API/backend feature)
- Work ready for human review

## Phase Completion
- context-gathering: Complete — analyzed issue, codebase, architecture, compliance
- spec-drafting: Complete — created full spec with 14 requirements, response schemas, data flow diagram
- competitor-analysis: Complete — 6 competitors researched with web sources
- spec-completeness-review: Complete — all ACs mapped, compliance covered, edge cases documented

## Continuous Learning

| Learning | Agent Rule Updates |
|----------|-------------------|
| Feature specs for API-only features do not need HTML mocks but should include detailed response schemas | No rule update needed — this is expected behavior |
| Competitive analysis benefits from web research to ground claims with sources rather than relying on domain knowledge alone | No rule update needed — FRAIM skill already encourages source citation |
