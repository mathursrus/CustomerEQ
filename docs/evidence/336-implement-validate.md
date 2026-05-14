# Phase 5 — implement-validate — Issue #336

**Issue**: #336 — Slice 4b: full editor (4 tabs) + `/new` Server Component + legacy survey-builder cleanup
**Branch**: `feature/336-impl-241-slice-4b-full-editor-4-tabs-new-server-component-legacy-survey-builder-cleanup`
**Date**: 2026-05-13
**Validator**: Claude (Opus 4.7), this session

This report records the Phase 5 (implement-validate) outcome against the validation requirements in `docs/evidence/336-implement-work-list.md` §F. **Phase 5 surfaced two real Phase 4 bugs** (ConsentAttestationModal not wired + two non-existent API endpoints) that the e2e mocks had masked. Both are fixed in this session.

---

## A. Validation gates run

| # | Gate | Result | Evidence |
|---|---|---|---|
| 1 | Code validation (no `console.log` / `FIXME` / `.only` / `.skip` in Slice 4b code) | ✅ | `grep` over `apps/web/src/app/(admin)/admin/surveys/{[id]/edit,new}/**` — zero matches |
| 2 | `pnpm --filter @customerEQ/web typecheck` | ✅ | clean |
| 3 | `pnpm --filter @customerEQ/web lint` | ✅ | 0 errors, 10 pre-existing warnings (Phase 4 ledger flagged these) |
| 4 | `pnpm --filter @customerEQ/web build` | ✅ | `/admin/surveys/new` = 152 B (Server Component shell); `/admin/surveys/[id]/edit` = 10.8 kB; no `/admin/survey-builder` route in output (legacy deleted) |
| 5 | `pnpm --filter @customerEQ/web test` (vitest) | ✅ | **256 / 256** across 29 files (Phase 4 left 253; +3 new consent-wiring tests added in §B) |
| 6 | `pnpm test:smoke` (repo root) | ⚠️ green but does not exercise `apps/web` | 16 turbo tasks all passed (15 cached + 1 fresh @customerEQ/api: 460/460). Gap: `apps/web` has no `test:smoke` script, so the root alias never exercises web vitest. **Pre-existing**, flagged in Phase 3 work-list §M; will surface in the PR description. |
| 7 | Playwright e2e — `336-survey-editor.spec.ts` + `336-surveys-list.spec.ts` | ✅ | **17 / 17** passed (16 base + 1 mobile-emulator) after Phase 5 fixes |
| 8 | Mobile-emulator validation (work-list §F) | ✅ | New test under `test.use(IPHONE_12_PROFILE)` asserts both `preview-mobile` (375px constraint) and `preview-desktop` mount on the iPhone 12 device profile. Evidence screenshot: `docs/evidence/ui-polish/336/lookfeel-iphone12.png` |
| 9 | API-shape diff vs `apps/api` runtime (work-list §I) | ✅ after fix | Found 2 endpoint mismatches; details in §C |
| 10 | State-aware affordance audit (work-list §F) | ✅ | Table in §D |

---

## B. Bugs surfaced and fixed in Phase 5

### B1. ConsentAttestationModal was never wired into the editor (R10 violation)

**Symptom**: `ConsentAttestationModal.tsx` existed and was unit-tested in isolation, but `SurveyEditorForm.tsx` never imported or rendered it. Selecting a more-permissive consent override (brand=EXPLICIT → IMPLIED_ON_SUBMIT) silently auto-saved through the generic `PATCH /v1/surveys/:id` path. Spec R10 + R23 + work-list JTBD 4 all require the attestation gate.

**Why e2e tests missed it**: The Phase 3 e2e spec asserted the modal appeared after `selectOption` but the implementation never reached that path. The test failed in Phase 5 — first run.

**Fix**: Wired in `SurveyEditorForm.tsx`:
- Lifted `consentMode` + `consentTextOverride` state from `BasicsTab` to the form so the parent owns the gate flow.
- Added `pendingConsent` state + new helpers `handleConsentChange` / `submitConsentAttestation` / `cancelConsentAttestation`.
- Intercept more-permissive overrides via `isMorePermissiveOverride(brand.consentMode, next)`: open the modal instead of triggering autosave.
- On confirm: `patchConsentMode` → dedicated `/v1/surveys/:id/consent-mode` endpoint with `{ consentMode, consentReason, attestedBy }`.
- On cancel: revert dropdown + text override to last attested state (the survey's stored values).
- Threaded `attestedBy` (current user email from Clerk `useUser()`) through `page.tsx` → `SurveyEditorForm`.

**Test coverage added** (SurveyEditorForm.test.tsx):
- More-permissive selection opens modal; no PATCH yet.
- Confirm calls `patchConsentMode` with `{ consentMode, consentReason, attestedBy }`; the generic `/v1/surveys/:id` PATCH never carries `consentMode`.
- Cancel reverts the dropdown to its prior value.

### B2. Editor called two endpoints that don't exist in `apps/api`

**Symptom** (caught by §I static API-shape diff against `apps/api/src/routes/`):
- Editor: `GET /v1/me` → **no such route in apps/api**. The actual brand profile lives at `GET /v1/admin/brand/profile`.
- Editor: `GET /v1/brand-themes` → **no such route**. Themes live at `GET /v1/themes`.

**Why e2e tests missed it**: The Playwright `page.route()` mocks intercepted `**/v1/me` + `**/v1/brand-themes` happily, so the tests passed against an invented contract. In production, both fetches would 404 → brand stays `null` → editor renders the "Survey not found" fallback even on valid surveys.

**Fix** (`page.tsx`):
- `/v1/me` → `/v1/admin/brand/profile` (response shape unchanged from editor's perspective: `{ brand }`).
- `/v1/brand-themes` → `/v1/themes` (response: `{ themes, defaultThemeId }`).
- Updated `page.test.tsx` mocks + `336-survey-editor.spec.ts` mocks to match the actual contract.

### B3. e2e specs vs Phase 4 UI mismatch (Class A bugs)

Phase 3 authored specs against a UI contract that didn't match what Phase 4 actually shipped. Fixed:

| Spec | Was | Now |
|---|---|---|
| `survey-row-menu-${id}` (4 tests) | clicked the popover container | clicks the trigger `survey-row-menu-trigger-${id}` |
| Status / Type chip filter (2 tests) | `getByRole('button', { name: /status/i })` → `getByRole('option', { name: /active/i })` (assumed popover) | `getByTestId('chip-status-ACTIVE')` (flat buttons — actual UI) |
| Discard draft (editor spec) | `getByRole('button', { name: /more.*menu/i })` (no such menu) | `getByTestId('discard-draft-btn')` (DRAFT-only footer button per Phase 4 ledger) → modal confirm via `getByRole('dialog')` scope |
| Consent override | `getByRole('combobox')` + speculative selectOption regex | `getByLabel(/consent mode/i).selectOption('IMPLIED_ON_SUBMIT')` (native `<select>` + value, not label) |
| `+ New survey` redirect (2 tests) | asserted POST + redirect to `/edit?tab=basics` | restricted to `href="/admin/surveys/new"` assertion: the Server Component's server-side `fetch` cannot be intercepted by `page.route()`, so end-to-end POST→redirect requires a real backing API. Comment in spec records the constraint. |

---

## C. API-shape diff details (work-list §I)

Static diff against `apps/api/src/routes/`:

| Endpoint | Status | Notes |
|---|---|---|
| `GET /v1/surveys/:id` | ✅ exists | `apps/api/src/routes/surveys.ts:117` — returns the survey row directly (not wrapped in `{ survey }`). Editor's defensive `'survey' in surveyData` check accepts both shapes. |
| `GET /v1/themes` | ✅ exists | `apps/api/src/routes/themes.ts:7` — returns `{ themes: [...], defaultThemeId }`. Full theme records (color fields the renderer needs). |
| `GET /v1/admin/brand/profile` | ✅ exists | `apps/api/src/routes/admin-brand-profile.ts:128` — returns `{ brand, themes (swatches), memberCount, supportEmail }`. Lazy-upserts the brand row on first call (good for fresh tenants). |
| `GET /v1/programs` | ✅ exists | `apps/api/src/routes/programs.ts:46`. |
| `PATCH /v1/surveys/:id` | ✅ exists | Per-field state-aware allowlist; unknown keys → 422. |
| `PATCH /v1/surveys/:id/status` | ✅ exists | Activation gate: `NO_QUESTIONS` → 422. |
| `PATCH /v1/surveys/:id/consent-mode` | ✅ exists (Slice 2) | Used by the newly-wired ConsentAttestationModal. |
| `DELETE /v1/surveys/:id` | ✅ exists | Used by DiscardDraftModal. |
| ~~`GET /v1/me`~~ | ❌ does not exist | **Replaced** with `/v1/admin/brand/profile`. |
| ~~`GET /v1/brand-themes`~~ | ❌ does not exist | **Replaced** with `/v1/themes`. |

**Fields known-nullable** (work-list §I, confirmed):
- `Survey.settings` — null for fresh drafts. Editor uses `survey.settings?.chromeMatrix` defensive optional chain.
- `Survey.title` — null until Basics tab edit (Slice 1 made it nullable). Editor seeds local state from `survey.title ?? ''`.
- `Survey.consentMode` / `consentTextOverride` / `consentSuppressedAttestedBy` / `consentSuppressedAttestedAt` / `consentReason` — null when no override.
- `Survey.thankYouRedirectUrl` — null for embedded-only flows. Editor handles via optional chain.
- `Brand.termsUrl` — null for brands without Terms URL. ConsentCollectionSubBlock hides Terms toolbar button when null (R12).

---

## D. State-aware affordance audit (work-list §F)

Walked every editor surface in every status. No blocking issues.

| Surface | DRAFT | ACTIVE | PAUSED | STOPPED |
|---|---|---|---|---|
| Inputs | editable | editable | editable | **disabled** |
| Indicator | "Draft" → "Saved · Xs ago" | "Unsaved in <tab>" / "All changes saved" | same as ACTIVE | "Stopped — Restart to edit" |
| Save button | hidden (autosave) | per-tab "Save changes" | per-tab "Save changes" | hidden |
| Activate button | enabled | enabled (R5 persistent) | enabled (R5 persistent) | **disabled** (`TabHeader.tsx:115`) |
| Discard draft footer | visible | hidden | hidden | hidden |
| Header banner | none | "This survey is live. Changes apply immediately on save." | "This survey is paused. Changes will apply on Restart." | none (indicator carries it) |

**Soft callout** (not blocking, no Slice 4b AC):
- "Activate" button label remains the same on ACTIVE/PAUSED even though the action would be a no-op (PATCH `/status` → ACTIVE is idempotent). R5 explicitly mandates persistent visibility across tabs, so the affordance stays. A future slice could relabel to "Status…" or open a status-switch modal when already-ACTIVE.

---

## E. Mobile-emulator validation (work-list §F)

New test in `336-survey-editor.spec.ts`:

```ts
const IPHONE_12_PROFILE = (() => {
  // Lift everything except defaultBrowserType from devices['iPhone 12'] so we
  // emulate the device profile on chromium without forcing a new worker.
  const { defaultBrowserType: _ignored, ...rest } = devices['iPhone 12']
  return rest
})()

test.describe('Mobile-emulator validation — LookFeelTab on iPhone 12', () => {
  test.use(IPHONE_12_PROFILE)
  test('Look & Feel renders Mobile preview (375px) side-by-side with Desktop …', …)
})
```

**Profile**: iPhone 12 (viewport 390×844, deviceScaleFactor 3, isMobile, hasTouch, mobile Safari user agent — minus webkit browser swap).

**Assertions**:
- `preview-mobile` and `preview-desktop` both mount.
- `preview-mobile` carries `data-viewport="mobile"` (375px constraint via `PreviewSurvey`'s `VIEWPORT_MAX_WIDTH`).

**Evidence**: `docs/evidence/ui-polish/336/lookfeel-iphone12.png` (full-page screenshot from a passing run).

---

## F. Test counts after Phase 5

| Suite | Before Phase 5 | After Phase 5 |
|---|---|---|
| `apps/web` vitest | 253 / 253 | **256 / 256** (+3 consent-wiring tests in SurveyEditorForm.test.tsx) |
| Playwright e2e (336 specs) | 7 / 16 | **17 / 17** (16 original + 1 mobile-emulator) |
| `apps/api` smoke | 460 / 460 | 460 / 460 |

---

## G. Files changed in Phase 5

```
apps/web/src/app/(admin)/admin/surveys/[id]/edit/page.tsx
apps/web/src/app/(admin)/admin/surveys/[id]/edit/components/SurveyEditorForm.tsx
apps/web/src/app/(admin)/admin/surveys/[id]/edit/components/SurveyEditorForm.test.tsx
apps/web/src/app/(admin)/admin/surveys/[id]/edit/components/BasicsTab.tsx
apps/web/src/app/(admin)/admin/surveys/[id]/edit/page.test.tsx
apps/web/test/e2e/336-survey-editor.spec.ts
apps/web/test/e2e/336-surveys-list.spec.ts
docs/evidence/336-implement-validate.md  (this file)
docs/evidence/ui-polish/336/lookfeel-iphone12.png  (mobile-emulator screenshot)
```

---

## H. Phase ledger update

| Phase | Status |
|---|---|
| 1 — implement-scoping | Complete |
| 2 — implement-repro | N/A (feature, not bug) |
| 3 — implement-tests | Complete |
| 4 — implement-code | Complete |
| 5 — implement-validate | **Complete (this report)** |
| 6 — implement-security-review | Next |

---

## I. Lessons for future slices

1. **E2E mocks can hide real endpoint contracts**. The `/v1/me` + `/v1/brand-themes` 404 in production was masked by `page.route()` returning `200 { brand: ... }`. Phase 5's static API-shape diff against the actual `apps/api` route handlers caught it. **Always diff against the real route source, not the test mock.** (Adds to validated-pattern: "API-shape diff at Phase 5 is load-bearing.")
2. **Component-existence ≠ component-wiring**. `ConsentAttestationModal` shipped with full RTL coverage but no consumer. The unit-test layer alone cannot prove a modal is reachable. Phase 5 e2e is the gate that surfaces this. (Confirms work-list §F gate item.)
3. **Phase 3 speculation drifts from Phase 4 reality**. Six of nine first-run Playwright failures were spec bugs (wrong test IDs, wrong query patterns) — Phase 3 authored against an imagined UI, Phase 4 settled the actual one. Future slices: write the e2e _scaffold_ in Phase 3 but finalize selectors after the implementing PR's first build.
