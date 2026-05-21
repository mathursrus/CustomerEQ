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
