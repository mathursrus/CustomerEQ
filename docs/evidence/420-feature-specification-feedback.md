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
