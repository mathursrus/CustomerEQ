# Feature: Outbound Webhook Delivery for Alert Events
Issue: #156  
Feature Spec: N/A (went straight to technical design — requirements were clear from product discussion)
PR: (pending)

## Completeness Evidence
- Issue tagged with label `phase:design`: Yes
- Issue tagged with label `status:needs-review`: No (pending PR submission)
- All files committed/synced to branch: No (pending)
- PR Comments addressed: N/A (no PR yet)

### Traceability Matrix

| Requirement / User Story | RFC Section / Data Model | Status | Validation Plan Alignment |
|---|---|---|---|
| Admin can add webhook endpoints (URL + label + active toggle) | API: `POST /v1/webhooks` + `WebhookEndpoint` model + Admin UI at `/admin/settings/webhooks` | Met | Integration: POST `/v1/webhooks`, assert 201 + correct fields stored |
| Admin can edit webhook endpoints | API: `PATCH /v1/webhooks/:id` + Admin UI edit action | Met | Integration: PATCH endpoint, assert fields updated |
| Admin can delete webhook endpoints | API: `DELETE /v1/webhooks/:id` + cascade on `WebhookDeliveryLog` | Met | Integration: DELETE, assert 200 + delivery logs cascade-deleted |
| Signing secret generated per endpoint, shown once at creation | `POST /v1/webhooks` returns `signingSecret` in response body; subsequent GETs omit it | Met | Integration: POST returns secret; GET does not; unit: secret is random 32-byte |
| Events delivered within 30 seconds of trigger | BullMQ `webhook-delivery` queue (concurrency 10); hook points in `alertEvaluation.ts` and `cases.ts` fire immediately after DB write | Met | Integration: trigger case creation, assert delivery job enqueued within 1s; actual HTTP delivery is I/O bound but concurrency 10 ensures low queue depth |
| Failed deliveries retry up to 5 times with exponential backoff | BullMQ config: `{ attempts: 5, backoff: { type: 'exponential', delay: 5000 } }` in `webhookDelivery.ts` | Met | Unit: mock fetch → 500, assert 5 retry attempts with correct delays |
| Delivery log shows last 50 attempts per endpoint (status code, timestamp, payload preview) | `GET /v1/webhooks/:id/deliveries` returns last 50 `WebhookDeliveryLog` rows including `httpStatus`, `deliveredAt`, `requestPayload` (2 KB cap), `responseBody` (500 char cap) | Met | Integration: create 55 delivery log rows, assert API returns 50 sorted by `deliveredAt DESC` |
| Payload includes: event, timestamp, brandId, caseId, score, status, surveyName, feedback, slaTarget | RFC § Webhook Payload Shape — all fields present in `data` object | Met | Unit: assert payload builder includes all required fields |
| `case.created` event fires when alert creates a case | Hook in `alertEvaluation.ts` after `prisma.caseFollowUp.create()` | Met | Integration: submit survey response matching alert rule, assert delivery job enqueued with `event: 'case.created'` |
| `case.status_changed` event fires when case status updated | Hook in `cases.ts` PATCH `/v1/cases/:id/status` after DB update | Met | Integration: PATCH case status, assert delivery job enqueued with `previousStatus`/`newStatus` |
| `case.overdue` event fires when SLA deadline passes | New `slaBreachCheck.ts` repeating BullMQ job (every 5 min); uses `slaBreachedAt` for idempotency | Met | Integration: insert case with past `slaDeadline`, run breach checker, assert delivery job enqueued + `slaBreachedAt` set; run again, assert no duplicate job |
| Endpoints subscribe to specific events only (not all) | `events String[]` on `WebhookEndpoint`; delivery enqueue checks `endpoint.events.includes(event)` before enqueueing | Met | Integration: endpoint subscribed to `case.created` only, assert no delivery on status change |
| Multi-tenant isolation — brand A cannot see brand B endpoints | All routes scoped to `brandId` from JWT via multiTenant plugin | Met | Integration: two brands, assert cross-brand read returns 404 |
| Admin UI: create endpoint flow with secret shown once | `apps/web/src/app/(admin)/admin/settings/webhooks/page.tsx` — post-creation banner with copy button | Met | E2E (Playwright): create endpoint, assert secret banner visible; reload, assert banner gone |
| Admin UI: delivery log per endpoint | Deliveries drawer (Sheet) on webhook list page | Met | E2E: open deliveries drawer, assert log rows rendered |

**Traceability result: ALL REQUIREMENTS MET — no unmet rows.**

---

## Due Diligence Evidence
- Reviewed feature spec in detail: N/A (no spec — went straight to technical design based on clear product discussion)
- Reviewed codebase in detail to understand and reproduce the issue: Yes
  - Read `alertEvaluation.ts` (hook point for `case.created`)
  - Read `cases.ts` (hook point for `case.status_changed`)
  - Read `schema.prisma` (confirmed `slaBreachedAt` column exists on `CaseFollowUp`)
  - Read `architecture.md` (confirmed BullMQ patterns, HMAC patterns, route conventions)
- Included detailed design, validation plan, test strategy in doc: Yes — see RFC `docs/rfcs/156-outbound-webhook-delivery.md`

## Architecture Gaps (for user review via PR)

| Gap | Type | Resolution Path |
|---|---|---|
| Outbound webhook delivery data flow not in architecture doc | Missing from architecture | Add §5.4 to arch doc during address-feedback |
| BullMQ repeating jobs not documented in §4.3 | Missing from architecture | Add note to §4.3 during address-feedback |
| Credential encryption at rest not documented (dependency on #53) | Missing from architecture | Track as dependency; note in arch doc |
| `/v1/webhooks` not in §4.1 route table | Route namespace ambiguity (low severity) | Add row to §4.1 during address-feedback |

## Continuous Learning

| Learning | Agent Rule Update |
|---|---|
| When no feature spec exists, the GitHub issue acceptance criteria serve as the traceability source of truth — document this explicitly at the start of the evidence file. | No rule update needed — standard practice documented here. |
| `slaBreachedAt` column already exists on `CaseFollowUp` — always grep the schema before designing new columns. | No rule update needed — existing rule (read before designing). |
