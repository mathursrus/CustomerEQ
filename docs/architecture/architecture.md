# Architecture Documentation: CustomerEQ

**Date**: 2026-03-25
**Status**: Approved — updated from codebase analysis
**Audience**: Engineers, AI agents, technical reviewers

---

## 1. Overview

CustomerEQ is a B2B SaaS unified CX-Loyalty platform targeting mid-market companies ($10M-$500M revenue). Its core value proposition is the **real-time CX-to-loyalty feedback loop**: ingesting customer experience signals (NPS scores, support tickets, reviews) and automatically triggering loyalty actions within 15 minutes — versus the industry average of 82 hours.

The platform is a multi-tenant loyalty engine with:
- A loyalty program engine (points earn/burn, rewards catalog, redemptions)
- A campaign automation engine (rule-based CX event -> loyalty action)
- A CRM integration layer (Salesforce, HubSpot webhook ingestion)
- An analytics dashboard (ROI measurement, campaign performance, external signal analysis)
- A member-facing portal (enrollment, points balance, reward redemption)
- An admin portal (program management, campaign configuration, integrations, external signal source management)

---

## 2. Tech Stack Choices

| Category | Choice | Rationale |
| :--- | :--- | :--- |
| **Language** | TypeScript 5.4 (strict mode) | Type safety across all apps and packages; shared types prevent API/frontend contract drift |
| **Runtime** | Node.js >= 20 | LTS with native ESM support; shared runtime across API, worker, and frontend SSR |
| **Frontend** | Next.js 15 (App Router) + React 18 | SSR/SSG for marketing, RSC for data-heavy dashboards, client components for interactive forms |
| **UI** | Tailwind CSS v4 + shadcn/ui (Radix primitives) | Utility-first CSS with accessible, copy-into-repo components — no black-box theme system to fight |
| **Backend** | Fastify v5 | Schema-first routes with auto-validation, ~2x Express throughput, clean plugin architecture |
| **ORM** | Prisma 5.13 | Type-safe queries, migration management, middleware for multi-tenant `brandId` scoping |
| **Database** | PostgreSQL 16 | ACID transactions for loyalty ledger integrity; JSONB for flexible rule conditions/event payloads |
| **Cache/Queue (optional)** | Redis 7 + BullMQ v5 | Optional optimization for async job queues, idempotency keys, and campaign deduplication. When `QUEUE_MODE=inline` (default fallback), all queued work runs synchronously in-process with no Redis dependency — suitable for single-instance deployments, demos, and development. Redis becomes required only when scaling horizontally or when idempotency guarantees must survive process restarts. |
| **Auth** | Clerk | Native Next.js support, multi-tenant organizations (Clerk org = brand), JWT verification |
| **Testing** | Vitest + Supertest + Playwright | Unit/integration (Vitest), HTTP testing (Supertest), E2E browser (Playwright) |
| **Build** | Turborepo + pnpm 9 | Monorepo task orchestration with caching; pnpm for strict dependency isolation |
| **Logging** | Pino v9 | Structured JSON logging, low-overhead, Fastify's native logger |
| **Validation** | Zod 3.23 | Runtime schema validation shared between API request parsing and frontend forms |
| **Infra** | Azure (API/worker/DB/cache) + Vercel (frontend) | Azure credits for backend; Vercel for zero-ops Next.js with first-party App Router support |
| **IaC** | Terraform | Provider-agnostic — manages both Azure resources and Vercel project config |

---

## 3. Architectural Layers

### 3.1. Presentation Layer (apps/web)
- **Responsibility**: Marketing site (SSR/SSG), admin portal (program/campaign/analytics management), member portal (dashboard, rewards catalog, redemptions).
- **Key Modules**: `apps/web/src/app/(marketing)/` (public pages), `apps/web/src/app/(admin)/` (admin portal), `apps/web/src/app/(member)/` (member portal)
- **Auth**: Clerk middleware guards all non-public routes; `ClerkProvider` wraps the app layout. Public routes: `/`, `/sign-in`, `/request-demo`, `/api/public/*`, `/survey/*`, `/{programSlug}/enroll` (Issue #3 — enrollment requires no prior auth)
- **API Communication**: Server components fetch with Clerk token; client components use `useAuth()` hook
- **Admin home entry point**: `/admin/page.tsx` (RSC) is the operator home dashboard — fetches `GET /v1/analytics/program-health` server-side and renders the unified CX+Loyalty panels. `/admin/analytics` remains as a deeper drill-down analytics view. (Issue #78)
- **Context-aware navigation**: CX metric click-throughs use `searchParams` to pre-populate campaign/survey builder forms without a separate API round-trip (e.g., `filter=detractors&maxNps=6` pre-fills the campaign builder audience segment). (Issue #78)
- **Client-side utilities**: Pure, web-only functions (e.g. recommendation lookups, formatting helpers) are co-located in `apps/web/src/utils/` — not exported to `packages/shared`. Use this location for functions that have no server-side or cross-package use case. (Issue #79)

### 3.2. API Layer (apps/api)
- **Responsibility**: RESTful API (versioned at `/v1/`), request validation (Zod), authentication (Clerk JWT), multi-tenant scoping, event ingestion, campaign trigger evaluation, audit logging.
- **Key Modules**: `apps/api/src/routes/` (domain routes), `apps/api/src/plugins/` (auth, multiTenant, audit, prisma, redis), `apps/api/src/queues/` (BullMQ queue factories)
- **Entry Point**: `apps/api/src/server.ts` -> `app.ts` (Fastify factory)
- **Plugin Registration Order**: CORS -> Sensible -> Prisma -> Redis -> Auth -> MultiTenant -> Audit

### 3.3. Event Processing Layer (apps/worker)
- **Responsibility**: Asynchronous processing of loyalty events, campaign trigger execution, notification delivery, feedback clustering, sentiment analysis, alert evaluation, health score computation, and external signal sync/ingestion.
- **Key Modules**: `apps/worker/src/processors/` (loyaltyEvents, campaignTriggers, notifications, sentimentAnalysis, feedbackClustering, embeddingGeneration, healthScore, externalSignalSync, externalSignalIngestion), `apps/worker/src/queues/` (Redis connection, producers)
- **Entry Point**: `apps/worker/src/index.ts` (bootstraps 9 BullMQ workers)
- **Concurrency**: loyalty-events (5), campaign-triggers (10), notifications (5), sentiment-analysis (5), feedback-clustering (1), embedding-generation (5), health-score-computation (3), external-signal-sync (2), external-signal-ingestion (3)

### 3.4. Data Layer (packages/database)
- **Responsibility**: Schema definition (Prisma), migrations, database client singleton.
- **Key Modules**: `packages/database/prisma/schema.prisma` (core loyalty, CX, survey, AI, and external signal models), `packages/database/src/` (client exports)

### 3.5. Shared Layer (packages/shared + packages/config)
- **Responsibility**: Cross-app type contracts (Zod schemas, TypeScript interfaces, queue name constants, pure evaluation helpers), shared test infrastructure (factories, mocks, helpers).
- **Key Modules**: `packages/shared/src/zod/` (request/response schemas), `packages/shared/src/types/` (internal payload interfaces), `packages/shared/src/externalSignals.ts` (external signal normalization + helper types), `packages/shared/src/queues.ts` (queue names), `packages/shared/src/conditions.ts` (`ConditionGroup` type + `evaluateConditions()` — used by both API simulate endpoint and worker rule evaluator), `packages/shared/src/supportRules.ts` (`evaluateSupportRules()` — support rule matching against conversation context), `packages/config/src/test-utils/` (factories, mocks, DB setup, helpers)

### 3.6. UI Layer (packages/ui)
- **Responsibility**: Shared Tailwind utility (`cn()` class merging). UI components are currently co-located in `apps/web/src/`.
- **Key Modules**: `packages/ui/src/utils.ts`

### 3.7. Embed Layer (packages/embed)
- **Responsibility**: CDN-distributed, standalone JavaScript components for embedding CustomerEQ experiences in brand websites. Uses Web Components (Custom Elements) with Shadow DOM for style isolation.
- **Key Modules**: `packages/embed/src/ceq-spin-wheel.ts` (spin-the-wheel campaign component), `packages/embed/src/ceq-support-chat.ts` (embeddable support chat widget)
- **Build**: Vite library mode, IIFE format, ES2020 target. Output: single JS file per component (~7 KB gzipped).
- **Auth**: Each component receives a member JWT token as an HTML attribute and calls public API endpoints.
- **Theming**: CSS custom properties (`--ceq-font-family`, `--ceq-primary-color`, `--ceq-background-color`) pierce Shadow DOM for brand customization.
- **Events**: Components fire custom DOM events (e.g., `ceq:reward-won`) so host pages can react.
- **No cross-package imports**: Standalone at build time — does not import from `@customerEQ/shared` or other packages.

---

## 4. Key Components & Modules

```mermaid
graph TD
    subgraph External
        SF[Salesforce]
        HS[HubSpot]
        ES[External Signal Sources]
        CL[Clerk Auth]
    end

    subgraph "apps/web (Next.js 15)"
        MP[Marketing Pages]
        AP[Admin Portal]
        MBP[Member Portal]
    end

    subgraph "apps/api (Fastify v5)"
        AUTH[Auth Plugin]
        MT[MultiTenant Plugin]
        AUDIT[Audit Plugin]
        ROUTES[Route Handlers]
        QUEUES[BullMQ Queues]
    end

    subgraph "apps/worker (BullMQ)"
        LE[Loyalty Events Processor]
        CT[Campaign Triggers Processor]
        NF[Notifications Processor]
        ESS[External Signal Sync]
        ESI[External Signal Ingestion]
    end

    subgraph Infrastructure
        PG[(PostgreSQL 16)]
        RD[(Redis 7)]
    end

    subgraph "packages/*"
        DB[database - Prisma]
        SH[shared - Zod/Types]
        CFG[config - Test Utils]
    end

    SF -->|Webhook HMAC| ROUTES
    HS -->|Webhook HMAC| ROUTES
    ES -->|Webhook / Poll| ROUTES
    CL -->|JWT| AUTH
    AP --> ROUTES
    MBP --> ROUTES
    AUTH --> MT --> ROUTES
    ROUTES --> AUDIT
    ROUTES --> QUEUES
    QUEUES --> RD
    RD --> LE
    RD --> CT
    RD --> NF
    RD --> ESS
    RD --> ESI
    LE --> DB
    CT --> DB
    CT --> NF
    ESS --> ESI
    ESI --> DB
    DB --> PG
    ROUTES --> DB
```

### 4.1 API Routes

All list endpoints return a standard pagination envelope: `{ data, total, page, pageSize, totalPages }`.

| Route Prefix | Responsibility |
|---|---|
| `GET /healthz` | Public health check (DB + Redis status) |
| `/v1/programs` | CRUD for loyalty programs + earning rules + tiers + rewards (retire) + simulate + versions; status transitions via `PUT /programs/:id/status`. Sub-resource `GET /v1/programs/:id/trigger-options` — computed/derived configuration data (earn rule → display label mapping for survey trigger wizard). **Convention**: read-only sub-resources on `/v1/programs/:id/` for derived config data follow GET-only, no-pagination pattern. (Issue #79) |
| `/v1/members` | Member enrollment (idempotent), balance queries, member list with health score filters, Customer 360 view (aggregated profile with health score breakdown, activity, stats, and matched external signals) |
| `/v1/events` | **Hero endpoint** — event ingestion with idempotency + sync campaign evaluation |
| `/v1/campaigns` | Campaign CRUD + status management (DRAFT -> ACTIVE -> PAUSED -> COMPLETED) |
| `/v1/rewards` | Reward catalog management |
| `/v1/redemptions` | Atomic point redemption (transactional debit + stock decrement) |
| `/v1/analytics` | Overview KPIs (ROI, redemption rate) + per-campaign performance. `GET /v1/analytics/program-health` — unified CX+loyalty health snapshot (fixed 30d/7d windows); all sub-queries run in `Promise.all`; insights computed in-process by `computeInsights()` (deterministic rule engine — 3 rules; LLM generation deferred). (Issue #78). `GET /v1/analytics/reach-estimate` — projected member reach for a given trigger key over 30 days; follows graceful-degradation contract: DB/timeout failures return `{ estimatedCount: null, reason: '...' }` (200) rather than 5xx to prevent UI blocking. (Issue #79). `GET /v1/analytics/cx/external-signals` adds the normalized external-signal feed used by the CX workspace. **Convention**: all analytics sub-query endpoints follow this graceful-degradation contract — non-critical reads must never return 5xx. |
| `/v1/integrations/webhooks/*` | Salesforce + HubSpot webhook receivers (HMAC-SHA256 verified) plus source-scoped external signal webhook ingestion at `/v1/integrations/webhooks/external-signals/:sourceId` |
| `/v1/surveys` | Survey CRUD + status management + question builder updates |
| `/v1/themes` | Survey theme CRUD + set-default (brand-scoped white-labeling) |
| `/v1/question-templates` | Question template library CRUD (save/reuse questions across surveys) |
| `/v1/public/*` | Demo request form, public survey fetch (with theme), survey response submission (no auth), campaign play endpoint (member JWT auth). `GET /v1/public/programs/by-slug/:slug` — resolves programId/brandId for member enrollment entry point (no auth) |
| `/v1/admin/*` | Demo request list, integration webhook URLs, health score recomputation trigger, external signal source registry (`/admin/external-signal-sources`) and admin external-signal feed (`/admin/external-signals`) |

### 4.2 Fastify Plugins

| Plugin | Hook | Purpose |
|---|---|---|
| **auth** | `preHandler` | Clerk JWT verification, extracts `brandId` + `clerkUserId` from org token. Test mode: `X-Test-Brand-Id`/`X-Test-User-Id` headers in dev/test. |
| **multiTenant** | `preValidation` | Rejects any request body containing `brandId` — must come from JWT only |
| **audit** | `onResponse` | Fire-and-forget logging of mutations (POST/PATCH/DELETE/PUT) to `AuditEvent` table |
| **prisma** | decorator | Singleton Prisma client, graceful disconnect on shutdown |
| **redis** | decorator | IORedis client for queues and idempotency, graceful quit on shutdown |
| **memberAuth** | helper | Lightweight member JWT verification for public endpoints. Uses `Authorization: Bearer <token>` header with Clerk `verifyToken()`. Returns member email/sub claims. Unlike org-level auth plugin, does not require Clerk organization context. Used by `/v1/public/campaigns/:id/play`. |

### 4.3 BullMQ Workers

| Queue | Processor | Concurrency | Key Logic |
|---|---|---|---|
| `loyalty-events` | `processLoyaltyEvent` | 5 | Idempotency check -> `evaluateRulesWithIds()` (priority ASC, first-match-wins, stackable opt-in, per-rule `budgetCapPoints` check) -> atomic transaction (LoyaltyEvent + pointsBalance increment) |
| `campaign-triggers` | `processCampaignTrigger` | 10 | Redis dedup (SET NX) -> budget cap check -> atomic award (LoyaltyEvent + pointsBalance + CampaignEvent + budgetSpent) -> optional notification. For `spin_wheel` campaigns: weighted random selection (`crypto.randomInt`) -> result stored in `CampaignEvent.result` JSON -> points/redemption award -> notification with spin link. |
| `notifications` | `processNotification` | 5 | MVP stub — routes to email/SMS provider when `EMAIL_PROVIDER` is configured |
| `sentiment-analysis` | `createSentimentProcessor` | 5 | AI-powered sentiment analysis of survey response text via GPT-4o |
| `feedback-clustering` | `processFeedbackClustering` | 1 | AI-powered feedback clustering with anomaly detection |
| `alert-evaluation` | `processAlertEvaluation` | 10 | Rule-based alert evaluation creating case follow-ups |
| `health-score-computation` | `processHealthScore` | 3 | Batch health score computation for members (weighted formula: recency 25%, frequency 20%, sentiment 25%, NPS 15%, engagement 15%) |
| `embedding-generation` | `processEmbeddingGeneration` | 5 | Generates and stores KB embeddings for semantic search |
| `external-signal-sync` | `createExternalSignalSyncProcessor` | 2 | Polls or simulates source deliveries from `samplePayloads` / `seedSignals`, updates source health, and enqueues normalized ingestion work |
| `external-signal-ingestion` | `processExternalSignalIngestion` | 3 | Normalizes provider payloads, deduplicates by `sourceId + externalId`, persists `ExternalSignal`, and updates source health/status history |

### 4.4 Database Models

| Model | Purpose |
|---|---|
| **Brand** | Multi-tenant root entity. `clerkOrgId` (unique) maps Clerk organization to tenant. |
| **Program** | Loyalty program per brand. Status: DRAFT/ACTIVE/PAUSED/ARCHIVED. Type: POINTS/TIERED/CASHBACK/HYBRID. Budget: `budgetUsdCents`, `monthlyBudgetUsdCents`, `alertThresholdPct`, `haltBehavior`. Soft-deleted via `deletedAt`. New (Issue #3): `slug` (unique URL-safe identifier, used as enrollment entry point `/{slug}/enroll`). |
| **EarningRule** | Point-earning triggers. `triggerEvent` matches event types. Supports `multiplier`, `maxUsesPerMember`, validity windows, JSONB `conditions` (AND/OR groups). New: `priority` (lower = evaluated first), `stackable` (fires after first match), `budgetCapPoints` (per-rule point spend cap). |
| **Tier** | *New (Issue #2).* Tier ladder entry within a program (Bronze/Silver/Gold/Platinum). Fields: `rank` (ordering), `minPoints`, `minSpendCents` (entry criteria), `benefits[]`, `multiplier`. Soft-deleted via `deletedAt`. Assignment of `Member.currentTierId` deferred to Issue #4. |
| **ProgramVersion** | *New (Issue #2).* Immutable JSON snapshot of a program's full configuration at a point in time. `source`: `explicit_save` (user-triggered) or `auto_save` (step-change). Used for audit history and rollback. |
| **Member** | Loyalty program participant. Unique by `brandId + email`. Tracks `pointsBalance`, consent, GDPR erasure. Status: ACTIVE/INACTIVE/ERASED. New (Issue #3): `emailOptIn`/`smsOptIn` (default false — explicit opt-in only), `consentGivenAt` (ISO datetime, NOT NULL), `consentVersion` (policy identifier). `currentTierId` FK deferred to Issue #4. New (Issue #99): `healthScore` (0-100 computed metric, nullable), `healthScoreUpdatedAt` (batch-computed, not transactional like `pointsBalance`). Index: `(brandId, healthScore)`. |
| **LoyaltyEvent** | Append-only ledger. `pointsEarned` (positive = earn, negative = burn). Stores `rulesApplied`, `idempotencyKey`, `payload` (JSONB). |
| **Reward** | Redeemable catalog item. `pointsCost`, optional `stock` (null = unlimited), `isAvailable` flag. New: `type` (DISCOUNT/FREE_ITEM/EXPERIENCE/VOUCHER), `availableFrom`, `availableTo`, `eligibleTierIds[]`, `deletedAt` (soft-delete via retire endpoint). |
| **Redemption** | Point spend record linking member -> reward. Status: PENDING/FULFILLED/CANCELLED. |
| **Campaign** | Rule-based automation. `triggerType` + `triggerCondition` (JSON) -> `actionType` + `actionConfig` (JSON). Budget cap tracking. |
| **CampaignEvent** | Campaign trigger execution record. Unique per `campaignId + memberId`. Tracks `latencyMs`. |
| **Survey** | CX feedback collection. Types: NPS/CSAT/CES/CUSTOM. Extended questions JSON supports 11 question types, skip logic, answer piping. Optional `themeId` FK to SurveyTheme. New (Issue #79): `triggerCategory` (loyalty/cx_risk/scheduled), `triggerKey` (e.g. tier_upgrade), `surveyTypeOverride` (non-null when manager deviated from recommendation) — all nullable, backwards-compatible. |
| **SurveyResponse** | Individual feedback with AI-analyzed sentiment, topics, confidence, cluster assignment. |
| **ExternalSignalSource** | Brand-scoped registry of review/social inputs. Stores `sourceType`, `connectionMethod`, `syncMode`, scope/filter/matching config, credential reference, health status, and last sync diagnostics. |
| **ExternalSignal** | Normalized external review/social record. Stores `sourceId`, `externalId`, optional `memberId`, match status/confidence, provider metadata, canonical URL, `postedAt`, `ingestedAt`, and `statusHistory`. Unique on `(sourceId, externalId)`. |
| **SurveyTheme** | Brand-level white-labeling: colors, typography, layout, logo, thank-you page config. One default per brand. Applied via CSS custom properties on public survey page. |
| **QuestionTemplate** | Reusable question library. Stores full question definition (JSON) with tags for discovery. Brand-scoped. |
| **FeedbackCluster** | AI-discovered feedback theme groupings with trend tracking. |
| **DemoRequest** | Public demo signup captures (no auth). |
| **AuditEvent** | System audit trail for admin mutations. |

---

## 5. Data Flow

### 5.1 Event Ingestion (Hero Feature)

```mermaid
sequenceDiagram
    participant Ext as External System
    participant API as Fastify API
    participant Redis as Redis
    participant LEQ as loyalty-events Queue
    participant CTQ as campaign-triggers Queue
    participant Worker as Worker
    participant DB as PostgreSQL

    Ext->>API: POST /v1/events (JWT + payload)
    API->>API: Auth plugin: verify JWT, extract brandId
    API->>Redis: Check idempotency key (24h TTL)
    alt Duplicate
        API-->>Ext: 200 (cached jobId)
    else New Event
        API->>DB: Validate member exists + consent given
        API->>LEQ: Enqueue loyalty event
        API->>Redis: Store idempotency key
        API->>DB: Query active campaigns matching triggerType
        loop Each matching campaign
            API->>API: Evaluate triggerCondition vs payload
            API->>CTQ: Enqueue campaign trigger (priority 10)
        end
        API-->>Ext: 202 Accepted (jobId)
        LEQ->>Worker: Process loyalty event
        Worker->>DB: Evaluate earning rules + atomic transaction
        CTQ->>Worker: Process campaign trigger
        Worker->>Redis: Dedup check (SET NX)
        Worker->>DB: Budget check + atomic award
    end
```

### 5.2 Redemption Flow

```mermaid
sequenceDiagram
    participant Member as Member Portal
    participant API as Fastify API
    participant DB as PostgreSQL

    Member->>API: POST /v1/redemptions (rewardId)
    API->>DB: Find member (verify brand)
    API->>DB: Find reward (verify brand, available, stock)
    API->>API: Validate points >= pointsCost
    API->>DB: BEGIN TRANSACTION
    DB->>DB: Decrement member.pointsBalance
    DB->>DB: Decrement reward.stock (if limited)
    DB->>DB: Create LoyaltyEvent (negative points)
    DB->>DB: Create Redemption (PENDING)
    API->>DB: COMMIT
    API-->>Member: 201 (redemption details)
```

### 5.3 Webhook Ingestion (Salesforce/HubSpot)

```mermaid
sequenceDiagram
    participant CRM as Salesforce / HubSpot
    participant API as Fastify API
    participant DB as PostgreSQL
    participant Q as loyalty-events Queue

    CRM->>API: POST /v1/integrations/webhooks/{provider}
    API->>API: Verify HMAC-SHA256 signature (timing-safe)
    API->>API: Normalize payload to InternalCxEvent
    API->>DB: Lookup member by email + brandId
    alt Member found with consent
        API->>Q: Enqueue loyalty event
        API-->>CRM: 200 OK
    else No member or no consent
        API-->>CRM: 200 OK (skipped, logged)
    end
```

---

### 5.4 External Signal Ingestion

```mermaid
sequenceDiagram
    participant Admin as Admin / Provider
    participant API as Fastify API
    participant SQ as external-signal-sync Queue
    participant IQ as external-signal-ingestion Queue
    participant WK as Worker
    participant DB as PostgreSQL

    Admin->>API: POST /v1/admin/external-signal-sources/:id/sync
    API->>SQ: Enqueue source sync
    SQ->>WK: processExternalSignalSync
    WK->>IQ: enqueue normalized deliveries
    IQ->>WK: processExternalSignalIngestion
    WK->>DB: Upsert ExternalSignal + update ExternalSignalSource health

    Note over Admin,API: Providers can also push directly to\nPOST /v1/integrations/webhooks/external-signals/:sourceId
    API->>IQ: Enqueue webhook deliveries
```

---

## 6. Design Patterns & Principles

- **Event-Driven Processing**: Synchronous ingestion decoupled from asynchronous processing. API returns 202 immediately; workers handle point calculation and campaign execution. Preserves the <15-minute SLA by processing campaign triggers at high priority (concurrency 10).

- **Multi-Tenant Isolation**: `brandId` is injected from verified JWT at the auth layer. The multiTenant plugin rejects `brandId` in request bodies. All Prisma queries are scoped to `brandId`. Defense in depth: DB-level foreign key constraints prevent cross-tenant references.

- **Append-Only Loyalty Ledger**: `LoyaltyEvent` is the source of truth for points. `Member.pointsBalance` is a materialized counter updated atomically within the same transaction as the ledger write. This prevents balance drift and preserves full audit history.

- **Idempotency**: When Redis is available, 24-hour TTL keys on event ingestion and SET NX for campaign trigger deduplication (one trigger per member per campaign). When running in `QUEUE_MODE=inline`, idempotency falls back to the database-level `idempotencyKey` column on `LoyaltyEvent` and the `@@unique([campaignId, memberId])` constraint on `CampaignEvent` — correct but without the fast-path cache. Redis is an optimization for write-heavy traffic, not a correctness requirement.

- **Transactional Integrity**: All point mutations (earn and burn) use Prisma `$transaction` to atomically write the `LoyaltyEvent` and update `pointsBalance`. Redemptions atomically debit points, decrement stock, and create the redemption record.

- **Budget-Capped Campaigns**: Campaign triggers calculate USD cost (`points * pointToCurrencyRatio`) and auto-pause campaigns when `budgetSpent` exceeds `budgetCap`.

- **Signature-Verified Webhooks**: Salesforce and HubSpot webhooks are HMAC-SHA256 verified with timing-safe comparison before any processing. External signal webhooks are source-scoped and validated against the source's configured shared secret before ingestion is queued.

- **Conservative External Identity Resolution**: External public content never attaches to a member record unless the ingestion pipeline has a deterministic match. Unmatched content remains brand-scoped (and optionally subject-scoped) so Customer 360 does not merge uncertain public identities into first-party profiles.

- **Centralized Test Infrastructure**: All mocks, factories, and test helpers live in `packages/config/src/test-utils/`. Tests import from `@customerEQ/config/test-utils` — never define inline mocks. This prevents mock drift across test files.

- **GDPR/CCPA by Default**: Soft deletes, consent tracking (`consentGivenAt`, `consentVersion`), and erasure support are baked into the Member model from MVP.

---

## 7. Configuration & Environment

### 7.1 FRAIM Config
Located at `fraim/config.json`. Architecture doc pointer: `customizations.architectureDoc` -> `docs/architecture/architecture.md`.

### 7.2 Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgresql://customerEQ:customerEQ@localhost:5432/customerEQ` | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection for BullMQ + idempotency |
| `CLERK_SECRET_KEY` | — | Clerk JWT verification key |
| `CLERK_PUBLISHABLE_KEY` | — | Clerk frontend key |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | — | Clerk key exposed to browser |
| `API_PORT` | `4000` | Fastify server port |
| `API_HOST` | `0.0.0.0` | Fastify server host |
| `API_BASE_URL` | `https://api.customerEQ.io` | Used in admin integration endpoint URLs |
| `SALESFORCE_WEBHOOK_SECRET` | — | HMAC secret for Salesforce webhook verification |
| `SALESFORCE_BRAND_ID` | — | Brand ID for Salesforce webhook events |
| `HUBSPOT_WEBHOOK_SECRET` | — | HMAC secret for HubSpot webhook verification |
| `HUBSPOT_BRAND_ID` | — | Brand ID for HubSpot webhook events |
| `EMAIL_PROVIDER` | `stub` | Email provider (`stub` for MVP, `sendgrid` or `resend` for production) |
| `AZURE_APPLICATION_INSIGHTS_CONNECTION_STRING` | — | Azure observability |
| `NODE_ENV` | — | `test` enables header-based auth bypass for integration tests |
| `LOG_LEVEL` | `info` | Fastify/Pino log level |

### 7.3 Local Development

```bash
# Prerequisites: Docker, Node.js >= 20, pnpm >= 9
pnpm install
docker compose up -d          # PostgreSQL 16 + Redis 7
cp .env.example .env          # Configure local secrets
pnpm db:generate              # Generate Prisma client
pnpm db:migrate               # Run migrations
pnpm dev                      # Start all apps in parallel (Turborepo)
```

### 7.4 Validation Commands (CI Gate)

```bash
pnpm build       # Turbo build — all apps + packages
pnpm typecheck   # tsc --noEmit — strict mode, zero errors
pnpm lint        # ESLint — zero errors
pnpm test        # Vitest unit + integration tests
pnpm test:e2e    # Playwright E2E (requires running app)
```

Smoke test (pre-deploy): `pnpm build && pnpm typecheck && pnpm test`

---

## 8. Infrastructure

| Component | Service | Rationale |
|---|---|---|
| API | Azure Container Apps | Serverless containers, scale-to-zero, built-in ingress |
| Worker | Azure Container Apps | Same image as API, separate app, scales independently |
| Database | Azure Database for PostgreSQL Flexible Server | Managed PostgreSQL 16, HA, automated backups, encryption at rest |
| Cache/Queue | Azure Cache for Redis | Managed Redis 7, supports BullMQ, zone-redundant in production |
| Frontend | Vercel | Zero-ops Next.js deploys, first-party App Router support, edge CDN |
| Object Storage | Azure Blob Storage | Receipt images, export files |
| CDN | Azure Front Door | Global CDN + WAF + load balancing |
| Secrets | Azure Key Vault | All secrets injected at runtime — never in code or .env files |
| Container Registry | Azure Container Registry | API and worker Docker images |
| Observability | Azure Monitor + Application Insights | APM tracing, structured logging, alerts |
| IaC | Terraform | Provider-agnostic — manages both Azure and Vercel resources |

---

## 9. Testing Strategy

### 9.1 Test Layers

| Layer | Tool | Scope | Location |
|---|---|---|---|
| Unit | Vitest | Pure functions, rule evaluation, Zod schemas | Co-located (`*.test.ts`) |
| Integration | Vitest + Supertest | API endpoints + real database (test schema) | `apps/api/test/integration/` |
| Worker | Vitest | BullMQ processors with mocked Redis | `apps/worker/test/` |
| E2E | Playwright | Full user workflows in browser | `apps/web/test/e2e/` |

### 9.2 Shared Test Utilities

All mocks, factories, fixtures, and helpers live in `packages/config/src/test-utils/`:

| Category | Examples |
|---|---|
| **Factories** | `createBrand()`, `createProgram()`, `createProgramWithRules()`, `createMember()`, `createConsentedMember()`, `createLoyaltyEvent()`, `createCxEvent()`, `createReward()`, `createCampaign()`, `createNpsCampaign()`, `createRedemption()` |
| **Mocks** | `mockClerkAuth()`, `mockClerkVerifyToken()`, `InMemoryQueue`, `createMockRedis()`, `mockEmailSend()` |
| **DB Utils** | `setupTestDb()`, `getTestPrisma()`, `teardownTestDb()`, `seedTestDb()` |
| **Helpers** | `authenticatedRequest()`, `unauthenticatedRequest()`, `toHavePointsBalance()`, `toHaveRedemption()`, `toHaveLoyaltyEventCount()` |

### 9.3 Test Coverage Requirements

| Priority | Unit | Integration | E2E |
|---|---|---|---|
| P0 (MVP) | Required | Required | Required |
| P1 | Required | Required | -- |
| P2 | Required | -- | -- |

---

## 10. Compliance Architecture

| Standard | Status | Implementation |
|---|---|---|
| GDPR | Required from MVP | Soft deletes, consent fields (`consentGivenAt`, `consentVersion`), erasure job, data export |
| CCPA/CPRA | Required from MVP | Same erasure + export infrastructure as GDPR |
| SOC2 Type 2 | Target Month 12 | Begin controls from day one: secrets in Key Vault, TLS everywhere, audit log, MFA via Clerk |
| PCI DSS | Minimal scope | Reward fulfillment via Tremendous/Rybbon keeps CustomerEQ out of card data flow |

---

## 11. Architecture Decision Records

ADRs document one-way-door decisions. Each ADR lives in `docs/architecture/adr/`.

| ADR | Decision | Date |
|---|---|---|
| ADR-001 | Monorepo with Turborepo over polyrepo | 2026-03-24 |
| ADR-002 | PostgreSQL over MongoDB for loyalty ledger | 2026-03-24 |
| ADR-003 | Clerk over Auth0 for MVP auth | 2026-03-24 |
| ADR-004 | BullMQ over Kafka for event queue | 2026-03-24 |
| ADR-005 | Vercel (frontend) + Azure (backend) hybrid deployment | 2026-03-24 |
| ADR-006 | Shared test-utils package as single mock source of truth | 2026-03-24 |

---

*This document is the authoritative architecture reference. Update it when a significant architectural decision changes.*
