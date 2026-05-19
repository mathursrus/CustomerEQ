# Support Platform Revamp — Design Spec

**Date:** 2026-05-13
**Owner:** Sanjoy Ghosh
**Status:** Draft — pending implementation plan
**Related:** Hero flow (Issue #6 — Real-Time CX-to-Loyalty), existing Support module (Issues #41, #101, #105, #107, #121, #156)

---

## 1. Goal

Revamp the existing Support module into a comprehensive end-to-end support platform comparable to Crisp.chat: embeddable widget, AI-first auto-answer with KB-backed RAG, human-in-loop inbox, and a closed loyalty loop on resolution. Ship the v1 as an **end-to-end thin slice** that exercises every layer (widget → AI → human → resolution → loyalty event), then deepen each layer in follow-up slices.

## 2. Product decisions (locked)

| Decision | Choice |
|---|---|
| Scope wedge | End-to-end thin slice (widget → AI tries → escalates → resolves → loyalty event fires) |
| AI agent role | **Tiered Autonomy** via existing `SupportRule.actionMode` — per-rule mix of AUTO_REPLY / DRAFT_FOR_AGENT / ESCALATE |
| Identity | Anonymous-first; brand can pass a verified token to upgrade mid-conversation; AI asks for identity inline only when a mutating action requires it |
| KB ingestion sources (v1) | Manual authoring + URL/sitemap crawl. File upload = fast follow. Notion/Confluence/Zendesk = slice 2. |
| Channels (v1) | Embeddable web widget + Slack agent-side notifications (reuses existing alert webhook infra). Email = slice 2. SMS = slice 3. |
| Resolution detection | Hybrid: CSAT 👍/👎 primary, AI-classifier timeout fallback after N hours, agent force-resolve override |
| Widget customization | Full design system — colors, radius, font, logo, launcher icon, position, greeting + offline copy, dark-mode auto. No custom CSS injection in v1. |
| Architectural approach | **Evolve in-place** — extend existing schema, replace `inlineSupportOrchestration` with a real BullMQ processor, pgvector on existing Postgres, revamp the existing `<ceq-support-chat>` Web Component. No new services or frameworks. |

## 3. Architecture

```
Client side
  <ceq-support-chat>    Embedded in brand sites (revamped Web Component, themed via SupportWidgetConfig)
  Next.js admin         /admin/support/{conversations,knowledge,widget,rules,analytics}
  Slack agent app       DMs/channel notifications + inbound replies

apps/api  (Fastify)
  /v1/public/support/*        revamp — anon flow, CSAT submit, widget-config GET
  /v1/support/*               revamp — agent draft/send flow
  /v1/support/knowledge       NEW — KB articles + sources CRUD
  /v1/support/widget-config   NEW — per-brand widget config
  /v1/webhooks/slack/events   NEW — Slack Events API receiver

apps/worker  (BullMQ)
  supportOrchestration        NEW — AI brain (intent → RAG → rules → tiered dispatch)
  kbIngestion                 NEW — URL/sitemap crawl + chunk + embed
  supportTimeoutClassifier    NEW — scheduled fallback resolution detector
  slackOutbound               NEW — agent-side notifications
  alertEvaluation             existing — survey-driven case follow-up
  slaBreachCheck              existing — SLA monitoring

packages/ai  (BAML)
  ClassifySupportIntent       NEW
  DraftSupportReply           NEW
  ClassifyResolution          NEW

Postgres 16 + pgvector
  Conversation/Message/SupportRule    extended
  KBArticle                            extended
  KBChunk / KBSource                   NEW
  SupportWidgetConfig                  NEW
  CSATResponse                         NEW

CX → Loyalty bridge (existing)
  Resolution detected → emit cx.ticket_resolved → loyaltyEvents queue
  → LoyaltyEvent + pointsBalance txn → matching Campaign trigger
```

Every queue, route, package, and Prisma extension follows patterns already established in the repo. The only new infra primitive is the `pgvector` Postgres extension.

## 4. Data model

### New tables

**`KBSource`** — where a KB article came from
```
id, brandId, kind: MANUAL | URL | SITEMAP, url?, title,
status: ACTIVE | DISABLED, crawlCron?, lastCrawledAt?, lastErrorMessage?,
createdAt, updatedAt
```

**`KBChunk`** — RAG-indexed chunks (one article → many chunks)
```
id, articleId → KBArticle, brandId (denorm for tenant scoping),
chunkIndex, content, tokenCount,
embedding vector(1536), embedStatus: PENDING | EMBEDDED | FAILED,
createdAt, updatedAt
HNSW index on embedding
```

**`SupportWidgetConfig`** — one row per brand
```
id, brandId (unique),
-- theming
primaryColor, accentColor, backgroundColor, textColor,
borderRadius, fontFamily, logoUrl, launcherIconUrl,
position: BOTTOM_RIGHT | BOTTOM_LEFT, darkModeAuto: bool,
-- copy
greeting, offlineMessage, csatPromptText, escalateButtonText,
-- behavior
showCsatAfterAi: bool, csatTimeoutSeconds: int, anonAllowed: bool,
createdAt, updatedAt
```

**`CSATResponse`** — rollup table for analytics
```
id, conversationId (unique → Conversation), brandId,
rating: THUMBS_UP | THUMBS_DOWN, comment?, createdAt
```

### Extensions to existing tables

**`Conversation`** — add: `channel: WIDGET | SLACK` (default WIDGET), `anonId?`, `email?`, `resolutionSource: CSAT | AI_TIMEOUT | AGENT | null`, `resolvedAt?`.

**`Message`** — add: `aiConfidence: Float?` (0-1, present on AI messages), `aiSources: jsonb?` (cited KBChunk IDs), `draftedByAi: bool` (AI drafted, human sent), `slackTs?` (Slack message ts for bi-directional thread sync).

**`KBArticle`** — add: `sourceId? → KBSource`, `sourceUrl?`, `contentHash` (skip re-embed on identical crawl), `publishedAt?`, `archivedAt?`.

**`SupportRule`** — add: `actionMode: AUTO_REPLY | DRAFT_FOR_AGENT | ESCALATE`, `confidenceThreshold: Float` (default 0.8). Makes tiered autonomy explicit rather than inferred from which action field is set.

### Multi-tenancy

Every new table carries `brandId` (denormalized where helpful). Prisma middleware enforces tenant scoping — no new boundary code.

### Migrations

Three independently-reversible migrations:
1. `support_revamp_pgvector_and_kb_chunks` — `CREATE EXTENSION vector`, `KBChunk`, `KBSource`, `KBArticle` extensions.
2. `support_revamp_widget_config_csat` — `SupportWidgetConfig`, `CSATResponse`.
3. `support_revamp_conversation_message_extensions` — nullable columns + defaults on `Conversation`, `Message`, `SupportRule`. Zero-downtime, no backfill.

## 5. Components (file layout)

> **Note (post-implementation, Issue #442):** KB pages and routes were co-located with Sid Mathur's pre-existing `/admin/kb/` monolith rather than nested under `/admin/support/`. The original spec called for `/admin/support/knowledge/` and `routes/knowledge.ts`; what actually shipped lives at `/admin/kb/sources/` (UI) and `apps/api/src/routes/kb-sources.ts` (API). The file layout below reflects what was built.

### `apps/api/src/routes/`
- `support-public.ts` — revamp; add channel handling, anonId cookie, CSAT submit, widget-config GET
- `support-admin.ts` — revamp; add agent draft-vs-send flow
- `kb.ts` + `kb-sources.ts` — NEW; KB articles + sources CRUD (co-located with the existing `/admin/kb` monolith)
- `support-widget-config.ts` — NEW; GET/PUT per-brand widget config
- `webhooks-slack.ts` — NEW; Slack Events API (signature verify, inbound message routing)

### `apps/web/src/app/(admin)/admin/`
- `support/conversations/` — revamp; three-pane inbox (list / thread / context), AI-drafted-reply banner with send/edit/discard, agent claim button
- `kb/sources/` — NEW; list articles + sources, create (manual or URL/sitemap), edit, crawl status pages
- `support/widget/` — NEW; live preview iframe + theming form
- `support/rules/` — existing; add `actionMode` picker, `confidenceThreshold` slider
- `support/analytics/` — existing; add KB hit-rate and CSAT charts

### `apps/worker/src/processors/`
- `supportOrchestration.ts` — NEW. Pipeline: `ClassifySupportIntent` → pgvector retrieval (top-K, brandId filter) → load Customer360 if identified → evaluate `SupportRule`s → dispatch by `actionMode`:
  - `AUTO_REPLY` → write AI Message + SSE push (requires `aiConfidence >= rule.confidenceThreshold`)
  - `DRAFT_FOR_AGENT` → write AI Message with `draftedByAi=true`, NOT pushed to customer; notify agent (Slack)
  - `ESCALATE` → assign + Slack notification, no AI draft
  - Per-conversationId concurrency=1 via BullMQ named-group concurrency for ordered processing.
- `kbIngestion.ts` — NEW; URL/sitemap fetch (Cheerio + Readability), token-aware chunker, OpenAI embed, contentHash diff to skip re-embed, exponential-backoff retry on crawl errors.
- `supportTimeoutClassifier.ts` — NEW; cron-scheduled (hourly). For each conversation with last message > 24h from AI/agent and no customer reply (configurable per-brand via `SupportWidgetConfig` later), run `ClassifyResolution`. Resolve if `confidence ≥ 0.7`.
- `slackOutbound.ts` — NEW; `chat.postMessage` to brand's configured channel/DM. BullMQ retry on 5xx.

### `packages/ai/baml_src/`
- `support_intent.baml` — `ClassifySupportIntent(message, history) → { intent, topic, sensitivity, customerSentiment, confidence }`
- `support_reply.baml` — `DraftSupportReply(message, history, kbChunks, customer360?, brandVoice) → { reply, citedChunkIds[], confidence, shouldEscalate, reason? }`
- `support_resolution.baml` — `ClassifyResolution(messages, hoursSinceLast) → { resolved: bool, confidence, reason }`

Each has a Vitest eval in `packages/ai/tests/` using the repo's `test:baml` discipline.

### `packages/embed/src/`
- `ceq-support-chat.ts` — full rewrite inside the existing custom-element shell. Shadow-DOM-scoped styles driven by `SupportWidgetConfig` + `BrandTheme`. Components: Launcher, Panel, Header, MessageList, Composer, CsatBar, TypingIndicator, AgentJoinedBanner.
- `theme.ts` — NEW; resolve theme tokens to CSS custom properties.
- `api-client.ts` — NEW; typed fetch wrappers, SSE client.

### `packages/shared/src/`
- `zod/support.schema.ts` — extend with Conversation/Message/CSAT/widget-config schemas
- `zod/knowledge.schema.ts` — NEW; KBArticle / KBSource / KBChunk schemas
- `supportRules.ts` — extend `evaluate()` to return `actionMode` + `confidenceThreshold`
- `queueNames.ts` — add: `supportOrchestration`, `kbIngestion`, `supportTimeoutClassifier`, `slackOutbound`

### `packages/config/src/test-utils/`
- `factories/{kbSource,kbChunk,supportWidgetConfig,csatResponse}.ts` — NEW
- `mocks/{openaiEmbed,slackClient}.ts` — NEW; deterministic embedding mock (seedable), Slack mock with signature helpers
- `db/setup-migration-test-db.ts` — extend to enable `pgvector` extension

## 6. Data flow — hero loop walkthrough

Anonymous visitor on brand X's site asks a shipping question, gets an AI answer, follows up with a refund request, gets escalated, agent resolves, member earns loyalty points.

1. **Widget boot.** `embed.js` mounts `<ceq-support-chat brand-id="X">`. Widget calls `GET /v1/public/support/widget-config?brandId=X`, renders themed launcher and greeting. Sets `ceq_anon_id=<uuid>` cookie.
2. **First message.** `POST /v1/public/support/conversations` creates Conversation (`anonId`, `channel=WIDGET`, `status=ACTIVE`). `POST .../messages` writes Message (role=CUSTOMER). Widget opens SSE stream. API enqueues `supportOrchestration`.
3. **Orchestrator.** `ClassifySupportIntent` → `{intent: shipping_question, topic: international_shipping, sensitivity: low, confidence: 0.92}`. pgvector retrieves top-K KBChunks (K=5, similarity threshold 0.7, brandId-filtered). No Customer360 (anon). `SupportRule` match → `actionMode: AUTO_REPLY`. `DraftSupportReply` → reply + `citedChunkIds`, confidence 0.88. Above rule threshold (0.8) → write Message (role=AI, `aiConfidence=0.88`, `aiSources=[c1,c3]`). SSE push → widget.
4. **Sensitive follow-up.** Customer: *"I want to return order #1234, I need a refund."* Intent: `refund_request`, sensitivity: high. Rule → `DRAFT_FOR_AGENT`. AI drafts identity-prompt reply. Message stored with `draftedByAi=true`, **not** pushed to customer. `slackOutbound` notifies agent.
5. **Agent reviews.** Opens `/admin/support/conversations/abc`. Sees AI-draft banner above composer. Edits a word, hits Send. Stored as Message (role=AGENT, `draftedByAi=true`, `agentUserId=u`). SSE → widget.
6. **Identity upgrade.** Customer replies with email + order #. Orchestrator runs an `EmailLookup` step (existing `Member` table query by `brandId + email`) → on match, updates `Conversation.memberId`, `email`. Customer360 now loadable. Sensitive rule → `ESCALATE`. Slack notification, no AI draft.
7. **Agent resolves.** Replies with confirmation, clicks **Resolve**. `PATCH .../conversations/abc { status: RESOLVED }` → sets `resolutionSource=AGENT`, `resolvedAt=now`. API emits `cx.ticket_resolved` (existing campaign trigger).
8. **Loyalty payoff.** Existing loyalty pipeline reads the event, finds Campaign with `triggerType: cx.ticket_resolved`, atomically writes `LoyaltyEvent` + bumps `pointsBalance`. Member sees +50 points.

### Alternative resolution paths

- **CSAT 👍.** After AI auto-reply, widget shows 👍/👎 after `csatTimeoutSeconds`. 👍 → `POST .../csat` writes `CSATResponse`, sets status RESOLVED with `resolutionSource=CSAT`. If `memberId` set, emit `cx.ticket_resolved`. If anon, skip emit.
- **Timeout fallback.** `supportTimeoutClassifier` hourly job. Finds conversations with last AI/agent message > 24h ago and no customer reply, status ACTIVE. Runs `ClassifyResolution`. If `{resolved: true, confidence ≥ 0.7}` → mark RESOLVED with `resolutionSource=AI_TIMEOUT`.
- **CSAT 👎.** Writes `CSATResponse`, status → `WAITING_ON_CUSTOMER`, new agent assignment + Slack notification.

### Slack-side reply

Agent replies from the Slack DM → Slack Events API webhook → `POST /v1/webhooks/slack/events` → verifies signature → looks up Conversation by `slackTs` → writes Message (role=AGENT) → SSE → widget. Bidirectional thread sync via stored `slackTs`.

## 7. Error handling, edge cases, invariants

### Failure modes

| Failure | Strategy |
|---|---|
| OpenAI 5xx / rate limit / timeout | BAML built-in retry (2 attempts, exponential backoff starting at 1s). On exhaustion, fall through to `rule.autoRespondArticleId` if set, else escalate. Conversation never stuck silently. |
| pgvector retrieval below similarity threshold | Skip AUTO_REPLY; drop to DRAFT_FOR_AGENT or ESCALATE per rule. Log `noKbCoverage: true` → analytics flags KB gaps. |
| KB crawl error (4xx/5xx, robots.txt, redirect loop) | Record on `KBSource.lastErrorMessage`, exponential-backoff retry, surface in admin source detail UI. |
| Embedding generation failure mid-ingest | `KBChunk` written with `embedStatus: PENDING`. Article `publishedAt` only set when all chunks EMBEDDED. Retry job picks up PENDING chunks. |
| Slack delivery failure | BullMQ retry. Slack is *notification* only — agents still see work in the inbox. Never blocks customer flow. |
| Slack webhook signature mismatch | 401, structured log. Timestamp-tolerance replay protection. |
| Agent collision (two agents reply simultaneously) | Optimistic concurrency on `Conversation.updatedAt`; loser gets 409, UI prompts refresh. |
| Two customer messages back-to-back | BullMQ per-conversationId concurrency=1 → ordered processing. |
| Double CSAT submission | Unique constraint on `CSATResponse.conversationId` → idempotent 200. |
| Anonymous reload / cookie loss | New cookie → new Conversation. Orphaned old convo stays in inbox. Deep-link recovery out of scope for v1. |
| AI hallucination at high confidence | `aiSources` records cited chunks → admin can audit. CSAT 👎 reopens conversation with agent. |
| Anonymous resolution | `memberId` null → resolve only, skip `cx.ticket_resolved` emit (no member to award). |

### Invariants (write-time enforced)

- Every `Conversation`, `Message`, `KBArticle`, `KBChunk`, `KBSource`, `SupportWidgetConfig`, `CSATResponse` carries `brandId`. Prisma middleware enforces scoping.
- A `Conversation` cannot transition to `RESOLVED` without `resolutionSource` and `resolvedAt` set.
- A `Message` with `role=AI` must have `aiConfidence` and `aiSources` set (`aiSources` may be `[]` if RAG returned zero chunks).
- `LoyaltyEvent` write + `pointsBalance` update remain in one transaction (repo rule #3, unchanged).
- A `KBArticle` is RAG-queryable only when `publishedAt` is set AND every `KBChunk` has `embedStatus=EMBEDDED`.
- `actionMode=AUTO_REPLY` cannot dispatch unless `aiConfidence >= rule.confidenceThreshold`; otherwise the rule falls through to the next matching rule's tier.

### Brand safety

AI is structurally prevented from committing side effects. All mutating actions (refunds, point awards, account changes) route through `DRAFT_FOR_AGENT` or `ESCALATE`. This is enforced by **rule schema** (`actionMode` enum) — a future code change cannot bypass it without a migration.

## 8. Testing

Coverage bar: **P0** (hero flow) — unit + integration + E2E all required.

### Unit (`pnpm test:smoke`)

| Component | Coverage |
|---|---|
| `supportOrchestration` | BAML mocked, pgvector mocked, rule evaluator real. All three `actionMode` branches × confidence above/below threshold × identified/anon. |
| `kbIngestion` | msw HTTP mock. Clean HTML, broken HTML, robots.txt block, redirect chain, sitemap parse, contentHash dedup skip. |
| `supportTimeoutClassifier` | Time mocked. Pre-cutoff, post-cutoff resolved, ambiguous, anon (no emit). |
| `slackOutbound` | Slack client mocked. Signature, retry, give-up. |
| `supportRules.evaluate()` | Extend with `actionMode` resolution + threshold logic. |
| KB chunker | Token-aware split, overlap, oversized-chunk guard. |
| Widget config Zod schema | Round-trip, default fill, color-hex validation, position enum. |
| CSAT idempotency | Second submit returns 200 with original record. |
| Widget Web Component | happy-dom: theming token application, SSE rendering, CSAT click → emit. |

### BAML evals (`pnpm test:baml`)

Per repo rule: tests must never skip. Missing `OPENAI_API_KEY` → fail loudly.

| Function | Eval set |
|---|---|
| `ClassifySupportIntent` | 30+ labeled cases. Pass bar: ≥ 90% intent accuracy, ≥ 85% sensitivity accuracy. |
| `DraftSupportReply` | 20+ cases. Judge model checks: cited chunks used, no fabricated URLs/prices, brand-voice respected, refusal-when-no-coverage. |
| `ClassifyResolution` | 20+ labeled threads. Pass bar: ≥ 85% accuracy, false-resolved rate < 5% (directly drives erroneous loyalty awards). |

### Integration (`pnpm test:integration`)

| Test | What it proves |
|---|---|
| Full lifecycle, identified member | POST message → orchestrate (BAML mocked) → AI reply → CSAT 👍 → `cx.ticket_resolved` → loyalty `LoyaltyEvent` + `pointsBalance` in one transaction. |
| Full lifecycle, anonymous | Same flow, no `memberId`. Resolved correctly, **no** `LoyaltyEvent` emitted. |
| Anonymous → identified upgrade | Mid-conversation `EmailLookup` updates `memberId`. Downstream resolution awards loyalty correctly. |
| KB crawl end-to-end | Mock HTTP serves sitemap + pages → `kbIngestion` populates `KBSource`, `KBArticle`, `KBChunk` with deterministic mock embeddings. Re-crawl with same content → contentHash skips embed. |
| Tiered autonomy branching | Three rules, three messages. Asserts AUTO_REPLY / DRAFT / ESCALATE each route correctly with expected DB + queue state. |
| Timeout resolver | Seed conversation with last message 25h ago → classifier (mocked resolved/true/0.85) → status flips, event emits. |
| Slack inbound webhook | Real Fastify, signed payload → message written, SSE pub/sub. Bad signature → 401, no write. |
| CSAT idempotency | Double-submit returns 200 with original record. |
| Tenant boundary | Brand A agent cannot list/read/PATCH brand B conversations. KB search on A never returns chunks from B. |
| pgvector retrieval correctness | Known chunks inserted, query, asserts ordering by cosine similarity + brandId filter. |

### E2E (`pnpm test:e2e`)

| Flow | Steps |
|---|---|
| Customer happy path | Open `demo-storefront`, click launcher, ask shipping question, AI replies with citation, 👍, assert CSAT recorded, widget shows "Thanks!" |
| Customer escalation | Same widget, ask refund question, widget shows "An agent will follow up", conversation visible in admin inbox. |
| Agent inbox | Admin opens conversations list, opens escalated convo, sees AI-drafted reply, edits, sends, clicks Resolve. |
| Widget theming preview | `/admin/support/widget` → change primary color → live preview iframe updates → save → reload storefront → applied. |
| KB authoring | `/admin/support/knowledge/new` → paste URL → ingestion runs (mock embed) → article + chunks created → visible in list. |

### Performance gates

- `supportOrchestration` p95 < 3s on a fixture conversation with 10k `KBChunk`s. Asserted in integration tier.
- `kbIngestion` for a 50-page sitemap completes < 60s with deterministic mock embeddings.

### Migration safety

- `CREATE EXTENSION IF NOT EXISTS vector;` is supported by Neon + managed Postgres 16.
- Extensions to existing tables use nullable columns with sensible defaults. Zero-downtime, no backfill required.
- The three migrations are independently reversible.

## 9. Out of scope (v1)

- Email channel (inbound + outbound)
- SMS / WhatsApp channels
- Third-party KB sync (Notion, Confluence, HelpScout, Zendesk)
- File upload for KB content (PDF/DOCX/MD) — fast follow
- Custom CSS injection on the widget — slice 2
- Headless SDK
- Multi-language detection / translation
- Voice / video escalation
- Co-browsing / screen sharing
- Deep-link recovery for anonymous lost-cookie sessions
- Mobile-native SDK (iOS / Android)
- Workflow automation builder beyond the existing `SupportRule` engine
- Agent performance scoring / gamification
- Customer satisfaction surveys beyond CSAT thumbs (NPS, CES already handled by the survey module)

## 10. Decomposition into implementation plans

This spec is one product shape but is too large for one implementation. It decomposes into four implementation slices, each its own plan:

1. **Slice 1 — Data + AI orchestrator (P0).** Migrations, BAML functions, `supportOrchestration` processor, extended `SupportRule.actionMode`, `supportRules.evaluate()` upgrade. Largest slice; foundational for everything else.
2. **Slice 2 — KB ingestion (P0).** `KBSource`, `KBChunk`, `kbIngestion` processor, `/admin/support/knowledge` UI, `/v1/support/knowledge` API. Depends on Slice 1's pgvector migration.
3. **Slice 3 — Widget revamp + theming (P0).** `SupportWidgetConfig`, `<ceq-support-chat>` rewrite, `/admin/support/widget` live preview, `/v1/support/widget-config` API. CSAT bar + UI states. Parallelizable with Slice 2 once Slice 1's schema lands.
4. **Slice 4 — Resolution + Slack + loyalty bridge (P0).** `CSATResponse`, `supportTimeoutClassifier`, `slackOutbound` + Slack Events webhook, agent inbox AI-draft banner, resolution → `cx.ticket_resolved` emit wiring. Depends on Slices 1 + 3.

Each slice is independently shippable (gated behind a feature flag if needed) and produces a demoable increment. Slice 1 + Slice 4 together complete the hero loop minimum; Slices 2 + 3 deepen the experience.
