# Feature: Survey Trigger Wizard — Technical Design
Issue: #79
Feature Spec: [docs/feature-specs/79-survey-trigger-wizard.md](../feature-specs/79-survey-trigger-wizard.md)
PR: (to be linked after push)

## Completeness Evidence
- Issue tagged with label `phase:design`: Yes
- Issue tagged with label `status:needs-review`: Yes
- All files committed/synced to branch: Yes (after commit)

| PR Comment | How Addressed |
|------------|---------------|
| (No prior feedback — initial design submission) | — |

### Traceability Matrix

| Requirement/User Story | RFC Section/Data Model | Status | Validation Plan Alignment |
|------------------------|----------------------|--------|--------------------------|
| R31 — Survey creation opens with Step 1 trigger selection before survey content | UI Changes: `new/page.tsx` refactored to 2-step wizard; Step 1 = `TriggerStep` component; no question editor until Step 1 completed | Met | E2E: assert `data-testid="trigger-step"` present, `data-testid="survey-content-step"` absent on load |
| R31 — Three trigger categories: Loyalty Moment, CX Risk, Scheduled | `TriggerStep.tsx` renders 3 category cards; static for CX Risk + Scheduled; dynamic for Loyalty Moment via `GET /v1/programs/:id/trigger-options` | Met | E2E: assert 3 category cards rendered; Integration: trigger-options endpoint returns loyaltyMoments array |
| R32 — Recommendation box with type + one-line rationale after sub-trigger selection | `getTriggerRecommendation(triggerKey)` pure function; 11-entry static map; `RecommendationBox` component renders type + rationale | Met | Unit: all 11 trigger keys return correct type; E2E: select Tier Upgrade → assert CSAT recommendation visible |
| R33 — Live estimated reach count with channel breakdown | `GET /v1/analytics/reach-estimate?triggerKey&programId`; LoyaltyEvent count query (event-based) or active Member count (scheduled); channel breakdown from emailOptIn/smsOptIn; `ReachBadge` component | Met | Integration: reach-estimate endpoint returns estimatedCount + channels; Unit: insufficient history → null + reason |
| R33 — Reach estimate uses 30-day historical window | Reach estimate query uses `createdAt >= now() - 30d`; `windowDays: 30` in response | Met | Integration: DB seeded with events; verify count matches expected |
| R34 — Manager can override survey type with one click | `OverridePicker` inline component; toggle via `overrideOpen` state; no navigation; type selector updates `selectedType` | Met | E2E: click override link → picker appears; rationale note preserved; select NPS → type changes |
| R34 — Original rationale remains visible in override picker | `override-note` div inside `OverridePicker` always shows rationale; not conditionally hidden | Met | E2E: after override picker opens → assert rationale text still visible in note element |
| R35 — Trigger + type persisted on Survey record | `CreateSurveySchema` extended with `triggerCategory`, `triggerKey`, `surveyTypeOverride` (all optional); `Survey` model gains 3 nullable columns via migration | Met | Integration: POST /v1/surveys with trigger fields → DB row has fields populated; survey list/detail reads them |
| R35 — Trigger badge visible on survey list + detail pages | `apps/web/src/app/(admin)/admin/surveys/page.tsx` and `[id]/page.tsx` updated to display "⭐ Tier Upgrade · CSAT" badge from survey response fields | Met | E2E: after survey created → survey list shows trigger badge |
| R36 — Reach estimate unavailable gracefully when < 7 days history | History sufficiency check in analytics route: if oldest LoyaltyEvent < 7 days old → return `{ estimatedCount: null, reason: 'insufficient_history' }`; UI shows "unavailable" fallback | Met | Integration: new program with < 7 days history → estimatedCount: null; UI fallback via reach-estimate = null check |
| R36 — API failure does not block Continue | Frontend: reach estimate fetch in `useEffect`, result stored in state; if fetch fails → state remains null → badge shows unavailable; Continue button not gated on reach estimate | Met | Unit: mock API failure → TriggerStep still shows Continue enabled |
| R37 — Loyalty Moment sub-triggers dynamically loaded from EarningRule | `GET /v1/programs/:id/trigger-options` queries EarningRule for program, maps triggerEvent to display labels via TRIGGER_LABEL_MAP | Met | Integration: program with 2 earn rules → trigger-options returns 2 loyaltyMoments; Integration: no earn rules → hasEarnRules: false |
| R37 — Empty earn rules → empty state with program setup link | Frontend: if `hasEarnRules: false` → render empty state div with link to `/admin/programs/:id` | Met | E2E: program with no earn rules → Loyalty Moment category shows "No loyalty moments configured" + link |
| Error: no category selected → inline validation | Frontend validate() blocks Continue with "Please select a trigger category" | Met | E2E (Scenario B in mock): click Continue without selection → assert error message |
| Error: no sub-trigger selected → inline validation | Frontend validate() blocks Continue with "Select a specific moment" when category selected but triggerKey null | Met | E2E (Scenario B): select category, click Continue without sub-trigger → assert sub-trigger error |
| Error: reach estimate API fails → UI graceful | Catch block sets reachEstimate to null → badge shows unavailable fallback | Met | Unit: mock fetch rejection → badge renders fallback |

**Traceability result: All 16 requirements/user stories Met. No Unmet rows.**

---

## Due Diligence Evidence
- Reviewed feature spec in detail: Yes — all 7 requirements (R31–R37) read and mapped to RFC sections
- Reviewed codebase in detail: Yes — read `surveys/new/page.tsx`, `surveys.ts` route, `schema.prisma` Survey model, `survey.schema.ts`, `analytics.ts` (program-health pattern), architecture doc
- Included detailed design, validation plan, test strategy in RFC: Yes — RFC has UI changes, API endpoints, data model, failure modes, confidence level, validation plan, test matrix, risks, architecture analysis

## Prototype & Validation Evidence
- Built proof-of-concept: N/A — design phase only; patterns confirmed from existing codebase (CampaignForm wizard refactor from #78, reach-estimate query from computeInsights pattern, nullable migration from Issue #3)
- `getTriggerRecommendation()` pure function is trivial — zero external dependencies, zero risk
- Reach estimate query reuses existing `LoyaltyEvent (brandId, createdAt)` index — confirmed in schema.prisma

## Continuous Learning

| Learning | Agent Rule Updates |
|----------|--------------------|
| The reach estimate endpoint should always return 200 with a structured response (even on failure) — never 500 — to prevent UI blocking on non-critical analytics reads. This is now documented as a missing architecture pattern. | No rule file updated — documented in RFC Architecture Analysis section as "Patterns Missing from Architecture" |
| `GET` sub-resources on `/v1/programs/:id/` for derived configuration data is an emerging pattern (trigger-options, future segment-preview) — should be documented in architecture doc §4.1. | No rule file updated — flagged in RFC Architecture Analysis section for user decision via PR comment |
