# Support Platform Revamp — Slice 1 (Data + AI Orchestrator) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the foundational schema (KBSource, KBChunk, Conversation/Message/SupportRule extensions) + the BAML AI pipeline (ClassifySupportIntent, DraftSupportReply, ClassifyResolution) + a real `supportOrchestration` BullMQ processor that exercises tiered autonomy (AUTO_REPLY / DRAFT_FOR_AGENT / ESCALATE). Slices 2 (KB UI), 3 (widget), 4 (CSAT + Slack + loyalty bridge) all depend on what lands here.

**Architecture:** Evolve in-place — extend existing Prisma models, add three BAML functions in `packages/ai/baml_src/`, replace `inlineSupportOrchestration` in `apps/api/src/queues/bullmq.ts` with a worker processor at `apps/worker/src/processors/supportOrchestration.ts` registered against `QUEUES.SUPPORT_ORCHESTRATION` (constant already exists). Per-conversationId ordering enforced via Redis `SET NX PX` lock (existing ioredis 5.10.1 — no new deps).

**Tech Stack:** Prisma 5.13 · Postgres 16 + pgvector (already wired for `KBArticle.embedding`) · BAML (Azure OpenAI clients in `clients.baml`) · BullMQ v5 · Vitest · Pino · Zod · TypeScript 5.4 strict.

**Authoritative spec:** `docs/superpowers/specs/2026-05-13-support-platform-revamp-design.md`. Locked decisions in §2 are not up for re-litigation in this plan.

**Out of scope (this slice):** KB admin UI (Slice 2), `SupportWidgetConfig` + widget rewrite (Slice 3), `CSATResponse` + `supportTimeoutClassifier` + Slack adapter + loyalty bridge wiring (Slice 4). Tests in this slice may verify that the orchestrator emits the right job to `loyaltyEvents` queue, but the end-to-end loyalty assertion lives in Slice 4.

---

## File Structure

### New files

```
packages/database/prisma/migrations/
  2026MMDD000001_support_revamp_kb_chunks_and_sources/migration.sql
  2026MMDD000002_support_revamp_conversation_message_rule_extensions/migration.sql

packages/ai/baml_src/
  support_intent.baml
  support_reply.baml
  support_resolution.baml

packages/ai/src/support/
  intent.ts                       wrapper around b.ClassifySupportIntent
  reply.ts                        wrapper around b.DraftSupportReply
  resolution.ts                   wrapper around b.ClassifyResolution
  intent.test.ts                  unit (mocked baml_client)
  reply.test.ts
  resolution.test.ts

packages/ai/tests/baml-evals/
  support_intent.eval.test.ts     real LLM, 30+ labeled cases
  support_reply.eval.test.ts      real LLM, 20+ cases, judge-scored
  support_resolution.eval.test.ts real LLM, 20+ labeled threads

apps/worker/src/processors/
  supportOrchestration.ts         the AI brain
  supportOrchestration.test.ts    unit (BAML + Prisma + Redis mocked)

apps/worker/src/lib/
  conversationLock.ts             Redis SETNX-based per-conversationId lock
  conversationLock.test.ts

apps/api/src/__tests__/integration/
  support-orchestration.integration.test.ts   real DB, mocked BAML

packages/config/src/test-utils/factories/
  kbSource.factory.ts
  kbChunk.factory.ts

packages/config/src/test-utils/mocks/
  openaiEmbed.mock.ts             deterministic seeded embeddings
  baml-support.mock.ts            BAML AI mocks for orchestrator tests
```

### Modified files

```
packages/database/prisma/schema.prisma
  - Add enums: KBSourceKind, KBSourceStatus, ChunkEmbedStatus, SupportActionMode,
    ResolutionSource, ConversationChannel
  - Add model: KBSource
  - Add model: KBChunk
  - Extend KBArticle: sourceId, sourceUrl, contentHash, publishedAt, archivedAt
  - Extend Conversation: channel, anonId, email, memberId nullable,
    resolutionSource, (resolvedAt already exists)
  - Extend Message: aiConfidence, aiSources, draftedByAi, slackTs
  - Extend SupportRule: actionMode, confidenceThreshold

packages/shared/src/supportRules.ts
  - SupportRuleInput gains actionMode + confidenceThreshold
  - SupportRuleMatchResult gains matchedRules[] each with actionMode + threshold
  - evaluateSupportRules returns actionMode + threshold for each match

packages/shared/src/zod/support.schema.ts
  - Add SupportOrchestrationPayload schema (existing payload, extend with new fields)
  - Add ActionMode enum schema

packages/shared/src/zod/knowledge.schema.ts          NEW
  - KBSource, KBChunk, embedStatus enums

apps/worker/src/index.ts
  - Register supportOrchestration Worker

apps/api/src/queues/bullmq.ts
  - Remove inlineSupportOrchestration; in QUEUE_MODE=inline, delegate to
    the same processor function exported from apps/worker/src/processors/supportOrchestration.ts

packages/config/src/test-utils/factories/support.factory.ts
  - Extend createConversation, createMessage, createSupportRule with new fields

packages/config/src/test-utils/db/setup-migration-test-db.ts
  - No change — pgvector already enabled by the migration that introduced
    KBArticle.embedding. Verify it still passes.
```

> **Date prefixes for migration filenames:** use the day this slice lands. Replace `2026MMDD000001` and `2026MMDD000002` with that day's date — e.g. if landing 2026-05-20 the files become `20260520000001_…` / `20260520000002_…`. Two migrations the same day get incrementing serial suffixes.

---

## Task 0: Branch + worktree setup

**Files:** none

- [ ] **Step 1: File the GitHub issue per repo rule #8**

Repo rule #8 (ONBOARDING.md) requires: issue first, branch `feature/issue-{N}-{slug}`, PR body says `Closes #N`. Title: *"Slice 1/4: Support platform revamp — data + AI orchestrator"*. Body cites this plan path. Capture the issue number as `$ISSUE` for use below.

- [ ] **Step 2: Create the branch**

```bash
git fetch origin
git switch -c feature/issue-$ISSUE-support-revamp-slice-1 origin/main
```

- [ ] **Step 3: Confirm clean baseline**

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test:smoke
```

Expected: all four commands pass before any edits.

---

## Task 1: Add new enums to Prisma schema

**Files:**
- Modify: `packages/database/prisma/schema.prisma` (enums live near lines 80–106 today; append the new ones in the same block)

- [ ] **Step 1: Add the new enums**

Append after the last existing support-related enum (`KBArticleStatus`):

```prisma
enum KBSourceKind {
  MANUAL
  URL
  SITEMAP
}

enum KBSourceStatus {
  ACTIVE
  DISABLED
}

enum ChunkEmbedStatus {
  PENDING
  EMBEDDED
  FAILED
}

enum SupportActionMode {
  AUTO_REPLY
  DRAFT_FOR_AGENT
  ESCALATE
}

enum ResolutionSource {
  CSAT
  AI_TIMEOUT
  AGENT
}

enum ConversationChannel {
  WIDGET
  SLACK
}
```

- [ ] **Step 2: Format + verify schema parses**

```bash
pnpm --filter @customerEQ/database exec prisma format
pnpm --filter @customerEQ/database exec prisma validate
```

Expected: both succeed, no diff outside the enum block.

- [ ] **Step 3: Commit**

```bash
git add packages/database/prisma/schema.prisma
git commit -m "schema: add support-slice-1 enums (KBSourceKind, ChunkEmbedStatus, SupportActionMode, ResolutionSource, ConversationChannel)"
```

---

## Task 2: Add KBSource and KBChunk models + extend KBArticle

**Files:**
- Modify: `packages/database/prisma/schema.prisma`

- [ ] **Step 1: Add KBSource model**

Insert near the existing `KBArticle` model:

```prisma
model KBSource {
  id              String         @id @default(cuid())
  brandId         String
  brand           Brand          @relation(fields: [brandId], references: [id])
  kind            KBSourceKind
  url             String?
  title           String
  status          KBSourceStatus @default(ACTIVE)
  crawlCron       String?
  lastCrawledAt   DateTime?
  lastErrorMessage String?
  articles        KBArticle[]
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  @@index([brandId, status])
  @@index([brandId, kind])
  @@map("kb_sources")
}
```

- [ ] **Step 2: Add KBChunk model**

Insert below `KBSource`:

```prisma
model KBChunk {
  id           String           @id @default(cuid())
  articleId    String
  article      KBArticle        @relation(fields: [articleId], references: [id], onDelete: Cascade)
  brandId      String
  chunkIndex   Int
  content      String
  tokenCount   Int
  embedding    Unsupported("public.vector(1536)")?
  embedStatus  ChunkEmbedStatus @default(PENDING)
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt

  @@index([brandId])
  @@index([articleId, chunkIndex])
  @@map("kb_chunks")
}
```

- [ ] **Step 3: Extend KBArticle**

Replace the existing `KBArticle` model block with this one (added fields: `sourceId`, `source`, `sourceUrl`, `contentHash`, `publishedAt`, `archivedAt`, `chunks`):

```prisma
model KBArticle {
  id          String                              @id @default(cuid())
  brandId     String
  title       String
  body        String
  category    KBArticleCategory                   @default(FAQ)
  tags        String[]
  status      KBArticleStatus                     @default(DRAFT)
  embedding   Unsupported("public.vector(1536)")?

  sourceId    String?
  source      KBSource?                           @relation(fields: [sourceId], references: [id])
  sourceUrl   String?
  contentHash String?
  publishedAt DateTime?
  archivedAt  DateTime?

  chunks      KBChunk[]
  deletedAt   DateTime?
  createdAt   DateTime                            @default(now())
  updatedAt   DateTime                            @updatedAt

  @@index([brandId, status])
  @@index([brandId, category])
  @@index([brandId, sourceId])
  @@map("kb_articles")
}
```

- [ ] **Step 4: Add the reverse relation on `Brand`**

In the `Brand` model, find the section listing reverse relations (other `…[]` lines like `members Member[]`). Add:

```prisma
  kbSources KBSource[]
```

- [ ] **Step 5: Validate**

```bash
pnpm --filter @customerEQ/database exec prisma format
pnpm --filter @customerEQ/database exec prisma validate
```

Expected: success, no diff outside the targeted blocks.

- [ ] **Step 6: Commit**

```bash
git add packages/database/prisma/schema.prisma
git commit -m "schema: add KBSource + KBChunk, extend KBArticle for RAG ingestion"
```

---

## Task 3: Generate migration 1 (KBSource + KBChunk + KBArticle extensions)

**Files:**
- Create: `packages/database/prisma/migrations/<TODAY>000001_support_revamp_kb_chunks_and_sources/migration.sql`

- [ ] **Step 1: Make sure Postgres + Redis are running locally**

```bash
docker compose up -d
```

Expected: `postgres` and `redis` containers `Up`.

- [ ] **Step 2: Create the migration in dev mode**

```bash
pnpm db:migrate:new --name support_revamp_kb_chunks_and_sources
```

Expected: prisma generates `packages/database/prisma/migrations/<TIMESTAMP>_support_revamp_kb_chunks_and_sources/migration.sql` with `CREATE TABLE kb_sources`, `CREATE TABLE kb_chunks`, and `ALTER TABLE kb_articles` adding the new columns.

- [ ] **Step 3: Hand-add the HNSW index for KBChunk.embedding**

Open the generated `migration.sql` and append at the bottom:

```sql
-- HNSW index for cosine-similarity retrieval (top-K queries are brandId-filtered)
CREATE INDEX kb_chunks_embedding_hnsw_idx
  ON "kb_chunks"
  USING hnsw ("embedding" vector_cosine_ops);
```

(`pgvector` extension is already enabled by the existing migration that introduced `KBArticle.embedding`; no `CREATE EXTENSION` needed here.)

- [ ] **Step 4: Reset + re-run migrations to verify the SQL applies cleanly**

```bash
pnpm db:reset --force
```

Expected: all migrations apply through the new one without error. The dev DB now has `kb_sources` + `kb_chunks` tables.

- [ ] **Step 5: Sanity check**

```bash
pnpm --filter @customerEQ/database exec prisma studio
```

Open in browser; confirm `KBSource` and `KBChunk` show up empty. Close studio.

- [ ] **Step 6: Commit**

```bash
git add packages/database/prisma/migrations/
git commit -m "migrate: support-slice-1 — KBSource + KBChunk tables + HNSW index"
```

---

## Task 4: Extend Conversation + Message + SupportRule in schema

**Files:**
- Modify: `packages/database/prisma/schema.prisma`

- [ ] **Step 1: Update Conversation**

Replace the existing `Conversation` model with this. **Note `memberId` becomes nullable** to support anonymous flows (Slice 3). All other additions are nullable / defaulted — zero-downtime additive.

```prisma
model Conversation {
  id        String              @id @default(cuid())
  brandId   String
  brand     Brand               @relation(fields: [brandId], references: [id])
  memberId  String?
  member    Member?             @relation(fields: [memberId], references: [id])
  channel   ConversationChannel @default(WIDGET)
  anonId    String?
  email     String?

  status         ConversationStatus @default(ACTIVE)
  intent         String?
  confidence     Float?
  topic          String?
  summary        String?
  assignee       String?
  caseFollowUpId String?
  escalatedAt    DateTime?
  rulesMatched   String[]

  resolutionSource ResolutionSource?
  resolvedAt       DateTime?
  closedAt         DateTime?

  messages  Message[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([brandId, status])
  @@index([memberId])
  @@index([brandId, channel, status])
  @@index([brandId, anonId])
  @@index([brandId, createdAt])
  @@map("conversations")
}
```

- [ ] **Step 2: Update Message**

Replace the existing `Message` model with:

```prisma
model Message {
  id             String       @id @default(cuid())
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  role           MessageRole
  content        String
  metadata       Json?

  aiConfidence Float?
  aiSources    Json?
  draftedByAi  Boolean @default(false)
  slackTs      String?

  createdAt DateTime @default(now())

  @@index([conversationId, createdAt])
  @@index([conversationId, role])
  @@map("messages")
}
```

- [ ] **Step 3: Update SupportRule**

Replace the existing `SupportRule` model with (adding `actionMode` + `confidenceThreshold`):

```prisma
model SupportRule {
  id          String  @id @default(cuid())
  brandId     String
  brand       Brand   @relation(fields: [brandId], references: [id])
  name        String
  description String?
  status      String  @default("ACTIVE")
  priority    Int     @default(0)

  intentFilters  String[]
  tierFilters    String[]
  healthScoreMin Float?
  healthScoreMax Float?
  topicFilters   String[]
  conditions     Json     @default("{}")

  actionMode           SupportActionMode @default(ESCALATE)
  confidenceThreshold  Float             @default(0.8)
  autoRespondArticleId String?
  escalateToAssignee   String?
  awardPoints          Int?
  triggerSurveyId      String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([brandId, status])
  @@index([brandId, status, priority])
  @@map("support_rules")
}
```

- [ ] **Step 4: Validate**

```bash
pnpm --filter @customerEQ/database exec prisma format
pnpm --filter @customerEQ/database exec prisma validate
```

Expected: success.

- [ ] **Step 5: Commit**

```bash
git add packages/database/prisma/schema.prisma
git commit -m "schema: extend Conversation/Message/SupportRule for anon flow + tiered autonomy"
```

---

## Task 5: Generate migration 2 (Conversation/Message/SupportRule extensions)

**Files:**
- Create: `packages/database/prisma/migrations/<TODAY>000002_support_revamp_conversation_message_rule_extensions/migration.sql`

- [ ] **Step 1: Generate**

```bash
pnpm db:migrate:new --name support_revamp_conversation_message_rule_extensions
```

Expected: SQL generated with: `ALTER TABLE conversations` adding `channel`, `anon_id`, `email`, `resolution_source`, **and** changing `member_id` to nullable; `ALTER TABLE messages` adding `ai_confidence`, `ai_sources`, `drafted_by_ai`, `slack_ts`; `ALTER TABLE support_rules` adding `action_mode`, `confidence_threshold`.

- [ ] **Step 2: Inspect the generated SQL**

Open the new `migration.sql`. Confirm `ALTER TABLE conversations ALTER COLUMN member_id DROP NOT NULL` is present. If Prisma generated the change as a drop+recreate instead, rewrite it as a simple `DROP NOT NULL` (safer, no data loss).

- [ ] **Step 3: Reset + re-migrate**

```bash
pnpm db:reset --force
```

Expected: clean run through both new migrations.

- [ ] **Step 4: Quick assertion that nullable took effect**

```bash
pnpm --filter @customerEQ/database exec prisma db execute \
  --schema packages/database/prisma/schema.prisma \
  --stdin <<< "SELECT is_nullable FROM information_schema.columns WHERE table_name='conversations' AND column_name='member_id';"
```

Expected: `is_nullable = YES`.

- [ ] **Step 5: Commit**

```bash
git add packages/database/prisma/migrations/
git commit -m "migrate: support-slice-1 — Conversation/Message/SupportRule extensions"
```

---

## Task 6: Regenerate Prisma client and confirm typecheck

**Files:** none directly — generated client lives in `packages/database/node_modules/.prisma/client/`.

- [ ] **Step 1: Regenerate**

```bash
pnpm db:generate
```

- [ ] **Step 2: Typecheck the whole repo**

```bash
pnpm typecheck
```

Expected: this will fail in several places that reference the old Conversation/Message/SupportRule shapes (e.g., `apps/api/src/queues/bullmq.ts:inlineSupportOrchestration` and any callers that assume non-null `memberId`). Capture the failure list — these are addressed in Tasks 13–20.

If failures are only in files this slice is going to touch (orchestrator, support routes), continue. If failures appear in **unrelated** files (e.g., loyalty), open one of them to confirm it's because of `Conversation.memberId` being null — if so, narrow the fix to a non-null assertion at the use-site (those code paths don't yet handle anon conversations, and won't until Slice 3 starts creating them).

- [ ] **Step 3: Apply targeted non-null assertions where needed**

For each unrelated file with a typecheck error on `Conversation.memberId` / equivalent, add a brief assertion at the read site:

```ts
if (!conversation.memberId) throw new Error(`Conversation ${conversation.id} unexpectedly has null memberId in pre-slice-3 code path`)
```

This keeps non-support code paths safe; Slice 3 will refactor when anon flows actually create null-`memberId` rows.

- [ ] **Step 4: Re-run typecheck**

```bash
pnpm typecheck
```

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add -u
git commit -m "fix: targeted null-guards for Conversation.memberId in pre-slice-3 code paths"
```

---

## Task 7: Zod schemas for KB + support orchestration

**Files:**
- Create: `packages/shared/src/zod/knowledge.schema.ts`
- Modify: `packages/shared/src/zod/support.schema.ts`
- Modify: `packages/shared/src/index.ts` (re-exports)

- [ ] **Step 1: Write `knowledge.schema.ts`**

```ts
// packages/shared/src/zod/knowledge.schema.ts
import { z } from 'zod'

export const KBSourceKindSchema = z.enum(['MANUAL', 'URL', 'SITEMAP'])
export type KBSourceKind = z.infer<typeof KBSourceKindSchema>

export const KBSourceStatusSchema = z.enum(['ACTIVE', 'DISABLED'])
export type KBSourceStatus = z.infer<typeof KBSourceStatusSchema>

export const ChunkEmbedStatusSchema = z.enum(['PENDING', 'EMBEDDED', 'FAILED'])
export type ChunkEmbedStatus = z.infer<typeof ChunkEmbedStatusSchema>

export const KBChunkRetrievedSchema = z.object({
  id: z.string(),
  articleId: z.string(),
  chunkIndex: z.number().int().nonnegative(),
  content: z.string(),
  similarity: z.number().min(0).max(1),
})
export type KBChunkRetrieved = z.infer<typeof KBChunkRetrievedSchema>
```

- [ ] **Step 2: Extend `support.schema.ts`**

Open the existing file and append:

```ts
export const SupportActionModeSchema = z.enum(['AUTO_REPLY', 'DRAFT_FOR_AGENT', 'ESCALATE'])
export type SupportActionMode = z.infer<typeof SupportActionModeSchema>

export const ResolutionSourceSchema = z.enum(['CSAT', 'AI_TIMEOUT', 'AGENT'])
export type ResolutionSource = z.infer<typeof ResolutionSourceSchema>

export const ConversationChannelSchema = z.enum(['WIDGET', 'SLACK'])
export type ConversationChannel = z.infer<typeof ConversationChannelSchema>

export const SupportOrchestrationPayloadSchema = z.object({
  conversationId: z.string(),
  brandId: z.string(),
  memberId: z.string().nullable(),
  messageId: z.string(),
  messageContent: z.string(),
})
export type SupportOrchestrationPayload = z.infer<typeof SupportOrchestrationPayloadSchema>
```

(If the file already exports a `SupportOrchestrationPayload`, replace it with this schema-derived version and remove the older type.)

- [ ] **Step 3: Re-export from `packages/shared/src/index.ts`**

Append (if not already present):

```ts
export * from './zod/knowledge.schema.js'
```

Confirm `./zod/support.schema.js` is already exported.

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter @customerEQ/shared typecheck
pnpm typecheck
```

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/
git commit -m "shared: add KB + support orchestration Zod schemas (actionMode, resolutionSource, channel)"
```

---

## Task 8: Upgrade `evaluateSupportRules` to return actionMode + threshold

**Files:**
- Modify: `packages/shared/src/supportRules.ts`
- Modify: `packages/shared/src/supportRules.test.ts` (or create if it doesn't exist)

- [ ] **Step 1: Write the failing test**

Create or replace `packages/shared/src/supportRules.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { evaluateSupportRules } from './supportRules.js'

const baseRule = {
  id: 'r1',
  status: 'ACTIVE' as const,
  priority: 0,
  intentFilters: ['shipping_question'],
  tierFilters: [],
  healthScoreMin: null,
  healthScoreMax: null,
  topicFilters: [],
  conditions: {},
  actionMode: 'AUTO_REPLY' as const,
  confidenceThreshold: 0.8,
  autoRespondArticleId: 'a1',
  escalateToAssignee: null,
  awardPoints: null,
  triggerSurveyId: null,
}

describe('evaluateSupportRules', () => {
  it('returns actionMode + confidenceThreshold for each matched rule', () => {
    const result = evaluateSupportRules([baseRule], {
      intent: 'shipping_question',
      tier: null,
      healthScore: undefined,
      topics: [],
    })
    expect(result.matchedRules).toHaveLength(1)
    expect(result.matchedRules[0]).toMatchObject({
      ruleId: 'r1',
      actionMode: 'AUTO_REPLY',
      confidenceThreshold: 0.8,
    })
  })

  it('orders matches by priority ascending', () => {
    const r1 = { ...baseRule, id: 'low', priority: 10 }
    const r2 = { ...baseRule, id: 'high', priority: 1 }
    const result = evaluateSupportRules([r1, r2], {
      intent: 'shipping_question',
      tier: null,
      healthScore: undefined,
      topics: [],
    })
    expect(result.matchedRules.map((m) => m.ruleId)).toEqual(['high', 'low'])
  })

  it('does not match when intent filter excludes', () => {
    const result = evaluateSupportRules([baseRule], {
      intent: 'refund_request',
      tier: null,
      healthScore: undefined,
      topics: [],
    })
    expect(result.matchedRules).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run it; expect failure**

```bash
pnpm --filter @customerEQ/shared test supportRules
```

Expected: TS error or runtime failure — `matchedRules` not exposed, `actionMode` not on input type.

- [ ] **Step 3: Update `SupportRuleInput` and the function**

Open `packages/shared/src/supportRules.ts`. Update the input type and return shape:

```ts
import type { SupportActionMode } from './zod/support.schema.js'

export interface SupportRuleInput {
  id: string
  status: 'ACTIVE' | 'INACTIVE'
  priority: number
  intentFilters: string[]
  tierFilters: string[]
  healthScoreMin: number | null
  healthScoreMax: number | null
  topicFilters: string[]
  conditions: Record<string, unknown>
  actionMode: SupportActionMode
  confidenceThreshold: number
  autoRespondArticleId: string | null
  escalateToAssignee: string | null
  awardPoints: number | null
  triggerSurveyId: string | null
}

export interface SupportRuleMatch {
  ruleId: string
  actionMode: SupportActionMode
  confidenceThreshold: number
  autoRespondArticleId: string | null
  escalateToAssignee: string | null
  awardPoints: number | null
  triggerSurveyId: string | null
}

export interface SupportRuleMatchResult {
  matchedRules: SupportRuleMatch[]
  ruleIds: string[]
  shouldEscalate: boolean
  escalateToAssignee: string | null
  autoResponseArticleId: string | null
}

export interface SupportRuleContext {
  intent: string
  tier: string | null
  healthScore: number | undefined
  topics: string[]
}

export function evaluateSupportRules(
  rules: SupportRuleInput[],
  context: SupportRuleContext,
): SupportRuleMatchResult {
  const active = rules.filter((r) => r.status === 'ACTIVE')
  const sorted = [...active].sort((a, b) => a.priority - b.priority)

  const matches: SupportRuleMatch[] = []
  for (const rule of sorted) {
    if (rule.intentFilters.length && !rule.intentFilters.includes(context.intent)) continue
    if (rule.tierFilters.length && (!context.tier || !rule.tierFilters.includes(context.tier))) continue
    if (rule.healthScoreMin != null && (context.healthScore == null || context.healthScore < rule.healthScoreMin)) continue
    if (rule.healthScoreMax != null && (context.healthScore == null || context.healthScore > rule.healthScoreMax)) continue
    if (rule.topicFilters.length && !rule.topicFilters.some((t) => context.topics.includes(t))) continue

    matches.push({
      ruleId: rule.id,
      actionMode: rule.actionMode,
      confidenceThreshold: rule.confidenceThreshold,
      autoRespondArticleId: rule.autoRespondArticleId,
      escalateToAssignee: rule.escalateToAssignee,
      awardPoints: rule.awardPoints,
      triggerSurveyId: rule.triggerSurveyId,
    })
  }

  const shouldEscalate = matches.some((m) => m.actionMode === 'ESCALATE')
  const escalateRule = matches.find((m) => m.actionMode === 'ESCALATE')
  const autoReplyRule = matches.find((m) => m.actionMode === 'AUTO_REPLY' && m.autoRespondArticleId)

  return {
    matchedRules: matches,
    ruleIds: matches.map((m) => m.ruleId),
    shouldEscalate,
    escalateToAssignee: escalateRule?.escalateToAssignee ?? null,
    autoResponseArticleId: autoReplyRule?.autoRespondArticleId ?? null,
  }
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @customerEQ/shared test supportRules
```

Expected: PASS (all 3 tests).

- [ ] **Step 5: Find existing callers + fix**

```bash
git grep -n 'evaluateSupportRules\|SupportRuleMatchResult\|SupportRuleInput' -- ':!packages/shared'
```

Update each caller to read `matchedRules` instead of (old) `rules`, and to supply `actionMode` + `confidenceThreshold` in inputs. There will be 1–3 callers (mainly `apps/api/src/queues/bullmq.ts:inlineSupportOrchestration` — that will be removed in Task 15 anyway).

For now, in any caller that still exists, make the smallest fix to typecheck: map the old field names onto new ones. The full orchestrator replacement happens in Task 14.

- [ ] **Step 6: Typecheck + commit**

```bash
pnpm typecheck
git add packages/shared/ apps/
git commit -m "shared: evaluateSupportRules returns actionMode + threshold per matched rule"
```

---

## Task 9: Test factories — extend support factories + add KB factories

**Files:**
- Modify: `packages/config/src/test-utils/factories/support.factory.ts`
- Create: `packages/config/src/test-utils/factories/kbSource.factory.ts`
- Create: `packages/config/src/test-utils/factories/kbChunk.factory.ts`
- Modify: `packages/config/src/test-utils/factories/index.ts` (re-exports — file may not exist yet, create if needed)

- [ ] **Step 1: Extend `createSupportRule` in `support.factory.ts`**

Find the existing `createSupportRule` and update its options + write:

```ts
export async function createSupportRule(opts: {
  brandId: string
  name?: string
  priority?: number
  intentFilters?: string[]
  topicFilters?: string[]
  tierFilters?: string[]
  actionMode?: 'AUTO_REPLY' | 'DRAFT_FOR_AGENT' | 'ESCALATE'
  confidenceThreshold?: number
  autoRespondArticleId?: string | null
  escalateToAssignee?: string | null
  awardPoints?: number | null
}) {
  const prisma = getTestPrisma()
  counter++
  return prisma.supportRule.create({
    data: {
      brandId: opts.brandId,
      name: opts.name ?? `rule_${counter}`,
      priority: opts.priority ?? 0,
      intentFilters: opts.intentFilters ?? [],
      topicFilters: opts.topicFilters ?? [],
      tierFilters: opts.tierFilters ?? [],
      actionMode: opts.actionMode ?? 'ESCALATE',
      confidenceThreshold: opts.confidenceThreshold ?? 0.8,
      autoRespondArticleId: opts.autoRespondArticleId ?? null,
      escalateToAssignee: opts.escalateToAssignee ?? null,
      awardPoints: opts.awardPoints ?? null,
    },
  })
}
```

If `createConversation` and `createMessage` exist in this file, ensure their options accept (but don't require) the new optional fields: `channel`, `anonId`, `email` on conversation; `aiConfidence`, `aiSources`, `draftedByAi` on message.

- [ ] **Step 2: Write `kbSource.factory.ts`**

```ts
import { getTestPrisma } from '../db/setup.js'

let counter = 0

export async function createKBSource(opts: {
  brandId: string
  kind?: 'MANUAL' | 'URL' | 'SITEMAP'
  url?: string | null
  title?: string
  status?: 'ACTIVE' | 'DISABLED'
}) {
  const prisma = getTestPrisma()
  counter++
  return prisma.kBSource.create({
    data: {
      brandId: opts.brandId,
      kind: opts.kind ?? 'MANUAL',
      url: opts.url ?? null,
      title: opts.title ?? `source_${counter}`,
      status: opts.status ?? 'ACTIVE',
    },
  })
}
```

- [ ] **Step 3: Write `kbChunk.factory.ts` with a deterministic embedding helper**

```ts
import { getTestPrisma } from '../db/setup.js'
import { Prisma } from '@prisma/client'

let counter = 0

/**
 * Deterministic 1536-dim "embedding" — seeded by a string so equal inputs
 * produce equal vectors. NOT cryptographic; just stable across test runs.
 */
export function deterministicEmbedding(seed: string): number[] {
  const vec = new Array<number>(1536)
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  for (let i = 0; i < 1536; i++) {
    h ^= i
    h = Math.imul(h, 16777619)
    vec[i] = ((h & 0xffff) / 65535 - 0.5) * 2 // [-1, 1)
  }
  // L2-normalize so cosine similarity behaves
  let norm = 0
  for (const x of vec) norm += x * x
  norm = Math.sqrt(norm) || 1
  for (let i = 0; i < vec.length; i++) vec[i] /= norm
  return vec
}

export async function createKBChunk(opts: {
  articleId: string
  brandId: string
  chunkIndex?: number
  content?: string
  embedSeed?: string
  embedStatus?: 'PENDING' | 'EMBEDDED' | 'FAILED'
}) {
  const prisma = getTestPrisma()
  counter++
  const content = opts.content ?? `chunk content ${counter}`
  const embedding = deterministicEmbedding(opts.embedSeed ?? content)
  const tokenCount = Math.ceil(content.length / 4)

  // pgvector is `Unsupported(...)` in the Prisma client; use raw SQL.
  const id = `chunk_${counter}_${Date.now()}`
  await prisma.$executeRaw`
    INSERT INTO "kb_chunks" ("id", "articleId", "brandId", "chunkIndex", "content", "tokenCount", "embedding", "embedStatus", "createdAt", "updatedAt")
    VALUES (${id}, ${opts.articleId}, ${opts.brandId}, ${opts.chunkIndex ?? counter}, ${content}, ${tokenCount}, ${Prisma.sql`${`[${embedding.join(',')}]`}::vector`}, ${opts.embedStatus ?? 'EMBEDDED'}::"ChunkEmbedStatus", NOW(), NOW())
  `
  return prisma.kBChunk.findUniqueOrThrow({ where: { id } })
}
```

- [ ] **Step 4: Re-export from the factories index**

Open `packages/config/src/test-utils/factories/index.ts` (create if it doesn't exist) and add:

```ts
export * from './kbSource.factory.js'
export * from './kbChunk.factory.js'
```

- [ ] **Step 5: Typecheck**

```bash
pnpm --filter @customerEQ/config typecheck
```

Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add packages/config/src/test-utils/
git commit -m "test-utils: extend support factories, add KBSource/KBChunk factories with deterministic embeddings"
```

---

## Task 10: OpenAI embed mock + BAML support mock

**Files:**
- Create: `packages/config/src/test-utils/mocks/openaiEmbed.mock.ts`
- Create: `packages/config/src/test-utils/mocks/baml-support.mock.ts`

- [ ] **Step 1: Write `openaiEmbed.mock.ts`**

```ts
import { vi } from 'vitest'
import { deterministicEmbedding } from '../factories/kbChunk.factory.js'

/**
 * Mocks @customerEQ/ai's generateEmbedding to produce stable vectors per input.
 * Call before any module-under-test imports generateEmbedding (use vi.hoisted).
 */
export function mockOpenAIEmbed() {
  vi.mock('@customerEQ/ai/src/analysis/embeddings.js', () => ({
    generateEmbedding: vi.fn(async (text: string) => deterministicEmbedding(text)),
  }))
}
```

- [ ] **Step 2: Write `baml-support.mock.ts`**

```ts
import { vi } from 'vitest'

export interface SupportIntentMock {
  intent: string
  topic: string
  sensitivity: 'low' | 'medium' | 'high'
  customerSentiment: 'positive' | 'neutral' | 'negative'
  confidence: number
}

export interface SupportReplyMock {
  reply: string
  citedChunkIds: string[]
  confidence: number
  shouldEscalate: boolean
  reason: string | null
}

export interface SupportResolutionMock {
  resolved: boolean
  confidence: number
  reason: string
}

/**
 * Returns three configurable mock functions matching the b.* BAML interface.
 * Tests wire these via vi.mock('@customerEQ/ai/src/support/intent.js', () => ({...}))
 * patterns — see supportOrchestration.test.ts for usage.
 */
export function makeSupportBamlMocks(defaults?: {
  intent?: Partial<SupportIntentMock>
  reply?: Partial<SupportReplyMock>
  resolution?: Partial<SupportResolutionMock>
}) {
  const classifyIntent = vi.fn<[unknown], Promise<SupportIntentMock>>(async () => ({
    intent: 'unknown',
    topic: 'general',
    sensitivity: 'low',
    customerSentiment: 'neutral',
    confidence: 0.9,
    ...defaults?.intent,
  }))

  const draftReply = vi.fn<[unknown], Promise<SupportReplyMock>>(async () => ({
    reply: 'Mocked reply.',
    citedChunkIds: [],
    confidence: 0.9,
    shouldEscalate: false,
    reason: null,
    ...defaults?.reply,
  }))

  const classifyResolution = vi.fn<[unknown], Promise<SupportResolutionMock>>(async () => ({
    resolved: false,
    confidence: 0.5,
    reason: 'mocked',
    ...defaults?.resolution,
  }))

  return { classifyIntent, draftReply, classifyResolution }
}
```

- [ ] **Step 3: Re-export from `packages/config/src/test-utils/mocks/index.ts`**

(If the index doesn't exist, create with:)

```ts
export * from './openaiEmbed.mock.js'
export * from './baml-support.mock.js'
```

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter @customerEQ/config typecheck
```

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add packages/config/src/test-utils/mocks/
git commit -m "test-utils: add openaiEmbed + BAML support mocks (deterministic, configurable defaults)"
```

---

## Task 11: BAML function — `ClassifySupportIntent`

**Files:**
- Create: `packages/ai/baml_src/support_intent.baml`
- Create: `packages/ai/src/support/intent.ts`
- Create: `packages/ai/src/support/intent.test.ts`

- [ ] **Step 1: Write the failing wrapper test**

`packages/ai/src/support/intent.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const bamlMock = vi.hoisted(() => ({
  b: {
    ClassifySupportIntent: vi.fn(),
  },
}))

vi.mock('../../baml_client/index.js', () => bamlMock)

import { classifySupportIntent } from './intent.js'

beforeEach(() => {
  bamlMock.b.ClassifySupportIntent.mockReset()
})

describe('classifySupportIntent', () => {
  it('passes message + history through to BAML and returns the result', async () => {
    bamlMock.b.ClassifySupportIntent.mockResolvedValue({
      intent: 'shipping_question',
      topic: 'international_shipping',
      sensitivity: 'low',
      customer_sentiment: 'neutral',
      confidence: 0.92,
    })

    const result = await classifySupportIntent({
      message: 'Do you ship to Canada?',
      history: [{ role: 'CUSTOMER', content: 'hello' }],
    })

    expect(bamlMock.b.ClassifySupportIntent).toHaveBeenCalledWith(
      'Do you ship to Canada?',
      [{ role: 'CUSTOMER', content: 'hello' }],
    )
    expect(result).toEqual({
      intent: 'shipping_question',
      topic: 'international_shipping',
      sensitivity: 'low',
      customerSentiment: 'neutral',
      confidence: 0.92,
    })
  })
})
```

- [ ] **Step 2: Run; expect failure**

```bash
pnpm --filter @customerEQ/ai test src/support/intent.test.ts
```

Expected: FAIL — `intent.ts` doesn't exist.

- [ ] **Step 3: Write the BAML function**

`packages/ai/baml_src/support_intent.baml`:

```baml
class SupportIntent {
  intent string                  @description("snake_case intent label, e.g. shipping_question, refund_request, order_status, account_login, billing_dispute, returns, complaint, other")
  topic string                   @description("snake_case topic label, e.g. international_shipping, refunds, password_reset")
  sensitivity "low" | "medium" | "high"
  customer_sentiment "positive" | "neutral" | "negative"
  confidence float               @description("0.0 - 1.0")
}

class SupportHistoryMessage {
  role "CUSTOMER" | "AI" | "AGENT"
  content string
}

function ClassifySupportIntent(message: string, history: SupportHistoryMessage[]) -> SupportIntent {
  client GPT4oMini
  prompt #"
    You are classifying a customer support message for triage.

    Given the latest customer message and the prior conversation history,
    output a strict JSON object matching the SupportIntent schema.

    Guidelines:
    - Use snake_case for intent and topic.
    - sensitivity = "high" for: refunds, account cancellation, billing disputes,
      legal complaints, anything involving money owed to the customer, anything PII-sensitive.
    - sensitivity = "low" for FAQ-style queries (shipping, hours, store locations).
    - confidence is your calibrated belief, not a fixed value.

    Conversation history (oldest first):
    {{ history }}

    Latest customer message:
    {{ message }}

    {{ ctx.output_format }}
  "#
}

test classifyShipping {
  functions [ClassifySupportIntent]
  args {
    message "Do you ship to Canada?"
    history []
  }
}

test classifyRefund {
  functions [ClassifySupportIntent]
  args {
    message "I want a refund for order #1234"
    history []
  }
}
```

- [ ] **Step 4: Write the TS wrapper**

`packages/ai/src/support/intent.ts`:

```ts
import { b } from '../../baml_client/index.js'

export interface ClassifySupportIntentInput {
  message: string
  history: Array<{ role: 'CUSTOMER' | 'AI' | 'AGENT'; content: string }>
}

export interface ClassifySupportIntentResult {
  intent: string
  topic: string
  sensitivity: 'low' | 'medium' | 'high'
  customerSentiment: 'positive' | 'neutral' | 'negative'
  confidence: number
}

export async function classifySupportIntent(
  input: ClassifySupportIntentInput,
): Promise<ClassifySupportIntentResult> {
  const raw = await b.ClassifySupportIntent(input.message, input.history)
  return {
    intent: raw.intent,
    topic: raw.topic,
    sensitivity: raw.sensitivity,
    customerSentiment: raw.customer_sentiment,
    confidence: raw.confidence,
  }
}
```

- [ ] **Step 5: Regenerate the BAML client**

```bash
pnpm generate:baml
```

Expected: `packages/ai/baml_client/` updates with the new `ClassifySupportIntent` function.

- [ ] **Step 6: Run wrapper test; expect pass**

```bash
pnpm --filter @customerEQ/ai test src/support/intent.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/ai/baml_src/support_intent.baml packages/ai/baml_client/ packages/ai/src/support/intent.ts packages/ai/src/support/intent.test.ts
git commit -m "ai: ClassifySupportIntent BAML function + wrapper"
```

---

## Task 12: BAML function — `DraftSupportReply`

**Files:**
- Create: `packages/ai/baml_src/support_reply.baml`
- Create: `packages/ai/src/support/reply.ts`
- Create: `packages/ai/src/support/reply.test.ts`

- [ ] **Step 1: Write the failing wrapper test**

`packages/ai/src/support/reply.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const bamlMock = vi.hoisted(() => ({
  b: { DraftSupportReply: vi.fn() },
}))
vi.mock('../../baml_client/index.js', () => bamlMock)

import { draftSupportReply } from './reply.js'

beforeEach(() => bamlMock.b.DraftSupportReply.mockReset())

describe('draftSupportReply', () => {
  it('forwards chunks + history + brand voice to BAML, returns shaped result', async () => {
    bamlMock.b.DraftSupportReply.mockResolvedValue({
      reply: 'Yes, we ship to Canada.',
      cited_chunk_ids: ['c1', 'c3'],
      confidence: 0.88,
      should_escalate: false,
      reason: null,
    })

    const result = await draftSupportReply({
      message: 'Do you ship to Canada?',
      history: [],
      kbChunks: [
        { id: 'c1', articleId: 'a1', chunkIndex: 0, content: 'We ship to Canada via UPS.', similarity: 0.91 },
        { id: 'c3', articleId: 'a1', chunkIndex: 2, content: 'Delivery 5-7 business days.', similarity: 0.78 },
      ],
      customer360: null,
      brandVoice: 'Friendly and concise. Use "we" not "the company".',
    })

    expect(bamlMock.b.DraftSupportReply).toHaveBeenCalledOnce()
    expect(result).toEqual({
      reply: 'Yes, we ship to Canada.',
      citedChunkIds: ['c1', 'c3'],
      confidence: 0.88,
      shouldEscalate: false,
      reason: null,
    })
  })
})
```

- [ ] **Step 2: Run; expect failure**

```bash
pnpm --filter @customerEQ/ai test src/support/reply.test.ts
```

Expected: FAIL.

- [ ] **Step 3: BAML function**

`packages/ai/baml_src/support_reply.baml`:

```baml
class SupportKBChunk {
  id string
  article_id string
  chunk_index int
  content string
  similarity float
}

class SupportCustomer360 {
  member_id string
  email string?
  current_tier string?
  points_balance int?
  recent_order_summary string?
}

class SupportReply {
  reply string                       @description("the actual reply text. May be empty if should_escalate is true.")
  cited_chunk_ids string[]           @description("ids of SupportKBChunks actually used to ground the reply")
  confidence float                   @description("0.0 - 1.0 calibrated confidence in the reply's correctness")
  should_escalate bool               @description("true if the reply requires human review (sensitive action, missing info, etc.)")
  reason string?                     @description("required when should_escalate is true")
}

function DraftSupportReply(
  message: string,
  history: SupportHistoryMessage[],
  kb_chunks: SupportKBChunk[],
  customer360: SupportCustomer360?,
  brand_voice: string,
) -> SupportReply {
  client GPT4o
  prompt #"
    You are drafting a customer support reply. You MUST ground the reply in
    the provided KB chunks. Do not fabricate prices, URLs, policies, dates,
    or product details that are not in the chunks. If the chunks do not
    cover the question, set should_escalate=true and leave reply empty
    (or set it to a polite "let me hand you to a human" message).

    Brand voice: {{ brand_voice }}

    {% if customer360 %}
    Customer context:
    - Tier: {{ customer360.current_tier }}
    - Points: {{ customer360.points_balance }}
    {% endif %}

    Conversation history (oldest first):
    {{ history }}

    KB chunks (most relevant first):
    {{ kb_chunks }}

    Latest customer message:
    {{ message }}

    Cite the chunk IDs you used in cited_chunk_ids. {{ ctx.output_format }}
  "#
}

test draftShippingReply {
  functions [DraftSupportReply]
  args {
    message "Do you ship to Canada?"
    history []
    kb_chunks [
      { id "c1" article_id "a1" chunk_index 0 content "We ship to Canada via UPS, 5-7 business days." similarity 0.91 }
    ]
    customer360 null
    brand_voice "Friendly and concise."
  }
}
```

- [ ] **Step 4: TS wrapper**

`packages/ai/src/support/reply.ts`:

```ts
import { b } from '../../baml_client/index.js'

export interface KBChunkForReply {
  id: string
  articleId: string
  chunkIndex: number
  content: string
  similarity: number
}

export interface Customer360 {
  memberId: string
  email: string | null
  currentTier: string | null
  pointsBalance: number | null
  recentOrderSummary: string | null
}

export interface DraftSupportReplyInput {
  message: string
  history: Array<{ role: 'CUSTOMER' | 'AI' | 'AGENT'; content: string }>
  kbChunks: KBChunkForReply[]
  customer360: Customer360 | null
  brandVoice: string
}

export interface DraftSupportReplyResult {
  reply: string
  citedChunkIds: string[]
  confidence: number
  shouldEscalate: boolean
  reason: string | null
}

export async function draftSupportReply(
  input: DraftSupportReplyInput,
): Promise<DraftSupportReplyResult> {
  const raw = await b.DraftSupportReply(
    input.message,
    input.history,
    input.kbChunks.map((c) => ({
      id: c.id,
      article_id: c.articleId,
      chunk_index: c.chunkIndex,
      content: c.content,
      similarity: c.similarity,
    })),
    input.customer360
      ? {
          member_id: input.customer360.memberId,
          email: input.customer360.email,
          current_tier: input.customer360.currentTier,
          points_balance: input.customer360.pointsBalance,
          recent_order_summary: input.customer360.recentOrderSummary,
        }
      : null,
    input.brandVoice,
  )
  return {
    reply: raw.reply,
    citedChunkIds: raw.cited_chunk_ids,
    confidence: raw.confidence,
    shouldEscalate: raw.should_escalate,
    reason: raw.reason,
  }
}
```

- [ ] **Step 5: Regenerate BAML client + run test**

```bash
pnpm generate:baml
pnpm --filter @customerEQ/ai test src/support/reply.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/ai/baml_src/support_reply.baml packages/ai/baml_client/ packages/ai/src/support/reply.ts packages/ai/src/support/reply.test.ts
git commit -m "ai: DraftSupportReply BAML function + wrapper"
```

---

## Task 13: BAML function — `ClassifyResolution`

**Files:**
- Create: `packages/ai/baml_src/support_resolution.baml`
- Create: `packages/ai/src/support/resolution.ts`
- Create: `packages/ai/src/support/resolution.test.ts`

- [ ] **Step 1: Failing wrapper test**

`packages/ai/src/support/resolution.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const bamlMock = vi.hoisted(() => ({
  b: { ClassifyResolution: vi.fn() },
}))
vi.mock('../../baml_client/index.js', () => bamlMock)

import { classifyResolution } from './resolution.js'

beforeEach(() => bamlMock.b.ClassifyResolution.mockReset())

describe('classifyResolution', () => {
  it('returns resolved + confidence + reason', async () => {
    bamlMock.b.ClassifyResolution.mockResolvedValue({
      resolved: true,
      confidence: 0.85,
      reason: 'customer said "thanks, that worked"',
    })

    const result = await classifyResolution({
      messages: [
        { role: 'CUSTOMER', content: 'how do I reset my password?' },
        { role: 'AI', content: 'click "forgot password" on the login page.' },
        { role: 'CUSTOMER', content: 'thanks, that worked' },
      ],
      hoursSinceLast: 26,
    })

    expect(result).toEqual({
      resolved: true,
      confidence: 0.85,
      reason: 'customer said "thanks, that worked"',
    })
  })
})
```

- [ ] **Step 2: Run, expect failure**

```bash
pnpm --filter @customerEQ/ai test src/support/resolution.test.ts
```

- [ ] **Step 3: BAML function**

`packages/ai/baml_src/support_resolution.baml`:

```baml
class SupportResolution {
  resolved bool                @description("true only when the customer's issue is clearly handled or the customer indicated they no longer need help")
  confidence float             @description("0.0 - 1.0; bias toward NOT resolving when ambiguous — false positives award points incorrectly")
  reason string                @description("one sentence rationale for the decision")
}

function ClassifyResolution(messages: SupportHistoryMessage[], hours_since_last: float) -> SupportResolution {
  client GPT4oMini
  prompt #"
    You are deciding whether a customer support conversation has been
    resolved, based on the message history. A conversation is RESOLVED
    when the customer's question has been answered AND the customer
    either (a) explicitly acknowledged ("thanks, that worked"), (b) stopped
    replying for >24h after a clear answer, or (c) marked it themselves.

    A conversation is NOT resolved when: the answer was partial; the customer
    raised a follow-up; the agent promised to follow up later; the question
    requires action that's still pending (e.g. "I'll process your refund").

    Bias toward NOT resolved when ambiguous. False positives award loyalty
    points incorrectly. Confidence below 0.7 should never be acted on.

    Hours since the last message: {{ hours_since_last }}

    Messages (oldest first):
    {{ messages }}

    {{ ctx.output_format }}
  "#
}

test resolutionThanksThatWorked {
  functions [ClassifyResolution]
  args {
    messages [
      { role "CUSTOMER" content "how do I reset my password?" }
      { role "AI" content "click forgot password on the login page" }
      { role "CUSTOMER" content "thanks, that worked" }
    ]
    hours_since_last 26.0
  }
}
```

- [ ] **Step 4: TS wrapper**

`packages/ai/src/support/resolution.ts`:

```ts
import { b } from '../../baml_client/index.js'

export interface ClassifyResolutionInput {
  messages: Array<{ role: 'CUSTOMER' | 'AI' | 'AGENT'; content: string }>
  hoursSinceLast: number
}

export interface ClassifyResolutionResult {
  resolved: boolean
  confidence: number
  reason: string
}

export async function classifyResolution(
  input: ClassifyResolutionInput,
): Promise<ClassifyResolutionResult> {
  const raw = await b.ClassifyResolution(input.messages, input.hoursSinceLast)
  return {
    resolved: raw.resolved,
    confidence: raw.confidence,
    reason: raw.reason,
  }
}
```

- [ ] **Step 5: Regenerate + test**

```bash
pnpm generate:baml
pnpm --filter @customerEQ/ai test src/support/resolution.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/ai/baml_src/support_resolution.baml packages/ai/baml_client/ packages/ai/src/support/resolution.ts packages/ai/src/support/resolution.test.ts
git commit -m "ai: ClassifyResolution BAML function + wrapper"
```

---

## Task 14: BAML eval tests (real LLM)

**Files:**
- Create: `packages/ai/tests/baml-evals/support_intent.eval.test.ts`
- Create: `packages/ai/tests/baml-evals/support_reply.eval.test.ts`
- Create: `packages/ai/tests/baml-evals/support_resolution.eval.test.ts`

> Per repo rule: tests must NEVER skip. If `AZURE_OPENAI_API_KEY` (the env var the existing BAML clients consume) is missing, these MUST fail loudly. The pattern below throws at the top of `beforeAll`.

- [ ] **Step 1: Write the intent eval test**

`packages/ai/tests/baml-evals/support_intent.eval.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { classifySupportIntent } from '../../src/support/intent.js'

const cases: Array<{
  message: string
  expectIntent: string
  expectSensitivity: 'low' | 'medium' | 'high'
}> = [
  { message: 'Do you ship to Canada?', expectIntent: 'shipping_question', expectSensitivity: 'low' },
  { message: 'What are your hours?', expectIntent: 'store_hours', expectSensitivity: 'low' },
  { message: 'Where is my order #1234?', expectIntent: 'order_status', expectSensitivity: 'low' },
  { message: 'I want a refund for order #1234', expectIntent: 'refund_request', expectSensitivity: 'high' },
  { message: 'Cancel my account', expectIntent: 'account_cancellation', expectSensitivity: 'high' },
  { message: 'I was double-charged', expectIntent: 'billing_dispute', expectSensitivity: 'high' },
  { message: 'How do I return this item?', expectIntent: 'returns', expectSensitivity: 'medium' },
  { message: 'Reset my password please', expectIntent: 'password_reset', expectSensitivity: 'medium' },
  { message: 'Your product broke after one day, this is unacceptable', expectIntent: 'complaint', expectSensitivity: 'high' },
  { message: 'Just wanted to say thank you for the great service', expectIntent: 'compliment', expectSensitivity: 'low' },
  { message: 'Do you have this in red?', expectIntent: 'product_inquiry', expectSensitivity: 'low' },
  { message: 'Why was my coupon code rejected?', expectIntent: 'promo_code_issue', expectSensitivity: 'medium' },
  { message: 'My subscription renewed without notice', expectIntent: 'billing_dispute', expectSensitivity: 'high' },
  { message: 'Where do I download my invoice?', expectIntent: 'invoice_request', expectSensitivity: 'low' },
  { message: 'How do I change my shipping address?', expectIntent: 'account_update', expectSensitivity: 'medium' },
  { message: 'Item arrived broken', expectIntent: 'damaged_item', expectSensitivity: 'high' },
  { message: 'Can I exchange size M for L?', expectIntent: 'exchange_request', expectSensitivity: 'medium' },
  { message: 'Do you offer student discounts?', expectIntent: 'discount_inquiry', expectSensitivity: 'low' },
  { message: 'Privacy policy question', expectIntent: 'privacy_inquiry', expectSensitivity: 'medium' },
  { message: 'I would like to delete my account and all my data', expectIntent: 'data_deletion_request', expectSensitivity: 'high' },
  { message: 'Quick question about gift cards', expectIntent: 'gift_card_inquiry', expectSensitivity: 'low' },
  { message: 'Order placed yesterday hasn’t shipped', expectIntent: 'order_status', expectSensitivity: 'low' },
  { message: 'Wrong item delivered', expectIntent: 'wrong_item', expectSensitivity: 'high' },
  { message: 'Can I add a gift note?', expectIntent: 'gifting_question', expectSensitivity: 'low' },
  { message: 'Loyalty program tier question', expectIntent: 'loyalty_inquiry', expectSensitivity: 'low' },
  { message: 'Can a human help me please', expectIntent: 'agent_request', expectSensitivity: 'medium' },
  { message: 'I think my card was charged twice', expectIntent: 'billing_dispute', expectSensitivity: 'high' },
  { message: 'What payment methods do you accept?', expectIntent: 'payment_methods', expectSensitivity: 'low' },
  { message: 'Do you ship to Australia?', expectIntent: 'shipping_question', expectSensitivity: 'low' },
  { message: 'How do I track my package?', expectIntent: 'order_status', expectSensitivity: 'low' },
]

beforeAll(() => {
  if (!process.env.AZURE_OPENAI_API_KEY || !process.env.AZURE_OPENAI_BASE_URL) {
    throw new Error('AZURE_OPENAI_API_KEY and AZURE_OPENAI_BASE_URL must be set for BAML eval tests — these tests do not skip')
  }
})

describe('eval: ClassifySupportIntent', () => {
  it('hits ≥90% intent accuracy and ≥85% sensitivity accuracy across the labeled set', async () => {
    let intentHits = 0
    let sensitivityHits = 0

    for (const c of cases) {
      const r = await classifySupportIntent({ message: c.message, history: [] })
      if (r.intent === c.expectIntent) intentHits++
      if (r.sensitivity === c.expectSensitivity) sensitivityHits++
    }

    const intentAcc = intentHits / cases.length
    const sensAcc = sensitivityHits / cases.length

    // eslint-disable-next-line no-console
    console.log(`Intent: ${intentHits}/${cases.length} (${(intentAcc * 100).toFixed(1)}%) | Sensitivity: ${sensitivityHits}/${cases.length} (${(sensAcc * 100).toFixed(1)}%)`)

    expect(intentAcc).toBeGreaterThanOrEqual(0.9)
    expect(sensAcc).toBeGreaterThanOrEqual(0.85)
  }, 120_000)
})
```

- [ ] **Step 2: Write the reply eval test**

`packages/ai/tests/baml-evals/support_reply.eval.test.ts`:

Cover: (1) reply uses a cited chunk when one is relevant; (2) reply escalates when chunks don't cover the question; (3) reply doesn't fabricate URLs/prices not in chunks.

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { draftSupportReply } from '../../src/support/reply.js'

beforeAll(() => {
  if (!process.env.AZURE_OPENAI_API_KEY || !process.env.AZURE_OPENAI_BASE_URL) {
    throw new Error('AZURE_OPENAI_API_KEY and AZURE_OPENAI_BASE_URL must be set for BAML eval tests')
  }
})

describe('eval: DraftSupportReply', () => {
  it('grounds the reply in provided KB chunks and cites them', async () => {
    const r = await draftSupportReply({
      message: 'Do you ship to Canada?',
      history: [],
      kbChunks: [
        { id: 'c1', articleId: 'a1', chunkIndex: 0, content: 'We ship to Canada via UPS Ground, typically 5-7 business days.', similarity: 0.91 },
        { id: 'c2', articleId: 'a2', chunkIndex: 0, content: 'Returns must be initiated within 30 days.', similarity: 0.41 },
      ],
      customer360: null,
      brandVoice: 'Friendly and concise.',
    })
    expect(r.shouldEscalate).toBe(false)
    expect(r.citedChunkIds).toContain('c1')
    expect(r.reply.toLowerCase()).toMatch(/canada/)
  }, 60_000)

  it('escalates when chunks do not cover the question', async () => {
    const r = await draftSupportReply({
      message: 'Can you process my refund for the laptop I bought three years ago?',
      history: [],
      kbChunks: [
        { id: 'c1', articleId: 'a1', chunkIndex: 0, content: 'Standard refund window is 30 days from purchase.', similarity: 0.55 },
      ],
      customer360: null,
      brandVoice: 'Friendly and concise.',
    })
    expect(r.shouldEscalate).toBe(true)
    expect(r.reason).toBeTruthy()
  }, 60_000)

  it('does not fabricate a price or URL that is not in the chunks', async () => {
    const r = await draftSupportReply({
      message: 'How much does shipping cost?',
      history: [],
      kbChunks: [
        { id: 'c1', articleId: 'a1', chunkIndex: 0, content: 'We offer free shipping on orders over a certain threshold.', similarity: 0.8 },
      ],
      customer360: null,
      brandVoice: 'Friendly and concise.',
    })
    // The chunk does NOT specify a dollar amount — the reply must not invent one
    expect(r.reply).not.toMatch(/\$\d+/)
    expect(r.reply).not.toMatch(/https?:\/\//)
  }, 60_000)
})
```

- [ ] **Step 3: Write the resolution eval test**

`packages/ai/tests/baml-evals/support_resolution.eval.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { classifyResolution } from '../../src/support/resolution.js'

beforeAll(() => {
  if (!process.env.AZURE_OPENAI_API_KEY || !process.env.AZURE_OPENAI_BASE_URL) {
    throw new Error('AZURE_OPENAI_API_KEY and AZURE_OPENAI_BASE_URL must be set for BAML eval tests')
  }
})

const cases: Array<{
  label: string
  messages: Array<{ role: 'CUSTOMER' | 'AI' | 'AGENT'; content: string }>
  hoursSinceLast: number
  expectResolved: boolean
}> = [
  {
    label: 'thanks-that-worked',
    messages: [
      { role: 'CUSTOMER', content: 'how do I reset my password?' },
      { role: 'AI', content: 'click forgot password on the login page' },
      { role: 'CUSTOMER', content: 'thanks, that worked' },
    ],
    hoursSinceLast: 26,
    expectResolved: true,
  },
  {
    label: 'follow-up-pending',
    messages: [
      { role: 'CUSTOMER', content: 'I want a refund' },
      { role: 'AGENT', content: "I'll process that and you should see it in 3-5 days" },
    ],
    hoursSinceLast: 26,
    expectResolved: false,
  },
  {
    label: 'silent-after-clear-answer',
    messages: [
      { role: 'CUSTOMER', content: 'do you ship to Canada?' },
      { role: 'AI', content: 'yes, via UPS, 5-7 days' },
    ],
    hoursSinceLast: 48,
    expectResolved: true,
  },
  // ... at least 17 more — see eval set in spec §8. Engineer must add the rest before
  // pass-bar accuracy can be measured. Minimum 20 cases.
]

describe('eval: ClassifyResolution', () => {
  it('hits ≥85% accuracy with <5% false-resolved rate', async () => {
    if (cases.length < 20) throw new Error(`Eval set has ${cases.length} cases; need ≥20 for statistical sanity`)
    let correct = 0
    let falseResolved = 0
    let actualResolved = 0

    for (const c of cases) {
      const r = await classifyResolution({ messages: c.messages, hoursSinceLast: c.hoursSinceLast })
      if (r.resolved === c.expectResolved) correct++
      if (r.resolved && !c.expectResolved) falseResolved++
      if (!c.expectResolved) actualResolved++
    }

    const acc = correct / cases.length
    const fpRate = actualResolved > 0 ? falseResolved / actualResolved : 0
    // eslint-disable-next-line no-console
    console.log(`Resolution acc: ${(acc * 100).toFixed(1)}% | False-resolved rate: ${(fpRate * 100).toFixed(1)}%`)

    expect(acc).toBeGreaterThanOrEqual(0.85)
    expect(fpRate).toBeLessThan(0.05)
  }, 180_000)
})
```

> **Action item before merging Slice 1:** the engineer MUST extend the resolution eval set to ≥20 labeled cases. The placeholder list is intentionally short to force this — don't ship a P0 false-resolved metric on 3 examples.

- [ ] **Step 4: Run evals (requires Azure OpenAI keys in env)**

```bash
pnpm test:baml
```

Expected: passes if the eval bar is met. If accuracy < bar, iterate on the prompts in the BAML files until it passes — that's the eval's job.

- [ ] **Step 5: Commit**

```bash
git add packages/ai/tests/baml-evals/
git commit -m "ai: BAML eval tests for support intent / reply / resolution (real LLM, no-skip)"
```

---

## Task 15: Per-conversationId Redis lock

**Files:**
- Create: `apps/worker/src/lib/conversationLock.ts`
- Create: `apps/worker/src/lib/conversationLock.test.ts`

- [ ] **Step 1: Failing test**

`apps/worker/src/lib/conversationLock.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { withConversationLock } from './conversationLock.js'

interface FakeRedis {
  set: ReturnType<typeof vi.fn>
  del: ReturnType<typeof vi.fn>
}

function makeRedis(setReturns: Array<'OK' | null>): FakeRedis {
  const setMock = vi.fn()
  setReturns.forEach((v) => setMock.mockResolvedValueOnce(v))
  return { set: setMock, del: vi.fn().mockResolvedValue(1) }
}

beforeEach(() => vi.useRealTimers())

describe('withConversationLock', () => {
  it('runs the task when the lock is acquired on first try', async () => {
    const redis = makeRedis(['OK'])
    const task = vi.fn().mockResolvedValue('done')
    const result = await withConversationLock(redis as never, 'conv1', task, { ttlMs: 30000, retryDelayMs: 10, maxRetries: 0 })
    expect(result).toBe('done')
    expect(task).toHaveBeenCalledOnce()
    expect(redis.set).toHaveBeenCalledWith('lock:conv:conv1', expect.any(String), 'PX', 30000, 'NX')
    expect(redis.del).toHaveBeenCalledOnce()
  })

  it('retries when the lock is held, then succeeds', async () => {
    const redis = makeRedis([null, null, 'OK'])
    const task = vi.fn().mockResolvedValue('done')
    const result = await withConversationLock(redis as never, 'conv1', task, { ttlMs: 30000, retryDelayMs: 1, maxRetries: 5 })
    expect(result).toBe('done')
    expect(redis.set).toHaveBeenCalledTimes(3)
  })

  it('throws when max retries exhausted', async () => {
    const redis = makeRedis([null, null, null])
    await expect(
      withConversationLock(redis as never, 'conv1', vi.fn(), { ttlMs: 30000, retryDelayMs: 1, maxRetries: 2 }),
    ).rejects.toThrow(/could not acquire/i)
  })

  it('releases the lock even if the task throws', async () => {
    const redis = makeRedis(['OK'])
    const task = vi.fn().mockRejectedValue(new Error('boom'))
    await expect(withConversationLock(redis as never, 'conv1', task, { ttlMs: 30000, retryDelayMs: 1, maxRetries: 0 })).rejects.toThrow('boom')
    expect(redis.del).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run, expect failure**

```bash
pnpm --filter @customerEQ/worker test src/lib/conversationLock.test.ts
```

- [ ] **Step 3: Implementation**

`apps/worker/src/lib/conversationLock.ts`:

```ts
import type Redis from 'ioredis'
import { randomUUID } from 'node:crypto'

export interface ConversationLockOptions {
  ttlMs: number
  retryDelayMs: number
  maxRetries: number
}

export async function withConversationLock<T>(
  redis: Redis,
  conversationId: string,
  task: () => Promise<T>,
  opts: ConversationLockOptions,
): Promise<T> {
  const key = `lock:conv:${conversationId}`
  const token = randomUUID()

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    const ok = await redis.set(key, token, 'PX', opts.ttlMs, 'NX')
    if (ok === 'OK') {
      try {
        return await task()
      } finally {
        try {
          await redis.del(key)
        } catch {
          // best effort; TTL will reclaim
        }
      }
    }
    if (attempt < opts.maxRetries) {
      await new Promise((r) => setTimeout(r, opts.retryDelayMs))
    }
  }

  throw new Error(`Could not acquire conversation lock for ${conversationId} after ${opts.maxRetries + 1} attempts`)
}
```

- [ ] **Step 4: Run; expect pass**

```bash
pnpm --filter @customerEQ/worker test src/lib/conversationLock.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/lib/
git commit -m "worker: per-conversationId Redis lock helper (SET NX PX + token)"
```

---

## Task 16: `supportOrchestration` processor — skeleton + AUTO_REPLY branch (TDD)

**Files:**
- Create: `apps/worker/src/processors/supportOrchestration.ts`
- Create: `apps/worker/src/processors/supportOrchestration.test.ts`

- [ ] **Step 1: Failing unit test — AUTO_REPLY happy path**

`apps/worker/src/processors/supportOrchestration.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoisted mocks — all upstream deps before processor import.
const prismaMock = vi.hoisted(() => ({
  conversation: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
  message: { findMany: vi.fn(), create: vi.fn() },
  supportRule: { findMany: vi.fn() },
  member: { findUnique: vi.fn() },
  brand: { findUnique: vi.fn() },
  $queryRaw: vi.fn(),
}))
vi.mock('@customerEQ/database', () => ({ prisma: prismaMock }))

const aiMock = vi.hoisted(() => ({
  classifySupportIntent: vi.fn(),
  draftSupportReply: vi.fn(),
}))
vi.mock('@customerEQ/ai/src/support/intent.js', () => ({ classifySupportIntent: aiMock.classifySupportIntent }))
vi.mock('@customerEQ/ai/src/support/reply.js', () => ({ draftSupportReply: aiMock.draftSupportReply }))

const embedMock = vi.hoisted(() => ({ generateEmbedding: vi.fn() }))
vi.mock('@customerEQ/ai/src/analysis/embeddings.js', () => embedMock)

const lockMock = vi.hoisted(() => ({ withConversationLock: vi.fn((_r, _c, task) => task()) }))
vi.mock('../lib/conversationLock.js', () => lockMock)

import { processSupportOrchestration } from './supportOrchestration.js'

beforeEach(() => {
  Object.values(prismaMock).forEach((v) => {
    if (typeof v === 'function') (v as ReturnType<typeof vi.fn>).mockReset()
    else Object.values(v).forEach((fn) => (fn as ReturnType<typeof vi.fn>).mockReset())
  })
  aiMock.classifySupportIntent.mockReset()
  aiMock.draftSupportReply.mockReset()
  embedMock.generateEmbedding.mockReset()
  lockMock.withConversationLock.mockClear()
})

const baseJob = {
  data: {
    conversationId: 'conv1',
    brandId: 'brand1',
    memberId: 'member1',
    messageId: 'msg1',
    messageContent: 'Do you ship to Canada?',
  },
} as never

describe('supportOrchestration processor — AUTO_REPLY', () => {
  it('writes an AI message when intent matches an AUTO_REPLY rule and confidence ≥ threshold', async () => {
    prismaMock.conversation.findUniqueOrThrow.mockResolvedValue({
      id: 'conv1', brandId: 'brand1', memberId: 'member1', status: 'ACTIVE',
    })
    prismaMock.message.findMany.mockResolvedValue([
      { role: 'CUSTOMER', content: 'Do you ship to Canada?' },
    ])
    prismaMock.supportRule.findMany.mockResolvedValue([
      {
        id: 'r1', status: 'ACTIVE', priority: 0,
        intentFilters: ['shipping_question'], tierFilters: [],
        healthScoreMin: null, healthScoreMax: null,
        topicFilters: [], conditions: {},
        actionMode: 'AUTO_REPLY', confidenceThreshold: 0.8,
        autoRespondArticleId: null, escalateToAssignee: null,
        awardPoints: null, triggerSurveyId: null,
      },
    ])
    prismaMock.member.findUnique.mockResolvedValue({
      id: 'member1', currentTier: 'GOLD', pointsBalance: 100,
      email: 'a@b.com', firstName: 'A', lastName: 'B',
    })
    prismaMock.brand.findUnique.mockResolvedValue({ id: 'brand1', name: 'BrandX' })

    aiMock.classifySupportIntent.mockResolvedValue({
      intent: 'shipping_question', topic: 'international_shipping',
      sensitivity: 'low', customerSentiment: 'neutral', confidence: 0.92,
    })
    embedMock.generateEmbedding.mockResolvedValue(new Array(1536).fill(0.1))
    prismaMock.$queryRaw.mockResolvedValue([
      { id: 'c1', articleId: 'a1', chunkIndex: 0, content: 'We ship to Canada via UPS', similarity: 0.91 },
    ])
    aiMock.draftSupportReply.mockResolvedValue({
      reply: 'Yes, we ship to Canada.',
      citedChunkIds: ['c1'], confidence: 0.88,
      shouldEscalate: false, reason: null,
    })
    prismaMock.message.create.mockResolvedValue({ id: 'aimsg1' })

    await processSupportOrchestration(baseJob)

    expect(prismaMock.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          conversationId: 'conv1',
          role: 'AI',
          content: 'Yes, we ship to Canada.',
          aiConfidence: 0.88,
          aiSources: ['c1'],
          draftedByAi: false,
        }),
      }),
    )
    expect(lockMock.withConversationLock).toHaveBeenCalledOnce()
  })

  it('falls through AUTO_REPLY when confidence < rule threshold (drops to ESCALATE if next rule)', async () => {
    prismaMock.conversation.findUniqueOrThrow.mockResolvedValue({
      id: 'conv1', brandId: 'brand1', memberId: 'member1', status: 'ACTIVE',
    })
    prismaMock.message.findMany.mockResolvedValue([{ role: 'CUSTOMER', content: '?' }])
    prismaMock.supportRule.findMany.mockResolvedValue([
      {
        id: 'r1', status: 'ACTIVE', priority: 0,
        intentFilters: ['shipping_question'], tierFilters: [],
        healthScoreMin: null, healthScoreMax: null, topicFilters: [], conditions: {},
        actionMode: 'AUTO_REPLY', confidenceThreshold: 0.9,
        autoRespondArticleId: null, escalateToAssignee: null,
        awardPoints: null, triggerSurveyId: null,
      },
      {
        id: 'r2', status: 'ACTIVE', priority: 1,
        intentFilters: ['shipping_question'], tierFilters: [],
        healthScoreMin: null, healthScoreMax: null, topicFilters: [], conditions: {},
        actionMode: 'ESCALATE', confidenceThreshold: 0,
        autoRespondArticleId: null, escalateToAssignee: 'user_x',
        awardPoints: null, triggerSurveyId: null,
      },
    ])
    prismaMock.member.findUnique.mockResolvedValue({ id: 'member1', currentTier: null, pointsBalance: 0, email: null, firstName: null, lastName: null })
    prismaMock.brand.findUnique.mockResolvedValue({ id: 'brand1', name: 'X' })
    aiMock.classifySupportIntent.mockResolvedValue({
      intent: 'shipping_question', topic: 't', sensitivity: 'low', customerSentiment: 'neutral', confidence: 0.7,
    })
    embedMock.generateEmbedding.mockResolvedValue(new Array(1536).fill(0))
    prismaMock.$queryRaw.mockResolvedValue([])
    aiMock.draftSupportReply.mockResolvedValue({
      reply: 'x', citedChunkIds: [], confidence: 0.7, shouldEscalate: false, reason: null,
    })

    await processSupportOrchestration(baseJob)

    // Did NOT write an AI customer-visible message
    const aiCalls = prismaMock.message.create.mock.calls.filter((c) => c[0].data.role === 'AI' && !c[0].data.draftedByAi)
    expect(aiCalls).toHaveLength(0)
    // DID escalate
    expect(prismaMock.conversation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ESCALATED', assignee: 'user_x' }),
      }),
    )
  })
})
```

- [ ] **Step 2: Run, expect failure**

```bash
pnpm --filter @customerEQ/worker test src/processors/supportOrchestration.test.ts
```

- [ ] **Step 3: Write the processor**

`apps/worker/src/processors/supportOrchestration.ts`:

```ts
import type { Job, ConnectionOptions } from 'bullmq'
import IORedis from 'ioredis'
import pino from 'pino'
import { prisma } from '@customerEQ/database'
import {
  evaluateSupportRules,
  type SupportRuleInput,
  type SupportRuleMatch,
  type SupportOrchestrationPayload,
  type KBChunkRetrieved,
} from '@customerEQ/shared'
import { classifySupportIntent } from '@customerEQ/ai/src/support/intent.js'
import { draftSupportReply } from '@customerEQ/ai/src/support/reply.js'
import { generateEmbedding } from '@customerEQ/ai/src/analysis/embeddings.js'
import { withConversationLock } from '../lib/conversationLock.js'

const logger = pino({ name: 'support-orchestration' })

const TOP_K = 5
const SIMILARITY_THRESHOLD = 0.7

// Lock options chosen to be safely longer than the slowest BAML round-trip + Postgres call.
const LOCK_TTL_MS = 60_000
const LOCK_RETRY_DELAY_MS = 250
const LOCK_MAX_RETRIES = 60 // up to ~15s of waiting before declaring a stuck lock

let _redis: IORedis | null = null
function getRedis(): IORedis {
  if (_redis) return _redis
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379'
  _redis = new IORedis(url, { maxRetriesPerRequest: null })
  return _redis
}

export function createSupportOrchestrationProcessor(_connection: ConnectionOptions) {
  return (job: Job<SupportOrchestrationPayload>) => processSupportOrchestration(job)
}

export async function processSupportOrchestration(
  job: Job<SupportOrchestrationPayload>,
): Promise<void> {
  const { conversationId, brandId, memberId, messageContent } = job.data
  const redis = getRedis()

  return withConversationLock(
    redis,
    conversationId,
    () => runOrchestration({ conversationId, brandId, memberId, messageContent }),
    { ttlMs: LOCK_TTL_MS, retryDelayMs: LOCK_RETRY_DELAY_MS, maxRetries: LOCK_MAX_RETRIES },
  )
}

interface OrchestrationCtx {
  conversationId: string
  brandId: string
  memberId: string | null
  messageContent: string
}

async function runOrchestration(ctx: OrchestrationCtx): Promise<void> {
  const { conversationId, brandId, memberId, messageContent } = ctx
  logger.info({ conversationId, brandId, memberId }, 'orchestration start')

  const conversation = await prisma.conversation.findUniqueOrThrow({
    where: { id: conversationId },
    select: { id: true, brandId: true, memberId: true, status: true },
  })
  if (conversation.brandId !== brandId) {
    throw new Error(`tenant mismatch: job brandId=${brandId} convo brandId=${conversation.brandId}`)
  }

  const history = (await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    select: { role: true, content: true },
  })) as Array<{ role: 'CUSTOMER' | 'AI' | 'AGENT'; content: string }>

  // 1. Intent
  const intent = await classifySupportIntent({ message: messageContent, history })
  logger.info({ conversationId, intent: intent.intent, sensitivity: intent.sensitivity, conf: intent.confidence }, 'intent classified')

  // 2. RAG retrieval
  const kbChunks = await retrieveKBChunks(brandId, messageContent)

  // 3. Customer360 (only if identified)
  const customer360 = memberId ? await loadCustomer360(memberId) : null

  // 4. Rule evaluation
  const rules = await prisma.supportRule.findMany({
    where: { brandId, status: 'ACTIVE' },
    orderBy: { priority: 'asc' },
  })
  const ruleInputs: SupportRuleInput[] = rules.map((r) => ({
    id: r.id,
    status: r.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
    priority: r.priority,
    intentFilters: r.intentFilters,
    tierFilters: r.tierFilters,
    healthScoreMin: r.healthScoreMin,
    healthScoreMax: r.healthScoreMax,
    topicFilters: r.topicFilters,
    conditions: (r.conditions ?? {}) as Record<string, unknown>,
    actionMode: r.actionMode,
    confidenceThreshold: r.confidenceThreshold,
    autoRespondArticleId: r.autoRespondArticleId,
    escalateToAssignee: r.escalateToAssignee,
    awardPoints: r.awardPoints,
    triggerSurveyId: r.triggerSurveyId,
  }))
  const ruleResult = evaluateSupportRules(ruleInputs, {
    intent: intent.intent,
    tier: customer360?.currentTier ?? null,
    healthScore: undefined,
    topics: [intent.topic],
  })

  // 5. Draft a reply (we always need this for AUTO_REPLY or DRAFT_FOR_AGENT)
  const brandRow = await prisma.brand.findUnique({ where: { id: brandId }, select: { name: true } })
  const brandVoice = `Friendly, concise, professional. Brand: ${brandRow?.name ?? 'this brand'}.`
  const draft = await draftSupportReply({
    message: messageContent,
    history,
    kbChunks,
    customer360,
    brandVoice,
  })

  // 6. Dispatch by tiered actionMode (first matched rule wins per priority order)
  for (const match of ruleResult.matchedRules) {
    if (await dispatchTier(match, { conversationId, intent, draft })) {
      logger.info({ conversationId, ruleId: match.ruleId, tier: match.actionMode }, 'dispatched')
      return
    }
  }

  // No matched rule with a viable tier — default behavior: escalate without an assignee
  logger.warn({ conversationId }, 'no rule produced a viable tier; defaulting to ESCALATE')
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { status: 'ESCALATED', escalatedAt: new Date() },
  })
}

async function dispatchTier(
  match: SupportRuleMatch,
  args: {
    conversationId: string
    intent: { intent: string; topic: string }
    draft: { reply: string; citedChunkIds: string[]; confidence: number; shouldEscalate: boolean }
  },
): Promise<boolean> {
  const { conversationId, intent, draft } = args
  switch (match.actionMode) {
    case 'AUTO_REPLY': {
      // Tier-specific guard: confidence must clear threshold; AI must not have flagged escalation
      if (draft.confidence < match.confidenceThreshold || draft.shouldEscalate) return false
      await prisma.message.create({
        data: {
          conversationId,
          role: 'AI',
          content: draft.reply,
          aiConfidence: draft.confidence,
          aiSources: draft.citedChunkIds,
          draftedByAi: false,
        },
      })
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { intent: intent.intent, topic: intent.topic, rulesMatched: { push: match.ruleId } },
      })
      return true
    }
    case 'DRAFT_FOR_AGENT': {
      await prisma.message.create({
        data: {
          conversationId,
          role: 'AI',
          content: draft.reply,
          aiConfidence: draft.confidence,
          aiSources: draft.citedChunkIds,
          draftedByAi: true,
        },
      })
      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          intent: intent.intent,
          topic: intent.topic,
          status: 'WAITING_ON_CUSTOMER',
          assignee: match.escalateToAssignee ?? undefined,
          rulesMatched: { push: match.ruleId },
        },
      })
      // Slack notification + agent push is Slice 4 — leave a log hook here for now
      logger.info({ conversationId, assignee: match.escalateToAssignee }, 'agent draft ready (notification deferred to Slice 4)')
      return true
    }
    case 'ESCALATE': {
      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          status: 'ESCALATED',
          escalatedAt: new Date(),
          assignee: match.escalateToAssignee ?? undefined,
          intent: intent.intent,
          topic: intent.topic,
          rulesMatched: { push: match.ruleId },
        },
      })
      return true
    }
  }
}

async function retrieveKBChunks(brandId: string, query: string): Promise<KBChunkRetrieved[]> {
  const embedding = await generateEmbedding(query)
  const vec = `[${embedding.join(',')}]`
  // pgvector cosine distance is `<=>`. similarity = 1 - distance.
  const rows = await prisma.$queryRaw<Array<{ id: string; articleId: string; chunkIndex: number; content: string; similarity: number }>>`
    SELECT id, "articleId", "chunkIndex", content, 1 - (embedding <=> ${vec}::vector) AS similarity
    FROM "kb_chunks"
    WHERE "brandId" = ${brandId} AND "embedStatus" = 'EMBEDDED'
    ORDER BY embedding <=> ${vec}::vector
    LIMIT ${TOP_K}
  `
  return rows.filter((r) => r.similarity >= SIMILARITY_THRESHOLD)
}

async function loadCustomer360(memberId: string) {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: {
      id: true, email: true, currentTier: true, pointsBalance: true,
    },
  })
  if (!member) return null
  return {
    memberId: member.id,
    email: member.email,
    currentTier: member.currentTier ?? null,
    pointsBalance: member.pointsBalance ?? 0,
    recentOrderSummary: null,
  }
}
```

- [ ] **Step 4: Run the test; expect AUTO_REPLY case to pass + threshold-fallthrough case to pass**

```bash
pnpm --filter @customerEQ/worker test src/processors/supportOrchestration.test.ts
```

Expected: both tests in Step 1 pass.

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/processors/supportOrchestration.ts apps/worker/src/processors/supportOrchestration.test.ts
git commit -m "worker: supportOrchestration processor — AUTO_REPLY branch + confidence fall-through"
```

---

## Task 17: Unit tests for DRAFT_FOR_AGENT + ESCALATE branches

**Files:**
- Modify: `apps/worker/src/processors/supportOrchestration.test.ts`

- [ ] **Step 1: Append DRAFT_FOR_AGENT test**

Add to the existing test file:

```ts
describe('supportOrchestration processor — DRAFT_FOR_AGENT', () => {
  it('writes a draftedByAi message and sets status WAITING_ON_CUSTOMER + assignee', async () => {
    prismaMock.conversation.findUniqueOrThrow.mockResolvedValue({
      id: 'conv1', brandId: 'brand1', memberId: 'member1', status: 'ACTIVE',
    })
    prismaMock.message.findMany.mockResolvedValue([{ role: 'CUSTOMER', content: 'refund please' }])
    prismaMock.supportRule.findMany.mockResolvedValue([
      {
        id: 'r1', status: 'ACTIVE', priority: 0,
        intentFilters: ['refund_request'], tierFilters: [],
        healthScoreMin: null, healthScoreMax: null, topicFilters: [], conditions: {},
        actionMode: 'DRAFT_FOR_AGENT', confidenceThreshold: 0,
        autoRespondArticleId: null, escalateToAssignee: 'agent_a',
        awardPoints: null, triggerSurveyId: null,
      },
    ])
    prismaMock.member.findUnique.mockResolvedValue({
      id: 'member1', currentTier: null, pointsBalance: 0, email: null, firstName: null, lastName: null,
    })
    prismaMock.brand.findUnique.mockResolvedValue({ id: 'brand1', name: 'X' })
    aiMock.classifySupportIntent.mockResolvedValue({
      intent: 'refund_request', topic: 'returns', sensitivity: 'high', customerSentiment: 'neutral', confidence: 0.95,
    })
    embedMock.generateEmbedding.mockResolvedValue(new Array(1536).fill(0))
    prismaMock.$queryRaw.mockResolvedValue([])
    aiMock.draftSupportReply.mockResolvedValue({
      reply: 'Could you confirm the email on the order?', citedChunkIds: [], confidence: 0.85,
      shouldEscalate: false, reason: null,
    })

    await processSupportOrchestration(baseJob)

    expect(prismaMock.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: 'AI',
          draftedByAi: true,
          aiConfidence: 0.85,
        }),
      }),
    )
    expect(prismaMock.conversation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'WAITING_ON_CUSTOMER',
          assignee: 'agent_a',
        }),
      }),
    )
  })
})

describe('supportOrchestration processor — ESCALATE', () => {
  it('sets status ESCALATED + assignee, never writes a customer-visible AI message', async () => {
    prismaMock.conversation.findUniqueOrThrow.mockResolvedValue({
      id: 'conv1', brandId: 'brand1', memberId: 'member1', status: 'ACTIVE',
    })
    prismaMock.message.findMany.mockResolvedValue([{ role: 'CUSTOMER', content: 'cancel my account' }])
    prismaMock.supportRule.findMany.mockResolvedValue([
      {
        id: 'r1', status: 'ACTIVE', priority: 0,
        intentFilters: ['account_cancellation'], tierFilters: [],
        healthScoreMin: null, healthScoreMax: null, topicFilters: [], conditions: {},
        actionMode: 'ESCALATE', confidenceThreshold: 0,
        autoRespondArticleId: null, escalateToAssignee: 'agent_b',
        awardPoints: null, triggerSurveyId: null,
      },
    ])
    prismaMock.member.findUnique.mockResolvedValue({
      id: 'member1', currentTier: null, pointsBalance: 0, email: null, firstName: null, lastName: null,
    })
    prismaMock.brand.findUnique.mockResolvedValue({ id: 'brand1', name: 'X' })
    aiMock.classifySupportIntent.mockResolvedValue({
      intent: 'account_cancellation', topic: 'account', sensitivity: 'high', customerSentiment: 'negative', confidence: 0.93,
    })
    embedMock.generateEmbedding.mockResolvedValue(new Array(1536).fill(0))
    prismaMock.$queryRaw.mockResolvedValue([])
    aiMock.draftSupportReply.mockResolvedValue({
      reply: 'Sorry to see you go.', citedChunkIds: [], confidence: 0.9, shouldEscalate: false, reason: null,
    })

    await processSupportOrchestration(baseJob)

    expect(prismaMock.message.create).not.toHaveBeenCalled()
    expect(prismaMock.conversation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'ESCALATED',
          assignee: 'agent_b',
        }),
      }),
    )
  })
})
```

- [ ] **Step 2: Run; expect pass**

```bash
pnpm --filter @customerEQ/worker test src/processors/supportOrchestration.test.ts
```

Expected: all four tests pass (AUTO_REPLY, threshold fall-through, DRAFT_FOR_AGENT, ESCALATE).

- [ ] **Step 3: Commit**

```bash
git add apps/worker/src/processors/supportOrchestration.test.ts
git commit -m "worker: unit tests for DRAFT_FOR_AGENT + ESCALATE tiers"
```

---

## Task 18: Wire processor into the worker entrypoint

**Files:**
- Modify: `apps/worker/src/index.ts`

- [ ] **Step 1: Register the Worker**

Add the import (with the other processor imports near the top):

```ts
import { createSupportOrchestrationProcessor } from './processors/supportOrchestration.js'
```

Add the Worker registration (with the other `new Worker(...)` blocks):

```ts
const supportOrchestrationWorker = new Worker(
  QUEUES.SUPPORT_ORCHESTRATION,
  createSupportOrchestrationProcessor(connection),
  { connection, concurrency: 5, drainDelay: IDLE_POLL_SECONDS },
)
```

If there's a `workers` array or shutdown handler that iterates registered Workers, add `supportOrchestrationWorker` to it.

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add apps/worker/src/index.ts
git commit -m "worker: register supportOrchestration Worker against SUPPORT_ORCHESTRATION queue"
```

---

## Task 19: Replace `inlineSupportOrchestration` in the API queue shim

**Files:**
- Modify: `apps/api/src/queues/bullmq.ts`

- [ ] **Step 1: Read the current inline shim**

```bash
grep -n 'inlineSupportOrchestration\|SUPPORT_ORCHESTRATION' apps/api/src/queues/bullmq.ts
```

The file currently routes `SupportOrchestrationPayload` jobs to a local `inlineSupportOrchestration()` when `QUEUE_MODE=inline`.

- [ ] **Step 2: Replace the inline implementation**

In `apps/api/src/queues/bullmq.ts`:
- Delete the inline `inlineSupportOrchestration()` function body and any helper functions only it used (e.g. `classifyIntentFallback`, `extractTopicsFallback`).
- Replace it with a thin delegate that calls the same processor used in `apps/worker`:

```ts
import { processSupportOrchestration } from '../../../worker/src/processors/supportOrchestration.js'
import type { Job } from 'bullmq'
import type { SupportOrchestrationPayload } from '@customerEQ/shared'

async function runSupportOrchestrationInline(payload: SupportOrchestrationPayload): Promise<void> {
  // Fabricate a minimal Job shape — the processor only reads .data
  const fakeJob = { data: payload, id: `inline_${Date.now()}` } as Job<SupportOrchestrationPayload>
  await processSupportOrchestration(fakeJob)
}
```

Then update the call site that previously invoked `inlineSupportOrchestration(...)` to call `runSupportOrchestrationInline(...)` instead.

> **Note:** the cross-app import path (`../../../worker/src/...`) works because workspaces share the TS build graph. If it produces a typecheck error, expose `processSupportOrchestration` via `apps/worker/src/index.ts` re-export and import from `@customerEQ/worker`.

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 4: Run smoke tests**

```bash
pnpm test:smoke
```

Expected: zero failures.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/queues/bullmq.ts
git commit -m "api: delegate inline support orchestration to the worker processor"
```

---

## Task 20: Integration test — full AUTO_REPLY happy path (real DB, mocked BAML)

**Files:**
- Create: `apps/api/src/__tests__/integration/support-orchestration.integration.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'

// BAML mocked at integration tier so we don't burn LLM calls for plumbing tests.
const aiMock = vi.hoisted(() => ({
  classifySupportIntent: vi.fn(),
  draftSupportReply: vi.fn(),
}))
vi.mock('@customerEQ/ai/src/support/intent.js', () => ({ classifySupportIntent: aiMock.classifySupportIntent }))
vi.mock('@customerEQ/ai/src/support/reply.js', () => ({ draftSupportReply: aiMock.draftSupportReply }))

const embedMock = vi.hoisted(() => ({ generateEmbedding: vi.fn() }))
vi.mock('@customerEQ/ai/src/analysis/embeddings.js', () => embedMock)

import { setupTestDb, teardownTestDb, getTestPrisma } from '@customerEQ/config/test-utils/db/setup'
import { createBrand } from '@customerEQ/config/test-utils/factories/brand.factory'
import { createMember } from '@customerEQ/config/test-utils/factories/member.factory'
import {
  createConversation,
  createMessage,
  createSupportRule,
} from '@customerEQ/config/test-utils/factories/support.factory'
import { createKBChunk } from '@customerEQ/config/test-utils/factories/kbChunk.factory'
import { deterministicEmbedding } from '@customerEQ/config/test-utils/factories/kbChunk.factory'
import { processSupportOrchestration } from '@customerEQ/worker/src/processors/supportOrchestration'

beforeAll(async () => { await setupTestDb() })

beforeEach(() => {
  aiMock.classifySupportIntent.mockReset()
  aiMock.draftSupportReply.mockReset()
  embedMock.generateEmbedding.mockReset()
})

describe('supportOrchestration — integration', () => {
  it('AUTO_REPLY end-to-end: rule match + KB retrieval + AI message written', async () => {
    const prisma = getTestPrisma()
    const brand = await createBrand({ name: 'BrandX' })
    const member = await createMember({ brandId: brand.id })
    const article = await prisma.kBArticle.create({
      data: {
        brandId: brand.id, title: 'Shipping', body: 'We ship globally.',
        status: 'PUBLISHED', publishedAt: new Date(),
      },
    })
    await createKBChunk({ articleId: article.id, brandId: brand.id, chunkIndex: 0, content: 'We ship to Canada via UPS, 5-7 business days.', embedSeed: 'canada-shipping' })
    await createSupportRule({
      brandId: brand.id,
      intentFilters: ['shipping_question'],
      actionMode: 'AUTO_REPLY',
      confidenceThreshold: 0.8,
    })

    const conv = await createConversation({ brandId: brand.id, memberId: member.id })
    const userMsg = await createMessage({ conversationId: conv.id, role: 'CUSTOMER', content: 'Do you ship to Canada?' })

    aiMock.classifySupportIntent.mockResolvedValue({
      intent: 'shipping_question', topic: 'international_shipping',
      sensitivity: 'low', customerSentiment: 'neutral', confidence: 0.92,
    })
    embedMock.generateEmbedding.mockResolvedValue(deterministicEmbedding('canada-shipping'))
    aiMock.draftSupportReply.mockResolvedValue({
      reply: 'Yes, we ship to Canada via UPS.', citedChunkIds: ['ignored-by-fixture'],
      confidence: 0.88, shouldEscalate: false, reason: null,
    })

    await processSupportOrchestration({
      data: { conversationId: conv.id, brandId: brand.id, memberId: member.id, messageId: userMsg.id, messageContent: 'Do you ship to Canada?' },
      id: 'job1',
    } as never)

    const aiMessages = await prisma.message.findMany({
      where: { conversationId: conv.id, role: 'AI' },
    })
    expect(aiMessages).toHaveLength(1)
    expect(aiMessages[0]).toMatchObject({
      content: 'Yes, we ship to Canada via UPS.',
      aiConfidence: 0.88,
      draftedByAi: false,
    })

    const updated = await prisma.conversation.findUniqueOrThrow({ where: { id: conv.id } })
    expect(updated.intent).toBe('shipping_question')
    expect(updated.topic).toBe('international_shipping')
  })

  it('tenant boundary: brand A orchestration never retrieves chunks from brand B', async () => {
    const prisma = getTestPrisma()
    const brandA = await createBrand({ name: 'A' })
    const brandB = await createBrand({ name: 'B' })
    const memberA = await createMember({ brandId: brandA.id })

    const articleB = await prisma.kBArticle.create({
      data: { brandId: brandB.id, title: 'B-only', body: 'secret', status: 'PUBLISHED', publishedAt: new Date() },
    })
    await createKBChunk({ articleId: articleB.id, brandId: brandB.id, chunkIndex: 0, content: 'Brand B canada shipping info', embedSeed: 'canada-shipping' })
    await createSupportRule({ brandId: brandA.id, intentFilters: ['shipping_question'], actionMode: 'AUTO_REPLY', confidenceThreshold: 0.5 })

    const convA = await createConversation({ brandId: brandA.id, memberId: memberA.id })
    const msg = await createMessage({ conversationId: convA.id, role: 'CUSTOMER', content: 'Do you ship to Canada?' })

    aiMock.classifySupportIntent.mockResolvedValue({
      intent: 'shipping_question', topic: 'international_shipping', sensitivity: 'low', customerSentiment: 'neutral', confidence: 0.9,
    })
    embedMock.generateEmbedding.mockResolvedValue(deterministicEmbedding('canada-shipping'))
    let receivedChunks: unknown[] = []
    aiMock.draftSupportReply.mockImplementation(async (input: { kbChunks: unknown[] }) => {
      receivedChunks = input.kbChunks
      return { reply: '...', citedChunkIds: [], confidence: 0.8, shouldEscalate: false, reason: null }
    })

    await processSupportOrchestration({
      data: { conversationId: convA.id, brandId: brandA.id, memberId: memberA.id, messageId: msg.id, messageContent: 'Do you ship to Canada?' },
      id: 'job-tenant',
    } as never)

    // Brand A has no chunks of its own; retrieval should return [], not B's chunks.
    expect(receivedChunks).toEqual([])
  })

  it('pgvector retrieval orders by cosine similarity within a single brand', async () => {
    const prisma = getTestPrisma()
    const brand = await createBrand({ name: 'PG' })
    const member = await createMember({ brandId: brand.id })
    const article = await prisma.kBArticle.create({
      data: { brandId: brand.id, title: 't', body: 'b', status: 'PUBLISHED', publishedAt: new Date() },
    })

    // 3 chunks with distinct seeds → distinct embeddings. We'll query with one seed
    // and expect the matching chunk first.
    await createKBChunk({ articleId: article.id, brandId: brand.id, chunkIndex: 0, content: 'far', embedSeed: 'far-from-query' })
    await createKBChunk({ articleId: article.id, brandId: brand.id, chunkIndex: 1, content: 'middle', embedSeed: 'middle' })
    await createKBChunk({ articleId: article.id, brandId: brand.id, chunkIndex: 2, content: 'exact', embedSeed: 'target-query' })

    await createSupportRule({ brandId: brand.id, intentFilters: ['shipping_question'], actionMode: 'AUTO_REPLY', confidenceThreshold: 0.5 })

    const conv = await createConversation({ brandId: brand.id, memberId: member.id })
    const m = await createMessage({ conversationId: conv.id, role: 'CUSTOMER', content: 'q' })

    aiMock.classifySupportIntent.mockResolvedValue({
      intent: 'shipping_question', topic: 't', sensitivity: 'low', customerSentiment: 'neutral', confidence: 0.9,
    })
    embedMock.generateEmbedding.mockResolvedValue(deterministicEmbedding('target-query'))
    let captured: Array<{ content: string }> = []
    aiMock.draftSupportReply.mockImplementation(async (input: { kbChunks: Array<{ content: string }> }) => {
      captured = input.kbChunks
      return { reply: '...', citedChunkIds: [], confidence: 0.8, shouldEscalate: false, reason: null }
    })

    await processSupportOrchestration({
      data: { conversationId: conv.id, brandId: brand.id, memberId: member.id, messageId: m.id, messageContent: 'q' },
      id: 'job-pg',
    } as never)

    expect(captured[0]?.content).toBe('exact')
  })
})
```

- [ ] **Step 2: Run integration test**

```bash
pnpm test:integration --filter @customerEQ/api
```

Expected: all three integration tests pass.

If "exact" is not first in the third test, the deterministic embedding's stability is fine — the test uses the same seed for both the index and the query, so an exact match must be at distance 0. If it fails, the bug is in `retrieveKBChunks`'s SQL or the embed-mock wiring; debug that, don't lower the assertion.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/__tests__/integration/
git commit -m "integration: supportOrchestration end-to-end (AUTO_REPLY, tenant boundary, pgvector ordering)"
```

---

## Task 21: Performance gate — orchestrator p95 < 3s with 10k chunks

**Files:**
- Modify: `apps/api/src/__tests__/integration/support-orchestration.integration.test.ts`

- [ ] **Step 1: Append the perf test**

```ts
describe('supportOrchestration — performance gate', () => {
  it('p95 < 3s with 10k KBChunks indexed for the brand', async () => {
    const prisma = getTestPrisma()
    const brand = await createBrand({ name: 'PerfBrand' })
    const member = await createMember({ brandId: brand.id })
    const article = await prisma.kBArticle.create({
      data: { brandId: brand.id, title: 't', body: 'b', status: 'PUBLISHED', publishedAt: new Date() },
    })
    // Bulk insert via raw SQL to avoid 10k round-trips. Embeddings via deterministicEmbedding for stability.
    const batch = 10000
    const values: string[] = []
    for (let i = 0; i < batch; i++) {
      const emb = deterministicEmbedding(`bulk-${i}`)
      values.push(`('bulk_${i}', '${article.id}', '${brand.id}', ${i}, 'content ${i}', 10, '[${emb.join(',')}]'::vector, 'EMBEDDED', NOW(), NOW())`)
    }
    // chunked inserts to avoid statement size limits
    const chunkSize = 500
    for (let i = 0; i < values.length; i += chunkSize) {
      const slice = values.slice(i, i + chunkSize).join(',')
      await prisma.$executeRawUnsafe(`INSERT INTO "kb_chunks" ("id", "articleId", "brandId", "chunkIndex", "content", "tokenCount", "embedding", "embedStatus", "createdAt", "updatedAt") VALUES ${slice}`)
    }

    await createSupportRule({ brandId: brand.id, intentFilters: ['shipping_question'], actionMode: 'AUTO_REPLY', confidenceThreshold: 0.5 })
    aiMock.classifySupportIntent.mockResolvedValue({
      intent: 'shipping_question', topic: 't', sensitivity: 'low', customerSentiment: 'neutral', confidence: 0.9,
    })
    embedMock.generateEmbedding.mockResolvedValue(deterministicEmbedding('bulk-42'))
    aiMock.draftSupportReply.mockResolvedValue({
      reply: '...', citedChunkIds: [], confidence: 0.9, shouldEscalate: false, reason: null,
    })

    // Run 5 orchestrations, take p95
    const durations: number[] = []
    for (let i = 0; i < 5; i++) {
      const conv = await createConversation({ brandId: brand.id, memberId: member.id })
      const m = await createMessage({ conversationId: conv.id, role: 'CUSTOMER', content: 'q' })
      const t0 = Date.now()
      await processSupportOrchestration({
        data: { conversationId: conv.id, brandId: brand.id, memberId: member.id, messageId: m.id, messageContent: 'q' },
        id: `perf-${i}`,
      } as never)
      durations.push(Date.now() - t0)
    }
    durations.sort((a, b) => a - b)
    const p95 = durations[Math.floor(durations.length * 0.95)]
    // eslint-disable-next-line no-console
    console.log(`Orchestrator p95: ${p95}ms (samples: ${durations.join(', ')})`)
    expect(p95).toBeLessThan(3000)
  }, 180_000)
})
```

- [ ] **Step 2: Run**

```bash
pnpm test:integration --filter @customerEQ/api -t 'performance gate'
```

Expected: p95 < 3000ms. The mocked BAML calls are instant — almost all the time is pgvector retrieval + Prisma writes. If this fails, the HNSW index from Task 3 isn't being used; check `EXPLAIN ANALYZE` in psql.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/__tests__/integration/support-orchestration.integration.test.ts
git commit -m "integration: orchestrator p95 perf gate with 10k indexed chunks"
```

---

## Task 22: Full validation gate

**Files:** none

- [ ] **Step 1: Run all the validation commands from `ONBOARDING.md`**

```bash
pnpm build
pnpm typecheck
pnpm lint
pnpm test:smoke
pnpm test:integration
```

Expected: zero failures across all five. Any failure here is a fix-now blocker — do not push the PR.

- [ ] **Step 2: If you have keys, run the BAML evals locally**

```bash
pnpm test:baml
```

Expected: passes the accuracy/sensitivity/false-positive bars from Task 14. If the accuracy bar isn't met, that's prompt-iteration work — go back to Task 11–13 and tune the BAML prompts until evals pass. Do not relax the bar.

- [ ] **Step 3: Run a quick local smoke**

```bash
QUEUE_MODE=inline pnpm dev
```

In another shell: create a conversation + message via curl to `/v1/public/support/conversations`, watch the worker logs. Confirm an AI message appears in the DB (psql or studio).

---

## Task 23: PR

**Files:** none

- [ ] **Step 1: Push the branch**

```bash
git push -u origin feature/issue-$ISSUE-support-revamp-slice-1
```

- [ ] **Step 2: Open PR**

```bash
gh pr create \
  --title "Slice 1/4: Support platform revamp — data + AI orchestrator" \
  --body "$(cat <<'EOF'
## Summary
Foundational slice of the Support platform revamp. See `docs/superpowers/specs/2026-05-13-support-platform-revamp-design.md` (§10) for the four-slice decomposition.

- Two Prisma migrations: pgvector chunks/sources + Conversation/Message/SupportRule extensions
- Three BAML functions (intent, reply, resolution) with wrappers + unit tests + real-LLM eval tests (≥90% intent acc, <5% false-resolved rate)
- New `supportOrchestration` BullMQ processor with tiered autonomy dispatch (AUTO_REPLY / DRAFT_FOR_AGENT / ESCALATE) and per-conversationId Redis lock for ordered processing
- `inlineSupportOrchestration` shim now delegates to the same processor for QUEUE_MODE=inline parity
- `evaluateSupportRules` returns `actionMode` + `confidenceThreshold` per matched rule
- Test factories for KBSource + KBChunk (deterministic embeddings) + BAML support mocks
- Tenant boundary, pgvector ordering, and p95 perf gate (10k chunks, < 3s) covered in integration tests

## Test plan
- [x] pnpm typecheck
- [x] pnpm lint
- [x] pnpm test:smoke
- [x] pnpm test:integration
- [x] pnpm test:baml (real Azure OpenAI; eval bars passing)
- [x] manual: QUEUE_MODE=inline pnpm dev → POST message → AI reply appears

## Out of scope (deferred to later slices)
- KB admin UI + crawler ingestion → Slice 2
- Widget rewrite + `SupportWidgetConfig` → Slice 3
- CSAT, timeout classifier, Slack adapter, loyalty bridge wiring → Slice 4

Closes #$ISSUE
EOF
)"
```

- [ ] **Step 3: Verify CI**

Watch the PR's checks. If anything fails in CI that passed locally, capture the failure and either fix-forward or revert the offending commit.

---

## Self-Review

**1. Spec coverage** — every item from §10 Slice 1:
- ✅ Three Prisma migrations → Tasks 1–5 (two migrations: KB tables + Conversation/Message/Rule extensions; `SupportWidgetConfig` and `CSATResponse` are explicitly Slice 3 / Slice 4 per §10).
- ✅ Three BAML functions with eval sets → Tasks 11, 12, 13, 14.
- ✅ `supportOrchestration` processor with all three actionMode branches → Tasks 16, 17.
- ✅ Per-conversationId concurrency=1 → Task 15 (Redis lock).
- ✅ `supportRules.evaluate()` upgrade → Task 8.
- ✅ Queue names — `QUEUES.SUPPORT_ORCHESTRATION` already exists (confirmed); processor wired in Task 18.
- ✅ Test factories — Tasks 9 (KB) + extended support factory.
- ✅ Mocks — Task 10.
- ✅ Unit + integration tests — Tasks 11–13 (unit per BAML), 16–17 (processor unit), 20 (integration), 21 (perf gate).

**2. Placeholder scan** — no "TBD", "TODO", "fill in later", or step-without-code. The resolution eval set in Task 14 ships with 3 cases + an explicit `if (cases.length < 20) throw` guard so the engineer is forced to add the remaining 17 — that's a tracked action, not a placeholder.

**3. Type consistency** — `SupportRuleInput`, `SupportRuleMatch`, `SupportRuleMatchResult`, `SupportOrchestrationPayload`, `KBChunkRetrieved`, `Customer360`, `ClassifySupportIntentResult`, `DraftSupportReplyResult`, `ClassifyResolutionResult` are all defined once and reused consistently. Action mode values (`'AUTO_REPLY' | 'DRAFT_FOR_AGENT' | 'ESCALATE'`) match across Prisma enum / Zod schema / TS type / test inputs.
