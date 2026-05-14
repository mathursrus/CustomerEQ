# Slice 4b — Implementation Feedback Ledger

**Issue**: #336 — Slice 4b: full editor (4 tabs) + `/new` Server Component + legacy survey-builder cleanup
**Branch**: `feature/336-impl-241-slice-4b-full-editor-4-tabs-new-server-component-legacy-survey-builder-cleanup`

This file captures **Phase 8 (implement-quality) findings** + the running list of feedback rounds that will follow once the PR opens. Each finding is tagged with a severity (P0/P1/P2) and a status (UNADDRESSED / ADDRESSED / DEFERRED).

---

## Phase 8 — deep-code-quality-checks (2026-05-13)

Scope: 12 new production files under `apps/web/src/app/(admin)/admin/surveys/[id]/edit/` + the rewritten `apps/web/src/app/(admin)/admin/surveys/new/page.tsx`.

Scan: Explore-agent delegated review + inline verification of top findings.

### QUALITY CHECK FAILURE — Q8-001 — dead ternary in patchSurvey path resolver — P1
**File**: `apps/web/src/app/(admin)/admin/surveys/[id]/edit/page.tsx:76`
**Finding**: `const path = url.startsWith('http') ? url : url` — both branches return the same value (`url`). The ternary is dead code. Consumers in this slice always pass relative URLs (e.g. `/v1/surveys/:id`), so the runtime behavior is correct, but the conditional misrepresents intent and is a foot-gun if anyone later passes an absolute URL.
**Status**: ADDRESSED

### QUALITY CHECK FAILURE — Q8-002 — error-parsing duplication across 4 modal files (Rule 15 violation) — P1
**Files**:
- `apps/web/src/app/(admin)/admin/surveys/[id]/edit/components/SurveyEditorForm.tsx:256`
- `apps/web/src/app/(admin)/admin/surveys/[id]/edit/components/ActivateModal.tsx:96`
- `apps/web/src/app/(admin)/admin/surveys/[id]/edit/components/DiscardDraftModal.tsx:43`
- `apps/web/src/app/(admin)/admin/surveys/[id]/edit/components/ConsentAttestationModal.tsx:66`

**Finding**: All four files duplicate the same pattern: `const parsed = (await res.json()) as { message?: string; error?: string }` followed by `parsed.message ?? parsed.error ?? <fallback>`. The 4th file (ConsentAttestationModal) additionally uses `res.clone().json()` instead of `res.json()` — minor variant of the same logic. Per project rule R15 (fix at right abstraction), repeated logic across ≥3 files should be extracted to a shared utility.
**Status**: ADDRESSED

### QUALITY CHECK FAILURE — Q8-003 — modal dialog structure duplication across 4 files (Rule 15 violation) — P1
**Files**:
- `apps/web/src/app/(admin)/admin/surveys/[id]/edit/components/ActivateModal.tsx:114-117`
- `apps/web/src/app/(admin)/admin/surveys/[id]/edit/components/DiscardDraftModal.tsx:61-64`
- `apps/web/src/app/(admin)/admin/surveys/[id]/edit/components/ConsentAttestationModal.tsx:119-122`
- `apps/web/src/app/(admin)/admin/surveys/[id]/edit/components/BasicsTab.tsx:323-326` (R6 type-change confirm modal — embedded inline)

**Finding**: All four files duplicate the same modal wrapper: `role="dialog"`, `aria-modal="true"`, plus the same Tailwind layout (`fixed inset-0 z-50 flex items-center justify-center ... p-4`). Per R15 this is a 4-file repeat that should be a shared component.

**Related observation (not in Slice 4b scope, will note for follow-up)**: `apps/web/src/app/(admin)/admin/settings/organization/components/ImpliedAttestationModal.tsx:39-48` (Slice 292) uses the same modal pattern with a third backdrop variant. A future cleanup PR could migrate it to the shared Dialog. **Out of scope for #336 per R21** — flag in PR description.

**Status**: ADDRESSED

### QUALITY CHECK FAILURE — Q8-004 — modal backdrop color inconsistency — P1
**Files** (same 4 as Q8-003 + 1 sibling):
- `ActivateModal.tsx:117`: `bg-gray-900/50`
- `DiscardDraftModal.tsx:64`: `bg-gray-900/50`
- `BasicsTab.tsx:326`: `bg-black/40`
- `ConsentAttestationModal.tsx:122`: `bg-black/40`
- `ImpliedAttestationModal.tsx:41` (org settings, pre-existing): `bg-slate-900/55`

**Finding**: Three different backdrop colors across the 5 modals in the admin area. Inconsistent visual treatment. Folds into the Q8-003 Dialog extraction — once a shared `<Dialog>` exists, the backdrop is centralized.
**Status**: ADDRESSED (folded into Q8-003 fix)

### QUALITY CHECK FAILURE — Q8-005 — TabHeader magic numbers for relative-time formatting — P2
**File**: `apps/web/src/app/(admin)/admin/surveys/[id]/edit/components/TabHeader.tsx:37-44`
**Finding**: The `formatSavedAt` helper uses `60_000` (minute), `60_000` again (per-minute floor), `60` (minutes-per-hour). Tiny function — but the same `60_000` literal appears 3× and `60` once. Naming them as `MINUTE_MS = 60_000` and `MINUTES_PER_HOUR = 60` would make the math more obvious to a reader. Low impact.
**Status**: ADDRESSED

### NO-OP / NOT A FINDING — Q8-noop-001 — `void brand` parameter in BasicsTab
**File**: `apps/web/src/app/(admin)/admin/surveys/[id]/edit/components/BasicsTab.tsx:67`
**Decision**: The `void brand` expression is intentionally suppressing TypeScript's unused-parameter warning while keeping the parameter as part of the function signature (the helper accepts `brand` for API consistency with consumers that need it). This is the project's established pattern for "reserved API parameter" — no change needed.

### NO-OP / NOT A FINDING — Q8-noop-002 — useAutoSave reference stability
**File**: `apps/web/src/app/(admin)/admin/surveys/[id]/edit/hooks/useAutoSave.ts:40-62`
**Decision**: The hook correctly uses `optionsRef` to capture the latest consumer callbacks without churning the `triggerSave` reference — exactly the Slice 4a Lesson 2 / Rule 25d pattern. No change needed.

### Action plan — all addressed

| ID | Fix | Commit |
|---|---|---|
| Q8-001 | Removed the dead `url.startsWith('http') ? url : url` ternary in `page.tsx:76`. Comment reworded to clarify that callers pass relative URLs and `callApi` prepends `API_URL`. | this session |
| Q8-002 | Created `apps/web/src/lib/errors.ts` exporting `parseErrorResponse(res: Response): Promise<string>`. Refactored 4 call sites: `SurveyEditorForm.tsx:256`, `ActivateModal.tsx:96`, `DiscardDraftModal.tsx:43`, `ConsentAttestationModal.tsx` (also removed the local `readErrorMessage` helper that wrapped `res.clone().json()`). Net savings: ~28 lines. | this session |
| Q8-003 + Q8-004 | Created `apps/web/src/components/ModalShell.tsx` (29 lines including license/comment) that centralizes the `role="dialog"`, `aria-modal="true"`, backdrop color (`bg-gray-900/50`), z-index (`z-50`), and centering wrapper. Migrated 4 modal consumers: `ActivateModal.tsx`, `DiscardDraftModal.tsx`, `ConsentAttestationModal.tsx`, and the inline type-change modal in `BasicsTab.tsx`. All three backdrop colors collapse to `bg-gray-900/50`. **Not migrated**: `apps/web/src/app/(admin)/admin/settings/organization/components/ImpliedAttestationModal.tsx` (org-settings, #292 territory) — out of scope per R21 (one issue per branch); flagged in PR description for a follow-up sweep. | this session |
| Q8-005 | Added `MINUTE_MS = 60_000` and `MINUTES_PER_HOUR = 60` constants at the top of `TabHeader.tsx`. `formatSavedAt` now uses them in place of the inline literals. | this session |

### Verification

| Gate | Result |
|---|---|
| `pnpm --filter @customerEQ/web typecheck` | clean (0 errors) |
| `pnpm --filter @customerEQ/web lint` | 0 errors / 10 warnings (warnings pre-existing — count unchanged from Phase 5 baseline) |
| `pnpm --filter @customerEQ/web test` | **29 files / 256 tests passed** |
| `pnpm --filter @customerEQ/web exec playwright test 336-*.spec.ts --workers=10` | **17 / 17 passed** in 1m12s under maximum parallel load — Q8-003 ModalShell refactor preserves modal accessibility (`getByRole('dialog')` continues to resolve via the wrapper) and visual appearance (backdrop standardized) |

### Bonus cleanup (incidental)

Removed unused import `MOCK_THEME_DEFAULT` from `apps/web/src/app/(admin)/admin/surveys/[id]/edit/page.test.tsx:24` — pre-existing lint error blocking `pnpm lint`. Two-line removal; restored `pnpm lint` to 0 errors.

---

## Round 1 — Phase 12 address-feedback (PR #364 manual verification)

*Received: 2026-05-14 (entire interactive session, treated as PR feedback per user instruction "Consider all my interaction in this session as the PR feedback")*
*Resolved in commit `312ce64` on `feature/336-impl-241-slice-4b-...`*

**Author**: `manohar.madhira@outlook.com` (PR #364 owner, manual verification)
**Type**: conversational PR feedback (delivered during Phase 12 manual verification before formal GitHub review). User selected CSAT Active Survey + a fresh draft as the test fixtures.

### Item V1-001 — `PointsAndThankYouTab` runtime TypeError — ADDRESSED
- **Comment**: "Cannot read properties of undefined (reading 'find')" — `PointsAndThankYouTab.tsx:47` crashes when `program` exists but `program.earningRules` is undefined.
- **Fix**: optional-chain through to `find` and rely on the existing "No points configured for &lt;type&gt;" empty-state fallback (`apps/web/src/app/(admin)/admin/surveys/[id]/edit/components/PointsAndThankYouTab.tsx:47-50`).

### Item V1-002 — `LookFeelTab` setState-in-render warning — ADDRESSED
- **Comment**: "Cannot update a component (`SurveyEditorForm`) while rendering a different component (`LookFeelTab`)". `handleChromeToggle` called `onChange(...)` (parent setState) *inside* the `setChromeMatrix` updater callback.
- **Fix**: compute `next` outside the updater, then call `setChromeMatrix(next)` + `onChange(...)` sequentially. Also preserve other `settings` keys when patching `chromeMatrix` so future settings additions don't get dropped.

### Item V1-003 — Tab-state-loss across all save modes — ADDRESSED
- **Comment**: "Anything I change on a tab goes away when I come back." Confirmed on Draft, Paused, and Active surveys.
- **Root cause**: each tab component held local `useState` mirrors seeded from `survey.*` props. Tab switch → component unmount → local state lost. Remount → seed from the saved snapshot, not the in-flight `values` map.
- **Fix**: `SurveyEditorForm` now computes `liveSurvey = { ...survey, ...values, settings: shallow-merged }` via `useMemo` and passes it down everywhere `survey` was passed. Tabs re-seed from in-flight values on remount. Also auto-fixed V1-004 because the type radio's `checked` now reads `liveSurvey.type`.

### Item V1-004 — Type-change modal: confirm doesn't apply — ADDRESSED
- **Comment**: "I tried changing type of an existing survey, I got an alert box but type did not change."
- **Fix**: `liveSurvey` (V1-003) makes the radio `checked` reflect the in-flight `values.type` after `onTypeChange` fires. The modal's "Change type" button now visually applies. Also added auto-swap of preset questions per V1-013.

### Item V1-005 — Type-change permitted on non-DRAFT (server returns 409) — ADDRESSED
- **Comment**: implicit — user attempted on CSAT Active; the modal opened, server would have rejected on save.
- **Fix**: per R29 state-aware editability, `BasicsTab` now disables the Type cards on non-DRAFT and shows an amber 🔒 LOCKED chip + tooltip ("Survey type can only be changed while the survey is a Draft").

### Item V1-006 — Questions tab: visual mismatch with 241 mock — ADDRESSED
- **Comment**: "The questions tab does not show the similar look and feel like the survey builder and mocks. Please use the mock design, Question types with icons on the left."
- **Fix**: palette is now a left-column list with mock-specified icon + label per type (`apps/web/src/app/(admin)/admin/surveys/[id]/edit/components/QuestionsTab.tsx:29-41`). Layout matches mock §241 lines 256-275 (`canvas-shell`).

### Item V1-007 — Questions tab: Survey-Builder per-type config gone — ADDRESSED
- **Comment**: "Question settings on Ratings also don't carry forward the capabilities of adjusting rating and the term — again, please build the Survey-Builder capabilities into the questions section. You have removed most functionality without any approval. Scope was to unify Survey-Builder into this view."
- **Fix**: full per-type config restored in the right rail for all 11 types — rating min/max + endpoint labels, slider min/max/step + labels, text placeholder/maxLength/multiline, options + allowOther for multiple_choice/checkbox/dropdown, ranking minSelect/maxSelect, matrix rows/columns, likert scale, image_choice with multiSelect, file_upload maxSize + allowedTypes. Reused the legacy `apps/web/src/app/(admin)/admin/survey-builder/page.tsx` (recovered from `git show d8a730d^`) as the parity reference.
- **Coaching moment**: this was a scope removal without prior approval — captured under `fraim/personalized-employee/learnings/raw/` (slug `silent-scope-removal`).

### Item V1-008 — Primary score question (`isScoreField`) toggle missing — ADDRESSED
- **Comment**: "A new setting was to be added to capture the Primary Score question for NPS,CSAT or CES types".
- **Clarification from user**: "is a question based config, not a survey based config. Only one question can be `isScope`. No separate scoring panel."
- **Fix**: `isScoreField` toggle added to the right rail for rating/slider questions only (per `SCORE_FIELD_RATEABLE_TYPES` in `packages/shared/src/zod/survey.schema.ts:72`). At-most-one invariant enforced client-side: turning it on for a new question auto-clears it on any other question. NPS/CSAT/CES presets ship with Q1 carrying `isScoreField: true`.

### Item V1-009 — Look & Feel preview: not the actual Survey Renderer — ADDRESSED
- **Comment**: "Look and Feel - Survey Title is not shown. When consent is explicit preview should show a check box."
- **Clarification**: "should show exactly what customer will see from Survey Renderer — any new questions etc. ... if I select options below (like Remove title, logo etc.) then preview should still reflect that."
- **Fix**: preview was already using `PreviewSurvey` → `SurveyFormRenderer`. The missing pieces were:
  - `SurveyResolved` + `BrandLite` types didn't carry `consentMode`, so the renderer couldn't tell EXPLICIT vs IMPLIED. Added `consentMode` to both (`apps/web/src/components/survey-form/types.ts`).
  - `SurveyFormRenderer` now renders a checkbox + disclosure under EXPLICIT mode (mirrors the `ConsentCollectionSubBlock` preview pattern). Implied stays paragraph-only.
  - Survey title is already wired through `chrome.title && survey.title` — combined with V1-003 (`liveSurvey`) the title now updates live as the operator types in Basics.

### Item V1-010 — Same experience for Draft/Paused/Active — ADDRESSED
- **Comment**: "When I clicked on a Draft or Paused survey - experience was the same."
- **Clarification**: not a defect on its own — the user was clarifying that V1-001..V1-009 apply to all three states. The state-aware save mode (DRAFT auto-saves, ACTIVE/PAUSED explicit save, STOPPED read-only) was already correct; user confirmed "No Divergence - stay with spec and mock" after I flagged a divergence between user paraphrasing and the RFC.

### Item V1-011 — Survey type cards: verbiage / icons don't match the mock — ADDRESSED
- **Comment**: "Check the mock - For the exact verbiage for the NPS, CSAT, CES and custom and the included 'Not sure which to pick'. These were deliberately designed and iterated to get information and icons right. Why do you keep ignoring the mock?"
- **Fix**: read `docs/feature-specs/mocks/241-survey-admin-ux.html` lines 577-612 directly. Type cards now match exactly — NPS ⭐ *Net Promoter* / "Loyalty health — would you recommend us?" / "1 standard question + 1 follow-up"; CSAT ❤ *Satisfaction*; CES ⚡ *Effort*; Custom ✎ "Build your own — any mix of question types." / "Blank canvas". Field helper: "Picking NPS / CSAT / CES auto-populates the Questions tab with the standard set (all editable). Custom = blank canvas."
- **Coaching moment**: ignoring HTML mocks despite explicit user direction — captured under `fraim/personalized-employee/learnings/raw/` (slug `always-open-html-mocks`).

### Item V1-012 — "Not sure which to pick?" affordance missing — ADDRESSED
- **Comment**: user explicitly named this affordance.
- **Fix**: collapsible quick guide button below the type-card grid (`BasicsTab.tsx`). Verbiage taken verbatim from mock §241 lines 603-612 (NPS/CSAT/CES/Custom positioning bullets).

### Item V1-013 — NPS/CSAT/CES preset auto-swap on type change missing — ADDRESSED
- **Comment**: "Even if I choose CSAT - I get the NPS questions populated. So we need to define the CSAT and CES defaults now."
- **Fix**: shared module at `apps/web/src/app/(admin)/admin/surveys/_helpers/presets.ts` exports `PRESET_QUESTIONS_NPS` (0-10 rating + follow-up), `PRESET_QUESTIONS_CSAT` (1-5), `PRESET_QUESTIONS_CES` (1-7), each with Q1 carrying `isScoreField: true`. `isUnchangedPreset()` detects untouched preset state. On type click in BasicsTab: if questions are empty or match the current type's preset, swap silently to the new preset; otherwise show the R6 modal warning that custom edits will be lost. `/new/page.tsx` now imports `freshPresetFor('NPS')` so /new and the BasicsTab swap stay in lock-step.

### Item V1-014 — Numbered tabs missing (Program-editor parity) — ADDRESSED
- **Comment**: "Please follow the mock exactly for layout, unless technically it is not feasible. Me pointing out mock deviations is waste of my time. ... tabs are laid out with numbers - same as Program."
- **Fix**: `TabHeader` now renders `[1] Basics · [2] Questions · [3] Look & Feel · [4] Points & Thank You` with the active tab marked by a filled indigo circle + indigo underline. Mirrors the mock's `.step-num` pattern (mock §241 lines 64-72 / 548-553) and the `WizardStepper` used by the Program edit page.

### Item V1-015 — Auto-save 401 on tab switch — ADDRESSED
- **Comment**: "I enter data into Basics and switch to the Questions and I get Auto-save failed (HTTP 401)."
- **Root cause**: `getAuthToken` (`apps/web/src/lib/config.ts`) had a 1-second race timeout. When Clerk's session refresh raced the auto-save, `getToken()` returned null, the PATCH shipped without `Authorization`, and the API rejected with 401.
- **Fix**: bumped the timeout to 10 seconds. The 1s value pre-dated the auto-save loop; auto-save is now async-tolerant.

### Item V1-016 — Internal name pre-filled "Untitled survey" — ADDRESSED
- **Comment**: "Can it be placeholder text so user is forced to enter instead of creating as Untitled Survey?"
- **Fix**: relaxed `CreateSurveySchema.name` and `UpdateSurveySchema.name` to allow empty strings (`packages/shared/src/zod/survey.schema.ts`). `/new` POSTs `name: ''`. Activation gate (`apps/api/src/routes/surveys.ts:179-203`) now returns 422 `MISSING_NAME` / `MISSING_TITLE` if the operator tries to activate without them, so the constraint moves from creation to publication.

### Item V1-017 — Activate modal: stale snapshot + autosave race — ADDRESSED
- **Comment**: "When I tried to Activate a Survey that I had 3 questions in, had set the Survey Title, the Activate modal still said I had 2 questions and error 'Survey title is required before activating'. When I went back to the Surveys list and came back, I could activate the survey."
- **Root cause**: `ActivateModal` received `survey` (the saved snapshot) instead of `liveSurvey`. Auto-save debounce hadn't flushed yet when the operator clicked Activate.
- **Fix**: pass `liveSurvey` to `ActivateModal`. `handleActivateClicked` now awaits `flushPendingChanges()` (a single PATCH with all dirty fields) before opening the modal, so both the modal's gate evaluation and the server-side R23 gate see the same state.

### Item V1-018 — Skip-logic editor missing — ADDRESSED
- **Comment**: "I don't see Skip question option. Is it because no logic wired up in Survey-Builder or something else?"
- **Fix**: added a Skip-logic section to the right rail of each question. Source-question selector + 10 operators (`eq`, `ne`, `gt`, `lt`, `gte`, `lte`, `contains`, `not_contains`, `is_empty`, `is_not_empty`) + AND/OR logic for multi-condition rules. Stores to `question.skipRules` per `SkipRuleSchema` in `packages/shared/src/zod/survey.schema.ts:22-27`. The renderer (`shouldShowQuestion` in `apps/web/src/components/survey-form/skip-rules.logic.ts`) already consumes this shape.

### Item V1-019 — Theme picker: brand default not pre-selected — ADDRESSED
- **Comment**: "When I come to Look & Feel - Brand Default theme should show selected, as shown in the Mock."
- **First attempt**: assumed `themes[0]` was the default. User pushed back: "How do you guarantee that?"
- **Root cause**: `GET /v1/themes` orders by `createdAt: 'desc'`, so `themes[0]` is the *most recent* theme, not the default. The canonical default is `Brand.defaultThemeId` (schema line 208), returned separately on the `/v1/themes` response.
- **Fix**: threaded `defaultThemeId` through `edit/page.tsx` → `SurveyEditorForm` (now a required prop) → `LookFeelTab`. Preselect order: `survey.themeId ?? defaultThemeId ?? themes[0]?.id`. "Brand default" badge now shows on the card whose id matches `defaultThemeId`.

### Item V1-020 — Rating endpoint labels missing in preview — ADDRESSED
- **Comment**: "The preview doesn't show the Endpoint Labels."
- **Fix**: `QuestionRenderer.tsx` rating case now renders `labels.left` / `labels.right` under the scale (mirrors what slider already did). Buttons + labels share an `inline-flex` wrapper with `justify-content: space-between` so the labels stay anchored under the leftmost / rightmost buttons regardless of viewport width.

### Item V1-021 — Respondent share-link doesn't match preview — ADDRESSED
- **Comment**: "When I use the survey link and open in another tab, the look and feel is nothing like the Preview or my settings. The questions did show up correctly."
- **Root cause**: `apps/web/src/app/survey/[id]/page.tsx` was a 1000-line bespoke renderer that pre-dated Slice 4a's `SurveyFormRenderer`. Editor preview and respondent view diverged in chrome, theme tokens, rating labels, consent rendering, and submit button styling.
- **Fix**: rewrote the respondent page to consume the shared `SurveyFormRenderer`. Preview and live view are now the same component by construction. Public API (`apps/api/src/routes/public.ts:139-185`) expanded to return `title`, `description`, `settings`, `consentMode`, `consentTextOverride`, plus brand `consentMode` / `consentTextDefault` / `termsUrl` / `privacyPolicyUrl` / `memberIdentifierKind`. Added `prefixSlot`, `onSubmit`, `submitLabel`, `submitDisabled`, `consentChecked`, `onConsentCheckedChange`, `errors` props to the renderer for the live-submit path.

### Item V1-022 — "Field not editable in current state" on Active save — ADDRESSED
- **Comment**: "On a Active Survey when I clicked Save changes I got Field not editable in current state."
- **Root cause**: spec §State-transitions line 167 says Pause is for "changing questions on a live survey without losing accumulated responses", but server `FIELD_EDITABILITY.questions` was `s === 'DRAFT'` only — so any dirty question on PAUSED also tripped 409 `FIELD_NOT_EDITABLE_IN_STATE`. Other path: `programId` / `responsePolicy` had no client-side gate, so the operator could dirty them on ACTIVE and Save would 409.
- **Fix**: server allowlist updated to allow `questions` in DRAFT or PAUSED. Client-side mirror at `apps/web/src/app/(admin)/admin/surveys/_helpers/field-editability.ts` drives `disabled` on type cards / program select / response-policy select. `handleSaveCurrentTab` + `flushPendingChanges` filter the PATCH body by `isFieldEditable` so a stale dirty field never reaches the server. Banner on QuestionsTab tells the operator to "Pause this survey to edit questions" on ACTIVE.

### Item V1-023 — Activate button visible on Active/Paused/Stopped — ADDRESSED
- **Comment**: "When Survey is Active, should we still need the Activate button drawing attention?" → "There is no way to activate a Paused or Stopped survey. Row action menu doesn't have Activate by design. It has to exist on the Survey page."
- **Fix**: page-header primary actions are now state-aware:
  - DRAFT → `[Discard draft]` + `[Activate →]`
  - ACTIVE → `[Pause]` + `[Stop]` (Stop confirmed via native dialog)
  - PAUSED → `[Resume →]` + `[Stop]`
  - STOPPED → `[Restart →]`
  Resume / Restart reuse the `ActivateModal` flow (R23 gate). Pause / Stop are direct PATCHes to `/v1/surveys/:id/status`.

### Item V1-024 (C1) — How do users know why disabled fields are locked? — ADDRESSED
- **Comment**: "When editing an active survey, some fields like Survey type are rightfully dimmed. How should we tell the users why they are not available?"
- **Fix**: locked fields (Type, Program, Response policy) get a 🔒 LOCKED amber chip next to the label with a hover tooltip explaining why ("Survey type is locked once the survey leaves Draft. Discard the survey and start a new draft if you need a different type.", etc.) plus a small amber hint below the field.

### Item V1-025 (C2) — Pause button missing on Active edit view — ADDRESSED
- Covered by V1-023.

### Item V1-026 (C3) — Breadcrumb should link to survey detail — ADDRESSED
- **Comment**: "Customers come to Edit thru Surveys > &lt;Survey Name&gt; > Edit. So breadcrumbs should allow going back to &lt;Survey Name&gt; Survey Detail page."
- **Fix**: breadcrumb is now `Surveys → <Survey Name> → Edit`. Survey name links to `/admin/surveys/[id]`. "Edit" is the leaf and unlinked.

### Item V1-027 — Mock-drift sweep: page header / theme picker / chrome toggles / question card chrome — ADDRESSED
- **User instruction**: "I will now only test functionality and trust you to fix the mock to implementation drift after we have all functionality fixed."
- **Fix**: walked the mock end-to-end and closed:
  - Page header (breadcrumb · H1 + status badge · saved indicator · primary actions) above the tab nav per mock §241 lines 533-545. TabHeader is now just the numbered tabs.
  - Internal name + Survey title in a `field-row-2` 2-col layout. Program + Description likewise.
  - Theme picker as color-swatch cards (3 swatches per theme, font tagline, "Brand default" badge).
  - Chrome matrix as a real `<table>` with toggle-switch UI for cells; columns align with header text via natural HTML-table sizing.
  - Question cards with Q1·/Q2·... numbering, grip handle (⠿), duplicate (⎘) action alongside delete (×), and a "+ Add question" dashed tile at the bottom of the canvas.
- **Coaching moment**: captured under `fraim/personalized-employee/learnings/raw/` (slug `mock-drift-is-my-responsibility`).

### Item V1-028 — Chrome toggles unaligned + unreadable when off — ADDRESSED
- **Comment**: "The toggles in Look & Feel for the logo etc are not aligned with the headers and not readable when off. Use the style from mock."
- **Root cause**: prior implementation used CSS-grid columns + `px-3` padding on the toggle `<label>`, which inflated the label width to 56px while the header text "Standalone (link)" sized differently. Off-state track was `bg-gray-300` which barely contrasted against the white card.
- **Fix**: switched to a real `<table>` so HTML's natural column sizing aligns headers and cells. Off-state track changed to `bg-gray-400` for visible contrast.

### Item V1-029 — Rating labels not next to buttons; buttons too far apart on wide screens — ADDRESSED
- **Comment**: "The ratings label appear, but are not next to the buttons they represent. When adjusting make sure that labels don't overlap and the rating buttons don't appear too far apart on wide screens."
- **Fix**: rating buttons sit in an `inline-flex` wrapper (hugs content) inside a `flex justify-flex-start` container. Labels share the same inline wrapper with `justify-content: space-between`, so "left" sits under the leftmost button and "right" under the rightmost — independent of container width.

### Item V1-030 — Submit returns `CONSENT_REQUIRED` even after checking the box — ADDRESSED
- **Comment**: "When I tried to submit a response, I got CONSENT_REQUIRED even after I checked the box to give the consent."
- **Root cause**: the consent checkbox in `SurveyFormRenderer` was uncontrolled. The respondent page never sent `consent: true` in the POST body, and the API requires it when effective consent mode is EXPLICIT (`public.ts:295`).
- **Fix**: added `consentChecked` + `onConsentCheckedChange` props to `SurveyFormRenderer`. Respondent page tracks the state and sends `consent: consentChecked` in the POST body.

### Item V1-031 — Field-level errors on respondent submit invisible — ADDRESSED
- **Comment**: "If I didn't give consent, or I didn't enter required field, then page doesn't submit, but I can't see any errors. My expectation is I see errors below the required fields and am directed to them. If I didn't give consent then I should be shown the error near the checkbox not above as was the earlier experience."
- **Fix**: submit button is always clickable (only blocked while a request is in flight). On click, validate required member-id + required questions + (if EXPLICIT) consent checkbox. Errors render inline next to each control — under the member-id input, under each question card, below the consent checkbox. The first `[data-error]` element scrolls smoothly into view. Each error clears as the operator fixes that field. Top-level banner is reserved for server failures.

### Item V1-032 — Look & Feel "black box" / "second page" / scroll-and-control-broken — ADDRESSED
- **Comment**: "When I select a Theme weirdly a black box appears with a larger scroll bar, the page itself is on top the box with its own scroll bar. ... only after I click any control on the Look & Feel..."
- **Diagnosis**: reproduced with Playwright. Captured `html.scrollHeight = 1106` vs `body.height = 720` — `SurveyEditorForm`'s logical bottom (1146.5) was leaking through `<main>`'s `overflow-y: auto` up to `documentElement.scrollHeight`. Focus auto-scroll then moved `html.scrollTop` to 350 on click, exposing the area below the layout. Globals.css's dark-mode `--background: #0f172a` was the original "black"; after that was locked to white the box was still visible as a contrasting gray. `position: fixed inset-0` on admin-layout broke the sidebar at narrow viewports — reverted.
- **Fix**: constrain `SurveyEditorForm` to `h-full` (sized to `<main>`'s 687px allocation) and move the scroll context to the tabpanel (`flex-1 min-h-0 overflow-y-auto [contain:layout]`). `contain: layout` isolates the LookFeelTab's logical extent so it stops propagating to `documentElement.scrollHeight`. Verified at 1280 wide and 560 narrow viewports — html no longer scrolls, only the tabpanel does, clicks no longer move the page.
- **Adjacent fix**: `globals.css` dark-mode `--background` locked to the light-mode value (the app is not dark-mode-ready — cards are hardcoded `bg-white`).

### Item V1-033 — Duplicate respondent submit → 500 (Internal Server Error) — ADDRESSED
- **Comment**: "When I used the same email as earlier, I get Internal Server Error."
- **Root cause**: Prisma `surveyResponse.create` hit the partial unique index `survey_responses_live_dedup` (migration `20260505000000_survey_import_batch`). The index was added in #262 to "preserve original deduplication behaviour" but it conflicts with `Survey.responsePolicy = 'MULTIPLE'`, documented to "always insert a new row". Also the ONCE-policy path lacked a defensive `try/catch` for the race window between `priorResponse` SELECT and INSERT.
- **User direction**: "errors in Slice 1,2,3,4a,4b all needs to be fixed now. It is one experience we ship. Can't punt issues down."
- **Fix**:
  - New migration `packages/database/prisma/migrations/20260514120000_drop_live_dedup_unique/migration.sql` drops `survey_responses_live_dedup`. Per-policy dedup is enforced in the API handler (ONCE: `priorResponse` SELECT + 409; LATEST_OVERWRITES: update on `priorResponse`; MULTIPLE: plain insert). The non-unique index `survey_responses_surveyId_memberId_idx` is retained for `priorResponse` lookups.
  - Defensive `try/catch` around the create path translates Prisma P2002 into a 409 with `duplicate: true` (handles the millisecond race window for ONCE policy).
  - The existing ONCE 409 path also now sends `duplicate: true` so both routes look identical to the client.
- **Schema comment** at `packages/database/prisma/schema.prisma:779-784` updated to document the change.

---

### Verification

| Gate | Result |
|---|---|
| `pnpm --filter @customerEQ/web typecheck` | clean (0 errors) |
| `pnpm --filter @customerEQ/api typecheck` | clean (0 errors) |
| `pnpm --filter @customerEQ/shared typecheck` | clean (0 errors) |
| Playwright repro at 1280 + 560 viewports (since deleted) | confirmed `html.scrollHeight = 720`, `htmlScrollTop = 0` post-click, single scrollbar (tabpanel) |
| Manual: editor walkthrough on Draft / Paused / Active | user-confirmed during the session |
| Manual: respondent submit (consent, validation, duplicate) | user-confirmed |
| Migration: `prisma migrate deploy` against `customerEQ-postgres` | applied `20260514120000_drop_live_dedup_unique` |

### Resolution commit

All items above land in commit `312ce64` on `feature/336-impl-241-slice-4b-...` (24 files / +2756 / -1325, with 2 new helper files and 1 new migration). Pushed to `origin`.

### Coaching moments captured (Phase 12 corrective-feedback protocol)

Per Phase 12 Step 3 protocol, the following recurring corrective feedback is captured as separate coaching-moment files under `fraim/personalized-employee/learnings/raw/`:

| Slug | Pattern |
|---|---|
| `always-open-html-mocks` | Read `docs/feature-specs/mocks/*.html` directly; never rely on agent-summarized verbiage / icon / layout |
| `silent-scope-removal` | Don't drop documented features (Survey-Builder per-type config) without surfacing the trade-off with rule-cross-reference (project Rule 25c) |
| `fraim-phase11-stay-on-pr` | During Phase 11 / 12 manual verification on an open PR, fix on the same branch — don't propose splitting into follow-up PRs unless the defect is unrelated to the issue |
| `copy-env-from-main-worktree` | Fresh worktrees lack gitignored `.env` files; copy them from the main worktree before `pnpm dev` or the API / worker crash on `DATABASE_URL` |
| `mock-drift-is-my-responsibility` | User tests functionality; closing mock-to-implementation drift is the agent's job — run a self-driven sweep after functional pass, no permission needed |

---

## Phase 12 Round 1 quality findings (`implement-quality`)

Deep code-quality scan of the Round 1 diff (commits `312ce64` + `52549b7` + `b3d4b19` + `5dbcb0c`). Four findings; all Low or Info; one ADDRESSED inline, three accepted with rationale below.

### QUALITY CHECK FAILURE — Q12-001 — `#dc2626` error color hardcoded (3 sites) — Low — ADDRESSED

- **File**: `apps/web/src/components/survey-form/SurveyFormRenderer.tsx:163` (question-error), `:215` (consent-error); `apps/web/src/app/survey/[id]/page.tsx:328` (memberId-error)
- **Finding**: Three near-identical error-line `<p>` elements use the literal color `#dc2626`. The renderer otherwise consumes `--ceq-*` CSS variables; error styling deserves the same indirection so a future theme update can override it.
- **Decision**: Extract a small `<RendererErrorLine>` co-located with `SurveyFormRenderer` and reuse it across all three sites. Color stays at `#dc2626` (project-wide error red — matches `CampaignForm.tsx`, `mystery/[id]/page.tsx`, and the BasicsTab inline-error pattern; introducing a `--ceq-error-color` token would also require a `BrandThemeLite.errorColor` field + a default in every theme, and is out of scope here).
- **Status**: ADDRESSED

### QUALITY CHECK FAILURE — Q12-002 — `QuestionsTab.tsx` exceeds 500-line threshold (1369 lines) — Low — accepted

- **File**: `apps/web/src/app/(admin)/admin/surveys/[id]/edit/components/QuestionsTab.tsx`
- **Finding**: The file contains the main `QuestionsTab` component (~430 lines), 9 per-type config editors (`RangeWithLabels`, `SliderEditor`, `TextEditor`, `OptionsWithOther`, `RankingEditor`, `MatrixEditor`, `LikertEditor`, `ImageChoiceEditor`, `FileUploadEditor`), 4 shared helpers (`SectionHeader`, `NumberField`, `TextField`, `StringListEditor`), plus the `SkipRuleEditor` (V1-018). All helpers are private to `QuestionsTab` — no other consumer.
- **Decision**: Accept. Splitting into 9 + 1 new files for one consumer trades one big-but-cohesive file for a directory tree with no reuse upside. The components are well-named and the file is straightforward to navigate (each `case` in `TypeConfigEditor` points at a single editor). Phase 8 quality already extracted the high-value shared components (`ModalShell`, `parseErrorResponse`); the remaining decomposition would be churn-for-its-own-sake.
- **Status**: Accepted (no fix)

### QUALITY CHECK FAILURE — Q12-003 — `SurveyEditorForm.tsx` exceeds 500-line threshold (715 lines) — Low — accepted

- **File**: `apps/web/src/app/(admin)/admin/surveys/[id]/edit/components/SurveyEditorForm.tsx`
- **Finding**: The file is the editor orchestrator — it owns the page header (V1-027), state-aware primary actions (V1-023), the consent-attestation flow (R10), the autosave-flush logic (V1-017), the field-editability filter wiring (V1-022), and the modal mounts. ~310 lines pre-Round-1, ~715 post-Round-1.
- **Decision**: Accept. The growth is intent-aligned — most lines are JSX for the four state-aware action variants and the breadcrumb + status header. Extracting an `<EditorPageHeader>` component is reasonable but its only consumer is this file and it depends on most of the form's state (status / dirty flags / status-transition handlers). The extraction would create a wide prop-drilled component without isolation benefit.
- **Status**: Accepted (no fix)

### QUALITY CHECK FAILURE — Q12-004 — New `_helpers/` directory placement — Info — accepted

- **Path**: `apps/web/src/app/(admin)/admin/surveys/_helpers/`
- **Files**: `presets.ts` (PRESET_QUESTIONS_NPS / _CSAT / _CES, `isUnchangedPreset`, `freshPresetFor`), `field-editability.ts` (`isFieldEditable`, `FIELD_EDITABILITY`)
- **Finding**: A new helpers directory under the admin surveys route group. Could potentially live in a higher-level shared location (e.g. `packages/shared/src/surveys/`).
- **Decision**: Accept. Both modules are admin-surveys-scoped:
  - `presets.ts` is consumed by `/new/page.tsx` and `BasicsTab.tsx` (both under the admin surveys tree).
  - `field-editability.ts` is the client-side mirror of `apps/api/src/routes/surveys.ts:25-45` and is consumed only by `BasicsTab.tsx` + `SurveyEditorForm.tsx`. Promoting to `packages/shared` would require duplicating the server's allowlist there too, which would create a tight coupling between the API surface and a shared utility package — not a desirable pattern.
- **Status**: Accepted (no fix)

### Action plan — Q12-001 addressed

Extracted `RendererErrorLine` in `apps/web/src/components/survey-form/SurveyFormRenderer.tsx` (co-located, not exported externally — only the 3 sites consume it). Three call sites collapse to a single component invocation each.

### Verification

| Gate | Result |
|---|---|
| `pnpm --filter @customerEQ/web typecheck` | clean |
| `pnpm --filter @customerEQ/web test` | 29 files / 251 tests pass |
| `pnpm test` (full) | 17/17 turbo tasks successful |

---
