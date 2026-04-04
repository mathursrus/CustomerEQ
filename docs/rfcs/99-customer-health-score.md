# Technical Design: Customer Health Score

Issue: #99
Owner: Claude (technical-design job)
Spec: GitHub Issue #99 (Phase B: CRM Intelligence -- Customer Health Score)

## Customer

Brand administrators and CX managers who need a single at-a-glance metric to identify at-risk customers and prioritize proactive outreach. Also consumed by MCP-connected AI agents for automated customer intelligence.

## Customer Problem Being Solved

Customer health is currently invisible. Admins must manually cross-reference loyalty events, survey responses, campaign participation, and redemption history across multiple screens to assess a member's engagement level. There is no computed signal that flags at-risk customers before they churn.

This feature adds a computed Customer Health Score (0-100) that synthesizes recency, frequency, sentiment trajectory, NPS trend, and redemption activity into a single integer, enabling proactive customer management.

## User Experience That Will Solve the Problem

### Admin Flow (API / Dashboard)
1. Call `GET /v1/members` with optional `healthScoreMin` / `healthScoreMax` query parameters to filter members by health score range (e.g., "show me all members with health < 30")
2. Call `GET /v1/members/:id/360` to see a full Customer 360 view including the `healthScore` field, last activity date, and score component breakdown
3. Health scores are recomputed in batch (nightly scheduled or on-demand via `POST /v1/admin/health-scores/recompute`)

### MCP Agent Flow
1. Call `get_member` tool -- response now includes `healthScore`
2. Call new `get_member_360` tool -- returns full 360 view with health score breakdown
3. Agent can reason about at-risk customers and recommend outreach

### Batch Computation Flow
1. BullMQ `health-score-computation` queue processes a job for each brand
2. Worker iterates all active, non-erased members for the brand
3. For each member, queries input signals and computes weighted health score
4. Updates `Member.healthScore` and `Member.healthScoreUpdatedAt` atomically
5. Logs computation summary (members processed, score distribution)

## Technical Details

### 1. Schema Changes

#### 1.1 Prisma Migration: Add health score fields to Member

**File**: `packages/database/prisma/schema.prisma`

```prisma
model Member {
  // ...existing fields...
  healthScore          Int?       // 0-100 computed health score (null = never computed)
  healthScoreUpdatedAt DateTime?  // timestamp of last health score computation
}
```

**Migration**: 
```sql
ALTER TABLE members ADD COLUMN "healthScore" INTEGER;
ALTER TABLE members ADD COLUMN "healthScoreUpdatedAt" TIMESTAMP(3);
CREATE INDEX members_brand_health_score_idx ON members ("brandId", "healthScore");
```

Non-breaking -- existing rows have `healthScore = NULL` (treated as "not yet computed"). The index supports efficient range filtering on `GET /v1/members`.

#### 1.2 No New Models Required

The health score reuses existing signal models:
- `LoyaltyEvent` -- recency and frequency signals
- `SurveyResponse` -- sentiment trajectory and NPS/CSAT scores
- `CampaignEvent` -- campaign participation signal
- `Redemption` -- reward redemption activity signal
- `Member` -- stores computed score; `pointsBalance` is an input signal

### 2. Health Score Formula

The score is a weighted sum of 5 normalized sub-scores (each 0-100), producing a final 0-100 integer.

| Sub-Score | Weight | Input | Normalization |
|---|---|---|---|
| **Recency** | 25% | Days since last `LoyaltyEvent.createdAt` | 100 if within 7 days, linear decay to 0 at 90 days, 0 if >90 days |
| **Frequency** | 20% | Count of `LoyaltyEvent` records in last 90 days | 100 if >= 10 events, linear scale from 0-10 |
| **Sentiment** | 25% | Average `SurveyResponse.sentiment` from last 90 days | Map [-1.0, 1.0] to [0, 100]. Null (no surveys) = 50 (neutral) |
| **NPS/Score** | 15% | Latest `SurveyResponse.score` (NPS 0-10) | Map [0, 10] to [0, 100]. Null = 50 (neutral) |
| **Engagement** | 15% | Count of `CampaignEvent` + `Redemption` records in last 90 days | 100 if >= 5 activities, linear scale from 0-5 |

**Final score**: `Math.round(recency * 0.25 + frequency * 0.20 + sentiment * 0.25 + nps * 0.15 + engagement * 0.15)`

**Configurable weights**: Weights are defined in a `HealthScoreWeights` Zod schema and passed to the computation function. Default weights are hardcoded but can be overridden per-brand in the future (stored in a `Brand.healthScoreConfig` JSON field -- deferred to a future issue).

**Edge cases**:
- **New member with no history**: All sub-scores default to neutral (50), yielding a health score of 50
- **Erased member** (`Member.erased = true` or `Member.status = 'ERASED'`): Skipped entirely, `healthScore` remains null
- **Inactive member** (`Member.status = 'INACTIVE'`): Still computed (admin may want to see declining health)
- **Member with partial data**: Missing sub-scores default to 50 (neutral)

### 3. Queue Infrastructure

#### 3.1 New Queue: `health-score-computation`

**File**: `packages/shared/src/queues.ts`

```typescript
export const QUEUES = {
  // ...existing queues...
  HEALTH_SCORE_COMPUTATION: 'health-score-computation',
} as const
```

#### 3.2 New Payload Type

**File**: `packages/shared/src/types/health-score.ts`

```typescript
export interface HealthScoreComputationPayload {
  brandId: string
  memberId?: string  // if provided, recompute only this member; otherwise all active members
}

export interface HealthScoreWeights {
  recency: number    // default 0.25
  frequency: number  // default 0.20
  sentiment: number  // default 0.25
  nps: number        // default 0.15
  engagement: number // default 0.15
}

export interface HealthScoreBreakdown {
  recency: number
  frequency: number
  sentiment: number
  nps: number
  engagement: number
  overall: number
  computedAt: string  // ISO 8601
}
```

#### 3.3 Enqueue Function

**File**: `apps/api/src/queues/bullmq.ts`

Add `_healthScoreQueue`, `getHealthScoreQueue()`, `enqueueHealthScoreComputation()`, and `inlineHealthScoreComputation()` following the exact same pattern as existing queues (e.g., `_feedbackClusteringQueue`).

The inline mode implementation will:
1. Query all active, non-erased members for the brand (or a single member if `memberId` is provided)
2. For each member, run 5 aggregation queries (one per sub-score input)
3. Compute the weighted health score
4. Update `Member.healthScore` and `Member.healthScoreUpdatedAt`

#### 3.4 Worker Processor

**File**: `apps/worker/src/processors/healthScore.ts` (new file)

Follows the same pattern as existing processors. Concurrency: 3 (I/O-bound, moderate parallelism).

#### 3.5 Scheduling

The batch job is triggered:
1. **On-demand**: Via `POST /v1/admin/health-scores/recompute` API endpoint
2. **Scheduled**: Via BullMQ `repeat` option (cron: `0 2 * * *` -- daily at 2 AM UTC). Configured in worker startup.

### 4. API Surface Changes

#### 4.1 New Endpoint: `GET /v1/members/:id/360`

**File**: `apps/api/src/routes/members.ts`

Returns a comprehensive Customer 360 view for a single member.

**Response schema**:
```typescript
{
  member: {
    id: string
    email: string
    firstName: string | null
    lastName: string | null
    pointsBalance: number
    status: MemberStatus
    currentTierId: string | null
    healthScore: number | null
    healthScoreUpdatedAt: string | null  // ISO 8601
    createdAt: string
  }
  healthBreakdown: HealthScoreBreakdown | null  // computed on-the-fly from current data
  recentLoyaltyEvents: LoyaltyEvent[]           // last 10
  recentSurveyResponses: SurveyResponse[]       // last 5
  recentCampaignEvents: CampaignEvent[]         // last 5
  recentRedemptions: Redemption[]               // last 5
  stats: {
    totalLoyaltyEvents: number
    totalSurveyResponses: number
    totalCampaignEvents: number
    totalRedemptions: number
    avgSentiment: number | null
    latestNpsScore: number | null
    daysSinceLastActivity: number | null
  }
}
```

**Auth**: Requires authenticated admin (Clerk JWT with brandId). The `brandId` is enforced via Prisma middleware.

**Performance**: Uses a single Prisma `findFirst` with `include` for relations, plus a few aggregation queries. Expected latency <200ms for typical member data volume.

#### 4.2 Modified Endpoint: `GET /v1/members`

**File**: `apps/api/src/routes/members.ts`

Add optional query parameters:
- `healthScoreMin` (integer 0-100) -- filter members with `healthScore >= value`
- `healthScoreMax` (integer 0-100) -- filter members with `healthScore <= value`

These map to a Prisma `where` clause on `Member.healthScore` using the new index.

#### 4.3 Modified Endpoint: `GET /v1/members/:id`

Include `healthScore` and `healthScoreUpdatedAt` in the response (already returned since we select `*`, but explicitly document it).

#### 4.4 New Endpoint: `POST /v1/admin/health-scores/recompute`

**File**: `apps/api/src/routes/members.ts` (or new file `apps/api/src/routes/healthScores.ts`)

Triggers on-demand health score recomputation.

**Request body**:
```typescript
{
  memberId?: string  // optional: recompute for a single member
}
```

**Response**: `{ status: "queued", jobId: string }`

**Auth**: Admin only (Clerk JWT with org admin role).

### 5. MCP Tool Changes

**File**: `apps/mcp-server/src/tools/members.ts`

#### 5.1 Modify `get_member` tool
Include `healthScore` and `healthScoreUpdatedAt` in the response (automatic since it calls `GET /v1/members/:id`).

#### 5.2 New tool: `get_member_360`
```typescript
server.tool(
  'get_member_360',
  'Get full Customer 360 view including health score breakdown, recent activity, and engagement stats.',
  z.object({
    memberId: z.string().describe('Member ID'),
  }).shape,
  async ({ memberId }) => {
    const res = await apiFetch(`/v1/members/${memberId}/360`)
    // ...standard pattern...
  },
)
```

### 6. Zod Schema Changes

**File**: `packages/shared/src/zod/member.schema.ts` (new or extend existing)

```typescript
export const HealthScoreWeightsSchema = z.object({
  recency: z.number().min(0).max(1).default(0.25),
  frequency: z.number().min(0).max(1).default(0.20),
  sentiment: z.number().min(0).max(1).default(0.25),
  nps: z.number().min(0).max(1).default(0.15),
  engagement: z.number().min(0).max(1).default(0.15),
}).refine(
  (w) => Math.abs(w.recency + w.frequency + w.sentiment + w.nps + w.engagement - 1.0) < 0.001,
  { message: 'Weights must sum to 1.0' }
)

export const HealthScoreFilterSchema = z.object({
  healthScoreMin: z.coerce.number().int().min(0).max(100).optional(),
  healthScoreMax: z.coerce.number().int().min(0).max(100).optional(),
})

export const RecomputeHealthScoreSchema = z.object({
  memberId: z.string().optional(),
})
```

### 7. Files Modified Summary

| File | Change |
|---|---|
| `packages/database/prisma/schema.prisma` | Add `healthScore`, `healthScoreUpdatedAt` to Member; add index |
| `packages/shared/src/queues.ts` | Add `HEALTH_SCORE_COMPUTATION` queue name |
| `packages/shared/src/types/health-score.ts` | New: payload and breakdown types |
| `packages/shared/src/zod/member.schema.ts` | New: weight, filter, recompute schemas |
| `apps/api/src/queues/bullmq.ts` | Add health score queue, enqueue function, inline processor |
| `apps/api/src/routes/members.ts` | Add `GET /:id/360`, modify `GET /`, add health filter params |
| `apps/api/src/routes/healthScores.ts` | New: `POST /v1/admin/health-scores/recompute` |
| `apps/worker/src/processors/healthScore.ts` | New: BullMQ worker processor |
| `apps/worker/src/index.ts` | Register health score worker |
| `apps/mcp-server/src/tools/members.ts` | Add `get_member_360` tool |

### 8. Failure Modes & Timeouts

| Failure | Impact | Mitigation |
|---|---|---|
| Health score computation fails mid-batch | Some members have stale scores | Each member update is independent; failed members are logged and skipped. Retry via BullMQ backoff (exponential, max 3 attempts). |
| Database timeout on aggregation queries | Score computation stalls | Set per-query timeout of 5s. For brands with >100K members, process in batches of 500 with cursor-based pagination. |
| Redis unavailable | Cannot enqueue batch job | Inline mode fallback already exists in bullmq.ts pattern. On-demand recompute returns 503. |
| Stale health scores (computation hasn't run) | `healthScore` is null | API returns null; UI displays "Not yet computed". 360 endpoint computes breakdown on-the-fly as a fallback. |

### 9. Telemetry & Analytics

- **Pino structured logging**: Log `health-score.computed` event with `{ brandId, membersProcessed, avgScore, distribution: { critical: n, poor: n, fair: n, good: n, excellent: n }, durationMs }`
- **Score buckets**: 0-20 (Critical), 21-40 (Poor), 41-60 (Fair), 61-80 (Good), 81-100 (Excellent)
- **No new external telemetry dependencies** -- uses existing Pino logger

## Confidence Level

85/100

High confidence because:
- All input signals already exist in the database with proper indexes
- BullMQ batch pattern is well-established (6 existing queues to follow)
- Schema change is additive (nullable column, non-breaking migration)
- No new external dependencies or unfamiliar technologies

Minor uncertainty:
- Performance of aggregation queries for brands with large member counts (>50K) -- mitigated by cursor-based batching
- Optimal default weights may need tuning after real-world usage

## Validation Plan

| User Scenario | Expected Outcome | Validation Method |
|---|---|---|
| New member enrolled with no activity | healthScore = 50 (all neutral defaults) | Unit test |
| Member with recent purchase, good NPS, positive sentiment | healthScore > 75 | Unit test |
| Member with no activity in 90+ days, negative sentiment | healthScore < 30 | Unit test |
| Erased member | Skipped, healthScore remains null | Unit test |
| GET /v1/members?healthScoreMin=0&healthScoreMax=30 | Returns only at-risk members | Integration test |
| GET /v1/members/:id/360 | Returns full 360 view with breakdown | Integration test |
| POST /v1/admin/health-scores/recompute | Enqueues job, scores updated | Integration test |
| MCP get_member_360 tool | Returns 360 data via MCP | Integration test |
| Batch job processes 1000 members | Completes in <30s, all scores updated | Integration test |
| Inline mode (no Redis) | Health score computed synchronously | Unit test |

## Test Matrix

### Unit Tests (mocking DB, testing logic)
- **New suite**: `apps/api/src/routes/members.test.ts` -- add tests for 360 endpoint and health filter
- **New suite**: `apps/api/src/queues/healthScore.test.ts` -- test score computation formula with various input combinations (new member, active member, churning member, erased member, partial data)
- **Modify**: `apps/mcp-server/src/api-client.test.ts` -- add get_member_360 tool test
- All mocks in `packages/config/src/test-utils/` per Rule 8

### Integration Tests (real DB, mocked external services)
- **New suite**: `apps/api/src/routes/members-health.integration.test.ts` -- test GET /v1/members/:id/360, GET /v1/members with health filters, POST recompute endpoint
- Seeds test members with varied activity levels, verifies correct score computation and filtering

### E2E Tests
- None for this issue -- no UI changes in scope (admin dashboard visualization deferred to a future issue)

## Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Aggregation queries slow for large brands | Medium | Health score computation takes >5min | Cursor-based batching (500 members/batch), per-query timeouts, background processing (non-blocking) |
| Default weights produce unintuitive scores | Medium | Users distrust the metric | Document formula transparently, plan for configurable weights in future issue |
| Phase A (Customer 360 pattern) not yet built | High | No existing 360 endpoint to extend | This design creates the 360 endpoint -- it IS the Phase A + Phase B combined delivery |
| Health score becomes stale between batch runs | Low | Admins see outdated data | Display `healthScoreUpdatedAt` timestamp in API; 360 endpoint computes breakdown on-the-fly |

## Spike Findings (if applicable)

No spike was needed. All technologies and patterns are well-established in the codebase:
- BullMQ queue pattern: 6 existing queues with inline fallback
- Prisma aggregation queries: used in feedback clustering and analytics
- Nullable column migration: standard additive change

## Observability (logs, metrics, alerts)

- **Computation start**: `log.info({ brandId, mode: 'batch'|'single' }, 'health-score.computation.start')`
- **Computation complete**: `log.info({ brandId, membersProcessed, durationMs, distribution }, 'health-score.computation.complete')`
- **Computation error**: `log.error({ brandId, memberId, err }, 'health-score.computation.error')`
- **Queue metrics**: Standard BullMQ job metrics (waiting, active, completed, failed counts) via existing monitoring

## Architecture Analysis

### Patterns Correctly Followed

1. **Event-Driven Processing (Section 6)**: Health score computation uses BullMQ queue with async processing, following the established event-driven pattern. The API enqueues the job and returns immediately (`202 Accepted`-style), while the worker processes scores in the background.

2. **Multi-Tenant Isolation (Section 6)**: `brandId` is never accepted from request body. The recompute endpoint uses `brandId` from the JWT (injected by auth plugin). All Prisma queries in the computation are scoped to `brandId`. The new database index is on `(brandId, healthScore)`.

3. **Append-Only Ledger Integrity (Section 6)**: The design reads from `LoyaltyEvent` as a signal source but never writes to it. The `Member.healthScore` update is a separate computed field, not a ledger mutation, so no transactional integrity concern.

4. **Shared Test Infrastructure (Section 9.2, Rule 8)**: All new mocks and factories will be added to `packages/config/src/test-utils/` before use in tests. No inline mocks.

5. **GDPR/CCPA Compliance (Section 10)**: Erased members (`Member.erased = true` or `status = 'ERASED'`) are explicitly excluded from health score computation. The `healthScore` field is a derived metric (not PII), so no erasure job update is needed.

6. **Centralized Queue Constants (Section 3.5)**: New queue name `HEALTH_SCORE_COMPUTATION` added to `packages/shared/src/queues.ts`, following the shared constants pattern.

7. **Zod Validation (Section 2)**: All new request/response schemas use Zod, consistent with the existing validation approach. Schemas live in `packages/shared/src/zod/`.

8. **Inline Queue Fallback**: The design includes `QUEUE_MODE=inline` support for the health score queue, matching the dual-mode pattern in `bullmq.ts` that allows operation without Redis.

### Patterns Missing from Architecture

1. **Scheduled/Cron Jobs**: The architecture document (Section 4.3) documents three BullMQ workers but does not describe a pattern for scheduled/recurring jobs. The health score batch computation introduces BullMQ `repeat` (cron scheduling) which is a new pattern. **Suggested resolution**: Add a "Scheduled Jobs" subsection to Section 4.3 documenting the cron pattern, including the health score nightly job as the first example.

2. **Computed/Derived Fields on Models**: The architecture document (Section 4.4) describes `Member.pointsBalance` as a "materialized counter" updated within transactions, but does not describe a general pattern for computed fields that are batch-updated asynchronously. `healthScore` is a new category: a derived metric computed from multiple signal sources on a schedule. **Suggested resolution**: Add a note to the Member model description in Section 4.4 distinguishing between transactional counters (`pointsBalance`) and batch-computed metrics (`healthScore`).

3. **Customer 360 Aggregation Endpoint**: The architecture document (Section 4.1) lists `/v1/members` for "enrollment, balance queries" but does not describe a 360-view aggregation pattern. The new `GET /v1/members/:id/360` endpoint introduces a read-heavy aggregation pattern that joins across multiple models. **Suggested resolution**: Add `/v1/members` description to include "Customer 360 view (aggregated member profile with health score, activity, and stats)".

4. **MCP Server Tools**: The architecture document does not describe the MCP server (`apps/mcp-server/`) or its tool registration pattern. The new `get_member_360` tool follows an established codebase pattern but is not documented architecturally. **Suggested resolution**: Add an "MCP Layer" subsection to Section 3 describing `apps/mcp-server/` as a thin API client wrapper exposing CustomerEQ capabilities to AI agents.

### Patterns Incorrectly Followed

None identified. The design correctly follows all documented architectural patterns.
