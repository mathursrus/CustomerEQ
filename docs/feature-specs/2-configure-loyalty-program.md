# Feature: Configure Loyalty Program

Issue: #2
Owner: manohar.madhira@outlook.com
Use Case: UC-09
Priority: P0 — MVP Blocking
Milestone: Phase 1: Core MVP

---

## Customer

**Admin / Program Owner** — the brand employee responsible for launching and managing the company's loyalty initiative on CustomerEQ. Typically a loyalty or marketing operations manager with moderate technical familiarity. They understand their business rules but should not need engineering support to configure a program.

---

## Customer's Desired Outcome

A fully configured, previewed, and activated loyalty program that members can immediately start earning points in — set up in under 30 minutes without needing a developer or professional services engagement.

---

## Customer Problem Being Solved

Today, loyalty program configuration is a fragmented, high-friction process. Annex Cloud and comparable platforms require:

1. Professional services engagements (weeks, $$$)
2. Separate tools for rules, tiers, and rewards — no unified wizard
3. No preview mode — admins discover mistakes after launch
4. No budget guardrails — programs overspend before anyone notices

The admin cannot get from "idea" to "running program" in a single session. This is the foundational blocker: no other loyalty feature (earn points, redeem rewards, campaigns) can work without a configured program.

---

## User Experience That Will Solve the Problem

The admin completes a **7-step guided configuration wizard** from the CustomerEQ dashboard. Each step is independently saveable (draft state), so the admin can return and continue. No step requires developer intervention.

### Workflow

**Entry point**: Admin Dashboard → "Programs" landing page → "Create New Program"

**Programs Landing Page** *(new — shown when admin clicks "Programs" in the sidebar)*
- Lists all existing programs in a table: name, type, status badge (Active / Paused / Draft), date range, member count, budget consumption bar
- Primary CTA: **"+ Create New Program"** (top-right) — launches the wizard
- Per-row actions: **"Edit"** (re-opens wizard pre-populated), **"Pause"** / **"Reactivate"** / **"Continue Setup"** depending on status
- Provides the overview context admins need before creating or editing a program

**Step 1 — Program Type**
- Admin selects one of four program types: **Points**, **Tiered**, **Cashback**, **Hybrid**
- Each type shows a brief description and example use case
- Selection determines which subsequent steps are shown (e.g., Tiered shows tier config; Cashback hides point multipliers)

**Step 2 — Basic Info**
- Program name (e.g., "Summer Rewards 2026")
- Description (visible to members)
- Start date / End date (or "Ongoing")
- **Currency symbol** — dropdown with preset options: Stars, Points, Coins, Miles, Credits, Sparks, Cash Back, plus "Other (custom)…" which reveals a free-text field for any custom name

**Steps 3–7 — Program Context Bar** *(persistent reference strip shown on all steps after Basic Info)*
- A slim bar at the top of each step (3 through 7) displays the program name and date range entered in Step 2
- Updates live as the admin edits Step 2 fields; includes an inline "Edit" link to jump back to Step 2
- Particularly useful during editing: admin always knows which program they are configuring without navigating away

**Step 3 — Earning Rules**
- Admin adds one or more earning rules
- Each rule has:
  - **Trigger**: purchase, review, referral, social share, survey completion, enrollment
  - **Condition(s)**: AND/OR logic builder — e.g., `product_category = "Electronics" AND channel = "web"`
  - **Action**: award X points, or X× multiplier on base points
  - **Time window**: always active, or specific date range
  - **Budget cap**: max points this rule can award (optional)
  - **Priority**: integer (lower = evaluated first when rules conflict)
- Admin can add multiple rules; they are evaluated in priority order
- Simple "earn 1 point per $1 spent" default pre-filled for first-time admins

**Step 4 — Tier Configuration** *(shown for Tiered and Hybrid programs only)*
- Admin defines 2–5 tiers (e.g., Bronze, Silver, Gold, Platinum)
- Each tier has:
  - Name and icon/color
  - **Entry criteria**: minimum points balance, or minimum spend, or both
  - **Benefits**: list of freeform benefit descriptions (e.g., "Free shipping", "10% discount")
  - **Points multiplier**: e.g., Gold tier earns 1.5× points on all purchases
- Tiers displayed in a visual ladder showing progression

**Step 5 — Rewards Catalog**
- Admin adds redeemable rewards to the catalog
- Each reward has:
  - Name and description
  - Type: discount code, free product, cashback, gift card, experience
  - **Points cost**: how many points to redeem
  - **Stock**: unlimited or limited quantity
  - **Availability**: always, or specific date range
  - **Eligible tiers**: all members, or Gold+ only, etc.

**Step 6 — Budget & Spend Controls**
- **Total program budget** (USD): hard cap on total points value issued
- **Monthly budget limit**: optional rolling cap
- **Alert threshold**: notify admin at 80% of budget consumed
- **Halt behavior on cap**: pause program or pause only new rule evaluations

**Step 7 — Preview & Activate**
- Admin sees a **simulated member view**: what a member would see after enrolling, their point balance, available rewards, and tier status
- Admin can click "Simulate Action" — enter a hypothetical purchase amount + category to see which rules fire and how many points are awarded
- Admin sees a summary checklist confirming all required fields are filled
- Two CTAs: **"Save as Draft"** and **"Activate Program"**
- Activation requires confirmation modal (program name re-entry for safety)

### UI Mocks

- [Step-by-step wizard mock → `docs/feature-specs/mocks/2-view.html`](mocks/2-view.html)

### Design Standards

Mocks use the **generic UI baseline**: Tailwind-equivalent utility classes, shadcn/ui component patterns (cards, buttons, badges, form inputs, steppers), neutral color palette. Consistent with `packages/ui` conventions established in `docs/architecture/architecture.md`.

---

## Scope Boundaries

### Out of Scope (MVP): Indirect-Channel Loyalty

This spec covers brands that **own the transaction pipeline** — i.e., brands with a direct ecommerce channel (Shopify, custom storefront) where purchase and review events can be delivered to CustomerEQ via webhook or CRM integration.

**Not covered in this spec:** Manufacturers that sell *only* through third-party online retailers (Amazon, Costco Direct, Walmart.com, etc.). This scenario requires a different event ingestion mechanism because:

- Third-party retailers do not push purchase webhooks to the brand
- Customer identity is unknown at time of purchase (the retailer owns the transaction)
- Reviews on external retail platforms cannot be directly subscribed to

The practical solutions — **receipt scanning** (customer submits receipt post-purchase) and **product registration** (customer registers product with serial number) — are Phase 2 features tracked in **Issue #24**.

> **Partial workaround (MVP):** If a brand's Amazon order data flows into Salesforce or HubSpot, Issue #9 (CRM Integration) can serve as an event ingestion path into CustomerEQ today. The rules engine processes those events identically — no changes to this spec required.

The rules engine architecture in this spec is **source-agnostic by design**. When receipt scanning ships (Phase 2), it will emit standard `purchase` events that flow through the same rules configured here.

---

## Compliance Requirements

**Source**: Inferred from project context (GDPR/CCPA obligations in `fraim/personalized-employee/rules/project_rules.md`, Rule 13).

No explicit compliance framework is configured in `fraim/config.json`, but the following controls are required by the project's always-on rules:

| Requirement | Control | File / Mechanism |
|-------------|---------|------------------|
| **R1** — Program config is tenant-scoped | `brandId` on `Program`, `Rule`, `Tier`, `Reward` entities; sourced from JWT only, never from request body | `apps/api` auth middleware + Prisma middleware |
| **R2** — No hard deletes on Program config | Soft-delete pattern (`deletedAt` timestamp) on all program entities | Prisma schema + middleware |
| **R3** — Points earn/burn transactions are atomic | Any rule evaluation that awards points uses a PostgreSQL transaction writing both `LoyaltyEvent` and updating `pointsBalance` | `apps/worker` BullMQ worker |
| **R4** — Audit trail for program changes | Every `PUT /programs/:id` write logs a change event (actor, timestamp, diff) | `apps/api` route hooks |
| **R5** — Member consent before earning | Rule evaluation must check `Member.consentGivenAt !== null` before awarding points | Rules engine worker |

**Compliance Validation**: See Validation Plan below.

---

## Validation Plan

### Functional Validation (Browser)

1. Navigate to Admin Dashboard → Programs → Create New Program
2. Complete wizard for a **Points** program — verify all 7 steps are reachable, saveable, and resumable
3. Complete wizard for a **Tiered** program — verify Step 4 (Tiers) appears and Step 3 tier multiplier fields activate
4. Add 3 earning rules with AND/OR conditions — verify condition logic builder renders correctly
5. Simulate purchase in Preview mode — verify correct rule fires and correct point total is shown
6. Activate program — verify confirmation modal, then verify program appears in Programs list with "Active" status
7. Pause program — verify status changes to "Paused" and no new rules evaluate
8. Reactivate program — verify status returns to "Active" and prior configuration is intact (no data loss)

### API Validation

```
POST /programs        → 201 with programId
PUT  /programs/:id    → 200, returns updated program
POST /programs/:id/rules  → 201 with ruleId
POST /programs/:id/tiers  → 201 with tierId
PUT  /programs/:id/status → 200 with new status
GET  /programs/:id    → 200 with full program + rules + tiers + rewards
```

- All endpoints reject requests with missing/invalid `Authorization` header (401)
- All endpoints reject non-admin roles (403)
- Cross-tenant: `brandId` from JWT must match program's `brandId` (403 otherwise)

### Compliance Validation

- **R1**: Create program via API without `brandId` in body — confirm `brandId` is still set correctly from JWT
- **R2**: Delete a program — confirm record has `deletedAt` set, not removed from DB
- **R3**: Trigger a rule evaluation — confirm both `LoyaltyEvent` record and `pointsBalance` update occur in same transaction
- **R4**: Update program name — confirm audit log entry with actor + timestamp + diff
- **R5**: Create member without consent, trigger earn action — confirm points NOT awarded

### Acceptance Criteria (from Issue)

- [x] R-01: Admin can create a new program in < 30 minutes via wizard
- [x] R-02: Program types supported: Points, Tiered, Cashback, Hybrid
- [x] R-03: Rules engine supports AND/OR condition logic with multiple attributes
- [x] R-04: Point multipliers configurable by product category, channel, time period
- [x] R-05: Tier names, criteria, and benefits fully customizable
- [x] R-06: Budget cap enforced — rules halt when budget reached
- [x] R-07: Preview mode shows simulated member experience before activation
- [x] R-08: Program can be paused and reactivated without data loss

---

## Alternatives

| Alternative | Why Discard? |
|-------------|--------------|
| **Free-form program config form** (no wizard) | Overwhelming for first-time admins. No guided validation between steps. Increases support burden. The <30-minute setup SLA is not achievable without a guided flow. |
| **Template-based setup** (choose a pre-built template, customize) | Constrains program flexibility. Mid-market brands need custom earn triggers and tier names. Templates become a crutch that prevents full configurability. Annex Cloud offers templates AND full config — we need full config as the baseline. |
| **API-only configuration** (no UI) | Requires developer for every program setup. Blocks the target Admin persona entirely. Violates the core value proposition of no-professional-services onboarding. |
| **Build rules engine as a separate admin panel** | Splits the configuration journey across two screens. Admin cannot see how rules, tiers, and rewards interact until they navigate between panels. Unified wizard maintains the full mental model in one flow. |

---

## Competitive Analysis

### Configured Competitors Analysis

*(No competitors are currently configured in `fraim/config.json`. See note at bottom — Antavo discovered during research; propose adding all five below to config.)*

### Additional Competitors Analysis

| Competitor | Current Solution | Strengths | Weaknesses | Customer Feedback | Market Position |
|------------|-----------------|-----------|------------|-------------------|-----------------|
| **Annex Cloud** | Separate portals for rules, tiers, rewards catalog. Requires dedicated PS implementation team, discovery workshops, IT engagement. Annual contract model. [Source](https://www.annexcloud.com/implementation-process/) | Most feature-complete enterprise platform. Handles billions of data records. Dedicated account management. | No wizard — fragmented config across multiple admin portals. PS dependency adds weeks and thousands of dollars. No self-serve option. No real-time CX integration. No preview mode. | Reviews cite multi-week to multi-month onboarding. Requires IT involvement for basic rule changes. | Enterprise, $50K+/yr, PS-required |
| **Yotpo Loyalty** | Dashboard-based setup with 15+ pre-configured earning campaign types. Separate settings sections for rules, tiers (VIP), and rewards. No AND/OR condition builder. [Source](https://support.yotpo.com/docs/loyalty-referrals-account-setup-checklist) | 15+ earning action types out of the box. Strong integrations (reviews, SMS, subscriptions). Good for Shopify Plus. Plans from $199/mo. | Rules are per-action toggles, not composable conditions. No AND/OR logic builder. No budget guardrails. Setup takes 2–4 weeks for complete config. No preview/simulation mode. | "Takes more time — more steps, more menus, more options." "Fits stores that have time to configure in detail." [Source](https://wiserreview.com/blog/smile-io-vs-yotpo/) | SMB/mid-market, Shopify-first, $199+/mo |
| **Smile.io** | Simple wizard: choose earning actions (purchases, referrals, birthdays), set point values, configure VIP tiers by spend milestones. VIP tier earning rules limit by tier membership. [Source](https://help.smile.io/en/articles/4036325-configure-vip-tier-earning-rules) | Fastest launch on the market — basic program live in minutes. Free plan available. $49+/mo. Clean, beginner-friendly UX. | No composable AND/OR condition logic. No Cashback or Hybrid program types. No budget controls. No preview/simulation mode. Custom rules not supported. | "Easier to start — steps are clear, layout is clean." "Great for simple programs; doesn't scale." [Source](https://wiserreview.com/blog/smile-io-vs-yotpo/) | SMB, Shopify/BigCommerce, $49+/mo |
| **LoyaltyLion** | Guided initial setup (choose design, activities, rewards). Standard rules turn on by default. Advanced custom rules require API integration with developer involvement. [Source](https://loyaltylion.com/resources/getting-started) | Good mid-market balance. Conditional earning rules (double points on specific products, exclusion rules). $159+/mo. | "Up and running in 30 days" — requires their team involvement. Custom rules require developer API work. No preview/simulation mode. No real-time CX event processing. | "30-day target" for full setup. Advanced personalization requires dev resources. [Source](https://loyaltylion.com/resources/getting-started) | Mid-market, $159+/mo, 30-day onboarding |
| **Antavo** *(newly discovered)* | Enterprise AI Loyalty Cloud with drag-and-drop Workflows module. Visual campaign builder with event triggers, filters, and gamified interactions. Management UI for tiers, campaigns, promotions. [Source](https://antavo.com/product/loyalty-engine/features/workflows/) | Most advanced rules engine among competitors — full visual workflow builder. AI-powered recommendations. Backdated event processing. Enterprise-grade. | Enterprise-only pricing and complexity. Significant implementation timeline. No self-serve setup for mid-market. No real-time CX-to-loyalty automation. | Gartner Peer Insights reviews highlight implementation complexity. [Source](https://www.gartner.com/reviews/market/loyalty-program-vendors/vendor/antavo/product/antavo-ai-loyalty-cloud) | Enterprise, complex onboarding, PS-required |

> **⚠️ Config Update Proposed**: Antavo was discovered during this research phase and is not yet in `fraim/config.json`. Proposed addition: `"competitors": ["Annex Cloud", "Yotpo", "Smile.io", "LoyaltyLion", "Antavo"]`.

### Competitive Positioning Strategy

#### Our Differentiation

- **Key Advantage 1 — Speed to Launch**: <30-minute self-serve setup (no PS, no dev required) vs. 2–6+ weeks for Annex Cloud/Antavo, 30 days for LoyaltyLion, 2–4 weeks for Yotpo. Only Smile.io is faster — but Smile.io cannot support the complex rules CustomerEQ's mid-market ICP requires.
- **Key Advantage 2 — Preview / Simulation Mode**: No competitor (Annex Cloud, Yotpo, Smile.io, LoyaltyLion, Antavo) offers a live simulation of the member experience with rule-fire visualization before activation. Admins catch misconfigured rules before they overspend budget.
- **Key Advantage 3 — Real-Time CX Foundation**: Program rules configured here feed directly into Issue #6 (Real-Time CX-to-Loyalty Campaign) — the same BullMQ worker that processes purchase events also processes CX signals (NPS scores, support tickets) within 15 minutes. No competitor connects program configuration to real-time CX signals at all.
- **Key Advantage 4 — AND/OR Condition Builder**: Smile.io has no condition logic. Yotpo has per-action toggles only. LoyaltyLion requires dev API work for complex conditions. Antavo has a visual builder but at enterprise price/complexity. CustomerEQ delivers composable AND/OR conditions in a self-serve wizard at mid-market pricing.

#### Competitive Response Strategy

- **If Annex Cloud adds a wizard**: Our speed advantage holds because we are self-serve by design (no PS). Also, they still lack real-time CX integration.
- **If Yotpo adds AND/OR logic**: Our budget controls + preview mode remain differentiators. Plus our mid-market pricing is more accessible than Yotpo's enterprise tiers.

#### Market Positioning

- **Target Segment**: Mid-market brands ($10M–$500M revenue) who outgrew Smile.io but can't afford Annex Cloud's PS model
- **Value Proposition**: Enterprise-grade rules engine + self-serve wizard + real-time CX integration — at a fraction of the PS cost
- **Pricing Strategy**: Usage-based SaaS (per active member or per event processed), not seat-based — aligns cost to program success

### Research Sources

- Annex Cloud capabilities: `docs/replicate/reports/REPLICATION_ANALYSIS.md` + [annexcloud.com/implementation-process](https://www.annexcloud.com/implementation-process/) (2026-03-24)
- Yotpo: [support.yotpo.com/docs/loyalty-referrals-account-setup-checklist](https://support.yotpo.com/docs/loyalty-referrals-account-setup-checklist) (2026-03-24)
- Smile.io: [help.smile.io/en/articles/4036325-configure-vip-tier-earning-rules](https://help.smile.io/en/articles/4036325-configure-vip-tier-earning-rules) (2026-03-24)
- LoyaltyLion: [loyaltylion.com/resources/getting-started](https://loyaltylion.com/resources/getting-started) (2026-03-24)
- Antavo: [antavo.com/product/loyalty-engine/features/workflows/](https://antavo.com/product/loyalty-engine/features/workflows/) + [Gartner Peer Insights](https://www.gartner.com/reviews/market/loyalty-program-vendors/vendor/antavo/product/antavo-ai-loyalty-cloud) (2026-03-24)
- Market comparison: [wiserreview.com — Smile.io vs Yotpo](https://wiserreview.com/blog/smile-io-vs-yotpo/) + [yotpo.com/blog/yotpo-vs-loyaltylion-vs-smileio/](https://www.yotpo.com/blog/yotpo-vs-loyaltylion-vs-smileio/) (2026-03-24)
- Use case documentation: `docs/replicate/analysis/use-cases.md#uc-09`
- Business validation report: `docs/business-development/business-validation-report-cx-loyalty-platform-2026-03-24.md`

---

## Technical Requirements Summary

> *(For implementer reference — authoritative implementation details live in `docs/architecture/architecture.md` and the issue itself.)*

### Data Models

```typescript
// packages/shared/src/types/program.ts

Program {
  id: string (uuid)
  brandId: string          // from JWT, never from body
  name: string
  description: string
  type: 'points' | 'tiered' | 'cashback' | 'hybrid'
  status: 'draft' | 'active' | 'paused' | 'archived'
  currencySymbol: string   // "Points", "Stars", etc.
  startDate: Date | null
  endDate: Date | null
  budgetUsdCents: number | null
  monthlyBudgetUsdCents: number | null
  alertThresholdPct: number  // 0-100
  haltBehavior: 'pause_program' | 'pause_rules'
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null   // soft delete
}

Rule {
  id: string (uuid)
  programId: string
  brandId: string
  trigger: 'purchase' | 'review' | 'referral' | 'social_share' | 'survey' | 'enrollment'
  conditions: ConditionGroup   // AND/OR tree
  action: { type: 'award_points' | 'multiplier'; value: number }
  priority: number
  budgetCapPoints: number | null
  activeFrom: Date | null
  activeTo: Date | null
  deletedAt: Date | null
}

Tier {
  id: string (uuid)
  programId: string
  brandId: string
  rank: number             // 1 = lowest
  name: string
  color: string
  minPoints: number | null
  minSpendCents: number | null
  benefits: string[]
  multiplier: number       // 1.0 = no multiplier
  deletedAt: Date | null
}

Reward {
  id: string (uuid)
  programId: string
  brandId: string
  name: string
  description: string
  type: 'discount_code' | 'free_product' | 'cashback' | 'gift_card' | 'experience'
  pointsCost: number
  stockUnlimited: boolean
  stockRemaining: number | null
  availableFrom: Date | null
  availableTo: Date | null
  eligibleTierIds: string[]  // empty = all tiers
  deletedAt: Date | null
}
```

### Event-Driven Architecture Constraint

Program **configuration** writes are synchronous (wizard saves go directly to DB via Prisma). However, any **loyalty action** triggered by a rule evaluation (earn points, tier upgrade) must flow through BullMQ as per project Rule #5. The rules engine worker reads `Rule` and `Program` records from DB, not from in-memory state.

### API Endpoints (Fastify v5)

```
POST   /programs                     → Create program (draft)
GET    /programs                     → List programs for brand
GET    /programs/:id                 → Get program with rules/tiers/rewards
PUT    /programs/:id                 → Update program config
DELETE /programs/:id                 → Soft-delete program

POST   /programs/:id/rules           → Add rule
PUT    /programs/:id/rules/:ruleId   → Update rule
DELETE /programs/:id/rules/:ruleId   → Soft-delete rule

POST   /programs/:id/tiers           → Add tier
PUT    /programs/:id/tiers/:tierId   → Update tier
DELETE /programs/:id/tiers/:tierId   → Soft-delete tier

POST   /programs/:id/rewards         → Add reward
PUT    /programs/:id/rewards/:rwId   → Update reward
DELETE /programs/:id/rewards/:rwId   → Soft-delete reward

PUT    /programs/:id/status          → Activate / pause / archive

POST   /programs/:id/simulate        → Preview: simulate member action, return rule match + point calc
```

### Implementation Order (per Issue #2 guidance)

1. **Prisma schema** — `Program`, `Rule`, `Tier`, `Reward` models with `brandId`, soft deletes, indexes
2. **API layer** — Fastify routes with Zod validation, admin auth guard, tenant scoping middleware
3. **UI** — Next.js App Router admin section, wizard component, condition builder, preview panel
4. **Tests** — Unit (rules engine condition evaluator), Integration (API endpoints), E2E (full wizard flow via Playwright)
