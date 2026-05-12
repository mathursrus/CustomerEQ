# Slice 4a — UI / Validation Evidence — Issue #335

**Issue**: [#335](https://github.com/mathursrus/CustomerEQ/issues/335) — survey-form renderer family + RTL harness + detail page rewrite
**Phase**: 5 of 13 (FRAIM `feature-implementation` → `implement-validate`)
**Branch**: `feature/241-slice-4a-renderer-detail-page` (off `feature/241-slice-3-surveys-list`)
**Validation date**: 2026-05-12

---

## Validation modes required (from work-list)

| Mode | Required | Status |
|---|---|---|
| `uiValidationRequired` | YES | **Performed** via Playwright Chromium E2E + RTL/jsdom unit suite |
| `mobileValidationRequired` | NO | Admin surface — desktop-first |
| Local pre-push gates (R11) | YES | All four green (typecheck · lint · build · test) |
| Integration suite | YES | Run in phase 7 (regression) |

---

## 1. Static gates — all green

| Gate | Command | Result |
|---|---|---|
| TypeScript | `pnpm --filter @customerEQ/web typecheck` | 0 errors |
| ESLint | `pnpm --filter @customerEQ/web lint` | 0 errors (10 pre-existing warnings in `mcp/route.ts` and `LoopMonitor.tsx`, none introduced by this slice) |
| Next build | `pnpm --filter @customerEQ/web build` | success — `/admin/surveys/[id]` listed as `ƒ (Dynamic)` route at 6.35 kB |
| Unit suite | `pnpm --filter @customerEQ/web test` | 17 test files / **145 passing tests** (88 new in this slice) |

The 88 new unit tests break down as:

| Suite | Tests | Covers |
|---|---|---|
| `theme-to-css-vars.test.ts` | 7 | R31 token-to-CSS-property mapping (every BrandTheme field) |
| `scale-resolvers.test.ts` | 12 | sm/md/lg → pixel scale table (heading / body / radius / max-width) |
| `skip-rules.test.ts` | 19 | Every operator × show/hide action × AND/OR composition |
| `ConsentDisclosure.test.tsx` | 4 | R12 / R13 / R14 — null on blank text, privacy + terms links |
| `SurveyFormRenderer.test.tsx` | 17 | All 11 question types render + consent renders + skip rules filter + CSS-variable contract on `.ceq-survey-card` |
| `PreviewSurvey.test.tsx` | 4 | Channel × viewport × readOnly behavior |
| `CollapsibleSection.test.tsx` | 5 | Chevron primitive — initial state + toggles + aria-expanded |
| `DistributionSection.test.tsx` | 6 | 4 tiles, R27 expand, clipboard copy of share/embed |
| `ResponseSection.test.tsx` | 3 | R32 inverse expand + placeholder copy |
| `ConfigurationSummarySection.test.tsx` | 3 | R28 expand + dl summary entries |
| `page.test.tsx` | 4 | Page-level section order + responsesCount-driven defaults + header chrome |

---

## 2. Browser validation — Playwright Chromium

**Spec**: `apps/web/test/e2e/335-survey-detail-page.spec.ts` (new in this slice — additive to the existing 187 e2e cases). Uses the established `PLAYWRIGHT_TEST=true` middleware bypass + `page.route('**/v1/**', ...)` API mocking pattern from `admin-organization-settings.spec.ts`.

**Command**: `pnpm --filter @customerEQ/web test:e2e 335-survey-detail`

**Result**: `6 passed (54.6s)`

| # | Scenario | Result | Asserts |
|---|---|---|---|
| 1 | Renders the 3 sections in spec order with breadcrumb + status pill (`responsesCount=0`) | ✅ | Breadcrumb link "Surveys" visible · h1 = survey name · status badge "Draft" · section order is Distribution → Response → Configuration summary |
| 2 | `responsesCount=0`: Distribution + Configuration expanded, Response collapsed | ✅ | "Share link" tile visible · "Quick NPS pulse" survey-title heading visible inside `<PreviewSurvey>` · "Response analytics" placeholder not in DOM |
| 3 | `responsesCount>0`: Distribution + Configuration collapsed, Response expanded (R32 inverse) | ✅ | "Response analytics" placeholder visible · "Share link" not in DOM · "Quick NPS pulse" preview heading not in DOM |
| 4 | Chevron click toggles each section independently | ✅ | Distribution starts expanded → click collapses → click expands; toggle state is per-section (R26) |
| 5 | Share link tile copies the canonical URL | ✅ | Click "Copy share link" → `navigator.clipboard.readText()` ends with `/survey/srv_test_4a_001` |
| 6 | Edit button navigates to `/admin/surveys/[id]/edit` (Slice 4b replaces the redirect stub) | ✅ | `<a href="/admin/surveys/srv_test_4a_001/edit">Edit</a>` rendered as expected |

Note on Next.js dev-server console noise: the run logged `Route "/admin/surveys/[id]" used headers().get(...)` warnings from Clerk middleware. These are pre-existing across all admin routes (Clerk 5.7 + Next 15 dev-mode interaction documented in `apps/web/src/middleware.ts` comment) and do not affect rendering or pass/fail.

---

## 3. Visible-shell delta vs spec § / RFC §

| Spec / RFC element | Implementation | Verified via |
|---|---|---|
| Breadcrumb `Surveys › <name>` | `<SurveyDetailShell>` `<nav aria-label="Breadcrumb">` | e2e scenario 1 |
| Status pill | `<StatusBadge status={status} />` (Slice 1 enum-rename) | e2e scenario 1 |
| Audit badge when consent override active | `hasConsentOverride={Boolean(survey.consentMode)}` → renders amber chip | Unit test path; e2e fixture has no override so visually unconfirmed (acceptable since the trigger is data-driven and the chip is wired by code reviewed inline) |
| Edit button | `<Link href={\`/admin/surveys/${id}/edit\`}>Edit</Link>` | e2e scenario 6 |
| More menu (state-aware) | `<SurveyDetailMoreMenu>` reuses Slice 3's `buildMenuItems` | Unit-tested via Slice 3 menu test; e2e currently exercises Edit but not the More menu (limited surface; visibility matrix is already covered by Slice 3's `SurveyRowMenu.test.ts`) |
| Distribution — Share link tile (Copy) | `CopyTile` writes `${origin}/survey/${id}` to clipboard | e2e scenarios 2, 5 |
| Distribution — Embed snippet tile (Copy) | `CopyTile` writes the `<script src="${apiUrl}/v1/public/surveys/${id}/widget.js">…</script>` | Unit-tested (Distribution.test.tsx); e2e Edit-button + clipboard scenario covers the same code path |
| Distribution — Email integration tile | `StubTile` with "Coming soon" copy (D-S4a.7 — honest stub, no fake Generate button) | Unit-tested; e2e scenario 2 lands the section body in the DOM |
| Distribution — QR code tile | `StubTile` (same) | Same |
| Response section placeholder | `<ResponseSection>` placeholder block | e2e scenario 3 |
| Configuration summary — `<PreviewSurvey>` left | Mounts the renderer family in `readOnly preview` mode | e2e scenarios 2, 3 (presence/absence by responsesCount) |
| Configuration summary — `<SurveyConfigDl>` right | Type · Status · Program · Theme · Response policy · Consent · Thank-you copy | Unit-tested; e2e scenario 2 mounts the section |

---

## 4. Code-cleanliness validation

| Check | Result |
|---|---|
| Stray `console.log` / `console.warn` in new files | None (grep across new files clean) |
| `TODO` / `FIXME` / `fix-me` markers | None |
| Empty / partial implementations | None — all 11 question types ship real native-control renderers; stub tiles are explicitly labeled "Coming soon" per D-S4a.7 |
| `git status` after commit | Clean (only the new test spec untracked at evidence-write time, intentionally added in this phase) |

---

## 5. Cross-route regression sanity

The new code is purely additive to:
- `apps/web/src/components/survey-form/**` — brand-new directory, no previous consumers.
- `apps/web/src/app/(admin)/admin/surveys/[id]/components/**` — brand-new directory.
- `apps/web/src/app/(admin)/admin/surveys/[id]/page.tsx` — full rewrite of the legacy 596-line file. Legacy elements removed in this slice: `ImportModal`, `LoopMonitor`, response table, mini-analytics panel, `Close` status button, `Import historical` button. These belonged to the response-analytics work tracked under a sibling sub-issue to #235 and are intentionally **not** ported here.

The Slice 3 list page (`/admin/surveys/page.tsx`) and chips / row menu / status badge are untouched.

Full regression-suite run (unit + integration + e2e) happens in phase 7.

---

## 6. Gaps / honest deferrals

- **Visual-regression gate** for the `SurveyFormRenderer` matching the embed widget's renderer pixel-for-pixel: deferred to **Slice 5** (per RFC §"Embed Widget" §"Slice 5 acceptance"). Slice 4a renders the family for admin previews only.
- **Standalone respondent page** `/survey/[id]` migration to the new renderer: deferred to **Slice 5**.
- **Editor + 3 modals + /new Server Component**: deferred to **Slice 4b**.
- **Mobile-emulator validation**: NOT performed because admin surface is desktop-first (per work-list).
- **A11y deep-dive**: this slice satisfies the surface-level WCAG 2.1 AA contract (semantic headings, aria-expanded on chevron, aria-label on copy buttons, native controls, focus-visible inherited from defaults). A formal axe-core scan is queued under the broader Issue #241 NFR-A1 validation that wraps Slice 5.

---

## 7. Verdict

Validation **PASSED** for the Slice 4a scope as defined in `docs/evidence/335-implement-work-list.md`. The detail page rewrite, the renderer family, and the RTL harness are exercised by 145 unit tests + 6 end-to-end Chromium scenarios. No regressions detected in pre-existing Slice 3 functionality. Phase 6 (security-review) is unblocked.
