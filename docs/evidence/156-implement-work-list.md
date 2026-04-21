# Implementation Work List — Issue #156: Outbound Webhook Delivery

**Branch**: `feature/issue-156-webhook-delivery-impl`  
**RFC**: `docs/rfcs/156-outbound-webhook-delivery.md`  
**Issue type**: Feature

---

## ⚠️ Phase Splitting Candidate

This feature touches **20 files** (>15 threshold). Breakdown:
- DB: 2 files (schema + migration)
- Shared: 4 files (queue constant, zod schemas, types, index export)
- API: 5 files (route, app registration, bullmq.ts, alertEvaluation hook, cases hook)
- Worker: 3 files (delivery processor, sla breach checker, worker index)
- UI: 2 files (webhooks admin page, sidebar nav)
- Tests: 4 files (unit x2, integration x1, e2e x1)

**Recommended split**:
- **Phase A** (backend-only, no UI): DB + Shared + API + Worker + unit/integration tests
- **Phase B** (admin UI + E2E): Admin webhooks page + sidebar + E2E test

User must approve full execution or split before implementation begins.

---

## Critical Pattern: QUEUE_MODE Dual-Path

Every new queue in this codebase must have two execution paths in `apps/api/src/queues/bullmq.ts`:
- `QUEUE_MODE=inline` → `scheduleInline('webhook-delivery', payload, inlineWebhookDelivery)`
- `QUEUE_MODE=redis` → `getWebhookDeliveryQueue().add('deliver', payload, { attempts: 5, backoff: ... })`

Both must produce the same functional outcome (same DB writes, same delivery log entries).

---

## Implementation Checklist

### DB Layer
- [x] `packages/database/prisma/schema.prisma` — Add `WebhookEndpoint` model, `WebhookDeliveryLog` model, `Brand.webhookEndpoints` relation
- [x] `packages/database/prisma/migrations/20260421000000_add_webhook_endpoints/migration.sql` — New migration file

### Shared Layer
- [x] `packages/shared/src/queues.ts` — Add `WEBHOOK_DELIVERY: 'webhook-delivery'`
- [x] `packages/shared/src/zod/webhooks.ts` — `CreateWebhookEndpointSchema`, `UpdateWebhookEndpointSchema`, `WebhookEventType` enum
- [x] `packages/shared/src/types/index.ts` — Add `WebhookDeliveryPayload` interface
- [x] `packages/shared/src/index.ts` — Export new types/schemas

### API Layer
- [x] `apps/api/src/routes/outboundWebhooks.ts` — New route file: GET/POST/PATCH/DELETE `/v1/webhooks`, GET `/v1/webhooks/:id/deliveries`, POST `/v1/webhooks/:id/test`
- [x] `apps/api/src/app.ts` — Register `outboundWebhooksRoutes` plugin
- [x] `apps/api/src/queues/bullmq.ts` — Add `_webhookDeliveryQueue`, `inlineWebhookDelivery()`, `enqueueWebhookDelivery()` export (both paths)
- [x] `apps/worker/src/processors/alertEvaluation.ts` — After `prisma.caseFollowUp.create()`, load active endpoints subscribed to `case.created` and enqueue delivery
- [x] `apps/api/src/routes/cases.ts` — After `prisma.caseFollowUp.update()` in PATCH status, enqueue delivery for `case.status_changed`

### Worker Layer
- [x] `apps/worker/src/processors/webhookDelivery.ts` — Processor: load endpoint, build payload, HMAC-sign, POST with 10s timeout, write `WebhookDeliveryLog`, throw on failure (triggers BullMQ retry)
- [x] `apps/worker/src/processors/slaBreachCheck.ts` — Repeating checker: find overdue cases with `slaBreachedAt IS NULL`, set `slaBreachedAt`, enqueue `case.overdue` deliveries
- [x] `apps/worker/src/index.ts` — Register `webhookDeliveryWorker` (concurrency 10) + schedule repeating SLA breach job

### Admin UI
- [ ] `apps/web/src/app/(admin)/admin/settings/webhooks/page.tsx` — New page: endpoint list with status, "Add Endpoint" modal, one-time secret banner, deliveries drawer *(Phase B — deferred)*
- [ ] `apps/web/src/app/(admin)/layout.tsx` — Add "Webhooks" link under Settings in sidebar *(Phase B — deferred)*

### Tests
- [x] `apps/worker/src/processors/webhookDelivery.test.ts` — Unit: HMAC signing, fetch timeout, 4xx/5xx retry, deleted endpoint, idempotency (9 tests)
- [x] `apps/worker/src/processors/slaBreachCheck.test.ts` — Unit: skips cases with `slaBreachedAt` set, sets it before enqueueing, no duplicates (10 tests)
- [x] `apps/api/test/integration/outbound-webhooks.test.ts` — Integration: full CRUD, multi-tenant isolation, delivery log, enqueue on case creation + status change
- [ ] `apps/web/test/e2e/webhooks.spec.ts` — E2E: create endpoint → secret shown once → reload → secret hidden *(Phase B — deferred)*

---

## Validation Requirements

- `uiValidationRequired`: Yes — admin webhooks page, modal, one-time secret banner, deliveries drawer
- `mobileValidationRequired`: No — admin-only page, desktop primary
- Browser baseline: Chromium (Playwright default)
- Evidence artifact: `docs/evidence/156-ui-polish-validation.md`

---

## Known Constraints / Deferrals

- **Credential encryption** (#53): `signingSecret` and `url` stored plaintext. This is acceptable for implementation; a prominent comment is required. Feature must not be enabled in production until #53 ships. No `TODO` comments — use a dedicated `NOTE:` comment with issue reference.
- **`caseNumber`** field: Does not exist on `CaseFollowUp` DB model. Omit from webhook payload; use `caseId` (the UUID) only.
- **SLA breach repeating job**: BullMQ `repeat` is only available in `QUEUE_MODE=redis`. In `inline` mode, omit the repeating schedule — the checker can be called manually or via a test helper.
