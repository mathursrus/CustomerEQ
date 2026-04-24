# Feature: Onboarding & First-Run Experience

Issue: #170 (epic)
Owner: Claude (feature-specification job)

> This epic owns the **shared spine** of onboarding. Archetype-specific connect/verify steps are separately specified in child issues #171 (API/SDK path), #172 (static-site path), and #173 (multi-application path). This document defines what every archetype sees and what contracts the archetype flows plug into.

---

## Customer

**Primary user**: the **first admin** of a new CustomerEQ customer organization — the person who signed up for CustomerEQ and will be responsible for wiring it into their company's stack, running the first survey/campaign, and proving internal value.

They are typically:

- At a mid-market company ($10M–$500M revenue) with 3–8 people across combined CX + Loyalty teams (per the ICP in the business validation report).
- Technical enough to install a snippet or generate an API key, but not a full-time developer — may have dev support, may not.
- On a 6–12 month evaluation cycle with internal pressure to show a working prototype **fast**.
- Evaluating CustomerEQ against keeping their current fragmented stack (separate CX platform + separate loyalty platform) — the "integration tax" pain.

**Secondary users** (not in scope for this epic but must not be broken):

- **Members** — customers of the admin's brand. Their journey starts via survey links, widget embeds, or API-driven enrollment, all downstream of this onboarding.
- **Invited team members** — colleagues the first admin invites via Clerk org invitations. They inherit an already-provisioned brand and onboarding state; they do not re-run the first-run flow.

---

## Customer's Desired Outcome

From the moment the admin hits "Sign up" to seeing **a verified end-to-end loop — event ingested → CX signal captured → loyalty action triggered** — **without leaving CustomerEQ** and **in under 30 minutes**, with clear visibility at every step into what's next and what's been done.

Concretely, success looks like:

- Sign-up succeeds. A `Brand` record exists. The admin never sees "no brand found" or a manual-SQL setup step.
- The admin lands on a path-specific connect flow that matches how they actually run their business (own app, static site, multiple apps), not a generic "configure everything" wizard.
- The admin completes a test loop — a real event they sent is visible in CustomerEQ, and they can see a loyalty action fire in response — before any paid conversation happens.
- A persistent checklist shows them the next milestone any time they come back to `/admin`, so returning sessions don't require remembering where they left off.
- The admin's org can measure **Time to First Value (TTFV)** from sign-up to first verified action. Internal analytics captures this per-org so CustomerEQ learns where onboarding friction lives.

The hero workflow (Issue #6 — real-time CX-to-loyalty campaign) must remain reachable in **less than 30 minutes from sign-up**. Onboarding cannot add friction to the path that differentiates CustomerEQ from Annex Cloud.

---

## Customer Problem Being Solved

### Today's state

- A new admin signs up via Clerk, lands on `/admin`, and sees a program-health dashboard with two empty-state CTAs: "Create survey" and "Create campaign" (ref: `apps/web/src/app/(admin)/admin/page.tsx:189`).
- The `Brand` record that backs the Clerk org **must be created manually** via a CLI script (`scripts/onboard-org.mjs`). There is no Clerk webhook handler and no first-login middleware; a brand-new sign-up that reaches `/admin` without someone running the script first will fail multi-tenant scoping.
- The developer page (`/admin/developer`) exists but sits downstream of onboarding — the admin has to know to go there to generate an API key or grab an embed snippet.
- There is no notion of "onboarding progress" anywhere in the product. No checklist, no progress widget, no milestone tracking, no `OnboardingState` entity, no activation event.
- There is no instrumentation for Time to First Value (TTFV). `AuditEvent` logs admin actions but does not compute a "time from org creation to first X" metric.

### The impact

- **Self-serve doesn't work.** Every new customer requires a hand-off call or a run of the onboard-org script. This does not scale past design partners.
- **Admins get stuck without knowing they're stuck.** An empty `/admin` with two CTAs gives no indication which one should come first, what "first" even means, or how many more steps there are.
- **CustomerEQ can't measure its own activation funnel.** Without TTFV we don't know whether onboarding is taking 4 minutes, 4 hours, or 4 days — so we can't know what to fix.
- **The hero workflow (Issue #6) is gated behind unclear prerequisites.** A marketing manager trying to launch a campaign needs a program, members, and CX-event ingestion wired up — but the admin home doesn't surface that dependency graph.

---

## User Experience That Will Solve the Problem

### High-level flow

```
Sign up (Clerk hosted UI)
   │
   ▼
Auto-provisioning (server)
   │  Brand row created via Clerk org.created webhook (or first-login fallback)
   │  Admin is now tenant-scoped to their Brand.
   ▼
Use-case picker  ───────────────► routes to one of:
   │                               - API/SDK path (#171)
   │                               - Static-site path (#172)
   │                               - Multi-app path (#173)
   ▼
Archetype connect flow (per-sub-issue)
   │  Ends with: data source connected + verification green + first event received
   ▼
Guided first-run checklist (persistent on /admin)
   │  Tracks: brand created → data source connected → first event received →
   │          first survey live → first action triggered
   ▼
Activation reached (all checklist steps done)
   │  TTFV captured. Checklist collapses; remains dismissible.
```

### Routes and components

| Route | Purpose | Notes |
| :--- | :--- | :--- |
| Clerk hosted sign-up (existing) | Account creation | No change. |
| `/admin/onboarding` (NEW) | Use-case picker + post-provisioning landing | Shown when `OnboardingState.useCasePath IS NULL`. Once a path is chosen, redirects into it. |
| `/admin/onboarding/api` (NEW, owned by #171) | API/SDK connect flow | Inline API key, tabbed snippets, test-event round-trip. |
| `/admin/onboarding/site` (NEW, owned by #172) | Static-site connect flow | Domain capture, embed snippet + hosted URL, snippet detection, inline 1-Q survey. |
| `/admin/onboarding/apps` (NEW, owned by #173) | Multi-app connect flow | App inventory, per-app keys, per-app verification. |
| `/admin` (existing, enhanced) | Dashboard + persistent first-run checklist widget | Checklist renders as a top-of-page card until activation reached; dismissible afterward. |
| `/admin/developer` (existing) | Keys, embed snippets, webhooks | Unchanged; acts as the "post-onboarding reference" screen. |

### Step 1 — Sign-up & brand auto-provisioning

**Trigger**: admin completes Clerk sign-up and is redirected into the app.

**Happy path**:

1. Clerk hosts sign-up → admin sets email/password → Clerk creates the user.
2. Clerk's default post-sign-up behavior creates a personal org; we intercept the `organization.created` Clerk webhook.
3. Our webhook handler (`apps/api/src/routes/clerk-webhooks.ts` — NEW, owned by this epic) validates the Svix signature and inserts a `Brand` row with `clerkOrgId = org.id`, `name = org.name`. Idempotent on `clerkOrgId` unique constraint.
4. Admin lands on `/admin`. Middleware (`apps/web/src/middleware.ts`) resolves Clerk org → Brand. A just-in-time fallback provisioning path exists for cases where the webhook has not yet delivered (rare but possible): if the Brand is missing at middleware time, create it inline.
5. `OnboardingState` record is created alongside the Brand, with `useCasePath = null` and `checklist = { brandCreated: true, dataSourceConnected: false, firstEventReceived: false, firstSurveyLive: false, firstActionTriggered: false, activatedAt: null }`.
6. Because `useCasePath` is null, admin is redirected to `/admin/onboarding`.

**Edge cases**:

- **Webhook not yet delivered on first page load**: middleware fallback creates the Brand synchronously. Webhook arriving later is a no-op due to idempotency on `clerkOrgId`.
- **Clerk org creation fails for billing or account reasons**: admin sees the standard Clerk error — not this epic's concern.
- **User invited to an existing org**: no new Brand is created. Admin inherits the existing Brand and its `OnboardingState`. If the Brand is already activated, the invited admin skips the use-case picker.
- **Brand.name changes later**: the webhook handler also listens to `organization.updated` and syncs `name`. Out of scope for the critical path; a follow-up polish.

### Step 2 — Use-case picker

**Trigger**: `OnboardingState.useCasePath IS NULL` on any admin-authenticated page load.

**UX**:

- Full-screen picker (not a modal) at `/admin/onboarding`.
- Title: "How do you want to use CustomerEQ?"
- Subtitle: "Pick the path that best matches how you run your business today. You can change or add paths later."
- Three cards, each with an icon, headline, one-sentence body, and "Choose this path" button:
  - **Card 1 — "I have my own application"** → routes to `/admin/onboarding/api` (owned by #171). For teams with a production web/mobile/backend app and developer resources.
  - **Card 2 — "Just a website"** → routes to `/admin/onboarding/site` (owned by #172). For teams with only a static marketing site and limited developer resources.
  - **Card 3 — "Multiple applications"** → routes to `/admin/onboarding/apps` (owned by #173). For orgs operating several apps under one brand, with per-app event attribution.
- Secondary link below the cards: "Skip for now and go to the dashboard." Sets `useCasePath = 'skipped'` on `OnboardingState`; admin lands on `/admin` with the checklist showing "Choose a path" as the next step.

**State changes**:

- On picker selection: `OnboardingState.useCasePath` is set to `'api' | 'site' | 'apps' | 'skipped'`.
- Admin is redirected to the chosen archetype's `/admin/onboarding/<path>` route.

**Edge cases**:

- Admin navigates to `/admin/onboarding` after already picking a path: redirect to the in-progress archetype flow (`/admin/onboarding/<useCasePath>`).
- Admin picks a path, then wants to switch: an "Change path" link at the top of each archetype flow returns them to the picker. Existing progress (e.g., an API key generated mid-flow) is preserved — switching paths is additive.

### Step 3 — Archetype connect flow

**Ownership**: this epic does NOT implement the connect flows themselves. Each archetype's connect flow is specified and implemented in its own sub-issue:

| Archetype | Sub-issue | Key contract with this epic |
| :--- | :--- | :--- |
| Own application | #171 | Must mark `OnboardingState.checklist.dataSourceConnected = true` on successful API key generation; `firstEventReceived = true` on first event via that key. |
| Static site | #172 | Must mark `dataSourceConnected = true` on snippet detection OR first hosted-URL response; `firstSurveyLive = true` when the inline 1-Q survey is published. |
| Multiple apps | #173 | Must mark `dataSourceConnected = true` when at least one app is verified; `firstEventReceived = true` on the first event from any app. |

**Contract**: each archetype flow is a sibling route under `/admin/onboarding/` and operates on the same `OnboardingState` row. This epic provides:

- The checklist data model and update helpers (a small API surface: `PATCH /v1/admin/onboarding/checklist` with a Zod-validated partial update payload).
- The shared UI shell that wraps every archetype page: a progress bar showing "Step 1 of 3 — Sign up ✓ / Choose path ✓ / Connect", a "Change path" escape hatch, and a "Skip for now" escape hatch on verification steps.
- A utility hook, `useOnboardingChecklist()`, that reads and updates `OnboardingState` on the client.

### Step 4 — Install verification

**Ownership**: each archetype defines its own verification mechanism (#171 test-event round-trip, #172 snippet-detection, #173 per-app round-trip). This epic provides:

- The **verification-result UI shell** — a panel with a status pill (pending / verified / failed), a primary detail area (event payload / screenshot / list), and a footer of "failure-mode hints" (the archetype-specific messages like "API key invalid", "domain unreachable", etc.).
- A **timeout policy** enforced at the shell level: verification operations that take longer than 30 seconds transition from "pending" to "timed out" and surface at least three named failure-mode hints per archetype.
- A **"Skip verification for now" link** that marks the path as "connected but unverified" — the checklist step remains incomplete but the admin is not blocked from reaching the dashboard.

### Step 5 — Guided first-run checklist (persistent widget)

**Location**: top of `/admin` (above the CX Health + Loyalty Health panels). Renders as a single card with a collapsible body.

**Collapsed state** (default after activation OR after admin clicks "Hide"):

- Header: "Onboarding — X of 5 complete" with a progress bar.
- Expand/collapse chevron.

**Expanded state**:

- Header same as above.
- Five step rows — matching the activation milestones named in #170 exactly: `brand created → data source connected → first event received → first survey live → first action triggered`. Each row has a status icon (green check / blue in-progress / gray pending), a step name, a one-line description, and an action link where applicable:
  1. **Create your brand** — "Your tenant is set up in CustomerEQ." (Auto-completed at provisioning. Action: none.)
  2. **Connect a data source** — "Install a snippet, generate an API key, or register your apps." (Action: "Continue setup" → current archetype flow. If `useCasePath IS NULL`, the button is "Choose a path" → `/admin/onboarding`.)
  3. **Receive your first event** — "We're watching for incoming events from your install." (Action: "View event log" → `/admin/events` once it exists; link suppressed if not yet available.)
  4. **Publish your first survey** — "Launch a survey to collect CX signals from your customers." (Action: "Create a survey" → `/admin/surveys/new`. #172's inline 1-Q wizard auto-completes this step; #171/#173 admins create the survey separately after their connect flow.)
  5. **Trigger your first action** — "A loyalty action fires in response to a CX signal." (Action: "Create your first campaign" → `/admin/campaigns/new`.)
- "Choose how you use CustomerEQ" is **not** a checklist step — it is a precondition gating step 2. While `useCasePath IS NULL`, step 2 renders the "Choose a path" variant and the remaining steps are visible but visually de-emphasized.
- Activation banner (when all 5 are done): "🎉 You've reached activation. TTFV: MM minutes."
- Dismiss button (visible after activation): hides the widget persistently for this user. Stored in `OnboardingState.dismissedByUserIds`.

**Persistence**: checklist state lives in the `OnboardingState` row (see Schema). Updated via `PATCH /v1/admin/onboarding/checklist` — validated, audit-logged, tenant-scoped.

**Reset**: an admin can manually reset the checklist from `/admin/settings/onboarding` (NEW settings page, low-priority — defer polish to a follow-up).

**Edge cases**:

- **Multiple admins in the same Brand**: checklist is per-Brand, not per-user. If Admin A completes step 3, Admin B sees it as complete. This is correct because activation is a property of the org, not of each individual.
- **Admin dismisses before activation**: not allowed. The dismiss button only appears once `activatedAt IS NOT NULL`.
- **Admin is on the member portal**: checklist does not render — it is an admin-only widget.

### Step 6 — Time to First Value (TTFV)

**Definition**: TTFV = `OnboardingState.activatedAt - Brand.createdAt`, measured in seconds, captured at the moment all 5 checklist steps first become complete.

**Instrumentation**:

- The checklist update endpoint detects when the transition from "not-all-complete" → "all-complete" occurs. At that moment it writes `activatedAt = now()` and emits an analytics event `onboarding.activated` with `{ brandId, ttfvSeconds }`.
- The event is logged through the existing `AuditEvent` mechanism (tenant-scoped, append-only).
- Internal analytics dashboard gains a "TTFV" card: p50, p90, p99 across all orgs activated in the last 30/90/365 days, and a link to a drill-down of individual org TTFV values.

**Surface**:

- The activation banner in the checklist widget shows the admin their own TTFV.
- Internal analytics (at `/admin/internal/analytics` or similar — final location TBD with CustomerEQ internal UX; defer to spec completeness review) is for CustomerEQ's own team, not the admin's team. **Not visible to customers in the admin portal's normal navigation.**

**Why AuditEvent instead of a dedicated table**: avoids adding a new analytics backend; AuditEvent already has the right shape (tenant-scoped, append-only, with arbitrary JSON payload) and a query-friendly schema. Open to a revisit in the RFC if the analytics team wants a dedicated `OnboardingEvent` model — flagged as OD-4.

---

## UI Mocks

All mocks for this epic live in `docs/feature-specs/mocks/` and link below. Per project rule 14 + the spec-drafting principle "No Markdown Mocks", mocks are authored as real HTML/CSS.

| Surface | File | What it shows |
| :--- | :--- | :--- |
| Use-case picker (Step 2) | [`170-view.html`](./mocks/170-view.html#scene-use-case-picker) | Three-card picker with "Skip for now" link |
| Admin home with checklist widget (Step 5) | [`170-view.html`](./mocks/170-view.html#scene-checklist-expanded) | Expanded checklist with 2-of-5 complete, showing action links |
| Activation banner (Step 5 / Step 6) | [`170-view.html`](./mocks/170-view.html#scene-activated) | Checklist collapsed post-activation with TTFV banner |

Each archetype's connect-flow and verification mocks live in its own sub-issue's spec.

---

## Design Standards Applied

- **Source**: `docs/architecture/architecture.md` §3.1 (Presentation Layer) and §3.7 — the authoritative UI reference for this repo per `fraim/config.json:customizations.designSystem`.
- **Stack**: Tailwind CSS v4 + shadcn/ui (Radix primitives). Standard CRUD route pattern from ADR 0001 does NOT apply here (onboarding is not a CRUD entity), but the general shadcn visual language — border radius, spacing scale, color tokens, button variants — must match the existing admin surfaces (programs, campaigns, alerts).
- **Not in config yet**: no dedicated design-system doc with tokens/components was authored at this time. `docs/replicate/screenshots/component-catalog.md` and `layout-patterns.md` describe the competitor (Annex Cloud) and are not a design system for CustomerEQ itself.
- **Accessibility**: shadcn/ui primitives inherit Radix accessibility (focus management, ARIA). Use-case picker cards must be keyboard-navigable (Tab between cards, Enter/Space to select). Checklist expand/collapse must have `aria-expanded`. Progress bar must have `aria-valuenow` / `aria-valuemax`.

---

## Compliance Requirements

Project config declares GDPR, CCPA, SOC2 (target month-12), and PCI-DSS (minimal scope). Onboarding touches three of these four.

### GDPR (applies if admin or their end-users are EU-based)

| Control | Requirement | Where enforced |
| :--- | :--- | :--- |
| Lawful basis for processing | Admin sign-up is contract-performance (they're signing up to use the product). No separate consent screen needed during admin onboarding itself. | Clerk ToS/privacy acceptance at sign-up. |
| Data minimization | Do not collect any field during onboarding that is not materially required to complete setup. Current plan collects: email (Clerk), org/brand name (Clerk), optional site domain (#172), optional app inventory (#173). **No end-user PII is collected during admin onboarding itself.** | Zod schemas on `/v1/admin/onboarding/*` endpoints. |
| Right to erasure (Article 17) | A deleted Brand must cascade-delete or anonymize its `OnboardingState` row. The checklist has no direct PII, but its `dismissedByUserIds` list references Clerk user IDs — treat as PII and handle in the existing erasure job. | `apps/worker/src/processors/erasure.ts` (or wherever erasure lives today) gets an `OnboardingState` cleanup step. |
| Transparency (Article 13) | Privacy policy must disclose that onboarding progress is tracked for product-analytics purposes (TTFV). | Marketing-site privacy page update — out of scope for engineering PR, tracked as a docs follow-up. |

### CCPA

Same data-minimization and erasure obligations as GDPR; no additional engineering controls beyond GDPR.

### SOC2 (target month-12)

| Control | Requirement | Where enforced |
| :--- | :--- | :--- |
| Logical access control | Brand auto-provisioning must be idempotent and tamper-resistant. Clerk webhook signature (Svix) must be verified before any DB write. | `apps/api/src/routes/clerk-webhooks.ts` rejects unsigned/invalid requests. |
| Audit trail | Every meaningful onboarding state change (`useCasePath` chosen, `checklist` step completed, activation reached, dismissed) must emit an `AuditEvent` with `actor`, `action`, `brandId`, `timestamp`. | `AuditEvent.create` called from `PATCH /v1/admin/onboarding/checklist`. |
| Change management | Schema changes (`OnboardingState` model, new `Brand.siteDomain`, potential `Application` model) follow the standard Prisma migration review path — no special SOC2 controls beyond existing. | `packages/database/prisma/migrations/`. |

### PCI-DSS (minimal scope)

No cardholder data is collected, stored, or transmitted during onboarding. Not in scope.

---

## Open Architectural Decisions

These decisions defer to the RFC (technical-design phase) but are surfaced here because they shape which sub-issues unblock in parallel.

### OD-1 — Clerk → Brand auto-provisioning: webhook vs first-login middleware?

- **Option A — Svix-signed webhook** (`organization.created` event). *Recommended.* Clerk-idiomatic; idempotent; survives browser crashes between sign-up and first page load.
- **Option B — First-login middleware** creates the Brand on the first authenticated request if not present. Simpler; no webhook infrastructure. Risk: double-create under concurrent first requests; requires a DB-level unique constraint + ON CONFLICT handling.
- **Recommendation**: *A (webhook) as primary path, B (middleware) as fallback for webhook delivery lag.* Implement both; the middleware path is cheap and also covers "webhook missed" incidents.

### OD-2 — Multi-app data model (#173): new `Application` model vs extend `ExternalSignalSource`?

- **Option A — New `Application` model** with its own `apiKeyId`, `brandId`, `name`, `type`. Clean separation of concerns.
- **Option B — Extend `ExternalSignalSource.sourceType` with `APPLICATION`**. Fewer migrations; existing source-level observability (health status, last-sync, last-error) is reused.
- **Recommendation**: *B (extend)* on grounds of reusing the existing health/monitoring layer and keeping the "sources of CX/loyalty data" in one table. Open to reversal in the RFC if the `scopeConfig` JSON shape is a poor fit for app metadata.

### OD-3 — `OnboardingState` persistence: new model vs fields on `Brand`?

- **Option A — New `OnboardingState` model**, 1:1 with `Brand`. *Recommended.* Allows non-trivial fields (`checklist: Json`, `dismissedByUserIds: String[]`) without bloating Brand. Clear extension point.
- **Option B — Flatten onto `Brand`**. Simpler migration but mixes identity (Brand) with ephemeral workflow state (onboarding).
- **Recommendation**: *A.* The 1:1 pattern matches existing similar splits in the schema.

### OD-4 — TTFV instrumentation: new event type vs piggyback on `AuditEvent`?

- **Option A — Piggyback on `AuditEvent`** with `action = 'onboarding.activated'` and TTFV in the payload. *Recommended.* No new table; internal analytics queries filter on action.
- **Option B — Dedicated `OnboardingActivationEvent` model**. Cleaner for analytics, but adds a table for what is essentially one event type per org.
- **Recommendation**: *A* for MVP; revisit in RFC if the analytics team wants richer activation-funnel events (e.g., per-step dwell times), in which case a dedicated model becomes warranted.

---

## Out of Scope / Future Considerations

- **Multi-org / enterprise onboarding** — depends on org hierarchy (#44) and multi-region (#19). Re-opens as a phase-2 sub-issue under #170 once those land.
- **SSO** — covered by #45.
- **Detailed survey-builder improvements** — the inline 1-Q survey in #172 defers to the existing survey model; full builder work belongs to #35/#36/#79.
- **Custom domain / white-label hosting** for the static-site path — #172 uses existing survey `shareUrl`; white-labeling is a separate concern.
- **First-class SDK packages (npm, pypi)** — out of scope for #171; copy-paste snippets only.
- **Webhook signing UI for customer-owned webhooks** — #53.
- **Full post-activation onboarding continuation** (second program, second campaign, advanced segmentation tour) — out of scope for #170. The widget disappears after activation; deeper product-led-growth surfaces are a separate epic.

### Forward-compatibility: pricing / subscription tiering

**Constraint stated by the product owner (2026-04-24)**: pricing and packaging are **not finalized**; in the future, some CustomerEQ sections may be gated behind a subscription plan or paywall.

This epic's design must not hard-code "all onboarding paths always available to all admins." Specifically:

1. The **use-case picker** should render each card by consulting a single `isPathAvailable(path, brand)` helper rather than conditionally-hidden JSX. Today the helper returns `true` for all paths; a future subscription layer can have it return false and render a "Upgrade to access this path" variant.
2. The **multi-app path (#173)** is the most plausible future tier-gating candidate, as it scales with customer size. Its app inventory count cap should be configurable (not hard-coded), driven by an `OnboardingLimits` config object.
3. The **TTFV internal analytics surface** has no admin-facing dependency; its gating (if any) is CustomerEQ-internal and does not affect customer-facing onboarding.
4. **Install verification** and **first-run checklist** are baseline onboarding and should remain available at any plan tier; moving them behind a paywall would be a regression.
5. Do **not** invent tier names, SKUs, or price points in this spec or the corresponding RFC — pricing is owned by the `pricing-strategy-definition` FRAIM job and its outputs.

When an ambiguity would be resolved differently depending on a pricing decision, flag it in the RFC's "Open Questions" section rather than guessing.

---

## Requirement Traceability

Every acceptance criterion and scope item in issue #170 (and the contracts inherited by sub-issues #171/#172/#173) maps to a specific spec section. This table is the Phase 4 (`spec-completeness-review`) artifact proving coverage.

| Source | Requirement | Spec section(s) | Coverage |
| :--- | :--- | :--- | :---: |
| #170 scope S1 / AC1 | Clerk sign-up auto-provisions a Brand on first login (no manual seed). | Step 1 — Sign-up & brand auto-provisioning (5-step flow + edge cases); OD-1 (webhook vs middleware). | ✅ |
| #170 scope S2 / AC2 | Use-case picker is the first screen post-provisioning; routes to the correct connect flow. | Step 2 — Use-case picker; Scene 1 mock; `OnboardingState.useCasePath` state. | ✅ |
| #170 scope S3 / AC3 | Guided first-run checklist renders on `/admin` until activation; dismissible after. | Step 5 — Guided first-run checklist (5-step list matching #170 verbatim); Scene 2 and Scene 3 mocks; edge-case rules for dismissal, multi-admin, member portal. | ✅ |
| #170 scope S4 | Install verification per path with failure-mode hints. | Step 4 — Install verification (shared shell + 30s timeout + ≥3 named failure-mode hints + skip-for-now); per-archetype mechanism in sub-issue specs. | ✅ |
| #170 scope S5 / AC4 | TTFV metric instrumented and surfaced in internal analytics. | Step 6 — TTFV (definition, instrumentation, surface); OD-4 (AuditEvent vs dedicated model). | ✅ |
| #170 AC5 | Each sub-issue's connect flow plugs into the shared checklist; no duplicated UI shells. | Step 3 — Archetype connect flow contract (table mapping each archetype to the `OnboardingState.checklist` flags it must set); Step 4 — shared verification UI shell. | ✅ |
| #170 AC6 | E2E test: sign-up → pick path → connect → verify → checklist marks activated, for ≥1 archetype. | Validation Plan / Functional #1 (auto-provisioning E2E) + #6 (activation-detection); each sub-issue spec owns its own archetype E2E. | ✅ |
| #170 note | Hero workflow (Issue #6) remains reachable in <30 min from sign-up. | Validation Plan / Performance #1; explicit design intent in "Customer's Desired Outcome" and "Out of Scope". | ✅ |
| #171 contract | Marks `dataSourceConnected = true` on key generation; `firstEventReceived = true` on first event. | Step 3 archetype contract table row for #171. | ✅ |
| #172 contract | Marks `dataSourceConnected = true` on snippet detection or first hosted-URL response; `firstSurveyLive = true` on inline survey publish. | Step 3 archetype contract table row for #172. | ✅ |
| #173 contract | Marks `dataSourceConnected = true` when ≥1 app verified; `firstEventReceived = true` on first event from any app. | Step 3 archetype contract table row for #173. | ✅ |
| User constraint (2026-04-24) | Pricing is not finalized; design for paywall forward-compatibility. | Out of Scope / "Forward-compatibility: pricing / subscription tiering" (5 concrete guidance points); Validation Plan does not assume any specific tier. | ✅ |

### Completeness notes

- **Schema is partially specified.** `OnboardingState` model is named with its key fields (`useCasePath`, `checklist` JSON, `dismissedByUserIds`, `activatedAt`) but full Prisma schema, indexes, and migration details are RFC territory (covered in the `technical-design` phase, not this spec).
- **API surface is partially specified.** `PATCH /v1/admin/onboarding/checklist` is named with its intent (validated, audit-logged, tenant-scoped) but the Zod payload shape is left to the RFC.
- **Internal-analytics surface location is TBD.** `/admin/internal/analytics` is placeholder text; final path depends on how CustomerEQ surfaces internal-only dashboards (no such surface exists today). Flagged for RFC / product decision.
- **Design system.** Spec relies on `docs/architecture/architecture.md` as the authoritative design source per `fraim/config.json.customizations.designSystem`. A dedicated design-system document (tokens, component inventory) does not exist yet — out of scope for this spec but worth filing as a follow-up.

## Validation Plan

### Functional validation

1. **Auto-provisioning happy path**: from a brand-new Clerk sign-up, admin reaches `/admin` and finds a `Brand` already provisioned. Test via Playwright E2E: sign up → load `/admin` → assert the dashboard renders without a "brand not found" error.
2. **Webhook idempotency**: fire the `organization.created` webhook twice with the same payload; assert exactly one `Brand` row exists and `clerkOrgId` uniqueness is preserved.
3. **Middleware fallback**: simulate webhook delivery lag (delete the `Brand` between Clerk's response and the admin's first page load); assert middleware creates the Brand inline without erroring.
4. **Use-case picker**: for each of the 3 paths + "skip", assert the correct redirect and that `OnboardingState.useCasePath` is persisted.
5. **Checklist step transitions**: exercise the `PATCH /v1/admin/onboarding/checklist` endpoint with each step's boolean flip and assert `AuditEvent` is emitted, response is tenant-scoped, and invalid transitions (e.g., skipping from step 1 to step 5) are rejected with a 400 if we enforce order.
6. **Activation detection**: flip all 5 steps true one at a time; assert `activatedAt` is set exactly once, at the moment the 5th step is set, and TTFV is computed and surfaced.
7. **Cross-admin visibility**: log in as Admin A, advance the checklist to step 3. Log in as Admin B (same Brand, different Clerk user). Assert Admin B sees step 3 as complete.

### UX validation

1. **Browser validation at 1440×900 and 375×667**: use-case picker renders correctly on desktop and mobile viewports (Playwright screenshots saved to evidence doc).
2. **Keyboard navigation**: Tab through the picker cards; Enter selects. Tab to the checklist expand/collapse; Space toggles.
3. **Empty state of the checklist widget**: loaded on a fresh Brand where only step 1 is complete, the widget renders with the correct step highlighted and the correct action link.
4. **Activation celebration**: once the 5th step is complete, the activation banner replaces the progress content; the dismiss button appears.

### Compliance validation

1. **Erasure integration test**: create a Brand, progress the checklist, fire the erasure job. Assert `OnboardingState` is cleaned up along with the Brand's other PII.
2. **Audit trail test**: each endpoint in `/v1/admin/onboarding/*` emits at least one `AuditEvent`; verify by querying the AuditEvent table after each test scenario.
3. **Signed-webhook rejection**: send `organization.created` without a valid Svix signature; assert 401 and no Brand is created.

### Performance validation

1. **Hero-workflow reachability**: measure the wall-clock time from a fresh Clerk sign-up to reaching the campaign builder (`/admin/campaigns/new`). Must be less than 30 minutes including a real end-to-end loop for at least one archetype (E2E covered in #171's or #172's spec).
2. **Webhook latency**: `organization.created` handler should complete in < 500ms p99. Measured via API observability.

---

## Alternatives

| Alternative | Why discard? |
| :--- | :--- |
| Skip the use-case picker; send everyone to a single "Getting Started" wizard that asks every question sequentially. | Single-funnel wizards assume a linear user population. Our three archetypes (own app / static site / multi-app) have materially different first steps — forcing every admin through every question before branching produces a long, irrelevant-feeling flow for most. Industry data (the "no-show after sign-up" pattern in SaaS onboarding literature) consistently shows branched path pickers outperform linear wizards for heterogeneous ICPs. |
| Gate all of `/admin` until onboarding is complete. | Blocks invited teammates from viewing data that already exists. Blocks admins from coming back later to resume where they left off without a "skip" escape hatch. Violates the "hero workflow must be reachable in <30 min" constraint because it adds friction between sign-up and the campaign builder. |
| Use Clerk's built-in "onboarding" fields to track state. | Clerk stores metadata at the user/org level but is not designed for a 5-step workflow with idempotent state transitions, audit logging, and tenant-scoped reads. Keeping onboarding state in our own Postgres row gives us full control over migration, querying, and compliance. |
| Make the checklist a modal that only appears on first login. | Admins will close it and then be unable to find it. Persistent widget on the dashboard is more discoverable and easier to resume. |
| Skip TTFV instrumentation; add it later. | Without TTFV on day one we don't know whether activation is taking minutes or days — so we have no signal on whether the onboarding we shipped is working. The cost to instrument in v1 (a single `AuditEvent` on step-5 completion) is trivial relative to the value of the signal. |
| Build each archetype path entirely inside the shared spine (collapse #171/#172/#173 into #170). | Epic sprawl. Each archetype is a substantial feature with its own verification mechanism and its own UI surface; separating them lets the spine ship first and unblock the connect flows in parallel. Rule #15 applies in reverse — right abstraction level is "spine as a contract, archetypes as implementations." |

---

## Competitive Analysis

Onboarding posture of the competitors relevant to this epic's ICP (mid-market $10M–$500M, separate CX + Loyalty teams). All claims are sourced to existing repo analysis under `docs/replicate/` and `docs/business-development/` (dated 2026-03-24 and 2026-03-25); public-doc research on newer competitor flows is flagged as a follow-up where the disk evidence is thin.

### Configured Competitors Analysis

*Note: `fraim/config.json` does not currently have a populated `competitors` block. This spec proposes adding the three primary competitors below — see the "Proposed config update" at the end of this section.*

| Competitor | Current Onboarding Solution | Strengths | Weaknesses | Customer Feedback | Market Position |
|------------|------------------------------|-----------|------------|-------------------|-----------------|
| **Annex Cloud** | Sales-led "concierge-assisted" onboarding; demo request → scoping call → implementation project; custom setup by Annex Cloud services team (`docs/replicate/reports/REPLICATION_ANALYSIS.md:191`). A `/sign-up` page exists on annexcloud.com but routes to a demo request in the captured flow, not a self-serve tenant provision. | Deep customization at sign-up; bundled with 125+ pre-built integrations; handles complex multi-brand/multi-region setups. | Named weakness: **"Months-long implementation"** — business-validation report identifies this as a structural mid-market blocker. Requires buyer to commit before a working instance exists; no trial path. | "Slow deployment … weeks/months to launch programs" (shared complaint across Annex Cloud + Qualtrics per `qualtrics-competitive-analysis-2026-03-25.md:40`). | Enterprise-focused; dominant at Fortune 500 but overbuilt for mid-market ICP. |
| **Qualtrics** | Sales-led; "survey engineer" role typically required to configure programs post-sign-up; admin burden is explicitly called out as a customer complaint (`qualtrics-competitive-analysis-2026-03-25.md:40-44`). | Best-in-class survey design, text analytics, statistical tooling post-onboarding; extensive enterprise integration library. | Onboarding assumes a dedicated internal admin team. Pricing "no public pricing, constant upselling" complicates self-serve even if offered. No loyalty engine — the action side of our loop has to be glued on externally. | "Admin burden — requires survey engineers and dedicated staff"; "Slow deployment — weeks/months". | Enterprise CX leader; same mid-market fit gap as Annex Cloud. |
| **Yotpo / Smile.io** | Primarily Shopify-app-style install for e-commerce brands — "install the app from the Shopify App Store, connect your store, pick a loyalty template." Self-serve exists but is shaped around one channel (e-commerce storefront) rather than the three archetypes this epic targets. | Very fast Shopify-vertical onboarding; templated programs get a brand live in hours, not weeks. Clear "install → connect store → first reward" milestone. | Narrow archetype fit: "I have my own application," "I have many applications," and "I have only a static non-Shopify website" are not well-served. Loyalty-only; bolt-on CX tooling expected. | **Disk evidence is thin** (no dedicated `docs/business-development/yotpo-*` or `smile-io-*` analysis). Public-doc survey flagged as a follow-up — see Research Sources below. | SMB / small-mid e-commerce; strong in Shopify ecosystem. |

### Additional Competitors Analysis

| Competitor | Current Onboarding Solution | Strengths | Weaknesses | Customer Feedback | Market Position |
|------------|------------------------------|-----------|------------|-------------------|-----------------|
| **The "do-nothing" alternative** (manual CSV + spreadsheet glue) | Customer keeps their fragmented stack: separate CX tool (SurveyMonkey / Typeform / Delighted) + separate loyalty tool + spreadsheets. No "onboarding" per se — glue is custom-built. | Zero vendor lock-in; known cost structure. | This is **the "integration tax" pain** CustomerEQ is sold to eliminate: $75K+/yr per the business validation report's primary hypothesis. No unified activation experience because there is no unified product. | "Mid-market companies spend $75,000+ annually on integration tax alone" (business validation report primary hypothesis). | Dominant default for the target ICP. Winning against this alternative = winning the bulk of the market. |

### Competitive Positioning Strategy

#### Our differentiation (for this epic specifically — onboarding)

1. **Self-serve activation target <30 minutes, not weeks.** No sales call required to reach a working end-to-end loop. Directly attacks the "months-long implementation" weakness of Annex Cloud and the "weeks/months to launch programs" complaint about Qualtrics.
2. **Three archetype paths, not one-size-fits-all.** The use-case picker acknowledges that an SMB with a Shopify-like static site, an SMB with its own application, and an org with multiple apps under one brand have materially different first steps. Yotpo/Smile solve the e-commerce path well but don't address the other two cleanly; Annex Cloud/Qualtrics don't surface the decision at all.
3. **Explicit activation milestone (TTFV) instrumented from day one.** Neither Annex Cloud's concierge model nor Qualtrics' survey-engineer model gives the customer — or the vendor — a crisp "you are now activated" moment. Our checklist + TTFV analytics gives both sides a shared success criterion that scales past concierge.
4. **Activation = verified end-to-end loop, not "account created".** Many SaaS onboarding flows declare activation at "first log-in" or "first invitation sent." We set the bar at "event ingested → CX signal captured → loyalty action fired" — the actual unit of value customers pay for. This is a consequence of the hero workflow being the product's point.

#### Competitive response strategy

- **If Annex Cloud launches self-serve onboarding** (plausible in 12–24 months given market pressure): they still lack the unified CX-to-loyalty loop. Our activation milestone remains differentiated because their loop ends at "loyalty program live," not at "CX signal triggered a loyalty action." We continue to win on the verified-loop definition of activation.
- **If Yotpo/Smile adds a non-Shopify path**: we focus on the multi-app and dedicated-application archetypes where they're weak. Our API/SDK path (#171) and multi-app path (#173) go deeper than Yotpo's vertical story allows.
- **If Qualtrics acquires or builds loyalty**: this is the largest strategic risk per the business validation report. The answer is still speed to mid-market — we ship a unified onboarding now; their acquisition-and-integrate timeline is measured in years.

#### Market positioning

- **Target segment for this epic**: mid-market admins ($10M–$500M revenue orgs) who are evaluating CustomerEQ against keeping their fragmented stack. The activation promise is "you'll see a working CustomerEQ instance in under 30 minutes without a sales call" — a claim neither Annex Cloud, Qualtrics, nor Yotpo/Smile (outside Shopify) can match.
- **Value proposition for this epic**: "From sign-up to a verified CX→loyalty loop in under 30 minutes." Everything in the onboarding UX (use-case picker, checklist, TTFV banner) supports this promise.
- **Pricing positioning**: *pricing for CustomerEQ is not finalized* (see project memory `project_pricing_not_finalized.md` and this spec's Forward-compatibility section). This epic does not assume any specific plan tier; the onboarding paths are designed to accommodate future tier-gating without structural rework.

### Proposed config update

Propose adding the following to `fraim/config.json`:

```json
"competitors": {
  "annex-cloud": "Enterprise loyalty platform — sales-led concierge onboarding, dominant at Fortune 500, overbuilt for mid-market.",
  "qualtrics": "Enterprise CX/XM leader — survey-engineer-led onboarding, no loyalty engine, widely complained 'weeks/months to launch'.",
  "yotpo": "E-commerce loyalty — Shopify-app onboarding, strong in Shopify vertical, narrow archetype fit.",
  "smile-io": "E-commerce loyalty — Shopify-app onboarding, similar positioning to Yotpo."
}
```

Rationale: these four are the competitors most frequently cited in the existing `docs/replicate/` and `docs/business-development/` analysis. Landing them in config unlocks future FRAIM jobs (`pricing-strategy-definition`, `branding-quality-audit`, sales talk-tracks) that key off this field. Requires user approval before write — flagged for the `spec-completeness-review` phase.

### Research Sources

- `docs/replicate/reports/REPLICATION_ANALYSIS.md` (2026-03-24) — Annex Cloud analysis, including onboarding posture on line 191 ("Months-long implementation" / "Concierge-assisted rapid onboarding" as the MVP target).
- `docs/business-development/business-validation-report-cx-loyalty-platform-2026-03-24.md` — ICP definition and the "integration tax" pain for the do-nothing alternative.
- `docs/business-development/qualtrics-competitive-analysis-2026-03-25.md` — Qualtrics customer-complaint list, including the "slow deployment" and "admin burden" items.
- `docs/replicate/analysis/comprehensive_analysis.json` — Annex Cloud's public sign-up flow capture (lines 5523–5766).
- **Missing from disk — flagged as follow-up**: dedicated Yotpo and Smile.io onboarding research. Their current e-commerce-vertical flows are inferred from the roadmap's one-line references (`docs/replicate/IMPLEMENTATION_ROADMAP.md:11`). A public-docs survey of their Shopify App Store listings, signup flows, and documentation would harden the "narrow archetype fit" claim; recommend filing a small chore issue for a dedicated competitor analysis if the "Proposed config update" above is approved.

**Research methodology**: disk-only for this phase. Live web research was not performed — claims are restricted to what was already captured in `docs/replicate/` and `docs/business-development/` by prior FRAIM jobs. Skill guardrail observed: no competitor facts were invented beyond those sources.
