# Feedback for Issue #378 — feature-specification workflow

## Round 2 Feedback
*Received: 2026-05-15 via chat with manohar.madhira@outlook.com*
*Surface: post-Round-2-rewrite mock review (spec rewrite paused until alignment)*

### Comment R2-1 — UNADDRESSED
- **Author**: manohar.madhira@outlook.com
- **Type**: chat (mock-review iteration)
- **Surface**: Scene 2 · Existing Members mode card
- **Comment**: "Existing members should still have options for sampling: % or Count, if members are enrolled. If no members are enrolled, section should be hidden."
- **Status**: UNADDRESSED — mock update needed
- **Implication**: confirm + expose the Percent / Count toggle inside the Existing Members card so the reviewer can see it in the static mock. Current scene shows the Custom List card selected, which collapses the Existing Members body. Action: render both card bodies expanded in the mock for review clarity (add small note clarifying production single-card behavior); R4 + R5 in spec already cover the semantics — no spec change needed beyond the mock.

### Comment R2-2 — UNADDRESSED (weak-POV question to agent)
- **Author**: manohar.madhira@outlook.com
- **Type**: chat (mock-review iteration — question to agent)
- **Surface**: Scene 2 · mode chooser
- **Comment**: "Weak POV — Only 1 of Existing members or Custom List can be used at one time — what do you suggest? Should we allow both and we merge and dedup or only one. So the UX would have to change accordingly."
- **Status**: UNADDRESSED — agent recommendation pending user confirmation; mock unchanged until user signals direction
- **Agent recommendation**: see chat reply (`← recommended` block).

### Comment R2-3 — UNADDRESSED (strong POV)
- **Author**: manohar.madhira@outlook.com
- **Type**: chat (mock-review iteration — strong-POV directive)
- **Surface**: Scene 2 · Custom List paste textarea
- **Comment**: "Strong POV — Email list should allow Name <email> format also and can be , ; or EOL separated."
- **Status**: UNADDRESSED — mock + spec R6 update needed
- **Implication**: Custom List parser accepts (a) plain identifier per line (existing), (b) RFC-822-style `Display Name <email@example.com>`, (c) separators are comma `,`, semicolon `;`, or EOL — operator can paste a single long line of comma-separated entries or one-per-line or mix. Names extracted from the angle-bracket form populate `firstName` / `lastName` on auto-enrolled members (last whitespace-separated token → lastName; everything before → firstName). Mock: update textarea placeholder + sample data to demonstrate the format; spec R6 amendment in next round.

### Comment R2-4 — UNADDRESSED
- **Author**: manohar.madhira@outlook.com
- **Type**: chat (mock-review iteration)
- **Surface**: Scene 2 · preview table columns
- **Comment**: "Remove Tier for now. in the preview. For Last response - it should show two columns - this survey and all surveys."
- **Status**: UNADDRESSED — mock update + spec R12 update needed
- **Implication**: preview table column set changes: Name · Identifier · **Last response on this survey** · **Last response across all surveys**. Tier column dropped (consistent with V0 removal of tier-based filter predicates per Round-1 Comment 2c). Spec R12 acceptance criterion amends accordingly.

### Comment R2-5 — UNADDRESSED
- **Author**: manohar.madhira@outlook.com
- **Type**: chat (mock-review iteration)
- **Surface**: Scene 3 · Success state
- **Comment**: "Include text Users will be able to respond only once in this wave."
- **Status**: UNADDRESSED — mock + spec update needed
- **Implication**: Success state surfaces explanatory line *"Users will be able to respond only once in this wave."* under or near the success banner — sets respondent-side expectation for the operator before they distribute. Spec §2.5 / R16 amends to require this copy.

### Comment R2-6 — UNADDRESSED
- **Author**: manohar.madhira@outlook.com
- **Type**: chat (mock-review iteration — global)
- **Surface**: all 6 mock scenes · top-right org-switcher chip
- **Comment**: "All scenes, Org name need not be shown on top right. That layout should be consistent with current experience."
- **Status**: UNADDRESSED — mock update needed across all 6 scenes
- **Implication**: drop the `.org-switcher` block from `.admin-top` in all scenes. Logo stays left; right side empty (matches the actual admin shell chrome which uses the left-side nav for org context). Spec is unaffected — this is a mock-fidelity correction.

## Round 1 Feedback
*Received: 2026-05-15 via chat with manohar.madhira@outlook.com*
*Surface: pre-document-review iteration on User Experience flow before reviewer reads spec*
*Resolution: all 20 items addressed in the Round-2 spec rewrite + mock rewrite (see Iteration history table in the spec).*

### Comment 1 — UNADDRESSED
- **Author**: manohar.madhira@outlook.com
- **Type**: chat (UX-flow iteration)
- **Surface**: §1 "Entry point" — `Send via my email tool →` tile copy on survey detail page Distribution section
- **Comment**: "Like the Send via email tool — I like the positioning. Change the text to *Generate per-recipient links for mail-merge applications like Mailchimp or use the links to send individual mails.*"
- **Status**: ADDRESSED in commit `<round-2 spec+mock rewrite>` — see resolving spec sections / mock scenes inline below
- **Implication for spec**: replace tile description copy in §1, R1 acceptance criterion, and mock Scene 1's tile body.

### Comment 2 — UNADDRESSED
- **Author**: manohar.madhira@outlook.com
- **Type**: chat (UX-flow iteration)
- **Surface**: §2 "Distribute flow — four steps" (entire wizard shape)
- **Comment**: "Send via email tool should be quick to navigate, not an elaborate 4 step process."
- **Status**: ADDRESSED in commit `<round-2 spec+mock rewrite>` — see resolving spec sections / mock scenes inline below
- **Implication for spec**: collapse the four-step wizard into a single short page. No step-rail, no `Back / Continue` pagination. Sub-points enumerated as Comments 2a–2e below.

### Comment 2a — UNADDRESSED
- **Author**: manohar.madhira@outlook.com
- **Type**: chat (UX-flow iteration)
- **Surface**: §2.1 Audience modes A and B (Percent / Count)
- **Comment**: "Existing members: Show the total number of Members and ask for: Existing Members: X% or N Count. If there are no members, don't show this option."
- **Status**: ADDRESSED in commit `<round-2 spec+mock rewrite>` — see resolving spec sections / mock scenes inline below
- **Implication for spec**: merge Modes A (Percent) and B (Count) into one "Existing Members" mode with a percent-or-count toggle. Display total members count from the brand's member roster. Conditional rendering: if total members = 0, the "Existing Members" mode is not offered at all (only Custom List remains).

### Comment 2b — UNADDRESSED
- **Author**: manohar.madhira@outlook.com
- **Type**: chat (UX-flow iteration)
- **Surface**: §2.1 Audience mode C (Explicit list)
- **Comment**: "Custom List: Can accept a pasted identifiers or upload CSV. Should have a checkbox to Auto-Enroll missing members."
- **Status**: ADDRESSED in commit `<round-2 spec+mock rewrite>` — see resolving spec sections / mock scenes inline below
- **Implication for spec**: retain Mode C's paste / CSV-upload shape and the auto-enroll checkbox; rename to "Custom List" in the UI. R6, R7 stay materially the same; copy aligns.

### Comment 2c — UNADDRESSED
- **Author**: manohar.madhira@outlook.com
- **Type**: chat (UX-flow iteration)
- **Surface**: §2.1 filter predicate panel (predicate chip-row reusing `SearchMembersQuerySchema`)
- **Comment**: "Filter predicate is too early to add — None of these data / processes are wired end to end. Remove for V0. I like the concept, we should keep this in V1."
- **Status**: ADDRESSED in commit `<round-2 spec+mock rewrite>` — see resolving spec sections / mock scenes inline below
- **Implication for spec**: remove the filter predicate panel entirely from V0. Drop R5 (predicate reuse of `SearchMembersQuerySchema`). Move predicate shape to V1.x roadmap with explicit note: "Audience predicates (tier / status / sentiment / health-score filters) deferred to V1 — current data wiring across health score, sentiment, and tier filters is not end-to-end production-ready; surfacing them in V0 would mis-promise capability."

### Comment 2d — UNADDRESSED
- **Author**: manohar.madhira@outlook.com
- **Type**: chat (UX-flow iteration)
- **Surface**: §2.1 sampling seed input (with `🔄 New seed` and `📋 Copy`)
- **Comment**: "Sampling seed — seems too technical for showing to users. Why do they care?"
- **Status**: ADDRESSED in commit `<round-2 spec+mock rewrite>` — see resolving spec sections / mock scenes inline below
- **Implication for spec**: remove seed surfacing from the UI. Seed remains internal infrastructure on `DistributionBatch.samplingSeed` to enable deterministic Re-run (operators see "same audience as last wave," not "seed `a7b3c1f4`"). The Re-run action chooses behavior in outcome terms ("same audience" vs "fresh sample"), not seed terms — open clarifying question OQ-R1.Q3 below.

### Comment 2e — UNADDRESSED
- **Author**: manohar.madhira@outlook.com
- **Type**: chat (UX-flow iteration)
- **Surface**: §2.2 Preview step — Wave label field
- **Comment**: "Suggest adding a field for capturing Survey name in mail (see point 5 below). Default this to survey title."
- **Status**: ADDRESSED in commit `<round-2 spec+mock rewrite>` — see resolving spec sections / mock scenes inline below
- **Implication for spec**: add a "Survey name in mail" field defaulting to `Survey.title`. This name flows into the CSV merge-tag rows so the mail body can reference the survey by a controlled name. New column `DistributionBatch.surveyNameInMail` (or carry on `audienceSpec` JSON). Distinct from the existing operator-facing wave label.

### Comment 3 — UNADDRESSED
- **Author**: manohar.madhira@outlook.com
- **Type**: chat (UX-flow iteration)
- **Surface**: §2.2 Preview step summary cards
- **Comment**: "I like the Review the page info"
- **Status**: ADDRESSED in commit `<round-2 spec+mock rewrite>` — see resolving spec sections / mock scenes inline below — qualified by 3a–3c
- **Implication for spec**: retain Preview's summary card + first-50-rows table format. Adjust per 3a–3c below.

### Comment 3a — UNADDRESSED
- **Author**: manohar.madhira@outlook.com
- **Type**: chat (UX-flow iteration)
- **Surface**: §2.2 summary cards — "Mode" + "Tokens to mint" + "Auto-enrollments" + "Unmatched"
- **Comment**: "Why do we need Tokens to Mint and Count separate? When will they be different?"
- **Status**: ADDRESSED in commit `<round-2 spec+mock rewrite>` — see resolving spec sections / mock scenes inline below
- **Implication for spec**: with predicate removed (2c), Tokens to Mint always equals the selected Count / Percent-resolved number (Existing Members mode) or the resolved-identifier count (Custom List mode). Eliminate the redundant card — show one number for "members in this wave." Auto-enrollments stays as a separate counter (3b).

### Comment 3b — UNADDRESSED
- **Author**: manohar.madhira@outlook.com
- **Type**: chat (UX-flow iteration)
- **Surface**: §2.2 summary cards — Auto-enrollments
- **Comment**: "I like Auto-enrollments to be shown"
- **Status**: ADDRESSED in commit `<round-2 spec+mock rewrite>` — see resolving spec sections / mock scenes inline below
- **Implication for spec**: retain Auto-enrollments summary card in Custom List mode. Hidden in Existing Members mode (no auto-enrollments possible). Mock Scene 2/3 reflects this.

### Comment 3c — UNADDRESSED
- **Author**: manohar.madhira@outlook.com
- **Type**: chat (UX-flow iteration)
- **Surface**: §2.2 preview table
- **Comment**: "Preview is good. Make sure fields are available. Preview would change if users paste or upload a CSV"
- **Status**: ADDRESSED in commit `<round-2 spec+mock rewrite>` — see resolving spec sections / mock scenes inline below
- **Implication for spec**: preview updates live in response to mode switch + input changes (existing-members count slider or custom-list paste/upload). Required fields surfaced per row: name (if known) + identifier-of-record. Custom-List preview adds an `unmatched` subsection (existing); the rest matches.

### Comment 4 — UNADDRESSED
- **Author**: manohar.madhira@outlook.com
- **Type**: chat (UX-flow iteration)
- **Surface**: §2.3 Confirm step
- **Comment**: "Confirm is already for the same info we shown in preview. So don't see the purpose."
- **Status**: ADDRESSED in commit `<round-2 spec+mock rewrite>` — see resolving spec sections / mock scenes inline below
- **Implication for spec**: drop the standalone Confirm step. The Preview becomes the configuration surface itself; the primary `Generate links` button sits at the bottom of the same page. Removes R11. After click, the page transitions in place to the Download state (no route change).

### Comment 5 — UNADDRESSED
- **Author**: manohar.madhira@outlook.com
- **Type**: chat (UX-flow iteration)
- **Surface**: §2.4 Download step — three artifact cards (CSV full + CSV ESP-shaped + merge-tag snippet)
- **Comment**: "Once generated can we show Download CSV — Include in the CSV the merge tag with the actual link and the use the title from 1e). I like the option of mail merge providers. Can't we combine the Download into one drop down — Generic on top, specific mail providers below."
- **Status**: ADDRESSED in commit `<round-2 spec+mock rewrite>` — see resolving spec sections / mock scenes inline below
- **Implication for spec**: collapse the three download artifacts into a single dropdown selector + one Download button. Dropdown options: Generic (first / default), Mailchimp, HubSpot, Klaviyo. The CSV includes the merge tag (vendor-specific syntax) inline in the URL column — so the operator copies one CSV, mail-merges, and the rendered URL carries the survey-name-in-mail field from 2e. Remove the separate "merge-tag snippet" card (it's redundant once the merge tag is baked into the CSV column). R15 simplifies.

### Comment 6 — Answer to Q1 (Survey-name-in-mail surface) — UNADDRESSED
- **Author**: manohar.madhira@outlook.com
- **Type**: chat (UX-flow iteration — Q1 reply)
- **Comment**: "1a — Note that Default Survey Name should the user facing title, not internal."
- **Status**: ADDRESSED in commit `<round-2 spec+mock rewrite>` — see resolving spec sections / mock scenes inline below
- **Implication for spec**: CSV gets two columns `surveyName` + `mergeTagUrl`. Default value for `DistributionBatch.surveyNameInMail` is `Survey.title` (the **respondent-facing** title introduced in #241 R7 — *not* `Survey.name`, which is the admin-only internal label). The configure page's "Survey name in mail" input pre-fills with `Survey.title`; operator may edit before generating.

### Comment 7 — Answer to Q2 (Re-run defaults) — UNADDRESSED
- **Author**: manohar.madhira@outlook.com
- **Type**: chat (UX-flow iteration — Q2 reply, contextualized in Scene 7 feedback)
- **Comment**: "2c" — but contextualized by Scene 7 reply: *"In V1 we can add — Generate new tokens for same audience on expired tokens — that could take you back to member selection with the seed intact."*
- **Status**: ADDRESSED in commit `<round-2 spec+mock rewrite>` — see resolving spec sections / mock scenes inline below
- **Implication for spec**: **V0 ships without a Re-run primitive.** The "Re-run with same audience" flow becomes a **V1.x feature** — "Generate new tokens for same audience on expired tokens" — that re-opens the configure page pre-populated with the prior audience, using the internal seed for deterministic sampling. V0 operators who want to send the same 100 members each quarter use **Custom List mode** with their own identifier list (the operator maintains the list externally; the seed is preserved on `DistributionBatch.samplingSeed` so the V1 affordance can be added without schema change). Q2c's "Same audience or fresh sample?" prompt becomes the V1 design recommendation, not a V0 requirement.

### Comment 8 — Answer to Q3 (Existing Members mode when zero exist) — UNADDRESSED
- **Author**: manohar.madhira@outlook.com
- **Type**: chat (UX-flow iteration — Q3 reply)
- **Comment**: "3a"
- **Status**: ADDRESSED in commit `<round-2 spec+mock rewrite>` — see resolving spec sections / mock scenes inline below
- **Implication for spec**: when `brand.memberCount = 0`, the Existing Members mode card is hidden entirely; Custom List is the only mode rendered. R4 acceptance criterion updated.

### Comment 9 — Scene 6 (Distribution batches sub-section on detail page) — UNADDRESSED
- **Author**: manohar.madhira@outlook.com
- **Type**: chat (UX-flow iteration — Scene 6)
- **Surface**: spec §3 "Distribution Batches sub-section on the survey detail page" (the prior standalone table)
- **Comment**: "How about we enter a filter section between Loop Monitor and Response to filter on Distribution batches, with a link to view the details about the batch?"
- **Status**: ADDRESSED in commit `<round-2 spec+mock rewrite>` — see resolving spec sections / mock scenes inline below
- **Implication for spec**: replace the standalone Distribution-batches table sub-section with a **filter row positioned between Loop Monitor (#241 R32b) and Response (#241 R32)** on the survey detail page. The filter offers a batch selector (default: "All batches"); selecting a batch filters the Response section below to that batch's responses. Each batch entry in the filter dropdown carries a `Details →` link to the batch detail page (`/admin/surveys/:id/distribute/batches/:batchId`). Discovery + drill-down through one compact surface — no separate table section. Detail-page section ordering becomes:
  1. Distribution (#241 R26)
  2. Loop Monitor (#241 R32b)
  3. **Distribution batches filter (NEW)**
  4. Response (#241 R32)
  5. Configuration summary (#241 R28)

### Comment 10 — Scene 7 verbiage — UNADDRESSED
- **Author**: manohar.madhira@outlook.com
- **Type**: chat (UX-flow iteration — Scene 7 token-status verbiage)
- **Surface**: spec §3.1 batch detail token-status column + Distribution-batches table column copy
- **Comment**: "verbiage is very technical — doesn't minted mean sent? Consumed means responded?"
- **Status**: ADDRESSED in commit `<round-2 spec+mock rewrite>` — see resolving spec sections / mock scenes inline below
- **Implication for spec**: rename token-status terminology throughout user-facing surfaces (batch detail table, summary cards, filter labels, mock scenes):
  - `Minted` → `Sent`
  - `Consumed` → `Responded`
  - `Pending` → `Awaiting response`
  - `Expired` → `Expired` (already operator-friendly, retained)
  - `Revoked` → removed (Revoke action dropped per Comment 12)
  - Schema column names (`consumedAt`, `tokenHash`, etc.) stay as-is — they're back-end identifiers; the UI/CSV column names use the operator-friendly terms.

### Comment 11 — Scene 7 batch detail audience spec — UNADDRESSED
- **Author**: manohar.madhira@outlook.com
- **Type**: chat (UX-flow iteration — Scene 7 audience spec)
- **Surface**: batch detail page Audience Spec block
- **Comment**: "In Audience Spec we will have to show number of members when minted and now. Otherwise later people may think system made an error."
- **Status**: ADDRESSED in commit `<round-2 spec+mock rewrite>` — see resolving spec sections / mock scenes inline below
- **Implication for spec**: the batch detail's Audience Spec block displays **two member counts**: "Members in audience at send time: N" + "Members in audience now: M" (where M ≤ N, accounting for members who left the brand, were erased, or otherwise dropped out since send). The delta is implicitly explained (no extra UI needed — the operator infers from the two numbers). Computed at view time; no caching needed (active member count is a quick query). Used to pre-explain why a V1 "Generate new tokens for same audience" run will hit M members, not N.

### Comment 12 — Scene 7 Revoke remaining action — UNADDRESSED
- **Author**: manohar.madhira@outlook.com
- **Type**: chat (UX-flow iteration — Scene 7 revoke)
- **Surface**: spec §3.1 `Revoke remaining` action + R26
- **Comment**: "At this time, I would not suggest adding Revoke remaining. If necessary, then let us add a capability to edit Expiry Date is survey is still open."
- **Status**: ADDRESSED in commit `<round-2 spec+mock rewrite>` — see resolving spec sections / mock scenes inline below
- **Implication for spec**: **drop the Revoke remaining action and its endpoint (`POST /v1/surveys/:id/distribution-batches/:batchId/revoke`) entirely from V0.** Drop R26 in current form. Drop `DistributionBatch.revokedAt`, `.revokedBy`, `.revokeReason` columns. Add a constructive control instead: **Edit Expiry Date** — operator can modify the batch's expiry on the batch detail page while the survey is still open. New endpoint `PATCH /v1/surveys/:id/distribution-batches/:batchId/expiry`. New R26 reframed around this. Open question: extend-and-shorten allowed, or only extend (more conservative — see Q-Round1.A below).

### Comment 13 — Scene 7 Expiry Date placement — UNADDRESSED
- **Author**: manohar.madhira@outlook.com
- **Type**: chat (UX-flow iteration — Scene 7 expiry)
- **Surface**: batch detail page Audience Spec block
- **Comment**: "That means we would not need Expiry Date in the Audience."
- **Status**: ADDRESSED in commit `<round-2 spec+mock rewrite>` — see resolving spec sections / mock scenes inline below
- **Implication for spec**: on the batch detail page, expiry is **not** shown inside the read-only Audience Spec block. It surfaces as its own editable property (label "Links expire on: 2026-05-22 17:24 UTC · [Edit]"). Audience Spec is read-only history (what audience was chosen + when); expiry is mutable (until survey-not-open or past expiry).

### Comment 14 — Scene 7 sampling seed — UNADDRESSED
- **Author**: manohar.madhira@outlook.com
- **Type**: chat (UX-flow iteration — Scene 7 seed)
- **Surface**: batch detail page Audience Spec block
- **Comment**: "Again Sampling Seed can hidden."
- **Status**: ADDRESSED in commit `<round-2 spec+mock rewrite>` — see resolving spec sections / mock scenes inline below
- **Implication for spec**: seed not surfaced anywhere in the V0 UI (configure page, preview, batch detail). Column `DistributionBatch.samplingSeed` retained in the schema for V1 affordance. Hidden in API responses to non-admin consumers.

### Comment 15 — Scene 7 V1 hook — UNADDRESSED
- **Author**: manohar.madhira@outlook.com
- **Type**: chat (UX-flow iteration — Scene 7 V1 hook)
- **Surface**: V1 roadmap note
- **Comment**: "In V1 we can add - Generate new tokens for same audience on expired tokens - that could take you back to member selection with the seed intact."
- **Status**: ADDRESSED in commit `<round-2 spec+mock rewrite>` — see resolving spec sections / mock scenes inline below — V1 roadmap, no V0 spec change beyond preserving the seed column
- **Implication for spec**: V1.x roadmap note (in Non-goals or Future Enhancements): "Generate new tokens for the same audience" affordance on expired batches — opens the configure page pre-populated with prior audience, deterministic re-sample via `DistributionBatch.samplingSeed`. Confirms Q2c (`Same audience` / `Fresh sample` prompt) as the V1 design.

### Comment 16 — Scene 8 respondent form — UNADDRESSED
- **Author**: manohar.madhira@outlook.com
- **Type**: chat (UX-flow iteration — Scene 8)
- **Surface**: mock Scene 8 "Respondent's view at tokenized URL"
- **Comment**: "we do not need to show this. Preview for the Survey is alread in the Configuration Section"
- **Status**: ADDRESSED in commit `<round-2 spec+mock rewrite>` — see resolving spec sections / mock scenes inline below
- **Implication for spec**: **drop mock Scene 8 entirely.** The respondent-facing form preview already lives in #241 R28's Configuration Summary section on the survey detail page (it renders the actual configured survey form under a "Survey preview" header). No need to duplicate in #378's mock. Spec §4 ("The respondent's experience") still describes the tokenized-URL behavior, but without a dedicated mock scene — the existing #241 preview applies.

### Comment 17 — Scene 9 error copy — UNADDRESSED
- **Author**: manohar.madhira@outlook.com
- **Type**: chat (UX-flow iteration — Scene 9)
- **Surface**: spec §4 token-error states + mock Scene 9
- **Comment**: "We don't have a way to show the 'support' section. Replace with a generic text, contact sender."
- **Status**: ADDRESSED in commit `<round-2 spec+mock rewrite>` — see resolving spec sections / mock scenes inline below
- **Implication for spec**: error copy on token-failure states drops the `Brand.supportEmail` reference. Replace with "contact the sender" — referring to the operator/brand that sent the email. New error copy:
  - **Expired**: "This survey link has expired. If you still want to share feedback, please contact the sender."
  - **Already responded**: "This survey has already been submitted. Thank you for your response!"
  - **Survey not open** (replaces "Revoked" — survey is DRAFT/PAUSED/STOPPED): "This survey is no longer open. If you still want to share feedback, please contact the sender."
  - **Invalid link**: "This link is not valid. Please check that you copied the full link from your email, or contact the sender."
  
  Token states simplify to **3 states + 1 survey-state failure**: `Awaiting response` / `Responded` / `Expired`, plus the surveys-not-active failure surfaces at the same error path as the prior `Revoked` state.

### Comment 18 — Answer to Q-R1.A (Edit Expiry direction) — UNADDRESSED
- **Author**: manohar.madhira@outlook.com
- **Type**: chat (UX-flow iteration — Q-R1.A reply)
- **Comment**: "A1" — Edit Expiry allows both extend and shorten while survey is open
- **Status**: ADDRESSED in commit `<round-2 spec+mock rewrite>` — see resolving spec sections / mock scenes inline below
- **Implication for spec**: `PATCH /v1/surveys/:id/distribution-batches/:batchId/expiry` accepts a new `expiresAt` value that may be earlier or later than the current value (subject to: survey status = ACTIVE; new value must be ≥ now()). Updates `DistributionBatch.expiresAt` and propagates to all tokens in the batch.

### Comment 19 — Answer to Q-R1.B (Filter scope) — UNADDRESSED
- **Author**: manohar.madhira@outlook.com
- **Type**: chat (UX-flow iteration — Q-R1.B reply)
- **Comment**: "B1" — filter applies to Response section only; Loop Monitor stays lifetime-pipeline-wide
- **Status**: ADDRESSED in commit `<round-2 spec+mock rewrite>` — see resolving spec sections / mock scenes inline below
- **Implication for spec**: filter row sits between Loop Monitor and Response on the detail page; the batch selection narrows Response section data only. Loop Monitor (issue #6 hero pipeline view per #241 R32b) renders unchanged regardless of filter state. Default filter value: "All batches" (Response shows lifetime responses with `distributionBatchId IS NULL` rows plus all batch-attributed rows).

### Comment 20 — V0 narrowing of Issue Success Criterion 4 — UNADDRESSED
- **Author**: manohar.madhira@outlook.com
- **Type**: chat (UX-flow iteration — confirmation of V0 narrowing)
- **Comment**: "resending to same audience will address as a new V1 - since it requires its own scoping"
- **Status**: ADDRESSED in commit `<round-2 spec+mock rewrite>` — see resolving spec sections / mock scenes inline below
- **Implication for spec**: V0 ships with **no** Re-run primitive whatsoever — no V0 "Download audience for re-use" button, no "Re-run with same audience" action, no UI surfacing of seed continuity. The full "send to same audience again" capability is a separate V1 issue requiring its own spec. V0 operators who want quarterly continuity to the same N members maintain their own identifier list externally and paste it into Custom List each wave. Spec's Non-goals section explicitly calls this out + opens a future issue placeholder.

### Overarching ask — UNADDRESSED
- **Author**: manohar.madhira@outlook.com
- **Type**: chat (UX-flow iteration)
- **Surface**: §2 wizard shape + §3 batches sub-section relationship
- **Comment**: "With the above can the page become a single 'short' page — no tabs, no sections? The users are here to get the job done, not navigate multiple tabs."
- **Status**: ADDRESSED in commit `<round-2 spec+mock rewrite>` — see resolving spec sections / mock scenes inline below
- **Implication for spec**: `/admin/surveys/[id]/distribute` becomes a single vertical page with two visual states: **(1) Configure** — mode selector + mode-specific fields + common fields (expiry, survey-name-in-mail) + live preview + Generate button; **(2) Success / Download** — success message + dropdown + Download CSV button + done navigation. No tabs, no step-rail, no section accordions. Estimated visible height when configured: 600–700px scroll-free on a 13-inch laptop. The post-wave Distribution batches section on the survey detail page (current spec §3) is retained — that's a separate surface (history of past waves) and was not in the scope of this overarching ask.
