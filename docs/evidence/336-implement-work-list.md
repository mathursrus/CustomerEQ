# Implementation Work List — Issue #336

**Issue**: #336 — impl (#241) Slice 4b: full editor (4 tabs) + `/new` Server Component + legacy survey-builder cleanup
**Umbrella**: #324 (Survey Admin UX V0 — five-slice implementation)
**Epic**: #241 (Survey Admin UX)
**Branch**: `feature/336-impl-241-slice-4b-full-editor-4-tabs-new-server-component-legacy-survey-builder-cleanup`
**Worktree**: `C:/Github/mathursrus/CustomerEQ - Issue 336`
**Base branch**: `main`
**Phase 1 author**: Claude (Opus 4.7), session 2026-05-13
**Status**: Phase 1 (implement-scoping) — work-list deliverable.

> **Phase 1 only this session.** Per user direction (2026-05-13), Phase 1 (implement-scoping) is the only phase running in this conversational session. Phases 3+ resume in a future session with this work-list as the entry point. Phase 2 (implement-repro) is marked N/A for features (Slice 4b is a feature, not a bug). Phase splitting was raised as a Phase Splitting Candidate per the implementation-planning-and-scope-slicing skill (~30-40 files); the user approved **full-execution as one atomic slice** because issue #336 mandates "no half-migrated state" — sub-PR splitting violates the atomic-switch invariant.

---

## A. Scope (from #336 issue body)

### In scope (this slice MUST ship together)

| Group | Surfaces |
|---|---|
| **A. Editor shell** | `/admin/surveys/[id]/edit/page.tsx` (replaces redirect stub) · `SurveyEditorForm.tsx` (RHF top-level) · `TabHeader.tsx` (4-tab nav + auto-save indicator + Activate) · `useAutoSave` hook (debounced PATCH on blur, no-op outside DRAFT) |
| **B. Four tabs** | `BasicsTab.tsx` · `QuestionsTab.tsx` (11 question types per #35; Up/Down reorder buttons; per-question right-rail config) · `LookFeelTab.tsx` (channel tabs × viewport split; theme picker; chrome matrix) · `PointsAndThankYouTab.tsx` (read-only program-rate display per R20; thank-you variable picker per R21) |
| **C. Consent sub-block** | `ConsentCollectionSubBlock.tsx` (dropdown + preview card + disclosure-text override; reuses `.consent-toolbar` from Organization Settings per §2.1.1) |
| **D. Modals** | `ConsentAttestationModal.tsx` (fires on more-permissive override per R10) · `ActivateModal.tsx` (pre-activate summary + confirm per §6 / R23) · `DiscardDraftModal.tsx` (calls `DELETE /v1/surveys/:id` per #333) |
| **E. `/new` Server Component** | `/admin/surveys/new/page.tsx` — thin Server Component: `auth()` → bearer → `GET /v1/programs` → `POST /v1/surveys` → `redirect('/[id]/edit?tab=basics')`. Lifts from Slice 3 commit `2ffa607`. No operator-visible content on `/new`. |
| **F. Legacy deletion** | Delete entire `apps/web/src/app/(admin)/admin/survey-builder/` directory · delete `apps/web/src/components/surveys/{TriggerStep,RuleBuilderStep,ReviewLaunchStep}.tsx` · delete `apps/web/src/utils/triggerRecommendation.ts` (no longer imported). Replace `/admin/surveys/new/page.tsx` wizard with the Server Component shell (E). Replace `[id]/edit/page.tsx` redirect stub with the editor shell (A). |
| **G. Architecture-doc update** | **MA1** — State-aware save mode entry in `docs/architecture/architecture.md` §6 (Phase 10 commitment; last of the umbrella #324's MA commitments). |
| **H. Tests — RTL** | Per-component RTL: `SurveyEditorForm` dirty-state tracking, `useAutoSave` debouncing + state short-circuit, each tab's required-field validation, each modal's open/close/submit. Page-level RTL for editor route. |
| **I. Tests — Playwright e2e** | Editor flow (create → fill Basics → tab through 4 → trigger auto-save → ConsentAttestationModal → activate → list reflects ACTIVE) · Discard draft flow · Activate-from-editor gates (no-questions, missing-title). **Bundled with list-page e2e from Slice 3** (deferred per phase-7 evidence): chip filters, ⋯ menu, row navigation. Single Clerk-auth + seed fixtures cover both. |

### Out of scope (verified against spec & RFC; deferred to future slices/issues)

| Item | Reason | Tracked under |
|---|---|---|
| Standalone respondent page `/survey/[id]` migration to `SurveyFormRenderer` | Slice 5 owns this alongside embed-widget visual-regression gate | Slice 5 |
| Embed widget (`packages/embed/src/ceq-survey.ts`) | Slice 5 | Slice 5 |
| Response analytics on detail page | Sibling sub-issue to #235 | future |
| Sub-issue UIs for post-survey action types (#234 / #242 / #246) | Rules tab intentionally absent from #241 V0 | sub-issues |
| Per-survey override of program base earn rate | Future `Survey.pointsOverride` column (V1 hook) | future |
| Theme creation/editing inside editor | Lives in Organization Settings (#277) — RBAC | #277 |
| Audit-log dashboard for consent-mode deviations | Out of #241 V0 | future |
| Native survey triggering | Trigger machinery not in #241 | future |
| i18n string extraction | NFR-I1 deferred to platform-wide i18n | future |
| Loop Monitor section / detail page rewrite | **Already shipped in Slice 4a** (#343 / PR #353, merged) — Slice 4b leaves the detail page intact | n/a |
| Survey-form renderer family | **Already shipped in Slice 4a** under `apps/web/src/components/survey-form/` — Slice 4b consumes it unchanged | n/a |
| Schema deltas (`Survey.title` add, `incentivePoints` drop, `CLOSED→STOPPED` rename) | **Already shipped in Slice 1** (#325 / PR #326, merged) | Slice 1 |
| API endpoints (POST/PATCH/PATCH-status/PATCH-consent-mode/DELETE/duplicate) | **Already shipped in Slices 2 + 2-follow-up** (#328 / PR #329 + #332 / PR #333) | Slices 2 / 2-follow-up |

---

## B. Dependencies — verified on `main`

| Dependency | Status | Verified by |
|---|---|---|
| Schema deltas (Slice 1) | ✅ Merged on `main` | `git log --oneline -- packages/database/prisma/schema.prisma` shows `incentivePoints` removed, `title` added, `STOPPED` value present |
| API surface (Slice 2 + follow-up) | ✅ Merged on `main` | `POST /v1/surveys`, `PATCH /v1/surveys/:id`, `PATCH /v1/surveys/:id/status`, `PATCH /v1/surveys/:id/consent-mode`, `DELETE /v1/surveys/:id`, `POST /v1/surveys/:id/duplicate` |
| List page (Slice 3) | ✅ Merged | `apps/web/src/app/(admin)/admin/surveys/page.tsx` + `components/` (FilterChips, SurveyRowMenu, list-page.logic) |
| Renderer family (Slice 4a) | ✅ Merged | `apps/web/src/components/survey-form/` family in place (PreviewSurvey, SurveyFormRenderer, ConsentDisclosure, QuestionRenderer, MemberIdField, types.ts, scale-resolvers, skip-rules.logic, theme-to-css-vars + fixtures + tests) |
| Detail page (Slice 4a) | ✅ Merged | `apps/web/src/app/(admin)/admin/surveys/[id]/` with SurveyDetailShell, CollapsibleSection, DistributionSection, ResponseSection, LoopMonitorSection, ConfigurationSummarySection, SurveyConfigDl, SurveyDetailMoreMenu |
| RTL/jsdom test harness for `apps/web` | ✅ Merged with Slice 4a | `apps/web/vitest.setup.ts` + `vitest.config.ts` (environment: jsdom) |
| RHF reference impl + per-section dirty state | ✅ Available | `OrganizationSettingsForm.tsx` (`SECTION_FIELDS` pattern at lines 174-177 per RFC §"RHF form structure"). **Slice 4b's `TAB_FIELDS` mirrors this shape.** |
| `.consent-toolbar` editor UX | ✅ Available | Organization Settings consent surface — reused by `ConsentCollectionSubBlock` |
| Audit-allowlist pattern + `requestIp` capture | ✅ Available | Slice 2 |
| `OrganizationSwitcher` redirect target | ✅ Available | #277/#292 Slice 4 |

**Slice 4b adds no schema migration, no new API endpoint, no new package dependency.** All work is in `apps/web` (UI + tests) + `docs/architecture/architecture.md` (MA1 doc).

---

## C. File inventory

### C.1 New files (`apps/web/src/app/(admin)/admin/surveys/[id]/edit/components/`)

| # | Path | Purpose | Spec / RFC anchor |
|---|---|---|---|
| 1 | `[id]/edit/components/SurveyEditorForm.tsx` | RHF top-level form; per-tab dirty state via `dirtyFields`; state-aware save trigger (autosave in DRAFT; explicit per-tab Save in ACTIVE/PAUSED; read-only in STOPPED) | RFC §"RHF form structure" + §"Save behavior by state" |
| 2 | `[id]/edit/components/TabHeader.tsx` | 4 horizontal tabs (`Basics → Questions → Look & Feel → Points & Thank You`) + auto-save indicator (DRAFT) / "Unsaved in <tab>" (ACTIVE/PAUSED) / "Stopped — Restart to edit" (STOPPED) + Activate button (top-right, persistent across tabs per R5) | Spec §2 / R3 / R5 |
| 3 | `[id]/edit/components/BasicsTab.tsx` | Internal name (`Survey.name` — required), Survey title (`Survey.title` — required, respondent-facing), Type card-grid (NPS/CSAT/CES/Custom with R6 type-change modal), Program selector (one program → default; multiple → require explicit select per `project_241_slice4_program_selection.md`), Description, Response policy dropdown, embedded `<ConsentCollectionSubBlock>` | Spec §2.1 / R6 / R7 / R8 / R30 |
| 4 | `[id]/edit/components/ConsentCollectionSubBlock.tsx` | Single dropdown for consent mode (Inherit / Override-permissive / Override-stricter per R9), live `<ConsentDisclosure>` preview, `.consent-toolbar` editor (Privacy / Terms tokens per R12), blank-disclosure handling per R13, mode indicator badge per R14 | Spec §2.1.1 / R9–R14 |
| 5 | `[id]/edit/components/QuestionsTab.tsx` | Per-question card with **Up/Down reorder buttons** (no drag-drop dep per RFC §"Question canvas"), 11 question types per #35 (rating, text, multiple_choice, checkbox, dropdown, matrix, ranking, slider, likert, image_choice, file_upload), per-question right-rail config (text, type, required, skip logic, branching), preset banner when Type is NPS/CSAT/CES | Spec §2.2 / R6 |
| 6 | `[id]/edit/components/LookFeelTab.tsx` | Channel tabs (`🔗 Standalone (link)` / `🧩 Embedded (widget)` per R17) × viewport split (Desktop / Mobile side-by-side per R17), theme picker (all brand themes per R19; no "Manage themes" link), per-channel chrome matrix (3 rows × 2 cols per R18). Consumes `<PreviewSurvey>` from Slice 4a's renderer family — no new renderer code | Spec §2.3 / R17 / R18 / R19 |
| 7 | `[id]/edit/components/PointsAndThankYouTab.tsx` | **Read-only program-rate display** sourced from `EarningRule(programId, cxEventForType)` per R20 ("No points configured for <type>" fallback if no rule), thank-you message textarea with **variable picker** offering exactly `{{points}}` / `{{pointCurrencyName}}` / `{{rewardLink}}` per R21, thank-you redirect URL (standalone-only) | Spec §2.4 / R20 / R21 |
| 8 | `[id]/edit/components/ConsentAttestationModal.tsx` | Fires on Save when consent dropdown set to more-permissive than `Brand.consentMode` per R10 — identity (auto), reason text (required, ≤500 chars, soft-warns on PII shapes), attestation checkbox. POSTs to `PATCH /v1/surveys/:id/consent-mode` (Slice 2 endpoint). HTTP 422 surfaces inline as per R10 spec wording | Spec §2.1.1 / R10 |
| 9 | `[id]/edit/components/ActivateModal.tsx` | Pre-activate summary (questions count, current consent mode, theme, response policy per §6), "Cancel" returns to editor, "Activate & go to detail" calls `PATCH /v1/surveys/:id/status` → ACTIVE, redirects to `/admin/surveys/[id]`. Gates per R23: ≥1 question + required fields complete + consent override (if any) attested. HTTP 422 inline on gate failure | Spec §6 / R23 |
| 10 | `[id]/edit/components/DiscardDraftModal.tsx` | Confirmation dialog for "Discard draft" CTA in editor. Wires to `DELETE /v1/surveys/:id` (#333 endpoint) and redirects to `/admin/surveys` | Spec §5 vocabulary table |
| 11 | `[id]/edit/hooks/useAutoSave.ts` (or `[id]/edit/components/useAutoSave.ts`) | Debounced (500ms) per-field PATCH on blur; **short-circuits to no-op when `survey.status !== 'DRAFT'`**; one-field-per-PATCH; emits "Saved · Xs ago" via passed-in setter; idempotent re-trigger on stable form ref | RFC §"RHF form structure" / §"Save behavior by state" |

### C.2 New files — Playwright e2e (`apps/web/test/e2e/`)

| # | Path | Purpose |
|---|---|---|
| 12 | `apps/web/test/e2e/336-survey-editor.spec.ts` | Editor end-to-end: create from `/new` → fill Basics → tab through 4 → trigger auto-save assertion → open ConsentAttestationModal (more-permissive override) → activate → assert list page reflects ACTIVE. **Uses established `PLAYWRIGHT_TEST=true` Clerk-bypass + `page.route()` API-mock pattern** (per Slice 4a's `335-survey-detail-page.spec.ts` recovery — see Slice 4a postmortem `What Went Right #1` and the prevention measure at `feedback_fraim_phases_not_optional.md`). Includes Discard-draft flow + Activate-gate failures (no-questions, missing-title). |
| 13 | `apps/web/test/e2e/336-surveys-list.spec.ts` *(bundled deferred list-page e2e from Slice 3)* | Chip filters (Status × Type) · row click → detail page · ⋯ menu (state-aware visibility per Slice 3's `survey-row-menu.logic`) · `+ New survey` → redirect to `/[id]/edit?tab=basics`. **Same Clerk-auth + seed fixtures pass as 336-survey-editor.spec.ts** — single bundle keeps CI runtime down. |

### C.3 Replaced files (existing files completely rewritten)

| # | Path | Today | New |
|---|---|---|---|
| 14 | `apps/web/src/app/(admin)/admin/surveys/[id]/edit/page.tsx` | 20-line client redirect stub to `/admin/survey-builder?surveyId=...` (verified at file:5-14) | Renders `<SurveyEditorForm>` shell after `auth()` + survey/brand/theme fetch. Reads `?tab=` query param for initial tab (default `basics`). |
| 15 | `apps/web/src/app/(admin)/admin/surveys/new/page.tsx` | 462-line client wizard with TriggerStep / RuleBuilderStep / ReviewLaunchStep (verified at file:1-462) | Thin Server Component: `auth()` → bearer → `GET /v1/programs` (resolves default `programId` or `redirect('/admin/surveys?error=no-program')` if 0 programs) → `POST /v1/surveys` with `{ name: 'Untitled survey', programId, type: 'NPS', questions: DEFAULT_QUESTIONS_NPS }` → `redirect('/admin/surveys/[id]/edit?tab=basics')`. No operator-visible content. |

### C.4 New per-component test files (RTL)

| # | Path | Coverage |
|---|---|---|
| 16 | `[id]/edit/components/SurveyEditorForm.test.tsx` | Dirty-state tracking (`isTabDirty('basics')` flips on field change); state-aware save mode (DRAFT → autosave; ACTIVE → explicit Save button rendered per tab; STOPPED → all inputs disabled, no Save button). |
| 17 | `[id]/edit/hooks/useAutoSave.test.ts` (logic-only — vitest, not RTL) | Debounce window (500ms); per-field PATCH (single field per call); state short-circuit (no PATCH issued when status≠DRAFT); rapid edits collapse to one PATCH; cleanup on unmount. |
| 18 | `[id]/edit/components/TabHeader.test.tsx` | Renders 4 tabs in order; clicking advances active tab; auto-save indicator copy varies by state; Activate button always visible; disabled state in STOPPED. |
| 19 | `[id]/edit/components/BasicsTab.test.tsx` | Internal name + Survey title required field validation; Type card-grid renders 4 cards; **R6 type-change confirmation modal** fires when questions exist + Type changes (not for Custom); Program selector with 1 program defaults; with multi-programs requires explicit selection. |
| 20 | `[id]/edit/components/ConsentCollectionSubBlock.test.tsx` | Dropdown reflects R9 visibility rules (override option appears only when it differs from brand default); Privacy/Terms toolbar buttons insert tokens at cursor (R12); Terms button hidden when `Brand.termsUrl === null` (R12); blank disclosure → preview card empty (R13/R14); checkbox toggle in preview reflects Explicit/Implied modes (R14). |
| 21 | `[id]/edit/components/QuestionsTab.test.tsx` | Renders all 11 question types in palette; per-question right-rail config; **Up/Down reorder updates questions array correctly** (no drag-drop); preset banner copy when Type=NPS/CSAT/CES; switching to Custom blanks the canvas. |
| 22 | `[id]/edit/components/LookFeelTab.test.tsx` | Channel-tabs switch (Standalone ↔ Embedded); Desktop + Mobile side-by-side per channel (R17); theme picker renders all brand themes (no count cap per R19); no "Manage themes" link; chrome matrix toggles propagate to `<PreviewSurvey>`. |
| 23 | `[id]/edit/components/PointsAndThankYouTab.test.tsx` | Read-only display reflects EarningRule for cxEventForType(type) per R20; "No points configured for <type>" fallback; variable picker offers exactly 3 chips (points/pointCurrencyName/rewardLink) per R21; thank-you redirect URL hidden for Embedded channel context (only relevant standalone). |
| 24 | `[id]/edit/components/ConsentAttestationModal.test.tsx` | Submit disabled until reason + attestation checked; PATCH `/v1/surveys/:id/consent-mode` body shape; 422 surfaces inline error; cancel restores prior dropdown state. |
| 25 | `[id]/edit/components/ActivateModal.test.tsx` | Pre-activate summary shows live values (type/policy/consent/theme); Activate gate failures (R23) surface as inline error per gate; success → PATCH status + redirect. |
| 26 | `[id]/edit/components/DiscardDraftModal.test.tsx` | Confirm calls `DELETE /v1/surveys/:id`; cancel closes without API call; success → redirect to `/admin/surveys`. |
| 27 | `[id]/edit/page.test.tsx` | Page-level RTL: `auth()` mock + survey/brand/theme fetch + initial tab from `?tab=` query param + STOPPED state renders read-only mode + DRAFT renders auto-save indicator. **Mocks must return stable references** (per Slice 4a postmortem "Lesson 2"): declare hook return objects at module top, not inline. |

### C.5 Deleted files (legacy removal — atomic with above)

| # | Path | Reason |
|---|---|---|
| 28 | `apps/web/src/app/(admin)/admin/survey-builder/page.tsx` | Replaced by Questions tab inside the new editor. Per R1, the route is **deleted, not redirected** — 404 with a "Surveys" home link. |
| 29 | `apps/web/src/components/surveys/TriggerStep.tsx` | Wizard step no longer used; legacy `/new` wizard removed. |
| 30 | `apps/web/src/components/surveys/RuleBuilderStep.tsx` | Wizard step no longer used. Note: Rules-tab UI is **deferred** entirely (per #241 §2 / D14); RuleBuilderStep is not migrated to the editor. |
| 31 | `apps/web/src/components/surveys/ReviewLaunchStep.tsx` | Wizard step no longer used. |
| 32 | `apps/web/src/utils/triggerRecommendation.ts` | No longer imported once wizard is gone. |

**Side-quest discipline (R21)**: any unrelated files that surface during implementation (dev-env patches, infra tweaks, cleanups) get a separate issue and branch — **do not bundle into this PR**. The validated pattern "PR scope discipline holds under multiple side-quests" (4 recurrences) is the load-bearing rule here.

### C.6 Modified files (no rewrites — surgical edits only)

| # | Path | Change |
|---|---|---|
| 33 | `apps/web/src/app/(admin)/admin/surveys/page.tsx` | If `+ New survey` button (Slice 3) targets the old wizard route — switch to navigate to `/admin/surveys/new` (which is now the Server Component shell, not the wizard). Spec §1: "+ New survey CTA creates a draft and routes to the editor." |
| 34 | `docs/architecture/architecture.md` (Phase 10) | Add **MA1** entry under §6 — State-aware save mode for admin editor forms (auto-save in DRAFT vs explicit Save in ACTIVE/PAUSED vs read-only in STOPPED). Adds a paragraph under §3.1 "Standard CRUD admin pattern" describing the entity-state-aware save trigger pattern. Last of #324's three MA commitments. |

### C.7 NOT modified — verify with `git diff --name-only origin/main` at Phase 11

- `apps/web/src/components/survey-form/**` — Slice 4a's renderer family is consumed unchanged. Any change here is **off-scope** and gets a separate issue per R21.
- `apps/web/src/app/(admin)/admin/surveys/[id]/page.tsx` and `[id]/components/**` — Slice 4a's detail page stays exactly as merged in PR #353.
- `packages/database/prisma/**` — no schema delta in Slice 4b.
- `apps/api/**` — no API change.
- `apps/worker/**` — no worker change.
- `packages/shared/**` — no shared-package change expected. Schema types already include `Survey.title` from Slice 1. **Verify before declaring Phase 11 done.**

---

## D. Operator JTBD walkthroughs (Phase 1 lesson from Slice 4a Round 1)

**Source**: Slice 4a Round 1 surfaced 7 of 10 items in Cluster A (spec-driven implementation without operator-JTBD modeling). Phase 1 prevention measure (per Slice 4a `Prevention Measures` table): every spec requirement that decides whether the operator sees a UI element gets a paired "operator first-time-open dry-run." Performed below.

### JTBD 1 — *"I just clicked + New survey from the list. What happens?"*

- **Operator path**: list page → `+ New survey` → `/admin/surveys/new` (Server Component) → `POST /v1/surveys` → `redirect('/[id]/edit?tab=basics')`.
- **What the operator sees**: zero flicker on `/new` (Server Component, no render), then editor opens on Basics tab with Internal name + Survey title fields highlighted red (required), with `Untitled survey` placeholder. Auto-save indicator says "Draft" initially (no Saved-Xs-ago until first edit).
- **Edge case — 0 programs in brand**: `/new` Server Component issues `redirect('/admin/surveys?error=no-program')`. List page must surface this query param as a toast/banner ("Create a program first before creating a survey"). **Acceptance test**: e2e covers the 0-program path with a fixture brand having no programs.
- **Edge case — back/forward from `/new`**: `/new` is purely a redirect handler — no operator-visible content. Back-from-editor returns to list page (the page before clicking `+ New survey`). Re-clicking `+ New survey` creates a **new** survey row (this is by design — the row count is bounded by clicks, not by Next-button presses).

### JTBD 2 — *"I'm filling out the editor. What auto-saves and when?"*

- **DRAFT state (the common case for a new survey)**: every field auto-saves on blur, debounced 500ms. The header indicator reads "Saved · Xs ago" after the PATCH lands; "Saving…" during the in-flight call.
- **ACTIVE / PAUSED state (editing a live survey)**: per-tab dirty state tracks unsaved changes; explicit Save button at the bottom of the tab body becomes enabled when `isTabDirty(tab)`. Header banner reads "This survey is live. Changes apply immediately on save." until Save is clicked.
- **STOPPED state**: all inputs disabled, no Save button, header reads "Stopped — Restart to edit."
- **Edge case — tab navigation mid-edit in DRAFT**: clicking another tab triggers blur on the focused field, which auto-saves. The tab-switch is immediate; no save spinner blocks navigation. R4: tab navigation never POSTs to `/v1/surveys` (only PATCHes via auto-save). Verified by R4's acceptance test: `SELECT count(*) FROM Survey WHERE id = :id` stays at 1 across tab-clicks.
- **Edge case — tab navigation mid-edit in ACTIVE/PAUSED**: if `isTabDirty('basics')` and operator switches to Look & Feel, the dirty state is preserved (banner persists). No silent save. Switching back surfaces the unsaved Basics fields exactly as left.

### JTBD 3 — *"I want to change the survey type after I've already added questions."*

- R6 mandates a **confirmation modal**: "Change type to <X>? This will replace your current questions with the <X> preset. (Or cancel and keep your questions.)"
- **Edge case — switching to Custom**: no modal fires. Custom = keep whatever questions exist.
- **Edge case — switching between presets (NPS → CSAT)**: modal fires every time questions exist. Cancel preserves type + questions; confirm replaces canvas with new preset.

### JTBD 4 — *"I want to set a more-permissive consent override on this survey."*

- Operator selects "Override · Implied on submit" in the consent dropdown (when brand default is Explicit). An **amber callout** appears in the section: "This deviation will be logged — when you save, you'll be asked to confirm and supply a reason." (R10 spec wording.)
- On save (or on `Activate` if the override isn't saved yet), `<ConsentAttestationModal>` fires. Identity auto-fills (current user). Reason text required (≤500 chars; soft-warn on PII shapes). Checkbox attestation.
- On confirm, PATCH `/v1/surveys/:id/consent-mode` (Slice 2 endpoint) writes `consentMode + consentSuppressedAttestedBy + consentSuppressedAttestedAt + consentReason` atomically + writes audit row.
- HTTP 422 if attestation missing or reason empty — modal surfaces inline error; nothing is saved.
- **Edge case — override-to-stricter** (e.g., brand=Implied, override="Explicit consent required"): no modal fires (R11); PATCH still writes audit row.
- **Edge case — blank disclosure** (R13): operator clears the disclosure textarea. Preview card body empties ("No consent block"). Audit row written on save with `metadata.consentTextOverride = ''`. No additional modal — but the audit-trail badge in the detail-page header (Slice 4a's `SurveyDetailShell`) will reflect this.

### JTBD 5 — *"I want to activate this draft."*

- Click `Activate` (always visible in header, persistent across tabs per R5; or `Continue` on Points & Thank You tab).
- `<ActivateModal>` fires with pre-activate summary.
- **Gates (R23)**:
  - `Survey.questions.length >= 1` — if zero, modal closes; editor jumps to Questions tab with inline message "Add at least one question before activating."
  - Required fields complete — if missing, editor jumps to the offending tab with inline highlight.
  - Consent override (if any) attested — if not, fires `<ConsentAttestationModal>` first, then re-opens `<ActivateModal>` on confirm.
- On confirm, PATCH `/v1/surveys/:id/status` → ACTIVE, redirect to `/admin/surveys/[id]` (Slice 4a's detail page).
- **Edge case — auto-save in-flight on Activate click**: Activate waits for in-flight PATCHes to settle before issuing the status PATCH. Otherwise the activated survey might miss the last field edit.

### JTBD 6 — *"I want to discard this draft and start over."*

- Open `More` menu (in editor header) → "Discard draft" → `<DiscardDraftModal>` confirmation → `DELETE /v1/surveys/:id` → redirect to `/admin/surveys`.
- **Edge case — only available in DRAFT**: spec §5 + ⋯-menu state-awareness — Discard hidden in ACTIVE/PAUSED/STOPPED.

### JTBD 7 — *"I navigate from `/new` directly to `/admin/surveys/[id]/edit?tab=questions` via URL."*

- `?tab=` query param controls initial tab (default `basics`). Valid values: `basics`, `questions`, `look-feel`, `points-thank-you`. Invalid values fall back to `basics`.
- **Edge case — invalid surveyId in URL**: 404 (route returns the standard not-found page; the editor never renders).

### JTBD 8 — *"I land on the editor for a STOPPED survey by clicking Edit on the detail page."*

- Editor renders read-only mode: all inputs `disabled`, no Save buttons, header reads "Stopped — Restart to edit."
- The `Restart` action lives in the detail page's ⋯ menu (Slice 4a) — not in the editor's chrome. Operator's path: editor → back → detail → ⋯ → Restart → re-enter editor in ACTIVE.

---

## E. Hide-vs-stub decisions (Slice 4a Round 1 lesson — item 4 / Cluster A)

**Source**: Slice 4a Round 1 surfaced "Coming soon" `StubTile`s for email integration + QR code as product-design clutter. User direction: **hide stubs entirely until implemented**.

| Surface | Decision | Rationale |
|---|---|---|
| Rules tab in editor | **Hide entirely** | #241 V0 deferred Rules tab per D14. No tab header, no breadcrumb. The 4-tab order is exactly `Basics → Questions → Look & Feel → Points & Thank You`. |
| "Manage themes →" link in Look & Feel theme picker | **Hide entirely** | RBAC: survey creator may not have theme-edit access (R19 explicit). |
| `V1` per-survey points-override input next to read-only program rate (R20) | **Reserve layout slot only (no UI element)** | Section §2.4 V1 hook — the layout leaves room for the future field but renders nothing today. |
| Email integration / QR code tiles in DistributionSection | **Slice 4a already hides these (deleted in PR #353)** | Slice 4b leaves the detail page untouched; no change here. |
| `<LoopMonitor>` section on detail page | **Slice 4a already promotes this to default-expanded section (R32b)** | Slice 4b leaves the detail page untouched. Hero-feature R2 protection is intact. |
| Type-as-column sortability in list page header | **Slice 3 already shipped without sortable headers** | Sortable headers are V1 per spec §1; Slice 4b doesn't touch list-page column behavior. |

---

## F. Validation Requirements

| Mode | Required? | Notes |
|---|---|---|
| **uiValidationRequired** | **Yes** | Editor + modals + tab navigation + auto-save indicator + state-aware save mode. Use Playwright with `PLAYWRIGHT_TEST=true` Clerk-bypass + `page.route()` API-mock pattern (per Slice 4a recovery). |
| **mobileValidationRequired** | **Yes** | Look & Feel tab renders Mobile preview side-by-side with Desktop (R17). **Mobile emulator (Playwright `viewport: { width: 375, height: 667 }`)** validation required for both PreviewSurvey orientations in Look & Feel. **Mobile here means emulator/device-profile, not just narrow-viewport browser.** |
| **API-shape diff at Phase 5** | **Yes** | Slice 4a Round 1 Cluster B (item 6) — local `SurveyResolved` type drifted from API runtime shape; `survey.settings` was always-present in type but `null` from API. **Prevention**: Phase 5 step — one real `GET /v1/surveys/:id` against dev server (or via curl with bearer), diff response against `SurveyResolved` / `SurveyEditorFormValues` local types, fix any field that's nullable in runtime but always-present in type. |
| **Operator JTBD dry-run at Phase 1** | **Done above** (§D) | Walked 8 distinct JTBDs; documented edge cases. |
| **State-aware affordance audit at Phase 5** | **Yes** | Walk every editor surface in every survey status (DRAFT / ACTIVE / PAUSED / STOPPED) and assert each clearly signals what the operator can/can't do. Spec R29 + R30 + the state-aware save mode all interlock here. |
| **Editor-tab mirror check at Phase 4** | **Already shipped in Slice 4a** for the detail page's Configuration summary (R28 — 4 subsections in editor-tab order). Slice 4b's editor is the canonical source; no mirror needed in #336. |
| **Phase 12 ledger-first** | **Operational rule** | Open `docs/evidence/336-feature-implementation-feedback.md` as soon as the first user feedback item lands. Append entries inline as fixes ship. Close the round with `seekMentoring(complete)` only after the file is current. |
| **Local gates (per CLAUDE.md + R11)** | **Yes** | `pnpm typecheck && pnpm lint && pnpm build && pnpm test:smoke && pnpm test:integration && pnpm test:e2e` all green. |
| **Tests-must-never-skip (R11a)** | **Yes** | Any test that requires DB / dev server / API key must **fail loudly with a clear error** if dep missing — never skip silently. |

---

## G. Pattern discovery (Phase 1 step 3)

### Established patterns in the codebase that Slice 4b reuses

| Pattern | Source | How Slice 4b uses it |
|---|---|---|
| RHF `useForm` + zodResolver + `mode: 'onBlur'` + per-section dirty state via `SECTION_FIELDS` map | `apps/web/src/app/(admin)/admin/organization-settings/.../OrganizationSettingsForm.tsx` (lines 174-177) | `SurveyEditorForm` uses `TAB_FIELDS` map of the same shape — one entry per tab listing the field names that contribute to that tab's dirty state. |
| `.consent-toolbar` disclosure editor with token-insert buttons + Reset-to-brand-default link | Organization Settings disclosure editor (referenced in spec §2.1.1 + #276 history) | `ConsentCollectionSubBlock` reuses the same toolbar styling + insert-token behavior. Token format `{{privacy:"…"}}` / `{{terms:"…"}}` per R12. |
| `<CollapsibleSection>` chevron primitive | Slice 4a `apps/web/src/app/(admin)/admin/surveys/[id]/components/CollapsibleSection.tsx` | Not required for the editor (4 tabs, not collapsibles), but **available** for "Not sure which to pick?" guidance block in Basics (spec §2.1) which is collapsed by default. |
| `<SurveyDetailMoreMenu>` state-aware ⋯ menu | Slice 3 `apps/web/src/app/(admin)/admin/surveys/components/SurveyRowMenu.tsx` + `survey-row-menu.logic.ts` | Editor's `More` menu (in header) should consume the same `survey-row-menu.logic.ts` to keep state×menu-item visibility consistent between list/detail/editor. **Reuse, don't duplicate**, per Slice 4a Lesson 4 (`<SurveyDetailMoreMenu>` already consumes it). |
| Playwright `PLAYWRIGHT_TEST=true` Clerk-bypass + `page.route()` API-mock | Slice 4a `apps/web/test/e2e/335-survey-detail-page.spec.ts` + `admin-organization-settings.spec.ts` | 336 e2e specs use the same pattern. **Do not invent a new auth-bypass mechanism** (Slice 4a's "Lesson 5" — `feedback_fraim_phases_not_optional.md` fired in Phase 5). |
| `getAuthToken(getToken)` + bearer | `apps/web/src/lib/config.ts` | Editor's CSR data fetches (programs, brand, theme) use the same pattern. `/new` Server Component uses `auth()` from `@clerk/nextjs/server` instead. |
| `survey.settings?.chromeMatrix` defensive optional chain | Slice 4a `SurveyConfigDl.tsx` (fix for null-settings runtime crash per Round 1 item 6) | Editor's `LookFeelTab` reads `survey.settings?.chromeMatrix` (not `survey.settings.chromeMatrix`) — never trust local type's always-present claim against API runtime shape. |
| `useState`-driven question canvas (no drag-drop dep) | Legacy `apps/web/src/app/(admin)/admin/survey-builder/page.tsx` (verified to use only React state, no `@dnd-kit`) | Slice 4b's `QuestionsTab` uses Up/Down buttons over the same `useState` substrate. **No new dependency.** |

### Patterns NOT to introduce in Slice 4b (anti-patterns)

| Anti-pattern | Why not |
|---|---|
| `@dnd-kit` or any drag-drop library | RFC §"Question canvas — reorder via Up/Down buttons" explicitly rejects this. Zero new bundle weight. |
| New form library (anything other than RHF) | Architecture.md §2 Forms row mandates RHF + zodResolver + per-section dirty state. |
| Module-level singletons for API clients / loggers | Architecture §Testability — DI patterns. Pass functions/objects through props or context. |
| `console.error` in production code | Slice 4a Round 1 fix (Phase 8) — use injected Pino-shaped logger or omit. |
| Inline mocks in test files | Project rule R8 — all mocks/factories live in `packages/config/src/test-utils/`. Slice 4b adds new mocks (e.g., `mockSurveyDraft`, `mockBrandThemeLibrary`) to that package first, then imports. |
| Forced TypeScript casts (`as unknown as`) over SDK boundaries | Mistake-pattern P-HIGH 8.0 — `signInUser` Clerk forced cast in #170 PR1. Redesign the interface instead. |
| Auto-save on Save-Draft button | The Save Draft "button" doesn't exist as a chrome element — the indicator is "Saved · Xs ago"; the auto-save fires on blur. Don't introduce a manual Save Draft button. |

---

## H. Hero-feature R2 cross-check (Slice 4a postmortem lesson #1)

**Project rule R2**: Issue #6 hero pipeline must preserve <15-minute feedback-to-action SLA + visibility.

**Slice 4b surfaces that touch the event pipeline?**
- ❌ No new event emission.
- ❌ No worker change.
- ❌ No change to `apps/api/src/routes/surveys.ts` response handler.
- ❌ No removal of `<LoopMonitor>` (Slice 4a's promotion to first-class section per R32b stays intact in `apps/web/src/app/(admin)/admin/surveys/[id]/page.tsx`).

**Slice 4b deletions that could touch pipeline visibility?**
- Survey-builder directory deletion: only the **builder UX** (separate route `/admin/survey-builder`). LoopMonitor lives at `apps/web/src/components/surveys/LoopMonitor.tsx` and is NOT inside the deleted directory. **No regression risk.**
- Wizard-step component deletion: TriggerStep / RuleBuilderStep / ReviewLaunchStep. None of these render pipeline state. **No regression risk.**

**Confirmation**: R2 is preserved. No additional surfacing required.

---

## I. API-shape verification (Slice 4a Round 1 Cluster B lesson)

**At Phase 5 (implement-validate)**, before declaring the phase complete:

1. With dev server running (`pnpm dev` or `docker compose up -d && pnpm db:migrate && pnpm dev`):
2. Create a fresh draft via `POST /v1/surveys` with bearer token.
3. `GET /v1/surveys/:id` — capture response JSON.
4. Diff response JSON against the local `SurveyEditorFormValues` type. Every field declared always-present in the type but `null`/`undefined` in the response is a **bug-in-waiting** — apply optional-chain at the consumer boundary OR widen the type to `T | null`.
5. Repeat for `GET /v1/programs` (program-rate display data).
6. Repeat for `GET /v1/brand-themes` (theme picker data).
7. Repeat for `GET /v1/brands/:id` (consent-mode + memberIdentifierKind defaults).

**Fields known-to-be-nullable from prior slices** (don't repeat Slice 4a's mistake):
- `Survey.settings` — `null` for surveys without custom settings (Slice 4a postmortem Round 1 item 6).
- `Survey.title` — `null` for newly-created drafts before Basics-tab edit (Slice 1 made it nullable).
- `Survey.consentMode` / `consentSuppressedAttestedBy` / `consentSuppressedAttestedAt` / `consentReason` — all null when no override.
- `Survey.consentTextOverride` — null when inheriting brand default; `""` (empty string) when blank-disclosure is set (R13 distinction).
- `Survey.thankYouRedirectUrl` — null for embedded-only flows.
- `Brand.termsUrl` — null for brands without Terms URL (R12: hides Terms toolbar button when null).

---

## J. Implementation order (Phase 4 sequencing — walking skeleton first)

Per FRAIM constitution §IV (Prototype-First) and the principle "Get a walking skeleton working first, then refine":

1. **Walking skeleton**: editor shell renders 4 empty tabs; auto-save indicator placeholder; Activate button placeholder. Test: page loads in DRAFT for an existing survey row.
2. **State-aware save mode wired**: `useAutoSave` hook + per-state branching. Test: DRAFT auto-saves on blur; ACTIVE/PAUSED render explicit Save button (button can be no-op for now); STOPPED disables inputs.
3. **BasicsTab fields + R6 type-change modal**: all 7 Basics fields + Type card-grid + type-change confirmation. Test: required field validation; type-change modal.
4. **ConsentCollectionSubBlock**: dropdown + preview + disclosure editor.
5. **ConsentAttestationModal**: more-permissive override surface.
6. **QuestionsTab**: 11 question types + Up/Down reorder + preset banner.
7. **LookFeelTab**: channel tabs × viewport split + theme picker + chrome matrix.
8. **PointsAndThankYouTab**: read-only program-rate + variable picker + redirect URL.
9. **ActivateModal**: pre-activate summary + gates + status PATCH + redirect.
10. **DiscardDraftModal**: confirmation + DELETE + redirect.
11. **/new Server Component**: Server Component with `auth()` + POST + redirect.
12. **Legacy deletion**: delete survey-builder/, wizard-step components, triggerRecommendation. Verify `pnpm typecheck && pnpm build` after each deletion to catch dangling imports.
13. **Architecture-doc MA1** (Phase 10).
14. **e2e specs** (parallel with phase 4; finalized at Phase 5).

---

## K. Risks (open)

| Risk | Likelihood | Mitigation |
|---|---|---|
| Mid-stream feedback rounds (Slice 4a precedent: 10 items in Round 1, 5-hour session across 2 days) | High | Phase 12 inline ledger discipline (open feedback file before first fix; append per item). Per-thread PR replies at resolution time (validated pattern P-HIGH 8.0). Decision blocks at PR-body bottom with `← recommended` defaults. |
| Parallel-worker e2e flakes (Slice 4a precedent: 2 tests timed out under 10-worker load) | Medium | Explicit `await expect(...).toBeVisible({ timeout: 20000 })` on post-load anchors. `await page.waitForLoadState('networkidle')` after `goto`. Run new specs under parallel-load pressure before declaring green. |
| `useAutoSave` hook reference-instability causing infinite render loops (Slice 4a Lesson 2) | Medium | Test mock for `useAuth()` (or any custom hook) returns **stable object references** — declare hook return at module top, not inline. Hook itself uses `useCallback` for the save fn so consumers' `useEffect([saveFn])` doesn't re-fire. |
| API-shape vs local-type drift (Slice 4a Round 1 Cluster B) | Medium | §I — Phase 5 API-shape diff with one real GET. Defensive optional chains at consumer boundaries. |
| Atomic-switch constraint conflicts with mid-implementation discovery of a missing API field | Low-Medium | If discovered, prefer a thin adapter at the form-level (optional-chain + default) over re-opening Slice 2 scope. Document the gap; file follow-up issue per R21. |
| Slice 4b's editor surfaces a feature not in Slice 4a's renderer family | Low | Verified §G — Slice 4a's `<PreviewSurvey channel="…" viewport="…" survey={} brand={} theme={} readOnly>` is the full contract. LookFeelTab and ConfigurationSummarySection both consume it as-is. |
| pnpm vs npm lockfile churn from prep-script (validated pattern, 4 recurrences) | Cleaned | prep-issue.sh's `package-lock.json` modification was reverted in this session via `git checkout -- package-lock.json` (worktree clean). Don't run `npm install` in this worktree; use `pnpm install` if a dep change ever surfaces. |
| FRAIM session ID lost across context compaction (mistake-pattern P-MED) | Medium | Session ID recorded here: **`118a3bc4-9abf-4732-a029-cb34d371f3b6`** — next session reconnects with this ID via `fraim_connect`. |

---

## L. Open questions / deferrals (for later phases)

| # | Question | Defer to | Resolution |
|---|---|---|---|
| OQ1 | Where do the `mockSurveyDraft` / `mockBrandThemeLibrary` / `mockProgramWithEarningRule` / `mockBrandWithConsentMode` test fixtures live in `packages/config/src/test-utils/`? | Phase 3 — adding before first use per project rule R8. | **Resolved Phase 3 (2026-05-13)**: existing Slice 4a pattern co-locates `__fixtures__/` next to consumers (`apps/web/src/components/survey-form/__fixtures__/`). `packages/config/src/test-utils/factories/` is the **DB/Prisma integration** tier (factories call into Prisma). Slice 4b adds `apps/web/src/app/(admin)/admin/surveys/[id]/edit/__fixtures__/editor-fixtures.ts` with `MOCK_DRAFT_SURVEY`/`MOCK_ACTIVE_SURVEY`/`MOCK_STOPPED_SURVEY`/`MOCK_BRAND_EXPLICIT`/`MOCK_BRAND_IMPLIED`/`MOCK_BRAND_NO_TERMS`/`MOCK_THEME_LIBRARY`/`MOCK_PROGRAM_NPS_WITH_RULE`/`MOCK_PROGRAM_CSAT_NO_RULE`. R8 still applies to integration-tier mocks. |
| OQ2 | Does the surveys list page's `+ New survey` button (Slice 3) point to `/admin/surveys/new` or carry an old href? | Phase 4 — verify before implementing /new Server Component (one-line edit if needed; falls under Modified file #33 above). | **Resolved Phase 3 (2026-05-13)**: list page already points to `/admin/surveys/new` (`apps/web/src/app/(admin)/admin/surveys/page.tsx:223` — `<Link href="/admin/surveys/new">`). Modified file #33 in §C.6 is a **no-op**; the existing href just becomes the new Server Component route once Phase 4 lands. |
| OQ3 | Embedded preview's Mobile rendering — does Slice 4a's `<PreviewSurvey viewport="mobile">` already constrain to mobile width, or does Slice 4b's LookFeelTab need an extra wrapper? | Phase 4 — read `apps/web/src/components/survey-form/PreviewSurvey.tsx` (existing) to confirm. | **Resolved Phase 3 (2026-05-13)**: `<PreviewSurvey>` already constrains viewport via `VIEWPORT_MAX_WIDTH` (`apps/web/src/components/survey-form/PreviewSurvey.tsx:28-31, 47-49` → mobile=375px). LookFeelTab needs **no extra wrapper**. |
| OQ4 | Auto-save indicator copy across multiple in-flight PATCHes (operator tabs rapidly) — show last-saved time or "Saving N changes…"? | Phase 4 — RFC says "Saved · Xs ago" so use last-saved-at after the queue settles. | Carried into Phase 4 — copy choice is "Saved · Xs ago" per RFC. |
| OQ5 | Type-change modal copy for the case "preset has 5 questions, switching to Custom" — Custom is "keep" per R6, no modal. Confirm with reviewer if behavior changes. | Out of scope — R6 is authoritative. | n/a (out of scope). |

---

## M. Phase ledger (running)

| Phase | Status | Notes |
|---|---|---|
| 1 — implement-scoping | **Complete** | Work-list authored, committed (`08d693e`), and pushed. |
| 2 — implement-repro | **N/A** | Slice 4b is a feature, not a bug. Confirmed at Phase 3 entry. |
| 3 — implement-tests | **Complete (2026-05-13)** | 12 RTL/vitest files in `[id]/edit/{components,hooks}/` + page-level RTL + 2 Playwright e2e specs (`336-survey-editor.spec.ts`, `336-surveys-list.spec.ts`) + shared `__fixtures__/editor-fixtures.ts`. Vitest run: all 12 fail loudly with clear errors (11 module-not-found for unbuilt components, 1 page-level with 5 assertion failures against the legacy redirect stub). Zero tests skipped — R11a satisfied. Slice 4a tests remain green (11/11) once `packages/consent-text` is built — Slice 4b changes are isolated. **Test-setup gap to flag in Phase 4**: `pnpm test:smoke` (root) runs turbo on packages but `apps/web` has no `test:smoke` script — Slice 4a's existing vitest tests do not run under the smoke alias either. This is **pre-existing** and out of Slice 4b scope per R21; flag for the PR description so reviewers know `pnpm --filter @customerEQ/web test` is the path to exercise both Slice 4a + 4b. |
| 4 — implement-code | **In progress — items 1–6 of §J complete (2026-05-13)** | Walking skeleton (page · `SurveyEditorForm` · `TabHeader` · `useAutoSave`), `BasicsTab` + R6 type-change modal, `ConsentCollectionSubBlock`, `ConsentAttestationModal`, and `QuestionsTab` (11-type palette · Up/Down reorder · right-rail config · preset banner) all landed. Stub files remain for `LookFeelTab` / `PointsAndThankYouTab` / `ActivateModal` / `DiscardDraftModal` (next-session placeholders). In-scope vitest: **79/79 green** across 8 files (was 64/64 / 7 — exactly +QuestionsTab's 15 tests). `pnpm typecheck` clean for `apps/web` after `pnpm --filter @customerEQ/database exec prisma generate && pnpm --filter @customerEQ/database build`. **Next-session entry point: §J item 7 (LookFeelTab full implementation).** Items 7 → 14 still pending. |
| 5 — implement-validate | Pending | Local gates + Playwright e2e + API-shape diff (§I) + mobile-emulator validation (§F). |
| 6 — implement-security-review | Pending | `reviewScope = diff`; admin-only surface; OWASP-Top-10 web checklist + privacy review. |
| 7 — implement-regression | Pending | Full `pnpm test:e2e` + `pnpm test:integration`. Verify no Slice 3 / Slice 4a regressions. |
| 8 — implement-quality | Pending | `deep-code-quality-checks` against the diff. |
| 9 — implement-completeness-review | Pending | Feature + Technical Design Traceability Matrices. |
| 10 — implement-architecture-update | Pending | MA1 entry in §6 + §3.1 paragraph. |
| 11 — implement-submission | Pending | Push branch (already pushed empty branch); open PR against `main` referencing #336 + #324 + #241. |
| 12 — address-feedback | Pending — **hold-point** | Inline ledger; per-thread PR replies; never auto-complete (Rule 25a). |
| 13 — retrospective | Pending | Postmortem in `docs/retrospectives/manohar.madhira@outlook.com-issue-336-slice-4b-...md`. |

---

## N. Resumption pointer

**Next session entry point**: `fraim_connect` (a fresh session ID is issued each connect — do not try to reuse the old one; FRAIM session state is reconstructed from the work-list + this resumption pointer, not from the session ID), then call `seekMentoring({ jobName: 'feature-implementation', jobId: '336', issueNumber: '336', currentPhase: '<next-phase>', status: 'starting' })` where `<next-phase>` is the next pending row in §M's phase ledger. This work-list is the authoritative scoping artifact — read it before §M to know what landed, then call `seekMentoring`. **Phase 4 is partially complete (items 1–5 of §J landed in session 2026-05-13).** Resume Phase 4 at **§J item 6 — `QuestionsTab` (11 question types + Up/Down reorder + preset banner)**. Items 6 → 8 are stub placeholders today; replace them. Then items 9 → 14 follow §J order. Reference: Phase 3 commit `f6f5921`; Phase 4 items 1–5 will be committed next.

**Note on Phase 4 progress (after session 2026-05-13b)**: `QuestionsTab` is now fully implemented (commit added in §J item 6 session). Per-question right-rail in the shipped tab covers **text · type · required**; skip-logic and branching UIs are **deferred** to a follow-up issue — no Slice 4b AC enforces them, no test in `QuestionsTab.test.tsx` exercises them, and per R21 they belong on their own branch rather than getting bundled here. File a sibling sub-issue when the operator-facing skip-logic UI is scheduled.

**Critical references for future sessions**:
- This work-list: `docs/evidence/336-implement-work-list.md` (this file)
- Spec: `docs/feature-specs/241-survey-admin-ux.md` (§2, §2.1, §2.1.1, §2.2, §2.3, §2.4, §6, R1-R34)
- RFC: `docs/rfcs/241-survey-admin-ux.md` — §"File tree", §"BrandTheme to Survey element token mapping (R31)", §"RHF form structure", §"Save behavior by state", §"Question canvas", §"Surveys list", §"Detail page" + MA1 in §"Patterns Missing from Architecture"
- Slice 4a postmortem: `docs/retrospectives/manohar.madhira@outlook.com-issue-335-slice-4a-renderer-detail-page-postmortem.md` (Round 1 lessons especially relevant)
- Slice 4a Round 1 feedback file: `docs/evidence/335-feature-implementation-feedback.md`
- Project rules: `fraim/personalized-employee/rules/project_rules.md` (R2, R8, R10, R21, R24, R25)
- Personalized learnings: `fraim/personalized-employee/learnings/manohar.madhira@outlook.com-{preferences,mistake-patterns,validated-patterns}.md`
