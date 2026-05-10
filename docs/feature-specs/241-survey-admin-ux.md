# Feature: Survey Admin UX — green-slate revamp

Issue: [#241](https://github.com/mathursrus/CustomerEQ/issues/241)
Owner: manohar.madhira@outlook.com
Status: **Ready for review (R4 converged).**
Last touched: 2026-05-10

---

## Customer

The primary persona is the **marketing manager** at a mid-market brand on CustomerEQ. They own the survey end-to-end — they create it, configure its distribution, set the thank-you copy, and (once Post-Survey Actions ship in a future iteration) configure the rules that fire on response. They are not necessarily a developer. Their mental model is "I want to measure NPS after a tier upgrade" or "I want a one-question feedback widget on my product page" — not "I want to configure a Trigger then a SurveyBuilder then an EarningRule."

A secondary persona is the **brand admin** who configures brand-level defaults — consent mode, member-identifier kind, brand-theme library — in [Organization Settings (#277)](277-organization-settings.md). The survey editor inherits from those defaults and exposes per-survey override only where business value warrants. In small organizations the two personas may be the same person; the surfaces are designed so the marketing manager never needs to enter Organization Settings to ship a survey. RBAC implication: the survey editor's theme picker is a *selector* over the brand theme library; theme creation/editing remains in Organization Settings because survey creators may not have theme-edit access.

A tertiary persona is the **respondent** — the customer who sees and submits the survey, either via a CustomerEQ-hosted link or rendered inline by the brand's widget JS on their own page. #241 owns how the brand admin *configures* what the respondent sees; #231 owns how responses are persisted.

## Customer's Desired Outcome

1. **One coherent surface** for creating, editing, and managing a survey from idea to live data — no choice between a wizard and a builder; no broken-link edit path; no accidental duplicate drafts.
2. **Compliant by default, customizable when justified.** Consent inherits from the brand. The survey owner overrides only when they have a reason; a more-permissive override requires an attestation that names who authorized it, when, and why — the same audit shape the brand-side editor uses.
3. **Predictable points behavior.** A single configured value credits exactly once per accepted response through the program, atomically with a `LoyaltyEvent` row. Points appear in the invitation and in the thank-you message — never on the survey form itself, where their presence depresses response quality.
4. **One survey, many channels.** A single survey row is reusable across share link, embed widget, email integration, QR — every channel live simultaneously, no per-channel duplication. The form-renderer adapts to the channel; per-channel chrome (logo / brand name / title visibility) is configurable in one place.
5. **Detail page that matches the job at hand.** Before responses land, the page focuses on edit + distribute. After responses land, configuration recedes and analytics takes the foreground — without the operator switching pages or templates.

## Customer Problem being solved

Today's survey admin experience is *visibly* fragmented. The 2026-05-10 directive on #241 enumerates the cluster:

- **Three entry points, no clear primary.** `/admin/surveys/new` (adhoc form-based), the triggered wizard (4 steps with rule-builder), and `/admin/survey-builder` (drag-drop question canvas). Each writes to the same `Survey` row but exposes a different subset of fields — a survey created in one path is not editable in another without code-reading.
- **No way to view a survey or edit a draft.** The list page lacks Edit affordances; the detail page has no Edit button (admins guess the `/edit` URL); the `/edit` URL is a redirect stub to survey-builder which only edits questions — not status, theme, consent, or thank-you.
- **Duplicate drafts.** The wizard POSTs `/v1/surveys` on every "Next" click — navigating back-and-forward produces orphan rows.
- **Vocabulary drift.** "Launch", "Activate", "Publish" used inconsistently for the same DRAFT→ACTIVE transition. "Close" used for an irreversible-feeling action that's actually reversible. Builder's "Launch" leaves the survey in DRAFT, requiring a separate Activate.
- **Two parallel earning paths.** `Survey.incentivePoints` (decorative widget badge) plus `EarningRule.triggerEvent='survey_completion'` (separate wizard, mismatched vocabulary). Empirically confirmed prod bug: customer configures the EarningRule, member submits NPS, `pointsBalance` stays at zero.
- **Rule-action picker contract broken.** The current dropdown lists six action types; five save with `actionConfig: {}` and the worker silently drops them.
- **Consent override missing from the editor.** #276 shipped the schema columns and the data migration to unblock production; #283 carries the PATCH endpoint and the editor panel. Both are #241's home — `#283` is absorbed into this Epic.
- **No surface for survey-theme UI elements.** Brand theme is now separated from survey theme (#291), but the survey owner has no way to pick a theme or set a thank-you message in the editor.
- **Embedded vs. standalone differences are configured nowhere.** Today the difference is post-launch only — a "Copy Widget" button on the detail page if status=ACTIVE. The owner can't preview an embedded form or tune brand-chrome visibility per channel.
- **GDPR / CCPA paths exist in schema but not in editor.** Brand-level defaults from #277/#292 are shipped; the survey-level override surface is not.

The cumulative effect: a marketing manager who wants to "ship a feedback survey on my product page" has to learn three editors, two earning models, and one broken picker — and is one unconfirmed click away from creating a duplicate draft or stopping a live survey. The directive is to redesign this end-to-end rather than patch field-by-field.

## User Experience that will solve the problem

The mock at [`mocks/241-survey-admin-ux.html`](mocks/241-survey-admin-ux.html) is the working artifact (fully interactive — reviewers walk the flow in-browser). Sections below describe the experience at the level of "specific steps the user takes"; the mock is the source of truth for visual layout.

### §1. Surveys list

- **Path**: `/admin/surveys`
- **One primary CTA**: `+ New survey` creates a draft and routes to the editor (`/admin/surveys/[id]/edit`).
- **Columns** (left-to-right): **Name** (with description + program in a muted meta line below) · **Type** (its own column — NPS / CSAT / CES / Custom rendered as a discrete pill) · **Status** (badge) · **Responses** · **Updated** (relative time) · row actions. Type-as-column prepares for column-header sortability later.
- **Row click** opens the read-only Detail page (Programs / Campaigns pattern). Edit happens from there, or directly via the row-end ✎ button.
- **Row actions**: Edit (✎) + More (⋯).
- **⋯ menu (state-aware)**: Duplicate (always) · Discard draft (DRAFT only) · Pause (ACTIVE only) · Stop (ACTIVE / PAUSED only) · Restart (STOPPED only) · Delete (STOPPED only, with confirm).
- **Filter chips** at the top: **Status** (All / Draft / Active / Stopped) and **Type** (NPS / CSAT / CES / Custom). No Trigger or Distribution chips — CustomerEQ doesn't natively trigger surveys in V0, and distribution is multi-channel (not a categorical attribute).
- **Status badges** use the converged vocabulary: Draft / Active / Paused / Stopped. (Schema rename `SurveyStatus.CLOSED → STOPPED`.)

### §2. The Survey editor — 4 horizontal tabs

- **Path**: `/admin/surveys/[id]/edit`.
- **Shape**: horizontal tabs at the top of the page, one tab body visible at a time. Tabs in order: **Basics → Questions → Look & Feel → Points & Thank You**. Each tab body ends with **Back** and **Continue** buttons; the auto-save indicator sits in the page header alongside the status pill, and the primary `Activate` button sits top-right.
- **Saving**: each field auto-saves on blur (debounced) into the same `Survey` row that was created at "+ New survey" time. No POST on tab navigation. Activation calls `PATCH /v1/surveys/:id/status DRAFT → ACTIVE` and gates on (a) `Survey.questions.length >= 1` and (b) all required fields complete.

#### §2.1 Basics

The foundation tab. Everything the form needs to render and persist responses.

- **Internal name** (`Survey.name`) — admin-only label. Required. "Used in the surveys list and analytics. Only your team sees this."
- **Survey title** (`Survey.title`, **new nullable column**) — respondent-facing form heading. Required. Subject to per-channel visibility toggle in Look & Feel. Existing surveys are backfilled at migration time to `Survey.name`.
- **Type** (NPS / CSAT / CES / Custom) — a 4-card grid with one-line "use this when" captions on each card. Picking NPS / CSAT / CES auto-populates the Questions tab with the standard set (all editable + reorderable). Custom = blank canvas.
- **"Not sure which to pick?"** — collapsed by default; expands to a guidance block (loyalty checkpoint → NPS, post-experience → CSAT, post-effort → CES, no-fit → Custom). The toggle uses the platform's standard `▼` chevron (rotated -90deg when collapsed) per the Organization Settings convention.
- **Program** — required FK; points credit through this program.
- **Description** — optional admin note; surfaces under the survey name in the list.
- **Response policy** (per #231) — single dropdown with three options: Allow multiple responses (default) / One response per member / Latest overwrites prior.
- **Consent collection** (sub-block) — see §2.1.1.

##### §2.1.1 Consent collection sub-block (inside Basics)

A single dropdown for consent mode with a live preview below and an optional disclosure-text override at the bottom — the same shape the Organization Settings consent surface uses.

- **Consent mode dropdown**:
  - `Inherit brand default · <resolved mode>` (default; e.g., "Inherit brand default · Explicit consent required")
  - `Override · Implied on submit` (visible only if it differs from brand default — per #276 round-1 reviewer note carried into #283)
  - `Override · Explicit consent required` (visible only if brand default is Implied)
- **Override-to-more-permissive triggers attestation.** Setting the dropdown to a more-permissive value surfaces an amber callout in the section ("This deviation will be logged — when you save, you'll be asked to confirm and supply a reason"). On Save, the **attestation modal** fires: identity (auto-filled), reason text (required, ≤500 chars, soft-warns on PII shapes), checkbox attestation. On confirm, `Survey.consentMode`, `Survey.consentSuppressedAttestedBy`, `Survey.consentSuppressedAttestedAt`, and `Survey.consentReason` are written via the PATCH endpoint absorbed from #283.
- **Override-to-stricter** does not trigger attestation (it's a more conservative posture) but still writes an audit row.
- **Preview card** — directly below the dropdown. Renders the disclosure exactly as the respondent will see it: with checkbox when Explicit; without checkbox (paragraph form) when Implied. Mode indicator in the preview header ("Explicit · with checkbox" / "Implied · no checkbox") updates as the dropdown changes.
- **Disclosure text override** (`Survey.consentTextOverride`) — uses **the same editor UX as the Organization Settings disclosure text editor**: a `.consent-toolbar` above the textarea with two insert buttons (`[+] Privacy link`, `[+] Terms link`) and a `Reset to brand default` link. Clicking a button inserts a token of the form `{{privacy:"Privacy Policy"}}` or `{{terms:"Terms and Conditions"}}` at the cursor (wraps the current selection if any). Tokens resolve at render time to `<a>` tags pointing at `Brand.privacyPolicyUrl` / `Brand.termsUrl`. If the brand has no Privacy URL, the same field-warning #277 surfaces appears here. If the brand has no Terms URL, the Terms link button is hidden. The preview updates live as the textarea changes.
- **Audit-trail badge** rendered on the survey detail page header when `Survey.consentMode != null`: shows attester + timestamp + reason snippet.

#### §2.2 Questions

The existing `/admin/survey-builder` UX, embedded here as the Questions tab. Drag-drop canvas + question-type palette (11 types per #35) + per-question config panel on the right.

When the Type field in Basics is NPS / CSAT / CES, the canvas pre-populates with that type's standard question set — all editable, all reorderable, deletable. A muted preset banner at the top of the canvas names the active preset; switching the type in Basics updates the preset banner here. Custom = blank canvas, palette is the only source of new questions.

Selecting a question reveals its config in the right rail: text, type, required, skip logic, branching. Same shape as today's builder.

#### §2.3 Look & Feel

Preview-first. The respondent's-eye view is the focus of the tab; theme picker and chrome matrix are the means.

- **Live preview — channel-first.** Top tabs: `🔗 Standalone (link)` and `🧩 Embedded (widget)`. Within each tab, **Desktop preview and Mobile preview render side-by-side**. Each preview shows the actual configured theme, the chrome matrix applied to its channel, the question set, the consent disclosure, and the submit button.
- **Theme picker** — card grid over the brand's BrandTheme library. Each card shows a primary-color swatch + font sample. The brand's default theme is marked and pre-selected. **Shows ALL brand themes** — no count cap. The survey editor is a theme *selector*, not an editor; no `Manage themes →` link surfaces here because the survey creator may not have theme-edit RBAC. Theme creation / editing lives in Organization Settings. CustomerEQ provisions 4 default themes per brand at brand creation; brand admins can add more.
- **Per-channel chrome matrix** — a small table with three rows (Brand logo / Brand name / Survey title) and two columns (Standalone / Embedded). Each cell is a toggle. Defaults: full chrome on Standalone (everything on); minimal on Embedded (only Survey title on — the host page already shows the brand). The form-renderer reads the matrix at render time. Toggles apply to both Desktop and Mobile previews of the active channel simultaneously.

#### §2.4 Points & Thank You

Single home for points and the thank-you experience.

- **Points awarded for completion** — single integer input. Help row: "Credits via your program *<programName>* in *<pointCurrencyName>*. Awarded once per accepted response, atomically with a `LoyaltyEvent` row." Replaces the legacy `Survey.incentivePoints` field. **Backend behavior**: on accepted-response submit, the response handler enqueues a `PROGRAM_EARN` event resolving to the configured points and writing a `LoyaltyEvent` (action `EARN`, source `survey_completion`). No `EarningRule` row required.
- **Thank-you message** — textarea with insert-variable picker. Available variables: `{{points}}`, `{{programName}}`, `{{pointCurrencyName}}`, `{{rewardLink}}`, `{{memberName}}`. Default copy: "Thank you for your feedback! Your `{{points}}` `{{programName}}` `{{pointCurrencyName}}` are on their way to your account."
- **Thank-you redirect URL** (standalone only) — optional URL. If set, post-submit redirects after 3 seconds. Embedded surveys ignore this and show the in-place thank-you state. (Embedded contexts don't navigate the host page.)
- **No in-form points badge. No `showIncentivePoints` toggle.** Points are surfaced in the invitation (email subject, embed snippet preview metadata, share-link unfurl description) and in the thank-you message via `{{points}}` — never on the survey form itself. This protects response quality (Singer & Ye 2013) while still rewarding the member. The field-level rationale is captured in a banner at the bottom of the section.
- **V1 hook**: per-survey override of the program's earn rate is a Campaign primitive, not a Survey field. The Points & Thank You section retains layout room for the future override below the points field once V1 lands. Out of scope for #241.

### §3. One survey, many channels

A single survey row is reusable across every distribution mechanism. The owner does **not** pick "Standalone" or "Embedded" at draft time — they author once and the survey is simultaneously available as:

- **Share link** — CustomerEQ-hosted at `/s/<surveyId>`.
- **Embed widget** — host-mounted JS snippet rendering the same form inside the brand's own page.
- **Email integration** — pre-rendered into outbound campaign emails.
- **QR code** — generated on demand for print, signage, or in-store kiosks.
- **Future channels** — added as the platform grows; survey rows don't need to know about them in advance.

The **form-renderer** adapts to the channel context, per the Look & Feel chrome matrix. The detail page surfaces every distribution mechanism side-by-side post-activation (§7).

### §4. Single earning path (program-credits only — V0)

Already covered in §2.4. To recap the cross-section impact:

- **Editor field**: "Points awarded for completion" — single integer in the Points & Thank You tab.
- **Backend**: response handler enqueues `PROGRAM_EARN` → `LoyaltyEvent` (action `EARN`, source `survey_completion`).
- **Migration**: one-shot data migration deletes `EarningRule` rows with `triggerEvent='survey_completion'`. The "Survey Completion" option is removed from the EarningRule wizard. Affected brands surfaced via a one-line backfill notice in Organization Settings (#277) with a "Review affected surveys" link.
- **In-form rendering**: points are never shown on the form (per §2.4).
- **V1**: per-survey override (e.g., "double points this month") is a Campaign primitive — owners create a campaign that boosts the program's earn rate for the matching survey response window. Filed when demand surfaces.

### §5. Vocabulary

| Operation | UI text | Status transition |
|---|---|---|
| Save without status change | **Save Draft** (auto-save indicator: "Saved · Xs ago") | n/a |
| Make survey live | **Activate** (gates on ≥1 question) | DRAFT → ACTIVE |
| Halt a live survey | **Stop** (modal-confirmed; reversible) | ACTIVE → STOPPED |
| Re-enable a stopped survey | **Restart** (modal-confirmed) | STOPPED → ACTIVE |
| Discard before activation | **Discard draft** (modal-confirmed) | DRAFT → (deleted) |
| Pause for time-bounded edits | **Pause** (rare — for changing questions on a live survey without losing accumulated responses) | ACTIVE → PAUSED |
| Resume from pause | **Resume** | PAUSED → ACTIVE |

- "Launch" is removed from all UI strings.
- "Close" is removed; replaced with "Stop".
- Schema rename: `SurveyStatus.CLOSED → STOPPED`. One migration; UI updates lockstep.

### §6. Activate flow

When the owner clicks `[Activate]` from the editor (top-right header or `Continue` on the Points & Thank You tab), a confirmation modal appears with:

- A short summary panel — type, response policy, consent mode (with override-attribution if applicable), points awarded, theme.
- Cancel returns to the editor.
- **Activate & go to detail** confirms and redirects to the survey's Detail page (`/admin/surveys/[id]`). The Detail page is where the owner sees all distribution surfaces (share link, embed snippet, email integration, QR) — the modal does not duplicate them.

Activation gates: (a) `Survey.questions.length >= 1`, (b) all required fields complete, (c) consent override (if present) attested.

### §7. Detail page — 3 collapsible sections

- **Path**: `/admin/surveys/[id]`.
- **Layout**: single vertical layout. Three sections stacked top-to-bottom, all collapsible. Same shell regardless of survey state. Header chrome (breadcrumb, status pill, audit-trail badge if consent overridden, Edit + More buttons) is in identical position across DRAFT / ACTIVE / PAUSED / STOPPED.
- **All collapsibles use the platform-standard chevron** (`▼` rotating -90deg when collapsed) — same icon set as Organization Settings.

The three sections:

1. **Distribution** — wide compact bar with the 4 distribution surfaces inline (Share link · Embed snippet · Email integration · QR code). Each tile shows a one-line value and a Copy/Manage/Generate action.
   - **Default expanded** when `responsesCount === 0` (no responses yet — the JTBD is share).
   - **Default collapsed** when responses exist (the JTBD is understand; the operator can still toggle open to grab a link).
   - The owner can override either default with the chevron at any time.
2. **Response** — placeholder block in #241 V0. Response analytics (score distribution, sentiment, topic clusters, individual response stream, LoopMonitor) are designed under a future sub-issue (sibling to #235), out of scope here. The placeholder describes what will land.
3. **Configuration summary** — collapsible, default collapsed. Shows the **actual rendered survey form** (the Look & Feel `preview-survey` component) as a first-class element on the left, with a compact text summary on the right (basics / look & feel / points / consent). The "as respondents see it" framing means the operator can verify post-activation that the form looks correct without re-opening the editor.

The Edit button in the detail header takes the owner back to the editor. The More menu opens Stop / Restart / Discard depending on state.

## Compliance Requirements

Per `fraim/config.json customizations.compliance.regulations`: GDPR (in-scope), CCPA (in-scope), SOC2 (target month-12), PCI-DSS (minimal-scope — no card data here).

| Regulation | Clause | Mapped Control |
|---|---|---|
| **GDPR** | [Art. 7 §1 — controller must demonstrate consent](https://gdpr-info.eu/art-7-gdpr/) | The Consent collection sub-block (§2.1.1) inherits from brand by default. Per-survey override to a more-permissive mode fires the attestation modal which captures identity + timestamp + reason on every deviation. Audit-trail badge surfaces this on the detail page header. The attestation PATCH endpoint (absorbed from #283) writes `Survey.consentMode`, `Survey.consentSuppressedAttestedBy`, `Survey.consentSuppressedAttestedAt`, `Survey.consentReason`. |
| **GDPR** | [Recital 32 — consent must be unambiguous and informed](https://gdpr-info.eu/recitals/no-32/) | The disclosure text is always shown to the respondent regardless of channel; only the opt-in checkbox is suppressed under Implied mode, and only with explicit attestation. The Look & Feel chrome matrix can hide brand logo / brand name / survey title but never the consent disclosure. |
| **GDPR** | [Art. 5 §1(b) — purpose limitation](https://gdpr-info.eu/art-5-gdpr/) | Disclosure text inherits `Brand.consentTextDefault`; per-survey override stored in `Survey.consentTextOverride`. The editor's `{{privacy}}` and `{{terms}}` tokens link to the brand's published policies, ensuring the respondent has access to purpose details at the moment of submission. |
| **CCPA** | [§1798.135 — right to opt out + Do Not Sell](https://oag.ca.gov/privacy/ccpa) | CustomerEQ does not sell PII. The audit trail produced by per-survey consent overrides supports `§1798.110` "right to know" requests by attributing every deviation to a named operator with reason text. |
| **CCPA** | §1798.105 — right to deletion | Out of scope here; covered by the existing `apps/worker` erasure job pattern. Consent-override columns are operational metadata, not PII. |
| **SOC2** | CC6.1 — logical access controls | The PATCH endpoint that writes `Survey.consentMode` is gated by the existing brandId-scoped authorization check (project rule R6). The editor cannot write to a survey outside the operator's brand. |
| **SOC2** | CC7.2 — change monitoring | Editor tab saves route through the existing audit plugin (`apps/api/src/plugins/audit.ts`); `inferAction → survey.update` covers section saves. Consent-override writes specifically capture `metadata.consentMode` and `metadata.consentReason` per #283's binding decisions. |

## Validation Plan

| Layer | What | How |
|---|---|---|
| **Browser E2E (Playwright)** | Owner can create a draft, edit every tab, activate, and reach the Detail page; can override consent to IMPLIED with reason; can change theme + per-channel chrome and see preview update; can stop and restart. | New e2e at `apps/web/test/e2e/survey-admin.spec.ts`. Scenarios: (a) NPS preset → activate → respond, (b) Custom blank-canvas → embed-via-widget → respond, (c) consent-override happy path with attestation, (d) detail page (no responses → first response submitted → Distribution auto-collapses on revisit). |
| **Browser regression** | The list page never produces duplicate drafts under back/forward navigation. | E2E asserts the survey row count after the create → edit → back → forward → edit pattern. |
| **Browser regression** | Activate is gated on `Survey.questions.length >= 1`. | E2E asserts the disabled state of Activate when the question list is empty, and the enabled state after one question is saved. |
| **API integration** | All editor tab saves go through the same single PATCH endpoint shape, brand-scoped. | Vitest in `apps/api/test/integration/surveys-admin.test.ts`. Covers each tab's PATCH path and the unauthorized-cross-brand 403. |
| **API integration** | The PATCH `/v1/surveys/:id/consent-mode` endpoint (absorbed from #283) honors the attestation gate end-to-end. | Vitest in `apps/api/test/integration/surveys-consent-override.test.ts`. Includes: (a) override-to-more-permissive without attestation → 422; (b) with attestation → 200, audit row written; (c) override-to-stricter without attestation → 200; (d) override clear (set to null) → 200, audit columns cleared. |
| **Migration** | Schema rename `SurveyStatus.CLOSED → STOPPED` updates every existing row; UI references update lockstep. | Direct psql replay; assert `SELECT count(*) FROM "Survey" WHERE status='CLOSED'` is 0 post-migration; grep the codebase for `'CLOSED'` to confirm no stragglers in UI / API. |
| **Migration** | EarningRule rows with `triggerEvent='survey_completion'` deleted; affected brands logged for the Organization Settings backfill notice. | Direct psql replay; assert affected row count matches the notice's count; replay twice for idempotency. |
| **Migration** | New `Survey.title` column added as nullable; existing rows backfilled to `Survey.name` value so respondents see something during the transition. | Direct psql replay; assert post-migration `SELECT count(*) FROM "Survey" WHERE title IS NULL` is 0. |
| **Compliance** | Re-running the empirical reproduction from #225's `LoyaltyEvent`-zero bug yields a non-zero `LoyaltyEvent` after response submit. | Per the issue body's acceptance criterion. Recorded as a smoke test in staging post-deploy. |

## Alternatives

| Alternative | Why discard? |
|---|---|
| **Patch the existing three entry points in place** (add Edit buttons, fix duplicate-draft bug, rename "Launch", remove broken action types from picker). | Treats symptoms not the root cause. The 2026-05-10 directive is explicit about a green-slate redesign. Field-by-field patches accumulate as new bugs over time. |
| **Linear wizard for create, sectioned editor for subsequent edits.** | Wizard is what produces the duplicate-draft bug. Horizontal tabs handle both create and edit cleanly with Next/Back navigation; auto-save eliminates the duplicate-draft surface. |
| **Two parallel forms — an "easy" form and a "power" builder.** | Restates today's problem. Horizontal tabs + auto-save give "easy by default, power available" in one place. |
| **Keep both earning paths; add a mode switch.** | Adds an axis. The empirical bug is from having two paths at all. V1 per-survey override is a Campaign primitive (a separate axis for boost amount), not a parallel EarningRule. |
| **Show points on the survey form to boost response rate** (a `showIncentivePoints` toggle). | Singer & Ye (2013) finds in-form-visible incentives boost response *rate* but depress response *quality* (the user's concern: "users may trick by only clicking required buttons with arbitrary values"). Points-as-thank-you in invitation + post-submit is the right framing. |
| **Distribution-mode picker at draft time** (Standalone / Embedded). | Owner shouldn't have to pick. The same survey is reusable across every channel; the form-renderer adapts; per-channel chrome is set once in Look & Feel. |
| **Ship Rules / Post-Survey Actions in #241 V0.** | Rules / Post-Survey Actions are a separate iteration with their own sub-issues (#234 send_message, #242 award_reward, #246 wheel/scratch/mystery) each shipping end-to-end. Bundling them into #241 would make the umbrella PR unreviewable and tie a stable editor surface to in-flux action contracts. |
| **`Manage themes →` link in the survey editor's theme picker.** | The survey creator may not have theme-edit RBAC. The picker is a *selector*; theme creation lives in Organization Settings. |
| **Two state-page templates for the detail page** (DRAFT/no-responses vs. responses-exist). | A single shell with collapsible sections gives the same JTBD differentiation (Distribution expanded by default when empty; Configuration collapsed by default; Response placeholder regardless) without the cost of maintaining two layouts. |
| **Type as a meta pill under the survey name in the list.** | Type as a discrete column makes it scannable across rows and prepares for column-header sortability later. |

## Out of Scope (deferred)

| Item | Where it lives |
|---|---|
| **Sub-issue UIs for individual Post-Survey Actions** (`send_message`, `award_reward`, wheel/scratch/mystery, future `award_bonus_points`). | #234, #242, #246 — each ships end-to-end (UI + worker executor + delivery + tests) in a future iteration on Post-Survey Actions. The Rules tab is intentionally absent from this Epic's V0 so the editor surface ships stable. |
| **Response analytics surface on the detail page** (score distribution, sentiment, topic clusters, individual response stream, LoopMonitor). | Future sub-issue (sibling to #235). The detail-page Response section is a placeholder in V0. |
| **Per-survey override of program earn rate** ("double points this month for survey X"). | V1; the Campaign primitive already supports response-window-bounded boosts. New issue when demand surfaces. |
| **Cross-survey bulk operations** ("move all surveys in program X to a new program"). | Future; surveys are configured one at a time in V0. |
| **Audit-log dashboard for consent-mode deviations across surveys.** | Observability ask; separate issue when the audit-plugin events accumulate enough to warrant a UI. |
| **Survey response detail page** (the per-response viewer). | #235 — different surface, separate issue. |
| **Historical response import.** | #262 — orthogonal. |
| **Brand-level survey defaults** (e.g., "all surveys in this program default to NPS"). | Future; lives in #277 if demand justifies it. |
| **Native survey triggering** (automatic send on loyalty / CX events). | Future; type-picker rationale text in §2.1 acknowledges the use case but the trigger machinery itself is not part of #241. |
| **In-form points badge / incentive callout above questions.** | Out per §2.4. Not a future item — explicitly the wrong design call. |
| **Theme creation / editing from inside the survey editor.** | Lives in Organization Settings; the survey editor's theme picker is a selector only, by RBAC design. |

## Competitive Analysis

This Epic is **internal UX coherence**, not a customer-visible differentiator. Per project rule R3 (Feature Parity Trap), the analysis stays brief and avoids fabricating competitor specifics.

### Industry shape (verified via product docs / public help centers)

| Tool | Survey-creation surface | One-survey-many-channels | Consent override per survey |
|---|---|---|---|
| Typeform | Single editor + builder with live preview pane. | Yes — the same form ID renders in embed snippet + share link + email. | Per-survey GDPR question type; no concept of brand default to override. |
| SurveyMonkey | Sectioned editor (Design / Logic / Options / Collect). | Yes — multiple "Collector" types per form. | Per-survey consent text; no brand-level default. |
| Qualtrics XM | Single editor; library-level "informed consent" element overrides per-survey. | Yes — Distributions tab with channel picker; one survey. | Library inheritance — closest in shape to CustomerEQ's brand-default + per-survey override model. |
| Annex Cloud (loyalty competitor) | Embedded surveys configured per-program; no sectioned editor — checklist-style fields. | Embedded primarily; standalone is afterthought. | Account-wide consent only. |

### How this redesign positions CustomerEQ

The CustomerEQ differentiator the redesign **preserves and strengthens**: the survey is the *first step* of an end-to-end loop (response → loyalty event → future Post-Survey Action). The unified editor + JTBD-aware detail page surfaces this loop natively. Most competitors treat the survey as a data-collection endpoint; CustomerEQ treats it as the entry of an automation pipeline. Today's three-entry-point fragmentation hides this; the green-slate redesign makes it visible.

### Research sources

- Typeform help center, "Embed your form" + "GDPR consent question" articles.
- SurveyMonkey help center, "Collector types" + "Privacy and consent settings".
- Qualtrics XM Library docs, public help center.
- Annex Cloud public marketing collateral.
- Singer & Ye (2013), "The Use and Effects of Incentives in Surveys" — meta-analysis on incentive transparency vs response quality. Cited under §2.4 and Alternatives.
- CustomerEQ codebase — every path/file referenced in this spec was read during context-gathering.

## Cross-references

- **Parent**: #225 (broader CX-to-loyalty coherence).
- **Absorbs**: **#232** (earning consolidation; direction shifted to elimination per V0 + future Campaign-based override).
- **Absorbs**: **#283** (consent-override end-to-end) — the PATCH endpoint contract + audit-plugin extension + survey-editor consent panel + attestation modal + audit-trail badge all ship under #241's umbrella PR. #283 closes as merged-into-#241 once #241's implementation PR lands.
- **Sub-issues** (deferred to a future iteration on Post-Survey Actions): #234 `send_message`, #242 `award_reward`, #246 wheel/scratch/mystery.
- **Sibling**: #235 (response-detail page), #262 (import flow).
- **Adjacent**: #277 (Organization Settings — brand defaults the survey editor inherits), #276 (P0 hotfix; data unblock done, UX absorbed here), #292 (brand-level consent admin, recently shipped), #291 (BrandTheme / SurveyTheme split — the theme library this editor picks from), #117 (`responsePolicy` precursor), #231 (response data model — schema columns this spec renders), **#79 (trigger wizard — collapses to the type-card grid + guidance link in Basics)**.

---

## Appendix: Decision Log

Iteration history — every decision made during R0–R4 of the mock-and-spec convergence. Preserved for traceability; the main body above is authoritative.

| # | Round | Decision | Rationale |
|---|---|---|---|
| D1 | R0 | One unified surface — three entry points collapse into `/admin/surveys/[id]/edit`. | Three parallel entry points produced duplicate drafts and "where do I edit?" confusion. |
| D2 | R0 | Section-tabbed editor, not a linear wizard. | Surveys are non-linear; wizard pattern produces the duplicate-draft bug. *Refined by D25 to horizontal tabs.* |
| D3 | R0 | ~~Distribution mode (Standalone/Embedded) as a first-class draft-time field.~~ | **SUPERSEDED by D10.** |
| D4 | R0 | Earning collapses to programs-only; the `Survey.incentivePoints` path is canonical. | Two parallel paths produced an empirically confirmed prod bug. |
| D5 | R0 | Vocabulary: Save Draft / Activate / Stop / Restart / Discard. Schema rename `CLOSED → STOPPED`. | Issue body directive; consolidates inconsistent verbs. |
| D6 | R0 | ~~Rule-action picker shows only end-to-end-shipping types.~~ | **SUPERSEDED by D14.** |
| D7 | R0 | Consent panel inside the editor; override surfaces only the option that differs from brand default. | Per #276 round-1 reviewer note carried into #283. |
| D8 | R0 | Theme picker over BrandTheme library; per-survey thank-you copy + redirect in editor. | Per #291's split. *Refined by D18, D30, D36.* |
| D9 | R1 | Section-tabbed editor confirmed (Q1 answer). | User picked section-tabbed over linear wizard / hybrid overlay. *Refined by D25 to horizontal tabs.* |
| D10 | R1 | Distribution is multi-channel by default; no picker. The form-renderer adapts per channel. | User R1: "Distribution method is not a choice. The same survey can and should be usable across different mechanisms." |
| D11 | R1 | Earning sweep = full delete; no flag, no deprecation. | User confirmed Q3(a). Feature-flag carries permanent two-path debt. |
| D12 | R1 | #283 absorbed into #241. | The consent panel UI + PATCH endpoint + audit extension are all part of the same unified editor surface. |
| D13 | R1 | ~~Rename `award_points` rule action to disambiguate.~~ | **OBVIATED by D14** — rules deferred entirely. |
| D14 | R1 | Rules / Post-Survey Actions deferred entirely from #241 V0. | User R1 POV: keep rule logic as Post-Survey Actions iterated under sub-issues. |
| D15 | R1 | Filename convention: `<issue#>-<feature-name>` (drops `-view` / `-epic` suffixes). | Aligns with `277-organization-settings.*`, `35-survey-builder.html`. |
| D16 | R1 | New nullable `Survey.title` column (respondent-facing); `Survey.name` stays admin-facing. | Admin names accumulate version context that shouldn't reach respondents. |
| D17 | R1 | Editor has 4 sections; Consent is a sub-block inside Basics. | User answer C2(a). |
| D18 | R1 | Theme picker lives in Look & Feel only; no Basics-level default. | User answer C3(a). *Refined by D29 (preview-first), D36 (no manage link).* |
| D19 | R1 | `Survey.showIncentivePoints` toggle removed entirely; points never appear on the form. | User confirmed C4 recommendation. Singer & Ye (2013): in-form-visible incentives depress response quality. |
| D20 | R1 | Look & Feel has per-channel chrome toggles (matrix) for Brand logo / Brand name / Survey title × Standalone / Embedded. | User R1: "each mode would allow any of brand logo, brand name, title to be hidden." |
| D21 | R1 | Type picker is a 4-card grid in Basics + a "Not sure?" guidance link (collapses #79's trigger wizard). | Type guidance is #79's actual deliverable once trigger framing is stripped. |
| D22 | R1 | List corrections: Type pill in row, Type filter chips, Trigger column dropped, View icon dropped, row click → Detail. | User R1 list feedback. *D26, D39 refined the layout further.* |
| D23 | R1 | ~~Detail page is JTBD-aware (State A / State B page templates).~~ | **SUPERSEDED by D32/D37.** |
| D24 | R1 | Activate gates on ≥1 question; modal shows share link + embed snippet. | User R1 directive. *Refined by D31 (modal simplified; share/embed move to detail page).* |
| D25 | R2 | Editor layout reverses to horizontal tabs (with Next/Back); the sticky vertical TOC goes. | User R2: "Questions section feels too cramped." With 4 tabs, horizontal is roomier. |
| D26 | R2 | Survey description surfaces on the list as a muted second-meta line under the name. | User R2 question on where description appears. |
| D27 | R2 | Response policy + Consent collection rendered as dropdowns, not stacked radio cards. | User R2: "drop downs to simply screen space." |
| D28 | R2 | Consent UX matches the #277 admin disclosure pattern (dropdown → preview-card → disclosure textarea). | User R2 directive. *D34 refined the disclosure toolbar specifically.* |
| D29 | R2 | Look & Feel section is preview-first; theme + chrome matrix sit below the preview. | User R2: "Should we show the preview first and then the customization?" |
| D30 | R2 | Theme picker shows 4 brand-provisioned defaults + any additional brand themes. | User R2: "We populate with 4 defaults." *Refined by D36 (no manage link).* |
| D31 | R2 | Activate modal simplifies — no share/embed inside; redirects to Detail page on confirm. | User R2: "Once Activate is clicked, the page can redirect to the Survey Detail page." |
| D32 | R2 | Detail page = 3 vertical sections (Distribution wide + collapsible, Response placeholder, Configuration summary). D23's two-state templates collapse into Section 1's expanded/collapsed default. | User R2 directive on detail-page restructure. |
| D33 | R2 | Mock is fully interactive (JS-wired). | User R2: "Make the mock completely interactive, so reviewers can actually see the flow." |
| D34 | R3 | Disclosure text override uses the same `.consent-toolbar` editor as Organization Settings — `[+] Privacy link`, `[+] Terms link`, `Reset to brand default`. Tokens render to brand URLs at render time. | User R3: explicit call-out that the disclosure UX should match the admin pattern. |
| D35 | R3 | Live Preview is channel-first: Standalone / Embedded as top tabs; Desktop + Mobile side-by-side under each. | User R3: channel is the meaningful semantic axis; viewport is the visual-fit axis. |
| D36 | R3 | Theme picker shows all brand themes; no `Manage themes →` link in the survey editor. | User R3 + RBAC: survey creator may not have theme-edit access. |
| D37 | R3 | All detail-page sections are collapsible; chevron icon converges with #277 (`▼` rotating -90deg when collapsed). | User R3: same icon set as Organization Settings. |
| D38 | R4 | "Not sure which to pick?" type-guidance toggle uses the same chevron pattern as the rest of the platform. | User R4: chevron consistency. |
| D39 | R4 | Type is a discrete column on the surveys list (not a meta pill under the name). Prepares for column-header sortability. | User R4: "Type deserves its own column to call attention." |

🤖 Spec converged after 4 review rounds. Implementation RFC and validation matrix follow this PR.
