# Feature: MVP Build — Full Loyalty Platform

Issue: #23
Owner: Claude (claude-sonnet-4-6)
Date: 2026-03-24

---

## Customer

Mid-market businesses ($10M–$500M revenue) operating loyalty or rewards programs, or wanting to start one. Specifically the following actors within those businesses:

| Actor | Role |
|-------|------|
| **Admin / Program Owner** | Creates and configures the loyalty program — rules, tiers, reward catalog |
| **Marketing Manager** | Creates and launches CX-to-loyalty campaigns; monitors performance |
| **Loyalty Member** | End customer who enrolls, earns points, and redeems rewards |
| **Analyst** | Views ROI metrics, campaign performance, and member engagement dashboards |
| **IT / Developer** | Connects Salesforce and HubSpot as CX event sources via webhooks |
| **Guest / Prospect** | Discovers CustomerEQ through the marketing site and requests a demo |

---

## Customer's Desired Outcome

1. Marketing managers can configure a fully operational loyalty program in under 30 minutes, without engineering help.
2. Loyalty members can self-enroll, view their points balance, and redeem rewards through a branded portal.
3. A low NPS score submitted in Salesforce (or a resolved support ticket in HubSpot) automatically triggers a loyalty reward for the affected member within **15 minutes** — turning a detractor into a promoter.
4. The CFO can see program ROI on a self-serve dashboard, proving loyalty spend attribution without a custom BI project.
5. Salesforce and HubSpot CX events flow into the loyalty engine without a $75,000/year custom integration contract.

---

## Customer Problem Being Solved

### The CX-Loyalty Disconnect (Primary Problem)

Every existing loyalty platform (Annex Cloud, Yotpo, Smile.io, LoyaltyLion) treats loyalty as a standalone engine disconnected from CX data. When a customer submits a 4/10 NPS score, nothing happens automatically. The customer service team sees the score in Salesforce. The loyalty team manages points in a separate system. Bridging them requires a manual weekly process or an expensive custom integration.

**Industry average time from CX event to loyalty action: 82 hours.**

In those 82 hours, the detractor has told 10 friends about their bad experience.

### The Integration Tax (Secondary Problem)

Connecting CX tools to loyalty platforms costs $75K–$150K per year in professional services and custom integration maintenance. Mid-market businesses ($10M–$500M) cannot justify this cost. They either do without the integration or pay it reluctantly and receive poor value.

### The ROI Blind Spot (Third Problem)

41% of loyalty program operators cannot quantify their program's ROI. Budget renewals rely on anecdote, not data. Without a clear ROI metric, loyalty programs are the first cut when budgets tighten.

---

## User Experience

### Phase 0 — Monorepo Scaffold (Internal, No User-Facing Features)

Before any user-facing work, the repository infrastructure must be established:

**R0.1** — The monorepo SHALL use Turborepo + pnpm workspaces with the following apps: `apps/web` (Next.js 15), `apps/api` (Fastify v5), `apps/worker` (BullMQ).
**R0.2** — The monorepo SHALL include the following packages: `packages/ui`, `packages/database`, `packages/shared`, `packages/config`.
**R0.3** — `packages/config/src/test-utils/` SHALL contain all shared mocks, factories, and test fixtures before any feature tests are written.
**R0.4** — `docker-compose.yml` SHALL provide local PostgreSQL 16 and Redis 7 instances.
**R0.5** — The CI pipeline SHALL run `pnpm build && pnpm typecheck && pnpm lint && pnpm test` on every push and block merges on failure.
**R0.6** — Clerk auth SHALL be integrated into `apps/web` middleware and `apps/api` JWT verification before any authenticated endpoint is built.
**R0.7** — Prisma middleware SHALL enforce `brandId` scoping on every query against tenant-scoped entities before any multi-tenant data is written.

**Gate**: All scaffold CI checks green before proceeding to feature issues.

---

### Issue #2 — Configure Loyalty Program

**Actor**: Admin
**Start**: Admin navigates to `/admin/programs/new`

**User Journey**:
1. Admin opens the program creation wizard.
2. Admin enters program name, description, and point currency name (e.g., "Stars").
3. Admin sets the point-to-currency ratio (e.g., $1 spent = 10 Stars).
4. Admin defines at least one earning rule (purchase event → point multiplier).
5. Admin sets the program status to `draft` and previews the configuration.
6. Admin activates the program (`status: active`).

**Mock**: [Admin Program Setup Wizard](mocks/23-admin-program-setup.html)

**Requirements** (R2.x):

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| R2.1 | Admin SHALL create a loyalty program with: name, description, pointCurrencyName, pointToCurrencyRatio | Given a valid POST /v1/programs request, When processed, Then a Program record is created with status=draft and brandId from JWT |
| R2.2 | Admin SHALL set program status: draft / active / paused | Given a PATCH /v1/programs/:id request with status, When processed, Then the program status transitions are valid (draft→active, active→paused, paused→active) |
| R2.3 | Admin SHALL define at least one earning rule | Given a program creation form, When no rules are defined and admin attempts to activate, Then activation is blocked with a validation error |
| R2.4 | Program config SHALL be scoped to admin's brandId | Given two brands with separate JWT tokens, When each queries GET /v1/programs, Then each sees only their own programs |
| R2.5 | API SHALL expose POST /v1/programs, GET /v1/programs/:id, PATCH /v1/programs/:id | Given valid auth, When requests are made, Then responses conform to the OpenAPI spec |

**Edge Cases**:
- Attempting to activate a program with zero earning rules → 422 with message "At least one earning rule is required."
- `brandId` included in request body → 400, field is ignored and sourced from JWT only.
- Duplicate program name within same brand → allowed (no uniqueness constraint on program names).

**Open Questions**: None.

---

### Issue #3 — Member Enrollment

**Actor**: Loyalty Member
**Start**: Member navigates to the brand's loyalty enrollment page

**User Journey**:
1. Member visits the enrollment page for a brand's loyalty program.
2. Member submits their email (and optional profile fields: first name, last name, phone).
3. System creates a Member record: `pointsBalance: 0`, `status: active`, `consentGivenAt: now()`.
4. System sends a confirmation email (mocked in test environment).
5. Member is redirected to their loyalty dashboard with a welcome message.

**If member is already enrolled**: The API returns the existing member record (idempotent).

**Mock**: [Member Portal — Enrollment + Dashboard](mocks/23-member-portal.html)

**Requirements** (R3.x):

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| R3.1 | Member SHALL enroll via POST /v1/members/enroll with email as required field | Given a POST request with a valid email, When processed, Then a Member record is created or the existing record is returned |
| R3.2 | Duplicate enrollment SHALL be idempotent | Given a member who already exists, When POST /v1/members/enroll is called with the same email, Then 200 is returned with the existing member (no duplicate record created) |
| R3.3 | Member record SHALL be created with pointsBalance=0, status=active, consentGivenAt timestamp | Given successful enrollment, When the record is fetched, Then these fields are set correctly |
| R3.4 | Confirmation email SHALL be sent on enrollment | Given a test environment, When enrollment succeeds, Then the email mock is called once with the member's email and points balance |
| R3.5 | API SHALL expose POST /v1/members/enroll and GET /v1/members/:id | Given valid auth, When requests are made, Then responses conform to the OpenAPI spec |

**Edge Cases**:
- Invalid email format → 400 with validation message.
- Missing consentGivenAt → enrollment rejected; consent is required (GDPR/CCPA).
- PII fields (email, name, phone) stored as UTF-8 with length validation (email ≤ 254 chars).

---

### Issue #4 — Earn Points (Rules Engine)

**Actor**: Loyalty Member / System
**Trigger**: External system posts a loyalty event

**User Journey** (System Flow):
1. An external system (POS, e-commerce platform, CRM webhook) posts a loyalty event: `POST /v1/events`.
2. The API checks the `idempotencyKey` in Redis (24hr TTL). If duplicate → return original result immediately.
3. The event is enqueued in BullMQ.
4. The rules engine worker picks up the job, evaluates the event against all active earning rules for the member's program.
5. Worker writes `LoyaltyEvent` record + updates `Member.pointsBalance` in a single PostgreSQL transaction.
6. Member's balance is queryable immediately: `GET /v1/members/:id/balance`.

**Requirements** (R4.x):

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| R4.1 | POST /v1/events SHALL accept: type, memberId, payload (JSON), idempotencyKey | Given a valid request, When processed, Then the event is enqueued |
| R4.2 | Idempotency key SHALL be stored in Redis with 24hr TTL; duplicate submissions SHALL return the original result with no double points | Given an event already processed, When the same idempotencyKey is submitted, Then 200 is returned with the original result and pointsBalance is unchanged |
| R4.3 | Rules engine SHALL evaluate the event against all active earning rules and calculate points | Given a program with rule "$1 = 10 points" and an event with payload.amount=25, When processed, Then 250 points are awarded |
| R4.4 | Points award SHALL be processed asynchronously via BullMQ worker | Given POST /v1/events, When the API responds 202 Accepted, Then the job is observable in the BullMQ queue |
| R4.5 | Worker SHALL write LoyaltyEvent record and update Member.pointsBalance in a single transaction | Given a worker processing a points award, When the transaction is committed, Then both records are consistent; if the transaction fails, neither is updated |
| R4.6 | GET /v1/members/:id/balance SHALL return current pointsBalance and recent LoyaltyEvents | Given a member with events, When balance is queried, Then the balance matches the sum of LoyaltyEvent.pointsEarned |

**Edge Cases**:
- `memberId` not found → 404 returned from rules engine, job moved to dead-letter queue.
- Member `consentGivenAt` is null → event is rejected (do not process PII-linked loyalty data without consent).
- No matching rules for event type → event recorded with `pointsEarned: 0`, no error.
- BullMQ worker crash mid-transaction → PostgreSQL rolls back; job retried with exponential backoff (max 3 retries).

---

### Issue #5 — Redeem Reward

**Actor**: Loyalty Member
**Start**: Member browses the rewards catalog

**User Journey**:
1. Member navigates to the rewards catalog: `GET /v1/rewards`.
2. Member views available rewards with pointsCost, description, and stock status.
3. Member selects a reward and confirms redemption: `POST /v1/redemptions`.
4. System verifies member has sufficient points.
5. System atomically deducts `pointsCost` from `Member.pointsBalance` and creates a `Redemption` record.
6. Member receives redemption confirmation.

**Requirements** (R5.x):

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| R5.1 | Admin SHALL create rewards via POST /v1/rewards with: name, description, pointsCost, stock (or unlimited) | Given a valid admin request, When processed, Then a Reward record is created |
| R5.2 | Member SHALL browse rewards via GET /v1/rewards | Given an authenticated member, When GET /v1/rewards is called, Then only available (isAvailable=true, stock>0 or unlimited) rewards are returned |
| R5.3 | Member SHALL redeem a reward via POST /v1/redemptions | Given a member with sufficient points, When redemption is requested, Then points are deducted and a Redemption record is created |
| R5.4 | Redemption SHALL fail with 422 if member has insufficient points | Given a member with 100 points attempting to redeem a 500-point reward, When POST /v1/redemptions is called, Then 422 is returned with message "Insufficient points balance" |
| R5.5 | Points deduction and Redemption record SHALL be written atomically in a single transaction | Given a redemption in progress, When the transaction commits, Then pointsBalance and Redemption record are consistent; if the transaction fails, neither is updated |

**Edge Cases**:
- Reward out of stock → 422 "Reward is no longer available."
- Concurrent redemption attempts for same limited-stock reward → row-level locking prevents double-issue.
- Redemption of a reward from a different brand's catalog → 403.

---

### Issue #6 — Real-Time CX-to-Loyalty Campaign ⭐ (Hero Feature)

**Actor**: Marketing Manager / System
**SLA Target**: CX event → loyalty action within **15 minutes**

**User Journey**:
1. Marketing Manager navigates to Campaigns → Create New Campaign.
2. Manager defines the campaign:
   - **Trigger condition**: e.g., `cx.nps_score < 7` (detractor) or `cx.ticket_resolved = true`
   - **Loyalty action**: award 500 bonus points + send personalized message
   - **Budget cap**: max $5,000 total value
   - **Date range**: start/end dates
3. Manager saves and activates the campaign.
4. When `POST /v1/events` receives a matching CX event:
   a. API evaluates active campaigns against the event.
   b. Matching campaign job enqueued in BullMQ (high priority queue).
   c. Worker executes the campaign action (award points, queue notification).
   d. Redis dedup key set for `{memberId}:{campaignId}` — prevents duplicate triggers.
5. End-to-end latency from event ingestion to action execution is measured and asserted in integration tests.

**Mock**: [Campaign Builder](mocks/23-campaign-builder.html)

**Requirements** (R6.x):

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| R6.1 | Admin SHALL create a campaign with: trigger condition, loyalty action, budget cap, start/end dates | Given a valid POST /v1/campaigns, When processed, Then a Campaign record is created with status=draft |
| R6.2 | Campaign trigger SHALL evaluate against incoming CX events from POST /v1/events | Given an active campaign with trigger `cx.nps_score < 7`, When an event with payload.score=4 is received, Then a campaign job is enqueued |
| R6.3 | Campaign action SHALL execute within 15 minutes of event ingestion | Given an integration test with a real BullMQ worker, When a matching event is ingested, Then the action is executed and recorded within 900 seconds |
| R6.4 | Zero duplicate campaign triggers per member per campaign | Given a member who has already triggered a campaign, When the same member submits another matching event, Then no second trigger occurs (Redis dedup key exists) |
| R6.5 | Campaign SHALL support at minimum: NPS score trigger (cx.nps_score < N) and ticket resolved trigger (cx.ticket_resolved = true) | Given these two trigger types, When configured and tested with matching events, Then both execute the loyalty action correctly |
| R6.6 | API SHALL expose POST /v1/campaigns, GET /v1/campaigns/:id, PATCH /v1/campaigns/:id/status | Given valid admin auth, When requests are made, Then responses conform to the OpenAPI spec |

**Edge Cases**:
- Campaign budget cap reached → campaign automatically pauses; new matching events are logged but no action is taken.
- Event matches multiple campaigns → each evaluated independently; dedup keys per `{memberId}:{campaignId}`.
- Campaign with past end date → PATCH /v1/campaigns/:id/status to "active" returns 422.
- Member does not have consentGivenAt → campaign action skipped; event logged with reason "member consent not given."

---

### Issue #7 — Loyalty Analytics Dashboard

**Actor**: Analyst / Marketing Manager
**Start**: User navigates to `/admin/analytics`

**User Journey**:
1. User opens the analytics dashboard.
2. User selects a date range (last 7d / 30d / 90d / custom).
3. Dashboard displays:
   - Total members enrolled
   - Total points issued
   - Total points redeemed
   - Redemption rate (%)
   - Top rewards by redemption count
   - Program ROI: estimated revenue attributable to the loyalty program
   - Campaign performance: events triggered, actions executed, points awarded per campaign
4. User can drill down by campaign.

**Mock**: [Analytics Dashboard](mocks/23-analytics-dashboard.html)

**Requirements** (R7.x):

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| R7.1 | GET /v1/analytics/overview SHALL return: totalMembers, totalPointsIssued, totalPointsRedeemed, redemptionRate, topRewards | Given a date range query param, When called, Then metrics reflect data within that range |
| R7.2 | GET /v1/analytics/campaigns SHALL return per-campaign: eventsTriggered, actionsExecuted, pointsAwarded | Given campaigns with events, When called, Then per-campaign metrics are correct |
| R7.3 | Date range filter SHALL support: 7d, 30d, 90d, custom (startDate + endDate) | Given each filter option, When applied, Then only events within the range are counted |
| R7.4 | Program ROI metric SHALL be calculated as: (totalPointsRedeemed × pointToCurrencyRatio) / pointsIssuanceCost | Given known program config values, When ROI is queried, Then the calculation matches the formula |
| R7.5 | Analytics API SHALL respond in < 3 seconds for date ranges up to 90 days | Given a test dataset of 100K events, When the overview endpoint is called, Then p99 latency is < 3 seconds |

---

### Issue #8 — Demo Request Form (Parallel, No Dependencies)

**Actor**: Guest / Prospect
**Start**: Guest visits the marketing site and clicks "Request a Demo"

**User Journey**:
1. Guest navigates to `/request-demo`.
2. Form collects: first name, last name, work email, company name, company size (dropdown), message (optional).
3. Guest submits the form.
4. System stores the submission in the `DemoRequest` table.
5. System sends confirmation email to the prospect (mocked in test).
6. Admin can view demo requests at `GET /v1/admin/demo-requests`.

**Requirements** (R8.x):

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| R8.1 | Public form SHALL collect: firstName, lastName, workEmail (required), companyName (required), companySize, message (optional) | Given the rendered form, When submitted with missing required fields, Then submission is blocked with inline validation errors |
| R8.2 | Submission SHALL be stored in DemoRequest table | Given a valid submission, When POST /v1/public/demo-requests is called, Then a DemoRequest record is created |
| R8.3 | Confirmation email SHALL be sent to prospect | Given a valid submission, When processed, Then the email mock is called once with the prospect's email |
| R8.4 | Admin SHALL view all demo requests via GET /v1/admin/demo-requests | Given admin auth, When the endpoint is called, Then all submissions are returned in descending createdAt order |

---

### Issue #9 — CRM Integration (Salesforce + HubSpot)

**Actor**: IT / Developer
**Start**: Developer navigates to Admin → Integrations

**User Journey**:
1. Developer navigates to the Integrations section.
2. Developer views their brand's webhook URL: `POST /v1/integrations/webhooks/salesforce` or `.../hubspot`.
3. Developer copies the URL into Salesforce (outbound messaging) or HubSpot (webhook workflow action).
4. Salesforce NPS survey completion → webhook fires → normalized to `cx.nps_submitted` event → `POST /v1/events` internal flow.
5. HubSpot deal closed / ticket resolved → webhook fires → normalized to `cx.ticket_resolved` event → `POST /v1/events` internal flow.
6. Signature verification rejects unsigned requests (prevents webhook spoofing).

**Requirements** (R9.x):

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| R9.1 | POST /v1/integrations/webhooks/:provider SHALL accept payloads from Salesforce and HubSpot | Given a signed Salesforce payload, When the endpoint receives it, Then 200 is returned and an internal event is queued |
| R9.2 | Salesforce NPS survey completion SHALL be normalized to a cx.nps_submitted event | Given a Salesforce NPS webhook payload (test fixture in shared test-utils), When processed, Then a LoyaltyEvent with type=cx.nps_submitted and correct score is enqueued |
| R9.3 | HubSpot ticket resolved SHALL be normalized to a cx.ticket_resolved event | Given a HubSpot ticket webhook payload (test fixture), When processed, Then a LoyaltyEvent with type=cx.ticket_resolved is enqueued |
| R9.4 | Webhook signature verification SHALL reject unsigned requests | Given a POST request without a valid HMAC signature, When the endpoint receives it, Then 401 is returned |
| R9.5 | Admin SHALL see their webhook URL in the integration config UI | Given an authenticated admin, When navigating to /admin/integrations, Then the webhook URL for each provider is displayed and copyable |

**Edge Cases**:
- Unknown provider in the URL path → 404.
- Malformed JSON payload → 400 with parsing error message.
- Member not found in CustomerEQ for the CRM's contact ID → event logged with `memberId: null`; not enqueued for loyalty processing (no orphan events).

---

## Design Standards

**Source**: Generic UI baseline (project-specific design system not configured in `fraim/config.json`).

**Applied standards across all mocks**:
- **Colors**: Indigo/violet primary (`#6366f1`), neutral grays for surface and text
- **Typography**: Inter font family, 14px base, tight line-height for data-dense views
- **Components**: Cards with subtle shadows, pill badges for status, data tables with sticky headers
- **Layout**: Left nav sidebar (admin), centered single-column for member portal
- **Responsiveness**: Mocks target desktop (1280px+); mobile-responsive via media queries
- **Accessibility**: ARIA labels on interactive elements, focus rings on all focusable elements, color contrast > 4.5:1

Mocks are located in `docs/feature-specs/mocks/`:
- [`23-admin-program-setup.html`](mocks/23-admin-program-setup.html) — Program configuration wizard (Issues #2, #5)
- [`23-member-portal.html`](mocks/23-member-portal.html) — Member enrollment and dashboard (Issue #3)
- [`23-campaign-builder.html`](mocks/23-campaign-builder.html) — CX-to-Loyalty campaign builder (Issue #6 — Hero)
- [`23-analytics-dashboard.html`](mocks/23-analytics-dashboard.html) — Analytics and ROI dashboard (Issue #7)

---

## Compliance Requirements

*Compliance inferred from project context. No formal compliance regulations are configured in `fraim/config.json`. Applicable regulations identified from architecture document: GDPR and CCPA/CPRA.*

### GDPR / CCPA — Required from MVP Day One

| Control ID | Requirement | Implementation | Test |
|------------|-------------|----------------|------|
| C-01 | Consent SHALL be collected and recorded before any member PII is processed | `Member.consentGivenAt` timestamp set on enrollment; events rejected if null | Integration test: POST /v1/events for member with null consentGivenAt returns 422 |
| C-02 | Member PII (email, name, phone) SHALL use soft deletes; no hard-delete without an erasure request | `Member.deletedAt` soft-delete; hard erasure only via `DataSubjectErasureRequest` job | Integration test: DELETE /v1/members/:id sets deletedAt, PII still present |
| C-03 | Erasure request SHALL zero-out PII fields | Worker erasure job overwrites email, firstName, lastName, phone with hash value; sets `Member.erased: true` | Integration test: erasure job run → GET /v1/members/:id returns hashed PII |
| C-04 | Member data SHALL be exportable on request | `GET /v1/members/:id/export` returns all member data as JSON | Integration test: export endpoint returns all LoyaltyEvents, profile fields, and Redemptions |
| C-05 | `brandId` SHALL never be accepted from a request body | Fastify middleware enforces: if `brandId` present in body, request returns 400 | Unit test: middleware rejects any body containing brandId |

### SOC2 Type 2 — Controls to Build from Day One

| Control ID | Requirement | Implementation |
|------------|-------------|----------------|
| S-01 | All secrets SHALL be stored in Azure Key Vault, never in code or .env files | `apps/api` and `apps/worker` read secrets from Key Vault at startup via managed identity |
| S-02 | All admin actions SHALL be recorded in an AuditEvent log table | Fastify plugin writes AuditEvent record for every mutating admin request (POST, PATCH, DELETE) |
| S-03 | MFA SHALL be enforced for all admin accounts | Enforced via Clerk org-level MFA policy |
| S-04 | Dependency vulnerability scanning SHALL run in CI | `pnpm audit --audit-level=high` gate in GitHub Actions pipeline |

---

## Validation Plan

### How we know the full platform is working

**Critical path E2E test** (Playwright, `apps/web/test/e2e/critical-path.spec.ts`):
1. Admin creates a loyalty program with one earning rule.
2. Admin creates a CX-to-loyalty campaign (NPS < 7 → award 500 bonus points).
3. Member enrolls via the enrollment page.
4. `POST /v1/integrations/webhooks/salesforce` receives a mock NPS=4 payload.
5. Assert: member receives 500 bonus points within 60 seconds (integration test timeout; real SLA is 15 minutes).
6. Member browses the rewards catalog and redeems a reward.
7. Assert: member's points balance is correctly deducted.
8. Admin views the analytics dashboard.
9. Assert: redemption appears in metrics.

**Hero Feature SLA Integration Test** (`apps/worker/test/integration/campaign-latency.test.ts`):
- Ingest a matching CX event via `POST /v1/events`.
- Assert campaign action is executed within 900 seconds (15-minute wall-clock SLA).
- Record and log actual latency as a test metric.

**Compliance Validation**:
- `POST /v1/members/enroll` without consentGivenAt → 422.
- `DELETE /v1/members/:id` followed by PII check → PII soft-deleted, not removed.
- DataSubjectErasureRequest job → PII fields hashed, `erased: true`.

---

## Alternatives

| Alternative | Why Discarded |
|-------------|---------------|
| Build loyalty platform as a monolith (single Express app) | No separation of sync API from async event processing. Points awards would block HTTP requests. Cannot scale event processing independently. |
| Use Kafka instead of BullMQ for event queue | Operationally complex for an MVP. BullMQ on Redis provides identical deduplication and retry semantics with zero additional infrastructure. Revisit at 10M+ events/day. |
| Use MongoDB instead of PostgreSQL | Loyalty is a financial ledger requiring ACID transactions. Multi-document transactions in MongoDB are slower and more constrained. PostgreSQL is the correct database for this domain. |
| Integrate directly with Salesforce API (polling) | Polling introduces lag. Webhooks from Salesforce push events in real-time (< 1 minute), which is necessary to achieve the 15-minute end-to-end SLA. |
| Build feature parity with Annex Cloud (20 issues) before shipping | 70% probability critical risk identified in business validation report. Delays market entry, dilutes value proposition. The 7-issue MVP is the minimum viable differentiation. |
| Use Auth0 instead of Clerk | Clerk is first-party Next.js 15 with native multi-tenant org support mapping directly to `brandId`. Auth0 achieves the same result with more configuration overhead. |

---

## Competitive Analysis

### Critical Research Finding — The Integration Direction Gap

All four primary competitors integrate their loyalty platform **with** CRM and email tools, but in one direction only: **loyalty → CRM** (pushing loyalty events into Salesforce/HubSpot/Klaviyo for email personalization). None implement the reverse: **CX → loyalty** (responding to CX feedback with automatic loyalty actions).

Specifically confirmed by web research (March 2026):
- **Yotpo** sends loyalty events to HubSpot "in near real-time" for email automation — but HubSpot NPS data does not flow back to trigger loyalty rewards. ([Yotpo HubSpot Integration](https://www.yotpo.com/integrations/hubspot/))
- **Smile.io** integrates with HubSpot and Klaviyo for email segmentation; no NPS or support ticket triggers documented. ([Smile.io Integrations](https://smile.io/integrations))
- **LoyaltyLion** + Klaviyo: loyalty tier changes trigger automated email flows — again loyalty → email, not CX → loyalty. ([LoyaltyLion Klaviyo](https://www.capterra.com/customer-loyalty-software/compare/140592-169446/LoyaltyLion-vs-Smile-io))
- **Annex Cloud**: Listed on Salesforce AppExchange; 125+ integrations; no documented CX-event-to-loyalty-action automation. Pricing is custom/not publicly disclosed. ([Annex Cloud AppExchange](https://appexchange.salesforce.com/appxListingDetail?listingId=a0N3A00000FtUpXUAV))

The NPS → loyalty automation gap is real and unaddressed by any current platform. The closest adjacent products (LoyaltyLoop, nps.today) are NPS collection tools that can generate alerts/tickets, but do not operate a loyalty engine.

---

### Primary Competitors

| Competitor | Integration Direction | CX → Loyalty Auto-Trigger? | Target Market | Pricing Model | CustomerEQ Advantage |
|------------|----------------------|---------------------------|---------------|---------------|---------------------|
| **Annex Cloud** | Loyalty → SAP CX, 125+ connectors | ✗ Not documented | Enterprise (30+ day impl.) | Custom quote (not public) | Self-serve setup; transparent pricing; real-time CX trigger |
| **Yotpo Loyalty** | Loyalty → HubSpot/Salesforce MC/Klaviyo for email | ✗ One-way only (loyalty events out) | DTC / e-commerce (Shopify-first) | Tiered, starts ~$199/mo | B2B / Salesforce CRM native; CX events IN |
| **Smile.io** | Loyalty → HubSpot/Klaviyo/MailChimp for email | ✗ None | SMB e-commerce | ~$49–$999/mo | CRM webhook ingestion; ROI dashboard |
| **LoyaltyLion** | Loyalty → Klaviyo/email for triggered flows | ✗ None (AI suggests campaigns but no CX source) | E-commerce (Shopify/Magento) | ~$399–$729/mo | CX event as first-class trigger source |

### Competitive Positioning Strategy

#### Our Differentiation
- **Key Advantage 1**: **Real-time CX-to-loyalty automation** — no competitor connects CX feedback (NPS, support tickets) to loyalty actions automatically. All competitors push loyalty data *into* CRM; none pull CX data *out* of CRM to act on it. We close the 82-hour gap to 15 minutes.
- **Key Advantage 2**: **Zero integration tax** — native Salesforce and HubSpot webhooks with HMAC verification, no $75K/yr professional services contract. Admin copies a URL; integration is live.
- **Key Advantage 3**: **ROI transparency** — built-in program ROI metric (`points redeemed × ratio / issuance cost`) surfaces the CFO conversation that 41% of loyalty operators currently cannot have.

#### Competitive Response Strategy
- **If Annex Cloud adds a CX trigger feature**: CustomerEQ responds with deeper NLP sentiment analysis on ticket text (OpenAI integration) and faster SLA targets (< 5 minutes). Annex Cloud's batch-oriented SAP CX architecture is structurally disadvantaged for sub-15-minute latency.
- **If Yotpo reverses integration direction (HubSpot NPS → loyalty)**: CustomerEQ expands CRM connectors to Zendesk, Intercom, and Gainsight — covering the full CX platform landscape beyond CRM.
- **If Smile.io or LoyaltyLion adds basic webhooks**: Compete on B2B/mid-market positioning (their ICP is SMB e-commerce), analytics depth, and multi-tenant enterprise features.

#### Market Positioning
- **Target Segment**: Mid-market B2B companies ($10M–$500M revenue) using Salesforce or HubSpot as their CX system of record.
- **Value Proposition**: "Turn every bad customer experience into a loyalty moment — automatically, in 15 minutes."
- **Pricing Strategy**: Transparent SaaS pricing (per-tenant + event volume tiers) published on marketing site. This alone differentiates from Annex Cloud's "request a quote" opacity, which signals enterprise complexity that mid-market buyers avoid.

### Research Sources
- Yotpo HubSpot integration docs: https://www.yotpo.com/integrations/hubspot/ (March 2026)
- Yotpo Salesforce Marketing Cloud: https://www.yotpo.com/integrations/salesforce-marketing-cloud/ (March 2026)
- Smile.io integrations page: https://smile.io/integrations (March 2026)
- LoyaltyLion vs Smile.io comparison: https://www.capterra.com/customer-loyalty-software/compare/140592-169446/LoyaltyLion-vs-Smile-io (March 2026)
- Annex Cloud Salesforce AppExchange: https://appexchange.salesforce.com/appxListingDetail?listingId=a0N3A00000FtUpXUAV (March 2026)
- Annex Cloud pricing (custom, not public): https://www.capterra.com/p/164609/Customer-Loyalty-Cloud/pricing/ (March 2026)
- Business validation report: `docs/business-development/business-validation-report-cx-loyalty-platform-2026-03-24.md`
- Replication analysis: `docs/replicate/reports/REPLICATION_ANALYSIS.md`
- Industry data: Medallia CX report (82-hour average response time); Loyalty360 ROI survey (41% cannot measure ROI)
- Research date: 2026-03-24
