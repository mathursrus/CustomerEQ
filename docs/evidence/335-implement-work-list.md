# Slice 4a — survey-form renderer family + RTL harness + detail page rewrite — Work List

**Issue**: [#335](https://github.com/mathursrus/CustomerEQ/issues/335) (sub-issue of umbrella [#324](https://github.com/mathursrus/CustomerEQ/issues/324))
**Slice**: 4a of 5 for [#241](https://github.com/mathursrus/CustomerEQ/issues/241) (Survey Admin UX)
**Branch**: `feature/241-slice-4a-renderer-detail-page` (branched off `feature/241-slice-3-surveys-list`, since PR #334 is not yet merged into `main`)
**FRAIM session**: `ce957b23-b2b7-4b59-ab31-3607af07d5c4` · job `feature-implementation` · jobId `241-slice-4a-335`

Pre-conditions:
- Slice 1 (PR #326, merged): `BrandTheme` rename, schema deltas, `SurveyStatus.STOPPED` enum, D50 fan-out migration.
- Slice 2 (PR #329 + #333 follow-up, both merged): API surface complete — `PATCH /v1/surveys/:id/status`, `PATCH /v1/surveys/:id/consent-mode`, `POST /v1/surveys/:id/duplicate`, `DELETE /v1/surveys/:id`, audit extensions, `responsePolicy` enforcement.
- Slice 3 (PR #334, open): list-page rewrite + chips + `⋯` menu + vitest unit-test wiring. This branch sits on top of Slice 3 and must keep all Slice 3 tests green.

---

## Goals (verbatim from [#335](https://github.com/mathursrus/CustomerEQ/issues/335))

### Acceptance criteria

- [ ] `/admin/surveys/[id]` renders the 3-section collapsible layout with embedded `<PreviewSurvey>`.
- [ ] Initial chevron expansion follows the spec (`expanded` per section based on `responsesCount`).
- [ ] Each section's toggle state can be overridden by chevron click.
- [ ] All 11 question types render correctly in `<SurveyFormRenderer>` (preview matches spec mocks).
- [ ] RTL harness is wired; `apps/web` has 1 new harness-style test for at least one renderer component.
- [ ] All Slice 3 functionality continues to work (list page, chips, ⋯ menu, Slice-3 tests still pass).
- [ ] `/admin/surveys/[id]/edit` still redirects to legacy survey-builder (unchanged from Slice 3).
- [ ] `/admin/surveys/new` still uses the legacy wizard (unchanged from Slice 3).
- [ ] All local gates pass.
- [ ] CI green on PR.

### Spec / RFC traceability

| Spec / RFC reference | What it dictates | This slice's deliverable |
|---|---|---|
| Spec §7 — Detail page (3 collapsible sections) | Layout, chevron defaults, header chrome | `[id]/page.tsx` rewrite + 4 new section components |
| R26 — three sections in order Distribution / Response / Configuration summary, chevron toggleable | All three sections SHALL be collapsible via the platform-standard `▼` chevron | `<SurveyDetailShell>` + section components |
| R27 — Distribution default `expanded` ⇔ `responsesCount === 0` | "default expanded, default collapsed, admin override" | `<DistributionSection expanded={responsesCount===0} />` + internal `useState(expanded)` |
| R28 — Configuration summary renders actual `<PreviewSurvey>`; default `expanded` ⇔ `responsesCount === 0` | "rendered preview of the survey form … alongside dl summary" | `<ConfigurationSummarySection>` wraps `<PreviewSurvey>` + `<SurveyConfigDl>` |
| R32 — Response default `expanded` ⇔ `responsesCount > 0` (inverse of R27/R28) | Placeholder block in V0; analytics out of scope | `<ResponseSection placeholder />` |
| R31 — `BrandTheme` → CSS-variable contract (`--ceq-*` tokens) | No element falls back to browser defaults for any tokenized property | `SurveyFormRenderer` consumes tokens via CSS custom properties; no hardcoded colors / sizes / fonts |
| RFC §"File tree under apps/web/src/components/survey-form/" | 5 files: `SurveyFormRenderer`, `PreviewSurvey`, `ConsentDisclosure`, `QuestionRenderer`, `MemberIdField` | Created under `apps/web/src/components/survey-form/` |
| RFC §"BrandTheme to Survey element token mapping (R31)" | 15-row token-to-element binding table | Implemented as `theme-to-css-vars.ts` helper + a single shared `.ceq-survey-card` CSS module |

### Explicit OUT OF SCOPE (deferred to later slices)

| Item | Where it goes |
|---|---|
| `/admin/surveys/[id]/edit` rewrite (the 4-tab editor) | **Slice 4b** |
| `/admin/surveys/new` Server Component rewrite (lift from Slice 3 commit `2ffa607`) | **Slice 4b** |
| Editor modals: `ConsentAttestationModal`, `ActivateModal`, `DiscardDraftModal` | **Slice 4b** |
| Deletion of `apps/web/src/app/(admin)/admin/survey-builder/` | **Slice 4b** |
| Deletion of wizard step components (`TriggerStep`, `RuleBuilderStep`, `ReviewLaunchStep`) | **Slice 4b** |
| Standalone respondent page `/survey/[id]` migration to new `SurveyFormRenderer` | **Slice 5** (alongside embed-widget visual-regression gate) |
| Embed widget rewrite in `packages/embed/src/ceq-survey.ts` | **Slice 5** |
| Detail page **Email integration** + **QR code** distribution tiles | **stubs in this slice** — surface the affordance but mark "Coming soon" until a dedicated sub-issue picks them up. Share link + Embed snippet tiles are wired to real values today. |

---

## Constraint Loading (FRAIM phase 1 — checked)

| Source | Constraints carried into this slice |
|---|---|
| `rules/constitution.md` | Truth-first reporting; no hypothesized success; no placeholders / TODOs in committed code |
| `rules/engineering/testing-standards.md` | Test-first for features; full suite must run; no mock data in core paths |
| `rules/engineering/architecture-standards.md` | Clean layering; dependency-injectable surfaces; pattern reuse over new utilities; arch.md update for new patterns |
| `fraim/personalized-employee/rules/project_rules.md` | R4 architecture doc authority · R8 shared test utils (no inline mocks) · R9 P0/P1/P2 coverage · R10 branch convention · R11 / R11a gates must pass · R15 right-level abstraction · R16 full-scope pre-flight · R21 one issue per branch |
| `feedback_fraim_phases_not_optional.md` | Every phase executed in order, deliverables on disk, `seekMentoring` called at every boundary |
| `feedback_admin_list_row_clicks.md` | Honor the platform two-affordance row-click pattern; no extension to PaginatedTable in this slice |

---

## Context Loading

### Issue type
**Feature** (additive admin read-only path; no production-data state changes; no destructive operations). `implement-repro` phase is **N/A** — to be documented explicitly in the evidence doc with the reason.

### Validation strategy classification
Per Spec NFR-A (WCAG 2.1 AA) and NFR-P (perf): **uiValidationRequired = YES** because we are introducing visible admin-facing UI. **mobileValidationRequired = NO** (admin surface, desktop-first per platform convention).

### Architecture context
The repo uses Clean Architecture as documented in `docs/architecture/architecture.md`. Three relevant existing patterns:

| Pattern | Source | Relevance to this slice |
|---|---|---|
| App-router admin pages are client components by default | All current `apps/web/src/app/(admin)/admin/**/page.tsx` use `'use client'` | Detail page rewrite continues client-side rendering (data fetched on mount via `fetch + getAuthToken`). Server Component variant is reserved for Slice 4b's `/new`. |
| RHF + zodResolver + `dirtyFields`-driven section dirty state | `OrganizationSettingsForm.tsx` (lines 174-177) — `SECTION_FIELDS` const map | Reused by Slice 4b for the editor; **not used in 4a** (renderer is read-only / no form submission yet). |
| Modal popovers escape `overflow-x-auto` ancestors via `position: fixed` + `getBoundingClientRect` | `SurveyRowMenu` (Slice 3) | Pattern adopted by the detail-header `More` menu so it doesn't get clipped by surrounding scroll containers. |

### Design standards
**Generic UI baseline** — Tailwind v4 utility classes + existing `apps/web/src/components/ui/*` primitives (`<Modal>`, `<StatusBadge>`, `<PaginatedTable>`). New chevron-collapsible needed because no platform primitive exists.

### Repo paths

- Issue: <https://github.com/mathursrus/CustomerEQ/issues/335>
- Spec: `docs/feature-specs/241-survey-admin-ux.md` §7, R26–R32
- RFC: `docs/rfcs/241-survey-admin-ux.md` §"File tree under apps/web/src/components/survey-form/", §"Detail page", §"BrandTheme to Survey element token mapping (R31)"
- Arch: `docs/architecture/architecture.md` (target for §6 update with new patterns)
- Previous slice work-list: `docs/evidence/331-implement-work-list.md`

---

## Pattern Discovery (FRAIM phase 1 — skill executed)

### Environment / config
- `apps/web/src/lib/config.ts` — `API_URL` constant + `getAuthToken(getToken)` helper. Pattern: every fetch uses `getAuthToken` then sets `Authorization: Bearer ${token}` header. Reused in this slice for the detail-page data load.
- `apps/web/src/lib/config.ts` no `FRONTEND_URL` constant; current detail page computes it as `typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'`. **Will inline the same pattern** in `<DistributionSection>` for the share link.

### Constants inventory
- `QUESTION_TYPES` in `packages/shared/src/zod/survey.schema.ts:5` — array of 11 type strings: `rating`, `text`, `choice`, `multiple_choice`, `checkbox`, `dropdown`, `matrix`, `ranking`, `slider`, `likert`, `image_choice`, `file_upload`. Three legacy types (`rating`, `text`, `choice`) coexist with their successors for backward compatibility — the renderer treats them as full first-class types.
- `SkipRuleSchema` / `SkipConditionSchema` — defined and re-exported. **Used** for skip-rule evaluation in `SurveyFormRenderer`.
- Consent rendering: `packages/consent-text/src/index.ts` exports `renderConsentTextReact(text, options)` — the canonical React renderer. `ConsentDisclosure.tsx` wraps it.
- `BrandTheme` schema field set (R31 contract): `primaryColor`, `secondaryColor`, `backgroundColor`, `textColor`, `buttonColor`, `buttonTextColor`, `accentColor`, `fontFamily`, `headingSize`, `bodySize`, `maxWidth`, `cardStyle`, `borderRadius`, `backgroundImageUrl`. Defaults in `CreateBrandThemeSchema` (`packages/shared/src/zod/survey.schema.ts:190+`).

### Utility functions
- `SENTIMENT.classify()` — sentiment-bucket label. Used only in the **Response section's** legacy analytics, which becomes a placeholder in V0 — therefore **not imported** in the rewrite.
- `relTime()` in `apps/web/src/app/(admin)/admin/surveys/list-page.logic.ts` — relative-time formatter. **Reused** in detail-page header for "Created Xh ago" badge.
- No existing chevron-collapsible primitive in `apps/web/src/components/ui/`. **New `<CollapsibleSection>` lives in `[id]/components/` for now**; if the editor (Slice 4b) reuses it, promote to `ui/`.

### Architectural patterns
- `(admin)/admin/**/page.tsx` — client component shell, `useAuth`, fetch on mount, error/loading states inline.
- `apps/web/src/components/ui/modal.tsx` — pattern for confirm modals (Slice 4b will lean on this; not used in 4a).
- `packages/consent-text/src/renderer.ts:renderConsentTextReact` — already returns a React node tree with `<a>` elements for `{{privacy}}` / `{{terms}}` tokens. No reimplementation.

---

## Resolved Decisions

### D-S4a.1 — Renderer family lives in `apps/web/src/components/survey-form/`

Per RFC §"File tree under apps/web/src/components/survey-form/". Five files: `SurveyFormRenderer.tsx`, `PreviewSurvey.tsx`, `ConsentDisclosure.tsx`, `QuestionRenderer.tsx`, `MemberIdField.tsx`. No additional helpers / hooks at this layer beyond what those files own.

### D-S4a.2 — `SurveyResolved` is local to the renderer, not a shared schema yet

The RFC describes `SurveyResolved` as a renderer input type (survey + answers + brand + theme + channel + viewport). It is **not** in `packages/shared` today. To avoid premature shared-package churn:
- Define `SurveyResolved` (or equivalent `RendererInput`) inline in `apps/web/src/components/survey-form/types.ts`.
- Re-evaluate promotion to `packages/shared` when the embed widget (Slice 5) needs to consume the same shape.

### D-S4a.3 — CSS variable contract via a single style block on the survey card

R31's token-to-element binding is delivered by:
1. A pure helper `theme-to-css-vars.ts` that maps `BrandTheme` → `Record<string, string>` of `--ceq-*` properties.
2. The `<SurveyFormRenderer>` root sets `style={{ ...cssVars }}` on a wrapping `<div className="ceq-survey-card">`.
3. The card and all descendants reference tokens via `var(--ceq-*)` in their inline styles or in a colocated CSS module.

This avoids both **global CSS variable bleed** and the need for a separate stylesheet ship. Hardcoded values for non-tokenized elements (error text, focus outline, hover derivations) match the RFC's "Non-brand-tokenized elements" table.

### D-S4a.4 — Read-only renderer + answers state injection

The renderer accepts a `mode: 'preview' | 'live'` prop. In `'preview'` mode (used by admin detail page + future editor previews), interactive controls are still focusable but submission is a no-op. In `'live'` mode (Slice 5 standalone respondent + embed), controls are wired to a parent-supplied `onChange` callback. **Slice 4a builds both code paths but only exercises `'preview'`** — `'live'` is unit-tested via answers-state propagation but is otherwise dormant until Slice 5 mounts the renderer on the respondent page.

### D-S4a.5 — Edit button in detail header stays on legacy redirect stub

The `Edit` button navigates to `/admin/surveys/[id]/edit`, which already redirects to `/admin/survey-builder?surveyId={id}` (legacy). Slice 4b replaces the redirect stub. **No deletion, no behavior change** in Slice 4a.

### D-S4a.6 — `More` menu in detail header opens state-aware actions

Mirror the `SurveyRowMenu` (Slice 3) shape: `Duplicate / Pause / Stop / Restart / Discard draft / Delete`. Same state × visibility matrix. **Implemented as a thin reuse**: import the pure logic from `SurveyRowMenu`'s `survey-row-menu.logic.ts` to avoid the visibility matrix drifting. The presentational shell is a separate `<SurveyDetailMoreMenu>` because positioning + breakpoint constraints differ from a table row.

### D-S4a.7 — Distribution section: 2 functional + 2 stub tiles in V0

- Share link tile → wired with the same `${origin}/survey/${id}` string used today.
- Embed snippet tile → wired with the same `<script src="${API_URL}/v1/public/surveys/${id}/widget.js"></script>` string used today.
- Email integration tile → renders a "Coming soon — survey email delivery is on the roadmap" placeholder. No button wired. (Linked-out issue to be filed in phase 11 if not already.)
- QR code tile → renders a "Coming soon — QR generator queued under a dedicated sub-issue" placeholder.

Honest stub vs. fabricated affordance — both stubs render visibly so the spec §7 four-tile shape is preserved, but no fake "Generate" button is wired. **This is the only place in Slice 4a where the visible shell exceeds the wired implementation; tests cover both states.**

### D-S4a.8 — RTL harness lives at the `apps/web` package boundary

Per the RFC's prior catch-up commit `013d2fe`, the apps/web vitest config is intentionally pure-logic today. This slice flips that:

- devDeps added to `apps/web/package.json`: `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom`.
- `apps/web/vitest.setup.ts` (new): `import '@testing-library/jest-dom/vitest'`.
- `apps/web/vitest.config.ts`: add `environment: 'jsdom'` + `setupFiles: ['./vitest.setup.ts']`.

This unlocks RTL tests for both the renderer family and the detail-page sections — a precondition for the editor in Slice 4b (auto-save / dirty-state interactions need RTL to validate).

### D-S4a.9 — Question renderer covers all 11 types in a single switch

Per the RFC: `QuestionRenderer.tsx` switches on the 11 type strings. The implementations are intentionally lightweight in V0 (no fancy slider thumb tracking, basic native inputs where possible) — the **visual + token-contract** is the priority, not interaction polish. NFR-A1 keyboard requirement is met by native `<input>` / `<button>` / `<select>` elements with no `tabIndex={-1}` overrides.

### D-S4a.10 — Skip-rule evaluation is a pure helper

`skip-rules.logic.ts` exports `shouldShowQuestion(question, answers): boolean`. The renderer iterates the questions list and calls the helper per question per render. Pure function, fully unit-tested without RTL.

---

## Implementation Checklist (file-by-file)

### A. Renderer family — `apps/web/src/components/survey-form/`

- [ ] `apps/web/src/components/survey-form/types.ts` — NEW. Local types: `SurveyResolved`, `RendererMode`, `RendererInput`, `AnswersState`, `Channel` (`'standalone' | 'embedded'`), `Viewport` (`'desktop' | 'mobile'`).
- [ ] `apps/web/src/components/survey-form/theme-to-css-vars.ts` — NEW. Pure helper: `BrandTheme → Record<string,string>` of `--ceq-*` properties (15 rows per RFC §"BrandTheme to Survey element token mapping").
- [ ] `apps/web/src/components/survey-form/scale-resolvers.ts` — NEW. Pure helpers: `resolveHeadingSize / resolveBodySize / resolveBorderRadius / resolveMaxWidth` returning pixel strings from `sm/md/lg` enums per the RFC scale table.
- [ ] `apps/web/src/components/survey-form/skip-rules.logic.ts` — NEW. Pure helper `shouldShowQuestion(question, answers): boolean` evaluating `SkipRule.action` × `SkipCondition.operator`.
- [ ] `apps/web/src/components/survey-form/SurveyFormRenderer.tsx` — NEW. Pure renderer; consumes `RendererInput` + answers state; wraps in `.ceq-survey-card` with CSS vars applied; renders chrome conditional on `chromeMatrix` per `channel`; maps questions through `<QuestionRenderer>` filtered by skip rules; appends `<ConsentDisclosure>` per R12–R14.
- [ ] `apps/web/src/components/survey-form/PreviewSurvey.tsx` — NEW. Channel/viewport-aware wrapper. Takes `channel + viewport + survey + brand + theme + readOnly`. For Slice 4a all admin previews call this with `mode='preview' readOnly`. Embedded vs. standalone affects `chromeMatrix` projection.
- [ ] `apps/web/src/components/survey-form/ConsentDisclosure.tsx` — NEW. Wraps `renderConsentTextReact()` from `@customerEQ/consent-text`. Resolves the text via `Survey.consentTextOverride ?? Brand.consentTextDefault`. Returns `null` when both are empty per R13.
- [ ] `apps/web/src/components/survey-form/QuestionRenderer.tsx` — NEW. Switch on the 11 types from `QUESTION_TYPES`. Native `<input>` / `<select>` / `<textarea>` elements; selected/unselected visual states honor `--ceq-accent-color` / `--ceq-secondary-color`. `file_upload` renders a disabled placeholder in `'preview'` mode (no real upload from admin previews).
- [ ] `apps/web/src/components/survey-form/MemberIdField.tsx` — NEW. Standalone-only respondent field. Reads `Brand.memberIdentifierKind` (`email` / `phone` / `external_id`). **Built here, but not consumed in Slice 4a** — the admin detail-page preview never renders the member-id field (admin previews are always read-only and skip identification). Wired in Slice 5 when the standalone page migrates.

### B. RTL / jsdom test harness

- [ ] `apps/web/package.json` — MODIFY. Add devDeps: `@testing-library/react ^16.0.0`, `@testing-library/user-event ^14.5.0`, `@testing-library/jest-dom ^6.5.0`, `jsdom ^25.0.0`. Versions chosen to match React 18 + Vitest 1 already pinned in the package.
- [ ] `apps/web/vitest.setup.ts` — NEW. `import '@testing-library/jest-dom/vitest'`.
- [ ] `apps/web/vitest.config.ts` — MODIFY. Add `environment: 'jsdom'` + `setupFiles: ['./vitest.setup.ts']`. The existing `include`/`exclude` and `@/` alias are preserved.

### C. Detail page rewrite — `/admin/surveys/[id]/`

- [ ] `apps/web/src/app/(admin)/admin/surveys/[id]/page.tsx` — REWRITE. Client component. Fetches survey + brand + theme + `responsesCount`; composes the 3 sections inside `<SurveyDetailShell>`. Replaces the 596-line legacy file end-to-end. Legacy `ImportModal` + `LoopMonitor` + response table are **not** ported into V0 — they live with the response analytics work tracked under a sibling sub-issue to #235. (Honest deferral: the existing detail page's response table is a sub-feature that R32's "placeholder" wording explicitly does not replace until that sibling sub-issue ships. Detail page in Slice 4a serves the spec §7 contract; analytics-rich content is a future-slice concern.)
- [ ] `apps/web/src/app/(admin)/admin/surveys/[id]/components/SurveyDetailShell.tsx` — NEW. Header chrome: breadcrumb (`Surveys › <name>`), status pill, audit-trail badge (rendered when `consentMode != null`), `Edit` button (Link), `More` menu (state-aware).
- [ ] `apps/web/src/app/(admin)/admin/surveys/[id]/components/SurveyDetailMoreMenu.tsx` — NEW. Reuses Slice 3's `survey-row-menu.logic.ts` for visibility decisions. Action handlers call the existing PATCH endpoints. Confirm modal for destructive (`Stop`, `Delete`, `Discard draft`).
- [ ] `apps/web/src/app/(admin)/admin/surveys/[id]/components/CollapsibleSection.tsx` — NEW. Generic chevron-toggle wrapper. Props: `title`, `expandedDefault`, `children`. Owns its own state; the `expandedDefault` is the initial value, then chevron toggles freely (R26 / R27 / R28 / R32). Single platform-standard `▼` icon (rotates `-90deg` when collapsed).
- [ ] `apps/web/src/app/(admin)/admin/surveys/[id]/components/DistributionSection.tsx` — NEW. 4 tiles: Share link (Copy), Embed snippet (Copy), Email integration ("Coming soon"), QR code ("Coming soon"). `expandedDefault={responsesCount === 0}`.
- [ ] `apps/web/src/app/(admin)/admin/surveys/[id]/components/ResponseSection.tsx` — NEW. Placeholder block describing what will land in the response-analytics sub-issue. `expandedDefault={responsesCount > 0}` (R32 inverse).
- [ ] `apps/web/src/app/(admin)/admin/surveys/[id]/components/ConfigurationSummarySection.tsx` — NEW. Two-column layout: left = `<PreviewSurvey channel="standalone" viewport="desktop" survey brand theme readOnly />`, right = `<SurveyConfigDl>`. `expandedDefault={responsesCount === 0}`.
- [ ] `apps/web/src/app/(admin)/admin/surveys/[id]/components/SurveyConfigDl.tsx` — NEW. Compact `<dl>` summary: Type · Status · Program · Theme · Consent mode · Response policy · Points-per-completion (text fallback if not configured) · Thank-you copy snippet.
- [ ] `apps/web/src/app/(admin)/admin/surveys/[id]/edit/page.tsx` — **UNCHANGED** (legacy redirect stub — Slice 4b replaces it).

### D. Tests (test-first — write against spec BEFORE implementation; watch fail; then implement)

#### D.1 Pure-logic tests (no RTL needed; run on the existing vitest config)

- [ ] `apps/web/src/components/survey-form/theme-to-css-vars.test.ts` — NEW. Asserts each of the 15 BrandTheme fields maps to its expected `--ceq-*` property. Snapshot the full vars-object for a known input. Asserts `backgroundImageUrl: null → 'none'` and `backgroundImageUrl: 'https://x.png' → 'url(\"https://x.png\")'`.
- [ ] `apps/web/src/components/survey-form/scale-resolvers.test.ts` — NEW. Verifies `sm/md/lg` resolutions for `headingSize` (20/24/32), `bodySize` (14/16/18), `borderRadius` (4/8/16), `maxWidth` (480/640/800).
- [ ] `apps/web/src/components/survey-form/skip-rules.test.ts` — NEW. Verifies `shouldShowQuestion` per `action × operator` cell. All 10 operators × `show`/`hide` action with single-condition + multi-condition `AND`/`OR`.

#### D.2 RTL tests (need jsdom harness)

- [ ] `apps/web/src/components/survey-form/SurveyFormRenderer.test.tsx` — NEW. Renders each of the 11 question types from a fixture survey; asserts the DOM contains a recognizable element per type (rating buttons / textarea / radios / checkboxes / etc.). Asserts consent disclosure renders when text is present and is absent when blank. Asserts skip-hidden questions are absent from the rendered tree.
- [ ] `apps/web/src/components/survey-form/PreviewSurvey.test.tsx` — NEW. Channel switching (standalone shows logo + name + title; embedded honors chromeMatrix). Viewport switching toggles the wrapping div's width class. `readOnly` disables interactive elements (verified via `pointer-events: none` style and / or `disabled` attribute on inputs).
- [ ] `apps/web/src/components/survey-form/ConsentDisclosure.test.tsx` — NEW. Renders the privacy + terms links correctly when both tokens are present; renders only the privacy link when terms is missing; returns null when both override and brand default are empty.
- [ ] `apps/web/src/app/(admin)/admin/surveys/[id]/components/CollapsibleSection.test.tsx` — NEW. Initial expanded honors `expandedDefault`; chevron click toggles; multiple clicks cycle correctly.
- [ ] `apps/web/src/app/(admin)/admin/surveys/[id]/components/DistributionSection.test.tsx` — NEW. Share link tile copies the canonical URL; Embed snippet copies the script tag; Email + QR tiles render "Coming soon" strings; default expanded follows `responsesCount`.
- [ ] `apps/web/src/app/(admin)/admin/surveys/[id]/components/ResponseSection.test.tsx` — NEW. Placeholder copy renders; default collapsed when `responsesCount === 0`, default expanded when `responsesCount > 0`.
- [ ] `apps/web/src/app/(admin)/admin/surveys/[id]/components/ConfigurationSummarySection.test.tsx` — NEW. Renders `<PreviewSurvey>` + `<SurveyConfigDl>` side-by-side; default expanded follows `responsesCount`.
- [ ] `apps/web/src/app/(admin)/admin/surveys/[id]/page.test.tsx` — NEW. Page-level RTL. Mocks `fetch` for `GET /v1/surveys/:id` + `GET /v1/brand-themes/:id`; asserts the three sections render in order; asserts initial chevron state for `responsesCount=0` and `responsesCount>10` fixtures.

#### D.3 Test data / fixtures

- [ ] `apps/web/src/components/survey-form/__fixtures__/survey-all-types.ts` — NEW. A single survey containing one question per type (11 questions) + a representative skip rule. Drives the renderer's "renders all 11" test and the page-level snapshot.
- [ ] `apps/web/src/components/survey-form/__fixtures__/theme-default.ts` — NEW. A `BrandTheme` instance with all 14 fields set to non-default values so `theme-to-css-vars.test.ts` exercises every binding.

### E. Local pre-push gates

- `pnpm typecheck` — must pass (strict TS; no `any` introduced).
- `pnpm lint` — zero errors; pre-existing warnings OK.
- `pnpm build` — Next build green.
- `pnpm test` — full unit suite. New tests must pass; **Slice 3 tests must remain green**.
- `pnpm test:integration` — no API changes in this slice; integration suite expected unchanged. Run anyway to catch incidental breakage.
- `pnpm test:e2e` — Slice 4a doesn't add new e2e cases (responsibility deferred to Slice 5's visual-regression gate). Run existing e2e to confirm no regression.

### F. Architecture doc update (FRAIM phase 10)

`docs/architecture/architecture.md` §6 — add patterns introduced this slice:

| Pattern | Section anchor |
|---|---|
| RTL/jsdom test harness for component behavior | new bullet under §9 (Testing Strategy) and §3.1 (Presentation Layer) |
| CSS-variable contract for theme-driven rendering (no hardcoded colors / sizes / fonts in renderer) | new bullet under §6 (Design Patterns & Principles) |
| Collapsible section chevron primitive (`▼ rotates -90deg`) | new bullet under §6 |
| Renderer family with channel/viewport-aware wrapper + read-only `preview` mode | new bullet under §3.1 |

Optionally also: §3.7 (Embed) — note that `packages/embed`'s self-contained renderer will mirror this family in Slice 5 with a Playwright visual-regression gate.

---

## Validation Requirements

- **`uiValidationRequired`**: **YES** — `/admin/surveys/[id]` admin detail page is rewritten end-to-end.
  - **Target journeys**:
    1. From `/admin/surveys` list, click a survey row → land on `/admin/surveys/[id]`. Three section headers visible in the order Distribution / Response / Configuration summary.
    2. Survey with 0 responses → Distribution expanded, Response collapsed, Configuration summary expanded.
    3. Survey with > 0 responses → Distribution collapsed, Response expanded, Configuration summary collapsed.
    4. Click each chevron → section toggles open / closed independently of the others.
    5. Click `Edit` → navigates to `/admin/surveys/[id]/edit` (still redirects to legacy survey-builder; unchanged from Slice 3).
    6. Click `More` → state-aware menu opens (matches `SurveyRowMenu` visibility per status).
    7. Inside Configuration summary: the embedded `<PreviewSurvey>` renders **all 11 question types** for the all-types fixture survey.
    8. Theme swap (apply a known-distinctive theme to the survey, reload detail page) → every visible token-bound element reflects the new colors / sizes / fonts.
  - **Breakpoints**: 1280 (primary admin viewport) confirmed; 768 spot-check for header chrome wrap; below 768 is out of scope (admin desktop-first).
  - **Browser baseline**: Chromium via Playwright dev (manual click-through during validate phase); production CI gate is the existing `pnpm test:e2e` suite (no new e2e cases added in this slice).
  - **Evidence artifact**: `docs/evidence/335-ui-polish-validation.md` (created in phase 5 — `implement-validate`).
- **`mobileValidationRequired`**: NO. Admin surface.
- **Local pre-push gates** (R11): `pnpm typecheck && pnpm lint && pnpm build && pnpm test && pnpm test:integration` all green.
- **CI on PR**: Build / Lint / Test workflow green; full validate workflow green.

---

## Complexity Assessment

| Surface | New files | Modified files |
|---|---|---|
| Renderer family (A) | 9 (5 components + 4 helpers + types) | 0 |
| RTL harness (B) | 1 (`vitest.setup.ts`) | 2 (`package.json`, `vitest.config.ts`) |
| Detail page (C) | 7 (page rewrite + 6 components) | 0 |
| Tests (D) | 11 (3 logic + 7 RTL + 1 page-level) + 2 fixtures | 0 |
| Architecture doc (F) | 0 | 1 (`docs/architecture/architecture.md`) |

**Total: ~31 new files + ~3 modified.**

The new-file count is high but each file is small (typical: <100 lines; SurveyFormRenderer/QuestionRenderer the largest at ~200 each). Modified-file count (3) is well below the 15-file split threshold. **Single shippable slice — no further phase split needed.** Branched off `feature/241-slice-3-surveys-list` so the diff against `main` reads as Slice 3 + Slice 4a — reviewers should pull the PR against `main` after Slice 3 merges, or against the Slice 3 branch in the interim.

---

## In-flight decisions / open questions deferred to later phases

- **OQ-S4a.1 — Email + QR distribution tiles**: confirmed as stubs in V0 (D-S4a.7). When the email-delivery sub-issue and the QR-code sub-issue exist, wire them in. No blocker for this slice.
- **OQ-S4a.2 — `SurveyConfigDl` content**: spec §7 says "compact text summary on the right (basics / look & feel / points / consent)". V0 ship will surface: Type, Status, Program (name lookup), Theme (name lookup), Consent mode (effective: brand default vs. override), Response policy, Points-per-completion (text or "no points configured"), Thank-you copy (first 80 chars). If reviewer wants more / less, iterate in phase 12 / address-feedback.
- **OQ-S4a.3 — Renderer "answers state" plumbing**: In Slice 4a it is purely component-local (each instance owns its `useState<AnswersState>`); the parent passes initial answers but does not collect anything back. Slice 5 wires the live submit path. Documented in `D-S4a.4`.
- **OQ-S4a.4 — Detail page data source**: V0 loads `GET /v1/surveys/:id` + (for the theme + brand) `GET /v1/brand-themes/:themeId` + `GET /v1/me` (brand identity). If `survey.themeId` is null, fall back to brand default theme (existing path). Phase 4 will confirm endpoint shapes and adjust if needed.

---

## Phase-1 exit (entry to phase 2 / implement-repro or phase 3 / implement-tests)

Phase 1 is complete when:
1. This work-list is on disk and committed locally.
2. `seekMentoring(currentPhase='implement-scoping', status='complete', findings.issueType='feature')` returns Phase-2 guidance.
3. Phase 2 (`implement-repro`) is explicitly marked N/A in this slice (feature, not bug) and the FRAIM mentor advances directly to Phase 3 (`implement-tests`).
