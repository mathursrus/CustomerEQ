# Technical Design: Knowledge Base with RAG and Intent Classification

Issue: #100
Owner: Claude (technical-design job)
Spec: `docs/feature-specs/100-knowledge-base-rag-intent-classification.md`

## Customer

CX program managers and support team leads at mid-market companies ($10M-$500M revenue) who need their AI support systems to give accurate, context-aware answers grounded in brand-specific knowledge rather than generic LLM outputs.

## Customer Problem Being Solved

Today the system can analyze feedback sentiment and topics (`AnalyzeFeedback` BAML) and route alerts to humans, but it has no structured knowledge base for the AI to reference and no way to understand customer intent. This means AI responses are ungrounded (hallucination risk), human agents must manually look up policies, and there is no semantic search or intent-based routing. This feature provides the two foundational capabilities the Phase D support widget needs: knowing *what to say* (KB + RAG) and understanding *what the customer wants* (intent classification).

## User Experience That Will Solve the Problem

### Admin Flow (KB Management)
1. Navigate to `/admin/kb` -- see table of KB articles (title, category, tags, status, last updated)
2. Click "Create Article" -- fill title, select category (dropdown), add tags (chip input), write body (Markdown editor)
3. Toggle status to "Published" -- save triggers async embedding generation
4. See "Embedding generated" indicator once BullMQ job completes
5. Use search bar to find articles by text
6. Edit/delete (soft delete) articles as needed

### API Flow (Semantic Search)
1. Call `GET /v1/kb/search?q=how do I get a refund&limit=5` with JWT
2. Query is embedded via OpenAI `text-embedding-3-small`
3. pgvector cosine similarity ranks published, non-deleted articles
4. Response: array of `{ id, title, category, score, snippet }` sorted by relevance

### API Flow (Intent Classification)
1. Call `POST /v1/classify-intent` with `{ "text": "I was charged twice for my last order" }`
2. System fetches published KB article summaries for the brand
3. `ClassifyIntent` BAML function (GPT-4o-mini) classifies the message
4. Response: `{ intent: "billing", confidence: 0.92, urgency: "high", suggestedArticleIds: [...], responseOutline: "...", reasoning: "..." }`

### MCP Flow
1. LLM agents call `search_kb`, `create_kb_article`, or `classify_intent` tools
2. Tools proxy to the corresponding API endpoints and return structured results

## Technical Details

### 1. Schema Changes

#### 1.1 pgvector Extension

A pre-migration SQL step is required before the Prisma migration:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

This must be added as a raw SQL migration step (`prisma/migrations/<timestamp>_add_pgvector/migration.sql`). The Azure PostgreSQL Flexible Server supports pgvector natively.

**File**: `packages/database/prisma/migrations/<timestamp>_add_pgvector/migration.sql`

#### 1.2 New Prisma Enums and Model

**File**: `packages/database/prisma/schema.prisma`

```prisma
// New enums
enum KBArticleCategory {
  FAQ
  POLICY
  TROUBLESHOOTING
  PRODUCT_GUIDE
  PROCESS
  OTHER
}

enum KBArticleStatus {
  DRAFT
  PUBLISHED
}

// New model
model KBArticle {
  id          String            @id @default(cuid())
  brandId     String
  title       String
  body        String            // Markdown content
  category    KBArticleCategory @default(FAQ)
  tags        String[]
  status      KBArticleStatus   @default(DRAFT)
  embedding   Unsupported("vector(1536)")? // pgvector -- nullable until generated
  deletedAt   DateTime?         // soft delete (GDPR/CCPA, project rule #13)
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt

  @@index([brandId, status])
  @@index([brandId, category])
  @@map("kb_articles")
}
```

**Migration notes:**
- `Unsupported("vector(1536)")` is Prisma's escape hatch for pgvector. The column type is `vector(1536)` in PostgreSQL.
- The embedding column is nullable: articles are saved immediately, embeddings generated async.
- No relation to `Brand` model needed -- `brandId` is enforced via Prisma middleware (consistent with `EarningRule`, `LoyaltyEvent`, `Tier` patterns).
- The Brand model needs a `kbArticles KBArticle[]` relation added if we want Prisma relation support, but following the pattern of `EarningRule` and `LoyaltyEvent` which do NOT have Brand relations, we will skip it. The `brandId` string field + index is sufficient.

#### 1.3 Vector Index (Post-Migration, Manual)

After initial data load (>100 articles per brand), create an IVFFlat index:

```sql
CREATE INDEX kb_articles_embedding_idx
  ON kb_articles USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

For the MVP with <1,000 articles total, the default sequential scan is fast enough (<50ms). The IVFFlat index should be added when any single brand exceeds ~1,000 articles. This can be done via a manual migration at that time.

**Alternative considered**: HNSW index (`vector_cosine_ops`). HNSW has better recall but higher memory usage and slower inserts. IVFFlat is the right choice at MVP scale.

### 2. Zod Schema Changes

**File**: `packages/shared/src/zod/kb.schema.ts` (new file)

```typescript
import { z } from 'zod'

export const KB_CATEGORIES = [
  'FAQ', 'POLICY', 'TROUBLESHOOTING', 'PRODUCT_GUIDE', 'PROCESS', 'OTHER',
] as const

export const KB_STATUSES = ['DRAFT', 'PUBLISHED'] as const

export const CreateKBArticleSchema = z.object({
  title: z.string().min(1).max(500),
  body: z.string().min(1).max(100_000), // ~50 pages of Markdown
  category: z.enum(KB_CATEGORIES).default('FAQ'),
  tags: z.array(z.string().min(1).max(50)).max(20).default([]),
  status: z.enum(KB_STATUSES).default('DRAFT'),
})

export const UpdateKBArticleSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  body: z.string().min(1).max(100_000).optional(),
  category: z.enum(KB_CATEGORIES).optional(),
  tags: z.array(z.string().min(1).max(50)).max(20).optional(),
  status: z.enum(KB_STATUSES).optional(),
})

export const KBSearchQuerySchema = z.object({
  q: z.string().min(1).max(2000), // ~8000 tokens max for embedding
  limit: z.coerce.number().int().min(1).max(20).default(5),
})

export const ClassifyIntentSchema = z.object({
  text: z.string().min(1).max(10_000),
})

export type CreateKBArticle = z.infer<typeof CreateKBArticleSchema>
export type UpdateKBArticle = z.infer<typeof UpdateKBArticleSchema>
export type KBSearchQuery = z.infer<typeof KBSearchQuerySchema>
export type ClassifyIntentInput = z.infer<typeof ClassifyIntentSchema>
```

**File**: `packages/shared/src/zod/kb.schema.test.ts` (new file)

Tests for: valid/invalid article creation, body length limits, tag limits, search query validation, intent text validation.

### 3. Queue Changes

#### 3.1 New Queue: Embedding Generation

**File**: `packages/shared/src/queues.ts` (modified)

```typescript
export const QUEUES = {
  // ...existing queues...
  EMBEDDING_GENERATION: 'embedding-generation',
} as const
```

**File**: `packages/shared/src/types/` (new payload type)

```typescript
export interface EmbeddingGenerationPayload {
  articleId: string
  brandId: string
  text: string // concatenation of title + body for embedding
}
```

#### 3.2 Queue Integration in API

**File**: `apps/api/src/queues/bullmq.ts` (modified)

Add `_embeddingGenerationQueue` following the exact pattern of existing queues:
- `initQueues()`: initialize the queue
- `getEmbeddingGenerationQueue()`: getter with null check
- `enqueueEmbeddingGeneration()`: public enqueue function with inline mode support
- Inline mode calls the embedding logic directly (no Redis needed for dev/test)

The inline processor logic:
1. Call OpenAI `text-embedding-3-small` API with the article text
2. Store the resulting 1536-dimensional vector on the `KBArticle` record via raw SQL (`UPDATE kb_articles SET embedding = $1::vector WHERE id = $2`)
3. Log success/failure

#### 3.3 Worker Processor

**File**: `apps/worker/src/processors/embeddingGeneration.ts` (new file)

Follows the pattern of `sentimentAnalysis.ts`:
- Receives `EmbeddingGenerationPayload` from BullMQ job
- Calls the embedding function from `@customerEQ/ai`
- Updates the article record with raw SQL (Prisma cannot write `Unsupported` types)
- Logs with Pino structured logging

**File**: `apps/worker/src/processors/embeddingGeneration.test.ts` (new file)

### 4. AI Layer Changes

#### 4.1 OpenAI Embeddings Service

**File**: `packages/ai/src/analysis/embeddings.ts` (new file)

```typescript
import OpenAI from 'openai'

const EMBEDDING_MODEL = 'text-embedding-3-small'
const EMBEDDING_DIMENSIONS = 1536

export async function generateEmbedding(text: string): Promise<number[]> {
  const client = new OpenAI() // uses OPENAI_API_KEY env var
  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
    dimensions: EMBEDDING_DIMENSIONS,
  })
  return response.data[0].embedding
}
```

**Note**: The `openai` npm package is already a dependency via BAML's OpenAI provider. We use it directly for the embeddings API (BAML does not support embeddings -- it only wraps chat completions).

**File**: `packages/ai/src/analysis/embeddings.test.ts` (new file)

Unit test with mocked OpenAI client.

#### 4.2 ClassifyIntent BAML Function

**File**: `packages/ai/baml_src/classify_intent.baml` (new file)

```baml
class IntentClassification {
  primary_intent string @description("One of: billing, shipping, product_question, complaint, feature_request, praise, general_inquiry, account_management, returns_refunds")
  confidence float @description("Confidence score 0.0 to 1.0")
  urgency string @description("One of: low, medium, high, critical")
  suggested_article_ids string[] @description("Up to 3 KB article IDs most relevant to this intent")
  response_outline string @description("Brief outline of how to respond to this message")
  reasoning string @description("Brief explanation of why this intent was chosen")
}

class KBArticleSummary {
  id string
  title string
  category string
}

function ClassifyIntent(
  message: string @description("The customer's message to classify"),
  kb_articles: KBArticleSummary[] @description("Available KB articles for this brand")
) -> IntentClassification {
  client GPT4oMini
  prompt #"
    You are a customer support intent classifier for a loyalty and CX platform.
    Analyze the customer message and determine their intent.

    Customer message:
    ---
    {{ message }}
    ---

    {% if kb_articles %}
    Available knowledge base articles:
    {% for article in kb_articles %}
    - ID: {{ article.id }} | Title: {{ article.title }} | Category: {{ article.category }}
    {% endfor %}

    Select up to 3 most relevant article IDs for suggested_article_ids.
    {% else %}
    No knowledge base articles available. Leave suggested_article_ids empty.
    {% endif %}

    Classify the intent, assess urgency, and suggest a response approach.

    {{ ctx.output_format }}
  "#
}
```

**Design rationale**:
- Uses `GPT4oMini` client (same as `AnalyzeFeedback`) for cost efficiency (~$0.15/1M input tokens)
- `max_tokens: 1024` is sufficient for the structured response
- Passes KB article summaries (not full bodies) to keep context window small
- Jinja template follows the exact pattern of `analyze_feedback.baml`

#### 4.3 ClassifyIntent TypeScript Wrapper

**File**: `packages/ai/src/analysis/classify-intent.ts` (new file)

```typescript
import { b } from '../generated/index.js'
import type { IntentClassification, KBArticleSummary } from '../generated/index.js'

export async function classifyIntent(
  message: string,
  kbArticles: KBArticleSummary[],
): Promise<IntentClassification> {
  return b.ClassifyIntent(message, kbArticles)
}
```

**File**: `packages/ai/src/index.ts` (modified -- add exports)

```typescript
export { generateEmbedding } from './analysis/embeddings.js'
export { classifyIntent } from './analysis/classify-intent.js'
```

#### 4.4 BAML Eval Tests

**File**: `packages/ai/src/evals/classify-intent.eval.ts` (new file)

Following the pattern of existing BAML eval tests, test intent classification accuracy across 10+ sample messages:

| Message | Expected Intent | Expected Urgency |
|---------|----------------|-----------------|
| "I was charged twice for my last order" | billing | high |
| "Where is my package? It's been 2 weeks" | shipping | high |
| "How do I change my password?" | account_management | low |
| "Your product is absolutely terrible" | complaint | high |
| "I love your rewards program!" | praise | low |
| "Can you add dark mode?" | feature_request | low |
| "How do I return an item?" | returns_refunds | medium |
| "What are your shipping rates?" | product_question | low |
| "I need help with something" | general_inquiry | low |
| "My account was hacked and someone spent my points" | account_management | critical |

Each test asserts:
- `primary_intent` matches expected intent
- `confidence` is > 0.5
- `urgency` is in the valid enum set
- `suggested_article_ids` is an array (may be empty if no KB articles provided)

These tests require `OPENAI_API_KEY` and must fail loudly if it is missing (project rule #11a).

### 5. API Changes

#### 5.1 KB Article CRUD Routes

**File**: `apps/api/src/routes/kb.ts` (new file)

Follows the pattern of `surveys.ts`:

```typescript
import type { FastifyPluginAsync } from 'fastify'
import { CreateKBArticleSchema, UpdateKBArticleSchema, KBSearchQuerySchema } from '@customerEQ/shared'
import { generateEmbedding } from '@customerEQ/ai'
import { enqueueEmbeddingGeneration } from '../queues/bullmq.js'

const kbRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /v1/kb/articles -- create
  // GET /v1/kb/articles -- list (paginated, filterable by category/status/tags)
  // GET /v1/kb/articles/:id -- get single
  // PUT /v1/kb/articles/:id -- update
  // DELETE /v1/kb/articles/:id -- soft delete
  // GET /v1/kb/search -- semantic search
}
```

**Route details:**

| Method | Path | Zod Schema | Key Logic |
|--------|------|-----------|-----------|
| POST | `/v1/kb/articles` | `CreateKBArticleSchema` | Create article with `brandId` from JWT. Enqueue embedding generation job. Return 201. |
| GET | `/v1/kb/articles` | Query params: `page`, `pageSize`, `category`, `status` | List articles where `brandId = request.brandId AND deletedAt IS NULL`. Paginated, ordered by `updatedAt desc`. |
| GET | `/v1/kb/articles/:id` | Path param: `id` | Find by `id + brandId + deletedAt IS NULL`. Return 404 if not found. |
| PUT | `/v1/kb/articles/:id` | `UpdateKBArticleSchema` | Update article. If `title` or `body` changed, re-enqueue embedding generation. Return 200. |
| DELETE | `/v1/kb/articles/:id` | Path param: `id` | Set `deletedAt = now()`. Return 204. Do NOT hard delete (GDPR/CCPA rule). |
| GET | `/v1/kb/search` | `KBSearchQuerySchema` | Embed query via OpenAI, then raw SQL cosine similarity. Filter: `brandId`, `status = PUBLISHED`, `deletedAt IS NULL`, `embedding IS NOT NULL`. Return top-K. |

**Semantic search raw SQL:**

```sql
SELECT id, title, category, body,
       1 - (embedding <=> $1::vector) AS score
FROM kb_articles
WHERE brand_id = $2
  AND status = 'PUBLISHED'
  AND deleted_at IS NULL
  AND embedding IS NOT NULL
ORDER BY embedding <=> $1::vector
LIMIT $3
```

The `<=>` operator is pgvector's cosine distance. `1 - distance = similarity score` (0 to 1).

**Snippet generation**: Return first 200 characters of body as `snippet` in search results.

**File**: `apps/api/src/routes/kb.test.ts` (new file)

#### 5.2 Intent Classification Route

**File**: `apps/api/src/routes/intent.ts` (new file)

```typescript
import type { FastifyPluginAsync } from 'fastify'
import { ClassifyIntentSchema } from '@customerEQ/shared'
import { classifyIntent } from '@customerEQ/ai'

const intentRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /v1/classify-intent
  fastify.post('/classify-intent', async (request, reply) => {
    const parse = ClassifyIntentSchema.safeParse(request.body)
    if (!parse.success) {
      return reply.status(422).send({
        error: 'Validation failed',
        message: parse.error.errors.map(e => e.message).join(', '),
      })
    }

    const brandId = request.brandId

    // Fetch published KB article summaries for this brand
    const articles = await fastify.prisma.kBArticle.findMany({
      where: { brandId, status: 'PUBLISHED', deletedAt: null },
      select: { id: true, title: true, category: true },
    })

    const kbSummaries = articles.map(a => ({
      id: a.id,
      title: a.title,
      category: a.category,
    }))

    const result = await classifyIntent(parse.data.text, kbSummaries)

    // Filter suggested article IDs to only include valid, existing articles
    const validIds = new Set(articles.map(a => a.id))
    result.suggested_article_ids = result.suggested_article_ids.filter(
      id => validIds.has(id)
    )

    return reply.status(200).send(result)
  })
}
```

**Key design decision**: The intent route fetches KB article summaries (id, title, category) and passes them to the BAML function. This means the LLM sees article metadata but not full bodies, keeping the prompt small. The LLM selects relevant article IDs based on titles/categories. We then filter the returned IDs against actual DB records to prevent hallucinated IDs from reaching the client.

**File**: `apps/api/src/routes/intent.test.ts` (new file)

#### 5.3 Route Registration

**File**: `apps/api/src/app.ts` (modified)

Add route registration following existing pattern:

```typescript
import kbRoutes from './routes/kb.js'
import intentRoutes from './routes/intent.js'

// In the route registration section:
app.register(kbRoutes, { prefix: '/v1' })
app.register(intentRoutes, { prefix: '/v1' })
```

#### 5.4 Audit Events

All KB mutations (create, update, delete) must create `AuditEvent` records following the existing pattern:

```typescript
await fastify.prisma.auditEvent.create({
  data: {
    brandId,
    actorId: request.auth.userId, // from Clerk JWT
    action: 'kb_article.create', // or .update, .delete
    resourceType: 'KBArticle',
    resourceId: article.id,
    metadata: { title: article.title, category: article.category },
  },
})
```

Actions: `kb_article.create`, `kb_article.update`, `kb_article.delete`

### 6. MCP Tool Changes

**File**: `apps/mcp-server/src/tools/kb.ts` (new file)

Following the pattern of `campaigns.ts` and `analytics.ts`:

```typescript
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { apiFetch } from '../api-client.js'

export function registerKBTools(server: McpServer) {
  // search_kb
  server.tool(
    'search_kb',
    'Search knowledge base articles by natural language query. Returns ranked results by semantic relevance.',
    z.object({
      query: z.string().describe('Natural language search query'),
      limit: z.number().optional().default(5).describe('Max results (default 5)'),
    }).shape,
    async ({ query, limit }) => {
      const res = await apiFetch('/v1/kb/search', {
        params: { q: query, limit: String(limit ?? 5) },
      })
      if (!res.ok) return { content: [{ type: 'text' as const, text: `Error: ${res.error}` }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify(res.data, null, 2) }] }
    },
  )

  // create_kb_article
  server.tool(
    'create_kb_article',
    'Create a new knowledge base article. Embedding is generated automatically.',
    z.object({
      title: z.string().describe('Article title'),
      body: z.string().describe('Article body in Markdown'),
      category: z.enum(['FAQ', 'POLICY', 'TROUBLESHOOTING', 'PRODUCT_GUIDE', 'PROCESS', 'OTHER'])
        .default('FAQ').describe('Article category'),
      tags: z.array(z.string()).default([]).describe('Tags for the article'),
    }).shape,
    async (params) => {
      const res = await apiFetch('/v1/kb/articles', { method: 'POST', body: params })
      if (!res.ok) return { content: [{ type: 'text' as const, text: `Error: ${res.error}` }] }
      return { content: [{ type: 'text' as const, text: `Article created: ${JSON.stringify(res.data, null, 2)}` }] }
    },
  )

  // classify_intent
  server.tool(
    'classify_intent',
    'Classify a customer message into an intent category with confidence score, urgency, and suggested KB articles.',
    z.object({
      message: z.string().describe('Customer message to classify'),
    }).shape,
    async ({ message }) => {
      const res = await apiFetch('/v1/classify-intent', {
        method: 'POST',
        body: { text: message },
      })
      if (!res.ok) return { content: [{ type: 'text' as const, text: `Error: ${res.error}` }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify(res.data, null, 2) }] }
    },
  )
}
```

**File**: `apps/mcp-server/src/index.ts` (modified -- register KB tools)

### 7. Error Handling

| Scenario | Component | Behavior |
|----------|-----------|----------|
| OpenAI API key missing | Embedding worker | Job fails with clear error. Article remains saved without embedding. Admin sees null embedding status. Embedding can be retried when key is configured. |
| OpenAI API rate limit | Embedding worker | BullMQ automatic retry with exponential backoff (3 attempts, 1s/2s/4s delays). After exhaustion, job moves to failed state. |
| OpenAI API timeout | Embedding worker | 30-second timeout on HTTP call. BullMQ retries on failure. |
| Empty search results | Search endpoint | Return `{ data: [], total: 0 }` with 200 status. Not an error. |
| Search query > 2000 chars | Search endpoint | Zod validation returns 422 with "Query too long" message. |
| Intent classification with no KB | Intent endpoint | BAML function receives empty `kb_articles` array. Returns classification without suggestions (`suggested_article_ids: []`). |
| Classify intent with LLM failure | Intent endpoint | Return 502 with `{ error: "Intent classification failed" }`. Log the LLM error. |
| Soft-deleted article in suggestions | Intent endpoint | Post-filter `suggested_article_ids` against valid article set. Hallucinated or deleted IDs are silently removed. |
| pgvector extension missing | Migration | Migration SQL fails with clear error: `CREATE EXTENSION IF NOT EXISTS vector` requires the extension to be available on the PostgreSQL server. |
| Article body empty after update | Update endpoint | Zod validates `body.min(1)`. Returns 422. |

### 8. Multi-Tenant Scoping (Project Rule #6)

All KB and intent endpoints enforce `brandId` from the verified JWT (project rule #6: "Never accept brandId from a request body"):

1. **Prisma middleware**: Existing middleware already appends `brandId` to all queries for tenant-scoped models. `KBArticle` has `brandId` so it is automatically scoped.
2. **Route-level**: Every route uses `request.brandId` (injected by the multiTenant plugin from the JWT).
3. **Raw SQL queries**: The semantic search raw SQL includes `WHERE brand_id = $2` to enforce scoping even outside Prisma's middleware.
4. **Cross-tenant isolation test**: Verify that creating articles under brand A and searching from brand B context returns zero results. Return 404 (not 403) for cross-tenant access attempts, following existing patterns.

## Architecture Analysis

### Patterns Correctly Followed

1. **Multi-Tenant Isolation** (Architecture Section 6): `brandId` from JWT, Prisma middleware scoping, multiTenant plugin rejection of `brandId` in request bodies. Raw SQL queries also include `brandId` filter for defense in depth.
2. **Fastify Plugin Route Pattern** (Architecture Section 3.2): New routes follow `FastifyPluginAsync` pattern, registered in `app.ts` with `/v1` prefix.
3. **Zod Validation in Shared Package** (Architecture Section 3.5): All request schemas defined in `packages/shared/src/zod/kb.schema.ts`, shared between API and MCP.
4. **BullMQ Queue Pattern** (Architecture Section 3.3, 4.3): New `EMBEDDING_GENERATION` queue follows existing pattern with queue constant in `packages/shared`, enqueue function in `apps/api/src/queues/bullmq.ts`, and inline mode support.
5. **Audit Logging** (Architecture Section 4.2): KB mutations create `AuditEvent` records following the existing audit plugin pattern.
6. **GDPR/CCPA Soft Deletes** (Architecture Section 10): `KBArticle.deletedAt` field, all queries filter `deletedAt IS NULL`.
7. **Pino Structured Logging** (Architecture Section 2): All components use Pino with structured log fields.
8. **Centralized Test Infrastructure** (Architecture Section 9.2): Tests import from `@customerEQ/config/test-utils`, no inline mocks.
9. **BAML Function Pattern** (existing in `packages/ai/baml_src/`): `ClassifyIntent` follows `AnalyzeFeedback` pattern with `GPT4oMini` client, typed output class, Jinja template.
10. **MCP Tool Pattern** (existing in `apps/mcp-server/src/tools/`): Tools use `apiFetch` proxy, `z.object().shape` schema, `McpServer.tool()` registration.
11. **Append-Only Ledger Integrity** (Architecture Section 6): This feature does not touch loyalty events or points, so no risk to ledger integrity.

### Patterns Missing from Architecture

These patterns are used in this design but are not yet documented in the architecture document (`docs/architecture/architecture.md`). They should be added during the address-feedback phase after PR review.

1. **pgvector Extension for Vector Search**
   - **What**: PostgreSQL pgvector extension enabling `vector(1536)` column type and cosine similarity operators (`<=>`) for semantic search.
   - **Why needed**: The architecture doc lists "PostgreSQL 16" as the database but does not mention pgvector or vector search capabilities. This is a new database-level capability.
   - **Suggested resolution**: Add to Section 2 (Tech Stack) as a new row: `pgvector | PostgreSQL extension for vector similarity search | Semantic search for KB articles; cosine distance operator; IVFFlat indexing at scale`. Add to Section 3.4 (Data Layer) noting that raw SQL is required for vector operations (Prisma uses `Unsupported` type).

2. **AI Layer (packages/ai) Not in Architecture Layers**
   - **What**: The `packages/ai` package is a full architectural layer containing BAML functions, OpenAI integrations, clustering, anomaly detection, and now embeddings + intent classification.
   - **Why needed**: Architecture Section 3 lists 7 layers but omits `packages/ai`. This package has grown to be a significant layer with its own BAML compilation, generated TypeScript clients, and multiple analysis modules.
   - **Suggested resolution**: Add Section 3.8 "AI Layer (packages/ai)" documenting: BAML function definitions, OpenAI API integrations (chat completions via BAML, embeddings via direct SDK), generated client code, analysis modules (sentiment, clustering, anomaly, embeddings, intent classification).

3. **MCP Server (apps/mcp-server) Not in Architecture Layers**
   - **What**: The `apps/mcp-server` application provides MCP (Model Context Protocol) tools for LLM agent integration.
   - **Why needed**: Architecture Section 3 and the component diagram (Section 4) do not include the MCP server. It is a distinct application that proxies to the API layer.
   - **Suggested resolution**: Add Section 3.9 "MCP Server (apps/mcp-server)" documenting: tool registration, `apiFetch` proxy pattern, Zod schema validation, and its role as an LLM-to-API bridge.

4. **Worker Queue Count Mismatch**
   - **What**: Architecture Section 4.3 documents 3 BullMQ workers (loyalty-events, campaign-triggers, notifications), but the codebase has 6 queues (adding sentiment-analysis, feedback-clustering, alert-evaluation) and this RFC adds a 7th (embedding-generation).
   - **Why needed**: The architecture doc is out of date. New processors added in issues #35-#41 and this issue are not reflected.
   - **Suggested resolution**: Update Section 4.3 to include all 7 workers with their concurrency settings.

5. **OpenAI Embeddings API as External Dependency**
   - **What**: Direct usage of OpenAI `text-embedding-3-small` API for vector embeddings, separate from the BAML-mediated chat completions.
   - **Why needed**: Architecture Section 2 does not list OpenAI as an external dependency. The `OPENAI_API_KEY` env var is not in Section 7.2.
   - **Suggested resolution**: Add OpenAI to external dependencies. Add `OPENAI_API_KEY` to Section 7.2 environment variables table.

6. **KBArticle Model Not in Section 4.4**
   - **What**: New `KBArticle` model with pgvector embedding column.
   - **Why needed**: Section 4.4 lists database models but will not include `KBArticle` until architecture is updated.
   - **Suggested resolution**: Add `KBArticle` entry to Section 4.4 after implementation.

### Patterns Incorrectly Followed

None identified. All architectural patterns are correctly applied in this design.

## Confidence Level

**85/100**

High confidence because:
- All technology choices are proven in the codebase (Prisma, Fastify, BullMQ, BAML, OpenAI)
- pgvector is well-documented and supported on Azure PostgreSQL
- The `text-embedding-3-small` model is a mature OpenAI API
- No new infrastructure components required (uses existing PostgreSQL + Redis)

Moderate risk areas:
- Raw SQL for pgvector queries (outside Prisma's type safety) -- mitigated by thorough integration tests
- Prisma `Unsupported` type requires raw SQL for writes -- mitigated by encapsulating in a single embedding service
- OpenAI embedding API latency in BullMQ inline mode may slow down dev workflows -- mitigated by mock in test environment

## Validation Plan

| User Scenario | Expected Outcome | Validation Method |
|---------------|-----------------|-------------------|
| Admin creates KB article | Article persisted with 201, embedding job enqueued | API test: POST /v1/kb/articles, verify DB record and queue job |
| Embedding generated async | Article's embedding column populated after worker processes job | Integration test: create article, process queue, verify embedding is non-null |
| Semantic search finds relevant articles | "refund policy" query returns refund-related articles ranked highest | Integration test: seed 5 articles, search, assert ordering |
| Search excludes draft/deleted articles | Draft and soft-deleted articles not in results | API test: create draft + published, search, verify only published returned |
| Intent classified correctly | "I was charged twice" returns billing intent with high confidence | BAML eval test + API integration test |
| Intent suggests KB articles | Classification includes relevant article IDs from the brand's KB | Integration test: seed KB, classify, verify suggested IDs exist |
| Multi-tenant isolation | Brand A articles invisible to Brand B | Integration test: create under brand A, search as brand B, assert empty |
| MCP search_kb tool works | Tool returns ranked articles | MCP integration test |
| MCP create_kb_article tool works | Tool creates article with embedding | MCP integration test |
| MCP classify_intent tool works | Tool returns structured classification | MCP integration test |
| Soft delete preserves data | DELETE sets deletedAt, article excluded from all queries | API test: delete, verify GET returns 404, DB has record with deletedAt |
| Audit events logged | Create/update/delete generate AuditEvent records | Integration test: mutate, verify AuditEvent exists |

## Test Matrix

### Unit Tests (mocking OpenAI, Prisma, BullMQ)

| Test Suite | File | What It Tests |
|-----------|------|--------------|
| KB Zod schemas | `packages/shared/src/zod/kb.schema.test.ts` | Validation: valid/invalid article payloads, search query limits, intent input limits |
| Embedding service | `packages/ai/src/analysis/embeddings.test.ts` | Mock OpenAI client, verify correct model/dimensions, error handling |
| ClassifyIntent wrapper | `packages/ai/src/analysis/classify-intent.test.ts` | Mock BAML client, verify input/output types |
| KB route handlers | `apps/api/src/routes/kb.test.ts` | CRUD operations with mocked Prisma, queue enqueue verification, audit event creation |
| Intent route handler | `apps/api/src/routes/intent.test.ts` | Mocked AI + Prisma, verify response shape, article ID filtering |
| Embedding worker | `apps/worker/src/processors/embeddingGeneration.test.ts` | Mock OpenAI + Prisma raw SQL, verify embedding stored |
| MCP KB tools | `apps/mcp-server/src/tools/kb.test.ts` | Mock apiFetch, verify tool registration and response format |

### Integration Tests (real DB, mocked OpenAI)

| Test Suite | File | What It Tests |
|-----------|------|--------------|
| KB CRUD + search | `apps/api/src/routes/kb.integration.test.ts` | Full API flow: create, read, update, delete, list with pagination, multi-tenant isolation |
| Semantic search | `apps/api/src/routes/kb-search.integration.test.ts` | Real pgvector queries with pre-seeded embeddings, ranking verification |
| Intent classification | `apps/api/src/routes/intent.integration.test.ts` | Full API flow with real DB, mocked BAML, article suggestion filtering |

### BAML Eval Tests (real LLM calls)

| Test Suite | File | What It Tests |
|-----------|------|--------------|
| ClassifyIntent accuracy | `packages/ai/src/evals/classify-intent.eval.ts` | 10+ sample messages across all intent types, accuracy assertions |

### E2E Tests (none for this issue)

This is a P1 feature (project rule #9): unit + integration required, E2E optional. The admin UI pages (`/admin/kb`) will be built in a separate UI issue. No E2E tests in scope for this backend-focused issue.

## Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| pgvector extension not available on Azure PostgreSQL | Low | High (blocks feature) | Azure PostgreSQL Flexible Server supports pgvector natively. Verify in staging before production migration. |
| OpenAI embeddings API cost at scale | Low | Medium | text-embedding-3-small is $0.02/1M tokens. 10,000 articles at ~500 tokens each = ~$0.10 total. Re-embedding on update is incremental. |
| Raw SQL injection in pgvector queries | Low | Critical | Use parameterized queries (`$1`, `$2`) exclusively. Never interpolate user input into SQL strings. |
| Prisma `Unsupported` type friction | Medium | Low | All embedding reads/writes go through a single `embeddingService` module that encapsulates raw SQL. If Prisma adds pgvector support, only one file changes. |
| LLM hallucinating article IDs in ClassifyIntent | Medium | Low | Post-filter `suggested_article_ids` against actual DB records. Invalid IDs silently removed. |
| Embedding generation queue backlog | Low | Medium | BullMQ concurrency limit of 5 for embedding worker. Embedding generation is fast (~200ms per article). Backlog alert if queue depth > 100. |
| Search latency at scale (>10K articles) | Low | Medium | NF1 requires <500ms. Sequential scan is fine to ~1K articles. Add IVFFlat index when any brand exceeds 1K articles. Monitor via structured logging. |

## Observability (Logs, Metrics, Alerts)

### Structured Logging (Pino)

All components use existing Pino structured logging:

| Component | Log Event | Fields |
|-----------|----------|--------|
| KB routes | Article CRUD | `{ brandId, articleId, action, category }` |
| Search endpoint | Semantic search | `{ brandId, query, resultCount, latencyMs }` |
| Intent endpoint | Intent classification | `{ brandId, intent, confidence, urgency, articleSuggestions, latencyMs }` |
| Embedding worker | Embedding generated | `{ brandId, articleId, embeddingDimensions, latencyMs }` |
| Embedding worker | Embedding failed | `{ brandId, articleId, error, attempt }` |

### Metrics to Track

| Metric | Source | Alert Threshold |
|--------|--------|-----------------|
| Semantic search latency (p95) | Search endpoint log | > 500ms (NF1 SLA) |
| Intent classification latency (p95) | Intent endpoint log | > 3000ms (NF3 SLA) |
| Embedding queue depth | BullMQ metrics | > 100 jobs pending |
| Embedding generation failures | Worker error log | > 5 failures in 1 hour |
| OpenAI API error rate | Embedding + intent logs | > 10% of calls failing |

### Dead Letter Queue (DLQ)

Embedding generation jobs that fail after all BullMQ retries (3 attempts) are moved to the BullMQ failed state. These can be inspected via the BullMQ dashboard and manually retried. No separate DLQ infrastructure needed -- BullMQ's built-in failed job tracking is sufficient at MVP scale.

## File Change Summary

### New Files

| File | Type | Description |
|------|------|-------------|
| `packages/database/prisma/migrations/<ts>_add_kb_articles/migration.sql` | Migration | pgvector extension + KBArticle table |
| `packages/shared/src/zod/kb.schema.ts` | Schema | Zod schemas for KB and intent validation |
| `packages/shared/src/zod/kb.schema.test.ts` | Test | Schema validation tests |
| `packages/ai/baml_src/classify_intent.baml` | BAML | ClassifyIntent function definition |
| `packages/ai/src/analysis/embeddings.ts` | Service | OpenAI embeddings generation |
| `packages/ai/src/analysis/embeddings.test.ts` | Test | Embedding service unit tests |
| `packages/ai/src/analysis/classify-intent.ts` | Service | ClassifyIntent TypeScript wrapper |
| `packages/ai/src/analysis/classify-intent.test.ts` | Test | ClassifyIntent unit tests |
| `packages/ai/src/evals/classify-intent.eval.ts` | Eval | BAML eval tests (10+ intent samples) |
| `apps/api/src/routes/kb.ts` | Route | KB article CRUD + semantic search |
| `apps/api/src/routes/kb.test.ts` | Test | KB route unit tests |
| `apps/api/src/routes/intent.ts` | Route | Intent classification endpoint |
| `apps/api/src/routes/intent.test.ts` | Test | Intent route unit tests |
| `apps/worker/src/processors/embeddingGeneration.ts` | Processor | BullMQ embedding worker |
| `apps/worker/src/processors/embeddingGeneration.test.ts` | Test | Embedding worker unit tests |
| `apps/mcp-server/src/tools/kb.ts` | MCP | search_kb, create_kb_article, classify_intent tools |

### Modified Files

| File | Change |
|------|--------|
| `packages/database/prisma/schema.prisma` | Add `KBArticleCategory` enum, `KBArticleStatus` enum, `KBArticle` model |
| `packages/shared/src/queues.ts` | Add `EMBEDDING_GENERATION` queue name |
| `packages/shared/src/index.ts` | Export KB schemas |
| `packages/ai/src/index.ts` | Export `generateEmbedding`, `classifyIntent` |
| `apps/api/src/queues/bullmq.ts` | Add embedding generation queue + inline processor |
| `apps/api/src/app.ts` | Register `kbRoutes` and `intentRoutes` |
| `apps/worker/src/index.ts` | Register embedding generation processor |
| `apps/mcp-server/src/index.ts` | Register KB tools |
