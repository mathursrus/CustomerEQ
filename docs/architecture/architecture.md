# Architecture Documentation: CustomerEQ

**Date**: 2026-04-21
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
| **Runtime** | Node.js >= 22 | LTS with native ESM support; shared runtime across API, worker, and frontend SSR. Track upstream Node LTS — bump within ~6 months of EOL. |
| **Frontend** | Next.js 15 (App Router) + React 18 | SSR/SSG for marketing, RSC for data-heavy dashboards, client components for interactive forms |
| **UI** | Tailwind CSS v4 + shadcn/ui (Radix primitives) | Utility-first CSS with accessible, copy-into-repo components — no black-box theme system to fight |
| **Backend** | Fastify v5 | Schema-first routes with auto-validation, ~2x Express throughput, clean plugin architecture |
| **ORM** | Prisma 5.13 | Type-safe queries, migration management, middleware for multi-tenant `brandId` scoping |
| **Database** | PostgreSQL 16 | ACID transactions for loyalty ledger integrity; JSONB for flexible rule conditions/event payloads |
| **Cache/Queue (optional)** | Redis 7 + BullMQ v5 | **Performance optimization, not a correctness dependency.** Every queued workflow has two interchangeable execution paths controlled by `QUEUE_MODE`: `redis` (BullMQ + Upstash, used in prod for throughput, retry/backoff, and cross-instance dedup) and `inline` (in-process execution against Postgres, used for single-instance deploys, dev, test, and CI). Both paths must produce the **same functional outcome** — same DB writes, same side effects, same idempotency guarantees, same observable behavior. Redis only changes *when* and *how fast* work happens, never *whether* it happens or *what* it does. The system must continue to work end-to-end with Redis absent (`QUEUE_MODE=inline`). When adding a new queued workflow, both branches in `apps/api/src/queues/bullmq.ts` must be implemented and kept at parity. |
| **Auth** | Clerk | Native Next.js support, multi-tenant organizations (Clerk org = brand), JWT verification |
| **Testing** | Vitest + Supertest + Playwright | Unit/integration (Vitest), HTTP testing (Supertest), E2E browser (Playwright) |
| **Build** | Turborepo + pnpm 9 | Monorepo task orchestration with caching; pnpm for strict dependency isolation |
| **Logging** | Pino v9 | Structured JSON logging, low-overhead, Fastify's native logger |
| **Validation** | Zod 3.23 | Runtime schema validation shared between API request parsing and frontend forms |
| **Forms** | React Hook Form 7.x + `@hookform/resolvers/zod` | Standard for admin-portal forms — single source of truth for validation between API and frontend (Zod schemas reused). Per-section dirty state via RHF `formState.dirtyFields`. Reference implementation: `apps/web/src/app/(admin)/admin/settings/organization/components/OrganizationSettingsForm.tsx` (Issue #292 Slice 4). Legacy `useState`-based admin forms (`ThemeForm`, `AlertRuleForm`, `CampaignForm`, survey-builder) migrate opportunistically when each next sees substantive change; #241 (Survey Admin UX) is the natural rework window for survey-side forms. (Issue #277) |
| **Infra** | Azure (API/worker/DB/cache) + Vercel (frontend) | Azure credits for backend; Vercel for zero-ops Next.js with first-party App Router support |
| **IaC** | Terraform | Provider-agnostic — manages both Azure resources and Vercel project config |

---

## 3. Architectural Layers

**Domain-narrow runtime packages.** Alongside the layer organization below, a recurring pattern is to extract a single-purpose runtime module — typically a parser / validator / renderer triplet — into its own package consumed by both web and api. `packages/embed` (CDN-distributed Web Components) and `packages/consent-text` (Issue #277 — token parser, Zod validator, HTML+React renderer for consent disclosures) are examples. These packages are kept out of `packages/shared` to avoid bundle bloat in the worker (which has no DOM-adjacent code) and to keep blast-radius small when their internal shape evolves. Add a new domain-narrow package when the candidate code is (a) consumed by ≥2 apps, (b) has no value in the worker bundle, and (c) has clear internal-shape stability.

### 3.1. Presentation Layer (apps/web)
- **Responsibility**: Marketing site (SSR/SSG), admin portal (program/campaign/analytics management), member portal (dashboard, rewards catalog, redemptions).
- **Key Modules**: `apps/web/src/app/(marketing)/` (public pages), `apps/web/src/app/(admin)/` (admin portal), `apps/web/src/app/(member)/` (member portal)
- **Auth**: Clerk middleware guards all non-public routes; `ClerkProvider` wraps the app layout. Public routes: `/`, `/sign-in`, `/request-demo`, `/api/public/*`, `/survey/*`, `/{programSlug}/enroll` (Issue #3 — enrollment requires no prior auth)
- **API Communication**: Server components fetch with Clerk token; client components use `useAuth()` hook
- **Admin home entry point**: `/admin/page.tsx` (RSC) is the operator home dashboard — fetches `GET /v1/analytics/program-health` server-side and renders the unified CX+Loyalty panels. `/admin/analytics` remains as a deeper drill-down analytics view. (Issue #78)
- **Context-aware navigation**: CX metric click-throughs use `searchParams` to pre-populate campaign/survey builder forms without a separate API round-trip (e.g., `filter=detractors&maxNps=6` pre-fills the campaign builder audience segment). (Issue #78)
- **Client-side utilities**: Pure, web-only functions (e.g. recommendation lookups, formatting helpers) are co-located in `apps/web/src/utils/` — not exported to `packages/shared`. Use this location for functions that have no server-side or cross-package use case. (Issue #79)
- **Standard CRUD admin pattern**: All admin route-based CRUD entities follow the four-route layout `/admin/{entity}` (list), `/admin/{entity}/new` (create), `/admin/{entity}/[id]` (view-only), `/admin/{entity}/[id]/edit` (edit). The view route wraps the form in `<ViewOnlyBanner entityLabel="…" />` (`apps/web/src/components/ui/view-only-banner.tsx`). Each entity has a single `{Entity}Form` component accepting `mode: 'create' | 'edit' | 'view'` that derives `isViewOnly = mode === 'view'` and disables interactive controls; submit actions are hidden when `isViewOnly`. The list page exposes a clickable name `Link` to the view route plus a separate row-action "Edit" link to the edit route. Reference implementation: `apps/web/src/app/(admin)/admin/programs/`. See ADR `docs/architecture/adr/0001-admin-crud-route-pattern.md`. (Issue #157)
- **Post-create landing for new Clerk organizations**: `<OrganizationSwitcher afterCreateOrganizationUrl="…" />` in the admin shell layout (`apps/web/src/app/(admin)/layout.tsx`) sets where Clerk navigates the admin after the create-organization dialog completes. The redirect target's first GET is the lazy-upsert site (see §3.2 lazy-upsert pattern). The companion props `organizationProfileMode="navigation"` + `organizationProfileUrl` opt out of Clerk's hosted org-profile modal so the "Manage" link navigates to our settings page instead. **Note on Clerk 5.7.x:** `organizationProfileMode` accepts `"navigation"` or `"modal"` only; an earlier RFC draft used `"redirect"` which does not exist on this Clerk version. (Issue #277, implemented in #292 Slice 4)
- **State-aware save trigger on the edit route**: The `[id]/edit` route in the Standard CRUD pattern branches its save behavior on the entity's state machine. For entities with a non-trivial state machine (Survey: DRAFT→ACTIVE→PAUSED→STOPPED), the edit form auto-saves debounced per-field on blur while the entity is in its mutable initial state (DRAFT), surfaces an explicit per-tab Save button while the entity is live (ACTIVE/PAUSED), and renders read-only with all inputs disabled in a terminal state (STOPPED). This complements the server-side state-aware editability allowlist in §6 — the server is the authority that rejects forbidden writes, the client's save mode minimizes how often operators hit those rejections. See `apps/web/src/app/(admin)/admin/surveys/[id]/edit/` for the reference implementation (Survey editor, Issue #241 Slice 4b).

### 3.2. API Layer (apps/api)
- **Responsibility**: RESTful API (versioned at `/v1/`), request validation (Zod), authentication (Clerk JWT), multi-tenant scoping, event ingestion, campaign trigger evaluation, audit logging.
- **Key Modules**: `apps/api/src/routes/` (domain routes), `apps/api/src/plugins/` (auth, multiTenant, audit, prisma, redis), `apps/api/src/queues/` (BullMQ queue factories)
- **Entry Point**: `apps/api/src/server.ts` -> `app.ts` (Fastify factory)
- **Plugin Registration Order**: CORS -> Sensible -> Prisma -> Redis -> Auth -> MultiTenant -> Audit
- **Lazy-upsert provisioning pattern**: GET endpoints that are the canonical landing target for newly-created tenants may upsert their tenant resource row keyed by JWT-extracted identifier (e.g. `clerkOrgId`). This is the redirect-target counterpart to the webhook-driven provisioning at `/api/webhooks/identity-provider` and survives webhook delivery failures. The handler must be idempotent (re-runnable on every GET) and write only the bootstrap row, never user-supplied state. First seen in `GET /v1/admin/brand/profile` (Issue #277).

### 3.3. Event Processing Layer (apps/worker)
- **Responsibility**: Asynchronous processing of loyalty events, campaign trigger execution, notification delivery, feedback clustering, sentiment analysis, alert evaluation, health score computation, external signal sync/ingestion, and outbound webhook delivery.
- **Key Modules**: `apps/worker/src/processors/` (loyaltyEvents, campaignTriggers, notifications, sentimentAnalysis, feedbackClustering, embeddingGeneration, healthScore, externalSignalSync, externalSignalIngestion, webhookDelivery, slaBreachCheck), `apps/worker/src/queues/` (Redis connection, producers)
- **Entry Point**: `apps/worker/src/index.ts` (bootstraps 11 BullMQ workers, including 1 repeating job)
- **Concurrency**: loyalty-events (5), campaign-triggers (10), notifications (5), sentiment-analysis (5), feedback-clustering (1), embedding-generation (5), health-score-computation (3), external-signal-sync (2), external-signal-ingestion (3), webhook-delivery (10), sla-breach-check (1)
- **Repeating jobs**: `sla-breach-check` runs every 5 minutes (BullMQ `repeat: { every: 5 * 60 * 1000 }`, jobId `sla-breach-check-repeating` for idempotent scheduling). This is the first use of BullMQ's repeating job capability in the worker.
- **Queue mode**: The worker process exists to drain BullMQ queues and is only deployed when `QUEUE_MODE=redis`. In `QUEUE_MODE=inline`, the same processor logic is invoked in-process from the API via `apps/api/src/queues/bullmq.ts` — the worker is not needed and is not run. Both modes execute the **same** processor functions and produce the **same** outcomes; Redis only changes scheduling and concurrency.

### 3.4. Data Layer (packages/database)
- **Responsibility**: Schema definition (Prisma), migrations, database client singleton.
- **Key Modules**: `packages/database/prisma/schema.prisma` (core loyalty, CX, survey, AI, and external signal models), `packages/database/src/` (client exports)
- **Hand-edited Prisma migrations (`prisma migrate dev --create-only` + manual SQL edit)**: Use this flow whenever the migration needs (a) a model or table rename, (b) backfill of values between an `ADD COLUMN` and a `DROP COLUMN`, or (c) recovery from a partial migration that shipped. Prisma's auto-generation defaults to DROP-and-CREATE on renames in non-interactive contexts and never emits `UPDATE` statements for backfills — both wrong shapes for these cases. The canonical hand-edit ordering is `ADD COLUMN → BACKFILL UPDATE → DROP COLUMN`; renames precede backfills so the `UPDATE ... FROM` reads from the renamed table. The reference examples in-tree are `20260430000000_patch_survey_distribution_gap/migration.sql` (recovery from a partial run via idempotent `DO $$ ... END $$` PL/pgSQL guards) and `<timestamp>_brandtheme_surveytheme_split/migration.sql` (issue #291 — single forward migration with rename + backfill + drop in one ordered diff). Forward-only is the project default; rollback is via a follow-up forward migration, not a `down` script.

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

### 3.8. AI Layer (packages/ai)
- **Responsibility**: BAML-driven LLM client wrappers and analysis helpers used by the API (synchronous note-creation sentiment per §6) and worker (asynchronous sentiment analysis, intent classification, clustering, anomaly detection).
- **Key Modules**: `packages/ai/baml_src/*.baml` (BAML function definitions and generator config), `packages/ai/src/analysis/*.ts` (sentiment/intent/cluster wrappers around the generated client), `packages/ai/src/generated/baml_client/` (gitignored — see Build below).
- **Build pipeline**: `pnpm build` runs `pnpm run generate && tsc`. The `generate` step invokes `npx @boundaryml/baml@<pinned-version> generate` which writes 13 files into `src/generated/baml_client/`. **The generated directory is gitignored** — every Docker build and every fresh checkout regenerates it. `tsc` then compiles the regenerated source into `dist/`.
- **ESM imports contract (#273)**: `packages/ai/baml_src/generators.baml` must set `module_format "esm"` so BAML emits relative imports with `.js` extensions. Node 22's ESM strict resolver rejects extensionless relative imports at module-load time. This is a build-pipeline contract — without it, the BAML output crashes at container startup with `ERR_MODULE_NOT_FOUND` on `/app/packages/ai/dist/generated/baml_client/async_client`.
- **BAML version pinning**: The BAML CLI version is pinned in two places that must move together: `packages/ai/package.json` (`@boundaryml/baml: <version>`) and `packages/ai/baml_src/generators.baml` (`version "<version>"`). Bumping one without the other produces codegen warnings and risks contract drift.
- **CI gate**: The `docker-build` job in `.github/workflows/ci.yml` runs a built-image module-resolution probe against `ceq-api:<sha>` and `ceq-worker:<sha>` to catch regressions in this contract at PR time. See §7.4 Validation Commands.

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
| `/v1/analytics` | Overview KPIs (ROI, redemption rate) + per-campaign performance. `GET /v1/analytics/program-health` — unified CX+loyalty health snapshot (fixed 30d/7d windows); all sub-queries run in `Promise.all`; insights computed in-process by `computeInsights()` (deterministic rule engine — 3 rules; LLM generation deferred). (Issue #78). `GET /v1/analytics/reach-estimate` — projected member reach for a given trigger key over 30 days; follows graceful-degradation contract: DB/timeout failures return `{ estimatedCount: null, reason: '...' }` (200) rather than 5xx to prevent UI blocking. (Issue #79). `GET /v1/analytics/cx/external-signals` adds the normalized external-signal feed used by the CX workspace (Issue #113). **Convention**: all analytics sub-query endpoints follow this graceful-degradation contract — non-critical reads must never return 5xx. |
| `/v1/integrations/webhooks/*` | Salesforce + HubSpot webhook receivers (HMAC-SHA256 verified) plus source-scoped external signal webhook ingestion at `/v1/integrations/webhooks/external-signals/:sourceId` (Issue #113) |
| `/v1/integrations/oauth/*` | OAuth authorize + callback routes for Google Business Profile and LinkedIn; HMAC-signed state, source-ownership verified before token exchange (Issue #113) |
| `/v1/surveys` | Survey CRUD + status management + question builder updates. `POST /v1/surveys/:id/launch` — activates a survey and atomically creates one `Campaign` + one `SurveyRule` per configured rule. **Convention**: status transitions with side effects (record creation) use a dedicated `POST /:id/action` endpoint, not `PATCH status`. (Issue #80) **Issue #241 Slice 2:** `PATCH /v1/surveys/:id` body is validated by `UpdateSurveySchema.strict()` so unknown keys return HTTP 422 with `code: 'FIELD_DISALLOWED'`; a per-field **state-aware editability allowlist** (`FIELD_EDITABILITY` table in `surveys.ts`) returns HTTP 409 `code: 'FIELD_NOT_EDITABLE_IN_STATE'` for forbidden `(state, field)` combinations (e.g. `type` editable only in DRAFT; `responsePolicy` locked once `responsesCount > 0`). `PATCH /v1/surveys/:id/consent-mode` is the dedicated endpoint for consent override writes — required when the requested mode is more permissive than `Brand.consentMode`, with an attestation gate returning `code: 'ATTESTATION_REQUIRED'` otherwise. **Issue #241 Slice 2 follow-up (#332/#333):** `POST /v1/surveys/:id/duplicate` clones into a new DRAFT with consent fields reset to brand defaults (audit-bypass guard); `DELETE /v1/surveys/:id` uniform soft-delete via `Survey.deletedAt` for DRAFT/STOPPED (ACTIVE/PAUSED return 409 `INVALID_STATE_FOR_DELETE`). |
| `/v1/cx-playbooks` | Brand-scoped named CX rule sets (CX Playbooks) — CRUD + soft-delete. Playbooks store an ordered list of response-to-action rules (scoreMin/scoreMax/actionType/actionConfig) reusable across surveys of the same type. Brand-scoped (not program-scoped) so they survive program lifecycle changes. (Issue #80) |
| `/v1/themes` | Survey theme CRUD + set-default (brand-scoped white-labeling) |
| `/v1/question-templates` | Question template library CRUD (save/reuse questions across surveys) |
| `/v1/public/*` | Demo request form, public survey fetch (with theme), survey response submission (no auth), campaign play endpoint (member JWT auth). `GET /v1/public/programs/by-slug/:slug` — resolves programId/brandId for member enrollment entry point (no auth). **Survey response → campaign trigger wiring**: `POST /v1/public/surveys/:id/respond` evaluates active `SurveyRule` records for the survey against the response score; for each matching rule, enqueues a job to the `campaign-triggers` BullMQ queue (same path as event ingestion). `surveyResponseId` is passed for loop monitor linkage. Non-blocking: trigger enqueue failure is logged but does not fail the response submission. (Issue #80) |
| `/v1/surveys/:id/loop-monitor` | Pipeline view for a live survey: surveys sent → responses received → rules matched → campaigns triggered → loyalty outcomes, with P50/P95 latency. Follows graceful-degradation contract (all sub-queries in `Promise.all`; failures return null sub-fields, never 5xx). Consistent with `program-health` pattern. (Issue #80) |
| `/v1/webhooks` | Outbound webhook endpoint management — GET list, POST create (returns signingSecret once), PATCH update, DELETE (cascade delivery logs), GET `:id/deliveries` (last 50 log entries), POST `:id/test` (synthetic test fire). All routes scoped by `brandId` from JWT. signingSecret never returned after creation. (Issue #156) |
| `/v1/admin/*` | Demo request list, integration webhook URLs, health score recomputation trigger, external signal source registry (`/admin/external-signal-sources`) and admin external-signal feed (`/admin/external-signals`) (Issue #113) |
| `/api/auth/signup` | *New (Issue #170 PR 2).* Public — POST. Creates Clerk user + org + Brand + OnboardingState + first activation event in one transaction via `IdentityProvider.createUserWithOrg`. Maps Clerk `form_identifier_exists` (422) → 409, 429 → 429, all others → 500 (transaction rolls back so no orphaned Brand row). |
| `/api/auth/oauth/:provider/start` | *New (Issue #170 PR 2).* Public — GET. Validates `returnTo` against the `APP_ORIGINS` allowlist (default-deny when unset; relative `/admin` paths bypass). Calls `IdentityProvider.beginOAuth`; redirects 302 to the provider's authorization URL. |
| `/api/auth/signup/finish` | *New (Issue #170 PR 2).* Auth required via `allowNoOrg: true` config flag — accepts a session with `userId` but no `orgId` (the OAuth new-user-without-org case). Calls `IdentityProvider.getUser` + `createOrgForUser`; provisions Brand + OnboardingState + first activation event in one transaction. |
| `/api/webhooks/identity-provider` | *New (Issue #170 PR 2).* Public — POST. Per-route raw-body content-type parser preserves the exact signed bytes for `IdentityProvider.parseWebhook` to verify (svix). Acted-on events: `organization.created` (idempotent upsert + emits first activation event when freshly created via webhook), `organization.updated` (log only — DB is source of truth), `organization.deleted` (log only in PR 2 — soft-delete deferred to PR 6 GDPR cascade), `user.created` (no-op; #189 will consume), `user.deleted` (no-op; PR 6 owns). Returns 401 on signature verification failure; 200 no-op on unrecognized event types. |

### 4.2 Fastify Plugins

| Plugin | Hook | Purpose |
|---|---|---|
| **auth** | `preHandler` | Session verification (delegates to `fastify.identityProvider.getSession()`), extracts `brandId` + `clerkUserId` from org token. Test mode: `X-Test-Brand-Id`/`X-Test-User-Id` headers in dev/test, plus `X-Test-Clerk-Org-Id` for lazy-upsert paths (Issue #277). **Route configs**: `public: true` skips auth entirely; `allowNoOrg: true` (Issue #170 PR 2) accepts sessions with `orgId === null` and decorates `clerkUserId` only — `brandId` is decorated only when `orgId` is non-null AND the brand exists; `lazyUpsertBrand: true` (Issue #277) requires a session with `orgId` but skips the 401-on-missing-brand short-circuit so the route handler can upsert (the redirect-target counterpart to webhook-driven provisioning). Used by `POST /api/auth/signup/finish` for the OAuth new-user-without-org case, and `GET /v1/admin/brand/profile` for first-run landing. (Issue #170 OD-5: no direct `@clerk/*` imports — see ADR 0004.) |
| **identityProvider** | decorator | Single boundary for all identity-provider interactions (`createUserWithOrg`, `getSession`, `parseWebhook`, OAuth, `inviteMember`, etc.). `ClerkIdentityProvider` is the only concrete impl today; ESLint `no-restricted-imports` enforces the boundary. Issue #170 OD-5; ADR 0004. |
| **multiTenant** | `preValidation` | Rejects any request body containing `brandId` — must come from JWT only |
| **audit** | `onResponse` | Fire-and-forget logging of mutations (POST/PATCH/DELETE/PUT) to `AuditEvent` table. **Per-route metadata allowlist** (Issue #277, doc row added by #276 RFC): route handlers populate `request.audit.metadata`; the plugin filters to the per-route `auditAllowlist` config before persisting. Routes can also override the inferred action and resource via `auditAction` and `auditResourceType` config flags (e.g., `/v1/admin/brand/profile` uses `auditAction: 'brand.profile.update'`). Routes without `auditAllowlist` config retain the legacy `{method, path, statusCode}` audit-metadata shape (backward-compat). Prevents accidental over-capture (raw bodies, secret-bearing fields) while letting per-route audit needs (`attestation`, `memberCountAtChange`, `changedFields`) flow into the row. **Issue #241 Slice 2 — `requestIp` capture (NFR-S5):** the plugin auto-enriches `metadata.requestIp` from `request.ip` (which honors Fastify's `trust-proxy` chain when configured). Wrapped in `try/catch`; if `request.ip` is unavailable (misconfigured trust-proxy or a code path that bypassed the network layer), logs `event: 'audit.ip_unavailable'` at WARN and persists `requestIp: null` — audit rows are never blocked on IP availability. `requestIp` must appear in the route's `auditAllowlist` to actually land in the persisted row (defense-in-depth: opt-in per route). |
| **prisma** | decorator | Singleton Prisma client, graceful disconnect on shutdown |
| **redis** | decorator | IORedis client for queues and idempotency, graceful quit on shutdown. Decorates `fastify.redis` as `null` when `QUEUE_MODE=inline`; all callers must null-guard. |
| **memberAuth** | helper | Lightweight member JWT verification for public endpoints. Uses `Authorization: Bearer <token>` header with Clerk `verifyToken()`. Returns member email/sub claims. Unlike org-level auth plugin, does not require Clerk organization context. Used by `/v1/public/campaigns/:id/play`. |

### 4.3 BullMQ Workers

| Queue | Processor | Concurrency | Key Logic |
|---|---|---|---|
| `loyalty-events` | `processLoyaltyEvent` | 5 | Idempotency check -> `evaluateRulesWithIds()` (priority ASC, first-match-wins, stackable opt-in, per-rule `budgetCapPoints` check) -> atomic transaction (LoyaltyEvent + pointsBalance increment) |
| `campaign-triggers` | `processCampaignTrigger` | 10 | Redis dedup (SET NX) -> budget cap check -> atomic award (LoyaltyEvent + pointsBalance + CampaignEvent + budgetSpent) -> optional notification. For `spin_wheel` campaigns: weighted random selection (`crypto.randomInt`) -> result stored in `CampaignEvent.result` JSON -> points/redemption award -> notification with spin link. |
| `notifications` | `processNotification` | 5 | MVP stub — routes to email/SMS provider when `EMAIL_PROVIDER` is configured |
| `sentiment-analysis` | `createSentimentProcessor` | 5 | AI-powered sentiment analysis of survey response text via GPT-4o. Also called synchronously (not queued) from `POST /v1/members/:id/notes` on the CRM note write path so the auto-tagged bucket is returned to the admin UI in the same response — see §6 "Synchronous AI on note creation". |
| `feedback-clustering` | `processFeedbackClustering` | 1 | AI-powered feedback clustering with anomaly detection |
| `alert-evaluation` | `processAlertEvaluation` | 10 | Rule-based alert evaluation creating case follow-ups |
| `health-score-computation` | `processHealthScore` | 3 | Batch health score computation for members (weighted formula: recency 25%, frequency 20%, sentiment 25%, NPS 15%, engagement 15%) |
| `embedding-generation` | `processEmbeddingGeneration` | 5 | Generates and stores KB embeddings for semantic search |
| `external-signal-sync` | `createExternalSignalSyncProcessor` | 2 | Polls or simulates source deliveries from `samplePayloads` / `seedSignals`, updates source health, and enqueues normalized ingestion work |
| `external-signal-ingestion` | `processExternalSignalIngestion` | 3 | Normalizes provider payloads, deduplicates by `sourceId + externalId`, persists `ExternalSignal`, and updates source health/status history |
| `webhook-delivery` | `processWebhookDelivery` | 10 | Loads the target endpoint, HMAC-SHA256 signs the payload (`X-CustomerEQ-Signature: sha256=<hmac(timestamp.body)>`, `X-CustomerEQ-Timestamp`), POSTs with 10s AbortSignal timeout, writes `WebhookDeliveryLog` for every attempt. Throws on 4xx, 5xx, and network errors to trigger BullMQ retry (5 attempts, exponential backoff). Silently returns on deleted/inactive endpoints. (Issue #156) |
| `sla-breach-check` | `createSlaBreachCheckProcessor` | 1 | **Repeating job — every 5 minutes.** Queries `CaseFollowUp` where `slaDeadline < NOW() AND slaBreachedAt IS NULL AND status IN (OPEN, CONTACTED)`, sets `slaBreachedAt` as a dedup guard (before enqueueing), then enqueues one `webhook-delivery` job per case per active endpoint subscribed to `case.overdue`. (Issue #156) |

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
| **Survey** | CX feedback collection. Types: NPS/CSAT/CES/CUSTOM. Extended questions JSON supports 11 question types, skip logic, answer piping. Optional `themeId` FK to SurveyTheme. New (Issue #79): `triggerCategory` (loyalty/cx_risk/scheduled), `triggerKey` (e.g. tier_upgrade), `surveyTypeOverride` (non-null when manager deviated from recommendation) — all nullable, backwards-compatible. New (Issue #80): `distributionCount` (incremented on each automated distribution), `surveyRules` relation. |
| **SurveyRule** | *New (Issue #80).* Per-survey response-to-action rule. Each row maps a score range (scoreMin/scoreMax) to a `Campaign` (1:1 via `campaignId` unique FK). Created atomically with the campaign in `POST /v1/surveys/:id/launch`. Evaluated against `SurveyResponse.score` on each response submission to enqueue campaign triggers. |
| **CxPlaybook** | *New (Issue #80).* Brand-scoped named rule set for reuse across surveys of the same type. Stores an ordered `rules` JSON array (scoreMin, scoreMax, actionType, actionConfig, ruleLabel). Soft-deleted via `deletedAt`. `@@unique([brandId, name])` prevents duplicate names per brand. Brand-scoped (not program-scoped) so playbooks survive program lifecycle changes and are reusable across programs. |
| **SurveyResponse** | Individual feedback with AI-analyzed sentiment, topics, confidence, cluster assignment. |
| **ExternalSignalSource** | Brand-scoped registry of review/social inputs. Stores `sourceType`, `connectionMethod`, `syncMode`, scope/filter/matching config, credential reference, health status, and last sync diagnostics. |
| **ExternalSignal** | Normalized external review/social record. Stores `sourceId`, `externalId`, optional `memberId`, match status/confidence, provider metadata, canonical URL, `postedAt`, `ingestedAt`, and `statusHistory`. Unique on `(sourceId, externalId)`. |
| **SurveyTheme** | Brand-level white-labeling: colors, typography, layout, logo, thank-you page config. One default per brand. Applied via CSS custom properties on public survey page. |
| **QuestionTemplate** | Reusable question library. Stores full question definition (JSON) with tags for discovery. Brand-scoped. |
| **FeedbackCluster** | AI-discovered feedback theme groupings with trend tracking. |
| **DemoRequest** | Public demo signup captures (no auth). |
| **AuditEvent** | System audit trail for admin mutations. |
| **WebhookEndpoint** | *New (Issue #156).* Brand-scoped outbound webhook configuration. Stores `label`, `url`, `signingSecret` (32-byte random hex, shown once on creation, stored plaintext — hard gate: #53 must encrypt before customer onboarding), `events[]` (`case.created`, `case.status_changed`, `case.overdue`), `active` flag. Index on `(brandId, active)`. Cascade relation to `WebhookDeliveryLog`. |
| **WebhookDeliveryLog** | *New (Issue #156).* Append-only delivery attempt record per webhook job. Stores `event`, `caseId`, `httpStatus`, `latencyMs`, `success`, `attempt` (1–5), `requestPayload` (JSON), `responseBody` (first ~500 chars), `deliveredAt`. Indexes on `(webhookEndpointId, deliveredAt DESC)` and `(brandId, deliveredAt DESC)`. Used by `GET /v1/webhooks/:id/deliveries` (last 50 entries) for operator debugging. |
| **OnboardingState** | *New (Issue #170).* 1:1 with Brand. Tracks onboarding progress: picked `useCasePath`, per-step `checklist` (JSON), `dismissedByUserIds` (array), `invitedAdminUserIds` (array), `activatedAt`. Single mutable row per brand; activation history lives in `OnboardingActivationEvent`. ADR 0004. |
| **OnboardingActivationEvent** | *New (Issue #170).* Append-only funnel events. Stores `step` (`OnboardingStep` enum), `previousStep`, `occurredAt`, `dwellMs`, `metadata`. Idempotent on `(brandId, step)`. Indexes on `(brandId, occurredAt)` and `(step, occurredAt)` for funnel aggregation. Never `UPDATE`/`DELETE` outside the GDPR erasure path. ADR 0004. |

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

### 5.5 Outbound Webhook Delivery (Issue #156)

CustomerEQ acts as the **sender** — the reverse of §5.3 (where it is the receiver). When alert cases are created, updated, or go overdue, CustomerEQ POSTs a signed JSON payload to all active webhook endpoints configured for the brand.

```mermaid
sequenceDiagram
    participant API as Fastify API / Worker
    participant WDQ as webhook-delivery Queue
    participant WKR as Worker (webhookDelivery)
    participant DB as PostgreSQL
    participant EXT as External Receiver

    Note over API: case.created → alertEvaluation.ts
    Note over API: case.status_changed → cases.ts PATCH
    Note over API: case.overdue → slaBreachCheck.ts (repeating every 5 min)

    API->>DB: Query active endpoints for brand + event
    loop Each active endpoint
        API->>WDQ: enqueueWebhookDelivery({ endpointId, event, caseId })
    end

    WDQ->>WKR: processWebhookDelivery (concurrency 10)
    WKR->>DB: Load endpoint (skip if deleted/inactive)
    WKR->>WKR: Build payload JSON + HMAC-SHA256 sign\n(X-CustomerEQ-Signature: sha256=<hmac(ts.body)>)
    WKR->>EXT: POST endpoint.url (10s timeout)
    alt Success (2xx)
        EXT-->>WKR: 200 OK
        WKR->>DB: WebhookDeliveryLog { success: true }
    else Failure (4xx / 5xx / timeout)
        EXT-->>WKR: error or non-2xx
        WKR->>DB: WebhookDeliveryLog { success: false, attempt: N }
        WKR->>WDQ: throw → BullMQ retry (up to 5 attempts, exponential backoff)
    end
```

**Dedup guard for `case.overdue`**: `slaBreachCheck` sets `CaseFollowUp.slaBreachedAt` *before* enqueueing deliveries. Concurrent checker runs query `slaBreachedAt IS NULL`, so each case fires at most once.

**Admin UI** (Phase B — deferred to Issue #156 Phase B): `/admin/settings/webhooks` page with endpoint list, Add Endpoint modal, one-time secret banner, and delivery log drawer.

---

## 6. Design Patterns & Principles

- **Event-Driven Processing**: Synchronous ingestion decoupled from asynchronous processing. API returns 202 immediately; workers handle point calculation and campaign execution. Preserves the <15-minute SLA by processing campaign triggers at high priority (concurrency 10).

- **Synchronous AI on note creation (exception to event-driven default)**: `POST /v1/members/:id/notes` calls `@customerEQ/ai` `analyzeResponse` *synchronously* inside the request handler when the caller doesn't provide an explicit sentiment tag. The auto-computed bucket must be returned in the same response so the admin UI can immediately show the rep what the AI picked and offer a one-click override. A queued/async path would force the UI to poll or render an "analyzing…" placeholder for every note. AI failures degrade gracefully: the note is still saved with `sentiment: null` and a warn log. The ~400-1200ms added latency is acceptable for CRM note writes (low frequency, human-operated).

- **Multi-Tenant Isolation**: `brandId` is injected from verified JWT at the auth layer. The multiTenant plugin rejects `brandId` in request bodies. All Prisma queries are scoped to `brandId`. Defense in depth: DB-level foreign key constraints prevent cross-tenant references.

- **Append-Only Loyalty Ledger**: `LoyaltyEvent` is the source of truth for points. `Member.pointsBalance` is a materialized counter updated atomically within the same transaction as the ledger write. This prevents balance drift and preserves full audit history.

- **Idempotency**: Same correctness guarantee in both queue modes. `QUEUE_MODE=redis` uses 24-hour TTL keys on event ingestion and SET NX for campaign trigger deduplication (one trigger per member per campaign) — fast path, served from cache. `QUEUE_MODE=inline` uses the database-level `idempotencyKey` unique index on `LoyaltyEvent` and the `@@unique([campaignId, memberId])` constraint on `CampaignEvent` — slower path, served from Postgres. Outcome is identical in both modes; Redis is purely a write-heavy traffic optimization.

- **Transactional Integrity**: All point mutations (earn and burn) use Prisma `$transaction` to atomically write the `LoyaltyEvent` and update `pointsBalance`. Redemptions atomically debit points, decrement stock, and create the redemption record.

- **Budget-Capped Campaigns**: Campaign triggers calculate USD cost (`points * pointToCurrencyRatio`) and auto-pause campaigns when `budgetSpent` exceeds `budgetCap`.

- **Signature-Verified Webhooks**: Salesforce and HubSpot webhooks are HMAC-SHA256 verified with timing-safe comparison before any processing. External signal webhooks are source-scoped and validated against the source's configured shared secret before ingestion is queued. Outbound webhooks (issue #156) are signed using the same algorithm — `X-CustomerEQ-Signature: sha256=<hmac>` with a per-endpoint secret and timestamp, mirroring the Stripe webhook signature pattern.

- **Conservative External Identity Resolution**: External public content never attaches to a member record unless the ingestion pipeline has a deterministic match. Unmatched content remains brand-scoped (and optionally subject-scoped) so Customer 360 does not merge uncertain public identities into first-party profiles.

- **Credential Encryption at Rest** *(pre-onboarding gate — tracked in #53)*: Any sensitive string stored in PostgreSQL that could expose a customer system if leaked — webhook endpoint URLs, signing secrets, integration API tokens — must be encrypted at rest before the feature is exposed to customers. Encryption/decryption is the responsibility of the application layer (not the database). This is a **hard gate** for customer onboarding: features that store such credentials must not go to production until #53 is resolved.

- **Centralized Test Infrastructure**: All mocks, factories, and test helpers live in `packages/config/src/test-utils/`. Tests import from `@customerEQ/config/test-utils` — never define inline mocks. This prevents mock drift across test files.

- **GDPR/CCPA by Default**: Soft deletes, consent tracking (`consentGivenAt`, `consentVersion`), and erasure support are baked into the Member model from MVP.

- **State-aware PATCH field allowlist (admin mutations)** *(Issue #241 Slice 2)*: For domain entities with a non-trivial state machine (Survey: DRAFT→ACTIVE→PAUSED→STOPPED), the `PATCH /:id` route validates body against `Schema.strict()` (unknown keys → 422 `FIELD_DISALLOWED`) AND consults a per-field editability table — `field → (state, ctx) → boolean` — returning 409 `FIELD_NOT_EDITABLE_IN_STATE` for forbidden combinations. Mutations with side effects (status transitions, consent overrides) get dedicated endpoints rather than being squeezed into the general PATCH. The frontend disables the corresponding inputs so users rarely hit the 409 in practice; the server-side check is the safety net for direct-API callers and racing clients. See `FIELD_EDITABILITY` in `apps/api/src/routes/surveys.ts` for the canonical example.

- **Pure-logic + React-shell file split for testable components** *(Issue #241 Slice 3)*: New web components with non-trivial business logic (`SurveyRowMenu`, `FilterChips`) split into two files — `Foo.tsx` (React shell: hooks, effects, JSX) and `foo.logic.ts` (pure functions: state-machine, reducers, predicate helpers). Tests target `.logic.ts` directly so the test runner doesn't need a React/jsdom harness. Used in `apps/web/src/app/(admin)/admin/surveys/components/`; pattern can be adopted for any component whose behavior is reducible to pure functions of its props and a small action surface.

- **Admin list row-click two-affordance pattern** *(Issue #241 Slice 3)*: Admin list pages (`/admin/programs`, `/admin/members`, `/admin/surveys`, etc.) navigate to detail via two affordances: the Name column is a single-click `<Link>`, and the row body honors `onRowDoubleClick` (PaginatedTable's existing API). Rationale: the row contains other actionable controls (`✎`, `⋯` menu, action buttons) — a single-click anywhere on the row would conflict with those; the Name link is the unambiguous "open this" affordance and double-click is a forgiving alternative for users who don't aim at the Name precisely.

- **`position: fixed` popover to escape table overflow** *(Issue #241 Slice 3)*: Popovers and dropdowns inside a `<table>` row cannot use `position: absolute` reliably — the table wrapper's `overflow-x-auto` (and similar clipping ancestors) will crop the popover and the browser may add a horizontal scrollbar. Pattern: render the trigger with `useRef`, on open compute `getBoundingClientRect()`, render the popover with `position: fixed` + coordinates from the rect. Re-position on `scroll` (capture-phase) and `resize` while open. Clamp into the viewport to avoid right-edge overflow on narrow widths. See `apps/web/src/app/(admin)/admin/surveys/components/SurveyRowMenu.tsx` for the canonical implementation; reuse rather than reinventing if a future component needs a row-anchored popover.

- **CSS-variable contract for theme-driven rendering** *(Issue #241 Slice 4a, R31)*: Themed components that need to render the brand's `BrandTheme` faithfully consume tokens **exclusively** via `--ceq-*` CSS custom properties — never hardcoded colors, sizes, or fonts. `theme-to-css-vars.ts` (`apps/web/src/components/survey-form/`) maps each `BrandTheme` field to its `--ceq-*` property; the root component (`<div className="ceq-survey-card" style={{ ...cssVars }}>`) sets the variables, and every descendant references them as `var(--ceq-*)`. Scale enums (`sm` / `md` / `lg`) resolve to pixel values via `scale-resolvers.ts`. This keeps the token surface narrow, makes runtime theme swaps free (no re-render gymnastics), and lets the future embed-widget renderer (`packages/embed/src/ceq-survey.ts`, Slice 5) consume the same contract for visual parity. Hardcoded values are reserved for non-theme concerns (error red `#dc2626`, focus outline geometry) — documented in the RFC's "Non-brand-tokenized elements" table.

- **Channel/viewport-aware renderer family** *(Issue #241 Slice 4a; respondent wiring landed Slice 4b — earlier than the original "Slice 5" commitment; second live host page + shared glue hook added Issue #378)*: Survey rendering (and any future channel-diverse rendering — receipt, email digest, etc.) lives under a `components/survey-form/` family where a single pure `SurveyFormRenderer` is wrapped by channel/viewport adapters: `PreviewSurvey` for admin preview, `apps/web/src/app/survey/[id]/page.tsx` for the standalone respondent page, and `apps/web/src/app/survey/[id]/r/[token]/page.tsx` for the tokenized respondent page (#378). The renderer accepts a `mode: 'preview' | 'live'` flag — `'preview'` (admin) disables submit and grays interactive controls; `'live'` (respondent) wires answers + the form's own submit button and surfaces field-level inline errors via the co-located `RendererErrorLine` component, which is used inside the renderer for question + consent errors **and** re-used by the respondent page for the member-id prefix field, so the three error surfaces share one visual contract (red text, `data-error` attribute, `role="alert"`). The renderer takes an `errors` prop (`{ consent?: string; questions?: Record<questionId, string> }`) plus controlled `consentChecked` / `onConsentCheckedChange` so the host page owns submit-time validation while the renderer stays presentation-only. Skip-rule evaluation is a separate pure helper (`skip-rules.logic.ts`) consumed by the renderer. The same React tree services every live consumer — no parallel implementations; the legacy bespoke respondent renderer (~1000 lines) was deleted in Slice 4b. **Live-page glue is shared via `useSurveyResponseForm`** (`apps/web/src/components/survey-form/useSurveyResponseForm.ts`, added in #378): both live host pages consume the hook for survey/brand fetch, answers / consent / memberId state, the clear-on-change handlers, required-question + explicit-consent validation, and the `effectiveConsentMode` projection. Each host page contributes only what's different — identity gate (member-id field vs token-status preflight) and POST body / response branching. Rationale: #378 introduced the second live surface and the original duplicated glue caused an inline-error regression mid-PR. The hook closes that drift surface by construction; the embed-widget surface (`apps/api/src/routes/public.ts:generateWidgetJs`) is a third copy tracked separately for unification under this family in [#415](https://github.com/mathursrus/CustomerEQ/issues/415).

- **Chevron-collapsible section primitive** *(Issue #241 Slice 4a, R26)*: Detail pages with multi-section layouts use `<CollapsibleSection title expandedDefault>` (`apps/web/src/app/(admin)/admin/surveys/[id]/components/CollapsibleSection.tsx`). Parent passes `expandedDefault`; the section owns its own toggle state thereafter so the parent never needs to manage open/closed children. The chevron is the platform-standard `▼` rotating `-90deg` when collapsed. Toggle button exposes `aria-expanded` for accessibility. Promote to `apps/web/src/components/ui/` when a 2nd consumer (Slice 4b editor or beyond) adopts it.

- **State-aware save mode for admin editor forms** *(Issue #241 Slice 4b, MA1)*: For domain entities with a non-trivial state machine (Survey: DRAFT→ACTIVE→PAUSED→STOPPED), the admin editor form branches its save behavior on entity status rather than always-on auto-save or always-on explicit Save. **DRAFT** uses a debounced (500 ms) per-field PATCH on blur via the `useAutoSave` hook (`apps/web/src/app/(admin)/admin/surveys/[id]/edit/hooks/useAutoSave.ts`); the header indicator reads "Saved · Xs ago". **ACTIVE / PAUSED** disables auto-save (the hook short-circuits to a no-op when `status !== 'DRAFT'`) and surfaces an explicit per-tab Save button enabled only when that tab's dirty state is non-empty; the header banner reads "This survey is live. Changes apply immediately on save." **STOPPED** disables all inputs and hides Save chrome entirely; the header reads "Stopped — Restart to edit." This client-side branching pairs with the server-side state-aware PATCH editability allowlist (above) — the server is the authority that rejects forbidden writes (409 `FIELD_NOT_EDITABLE_IN_STATE`), the client's save mode minimizes how often operators encounter those rejections in the first place. Reference: `apps/web/src/app/(admin)/admin/surveys/[id]/edit/components/SurveyEditorForm.tsx`. **Pairing rule**: any entity whose `[id]/edit` page would adopt the Standard CRUD admin pattern with a non-trivial state machine should adopt this save-mode pattern as well.

- **Client mirror of the state-aware field-editability allowlist** *(Issue #241 Slice 4b, Phase 12 Round 1)*: When the server enforces a per-field state-aware editability table (see "State-aware PATCH field allowlist" above), the client maintains a structurally identical mirror at `apps/web/src/app/(admin)/admin/surveys/_helpers/field-editability.ts` and runs every outbound PATCH body through `isFieldEditable(field, state, ctx)` before sending. Rationale: the activation gate flushes any pending field changes before opening the ActivateModal so the operator's last edits aren't lost; without the client-side filter that flush could re-send a DRAFT-only field (e.g. `responsePolicy` after `responsesCount > 0`) and the server would reject the whole PATCH with 409, blocking activation through no fault of the operator. The server table remains the authority — the client mirror is a UX guard that keeps activation deterministic. **Pairing rule**: ship the mirror in lockstep with any server-side `FIELD_EDITABILITY` change; the mirror is documented as a "must-update" in the server table's file-header comment.

- **Policy-aware application-layer dedup for survey responses** *(Issue #241 Slice 4b, Phase 12 Round 1)*: `SurveyResponse` dedup is enforced in the API handler (`apps/api/src/routes/public.ts`), not via a DB partial-unique index. The handler branches on `Survey.responsePolicy`: **ONCE** does a `priorResponse` SELECT and returns 409 `POLICY_ONCE_DUPLICATE` (with a defensive P2002 catch for the millisecond race window of two concurrent submits), **LATEST_OVERWRITES** updates the prior response row in place, and **MULTIPLE** plain-inserts. The earlier partial-unique index `survey_responses_live_dedup` on `(surveyId, memberId) WHERE importBatchId IS NULL AND memberId IS NOT NULL` (added in `20260505000000_survey_import_batch`) was dropped in `20260514120000_drop_live_dedup_unique` because it ignored `responsePolicy` and crashed MULTIPLE-policy second-submits with P2002 → HTTP 500. The non-unique index `survey_responses_surveyId_memberId_idx` remains for SELECT performance. **General rule**: when a uniqueness invariant is conditional on a row's logical state (here: `responsePolicy`, which lives on a different table from the constrained row), enforce it in the API handler — not in a partial-unique index that the database evaluates without that context.

- **Hash-at-rest tokenized public endpoint** *(Issue #378)*: Any unauthenticated public route that needs to identify a specific actor without exposing PII does so via an opaque token whose SHA-256 hash is the only thing stored at rest. Token generation: `crypto.randomBytes(24)` (192 bits of entropy) encoded as base64url and embedded in a URL path segment (never a query parameter, never a header — the path-segment shape matches the industry standard `/r/<token>` used by SurveyMonkey / GetFeedback / Typeform's `/to/<form>`). Storage: `tokenHash @unique` index on the persistence table; plaintext returned exactly once in the response that creates the token, never retrievable afterwards. Validation: `findUnique({ where: { tokenHash } })` is a constant-time B-tree lookup; error responses across token-state branches (`invalid` / `expired` / `responded` / `survey-not-open`) share a uniform body shape to prevent token-existence-leak timing attacks. Canonical implementation: `packages/shared/src/distributionTokens.ts` + `apps/api/src/routes/distributionBatches.ts` (mint) + `apps/api/src/routes/public.ts` (validate). Mirrors the `ApiKey.keyHash` precedent at `apps/api/src/plugins/auth.ts:69`. Reuse pattern (not the literal token type) for any future tokenized public flow (one-click email confirmations, magic-link sign-in, etc.).

- **Brand-timezone + locale display utility** *(Issue #378)*: All UI-visible timestamps for tenant-scoped records are formatted in `Brand.timezone` (IANA, e.g., `America/Los_Angeles`) with the brand's `Brand.locale` (BCP-47, e.g., `en-US`). Storage stays UTC; the display projection happens at render time. Two primitives at `packages/shared/src/datetime.ts` wrap `date-fns-tz` v3: `formatInBrandTz(date, tz, locale, format?)` and `endOfDayInBrandTz(localDate, tz)`. A third helper `addDaysInBrandTz(now, days, tz)` does calendar-aware day addition in brand-TZ wall-clock space (so DST spring/fall inside the window resolves to the same wall-clock day on the target date) and converts the result back to true UTC for composition with `endOfDayInBrandTz`. Locale registry maps BCP-47 strings to `date-fns/locale` exports; unknown locales fall back to `enUS`. Web consumers re-export through `apps/web/src/lib/datetime.ts`. Correctness verified by 15 spike fixtures (PT spring-forward + fall-back, IST half-hour, NZ Southern-hemisphere DST, boundary days) — see `docs/evidence/378-tz-spike/findings.md`. Reuse for any future surface that needs brand-TZ display: digest emails, scheduled batches in V1.x, audit-log display, alert-rule cooldowns, expiring webhook secrets.

- **In-handler throttling with `QUEUE_MODE` parity** *(Issue #378)*: When an endpoint needs a small, well-scoped rate limit and the repo doesn't (yet) have a route-wide rate-limit plugin, implement the limit in-handler via Redis `INCR` + `EXPIRE NX` inside a `multi()` pipeline, with `QUEUE_MODE=inline` graceful degradation. The handler checks `fastify.redis && typeof fastify.redis.multi === 'function'` — when either is false (inline mode, Redis down, test stub), it skips the check and emits a structured `WARN` log (`event: <feature>.ratelimit.skipped`, `reason: redis_unavailable`) so ops can see the gap. This mirrors the queue-mode parity contract from `apps/api/src/queues/bullmq.ts:52-69` — full enforcement when Redis is available, observable degradation when it isn't. Migration trigger to `@fastify/rate-limit` (issue [#218](https://github.com/mathursrus/CustomerEQ/issues/218)): when a third endpoint family in the repo needs throttling, OR when the in-handler approach can no longer express the limit shape (e.g., per-brand-per-minute rather than per-survey, or progressive backoff). Canonical implementation: `apps/api/src/routes/distributionBatches.ts:enforceBatchRateLimit`.

- **One-time secret regeneration as the only re-fetch path** *(Issue #378)*: For credentials and tokens that are hash-at-rest (above), the plaintext is irrecoverable after the single transmission. The operator-side "re-download" affordance — which exists for operator-error recovery (`I lost the CSV before pasting it into Mailchimp; my recipients have not seen any email yet`) — is therefore implemented as **regenerate-and-invalidate**, not as a stable re-fetch. The regenerate endpoint mints new tokens for every existing `(parent, member)` pair, replaces the `tokenHash` + `tokenPrefix` columns, and preserves any `consumedAt` markers (responded members stay responded — consumption is monotonic; previously valid responses remain valid). The previous URLs become permanently invalid (their hashes no longer exist in the table). Gating: the regenerate endpoint requires a `confirmAcknowledge: true` body field as server-side proof that the operator accepted the strong-warning modal; missing the flag returns HTTP 422 `code='REGENERATION_NOT_ACKNOWLEDGED'`. Audit row written with `action='<entity>.tokens_regenerated'` and `metadata.regeneratedCount`. Canonical implementation: `apps/api/src/routes/distributionBatches.ts` POST `/regenerate-tokens` + `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/batches/[batchId]/page.tsx` confirmation modal. Pairs with the **Hash-at-rest tokenized public endpoint** pattern above — apply both together for any new tokenized credential type.

- **Server-side document rendering for Office/PDF exports** *(Issue #423)*: Office-format responses (`.xlsx` today, `.docx` / `.pdf` later) are assembled server-side under `apps/api/src/utils/<format>Export.ts` using ExcelJS (`exceljs` on npm) for `.xlsx`. The route returns `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` + `Content-Disposition: attachment; filename="…"`. Browser-issued GET via `<a href>` so the browser owns the download lifecycle; the client never transforms the response (preserves the cover-block's audit-trail integrity from §10 Compliance Architecture). Library choice rationale: ExcelJS is Node-native streaming-capable, has built-in cell-level styling (alignment / fill / hyperlinks), and avoids SheetJS's deprecation-path for styled output. Reuse for any future generated document; canonical implementation `apps/api/src/utils/excelExport.ts`. Pairs with **Bulk-export row cap** below.

- **Query-token auth for browser-issued downloads** *(Issue #423)*: Authenticated `<a href>` downloads cannot inject `Authorization: Bearer` headers from an anchor click. The auth plugin (`apps/api/src/plugins/auth.ts`) therefore accepts a `?token=<jwt>` query parameter as an alternative credential — the same Clerk JWT scoping applies whether the token rides in a header or the query string. Tokens MUST be short-lived (Clerk JWTs default to 60s). Mitigations against URL-leakage: the response sets `Content-Disposition: attachment` so nothing renders in the browser tab (no clickable resource → no referer-header leakage); Fastify does not log query strings by default. For routes that don't need this credential pathway, prefer Bearer-in-header. Future hardening (one-shot signed URLs) is an option if a downstream possessor raises concerns; revisit when a second generated-document route ships. Canonical use: `GET /v1/surveys/:id/responses.xlsx`.

- **Shared admin filter component family** *(Issue #423, R9c)*: Generic filter primitives live at `apps/web/src/components/filters/` — `FilterChipGroup` (lifted from Issue #241 Slice 3's `FilterChips`), `SubmittedDateRange`, `FilterBar` (overflow-aware composer), `filter-chips.logic.ts` (pure helpers including `bandChipsForType(type)`), `<filter>.url.ts` codecs. Any admin surface that needs a chip-style filter row consumes these primitives via `<FilterBar groups={…} />` or directly via `<FilterChipGroup …>`. Surface-specific filter logic stays out of the shared family — only generic primitives live here. Per-surface adoption: when a new admin page introduces a chip-style filter row, lift any surface-specific chip primitive into this family in the same commit (no copy stays behind). Canonical consumers: `apps/web/src/app/(admin)/admin/surveys/page.tsx` (surveys list) + `apps/web/src/app/(admin)/admin/surveys/[id]/components/ResponseSection.tsx` (survey response review).

- **Filter-bar overflow → popover pattern** *(Issue #423, R9d)*: A filter bar with ≥3 chip groups that may overflow its container at narrow viewports collapses its least-analytically-critical group behind a `More filters ↓` popover. The collapsed group renders the same `FilterChipGroup` inside the popover; selection state preserves across collapse/expand. Detection: resize-observer-driven (jsdom polyfills it as a no-op in tests; behavior is verified in Playwright E2E). Fallback: Tailwind `lg:` media query at <1024px unconditionally collapses. Canonical implementation: `apps/web/src/components/filters/FilterBar.tsx`.

- **URL state codec for admin-table filters** *(Issue #423)*: Filter state on admin tables serialises into the URL query string via a colocated codec `apps/web/src/components/filters/<feature>.url.ts`. The decoder validates via the *same* Zod schema the API consumes (`packages/shared/src/zod/<feature>.schema.ts`); unknown values silently drop to defaults so a shared URL never throws a render error. Encoded shape is `?key=v1,v2&otherKey=…` (comma-joined arrays). Operators share filtered views with colleagues by copying the URL. Canonical implementation: `apps/web/src/components/filters/responseFilters.url.ts` paired with `packages/shared/src/zod/responseFilters.schema.ts`.

- **List endpoint filter-echo envelope** *(Issue #423)*: When a list endpoint's filter state drives a sibling export endpoint, the response envelope augments the standard `{ data, total, page, pageSize, totalPages }` with a `filters` block echoing the *effective* (post-gate) filter state and any visibility gates. The export endpoint reads the same shape so the cover-block's `Score band: N/A` / `Sentiment band: N/A` decisions never duplicate the type-gating logic. Canonical implementation: `buildFiltersEcho` in `apps/api/src/utils/responseFilters.ts`; consumed by `GET /v1/surveys/:id/responses` + `GET /v1/surveys/:id/responses.xlsx`.

- **`AI ·` column prefix + shared `AI_FIELDS_CAVEAT` constant** *(Issue #423, R6a)*: Operator-facing surfaces that display AI-derived columns (sentiment, topics, AI summary, etc.) prefix the column header with `AI ·` so the operator never confuses derived data for entered data. The caveat tooltip text and any matching disclaimer-row text in exports read from a single shared constant `AI_FIELDS_CAVEAT` (in `packages/shared/src/constants.ts`). Operator-facing copy MUST NOT name internal issue numbers — the future-pointer phrasing is *"later phases of this product surface will continue refining these AI-derived values to improve accuracy."* Pairs with **Server-side document rendering** above (export disclaimer row 13 reads the same constant verbatim).

- **Canonical app-host constant for generated documents** *(Issue #423, R15)*: Canonical app-host URLs referenced inside generated documents (exports, emails, PDFs) live as named constants in `packages/shared/src/constants.ts` — `EXPORTS_POWERED_BY_URL = 'https://customereq.wellnessatwork.me'` is the first. The cover-block / template builders read the constant; literals never duplicate. If the production host changes, a single edit propagates to every generated document. Future PDF / email surfaces SHALL reuse this constant (or co-locate a sibling under the same naming scheme).

- **Scale-aware band tables on score-type constants** *(Issue #423, R9a)*: Survey scoring types with multiple admissible scales (`NPS` today: 0-10 default + 1-5 reserved; `CES` today: 1-7 default + 1-5 reserved) expose a `bandsForScale(scale: ScoreScale)` accessor returning the per-scale band table. Filter UI and API filter translators consume the same table — no hard-coded scale shapes. Phase 1 wires only the default scale; future scales (NPS 1-5, CES 1-5) are no-throw addressable via the same accessor. Constants surface: `NPS.bandsForScale`, `CSAT.bandsForScale`, `CES.bandsForScale` + `defaultScaleForType(type)` + `shouldShowScoreBand(type)` / `shouldShowSentimentBand(type, hasOpenEndedQuestion)` gating helpers. Canonical location: `packages/shared/src/constants.ts`.

- **Bulk-export row cap with HTTP 413 contract** *(Issue #423, R18a)*: Bulk-export endpoints cap output via a single `EXPORT_ROW_CAP` shared constant in `packages/shared/src/constants.ts` (Phase 1: `50_000`, well within Excel's 1,048,576 sheet limit). Beyond the cap → HTTP 413 with body `{ code: 'EXPORT_TOO_LARGE', total, capacity, message }`. The consumer UI pre-emptively disables the Export button based on the count badge so the cap rarely surfaces as a round-trip 413 in practice. Async-job export for very large filter sets is a deferred V1.x option (route stays HTTP-synchronous in Phase 1). Audit data (the export endpoint's audit row records `metadata.total`) drives any future cap adjustment. Canonical implementation: `apps/api/src/routes/surveys.ts` GET `/v1/surveys/:id/responses.xlsx`.

- **Audit-configured GET routes** *(Issue #423)*: The audit plugin (`apps/api/src/plugins/audit.ts`) defaults to auditing only mutation methods (POST / PATCH / PUT / DELETE) so read traffic doesn't flood the audit trail. Read endpoints that need audit coverage for compliance (GDPR Art. 30, SOC2 CC7.2) opt in via `config.auditAction` on the route definition; the plugin's gate widens for any GET that declares `auditAction`. Use sparingly — only when the read itself is a regulated event (per-tenant bulk data fetch, export, member-PII detail). Canonical implementations: `survey.responses.list` + `survey.responses.export` on `apps/api/src/routes/surveys.ts`. The export audit row additionally captures `aiVintageNonNullCount` so a downstream possessor can correlate exported PII with the AI-model state at export time.

- **Forward-pointer for GDPR Art. 17 erasure worker** *(Issue #423; placeholder for future erasure worker)*: When the data-subject erasure worker is built (no such worker exists today), it SHALL zero AI-derived columns (`sentiment`, `confidence`, `topics`, `summary`, `clusterId`) on every `SurveyResponse` belonging to an erased member, in addition to clearing `memberId`. The downstream read surfaces (list endpoint, Excel export) already render `member: null` → `—` correctly whether the worker has run yet or not, so this is a forward-looking constraint on the future worker's contract — not a Phase-1 deliverable.

---

## 7. Configuration & Environment

### 7.1 FRAIM Config
Located at `fraim/config.json`. Architecture doc pointer: `customizations.architectureDoc` -> `docs/architecture/architecture.md`.

### 7.2 Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgresql://customerEQ:customerEQ@localhost:5432/customerEQ` | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection for BullMQ + idempotency (only used when `QUEUE_MODE=redis`) |
| `QUEUE_MODE` | `redis` | Queue execution mode. `redis` runs work asynchronously through BullMQ + Redis (prod default, optimized for throughput and cross-instance dedup). `inline` runs the same workflows synchronously in-process against Postgres only — no Redis required. Both modes are functionally equivalent; Redis is a perf optimization, not a correctness dependency. |
| `CLERK_SECRET_KEY` | — | Clerk JWT verification key |
| `CLERK_PUBLISHABLE_KEY` | — | Clerk frontend key |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | — | Clerk key exposed to browser |
| `API_PORT` | `4000` | Fastify server port |
| `API_HOST` | `0.0.0.0` | Fastify server host |
| `API_BASE_URL` | `https://api.customerEQ.io` | Used in admin integration endpoint URLs |
| `CEQ_SALESFORCE_WEBHOOK_SECRET` | — | HMAC secret for Salesforce webhook verification |
| `CEQ_SALESFORCE_BRAND_ID` | — | Brand ID for Salesforce webhook events |
| `CEQ_HUBSPOT_WEBHOOK_SECRET` | — | HMAC secret for HubSpot webhook verification |
| `CEQ_HUBSPOT_BRAND_ID` | — | Brand ID for HubSpot webhook events |
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

**Built-image module-resolution probe (CI gate, #273)**: The `docker-build` job in `.github/workflows/ci.yml` runs each just-built image with a one-shot dynamic import:

```yaml
- name: Verify <Image> image module resolution
  run: |
    docker run --rm --entrypoint node ceq-<image>:${{ github.sha }} \
      --input-type=module \
      -e "await import('/app/packages/ai/dist/index.js').then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)})"
```

This catches `ERR_MODULE_NOT_FOUND`, broken relative imports, and missing dist files at PR time, before the image reaches CD. Probe target is **deliberately narrow** to `@customerEQ/ai`'s dist — importing the full app entry would couple the gate to env-var reads and false-positive in CI. Complementary to the CD-side `Verify API health` step in `deploy.yml`, not a replacement.

**CD pipeline shape (post Issues #386 / #451 / #453)**:
```
CI on `main` push → Deploy workflow (`workflow_run`) → Build images against Microsoft-hosted `NODE_IMAGE` → Push to ACR → [customereq-migrate ACA Job] → Deploy containers → Image SHA probe (demo only if rebuilt) → Health check → Canary checks
                                                                                                                    ↓ (on failure)
                                                                                                            Pipeline fails, old containers stay live
```
The deploy workflow passes a Microsoft-hosted Node image into every deploy-time Docker build via `NODE_IMAGE`, while local and PR builds keep the default `node:22-slim` baked into the Dockerfiles. This removes the deploy-time dependency on Docker Hub's anonymous pull quota without forcing private-registry auth into the local or PR path. The migration job uses the just-pushed API image (`docker-entrypoint-migrate.sh`), runs `prisma migrate deploy`, and asserts `_prisma_migrations` completeness. If it exits non-zero, all subsequent `az containerapp update` steps are skipped. When the demo storefront was not rebuilt, the image-SHA verification step skips `customereq-demo` as well so non-demo prod commits do not fail after a successful core rollout. This applies to both `workflow_run` (CI-triggered) and `workflow_dispatch` (manual hotfix) paths.

---

## 8. Infrastructure

| Component | Service | Rationale |
|---|---|---|
| API | Azure Container Apps | Serverless containers, scale-to-zero, built-in ingress |
| Worker | Azure Container Apps | Same image as API, separate app, scales independently |
| Migration Gate (`customereq-migrate`) | Azure Container Apps Job (Manual) | Runs `prisma migrate deploy` + `_prisma_migrations` completeness check before any container swap (Issue #386). Exits non-zero on failure → pipeline stops, old containers stay live. Uses API image, system-assigned managed identity for ACR pull and `DATABASE_URL` from Key Vault. Provision via `scripts/provision-migrate-job.sh`. |
| Database | Azure Database for PostgreSQL Flexible Server | Managed PostgreSQL 16, HA, automated backups, encryption at rest |
| Cache/Queue (optional) | Upstash Redis (managed) | Managed Redis used by BullMQ when `QUEUE_MODE=redis`. Optional — the system runs end-to-end without it under `QUEUE_MODE=inline`. |
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
| Unit (pure logic) | Vitest | Pure functions, rule evaluation, Zod schemas | Co-located (`*.test.ts`) |
| Unit (RTL/jsdom — component behavior) — *Issue #241 Slice 4a* | Vitest + jsdom + React Testing Library | React component rendering, user-event interaction, accessibility-tree assertions for client components in `apps/web` | Co-located (`*.test.tsx`); harness wired in `apps/web/vitest.{config,setup}.ts` |
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
| [ADR 0004](./adr/0004-onboarding-activation-funnel-and-identity-provider.md) | OnboardingActivationEvent funnel model + IdentityProvider abstraction (Issue #170) | 2026-04-27 |

---

*This document is the authoritative architecture reference. Update it when a significant architectural decision changes.*
