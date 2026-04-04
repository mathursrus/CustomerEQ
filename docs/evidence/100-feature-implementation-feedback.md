# Quality Feedback: #100 — Knowledge Base with RAG and Intent Classification

## Quality Checks

### 1. Hardcoded Values
- **PASS**: No hardcoded URLs, API keys, credentials, or magic numbers in new files
- Model name `text-embedding-3-small` and dimensions `1536` are intentional constants in the embeddings module (per RFC)

### 2. Duplicate Code
- **ACCEPTABLE**: Vector string formatting (`[${embedding.join(',')}]`) appears in 3 locations:
  - `apps/api/src/queues/bullmq.ts` (inline processor — dev mode)
  - `apps/worker/src/processors/embeddingGeneration.ts` (BullMQ processor — prod mode)
  - `apps/api/src/routes/kb.ts` (search query embedding)
  - These are intentionally parallel execution paths per the queue architecture. Extracting a shared helper would create a cross-cutting dependency for a one-liner.

### 3. File Sizes
- **PASS**: All new files under 500 lines
  - `apps/api/src/routes/kb.ts`: 246 lines (6 endpoints)
  - `apps/api/src/routes/intent.ts`: 65 lines
  - `apps/api/src/queues/bullmq.ts`: 434 lines (pre-existing + new queue)
  - `apps/worker/src/processors/embeddingGeneration.ts`: 37 lines

### 4. Architecture Standards Compliance
- **PASS**: AI/LLM logic isolated in `packages/ai` (embeddings, classify-intent)
- **PASS**: No LLM prompts in routes or services
- **PASS**: Environment variables used for all configuration (OPENAI_API_KEY, QUEUE_MODE)
- **PASS**: brandId scoping on all endpoints from JWT (project rule #6)
- **PASS**: Soft deletes with deletedAt (project rule #13)
- **PASS**: Audit events on all mutations
- **PASS**: Mocks in `packages/config/src/test-utils/` (project rule #8)
- **PASS**: Tests fail loudly if deps missing (project rule #11a)

### 5. Pattern Consistency
- **PASS**: Route follows FastifyPluginAsync pattern (like surveys.ts)
- **PASS**: Queue follows existing initQueues/getter/enqueue pattern
- **PASS**: BAML follows AnalyzeFeedback pattern (GPT4oMini client, Jinja template)
- **PASS**: MCP tools follow campaigns.ts pattern (apiFetch, z.object().shape)
- **PASS**: Worker follows existing processor registration pattern

### 6. Security
- **PASS**: Raw SQL uses parameterized queries ($1, $2) — no string interpolation
- **PASS**: No credentials in code
- **PASS**: brandId never accepted from request body

## All Issues: ADDRESSED
No unaddressed quality issues found.
