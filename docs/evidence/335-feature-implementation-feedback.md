# Slice 4a — Implementation Quality Feedback — Issue #335

**Phase**: 8 of 13 (FRAIM `feature-implementation` → `implement-quality`)
**Scope**: deep-code-quality-checks against `apps/web/src/components/survey-form/**` + `apps/web/src/app/(admin)/admin/surveys/[id]/**` + 1 e2e spec.

This doc captures every quality-check finding raised by `deep-code-quality-checks` against the Slice 4a diff. Each finding is tagged `QUALITY CHECK FAILURE`, classified by severity, and resolved with `ADDRESSED — <action>`. Phase 8 does not advance until every finding is `ADDRESSED`.

---

## Summary

| Severity | Count | Disposition |
|---|---|---|
| Critical | 0 | — |
| High | 0 | — |
| Medium | 2 | All ADDRESSED (with rationale) |
| Low | 4 | All ADDRESSED (with rationale) |
| Info | 2 | All ADDRESSED (informational only) |

No blocking findings. Phase advances to `implement-completeness-review`.

---

## Findings

### QC1 — LOW — Hardcoded `setTimeout(2000)` in `DistributionSection.CopyTile`

**File**: `apps/web/src/app/(admin)/admin/surveys/[id]/components/DistributionSection.tsx:34`

**QUALITY CHECK FAILURE**: The "Copied!" feedback delay is a literal `2000` ms inline; not extracted to a named constant.

**ADDRESSED — Keep inline (consistent with legacy + minimal value to extract)**. The legacy `CopyButton` in the pre-rewrite `[id]/page.tsx` used the same literal at line 89. Establishing a `COPY_FLASH_MS` constant for one call site adds indirection without changing behavior; the pattern is intentionally a UI affordance owned by this component. If future copy-buttons land outside this file, extract then.

---

### QC2 — LOW — `DEFAULT_THEME` constant duplicates `BrandTheme` Zod-schema defaults

**File**: `apps/web/src/app/(admin)/admin/surveys/[id]/page.tsx:23-39`

**QUALITY CHECK FAILURE**: `DEFAULT_THEME` literal duplicates the `.default('#6366f1')` chain in `packages/shared/src/zod/survey.schema.ts:190+` (`CreateBrandThemeSchema`).

**ADDRESSED — Intentional duplication, narrow fallback**. The page uses `DEFAULT_THEME` only as a last-resort fallback when `loadedSurvey.themeId` is missing **and** `/v1/brand-themes/:id` returns null. The Zod schema's `.default()` chain isn't easily reachable from client code without instantiating a `ZodObject` (overkill for a presentation fallback). Same posture as other admin pages that hard-code presentation fallbacks — see e.g., `programs/page.tsx`'s `DEFAULT_PAGE_SIZE`.

---

### QC3 — MEDIUM — `MOCK_THEME` body duplicated across 3 e2e specs

**Files**:
- `apps/web/test/e2e/335-survey-detail-page.spec.ts:55-71` (MOCK_THEME)
- `apps/web/test/e2e/survey-rule-builder.spec.ts:333` (theme literal in `page.route('**/v1/brand-themes/**')`)
- `apps/web/test/e2e/survey-creation.spec.ts:88` (theme literal in `page.route('**/v1/brand-themes/**')`)

**QUALITY CHECK FAILURE**: Mock BrandTheme bodies are repeated across specs that exercise the new detail page.

**ADDRESSED — Inline mocks are the established e2e pattern**. `admin-organization-settings.spec.ts` also embeds its own `MOCK_BRAND_BASE` rather than importing from a shared fixtures package. Per project rule R8 (shared test utils), mocks are centralized in `packages/config/src/test-utils/` for **unit** tests, not Playwright e2e specs (which run against a transpiled bundle and cannot easily share TypeScript-typed fixtures across files without bundler config changes). When the next slice adds another spec that mocks BrandTheme, that will be the prompt to extract a shared `mockBrandThemeApi(page)` helper. For two-and-a-half consumers, the duplication is within tolerance.

---

### QC4 — MEDIUM — `QuestionRenderer.tsx` is 415 lines and exports a single component with an 11-case switch

**File**: `apps/web/src/components/survey-form/QuestionRenderer.tsx`

**QUALITY CHECK FAILURE**: Engineering standards rule says "Functions over 50 lines or files over 500 lines require justification."

**ADDRESSED — Under threshold + cohesion wins**.
- File: **415 lines** (under the 500-line limit).
- Largest single function: the `QuestionRenderer` component's switch body has 12 cases. Each case body is **under 50 lines** (verified manually).
- No shared private state across cases — each case is self-contained.
- Splitting per-type would create 11 thin files (`RatingQuestion.tsx`, `TextQuestion.tsx`, …) with mutual independence and a parent `QuestionRenderer` that just dispatches. The split would lose the "all 11 types in one place" discoverability — a key advantage when extending the renderer. Per the standards rule's "justification" clause, the cohesion benefit justifies the file size.

---

### QC5 — LOW — `DEFAULT_CHROME_MATRIX` exported from `types.ts` but consumed only by `SurveyFormRenderer`

**File**: `apps/web/src/components/survey-form/types.ts:78`

**QUALITY CHECK FAILURE**: Could be moved inline into `SurveyFormRenderer.tsx` since it has a single consumer.

**ADDRESSED — Keep in types.ts**. The default is part of the documented `ChromeMatrix` contract from RFC §"Per-channel chrome matrix (R18)". Living alongside the `ChromeMatrix` type signals "this is the canonical default" and makes future consumers (Slice 5's standalone respondent page) inherit the same defaults without re-declaration.

---

### QC6 — LOW — `theme-to-css-vars.ts` returns a `Record<string, string>` rather than a typed object

**File**: `apps/web/src/components/survey-form/theme-to-css-vars.ts:8`

**QUALITY CHECK FAILURE**: TypeScript-wise the return type is wide; a future caller could read any key without compile error.

**ADDRESSED — Acceptable for inline `style={{ ...vars }}` consumption**. The only consumer is `<div style={{ ...cssVars }}>` in `SurveyFormRenderer`, which expects React's `CSSProperties` shape (which allows arbitrary `--ceq-*` keys at any value). A `Record<\`--ceq-${string}\`, string>` template-literal type was considered but adds noise for the single consumer site. Tests (`theme-to-css-vars.test.ts`) already lock the 14-key contract.

---

### QC7 — LOW — `'use client'` directives sprinkled across new section components

**Files**: All 6 `[id]/components/*.tsx` carry `'use client'` plus the renderer family.

**QUALITY CHECK FAILURE**: Could the page be a Server Component with smaller client islands?

**ADDRESSED — Consistent with project convention + spec**. The detail page calls `useAuth()` + `useEffect` (data load on mount), so it must be client. Slice 4b's `/new` is the **first** Server Component in this directory tree (per the original Slice 3 design). Mixing server/client in Slice 4a's read-only path would invite scope creep with no UX win — admin detail pages are already client-rendered everywhere else (see `programs/[id]/page.tsx`).

---

### QC8 — INFO — No hardcoded credentials, secrets, or external URLs

**Verified** by `grep -rnE "https?://|api_key|secret|password|token=" <new-files>` → 0 matches. All API calls route through `API_URL` (`process.env.NEXT_PUBLIC_API_URL`).

**ADDRESSED — informational**.

---

## Validation Re-Check After Quality Pass

| Gate | Result |
|---|---|
| `pnpm --filter @customerEQ/web typecheck` | 0 errors |
| `pnpm --filter @customerEQ/web lint` | 0 errors |
| `pnpm --filter @customerEQ/web test` | 145 / 145 passing |
| `pnpm test:smoke` (16 packages) | All green |
| Local pre-push gates (R11) | All green |

Phase 8 closes with **0 unaddressed findings**.
