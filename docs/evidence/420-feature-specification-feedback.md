# Feedback for Issue #420 — feature-specification Workflow

## Round 2 Feedback
*Received: 2026-05-21 (in-conversation review of PR #497 spec round 1)*

### Comment 1 — UNADDRESSED → ADDRESSED (Round 2)
- **Author**: manohar.madhira@outlook.com
- **Type**: pr_review (conversational, transcribed to this file)
- **File**: `docs/feature-specs/mocks/420-send-via-customereq-acs.html` + `docs/feature-specs/420-send-via-customereq-acs.md`
- **Comment**:
  > The mock doesn't include how the Send via Email tool would change based on this. This issue should cover both send scenarios, because they must share the inputs. Survey Title and Link Expiry are not shown in the mocks. Think as a PM — how the two scenarios should overlap and where they diverge. Don't design / re-design in isolation.
- **What was wrong**:
  1. Mock only showed the new `Send via CustomerEQ` flow. The existing `Send via my email tool` flow (#378) was visible only as a button in scene 1; its page-level surface under the new shared audience builder was never illustrated.
  2. `Survey name in mail` (#378 §2.2 — operator-facing survey name flowing into the CSV/email) and `Links expire on` (#378 §2.2 — wave expiry) were omitted from every scene. Both are **shared inputs** consumed by both flows.
  3. The spec described the audience builder as shared (good) but never framed the design as *one shared structure with explicit divergence points* — instead it described one new flow with a parenthetical "shared with #378."
- **Resolution (Round 2 changes)**:
  - **Spec changes**:
    - Added a new §0 *"Shared surface vs path-specific divergence"* block up-front. Tags every input/affordance as `Shared (both modes)` / `Mode-specific (MANAGED_ACS)` / `Mode-specific (SELF_SERVE)`.
    - Inserted a new §2.2 *"Configure state — Common fields (shared with both modes)"* covering `Survey name in mail`, `Links expire on`, and auto-enroll toggle — verbatim semantics inherited from #378 §2.2 / §2.4, applied identically in both modes.
    - Renumbered the previous §2.2 (Composer) → §2.3 and explicitly marked it `Mode-specific (MANAGED_ACS)`.
    - Added §2.4a *"Configure state — Generate (SELF_SERVE mode)"* describing the BYO path's Generate-Links CTA under the new shared structure.
    - Updated §2.5/§2.6 to show both modes' Success states side-by-side (Self-serve = Download CSV per #378; Managed-ACS = Sending/Sent progress per Round 1's §2.4–2.5).
    - Updated §3 (#378 reshape) to enumerate the post-reshape #378 surface: it now uses the §2.1 audience builder + §2.2 common fields + §2.4a SELF_SERVE Generate-Links section — i.e., #378's distribute page is now a `mode=SELF_SERVE` instance of the same single-page component.
    - Added an architectural note: both paths render the same React page component (`<DistributePage mode={...}/>`) parameterized by `mode` query param; the divergent sections are isolated subcomponents (`<SelfServeComposer/>` vs `<ManagedAcsComposer/>`).
  - **Mock changes**:
    - Scene 1 (Distribution tile): button labels and styling unchanged but both are made equal-weight (both `outline-primary`) since the issue body presents them as two peer choices, not primary/secondary.
    - Scene 2 (Audience builder): added the **Common fields** card (Survey name in mail + Links expire on + auto-enroll already on the Custom List card) BELOW the audience list and ABOVE the path-specific area — visible regardless of mode.
    - Scene 3 split into Scene 3A (`Send via my email tool` composer = format dropdown + Generate Links CTA per #378) and Scene 3B (`Send via CustomerEQ` composer = sender + body + send CTA, formerly the only Scene 3).
    - Scenes 4–6 became mode-aware: Scene 4 confirm modal is shown in both variants; Scene 5/6 success states show CSV-download variant alongside Sending/Sent variant.
    - Added a header banner at the top of the mock explicitly labelling **"Shared scenes: 1, 2 · Divergent scenes: 3A vs 3B, 5/6 modes"** so reviewers see the symmetry at a glance.
  - **Coaching moment**: captured at `fraim/personalized-employee/learnings/raw/manohar.madhira@outlook.com-2026-05-21T21-19-48-pm-design-paired-flows-with-shared-structure.md`.
- **Status**: ADDRESSED (Round 2)

## Round 3 Feedback
*Received: 2026-05-21 (in-conversation review of PR #497 after Round 2 mock update)*
*Reviewer instruction: "Once we iterate on the mock then you can update the spec at one time." → mock-only iteration this round; spec update deferred until reviewer locks the mock.*

### Comment 1 — UNADDRESSED → ADDRESSED (Round 3, mock only)
- **Author**: manohar.madhira@outlook.com
- **Type**: pr_review (conversational, transcribed)
- **File**: `docs/feature-specs/mocks/420-send-via-customereq-acs.html`
- **Comment**:
  > In the Mock — please add capability to Insert Brand logo. In the default message, show Brand Logo and Brand Name as the header.
- **Resolution (mock only)**:
  - Added a new **Brand logo** field in the MANAGED_ACS Composer (Scene 3), placed in the "Sender & branding" block alongside Sender name and Sender alias. Affordance: a chip preview of the current logo (defaulting to `Brand.logoUrl` if set; otherwise *"No logo — upload one"* with an Upload control) plus a *"Use a different logo for this send"* link that opens a small upload panel. Saves to per-batch `composerSnapshot.brandLogoUrl` (and optionally back to `Brand.logoUrl` via a *"Save as brand default"* toggle).
  - Updated the default Body editor textarea to include `{{brand_logo}}` and `{{brand_name}}` at the top, rendered as a header block. New mustache palette buttons added: `{{brand_logo}}` and `{{brand_name}}` (the latter was already present; now styled as part of the header convention).
  - Updated the **Live preview** pane to render the logo image + brand name as an actual visual header above the greeting line.
- **Status**: ADDRESSED (Round 3 — mock only; spec update deferred per reviewer instruction)

### Comment 2 — UNADDRESSED → ADDRESSED (Round 3, mock only)
- **Author**: manohar.madhira@outlook.com
- **Type**: pr_review (conversational, transcribed)
- **File**: `docs/feature-specs/mocks/420-send-via-customereq-acs.html`
- **Comment**:
  > In Add Custom List, we should allow emails to be pasted even if Brand is setup to use Member ID or phone number. If Email ID is pasted, or uploaded via CSV, member should be looked up based on email. If not found and the brand is set to Phone or Email as primary ID [reviewer transcription — interpreted as Phone or external_id as primary], then list below as "Emails not found, cannot be auto-enrolled because Brand Identifier is <>". Today the Paste expects only the brand identifier in a custom paste / CSV. Custom Paste or CSV could be used when Brands select the members to receive surveys based on their own logic.
- **What was wrong**:
  - The Round 1 / Round 2 spec inherited #378's parser rule that pasted identifiers must match the brand's primary identifier kind. This was overly restrictive: brands often supply lists of emails (their own segmentation logic outputs emails) even when their primary identifier in CustomerEQ is `phone` or `external_id`. The platform should still look up those members by email, and if no match exists, surface a clear *"can't auto-enroll because brand identifier is `<phone>`"* line — not silently drop them as unmatched.
  - Coaching moment captured at `fraim/personalized-employee/learnings/raw/manohar.madhira@outlook.com-2026-05-21T22-50-13-parser-grammar-vs-brand-primary-identifier.md`.
- **Resolution (mock only)**:
  - Updated the Custom List card's help-text to read: *"Paste identifiers or upload a CSV. **Email format always accepted** (looked up by email regardless of brand identifier). Newline / comma / semicolon-separated. `Name <email>` form accepted."*
  - Added a new mini-scene **Scene 2B · "Custom List with email paste against a non-email-keyed brand"** showing a brand whose primary identifier is `external_id`. The audience-list table gains a third subsection: *"Emails not found — cannot be auto-enrolled because Brand identifier is `external_id`"* with one example row + a one-line recovery hint (*"Add these members in Members → New with their `external_id` first; they'll match here on the next paste."*).
  - The Live preview Source-chip vocabulary gains a new value: `Email — not found` (warning-styled) for these rows.
- **Status**: ADDRESSED (Round 3 — mock only; spec update deferred per reviewer instruction)

## Round 4 Feedback
*Received: 2026-05-21 (in-conversation review of PR #497 after Round 3 mock update)*
*Reviewer instruction continues: mock-only iteration; spec update happens in one pass once the mock is locked.*

### Comment 1 — UNADDRESSED → ADDRESSED (Round 4, mock only)
- **Author**: manohar.madhira@outlook.com
- **Type**: pr_review (conversational, transcribed)
- **File**: `docs/feature-specs/mocks/420-send-via-customereq-acs.html`
- **Comment**:
  > Show preview for Brand Logo, but need not allow for updating the logo in this view — we don't have capability to upload Logos yet. So the Brand Logo block in Scene 3 is not required.
- **Resolution**:
  - Removed the Brand-logo field (chip preview + upload + "Save as brand default" toggle) from Scene 3's first composer card. Renamed the card from "Sender & branding" → "Sender" since branding affordances no longer live there.
  - **Preserved** the `{{brand_logo}}` + `{{brand_name}}` mustache tokens in the default Body editor template, the new `{{brand_logo}}` button in the mustache palette, and the rendered logo + name visual header in the Live preview pane. The body editor's helper text now explicitly says: *"The logo is pulled from `Brand.logoUrl` (set in Organization Settings — no upload affordance in this view); if the brand has no logo configured, `{{brand_logo}}` renders as empty and the header collapses to brand name only."*
  - Effect: operator sees the preview render and understands the logo will appear in recipient emails, without an upload control that the platform doesn't yet support. Future issue scope (a separate Organization Settings update) will add the upload flow; this issue scopes only the surfacing.
- **Status**: ADDRESSED (Round 4 — mock only)

### Comment 2 — UNADDRESSED → ADDRESSED (Round 4, mock only)
- **Author**: manohar.madhira@outlook.com
- **Type**: pr_review (conversational, transcribed)
- **File**: `docs/feature-specs/mocks/420-send-via-customereq-acs.html` (Scene 5A)
- **Comment**:
  > In Scene 5A include the statement that these members will be marked as sent on download. If users regenerate for a given batch, update the sent information also. In case of Send via my email tool, downloading CSV can be considered as Sent.
- **Resolution**:
  - Added an info-banner directly above the strong-warning amber banner on Scene 5A explaining the Self-serve Sent semantics: *"Self-serve hands the operator a CSV they paste into their own email tool — the platform marks each member's `SurveyDistribution.sentAt` at the moment of CSV download (i.e., downloading the CSV is the operator-side dispatch-handoff moment). The Survey's `sentCount` is incremented by the rows here, and these members show as Sent in the Loop Monitor (Scene 6) and in the Batch Details Sent counter (Scene 7)."*
  - Added a follow-on line about Regenerate semantics: *"If you Regenerate later (Batch Details → Regenerate links): the regeneration replaces the tokens but updates the `sentAt` timestamp on each row — so the Sent count reflects the most recent dispatch handoff, not the original. Members already responded keep their `respondedAt` independently."*
- **Status**: ADDRESSED (Round 4 — mock only)

### Comment 3 — UNADDRESSED → ADDRESSED (Round 4, mock only)
- **Author**: manohar.madhira@outlook.com
- **Type**: pr_review (conversational, transcribed)
- **File**: `docs/feature-specs/mocks/420-send-via-customereq-acs.html` (Scene 6 + new Scene 7)
- **Comment**:
  > Sent information should also appear in the Loop Monitor as Survey Sent. Scene 6 need not be present. Loop Monitor shows the Sent and Received information. The Batch Details should show Sent. Configuration is just what was configured in the survey.
  > Show Survey Sent Count in the Responses Header Section, before the <X> response that changes based on the Filters selected (e.g. Wave).
- **Resolution**:
  - **Removed** the "Sent" line from the Configuration Summary in Scene 6. Configuration Summary now contains only what was *configured* on the survey (type, status, response policy, member identifier kind, creator/created-at), with an explicit footer note: *"Configuration Summary is what was configured on this survey. Stat counters (Sent / Responses / Closed-loop Actions) live in the Loop Monitor and Response section above — not here."*
  - **Replaced Scene 6 entirely** with a comprehensive survey-detail view showing three sections:
    1. **Loop Monitor** (lifetime pipeline, #241 R32b) — 4 stat-cards: Survey Sent (with mode breakdown sub-line), Responses Received, Closed-loop Actions, P75 Time-to-Action. Sub-note: *"Loop Monitor stays lifetime-wide regardless of Wave filter."*
    2. **Responses** — new header strip showing `Survey Sent: 11 (lifetime · not affected by Wave filter) | Responses: 4 of 11 (36% · changes with the Wave filter on the right)` followed by the Wave filter dropdown and the response table. The Sent count sits **before** the filtered response count exactly as specified.
    3. **Configuration summary** — preserved but stat-counter-free (see above).
  - **Added Scene 7 (new)** — Batch detail page showing 5 counters strip (**Sent** · Awaiting response · Responded · Failed · Expired). The Sent counter is the new addition; the others are preserved from #378 §3.1. Sub-note explains that Sent semantics differ per mode: Managed-ACS increments per-recipient as the worker confirms ACS delivery; Self-serve increments on CSV download (and re-increments on Regenerate).
- **Status**: ADDRESSED (Round 4 — mock only)

## Round 5 Feedback
*Received: 2026-05-21 (in-conversation review of PR #497 after Round 4 mock update)*
*Reviewer instruction continues: mock-only iteration; spec update happens in one pass once the mock is locked.*

### Comment 1 — UNADDRESSED → ADDRESSED (Round 5, mock only)
- **Author**: manohar.madhira@outlook.com
- **Type**: pr_review (conversational, transcribed)
- **File**: `docs/feature-specs/mocks/420-send-via-customereq-acs.html`
- **Comment**:
  > Remove reference to ACS — that is internal application detail. It should state CustomerEQ Email.
- **Resolution**:
  - All **operator-visible** ACS references in the mock replaced. Mappings:
    - Pill text "Managed (ACS)" → "CustomerEQ Email"
    - Mode-tag chip text "MANAGED_ACS" → "CUSTOMEREQ EMAIL" (the internal mode-tag convention, kept uppercase to parallel "SELF_SERVE")
    - Page-header subtitle pills updated in Scene 3, Scene 5B, Scene 5C, Scene 7B.
    - Scene 3 help-text: "Domain pinned to brand's verified ACS sender" → "Domain pinned to brand's verified CustomerEQ Email sender"
    - Scene 3 scene-label: "the ACS composer" → "the CustomerEQ Email composer"
    - Scene 7B sub-note: "via ACS confirmed delivery" → "via CustomerEQ Email confirmed delivery"
    - Scene 7B explanatory note: "incremented per-recipient as the worker confirms ACS delivery" → "incremented per-recipient as the platform confirms email delivery"
    - Loop-Monitor Wave-filter option: "(Managed ACS)" → "(CustomerEQ Email)"
  - **Kept** (internal-only, not operator-visible): the CSS class names `mode-managed-acs` / `managed-acs` (class identifiers, not user-facing text), and the URL query-string value `?mode=managed-acs` (technical contract on the page route — the spec-side renaming to `?mode=customereq-email` is a deferred decision, will be settled in the spec pass).
  - Verified clean via `grep "ACS"` on the mock file — no operator-visible ACS strings remain.
- **Status**: ADDRESSED (Round 5 — mock only)

### Comment 2 — UNADDRESSED → ADDRESSED (Round 5, mock only)
- **Author**: manohar.madhira@outlook.com
- **Type**: pr_review (conversational, transcribed)
- **File**: `docs/feature-specs/mocks/420-send-via-customereq-acs.html`
- **Comment**:
  > Ensure that previous functionality of viewing Wave Detail should be maintained for Send via my email tool.
- **Resolution**:
  - Renamed the existing Scene 7 → **Scene 7B (Wave detail · CustomerEQ Email batch)**.
  - **Added Scene 7A (Wave detail · Self-serve batch)** preserving #378 §3.1 functionality verbatim:
    - Same 5-counter strip (Sent · Awaiting response · Responded · Failed · Expired). Failed shows "—" with sub-note *"n/a for Self-serve (no platform dispatch)"* — accurate to the dispatch model.
    - **Audience spec block** preserved from #378 §3.1 (mode, members-at-send-time, members-now, survey name in mail, links-expire-on with Edit affordance, format chosen, created).
    - **Tokens table** preserved: paginated by status (Awaiting / Responded / Expired), showing token prefix, identifier, status pill, responded-at timestamp.
    - **Regenerate Links + Download CSV** affordance preserved (format dropdown + button at the top of the Tokens table).
    - Sub-notes explain Self-serve Sent semantics (CSV-download = Sent timestamp; Regenerate re-increments).
    - Bottom warning banner: *"No platform-side send log for Self-serve batches"* clarifies the absence of per-recipient delivery confirmations (operator's email tool dispatched these).
  - Mock-header nav + TOC updated to list Scene 7A and Scene 7B as parallel batch-detail variants.
- **Status**: ADDRESSED (Round 5 — mock only)

### Comment 3 — UNADDRESSED → ADDRESSED (Round 5, **spec update**)
- **Author**: manohar.madhira@outlook.com
- **Type**: pr_review (conversational, transcribed)
- **File**: `docs/feature-specs/420-send-via-customereq-acs.md` (the deferred consolidated spec pass)
- **Comment**:
  > Now update the feature spec.
- **Resolution (consolidated spec rewrite folding Rounds 2–5 into spec text)**:
  - **Status** bumped to *"Round 5 — consolidated spec pass."*
  - **Iteration history** table expanded with R3, R4, R5 rows summarizing each round's outcomes (mock-only rounds + this spec pass).
  - **§0 Shared-vs-divergent table** mode-labels switched to operator-facing wording.
  - **§1 entry-point** copy: pills use "CustomerEQ Email" / "Self-serve".
  - **§2.1 Audience builder Custom List card**: parser-relaxation language added (Round 3) — emails always accepted regardless of brand identifier kind; routed via `Member.email` lookup; three Source-chip categories (Existing / Existing-via-email / Email-not-found) enumerated.
  - **§2.2 Common fields** (Round 2): Survey name in mail + Links expire on as shared, mode-aware semantics each side.
  - **§2.3 Composer (MANAGED_EMAIL-only)**: Round 4 brand-logo-no-upload language — `{{brand_logo}}` mustache + `{{brand_name}}` in default body header, pulled from `Brand.logoUrl`, graceful collapse when null, explicit *"No brand-logo upload affordance on this page"* note pointing to Non-goals.
  - **§2.4a SELF_SERVE Generate** + **§2.6a Success** clarified: `Survey.sentCount` increment + `SurveyDistribution.sentAt` write happen on **Download CSV** event (not at Generate-time); Regenerate re-writes both.
  - **§3.2 Wave Detail page** rewritten as mode-aware: SELF_SERVE preserves #378 §3.1 verbatim (Audience Spec + Edit Expiry + Tokens table + Regenerate Links + Download CSV); MANAGED_EMAIL adds Composer snapshot block + Per-recipient send log.
  - **§4 Sent-count surfacing** entirely rewritten: §4.1 Loop Monitor stat-card + §4.2 Responses section header strip (Sent before Wave-filtered count) + §4.3 Configuration Summary stat-counter-free.
  - **Data Model** updated: `MANAGED_EMAIL` enum value (renamed from `MANAGED_ACS`); `Brand.managedEmailSenderDomain` (renamed from `Brand.acsSenderDomain`); `DistributionBatch.composerSnapshot` now includes `brandLogoUrl` (snapshot of `Brand.logoUrl` at send time); `SurveyDistribution.sentAt` semantics spelled out per mode (SELF_SERVE = CSV-download time, mutable on Regenerate; MANAGED_EMAIL = provider-confirmed delivery, immutable); `Brand.logoUrl` flagged as a dependency.
  - **API Endpoints** collapsed: no new `/send-via-acs` route. Existing `POST /v1/surveys/:id/distribution-batches` extended with `sendMode` discriminator (defaults to `SELF_SERVE` preserving #378 contract); new `POST /v1/surveys/:id/distribution-batches/:batchId/mark-csv-downloaded` for SELF_SERVE Sent-on-download semantics.
  - **Architecture** section: replaced operator-facing ACS references with "managed email provider"; kept the implementation-note that the provider is currently ACS at `packages/connectors/src/email.ts`, with explicit note that this is a deployment detail not surfaced to operators.
  - **Compliance / Alternatives / Competitive Positioning** sections updated for terminology consistency.
  - **Open Questions**: OQ-4 marked **RESOLVED** (sent-count surfacing → Loop Monitor + Response header); OQ-6 marked **RESOLVED** (drop-in reshape via §3.1); new OQ-7 added for `Brand.logoUrl` dependency clarification; OQ-1, OQ-2, OQ-3, OQ-5 still open.
  - **Non-goals** updated: added *"Brand logo upload UX"* (V0 consumes only; production tracked separately).
  - **Final ACS-grep**: 9 ACS occurrences remain — all in iteration-history rows or technical-implementation notes (Architecture section + Test plan + staging env). No operator-facing surface still leaks ACS.
- **Status**: ADDRESSED (Round 5 — spec consolidated)

## Round 6 Feedback
*Received: 2026-05-22 (24 inline review comments on PR #497 commit `89d3092`, transcribed below)*
*Pre-Round-6 actions: (a) rebased `feature/420-*` branch onto latest `origin/main` to refresh local rule text per the [[stale-local-rule-text-from-feature-branch-divergence]] mistake-pattern; (b) re-read `project_rules.md` (Rule 26 reworded by #404; Rule 27 in main is now the auto-merge workflow from #498, distinct from the Rule 27 I authored on PR #496); (c) re-read learnings (preferences, mistake-patterns); (d) captured coaching moment for hallucinated-claims-without-codebase-verification (`fraim/personalized-employee/learnings/raw/manohar.madhira@outlook.com-2026-05-22T17-13-10-hallucinated-claims-without-codebase-verification.md`); (e) verified every codebase claim cited in the spec against `packages/database/prisma/schema.prisma`, `apps/web/src/components/surveys/LoopMonitor.tsx`, `.env.example`, `apps/api/src/routes/distributionBatches.ts`.*

### Comments 1–24 — ADDRESSED (Round 6)

| # | File · Line | Reviewer comment (verbatim) | Resolution |
|---|---|---|---|
| 1 | spec:24 | *"While this can be true - Customer expectation could be I come to one tool - CustomerEQ and I expect it to do everything... Point 3 should be the first point."* | Customer's Desired Outcome reordered — *"One tool, complete flow"* is now point 1; *"In-app flow start-to-inbox"* is point 2 as the concrete expression of #1. |
| 2 | spec:34 | *"In V0 - the domain will be customereq.wellnessatwork.me till we register custom sender domains with ACS."* | Customer Desired Outcome #4 + §2.3 Composer + R25 explicitly pin the V0 sender domain to `customereq.wellnessatwork.me` (verified via `.env.example:42`). `Brand.managedEmailSenderDomain` column ships in V0 with code wiring but null in V0 — populated in V1 when custom domains land. |
| 3 | spec:46 | *"This is wrong. We don't have the filtering by attribute. Don't hallucinate. Verify each claim with actual code base"* | **Hallucinated claim removed.** Customer Problem #3 rewritten — the spec no longer asserts filter-by-attribute audience targeting as an existing capability. Verified against codebase: no `tier` / `sentiment` / `healthScore` / `cooldown` filter implementations exist in `apps/web/src/app/(admin)/admin/members/` or in the API surface. Coaching moment captured at `fraim/personalized-employee/learnings/raw/manohar.madhira@outlook.com-2026-05-22T17-13-10-hallucinated-claims-without-codebase-verification.md`. |
| 4 | spec:47 | *"This problem is only partially solved in V0 - allowing to customize the name and alias used. The domain cannot be customized till we enable custom domains in ACS"* | Customer Problem #4 retitled *"No 'I want CustomerEQ as the sender alias' affordance — V0 partially solves this."* The body now explicitly frames From-name + alias-local-part as V0-customizable and domain as V0-pinned / V1-customizable. |
| 5 | mock:457 | *"Move this section above the Member selection."* | Spec §2 sub-sections reordered — Common Fields (now §2.1) precedes Audience builder (now §2.2). Mock structural reorder is a pending mock change (Round-6 spec ships first; mock follows on next iteration if reviewer wants the visual move now). |
| 6 | spec:69 | *"Agreed"* | No action — reviewer acknowledgment. |
| 7 | spec:88 | *"It is not about technical aspect. More a JTBD - they want to send a survey via email - so one tile - two modes. The others are JTBD - they want to embed the survey, and they want to paste it on their website (e.g.)"* | §1 *"Why two buttons in one tile, not two separate tiles — JTBD framing"* rewritten. Each tile is now framed as a distinct job-to-be-done; both buttons in the Send-via-Email tile share the single JTBD *"deliver a survey to a recipient via email"* with two equally-valid mechanisms. |
| 8 | spec:115 | *"Random Sample should also have Add button, so the flow doesn't appear broken and distinct"* | §2.2 Add-from-Existing-Members card / Random Sample tab description updated to require an explicit `Add N members` button after the operator picks count/percent. Codified in R18. Mock change still pending. |
| 9 | spec:134 | *"As mentioned in the HTML comment, move this above the Audience selection page - Flow being: Define this batch attributes -> Select members -> Send"* | Spec §2 reordered (Common Fields §2.1 before Audience §2.2; Composer §2.3; Action §2.4). Flow now explicitly described as *"Define batch attributes → Select members → Send"*. R6 codifies this ordering. |
| 10 | spec:155 | *"As mentioned in V0 we are not offering custom domains. Domain name should be obtained from Application's default domain. When custom domains are offered, the domain should resolve from Brand domain and if null, then application domain"* | §2.3 sender-domain block rewritten. V0: domain is application default (`customereq.wellnessatwork.me`); `Brand.managedEmailSenderDomain` ships with code wiring but null. V1+: resolution order is `Brand.managedEmailSenderDomain` → `AZURE_COMMUNICATION_SERVICES_EMAIL_FROM` env → hard-coded fallback. R25 codifies. |
| 11 | spec:184 | *"Change this to, You received this survey because you're a customer or partner or `{{brand_name}}`. [Unsubscribe](unscubscribe-link)"* | Footer copy in §2.3 + §13.3 + mock all updated to *"You received this survey because you're a customer or partner of `{{brand_name}}`."* (Interpreted reviewer's *"or"* between *"partner"* and `{{brand_name}}` as a typo for *"of"*.) R30 codifies. |
| 12 | spec:113 | *"If a member has unsubscribed but matches the search pattern / custom list, they should still be shown in the list, default checkbox off and disabled. Specifically indicate that member has unsubscribed."* | §2.2 audience-list table gains a new Status column with chips `OK` / `Unsubscribed` / `No consent` / `Erased`. Suppressed-member rows render checkbox unchecked AND disabled, with tooltip explaining when/why. R22 codifies. Mock change still pending. |
| 13 | spec:348 | *"In the response section header Survey Sent and Responses can be effected by Wave Filter - correct? Survey sent cannot be effected on filters that come from responses - e.g. Date range, scope, etc. Response Count can"* | §4.2 Responses section header rewritten to clarify filter responsiveness: Wave filter affects BOTH Sent and Responses; response-only filters (date range, sentiment scope) affect Responses ONLY. Lifetime Sent in Loop Monitor stays filter-agnostic. R39 + R40 codify. |
| 14 | spec:351 | *"See previous comment. The life time sent is shown in the Loop Monitor"* | Confirmed in §4.1 — Loop Monitor's Survey Sent stat-card is lifetime always. |
| 15 | spec:372 | *"Agreed that model change should be made now with code wiring. My previous comments about not in V0 mean that data would be null in V0"* | Confirmed — Data Model section keeps the column additions (`Brand.managedEmailSenderDomain`, `Member.unsubscribedAt`, `DistributionBatch.sendMode`, `DistributionBatch.composerSnapshot`, `Survey.sentCount`) with V0 = null/default values for the fields that wait on V1 features. |
| 16 | spec:562 | *"Similar to the Unsubscribed comment above, if members exist without consent they should be shown in the list with unchecked for sending mail and disabled from selection. This check at Dispatch should still exist, including check for unsubscribed to add edge case of member unsubscribing between member selection and actual send"* | Two-gate suppression model added: gate 1 = audience builder Status chip + disabled checkbox (R22); gate 2 = worker pre-dispatch re-check at `survey-distribution-send` job invocation (R44 + new §13.7 Compliance section). |
| 17 | spec:681 | *"Fallback domain is required. If Azure Communication Services Email from is not set, it should fall back to application's domain. It should also fire an event with a warning."* | OQ-1 resolved — §2.3 + R25 specify the 3-step resolution order with `email.sender_domain.fallback` warn event when the env is unset. |
| 18 | spec:682 | *"glib is correct"* | OQ-2 resolved — glob syntax (`*` / `?` translated to SQL LIKE `%` / `_`). Codified in R17. |
| 19 | spec:683 | *"At this time, keep it brand wide. Will expand to per survey if needed later"* | OQ-3 resolved — `Member.unsubscribedAt` is brand-wide (V0); per-survey opt-out deferred to V1+. Codified in R41 + Non-goals. |
| 20 | spec:685 | *"Decide at Technical Design"* | OQ-5 resolved (deferred to RFC) — rich-text editor library choice handed to Technical Design phase. Default: TipTap if no other preference surfaces. |
| 21 | spec:686 | *"Agreed"* | OQ-6 confirmed as resolved via §3.1 drop-in reshape (no feature flag). |
| 22 | spec:687 | *"I know it exists. Shouldn't spec verify this first instead of assuming?"* | OQ-7 closed via codebase verification: `Brand.logoUrl` exists at `packages/database/prisma/schema.prisma:201`. Spec updated to cite the verified column, not the assumption. Coaching moment captured (see above). |
| 23 | spec:698 | *"We have brand accent colors defined and Survey selects. The spec should call out which elements map to which colors in the selected survey theme."* | New §2.3.1 *Theme-color mapping for managed-email rendering* added — table maps each email element (brand-name header, link color, body background, body text) to the corresponding `BrandTheme` column (`primaryColor` / `accentColor` / `backgroundColor` / `textColor` / `buttonColor` / `buttonTextColor` / `secondaryColor`). Theme resolution: `Survey.themeId` → `Brand.defaultThemeId` → CustomerEQ default palette. `BrandTheme` verified to exist at `schema.prisma:758-789` (renamed from SurveyTheme per #291). R29 codifies. |
| 24 | (top-level) | *"Why doesn't the spec include R1..RNN style requirements with SHALL statements for traceability?"* | New §Requirements section added with **R1..R45** SHALL-style traceable requirements grouped into: Distribution entry-point (R1–R5), Configure surface (R6–R10), Common fields (R11–R15), Audience builder (R16–R23), Composer (R24–R30), Send + Terminal state (R31–R35), Sent-count surfacing (R36–R40), Compliance + suppression (R41–R45). Each requirement is testable; many include Given/When/Then acceptance criteria. |

**Round-6 codebase verification audit trail:**
- `Brand.logoUrl` — verified `String?` at `schema.prisma:201`. ✓
- `Brand.name` — verified `String` at `schema.prisma:198` (NOT `Brand.displayName` — that column doesn't exist; spec corrected throughout).
- `Brand.memberIdentifierKind` — verified `MemberIdentifierKind @default(EMAIL)` at `schema.prisma:203`. ✓
- `Brand.timezone` — verified `String @default("UTC")` at `schema.prisma:213`. ✓
- `Member.email` — verified `String?` (nullable per #231 PR2) at `schema.prisma:331`. ✓
- `Member.consentGivenAt` — verified `DateTime?` at `schema.prisma:338`. ✓
- `Member.emailOptIn` — verified `Boolean @default(false)` at `schema.prisma:340` (new OQ-NEW-1 about its relationship to proposed `Member.unsubscribedAt`).
- `Member.unsubscribedAt` — does NOT exist; correctly flagged as new.
- `Member.erased` — verified `Boolean @default(false)` at `schema.prisma:345`.
- `BrandTheme` — verified at `schema.prisma:758-789` (renamed from SurveyTheme per #291). All cited color columns present.
- `Survey.themeId` — verified at `schema.prisma:616` (FK to BrandTheme).
- `DistributionBatch` — verified at `schema.prisma:676-696` (no `sendMode`, `composerSnapshot` yet — correctly proposed new).
- `SurveyDistribution.sentAt` — verified `DateTime @default(now())` at `schema.prisma:659`. Semantic-change to per-mode meaning is the proposed change.
- Loop Monitor's `surveysSent` — verified at `apps/web/src/components/surveys/LoopMonitor.tsx:13` as `number` in the pipeline data shape (already exposed; #420 only adds breakdown).
- `.env.example:42` — verified `AZURE_COMMUNICATION_SERVICES_EMAIL_FROM="no-reply@customereq.wellnessatwork.me"`. ✓
- Filter-by-attribute audience targeting — verified NOT present in `apps/web/src/app/(admin)/admin/members/page.tsx` or in the audience-spec shape of `apps/api/src/routes/distributionBatches.ts`. R1–R5 spec text corrected.
- Mock: sender suffix updated to `@customereq.wellnessatwork.me`; footer copy updated to *"customer or partner of"*. Remaining mock changes (visual reorder of Common Fields above Audience cards in Scenes 2/3; Random Sample Add button; Suppressed-member row demonstration) deferred to a Round-6.5 mock iteration if reviewer wants them now.

- **Status**: ADDRESSED (Round 6 — spec + partial mock; remaining mock visual updates deferred to Round 6.5 if requested)

### Comment 25 (Round 6.5) — UNADDRESSED → ADDRESSED — Theme resolution clarification + mock visualization
- **Author**: manohar.madhira@outlook.com
- **Type**: pr_review (conversational follow-up after Round 6)
- **File**: spec §2.3.1 + mock Scene 3
- **Comment**:
  > For 2.3.1 do you use theme selected in Survey or default Brand theme? Update the mock based on the comment.
- **Resolution**:
  - **Spec already specified Survey-first resolution order** (§2.3.1): *"Survey.themeId (if set) → Brand.defaultThemeId (if set) → CustomerEQ default palette."* No spec change needed — the answer is **Survey-selected theme first**, then Brand default, then platform defaults. R29 codifies.
  - **Mock updated** to make the resolution visible: Scene 3's Live preview pane now has:
    - A **Theme banner** above the email frame: *"Theme: Acme Q2 2026 · resolved from `Survey.themeId` · color mapping ↓"* — operator sees which theme is being applied and where it came from.
    - The email-frame's colors are now driven by realistic palette values (warm brown `#6f2c1a` for `primaryColor` + Subject; rust orange `#c2410c` for `accentColor` + survey link; cream `#fdfaf6` for `backgroundColor`; dark brown `#2d2218` for `textColor`; warm grey `#d6cfc6` for `secondaryColor` / dividers). Reviewer sees what brand-themed rendering looks like, not generic indigo.
    - A **Theme-mapping legend** below the email frame: a 5-row table listing each rendered element → corresponding `BrandTheme` column → resolved hex with a color swatch. Includes the V1-deferred CTA-button row (greyed out with *"out of V0 scope"*).
    - Resolution-order note at the bottom of the legend: *"Survey.themeId (if set — this case) → Brand.defaultThemeId (if set) → CustomerEQ default palette. Resolved theme is snapshotted into `DistributionBatch.composerSnapshot.themeSnapshot` at send time so the Wave Detail page (Scene 7B) shows exactly which palette was used."*
- **Status**: ADDRESSED (Round 6.5 — mock only)
