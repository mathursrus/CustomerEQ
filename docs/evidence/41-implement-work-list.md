# Implementation Work List — #41 Closed-Loop Alerting

Issue: #41
Branch: `spec/41-closed-loop-alerting`
Type: Feature

---

## Phase 1: Database & Shared Schema

- [ ] `packages/database/prisma/schema.prisma` — Add `AlertRule` model, `CaseFollowUp` model, add relations to Brand
- [ ] `packages/shared/src/zod/alert.schema.ts` — NEW: CreateAlertRuleSchema, UpdateAlertRuleSchema, UpdateCaseStatusSchema, AddCaseNoteSchema
- [ ] `packages/shared/src/queues.ts` — Add `ALERT_EVALUATION` queue
- [ ] `packages/shared/src/index.ts` — Export new schemas

## Phase 2: API Routes

- [ ] `apps/api/src/routes/alertRules.ts` — NEW: CRUD for alert rules (GET list, POST, GET detail, PATCH, DELETE, PATCH status)
- [ ] `apps/api/src/routes/cases.ts` — NEW: Case management (GET list with filters, GET detail, PATCH status, POST notes)
- [ ] `apps/api/src/app.ts` — Register new routes
- [ ] `apps/api/src/queues/bullmq.ts` — Add `enqueueAlertEvaluation` producer

## Phase 3: Worker — Alert Evaluation

- [ ] `apps/worker/src/processors/alertEvaluation.ts` — NEW: Evaluate alert rules against survey response, create CaseFollowUp, deliver alerts (Slack/email/Teams webhooks)
- [ ] `apps/worker/src/index.ts` — Register alert evaluation worker

## Phase 4: Integration Points

- [ ] `apps/api/src/routes/surveys.ts` — Enqueue ALERT_EVALUATION after survey response submission
- [ ] `apps/api/src/routes/public.ts` — Enqueue ALERT_EVALUATION after public survey response
- [ ] `apps/worker/src/processors/sentimentAnalysis.ts` — Enqueue ALERT_EVALUATION after sentiment analysis completes (for sentiment-based rules)

## Phase 5: Frontend — Admin UI

- [ ] `apps/web/src/app/(admin)/admin/alerts/rules/page.tsx` — NEW: Alert rules list
- [ ] `apps/web/src/app/(admin)/admin/alerts/rules/new/page.tsx` — NEW: Create alert rule form
- [ ] `apps/web/src/app/(admin)/admin/alerts/cases/page.tsx` — NEW: Case management dashboard with stats + filters + table
- [ ] `apps/web/src/app/(admin)/admin/alerts/cases/[id]/page.tsx` — NEW: Case detail with timeline, actions, SLA indicator
- [ ] `apps/web/src/app/(admin)/layout.tsx` — Add "Alerts" nav item to sidebar

## Phase 6: Tests

- [ ] `packages/shared/src/zod/alert.schema.test.ts` — NEW: Schema validation tests
- [ ] `apps/api/src/routes/alertRules.test.ts` — NEW: Alert rule route tests (if patterns exist)
- [ ] `apps/web/test/e2e/closed-loop-alerting.spec.ts` — NEW: E2E test for alert rule creation + case management

---

## Validation Requirements

- `uiValidationRequired`: true — case management dashboard is customer-facing admin tool
- `mobileValidationRequired`: false — admin-only desktop tool
- Browser baseline: Chrome latest
- Target journeys:
  1. Admin creates alert rule with NPS < 7 condition + Slack channel
  2. Survey response triggers alert → case created → appears in dashboard
  3. Admin updates case status through lifecycle
  4. SLA breach detection flags overdue cases

## Key Decisions

1. **Alert evaluation is async** (BullMQ worker) — doesn't block survey response pipeline
2. **Dual trigger points**: After response submission (for score-based rules) + after sentiment analysis (for sentiment-based rules)
3. **Slack/Teams delivery**: Direct HTTP POST to webhook URLs (no SDK dependency)
4. **Zendesk/Jira**: Deferred to v2 — focus on Slack/email/Teams for v1
5. **Credential storage**: Store webhook URLs as plain strings for v1 (encryption in v2 with proper key management)
6. **SLA check**: Computed on read (compare deadline vs now) rather than background cron

## Deferrals

- Zendesk/Jira ticket creation (v2)
- Credential encryption at rest (v2)
- Re-survey trigger after resolution (v2)
- Round-robin assignment (v2 — static assignment only in v1)
