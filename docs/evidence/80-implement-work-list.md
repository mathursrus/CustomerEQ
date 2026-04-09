# Issue #80 — Response-to-Action Rule Builder and Loop Monitor
# Implementation Work List

Branch: `feature/80-response-to-action-rule-builder`
RFC: `docs/rfcs/80-response-to-action-rule-builder.md`
Evidence: `docs/evidence/80-technical-design-evidence.md`

## Validation Requirements
- `uiValidationRequired`: Yes — wizard steps 3 & 4, Loop Monitor, Playbook selector
- `mobileValidationRequired`: No — admin panel only
- `integrationTestRequired`: Yes — cx-playbooks CRUD, launch, loop-monitor, response wiring
- `e2eTestRequired`: Yes — survey-rule-builder.spec.ts (mocked API for Loop Monitor)
- Browser baseline: Chrome latest (Playwright default)

---

## Implementation Checklist

### Layer 1: Schema Migration
- [ ] `packages/database/prisma/schema.prisma` — Add `CxPlaybook` model, `SurveyRule` model; add `surveyRules`+`distributionCount` to Survey; add `surveyRule`+`surveyId` to Campaign; add `surveyResponseId` to CampaignEvent
- [ ] `packages/database/prisma/migrations/20260408000000_add_cx_playbooks_and_survey_rules/migration.sql` — New tables + column additions
- [ ] Run `prisma generate` to regenerate client

### Layer 2: Shared Types / Zod
- [ ] `packages/shared/src/types/index.ts` — Add `surveyResponseId?: string` to `CampaignTriggerPayload`
- [ ] `packages/shared/src/zod/survey.schema.ts` — Add `SurveyRuleInputSchema`, `LaunchSurveySchema`, `CreateCxPlaybookSchema`, `UpdateCxPlaybookSchema`; export types
- [ ] `packages/shared/src/index.ts` — No new export needed (survey.schema already exported)
- [ ] `packages/shared/src/zod/survey.schema.test.ts` — Unit tests: `validateRuleOverlap`, boundary scoring, `evaluateSurveyRule`

### Layer 3: Pure Function Tests (unit)
- [ ] `packages/shared/src/zod/survey.schema.ts` — Add pure functions: `validateRuleOverlap()`, `evaluateSurveyRule()`
- [ ] `packages/shared/src/utils/loopMonitor.ts` — Pure functions: `computeLoopMonitorWarning()`, `computeLatencyPercentiles()`
- [ ] `packages/shared/src/utils/loopMonitor.test.ts` — Unit tests for loopMonitor pure functions

### Layer 4: API Routes
- [ ] `apps/api/src/routes/cxPlaybooks.ts` — New route file: POST/GET/PUT/DELETE `/v1/cx-playbooks`
- [ ] `apps/api/src/routes/surveys.ts` — Add `POST /v1/surveys/:id/launch` + `GET /v1/surveys/:id/loop-monitor`
- [ ] `apps/api/src/routes/public.ts` — Extend `POST /v1/public/surveys/:id/respond` with SurveyRule evaluation + enqueue
- [ ] `apps/api/src/app.ts` — Register `cxPlaybooksRoutes` with prefix `/v1`

### Layer 5: Worker
- [ ] `apps/worker/src/processors/campaignTriggers.ts` — Pass `surveyResponseId` from payload to `CampaignEvent.create` (in both standard and interactive paths)

### Layer 6: Frontend Components (new)
- [ ] `apps/web/src/components/surveys/PlaybookSelector.tsx` — Load Playbook dropdown + confirmation prompt
- [ ] `apps/web/src/components/surveys/RuleBuilderStep.tsx` — Step 3: rule rows, reach estimate badge, save-as-playbook, overlap validation
- [ ] `apps/web/src/components/surveys/ReviewLaunchStep.tsx` — Step 4: summary cards, budget warning, Launch button
- [ ] `apps/web/src/components/surveys/LoopMonitor.tsx` — 5-stage pipeline, latency strip, 48h warning, auto-refresh

### Layer 7: Frontend Page Modifications
- [ ] `apps/web/src/app/(admin)/admin/surveys/new/page.tsx` — Extend from 2 to 4 steps (add Step 3 RuleBuilderStep + Step 4 ReviewLaunchStep); carry rules state across steps; POST launch on Step 4
- [ ] `apps/web/src/app/(admin)/admin/surveys/[id]/page.tsx` — Add LoopMonitor section below survey header KPI row

### Layer 8: Integration Tests
- [ ] `apps/api/test/integration/cx-playbooks.test.ts` — New: CRUD + isolation + duplicate name 422
- [ ] `apps/api/test/integration/surveys.test.ts` — Extend: launch endpoint (creates campaigns, idempotent, overlap rejection, empty rules)
- [ ] `apps/api/test/integration/surveys.test.ts` — Extend: loop-monitor (counts, 48h warning, percentiles, DRAFT placeholder)
- [ ] `apps/api/test/integration/public-survey.test.ts` — Extend: response wiring (matching rule enqueues trigger, non-matching doesn't, boundary values, no rules = no trigger)

### Layer 9: E2E Test
- [ ] `apps/web/test/e2e/survey-rule-builder.spec.ts` — New: happy path 4 steps, overlap validation, playbook save+load, back button, Loop Monitor with mocked API

### Layer 10: Build Verification
- [ ] `pnpm build` (or typecheck) — zero TypeScript errors
- [ ] `pnpm test:smoke` — all unit tests pass
- [ ] `pnpm test:integration --filter surveys, cx-playbooks, public-survey` — integration tests pass

---

## Known Deferrals
- `loyaltyOutcomes.retentionDelta` — always `null` in MVP (cohort query deferred)
- `GET /v1/analytics/reach-estimate` `surveyId`+`surveyType` params — already exists; RuleBuilderStep uses `scoreMin`/`scoreMax` as query params; no API change needed for MVP (re-uses existing endpoint)

## Open Decisions
- None — all architecture gaps approved in PR #118 review
