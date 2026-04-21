# RFC: Outbound Webhook Delivery for Alert Events

Issue: #156  
Owner: swavak@gmail.com  
Status: Draft

---

## Customer

CustomerEQ admin operators and their IT/developer teams who need to integrate CX alert events into external systems (CRMs, ticketing tools, Slack bots, Zapier, custom dashboards).

---

## Customer Problem Being Solved

Alert cases are created and managed inside CustomerEQ, but there is no programmatic way to get them out. Customers must log in and check the admin page. This blocks integrations with:
- Ticketing systems (Zendesk, Jira) — see also #51
- CRMs (Salesforce, HubSpot) — for case enrichment beyond the CRM integration layer
- Notification tools (Slack, PagerDuty, custom bots)
- Zapier/Make automations — see also #45

---

## User Experience That Will Solve the Problem

**Setup flow (admin):**
1. Navigate to `/admin/settings/webhooks`
2. Click "Add Endpoint" → enter URL and display label, check which events to subscribe to
3. System generates a signing secret and shows it once — admin copies it to their receiver app
4. Endpoint appears in the list; status shows "No deliveries yet"

**Runtime flow (automatic):**
- When a case is created/updated/goes overdue, CustomerEQ POSTs a signed JSON payload to all active endpoints for the brand
- If delivery fails, the system retries up to 5 times with exponential backoff (5s, 10s, 20s, 40s, 80s)

**Debugging flow (admin):**
1. Click into an endpoint → "Delivery Log" tab shows last 50 attempts
2. Each row shows: event type, timestamp, HTTP status code, latency, truncated payload preview
3. If all 5 retries failed, the row is shown in red

**Test flow (admin):**
- Click "Send Test" on any endpoint → fires a `case.created` synthetic event, visible immediately in the delivery log

---

## Technical Details

### Data Models

**New: `WebhookEndpoint`**

```prisma
model WebhookEndpoint {
  id              String   @id @default(cuid())
  brandId         String
  brand           Brand    @relation(fields: [brandId], references: [id])
  label           String
  url             String   // Encrypted at rest (ref #53)
  signingSecret   String   // Encrypted at rest — 32-byte random, shown once
  events          String[] // ["case.created", "case.status_changed", "case.overdue"]
  active          Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  deliveries      WebhookDeliveryLog[]

  @@index([brandId, active])
  @@map("webhook_endpoints")
}
```

**New: `WebhookDeliveryLog`**

```prisma
model WebhookDeliveryLog {
  id                String   @id @default(cuid())
  webhookEndpointId String
  endpoint          WebhookEndpoint @relation(fields: [webhookEndpointId], references: [id], onDelete: Cascade)
  brandId           String   // Denormalized for index-only queries
  event             String   // "case.created" | "case.status_changed" | "case.overdue"
  caseId            String
  httpStatus        Int?     // null if request never completed
  latencyMs         Int?
  success           Boolean
  attempt           Int      @default(1)  // 1–5
  requestPayload    Json     // truncated to 2 KB for storage
  responseBody      String?  // first 500 chars
  deliveredAt       DateTime @default(now())

  @@index([webhookEndpointId, deliveredAt(sort: Desc)])
  @@index([brandId, deliveredAt(sort: Desc)])
  @@map("webhook_delivery_logs")
}
```

**Brand relation addition:**
```prisma
// On existing Brand model:
webhookEndpoints  WebhookEndpoint[]
```

---

### API Endpoints

All routes under `/v1/webhooks`, guarded by standard Clerk JWT auth + multi-tenant plugin.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/webhooks` | List all endpoints for brand |
| `POST` | `/v1/webhooks` | Create endpoint — returns `signingSecret` in response body (only time it is returned) |
| `PATCH` | `/v1/webhooks/:id` | Update label, URL, events[], active |
| `DELETE` | `/v1/webhooks/:id` | Hard delete endpoint + cascade delivery logs |
| `GET` | `/v1/webhooks/:id/deliveries` | Last 50 delivery log entries (no pagination needed) |
| `POST` | `/v1/webhooks/:id/test` | Fire synthetic `case.created` test event → queues a delivery |

**Zod schemas** (in `packages/shared/src/zod/webhooks.ts`):
```ts
export const CreateWebhookEndpointSchema = z.object({
  label: z.string().min(1).max(100),
  url: z.string().url(),
  events: z.array(z.enum(['case.created', 'case.status_changed', 'case.overdue'])).min(1),
})

export const UpdateWebhookEndpointSchema = CreateWebhookEndpointSchema.partial().extend({
  active: z.boolean().optional(),
})
```

**`POST /v1/webhooks` response** (secret shown once):
```json
{
  "id": "clxxx",
  "label": "My Zendesk Bot",
  "url": "https://example.com/hook",
  "events": ["case.created"],
  "active": true,
  "signingSecret": "whsec_<base64>",
  "createdAt": "..."
}
```
All subsequent `GET` responses omit `signingSecret`.

---

### Webhook Payload Shape

```json
{
  "event": "case.created",
  "timestamp": "2026-04-20T14:32:00.000Z",
  "brandId": "brand_xxx",
  "data": {
    "caseId": "case_xxx",
    "alertRuleId": "rule_xxx",
    "alertRuleName": "Detractor Alert",
    "status": "OPEN",
    "priority": "HIGH",
    "assignee": "jane@acme.com",
    "score": 3,
    "sentiment": -0.82,
    "topics": ["shipping", "delay"],
    "surveyName": "Post-Purchase NPS",
    "feedback": "Package arrived two weeks late.",
    "slaDeadline": "2026-04-21T14:32:00.000Z",
    "memberId": "member_xxx",
    "createdAt": "2026-04-20T14:32:00.000Z"
  }
}
```

For `case.status_changed`, `data` adds:
```json
{
  "previousStatus": "OPEN",
  "newStatus": "CONTACTED",
  "changedAt": "..."
}
```

For `case.overdue`, `data` adds:
```json
{
  "slaDeadline": "...",
  "hoursOverdue": 2.5
}
```

---

### Signing

Header sent with every request:
```
X-CustomerEQ-Signature: sha256=<hmac-sha256-hex>
X-CustomerEQ-Timestamp: <unix-epoch-seconds>
```

Signed string: `<timestamp>.<json-body>` — mirrors the Stripe webhook signature pattern, which is the industry standard and makes replay attack detection straightforward for receivers.

Node signing implementation:
```ts
import { createHmac } from 'crypto'

function signPayload(secret: string, timestamp: number, body: string): string {
  const signingInput = `${timestamp}.${body}`
  return 'sha256=' + createHmac('sha256', secret).update(signingInput).digest('hex')
}
```

---

### Event Delivery Architecture

**New BullMQ queue: `webhook-delivery`**

Added to `apps/worker/src/queues/` and `apps/worker/src/processors/webhookDelivery.ts`.

Concurrency: 10 (same as `campaign-triggers` — I/O bound).

**Retry config:**
```ts
{
  attempts: 5,
  backoff: { type: 'exponential', delay: 5000 }, // 5s, 10s, 20s, 40s, 80s
}
```

After all retries exhausted, BullMQ moves the job to the failed queue — delivery log row already written with `success: false`.

**Hook points — where enqueue calls are added:**

| Event | File | After What |
|-------|------|-----------|
| `case.created` | `apps/worker/src/processors/alertEvaluation.ts` | After `prisma.caseFollowUp.create()` |
| `case.status_changed` | `apps/api/src/routes/cases.ts` | After `prisma.caseFollowUp.update()` in PATCH `/cases/:id/status` |
| `case.overdue` | `apps/worker/src/processors/slaBreachCheck.ts` (new) | Scheduled repeating BullMQ job — every 5 minutes |

**SLA breach checker (new repeating job):**

BullMQ supports `repeat: { every: 5 * 60 * 1000 }`. The processor:
1. Queries all `CaseFollowUp` where `status IN ('OPEN', 'CONTACTED') AND slaDeadline < NOW() AND slaBreachedAt IS NULL`
2. Updates `slaBreachedAt = NOW()` for each (prevents duplicate `case.overdue` firing)
3. Enqueues one `webhook-delivery` job per case per active endpoint subscribed to `case.overdue`

**Processor pseudocode (`webhookDelivery.ts`):**
```ts
export async function processWebhookDelivery(job: Job, prisma: PrismaClient) {
  const { webhookEndpointId, event, caseId, payload } = job.data
  const endpoint = await prisma.webhookEndpoint.findFirst({
    where: { id: webhookEndpointId, active: true },
  })
  if (!endpoint) return // endpoint deleted or deactivated

  const body = JSON.stringify(payload)
  const ts = Math.floor(Date.now() / 1000)
  const sig = signPayload(decrypt(endpoint.signingSecret), ts, body)

  const start = Date.now()
  let httpStatus: number | null = null
  let responseBody: string | null = null
  let success = false

  try {
    const res = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CustomerEQ-Signature': sig,
        'X-CustomerEQ-Timestamp': String(ts),
      },
      body,
      signal: AbortSignal.timeout(10_000), // 10s timeout
    })
    httpStatus = res.status
    responseBody = (await res.text()).slice(0, 500)
    success = res.ok
  } catch (err) {
    responseBody = String(err).slice(0, 500)
  }

  await prisma.webhookDeliveryLog.create({
    data: {
      webhookEndpointId,
      brandId: endpoint.brandId,
      event,
      caseId,
      httpStatus,
      latencyMs: Date.now() - start,
      success,
      attempt: (job.attemptsMade ?? 0) + 1,
      requestPayload: payload,
      responseBody,
    },
  })

  if (!success) throw new Error(`Delivery failed: HTTP ${httpStatus}`)
}
```

---

### Admin UI

**New page: `apps/web/src/app/(admin)/admin/settings/webhooks/page.tsx`**

Layout:
- Header: "Webhook Endpoints" + "Add Endpoint" button
- Table: Label | URL (masked: `https://exa…m/hook`) | Events | Status (last delivery) | Actions (Edit, Deliveries, Delete)
- "Add Endpoint" → modal with: Label input, URL input, event checkboxes
- After creation: banner showing the signing secret with copy button — "Store this secret now. It won't be shown again."
- Deliveries drawer (Sheet component): triggered by "Deliveries" action — shows last 50 log rows

Navigation: Add "Webhooks" link under Settings in the admin sidebar.

---

### Failure Modes & Timeouts

| Scenario | Behaviour |
|---|---|
| Endpoint URL returns 4xx | Logged as failure; BullMQ retries (4xx is treated as retriable — receiver may be temporarily misconfigured) |
| Endpoint URL returns 5xx | Logged as failure; retried |
| Network timeout (>10s) | AbortSignal kills the fetch; logged as failure; retried |
| All 5 retries exhausted | Job moves to BullMQ failed queue; delivery log row has `success: false`, `attempt: 5` |
| Endpoint deleted mid-retry | Processor finds no endpoint, returns without throwing — job completes silently |
| `case.overdue` fired twice | `slaBreachedAt` column prevents duplicate enqueue (set before enqueueing) |

---

### Confidence Level

**90 / 100**

All components (BullMQ queues, HMAC signing, Prisma models, Fastify routes) follow patterns already proven in the codebase. The only new pattern is the repeating SLA breach job — BullMQ's `repeat` option is well-documented. Risk is low.

---

## Validation Plan

| User Scenario | Expected Outcome | Validation Method |
|---|---|---|
| Admin creates webhook endpoint | Endpoint stored; signing secret returned once in response | Integration: POST `/v1/webhooks`, assert 201 + `signingSecret` in body; GET `/v1/webhooks` asserts secret not returned |
| Survey response triggers detractor alert → case created | `case.created` payload POSTed to all active endpoints for brand | Integration: create survey response, assert `webhook-delivery` job enqueued with correct payload |
| Case status changed via API | `case.status_changed` payload delivered with `previousStatus` / `newStatus` | Integration: PATCH `/v1/cases/:id/status`, assert delivery job enqueued |
| SLA deadline passes | `case.overdue` payload delivered; `slaBreachedAt` set; no duplicate fires | Integration: insert case with past `slaDeadline`, run SLA checker, assert single delivery job and `slaBreachedAt` set |
| Receiver returns 500 | Delivery retried up to 5 times; final log row has `success: false, attempt: 5` | Unit: mock fetch to return 500; assert 5 BullMQ retries |
| Endpoint is inactive | No delivery job enqueued | Integration: set endpoint `active: false`, trigger case, assert no delivery job |
| Signature verification | HMAC on receiver side matches | Unit: reconstruct signature from known secret + payload, assert match |
| Test endpoint fires | Synthetic `case.created` appears in delivery log | Integration: POST `/v1/webhooks/:id/test`, assert delivery log row |
| Delete endpoint | Cascade deletes delivery logs | Integration: DELETE `/v1/webhooks/:id`, assert delivery logs gone |
| Admin UI: create endpoint shows secret once | Secret visible in post-creation banner, not on subsequent loads | E2E (Playwright): create endpoint, assert secret shown; reload, assert secret hidden |

---

## Test Matrix

**Unit** (`apps/worker/src/processors/webhookDelivery.test.ts`):
- Signs payload correctly (known secret, known body, known timestamp → known HMAC)
- Handles fetch timeout → logs failure, throws to trigger retry
- Handles 4xx/5xx → logs failure, throws to trigger retry
- Handles deleted endpoint → returns without error
- `slaBreachCheck.ts`: skips cases with `slaBreachedAt` already set; sets `slaBreachedAt` before enqueuing

**Integration** (`apps/api/test/integration/webhooks.test.ts`):
- Full CRUD on `/v1/webhooks`
- Multi-tenant isolation: brand A cannot read/write brand B endpoints
- `GET /v1/webhooks/:id/deliveries` returns correct log rows
- Delivery enqueue on case creation (mock BullMQ queue, assert `add()` called with correct args)
- Delivery enqueue on status change

**E2E** (`apps/web/test/e2e/webhooks.spec.ts`):
- Create endpoint → secret shown once → delivery log page renders

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Signing secret stored in plaintext | High (not yet encrypted) | High | **Hard gate: credential encryption (#53) must be completed before any customer is onboarded.** The `signingSecret` and `url` fields on `WebhookEndpoint` must be encrypted at rest. Implementation may proceed in a pre-production environment without encryption, but the feature must not be exposed to customers until #53 is resolved and encryption is verified. |
| Receiver is slow / hangs | Medium | Medium | 10s `AbortSignal` timeout; does not block the worker's concurrency slot beyond that |
| High-volume brands generate excessive delivery jobs | Low (mid-market ICP) | Medium | Rate-limit: max 20 webhook endpoints per brand; max 100 delivery jobs per minute per brand (BullMQ rate limiter) |
| Replay attacks from stolen payloads | Low | Medium | Timestamp in signature; receivers should reject requests where `now - timestamp > 300s` |
| `case.overdue` fires before `slaBreachedAt` write completes | Low | Low | `slaBreachedAt` is written in the same DB transaction as the enqueue guard check |

---

## Observability

**Logs** (Pino structured):
- `webhook.delivery.success`: `{ endpointId, event, caseId, latencyMs, httpStatus }`
- `webhook.delivery.failure`: `{ endpointId, event, caseId, attempt, httpStatus, error }`
- `webhook.sla_breach_check.ran`: `{ casesFound, endpointsNotified }`

**Metrics** (future — not in this issue):
- `webhook_deliveries_total{event, success}` (Prometheus counter)
- `webhook_delivery_latency_ms` (histogram)

---

## Spike Findings

No spike required. All technology choices (BullMQ repeating jobs, HMAC-SHA256, Prisma, Fastify plugins) are already in use in this codebase.

---

## Architecture Analysis

### Patterns Correctly Followed

| Pattern | How RFC Follows It |
|---|---|
| **Event-Driven Processing** | Webhook delivery is async via BullMQ — API/worker enqueues the job, worker delivers. Same decoupling model as `loyalty-events` and `campaign-triggers`. |
| **Multi-Tenant Isolation** | `WebhookEndpoint` and `WebhookDeliveryLog` both carry `brandId`. All `/v1/webhooks` routes are guarded by the existing auth + multiTenant plugins — `brandId` comes from JWT, never from the request body. |
| **HMAC-SHA256 Signature Verification** | Outbound signing mirrors the inbound pattern used for Salesforce/HubSpot webhooks. Same algorithm, same Node `crypto.createHmac` approach. |
| **BullMQ Queue Naming & Processor Placement** | New `webhook-delivery` queue follows the `apps/worker/src/queues/` + `apps/worker/src/processors/` convention established by all 7 existing queues. |
| **Zod Schemas in `packages/shared`** | `CreateWebhookEndpointSchema` and `UpdateWebhookEndpointSchema` live in `packages/shared/src/zod/webhooks.ts` — consistent with all other domain schemas. |
| **Fastify Plugin Route Structure** | `/v1/webhooks` route file follows the `FastifyPluginAsync` pattern used by all other route files under `apps/api/src/routes/`. |
| **Audit Logging** | The existing `audit` plugin (`onResponse` hook) automatically logs POST/PATCH/DELETE on `/v1/webhooks` — this is free and requires no additional code. |

### Patterns Missing from Architecture

These patterns are introduced by this RFC but not yet documented in `docs/architecture/architecture.md`. They should be added during the `address-feedback` phase after user review.

| Gap | Description | Suggested Documentation Location |
|---|---|---|
| **Outbound Webhook Delivery** | Architecture documents inbound HMAC webhooks (§5.3) but has no section on outbound delivery — the reverse flow where CustomerEQ is the sender. New data flow diagram needed. | §5 Data Flow → add §5.4 Outbound Webhook Delivery |
| **BullMQ Repeating Jobs** | §4.3 lists workers and their concurrency but does not mention BullMQ's `repeat` (cron-style) capability. The SLA breach checker introduces the first repeating job. | §4.3 BullMQ Workers → add note on repeating jobs |
| **Credential Encryption at Rest** | Neither the architecture doc nor the Prisma schema currently documents any encryption strategy for sensitive string fields (webhook URLs, signing secrets). **Hard gate: #53 must be resolved before any customer is onboarded to this feature.** The `signingSecret` and `url` fields must be encrypted at rest before production exposure. | §6 Design Patterns → add Credential Encryption entry; mark as pre-onboarding requirement |
| **Delivery Log Pattern** | No existing pattern for recording outbound HTTP delivery attempts. `WebhookDeliveryLog` establishes a new convention for auditing external HTTP calls made by the worker. | §4.4 Database Models → add WebhookDeliveryLog description |

### Patterns Incorrectly Followed

| Issue | Severity | Detail | Resolution |
|---|---|---|---|
| **Route namespace ambiguity** | Low | Inbound integration webhooks live at `/v1/integrations/webhooks/{provider}`. This RFC places outbound webhook config at `/v1/webhooks`. These are distinct resources (inbound receivers vs. outbound endpoint config), so `/v1/webhooks` is semantically correct — but the architecture doc's route table (§4.1) needs a clear entry to avoid future confusion. | Add `/v1/webhooks` row to §4.1 route table during address-feedback phase. No RFC change needed. |
| **`slaBreachedAt` not in current schema** | Medium | The RFC references a `slaBreachedAt` column on `CaseFollowUp` for deduplication of `case.overdue` events. This column exists in the schema already (`slaBreachedAt DateTime?`). Confirmed — no change needed. | No action. |
