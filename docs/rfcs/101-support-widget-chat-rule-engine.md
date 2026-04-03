# Technical Design: Support Widget — Embeddable Chat with Rule-Based Response Engine

Issue: #101
Owner: Claude (technical-design job)
Spec: GitHub issue #101 body + `docs/brainstorming/codebase-brainstorming-2026-04-03.md` (S7, S8)

## Customer

Brand administrators who want configurable, no-code support automation. End customers (loyalty members) who need real-time support on brand websites without leaving the page.

## Customer Problem Being Solved

Customer support is disconnected from customer intelligence. When a Gold-tier member with declining health score contacts support about a billing issue, the agent has no context. Responses are generic. Escalation rules are manual. There is no self-service channel embedded in the brand's website.

This feature solves three problems:
1. **No embedded support channel** — members must leave the brand site to get help.
2. **No context-aware responses** — support has no access to Customer 360 data, health scores, or KB articles during conversations.
3. **No automated routing/response** — escalation, auto-responses, and compensatory actions (points award, survey trigger) require manual human judgment for every interaction.

## User Experience That Will Solve the Problem

### Member Flow (Chat Widget)
1. Member visits brand website with embedded `<ceq-support-chat>` component
2. Clicks chat bubble launcher (bottom-right corner)
3. Chat panel slides up with greeting: "Hi [firstName], how can we help?"
4. Member types message (e.g., "I was charged twice for my order")
5. System classifies intent (billing), retrieves relevant KB articles, injects Customer 360 context
6. LLM generates personalized response using KB + customer context
7. If SupportRule matches (e.g., intent=billing AND tier=Gold), auto-actions fire: escalate to account manager, award 500 apology points
8. If confidence is low or rule says escalate, conversation is handed off to `CaseFollowUp` for human agent
9. Member sees real-time streamed response via SSE
10. Conversation history persists across page navigations (stored server-side)

### Admin Flow (Support Rules)
1. Navigate to `/admin/support/rules`
2. Click "New Support Rule"
3. Configure match conditions using condition-builder UI:
   - Intent = "billing" AND Customer Tier = "Gold" AND Health Score < 40
4. Configure actions:
   - Auto-respond with KB article (select from dropdown)
   - Escalate to human (assign to specific team/person)
   - Award points (apology gesture — amount configurable)
   - Trigger survey (post-resolution CSAT)
5. Set priority (lower = evaluated first) and enable/disable toggle
6. Save rule; it takes effect immediately for new conversations

### Admin Flow (Conversation Dashboard)
1. Navigate to `/admin/support/conversations`
2. See list of active/recent conversations with member name, intent, status, assigned agent
3. Click into conversation to see full thread, Customer 360 sidebar, matched rules
4. Can manually respond, escalate, or close conversation

## Technical Details

### 1. Schema Changes

#### 1.1 New Models: Conversation and Message

```prisma
enum ConversationStatus {
  ACTIVE
  WAITING_ON_CUSTOMER
  ESCALATED
  RESOLVED
  CLOSED
}

enum MessageRole {
  CUSTOMER
  AI
  AGENT
}

model Conversation {
  id             String             @id @default(cuid())
  brandId        String
  brand          Brand              @relation(fields: [brandId], references: [id])
  memberId       String
  member         Member             @relation(fields: [memberId], references: [id])

  status         ConversationStatus @default(ACTIVE)
  intent         String?            // classified intent (billing, shipping, etc.)
  confidence     Float?             // intent classification confidence
  topic          String?            // extracted topic
  summary        String?            // AI-generated conversation summary

  // Escalation
  assignee       String?            // human agent email
  caseFollowUpId String?            // FK to CaseFollowUp if escalated
  escalatedAt    DateTime?

  // Rules matched
  rulesMatched   String[]           // SupportRule IDs that fired

  messages       Message[]

  createdAt      DateTime           @default(now())
  updatedAt      DateTime           @updatedAt
  resolvedAt     DateTime?
  closedAt       DateTime?

  @@index([brandId, status])
  @@index([memberId])
  @@index([brandId, createdAt])
  @@map("conversations")
}

model Message {
  id              String       @id @default(cuid())
  conversationId  String
  conversation    Conversation @relation(fields: [conversationId], references: [id])

  role            MessageRole  // CUSTOMER, AI, AGENT
  content         String       // message text
  metadata        Json?        // { kbArticleIds, customer360Snapshot, intentResult, confidence }

  createdAt       DateTime     @default(now())

  @@index([conversationId, createdAt])
  @@map("messages")
}
```

**File**: `packages/database/prisma/schema.prisma`

**Migration**: Two new tables (`conversations`, `messages`). Non-breaking — no changes to existing tables.

Add relations to existing models:
- `Brand`: add `conversations Conversation[]`
- `Member`: add `conversations Conversation[]`

#### 1.2 New Model: SupportRule

```prisma
model SupportRule {
  id              String   @id @default(cuid())
  brandId         String
  brand           Brand    @relation(fields: [brandId], references: [id])
  name            String
  description     String?
  status          String   @default("ACTIVE") // ACTIVE, PAUSED
  priority        Int      @default(0)        // lower = evaluated first

  // Match conditions (extends AlertRule pattern)
  intentFilters   String[] // ["billing", "shipping"] or empty = all
  tierFilters     String[] // ["Gold", "Platinum"] or empty = all
  healthScoreMin  Float?   // match if health score >= this
  healthScoreMax  Float?   // match if health score <= this
  topicFilters    String[] // ["refund", "overcharge"] or empty = all
  conditions      Json     @default("{}") // ConditionGroup for additional field/op/value matching

  // Actions (multiple can fire)
  autoRespondArticleId String?  // KB article ID to auto-respond with
  escalateToAssignee   String?  // human agent email for escalation
  awardPoints          Int?     // compensatory points to award
  triggerSurveyId      String?  // post-resolution survey to trigger

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([brandId, status])
  @@map("support_rules")
}
```

**File**: `packages/database/prisma/schema.prisma`

Add relation to `Brand`: `supportRules SupportRule[]`

#### 1.3 Dependency on Phase A-C Models (Not in This RFC)

This RFC assumes the following Phase A-C models and APIs exist or will be built first:
- **Customer 360 API** (Phase A, S1): `GET /v1/members/:id/360` returning aggregated member data
- **Health Score** (Phase B, S4): computed field on Member or separate table
- **KBArticle model** (Phase C, S5): knowledge base articles with vector embeddings for RAG
- **ClassifyIntent BAML function** (Phase C, S6): intent classification from message text

If these do not exist at implementation time, the orchestration pipeline will degrade gracefully:
- No Customer 360 -> LLM responds without customer context
- No Health Score -> SupportRule healthScore conditions are skipped
- No KB articles -> LLM responds without KB RAG context (general knowledge only)
- No ClassifyIntent -> Intent is set to "unknown", only non-intent-based rules fire

### 2. Zod Schema Changes

**File**: `packages/shared/src/zod/support.schema.ts` (new)

```typescript
import { z } from 'zod'

// --- Conversation ---
export const ConversationStatusEnum = z.enum([
  'ACTIVE', 'WAITING_ON_CUSTOMER', 'ESCALATED', 'RESOLVED', 'CLOSED'
])

export const CreateConversationSchema = z.object({
  memberEmail: z.string().email(),
  initialMessage: z.string().min(1).max(5000),
})

// --- Message ---
export const MessageRoleEnum = z.enum(['CUSTOMER', 'AI', 'AGENT'])

export const SendMessageSchema = z.object({
  content: z.string().min(1).max(5000),
})

// --- SupportRule ---
export const CreateSupportRuleSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  priority: z.number().int().min(0).default(0),
  intentFilters: z.array(z.string()).default([]),
  tierFilters: z.array(z.string()).default([]),
  healthScoreMin: z.number().min(0).max(100).optional(),
  healthScoreMax: z.number().min(0).max(100).optional(),
  topicFilters: z.array(z.string()).default([]),
  conditions: z.object({
    operator: z.enum(['AND', 'OR']).default('AND'),
    conditions: z.array(z.object({
      field: z.string(),
      op: z.enum(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'contains']),
      value: z.union([z.string(), z.number()]),
    })).default([]),
  }).default({ operator: 'AND', conditions: [] }),
  autoRespondArticleId: z.string().optional(),
  escalateToAssignee: z.string().email().optional(),
  awardPoints: z.number().int().min(0).optional(),
  triggerSurveyId: z.string().optional(),
}).refine(
  (d) => d.healthScoreMin === undefined || d.healthScoreMax === undefined || d.healthScoreMin <= d.healthScoreMax,
  { message: 'healthScoreMin must be <= healthScoreMax' }
)

export const UpdateSupportRuleSchema = CreateSupportRuleSchema.partial().extend({
  status: z.enum(['ACTIVE', 'PAUSED']).optional(),
})
```

### 3. BAML Functions

#### 3.1 ClassifyIntent (Phase C prerequisite — documented here for orchestration)

**File**: `packages/ai/baml_src/classify_intent.baml`

```
class IntentResult {
  intent string @description("Primary intent: billing, shipping, product_question, complaint, feature_request, praise, account, returns, technical, other")
  confidence float @description("0.0 to 1.0")
  urgency string @description("low, medium, high, critical")
  suggestedTopics string[] @description("Specific topics extracted from the message")
}

function ClassifyIntent(
  message_text: string,
  conversation_history: string? @description("Previous messages for context")
) -> IntentResult {
  client GPT4oMini
  prompt #"
    Classify the customer support intent from this message.
    ...
  "#
}
```

#### 3.2 GenerateSupportResponse (New — this RFC)

**File**: `packages/ai/baml_src/generate_support_response.baml`

```
class SupportResponse {
  response string @description("The support response to send to the customer")
  confidence float @description("0.0 to 1.0 — how confident the AI is in this response")
  shouldEscalate bool @description("True if the AI recommends human escalation")
  escalationReason string? @description("Why escalation is recommended")
  kbArticlesUsed string[] @description("IDs of KB articles referenced in the response")
}

function GenerateSupportResponse(
  customer_message: string,
  conversation_history: string,
  intent: string,
  kb_context: string @description("Relevant KB article excerpts from RAG retrieval"),
  customer_context: string @description("Customer 360 summary: tier, health score, recent activity, sentiment"),
  brand_name: string,
  support_rules_context: string? @description("Any auto-response content from matched support rules")
) -> SupportResponse {
  client GPT4o
  prompt #"
    You are a support agent for {{ brand_name }}. Generate a helpful, personalized response.

    Customer message: {{ customer_message }}

    {% if conversation_history %}
    Conversation history:
    {{ conversation_history }}
    {% endif %}

    Intent: {{ intent }}

    {% if kb_context %}
    Relevant knowledge base articles:
    {{ kb_context }}
    {% endif %}

    {% if customer_context %}
    Customer context:
    {{ customer_context }}
    {% endif %}

    {% if support_rules_context %}
    Pre-configured response guidance:
    {{ support_rules_context }}
    {% endif %}

    Guidelines:
    - Be empathetic and professional
    - Reference specific KB articles when relevant
    - Personalize based on customer context (use their name, acknowledge their tier/history)
    - If you are unsure or the question requires account-specific actions you cannot perform, recommend escalation
    - Keep responses concise but thorough

    {{ ctx.output_format }}
  "#
}
```

### 4. API Changes

#### 4.1 New: Public Chat Routes (Widget-facing)

**File**: `apps/api/src/routes/support-public.ts` (new)

These routes use `{ config: { public: true } }` with the existing `memberAuth` helper for member JWT verification.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/v1/public/support/conversations` | Member JWT | Create new conversation with initial message |
| `POST` | `/v1/public/support/conversations/:id/messages` | Member JWT | Send a message in existing conversation |
| `GET` | `/v1/public/support/conversations/:id/messages` | Member JWT | Fetch conversation messages (paginated) |
| `GET` | `/v1/public/support/conversations/:id/stream` | Member JWT | SSE endpoint for real-time AI response streaming |

**POST /v1/public/support/conversations** — Creates a conversation and triggers the orchestration pipeline:

```typescript
fastify.post(
  '/public/support/conversations',
  { config: { public: true } },
  async (request, reply) => {
    // 1. Verify member JWT (reuse memberAuth pattern from spin-wheel)
    const memberToken = await verifyMemberToken(request)
    if (!memberToken) return reply.code(401).send({ error: 'Authentication required' })

    // 2. Look up member
    const member = await fastify.prisma.member.findFirst({
      where: { email: memberToken.email, deletedAt: null, erased: false },
      include: { currentTier: true },
    })
    if (!member) return reply.code(404).send({ error: 'Member not found' })

    // 3. Parse and validate
    const body = CreateConversationSchema.parse(request.body)

    // 4. Create conversation + initial message in transaction
    const conversation = await fastify.prisma.$transaction(async (tx) => {
      const conv = await tx.conversation.create({
        data: { brandId: member.brandId, memberId: member.id, status: 'ACTIVE' },
      })
      await tx.message.create({
        data: { conversationId: conv.id, role: 'CUSTOMER', content: body.initialMessage },
      })
      return conv
    })

    // 5. Enqueue orchestration pipeline (async)
    await enqueueSupportOrchestration({
      conversationId: conversation.id,
      brandId: member.brandId,
      memberId: member.id,
      messageContent: body.initialMessage,
    })

    return reply.code(201).send({
      conversationId: conversation.id,
      status: 'ACTIVE',
      streamUrl: `/v1/public/support/conversations/${conversation.id}/stream`,
    })
  }
)
```

**GET /v1/public/support/conversations/:id/stream** — SSE endpoint:

```typescript
fastify.get(
  '/public/support/conversations/:id/stream',
  { config: { public: true } },
  async (request, reply) => {
    const memberToken = await verifyMemberToken(request)
    if (!memberToken) return reply.code(401).send({ error: 'Authentication required' })

    // Verify conversation belongs to this member
    const conversation = await fastify.prisma.conversation.findFirst({
      where: { id: request.params.id, member: { email: memberToken.email } },
    })
    if (!conversation) return reply.code(404).send({ error: 'Not found' })

    // Set SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })

    // Subscribe to Redis pub/sub channel for this conversation
    const channel = `support:conversation:${conversation.id}`
    const subscriber = fastify.redis.duplicate()
    await subscriber.subscribe(channel)

    subscriber.on('message', (_ch, data) => {
      reply.raw.write(`data: ${data}\n\n`)
    })

    // Cleanup on disconnect
    request.raw.on('close', () => {
      subscriber.unsubscribe(channel)
      subscriber.quit()
    })
  }
)
```

**Rate limiting**: Apply `fastify-rate-limit` to all `/public/support/*` routes:
- Conversation creation: 5 per minute per member
- Message send: 20 per minute per member

#### 4.2 New: Admin Support Routes

**File**: `apps/api/src/routes/support-admin.ts` (new)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/v1/support/conversations` | Admin JWT | List conversations (paginated, filterable by status) |
| `GET` | `/v1/support/conversations/:id` | Admin JWT | Get conversation detail with messages and Customer 360 |
| `POST` | `/v1/support/conversations/:id/messages` | Admin JWT | Send agent message |
| `PATCH` | `/v1/support/conversations/:id` | Admin JWT | Update status (escalate, resolve, close) |
| `GET` | `/v1/support/rules` | Admin JWT | List support rules |
| `POST` | `/v1/support/rules` | Admin JWT | Create support rule |
| `PUT` | `/v1/support/rules/:id` | Admin JWT | Update support rule |
| `DELETE` | `/v1/support/rules/:id` | Admin JWT | Delete support rule |

All routes follow existing Fastify patterns: auth plugin for JWT, multiTenant for brandId scoping, Zod validation, standard pagination envelope.

### 5. Orchestration Pipeline

**File**: `apps/api/src/queues/supportOrchestration.ts` (new)

The orchestration pipeline runs as a BullMQ job. It processes each customer message through a multi-step pipeline:

```
Message Received
    │
    ▼
┌─────────────────┐
│ ClassifyIntent   │ ← BAML function (Phase C)
│ (GPT-4o-mini)   │
└────────┬────────┘
         │ intent, confidence, urgency, topics
         ▼
┌─────────────────┐
│ Evaluate         │ ← SupportRule conditions
│ SupportRules     │   (priority order, first-match-wins)
└────────┬────────┘
         │ matched rules, actions
         ▼
┌─────────────────┐
│ Retrieve KB      │ ← Vector search (Phase C)
│ Articles (RAG)   │   Top 3 articles by intent + topic
└────────┬────────┘
         │ kb_context
         ▼
┌─────────────────┐
│ Fetch Customer   │ ← Customer 360 API (Phase A)
│ 360 Context      │   Tier, health score, recent activity
└────────┬────────┘
         │ customer_context
         ▼
┌─────────────────┐
│ GenerateSupport  │ ← BAML function (this RFC)
│ Response (GPT-4o)│   Uses all context above
└────────┬────────┘
         │ response, confidence, shouldEscalate
         ▼
┌─────────────────┐
│ Execute Actions  │ ← From matched SupportRules
│ & Store Response │
└─────────────────┘
```

```typescript
async function processSupportOrchestration(job: Job<SupportOrchestrationPayload>) {
  const { conversationId, brandId, memberId, messageContent } = job.data
  const publisher = redis.duplicate()

  try {
    // 1. Classify intent
    const intentResult = await classifyIntent(messageContent, conversationHistory)

    // Update conversation with intent
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { intent: intentResult.intent, confidence: intentResult.confidence, topic: intentResult.suggestedTopics[0] },
    })

    // 2. Evaluate support rules (priority order)
    const rules = await prisma.supportRule.findMany({
      where: { brandId, status: 'ACTIVE' },
      orderBy: { priority: 'asc' },
    })
    const matchedRules = evaluateSupportRules(rules, {
      intent: intentResult.intent,
      tier: member.currentTier?.name,
      healthScore: member.healthScore,
      topics: intentResult.suggestedTopics,
    })

    // 3. Retrieve KB articles (if KB exists)
    let kbContext = ''
    try {
      kbContext = await retrieveKBArticles(brandId, intentResult.intent, intentResult.suggestedTopics)
    } catch { /* graceful degradation */ }

    // 4. Fetch Customer 360 (if available)
    let customerContext = ''
    try {
      customerContext = await getCustomer360Summary(memberId)
    } catch { /* graceful degradation */ }

    // 5. Generate response
    const response = await generateSupportResponse({
      customer_message: messageContent,
      conversation_history: conversationHistory,
      intent: intentResult.intent,
      kb_context: kbContext,
      customer_context: customerContext,
      brand_name: brand.name,
      support_rules_context: matchedRules.autoResponseContent,
    })

    // 6. Store AI message
    await prisma.message.create({
      data: {
        conversationId,
        role: 'AI',
        content: response.response,
        metadata: {
          kbArticleIds: response.kbArticlesUsed,
          intentResult,
          confidence: response.confidence,
          rulesMatched: matchedRules.ruleIds,
        },
      },
    })

    // 7. Stream response to client via Redis pub/sub
    await publisher.publish(
      `support:conversation:${conversationId}`,
      JSON.stringify({ type: 'message', role: 'AI', content: response.response })
    )

    // 8. Execute rule actions
    for (const rule of matchedRules.rules) {
      if (rule.awardPoints && rule.awardPoints > 0) {
        await enqueueEvent({
          brandId, memberId, eventType: 'support_apology_points',
          payload: { conversationId, ruleId: rule.id, points: rule.awardPoints },
        })
      }
      if (rule.triggerSurveyId) {
        // Queue survey trigger for post-resolution
        await prisma.conversation.update({
          where: { id: conversationId },
          data: { /* store pending survey trigger */ },
        })
      }
    }

    // 9. Escalate if needed
    if (response.shouldEscalate || matchedRules.shouldEscalate) {
      const assignee = matchedRules.escalateToAssignee ?? 'support@brand.com'
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { status: 'ESCALATED', assignee, escalatedAt: new Date() },
      })
      // Create CaseFollowUp for human agent tracking
      // (reuses existing CaseFollowUp model pattern)
      await publisher.publish(
        `support:conversation:${conversationId}`,
        JSON.stringify({ type: 'status', status: 'ESCALATED', assignee })
      )
    }
  } finally {
    publisher.quit()
  }
}
```

#### 5.1 SupportRule Evaluation

**File**: `packages/shared/src/supportRules.ts` (new)

Extends the `evaluateConditions()` pattern from `packages/shared/src/conditions.ts`:

```typescript
export interface SupportRuleContext {
  intent: string
  tier?: string
  healthScore?: number
  topics: string[]
}

export function evaluateSupportRules(
  rules: SupportRule[],
  context: SupportRuleContext
): SupportRuleMatchResult {
  const matched: SupportRule[] = []

  for (const rule of rules) {  // pre-sorted by priority ASC
    // Intent filter
    if (rule.intentFilters.length > 0 && !rule.intentFilters.includes(context.intent)) continue
    // Tier filter
    if (rule.tierFilters.length > 0 && context.tier && !rule.tierFilters.includes(context.tier)) continue
    // Health score range
    if (rule.healthScoreMin !== null && context.healthScore !== undefined && context.healthScore < rule.healthScoreMin) continue
    if (rule.healthScoreMax !== null && context.healthScore !== undefined && context.healthScore > rule.healthScoreMax) continue
    // Topic filter
    if (rule.topicFilters.length > 0 && !rule.topicFilters.some(t => context.topics.some(ct => ct.toLowerCase().includes(t.toLowerCase())))) continue
    // Additional conditions (ConditionGroup)
    if (rule.conditions && !evaluateConditions(rule.conditions as ConditionGroup, context as Record<string, unknown>)) continue

    matched.push(rule)
  }

  return {
    rules: matched,
    ruleIds: matched.map(r => r.id),
    shouldEscalate: matched.some(r => r.escalateToAssignee != null),
    escalateToAssignee: matched.find(r => r.escalateToAssignee)?.escalateToAssignee ?? null,
    autoResponseContent: matched.find(r => r.autoRespondArticleId)?.autoRespondArticleId ?? null,
  }
}
```

#### 5.2 New Queue

**File**: `packages/shared/src/queues.ts` (modify)

```typescript
export const QUEUES = {
  // ...existing queues...
  SUPPORT_ORCHESTRATION: 'support-orchestration',
} as const
```

**Concurrency**: 5 (same as notifications queue — I/O bound, LLM calls dominate latency).

### 6. Embeddable Web Component

#### 6.1 Package Structure

Builds on existing `packages/embed/` package pattern (ceq-spin-wheel):

**File**: `packages/embed/src/ceq-support-chat.ts` (new)

```
packages/embed/src/
├── ceq-spin-wheel.ts      # existing
└── ceq-support-chat.ts    # NEW
```

**Build**: Add separate Vite entry for `ceq-support-chat.ts`. Output: `dist/ceq-support-chat.js` (~12 KB gzipped).

#### 6.2 Component Design

```typescript
/**
 * <ceq-support-chat> — Embeddable Web Component for CustomerEQ support chat.
 *
 * Usage:
 *   <ceq-support-chat brand-id="brand_abc" token="member-jwt" api-base="https://api.example.com"></ceq-support-chat>
 *
 * CSS Custom Properties (brand theming):
 *   --ceq-font-family: 'Inter', system-ui, sans-serif
 *   --ceq-primary-color: #4F46E5
 *   --ceq-background-color: #ffffff
 *   --ceq-chat-bubble-color: #4F46E5
 */

class CeqSupportChat extends HTMLElement {
  static observedAttributes = ['brand-id', 'token', 'api-base']

  private shadow: ShadowRoot
  private state: 'closed' | 'open' | 'loading' | 'error'
  private conversationId: string | null = null
  private messages: Array<{ role: string; content: string; timestamp: string }>
  private eventSource: EventSource | null = null

  connectedCallback() {
    this.shadow = this.attachShadow({ mode: 'open' })
    this.state = 'closed'
    this.messages = []
    this.render()  // renders chat bubble launcher
  }

  disconnectedCallback() {
    // Close SSE connection
    this.eventSource?.close()
  }

  // --- UI States ---
  // Closed: floating chat bubble (bottom-right)
  // Open: chat panel with message thread, input box, send button
  // Loading: typing indicator while AI processes
  // Error: error message with retry

  private async startConversation(message: string) {
    const res = await fetch(`${this.apiBase}/v1/public/support/conversations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ memberEmail: this.memberEmail, initialMessage: message }),
    })
    const data = await res.json()
    this.conversationId = data.conversationId
    this.connectSSE(data.streamUrl)
  }

  private connectSSE(streamUrl: string) {
    // Note: SSE with auth requires custom implementation since
    // EventSource doesn't support custom headers.
    // Use fetch + ReadableStream or a polyfill library.
    const url = `${this.apiBase}${streamUrl}?token=${this.token}`
    this.eventSource = new EventSource(url)
    this.eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'message') {
        this.messages.push({ role: data.role, content: data.content, timestamp: new Date().toISOString() })
        this.renderMessages()
      } else if (data.type === 'status') {
        this.handleStatusUpdate(data)
      }
    }
  }

  private async sendMessage(content: string) {
    this.messages.push({ role: 'CUSTOMER', content, timestamp: new Date().toISOString() })
    this.renderMessages()
    this.showTypingIndicator()

    await fetch(`${this.apiBase}/v1/public/support/conversations/${this.conversationId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content }),
    })
  }
}

customElements.define('ceq-support-chat', CeqSupportChat)
```

#### 6.3 SSE Authentication

Standard `EventSource` does not support custom headers. Two options:
- **Option A (chosen)**: Pass token as query parameter for SSE endpoint. The SSE route validates `?token=` parameter using the same `verifyMemberToken` logic. Acceptable because: (a) the token is a short-lived Clerk JWT, (b) the SSE endpoint is read-only, (c) the URL is not logged server-side.
- **Option B (alternative)**: Use `fetch()` with `ReadableStream` for manual SSE parsing. More secure but more complex. Defer to implementation if Option A raises security concerns.

#### 6.4 Custom DOM Events

The component fires custom events so host pages can react:

| Event | Payload | When |
|---|---|---|
| `ceq:chat-opened` | `{}` | Chat panel opened |
| `ceq:chat-closed` | `{}` | Chat panel closed |
| `ceq:message-sent` | `{ conversationId }` | Customer sent a message |
| `ceq:message-received` | `{ conversationId, role }` | AI or agent responded |
| `ceq:escalated` | `{ conversationId, assignee }` | Conversation escalated to human |
| `ceq:resolved` | `{ conversationId }` | Conversation resolved |

### 7. Frontend Changes (Admin UI)

#### 7.1 Support Rules Management Page

**File**: `apps/web/src/app/(admin)/admin/support/rules/page.tsx` (new)

Reuses `condition-builder.tsx` component for rule condition editing. Page structure:
1. List of support rules (table: name, status, priority, intent filters, actions, toggle)
2. Create/Edit dialog with:
   - Name, description, priority
   - Intent filters (multi-select dropdown)
   - Tier filters (multi-select dropdown)
   - Health score range (min/max inputs)
   - Topic filters (tag input)
   - Additional conditions (reuse `ConditionBuilder` component)
   - Actions section: auto-respond article picker, escalation assignee, points award, survey trigger
3. Drag-and-drop priority reordering (optional enhancement)

**Extends condition-builder.tsx**: Add `'contains'` operator to `STRING_OPS` to support topic matching:

```typescript
const STRING_OPS = [
  { value: 'eq', label: '=' },
  { value: 'ne', label: '!=' },
  { value: 'contains', label: 'contains' },  // NEW
]
```

Also add `'contains'` case to `evaluateConditions()` in `packages/shared/src/conditions.ts`:

```typescript
case 'contains': return typeof actual === 'string' && typeof cond.value === 'string' && actual.toLowerCase().includes(cond.value.toLowerCase())
```

#### 7.2 Conversations Dashboard

**File**: `apps/web/src/app/(admin)/admin/support/conversations/page.tsx` (new)

1. Conversation list with filters (status, intent, date range)
2. Conversation detail view: message thread + Customer 360 sidebar
3. Agent reply input (admin can send messages as AGENT role)
4. Status management buttons (Escalate, Resolve, Close)

#### 7.3 Navigation

Add "Support" section to admin sidebar with sub-items:
- Conversations
- Rules

### 8. Widget.js Delivery

**File**: `apps/api/src/routes/public.ts` (modify)

Add a new `widget.js` endpoint for the chat widget, following the existing survey widget pattern:

```typescript
// GET /v1/public/support/widget.js — embeddable chat widget loader
fastify.get(
  '/public/support/widget.js',
  { config: { public: true } },
  async (request, reply) => {
    const { brandId, token } = request.query as { brandId: string; token?: string }

    // Return self-bootstrapping JS that:
    // 1. Creates <ceq-support-chat> element
    // 2. Loads the Web Component from CDN
    // 3. Injects into DOM
    const widgetJs = generateChatWidgetJs(brandId, token, API_BASE_URL)
    return reply.status(200).type('application/javascript').send(widgetJs)
  }
)
```

Brand embed snippet:
```html
<script src="https://api.customerEQ.io/v1/public/support/widget.js?brandId=brand_abc&token=MEMBER_JWT"></script>
```

### 9. Implementation Order

| Step | Description | Files | Depends On |
|---|---|---|---|
| 1 | Schema migration: Conversation, Message, SupportRule models | `schema.prisma`, migration | Nothing |
| 2 | Zod schemas: support.schema.ts | `packages/shared/src/zod/support.schema.ts` | Nothing |
| 3 | SupportRule evaluation logic | `packages/shared/src/supportRules.ts` | Nothing |
| 4 | BAML function: GenerateSupportResponse | `packages/ai/baml_src/generate_support_response.baml` | Nothing |
| 5 | BullMQ queue: support-orchestration | `packages/shared/src/queues.ts`, `apps/api/src/queues/bullmq.ts` | Nothing |
| 6 | Public chat API routes | `apps/api/src/routes/support-public.ts` | Steps 1, 2, 5 |
| 7 | Admin support API routes | `apps/api/src/routes/support-admin.ts` | Steps 1, 2 |
| 8 | Orchestration pipeline processor | `apps/api/src/queues/supportOrchestration.ts` | Steps 1, 3, 4, 5 |
| 9 | Admin UI: support rules page | `apps/web/.../admin/support/rules/page.tsx` | Steps 2, 7 |
| 10 | Admin UI: conversations dashboard | `apps/web/.../admin/support/conversations/page.tsx` | Step 7 |
| 11 | `<ceq-support-chat>` web component | `packages/embed/src/ceq-support-chat.ts` | Step 6 |
| 12 | Widget.js loader endpoint | `apps/api/src/routes/public.ts` | Step 11 |

Steps 1-5 can be done in parallel. Steps 6-7 in parallel after Step 1. Steps 9-11 in parallel after their dependencies.

## Confidence Level

**70/100**

High confidence areas:
- Prisma models follow existing patterns exactly (Conversation/Message similar to Survey/SurveyResponse)
- SupportRule evaluation extends proven AlertRule + evaluateConditions() patterns
- Web Component follows ceq-spin-wheel pattern precisely
- BullMQ queue follows existing 6-queue infrastructure
- Admin UI reuses condition-builder.tsx component
- BAML function follows AnalyzeFeedback pattern

Medium confidence areas:
- **SSE with authentication** — EventSource does not support custom headers; the query-parameter token approach works but needs security review
- **LLM response latency** — GPT-4o may take 3-8 seconds per response; acceptable for chat but users need typing indicator UX
- **Redis pub/sub for SSE** — works for single-server; if API scales to multiple instances, need Redis pub/sub (already available via existing Redis connection)
- **Phase A-C dependencies** — Customer 360, KB RAG, Intent Classification do not exist yet; graceful degradation is designed but untested

Lower confidence:
- **Orchestration pipeline complexity** — 5-step pipeline with multiple external calls (LLM, KB, Customer 360) has many failure modes. Each step needs timeout + fallback.

## Validation Plan

| User Scenario | Expected Outcome | Validation Method |
|---|---|---|
| Member opens chat widget on brand site | Chat bubble renders, panel opens on click | E2E test (Playwright) |
| Member sends first message | Conversation created, 201 returned, SSE stream connected | API test (Supertest) |
| Message triggers orchestration pipeline | Intent classified, rules evaluated, response generated | Integration test |
| AI responds to billing question with KB article | Response references relevant KB content, stored as AI message | Integration test |
| SupportRule matches: intent=billing AND tier=Gold | Rule fires, apology points awarded, response sent | Integration test |
| SupportRule with escalation action | Conversation status set to ESCALATED, CaseFollowUp created | Integration test |
| Low-confidence AI response | shouldEscalate=true, conversation escalated | Integration test |
| Admin creates support rule via UI | Rule saved with all conditions and actions | E2E test (Playwright) |
| Admin views conversation in dashboard | Full thread displayed with Customer 360 sidebar | E2E test (Playwright) |
| Admin replies to conversation | AGENT message created, member sees it via SSE | API test |
| Member sends message to existing conversation | Message added, orchestration re-runs with history | API test |
| Unauthenticated widget request | 401 returned | API test |
| Rate limit exceeded (>5 conversations/min) | 429 returned | API test |
| Orchestration step fails (LLM timeout) | Graceful fallback: "Let me connect you with a human" + auto-escalate | Integration test |
| Phase A-C APIs unavailable | Pipeline continues with reduced context, response still generated | Integration test |

## Test Matrix

### Unit Tests

| Suite | What's Tested |
|---|---|
| `packages/shared/src/supportRules.test.ts` (new) | `evaluateSupportRules()` — intent matching, tier filtering, health score ranges, topic matching, priority ordering, empty filter = match all, combined conditions |
| `packages/shared/src/conditions.test.ts` (extend) | Add `contains` operator test cases |
| `packages/shared/src/zod/support.schema.test.ts` (new) | CreateConversationSchema, SendMessageSchema, CreateSupportRuleSchema, UpdateSupportRuleSchema — valid inputs, edge cases, refine validations |

### Integration Tests

| Suite | What's Tested |
|---|---|
| `apps/api/test/integration/support-conversations.test.ts` (new) | Conversation CRUD, message send/receive, SSE streaming, member auth, rate limiting, pagination |
| `apps/api/test/integration/support-rules.test.ts` (new) | SupportRule CRUD, admin auth, validation errors, brandId scoping |
| `apps/api/test/integration/support-orchestration.test.ts` (new) | Full pipeline: message -> intent -> rules -> KB -> Customer 360 -> LLM -> response. Mocks: LLM calls (BAML). Real: database, Redis pub/sub |

### E2E Tests (1 test)

| Suite | What's Tested |
|---|---|
| `apps/web/test/e2e/support-rules.spec.ts` (new) | Admin creates a support rule with intent filter + tier filter + points award action -> saves -> verifies rule appears in list -> toggles status to PAUSED |

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| LLM response latency (3-8s for GPT-4o) | High | Medium | Show typing indicator in widget. Use GPT-4o-mini for intent classification (fast), GPT-4o only for final response. Stream response tokens if BAML supports it. |
| SSE token in query parameter logged in access logs | Medium | Medium | Configure Fastify to exclude query params from access logs for SSE routes. Token is short-lived Clerk JWT. Alternative: switch to fetch+ReadableStream in implementation. |
| Orchestration pipeline partial failure | Medium | High | Each step has try/catch with fallback. If intent fails: set "unknown". If KB fails: skip. If Customer 360 fails: skip. If LLM fails: send canned "connecting you with a human" message + auto-escalate. |
| Redis pub/sub message lost (client disconnected during publish) | Low | Medium | Client reconnects SSE and fetches message history via GET endpoint. Messages are persisted to DB before pub/sub publish. |
| Phase A-C not implemented when Phase D starts | High | Medium | Graceful degradation designed for each dependency. Feature works without Customer 360, health scores, KB, or intent classification — just with reduced quality. |
| High concurrent conversations exhaust BullMQ | Low | Medium | Support orchestration queue concurrency set to 5. LLM calls are the bottleneck, not BullMQ. If needed, increase or add dedicated worker. |
| Chat widget increases page load time | Low | Low | Widget JS is ~12KB gzipped, loaded async. Shadow DOM prevents style conflicts. Lazy-loads chat panel only on bubble click. |
| Support rules create infinite loops (rule awards points -> triggers event -> rule fires again) | Low | High | Support orchestration does NOT re-evaluate rules on its own side effects. Points awarded via `enqueueEvent` go through loyalty pipeline, not support pipeline. Different queue, different trigger. |

## Spike Findings

No spike was required. All technologies are either already proven in the codebase or are well-documented:
- **SSE**: Fastify supports raw response writing (`reply.raw`). Pattern documented in Fastify docs.
- **Redis pub/sub**: Already using Redis 7 via IORedis for BullMQ. `redis.duplicate()` for subscriber is standard IORedis pattern.
- **Web Components**: `<ceq-spin-wheel>` proves the full pattern (Shadow DOM, custom events, CSS properties, Vite IIFE build).
- **BAML functions**: `AnalyzeFeedback`, `DiscoverClusters`, `DetectAnomalies` establish the complete BAML pattern.
- **Condition evaluation**: `evaluateConditions()` and `AlertRule` evaluation logic are proven in production.

## Observability

### Logs (Pino structured JSON)

| Event | Level | Fields | When |
|---|---|---|---|
| `support.conversation.created` | info | `conversationId, brandId, memberId` | New conversation |
| `support.message.received` | info | `conversationId, role, messageLength` | Any message |
| `support.intent.classified` | info | `conversationId, intent, confidence, latencyMs` | After ClassifyIntent |
| `support.rules.evaluated` | info | `conversationId, rulesMatched, ruleIds` | After rule evaluation |
| `support.response.generated` | info | `conversationId, confidence, shouldEscalate, latencyMs` | After LLM response |
| `support.conversation.escalated` | warn | `conversationId, assignee, reason` | Escalation |
| `support.orchestration.error` | error | `conversationId, step, err` | Pipeline step failure |
| `support.orchestration.fallback` | warn | `conversationId, step, fallbackUsed` | Graceful degradation |

### Metrics (future — not in MVP)

- Conversation volume per brand (daily)
- Average response latency (intent + LLM combined)
- Escalation rate (% of conversations escalated)
- Resolution rate and time-to-resolution
- SupportRule match rate (% of conversations matching at least one rule)
- LLM confidence distribution

### Alerts

- Orchestration error rate > 10% in 5-minute window
- LLM response latency P95 > 15 seconds
- SSE connection failures > 20% (Redis pub/sub health)

## Architecture Analysis

### Patterns Correctly Followed

1. **Multi-tenant scoping** — `brandId` on Conversation, Message, SupportRule. Scoped via JWT, never from request body.
2. **Event-driven processing** — Orchestration runs via BullMQ queue, not synchronously in the API route. API returns 201 immediately.
3. **Prisma transactional writes** — Conversation + initial Message created atomically in `$transaction()`.
4. **Zod validation** — All request schemas defined in `packages/shared/src/zod/`, shared between API and frontend.
5. **Shared evaluation logic** — `evaluateSupportRules()` in `packages/shared/` follows `evaluateConditions()` pattern.
6. **Web Component pattern** — Shadow DOM, CSS custom properties, custom DOM events, Vite IIFE build in `packages/embed/`.
7. **Public route auth** — `{ config: { public: true } }` with `memberAuth` helper, same as spin-wheel play endpoint.
8. **Test infrastructure** — All test factories/mocks in `packages/config/src/test-utils/`. New factories: `createConversation()`, `createMessage()`, `createSupportRule()`.

### Patterns That Need Architecture Doc Updates

**1. SSE / Real-Time Messaging**
- **What**: The architecture doc does not mention SSE or real-time push. All current data flows are request-response.
- **Why**: Support chat requires server-push for AI responses. SSE via Redis pub/sub is the chosen approach.
- **Suggested resolution**: Add a "5.4 Real-Time Messaging (SSE)" data flow section to architecture doc describing the Redis pub/sub -> SSE pattern.

**2. Support Orchestration Queue**
- **What**: Adds a 7th BullMQ queue (`support-orchestration`) to the existing 6.
- **Why**: Multi-step LLM pipeline needs async processing with timeout/fallback per step.
- **Suggested resolution**: Update Section 4.3 (BullMQ Workers) table with the new queue.

**3. `contains` Operator in Condition Evaluation**
- **What**: Adds `contains` string operator to `evaluateConditions()`.
- **Why**: Topic matching requires substring/contains logic, not just equality.
- **Suggested resolution**: Update `packages/shared/src/conditions.ts` and note in architecture doc Section 3.5 that condition evaluation supports contains.

### Patterns Incorrectly Followed
None identified. The design follows all existing architectural patterns correctly.

---

## Design Standards

Admin UI follows the generic UI baseline: indigo/violet color scheme, Inter font, Tailwind v4, shadcn/ui-style components. Support rules page reuses `condition-builder.tsx`. Conversation dashboard follows the existing admin table + detail-panel pattern.

The `<ceq-support-chat>` widget uses a neutral default theme (white background, indigo accents) with CSS custom properties for brand customization. Shadow DOM ensures complete style isolation from host pages.
