# Implementation Work List — Issue #23: MVP Loyalty Platform

**Issue**: #23 — MVP Build: Full Loyalty Platform (Issues #2–#9)
**RFC**: docs/rfcs/23-mvp-loyalty-platform.md
**Spec**: docs/feature-specs/23-mvp-loyalty-platform.md
**Branch**: feature/23--mvp-build-full-loyalty-platform-issues-2-9-in-one-pass
**Issue Type**: Feature (greenfield — no existing code)

> **Phase Splitting Assessment**: This checklist contains ~65+ file creations across 9 feature areas. Per scope-slicing skill, this qualifies as a "Phase Splitting Candidate." User has explicitly requested full execution in one pass with parallelism. Proceeding with parallel agent wave strategy.

---

## Parallelism Strategy

Implementation is organized into **4 sequential waves**. Within each wave, independent groups can run in parallel via subagents.

```
Wave 0 (serial):    Monorepo Scaffold
Wave 1 (serial):    Shared packages (database schema, types, test infrastructure)
Wave 2 (parallel):  [API Backend] || [Worker] || [Frontend]
Wave 3 (parallel):  [Unit Tests] || [Integration Tests] || [E2E Tests]
```

---

## Wave 0 — Monorepo Scaffold (Phase 0, R0.1–R0.7)

**Must complete before all other waves.**

- [ ] `package.json` — root workspace: pnpm workspaces, Turborepo scripts (`build`, `typecheck`, `lint`, `test`, `dev`)
- [ ] `pnpm-workspace.yaml` — declare `apps/*` and `packages/*`
- [ ] `turbo.json` — pipeline: `build → typecheck → lint → test` with correct `dependsOn`
- [ ] `docker-compose.yml` — PostgreSQL 16 + Redis 7 with named volumes
- [ ] `.env.example` — all required vars: `DATABASE_URL`, `REDIS_URL`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `SALESFORCE_WEBHOOK_SECRET`, `HUBSPOT_WEBHOOK_SECRET`, `AZURE_APPLICATION_INSIGHTS_CONNECTION_STRING`
- [ ] `.gitignore` — update with Node, pnpm, Next.js, Prisma, .env patterns
- [ ] `.github/workflows/ci.yml` — Actions: Postgres 16 + Redis 7 services, pnpm install, build, typecheck, lint, audit, test

### Package Scaffolds (package.json + tsconfig per package)

- [ ] `packages/database/package.json` — name: `@customerEQ/database`, deps: prisma, @prisma/client
- [ ] `packages/shared/package.json` — name: `@customerEQ/shared`, deps: zod
- [ ] `packages/config/package.json` — name: `@customerEQ/config`, deps: vitest, supertest, ioredis-mock
- [ ] `packages/ui/package.json` — name: `@customerEQ/ui`, deps: react, tailwindcss, shadcn primitives
- [ ] `apps/api/package.json` — deps: fastify, @fastify/sensible, @clerk/fastify, prisma, bullmq, ioredis, pino
- [ ] `apps/worker/package.json` — deps: bullmq, ioredis, @customerEQ/database, @customerEQ/shared
- [ ] `apps/web/package.json` — deps: next@15, react, @clerk/nextjs, tailwindcss

---

## Wave 1 — Shared Packages (foundation for all features)

**Must complete before Wave 2.**

### packages/database (R0.3)

- [ ] `packages/database/prisma/schema.prisma` — all 11 models: Brand, Program, EarningRule, Member, LoyaltyEvent, Reward, Redemption, Campaign, CampaignEvent, DemoRequest, AuditEvent + all enums + all indexes
- [ ] `packages/database/src/client.ts` — singleton PrismaClient export
- [ ] `packages/database/src/middleware/tenantScope.ts` — `applyTenantScope()` using Prisma `$extends` (R3.5, C-05)
- [ ] `packages/database/src/index.ts` — re-export client + middleware + generated types

### packages/shared (R0.3)

- [ ] `packages/shared/src/queues.ts` — `QUEUES` const: `loyalty-events`, `campaign-triggers`, `notifications`
- [ ] `packages/shared/src/types/index.ts` — `InternalCxEvent`, `CampaignTriggerPayload`, `LoyaltyEventPayload`, `NotificationPayload`
- [ ] `packages/shared/src/zod/program.schema.ts` — CreateProgramSchema, UpdateProgramSchema
- [ ] `packages/shared/src/zod/member.schema.ts` — EnrollMemberSchema
- [ ] `packages/shared/src/zod/event.schema.ts` — IngestEventSchema (eventType, memberId, payload, idempotencyKey)
- [ ] `packages/shared/src/zod/campaign.schema.ts` — CreateCampaignSchema, TriggerConditionSchema, ActionConfigSchema
- [ ] `packages/shared/src/zod/redemption.schema.ts` — RedeemSchema
- [ ] `packages/shared/src/zod/demoRequest.schema.ts` — DemoRequestSchema
- [ ] `packages/shared/src/index.ts` — re-export all types + schemas

### packages/config/test-utils (R0.3)

- [ ] `packages/config/src/test-utils/db/setup.ts` — beforeAll: create test schema, run migrations
- [ ] `packages/config/src/test-utils/db/teardown.ts` — afterAll: drop test schema
- [ ] `packages/config/src/test-utils/db/seed.ts` — 1 brand, 1 program, 1 earning rule
- [ ] `packages/config/src/test-utils/factories/brand.factory.ts` — `createBrand()`
- [ ] `packages/config/src/test-utils/factories/program.factory.ts` — `createProgram()`, `createProgramWithRules()`
- [ ] `packages/config/src/test-utils/factories/member.factory.ts` — `createMember()`, `createConsentedMember()`
- [ ] `packages/config/src/test-utils/factories/event.factory.ts` — `createLoyaltyEvent()`, `createCxEvent(type, score)`
- [ ] `packages/config/src/test-utils/factories/reward.factory.ts` — `createReward()`
- [ ] `packages/config/src/test-utils/factories/campaign.factory.ts` — `createCampaign(trigger, action)`
- [ ] `packages/config/src/test-utils/factories/redemption.factory.ts` — `createRedemption()`
- [ ] `packages/config/src/test-utils/mocks/clerk.mock.ts` — `mockClerkAuth(brandId, userId)`
- [ ] `packages/config/src/test-utils/mocks/bullmq.mock.ts` — `InMemoryQueue` (synchronous processing for tests)
- [ ] `packages/config/src/test-utils/mocks/redis.mock.ts` — ioredis-mock instance
- [ ] `packages/config/src/test-utils/mocks/integrations.mock.ts` — `salesforceNpsPayload()`, `hubspotTicketPayload()`
- [ ] `packages/config/src/test-utils/mocks/email.mock.ts` — `mockEmailSend()`, `assertEmailSent()`
- [ ] `packages/config/src/test-utils/helpers/api.helper.ts` — `authenticatedRequest(brandId)` → Supertest client
- [ ] `packages/config/src/test-utils/helpers/assert.helper.ts` — `toHavePointsBalance(n)`, `toHaveRedemption()`
- [ ] `packages/config/src/test-utils/index.ts` — re-export all

---

## Wave 2A — API Backend (apps/api)

**Parallel with Wave 2B and Wave 2C after Wave 1 complete.**

### Core (prerequisite within Wave 2A)

- [ ] `apps/api/src/app.ts` — Fastify instance, register all plugins + routes
- [ ] `apps/api/src/plugins/auth.ts` — Clerk JWT verify → `request.brandId` (C-05)
- [ ] `apps/api/src/plugins/prisma.ts` — PrismaClient decorator on Fastify instance
- [ ] `apps/api/src/plugins/redis.ts` — ioredis decorator
- [ ] `apps/api/src/plugins/audit.ts` — `onResponse` hook: create AuditEvent for mutations (S-02)
- [ ] `apps/api/src/plugins/multiTenant.ts` — `preValidation` hook: reject `brandId` in body (C-05)
- [ ] `apps/api/src/queues/bullmq.ts` — Queue producer functions: `enqueueEvent()`, `enqueueCampaign()`, `enqueueNotification()`

### Routes — Issue #2: Configure Loyalty Program (R2.1–R2.5)

- [ ] `apps/api/src/routes/programs.ts` — POST `/v1/programs`, GET `/v1/programs/:id`, PATCH `/v1/programs/:id`; status machine DRAFT→ACTIVE→PAUSED→ARCHIVED; Zod validation

### Routes — Issue #3: Member Enrollment (R3.1–R3.5)

- [ ] `apps/api/src/routes/members.ts` — POST `/v1/members/enroll` (idempotent: unique brandId+email), GET `/v1/members/:id`, GET `/v1/members/:id/balance`; consent gate

### Routes — Issue #4: Earn Points (R4.1–R4.6)

- [ ] `apps/api/src/routes/events.ts` — POST `/v1/events`: idempotency key Redis SET NX → enqueue loyalty-events → evaluate active campaigns → enqueue campaign-triggers (priority=10)

### Routes — Issue #5: Redeem Reward (R5.1–R5.5)

- [ ] `apps/api/src/routes/rewards.ts` — POST `/v1/rewards` (admin), GET `/v1/rewards` (member)
- [ ] `apps/api/src/routes/redemptions.ts` — POST `/v1/redemptions`: atomic `prisma.$transaction` (check balance → deduct → create Redemption + LoyaltyEvent)

### Routes — Issue #6: CX-to-Loyalty Campaign (R6.1–R6.6)

- [ ] `apps/api/src/routes/campaigns.ts` — POST `/v1/campaigns`, GET `/v1/campaigns/:id`, PATCH `/v1/campaigns/:id/status`

### Routes — Issue #7: Analytics (R7.1–R7.5)

- [ ] `apps/api/src/routes/analytics.ts` — GET `/v1/analytics/overview` (raw SQL, ROI formula), GET `/v1/analytics/campaigns`

### Routes — Issue #8: Demo Request (R8.1–R8.4)

- [ ] `apps/api/src/routes/public.ts` — POST `/v1/public/demo-requests` (no auth), GET `/v1/admin/demo-requests` (admin JWT)

### Routes — Issue #9: CRM Webhooks (R9.1–R9.5)

- [ ] `apps/api/src/routes/webhooks.ts` — POST `/v1/integrations/webhooks/salesforce` + `/hubspot`: HMAC verify → normalize → lookup member → enqueue event
- [ ] `apps/api/src/routes/integrations.ts` — GET `/v1/admin/integrations`: return webhook URLs

---

## Wave 2B — Worker (apps/worker)

**Parallel with Wave 2A and Wave 2C after Wave 1 complete.**

- [ ] `apps/worker/src/queues/definitions.ts` — Queue + Worker instances (shared with apps/api via @customerEQ/shared)
- [ ] `apps/worker/src/queues/producers.ts` — `enqueueEvent()`, `enqueueCampaign()`, `enqueueNotification()` implementations
- [ ] `apps/worker/src/processors/loyaltyEvents.ts` — Rules engine: evaluate EarningRules, calculate points, increment balance, create LoyaltyEvent (R4.1–R4.6)
- [ ] `apps/worker/src/processors/campaignTriggers.ts` — Redis dedup SET NX → fetch campaign → check budget cap → execute action (`prisma.$transaction`) → record CampaignEvent.latencyMs → enqueue notification (R6.3–R6.6)
- [ ] `apps/worker/src/processors/notifications.ts` — Send email/SMS confirmation (R3.4, R5.5)
- [ ] `apps/worker/src/index.ts` — Register all processors, graceful shutdown

---

## Wave 2C — Frontend (apps/web)

**Parallel with Wave 2A and Wave 2B after Wave 1 complete.**

- [ ] `apps/web/middleware.ts` — `clerkMiddleware()` with `isAdminRoute` + `isPublicRoute` matchers (R2.1, R3.x)
- [ ] `apps/web/app/layout.tsx` — Root: ClerkProvider, Inter font, global styles
- [ ] `apps/web/app/(marketing)/page.tsx` — Homepage (marketing)
- [ ] `apps/web/app/(marketing)/request-demo/page.tsx` — Demo request form: firstName, lastName, workEmail, companyName, companySize, message → POST `/v1/public/demo-requests` (R8.1–R8.4)
- [ ] `apps/web/app/(admin)/layout.tsx` — Admin layout: Clerk org membership guard
- [ ] `apps/web/app/(admin)/programs/page.tsx` — Program list
- [ ] `apps/web/app/(admin)/programs/new/page.tsx` — 4-step program creation wizard (R2.1–R2.5)
- [ ] `apps/web/app/(admin)/campaigns/page.tsx` — Campaign list
- [ ] `apps/web/app/(admin)/campaigns/new/page.tsx` — Campaign builder: trigger type, condition, action config, budget (R6.1–R6.2)
- [ ] `apps/web/app/(admin)/analytics/page.tsx` — Analytics dashboard: date range picker, KPI tiles, campaign table (R7.1–R7.5)
- [ ] `apps/web/app/(admin)/integrations/page.tsx` — Webhook URL display for Salesforce + HubSpot (R9.5)
- [ ] `apps/web/app/(member)/layout.tsx` — Member layout: Clerk auth guard
- [ ] `apps/web/app/(member)/page.tsx` — Member dashboard: points balance + recent activity (R3.1–R3.3)
- [ ] `apps/web/app/(member)/rewards/page.tsx` — Rewards catalog + redemption button (R5.2–R5.3)

---

## Wave 3A — Unit Tests

**Parallel with Wave 3B and Wave 3C after Wave 2 complete.**

- [ ] `packages/shared/src/zod/*.test.ts` — All Zod schemas: valid + invalid inputs for each schema
- [ ] `apps/api/src/plugins/multiTenant.test.ts` — brandId body guard: rejects when present, passes when absent
- [ ] `apps/api/src/plugins/auth.test.ts` — JWT: valid / expired / wrong org using `mockClerkAuth`
- [ ] `apps/worker/src/processors/loyaltyEvents.test.ts` — Rules engine: point calculation, multipliers, conditions, maxUsesPerMember
- [ ] `apps/worker/src/processors/campaignTriggers.test.ts` — Dedup logic, budget cap enforcement, action execution, latencyMs recording
- [ ] `apps/api/src/routes/webhooks.test.ts` — HMAC verification: valid + invalid for Salesforce + HubSpot
- [ ] `apps/api/src/routes/analytics.test.ts` — ROI formula correctness, date range filtering

---

## Wave 3B — Integration Tests

**Parallel with Wave 3A and Wave 3C after Wave 2 complete.**

- [ ] `apps/api/test/integration/programs.test.ts` — R2.1–R2.5: CRUD, status machine, tenant isolation
- [ ] `apps/api/test/integration/members.test.ts` — R3.1–R3.5: enrollment idempotency, consent gate, balance endpoint
- [ ] `apps/api/test/integration/events.test.ts` — R4.1–R4.6: idempotency key, rules engine, BullMQ drain, points credited
- [ ] `apps/api/test/integration/rewards-redemptions.test.ts` — R5.1–R5.5: atomicity, insufficient balance (422), stock tracking
- [ ] `apps/api/test/integration/campaigns.test.ts` — R6.1–R6.6: trigger evaluation, dedup, budget cap, SLA (latencyMs < 900,000)
- [ ] `apps/api/test/integration/analytics.test.ts` — R7.1–R7.5: metric correctness, ROI, date range, <3s perf on seed data
- [ ] `apps/api/test/integration/webhooks.test.ts` — R9.1–R9.4: Salesforce normalization, HubSpot normalization, HMAC rejection (401)
- [ ] `apps/api/test/integration/demoRequests.test.ts` — R8.1–R8.4: form submission, DB record, email mock called

---

## Wave 3C — E2E Tests

**Parallel with Wave 3A and Wave 3B after Wave 2 complete.**

- [ ] `apps/web/test/e2e/critical-path.spec.ts` — Full flow: enroll → earn → CX campaign trigger → redeem → analytics shows updated data
- [ ] `apps/web/test/e2e/demo-request.spec.ts` — Public form submission → confirmation message displayed

---

## Validation Requirements

| Requirement | Mode | Target |
|-------------|------|--------|
| `uiValidationRequired` | Yes — browser | 4 admin + 3 member + 1 marketing pages |
| `mobileValidationRequired` | No — desktop-first MVP | — |
| Responsive breakpoints | lg (1280px), md (768px) | Admin and member pages |
| Browser baseline | Chrome (Playwright) | All E2E + UI validation |
| SLA test | Integration: `latencyMs < 900_000` | `campaigns.test.ts` |
| Perf test | Analytics query < 3s | `analytics.test.ts` with seed data |
| Build check | `pnpm typecheck` must pass | Pre-submit gate |
| UI polish evidence | `docs/evidence/23-ui-polish-validation.md` | After Wave 2C |

---

## Open Questions / Known Deferrals

| Item | Decision |
|------|----------|
| Email provider (SendGrid / Resend / SES) | Use mock in tests; `process.env.EMAIL_PROVIDER` config; stub implementation for notifications processor |
| Clerk org setup for local dev | Use `mockClerkAuth` in integration tests; document Clerk setup in README |
| Azure infrastructure (Terraform in `infra/`) | Out of scope for MVP build — stub `infra/README.md` only |
| Salesforce real payload samples | Use RFC-documented shape; mark normalization layer for real-world adjustment at integration time |

---

## Compliance Checklist

- [ ] C-01: Consent gate enforced in `POST /v1/members/enroll` (consentGivenAt set from request)
- [ ] C-02: Soft delete on Member (deletedAt set, erased=false initially)
- [ ] C-03: Erasure endpoint hashes PII fields (email, firstName, lastName, phone), sets erased=true
- [ ] C-04: Data export endpoint returns member + events JSON
- [ ] C-05: brandId from JWT only — `multiTenant.ts` plugin rejects brandId in body
- [ ] S-01: All secrets via `process.env`, no hardcoding, `.env.example` provided
- [ ] S-02: AuditEvent created on all mutations via `audit.ts` plugin
- [ ] S-03: MFA enforced via Clerk org settings (documented in README, not coded)
- [ ] S-04: `pnpm audit --audit-level=high` in CI pipeline
