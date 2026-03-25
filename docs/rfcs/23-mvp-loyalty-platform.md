# RFC: MVP Loyalty Platform — Full Build (Issues #2–#9)

Issue: #23
Owner: Claude (claude-sonnet-4-6)
Date: 2026-03-24
Status: Draft

---

## Customer

Mid-market businesses ($10M–$500M) connecting CX feedback to loyalty actions automatically. See `docs/feature-specs/23-mvp-loyalty-platform.md` for full actor breakdown.

## Customer Problem Being Solved

Loyalty platforms are disconnected from CX data. When a member gives a bad NPS score, nothing happens for 82 hours. CustomerEQ closes that gap to <15 minutes via a real-time event-driven pipeline.

## User Experience Summary

Full UX flows are documented in the feature spec. This RFC covers the *how* — data models, API contracts, queue architecture, and component wiring — that implements those flows. See spec mocks in `docs/feature-specs/mocks/`.

---

## Technical Details

### 0. Monorepo Structure (Phase 0)

```
customerEQ/
├── apps/
│   ├── web/                 # Next.js 15 App Router — marketing + member portal + admin
│   ├── api/                 # Fastify v5 — REST API (loyalty engine)
│   └── worker/              # BullMQ workers — async event processing
├── packages/
│   ├── ui/                  # shadcn/ui + Tailwind v4 components
│   ├── database/            # Prisma schema, migrations, seed, shared client
│   ├── shared/              # TypeScript types + Zod schemas
│   └── config/              # ESLint, TS, Vitest base configs + test-utils
├── infra/                   # Terraform — Azure + Vercel
└── docker-compose.yml       # Local PostgreSQL 16 + Redis 7
```

**Turborepo pipeline (`turbo.json`):**
```json
{
  "pipeline": {
    "build": { "dependsOn": ["^build"], "outputs": [".next/**", "dist/**"] },
    "typecheck": { "dependsOn": ["^build"] },
    "lint": {},
    "test": { "dependsOn": ["^build"] }
  }
}
```

**pnpm workspace packages:**
- `apps/web`, `apps/api`, `apps/worker`
- `packages/ui` → `@customerEQ/ui`
- `packages/database` → `@customerEQ/database`
- `packages/shared` → `@customerEQ/shared`
- `packages/config` → `@customerEQ/config`

---

### 1. Data Models (Prisma Schema)

**File**: `packages/database/prisma/schema.prisma`

All tenant-scoped models carry `brandId String` and are enforced via Prisma middleware (see §4).

#### Core Entities

```prisma
model Brand {
  id          String   @id @default(cuid())
  clerkOrgId  String   @unique   // Clerk organization ID → brandId mapping
  name        String
  programs    Program[]
  members     Member[]
  createdAt   DateTime @default(now())
}

model Program {
  id                   String        @id @default(cuid())
  brandId              String
  brand                Brand         @relation(fields: [brandId], references: [id])
  name                 String
  description          String?
  pointCurrencyName    String        @default("Points")
  pointToCurrencyRatio Float         @default(0.01)  // $0.01 per point
  status               ProgramStatus @default(DRAFT)
  earningRules         EarningRule[]
  campaigns            Campaign[]
  rewards              Reward[]
  createdAt            DateTime      @default(now())
  updatedAt            DateTime      @updatedAt

  @@index([brandId])
}

enum ProgramStatus { DRAFT ACTIVE PAUSED ARCHIVED }

model EarningRule {
  id              String      @id @default(cuid())
  programId       String
  program         Program     @relation(fields: [programId], references: [id])
  brandId         String
  name            String
  triggerEvent    String      // e.g. "purchase", "survey_complete", "enrollment"
  pointsAwarded   Int
  multiplier      Float       @default(1.0)
  conditions      Json?       // JSONB: AND/OR condition logic
  maxUsesPerMember Int?       // null = unlimited
  status          RuleStatus  @default(ACTIVE)
  validFrom       DateTime    @default(now())
  validTo         DateTime?
  createdAt       DateTime    @default(now())

  @@index([programId, status])
  @@index([brandId])
}

enum RuleStatus { ACTIVE INACTIVE }

model Member {
  id              String        @id @default(cuid())
  brandId         String
  brand           Brand         @relation(fields: [brandId], references: [id])
  email           String
  firstName       String?
  lastName        String?
  phone           String?
  pointsBalance   Int           @default(0)
  status          MemberStatus  @default(ACTIVE)
  consentGivenAt  DateTime?
  consentVersion  String?
  deletedAt       DateTime?     // soft delete
  erased          Boolean       @default(false)
  loyaltyEvents   LoyaltyEvent[]
  redemptions     Redemption[]
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@unique([brandId, email])
  @@index([brandId])
}

enum MemberStatus { ACTIVE INACTIVE ERASED }

model LoyaltyEvent {
  id               String   @id @default(cuid())
  brandId          String
  memberId         String
  member           Member   @relation(fields: [memberId], references: [id])
  eventType        String   // "purchase", "cx.nps_submitted", "campaign_award", etc.
  pointsEarned     Int      // positive = earn, negative = burn (redemption deduction)
  payload          Json?    // raw event payload
  idempotencyKey   String?  // stored in Redis; also here for audit trail
  rulesApplied     String[] // array of EarningRule IDs applied
  campaignId       String?  // if triggered by a campaign
  processedAt      DateTime @default(now())
  createdAt        DateTime @default(now())

  @@index([brandId, createdAt])  // critical for analytics queries
  @@index([memberId])
  @@index([idempotencyKey])
}

model Reward {
  id              String      @id @default(cuid())
  brandId         String
  programId       String
  program         Program     @relation(fields: [programId], references: [id])
  name            String
  description     String?
  pointsCost      Int
  stock           Int?        // null = unlimited
  isAvailable     Boolean     @default(true)
  redemptions     Redemption[]
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  @@index([brandId, isAvailable])
}

model Redemption {
  id          String     @id @default(cuid())
  brandId     String
  memberId    String
  member      Member     @relation(fields: [memberId], references: [id])
  rewardId    String
  reward      Reward     @relation(fields: [rewardId], references: [id])
  pointsSpent Int
  status      RedemptionStatus @default(PENDING)
  createdAt   DateTime   @default(now())

  @@index([brandId, memberId])
}

enum RedemptionStatus { PENDING FULFILLED CANCELLED }

model Campaign {
  id              String         @id @default(cuid())
  brandId         String
  programId       String
  program         Program        @relation(fields: [programId], references: [id])
  name            String
  triggerType     String         // "cx.nps_submitted", "cx.ticket_resolved"
  triggerCondition Json          // e.g. { "field": "nps_score", "op": "lt", "value": 7 }
  actionType      String         // "award_points", "award_reward", "send_message"
  actionConfig    Json           // e.g. { "points": 500, "message": "..." }
  budgetCap       Float?         // USD value cap
  budgetSpent     Float          @default(0)
  status          CampaignStatus @default(DRAFT)
  startDate       DateTime
  endDate         DateTime?
  campaignEvents  CampaignEvent[]
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  @@index([brandId, status])
}

enum CampaignStatus { DRAFT ACTIVE PAUSED COMPLETED }

model CampaignEvent {
  id          String   @id @default(cuid())
  brandId     String
  campaignId  String
  campaign    Campaign @relation(fields: [campaignId], references: [id])
  memberId    String
  triggeredAt DateTime @default(now())
  executedAt  DateTime?
  latencyMs   Int?     // measured latency from event ingestion to action execution
  status      String   @default("executed")

  @@unique([campaignId, memberId])  // dedup: one trigger per member per campaign
  @@index([brandId, campaignId])
}

model DemoRequest {
  id          String   @id @default(cuid())
  firstName   String
  lastName    String
  workEmail   String
  companyName String
  companySize String?
  message     String?
  createdAt   DateTime @default(now())

  @@index([createdAt])
}

model AuditEvent {
  id          String   @id @default(cuid())
  brandId     String?
  actorId     String   // Clerk user ID
  action      String   // "program.create", "campaign.activate", etc.
  resourceType String
  resourceId  String
  metadata    Json?
  createdAt   DateTime @default(now())

  @@index([brandId, createdAt])
}
```

**Indexes rationale:**
- `LoyaltyEvent(brandId, createdAt)` — analytics range queries (R7.1, R7.5 <3s)
- `Campaign(brandId, status)` — active campaign lookup on every event ingest
- `CampaignEvent(campaignId, memberId)` unique — dedup constraint enforced at DB level (R6.4)
- `Member(brandId, email)` unique — idempotent enrollment (R3.2)

---

### 2. API Endpoints (Fastify v5)

**File**: `apps/api/src/`

#### Plugin Architecture

```
apps/api/src/
├── app.ts              # Fastify instance, plugins, routes registration
├── plugins/
│   ├── auth.ts         # Clerk JWT verification → sets request.brandId
│   ├── prisma.ts       # Prisma client decorator
│   ├── redis.ts        # ioredis decorator
│   ├── audit.ts        # AuditEvent logging hook (onResponse for mutations)
│   └── multiTenant.ts  # brandId body-injection guard
├── routes/
│   ├── programs.ts
│   ├── members.ts
│   ├── events.ts
│   ├── rewards.ts
│   ├── redemptions.ts
│   ├── campaigns.ts
│   ├── analytics.ts
│   ├── webhooks.ts
│   └── public.ts
└── queues/
    └── bullmq.ts       # Queue definitions and producer functions
```

#### Auth Plugin (`plugins/auth.ts`)

```typescript
// Verifies Clerk JWT; extracts orgId; resolves brandId
fastify.addHook('preHandler', async (request, reply) => {
  const token = request.headers.authorization?.replace('Bearer ', '');
  const payload = await verifyClerkToken(token);         // Clerk SDK
  const brand = await prisma.brand.findUniqueOrThrow({
    where: { clerkOrgId: payload.org_id }
  });
  request.brandId = brand.id;
  request.clerkUserId = payload.sub;
});
```

**brandId body-injection guard (`plugins/multiTenant.ts`):**
```typescript
fastify.addHook('preValidation', async (request, reply) => {
  if (request.body && typeof request.body === 'object' && 'brandId' in request.body) {
    return reply.status(400).send({ error: 'brandId must not be provided in request body' });
  }
});
```

#### Routes Summary

| Method | Path | Auth | Handler |
|--------|------|------|---------|
| POST | `/v1/programs` | Admin JWT | Create program (status=DRAFT) |
| GET | `/v1/programs/:id` | Admin JWT | Get program by ID |
| PATCH | `/v1/programs/:id` | Admin JWT | Update program / change status |
| POST | `/v1/members/enroll` | Public (program token) | Idempotent member enrollment |
| GET | `/v1/members/:id` | Member or Admin JWT | Get member profile |
| GET | `/v1/members/:id/balance` | Member JWT | Points balance + recent events |
| POST | `/v1/events` | API key or Admin JWT | Ingest loyalty/CX event |
| POST | `/v1/rewards` | Admin JWT | Create reward in catalog |
| GET | `/v1/rewards` | Member JWT | Browse available rewards |
| POST | `/v1/redemptions` | Member JWT | Redeem reward (transactional) |
| POST | `/v1/campaigns` | Admin JWT | Create campaign |
| GET | `/v1/campaigns/:id` | Admin JWT | Get campaign |
| PATCH | `/v1/campaigns/:id/status` | Admin JWT | Activate / pause / complete |
| GET | `/v1/analytics/overview` | Admin JWT | KPI metrics with date range |
| GET | `/v1/analytics/campaigns` | Admin JWT | Per-campaign performance |
| POST | `/v1/integrations/webhooks/:provider` | HMAC sig | Ingest Salesforce/HubSpot webhook |
| GET | `/v1/admin/integrations` | Admin JWT | View webhook URLs |
| POST | `/v1/public/demo-requests` | None | Submit demo request form |
| GET | `/v1/admin/demo-requests` | Admin JWT | List demo requests |

#### Event Ingestion Flow (`routes/events.ts`)

This is the critical path for the <15-min SLA:

```
POST /v1/events { type, memberId, payload, idempotencyKey }
  │
  ├─ 1. Check idempotencyKey in Redis
  │     SET NX key=`idempotency:{brandId}:{idempotencyKey}` value=jobId EX=86400
  │     → if key exists: return cached 200 result
  │
  ├─ 2. Validate memberId and consentGivenAt
  │     → if member not found: 404
  │     → if consentGivenAt is null: 422 "member consent required"
  │
  ├─ 3. Enqueue to `loyalty-events` BullMQ queue
  │     → return 202 Accepted { jobId }
  │
  └─ 4. Evaluate active campaigns (sync, fast path)
        SELECT * FROM campaigns
        WHERE brandId=? AND status='ACTIVE'
          AND startDate <= NOW() AND (endDate IS NULL OR endDate >= NOW())
        → for each matching campaign: evaluate triggerCondition against payload
        → if match: enqueue to `campaign-triggers` queue (priority=10)
```

#### Redemption Transaction (`routes/redemptions.ts`)

```typescript
await prisma.$transaction(async (tx) => {
  const member = await tx.member.findUniqueOrThrow({
    where: { id: memberId, brandId },
    select: { pointsBalance: true }
  });
  if (member.pointsBalance < reward.pointsCost) {
    throw new InsufficientPointsError();
  }
  // Atomic deduction + redemption record
  await tx.member.update({
    where: { id: memberId },
    data: { pointsBalance: { decrement: reward.pointsCost } }
  });
  await tx.loyaltyEvent.create({
    data: { memberId, brandId, eventType: 'redemption', pointsEarned: -reward.pointsCost }
  });
  return tx.redemption.create({
    data: { memberId, rewardId, brandId, pointsSpent: reward.pointsCost }
  });
});
```

---

### 3. BullMQ Queue Architecture

**File**: `apps/worker/src/`

```
apps/worker/src/
├── index.ts            # Worker startup — registers all processors
├── queues/
│   ├── definitions.ts  # Queue + Worker instances (shared with apps/api)
│   └── producers.ts    # enqueueEvent(), enqueueCampaign(), enqueueNotification()
└── processors/
    ├── loyaltyEvents.ts    # Rules engine: evaluate + award points
    ├── campaignTriggers.ts # Execute campaign action (award points + notify)
    └── notifications.ts    # Send email/SMS confirmation
```

#### Queue Definitions

```typescript
// packages/shared/src/queues.ts — imported by both apps/api and apps/worker
export const QUEUES = {
  LOYALTY_EVENTS:    'loyalty-events',
  CAMPAIGN_TRIGGERS: 'campaign-triggers',  // high priority
  NOTIFICATIONS:     'notifications',
} as const;

// Priority: campaign-triggers jobs get priority=10 (higher = sooner)
// BullMQ default priority is 0; higher numbers run first
```

#### Campaign Trigger Processor (`processors/campaignTriggers.ts`)

```typescript
async function processCampaignTrigger(job: Job<CampaignTriggerPayload>) {
  const { campaignId, memberId, brandId, eventIngestedAt } = job.data;

  // Dedup: SET NX in Redis (also enforced by DB unique constraint as safety net)
  const dedupKey = `campaign:dedup:${campaignId}:${memberId}`;
  const isNew = await redis.set(dedupKey, '1', 'NX');
  if (!isNew) return { skipped: true, reason: 'already_triggered' };

  // Fetch campaign action config
  const campaign = await prisma.campaign.findUniqueOrThrow({ where: { id: campaignId } });
  if (campaign.status !== 'ACTIVE') return { skipped: true, reason: 'campaign_inactive' };

  // Check budget cap
  if (campaign.budgetCap !== null) {
    const actionCostUsd = (campaign.actionConfig as any).points * campaign.program.pointToCurrencyRatio;
    if (campaign.budgetSpent + actionCostUsd > campaign.budgetCap) {
      await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'PAUSED' } });
      return { skipped: true, reason: 'budget_cap_reached' };
    }
  }

  // Execute: award points (reuses earn transaction)
  await prisma.$transaction(async (tx) => {
    const points = (campaign.actionConfig as any).points ?? 0;
    await tx.loyaltyEvent.create({
      data: { memberId, brandId, eventType: 'campaign_award', pointsEarned: points, campaignId }
    });
    await tx.member.update({
      where: { id: memberId },
      data: { pointsBalance: { increment: points } }
    });
    await tx.campaignEvent.create({
      data: {
        campaignId, memberId, brandId,
        executedAt: new Date(),
        latencyMs: Date.now() - new Date(eventIngestedAt).getTime(),
        status: 'executed'
      }
    });
    await tx.campaign.update({
      where: { id: campaignId },
      data: { budgetSpent: { increment: points * campaign.program.pointToCurrencyRatio } }
    });
  });

  // Enqueue notification if message configured
  if ((campaign.actionConfig as any).message) {
    await enqueueNotification({ memberId, message: (campaign.actionConfig as any).message });
  }
}
```

**SLA Measurement**: `latencyMs = Date.now() - eventIngestedAt` is recorded on every `CampaignEvent`. The integration test asserts `latencyMs < 900_000` (15 minutes). In practice, BullMQ campaign jobs should complete in seconds.

---

### 4. Prisma Middleware (Multi-Tenant Enforcement)

**File**: `packages/database/src/middleware/tenantScope.ts`

```typescript
const TENANT_SCOPED_MODELS = new Set([
  'Program', 'EarningRule', 'Member', 'LoyaltyEvent',
  'Reward', 'Redemption', 'Campaign', 'CampaignEvent', 'AuditEvent'
]);

export function applyTenantScope(prisma: PrismaClient, getBrandId: () => string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_SCOPED_MODELS.has(model!)) return query(args);
          if (['findMany', 'findFirst', 'count', 'aggregate'].includes(operation)) {
            args.where = { ...(args.where ?? {}), brandId: getBrandId() };
          }
          if (operation === 'create') {
            args.data = { ...(args.data ?? {}), brandId: getBrandId() };
          }
          if (operation === 'update' || operation === 'delete') {
            args.where = { ...(args.where ?? {}), brandId: getBrandId() };
          }
          return query(args);
        }
      }
    }
  });
}
```

The `getBrandId` closure is bound to `request.brandId` inside the Fastify request lifecycle, ensuring each request only touches its own tenant's data.

---

### 5. Webhook Ingestion (Salesforce + HubSpot)

**File**: `apps/api/src/routes/webhooks.ts`

#### HMAC Verification

```typescript
// Salesforce: X-SFDC-Signature header (SHA-256, base64)
function verifySalesforceSignature(rawBody: Buffer, sig: string, secret: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

// HubSpot: X-HubSpot-Signature-v3 header (HMAC-SHA256 of method+uri+body+timestamp)
function verifyHubSpotSignature(method: string, uri: string, body: string, ts: string, sig: string, secret: string): boolean {
  const payload = method + uri + body + ts;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}
```

#### Payload Normalization

```typescript
function normalizeSalesforcePayload(body: SalesforceNPSPayload): InternalCxEvent {
  return {
    type: 'cx.nps_submitted',
    externalId: body.caseId ?? body.surveyResponseId,
    memberEmail: body.contactEmail,
    payload: { nps_score: body.npsScore, comment: body.comment }
  };
}

function normalizeHubSpotPayload(body: HubSpotWebhookPayload): InternalCxEvent {
  const type = body.subscriptionType === 'deal.propertyChange' ? 'cx.deal_closed'
             : body.subscriptionType === 'ticket.propertyChange' ? 'cx.ticket_resolved'
             : 'cx.unknown';
  return {
    type,
    externalId: String(body.objectId),
    memberEmail: body.propertyValue?.email ?? body.contactEmail,
    payload: body
  };
}
```

After normalization:
1. Look up `Member` by `memberEmail` within `brandId` (from webhook config)
2. If member found and `consentGivenAt` is set: call `POST /v1/events` internally with the normalized event
3. If member not found: log as `WebhookEvent` with `status: 'member_not_found'`

---

### 6. Analytics Queries

**File**: `apps/api/src/routes/analytics.ts`

#### Overview Endpoint

```typescript
// GET /v1/analytics/overview?startDate=...&endDate=...
const [totals, topRewards] = await Promise.all([
  prisma.$queryRaw<AnalyticsTotals[]>`
    SELECT
      COUNT(DISTINCT m.id)::int                                    AS "totalMembers",
      COALESCE(SUM(le.points_earned) FILTER (WHERE le.points_earned > 0), 0)::int AS "totalPointsIssued",
      COALESCE(SUM(ABS(le.points_earned)) FILTER (WHERE le.points_earned < 0), 0)::int AS "totalPointsRedeemed"
    FROM loyalty_events le
    JOIN members m ON le.member_id = m.id
    WHERE le.brand_id = ${brandId}
      AND le.created_at BETWEEN ${startDate} AND ${endDate}
  `,
  prisma.redemption.groupBy({
    by: ['rewardId'],
    where: { brandId, createdAt: { gte: startDate, lte: endDate } },
    _count: { rewardId: true },
    orderBy: { _count: { rewardId: 'desc' } },
    take: 5
  })
]);
```

**ROI calculation:**
```typescript
const roi = (totalPointsRedeemed * program.pointToCurrencyRatio) / pointsIssuanceCost;
// pointsIssuanceCost = totalPointsIssued * program.pointToCurrencyRatio (i.e. cost at face value)
```

**Performance**: The `(brandId, createdAt)` composite index on `loyalty_events` makes this query O(log n) for any date range. P99 target: <3s for 90-day range on 100K events (R7.5).

---

### 7. Frontend Structure (Next.js 15 App Router)

**File**: `apps/web/app/`

```
apps/web/
├── app/
│   ├── layout.tsx              # Root layout: ClerkProvider, fonts
│   ├── (marketing)/
│   │   ├── page.tsx            # Homepage
│   │   └── request-demo/
│   │       └── page.tsx        # Demo request form (R8.1)
│   ├── (admin)/
│   │   ├── layout.tsx          # Admin layout: requires Clerk org membership
│   │   ├── programs/
│   │   │   ├── page.tsx        # Program list
│   │   │   └── new/page.tsx    # Program creation wizard (4 steps)
│   │   ├── campaigns/
│   │   │   ├── page.tsx        # Campaign list
│   │   │   └── new/page.tsx    # Campaign builder (R6.1)
│   │   ├── analytics/
│   │   │   └── page.tsx        # Analytics dashboard (R7.1–R7.5)
│   │   └── integrations/
│   │       └── page.tsx        # Webhook URL display (R9.5)
│   └── (member)/
│       ├── layout.tsx          # Member layout: requires member session
│       ├── page.tsx            # Member dashboard: balance + activity (R3.x)
│       └── rewards/
│           └── page.tsx        # Rewards catalog + redemption (R5.2)
├── components/                 # Page-specific client components
└── middleware.ts               # clerkMiddleware() — route protection
```

**Clerk middleware (`apps/web/middleware.ts`):**
```typescript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isAdminRoute = createRouteMatcher(['/admin(.*)']);
const isPublicRoute = createRouteMatcher(['/', '/request-demo', '/api/public(.*)']);

export default clerkMiddleware((auth, req) => {
  if (isAdminRoute(req)) auth().protect({ organizationRole: 'org:admin' });
  if (!isPublicRoute(req) && !isAdminRoute(req)) auth().protect();
});
```

---

### 8. Shared Test Infrastructure

**File**: `packages/config/src/test-utils/`

All tests import from `@customerEQ/config/test-utils`. No inline mocks (project rule #8).

```
packages/config/src/test-utils/
├── index.ts
├── factories/
│   ├── brand.factory.ts      # createBrand()
│   ├── program.factory.ts    # createProgram(), createProgramWithRules()
│   ├── member.factory.ts     # createMember(), createConsentedMember()
│   ├── event.factory.ts      # createLoyaltyEvent(), createCxEvent(type, score)
│   ├── reward.factory.ts     # createReward()
│   ├── campaign.factory.ts   # createCampaign(trigger, action)
│   └── redemption.factory.ts # createRedemption()
├── mocks/
│   ├── clerk.mock.ts         # mockClerkAuth(brandId, userId)
│   ├── bullmq.mock.ts        # InMemoryQueue — processes jobs synchronously in tests
│   ├── redis.mock.ts         # ioredis-mock
│   ├── integrations.mock.ts  # salesforceNpsPayload(), hubspotTicketPayload()
│   └── email.mock.ts         # mockEmailSend(), assertEmailSent()
├── db/
│   ├── setup.ts              # beforeAll: create test schema, run migrations
│   ├── teardown.ts           # afterAll: drop test schema
│   └── seed.ts               # Seed: 1 brand, 1 program, 1 earning rule
└── helpers/
    ├── api.helper.ts         # authenticatedRequest(brandId) → Supertest client
    └── assert.helper.ts      # toHavePointsBalance(n), toHaveRedemption()
```

---

### 9. CI Pipeline (GitHub Actions)

**File**: `.github/workflows/ci.yml`

```yaml
jobs:
  ci:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env: { POSTGRES_PASSWORD: test }
      redis:
        image: redis:7
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm audit --audit-level=high   # S-04: dep vulnerability scan
      - run: pnpm test
        env: { DATABASE_URL: postgresql://postgres:test@localhost/test, REDIS_URL: redis://localhost:6379 }
```

---

## Confidence Level

**92 / 100**

High confidence because:
- All technologies are pre-approved in `docs/architecture/architecture.md`
- All integration patterns (HMAC verification, BullMQ priority queues, Prisma middleware, Clerk org mapping) have known implementations
- The most novel element (real-time CX→loyalty pipeline) is architecturally straightforward: webhook → normalize → enqueue → worker acts
- Analytics queries use standard SQL aggregation with well-placed indexes

Residual uncertainty (8%):
- Clerk org→brandId mapping behavior under edge cases (org switch mid-session, org deletion) — handled by `findUniqueOrThrow` throwing 404
- Salesforce webhook payload shape for NPS surveys may vary by Salesforce org configuration — need real-world payload samples at integration time

---

## Validation Plan

| User Scenario | Expected Outcome | Validation Method |
|--------------|-----------------|-------------------|
| Admin creates program with 1 earning rule and activates | Program status = ACTIVE; rule stored; accessible only by same brandId | Integration test: POST /v1/programs + POST rule + PATCH status; assert 200 + DB state |
| Member enrolls twice with same email | Second enrollment returns existing member (200, not 201) | Integration test: POST /v1/members/enroll × 2; assert same member ID returned |
| POST /v1/events with duplicate idempotencyKey | Second call returns original 200; pointsBalance unchanged | Integration test: two identical POST requests; assert single LoyaltyEvent record |
| Member earns 250 points from $25 purchase | pointsBalance incremented by 250; LoyaltyEvent created | Integration test: POST event → worker drains → assert balance via GET /balance |
| Member redeems reward with insufficient points | 422 "Insufficient points balance"; no Redemption record created | Integration test: member with 100 pts redeems 500-pt reward |
| CX event (NPS=4) triggers campaign | Campaign action executed within 900 seconds; CampaignEvent.latencyMs recorded | Integration test with real BullMQ worker; assert CampaignEvent.executedAt set |
| Same member triggers same campaign twice | Second trigger skipped; CampaignEvent unique constraint upheld | Integration test: two matching events; assert 1 CampaignEvent record |
| Analytics overview for 30 days | Correct totalMembers, points issued/redeemed; ROI calculated correctly | Integration test: seed known data; assert exact metric values |
| Salesforce webhook with invalid HMAC | 401 returned; no event processed | Integration test: POST with wrong signature header |
| HubSpot ticket resolved → member points | Points awarded to member within pipeline; CampaignEvent recorded | E2E test using Playwright + mock webhook |
| Admin posts demo request form | DemoRequest record created; confirmation email mock called | Integration test: POST /v1/public/demo-requests; assert DB + email mock |
| brandId in request body rejected | 400 returned; request not processed | Unit test: multiTenant plugin |
| GDPR erasure: member PII zeroed | email/firstName/lastName/phone hashed; erased=true | Integration test: erasure job run; GET member returns hashed values |

---

## Test Matrix

### Unit Tests (Vitest, co-located `*.test.ts`)
- `packages/shared/src/zod/` — all Zod schemas validate correct/incorrect inputs
- `apps/api/src/plugins/multiTenant.test.ts` — brandId body guard rejects and passes correctly
- `apps/api/src/plugins/auth.test.ts` — JWT verification with mock Clerk (valid / expired / wrong org)
- `apps/worker/src/processors/loyaltyEvents.test.ts` — rules engine: correct points calculation for each trigger type, multipliers, conditions
- `apps/worker/src/processors/campaignTriggers.test.ts` — dedup logic, budget cap enforcement, action execution
- `apps/api/src/routes/webhooks.test.ts` — HMAC verification (valid/invalid) for both providers
- `apps/api/src/routes/analytics.test.ts` — ROI formula correctness, date range filtering

### Integration Tests (Vitest + Supertest, real DB test schema)
- `apps/api/test/integration/programs.test.ts` — R2.1–R2.5 + edge cases
- `apps/api/test/integration/members.test.ts` — R3.1–R3.5 (enrollment idempotency, consent)
- `apps/api/test/integration/events.test.ts` — R4.1–R4.6 (idempotency key, rules engine, BullMQ drain)
- `apps/api/test/integration/rewards-redemptions.test.ts` — R5.1–R5.5 (transaction atomicity, insufficient balance)
- `apps/api/test/integration/campaigns.test.ts` — R6.1–R6.6 (trigger evaluation, dedup, SLA latency)
- `apps/api/test/integration/analytics.test.ts` — R7.1–R7.5 (query correctness, date range, <3s perf)
- `apps/api/test/integration/webhooks.test.ts` — R9.1–R9.4 (Salesforce + HubSpot normalization, HMAC rejection)
- `apps/api/test/integration/demoRequests.test.ts` — R8.1–R8.4

### E2E Tests (Playwright)
- `apps/web/test/e2e/critical-path.spec.ts` — full enroll → earn → campaign trigger → redeem → analytics flow
- `apps/web/test/e2e/demo-request.spec.ts` — public form submission and confirmation

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| BullMQ campaign job delayed under load (>15 min SLA miss) | Low | High | Dedicated `campaign-triggers` queue with priority=10; separate concurrency setting; latency metric alerts via Azure Monitor |
| Redis idempotency key lost (Redis restart) | Low | Medium | 24-hour TTL is intentional; LoyaltyEvent.idempotencyKey in DB provides secondary dedup check on worker |
| Prisma middleware `getBrandId()` returns wrong brandId under concurrent requests | Very Low | High | `getBrandId` is a closure bound to the Fastify request object (not a global); cannot leak across requests |
| Salesforce webhook payload schema changes | Medium | Low | Normalization layer is isolated in `webhooks.ts`; add `payload.raw` field to `WebhookEvent` for debugging |
| Analytics query timeout for large datasets | Medium | Medium | `(brandId, createdAt)` composite index covers range queries; add `EXPLAIN ANALYZE` to CI on seed data of 1M rows |
| Clerk org deletion leaves orphaned brandId | Low | Medium | `Brand.clerkOrgId` unique; auth plugin throws 404 if brand not found; add Clerk webhook handler to soft-delete brand on org deletion |
| Campaign budget float precision | Low | Low | Use integer cents (multiply by 100) internally; display only rounds to 2 decimal places |

---

## Spike Findings

No spike was required. All technology choices are pre-approved in `docs/architecture/architecture.md` and all integration patterns (BullMQ priority queues, Prisma `$extends` middleware, Clerk `org_id` JWT claims, HMAC-SHA256 webhook verification) have well-documented implementations with no known incompatibilities in the approved stack.

**Ambiguities assessed and resolved:**

| Ambiguity | Uncertainty | Resolution |
|-----------|-------------|------------|
| Clerk `orgId` in JWT for brandId mapping | Low | Clerk session claims include `org_id`; extract in auth plugin; look up Brand by `clerkOrgId` |
| BullMQ job priority for campaign SLA | Low | `priority: 10` on job enqueue; higher number = higher priority in BullMQ v5 |
| Salesforce HMAC signature format | Low | `X-SFDC-Signature`: SHA-256 HMAC of raw body, base64-encoded; use `timingSafeEqual` |
| HubSpot signature format | Low | `X-HubSpot-Signature-v3`: HMAC-SHA256 of `method+uri+body+timestamp` |
| Prisma `$extends` vs `$use` middleware | Low | Use `$extends` (Prisma 5+ recommended); `$use` is deprecated |

---

## Observability (Logs, Metrics, Alerts)

### Structured Logging (Pino via Fastify)

Every API request logs: `{ requestId, brandId, method, path, statusCode, durationMs }`

Every BullMQ job logs on start/complete/fail: `{ jobId, queue, brandId, durationMs, latencyMs? }`

### Key Metrics (Azure Application Insights)

| Metric | Alert Threshold | Purpose |
|--------|----------------|---------|
| `campaign.latencyMs` p99 | > 300,000 ms (5 min) | Early warning before SLA breach |
| `event.ingest.rate` | < 10% of baseline | Webhook source failure detection |
| `bullmq.failed.count` | > 10 / 5 min | Worker crash or poison pill job |
| `api.p99.latency` | > 2,000 ms | API performance degradation |
| `analytics.queryDuration` | > 2,500 ms | Index degradation or missing index |

### Dead-Letter Queue (DLQ)

Failed BullMQ jobs after 3 retries move to `*-failed` queues. A nightly cron job logs DLQ contents to Application Insights and pages on-call if count > 50.

---

## Design Standards

**Source**: Generic UI baseline (project design system not configured in `fraim/config.json`).

All frontend components use:
- Tailwind v4 utility classes from `packages/ui`
- shadcn/ui primitives (Button, Card, Table, Badge, Input, Select, Dialog, Progress)
- Indigo/violet primary (`#6366f1`), neutral grays for surface/text
- Inter font, 14px base size
- ARIA labels on all interactive elements; focus rings visible; color contrast > 4.5:1

Validation coverage: all interactive flows covered by Playwright E2E tests that assert element presence and user interaction success.
