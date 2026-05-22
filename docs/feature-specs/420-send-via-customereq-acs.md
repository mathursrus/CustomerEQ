# Feature: Send Survey Emails via CustomerEQ (Azure Communication Services)

Issue: [#420](https://github.com/mathursrus/CustomerEQ/issues/420)
Owner: manohar.madhira@outlook.com
Status: **Round 5 — consolidated spec pass after 4 rounds of mock iteration. Operator-facing terminology cleanup; Sent-count moved to Loop Monitor + Response header.**
Last touched: 2026-05-21

---

## Iteration history

| Round | Date | Trigger | Outcome |
|---|---|---|---|
| R1 | 2026-05-21 | FRAIM `feature-specification` job phases 1–2 → first Draft PR commit | Two peer Send tiles (`Send via CustomerEQ` / `Send via my email tool`); shared **merged Existing + Custom audience builder** with wildcard search, per-row deselect, and 25/50 pagination; managed-email composer page (sender name + alias + rich-text body with `{{survey_link}}` mustache); BullMQ per-recipient send queue; `DistributionBatch.sendMode` enum; `Survey.sentCount` + the existing distribution batch listing tagged by mode. Reuses #378's `DistributionBatch` / `SurveyDistributionToken` / `SurveyDistribution` data model and the existing email connector at `packages/connectors/src/email.ts`. |
| R2 | 2026-05-21 | Reviewer feedback on PR #497: *"The mock doesn't include how the Send via Email tool would change based on this. This issue should cover both send scenarios, because they must share the inputs. Survey Title and Link Expiry are not shown in the mocks. Think as a PM — how the two scenarios should overlap and where they diverge. Don't design / re-design in isolation."* (coaching moment: `fraim/personalized-employee/learnings/raw/manohar.madhira@outlook.com-2026-05-21T21-19-48-pm-design-paired-flows-with-shared-structure.md`) | Reframed entirely around **one shared structure with explicit divergence points**. New §0 lists every input/affordance tagged `Shared` / `Mode-specific`. New §2.2 *Common fields* (Survey name in mail + Links expire on) lifted from #378 §2.2 and applied identically in both modes. §-numbered walk-through interleaves both modes: §2.3 composer is the managed-email-only block; §2.4a is the Self-serve Generate-Links block; §2.5/§2.6 mode-specific. §3 (#378 reshape) framed as the `mode=self-serve` instance of the shared component. Both paths render `<DistributePage mode={...}/>` parameterized by `mode` URL param. |
| R3 | 2026-05-21 | Reviewer feedback on PR #497 (mock-only round): *"please add capability to Insert Brand logo. In the default message, show Brand Logo and Brand Name as the header. In Add Custom List, we should allow emails to be pasted even if Brand is setup to use Member ID or phone number..."* (coaching moment: `manohar.madhira@outlook.com-2026-05-21T22-50-13-parser-grammar-vs-brand-primary-identifier.md`) | Brand-logo + brand-name added to the default email body as a header block (mustache tokens `{{brand_logo}}` + `{{brand_name}}`). Custom List parser **relaxed**: emails are accepted regardless of brand's primary identifier kind, looked up via `Member.email`; unmatched emails surface in an explicit *"Emails not found — cannot be auto-enrolled because Brand identifier is `<phone|external_id>`"* subsection of the audience preview (mock Scene 2B). Mock only — spec deferred to consolidated pass. |
| R4 | 2026-05-21 | Reviewer feedback on PR #497 (mock-only round): *"Show preview for Brand Logo, but need not allow for updating the logo in this view... In Scene 5A include the statement that these members will be marked as sent on download. If users regenerate for a given batch, update the sent information also. In case of Send via my email tool, downloading CSV can be considered as Sent. Sent information should also appear in the Loop Monitor as Survey Sent. Scene 6 need not be present. Loop Monitor shows the Sent and Received information. The Batch Details should show Sent. Configuration is just what was configured in the survey. Show Survey Sent Count in the Responses Header Section, before the <X> response that changes based on the Filters selected (e.g. Wave)."* | Removed in-spec brand-logo upload affordance (no upload UX in this issue; logo pulled from `Brand.logoUrl`; header collapses gracefully if unset; upload UX deferred to a separate Organization Settings issue). **Sent semantics** spelled out: Self-serve → CSV-download is the dispatch-handoff moment that sets `SurveyDistribution.sentAt` and increments `Survey.sentCount`; Regenerate Links updates `sentAt` on every row in the batch. Managed-email → per-recipient `sentAt` set when the worker confirms delivery. **Sent-count surfacing moved**: out of Configuration Summary (which now contains only what was configured on the survey); into Loop Monitor (lifetime Survey Sent stat, mode breakdown sub-line) and Responses section header (Sent before the Wave-filtered Response count). Mock only — spec deferred to consolidated pass. |
| R5 | 2026-05-21 | Reviewer feedback on PR #497: *"Remove reference to ACS — that is internal application detail. It should state CustomerEQ Email. Ensure that previous functionality of viewing Wave Detail should be maintained for Send via my email tool. Now update the feature spec."* | **Operator-facing terminology cleanup**: every operator-visible reference to ACS removed and replaced with *"CustomerEQ Email"*. Internal naming aligned: enum value `MANAGED_EMAIL` → `MANAGED_EMAIL`; new column `Brand.managedEmailSenderDomain` (proposed in R1) → `Brand.managedEmailSenderDomain`; URL param `?mode=managed-email` → `?mode=managed-email`; API endpoint `POST .../send-via-acs` collapsed into the existing `POST .../distribution-batches` using a `sendMode` discriminator (no new endpoint). Architecture section retains technical reference to the ACS-based email provider in `packages/connectors/src/email.ts` because that file remains the implementation surface — but operator-facing surfaces never name the provider. **Wave Detail preserved** for Self-serve: §3.2 batch-detail page renders a 5-counter strip plus mode-conditional sections — Self-serve keeps #378 §3.1's Tokens table + Edit Expiry + Regenerate-Links-and-download-CSV affordance verbatim. Spec consolidated in this round (per reviewer's *"Now update the feature spec"*); mock at Round 5. |

## Customer

Same operator persona as [#378](378-personalized-survey-links-byo-email.md) — the **marketing manager** or **CX operator** running quarterly NPS / CSAT / CES programs. #378 served the subset who run their own ESP (Mailchimp, HubSpot, Klaviyo) or hand-mail-merge from Gmail. #420 serves the *other* subset: the operator who would prefer CustomerEQ to actually send the mail because:

1. They don't have an ESP — they're early-stage, or they're a one-person CX team running an off-cycle pulse and don't want to involve marketing-ops to load a 200-row list into Mailchimp for one wave.
2. They want the survey emails to live separate from their marketing send — different sender alias, different reputation, different unsubscribe registry. *"From: Acme CX Team `<feedback@cx.acme-via-customereq.io>`"* on a survey email is a different brand voice than *"From: Acme Marketing `<news@acme.com>`"*.
3. They want one-flow simplicity — define the audience, write the body, click Send. No download-CSV-then-paste-into-another-tool dance.

The **respondent** persona is unchanged from #378 — they receive an email with a tokenized URL, click, see the form, submit. From the respondent's perspective, an CustomerEQ Email message and a Mailchimp-merge-sent email arrive in the same inbox and lead to the same form. The distinction is operator-side.

## Customer's Desired Outcome

1. **One in-app flow from "I have a survey" to "the survey is in my recipients' inboxes"** — no leaving the dashboard, no CSV download, no second tool.
2. **Audience built in one place, by the same primitives, regardless of which Send path the operator picks** — Existing Members (with wildcard search) + Custom List (paste / CSV) accumulated into a single deduped list with per-row deselect. The two Send paths diverge only on what happens *after* the list is approved.
3. **Sender identity within CustomerEQ's deliverability envelope, but operator-controlled at the human-readable level** — operator picks the From-name (e.g., *"Acme CX Team"*) and the local-part of the From-alias (e.g., *"feedback"*); CustomerEQ pins the domain (the CustomerEQ-Email-verified sender domain) so deliverability and DMARC alignment stay under CustomerEQ's operational control.
4. **Rich-text body with one inevitable merge variable** — `{{survey_link}}`. The default body is pre-templated from the survey title; the operator edits it before sending.
5. **Confirm before send, never silently dispatch** — *"Are you sure? This will email N recipients in the next few minutes."* Once dispatch starts, the operator has a single screen showing per-recipient send status (queued / sent / failed) so they can intervene if 60% of sends fail.
6. **CAN-SPAM/CASL/GDPR compliance baked into every CustomerEQ Email send** — every email carries a one-click unsubscribe link that persists in `Member.unsubscribedAt` and suppresses all future CustomerEQ Email sends for that member.
7. **Survey Sent count surfaces both paths** — the existing operator-facing counter shows total recipients across all send waves, broken down by send mode (`CustomerEQ Email` vs `Self-serve (CSV)`).

## Customer Problem being solved

Restating the issue body in persona language:

1. **No supported in-app send.** Today's only sends are share-link (anonymous, no PII attribution), embed widget (host-page integration), and #378's per-recipient-CSV-for-BYO-ESP. None of these let the operator click a button and have CustomerEQ actually drop emails into recipients' inboxes. For the operator without an ESP, this is a complete dead end — they cannot run a survey wave at all from inside CustomerEQ.
2. **The #378 audience builder is mutually-exclusive between Existing and Custom.** That decision (Round 2 Decision A in #378) was correct for #378's CSV download semantics — one mode, one CSV, one wave. But it fights against the ACS-send use case: *"Send to my Gold tier (existing members) plus these 5 specific support-escalation customers (custom list) that I want to include in this wave."* That natural request has no single-batch answer in #378; the operator runs two batches and downloads two CSVs. #420 unifies them into a **merged + deduped list with per-row deselect** that serves both Send paths.
3. **Wildcard search on the member roster doesn't exist.** Operators commonly want *"all members at `@artistos.com`"* or *"all members whose external-id starts with `q2-2026-`"*. The current member-list page has filters by attribute (status, enrolled date, tier) but no glob-on-identifier. #420 introduces wildcard search as a member-selection primitive on the Distribute page.
4. **No "I want CustomerEQ as the sender alias" affordance.** The platform sends notification emails today (via `packages/connectors/src/email.ts`), but the sender is hard-pinned at platform startup from `AZURE_COMMUNICATION_SERVICES_EMAIL_FROM` — it isn't per-survey, per-wave, or per-brand. For #420, the brand needs to project a sender identity that *they* configure (display name + local-part), not the platform's notifications sender.
5. **No sent-count surfacing.** The platform tracks `DistributionBatch.tokenCount` and `SurveyDistribution.sentAt` (which today marks "we minted a token for this member" — not "we actually dropped an email in their inbox"). For #420, the worker that performs the ACS send updates a true sent timestamp + sent mode, and a survey-level aggregator rolls them up. For #378 sends, the sent count is incremented atomically when the operator downloads the CSV (the moment of operator-side dispatch handoff — analogous to "we minted; you took it from here").

## Shared surface vs path-specific divergence (the PM framing)

The headline architectural commitment of #420: **both Send paths render the same React page component (`<DistributePage mode={...}/>`)**, parameterized by a `mode` URL query param (`mode=SELF_SERVE` for the `Send via my email tool` path; `mode=MANAGED_EMAIL` for the `Send via CustomerEQ` path). The shared component owns every input the two flows have in common; the small set of mode-specific affordances live in clearly-isolated subcomponents (`<SelfServeComposer/>` vs `<ManagedAcsComposer/>`). This is the architecture answer to *"the inputs must be shared"* — the alternative (two separate page components copying the audience builder + common fields) would produce drift the moment one path got a new input the other didn't.

The table below enumerates every operator-facing input/affordance in the Distribute surface and tags each as `Shared` or `Mode-specific`:

| Affordance | SELF_SERVE (`Send via my email tool`) | MANAGED_EMAIL (`Send via CustomerEQ`) |
|---|---|---|
| **Distribution tile button** (entry point in survey-detail Distribution section) | `Send via my email tool →` button (outline-primary) | `Send via CustomerEQ →` button (outline-primary, equal-weight peer) |
| **Page URL** | `/admin/surveys/[id]/distribute?mode=self-serve` | `/admin/surveys/[id]/distribute?mode=managed-email` |
| **Page header / "switch mode" link** | *"Send via my email tool"* heading + *"Switch to Send via CustomerEQ →"* link in top-right | *"Send via CustomerEQ"* heading + *"Switch to Send via my email tool →"* link in top-right |
| **Audience builder** (§2.1 — *Add from Existing Members* card with wildcard search + random sample · *Add from Custom List* card with paste/CSV + auto-enroll · unified deduped list with per-row deselect + 25/50 pagination) | **SHARED** — identical UI, identical semantics | **SHARED** — identical UI, identical semantics |
| **Common fields** (§2.2 — `Survey name in mail` text input · `Links expire on` select with 24h / 7d / 30d / 90d / Custom presets + brand-TZ helper) | **SHARED** — identical UI, identical semantics. `surveyNameInMail` flows into the CSV's `surveyName` column. | **SHARED** — identical UI, identical semantics. `surveyNameInMail` flows into the email subject's default value and is available as the `{{survey_title}}` mustache variable. |
| **Composer / generator section** (§2.3 / §2.4a) | **Mode-specific (SELF_SERVE)** — format dropdown (Generic / Mailchimp / HubSpot / Klaviyo) + `Generate N links →` CTA. Composer body is the CSV format choice; there is no email body to compose. | **Mode-specific (MANAGED_EMAIL)** — Sender name + Sender alias (local-part) + brand-pinned domain suffix · Subject · Body (rich-text editor with `{{survey_link}}` mustache palette and auto-appended unsubscribe footer) · live preview pane · `Send N emails →` CTA. |
| **Confirmation modal** (§2.4) | **Mode-specific copy** — *"Generate N tokenized links and download the CSV?"* with the strong-warning *"⚠ The plaintext URLs are shown only once"* preserved from #378 | **Mode-specific copy** — *"Send N emails from `<sender>`?"* with the warning *"Emails will be sent in the next few minutes. You cannot cancel a send in progress."* |
| **Success state** (§2.5) | **Mode-specific (SELF_SERVE)** — generated-success banner + format dropdown + `⬇ Download CSV` button (preserved from #378 §2.5) + `Done — back to survey →` link | **Mode-specific (MANAGED_EMAIL)** — Sending state (SSE-driven progress bar + per-recipient status table + Retry-failed CTA) transitioning to Sent state (summary banner — success/warn-styled by failed count) + `Done — back to survey →` link |
| **DistributionBatch row written** | `sendMode = SELF_SERVE` · `composerSnapshot = null` · `Survey.sentCount += tokenCount` at **CSV download time** (operator-dispatch-handoff semantic). Re-incremented on Regenerate Links (which updates `sentAt` on every row in the batch). | `sendMode = MANAGED_EMAIL` · `composerSnapshot = {senderName, senderAlias, senderDomain, subject, body, footerTemplate, brandLogoUrl}` · `Survey.sentCount` incremented per-recipient by the worker as the managed email provider confirms each delivery. |
| **Survey detail page (post-send)** | **SHARED surfacing** — Configuration Summary's Sent line shows the per-mode breakdown (e.g., *"5 total · 5 via my email tool · 0 via CustomerEQ"*). Distribution batches filter shows the batch with a `Self-serve` mode pill. | **SHARED surfacing** — same line, breakdown reflects MANAGED_EMAIL contribution. Distribution batches filter shows the batch with a `CustomerEQ Email` mode pill. |

**One thing the issue is silent on but is worth making explicit**: the *"switch mode"* link in the page header (top-right) lets the operator change their mind after building the audience. Switching modes preserves the audience list, common fields, and toggles only the composer / generator section. This is the affordance that pays off the architectural commitment — without it the *"shared component"* claim is just code-organization aesthetics. With it, the operator can run a `Send via my email tool` audience build, decide mid-flow *"actually let CustomerEQ deliver these"*, and switch without re-entering 200 paste-list emails.

---

## User Experience that will solve the problem

The interactive mock at [`mocks/420-send-via-customereq-acs.html`](mocks/420-send-via-customereq-acs.html) is the working artifact. Sections below describe the experience at the level of "specific steps the user takes"; the mock is the source of truth for visual layout, copy, and affordances.

### §1. Entry point — the Distribution tiles, reshaped

The existing 3-tile Distribution section (`SendViaEmailToolTile` + `Embed snippet` + `Share link` per `apps/web/src/app/(admin)/admin/surveys/[id]/components/DistributionSection.tsx`) becomes a **3-tile section with a redesigned leftmost tile**. The leftmost tile is no longer single-CTA "Send via my email tool →"; it's now a **"Send via Email" tile with two equal-weight peer buttons** stacked vertically:

- `Send via CustomerEQ →` — **NEW** — routes to `/admin/surveys/[id]/distribute?mode=managed-email`
- `Send via my email tool →` — routes to `/admin/surveys/[id]/distribute?mode=self-serve` (the existing #378 page, now parameterized by mode)

Both buttons render with **equal visual weight** (both `outline-primary` styling, same size, same chevron). The issue body presents them as peer choices ("two button options"); making one primary-solid would imply the platform's preference, which it doesn't have — the right mode is whichever fits the operator's situation. The other two tiles (`Embed snippet` Copy, `Share link` Copy) are unchanged.

**DRAFT/PAUSED/STOPPED states** are unchanged from #378 R2: both buttons are disabled with state-keyed tooltips ("Activate the survey before distributing" / "Resume the survey to distribute" / "This survey is stopped — Restart to distribute").

**Why two buttons in one tile, not two separate tiles**: the audience builder + common fields are *the same* between the two paths. Surfacing them as one tile telegraphs "these share the audience step and the common fields; they diverge after." Two separate tiles would imply two independent flows and invite the operator to wonder which one the audience-builder choices belong to.

### §2. The Distribute page — single mode-parameterized page

The page lives at `/admin/surveys/[id]/distribute?mode=<self-serve|managed-acs>` — a single React component (`<DistributePage mode={...}/>`) renders for both modes. This is the same route #378 used (`/admin/surveys/[id]/distribute`) — #420 adds the `?mode=` parameter and **preserves the existing route as a mode=self-serve alias** so any in-the-wild bookmarks of #378's URL still work (they land in SELF_SERVE mode by default).

The page has **two-to-four visual states** on the same route — the first two states are mode-invariant; the third state diverges per mode:

1. **Configure** (shared shape, mode-specific composer) — audience builder + common fields + path-specific composer + Generate/Send CTA
2. **Confirm modal** (mode-specific copy)
3. **Terminal state**:
   - SELF_SERVE → **Success** (single state) — generated-success banner + format dropdown + Download CSV button
   - MANAGED_EMAIL → **Sending** → **Sent** (two-state) — per-recipient progress streaming via SSE, transitioning to summary banner when all sends terminal

Clicking the path-specific CTA transitions Configure → Confirm modal → Terminal state in place. **Audience changes are not allowed past the Configure state** — the page is locked to the audience as confirmed at submit-time. A **"Switch to `<other-mode>`"** link in the page header is available throughout the Configure state and preserves the audience + common fields, swapping only the composer.

#### §2.1 Configure state — Audience builder (shared with §3)

The audience builder is the headline UX innovation of #420 and is **shared with the existing `Send via my email tool` page** (#378's `/admin/surveys/[id]/distribute`) — both flows hand off to it. Layout:

**Two add-members cards stacked vertically** (not radio-card mutually-exclusive like #378 today):

- **Add from Existing Members** card
  - Search input with placeholder: *"Search by email, name, external ID. Wildcards supported (e.g., `*@artistos.com`, `q2-*`, `*support*`)."*
  - Wildcard grammar: `*` matches any run of characters; `?` matches a single character; non-wildcard input is substring-matched. Case-insensitive. Applied against `Member.externalId` + `Member.firstName` + `Member.lastName` (OR-joined).
  - Live results list (paginated under the search input, 25 per page) showing matching members. Each row: name · identifier · last-response date (this survey).
  - Each row has an `Add` button. The whole result set is `Add all on this page` and `Add all matching (N)`.
  - Sample-by-count / sample-by-percent (the #378 affordance) is preserved as a secondary tab on this card — *"Random sample"* — for the operator who wants "10% of all members" without searching. Mutually exclusive with the search results within this card (operator picks one at a time inside the card).
- **Add from Custom List** card
  - Same paste-textarea + `Upload CSV` toggle as #378 §2.1 today (newline / comma / semicolon separated; `Name <email>` accepted; auto-enroll checkbox per #378).
  - **Email format is always accepted, regardless of `Brand.memberIdentifierKind`** (the **Round-3 parser relaxation** — the #378 rule that pasted identifiers must match the brand's primary identifier kind is **deliberately relaxed by #420**). Rationale: brands routinely supply lists in their own segmentation tools' format (typically email) regardless of which identifier kind the brand picked in CustomerEQ. The parser detects email format, looks up via `Member.email` (an existing column on the Member model), and routes the match through three possible buckets:
    - **Matched** on the brand's primary identifier (e.g., paste was `acme-cust-001` and the brand is `external_id`-keyed) → counts as Existing in the audience list, Source chip `Existing`.
    - **Matched** on email lookup (e.g., paste was `joe@example.com` against an `external_id`-keyed brand where Member exists with that email) → counts as Existing, Source chip `Existing (via email)`.
    - **Email unmatched against a non-email-keyed brand** (e.g., paste was `unknown@somewhere.com` and the brand is `external_id`-keyed; the email doesn't match any Member's `email`) → **listed in a separate "Emails not found — cannot be auto-enrolled because Brand identifier is `<phone|external_id>`" subsection** of the audience list with a one-line recovery hint: *"Add these members in Members → New with the brand identifier first; they'll match here on the next paste."* These rows are not silently dropped — the operator gets explicit signal about why they can't be sent to and what to do about it.
  - One `Add` button at the bottom of the card parses the paste/CSV and appends rows to the unified list (instead of replacing it, like #378 today).

**Below the two cards: the unified Audience list**

- Header: *"`N` members in this wave"* (N updates as members are added/removed).
- Table columns: ☑ (checkbox, default selected) · Name · Identifier · Last response · this survey · Last response · all surveys · Source (chip: `Existing` / `Existing (via email)` / `New (will auto-enroll)` / `Email — not found` / `Skipped`).
- **Deselect**: operator can uncheck individual rows. Deselected rows are excluded from the wave but remain visible so the operator can re-select before sending.
- **Bulk actions**: `Select all on page` / `Deselect all on page` / `Remove all unchecked`.
- **Dedup**: identical identifier added twice (once from Existing, once from Custom List) appears once. The card source that won is shown in the Source chip; the duplicate is silently absorbed.
- **Pagination**: default page size **25**, alternative **50** via a select control. Pagination preserves checkbox state across pages.
- **Empty state**: *"No members added yet. Use the cards above to add members from your roster or paste a list."*

#### §2.2 Configure state — Common fields (**SHARED — both modes**)

Below the audience list, before any mode-specific composer, a **Common fields** card surfaces the two inputs that both flows need. Identical UI, identical semantics, identical persistence (both write to `DistributionBatch.surveyNameInMail` + `DistributionBatch.expiresAt`):

- **Survey name in mail** — single text input. Default: `Survey.title` (respondent-facing title per #241 R7) falling back to `Survey.name`. Max 80 chars. The operator may edit before generating/sending.
  - **SELF_SERVE path**: flows into the downloaded CSV's `surveyName` column so the brand's mail-merge template can reference it (e.g., `*|SURVEY_NAME|*` in Mailchimp). #378 §2.2 semantics, preserved.
  - **MANAGED_EMAIL path**: provides the default value for the Subject input below (composer §2.3) and is exposed as the `{{survey_title}}` mustache variable in the Body editor.
- **Links expire on** — a select with presets (24 hours / 7 days / 30 days / 90 days / Custom date+time). Default: 7 days from now, snapped to **end-of-day in `Brand.timezone`** (per #378 §2.2). Custom Date+Time opens a date-and-time picker; helper text directly below the picker reads *"All times in `<Brand.timezone>`"*. Stored on `DistributionBatch.expiresAt` as a UTC timestamp.
  - **SELF_SERVE path**: every minted token in the batch expires at this timestamp. #378 §2.2 semantics, preserved.
  - **MANAGED_EMAIL path**: same — the tokenized URL embedded in the CustomerEQ Email message expires at this timestamp. The MANAGED_EMAIL confirm-modal copy (§2.4) surfaces the expiry alongside the recipient count so the operator sees both before clicking Send.
- *(The `Auto-enroll members not in this brand` checkbox lives inside the Custom List card per §2.1; it's part of the audience builder, not a common field. Mentioned here only so reviewers don't think it's missing.)*

A **wave label** is auto-derived from `<Survey.title> · <ISO date>` (e.g., *"Q2 customer satisfaction · 2026-05-21"*) and stored on `DistributionBatch.label`. Not surfaced as an editable input on the configure page in either mode — operators rename from the batch detail page (#378 §3.1) if needed.

#### §2.3 Configure state — Composer (**Mode-specific: MANAGED_EMAIL only**)

Below the common fields, the MANAGED_EMAIL composer appears. On SELF_SERVE this card is replaced by the §2.4a Generate-Links section (no email body to compose).

**Sender block** (two side-by-side fields):
- **Sender name** — free text. Default: `Brand.displayName` (from #277 Organization Settings) or the brand name fallback. Max 50 chars. Renders in the email as the friendly From-name.
- **Sender alias** — local-part-only input. Renders next to a non-editable suffix showing the pinned CustomerEQ Email domain (e.g., the input shows *"feedback"* and the suffix shows *"@cx.acme-via-customereq.io"*). Validated as `[a-z0-9._-]+` (RFC-822 safe local-part subset). Default: `feedback`.
  - **Why the domain is non-editable**: it's the CustomerEQ-Email-verified sender domain configured at the brand level; arbitrary domains would fail SPF/DKIM/DMARC alignment and break deliverability. The domain comes from `Brand.managedEmailSenderDomain` (new column — see Data Model §A); if not set on the brand, falls back to the platform's existing-notifications sender domain (currently `AZURE_COMMUNICATION_SERVICES_EMAIL_FROM` env value — implementation detail) with an info-line *"Using shared CustomerEQ sender domain. Contact support to configure a brand-specific sender."*

**No brand-logo upload affordance on this page.** The brand logo is consumed (not produced) by the composer — the `{{brand_logo}}` mustache renders the existing `Brand.logoUrl` value (set in Organization Settings). This issue intentionally scopes only the **surfacing** of the logo in survey emails; the upload UX itself (which doesn't exist yet) is tracked separately as a future Organization Settings issue (see Non-goals). When `Brand.logoUrl` is null, `{{brand_logo}}` renders empty and the header collapses to the brand name only — graceful degradation, no operator action required.

**Email body block**:
- **Subject** — single text input. Default: the survey's respondent-facing title (`Survey.title`) prefixed by *"Quick question:"* (configurable — operator may overwrite the whole subject).
- **Body** — rich-text editor (TipTap-based to match existing rich-text usage in the codebase if any, otherwise a minimal contenteditable with bold / italic / link / bulleted list). Default body opens with a brand header block, then greeting + survey link + signature:
  ```
  {{brand_logo}}
  {{brand_name}}

  Hi {{first_name}},

  We'd love your feedback on {{survey_title}}. It takes about 2 minutes.

  {{survey_link}}

  Thanks,
  {{sender_name}}
  ```
- The `{{brand_logo}}` token renders as `<img src="<Brand.logoUrl>" alt="<Brand.displayName>" />` if `Brand.logoUrl` is present, otherwise as an empty string. `{{brand_name}}` renders as `<Brand.displayName>` (always present). Both are visible in the live preview pane so the operator sees what recipients see.
- Available mustache variables surfaced as a click-to-insert palette:
  - `{{survey_link}}` (required — the spec rejects send if the body doesn't contain at least one literal `{{survey_link}}`)
  - `{{first_name}}` / `{{last_name}}` (from `Member.firstName` / `Member.lastName`; render as empty string if null — *not* a default-to-"Customer" courtesy fallback, to avoid surprising the operator who didn't notice their roster has unfilled names)
  - `{{survey_title}}` (`Survey.title`)
  - `{{sender_name}}` (the Sender name field above)
  - `{{brand_name}}` (`Brand.displayName`)
  - `{{brand_logo}}` (`Brand.logoUrl` — renders as `<img>`, or empty if unset)
- **Footer (auto-appended)**: a non-editable footer with the unsubscribe link, mandated by CAN-SPAM §316.5 / CASL §6 / GDPR Art. 21:
  > *You received this survey because you're a member of `{{brand_name}}`'s loyalty program. [Unsubscribe](unsubscribe-link)*

  The unsubscribe-link is a tokenized URL of shape `https://<frontend-host>/u/<unsubscribe-token>`. Clicking it shows a one-click confirmation page and sets `Member.unsubscribedAt = now()`. Suppression applies to **all future CustomerEQ Email sends from this brand** (not per-survey, per CAN-SPAM convention — see Open Question OQ-3).

**Preview pane** (right column, sticky): renders the email as a recipient would see it, with merge variables resolved against a "sample recipient" (first selected member's name + identifier). Live-updates as the operator edits the body or sender fields.

#### §2.4 Configure state — Action button (mode-branching)

A single primary button at the bottom-right of the configure area. The button label and validation gate vary by mode; the placement is identical.

##### §2.4a SELF_SERVE — Generate links

Label: `Generate N links →`. Disabled until:
- Audience count (selected checkbox count) ≥ 1
- Survey name in mail (§2.2) is non-empty
- A format is chosen in the format dropdown shown directly above the button: **Generic** (default) / Mailchimp / HubSpot / Klaviyo. This controls the CSV's column-header shape (preserved from #378 §2.5 — `mergeTagUrl` column wrapping varies by format). Surfaced earlier (at the composer level) for SELF_SERVE because the format choice fundamentally shapes the CSV; the MANAGED_EMAIL path has no equivalent since CustomerEQ owns the dispatch.

Clicking starts a Prisma transaction that creates the `DistributionBatch` (with `sendMode = SELF_SERVE` + null `composerSnapshot`), mints tokens, writes `SurveyDistribution` rows (with `sentAt = NULL` at this point — the Sent timestamp is set later when the operator clicks Download CSV), and transitions the page to the Success state (§2.6a). Same atomic-write semantics as #378 §2.4. `Survey.sentCount` is **not** incremented here — that increment happens on Download CSV (see §2.6a Sent-semantics info banner).

##### §2.4b MANAGED_EMAIL — Send

Label: `Send N emails →`. Disabled until:
- Audience count (selected checkbox count) ≥ 1
- Survey name in mail (§2.2) is non-empty
- Sender name (§2.3) is non-empty
- Sender alias matches `[a-z0-9._-]+`
- Subject is non-empty
- Body contains at least one literal `{{survey_link}}` token

Clicking does NOT immediately enqueue; it opens the confirmation modal (§2.5) first.

#### §2.5 Confirmation modal (**mode-specific copy, shared shape**)

The modal shape is identical across modes (same layout, same dismiss/confirm button placement); only the copy varies. The summary table inside the modal echoes back the audience count, common fields (`Survey name in mail`, `Links expire on`) and mode-specific fields so the operator gets a single-screen recap before committing.

##### §2.5a SELF_SERVE confirmation copy

> **Generate `N` tokenized links for `<wave label>`?**
>
> Survey name in mail: `<surveyNameInMail>`
> Links expire: `<expires-at>` `<Brand.timezone>`
> Format: `<Generic | Mailchimp | HubSpot | Klaviyo>`
> Recipients: `N` selected members (auto-enrolling `K` new members)
>
> **⚠ The plaintext URLs are shown only once.** Save the CSV immediately. Re-downloading later requires regenerating all tokens (which invalidates the URLs in this batch).
>
> [Cancel] [Yes, generate `N` links]

(Strong warning preserved from #378 §2.5 / §3.1 — Q1.1c semantics.)

##### §2.5b MANAGED_EMAIL confirmation copy

> **Send `N` emails for `<wave label>`?**
>
> From: `<sender-name>` `<sender-alias>@<acs-domain>`
> Subject: `<subject>`
> Survey name in mail: `<surveyNameInMail>`
> Links expire: `<expires-at>` `<Brand.timezone>`
> Recipients: `N` selected members (auto-enrolling `K` new members)
>
> Emails will be sent in the next few minutes. You can monitor progress on the next screen but **you cannot cancel a send in progress**.
>
> [Cancel] [Yes, send `N` emails]

On confirm, the page transitions in place to the mode-appropriate Terminal state (§2.6a or §2.6b).

#### §2.6 Terminal state (mode-branching)

##### §2.6a SELF_SERVE — Success: Download CSV

(Inherits #378 §2.5 verbatim — same banner, same warning, same format dropdown, same download button. Briefly restated for completeness; Sent semantics clarified in the trailing block.)

- **Success banner**: *"✓ Generated `N` links — `<wave label>`. Tokens expire `<absolute date+time>` `<Brand.timezone>`."*
- **One-wave-one-response explanatory line**: *"Users will be able to respond only once in this wave. A leaked or re-clicked link gets the 'already submitted' state."*
- **Sent-semantics info banner** (info-styled, between the explanatory line and the strong warning): *"📤 Self-serve hands the operator a CSV they paste into their own email tool — the platform marks each member's `SurveyDistribution.sentAt` at the moment of CSV download (i.e., downloading the CSV is the operator-side dispatch-handoff moment). The Survey's `sentCount` is incremented by these N rows; these members show as Sent in the Loop Monitor (§4) and in the Batch Details Sent counter (§3.2). **If you Regenerate later** via the Batch Details page: the regeneration replaces the tokens but updates the `sentAt` timestamp on every row — so the Sent count reflects the most recent dispatch handoff, not the original. Members who already responded keep their `respondedAt` independently."*
- **Strong warning banner** (amber-styled): *"⚠ Save this CSV now. The plaintext URLs are shown only once. Re-downloading later requires regenerating all tokens — which invalidates the URLs in this batch."*
- **Format dropdown** (Generic default · Mailchimp · HubSpot · Klaviyo) + **`⬇ Download CSV`** button.
- **`Done — back to survey →`** link.

**`Survey.sentCount` write semantics for SELF_SERVE batches**: incremented by `tokenCount` at the moment the operator clicks Download CSV (the dispatch-handoff event). Re-incremented on Regenerate Links from the Batch Details page (§3.2) — every row in the batch has its `sentAt` updated to the new download timestamp, and the Survey-level counter reflects the new dispatch. This is the deliberate deviation from a "minted-once-counted-once" semantic: for Self-serve, the operator's act of taking the CSV is the platform-observable Sent moment.

##### §2.6b MANAGED_EMAIL — Sending → Sent

Two sub-states on the same surface:

**Sending state**
- **Progress banner** (info-styled): *"Sending `N` emails… `K` of `N` complete"* with a live progress bar. Updates via Server-Sent Events from a `GET /v1/surveys/:id/distribution-batches/:batchId/send-progress` endpoint that streams `progress` events.
- **Per-recipient status table** (paginated 25/50): Name · Identifier · Status (`Queued` / `Sending` / `Sent` / `Failed: <reason>`) · Sent / failed at timestamp.
- **Send-failure handling**: failed rows show `Failed: <short reason>` (`Failed: bounce`, `Failed: invalid address`); suppressed rows show `Skipped: unsubscribed` / `Skipped: no consent` and are **not retryable**. A `Retry failed →` button at the top retries any non-suppressed failed rows.

The page does NOT auto-redirect to Sent state; the operator clicks `Done — back to survey →` when they're satisfied. Closing the browser is safe — the worker continues processing the queue. `Survey.sentCount` is incremented per-recipient by the worker as the managed email provider confirms each delivery.

**Sent state** (when all per-recipient sends are terminal):
- Progress banner becomes a **summary banner** (success-styled if `failedCount === 0`, warn-styled otherwise): *"✓ Sent `K` of `N` emails. `M` failed."*
- The per-recipient status table remains visible (same Retry-failed affordance).
- `Done — back to survey →` returns to `/admin/surveys/[id]`.

#### §2.7 Returning later

Re-opening either mode of `/admin/surveys/[id]/distribute?mode=...` after a terminal state opens the page in **Configure state** with the audience reset. The previous batch is now a historical `DistributionBatch` accessible from the survey detail page's batch filter (per #378 §3) — the mode pill on the batch list distinguishes Self-serve from CustomerEQ Email batches.

### §3. `Send via my email tool` page (#378) — now a `mode=self-serve` instance of the shared component

There is no longer a "separate #378 page reshape" in #420 — the shared `<DistributePage mode={...}/>` component IS the #378 page at `mode=self-serve`, and IS the #420 page at `mode=managed-acs`. The page-level structure is whatever §2.1 → §2.2 → §2.3/§2.4a → §2.5 → §2.6 prescribes for the chosen mode.

To make this concrete, the SELF_SERVE instance — what #378 operators see after #420 ships — consists of:

1. **Audience builder** (§2.1, SHARED) — replaces #378's existing mutually-exclusive radio-card mode chooser. The new merged-and-deduped list with per-row deselect and wildcard search is a strict superset: an operator who wants today's #378 behavior simply leaves one of the two add-cards empty.
2. **Common fields** (§2.2, SHARED) — `Survey name in mail` + `Links expire on`. Identical UI to today's #378 §2.2 (text input + select with the same presets); the only change is that the card is now visually a sibling of the audience builder rather than embedded inside a wizard step.
3. **No composer card** (composer is MANAGED_EMAIL-only).
4. **Format dropdown + `Generate N links →` CTA** (§2.4a) — preserved from #378 §2.4, repositioned to sit immediately below the common fields card.
5. **Confirmation modal** (§2.5a) — preserved warning copy from #378 R3 about plaintext URLs being shown only once.
6. **Success state** (§2.6a) — preserved from #378 §2.5 verbatim (banner + warning + format dropdown + Download CSV + Done link).

What changes for the existing #378 operator (a marketing manager who's been using the distribute page) is enumerated in `Backward Compatibility & Migration` below. The deliberate breaking change (mutually-exclusive radio cards → merged deduped list) is justified by Customer Problem #2 above.

#### §3.1 Backward Compatibility & Migration

- **Bookmarked URL `/admin/surveys/[id]/distribute`** (no `?mode=` query param) → defaults to `mode=self-serve`. Existing bookmarks land on the SELF_SERVE flow that's their continuation; they're not greeted with a confusing managed-email composer.
- **Existing `DistributionBatch` rows** → backfill `sendMode = SELF_SERVE` (every batch created before #420 was by definition a #378 self-serve batch). Migration is data-only; no code path differences.
- **Existing API endpoints** (`POST /v1/surveys/:id/distribution-batches`, etc.) → preserve their bodies and semantics, **extended** with a `sendMode` discriminator (R5 design decision — no new endpoint). Calls without `sendMode` default to `SELF_SERVE` (preserves the #378 contract verbatim for any in-the-wild integrators). Calls with `sendMode = MANAGED_EMAIL` carry the new `composer: {...}` block in the body (see API Endpoints §) and trigger the dispatch worker.
- **The deprecated `Send via my email tool →` tile** (today's single-CTA primary tile per `DistributionSection.tsx:107-152`) → replaced by the two-button "Send via Email" tile in §1.

#### §3.2 The mode-aware batch detail page (Wave Detail) (#378 §3.1)

The existing batch detail page at `/admin/surveys/[id]/distribute/batches/[batchId]` — referred to informally as the *Wave Detail page* — gains a **mode pill** at the top (`Self-serve` / `CustomerEQ Email`) and a **5-counter strip** above the existing #378 sections: `Sent · Awaiting response · Responded · Failed · Expired`. The Sent counter is new (#420); the others preserve #378 §3.1's existing counters. Per-mode behavior:

**SELF_SERVE batches — Wave Detail preserves #378 §3.1 verbatim:**
- 5-counter strip with Sent = the most recent CSV-download row count; Failed shown as `—` with a sub-note *"n/a for Self-serve (no platform dispatch)"* — accurate to the dispatch model.
- **Audience Spec block** — mode, members-at-send-time, members-now, survey name in mail, links-expire-on, format chosen, created-by/at. Identical to #378.
- **Expiry control** (Edit Expiry) — identical to #378 §3.1; new value can be earlier or later than current while survey is ACTIVE.
- **Tokens table** — paginated by status (Awaiting / Responded / Expired), identical to #378.
- **Regenerate Links + Download CSV affordance** — format dropdown (Generic / Mailchimp / HubSpot / Klaviyo) + button — **fully preserved** from #378 §3.1. On click: mints fresh tokens for every member in the batch (responded members keep their `respondedAt`; their token row gets a new hash/prefix but the response stays attributed); invalidates previous URLs; downloads a new CSV. **Sent semantic update**: every row's `sentAt` is set to the regeneration timestamp; Survey-level `sentCount` re-increments to reflect the new dispatch handoff. This is the deliberate operator-error-recovery semantic from #378 §2.5 Q1.1c.
- Bottom warning: *"No platform-side send log for Self-serve batches. The operator's own email tool dispatched these — CustomerEQ does not have per-recipient delivery confirmations."*

**MANAGED_EMAIL batches — Wave Detail adds platform-dispatch surfaces:**
- 5-counter strip with Sent = the count of `SurveyDistribution` rows that have `sentAt IS NOT NULL` (i.e., the managed email provider confirmed delivery); Failed shows the count of rows in `failureReason IS NOT NULL` state.
- **Same Audience Spec block** as SELF_SERVE.
- **Same Expiry control** as SELF_SERVE.
- **Tokens table**, augmented per-row with the new `sentAt` / `failedAt` / `failureReason` columns (one of these is always populated post-dispatch).
- **New: Composer snapshot block** (read-only) — shows the operator's saved sender + subject + body + brand-logo-URL at send time (from `DistributionBatch.composerSnapshot`). Lets operators audit exactly what was sent for a given wave.
- **New: Per-recipient send log block** — Sent / Failed timestamps + failure reason for failed rows. Same shape as the Sending-state recipient table (§2.6b), but persistent and historical.
- **Regenerate-Links + download CSV is hidden** for `MANAGED_EMAIL` batches — there's no CSV to re-download; the emails are the only artifact, and re-sending semantics intersect with `Member.unsubscribedAt` in ways deliberately outside V0. V1 candidate: *"Re-send to failed recipients only"* — see Non-goals.

### §4. Sent-count surfacing on the survey detail page

`Survey.sentCount` is a lifetime aggregate (one survey → many batches, many sends). It surfaces in **two places** on the survey detail page (`/admin/surveys/[id]`), and **deliberately not** in the Configuration Summary section.

#### §4.1 Loop Monitor (lifetime pipeline, #241 R32b)

The Loop Monitor section gains a **Survey Sent** stat-card at the leftmost position of its existing 4-card grid:

> **Survey Sent**: `N` &nbsp;&nbsp; *(sub-line:* `K` via CustomerEQ Email · `M` via my email tool *)*

- The big number `N` is `Survey.sentCount` (sum across both modes, lifetime — i.e., every batch ever created on this survey).
- The sub-line breaks down by `DistributionBatch.sendMode` aggregated through `SurveyDistribution.sendMode` (which mirrors the parent batch's mode for fast aggregation without a join).
- **Loop Monitor stays lifetime-wide regardless of the Wave filter** in the Responses section below (per #378 §3 design — the per-batch slicing belongs to Responses, not the lifetime pipeline view).

The other three stat-cards in the Loop Monitor — Responses Received, Closed-loop Actions, P75 Time-to-Action — are preserved from #241 R32b without modification.

#### §4.2 Responses section header

The Responses section gains a **header strip** that surfaces Sent count alongside the existing Wave-filtered response count:

> **Survey Sent**: `N` &nbsp; *(lifetime · not affected by Wave filter)* &nbsp; **|** &nbsp; **Responses**: `R of N` &nbsp; *(`P%` · changes with the Wave filter on the right)* &nbsp; *[Wave filter dropdown]*

- The Sent value sits **before** the filtered response count (left of the divider), so the operator anchors on lifetime Sent first, then narrows Responses by Wave.
- The Wave filter dropdown (preserved from #378 §3) still scopes the Responses section's table below; the strip's response count updates accordingly. The Sent number does **not** change when the operator picks a specific Wave (Sent is a lifetime stat anchored above the filter).
- When the operator picks a specific Wave, the response count display reads e.g., *"Responses: 2 of 5 (40% · Wave: Q2 2026 NPS · 2026-05-21)"*; selecting *"All waves & direct responses"* reads e.g., *"Responses: 4 of 11 (36% · lifetime)"*.

#### §4.3 Configuration Summary is **stat-counter-free**

The Configuration Summary section (#241 R28) keeps its existing rows — Survey type, Status, Response policy, Member identifier kind, Created by/at — and **does not** gain a Sent line. Configuration is what was *configured* on this survey; stat counters live in Loop Monitor (lifetime) and Responses (Wave-filtered). An explicit footer note on the Configuration Summary section reads: *"Configuration Summary is what was configured on this survey. Stat counters (Sent / Responses / Closed-loop Actions) live in the Loop Monitor and Response section above — not here."*

### §5. The respondent's experience

Unchanged from #378 §4. The tokenized URL embedded in the CustomerEQ Email message lands on `/survey/<surveyId>/r/<token>`; the form renders without member-identification (the token resolves the member); error states (`expired`, `responded`, `survey-not-open`, `invalid`) are the same.

The only addition is the **unsubscribe page** at `/u/<unsubscribe-token>`:
- One-click confirmation: *"Are you sure you want to stop receiving survey emails from `<brand_name>`? You can resubscribe by contacting `<brand_name>` directly."*
- `[Yes, unsubscribe]` → `Member.unsubscribedAt = now()`, page transitions to a success state.
- No PII shown on the unsubscribe page (matches #378 §4's no-PII-in-error-states stance).

## Data Model

### A. New: `Brand.managedEmailSenderDomain` column

```prisma
model Brand {
  // ... existing fields ...
  managedEmailSenderDomain   String?  // operator-configurable CustomerEQ-Email-verified sender domain (e.g., "cx.acme-via-customereq.io"). Null → falls back to platform default. (Underlying provider verification today is via Azure Communication Services — implementation detail; the column is provider-agnostic.)
}
```

Migration: backfills null for all existing brands. The platform-default fallback (env `AZURE_COMMUNICATION_SERVICES_EMAIL_FROM`'s domain) preserves the current behavior for any pre-existing notification sends.

### B. New: `DistributionBatch.sendMode` enum

```prisma
enum SendMode {
  SELF_SERVE      // #378 path — operator downloads CSV, sends via their own ESP
  MANAGED_EMAIL     // #420 path — CustomerEQ Email (the platform sends the email via the configured email provider in packages/connectors/src/email.ts)
}

model DistributionBatch {
  // ... existing fields from #378 ...
  sendMode  SendMode  @default(SELF_SERVE)
}
```

Backfill: existing rows get `SELF_SERVE` (every batch created before #420 was a #378 self-serve batch by definition).

### C. New: `DistributionBatch.composerSnapshot` (Json, MANAGED_EMAIL-only)

For `MANAGED_EMAIL` batches, the operator's composer inputs are snapshotted on the batch so the per-recipient send job can render the email body without re-reading mutable brand state. The snapshot also drives the *Composer snapshot* read-only block on the Wave Detail page (§3.2).

```jsonc
{
  "senderName": "Acme CX Team",
  "senderAlias": "feedback",
  "senderDomain": "cx.acme-via-customereq.io",
  "subject": "Quick question: Q2 NPS",
  "body": "{{brand_logo}}\n{{brand_name}}\n\nHi {{first_name}},\n\nWe'd love your feedback on {{survey_title}}…",
  "footerTemplate": "You received this survey because…",
  "brandLogoUrl": "https://customereq-cdn.example.com/logos/acme.png"  // snapshot of Brand.logoUrl at send time; if null/empty, the header collapses to brand name only
}
```

Null for `SELF_SERVE` batches.

**Note on `Brand.logoUrl`**: this column is assumed to exist (or will be added as part of the brand-profile data model — outside this issue's scope). #420 only **consumes** the logo URL in the composer snapshot + worker render path; the upload UX that *produces* the logo URL is tracked separately. See Non-goals.

### D. New: `SurveyDistribution.sentAt` semantics + `sendMode` mirror

The existing `SurveyDistribution.sentAt` today marks "we minted a token for this member" (i.e., creation time of the distribution row). #420 makes the semantic precise per send mode:

- **`enqueuedAt`** (new) — when the per-recipient BullMQ send job was enqueued. Set on batch generate (`MANAGED_EMAIL`) or remains null (`SELF_SERVE` — there is no enqueue).
- **`sentAt`** (semantic change) — the **dispatch-handoff timestamp**, with mode-specific definition:
  - For `SELF_SERVE` batches: set to the moment the operator clicks **Download CSV** on the Success state (§2.6a). The dispatch handoff is when the operator takes the CSV — not when the row was minted. Re-set (overwritten) every time the operator clicks **Regenerate Links + Download CSV** on the Wave Detail page (§3.2) — so `sentAt` reflects the most recent dispatch event, not the original mint time.
  - For `MANAGED_EMAIL` batches: set by the worker when the managed email provider's send confirmation returns success (i.e., `EmailClient.beginSend().pollUntilDone()` resolved to `status=succeeded`). Set once; not overwritten on subsequent operations.
- **`failedAt`** + **`failureReason`** (new) — set when the managed email provider returned non-success or threw. Mutually exclusive with `sentAt` on the same row. `SELF_SERVE` rows never enter this state (the platform did not dispatch).
- **`sendMode`** (new mirror of the parent batch's mode) — denormalized for fast `Survey.sentCount` aggregation per mode without a join.

### E. New: `Member.unsubscribedAt` column

```prisma
model Member {
  // ... existing fields ...
  unsubscribedAt  DateTime?  // global suppression — set when member clicks unsubscribe in any CustomerEQ Email message
}
```

Per-survey unsubscribe is **not** in V0 (see Open Question OQ-3). The suppression flow applies brand-wide.

### F. New: `MemberUnsubscribeToken` table

```prisma
model MemberUnsubscribeToken {
  id          String    @id @default(cuid())
  brandId     String
  memberId    String
  member      Member    @relation(fields: [memberId], references: [id])
  tokenHash   String    @unique  // SHA-256 of the plaintext; mirrors NFR-S2 from #378
  tokenPrefix String              // first 8 chars for audit/display
  createdAt   DateTime  @default(now())
  consumedAt  DateTime?            // set when the unsubscribe is confirmed
  @@index([memberId])
  @@map("member_unsubscribe_tokens")
}
```

One token per (brandId, memberId, batchId) tuple, minted at send-time and embedded in the email footer's unsubscribe link.

### G. New: `Survey.sentCount` column (denormalized aggregate)

```prisma
model Survey {
  // ... existing fields ...
  sentCount  Int  @default(0)
}
```

Incremented per mode:
- **SELF_SERVE**: `+= tokenCount` when the operator clicks **Download CSV** on the Success state — the dispatch-handoff moment. Re-incremented by `tokenCount` again whenever the operator clicks **Regenerate Links + Download CSV** from the Wave Detail page (each Regenerate is a fresh dispatch event from the platform's point of view).
- **MANAGED_EMAIL**: `+= 1` per worker job that transitions a `SurveyDistribution` row into the `sentAt IS NOT NULL` state (i.e., per-recipient as the managed email provider confirms each delivery).

Decremented on batch deletion (defensive, in case of admin cleanup).

**Surfacing** (see §4): the lifetime aggregate appears in the Loop Monitor's Survey Sent stat-card and in the Responses section header. The mode breakdown sub-line is computed on read from `SurveyDistribution.sendMode` aggregation (not denormalized to columns to avoid backfill complexity).

## API Endpoints

### Extended: `POST /v1/surveys/:id/distribution-batches` (single endpoint, `sendMode` discriminator)

**Round-5 design decision**: rather than a new `send-via-customereq-email` route, the existing #378 endpoint is extended with a `sendMode` discriminator. This keeps `#378`'s contract identical for existing self-serve callers (missing `sendMode` → defaults to `SELF_SERVE`) and adds the MANAGED_EMAIL path as an additive shape on the same endpoint.

```jsonc
{
  "surveyNameInMail": "Q2 NPS",     // optional; defaults to Survey.title
  "expiresAt": "2026-05-28T23:59:00Z",
  "audience": {                      // SHARED across modes post-#420 reshape
    "members": [
      { "memberId": "mbr_x", "source": "existing" },
      { "identifier": "new@example.com", "source": "custom_list", "willAutoEnroll": true },
      { "identifier": "joe@example.com", "source": "custom_list", "matchedVia": "email" }   // Round-3 parser-relaxation surface
    ]
  },
  "sendMode": "SELF_SERVE",           // optional; defaults to SELF_SERVE if omitted (#378 contract preserved)
  "format": "generic",                // REQUIRED when sendMode === SELF_SERVE — chooses CSV column-header shape
  "composer": {                       // REQUIRED when sendMode === MANAGED_EMAIL
    "senderName": "Acme CX Team",
    "senderAlias": "feedback",
    "subject": "Quick question: Q2 NPS",
    "body": "{{brand_logo}}\n{{brand_name}}\n\nHi {{first_name}}, …"
  }
}
```

**Handler** (mode-branching):

1. Validate audience (resolve existing IDs by brand-primary identifier; resolve emails by `Member.email` lookup for the Round-3 relaxation; auto-enroll new identifiers per #378 semantics; surface unresolvable-emails-against-non-email-keyed-brand under a separate `unmatchedEmails` field).
2. If `sendMode = MANAGED_EMAIL`: validate composer (body contains `{{survey_link}}`; sender alias matches `[a-z0-9._-]+`; sender domain resolved from `Brand.managedEmailSenderDomain` or platform fallback).
3. In a single Prisma transaction:
   - Create `DistributionBatch` with the appropriate `sendMode` + `composerSnapshot` (null for SELF_SERVE; populated with the composer fields + a snapshot of `Brand.logoUrl` for MANAGED_EMAIL).
   - Mint one `SurveyDistributionToken` per recipient (existing #378 logic).
   - For MANAGED_EMAIL only: mint one `MemberUnsubscribeToken` per recipient (one per send wave).
   - Write `SurveyDistribution` rows: `SELF_SERVE` rows have `sentAt = NULL` at this point (Sent timestamp is set on CSV-download, not here); `MANAGED_EMAIL` rows get `enqueuedAt = now()`.
4. After transaction commits, mode-branch:
   - **SELF_SERVE**: return `201` with the batch ID + the plaintext token URLs in the response body. The caller (admin UI) materializes the CSV from this body and triggers download. **The Survey's `sentCount` is incremented + every row's `sentAt` is set when a separate `POST .../distribution-batches/:batchId/mark-csv-downloaded` endpoint is called by the UI on the actual download click** (see endpoint below).
   - **MANAGED_EMAIL**: enqueue one BullMQ job per recipient on the `survey-distribution-send` queue. Return `201` with the batch ID + `progressStreamUrl`. (No plaintext URLs are returned in the response — they are rendered server-side per-recipient by the worker; the operator never handles them.)

### New: `POST /v1/surveys/:id/distribution-batches/:batchId/mark-csv-downloaded` (SELF_SERVE)

Marks the dispatch-handoff event for a SELF_SERVE batch. Called by the UI when the operator clicks Download CSV (Success state §2.6a) or Regenerate Links + Download CSV (Wave Detail §3.2). Idempotent — repeated calls update `sentAt` to the latest call's timestamp; `Survey.sentCount` is **not** double-incremented (the increment happens only on transitions of `sentAt` from `NULL` → `<timestamp>`, not on `<timestamp>` → `<later-timestamp>` re-writes for the same row).

Returns `200` with `{ batchId, sentAt, sentCount: <updated Survey.sentCount> }`.

(Alternative considered: have the GET-CSV-rendering endpoint side-effect the `sentAt`. Rejected because GETs should be idempotent and side-effect-free; making the explicit POST is cleaner.)

### New: `GET /v1/surveys/:id/distribution-batches/:batchId/send-progress` (Server-Sent Events)

Streams `progress` events while the batch has unfinished sends. Event payloads include cumulative counts (`queuedCount`, `sentCount`, `failedCount`) and the most recent per-recipient transition. Closes when all sends are terminal.

### New: `POST /v1/surveys/:id/distribution-batches/:batchId/retry-failed`

Re-enqueues per-recipient send jobs for any `SurveyDistribution` rows in failed state on this batch. Unsubscribed-suppression failures are silently filtered out (cannot be retried). Returns the count re-enqueued.

### New: `GET /u/:token` (public) + `POST /u/:token/confirm` (public)

- `GET` renders the unsubscribe page (HTML, no auth, no PII other than `Brand.displayName`).
- `POST /confirm` sets `Member.unsubscribedAt = now()` and marks the `MemberUnsubscribeToken` as consumed. Idempotent — repeated POSTs are no-ops after the first.

### New: search endpoint extension: `GET /v1/members?q=<wildcard>`

The existing `GET /v1/members` (used to populate the member-list page) gains wildcard semantics on the `q` query param:
- `q=*@artistos.com` → matches all members whose externalId ends with `@artistos.com` (after wildcard translation: `LIKE '%@artistos.com'`).
- `q=q2-*` → matches all members whose externalId starts with `q2-`.
- `q=customer` (no wildcards) → substring match (LIKE `%customer%`), unchanged from today.

**Implementation**: convert `*` → `%` and `?` → `_` after escaping SQL LIKE specials (`%`, `_`, `\`) in the operator's literal characters. The Distribute page's Existing-Members search consumes this endpoint with `pageSize=25`.

## Architecture / Event-Driven Compliance

Per project_rules.md **Rule 5 — Event-Driven First**: loyalty actions go through BullMQ; direct synchronous writes from the API are forbidden. CustomerEQ Email sends are emails, not loyalty actions, so Rule 5 doesn't strictly apply — but the *spirit* of Rule 5 (async dispatch, bounded request latency) is upheld by:

1. The batch-create handler returns `201` immediately after the DB transaction; the per-recipient email sends are enqueued, not awaited.
2. A new BullMQ queue `survey-distribution-send` carries one job per recipient. Concurrency is bounded (initial: 5 concurrent workers per process — reviewable based on the provider's throughput limits).
3. Per-job retry policy (BullMQ-native): exponential backoff on transient failures (network error, provider 5xx). Hard failures (invalid address, unsubscribed) skip retry and land in Failed state.
4. **Implementation note (not operator-facing)**: the worker uses the existing `packages/connectors/src/email.ts:sendEmailMessage` function, which today is implemented against Azure Communication Services and switched via the `EMAIL_PROVIDER=azure-communication-services` env. We augment it with a per-call `senderAddress` override (today it's read from env; the override lets us pass the per-batch composer's sender alias + domain). This is a small backward-compatible change to the connector. The choice of provider is a deployment detail, not exposed in any operator-facing surface — switching to SendGrid / Resend later would not change any spec-described UX.

`docs/architecture/architecture.md` design-standards source: applied — admin-facing UI follows the standard CRUD pattern (existing `/admin/surveys/[id]/*` subroute convention).

## Compliance Requirements

Project rules.md Rule 13 codifies GDPR/CCPA + Rule 23 codifies bulk-import consent semantics. (`fraim/config.json` does have `compliance.regulations` configured: GDPR / CCPA in-scope, SOC2 month-12, PCI-DSS minimal-scope.) The CustomerEQ Email send path adds these obligations:

### 13.1 — `Member.consentGivenAt` enforcement at dispatch

Every `survey-distribution-send` worker job MUST check `Member.consentGivenAt IS NOT NULL` before dispatching. If null, the job lands in Failed state with reason `Skipped: no consent`. Rule 23 (bulk-import carve-out) does NOT apply — Rule 23 governs historical-import processors, not live operator sends.

### 13.2 — `Member.unsubscribedAt` suppression

Every `survey-distribution-send` worker job MUST check `Member.unsubscribedAt IS NULL` before dispatching. If non-null, Failed state with reason `Skipped: unsubscribed`. Suppression is global (brand-wide, not per-survey) per OQ-3 default.

### 13.3 — CAN-SPAM §316.5 / CASL §6 mandatory footer

The composer's appended footer (operator cannot remove) must contain:
- The brand's legal name (`Brand.displayName`).
- A one-click unsubscribe link (the `/u/<token>` endpoint).
- No PII other than the recipient's name (rendered via `{{first_name}}` / `{{last_name}}` if present in body).

### 13.4 — GDPR Art. 21 right-to-object

The unsubscribe flow IS the operator's GDPR right-to-object mechanism. `Member.unsubscribedAt` MUST persist across surveys, brands' programs, and time. Future sends from the same brand to the same member are suppressed.

### 13.5 — GDPR Art. 5(1)(c) data minimization

The CustomerEQ Email message body MUST NOT contain PII other than the recipient's first/last name and the survey link. Composer validation rejects body content matching email-address patterns, phone-number patterns (rough regex; not bullet-proof) — the platform tries to catch *"Hi `{{first_name}}`, your account is associated with `external_id_12345`…"* leakage by warning the operator. Hard-reject is too strict; warn-on-validate is the V0 stance.

### 13.6 — Audit logging

Every `MANAGED_EMAIL` batch creation + every per-recipient CustomerEQ Email send + every unsubscribe confirmation writes an `AuditLog` row with appropriate action / actorUserId / resourceType / metadata. Audit allowlist is documented per-handler in the new endpoints' `auditAllowlist` config (matches the existing pattern in `apps/api/src/routes/distributionBatches.ts`).

## Validation Plan

### Browser (Playwright per Rule 14)

E2E test scenarios:
1. **Happy path managed-email send**: Configure audience (3 existing + 2 custom-list with auto-enroll) → compose → confirm modal → progress → all sent. Verify `Survey.sentCount === 5`, `DistributionBatch.sendMode === MANAGED_EMAIL`, all `SurveyDistribution.sentAt` populated. ACS connector stubbed in test env (`EMAIL_PROVIDER=stub`); test asserts `sendEmailMessage` was called per-recipient with correct merged body.
2. **Audience merge + dedup**: Add member X via Existing, add member X again via Custom List (same email). Verify the audience list shows X exactly once with `Existing` source chip. Send and verify exactly one ACS call to X.
3. **Per-row deselect**: Add 5 members, deselect 2 via checkbox. Send. Verify exactly 3 ACS calls (the 3 still-checked members).
4. **Wildcard search**: Brand has members `alice@artistos.com`, `bob@artistos.com`, `carol@others.com`. Search `*@artistos.com`. Verify 2 results (alice + bob). Search `q2-*`. Verify no results (no matches; empty state).
5. **Unsubscribe flow**: Send to member X. Click the unsubscribe link in the test-captured ACS payload. POST `/u/<token>/confirm`. Verify `Member.unsubscribedAt` is set. Send another batch including X. Verify X's `SurveyDistribution` row is in Failed state with reason `Skipped: unsubscribed`.
6. **Composer validation**: Try to Send with body missing `{{survey_link}}`. Verify Send button stays disabled + validation message. Try sender alias `Feedback Team` (space, illegal). Verify rejected.
7. **Send-progress SSE**: Send 10 emails. Verify the progress page receives `progress` events with monotonically increasing `sentCount`. Verify the stream closes when terminal.
8. **Retry-failed**: 5 emails: 4 succeed, 1 fails (test stubs a transient ACS failure). Click `Retry failed`. Verify the failed row transitions back to Queued and eventually Sent.
9. **#378 path preserved**: Existing `/admin/surveys/[id]/distribute` → audience builder is shared but Composer is replaced by the existing #378 Common-fields + Generate-CSV flow. Verify CSV download works as today.

### API integration (per Rule 11)

- `POST /v1/surveys/:id/distribution-batches/send-via-acs` with malformed composer (missing `{{survey_link}}`) → 422 `INVALID_COMPOSER`.
- `POST /.../send-via-acs` with audience overlapping an unsubscribed member → 201 success, but that member's `SurveyDistribution` row is created in Failed state with `failureReason='Skipped: unsubscribed'`.
- `GET /v1/members?q=*@artistos.com` → returns expected paginated results.
- `POST /u/<token>/confirm` is idempotent (second call is a no-op, not an error).

### Compliance validation

- Rule 13.1: integration test sends to a member with `consentGivenAt = null`. Verify the worker's outcome is `Skipped: no consent`, not `Sent`.
- Rule 13.2: integration test (above) covers unsubscribe suppression.
- Rule 13.3: snapshot test on the rendered email footer asserts brand legal name + unsubscribe link presence.
- Rule 13.5: composer validation unit-tests assert body containing `bob@example.com` triggers a warning (warn-on-validate).
- Rule 13.6: audit-log snapshot test asserts batch-create, per-recipient-send, and unsubscribe-confirm each write expected rows.

## Alternatives

| Alternative | Why discard? |
|---|---|
| **Build a SendGrid / Resend integration instead of reusing the existing email connector.** | The existing email connector at `packages/connectors/src/email.ts` is already provisioned (currently against Azure Communication Services) for notification emails. Adding a second provider doubles the connector surface for no incremental customer value — operator-facing UX is identical regardless of provider. Could be considered for V1 if the current provider's deliverability proves insufficient; the operator-facing label "CustomerEQ Email" is intentionally provider-agnostic so such a swap is transparent. |
| **Tokenless email — embed `Member.email` in the unsubscribe URL.** | Violates #378's no-PII-in-URLs invariant (Rule 13.5) and is exactly the failure mode #378 retired the `?email=` query param to fix. The tokenized unsubscribe approach mirrors the tokenized survey-respond approach. |
| **Send synchronously inside the HTTP request, no BullMQ queue.** | Bounded request latency requires queueing. A 1,000-recipient send at ~200ms per provider call is ~3.3 minutes — the HTTP request would time out, the operator would refresh and re-trigger, partial sends would cause duplicate emails. Per-recipient queueing is the only sane shape for batches >50. |
| **Per-survey unsubscribe instead of brand-wide.** | Brand-wide matches CAN-SPAM / CASL convention and operator expectation. Per-survey unsubscribe is technically possible but rare in practice — most ESPs (Mailchimp, Klaviyo, HubSpot) maintain a brand-wide suppression list. See OQ-3 — if user prefers per-survey, switch trivially. |
| **Per-batch sender domain (operator picks `acme.com` or `acme-cx.io` per send)** | Each domain needs DKIM/SPF/DMARC verification — operator-side DNS surgery. Out of scope for V0. The brand-level `Brand.managedEmailSenderDomain` (admin-configured, not per-send) is the right granularity for V0. |
| **Mid-flight cancel of a batch send.** | The BullMQ queue is consumed by 5 concurrent workers; canceling means pausing the queue + draining in-flight jobs. Complexity outweighs benefit at the V0 scale — most batches will be <500 recipients and complete in <2 minutes. If a batch must be aborted, the operator pauses the survey (`Survey.status = PAUSED`) — pending worker jobs will see the status check and skip. V1 may add explicit cancel. |
| **Real-time "I see who clicked" view.** | Out of scope for V0. Open-rate / click-rate analytics is a separate analytics initiative (see #41 Closed-loop Alerting for the broader analytics direction). |

## Competitive Analysis

### Configured Competitors Analysis

*Note: `fraim/config.json.competitors` is configured per #378 R3-30 but is not refetched here as a context-loading step.*

| Competitor | Current Solution | Strengths | Weaknesses | Customer Feedback | Market Position |
|---|---|---|---|---|---|
| **SurveyMonkey** | Built-in *Email Invitation* feature: operator picks audience from contacts, composes via WYSIWYG, schedules send. | Mature: address validation, autocomplete merge tags, A/B subject lines, scheduled send. Sends from `surveymonkey.com` subdomains. | No per-brand sender domain — every survey from every brand sends from `surveymonkey.com`. Deliverability handled by SurveyMonkey, not operator. | Operators praise the ease; CX-mature brands chafe at the *"sent from surveymonkey"* visual when their email looks unfamiliar. | Market leader; reference UX. |
| **Qualtrics XM** | *Distributions → Email* with their *Compose Mailer* — extensive merge fields, scheduled send, follow-up reminder cadences. | Most powerful sender: A/B, segmentation, throttling, reminder follow-up. Per-brand sender via Qualtrics Mail Server config. | Configuration burden is enterprise-grade. Out of reach for mid-market self-serve. | "Powerful but I need a Qualtrics admin to set it up." | Enterprise default. |
| **Delighted** | *Send via Delighted* + *Send via Web link / Email link* affordances. Uses operator-supplied lists; sends from `surveys.delighted.com`. | Cleanest single-purpose UX. Strong programmatic API for sending. | NPS-only focus (locked to NPS/CSAT/CES question types). No `Send via my email tool` parity — only their send. | Loved for one-question NPS pulses; outgrown when teams want richer surveys or BYO-email. | Reference NPS-focused; recently absorbed into Qualtrics XM portfolio. |
| **Medallia** | Multi-channel distribution including email send via their *Sense Engagement* sender; templated. | Enterprise multi-channel orchestration: email + SMS + IVR + in-app. Per-brand sender domain. | Enterprise pricing + setup. No paste-a-list audience builder — every audience is a configured segment in their data platform. | Best for vertically-integrated enterprise CX; mid-market complains about onboarding cost. | Enterprise CX-suite leader. |
| **HubSpot Service Hub** | Survey sends inside their broader marketing-automation surface — sends use the same email infrastructure as marketing emails. | Tightly integrated with the HubSpot CRM contacts list. Operator builds the audience using HubSpot Lists primitives. | Survey email is a side-feature of a marketing platform — the surface is built around marketing emails, not CX surveys. Audience builder is the HubSpot Lists UI, which has its own learning curve. | Best for shops already standardized on HubSpot for marketing/CRM. | CRM-bundled; pricing tied to total contact count. |
| **Typeform** | *Send by Email* in their distribute panel. Compose via simple text editor; merge variables limited to first name. Sends from `typeform.com`. | Slick mock-and-preview surface. Includes consumer-facing unsubscribe page out-of-box. | Limited merge variables; no per-brand sender domain. No "audience builder" — operator pastes addresses. No save-list-for-reuse. | Best for one-off surveys. CX teams running quarterly waves outgrow it. | Strong mid-market; differentiates on form aesthetics. |
| **AskNicely** | Email + SMS + in-app survey distribution targeting recurring NPS programs (weekly / monthly pulses). | Strong recurrence semantics — schedule a pulse and AskNicely handles the recurring send. Per-brand sender domain. | NPS-focused like Delighted; surface optimized for one-question pulses, not multi-question conditional surveys. | Loved by service-business CX teams (HVAC, dental, contractor shops). | NPS-focused; mid-market service-business niche. |
| **GetFeedback** | *Email Invitation* with explicit *From email* field (operator-side DKIM setup required). | Per-brand sender domain (with operator-side DNS setup). Salesforce-native — pulls audience from SFDC Marketing Cloud. | Heavy Salesforce dependency. The audience builder is "select a Marketing Cloud segment" — not a paste-or-search affordance. Not approachable for non-SFDC shops. | Loved by Salesforce-Marketing-Cloud-shops; unfamiliar to others. | SFDC-aligned enterprise CX. |

### Competitive Positioning Strategy

#### Our Differentiation

- **Key Advantage 1**: **Two send paths in one audience-builder.** CustomerEQ's `Send via my email tool` (CSV-for-Mailchimp) and `Send via CustomerEQ` (CustomerEQ Email) share the same audience step. No competitor offers both as peers — they pick one model and force operators into it.
- **Key Advantage 2**: **Wildcard search on the member roster + per-row checkbox deselect.** Operators routinely want *"all members at this domain"* — competitors require pre-built segments or CSV uploads to achieve this. Wildcard search is a first-class operation in CustomerEQ.
- **Key Advantage 3**: **Per-brand managed-email sender domain at admin-config granularity.** Cheaper than GetFeedback's SFDC-tied flow; more flexible than SurveyMonkey/Typeform's no-customization stance. Operator sets it once; every survey wave inherits.

#### Competitive Response Strategy

- **If SurveyMonkey ships per-brand sender domain**: CustomerEQ's two-path differentiation (managed + BYO in one UI) remains; competing on sender-domain parity alone is not the moat.
- **If a competitor ships "merged audience builder + wildcard search"**: differentiate on the depth of the BYO-email path (#378's CSV semantics, regenerate-tokens, batch-detail page) and the unified analytics surface (#41 closed-loop alerting).

#### Market Positioning

- **Target Segment**: mid-market CX operators who run quarterly NPS / CSAT programs. Often have a marketing-ops team using Mailchimp/Klaviyo and a CX-ops person who wants a quick survey send without involving them.
- **Value Proposition**: *"Send your surveys however you want — through your own ESP or through CustomerEQ. Same audience builder. Same dashboard."*
- **Pricing Strategy**: included in the base subscription. CustomerEQ Email send volume is a CustomerEQ cost-of-goods that we absorb up to a reasonable cap (TBD with go-to-market — separate scoping).

### Research Sources

- SurveyMonkey: https://help.surveymonkey.com/en/surveymonkey/send/email-invitations/ (accessed via internet research, summarized)
- Typeform: https://www.typeform.com/help/a/send-by-email-360029273212/ (summarized)
- GetFeedback: integrator docs (Salesforce-internal — summarized from public marketing pages)
- Qualtrics: https://www.qualtrics.com/support/survey-platform/distributions-module/email-distribution/ (summarized)
- Date of research: 2026-05-21
- Methodology: documentation review + competitor marketing pages. No customer interviews were conducted for this round.

## Design Standards Applied

- `docs/architecture/architecture.md` is the resolved design-standards source.
- Mocks follow the existing `docs/feature-specs/mocks/378-distribute-flow.html` CSS-variable system (`:root` palette, `.dist-tile`, `.btn primary` patterns) for visual consistency across the Distribute surface.

## Open Questions for reviewer

- **OQ-1 (Sender domain default value)**: For V0, when `Brand.managedEmailSenderDomain` is unset, the spec falls back to the platform's existing-notifications sender domain (currently the `AZURE_COMMUNICATION_SERVICES_EMAIL_FROM` env value — implementation detail; the *operator-facing* name remains "CustomerEQ Email sender domain"). **Is that fallback domain the deliberate operator-facing sender, or is it notifications-only and we should NOT expose it as a survey-send domain?** If the latter, V0 should require `Brand.managedEmailSenderDomain` to be set before the `Send via CustomerEQ` tile is enabled (else show *"Configure brand sender domain"* tooltip).
- **OQ-2 (Wildcard syntax)**: spec defaults to `*` / `?` glob (translated to SQL LIKE `%` / `_` after escape). **Is glob the right primitive, or should we lean toward SQL LIKE syntax (`%@artistos.com`) since operators may already think in that vocabulary?** Glob is more user-friendly; LIKE is more familiar to power users. Spec defaults to glob.
- **OQ-3 (Unsubscribe granularity)**: spec defaults to **brand-wide** suppression (`Member.unsubscribedAt`). **Should it be per-survey** instead — letting a member opt out of just this survey while remaining subscribed to other surveys from the brand? CAN-SPAM doesn't require brand-wide, but it's the convention. Operators in regulated industries (healthcare) often want per-survey.
- **OQ-4 (Survey.sentCount surfacing location)** — **RESOLVED (Round 4 mock review)**: surfaces in Loop Monitor (lifetime Survey Sent stat-card) + Responses section header (Sent before the Wave-filtered response count). Explicitly **not** in Configuration Summary (which stays stat-counter-free). See §4.
- **OQ-5 (Rich-text editor library)**: spec assumes a TipTap-based editor if one is in the codebase, otherwise minimal contenteditable. **Is there a preferred editor library or should we pick during implementation?** If no preference, spec defaults to TipTap (battle-tested, MIT-licensed, accessible).
- **OQ-6 (#378 audience-builder reshape — backward compat)** — **RESOLVED via §3.1**: drop-in reshape, no feature flag. The merged shape degenerates to single-source if one card is empty, so existing #378 workflows continue to work; the new affordances (per-row deselect, wildcard search, merged dedup) are additive. Bookmarked `/admin/surveys/[id]/distribute` URLs default to `mode=self-serve` to preserve continuity.
- **OQ-7 (NEW — Brand.logoUrl source)**: spec assumes `Brand.logoUrl` either exists today or is added by a separate, parallel Organization-Settings issue. **Does it exist today, or do we need to file the dependency now?** If filing now: add to the `Brand` model with appropriate validation/storage (URL or CDN-uploaded asset). The upload UX itself is out of scope here (see Non-goals); only the column/value-consumption is needed for #420.

## Non-goals (V1+)

- **Scheduled send** (operator picks a future send-at). V0 is *"click Send → send now."*
- **Open-rate / click-rate analytics** on the sent email (separate analytics initiative).
- **A/B subject line testing**.
- **Per-recipient personalized survey URL beyond the existing token** (e.g., a Customer-specific link that pre-fills the first response field). Out of scope.
- **Resubscribe self-serve flow** for unsubscribed members. V0 requires the brand to manually flip `Member.unsubscribedAt = null` via admin tooling. V1 may add an in-app resubscribe link if recipient demand surfaces.
- **Per-survey sender domain override** at send-time (operator picks per send). V0 is admin-config at the brand level.
- **Mid-flight cancel of a batch send** (see Alternatives — V1 candidate).
- **Custom email templates / brand-branded email designs.** V0 is a plaintext-style rich-text body with the operator's free-form composition. The brand-logo header rendering is the one piece of branded chrome V0 includes (via the `{{brand_logo}}` mustache). Full branded HTML templates with brand colors / multi-column layouts / hero images / etc. are a separate visual-design initiative.
- **Brand logo upload UX.** V0 *consumes* `Brand.logoUrl` (renders it as the `{{brand_logo}}` mustache); it does NOT include the upload flow that produces the value. Setting `Brand.logoUrl` is currently a manual operation (admin tooling / database write). The full upload UX in Organization Settings is tracked separately as a future issue. If `Brand.logoUrl` is null, the email header renders with only the brand name — graceful degradation.

## Validation Requirements

- `uiValidationRequired`: true — primary affordances are operator-facing UI.
- `mobileValidationRequired`: false — Distribute surfaces are desktop-first (admin tooling).
- Required browser baseline: Chrome / Firefox / Safari (latest). Responsive: tablet portrait + landscape; not optimized for mobile portrait.
- Required test environment: dev-mode `EMAIL_PROVIDER=stub` for unit / integration tests; staging-mode `EMAIL_PROVIDER=azure-communication-services` against an ACS sandbox sender for end-to-end pre-deploy validation.
