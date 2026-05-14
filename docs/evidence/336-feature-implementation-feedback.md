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
