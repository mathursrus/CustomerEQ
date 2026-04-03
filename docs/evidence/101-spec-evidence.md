# Feature Specification: Support Widget — Embeddable Chat with Rule-Based Response Engine
Issue: #101
PR: TBD (will be created during submission)

## Completeness Evidence
- Issue tagged with label `phase:spec`: Yes
- Issue tagged with label `status:needs-review`: Yes
- All specification documents committed/synced to branch: Yes

### Customer Research

| Customer Research Area | Sources of Information |
|---|---|
| Mid-market CX program managers need real-time AI support | `docs/business-development/business-validation-report-cx-loyalty-platform-2026-03-24.md` |
| Existing codebase capabilities and gaps | `docs/brainstorming/codebase-brainstorming-2026-04-03.md` — S7 and S8 sections |
| Embed pattern (Web Component + Shadow DOM) | `packages/embed/src/ceq-spin-wheel.ts` — existing component pattern |
| Widget.js delivery pattern | `apps/api/src/routes/public.ts:392` — survey widget endpoint |
| Condition builder reuse | `apps/web/src/components/ui/condition-builder.tsx` — reusable AND/OR condition editor |
| Condition evaluation logic | `packages/shared/src/conditions.ts` — `evaluateConditions()` function |
| AlertRule + CaseFollowUp models | `packages/database/prisma/schema.prisma:475-543` — existing rule and case models |
| Campaign trigger evaluation | `apps/api/src/routes/events.ts:112-142` — condition matching on event payloads |
| Competitive landscape | Web research: Intercom Fin AI ($0.99/resolution), Zendesk AI Agents, Freshdesk Freddy, Annex Cloud, Yotpo |

### Spec Deliverables

| Deliverable | Path | Status |
|---|---|---|
| Feature specification | `docs/feature-specs/101-support-widget-chat-rule-engine.md` | Complete |
| Widget chat mock (member-facing) | `docs/feature-specs/mocks/101-widget-chat.html` | Complete, validated in browser |
| Admin support rules mock | `docs/feature-specs/mocks/101-admin-support-rules.html` | Complete, validated in browser |
| Admin support analytics mock | `docs/feature-specs/mocks/101-admin-support-analytics.html` | Complete, validated in browser |

### Spec Sections Completed

- Customer + Desired Outcome + Problem Being Solved
- User Experience (5 detailed flows: widget install, member chat, message orchestration, admin rules, admin analytics)
- Data Model (Conversation, Message, SupportRule)
- Real-Time Communication (SSE with polling fallback)
- API Endpoints (12 endpoints — public + admin)
- Integration Points (7 existing system touchpoints)
- Requirements (14 SHALL-style requirements with acceptance criteria)
- Error States (7 scenarios)
- UI Mocks (3 interactive HTML files)
- Design Standards Applied (generic UI baseline)
- Compliance Requirements (5 — GDPR erasure, consent, multi-tenant, data retention, no secrets)
- Validation Plan (unit, integration, E2E, BAML eval, compliance tests)
- Alternatives (5 alternatives with rationale for discarding)
- Competitive Analysis (5 competitors with pricing, strengths, weaknesses, differentiation strategy)

### PR Comments

| PR Comment | How Addressed |
|---|---|
| N/A — first submission | N/A |

## Continuous Learning

| Learning | Agent Rule Updates |
|---|---|
| No new learnings to record from this spec phase | N/A |
