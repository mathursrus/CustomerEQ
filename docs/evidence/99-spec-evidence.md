# Feature Specification: Customer Health Score
Issue: #99
PR: (to be linked after PR creation)

## Completeness Evidence
- Issue tagged with label `phase:spec`: Yes
- Issue tagged with label `status:needs-review`: Yes
- All specification documents committed/synced to branch: Yes

### Customer Research

| Customer Research Area | Sources of Information |
|------------------------|-----------------------|
| Customer problem (CX managers need proactive churn identification) | Issue #99 description, brainstorming doc `docs/brainstorming/codebase-brainstorming-2026-04-03.md` |
| Existing data signals (LoyaltyEvent, SurveyResponse, Redemption, CampaignEvent) | Prisma schema analysis (`packages/database/prisma/schema.prisma`) |
| BullMQ queue pattern for batch processing | `apps/api/src/queues/bullmq.ts` (6 existing queues with inline/Redis dual mode) |
| Current member API endpoints | `apps/api/src/routes/members.ts` (GET /members/:id, GET /members/me) |
| Customer 360 gap analysis | `docs/brainstorming/codebase-brainstorming-2026-04-03.md` (no 360 aggregation exists yet) |
| Competitor health scoring approaches | Web research: Gainsight Scorecards, Totango SuccessBLOCs, ChurnZero ChurnScores, Annex Cloud RFM |
| Compliance requirements (GDPR, CCPA) | `fraim/config.json` compliance config, project rules #6 (multi-tenant), #7 (ledger integrity), #13 (GDPR/CCPA) |

### Feedback History

| PR Comment | How Addressed |
|-----------|---------------|
| (No feedback received yet — initial submission) | N/A |

## Deliverables

| Artifact | Path | Description |
|----------|------|-------------|
| Feature Specification | `docs/feature-specs/99-customer-health-score.md` | Complete spec with requirements, scoring formula, compliance, competitive analysis |
| UI Mock: 360 View | `docs/feature-specs/mocks/99-health-score-360.html` | Health score badge, component breakdown, activity timeline |
| UI Mock: Member List | `docs/feature-specs/mocks/99-health-score-list.html` | Sortable health score column, range filters, quick-filter presets |

## Validation

- Spec covers all 7 acceptance criteria from issue #99
- 11 functional requirements with SHALL-style language and Given/When/Then acceptance criteria
- 6 edge cases documented
- 5 compliance controls mapped to GDPR, CCPA, multi-tenant, consent, and SOC2
- Scoring formula documented with 5 weighted components and configurable weights
- Competitive analysis covers 4 competitors with web-sourced evidence
- Data flow diagram (Mermaid) showing trigger-to-consumer path
- 2 HTML/CSS mocks using Tailwind v4 + shadcn/ui patterns

## Continuous Learning

| Learning | Agent Rule Updates |
|----------|-------------------|
| Customer 360 endpoint does not exist yet (Phase A dependency) — spec should document dependency assumptions explicitly | No rule update needed; documented in Open Questions section |
| Existing BullMQ pattern supports both inline and Redis modes — new queues must follow this dual-mode pattern | No rule update needed; pattern already well-established in codebase |
