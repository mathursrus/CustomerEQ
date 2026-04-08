# Feature: Response-to-Action Rule Builder and Loop Monitor
Issue: #80
Feature Spec: docs/feature-specs/80-response-to-action-rule-builder-and-loop-monitor.md
PR: (to be linked after push)

## Completeness Evidence
- Issue tagged with label `phase:design`: Yes
- Issue tagged with label `status:needs-review`: Yes (will update after PR)
- All files committed/synced to branch: Yes

| PR Comment | How Addressed |
|------------|---------------|
| (No prior feedback — initial design submission) | — |

### Traceability Matrix

| Requirement/User Story | RFC Section/Data Model | Status | Validation Plan Alignment |
|------------------------|----------------------|--------|--------------------------|
| R35 — Rule Builder step in wizard after Step 2 | `RuleBuilderStep.tsx`; `surveys/new/page.tsx` extended to 4 steps | Met | E2E — wizard step 3 loads after step 2 |
| R35 — Score range picker constrained to survey type | `RuleBuilderStep` props include `surveyType`; client-side bounds validation | Met | E2E — NPS range capped at 0–10 |
| R35 — 6 action types + inline config panel | `SurveyRule.actionType`; `actionConfig` JSON; contextual panel per type | Met | E2E — select each action type, verify panel |
| R35 — Estimated member count badge (server-side) | `GET /v1/analytics/reach-estimate` extended params | Met | Integration — reach-estimate with scoreMin/scoreMax |
| R35 — Expected point cost (award_points) | Client-side: `reachEstimate × points` | Met | E2E — cost shown in rule row |
| R35 — Add/remove/reorder rules | `RuleBuilderStep` state array | Met | E2E — add second rule, delete first |
| R35 — Overlap validation + inline error | `validateRuleOverlap()` pure function; "Continue" disabled | Met | Unit — boundary cases; E2E — overlap blocks continue |
| R35 — Default pre-populated rule row | `RuleBuilderStep` initializes with default per `surveyType` | Met | E2E — step 3 loads with one row |
| R36 — Save rules as named CX Playbook | `POST /v1/cx-playbooks`; `CxPlaybook` model | Met | Integration — create playbook, verify DB record |
| R36 — Load Playbook dropdown | `PlaybookSelector.tsx`; `GET /v1/cx-playbooks?surveyType=...`; confirmation prompt | Met | E2E — load replaces rules |
| R36 — Playbook brand-scoped | `CxPlaybook.brandId` from JWT; `@@unique([brandId, name])` | Met | Integration — cross-tenant isolation test |
| R36 — Same-name conflict prompt | 422 on duplicate name; frontend prompt | Met | Integration — duplicate name returns 422 |
| R36 — PUT/DELETE playbook | `PUT /v1/cx-playbooks/:id`; `DELETE /v1/cx-playbooks/:id` (soft-delete) | Met | Integration — update + delete + verify not returned |
| R37 — Loop Monitor 5-stage pipeline | `LoopMonitor.tsx`; `GET /v1/surveys/:id/loop-monitor`; `[id]/page.tsx` | Met | E2E — all 5 stages visible on survey detail page |
| R37 — Stage data sources | RFC §API Surface Changes — surveysSent, responsesReceived, rulesMatched, campaignsTriggered, loyaltyOutcomes | Met | Integration — seeded data, verify counts |
| R37 — Clickable stages → detail drawer | `LoopMonitor.tsx` inline drawer | Met | E2E — click stage, drawer opens |
| R37 — Auto-refresh 60s + last updated | `useEffect` interval; `generatedAt` field | Met | E2E — mock API, verify re-fetch after 60s |
| R37 — DRAFT survey shows placeholder | `LoopMonitor` renders placeholder when not ACTIVE | Met | E2E — draft survey, verify placeholder text |
| R38 — 48-hour warning | `warning` field in response; `computeLoopMonitorWarning()` | Met | Integration — seed first response > 48h ago, 0 campaigns |
| R38 — Warning from first response timestamp | Warning logic uses first `SurveyResponse.completedAt` | Met | Integration — verify anchor timestamp |
| R38 — Warning clears on campaign trigger | `warning = null` when `campaignsTriggered > 0` | Met | Integration — seed one CampaignEvent, re-fetch |
| R39 — Review & Launch step (Step 4) | `ReviewLaunchStep.tsx`; 4 summary cards | Met | E2E — all 4 cards visible |
| R39 — Budget cap warning | `ReviewLaunchStep` compares cost vs `program.budgetCap` | Met | E2E — seed budget cap below estimated cost |
| R39 — Launch creates Campaign per rule | `POST /v1/surveys/:id/launch` transaction | Met | Integration — N rules → N campaigns + N survey_rules |
| R39 — Launch sets status ACTIVE | Same transaction | Met | Integration — verify survey.status = ACTIVE |
| R39 — Back button preserves rules | `onBack()` callback; rule state preserved | Met | E2E — navigate back, rules intact |
| R40 — P50/P95 latency in Loop Monitor | `latency` object; PostgreSQL `PERCENTILE_CONT` | Met | Integration — 289 seeded events, verify percentiles |
| R40 — SLA color coding | `LoopMonitor.tsx` color from `slaStatus` field | Met | Integration — seed P95 > 1800s, verify breach status |
| R40 — Insufficient data message | `sampleSize < 10` → display message | Met | Integration — 5 events, verify null percentiles |
| **Wiring gap** — rules execute when responses arrive | `POST /v1/public/surveys/:id/respond` evaluates SurveyRule + enqueues triggers | Met | Integration — response + matching rule → campaign trigger enqueued |

**Result: 30/30 Met — PASS**

## Due Diligence Evidence
- Reviewed feature spec in detail: Yes — R35–R40, all error states, compliance, validation plan
- Reviewed codebase in detail: Yes — read `campaignTriggers.ts` processor, `public.ts` response handler, `schema.prisma`, `architecture.md`, `worker/src/index.ts`
- Included detailed design, validation plan, test strategy in RFC: Yes

## Architecture Gaps Documented
4 patterns used in design but not yet in `architecture.md`:
1. Survey response → campaign trigger wiring (§4.1)
2. `POST /:id/launch` for side-effect-bearing status transitions (§4.1)
3. Brand-scoped reusable operator configuration / CxPlaybook pattern (§4.4)
4. Loop monitor graceful-degradation contract extension (§4.1)

These are documented in the RFC `## Architecture Analysis` section for PR reviewer decisions.

## Continuous Learning

| Learning | Agent Rule Updates |
|----------|--------------------|
| The wiring gap (rules don't fire without a worker hook into response submission) is a recurring risk for any wizard that creates configuration but doesn't wire it to execution. | No rule file updated — captured in RFC wiring gap section and in Issue #117 for #79's equivalent gap. |
| `POST /:id/launch` is the right pattern whenever a status transition has side effects (creates other records). Documenting this prevents future PRs from using `PATCH status` for side-effect transitions. | No rule file updated — documented as architecture gap for arch.md update. |
