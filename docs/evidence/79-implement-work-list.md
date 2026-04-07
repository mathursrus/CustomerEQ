# Implementation Work List — Issue #79: Survey Trigger Wizard

RFC: docs/rfcs/79-survey-trigger-wizard.md
Branch: feature/79-impl-survey-trigger-wizard

---

## Implementation Checklist

### Database / Schema
- [ ] `packages/database/prisma/schema.prisma` — Add 3 nullable fields to Survey model: `triggerCategory String?`, `triggerKey String?`, `surveyTypeOverride String?`
- [ ] `packages/database/prisma/schema.prisma` — Add composite index to LoyaltyEvent: `@@index([brandId, programId, eventType, createdAt])`
- [ ] Run `pnpm --filter @customerEQ/database prisma migrate dev --name add_survey_trigger_fields`

### Shared Package
- [ ] `packages/shared/src/zod/survey.schema.ts` — Add optional fields to `CreateSurveySchema`: `triggerCategory`, `triggerKey`, `surveyTypeOverride`

### API — New Endpoints
- [ ] `apps/api/src/routes/analytics.ts` — Add `GET /analytics/reach-estimate` handler (LoyaltyEvent count query, active member fallback for scheduled, channel breakdown, graceful fallback)
- [ ] `apps/api/src/routes/programs.ts` — Add `GET /programs/:id/trigger-options` handler (EarningRule → display label mapping)

### API — Existing Route Update
- [ ] `apps/api/src/routes/surveys.ts` — Pass `triggerCategory`, `triggerKey`, `surveyTypeOverride` from validated body to `prisma.survey.create`

### Frontend — New Files
- [ ] `apps/web/src/utils/triggerRecommendation.ts` — Pure function `getTriggerRecommendation(triggerKey)`, 11-entry static map + fallback
- [ ] `apps/web/src/components/surveys/TriggerStep.tsx` — Step 1 wizard component (category cards, sub-trigger pills, recommendation box, override picker, reach badge)

### Frontend — Modified Files
- [ ] `apps/web/src/app/(admin)/admin/surveys/new/page.tsx` — Refactor to 2-step wizard; Step 1 = TriggerStep, Step 2 = existing content form; submit includes trigger fields
- [ ] `apps/web/src/app/(admin)/admin/surveys/page.tsx` — Show trigger badge on survey cards
- [ ] `apps/web/src/app/(admin)/admin/surveys/[id]/page.tsx` — Show trigger + type in detail header

---

## Tests Checklist

### Unit Tests
- [ ] `apps/web/src/utils/triggerRecommendation.test.ts` — All 11 keys, fallback, type constraints
- [ ] `apps/api/src/utils/triggerEventMap.test.ts` (if extracted) — TRIGGER_EVENT_MAP coverage

### Integration Tests
- [ ] `apps/api/test/integration/analytics.test.ts` — reach-estimate: event-based, scheduled, insufficient history, missing param
- [ ] `apps/api/test/integration/programs.test.ts` — trigger-options: with rules, without rules
- [ ] `apps/api/test/integration/surveys.test.ts` — POST with trigger fields, POST without (backwards compat), invalid triggerCategory

### E2E Tests
- [ ] `apps/web/test/e2e/survey-trigger-wizard.spec.ts` — Happy path: Step 1 → Step 2 → submit → survey detail

---

## Validation Requirements

- `uiValidationRequired`: Yes — trigger wizard Step 1 + Step 2 flow, survey list badge, survey detail badge
- `mobileValidationRequired`: No
- Target breakpoints: desktop (1280px), tablet (768px)
- Browser baseline: Chromium (Playwright default)
- UI evidence artifact: `docs/evidence/79-ui-polish-validation.md`

---

## Deferrals / Open Questions

- `surveyTypeOverride` analytics use case (querying deviation rate) — deferred to future issue; field is captured but no UI surface for it
- CX Risk + Scheduled sub-triggers are static in frontend — dynamic loading from program config deferred
- 5th-purchase trigger: `EarningRule.triggerEvent = 'purchase'` with count-based condition — reach estimate counts all purchase events for simplicity (not filtered by N-th occurrence); documented as known approximation

---

## File Count: 13 files (within 15-file threshold — no phase split needed)
