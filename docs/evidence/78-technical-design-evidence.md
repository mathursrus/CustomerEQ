# Technical Design Evidence — Issue #78: Unified CX+Loyalty Operator Dashboard

**RFC**: `docs/rfcs/78-unified-cx-loyalty-dashboard.md`
**Branch**: `feature/3-issue-3`
**Date**: 2026-04-03
**Head commit**: `835a802`

---

## Summary

Full technical design completed for the Unified CX+Loyalty Operator Dashboard. The RFC specifies a new `/admin` home dashboard with two side-by-side health panels, a rule-based insights section, and click-through navigation to the pre-filtered campaign builder. All requirements (R28–R30) and acceptance criteria (AC1–AC5) are covered. No new Prisma models required — all data computable from existing schema.

---

## Design Decisions

| Decision | Rationale |
|---|---|
| RSC + server-side fetch for `/admin/page.tsx` | Matches §3.1 pattern; avoids client-side waterfall; Clerk token available server-side |
| Single `GET /v1/analytics/program-health` endpoint | Minimizes round-trips; fixed 30d/7d windows match UX copy; no query params needed |
| `Promise.all` for 4 sub-queries | Existing pattern in `analytics.ts:117`; prevents sequential waterfall under 5s timeout |
| Rule-based insights engine (no LLM) | No latency, no API cost, deterministic; LLM enhancement deferred as follow-on issue |
| `searchParams` pre-fill for campaign builder | No extra API round-trip; operator is authenticated so no security concern |
| Partial data on sub-query failure | Never 5xx for unavailable stat; `warnings[]` array surfaces failures gracefully |
| `activeMembers` as `responseRate` denominator | Approximation for MVP (OQ-3); refinable when `SurveyInvite` table added |

---

## Spike Results

No spike was required. All data exists in current DB schema (SurveyResponse, Member, LoyaltyEvent, Redemption, Campaign, Survey). Design confidence: **88/100**.

---

## Traceability Matrix

| Requirement / Acceptance Criteria | RFC Section | Designed Artifact | Status |
|---|---|---|---|
| **R28** — Two side-by-side panels: CX Health (avg NPS, active surveys, response rate, at-risk count) + Loyalty Health (active members, points this week, redemption rate, active campaigns) | "UI Changes" → Component structure; "API Surface Changes" → `cxHealth` + `loyaltyHealth` response shape | `AdminHomePage → ProgramHealthPanels → CXHealthPanel + LoyaltyHealthPanel`; `GET /v1/analytics/program-health` response fields | Met |
| **R29** — Insights section connecting CX signals to loyalty outcomes (1–3 pre-computed insights with CTAs) | "Insights Rules Engine" section; `insights[]` array in response shape | `InsightsSection → InsightCard[]`; 3 rule templates: `detractors-no-redemption`, `survey-completers-earn-more`, `low-response-rate`; `computeInsights()` pure function | Met |
| **R30** — Click-through from CX metric (at-risk badge) to pre-filtered campaign builder | "Modified: campaign builder `searchParams`"; `ctaHref` field in insight shape; `AtRiskBadge` component | `AtRiskBadge` → `/admin/campaigns/new?filter=detractors&maxNps=6`; `ctaHref` in `insights[]` response; campaign builder accepts `filter`, `minNps`, `maxNps` searchParams | Met |
| **AC1** — CX Health and Loyalty Health panels visible side by side | "Design Standards" → `grid grid-cols-1 md:grid-cols-2 gap-6` | `ProgramHealthPanels` two-column grid | Met |
| **AC2** — At least one insight card visible when qualifying data exists | "Insights Rules Engine" table — rules evaluated in priority order; at most 3 shown | `detractors-no-redemption` fires when `atRiskCount > 0`; min threshold: `atRiskCount ≥ 5` | Met |
| **AC3** — Clicking insight CTA navigates to campaign builder with `filter=detractors` pre-populated | "Modified: campaign builder" + `ctaHref` in response shape | `ctaHref: '/admin/campaigns/new?filter=detractors&maxNps=6'`; campaign builder reads `searchParams.filter` and pre-populates segment condition | Met |
| **AC4** — Dashboard loads within 3 seconds | "Failure Modes & Timeouts" — 5s Fastify `requestTimeout`; "Observability" — sub-query > 2s logged at warn | `Promise.all` parallel queries; integration test asserts `< 3000ms`; E2E test measures `performance.timing` | Met |
| **AC5** — Empty states defined for no-survey and no-campaign scenarios | "Empty states" section in UX description | CX Health empty: `data-testid="cx-health-empty"` with "No surveys yet" CTA; Loyalty Health empty: `data-testid="loyalty-health-empty"` with "No campaigns active" CTA; both panels show zero-state for no-member | Met |

---

## Validation Plan Coverage

All scenarios in the RFC Validation Plan map to test types:

| Scenario | Test Type | Artifact |
|---|---|---|
| Manager opens admin home, panels visible | E2E | `apps/web/test/e2e/unified-dashboard.spec.ts` |
| No surveys → CX Health empty state | E2E | `unified-dashboard.spec.ts` |
| No campaigns → Loyalty Health empty state | E2E | `unified-dashboard.spec.ts` |
| 18 detractors with no redemption → correct insight | Integration | `apps/api/test/integration/analytics.test.ts` |
| Click CTA → navigates to pre-filtered builder | E2E | `unified-dashboard.spec.ts` |
| Dashboard load < 3s | Integration + E2E | `analytics.test.ts` + `unified-dashboard.spec.ts` |
| Sub-query failure → 200 with `warnings[]` | Integration | `analytics.test.ts` |
| `computeInsights()` rule conditions | Unit | `packages/shared` or `apps/api/src/` |

---

## Architecture Gap Analysis

| Gap | RFC Response |
|---|---|
| Admin home route not documented in §3.1 | Proposed update: "note `/admin/page.tsx` as operator home; `/admin/analytics` remains drill-down" |
| Rule-based insights engine pattern missing from §3.2–3.3 | Proposed note in §4.1: "Insights computed in-process by `computeInsights()` — deterministic; LLM deferred" |
| URL-state-to-form-preload pattern undocumented | Proposed addition to §3.1 Web App patterns |

No patterns incorrectly followed.

---

## Open Questions Resolved

| ID | Question | Decision |
|---|---|---|
| OQ-1 | Replace or coexist alongside `/admin/analytics`? | Replace as home; `/admin/analytics` stays as drill-down |
| OQ-2 | LLM vs rule-based insights? | Rule-based for MVP; LLM deferred |
| OQ-3 | `responseRate` denominator? | `activeMembers` approximation; document in code |
