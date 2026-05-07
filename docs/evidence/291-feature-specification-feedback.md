# Feedback for Issue #291 — Feature-Specification Workflow

## Round 1 Feedback

*Received: 2026-05-06 (chat — direct reviewer message during PR #295 review)*

### Comment 1 — ADDRESSED

- **Author**: rmadhira86
- **Type**: pr_comment (delivered in chat, not on PR thread; treated equivalently)
- **File**: `docs/feature-specs/291-brandtheme-surveytheme-split.md` and `docs/feature-specs/mocks/291-view.html`
- **Comment**:
  > Let us iterate on the UX and then I will review the spec. Keep it simple - don't change the current layout. Simply drop the columns from the view and edit. No Screen builder changes in this feature. The scope seems to have ballooned instead of just dropping the fields.
- **Status**: ADDRESSED in commit (this round)
- **How addressed**:
  - **Spec body** (`docs/feature-specs/291-brandtheme-surveytheme-split.md`):
    - Removed the prior "Surface 2 — Survey builder" subsection and the corresponding `R11` requirement (admin survey-builder Thank-you section). The surface and the requirement are gone — survey-builder UI is no longer in #291's scope.
    - Renumbered remaining surfaces: Surface 1 (Theme editor) → Surface 1; Surface 2 (Theme list) → Surface 2; Surface 3 (renderer) → Surface 3; Surface 4 (Org Settings consumer) → Surface 4. Renumbered remaining requirements: R9 (theme editor), R10 (theme list), R11 (renderer), R12 (tests/seeds), R13 (migration verification). DR1/DR2/DR3 unchanged.
    - **Surface 1 was rewritten** to emphasize "the editor's existing layout is unchanged." The narrative is now an explicit per-row drop list mapped to `ThemeForm.tsx` line numbers (411-420 logo URL, 421-430 brand name, 491-523 thank-you section, 525-535 isDefault checkbox, 386-390 Default badge data source, 170-181 + 255-264 preview pane drops). No new sections, no tab restructure, no field reordering.
    - `R8` (survey API accepts the 3 new fields on the body) was retained but explicitly tagged "**No admin-UI surface in this issue.**" The schema/API side of the survey-level fields stays — the user's instruction was about UI scope, and AC#3 of the original issue requires the columns to exist on `Survey`. The admin form lighting up these columns is now an Out-of-Scope item.
    - **Out of Scope** section gained a first bullet: "Admin UI for the new survey-level fields. R8 ensures the survey API accepts the fields so admins can set them via the API today; the admin form section that exposes these in the survey-edit page is **deferred to a follow-on issue** (likely under #241 — Survey Admin UX epic)."
    - **Alternatives** table gained a new row: "Ship the admin survey-builder UI for the 3 fields in #291 alongside the schema move." → "This is the version of the spec the reviewer pushed back against in round 1 — scope balloon. The schema + API + renderer rebind in #291 is enough; the admin UX has its own owner under #241."
    - **References** section gained a pointer to this feedback file.
  - **Mock** (`docs/feature-specs/mocks/291-view.html`):
    - Removed `#scene-survey-builder` (the survey-builder scene with the new Thank-you section).
    - Removed `#scene-theme-list` (the theme-list-with-row-action scene). Its content collapsed into a footnote: the existing "Set as Default" button stays and its handler's write target changes — no list-level layout change to mock.
    - **Replaced the prior `#scene-theme-editor`** (which had implied a tab-based layout with struck-through tabs Brand and Thank-you) with `#scene-theme-editor-after` — a side-by-side BEFORE / AFTER pair that mirrors the actual `ThemeForm.tsx` flat-sections layout. Each removed row in the BEFORE panel is highlighted red; the AFTER panel shows the same chrome with those rows literally absent. Sections that retain at least one input keep their header; the Thank-you section disappears because all its inputs are gone.
    - Two footnotes at the bottom of the mock document: one for unchanged-but-implementation-changed behavior (Set-as-Default button, Default badge data source); one explicitly carrying the "Out of scope for #291" note that the survey-builder admin UI defers to a follow-on issue.

## Round 2 Feedback

*Received: 2026-05-07 (10 inline review comments on PR #295 commit `495c56f`, plus a clarifying chat message after I misread the inline comments)*

The 10 inline comments came in two semantically-coherent batches:
1. **Mechanical fixes** (mock filename, false examples, `_count.surveys` clarification, DR2 confirmation) — addressed straightforwardly.
2. **Empirical scope question** ("are these fields actually used by any survey?") — I misread this as "scope-tighten by deferring the schema move" and produced a round-2 spec that dropped the Survey-side schema entirely. The reviewer corrected: *"If data is showing that dropped fields from the themes are used in the surveys, then we need to migrate those over to a survey level entity and backfill. That was my main comment. You seem to be updating spec to defer the issue, that is not my intent."*

Round 3 (the corrective revision) re-pivots back to the round-1 schema move + adds explicit backfill, with the round-1 mechanical fixes from this round still applied (mock rename, false examples removed, no admin survey-builder UI). The miss is captured durably as a coaching moment at `fraim/personalized-employee/learnings/raw/manohar.madhira@outlook.com-2026-05-07T08-00-00-misread-data-preservation-not-critical-as-defer-instead-of-backfill.md`.

### Comment 2.1 — ADDRESSED (mock filename)

- **Author**: rmadhira86
- **Type**: review_comment, [r3199265473](https://github.com/mathursrus/CustomerEQ/pull/295#discussion_r3199265473)
- **File**: `docs/feature-specs/mocks/291-view.html`
- **Comment**:
  > Why is this file name 291-view and not the standard naming pattern of <issue>-feature like the functional spec?
- **Status**: ADDRESSED
- **How addressed**: Renamed `docs/feature-specs/mocks/291-view.html` → `docs/feature-specs/mocks/291-brandtheme-surveytheme-split.html` to match the spec slug convention (per #277's `277-organization-settings.html` pattern). Spec body and references updated.

### Comment 2.2 — ADDRESSED (line 41 false examples)

- **Author**: rmadhira86
- **Type**: review_comment, [r3199333067](https://github.com/mathursrus/CustomerEQ/pull/295#discussion_r3199333067), `docs/feature-specs/291-brandtheme-surveytheme-split.md` line 41
- **Comment**:
  > The examples given are not true. Check if the earlier spec calls out the intent, else don't give these examples. More likely the intent was to redirect to a page outside of Customer EQ
- **Status**: ADDRESSED
- **How addressed**: Removed the invented `/rewards`, `/account` examples from the `thankYouRedirectUrl` row of the customer-problem table. Replaced with the correct intent (per #36's framing): "redirect respondents back to the brand's external site after completion." Also removed the invented "NPS vs CSAT post-purchase" example from the `thankYouMessage` row — the field is per-survey by design, no specific examples needed. L1 mistake-pattern firing: *"Asserted facts about file/config/external-state contents without reading the primary source first"* applied to product-context examples.

### Comment 2.3 — ADDRESSED (line 104, R3 — Survey gains 3 columns)

- **Author**: rmadhira86
- **Type**: review_comment, [r3199354430](https://github.com/mathursrus/CustomerEQ/pull/295#discussion_r3199354430), line 104
- **Comment**:
  > Is this required now to avoid breaking something?
- **Status**: ADDRESSED
- **How addressed**: Yes — three demos populate these fields today (Acme/StarBrew/Diamond — see "Empirical state — which fields are populated and read today" section). Without the Survey columns, the migration's backfill has nowhere to write the demos' customised values. R3 stays. Spec now documents the empirical demo state explicitly so the answer is visible without re-running the check.

### Comment 2.4 — ADDRESSED (line 105, R4 — verify-and-preserve)

- **Author**: rmadhira86
- **Type**: review_comment, [r3199367833](https://github.com/mathursrus/CustomerEQ/pull/295#discussion_r3199367833), line 105
- **Comment**:
  > Check if Survey Theme is really used anywhere on Survey. Survey Themes itself will have values. The question is whether any Survey uses the themes at all. Since all surveys are test surveys, data preservation is not critical.
- **Status**: ADDRESSED
- **How addressed**: Empirical check ran. Three demos (Acme/StarBrew/Diamond) populate `survey_themes` rows that surveys reference via `themeId`. Reviewer's clarification: "data preservation is not critical for production [no production surveys exist], but the demos still need their data carried forward." R5 (renumbered from round 1's R4) now explicitly backfills from `survey_themes` rows onto `surveys` and `brands` before the column drop. The simpler "unconditional drop" form was tried in round 2 and pulled back.

### Comment 2.5 — ADDRESSED (line 110, _count.surveys)

- **Author**: rmadhira86
- **Type**: review_comment, [r3199375297](https://github.com/mathursrus/CustomerEQ/pull/295#discussion_r3199375297), line 110
- **Comment**:
  > What is the intent of _count.surveys needed here?
- **Status**: ADDRESSED
- **How addressed**: R6 (renumbered) now explicitly states the intent inline: "The existing `_count.surveys` already in the response is preserved (the admin theme list at `apps/web/src/app/(admin)/admin/settings/themes/page.tsx` reads it for the per-row 'Surveys' count column — `themes.ts:11, 53` already include this; no change)." Status quo, not new.

### Comment 2.6 — ADDRESSED (line 112, R8 — Survey routes)

- **Author**: rmadhira86
- **Type**: review_comment, [r3199445344](https://github.com/mathursrus/CustomerEQ/pull/295#discussion_r3199445344), line 112
- **Comment**:
  > If there are no surveys today that use the theme, then is this required now?
- **Status**: ADDRESSED
- **How addressed**: Demos do use themes (per the empirical finding). R8 is required so the admin can write the new fields via API once the migration backfills them, and so the API contract is complete for future admin UX. R8 stays, with explicit "No admin-UI surface in this issue" tag — the schema/API ship; the survey-builder admin form is the follow-on issue's concern.

### Comment 2.7 — ADDRESSED (line 121, R11 — renderer)

- **Author**: rmadhira86
- **Type**: review_comment, [r3199451805](https://github.com/mathursrus/CustomerEQ/pull/295#discussion_r3199451805), line 121
- **Comment**:
  > Is this currently read, or is it coming from a hardcoded text. If it is not read today, then we should not be touching surveys in this Issue
- **Status**: ADDRESSED
- **How addressed**: All 5 fields ARE currently read by the renderer — `theme.thankYouRedirectUrl` (lines 347, 446), `theme.showIncentivePoints` (line 364), `theme.thankYouMessage` (line 413), `theme.logoUrl` (lines 475-477), `theme.brandName` (lines 476, 479). Spec's "Empirical state" section enumerates these. The renderer rebinds to `survey.*` (for the three thank-you fields) and `survey.brand.*` (for logo and brand name) — DOM byte-identical post-migration for any survey whose new columns hold the values that were previously on its theme row.

### Comment 2.8 — ADDRESSED (line 177, DR1 — demo doc)

- **Author**: rmadhira86
- **Type**: review_comment, [r3199465706](https://github.com/mathursrus/CustomerEQ/pull/295#discussion_r3199465706), line 177
- **Comment**:
  > This would be important if it breaks any of the demo scripts for ACME Coffee or StarBrew. Check if Theme is really used in any survey, if so document the Organization and Survey so we can make a call. Other than demo, all surveys today are test only.
- **Status**: ADDRESSED
- **How addressed**: New "Demos affected" section in the spec documents Acme + StarBrew + Diamond explicitly: which fields each populates, which the migration backfills, and what the post-migration demo experience is. Backfill ensures the demos render identically — no reseed required. Round-3 DR1 resolution is "backfill before drop" (not the round-2 "unconditional drop" misread).

### Comment 2.9 — ADDRESSED (line 178, DR2 — rename)

- **Author**: rmadhira86
- **Type**: review_comment, [r3199473171](https://github.com/mathursrus/CustomerEQ/pull/295#discussion_r3199473171), line 178
- **Comment**:
  > Agree with rename
- **Status**: ADDRESSED
- **How addressed**: DR2 marked resolved — option (a) rename in place. R2 encodes `SurveyTheme` → `BrandTheme` (and table `survey_themes` → `brand_themes`) in the same migration.

### Comment 2.10 — ADDRESSED (line 179, DR3 — Survey columns vs Override)

- **Author**: rmadhira86
- **Type**: review_comment, [r3199476951](https://github.com/mathursrus/CustomerEQ/pull/295#discussion_r3199476951), line 179
- **Comment**:
  > If these are needed. Again, we should avoid crossing over to Survey changes if we can avoid
- **Status**: ADDRESSED — DR3 still open for reviewer choice
- **How addressed**: The empirical finding ("demos populate these") makes the Survey-side schema move unavoidable. DR3 is therefore still alive — three options now surfaced: (a) typed columns on `Survey` (recommended — easiest backfill, easiest future Zod validation, mirrors `Survey.incentivePoints` precedent), (b) `SurveyOverride` 1:1 row (adds a join with no concrete benefit), (c) keys in the existing `Survey.settings` Json (lighter schema-wise, harder to query/validate/surface in UI). Reviewer to confirm.

## Round 3 Feedback (chat correction during PR #295 review)

*Received: 2026-05-07 chat after round-2 push of `495c56f`*

### Comment 3.1 — ADDRESSED

- **Author**: rmadhira86
- **Type**: pr_comment (delivered in chat after I pushed an incorrect round-2 spec)
- **Comment**:
  > If data is showing that dropped fields from the themes are used in the surveys, then we need to migrate those over to a survey level entity and backfill. That was my main comment. You seem to be updating spec to defer the issue, that is not my intent.
- **Status**: ADDRESSED
- **How addressed**: Round 3 (this commit) re-pivots the spec back to the round-1 shape — Survey-side schema columns + verify-and-backfill migration + renderer rebind. The round-2 misread (interpreting "data preservation is not critical" as "defer the schema move") is corrected. The mechanical fixes from round 2 (mock filename, false examples removed, `_count.surveys` clarified, no admin survey-builder UI) are kept; the schema/API/renderer changes from round 1 are restored, with the migration explicitly performing backfill so demos render identically. Coaching moment captured at `fraim/personalized-employee/learnings/raw/manohar.madhira@outlook.com-2026-05-07T08-00-00-misread-data-preservation-not-critical-as-defer-instead-of-backfill.md`.

## Continuous Learning

| Learning | Agent Rule Updates |
|---|---|
| When a spec lists "blast radius" surfaces from the issue body, that is *information*, not a mandate to ship UI for every surface in the same issue. The surface-by-surface UX framing should still distinguish "schema/API change is unavoidable consequence of the move" from "admin UX surface that lights up the new schema." Conflating these two is what made this round's spec feel ballooned. | Candidate addition to a future feedback memory — "for refactor specs, separate consequence-of-change UI work (renderer rebind, set-default action target swap) from new-affordance UI work (admin form section that exposes new fields). Defer the latter to a follow-on issue by default unless the original issue's AC explicitly requires it." Will be promoted to a feedback memory if a similar miss recurs. |
| The mock's first draft was tab-based because I leaned on #36's spec language ("tabs") instead of reading the actual `ThemeForm.tsx`. The implementation went with flat sections. Sister-pattern to L1 mistake-pattern *"Asserted facts about file/config without reading the primary source first"* — applied at the UI layer this time, not the config layer. | Existing L1 entry already covers this; the rule "for any RFC table that claims modify X, run a verifying read of X in the same drafting pass" extends to mocks — for any mock that depicts an existing surface, read the actual implementation file before drawing the chrome. Captured here as the Round 1 reviewer fix; if the same shape recurs at the mock layer specifically, promote to its own L1 sub-bullet. |
