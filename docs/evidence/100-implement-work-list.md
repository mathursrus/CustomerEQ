# Implementation Work List: #100 — Knowledge Base with RAG and Intent Classification

Issue: #100
RFC: `docs/rfcs/100-knowledge-base-rag-intent-classification.md`
Spec: `docs/feature-specs/100-knowledge-base-rag-intent-classification.md`
Branch: `feature/100-phase-c-support-foundation-knowledge-base-with-rag-and-intent-classification`
Priority: P1 (unit + integration tests required)

---

## Implementation Checklist

### 1. Database Layer
- [ ] `packages/database/prisma/schema.prisma` — Add `KBArticleCategory` enum, `KBArticleStatus` enum, `KBArticle` model
- [ ] `packages/database/prisma/migrations/<ts>_add_kb_articles/migration.sql` — pgvector extension + KBArticle table creation

### 2. Shared Package
- [ ] `packages/shared/src/zod/kb.schema.ts` — New Zod schemas: CreateKBArticle, UpdateKBArticle, KBSearchQuery, ClassifyIntent
- [ ] `packages/shared/src/zod/kb.schema.test.ts` — Schema validation tests
- [ ] `packages/shared/src/queues.ts` — Add `EMBEDDING_GENERATION` queue constant
- [ ] `packages/shared/src/types/index.ts` — Add `EmbeddingGenerationPayload` interface
- [ ] `packages/shared/src/index.ts` — Export KB schemas

### 3. AI Layer
- [ ] `packages/ai/baml_src/classify_intent.baml` — ClassifyIntent BAML function
- [ ] `packages/ai/src/analysis/embeddings.ts` — OpenAI embeddings service
- [ ] `packages/ai/src/analysis/embeddings.test.ts` — Embedding service unit tests
- [ ] `packages/ai/src/analysis/classify-intent.ts` — ClassifyIntent TypeScript wrapper
- [ ] `packages/ai/src/analysis/classify-intent.test.ts` — ClassifyIntent unit tests
- [ ] `packages/ai/src/evals/classify-intent.eval.ts` — BAML eval tests (10+ intent samples)
- [ ] `packages/ai/src/index.ts` — Export generateEmbedding, classifyIntent

### 4. API Layer
- [ ] `apps/api/src/routes/kb.ts` — KB article CRUD + semantic search endpoints
- [ ] `apps/api/src/routes/kb.test.ts` — KB route unit tests
- [ ] `apps/api/src/routes/intent.ts` — Intent classification endpoint
- [ ] `apps/api/src/routes/intent.test.ts` — Intent route unit tests
- [ ] `apps/api/src/queues/bullmq.ts` — Add embedding generation queue + inline processor
- [ ] `apps/api/src/app.ts` — Register kbRoutes and intentRoutes

### 5. Worker
- [ ] `apps/worker/src/processors/embeddingGeneration.ts` — BullMQ embedding worker processor
- [ ] `apps/worker/src/processors/embeddingGeneration.test.ts` — Worker unit tests
- [ ] `apps/worker/src/index.ts` — Register embedding generation worker

### 6. MCP Server
- [ ] `apps/mcp-server/src/tools/kb.ts` — search_kb, create_kb_article, classify_intent tools
- [ ] `apps/mcp-server/src/index.ts` — Register KB tools

---

## Validation Requirements

- `uiValidationRequired`: false (backend-only; admin UI is a separate issue)
- `mobileValidationRequired`: false
- `unitTests`: required (P1)
- `integrationTests`: required (P1)
- `bamlEvalTests`: required (ClassifyIntent accuracy)
- `e2eTests`: not required (P1, no UI in this issue)

## Quality Requirements

- All mocks in `packages/config/src/test-utils/` (project rule #8)
- brandId scoping on all endpoints (project rule #6)
- Soft deletes only (project rule #13)
- Audit events on all mutations
- Tests fail loudly if deps missing (project rule #11a)

## Discovered Codebase Patterns

- **Route pattern**: `FastifyPluginAsync` with Zod `safeParse`, `request.brandId` from JWT
- **Queue pattern**: Queue constant in `packages/shared/src/queues.ts`, init/getter/enqueue in `apps/api/src/queues/bullmq.ts`, inline mode support
- **BAML pattern**: `.baml` in `packages/ai/baml_src/`, uses `GPT4oMini` client, TypeScript wrapper in `src/analysis/`
- **MCP pattern**: `registerXTools(server: McpServer)` in `apps/mcp-server/src/tools/`, uses `apiFetch`, `z.object().shape`
- **Test pattern**: Vitest, `describe/it/expect`, mock via `@customerEQ/config/test-utils`
- **Worker pattern**: `new Worker(QUEUE_NAME, processor, { connection, concurrency, drainDelay })`
- **Audit pattern**: `fastify.prisma.auditEvent.create({ data: { brandId, actorId, action, resourceType, resourceId, metadata } })`

## Deferrals / Open Questions

- IVFFlat vector index deferred until >1K articles per brand
- Admin UI pages (`/admin/kb`) deferred to separate issue
- Architecture doc updates deferred to address-feedback phase
