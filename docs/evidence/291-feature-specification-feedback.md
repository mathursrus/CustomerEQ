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

## Continuous Learning

| Learning | Agent Rule Updates |
|---|---|
| When a spec lists "blast radius" surfaces from the issue body, that is *information*, not a mandate to ship UI for every surface in the same issue. The surface-by-surface UX framing should still distinguish "schema/API change is unavoidable consequence of the move" from "admin UX surface that lights up the new schema." Conflating these two is what made this round's spec feel ballooned. | Candidate addition to a future feedback memory — "for refactor specs, separate consequence-of-change UI work (renderer rebind, set-default action target swap) from new-affordance UI work (admin form section that exposes new fields). Defer the latter to a follow-on issue by default unless the original issue's AC explicitly requires it." Will be promoted to a feedback memory if a similar miss recurs. |
| The mock's first draft was tab-based because I leaned on #36's spec language ("tabs") instead of reading the actual `ThemeForm.tsx`. The implementation went with flat sections. Sister-pattern to L1 mistake-pattern *"Asserted facts about file/config without reading the primary source first"* — applied at the UI layer this time, not the config layer. | Existing L1 entry already covers this; the rule "for any RFC table that claims modify X, run a verifying read of X in the same drafting pass" extends to mocks — for any mock that depicts an existing surface, read the actual implementation file before drawing the chrome. Captured here as the Round 1 reviewer fix; if the same shape recurs at the mock layer specifically, promote to its own L1 sub-bullet. |
