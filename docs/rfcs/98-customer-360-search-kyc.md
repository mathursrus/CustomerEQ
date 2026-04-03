# Technical Design: CRM Core — Customer 360 API, Search, and KYC Synthesis

Issue: #98
Owner: Claude (technical-design job)
Spec: `docs/feature-specs/98-customer-360-search-kyc.md` (on branch)

## Customer

Brand administrators and customer success managers who need a unified view of any loyalty member. LLM agents (via MCP tools) that need full customer context for intelligent support, reporting, and automated workflows.

## Customer Problem Being Solved

1. **Fragmented customer view:** `GET /v1/members/:id` returns only the flat member record. Understanding a customer requires separate calls for events, surveys, redemptions, campaigns, and cases, then mental synthesis.
2. **No customer search:** Members can only be retrieved by exact ID. No way to find members by name, email, or behavioral attributes (tier, sentiment, NPS, points balance).
3. **No AI-powered customer narrative:** Even with all data assembled, there is no automated synthesis explaining engagement patterns, sentiment trajectory, risk signals, or recommended actions.

## User Experience That Will Solve the Problem

### UX Flow 1: Customer 360 API
1. Admin or LLM agent calls `GET /v1/members/:id/360` (or MCP tool `get_customer_360`)
2. API returns single JSON response: member profile + tier + recent loyalty events + survey responses (with sentiment/topics) + redemptions + campaign events + open cases + summary stats
3. Sub-collections are paginated with configurable limits and `hasMore` flags

### UX Flow 2: Customer Search
1. Admin or LLM agent calls `GET /v1/members` (or MCP tool `search_members`) with query parameters: `q` (text search), `tier`, `sentimentMin`/`sentimentMax`, `npsMin`/`npsMax`, `balanceMin`/`balanceMax`, `status`, `enrolledAfter`/`enrolledBefore`, `page`/`pageSize`, `sortBy`/`sortOrder`
2. API returns paginated list of members with summary fields (id, email, name, points, tier, status, latestSentiment, latestNpsScore)

### UX Flow 3: KYC Synthesis
1. LLM agent calls `get_customer_360` MCP tool
2. Passes 360 data to `SynthesizeCustomerProfile` BAML function
3. Returns structured KYC: engagementLevel, sentimentTrajectory, preferences, riskSignals, recommendedActions, summary

## Technical Details

### 1. Schema Changes

#### 1.1 No Prisma Schema Changes Required

All required relations already exist in the Prisma schema:
- `Member` has `loyaltyEvents LoyaltyEvent[]`, `surveyResponses SurveyResponse[]`, `redemptions Redemption[]`, `campaignEvents CampaignEvent[]`, `currentTier Tier?`
- `CaseFollowUp` has a `memberId String` field but **no Prisma relation** to `Member`

**CaseFollowUp join strategy:** Use `prisma.caseFollowUp.findMany({ where: { memberId, brandId } })` as a separate query rather than adding a schema relation. Adding a relation FK would require a migration and could break the existing `CaseFollowUp` -> `AlertRule` -> `Brand` chain. A separate query is simpler, avoids migration risk, and the 360 endpoint already makes multiple queries.

**No migration needed.** This is a purely additive API feature.

#### 1.2 Database Indexes — Already Sufficient

The 360 endpoint queries use existing indexes:
- `loyalty_events(memberId)` — for events by member
- `survey_responses(brandId, completedAt)` — for responses by brand + ordering
- `redemptions(brandId, memberId)` — for redemptions by member
- `campaign_events(brandId, campaignId)` — for campaign events by brand
- `case_follow_ups(brandId, status)` — for open cases by brand
- `members(brandId)` — for search by brand
- `members(brandId, email)` — unique constraint, used in text search

For search by sentiment/NPS, no new index is needed because the subquery aggregates at query time from `SurveyResponse`. If search performance degrades at scale (>50K members), consider adding a computed `latestSentiment`/`latestNpsScore` column on `Member` as a denormalized cache — but this is premature for mid-market volumes (<100K members per brand).

### 2. Zod Schema Changes

**File**: `packages/shared/src/zod/member.schema.ts`

```typescript
// NEW: Search query params schema
export const SearchMembersQuerySchema = z.object({
  q: z.string().optional(),
  tier: z.string().optional(),
  sentimentMin: z.coerce.number().min(-1).max(1).optional(),
  sentimentMax: z.coerce.number().min(-1).max(1).optional(),
  npsMin: z.coerce.number().min(0).max(10).optional(),
  npsMax: z.coerce.number().min(0).max(10).optional(),
  balanceMin: z.coerce.number().int().min(0).optional(),
  balanceMax: z.coerce.number().int().min(0).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ERASED']).optional(),
  enrolledAfter: z.string().datetime().optional(),
  enrolledBefore: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['name', 'email', 'pointsBalance', 'createdAt', 'sentiment']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

export type SearchMembersQuery = z.infer<typeof SearchMembersQuerySchema>

// NEW: 360 sub-collection limit params
export const Customer360QuerySchema = z.object({
  eventsLimit: z.coerce.number().int().min(1).max(100).default(20),
  surveysLimit: z.coerce.number().int().min(1).max(50).default(10),
  redemptionsLimit: z.coerce.number().int().min(1).max(50).default(10),
  campaignEventsLimit: z.coerce.number().int().min(1).max(50).default(10),
})

export type Customer360Query = z.infer<typeof Customer360QuerySchema>
```

**Validation approach**: Query params arrive as strings from the URL. Use `z.coerce.number()` for numeric filters so Fastify can parse them without manual conversion. The `z.enum` for `sortBy`/`sortOrder` prevents SQL injection in ORDER BY clauses. The pagination uses `page`/`pageSize` (not `limit`/`offset`) to match the standard pagination envelope documented in the architecture (Section 4.1) and used by `GET /v1/programs`.

### 3. API Changes

#### 3.1 New: `GET /v1/members/:id/360`

**File**: `apps/api/src/routes/members.ts`

```typescript
fastify.get<{ Params: { id: string }; Querystring: Customer360Query }>(
  '/members/:id/360',
  async (request, reply) => {
    const { eventsLimit, surveysLimit, redemptionsLimit, campaignEventsLimit } =
      Customer360QuerySchema.parse(request.query)

    // 1. Fetch member with tier
    const member = await fastify.prisma.member.findFirst({
      where: { id: request.params.id, brandId: request.brandId, deletedAt: null },
      include: {
        currentTier: {
          select: { id: true, name: true, rank: true, benefits: true, multiplier: true },
        },
      },
    })
    if (!member) return reply.status(404).send({ error: 'Member not found' })

    // 2. Mask PII if erased (C-GDPR-1, C-CCPA-1)
    const profile = member.erased
      ? { ...member, email: '[ERASED]', firstName: '[ERASED]', lastName: '[ERASED]', phone: '[ERASED]' }
      : member

    // 3. Parallel queries for sub-collections
    const [events, eventCount, surveys, surveyCount, redemptions, redemptionCount,
           campaignEvents, ceCount, openCases, stats] = await Promise.all([
      // Recent events
      fastify.prisma.loyaltyEvent.findMany({
        where: { memberId: member.id, brandId: request.brandId },
        orderBy: { createdAt: 'desc' },
        take: eventsLimit + 1, // +1 to detect hasMore
      }),
      fastify.prisma.loyaltyEvent.count({
        where: { memberId: member.id, brandId: request.brandId },
      }),
      // Survey responses
      fastify.prisma.surveyResponse.findMany({
        where: { memberId: member.id, brandId: request.brandId },
        orderBy: { completedAt: 'desc' },
        take: surveysLimit + 1,
        include: { survey: { select: { name: true, type: true } } },
      }),
      fastify.prisma.surveyResponse.count({
        where: { memberId: member.id, brandId: request.brandId },
      }),
      // Redemptions
      fastify.prisma.redemption.findMany({
        where: { memberId: member.id, brandId: request.brandId },
        orderBy: { createdAt: 'desc' },
        take: redemptionsLimit + 1,
        include: { reward: { select: { name: true } } },
      }),
      fastify.prisma.redemption.count({
        where: { memberId: member.id, brandId: request.brandId },
      }),
      // Campaign events
      fastify.prisma.campaignEvent.findMany({
        where: { memberId: member.id, brandId: request.brandId },
        orderBy: { triggeredAt: 'desc' },
        take: campaignEventsLimit + 1,
        include: { campaign: { select: { name: true } } },
      }),
      fastify.prisma.campaignEvent.count({
        where: { memberId: member.id, brandId: request.brandId },
      }),
      // Open cases (all, no limit)
      fastify.prisma.caseFollowUp.findMany({
        where: { memberId: member.id, brandId: request.brandId, status: 'OPEN' },
        orderBy: { createdAt: 'desc' },
      }),
      // Aggregated stats
      fastify.prisma.loyaltyEvent.aggregate({
        where: { memberId: member.id, brandId: request.brandId },
        _sum: { pointsEarned: true },
      }),
    ])

    // 4. Compute summary stats
    const totalPointsEarned = stats._sum.pointsEarned ?? 0
    const totalPointsRedeemed = redemptions.reduce(
      (sum, r) => sum + r.pointsSpent, 0
    )
    const avgSentiment = surveyCount > 0
      ? surveys.reduce((sum, s) => sum + (s.sentiment ?? 0), 0) / Math.min(surveys.length, surveysLimit)
      : null

    // 5. Build response with hasMore flags
    return reply.status(200).send({
      member: {
        id: profile.id,
        email: profile.email,
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone,
        pointsBalance: profile.pointsBalance,
        status: profile.status,
        enrollmentDate: profile.createdAt,
        consentGivenAt: profile.consentGivenAt,
        consentVersion: profile.consentVersion,
        tier: profile.currentTier,
      },
      recentEvents: {
        items: events.slice(0, eventsLimit).map((e) => ({
          id: e.id,
          eventType: e.eventType,
          pointsEarned: e.pointsEarned,
          payload: e.payload,
          createdAt: e.createdAt,
        })),
        hasMore: events.length > eventsLimit,
        total: eventCount,
      },
      surveyResponses: {
        items: surveys.slice(0, surveysLimit).map((s) => ({
          id: s.id,
          surveyName: s.survey.name,
          surveyType: s.survey.type,
          score: s.score,
          sentiment: s.sentiment,
          topics: s.topics,
          summary: s.summary,
          completedAt: s.completedAt,
        })),
        hasMore: surveys.length > surveysLimit,
        total: surveyCount,
      },
      redemptions: {
        items: redemptions.slice(0, redemptionsLimit).map((r) => ({
          id: r.id,
          rewardName: r.reward.name,
          pointsSpent: r.pointsSpent,
          status: r.status,
          createdAt: r.createdAt,
        })),
        hasMore: redemptions.length > redemptionsLimit,
        total: redemptionCount,
      },
      campaignEvents: {
        items: campaignEvents.slice(0, campaignEventsLimit).map((ce) => ({
          id: ce.id,
          campaignName: ce.campaign.name,
          triggeredAt: ce.triggeredAt,
          status: ce.status,
          result: ce.result,
        })),
        hasMore: campaignEvents.length > campaignEventsLimit,
        total: ceCount,
      },
      openCases: openCases.map((c) => ({
        id: c.id,
        status: c.status,
        priority: c.priority,
        assignee: c.assignee,
        slaDeadline: c.slaDeadline,
        createdAt: c.createdAt,
      })),
      stats: {
        totalEvents: eventCount,
        totalSurveyResponses: surveyCount,
        averageSentiment: avgSentiment,
        totalPointsEarned,
        totalPointsRedeemed,
      },
    })
  },
)
```

**Key design decisions:**
- **`take: limit + 1` pattern**: Fetch one extra record to detect `hasMore` without a separate count query for pagination. The extra record is sliced off before returning.
- **`Promise.all` for parallel queries**: All sub-collection queries are independent and can run concurrently, keeping response time bounded by the slowest individual query rather than the sum.
- **PII masking at response layer**: Erased member check happens once at the top, then profile object is used throughout. No PII leaks through sub-collections (events, redemptions, etc. do not contain PII).
- **Open cases have no limit**: CaseFollowUp count is typically small (<10 per member). Fetching all open cases avoids the complexity of paginating a small collection.

#### 3.2 New: `GET /v1/members`

**File**: `apps/api/src/routes/members.ts`

```typescript
fastify.get('/members', async (request, reply) => {
  const query = SearchMembersQuerySchema.parse(request.query)
  const { q, tier, sentimentMin, sentimentMax, npsMin, npsMax,
          balanceMin, balanceMax, status, enrolledAfter, enrolledBefore,
          page, pageSize, sortBy, sortOrder } = query

  // Build Prisma where clause
  const where: Prisma.MemberWhereInput = {
    brandId: request.brandId,
    deletedAt: null,
  }

  // Text search (ILIKE via Prisma mode: 'insensitive')
  if (q) {
    where.OR = [
      { firstName: { contains: q, mode: 'insensitive' } },
      { lastName: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
    ]
  }

  // Behavioral filters
  if (tier) {
    where.currentTier = { name: { equals: tier, mode: 'insensitive' } }
  }
  if (status) where.status = status
  if (balanceMin !== undefined) where.pointsBalance = { ...where.pointsBalance as object, gte: balanceMin }
  if (balanceMax !== undefined) where.pointsBalance = { ...where.pointsBalance as object, lte: balanceMax }
  if (enrolledAfter) where.createdAt = { ...where.createdAt as object, gte: new Date(enrolledAfter) }
  if (enrolledBefore) where.createdAt = { ...where.createdAt as object, lte: new Date(enrolledBefore) }

  // For sentiment/NPS filters, use a two-pass approach:
  // 1. First query members matching non-survey filters
  // 2. Then filter by survey data via subquery
  // This avoids complex raw SQL while maintaining Prisma type safety.
  const needsSurveyFilter = sentimentMin !== undefined || sentimentMax !== undefined ||
                            npsMin !== undefined || npsMax !== undefined

  if (needsSurveyFilter) {
    // Use Prisma's relational filter: members that HAVE survey responses matching criteria
    const surveyFilter: Prisma.SurveyResponseWhereInput = {}
    if (sentimentMin !== undefined) surveyFilter.sentiment = { ...surveyFilter.sentiment as object, gte: sentimentMin }
    if (sentimentMax !== undefined) surveyFilter.sentiment = { ...surveyFilter.sentiment as object, lte: sentimentMax }
    if (npsMin !== undefined) surveyFilter.score = { ...surveyFilter.score as object, gte: npsMin }
    if (npsMax !== undefined) surveyFilter.score = { ...surveyFilter.score as object, lte: npsMax }

    where.surveyResponses = { some: surveyFilter }
  }

  // Sort mapping
  const orderByMap: Record<string, Prisma.MemberOrderByWithRelationInput> = {
    name: { firstName: sortOrder },
    email: { email: sortOrder },
    pointsBalance: { pointsBalance: sortOrder },
    createdAt: { createdAt: sortOrder },
    // sentiment sort requires post-query sort (see below)
  }

  const isSentimentSort = sortBy === 'sentiment'

  // Query with pagination
  const [members, total] = await Promise.all([
    fastify.prisma.member.findMany({
      where,
      orderBy: isSentimentSort ? { createdAt: 'desc' } : orderByMap[sortBy],
      take: isSentimentSort ? undefined : pageSize, // fetch all for sentiment sort
      skip: isSentimentSort ? undefined : (page - 1) * pageSize,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        pointsBalance: true,
        status: true,
        erased: true,
        createdAt: true,
        currentTier: { select: { name: true } },
        surveyResponses: {
          orderBy: { completedAt: 'desc' },
          take: 1,
          select: { sentiment: true, score: true },
        },
      },
    }),
    fastify.prisma.member.count({ where }),
  ])

  // Post-process: sentiment sort (if needed) + PII masking
  let results = members.map((m) => ({
    id: m.id,
    email: m.erased ? '[ERASED]' : m.email,
    firstName: m.erased ? '[ERASED]' : m.firstName,
    lastName: m.erased ? '[ERASED]' : m.lastName,
    pointsBalance: m.pointsBalance,
    status: m.status,
    tierName: m.currentTier?.name ?? null,
    latestSentiment: m.surveyResponses[0]?.sentiment ?? null,
    latestNpsScore: m.surveyResponses[0]?.score ?? null,
    createdAt: m.createdAt,
  }))

  if (isSentimentSort) {
    results.sort((a, b) => {
      const aVal = a.latestSentiment ?? (sortOrder === 'asc' ? Infinity : -Infinity)
      const bVal = b.latestSentiment ?? (sortOrder === 'asc' ? Infinity : -Infinity)
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal
    })
    results = results.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize)
  }

  return reply.status(200).send({
    data: results,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  })
})
```

**Key design decisions:**
- **ILIKE via Prisma `contains` with `mode: 'insensitive'`**: Sufficient for <100K members per brand. Avoids introducing `tsvector` complexity. If search performance becomes an issue, a `tsvector` GIN index can be added later without API contract changes.
- **Sentiment/NPS filtering via Prisma `some` relational filter**: Checks if the member has ANY survey response matching the criteria. This is simpler than averaging and aligns with "show me members who recently scored X" use case. The feature spec's R11 says "filter uses actual survey data, not a cached field" — this satisfies that.
- **Sentiment sort is post-query**: Prisma does not support ORDER BY on a related model's field. For sentiment sort, we fetch all matching members and sort in-memory. This is acceptable for mid-market volumes (<100K). If it becomes a bottleneck, add a `latestSentiment` denormalized column.
- **PII masking**: Erased members appear in search results but with `[ERASED]` for PII fields. This allows admins to see that erased members exist without exposing their identity.

#### 3.3 Authentication & Multi-Tenant Scoping

Both new endpoints use the existing auth plugin pattern:
- `request.brandId` comes from the verified Clerk JWT (or `X-Test-Brand-Id` header in test mode)
- The `multiTenant` plugin rejects any `brandId` in the request body
- All Prisma queries include `brandId: request.brandId` as a WHERE clause
- All queries include `deletedAt: null` to exclude soft-deleted records

No new auth patterns are introduced. Both endpoints are admin-authenticated routes (not public).

### 4. MCP Tool Changes

**File**: `apps/mcp-server/src/tools/members.ts`

#### 4.1 New: `get_customer_360` tool

```typescript
server.tool(
  'get_customer_360',
  'Get a comprehensive Customer 360 view including profile, loyalty events, survey responses, ' +
  'redemptions, campaign events, open cases, and summary statistics.',
  z.object({
    memberId: z.string().describe('Member ID'),
    eventsLimit: z.number().int().min(1).max(100).default(20).optional()
      .describe('Max recent events to return (default: 20)'),
    surveysLimit: z.number().int().min(1).max(50).default(10).optional()
      .describe('Max survey responses to return (default: 10)'),
  }).shape,
  async (params) => {
    const queryParams: Record<string, string> = {}
    if (params.eventsLimit) queryParams.eventsLimit = String(params.eventsLimit)
    if (params.surveysLimit) queryParams.surveysLimit = String(params.surveysLimit)

    const res = await apiFetch(`/v1/members/${params.memberId}/360`, { params: queryParams })
    if (!res.ok) return { content: [{ type: 'text' as const, text: `Error: ${res.error}` }] }

    // Format for LLM readability
    const data = res.data as Record<string, unknown>
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(data, null, 2),
      }],
    }
  },
)
```

#### 4.2 New: `search_members` tool

```typescript
server.tool(
  'search_members',
  'Search for loyalty program members by name, email, or behavioral filters (tier, sentiment, ' +
  'NPS score, points balance, status, enrollment date).',
  z.object({
    q: z.string().optional().describe('Text search across name and email'),
    tier: z.string().optional().describe('Filter by tier name'),
    sentimentMin: z.number().min(-1).max(1).optional().describe('Min sentiment (-1.0 to 1.0)'),
    sentimentMax: z.number().min(-1).max(1).optional().describe('Max sentiment (-1.0 to 1.0)'),
    npsMin: z.number().min(0).max(10).optional().describe('Min NPS score (0-10)'),
    npsMax: z.number().min(0).max(10).optional().describe('Max NPS score (0-10)'),
    balanceMin: z.number().int().min(0).optional().describe('Min points balance'),
    balanceMax: z.number().int().min(0).optional().describe('Max points balance'),
    status: z.enum(['ACTIVE', 'INACTIVE', 'ERASED']).optional().describe('Member status filter'),
    page: z.number().int().min(1).default(1).optional().describe('Page number (default: 1)'),
    pageSize: z.number().int().min(1).max(100).default(20).optional().describe('Results per page (default: 20)'),
  }).shape,
  async (params) => {
    const queryParams: Record<string, string> = {}
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) queryParams[key] = String(value)
    }

    const res = await apiFetch('/v1/members', { params: queryParams })
    if (!res.ok) return { content: [{ type: 'text' as const, text: `Error: ${res.error}` }] }
    return { content: [{ type: 'text' as const, text: JSON.stringify(res.data, null, 2) }] }
  },
)
```

### 5. BAML Changes

#### 5.1 New: `SynthesizeCustomerProfile` function

**File**: `packages/ai/baml_src/synthesize_profile.baml`

```baml
// LLM-powered KYC synthesis
// Takes Customer 360 data and produces structured behavioral analysis

class CustomerContext {
  member_status string @description("ACTIVE, INACTIVE, or ERASED")
  points_balance int
  tier_name string? @description("Current tier name or null")
  total_events int
  total_survey_responses int
  average_sentiment float? @description("Average sentiment across survey responses, -1.0 to 1.0")
  total_points_earned int
  total_points_redeemed int
  recent_event_types string[] @description("Event types from last 20 events, e.g. ['purchase', 'survey_complete']")
  recent_sentiments float[] @description("Sentiment scores from recent survey responses, newest first")
  recent_nps_scores float[] @description("NPS scores from recent survey responses, newest first")
  recent_topics string[][] @description("Topics arrays from recent survey responses")
  has_open_cases bool
  open_case_count int
  days_since_enrollment int
  days_since_last_event int? @description("Days since most recent loyalty event, or null if no events")
}

class CustomerProfileSynthesis {
  engagement_level string @description("One of: high, medium, low, dormant — based on event frequency and recency")
  sentiment_trajectory string @description("One of: improving, stable, declining — based on sentiment over time")
  preferences string[] @description("Inferred preferences from purchase patterns, redemption choices, campaign participation")
  risk_signals string[] @description("Churn indicators: declining engagement, negative sentiment trend, SLA breaches")
  recommended_actions string[] @description("Specific next-best-actions for this customer")
  summary string @description("2-3 sentence natural-language narrative of who this customer is")
}

function SynthesizeCustomerProfile(
  context: CustomerContext
) -> CustomerProfileSynthesis {
  client GPT4o
  prompt #"
    You are a customer success analyst for a loyalty program. Analyze this customer's data and produce a structured Know Your Customer (KYC) profile.

    Customer Data:
    - Status: {{ context.member_status }}
    - Points Balance: {{ context.points_balance }}
    {% if context.tier_name %}- Tier: {{ context.tier_name }}{% endif %}
    - Total Events: {{ context.total_events }}
    - Total Survey Responses: {{ context.total_survey_responses }}
    {% if context.average_sentiment %}- Average Sentiment: {{ context.average_sentiment }}{% endif %}
    - Total Points Earned: {{ context.total_points_earned }}
    - Total Points Redeemed: {{ context.total_points_redeemed }}
    - Days Since Enrollment: {{ context.days_since_enrollment }}
    {% if context.days_since_last_event %}- Days Since Last Event: {{ context.days_since_last_event }}{% endif %}
    - Open Support Cases: {{ context.open_case_count }}

    {% if context.recent_event_types %}
    Recent Event Types (newest first): {{ context.recent_event_types }}
    {% endif %}

    {% if context.recent_sentiments %}
    Recent Sentiment Scores (newest first): {{ context.recent_sentiments }}
    {% endif %}

    {% if context.recent_nps_scores %}
    Recent NPS Scores (newest first): {{ context.recent_nps_scores }}
    {% endif %}

    {% if context.recent_topics %}
    Recent Survey Topics: {{ context.recent_topics }}
    {% endif %}

    Rules:
    - engagement_level: "high" if frequent recent events (multiple per week), "medium" if regular (weekly/biweekly), "low" if infrequent (monthly or less), "dormant" if no events in 30+ days
    - sentiment_trajectory: compare recent sentiments to older ones — "improving" if trending up, "declining" if trending down, "stable" if consistent
    - preferences: infer from event types, redemption patterns, and survey topics — be specific (e.g. "experiential rewards" not "rewards")
    - risk_signals: flag declining engagement, negative sentiment trends, open SLA breaches, high points balance with no recent redemptions (disengagement signal)
    - recommended_actions: suggest 2-3 concrete, actionable steps based on the profile
    - summary: write a concise 2-3 sentence narrative — do NOT include raw PII (email, phone, full name)

    {{ ctx.output_format }}
  "#
}

// Tests: see packages/ai/src/analysis/synthesize-profile.test.ts
```

**Key design decisions:**
- **Uses `GPT4o` client** (not GPT4oMini) per spec R14 for synthesis quality. The KYC function produces nuanced behavioral analysis requiring stronger reasoning.
- **Input is pre-processed `CustomerContext`** rather than raw 360 JSON. This keeps the prompt token count bounded and avoids sending raw PII (email, name, phone) to the LLM. The caller transforms 360 response into `CustomerContext` before invoking.
- **No PII in BAML input/output** (C-GDPR-4): The `CustomerContext` class contains only behavioral data (event counts, sentiments, topics). The caller must strip PII before passing data to BAML.

#### 5.2 TypeScript Wrapper

**File**: `packages/ai/src/analysis/synthesize-profile.ts`

```typescript
import { b } from '../generated/index.js'
import type { Customer360Response } from '@customerEQ/shared'

export interface CustomerContext {
  memberStatus: string
  pointsBalance: number
  tierName: string | null
  totalEvents: number
  totalSurveyResponses: number
  averageSentiment: number | null
  totalPointsEarned: number
  totalPointsRedeemed: number
  recentEventTypes: string[]
  recentSentiments: number[]
  recentNpsScores: number[]
  recentTopics: string[][]
  hasOpenCases: boolean
  openCaseCount: number
  daysSinceEnrollment: number
  daysSinceLastEvent: number | null
}

export interface CustomerProfileSynthesis {
  engagementLevel: 'high' | 'medium' | 'low' | 'dormant'
  sentimentTrajectory: 'improving' | 'stable' | 'declining'
  preferences: string[]
  riskSignals: string[]
  recommendedActions: string[]
  summary: string
}

/**
 * Transform a Customer 360 API response into the context needed for BAML synthesis.
 * Strips all PII to comply with C-GDPR-4.
 */
export function buildCustomerContext(data: Customer360Response): CustomerContext {
  const now = new Date()
  const enrollmentDate = new Date(data.member.enrollmentDate)
  const lastEventDate = data.recentEvents.items[0]?.createdAt
    ? new Date(data.recentEvents.items[0].createdAt)
    : null

  return {
    memberStatus: data.member.status,
    pointsBalance: data.member.pointsBalance,
    tierName: data.member.tier?.name ?? null,
    totalEvents: data.stats.totalEvents,
    totalSurveyResponses: data.stats.totalSurveyResponses,
    averageSentiment: data.stats.averageSentiment,
    totalPointsEarned: data.stats.totalPointsEarned,
    totalPointsRedeemed: data.stats.totalPointsRedeemed,
    recentEventTypes: data.recentEvents.items.map((e) => e.eventType),
    recentSentiments: data.surveyResponses.items
      .filter((s) => s.sentiment !== null)
      .map((s) => s.sentiment!),
    recentNpsScores: data.surveyResponses.items
      .filter((s) => s.score !== null)
      .map((s) => s.score!),
    recentTopics: data.surveyResponses.items.map((s) => s.topics),
    hasOpenCases: data.openCases.length > 0,
    openCaseCount: data.openCases.length,
    daysSinceEnrollment: Math.floor((now.getTime() - enrollmentDate.getTime()) / 86400000),
    daysSinceLastEvent: lastEventDate
      ? Math.floor((now.getTime() - lastEventDate.getTime()) / 86400000)
      : null,
  }
}

/**
 * Synthesize a KYC profile from Customer 360 data using GPT-4o via BAML.
 */
export async function synthesizeCustomerProfile(
  data: Customer360Response,
): Promise<CustomerProfileSynthesis> {
  const context = buildCustomerContext(data)
  const result = await b.SynthesizeCustomerProfile({
    context: {
      member_status: context.memberStatus,
      points_balance: context.pointsBalance,
      tier_name: context.tierName,
      total_events: context.totalEvents,
      total_survey_responses: context.totalSurveyResponses,
      average_sentiment: context.averageSentiment,
      total_points_earned: context.totalPointsEarned,
      total_points_redeemed: context.totalPointsRedeemed,
      recent_event_types: context.recentEventTypes,
      recent_sentiments: context.recentSentiments,
      recent_nps_scores: context.recentNpsScores,
      recent_topics: context.recentTopics,
      has_open_cases: context.hasOpenCases,
      open_case_count: context.openCaseCount,
      days_since_enrollment: context.daysSinceEnrollment,
      days_since_last_event: context.daysSinceLastEvent,
    },
  })

  return {
    engagementLevel: result.engagement_level as CustomerProfileSynthesis['engagementLevel'],
    sentimentTrajectory: result.sentiment_trajectory as CustomerProfileSynthesis['sentimentTrajectory'],
    preferences: result.preferences,
    riskSignals: result.risk_signals,
    recommendedActions: result.recommended_actions,
    summary: result.summary,
  }
}
```

### 6. Implementation Order

| Step | Description | Files | Depends On |
|---|---|---|---|
| 1 | Zod schemas: `SearchMembersQuerySchema`, `Customer360QuerySchema` | `packages/shared/src/zod/member.schema.ts` | Nothing |
| 2 | BAML function: `SynthesizeCustomerProfile` | `packages/ai/baml_src/synthesize_profile.baml` | Nothing |
| 3 | BAML TypeScript wrapper: `synthesizeCustomerProfile()` | `packages/ai/src/analysis/synthesize-profile.ts` | Step 2 |
| 4 | API: `GET /v1/members/:id/360` endpoint | `apps/api/src/routes/members.ts` | Step 1 |
| 5 | API: `GET /v1/members` search endpoint | `apps/api/src/routes/members.ts` | Step 1 |
| 6 | MCP: `get_customer_360` tool | `apps/mcp-server/src/tools/members.ts` | Step 4 |
| 7 | MCP: `search_members` tool | `apps/mcp-server/src/tools/members.ts` | Step 5 |
| 8 | Unit tests: Zod schemas, `buildCustomerContext()` | `packages/shared/`, `packages/ai/` | Steps 1, 3 |
| 9 | BAML eval tests: `SynthesizeCustomerProfile` | `packages/ai/src/analysis/synthesize-profile.test.ts` | Step 3 |
| 10 | Integration tests: 360 + search endpoints | `apps/api/test/integration/members.test.ts` | Steps 4, 5 |
| 11 | Test factories: extend member factory with survey/event data | `packages/config/src/test-utils/` | Nothing |

Steps 1-2 can be done in parallel. Steps 4-5 can be done in parallel (both depend on Step 1). Steps 6-7 can be done in parallel. Steps 8-11 can be done in parallel once their dependencies are met.

## Confidence Level

**90/100**

High confidence because:
- No schema migrations needed — all Prisma relations already exist
- Prisma `include` with `take`/`orderBy` is well-established and used throughout the codebase
- BAML function follows the exact `AnalyzeFeedback` pattern already working in production
- MCP tools follow the exact `get_member`/`get_member_balance` pattern
- Text search via Prisma `contains` with `mode: 'insensitive'` is a standard Prisma feature
- No new packages, no new auth patterns, no external integrations

Medium areas:
- Sentiment sort requires in-memory sort (but acceptable for <100K members)
- CaseFollowUp join without Prisma relation (but `findMany` with `where: { memberId }` works fine)
- `Promise.all` with 10+ parallel Prisma queries (but PostgreSQL connection pooling handles this)

## Validation Plan

| User Scenario | Expected Outcome | Validation Method |
|---|---|---|
| Call `GET /v1/members/:id/360` for active member with events, surveys, redemptions | 200 with all sub-collections populated, correct counts | API test (Supertest) |
| Call 360 for member with no events/surveys/redemptions | 200 with empty arrays, `hasMore: false`, zero counts | API test |
| Call 360 for erased member | 200 with `[ERASED]` for email/firstName/lastName/phone | API test |
| Call 360 for non-existent member | 404 | API test |
| Call 360 for member in different brand | 404 (brandId scoping) | API test |
| Call 360 with `eventsLimit=5` for member with 20 events | 5 events returned, `hasMore: true`, `total: 20` | API test |
| Call `GET /v1/members?q=ali` | Returns members matching "ali" in name or email | API test |
| Call search with `npsMin=9&sentimentMax=-0.3` | Returns only at-risk promoters | API test |
| Call search with `tier=Gold` | Returns only Gold tier members | API test |
| Call search with `status=ERASED` | Returns erased members with `[ERASED]` PII | API test |
| Call search with `balanceMin=1000&balanceMax=5000` | Returns members in points range | API test |
| Call search with `page=3&pageSize=5` | Returns correct page of results with total and totalPages | API test |
| Call search with `sortBy=sentiment&sortOrder=desc` | Members sorted by latest sentiment descending | API test |
| Invoke `get_customer_360` MCP tool | Returns formatted 360 data | MCP tool test |
| Invoke `search_members` MCP tool with filters | Returns matching members | MCP tool test |
| `SynthesizeCustomerProfile` with high-engagement member | Returns `engagementLevel: "high"`, positive trajectory | BAML eval test |
| `SynthesizeCustomerProfile` with declining member | Returns risk signals, `sentimentTrajectory: "declining"` | BAML eval test |
| `SynthesizeCustomerProfile` with minimal data (new member) | Graceful handling, `engagementLevel: "low"` or `"dormant"` | BAML eval test |
| `buildCustomerContext()` strips PII | Output contains no email, name, or phone | Unit test |
| Erased member PII masking in 360 response | email/name/phone show `[ERASED]` | API test |
| Soft-deleted member excluded from search | Not returned in results | API test |
| brandId scoping — cannot access other brand's members | 404 or empty results | API test |

## Test Matrix

### Unit Tests

**New suite**: `packages/shared/src/zod/member.schema.test.ts` (extend existing)
- `SearchMembersQuerySchema` — valid queries, coercion of string params to numbers, default values, min/max bounds, invalid status
- `Customer360QuerySchema` — valid limits, defaults, out-of-range limits

**New suite**: `packages/ai/src/analysis/synthesize-profile.test.ts`
- `buildCustomerContext()` — transforms 360 response correctly, handles null sentiments, handles empty sub-collections, computes daysSinceEnrollment correctly, output contains no PII
- Mock BAML client for `synthesizeCustomerProfile()` — verify input/output mapping

### Integration Tests

**Extend**: `apps/api/test/integration/members.test.ts`
- `GET /v1/members/:id/360` — happy path (all sub-collections populated), empty member (no events), erased member (PII masked), non-existent member (404), cross-brand access (404), pagination limits, open cases included
- `GET /v1/members` — text search by name, text search by email, tier filter, sentiment range filter, NPS range filter, balance range filter, status filter, date range filter, combined filters, pagination (page/pageSize), sort by different columns, erased member PII masking, soft-deleted exclusion, cross-brand isolation

**New test factories needed**: `packages/config/src/test-utils/factories/`
- Extend `createConsentedMember()` to optionally seed related data (events, survey responses, redemptions)
- Add `createMemberWith360Data()` factory that creates a member with a full set of related records for 360 testing
- Add `createSurveyResponse()` factory (may already exist in `survey.factory.ts`)

### BAML Eval Tests (requires OPENAI_API_KEY)

**New suite**: `packages/ai/src/analysis/synthesize-profile.eval.ts` (or `.test.ts` with `test:baml` script)
- High-engagement member context -> verify `engagementLevel` is "high", `riskSignals` is empty or minimal
- Declining member context (decreasing sentiments, no recent events) -> verify risk signals present, `sentimentTrajectory` is "declining"
- New member context (1 event, no surveys) -> verify graceful output, no hallucinated data
- Dormant member context (no events in 60 days) -> verify `engagementLevel` is "dormant"

### E2E Tests

No E2E tests needed for this feature — it is entirely API/backend with MCP tool exposure. No UI components are introduced. E2E tests will be added when the consuming UI is built in Phase B (Health Score dashboard) and Phase D (Support Widget).

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| 360 endpoint slow for members with many events (>1000) | Low | Medium | `take: limit + 1` caps query size. All sub-queries run in parallel via `Promise.all`. Existing DB indexes cover all WHERE clauses. Monitor P95 latency; add materialized stats if >500ms. |
| Search by sentiment requires in-memory sort, slow for large result sets | Low | Medium | Mid-market customers have <100K members per brand. In-memory sort of 100K records takes <50ms. If needed, add denormalized `latestSentiment` column on `Member` table. |
| ILIKE search performance on large member tables | Low | Low | PostgreSQL ILIKE with `%term%` does a sequential scan. For <100K rows per brand (scoped by brandId index), this is <50ms. Add `pg_trgm` GIN index if needed. |
| `Promise.all` with 10+ parallel queries exhausts connection pool | Low | Medium | Default Prisma pool is 10 connections per instance. 360 endpoint issues ~10 parallel queries. In worst case, two concurrent 360 requests could saturate the pool. Mitigation: increase pool size to 20 for API app (`?connection_limit=20` in DATABASE_URL). Monitor connection pool saturation. |
| BAML `SynthesizeCustomerProfile` returns invalid enum values | Low | Low | BAML's structured output parsing enforces the schema. Invalid values cause a parse error, which the caller handles gracefully. Add retry policy from `clients.baml`. |
| CaseFollowUp missing Prisma relation to Member | None | Low | CaseFollowUp already has `memberId` field. `findMany({ where: { memberId } })` works without a Prisma relation. No migration risk. |

## Spike Findings

No spike was required. All technologies are well-established in the codebase:
- **Prisma `include` with `take`/`orderBy`**: Used in `GET /v1/members/me/balance` (events), survey routes, and campaign routes
- **Prisma `contains` with `mode: 'insensitive'`**: Standard Prisma feature, documented pattern
- **Prisma `aggregate`**: Used in analytics routes for KPI computation
- **BAML function with structured output**: `AnalyzeFeedback` and `DiscoverClusters` follow identical pattern
- **MCP tool with `apiFetch`**: Three existing tools (`enroll_member`, `get_member`, `get_member_balance`) follow exact same pattern
- **`Promise.all` for parallel queries**: Used in analytics routes

## Observability

### Logs (Pino)

- `member.360.fetched` — when 360 endpoint returns successfully (includes memberId, brandId, sub-collection counts)
- `member.360.erased` — when 360 is fetched for an erased member (includes memberId, brandId)
- `member.search.executed` — when search returns (includes brandId, filter count, result count, response time ms)
- `member.kyc.synthesized` — when BAML KYC completes (includes memberId, engagementLevel, latency ms)
- `member.kyc.error` — when BAML KYC fails (includes memberId, error message)

### Audit Events

The existing audit plugin automatically logs all mutations (POST/PATCH/DELETE/PUT). The 360 and search endpoints are GET requests, so they are not automatically logged. Per C-CCPA-2, add explicit audit logging for 360 access:

```typescript
// In 360 endpoint, after successful response
fastify.prisma.auditEvent.create({
  data: {
    brandId: request.brandId,
    actorId: request.clerkUserId,
    action: 'member.360.accessed',
    resourceType: 'Member',
    resourceId: member.id,
  },
}).catch((err) => fastify.log.error({ err }, 'Failed to log 360 audit event'))
```

This is fire-and-forget (non-blocking) to avoid adding latency to the 360 response.

### Metrics (future)

- 360 endpoint latency (P50/P95/P99)
- Search endpoint latency by filter combination
- KYC synthesis latency and token usage
- Search result count distribution (are users finding what they need?)

## Architecture Analysis

### Patterns Correctly Followed

1. **Standard pagination envelope** — search endpoint returns `{ data, total, page, pageSize, totalPages }` matching the convention documented in architecture Section 4.1 and used by `GET /v1/programs`
2. **Fastify route registration** — new routes added to existing `members.ts` file, same pattern as `GET /v1/members/:id`
2. **Zod validation** — new schemas in `packages/shared/src/zod/member.schema.ts`, using `z.coerce` for query params
3. **Multi-tenant scoping** — `brandId` from JWT, all queries include `brandId: request.brandId`, `deletedAt: null`
4. **GDPR PII masking** — erased member check with `[ERASED]` replacement, same as architectural requirement
5. **Prisma query patterns** — `include`, `take`, `orderBy`, `aggregate` used consistently with existing routes
6. **BAML function pattern** — follows `AnalyzeFeedback` structure: class definitions, function with prompt, `ctx.output_format`
7. **MCP tool pattern** — follows `get_member`/`get_member_balance` structure: Zod schema, `apiFetch`, text content response
8. **Shared test utilities** — new factories go in `packages/config/src/test-utils/factories/`, tests import from `@customerEQ/config/test-utils`
9. **Audit logging** — fire-and-forget `auditEvent.create()` for 360 access (C-CCPA-2)

### Patterns Missing from Architecture (Need Documentation)

**1. Behavioral Search / Relational Filtering**
- **What**: The search endpoint introduces filtering members by attributes of related models (sentiment from `SurveyResponse`, NPS from `SurveyResponse`). This pattern (Prisma `some` relational filter) is not documented in the architecture doc.
- **Suggested resolution**: Add a note to Section 4.1 (API Routes) that list endpoints may filter by related model attributes using Prisma's `some`/`every` relational filters.

**2. In-Memory Post-Query Sort**
- **What**: Sorting by `sentiment` requires fetching all matching members and sorting in application code because Prisma does not support ORDER BY on related model fields.
- **Suggested resolution**: Document this as a known limitation and the threshold at which to switch to raw SQL or denormalized columns (>100K members per brand).

### Patterns Incorrectly Followed

None identified. The design follows all existing architectural patterns correctly.

## Design Standards

Generic UI baseline applied. No UI components introduced in this phase. The feature is entirely API/backend with MCP tool exposure. The consuming UI will be built in Phase B (Health Score dashboard) and Phase D (Support Widget).

## Open Questions Resolution

| Question | Resolution |
|---|---|
| Health score placeholder in 360 response? | **No.** Adding a null placeholder creates a contract that must be maintained. Phase B will add the field when the health score computation is built. Simpler to extend the response schema then. |
| ILIKE vs `tsvector` for search? | **ILIKE via Prisma `contains`.** Sufficient for <100K members per brand. `tsvector` adds migration complexity and Prisma raw SQL dependency. Can be added later without API contract changes if needed. |
| Sub-collection defaults (20 events, 10 surveys, etc.)? | **Adopted as specified.** Configurable via query parameters. Defaults are reasonable for typical member profiles. |
| KYC caching? | **On-demand for now.** Caching adds staleness risk and TTL management complexity. Phase B can introduce a `memberKyc` cache table if synthesis latency becomes an issue (GPT-4o typically responds in 1-3 seconds). |
