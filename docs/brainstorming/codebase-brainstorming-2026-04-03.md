# Codebase Brainstorming: Lightweight CRM & AI Support Widget — Distance Assessment

**Date:** 2026-04-03
**Focus Areas:** (1) Lightweight CRM with LLM "Know Your Customer" flow, (2) AI-Powered Support Widget

---

## Executive Summary

**Goal 1 — Lightweight CRM with LLM "Know Your Customer":** **~60-70% there.** The data model is CRM-ready. Members, events, surveys, redemptions, campaigns are all linked by `memberId`. The MCP server already lets an LLM query individual pieces. What's missing is a **synthesis layer** — a single API call that assembles the full customer picture, and a BAML function that narrates it.

**Goal 2 — AI-Powered Support Widget:** **~30-40% there.** Strong foundations exist (case management, alert rules with topic/sentiment routing, embeddable widget patterns, AI topic extraction). But the core support-specific components are absent: no knowledge base, no chat UI, no intent classification, no conversational AI. The good news is that every architectural pattern needed to build them already exists in the codebase.

**Key Insight:** Goal 1 is a prerequisite for Goal 2 — the customer context synthesis needed for CRM directly powers personalized support responses.

---

## What Currently Exists

### Customer Data Layer

| Capability | Evidence | Notes |
|---|---|---|
| Member profiles | `packages/database/prisma/schema.prisma` (Member model, lines 154-184) | Email, name, phone, points, tier, consent, status |
| Activity stream | `LoyaltyEvent` (schema.prisma:186-204) | Purchase, survey, campaign, redemption events with payloads |
| Survey responses with AI analysis | `SurveyResponse` (schema.prisma:398-421) | Sentiment (-1 to 1), topics, summary, cluster assignment |
| Redemption history | `Redemption` (schema.prisma:265-278) | What they redeemed, when, points spent |
| Campaign participation | `CampaignEvent` (schema.prisma:303-319) | Which campaigns played, results |
| Tier progression | `Tier` (schema.prisma:229-249) + `Member.currentTierId` | Rank, benefits, multiplier |
| Audit trail | `AuditEvent` (schema.prisma:559-571) | Admin activity logged |
| External CRM ingestion | Salesforce + HubSpot webhooks (`apps/api/src/routes/webhooks.ts`) | Webhook signature verification, event normalization |

### MCP Tools for LLM Access

| Tool | Location | Returns |
|---|---|---|
| `get_member` | `apps/mcp-server/src/tools/members.ts:43` | Full member details |
| `get_member_balance` | `apps/mcp-server/src/tools/members.ts:29` | Points balance + recent 10 events |
| `get_cx_analytics` | `apps/mcp-server/src/tools/analytics.ts:14` | NPS/CSAT/CES/sentiment distribution |
| `get_feedback_clusters` | `apps/mcp-server/src/tools/analytics.ts:46` | Feedback themes with trends |
| `get_anomalies` | `apps/mcp-server/src/tools/analytics.ts:79` | Volume spikes, sentiment drops, new themes |
| `enroll_member` | `apps/mcp-server/src/tools/members.ts:8` | Enroll new member |
| `ingest_event` | `apps/mcp-server/src/tools/events.ts:7` | Ingest CX event into pipeline |

### AI/LLM Pipeline

| Function | Location | Purpose |
|---|---|---|
| `AnalyzeFeedback` | `packages/ai/baml_src/analyze_feedback.baml` | Sentiment, topics, summary, cluster assignment |
| `DiscoverClusters` | `packages/ai/baml_src/discover_clusters.baml` | Batch theme discovery from unassigned feedback |
| `DetectAnomalies` | `packages/ai/baml_src/detect_anomalies.baml` | Volume/sentiment anomaly detection |

### Support-Adjacent Capabilities

| Capability | Evidence | Notes |
|---|---|---|
| Alert rules with topic/sentiment/score routing | `AlertRule` (schema.prisma:475-509) | Rule-based routing already exists for feedback |
| Case management with SLA tracking | `CaseFollowUp` (schema.prisma:511-543) | Status workflow, assignment, notes timeline, SLA breach detection |
| Embeddable survey widget | `apps/api/src/routes/public.ts:392` (`widget.js` endpoint) | Inline JS injection pattern, DOM container creation |
| Multi-channel notifications | Slack, Email, Teams webhooks in AlertRule | Notification infrastructure in place |
| Condition builder UI | `apps/web/src/components/ui/condition-builder.tsx` | Reusable rule editor with operators (eq, ne, lt, gt, contains, etc.) |
| Public API pattern | `/v1/public/*` routes in `apps/api/src/routes/public.ts` | Unauthenticated customer-facing endpoints |
| BullMQ async processing | `apps/api/src/queues/bullmq.ts` | 6 queues: loyalty-events, campaign-triggers, sentiment-analysis, feedback-clustering, notifications, alert-evaluation |

---

## Gap Analysis

### Goal 1: Lightweight CRM — What's Missing

| Gap | Why It Matters |
|---|---|
| **No Customer 360 aggregation** | `GET /v1/members/:id` (members.ts:198) returns flat member record only — no joins for events, surveys, redemptions, campaigns |
| **No LLM customer synthesis** | MCP tools return raw data; no function narrates the customer story |
| **No customer search** | Can only look up members by ID — no search by name, email, behavior, or segment |
| **No customer health score** | No computed metric combining recency, frequency, sentiment, NPS |
| **No contact/interaction logging** | No way to record manual interactions (calls, emails) against a customer |

### Goal 2: Support Widget — What's Missing

| Gap | Why It Matters |
|---|---|
| **No knowledge base** | No articles, FAQs, or troubleshooting guides to power AI responses |
| **No vector search / RAG** | No way to semantically retrieve relevant KB content for a customer query |
| **No intent classification** | Topic extraction exists but no purpose-built intent detection for support |
| **No chat UI** | No chat widget, conversation interface, or real-time messaging component |
| **No conversation model** | No data model for chat threads, messages, or conversation state |
| **No rule-based response engine** | Alert rules route notifications but don't auto-generate responses |
| **No customer context in responses** | Even if chat existed, no mechanism to inject customer profile into LLM context |

---

## Grounded Suggestions

### S1: Customer 360 API Endpoint + MCP Tool (CRM Foundation)

- **Builds on:** `GET /v1/members/:id` (`apps/api/src/routes/members.ts:198`) currently returns flat member record only — no joins
- **What changes:** New `GET /v1/members/:id/360` endpoint that aggregates: member profile + last N loyalty events + survey responses (with sentiment/topics) + redemptions + campaign events + current tier + open cases
- **MCP addition:** New `get_customer_360` tool in `apps/mcp-server/src/tools/members.ts` calling this endpoint
- **Impact:** Enables any LLM to get full customer context in a single call. This is the foundational building block for both CRM and support.
- **Effort:** Small — all data already linked via `memberId` foreign keys

### S2: LLM-Powered KYC Synthesis (BAML Function)

- **Builds on:** Existing BAML infrastructure in `packages/ai/baml_src/`, specifically the `AnalyzeFeedback` pattern
- **What changes:** New `SynthesizeCustomerProfile` BAML function that takes Customer 360 data and produces: engagement level, sentiment trajectory, preferences, risk signals (churn indicators), recommended actions, natural-language summary
- **Impact:** An LLM calling the MCP can invoke `get_customer_360` → feed result to this BAML function → get a human-readable customer narrative. This is the "Know Your Customer" flow.
- **Effort:** Small-Medium — follows established BAML function pattern

### S3: Customer Search with Behavioral Filters

- **Builds on:** `Member` table has `[brandId, email]` unique index (schema.prisma:180)
- **What changes:** New `GET /v1/members` list endpoint with filters: search (name/email), tier, sentiment range (from survey responses), NPS score range, points balance range, enrollment date range, status
- **MCP addition:** `search_members` tool
- **Impact:** Enables finding customers by behavioral criteria ("show me at-risk promoters" = NPS >= 9 but recent sentiment < -0.3)
- **Effort:** Small — standard Prisma query with optional where clauses

### S4: Customer Health Score

- **Builds on:** All signals exist — `LoyaltyEvent` (recency/frequency), `SurveyResponse.sentiment` (sentiment trajectory), `Member.pointsBalance` (engagement), `CampaignEvent` (participation)
- **What changes:** Computed field on Member or new scheduled job that calculates a 0-100 health score from: recency of last event, frequency of engagement, average sentiment, NPS trend, redemption activity
- **Impact:** Instant at-a-glance customer health for CRM views; enables proactive outreach for at-risk customers
- **Effort:** Medium — needs scoring formula + batch computation job (reuse BullMQ pattern from `apps/api/src/queues/bullmq.ts`)

### S5: Knowledge Base with Vector Search (Support Foundation)

- **Builds on:** Database multi-tenant pattern (`brandId` on every model), existing Prisma schema patterns
- **What changes:** New `KnowledgeBase` and `KBArticle` Prisma models (title, body, category, tags, embedding vector). New CRUD API routes. Vector embeddings generated via OpenAI embeddings API (already have `OPENAI_API_KEY` dependency from BAML). Search via pgvector extension or external vector DB.
- **Impact:** Enables AI to retrieve relevant help articles when answering customer questions
- **Effort:** Medium — new models + embedding pipeline + vector search

### S6: Intent Classification BAML Function

- **Builds on:** `AnalyzeFeedback` BAML function already extracts topics from free text (`packages/ai/baml_src/analyze_feedback.baml`)
- **What changes:** New `ClassifyIntent` BAML function that takes customer message text and returns: primary intent (billing, shipping, product_question, complaint, feature_request, praise, etc.), confidence score, suggested KB article IDs (if KB exists), urgency level, suggested response outline
- **Impact:** Powers automated routing in support widget; enables rule-based responses
- **Effort:** Small-Medium — follows established BAML pattern

### S7: Embeddable Support Chat Widget

- **Builds on:** Existing embeddable widget pattern (`apps/api/src/routes/public.ts:392` — `widget.js` served as inline JS), existing `ceq-survey-widget` DOM injection pattern
- **What changes:** New `<ceq-support-chat>` web component with: chat bubble launcher, conversation thread UI, member identification (email or token), WebSocket/SSE for real-time. Backend: new `Conversation` and `Message` Prisma models, new API routes for message send/receive
- **Orchestration:** On message received → `ClassifyIntent` (S6) → retrieve KB articles via RAG (S5) → inject Customer 360 context (S1) → LLM generates personalized response → if confidence low, escalate to `CaseFollowUp` (existing)
- **Impact:** Customer-facing AI support powered by full customer intelligence
- **Effort:** Large — new UI component, new models, real-time infrastructure, LLM orchestration

### S8: Rule-Based Response Engine

- **Builds on:** `AlertRule` condition matching pattern (schema.prisma:475-509) — surveyTypes, scoreMin/Max, sentimentThreshold, topicFilters. Also: campaign trigger condition evaluation in `apps/api/src/routes/events.ts:112-142` (field/operator/value matching)
- **What changes:** New `SupportRule` model extending AlertRule pattern: match on intent (from S6), customer tier, health score (S4), topic. Actions: auto-respond with KB article, escalate to human, award points (apology gesture), trigger survey. Reuse `condition-builder.tsx` UI component for rule creation.
- **Impact:** Configurable, no-code support automation — brand admins define rules like "if intent=billing AND tier=Gold, respond with KB article X and escalate to account manager"
- **Effort:** Medium — extends proven patterns

---

## Recommended Implementation Order

```
Phase A (CRM Core — ~2 sprints):
  S1: Customer 360 API + MCP tool
  S3: Customer search with behavioral filters
  S2: KYC synthesis BAML function

Phase B (CRM Intelligence — ~1-2 sprints):
  S4: Customer health score

Phase C (Support Foundation — ~2-3 sprints):
  S5: Knowledge base + vector search
  S6: Intent classification BAML function

Phase D (Support Widget — ~3-4 sprints):
  S7: Embeddable support chat widget
  S8: Rule-based response engine
```

### Dependency Graph

```
S1 (Customer 360) ──┬──> S2 (KYC Synthesis) ──> S4 (Health Score)
                     │
                     └──> S7 (Chat Widget) ──> S8 (Rule Engine)
                              ↑         ↑
                     S5 (KB + RAG) ──┘         │
                     S6 (Intent Classification) ┘
```

---

## Visionary Ideas (10x Thinking)

These are speculative/futuristic concepts that go beyond incremental improvement:

1. **Predictive Customer Journey AI** — Instead of reactive support, the system predicts what the customer will need next based on their trajectory through loyalty events, sentiment trends, and behavioral patterns. Proactively surfaces relevant content, offers, or support before the customer asks.

2. **Autonomous Customer Success Agent** — A fully autonomous AI agent that monitors customer health scores, detects at-risk customers, drafts personalized retention campaigns, and executes them through the existing campaign infrastructure — all without human intervention.

3. **Cross-Brand Customer Intelligence Network** — Anonymized, aggregated insights across all brands on the platform. "Customers who exhibit pattern X typically churn within 30 days" — powered by federated learning across the multi-tenant dataset.

4. **Voice of Customer → Product Roadmap Pipeline** — Feedback clusters and anomaly detection feed directly into a product prioritization engine. The system doesn't just detect "shipping complaints are spiking" — it drafts the product requirement, estimates impact based on affected customer value, and queues it for PM review.

---

## Verification Checklist

- [x] All "Currently Exists" items have file paths
- [x] No hypothetical functionality is presented as real
- [x] All "Could Be Built" suggestions reference an existing architectural foundation
- [x] Clear distinction exists between current state and future possibilities
- [x] Each suggestion has a realistic implementation approach (not just a label)
