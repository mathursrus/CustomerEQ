# Issue #117 — Implementation Work List

**Issue**: fix(#79): survey creation UX — restore ad-hoc path and wire trigger to automated distribution  
**Type**: bug (regression)  
**Branch**: feature/117-fix-79-survey-creation-ux-restore-ad-hoc-path-and-wire-trigger-to-automated-distribution

---

## Problem Summary

Issue #79 introduced two regressions:
1. Ad-hoc survey creation path removed — every survey now forces through the trigger wizard
2. Trigger metadata is inert — triggerKey/triggerCategory saved but never used to auto-distribute surveys

---

## Validation Requirements

- `uiValidationRequired`: Yes — ad-hoc path and triggered path both render correctly
- `mobileValidationRequired`: No
- Browser baseline: Chromium (Playwright)
- Evidence artifact: `docs/evidence/117-ui-polish-validation.md`

---

## Implementation Checklist

### DB
- [ ] `packages/database/prisma/schema.prisma` — Add `SurveyDistribution` model for cooldown deduplication
- [ ] Run `pnpm db:migrate` to apply migration

### Shared Package
- [ ] `packages/shared/src/queues.ts` — Add `SURVEY_DISTRIBUTE` queue name
- [ ] `packages/shared/src/types/index.ts` — Add `SurveyDistributePayload` interface

### Worker
- [ ] `apps/worker/src/processors/surveyDistribute.ts` — New processor: receive survey, send notification to member
- [ ] `apps/worker/src/processors/loyaltyEvents.ts` — After loyalty processing, check for active surveys with matching triggerKey, enforce 30-day cooldown, enqueue distribution
- [ ] `apps/worker/src/queues/producers.ts` — Add `enqueueSurveyDistribute()`
- [ ] `apps/worker/src/index.ts` — Register `surveyDistributeWorker`

### Frontend
- [ ] `apps/web/src/app/(admin)/admin/surveys/new/page.tsx` — Add path selection step (ad-hoc vs triggered) before Step 1
  - Ad-hoc: skip TriggerStep, go direct to survey details form
  - Triggered: keep existing 4-step wizard flow

### Tests
- [ ] `apps/worker/src/processors/loyaltyEvents.test.ts` — Unit tests for `getMatchingTriggerKeys()` mapping and cooldown logic
- [ ] `apps/api/test/integration/surveys.test.ts` — Integration test: triggered survey auto-distribution on loyalty event

### Architecture
- [ ] `docs/architecture/architecture.md` — Update `SURVEY_DISTRIBUTE` queue in worker section

---

## Trigger Key → Loyalty Event Type Mapping

| triggerKey | LoyaltyEvent.eventType |
|-----------|----------------------|
| tier_upgrade | tier.upgraded |
| first_redemption | redemption.first |
| 5th_purchase | purchase |
| enrollment | member.enrolled |
| anniversary | member.anniversary |
| inactive_30d | member.inactive |
| after_support | cx.support_closed |
| nps_drop | cx.nps_drop |
| quarterly_pulse | (scheduled — no event trigger) |
| monthly_csat | (scheduled — no event trigger) |
| annual_program | (scheduled — no event trigger) |

---

## Acceptance Criteria

- [ ] Admin can create an ad-hoc survey (name + program + type only) without going through any trigger step
- [ ] Admin can create a triggered survey via the #79 wizard flow
- [ ] When a triggered survey is ACTIVE and the matching loyalty event fires for a member, the survey is automatically sent
- [ ] A member does not receive the same triggered survey more than once within 30 days
- [ ] The surveys list distinguishes between ad-hoc surveys and triggered surveys

---

## Deferrals / Open Questions

- Scheduled triggers (quarterly_pulse, monthly_csat, annual_program): not wired to event-based distribution — require a cron job. Deferred to future issue.
- Real email delivery: notifications queue is a stub (EMAIL_PROVIDER=stub). Survey distribution enqueues notification with survey link; actual delivery is stub in MVP.
