# Feature: Response-to-Action Rule Builder and Loop Monitor

Issue: #80  
Owner: swavak@gmail.com

---

## Customer

Marketing Manager at a mid-market brand using CustomerEQ to run a loyalty program. Owns the CX-to-loyalty strategy. Does not have an engineering background.

---

## Customer Problem Being Solved

After a survey response arrives, the manager today must: note the survey ID, navigate to the campaign builder, recall which score ranges they want to act on, and build one campaign per tier — with no in-context connection back to the survey. More critically: even after building those campaigns, nothing fires them automatically. The pipeline between "member submitted NPS = 3" and "win-back campaign executes" does not exist.

Issue #80 solves both halves:
1. **Configuration gap** — the Rule Builder (Step 3) and Review & Launch (Step 4) wizard steps let the manager define response-to-action rules in the same flow as building the survey, with a reusable CX Playbook abstraction.
2. **Wiring gap** — the survey response submission path is extended to evaluate those rules and enqueue the resulting campaign triggers, closing the actual feedback-to-loyalty pipeline.

---

## User Experience That Will Solve the Problem

### Creating a survey with rules (wizard Steps 3–4)

1. Admin navigates to `/admin/surveys/new`, completes Steps 1 and 2 as before
2. **Step 3 — "What happens next?"** loads with one pre-populated default rule row (NPS: Detractors 0–6 → `award_points` 100 pts)
3. Manager configures score range, action type, and action config inline. A live badge shows estimated member reach per rule
4. Manager optionally saves the ruleset as a named CX Playbook via "Save as Playbook"
5. Manager clicks "Continue: Review & Launch →"
6. **Step 4 — Review & Launch** shows a full summary: survey identity, content summary, rules table with estimated reach and point cost, total budget estimate, budget cap warning if applicable
7. Manager clicks "Launch Survey"
8. API: survey status → `ACTIVE`, one `Campaign` record created per rule (with `triggerType = "cx.survey_response"`, `triggerCondition = { surveyId, scoreMin, scoreMax }`), manager redirected to survey detail page

### Post-launch: Loop Monitor

9. Survey detail page shows the **Loop Monitor** section — a 5-stage pipeline: Surveys Sent → Responses Received → Rules Matched → Campaigns Triggered → Loyalty Outcomes
10. Each stage is clickable to expand a detail drawer
11. A latency strip shows P50/P95 feedback-to-campaign latency (color-coded against the 15-minute SLA)
12. If no campaigns have triggered within 48 hours of the first response, an amber warning banner appears with a "Review rules" CTA
13. Auto-refresh every 60 seconds

### Survey response → campaign execution (the wiring)

14. Member submits a survey response via `POST /v1/public/surveys/:id/respond`
15. The API evaluates active `SurveyRule` records for the survey against the response score
16. For each matching rule, a `Campaign` is looked up by the rule's linked `campaignId` and enqueued to the `campaign-triggers` queue — same path as event-ingestion campaign triggers
17. The existing `campaignTriggers.ts` processor handles execution: dedup, budget check, atomic award

---

## Technical Details

### New Data Models

#### `CxPlaybook`
Brand-scoped named ruleset for reuse across surveys of the same type.

```prisma
model CxPlaybook {
  id         String   @id @default(cuid())
  brandId    String
  brand      Brand    @relation(fields: [brandId], references: [id])
  name       String
  surveyType SurveyType
  rules      Json     // Array of { scoreMin, scoreMax, actionType, actionConfig, ruleLabel? }
  deletedAt  DateTime?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@unique([brandId, name])
  @@index([brandId, surveyType])
  @@map("cx_playbooks")
}
```

Audit: `POST`, `PUT`, `DELETE` on playbooks flow through the existing audit plugin automatically.

#### `SurveyRule`
Per-survey response-to-action rule. One row per rule defined in the wizard. Links a survey to a campaign.

```prisma
model SurveyRule {
  id           String   @id @default(cuid())
  brandId      String
  surveyId     String
  survey       Survey   @relation(fields: [surveyId], references: [id])
  campaignId   String   @unique  // one rule → one campaign (1:1)
  campaign     Campaign @relation(fields: [campaignId], references: [id])
  scoreMin     Float
  scoreMax     Float
  actionType   String   // award_points | award_reward | send_message | spin_wheel | scratch_card | mystery_box
  actionConfig Json     // same shape as Campaign.actionConfig
  ruleLabel    String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([surveyId])
  @@index([brandId])
  @@map("survey_rules")
}
```

#### `Survey` model additions
```prisma
// Add to Survey model:
surveyRules     SurveyRule[]
distributionCount Int @default(0)  // incremented by survey.distribute worker jobs
```

#### `Campaign` model additions
```prisma
// Add to Campaign model:
surveyRule      SurveyRule?   // back-relation; null for non-survey campaigns
surveyId        String?       // denormalized for loop monitor queries
```

#### `CampaignEvent` model additions
```prisma
// Add to CampaignEvent model (already has latencyMs):
surveyResponseId String?  // FK → SurveyResponse, for loop monitor Rules Matched + Campaigns Triggered counts
```

---

### Schema Migration

```sql
-- New tables
CREATE TABLE cx_playbooks (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id),
  name TEXT NOT NULL,
  survey_type TEXT NOT NULL,
  rules JSONB NOT NULL,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(brand_id, name)
);
CREATE INDEX cx_playbooks_brand_survey_type ON cx_playbooks(brand_id, survey_type);

CREATE TABLE survey_rules (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL,
  survey_id TEXT NOT NULL REFERENCES surveys(id),
  campaign_id TEXT UNIQUE NOT NULL REFERENCES campaigns(id),
  score_min FLOAT NOT NULL,
  score_max FLOAT NOT NULL,
  action_type TEXT NOT NULL,
  action_config JSONB NOT NULL,
  rule_label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX survey_rules_survey_id ON survey_rules(survey_id);
CREATE INDEX survey_rules_brand_id ON survey_rules(brand_id);

-- Additions to existing tables
ALTER TABLE surveys ADD COLUMN distribution_count INT DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN survey_id TEXT REFERENCES surveys(id);
ALTER TABLE campaign_events ADD COLUMN survey_response_id TEXT REFERENCES survey_responses(id);
```

---

### API Surface Changes

#### New endpoints

**`POST /v1/cx-playbooks`** — Create playbook
- Auth: brand JWT
- Body: `{ name: string, surveyType: SurveyType, rules: SurveyRuleInput[] }`
- Response: 201 `CxPlaybook`
- Validation: `name` non-empty, `surveyType` valid enum, `rules` array non-empty, no overlapping score ranges within rules

**`GET /v1/cx-playbooks?surveyType=NPS`** — List playbooks for brand
- Auth: brand JWT
- Query: `surveyType` (optional filter)
- Response: 200 `{ data: CxPlaybook[], total: number }`
- Filters out `deletedAt != null`

**`PUT /v1/cx-playbooks/:id`** — Overwrite playbook rules
- Auth: brand JWT
- Body: `{ name?: string, rules: SurveyRuleInput[] }`
- Response: 200 updated `CxPlaybook`

**`DELETE /v1/cx-playbooks/:id`** — Soft-delete playbook
- Auth: brand JWT
- Response: 204

**`POST /v1/surveys/:id/launch`** — Launch survey (status → ACTIVE, create campaigns)
- Auth: brand JWT
- Body: `{ rules: SurveyRuleInput[] }` (the confirmed ruleset; empty array = launch without rules)
- Transaction:
  1. Set `survey.status = 'ACTIVE'`
  2. For each rule: create `Campaign` (`triggerType = "cx.survey_response"`, `triggerCondition = { surveyId, scoreMin, scoreMax }`, `status = 'ACTIVE'`, `startDate = now()`) + create `SurveyRule` linking survey → campaign
  3. Emit audit event
- Response: 200 `{ surveyId, campaignsCreated: number }`
- Idempotent: if survey already `ACTIVE`, returns 200 without re-creating campaigns

**`GET /v1/surveys/:id/loop-monitor`** — Loop monitor pipeline data
- Auth: brand JWT
- Response shape:
```json
{
  "surveyId": "...",
  "generatedAt": "2026-04-07T...",
  "pipeline": {
    "surveysSent": 1240,
    "responsesReceived": 312,
    "scoreDistribution": { "0-6": 58, "7-8": 147, "9-10": 107 },
    "rulesMatched": 295,
    "campaignsTriggered": 289,
    "loyaltyOutcomes": {
      "pointsAwarded": 43350,
      "rewardsIssued": 12,
      "retentionDelta": null
    }
  },
  "latency": {
    "p50Ms": 2300,
    "p95Ms": 11700,
    "sampleSize": 289,
    "slaStatus": "ok"
  },
  "warning": null
}
```
- Queries run in `Promise.all` (same graceful-degradation contract as `program-health` — partial failures return null sub-fields, never 5xx)
- `rulesMatched`: count of `CampaignEvent` records where `surveyResponseId` is not null and campaign is linked to this survey
- `campaignsTriggered`: same count filtered to `status = 'executed'`
- `loyaltyOutcomes.pointsAwarded`: sum of `LoyaltyEvent.pointsEarned` for events with `campaignId` in this survey's campaign IDs
- `latency.p50Ms` / `p95Ms`: computed with PostgreSQL `PERCENTILE_CONT`:
  ```sql
  SELECT
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY latency_ms) AS p50,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95,
    COUNT(*) AS sample_size
  FROM campaign_events
  WHERE campaign_id = ANY($1) AND latency_ms IS NOT NULL
  ```
- `warning`: `{ type: "no_campaigns_triggered_48h", message: "..." }` if conditions met (first response > 48h ago AND `campaignsTriggered = 0`), else `null`

**`GET /v1/analytics/reach-estimate` additions** (extend existing endpoint)
- Add support for `surveyId` + `surveyType` query params to return score distribution
- Used by Rule Builder to show estimated reach badges per rule row

---

### Survey Response Submission Wiring

**File: `apps/api/src/routes/public.ts`** — extend existing `POST /v1/public/surveys/:id/respond` handler

After the existing incentive points enqueue step, add:

```typescript
// Evaluate response-to-action rules
const surveyRules = await fastify.prisma.surveyRule.findMany({
  where: { surveyId: survey.id, brandId: survey.brandId },
  include: { campaign: { select: { id: true, status: true, brandId: true } } },
})

const matchingRules = surveyRules.filter(rule =>
  response.score !== null &&
  response.score !== undefined &&
  response.score >= rule.scoreMin &&
  response.score <= rule.scoreMax &&
  rule.campaign.status === 'ACTIVE'
)

for (const rule of matchingRules) {
  // Enqueue campaign trigger — same path as event ingestion
  await enqueueCampaignTrigger({
    campaignId: rule.campaignId,
    memberId: member.id,
    brandId: survey.brandId,
    eventIngestedAt: new Date().toISOString(),
    surveyResponseId: response.id,  // for loop monitor linkage
  })
}
```

**Constraint**: Only fires for surveys with `status = 'ACTIVE'` (already enforced by the survey lookup at the top of the handler). No new consent check required — existing `consentGivenAt` check already gates the entire response submission path.

**`CampaignTriggerPayload` type addition** (`packages/shared/src/types/`):
```typescript
surveyResponseId?: string  // optional — set when triggered by survey response
```

**`campaignTriggers.ts` processor addition**:
When `job.data.surveyResponseId` is set, update the created `CampaignEvent` to include `surveyResponseId`.

---

### Frontend Changes

#### New files
- `apps/web/src/components/surveys/RuleBuilderStep.tsx` — Step 3 wizard step
- `apps/web/src/components/surveys/ReviewLaunchStep.tsx` — Step 4 wizard step
- `apps/web/src/components/surveys/LoopMonitor.tsx` — post-launch pipeline view
- `apps/web/src/components/surveys/PlaybookSelector.tsx` — Load Playbook dropdown

#### Modified files
- `apps/web/src/app/(admin)/admin/surveys/new/page.tsx` — extend from 2 steps to 4 steps; add step 3 + 4 rendering
- `apps/web/src/app/(admin)/admin/surveys/[id]/page.tsx` — add Loop Monitor section below survey header KPI row

#### `RuleBuilderStep` component
- Props: `surveyType: SurveyType`, `programId: string`, `onContinue(rules: SurveyRuleInput[]): void`, `onSkip(): void`
- State: `rules: SurveyRuleInput[]`, `playbooks: CxPlaybook[]`
- Fetches `GET /v1/cx-playbooks?surveyType=...` on mount
- Fetches reach estimate per rule via `GET /v1/analytics/reach-estimate?surveyId=...&scoreMin=...&scoreMax=...` (debounced 500ms after range change)
- Validates no overlapping score ranges client-side; disables "Continue" on overlap
- "Save as Playbook" → `POST /v1/cx-playbooks` + updates local playbook list
- "Load Playbook" → confirmation prompt → replaces rule rows

#### `ReviewLaunchStep` component
- Props: `surveyId: string`, `triggerData`, `contentSummary`, `rules: SurveyRuleInput[]`, `onLaunch(): void`, `onBack(): void`
- Computes `estimatedPointCost = sum(rule.reachEstimate × rule.points)` for `award_points` rules
- Shows budget cap warning if `estimatedPointCost > program.budgetCap`
- "Launch Survey" → `POST /v1/surveys/:id/launch` → on success, router.push to `/admin/surveys/:id`

#### `LoopMonitor` component
- Props: `surveyId: string`, `surveyStatus: SurveyStatus`
- When `surveyStatus !== 'ACTIVE'`: renders placeholder card "Loop Monitor activates when the survey is live."
- When `ACTIVE`: fetches `GET /v1/surveys/:id/loop-monitor`, auto-refreshes every 60s
- 5 pipeline stage blocks with chevron connectors
- Clickable stages open inline detail drawers (not modals)
- Latency strip: P50/P95 with SLA color coding (green < 900s, amber 900–1800s, red > 1800s)
- 48h warning banner from `response.warning` field

---

### Architecture Gaps to Document

The following patterns established by this feature should be added to `docs/architecture/architecture.md`:

1. **Survey response → campaign trigger wiring** (`§4.1 API Routes` under `/v1/public/*`): When a survey response is submitted, the API evaluates `SurveyRule` records for the survey and enqueues matching campaign triggers. The same `campaign-triggers` BullMQ queue is used. `surveyResponseId` is passed for loop monitor linkage.

2. **`POST /v1/surveys/:id/launch` pattern** (`§4.1`): Survey activation is a dedicated endpoint (not a `PATCH status`), because it has side effects (campaign creation). Any future resource that requires side-effect-bearing status transitions should use the `POST /:id/action` pattern, not `PATCH /:id`.

3. **Loop monitor API contract** (`§4.1`): `GET /v1/surveys/:id/loop-monitor` follows the graceful-degradation contract: all sub-queries run in `Promise.all`; individual failures return null sub-fields. Never returns 5xx. Consistent with `GET /v1/analytics/program-health` pattern.

4. **`CxPlaybook` as brand-scoped reusable configuration** (`§4.4 Database Models`): Playbooks are scoped to `brandId`, not `programId`, allowing reuse across multiple loyalty programs within the same brand. This is the pattern for any brand-level operator configuration that should survive program lifecycle changes.

---

### Failure Modes & Timeouts

| Failure | Behavior |
|---------|----------|
| `POST /v1/surveys/:id/launch` partial failure (campaign N of M fails to create) | Entire transaction rolled back. Survey status remains `DRAFT`. No partial state. |
| Score range overlap submitted to launch endpoint | 422 validation error. Transaction not started. |
| `GET /v1/surveys/:id/loop-monitor` sub-query timeout | Affected field returns `null`. Other fields unaffected. 200 response with `generatedAt` timestamp. |
| `enqueueCampaignTrigger` fails during response submission | Logged server-side. Response submission still returns 201 (incentive points already enqueued). Campaign trigger failure is non-blocking — consistent with existing event ingestion pattern. |
| `GET /v1/cx-playbooks` called with soft-deleted playbooks | Filtered from results. Surveys already launched with those rules are unaffected. |

---

### Confidence Level

**88 / 100**

High confidence because:
- Campaign trigger wiring is an exact structural copy of the event ingestion → campaign trigger path (already proven in production)
- PostgreSQL `PERCENTILE_CONT` for P50/P95 is a built-in aggregate — no uncertainty
- `Promise.all` graceful-degradation pattern is already used in `program-health`

Lower than 95 because:
- `@@unique([campaignId, memberId])` on `CampaignEvent` means a member who submits two surveys matched by the same campaign can only get one `CampaignEvent`. This is intentional (dedup) but means the loop monitor `campaignsTriggered` count will undercount for shared campaigns. **Decision**: each `SurveyRule` creates a distinct `Campaign` via the launch endpoint — so this is not a problem in practice (no shared campaigns across rules).
- `retentionDelta` (30-day retention rate delta) in Loop Monitor outcomes requires a cohort query across `SurveyResponse` + `LoyaltyEvent` tables — deferred to `null` in MVP, computed in a future iteration.

---

## Validation Plan

| User Scenario | Expected Outcome | Validation Method |
|---------------|-----------------|-------------------|
| Manager completes Step 3 with two non-overlapping rules | Both rules shown, reach badges populated, "Continue" enabled | E2E — Playwright |
| Manager configures overlapping rules (0–6 and 5–8) | Inline error on both rows, "Continue" disabled | E2E — Playwright |
| Manager saves rules as CX Playbook | `POST /v1/cx-playbooks` returns 201, playbook in dropdown | E2E — Playwright |
| Manager loads playbook, rules replaced | Rule rows match playbook, rows editable | E2E — Playwright |
| Manager clicks "Launch Survey" on Step 4 | `POST /v1/surveys/:id/launch` → 200, survey `ACTIVE`, N campaigns created | Integration — Supertest |
| Survey ACTIVE, member submits NPS = 3 (matches 0–6 rule) | Campaign trigger enqueued, CampaignEvent created, LoyaltyEvent created | Integration — Supertest + worker |
| Survey ACTIVE, member submits NPS = 9 (no matching rule) | No campaign trigger enqueued | Integration — Supertest |
| GET /v1/surveys/:id/loop-monitor with 289 events | Returns correct counts + P50/P95 + slaStatus | Integration — Supertest |
| Survey active > 48h, 0 campaigns triggered | `warning.type = "no_campaigns_triggered_48h"` in response | Integration — Supertest |
| P95 latency > 1800s | `slaStatus = "breach"`, red indicator in UI | Integration + E2E |
| `GET /v1/cx-playbooks?surveyType=CSAT` with 2 NPS + 1 CSAT playbook | Only 1 CSAT playbook returned | Integration — Supertest |
| Launch with no rules | Survey status → ACTIVE, no campaigns created, 0 rules | Integration — Supertest |

---

## Test Matrix

### Unit Tests
- `packages/shared/src/` — `evaluateSurveyRule(rule, score): boolean` pure function (score in range, boundary values, out of range)
- `validateRuleOverlap(rules: SurveyRuleInput[]): OverlapError[]` — overlap detection (no overlap, exact adjacency, overlap, single rule)
- `computeLatencyPercentiles(latencyMs: number[], p: number): number` — P50/P95 edge cases (empty, single value, even/odd count)
- `computeLoopMonitorWarning(firstResponseAt, campaignsTriggered): Warning | null` — 48h logic (< 48h → null, > 48h + 0 triggers → warning, > 48h + >0 triggers → null)

### Integration Tests (`apps/api/test/integration/`)

**`cx-playbooks.test.ts`** (new):
- `POST /v1/cx-playbooks` — create, duplicate name conflict, invalid surveyType, overlap validation
- `GET /v1/cx-playbooks` — list with/without surveyType filter, cross-tenant isolation
- `PUT /v1/cx-playbooks/:id` — update rules, name conflict with another playbook
- `DELETE /v1/cx-playbooks/:id` — soft-delete, not returned in subsequent GET

**`surveys.test.ts`** (extend existing):
- `POST /v1/surveys/:id/launch` — creates campaigns per rule, idempotent on re-call, overlap validation, empty rules
- `GET /v1/surveys/:id/loop-monitor` — pipeline counts with seeded data, 48h warning, latency percentiles, DRAFT survey returns placeholder, cross-tenant isolation

**`public.test.ts`** (extend existing):
- Survey response submission with matching rule → campaign trigger enqueued
- Survey response with non-matching score → no trigger
- Survey with no rules → no trigger (regression)
- Survey response with score on boundary (exactly scoreMin, exactly scoreMax)

### E2E Tests (`apps/web/test/e2e/survey-rule-builder.spec.ts`) — new file
- Happy path: Steps 1 → 4 → Launch → Loop Monitor placeholder visible
- Rule validation: overlap error blocks "Continue", fix clears error
- Playbook: save → load → rules replaced, rows editable
- Step 4 back button: returns to Step 3 with rules intact
- Loop Monitor (mocked API): 5 stages visible, latency strip, 48h warning banner visible and dismissable via "Review rules" CTA

---

## Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| `@@unique([campaignId, memberId])` on `CampaignEvent` double-fires for same member if they complete two surveys with overlapping campaigns | Low | Each `SurveyRule` creates its own `Campaign` via the launch transaction — no campaign is shared across rules. The constraint is not a problem. |
| Loop monitor query performance on high-volume surveys (10K+ responses, 10K+ CampaignEvents) | Medium | `campaign_events` has `@@index([brandId, campaignId])`. The loop monitor queries filter by campaign IDs (bounded set). Add `@@index([campaign_id, survey_response_id])` to `campaign_events` for the `WHERE survey_response_id IS NOT NULL` queries. |
| `enqueueCampaignTrigger` called N times per response submission (one per matching rule) | Low | Rules per survey are bounded (spec: reasonable to assume < 10). N enqueue calls are fast (Redis SET). Acceptable synchronous overhead during response submission. |
| CxPlaybook `rules` JSON schema drift | Low | Validate rule shape in the `POST /v1/cx-playbooks` Zod schema. `SurveyRuleInput` Zod type shared between playbook and launch endpoints via `packages/shared/src/zod/`. |
| `retentionDelta` deferred to null | Accepted | Documented in spec. Loop Monitor UI shows "—" for retention delta. A future iteration adds the cohort query. |

---

## Architecture Analysis

### Patterns Correctly Followed

- **Event-driven campaign triggers** (arch §6): Survey response submission enqueues to the `campaign-triggers` BullMQ queue — no synchronous loyalty state writes from the API layer.
- **Multi-tenant isolation** (arch §6): `brandId` sourced exclusively from JWT; `multiTenant` plugin rejects any `brandId` in request bodies. All new models carry `brandId`.
- **Transactional integrity** (arch §6): `POST /v1/surveys/:id/launch` uses `prisma.$transaction` to atomically create N campaigns + N survey rules — no partial state possible.
- **Graceful-degradation analytics contract** (arch §4.1): `GET /v1/surveys/:id/loop-monitor` runs sub-queries in `Promise.all`; individual failures return `null` sub-fields, never 5xx. Consistent with `program-health`.
- **Audit plugin** (arch §4.2): `POST`, `PUT`, `DELETE` on `/v1/cx-playbooks` automatically logged by the existing `onResponse` audit plugin — no manual audit calls needed.
- **Shared Zod schemas** (arch §3.5): `SurveyRuleInput` type defined in `packages/shared/src/zod/` and imported by both API and frontend — prevents contract drift.
- **No inline mocks in tests** (project rule 8): All test factories and helpers go in `packages/config/src/test-utils/`.
- **`@@unique([campaignId, memberId])`** dedup on `CampaignEvent` respected — each `SurveyRule` creates its own `Campaign`, so the unique constraint is not violated.

### Patterns Missing from Architecture (to be added after PR approval)

The following patterns introduced by this RFC are not yet documented in `docs/architecture/architecture.md`. Reviewer should confirm each before the architecture update in address-feedback:

1. **Survey response → campaign trigger wiring** (`§4.1 /v1/public/*`): When a survey response is submitted, the API evaluates `SurveyRule` records and enqueues matching campaign triggers via the existing `campaign-triggers` queue. `surveyResponseId` is passed for loop monitor linkage.

2. **`POST /:id/launch` for side-effect-bearing status transitions** (`§4.1`): Survey activation uses a dedicated `POST /v1/surveys/:id/launch` endpoint (not `PATCH status`) because activation has side effects (campaign creation). Any future resource with side-effect-bearing status transitions should use this `POST /:id/action` pattern.

3. **Brand-scoped reusable operator configuration** (`§4.4`): `CxPlaybook` is a brand-scoped (not program-scoped) entity that stores operator configuration surviving program lifecycle events. This is the pattern for any brand-level configuration reusable across programs.

4. **Loop monitor API contract** (`§4.1`): `GET /v1/surveys/:id/loop-monitor` follows the same graceful-degradation contract as `GET /v1/analytics/program-health`. Both are survey/program-scoped pipeline views — this pattern should be documented as standard for pipeline analytics endpoints.

### Patterns Incorrectly Followed

None identified. RFC design aligns with all existing architectural patterns.

---

## Observability

- **Logs**: `survey.rules_evaluated` log entry on every response submission — `{ surveyId, memberId, score, rulesMatched: N, triggersEnqueued: N }` (Pino structured log)
- **Logs**: `campaign_trigger.enqueue_failed` if `enqueueCampaignTrigger` throws — non-blocking, logged with `{ surveyId, ruleId, memberId, error }`
- **Metrics**: Existing `campaignTriggers` processor `latencyMs` field covers P50/P95 for loop monitor — no new metric needed
- **Alert**: If `slaStatus = "breach"` in loop monitor response, the UI surfaces it to the operator. No server-side alert added (existing alert evaluation pipeline already covers campaign execution failures)
