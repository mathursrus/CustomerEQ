# Implementation Work List — Issue #78: Unified CX+Loyalty Operator Dashboard

**RFC**: `docs/rfcs/78-unified-cx-loyalty-dashboard.md`
**Branch**: `feature/3-issue-3`
**Date**: 2026-04-03
**Issue Type**: Feature

---

## Scope Summary

New `GET /v1/analytics/program-health` endpoint + new `/admin` home dashboard RSC + campaign builder `searchParams` pre-fill. No new Prisma models. No schema migration.

**File count**: 9 new/modified files — within single-phase limit.

---

## Patterns Discovered

| Pattern | Location | Notes |
|---|---|---|
| Fastify route handler with `Promise.all` | `apps/api/src/routes/analytics.ts:117` | Use `fastify.prisma.$queryRaw` for raw SQL aggregates |
| `request.brandId` from JWT | `analytics.ts:113` | Never from query string |
| `authenticatedRequest(brand.id)` in integration tests | `apps/api/test/integration/analytics.test.ts:35` | Supertest helper from `@customerEQ/config/test-utils` |
| `createBrand`, `createProgram`, `createConsentedMember`, `createLoyaltyEvent` | test-utils | Seed helpers for integration tests |
| `KPICard` component pattern | `apps/web/src/app/(admin)/admin/analytics/page.tsx:24` | Reuse directly |
| Client page: `'use client'` + `useAuth()` + `getAuthToken()` | `analytics/page.tsx:1-6` | Server-side fetch is preferred for RSC but client pattern exists |
| `page.route()` for API mocking in E2E | `apps/web/test/e2e/enrollment.spec.ts:27` | Use same pattern for `/v1/analytics/program-health` |
| `API_URL` from `@/lib/config` | `apps/web/src/lib/config.ts:9` | Use in all client fetch calls |
| Shared types exported from `packages/shared/src/index.ts` | `packages/shared/src/index.ts` | Add `programHealth.schema.ts` → export from index |
| `grid grid-cols-1 md:grid-cols-2 gap-6` | RFC design standards | Two-column panel grid |
| `rounded-xl border bg-white p-6` | `analytics/page.tsx:26` | KPICard base style |
| `data-testid` attributes on panels | RFC validation plan | Required for E2E assertions |

---

## Implementation Checklist

### 1. Shared Package — Response Type
- [ ] `packages/shared/src/zod/programHealth.schema.ts` — Zod schema + TypeScript type for `ProgramHealthResponse` (cxHealth, loyaltyHealth, insights[])
- [ ] `packages/shared/src/index.ts` — add `export * from './zod/programHealth.schema.js'`

### 2. API — New Endpoint
- [ ] `apps/api/src/routes/analytics.ts` — add `GET /analytics/program-health` handler:
  - `Promise.all([cxHealthQuery, loyaltyHealthQuery, atRiskQuery, insightRulesEngine])`
  - All queries scoped to `request.brandId`
  - Partial-failure: catch per-query, set field to `null`, append to `warnings[]`
  - Return `{ cxHealth, loyaltyHealth, insights, warnings? }`
- [ ] `apps/api/src/utils/computeInsights.ts` — pure function implementing 3 rules:
  - `detractors-no-redemption`: atRiskCount ≥ 5 → warning insight
  - `survey-completers-earn-more`: multiplier ≥ 1.5, ≥ 10 members → info insight
  - `low-response-rate`: responseRate < 20 AND activeSurveys > 0 → warning insight
  - Returns at most 3 insights

### 3. Web — Admin Home Dashboard
- [ ] `apps/web/src/app/(admin)/admin/page.tsx` — new client component (matches existing analytics page pattern):
  - Fetches `GET /v1/analytics/program-health` with Clerk token
  - Renders `CXHealthPanel` + `LoyaltyHealthPanel` side by side (`grid grid-cols-1 md:grid-cols-2 gap-6`)
  - Renders `InsightsSection` below panels
  - Uses existing `KPICard` inline (or extracted component)
  - `data-testid="cx-health-panel"`, `data-testid="loyalty-health-panel"`, `data-testid="cx-health-empty"`, `data-testid="loyalty-health-empty"`
  - Null values render as `—` (matching existing analytics page pattern)

### 4. Web — Campaign Builder Pre-fill
- [ ] `apps/web/src/app/(admin)/admin/campaigns/new/page.tsx` — read `filter`, `minNps`, `maxNps` from `searchParams`:
  - When `filter=detractors`: pre-populate `conditionField='nps_score'`, `conditionOperator='between'`, `conditionValue='0,6'` (or equivalent form state)
  - Only applied as initial state — user can override

### 5. Tests — Unit
- [ ] `packages/shared/src/zod/programHealth.schema.test.ts` — Zod schema validation tests for `ProgramHealthResponse`
- [ ] `apps/api/src/utils/computeInsights.test.ts` — pure unit tests for `computeInsights()`:
  - `detractors-no-redemption` fires when atRiskCount ≥ 5
  - `survey-completers-earn-more` fires when multiplier ≥ 1.5 and memberCount ≥ 10
  - `low-response-rate` fires when responseRate < 20 and activeSurveys > 0
  - At most 3 insights returned
  - Rules with no qualifying data omitted silently

### 6. Tests — Integration
- [ ] `apps/api/test/integration/analytics.test.ts` — add `GET /v1/analytics/program-health` tests:
  - 200 with correct shape (empty brand → all counts 0, insights [])
  - Seeded NPS responses → correct `avgNps` and `atRiskCount`
  - Seeded loyalty events → correct `pointsIssuedThisWeek`
  - Seeded detractors with no redemption → `detractors-no-redemption` in `insights`
  - Response time < 3000ms
  - Partial failure (mocked sub-query throw) → 200 with `warnings[]`

### 7. Tests — E2E
- [ ] `apps/web/test/e2e/unified-dashboard.spec.ts` — new E2E spec:
  - Mock `GET /v1/analytics/program-health` via `page.route()`
  - Assert `data-testid="cx-health-panel"` and `data-testid="loyalty-health-panel"` visible
  - Assert insight card visible with CTA link
  - Assert `data-testid="cx-health-empty"` visible when no surveys
  - Assert `data-testid="loyalty-health-empty"` visible when no campaigns
  - Click CTA → assert URL contains `filter=detractors`
  - Assert campaign builder condition pre-populated when `filter=detractors` in URL

---

## Open Questions / Deferrals

| ID | Question | Decision |
|---|---|---|
| OQ-3 | `responseRate` denominator | `activeMembers` approximation for MVP |
| — | `survey-completers-earn-more` insight | Requires `AVG(pointsBalance)` for survey vs non-survey members — complex cross-join; implement as best-effort |
| — | `searchParams` pre-fill in campaign builder | Pre-fill `conditionField/Operator/Value` initial state only; existing form logic otherwise unchanged |

---

## Validation Requirements

- `uiValidationRequired`: Yes — admin home page renders panels, stat cards, insight cards
- `mobileValidationRequired`: No (admin portal is desktop-primary; responsive check at 768px+ via Tailwind grid)
- Browser validation: SSR curl to confirm page renders + E2E spec for interaction
- Evidence artifact: `docs/evidence/78-ui-polish-validation.md`
- Required breakpoints: 768px (md grid kick-in), 1280px desktop
- Partial-failure behaviour: confirm `warnings[]` returned on sub-query error

---

## Quality Requirements

- No new TypeScript errors (`pnpm typecheck` must pass)
- No new lint errors
- `pnpm test:smoke` (240+ unit tests) must pass with new tests added
- `computeInsights()` must be a pure function (no DB, no side effects)
- No hardcoded `brandId` or credentials in any file
- Check `@customerEQ/shared` exports before defining any response interface in `apps/web/`
