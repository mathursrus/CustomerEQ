# CustomerEQ — Architecture Document

**Date**: 2026-03-24
**Status**: Approved greenfield design
**Audience**: Engineers, AI agents, technical reviewers

---

## 1. System Overview

CustomerEQ is a B2B SaaS unified CX-Loyalty platform targeting mid-market companies ($10M–$500M revenue). Its core value proposition is the **real-time CX-to-loyalty feedback loop**: ingesting customer experience signals (NPS scores, support tickets, reviews) and automatically triggering loyalty actions within 15 minutes — versus the industry average of 82 hours.

The platform is a multi-tenant loyalty engine with:
- A loyalty program engine (points earn/burn, tiers, rewards)
- A campaign automation engine (rule-based CX event → loyalty action)
- A CRM integration layer (Salesforce, HubSpot as event sources)
- An analytics dashboard (ROI measurement, RFM segmentation)
- A member-facing portal (enrollment, points balance, reward redemption)

---

## 2. Repository Structure

CustomerEQ is a **Turborepo monorepo** managed with pnpm workspaces.

```
customerEQ/
├── apps/
│   ├── web/              # Next.js 15 — marketing site + customer app portal
│   ├── api/              # Fastify v5 — REST API (loyalty engine)
│   └── worker/           # BullMQ workers — async event processing
├── packages/
│   ├── ui/               # shadcn/ui + Tailwind v4 — shared component library
│   ├── database/         # Prisma schema, migrations, seed data, shared client
│   ├── shared/           # Shared TypeScript types + Zod validation schemas
│   └── config/           # Shared ESLint, TypeScript, Vitest base configs
├── infra/                # AWS CDK — ECS, RDS, ElastiCache, S3, CloudFront
└── docs/
    ├── architecture/     # This file + ADRs
    └── replicate/        # Annex Cloud analysis, use cases, data models, roadmap
```

**Why a monorepo?**
A single repo keeps the TypeScript types for API contracts and database models in sync across all apps without versioned package publishing overhead. The `packages/shared` package is the single source of truth for `Member`, `LoyaltyEvent`, `Program`, and other core domain types — the API serializes them, the frontend deserializes them, and the worker processes them, all from the same definition.

---

## 3. Technology Stack

### 3.1 Frontend — Next.js 15 (App Router)

**Choice**: Next.js 15 with TypeScript, App Router, React Server Components.
**Alternatives considered**: Vite SPA, Remix.

**Rationale**: The application has two distinct rendering needs:
1. The marketing site requires SSR and static generation for SEO.
2. The customer dashboard requires fast, interactive client-side rendering.

Next.js App Router handles both in a single framework — static pages for marketing, RSC for data-heavy dashboard views, client components for interactive forms and real-time updates. Running two separate frontends (one for marketing, one for app) would double infrastructure and split the shared `packages/ui` component library across deployment boundaries.

### 3.2 UI — Tailwind v4 + shadcn/ui

**Choice**: Tailwind CSS v4 (utility-first CSS) + shadcn/ui (Radix UI primitives).
**Alternatives considered**: MUI, Chakra UI, Ant Design.

**Rationale**: shadcn/ui components are copied into the repo (not installed as a black-box dependency), giving full control over styling and behavior. Radix primitives handle accessibility (ARIA, keyboard navigation, focus management) without imposing visual design. This avoids the common trap of fighting a component library's theme system six months into the project. All components live in `packages/ui` and are shared across `apps/web`.

### 3.3 Backend — Fastify v5 + TypeScript

**Choice**: Node.js 22 LTS with Fastify v5.
**Alternatives considered**: Express, NestJS, Hono.

**Rationale**: Fastify is schema-first — route handlers declare their request/response schemas using JSON Schema, and Fastify validates and serializes automatically. This means the API contract is defined at the route level, not inferred from code. Fastify is also approximately 2x faster than Express on throughput benchmarks, and its plugin architecture (lifecycle hooks, decorators) is a cleaner model than Express middleware for concerns like authentication, multi-tenant scoping, and rate limiting. NestJS was rejected for adding significant complexity (decorators, modules, DI container) that is not justified for an API of this scale.

### 3.4 Database — PostgreSQL 16 + Redis 7

**Choice**: PostgreSQL as the primary data store; Redis for queues, cache, and leaderboards.
**Alternatives considered**: MongoDB, PlanetScale (MySQL), DynamoDB.

**Why PostgreSQL over MongoDB (the key decision):**

A loyalty platform is a **financial ledger**. When a member earns 500 points, two things must happen atomically: the `LoyaltyEvent` is written and the member's `pointsBalance` is updated. If the process crashes between those two writes, the database is in a corrupt state — a member has points they didn't earn, or earned points that aren't reflected in their balance.

PostgreSQL guarantees this with **ACID transactions and row-level locking**. MongoDB added multi-document transactions in v4.0, but they are slower, have more constraints, and are not the primary design target of MongoDB's engine. Building a loyalty ledger on MongoDB requires fighting the database's natural document model to achieve relational consistency. Postgres is the right tool.

**Schema is a feature, not a constraint**: MongoDB's schema-less flexibility is valuable when data shapes are unknown or highly variable. CustomerEQ's domain is fully understood upfront — 13 entities are defined in `docs/replicate/analysis/data-models.md`. Schema-enforced integrity (NOT NULL, foreign keys, CHECK constraints) prevents entire classes of bugs at the database level without application code.

**Flexibility where needed via JSONB**: Rule conditions, campaign trigger definitions, and loyalty event metadata are inherently variable in structure. PostgreSQL's `JSONB` column type handles this natively with GIN indexing and containment queries — providing document flexibility exactly where the domain needs it, without sacrificing relational integrity everywhere else.

**Prisma for multi-tenant isolation**: Prisma middleware enforces `brandId` scoping on every query at the ORM layer, making cross-tenant data leakage structurally impossible. This is a critical security property for a multi-tenant SaaS.

**Redis responsibilities**:
- BullMQ job queues (loyalty event processing)
- Rate limiting (per-tenant API throttling)
- Session storage
- Sorted sets for real-time leaderboards
- Short-lived campaign deduplication keys (prevent duplicate triggers)

### 3.5 Event Queue — BullMQ v5

**Choice**: BullMQ v5 on Redis.
**Alternatives considered**: Kafka, SQS, Inngest.

**Rationale**: Every loyalty action flows through the event queue:

```
External System → POST /events → BullMQ → Rules Engine Worker → Actions
```

BullMQ provides exactly-once delivery semantics via Redis deduplication keys — critical for loyalty (a member should never receive double points from the same purchase event). It supports job priorities, delayed jobs, repeating jobs, and dead-letter queues. Kafka was rejected as operationally complex for an MVP; SQS was rejected because it lacks the deduplication key pattern needed for idempotent loyalty events. Inngest is a good future option for observable workflows but requires managed infrastructure.

### 3.6 Auth — Clerk

**Choice**: Clerk.
**Alternatives considered**: Auth0, NextAuth, custom JWT.

**Rationale**: Clerk is built for Next.js (first-party middleware, RSC-compatible hooks) and supports multi-tenant organizations natively — each CustomerEQ customer (brand) is a Clerk organization, with members scoped to their org. This maps directly to the `brandId` multi-tenant model. Auth0 has a more mature enterprise SSO story but requires significantly more configuration and custom UI work to achieve the same result. Auth0 remains the migration path if a customer requires a specific enterprise SSO integration not supported by Clerk.

### 3.7 AI/ML — OpenAI API + Vercel AI SDK

**Choice**: OpenAI API (GPT-4o) via Vercel AI SDK.
**Alternatives considered**: Anthropic Claude API, Hugging Face self-hosted models.

**Rationale**: Phase 1 AI use cases (sentiment analysis on CX events, campaign suggestion, ROI summarization) are well within GPT-4o's capability and do not require fine-tuned models. The Vercel AI SDK provides a unified interface for streaming responses and tool calling, and abstracts the provider — switching from OpenAI to another provider is a one-line change if needed.

### 3.8 Infrastructure — Azure + Vercel

**Choice**: Azure for API, worker, database, and cache infrastructure; Vercel for Next.js frontend.

**Why Azure?** The project has Azure credits available, and Azure's managed services are a direct 1:1 equivalent to AWS for every component in this stack. There is no meaningful technical quality difference between Azure Container Apps and ECS Fargate, or between Azure Database for PostgreSQL and RDS. Using Azure credits avoids real infrastructure cost during the MVP and early growth phases.

| Component | Service | Rationale |
|-----------|---------|-----------|
| API | Azure Container Apps | Serverless containers with built-in ingress, scale-to-zero, and no task-definition overhead. Better developer experience than ECS Fargate for this use case. |
| Worker | Azure Container Apps | Same container image as API, separate app definition, scales independently. |
| Database | Azure Database for PostgreSQL Flexible Server | Managed PostgreSQL 16, high availability, automated backups, encryption at rest. |
| Cache/Queue | Azure Cache for Redis | Managed Redis 7, supports BullMQ natively, zone-redundant in production. |
| Frontend | Vercel | Zero-ops Next.js deploys with first-party App Router support, edge CDN, instant preview URLs per PR. |
| Object Storage | Azure Blob Storage | Receipt images, export files. Direct S3 equivalent. |
| CDN | Azure Front Door | Global CDN + WAF + load balancing for API and static assets. |
| Secrets | Azure Key Vault | All secrets injected at runtime — never in code or environment files. |
| Container Registry | Azure Container Registry | Stores API and worker Docker images. |
| Observability | Azure Monitor + Application Insights | APM tracing, structured logging, alerts. App Insights provides richer APM than CloudWatch for Node.js services. |

**Why Vercel for frontend and Azure for backend?** Vercel built Next.js. App Router dynamic routes, React Server Components, server actions, and edge middleware all work without limitation on Vercel — Azure Static Web Apps has known constraints with these features. The frontend and backend are fully decoupled by API contract, so there is no operational downside to running them on different providers.

**Infrastructure as Code**: Terraform (not Azure Bicep). Terraform is provider-agnostic — a single codebase manages both Azure resources and the Vercel project configuration (via the Vercel Terraform provider). This avoids learning a second IaC tool if any component moves providers later.

---

## 4. Data Architecture

### 4.1 Multi-Tenancy

All tenant-scoped entities carry a `brandId` column. Tenant isolation is enforced at three layers:

1. **Database**: All queries filtered by `brandId` (Prisma middleware)
2. **API**: Fastify auth plugin sets `request.brandId` from the verified JWT; routes never accept `brandId` from the request body
3. **Row-Level Security**: PostgreSQL RLS policies as a safety net (defense in depth)

### 4.2 Loyalty Event Ledger

Points balance is derived from the append-only `LoyaltyEvent` ledger, not stored as a mutable counter. The member's current balance is a materialized view updated transactionally on each event write. This pattern:
- Makes the full audit trail always available
- Allows retroactive rule changes to be replayed
- Prevents balance drift from partial writes

### 4.3 GDPR / CCPA Compliance (Built-in from MVP)

The data model includes compliance fields from day one:

- **Soft deletes with erasure**: `Member` records are soft-deleted on deactivation; a `DataSubjectErasureRequest` triggers a separate erasure job that overwrites PII fields (`email`, `name`, `phone`) with a hash and marks the record as erased
- **Consent tracking**: `Member.consentGivenAt` + `Member.consentVersion` tracks when consent was given and to which privacy policy version
- **Data portability**: All member data exportable via `GET /members/:id/export` (JSON)
- **Data residency**: `Program.dataResidency` tag maps to the AWS region where that program's data is stored

---

## 5. API Design

- **REST**, versioned at `/v1/`
- OpenAPI 3.1 spec auto-generated from Fastify JSON Schema route definitions
- All endpoints require `Authorization: Bearer <jwt>` except `/v1/public/*` and `/v1/auth/*`
- Rate limiting: 1000 req/min per tenant (configurable), 100 req/min per member token
- Pagination: cursor-based (not offset) for event lists; offset for bounded result sets

### Event Ingestion Endpoint (Hero Feature)

```
POST /v1/events
{
  "type": "cx.nps_submitted",
  "memberId": "mbr_xxx",
  "payload": { "score": 4, "comment": "Shipping was slow" },
  "idempotencyKey": "salesforce-case-00Q123"
}
```

The `idempotencyKey` is stored in Redis with a 24-hour TTL. Duplicate submissions return `200` with the original result — no duplicate points awarded.

---

## 6. Testing Strategy

### 6.1 Test Layers

| Layer | Tool | Scope | Location |
|-------|------|-------|----------|
| Unit | Vitest | Pure functions, rule evaluation, Zod schemas | Co-located with source (`*.test.ts`) |
| Integration | Vitest + Supertest | API endpoints + real database (test schema) | `apps/api/test/integration/` |
| E2E | Playwright | Full user workflows in browser | `apps/web/test/e2e/` |
| Worker | Vitest | BullMQ job processors with mocked Redis | `apps/worker/test/` |

### 6.2 Shared Test Utilities — the single source of truth for mocks

**All mocks, factories, fixtures, and test helpers live in one place:**

```
packages/config/src/test-utils/
├── index.ts               # Re-exports everything — import from here only
├── factories/
│   ├── member.factory.ts  # createMember(), createMemberWithTier()
│   ├── program.factory.ts # createProgram(), createProgramWithRules()
│   ├── event.factory.ts   # createLoyaltyEvent(), createCxEvent()
│   ├── reward.factory.ts  # createReward(), createRewardCatalog()
│   └── campaign.factory.ts# createCampaign(), createCampaignWithTrigger()
├── mocks/
│   ├── clerk.mock.ts      # Mock Clerk auth (setAuthUser, clearAuth)
│   ├── openai.mock.ts     # Mock OpenAI responses
│   ├── bullmq.mock.ts     # In-memory BullMQ queue for worker tests
│   ├── redis.mock.ts      # ioredis-mock for unit tests
│   └── integrations.mock.ts # Mock Salesforce + HubSpot webhook payloads
├── db/
│   ├── setup.ts           # beforeAll: create test schema, run migrations
│   ├── teardown.ts        # afterAll: drop test schema
│   └── seed.ts            # Seed minimal test data (1 brand, 1 program)
└── helpers/
    ├── api.helper.ts      # Authenticated Supertest client factory
    └── assert.helper.ts   # Custom Vitest matchers (toHaveEarnedPoints, etc.)
```

**The rule**: if a test file needs a mock or factory, it imports from `@customerEQ/config/test-utils`. It never defines its own mock inline. This prevents mock drift — where two test files mock the same thing differently and test different behaviors.

### 6.3 Test Coverage Requirements by Priority

| Priority | Unit | Integration | E2E |
|----------|------|-------------|-----|
| P0 (MVP) | Required | Required | Required |
| P1 | Required | Required | — |
| P2 | Required | — | — |

---

## 7. Compliance Architecture

### Active Requirements

| Standard | Status | Implementation |
|----------|--------|---------------|
| GDPR | Required from MVP | Soft deletes, consent fields, erasure job, data export endpoint |
| CCPA/CPRA | Required from MVP | Same erasure + export infrastructure as GDPR |
| SOC2 Type 2 | Target Month 12 | Requires 6 months of operational evidence; begin controls from day one |
| PCI DSS | Minimal scope | Use Tremendous/Rybbon for reward fulfillment to keep CustomerEQ out of card data flow |

### SOC2 Controls to Build From Day One

Even before the formal audit, these controls reduce remediation work later:
- All secrets in AWS Secrets Manager (never in environment variables or code)
- All database connections encrypted in transit (TLS) and at rest
- Audit log table (`AuditEvent`) for all admin actions
- MFA enforced for all admin accounts (via Clerk)
- Automated dependency vulnerability scanning in CI (e.g., `pnpm audit`)

---

## 8. Local Development

```bash
# Prerequisites: Docker, Node.js 22, pnpm 9
pnpm install
docker compose up -d          # PostgreSQL + Redis (local containers)
pnpm db:migrate               # Run Prisma migrations
pnpm db:seed                  # Seed dev data
pnpm dev                      # Start all apps in parallel (Turborepo)
```

**Validation commands (CI)**:

```bash
pnpm build       # turbo build — all apps + packages
pnpm typecheck   # turbo typecheck — tsc --noEmit strict
pnpm lint        # turbo lint — ESLint
pnpm test        # turbo test — Vitest unit + integration
pnpm test:e2e    # Playwright E2E (requires running app)
```

Smoke test (pre-deploy gate): `pnpm build && pnpm typecheck && pnpm test`

---

## 9. Architecture Decision Records

ADRs document one-way-door decisions. Each ADR lives in `docs/architecture/adr/`.

| ADR | Decision | Date |
|-----|----------|------|
| ADR-001 | Monorepo with Turborepo over polyrepo | 2026-03-24 |
| ADR-002 | PostgreSQL over MongoDB for loyalty ledger | 2026-03-24 |
| ADR-003 | Clerk over Auth0 for MVP auth | 2026-03-24 |
| ADR-004 | BullMQ over Kafka for event queue | 2026-03-24 |
| ADR-005 | Vercel (frontend) + Azure (backend) hybrid deployment | 2026-03-24 |
| ADR-006 | Shared test-utils package as single mock source of truth | 2026-03-24 |

---

*This document is the authoritative architecture reference. Update it when a significant architectural decision changes.*
