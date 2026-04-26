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
CustomerEQ-owned signup page (/signup)
   │  Email + password + organization name + admin name
   │  No Clerk-branded chrome visible to the admin.
   ▼
Auto-provisioning (server)
   │  Goes through the IdentityProvider abstraction (Clerk today).
   │  Brand row created with Brand.name = the org name the admin
   │  typed on /signup. clerkOrgId stored as an internal mapping.
   ▼
Org profile capture (/admin/onboarding/profile)
   │  Logo, website domain, default theme, optional org-size category.
   │  Single form; mostly optional fields can be skipped and revisited.
   ▼
Use-case picker (/admin/onboarding) ──► routes to one of:
   │                                     - API/SDK path (#171)
   │                                     - Static-site path (#172)
   │                                     - Multi-app path (#173)
   ▼
Archetype connect flow (per-sub-issue)
   │  Ends with: data source connected + verification green + first event received
   ▼
Guided first-run checklist (persistent on /admin)
   │  Tracks: brand created → data source connected → first event received →
   │          first survey live → first action triggered
   │  Has an explicit "Create your loyalty program" precondition gating
   │  the final "Trigger your first action" milestone.
   ▼
Activation reached (all checklist steps done)
   │  Per-step dwell times captured via OnboardingActivationEvent.
   │  Checklist collapses; remains dismissible.
```

### Routes and components

| Route | Purpose | Notes |
| :--- | :--- | :--- |
| `/signup` (NEW) | CustomerEQ-owned signup page (account + org info) | Wraps the IdentityProvider's user-creation primitive. Captures email, password, admin name, organization name. No Clerk org-naming UI visible. Plan-selection slot deferred to a future epic — `/signup` is "Free, get started" only today. |
| `/sign-in` (existing) | Sign-in page | Unchanged shell; routed through the IdentityProvider abstraction. |
| `/admin/onboarding/profile` (NEW) | Org profile capture | Logo upload, website domain, default theme picker, optional org-size category. Required completion or explicit "Skip and add later". |
| `/admin/onboarding` (NEW) | Use-case picker | Shown when `OnboardingState.useCasePath IS NULL`. Title and framing focus on the org's setup shape. Once a path is chosen, redirects into it. |
| `/admin/onboarding/api` (NEW, owned by #171) | API/SDK connect flow | Inline API key, tabbed snippets, test-event round-trip. |
| `/admin/onboarding/site` (NEW, owned by #172) | Static-site connect flow | Domain capture, embed snippet + hosted URL, snippet detection, inline 1-Q survey. |
| `/admin/onboarding/apps` (NEW, owned by #173) | Multi-app connect flow | App inventory, per-app keys, per-app verification. |
| `/admin` (existing, enhanced) | Dashboard + persistent first-run checklist widget | Checklist renders as a top-of-page card until activation reached; dismissible afterward. Empty-state CTAs vary by archetype (see Step 5 → "Path-specific dashboard states"). |
| `/admin/developer` (existing) | Keys, embed snippets, webhooks | Unchanged; acts as the "post-onboarding reference" screen. |
| `/admin/internal/onboarding-funnel` (NEW, internal-only) | Per-step activation funnel surface for the CustomerEQ team | Aggregates `OnboardingActivationEvent` rows; not visible in the customer-facing admin nav. |

### Step 0 — CustomerEQ-owned signup page

**Why a CustomerEQ-owned signup page (and not Clerk's hosted UI directly)**: the admin's first surface must be CustomerEQ-branded and CustomerEQ-controlled, for three reasons:

1. **Brand presentation**: Clerk's hosted sign-up surfaces "My Organization" naming flows and Clerk-branded chrome that confuse first-time admins (per reviewer feedback on this spec, 2026-04-25).
2. **Future plan-selection slot**: pricing is not finalized today, but the signup page is the natural surface where future plan offerings (Free / paid SKUs / "Get started for Free") would appear. A CustomerEQ page lets us add that slot without negotiating with Clerk's UI primitives. The plan-selection UI itself is **out of scope** for this epic — Step 0 ships as "create account + capture org info, free tier today" and a future epic adds the plan-selection step.
3. **Identity-provider replaceability**: see OD-5. Routing all signup traffic through `/signup` (a CustomerEQ-owned route) gives us a single integration point for the IdentityProvider abstraction, so swapping Clerk later does not require touching every page that knew about Clerk.

**Trigger**: anonymous visitor clicks "Get started" / "Sign up" from the marketing site or lands on `/signup`.

**Form fields** (single page, no multi-step):

| Field | Required | Notes |
| :--- | :---: | :--- |
| Work email | ✓ | Becomes the admin's login. Validated for syntax + duplicate check. |
| Password | ✓ | Strength validated (delegated to the IdentityProvider's policy). |
| Admin's full name | ✓ | Stored on the User; used in member-portal "Hi, {firstName}" and email signatures. |
| Organization name | ✓ | Stored as `Brand.name`. The IdentityProvider org is created with this same name silently — admin never sees a "name your organization" prompt from Clerk. |
| (Plan selection) | — | **Deferred to a future epic.** Step 0 today implies the Free tier. Spec leaves a designated slot in the form layout so plan selection can be added later without restructuring. |

**Social / OAuth sign-in (Sign in with Google, etc.)**:

The CustomerEQ-owned `/signup` page does **not** sacrifice the social-OAuth UX that Clerk's hosted page currently provides. Above the email/password form, the page renders a row of social-provider buttons — exactly the set the active IdentityProvider supports today (today: Google; whichever others Clerk has enabled in our config; tomorrow: whatever the swapped provider supports). Each button initiates the OAuth handshake via the IdentityProvider abstraction, not via a direct Clerk call:

- Click "Sign up with Google" → CustomerEQ-owned route `/api/auth/oauth/<provider>/start` calls `IdentityProvider.beginOAuth({ provider, returnTo })` and returns the provider's authorization URL. The browser is redirected there.
- After the user authorizes with Google, the provider redirects back to a CustomerEQ-owned callback `/api/auth/oauth/<provider>/callback`, which calls `IdentityProvider.completeOAuth({ provider, code, state })`. That returns `{ userId, isNewUser }`.
- If `isNewUser === true`, the user has no Brand yet — we redirect them to a follow-up `/signup/finish` page that asks **only the org-name field** (the other fields — email, name — are populated from the OAuth profile). Submitting that calls `IdentityProvider.createOrgForUser({ userId, orgName })` and continues like the email/password path from there.
- If `isNewUser === false`, the user already exists; sign them in and route based on whether they have a Brand yet (existing Brand → `/admin`; no Brand → `/signup/finish`).

OD-5 (IdentityProvider abstraction) is extended with two methods to support this without leaking Clerk-isms: `beginOAuth({ provider, returnTo })`, `completeOAuth({ provider, code, state })`, and `createOrgForUser({ userId, orgName })`. The list of supported providers is **whatever the active IdentityProvider implementation reports today** — the abstraction exposes a `listSupportedOAuthProviders()` method, and the `/signup` page renders one button per result. When Clerk adds or removes a provider, the buttons follow without a spec change.

**Submission flow** (email/password path):

1. Form validates client-side, then POSTs to `/api/auth/signup` (a CustomerEQ-owned API endpoint).
2. Server calls `IdentityProvider.createUserWithOrg({ email, password, name, orgName })` — see OD-5. With Clerk as the active provider, this performs Clerk's `Create user` + `Create organization` + `Add admin to organization (role: admin)` calls in sequence and returns `{ userId, orgId }`.
3. Server inserts a `Brand` row with `name = orgName`, `clerkOrgId = orgId` (or whichever provider's ID is current). `OnboardingState` is created alongside in the same transaction (see Step 1).
4. Server signs the admin in (creates the IdentityProvider session) and redirects to `/admin/onboarding/profile` (Step 1.5).

The OAuth path converges on Step 1 the same way (the `Brand` row is created once `createOrgForUser` returns), so Step 1's provisioning logic is unchanged regardless of which sign-up method the admin used.

**Error states** (concrete, not "the user sees a Clerk error"):

- **Email already in use**: form returns inline `"This email is already registered. Sign in instead."` with a link to `/sign-in?email=<address>`.
- **Password too weak**: inline list of unmet strength rules (length, character classes), no submit until cleared.
- **Provider rate-limited / billing failure**: full-form banner: `"We can't create your account right now. This is on us — try again in a minute, or contact support@customerEQ.com if it persists."` with a "Retry" button. Logs the underlying provider error code for the support team. **Admin is never shown the raw provider error message** — that is a Clerk-internal concept they shouldn't have to interpret.
- **Provider unreachable (network)**: same banner pattern as above; specific copy: `"We're having trouble reaching our authentication service. Retrying automatically..."` with auto-retry up to 3 times, then surface the manual retry button.

### Step 1 — Brand provisioning (server-side)

**Trigger**: `IdentityProvider.createUserWithOrg(...)` returns successfully from the Step 0 submission.

**Happy path** (server-side, invisible to the admin):

1. Step 0's submit handler calls the IdentityProvider abstraction; on success it has `{ userId, orgId, orgName }`.
2. Inside the same database transaction, insert a `Brand` row: `name = orgName` (the value the admin typed, **not** whatever Clerk's UI would have defaulted to), `clerkOrgId = orgId`, `createdAt = now()`. Idempotent on `clerkOrgId` unique constraint (so the org-created webhook arriving later cannot duplicate).
3. Insert an `OnboardingState` row alongside the Brand: `useCasePath = null`, `checklist = { brandCreated: true, dataSourceConnected: false, firstEventReceived: false, firstSurveyLive: false, firstActionTriggered: false, programCreated: false, activatedAt: null }`.
4. Insert the first `OnboardingActivationEvent` row: `step = 'account_created'`, `previousStep = null`, `dwellMs = null`, `metadata = { source: 'signup_page' }`. (See Step 6 for how dwell times accumulate from here.)
5. Sign the admin in via the IdentityProvider session helper.
6. Redirect to `/admin/onboarding/profile`.

**Defense-in-depth: webhook + middleware fallback**:

Step 0's synchronous flow is the primary path — by the time the admin lands on `/admin/onboarding/profile`, the Brand exists. As a defense-in-depth measure for edge cases where Step 0's transaction commits but the redirect fails (browser crash, network drop), we additionally:

- Subscribe to the IdentityProvider's `organization.created` webhook (Clerk-specific today; the abstraction in OD-5 normalizes the event shape). Webhook handler verifies signature (Svix for Clerk), then upserts `Brand` keyed on `clerkOrgId`. Idempotent.
- A first-login middleware in `apps/web/src/middleware.ts` resolves the IdentityProvider org → Brand on every authenticated admin request. If the Brand is missing (extremely rare given Step 0's synchronous create), it creates one inline using the IdentityProvider's `getOrg(orgId)` call — same idempotency contract.

**Edge cases — concrete UX, not "this is between admin and Clerk"**:

- **Webhook not yet delivered on first authenticated page load** *(extremely rare since Step 0 creates the Brand synchronously)*. Middleware fallback creates the Brand inline before the request continues. Admin sees no error; the first request may be ~50–100 ms slower.
- **Account creation fails after Step 0's form was submitted** *(provider rate-limit, billing rejection, network)*. Step 0's error states above apply: admin is held on `/signup` with an explicit error banner and a Retry button. The Brand row is never created (the transaction rolls back). No half-provisioned state ships.
- **User invited to an existing Brand by a teammate** *(distinct from "first signup")*. The invite is sent through `/admin/team/invitations` (a separate surface, owned by issue **#189 — Team management — invite admins to an existing Brand**). When the invitee accepts the invite link, they hit a CustomerEQ-owned `/accept-invite/<token>` page, sign in via the IdentityProvider, and are placed into the existing Brand with `OnboardingState.invitedAdminUserIds += [userId]`. They **skip** Step 0's signup page (no new Brand created) and **skip** the use-case picker if `OnboardingState.activatedAt IS NOT NULL`. They land directly on `/admin`. If the existing Brand is mid-onboarding, they see the same first-run checklist as the inviting admin — checklist state is per-Brand, so they pick up wherever the team is.
- **Brand name change after onboarding** *(admin renames the org from `/admin/settings/brand`, owned by issue **#190 — Brand settings page — edit org details**)*. The change is a single user action: `PATCH /v1/admin/brand` with `{ name }`. The handler updates `Brand.name` first (CustomerEQ DB is the source of truth), then calls `IdentityProvider.updateOrg(brandId, { name })` through the abstraction. If the IdentityProvider call fails, the Brand row is still updated (we don't roll back the local DB on a remote provider failure); we enqueue a retry job to re-sync the provider. **This means the IdentityProvider's stored org name can lag the CustomerEQ DB by seconds-to-minutes during a provider outage; CustomerEQ's UI never reads `org.name` from Clerk in the request path**, so admins always see the latest name they typed. Loose-coupling rationale: see OD-5.

### Step 1.5 — Org profile capture

**Why this step**: a Brand is more than a name. The same fields are needed in many places across CustomerEQ — admin-portal chrome, member-portal header, embed components, email templates, default survey theme — and the cheapest place to gather them is right after sign-up, before the admin starts building anything that would otherwise render with placeholder branding.

**Trigger**: admin lands on `/admin/onboarding/profile` immediately after Step 0 + Step 1 complete (i.e., on first sign-in). Also reachable from `/admin/settings/brand` post-onboarding for revisions.

**Form fields and where each one is consumed**:

| Field | Required | Type | Stored on | Consumed by |
| :--- | :---: | :--- | :--- | :--- |
| Brand display name | ✓ (pre-filled from Step 0's org name; editable) | string | `Brand.name` | Admin nav header, member-portal header, email "From" name, survey email body, embed widget header. |
| Logo | ✗ (default: gradient initials placeholder) | image upload (PNG/SVG, ≤ 1 MB, ≤ 512×512) | `Brand.logoUrl` (object-store URL) | Admin nav top-left, member-portal header, embed widget header, exported reports. |
| Website domain | ✗ | string (e.g., `acmecoffee.com`) | `Brand.siteDomain` (NEW field) | #172's snippet detection (matches against this domain), email "Reply-to" hostname suggestion, member-portal "Visit our site" link. |
| Default theme | ✗ (default: the **Indigo** stock theme — neutral CustomerEQ default) | radio: 4 stock themes + "Custom (set later)" | `Brand.defaultThemeId` (NEW field, FK to existing `Theme` model from #157) | Default survey theme, default embed widget styling, default reward-redemption page styling. **Theme continuity**: at Brand provisioning, four stock `Theme` rows (Indigo / Forest / Sunset / Slate) are seeded for the Brand and persist into `/admin/settings/themes` (#157's themes CRUD, plus the dedicated brand-settings surface filed as **#190**). The picker on this onboarding screen and the picker on Settings → Brand → Default theme (per #190) read from the **same** four stock rows; choosing Indigo here equals choosing Indigo there. Picking "Custom (set later)" takes the admin to the existing `/admin/settings/themes` create flow. |
| Org-size category | ✗ | radio: `1–10` / `11–50` / `51–200` / `201+` / `Prefer not to say` | `Brand.sizeCategory` (NEW enum field) | Internal analytics (segmenting activation funnel by org size), used by the use-case picker (Step 2) to gently steer the recommended archetype card. |

**Submission flow**:

- "Save and continue" → server validates payload (Zod), persists to `Brand`, emits `OnboardingActivationEvent { step: 'org_profile_completed' }`, redirects to `/admin/onboarding` (Step 2 — use-case picker).
- "Skip and add later" → same persist call but with only the pre-filled `name` and any optional fields the admin already filled. Same redirect. The omitted fields stay at their default values; the admin can revisit `/admin/settings/brand` any time. Skipping does NOT set the org-profile checklist step to complete (it's not on the 5-row activation checklist — see Step 5; org-profile is a smoothing step, not a milestone).

**Validation**:

- Logo: client-side preview before upload; server validates image dimensions and content-type before writing to object storage.
- Website domain: format check only (no DNS lookup at submit time — that's #172's job during snippet detection).
- Default theme picker: an inline, non-clickable **Theme Preview** panel renders below the four theme swatches and updates on every selection so the admin sees what theme tokens (primary color, accent color, neutral surface, button styles) will look like on real CustomerEQ surfaces. The preview shows three concrete mini-surfaces stacked vertically inside the panel — a member-portal header chip (logo + brand name + a primary CTA), a one-question survey card (question text, 0–10 NPS scale, "Submit" button), and a reward-redemption tile (reward name, points cost, "Redeem" button). The mini-surfaces use the picked theme's tokens so a switch from Indigo → Forest visibly changes the chrome on all three. The preview is illustrative-only — no clicks, no real data — and explicitly labeled "Preview" so the admin understands they are looking at a sample, not their actual member-facing site.

**Forward-compatibility**: this step is also where additional org-profile fields would land in the future (industry vertical, primary CX use-case, time zone for scheduled campaigns). New fields go here; the form layout reserves space for an additional 2–3 optional fields without restructuring.

### Step 2 — Use-case picker

**Reframing per reviewer feedback (2026-04-25)**: the picker is genuinely about **the shape of the customer's setup** (do they have an app, a static site, multiple apps under one brand) — not "how the admin wants to use CustomerEQ" as an aspiration. The title and copy reflect that.

**Trigger**: `OnboardingState.useCasePath IS NULL` on any admin-authenticated page load after Step 1.5 completes.

**UX**:

- Full-screen picker (not a modal) at `/admin/onboarding`.
- Title: "How is your setup today?"
- Subtitle: "Tell us where CustomerEQ should plug in. We'll show you the right setup steps for each option. You can add other paths later."
- Optional tone-setter when `Brand.sizeCategory` was provided in Step 1.5: a small italicized note above the cards — *"Most teams your size start with..."* — gently highlighting the most common path for that size cohort. Implementation note: the cohort defaults are set internally and can be tuned over time as the activation funnel surfaces actual conversion rates.
- Three cards, each with an icon, headline, one-sentence body, and "Choose this path" button:
  - **Card 1 — "I have my own application"** → routes to `/admin/onboarding/api` (owned by #171). For teams with a production web/mobile/backend app and developer resources.
  - **Card 2 — "Just a website"** → routes to `/admin/onboarding/site` (owned by #172). For teams with only a static marketing site and limited developer resources.
  - **Card 3 — "Multiple applications"** → routes to `/admin/onboarding/apps` (owned by #173). For orgs operating several apps under one brand, with per-app event attribution.
- Secondary link below the cards: "Skip for now and go to the dashboard." Sets `useCasePath = 'skipped'` on `OnboardingState`; admin lands on `/admin` with the checklist showing "Choose a path" as the next step.

**State changes**:

- On picker selection: `OnboardingState.useCasePath` is set to `'api' | 'site' | 'apps' | 'skipped'`. `OnboardingActivationEvent { step: 'path_chosen', metadata: { path } }` is emitted.
- Admin is redirected to the chosen archetype's `/admin/onboarding/<path>` route.

**Edge cases**:

- Admin navigates to `/admin/onboarding` after already picking a path: redirect to the in-progress archetype flow (`/admin/onboarding/<useCasePath>`).
- Admin picks a path, then wants to switch: a "Change path" link at the top of each archetype flow returns them to the picker. Existing progress (e.g., an API key generated mid-flow) is preserved — switching paths is additive.

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
  5. **Trigger your first action** — "A loyalty action fires in response to a CX signal." (Action — varies by `programCreated` precondition state, see below.)
- **Step 5 has a "Create your loyalty program" precondition.** A loyalty action cannot be triggered without a program to credit it against. The precondition surfaces in the row as a sub-state:
  - When `OnboardingState.checklist.programCreated === false`: row 5 description reads `"First, create a loyalty program. Then a campaign can fire actions against it."` and the action button is "Create a loyalty program" → `/admin/programs/new`. On program creation, `programCreated` flips to true and the row's description and CTA refresh to the campaign-builder text.
  - When `programCreated === true` and `firstActionTriggered === false`: description reads `"A loyalty action fires in response to a CX signal."` and the action button is "Create your first campaign" → `/admin/campaigns/new`.
  - When `firstActionTriggered === true`: row is checked, no action link.
- "Choose how you use CustomerEQ" is **not** a checklist step — it is a precondition gating step 2. While `useCasePath IS NULL`, step 2 renders the "Choose a path" variant and the remaining steps are visible but visually de-emphasized.
- Activation banner (when all 5 are done): "🎉 You've reached activation. Your team got there in MM minutes."
- Dismiss button (visible after activation): hides the widget persistently for this user. Stored in `OnboardingState.dismissedByUserIds`.

**Path-specific dashboard states** (post-activation): the `/admin` dashboard's existing CX Health and Loyalty Health panels are the same shape across archetypes, but the **empty-state CTAs and quick-action links vary by `OnboardingState.useCasePath`** to point the admin at next steps that match how they're plugged in:

| Archetype | CX Health empty-state CTA | Loyalty Health empty-state CTA | Sidebar quick-add |
| :--- | :--- | :--- | :--- |
| `api` (#171) | "Send a CX event via API" → developer page | "Trigger a campaign from a CX event" → campaign builder | "Generate API key" |
| `site` (#172) | "Add another survey to your site" → survey builder | "Reward respondents with a campaign" → campaign builder | "Get a hosted survey URL" |
| `apps` (#173) | "Send a CX event from another app" → app inventory | "Build a cross-app campaign" → campaign builder | "Add another app" |
| `skipped` / unset | (Today's behavior — generic CTAs) | (Today's behavior — generic CTAs) | "Choose how you use CustomerEQ" |

**Persistence**: checklist state lives in the `OnboardingState` row (see Schema). Updated via `PATCH /v1/admin/onboarding/checklist` — validated, audit-logged, tenant-scoped. Each transition also emits an `OnboardingActivationEvent` row (see Step 6) for the funnel surface.

**Persistence**: checklist state lives in the `OnboardingState` row (see Schema). Updated via `PATCH /v1/admin/onboarding/checklist` — validated, audit-logged, tenant-scoped.

**Reset**: an admin can manually reset the checklist from `/admin/settings/onboarding` (NEW settings page, low-priority — defer polish to a follow-up).

**Edge cases**:

- **Multiple admins in the same Brand**: checklist is per-Brand, not per-user. If Admin A completes step 3, Admin B sees it as complete. This is correct because activation is a property of the org, not of each individual.
- **Admin dismisses before activation**: not allowed. The dismiss button only appears once `activatedAt IS NOT NULL`.
- **Admin is on the member portal**: checklist does not render — it is an admin-only widget.

### Step 6 — Activation funnel + Time to First Value (TTFV)

**Why a funnel, not a single TTFV metric**: a single end-to-end TTFV tells us "how long activation took" but not "where it stuck." Per reviewer feedback (2026-04-25), CustomerEQ needs per-step dwell times from day one — without them, we cannot tell the difference between "the customer's developer is busy" and "our SDK install instructions are confusing." Both produce the same TTFV but the remediation is opposite.

**Data model — `OnboardingActivationEvent`**:

A dedicated, append-only model — one row per step transition per Brand:

```
OnboardingActivationEvent {
  id            String   @id @default(cuid())
  brandId       String   // FK Brand
  step          OnboardingStep   // enum (see below)
  previousStep  OnboardingStep?  // null for the first event
  occurredAt    DateTime @default(now())
  dwellMs       Int?             // ms since `previousStep.occurredAt`; null for first event
  metadata      Json             // free-form per-step context
  @@index([brandId, occurredAt])
}

enum OnboardingStep {
  account_created          // emitted at end of Step 1 (Brand provisioning)
  org_profile_completed    // emitted on Step 1.5 submit (or skip)
  path_chosen              // emitted on Step 2 selection (one of api / site / apps / skipped)
  data_source_connected    // emitted by archetype flow (#171/#172/#173)
  first_event_received     // emitted by archetype flow
  first_survey_published   // emitted by survey-publish handler
  program_created          // emitted by program-create handler
  first_action_triggered   // emitted by campaign worker on first run
  activated                // emitted exactly once when all 5 checklist milestones complete
}
```

Why a dedicated model rather than `AuditEvent` piggyback (see OD-4): per-step dwell times are first-class from MVP — the funnel surface needs structured `step` and `dwellMs` columns it can group and aggregate on, not an `action` string and a Json blob. `AuditEvent` is fine for "who did what, when" forensics; it is not the right shape for product-analytics aggregation.

**Forward-compatibility with pricing/subscription**: this model is orthogonal to plan tiers — onboarding events describe one-time activation, while subscription events would describe recurring billing state. Adding a future `Subscription` or `Plan` model does not change the shape of `OnboardingActivationEvent`. If a future feature gates onboarding paths behind a tier, we can extend the `metadata` JSON (e.g., `{ blockedByTier: 'business' }` on a `path_chosen` event where the user attempted a gated path); the model itself does not need to change.

**TTFV definition**: TTFV = `(activated.occurredAt - account_created.occurredAt)` for a given Brand. Computed on demand from `OnboardingActivationEvent` rows; not stored separately. Per-step dwell times (`org_profile → path_chosen`, `data_source_connected → first_event_received`, etc.) are also computable from the same rows.

**Instrumentation responsibilities**:

| Step | Emitted by |
| :--- | :--- |
| `account_created` | Step 1 server-side provisioning handler (`/api/auth/signup`). |
| `org_profile_completed` | Step 1.5 submit handler. Includes `metadata: { skipped: bool, fieldsProvided: [...] }`. |
| `path_chosen` | Step 2 picker submit. `metadata: { path: 'api' \| 'site' \| 'apps' \| 'skipped' }`. |
| `data_source_connected` | Archetype connect flow (#171/#172/#173). `metadata` carries archetype-specific detail. |
| `first_event_received` | The first `/v1/events` request handler that matches the Brand's first key (#171/#173) OR the first hosted-URL response (#172). |
| `first_survey_published` | The survey publish handler when a survey transitions to `status: 'live'` for the first time on this Brand. |
| `program_created` | The program create handler. |
| `first_action_triggered` | The campaign worker (`apps/worker/src/processors/campaignTriggers.ts`) on the first action it fires for this Brand. |
| `activated` | The checklist update endpoint, exactly once when all 5 milestones are first complete. Sets `OnboardingState.activatedAt = now()` in the same transaction. |

**Surfaces**:

- **Admin-facing**: the activation banner inside the checklist widget shows the customer their own TTFV (in minutes / hours, human-readable). No funnel detail surfaced to the customer — the per-step view is internal-only by design.
- **Internal-only at `/admin/internal/onboarding-funnel`**: aggregate funnel chart (number of brands at each step, cumulative drop-off, p50/p90/p99 dwell time per step transition), with filters on `useCasePath`, `Brand.sizeCategory`, and time range. Drill-down to per-Brand timelines for support investigations. **Not in the customer-facing admin nav.** Access is gated to CustomerEQ employees only via a feature flag or internal-org check (RFC will pin the exact gating mechanism).
- **CSV export** of the per-step events for support and product-analytics use-cases. Append-only model means time-bounded exports are safe.

---

## UI Mocks

All mocks for this epic live in `docs/feature-specs/mocks/` and link below. Per project rule 14 + the spec-drafting principle "No Markdown Mocks", mocks are authored as real HTML/CSS.

| Surface | File | What it shows |
| :--- | :--- | :--- |
| Signup page (Step 0) | [`170-view.html`](./mocks/170-view.html#scene-signup) | CustomerEQ-owned `/signup` page: email + password + admin name + org name. No Clerk chrome. Plan-selection slot reserved but not active. |
| Org profile (Step 1.5) | [`170-view.html`](./mocks/170-view.html#scene-org-profile) | `/admin/onboarding/profile` with logo upload preview, website domain, theme picker, org-size category, and a "Skip and add later" escape. |
| Use-case picker (Step 2) | [`170-view.html`](./mocks/170-view.html#scene-use-case-picker) | Three-card picker with reframed "How is your setup today?" title, "Most teams your size start with..." size-cohort hint, "Skip for now" link. |
| Admin home with checklist widget (Step 5) | [`170-view.html`](./mocks/170-view.html#scene-checklist-expanded) | Expanded checklist with 2-of-5 complete, showing action links + the "Create your loyalty program" precondition state on row 5. |
| Activation banner (Step 5 / Step 6) | [`170-view.html`](./mocks/170-view.html#scene-activated) | Checklist collapsed post-activation with TTFV banner. |

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
| Lawful basis for processing | Admin sign-up is contract-performance. No separate consent screen needed during admin onboarding itself. ToS/privacy acceptance is captured on the CustomerEQ-owned `/signup` page (Step 0), not on the IdentityProvider's hosted UI. | `/signup` form has explicit ToS/privacy checkboxes; agreement timestamp persisted on the User record. |
| Data minimization | Do not collect any field during onboarding that is not materially required. Step 0 collects: admin email, password, admin name, org name. Step 1.5 collects: logo, website, default theme, org-size category — all optional and explicitly listed in the form with skip option. Step 2 captures `useCasePath`. **No end-user PII is collected during admin onboarding itself.** | Zod schemas on `/api/auth/signup`, `/v1/admin/onboarding/profile`, `/v1/admin/onboarding/checklist`. |
| Right to erasure (Article 17) | A deleted Brand must cascade-delete or anonymize: `OnboardingState`, all `OnboardingActivationEvent` rows for that Brand, the logo asset in object storage, and `dismissedByUserIds` references. The IdentityProvider abstraction (OD-5) must also receive a deletion call so the Clerk-side user/org is removed in the same erasure run. | `apps/worker/src/processors/erasure.ts` gets `OnboardingState` + `OnboardingActivationEvent` cleanup steps + a call to `IdentityProvider.deleteUser(userId)` and `IdentityProvider.deleteOrg(orgId)`. |
| Transparency (Article 13) | Privacy policy must disclose that onboarding progress is tracked for product-analytics purposes (per-step funnel + TTFV). | Marketing-site privacy page update — out of scope for engineering PR, tracked as a docs follow-up. |

### CCPA

Same data-minimization and erasure obligations as GDPR; no additional engineering controls beyond GDPR.

### SOC2 (target month-12)

| Control | Requirement | Where enforced |
| :--- | :--- | :--- |
| Logical access control | Brand auto-provisioning must be idempotent and tamper-resistant. The IdentityProvider webhook signature (Svix for Clerk today) is verified before any DB write inside the abstraction layer. The signup endpoint authenticates the form payload + uses the IdentityProvider abstraction's `createUserWithOrg` — no direct DB writes from a request the abstraction has not validated. | Webhook handler inside `clerk-identity-provider.ts` (per OD-5) rejects unsigned/invalid requests. |
| Audit trail | Two complementary trails. (a) Forensics — every meaningful onboarding state change (signup, profile-completed, path-chosen, checklist transitions, brand-name change, dismissed) emits an `AuditEvent` with `actor`, `action`, `brandId`, `timestamp`, and request metadata. (b) Product analytics — every step transition emits an `OnboardingActivationEvent` (per Step 6). The two trails serve different purposes and overlap only at the "what happened" level. | `AuditEvent.create` called from `/api/auth/signup`, `/v1/admin/onboarding/profile`, `/v1/admin/onboarding/checklist`, `/v1/admin/brand` rename handler. `OnboardingActivationEvent.create` called from each step emitter listed in Step 6. |
| Change management | Schema changes (`OnboardingState` model, new `Brand.siteDomain` / `Brand.logoUrl` / `Brand.defaultThemeId` / `Brand.sizeCategory`, new `OnboardingActivationEvent` model, potential `Application` model or `ExternalSignalSource.sourceType` extension) follow the standard Prisma migration review path. | `packages/database/prisma/migrations/`. |

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

### OD-4 — Activation funnel storage: piggyback on `AuditEvent` vs dedicated `OnboardingActivationEvent` model?

- **Option A — Piggyback on `AuditEvent`** with `action = 'onboarding.activated'` and TTFV in the payload. No new table; internal analytics queries filter on action.
- **Option B — Dedicated `OnboardingActivationEvent` model** with structured `step`, `previousStep`, `dwellMs`, `metadata` columns. *Recommended.* See Step 6 for the full model.
- **Recommendation revised (2026-04-25 reviewer feedback)**: *B (dedicated model)*. A single TTFV metric tells us "how long" but not "where it stuck"; per-step dwell times are the actual diagnostic signal we need to identify slow integration paths and improve the onboarding funnel over time. `AuditEvent` is the wrong shape for product-analytics aggregation — it's keyed for forensics, not funnels. The marginal cost of one extra table is small versus retrofitting a richer model later. Forward-compatibility note: this model is orthogonal to any future pricing/subscription model, so the decision does not couple us to today's pricing assumptions.

### OD-5 — Identity-Provider abstraction (NEW from reviewer feedback)

The signup, sign-in, org-creation, member-invitation, and org-name-change flows all currently call Clerk APIs directly from the `apps/web` and `apps/api` codebases. Per reviewer feedback (2026-04-25), CustomerEQ wants the option to swap Clerk later (cost, vendor risk, feature gaps) without touching every call site. The abstraction also makes it possible for the `/signup` and org-name-change UX to never expose Clerk-specific concepts to the admin.

- **Option A — Define an `IdentityProvider` interface** (e.g., `apps/api/src/auth/identity-provider.ts`) with a closed set of methods CustomerEQ uses today, and a single `ClerkIdentityProvider` implementation behind it. *Recommended.* Methods (initial set):
  - `createUserWithOrg({ email, password, name, orgName }) → { userId, orgId }`
  - `signInUser({ email, password }) → { sessionToken }`
  - `getSession(token) → { userId, orgId } | null`
  - `getOrg(orgId) → { id, name }`
  - `updateOrgName(orgId, name) → void`
  - `inviteMember(orgId, email, role) → { invitationId }`
  - `listOrgMembers(orgId) → User[]`
  - Webhook-event normalizer: `parseWebhook(rawRequest) → { type, payload }` covering at minimum `user.created`, `organization.created`, `organization.updated`, `user.deleted`.
  Every CustomerEQ call site (signup endpoint, middleware, member-management UI, webhook handler) imports the interface, never the Clerk SDK directly. The Clerk SDK is imported only inside `clerk-identity-provider.ts`.
- **Option B — Defer the abstraction; keep Clerk calls inline** until a swap is actually contemplated. Lower upfront cost; higher cost when (if) the swap happens.
- **Recommendation**: *A.* The interface is small (~8 methods), has well-defined boundaries, and is exactly the kind of port that pays dividends if (a) Clerk pricing changes, (b) a feature gap (e.g., enterprise-only auth methods) forces evaluation, or (c) the team wants to test sign-in flows without hitting Clerk's rate limits. Implementing it now while there are only a handful of Clerk call sites in the codebase is materially cheaper than implementing it later when those call sites have multiplied. The RFC will pin the exact interface shape.
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
| #170 scope S1 / AC1 | Sign-up auto-provisions a Brand on first login (no manual seed). | Step 0 — CustomerEQ-owned signup page (form + submit flow); Step 1 — server-side Brand provisioning + webhook/middleware fallback; OD-1 (webhook vs middleware); OD-5 (IdentityProvider abstraction makes provisioning provider-agnostic). | ✅ |
| #170 scope S2 / AC2 | Use-case picker is the first screen post-provisioning; routes to the correct connect flow. | Step 2 — Use-case picker (reframed title per reviewer feedback); Scene 3 mock; `OnboardingState.useCasePath` state. | ✅ |
| #170 scope S3 / AC3 | Guided first-run checklist renders on `/admin` until activation; dismissible after. | Step 5 — Guided first-run checklist (5-step list matching #170 verbatim) + path-specific dashboard states + Create-your-loyalty-program precondition; Scene 4 and Scene 5 mocks; edge-case rules for dismissal, multi-admin, member portal. | ✅ |
| #170 scope S4 | Install verification per path with failure-mode hints. | Step 4 — Install verification (shared shell + 30s timeout + ≥3 named failure-mode hints + skip-for-now); per-archetype mechanism in sub-issue specs. | ✅ |
| #170 scope S5 / AC4 | TTFV metric instrumented and surfaced in internal analytics. | Step 6 — Activation funnel + TTFV (per-step `OnboardingActivationEvent` rows; `/admin/internal/onboarding-funnel` surface); OD-4 (recommendation revised to dedicated model). | ✅ |
| #170 AC5 | Each sub-issue's connect flow plugs into the shared checklist; no duplicated UI shells. | Step 3 — Archetype connect flow contract; Step 4 — shared verification UI shell. | ✅ |
| #170 AC6 | E2E test: sign-up → pick path → connect → verify → checklist marks activated, for ≥1 archetype. | Validation Plan / Functional #1 (signup → activation E2E) + #6 (activation-detection); each sub-issue spec owns its own archetype E2E. | ✅ |
| #170 note | Hero workflow (Issue #6) remains reachable in <30 min from sign-up. | Validation Plan / Performance #1; explicit design intent in "Customer's Desired Outcome" and "Out of Scope". | ✅ |
| #171 contract | Marks `dataSourceConnected = true` on key generation; `firstEventReceived = true` on first event. | Step 3 archetype contract table row for #171; Step 6 instrumentation responsibilities table. | ✅ |
| #172 contract | Marks `dataSourceConnected = true` on snippet detection or first hosted-URL response; `firstSurveyLive = true` on inline survey publish. | Step 3 archetype contract table row for #172; Step 6 instrumentation responsibilities table. | ✅ |
| #173 contract | Marks `dataSourceConnected = true` when ≥1 app verified; `firstEventReceived = true` on first event from any app. | Step 3 archetype contract table row for #173; Step 6 instrumentation responsibilities table. | ✅ |
| User constraint (2026-04-24) | Pricing is not finalized; design for paywall forward-compatibility. | Out of Scope / "Forward-compatibility: pricing / subscription tiering" (5 concrete guidance points); Step 0 reserves a plan-selection slot; Step 6 forward-compat note that activation funnel is orthogonal to subscription model. | ✅ |
| Reviewer Comment 1 (2026-04-25) | Custom signup page distinct from Clerk; future plan-selection slot. | Step 0 — CustomerEQ-owned signup page; "Why a CustomerEQ-owned signup page" rationale; Forward-compat slot reserved. | ✅ |
| Reviewer Comment 2 (2026-04-25) | Path-specific dashboard states. | Step 5 — "Path-specific dashboard states" sub-section with archetype × CTA matrix. | ✅ |
| Reviewer Comment 3 (2026-04-25) | Common org-info onboarding step (name, logo, website, theme). | Step 1.5 — Org profile capture (full field table + per-field consumer surfaces). | ✅ |
| Reviewer Comment 4 (2026-04-25) | Hide "My Organization" Clerk behavior; admin specifies org name silently. | Step 0 form captures org name as a CustomerEQ field; Step 1 explicitly uses the admin-typed name as `Brand.name`, not whatever Clerk would default. OD-5 abstraction prevents Clerk org-naming UI from reaching the admin. | ✅ |
| Reviewer Comment 5 (2026-04-25) | Concrete error handling and admin recovery for signup failures. | Step 0 — "Error states" section with 4 concrete error categories and admin recovery copy + behavior. | ✅ |
| Reviewer Comment 6 (2026-04-25) | Elaborate the invited-admin-to-existing-org flow. | Step 1 edge case "User invited to an existing Brand by a teammate" expanded with concrete `/accept-invite/<token>` route and per-Brand checklist semantics. | ✅ |
| Reviewer Comment 7 (2026-04-25) | Loose coupling with Clerk for future swap. | OD-5 — IdentityProvider abstraction (interface + ClerkIdentityProvider implementation; all CustomerEQ call sites depend on the interface only). Step 1 edge case "Brand name change" routes through the abstraction. | ✅ |
| Reviewer Comment 8 (2026-04-25) | Reframe use-case picker as org-shape question. | Step 2 — title changed to "How is your setup today?"; subtitle reworded; size-cohort hint added; explicit reframing rationale at the top of Step 2. | ✅ |
| Reviewer Comment 10 (2026-04-25) | Program/campaign sequencing in the activation flow. | Step 5 — "Create your loyalty program" precondition added to row 5 with three sub-states (programCreated false → row 5 reads create-program; true + first-action false → row 5 reads create-campaign; first-action true → row 5 done). | ✅ |
| Reviewer Comment 14 (2026-04-25) | Activation funnel with per-step timing instead of a single TTFV metric. | Step 6 — full rewrite. Dedicated `OnboardingActivationEvent` model with `step`, `previousStep`, `dwellMs`, `metadata`. OD-4 recommendation flipped from AuditEvent to dedicated model with explicit forward-compat note. Internal `/admin/internal/onboarding-funnel` surface specified. | ✅ |
| Reviewer Round 2 #1 (2026-04-25) | Sign in with Google / OAuth providers must keep working under the CustomerEQ-owned `/signup` page. | Step 0 — new "Social / OAuth sign-in" sub-section. OAuth handshake routes through `IdentityProvider.beginOAuth` / `completeOAuth` / `createOrgForUser`; provider list comes from `IdentityProvider.listSupportedOAuthProviders()` so the buttons follow whatever the active provider supports. New-user OAuth path lands on `/signup/finish` for the org-name capture, then converges with the email/password Step 1. | ✅ |
| Reviewer Round 2 #2 (2026-04-25) | Theme picker should tie to Settings → Theme; same four stock themes. | Step 1.5 — Default theme field row updated. Four stock `Theme` rows (Indigo / Forest / Sunset / Slate) seeded at Brand provisioning per #157; same picker + same options surface in `/admin/settings/themes` and Settings → Brand → Default theme (per **#190**). "Custom (set later)" routes to the existing Themes CRUD create flow. | ✅ |
| Reviewer Round 2 #3 (2026-04-25) | File a separate issue for the team-management invite flow. | Filed **#189 — Team management — invite admins to an existing Brand**. Step 1 edge case "User invited to an existing Brand" updated to reference #189 instead of "tracked as a follow-up." | ✅ |
| Reviewer Round 2 #4 (2026-04-25) | File a separate issue for the brand-settings page (org details / themes). | Filed **#190 — Brand settings page — edit org details**. Step 1 edge case "Brand name change after onboarding" updated to reference #190; Step 1.5 theme-picker description points at #190 for the post-onboarding edit surface. | ✅ |
| Reviewer Round 2 #5 (2026-04-26) | Concrete spec for the theme-picker live preview (mock today doesn't show the preview). | Step 1.5 Validation — preview spec replaced with a concrete description of three illustrative-only mini-surfaces (member-portal header chip, NPS survey card, reward-redemption tile) that swap theme tokens on selection. Mock Scene 2 updated with a new "Preview · Indigo theme" panel under the swatches showing all three mini-surfaces, explicitly labeled "illustrative only — not clickable." | ✅ |

### Completeness notes

- **Schema is partially specified.** `OnboardingState` model is named with its key fields (`useCasePath`, `checklist` JSON, `dismissedByUserIds`, `activatedAt`) but full Prisma schema, indexes, and migration details are RFC territory (covered in the `technical-design` phase, not this spec).
- **API surface is partially specified.** `PATCH /v1/admin/onboarding/checklist` is named with its intent (validated, audit-logged, tenant-scoped) but the Zod payload shape is left to the RFC.
- **Internal-analytics surface location is TBD.** `/admin/internal/analytics` is placeholder text; final path depends on how CustomerEQ surfaces internal-only dashboards (no such surface exists today). Flagged for RFC / product decision.
- **Design system.** Spec relies on `docs/architecture/architecture.md` as the authoritative design source per `fraim/config.json.customizations.designSystem`. A dedicated design-system document (tokens, component inventory) does not exist yet — out of scope for this spec but worth filing as a follow-up.

## Validation Plan

### Functional validation

1. **Signup → activation E2E**: from `/signup`, fill the form (email, password, admin name, org name), submit. Assert: redirect to `/admin/onboarding/profile`, `Brand` exists with `name` matching what was typed, `OnboardingState` exists with `brandCreated: true`, first `OnboardingActivationEvent` row with `step = 'account_created'`. Continue through Step 1.5 (skip) → Step 2 (pick a path) → archetype flow → first event → first survey published → program created → first action triggered. Assert `activatedAt` is set exactly once, TTFV is correct, and the per-step `OnboardingActivationEvent` rows form a complete chain with realistic `dwellMs` values.
2. **Step 0 — error states**: simulate each error category (email-already-in-use, password-weak, IdentityProvider rate-limit, IdentityProvider unreachable). Assert the admin sees the spec-defined recovery copy, no Brand row is created, and the form re-renders with state preserved.
3. **Step 0 — admin never sees Clerk org-naming UI**: end-to-end signup with Playwright; assert the page DOM never references "Clerk" or contains a Clerk-hosted "Organization name" input — the only org name input is the CustomerEQ form field.
4. **Step 1.5 — org profile happy path**: submit with all fields filled; assert all five fields persist on `Brand`, the logo is uploaded to object storage, `OnboardingActivationEvent { step: 'org_profile_completed' }` is emitted with `metadata.skipped = false`.
5. **Step 1.5 — skip path**: click "Skip and add later"; assert the same persistence behavior with optional fields at default values, event metadata `skipped = true`, and admin lands on `/admin/onboarding`.
6. **Webhook idempotency**: fire the IdentityProvider's `organization.created` webhook twice with the same payload; assert exactly one `Brand` row exists.
7. **Middleware fallback**: simulate Step 0 commit succeeding but the redirect failing (e.g., browser closed); admin re-signs in; assert middleware finds the Brand without re-creating it.
8. **Use-case picker**: for each of the 3 paths + "skip", assert the correct redirect and that `OnboardingState.useCasePath` is persisted; assert the size-cohort hint renders when `Brand.sizeCategory` is set, and is suppressed when null.
9. **Checklist step transitions**: exercise the `PATCH /v1/admin/onboarding/checklist` endpoint with each step's boolean flip; assert both `AuditEvent` and `OnboardingActivationEvent` are emitted, responses are tenant-scoped, and invalid transitions (e.g., setting `firstActionTriggered = true` while `programCreated = false`) are rejected with a 400.
10. **Activation detection**: flip all 5 milestones (including `programCreated = true` precondition) one at a time; assert `activatedAt` is set exactly once, the dedicated `activated` `OnboardingActivationEvent` is emitted exactly once, and the activation banner displays the correct human-readable TTFV.
11. **Path-specific dashboard states**: for each of `useCasePath = 'api' | 'site' | 'apps'`, load `/admin` post-activation; assert the empty-state CTAs and sidebar quick-add match the spec's archetype × CTA matrix.
12. **Cross-admin visibility**: log in as Admin A, advance the checklist to step 3. Log in as Admin B (same Brand, different IdentityProvider user). Assert Admin B sees step 3 as complete.
13. **OD-5 abstraction integrity**: grep `apps/web` and `apps/api` for direct imports of `@clerk/*` outside `apps/api/src/auth/clerk-identity-provider.ts`; assert zero matches. Run a unit test against a `MockIdentityProvider` to confirm the abstraction's call sites work without Clerk in the loop.

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
