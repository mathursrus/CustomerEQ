# Quality Feedback — Issue #292 Slice 4

Branch: `feature/issue-292-org-settings-ui`
Diff: 13 new files (page route + form orchestrator + 6 section components + 2 modal/editor components + shared admin banner + 2 lib files) + 4 modified files (`apps/web/package.json`, `apps/web/src/app/(admin)/layout.tsx`, `docs/feature-specs/277-organization-settings.md`, `docs/rfcs/277-organization-settings.md`) + lockfile.

## Quality Checks

| Check | Status | Notes |
|---|---|---|
| Hardcoded values (URLs / API keys / credentials) | **PASS** | No hardcoded URLs, keys, or credentials. `API_URL` resolves from `process.env.NEXT_PUBLIC_API_URL` with the existing `localhost:4000` dev fallback (matches `apps/web/src/lib/config.ts` convention). `SUPPORT_EMAIL` is consumed from the GET response (resolved server-side from `process.env.SUPPORT_EMAIL` per Slice 3). |
| Magic numbers | **PASS** | The 12-entry `TIMEZONES` and 12-entry `LOCALES` arrays in `DefaultsSection.tsx` are spec-driven (spec §F15 / §F16: "initial set of 12 most common locales for our ICP"). Six `ORG_SIZES` entries match spec §F5 verbatim. The 80-char inner-string cap inside `zConsentText` is owned by `@customerEQ/consent-text`'s `tokens.ts` (R18). The 1-second `getAuthToken` timeout is the existing apps/web convention. |
| Duplicate code | **NOTE (justified)** | The 6 section files share a `<label>...<input>...<helper>` boilerplate. Each section's behaviors are different (radio cards, pill radios, select, textarea-with-toolbar, copy rows), so promoting to a single `<FormField>` component would force one shape across heterogeneous controls. Pattern matches `apps/web/src/components/themes/ThemeForm.tsx` (which inlines its own `ColorInput` / `ChipGroup` per row). Re-evaluate if a 7th similar admin form lands. |
| Missed reusability | **PASS** | `AdminPendingBanner` lands in `apps/web/src/components/admin/` so future settings pages with cross-section required fields can adopt it (R16 — pattern surface for #277.C, future Compliance pages, etc.). `CopyRow` is local to `DeveloperSupportSection` (used only there); promoting now would over-abstract. The Zod schema reuses `zConsentText` from `@customerEQ/consent-text` (R18 single-source-of-truth — verified by grep: `apps/web` imports `zConsentText`, `hasPrivacyToken`, `renderConsentTextReact` from the package; no inline regex or label-rendering logic in the new files). |
| Quality standards compliance (architecture-standards rule) | **PASS** | All exported components have single responsibility. Per-section state lives at the form level (RHF FormProvider); per-component local state limited to UI-only concerns (modal `justification`/`checked`, copy `copied`, page `loading`/`error`). No env vars accessed directly in components — all routed through `apps/web/src/lib/config.ts`. No DI required (Clerk hooks via context match the existing apps/web pattern). |
| Monolithic files | **NOTE (justified)** | `OrganizationSettingsForm.tsx` is ~316 LOC after the dead-code cleanup (see fix below). Single export. The 500-LOC architecture-standards limit is the threshold; ~316 is well under. The orchestrator combines: form-state setup (RHF + Zod resolver), per-section dirty/save/cancel logic, IMPLIED-attestation flip interception, toast/error UX, sticky TOC. Splitting would move the section-list into a separate map without separating concerns that vary independently. Re-examine if a second admin form adopts this same orchestration shape. |
| Overly complex logic | **PASS** | `handleSaveSection` is ~30 LOC sequential (validate-section → build-patch → fetch → reset-dirty → toast). Cyclomatic complexity ≤ 4. `insertToken` in `ConsentTextEditor.tsx` is ~30 LOC (compute insertion + post-render selection placement); complexity ≤ 3. `computePendingItems` in `lib/pendingItems.ts` is pure logic with sequential branches; complexity ≤ 5. Max nesting depth: 3. Max parameters across new functions: 3 (`buildSectionPatch(sectionId, all)`, `confirmImpliedAttestation(att)`). |
| Architecture health (imports + circular deps) | **PASS** | Import graph (verified by inspection): `page.tsx → OrganizationSettingsForm + types`; `OrganizationSettingsForm.tsx → react-hook-form + zod-resolver + clerk-hooks + AdminPendingBanner + sections/* + lib/*`; sections → `react-hook-form` + `clerk-hooks` (where applicable) + `types`; `ConsentTextEditor.tsx → react-hook-form + @customerEQ/consent-text + types`; `AdminPendingBanner.tsx → React only`. No circular dependencies. The new `@hookform/resolvers` and `react-hook-form` deps are listed explicitly; lockfile delta bounded to +28 lines. |
| UI baseline validation | **PASS** | All 14 E2E scenarios drive the real Chromium browser end-to-end (real React, real RHF lifecycle, real Zod, real Clerk JS), exercising layout structure (6 sections), form interaction (per-section dirty/save), modal flow (open-on-flip, confirm-disabled-until-both-inputs, cancel-resets), live consent-text preview (defense-in-depth — no `<script>` in rendered HTML), toolbar token insertion + selection-after-insert UX, sidebar nav + active state, locked-state UI on first paint, banner state transitions. The 21.3 kB / 168 kB First Load JS is in line with adjacent settings pages (`/admin/settings/themes` 1.4 kB; the gap is RHF + zod-resolver + the consent-text package). Mock alignment: indigo-600 primary, gray-* surfaces, amber for warnings — consistent with the spec mock (`docs/feature-specs/mocks/277-organization-settings.html`). |

## QUALITY CHECK FAILURES

**1. Dead code in `handleCancelSection`** (RESOLVED in same phase)

- **Severity**: Minor
- **Initial state**: `OrganizationSettingsForm.tsx:handleCancelSection` declared `const all = methods.getValues()` then immediately wrote `void all` to silence the unused-var warning. The `getValues()` call is not needed — the function only resets the section's fields to `initialValues`.
- **Fix**: Removed the `getValues()` call and the `void all` no-op. The cancel handler now reads cleanly:
  ```ts
  function handleCancelSection(sectionId: SectionId) {
    for (const f of SECTION_FIELDS[sectionId]) {
      methods.setValue(f, initialValues[f] as never, { shouldDirty: false, shouldValidate: false })
    }
    if (sectionId === 's-consent') setPendingAttestation(null)
  }
  ```
- **Evidence**: typecheck 0 errors; lint 0 errors (6 pre-existing warnings in untouched files); 14/14 E2E still passing post-fix (cancel flow exercised by E2E #4b "IMPLIED modal cancellation — no PATCH fires" indirectly via the consent radio reverting).
- **Status**: ADDRESSED.

**2. `OrganizationSettingsForm.tsx` size — ~316 LOC** (DOCUMENTED, not a defect)

- **Severity**: Note (not a failure)
- **Detail**: Single-file orchestrator combining RHF setup, per-section dirty/save/cancel logic, IMPLIED-attestation interception, toast/error UX, sticky TOC.
- **Justification**: Architecture-standards explicitly allows >50-LOC functions / >300-LOC files with justification. The orchestrator's concerns (form-state, section save, modal interception, sticky nav) are unified by the page-level pattern; splitting them into separate orchestrator files would introduce indirection without separating concerns that vary independently. The 500-LOC hard limit is the threshold; ~316 is well within. Re-examine if a sibling admin form (e.g. #277.C sender / reply-to) adopts the same pattern — at that point the per-section save mechanic graduates to a shared `<SectionedAdminForm>` component.
- **Status**: ACCEPTED — documented as a deliberate architectural choice.

**3. Per-section field boilerplate across the 6 section files** (DOCUMENTED, not a defect)

- **Severity**: Note (not a failure)
- **Detail**: Each section repeats a `<label>...<input>...<helper>` JSX shape. Could in principle be extracted to a `<FormField>` component.
- **Justification**: The 6 sections use **heterogeneous controls** — pill radios (orgSize), select (timezone/locale), radio cards (memberIdentifierKind/consentMode), text inputs (name/siteDomain/logoUrl), URL inputs (privacy/terms), textarea-with-toolbar (consentTextDefault), color-swatch radios (defaultThemeId), copy-rows (developer). Promoting to a single `<FormField>` shape would force a one-size-fits-all prop signature across these. R15 ("fix at the right abstraction level") explicitly notes "stay where the variance lives." Pattern consistency: existing apps/web admin forms (`ThemeForm.tsx`, `AlertRuleForm.tsx`, `CampaignForm.tsx`) inline their own per-row primitives. Re-examine if and only if a 7th similar admin form lands AND it shares ≥3 row shapes with these.
- **Status**: ACCEPTED — documented; tracks alongside the post-#241 RHF migration plan in `project_admin_form_lib_rhf.md`.

## Resolution Status

- 1 quality finding raised (dead code in `handleCancelSection`) → **ADDRESSED** in same phase via removal.
- 2 notes logged (orchestrator file size, per-section JSX boilerplate) → **ACCEPTED** with documented justification.
- 0 unresolved findings remain.

Phase 8 outcome: passes; no return to `implement-code` required. Ready for Phase 9 (`implement-completeness-review`).
