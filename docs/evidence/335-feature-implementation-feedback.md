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

---

## Round 1 Feedback — post-PR-open manual-testing pass

*Received: 2026-05-12 / 2026-05-13 across a single conversational session.*

The original Slice 4a shipped via PR #340, which was auto-closed by GitHub when `gh pr merge 334 --delete-branch` deleted its base branch (see #343 retrospective). PR #353 is the re-submission against `main` as the new base. Once the dev server was brought up against PR #353's head, the user ran a manual-testing pass against `/admin/surveys/[id]` and surfaced the items below. Each was addressed via a commit on PR #353; the audit trail is appended retroactively after the user explicitly flagged Phase-12 Step-4 was being skipped — see coaching moment `fraim/personalized-employee/learnings/raw/manohar.madhira@outlook.com-2026-05-13T00-15-00-engage-fraim-phase-ledger-during-feedback-rounds.md`.

### Comment 1 — ADDRESSED (P0)
- **Author**: manohar.madhira@outlook.com
- **Type**: conversational-session
- **Comment**: *"Loop monitor was supposed to be implemented — found during regression testing (see in Post mortem), but I don't see any loop monitor display section in the page."*
- **Resolution**: Promoted `<LoopMonitor>` to its own always-default-expanded section between Distribution and Response. New `<LoopMonitorSection>` component; Response section reverts to deferred-analytics placeholder body. Spec amended (new **R32b** in §7).
- **Commit**: `03a1786`
- **Status**: ADDRESSED

### Comment 2 — ADDRESSED
- **Author**: manohar.madhira@outlook.com
- **Type**: conversational-session
- **Comment**: *"Distribution, Response, Configuration are each supposed to be collapsible with specific logic which expands automatically and when. I don't see any options to collapse."*
- **Resolution**: Replaced Unicode `▼` with SVG chevron; whole section header now clickable with `hover:bg-gray-50`, focus ring, and a "Show"/"Hide" label suffix. Behavior (open/close, `aria-expanded`) unchanged.
- **Commit**: `03a1786` (CollapsibleSection rewrite)
- **Status**: ADDRESSED

### Comment 3 — ADDRESSED
- **Author**: manohar.madhira@outlook.com
- **Type**: conversational-session
- **Comment**: *"I tried copying the share link and opening in another tab. Got Survey not found. I don't know if it data issue or a bug."*
- **Diagnosis**: `apps/api/src/routes/public.ts:147` filters `where: { id, status: 'ACTIVE' }`. DRAFT surveys 404 publicly by design. The admin tile was showing the URL unconditionally.
- **Resolution**: Added a non-blocking amber banner (new **R33**) inside `DistributionSection` for `status === 'DRAFT'` that explains the link/embed won't respond until activation. Values stay visible so the operator can stage host-page integrations before activation.
- **Commit**: `03a1786`
- **Status**: ADDRESSED

### Comment 4 — ADDRESSED
- **Author**: manohar.madhira@outlook.com
- **Type**: conversational-session
- **Comment**: *"Is generation of QR Code in Slice 4b?"* / *"In hindsight, I think we should not show email integration at this time. When the feature is implemented, we can show it."*
- **Resolution**: Both `StubTile`s for QR code and email integration removed from `DistributionSection`. Section reflows to two tiles (Share link + Embed snippet) until each feature ships under its own sub-issue.
- **Commit**: `03a1786`
- **Status**: ADDRESSED

### Comment 5 — ADDRESSED
- **Author**: manohar.madhira@outlook.com
- **Type**: conversational-session
- **Comment**: *"Configuration summary does not match the Mock — neither in typography, nor in sections. Note that Survey shown should be a preview of customers will see. Can't tell whether it is a preview or something else."*
- **Resolution (preview clarity)**: Added a "Survey preview — what your customers will see" header on the left column and a "Configuration" header on the right of `ConfigurationSummarySection`. The two-header treatment makes the customer-facing preview unambiguous.
- **Resolution (typography)**: Deferred per follow-up user direction in the same session — typography uniformity will be applied platform-wide once more designs converge. Filed under "platform-wide design pass" rather than fixed in this round.
- **Commit**: `03a1786`
- **Status**: ADDRESSED

### Comment 6 — ADDRESSED
- **Author**: manohar.madhira@outlook.com
- **Type**: conversational-session
- **Comment**: *"Embed Link should now have 3 fields that brand should populate: The ID corresponding to the Brand Member Identifier and 2 optional name fields. I don't see that in the link."*
- **Resolution**: Embed snippet now includes `data-survey="{id}"` + a brand-aware identifier attribute (`data-prefill-email` / `data-prefill-phone` / `data-prefill-external-id` per `brand.memberIdentifierKind`) + `data-prefill-first-name` + `data-prefill-last-name` with `{{...}}` placeholder values brands replace via host-side templating. Matches spec R16 A1 contract. New **R34** codifies the surface.
- **Commit**: `03a1786`
- **Status**: ADDRESSED

### Comment 7 — ADDRESSED
- **Author**: manohar.madhira@outlook.com
- **Type**: conversational-session
- **Comment**: *"Configuration section inside Configuration Summary does not match the mock. It is important to keep that UI for this section to correlate with the tabs of the new Survey creator."*
- **Resolution**: Restructured `SurveyConfigDl` from a flat 7-row `<dl>` into four subsections that map 1:1 to the editor's tab structure per spec §2 / R3: **Basics → Questions → Look & Feel → Points & Thank You**. Each subsection has a small `<dl>` with its tab's relevant rows. R28 amended to mandate four subsections in editor-tab order.
- **Commit**: `1ec2c97`
- **Status**: ADDRESSED

### Comment 8 — ADDRESSED (runtime bug from my own code in commit `1ec2c97`)
- **Author**: manohar.madhira@outlook.com
- **Type**: conversational-session (reported runtime error)
- **Comment**: *"Now this Runtime TypeError — Cannot read properties of null (reading 'chromeMatrix') at SurveyConfigDl.tsx:67"*
- **Diagnosis**: Commit `1ec2c97` read `survey.settings.chromeMatrix` unconditionally. The Slice 1/2 API returns `settings: null` for surveys with no custom settings (column is nullable, not seeded with `{}`). The local `SurveyResolved` type declared `settings` as always-present, which diverged from runtime.
- **Resolution**: Optional chain `survey.settings?.chromeMatrix` at the boundary in `SurveyConfigDl`; left the type contract alone for the renderer family (Slice 4b will tighten when settings becomes editor-managed).
- **Commit**: `6d597ac`
- **Status**: ADDRESSED

### Comment 9 — ADDRESSED
- **Author**: manohar.madhira@outlook.com
- **Type**: conversational-session
- **Comment**: *"In fact that is why I was thinking that current 50px border for each section seems too large, but I am not a designer."* (in the context of discussing whether to reorder sections for ACTIVE surveys)
- **Resolution**: Light tighten of `CollapsibleSection` chrome: `px-6 py-4` → `px-5 py-3`, `mb-4` → `mb-3`, `text-base font-semibold` → `text-sm font-semibold` on the `<h2>`. Collapsed section header drops from ~73px to ~52px (≈29% reduction), in line with Stripe / Linear / Vercel section density. Body padding kept at `py-4` so expanded content still has breathing room.
- **Commit**: `6d597ac`
- **Status**: ADDRESSED

### Comment 10 — ADDRESSED
- **Author**: manohar.madhira@outlook.com
- **Type**: conversational-session
- **Comment**: *"Sample data has the type of survey in the name. The Survey type should be shown next to the name (missed in mock as well). Second — the type and the status should have a visual distinguisher (mock showed a bullet, suggest what would appeal). In the Surveys list where is the second line below Survey name coming from? For the brand-health initiative. We should show the same below the Survey name in Detail form."*
- **Resolution**: `SurveyDetailShell` extended with two pieces:
  - **Type pill** rendered next to the survey name. Reuses the list page's TYPE_PILL color mapping (NPS-indigo / CSAT-blue / CES-purple / CUSTOM-slate) in OUTLINED form (border + transparent fill) rather than the list page's solid filled pill. Pairs with the existing solid `<StatusBadge>` for visual distinguishability: same rounded-full footprint, different fill — status is loud (it changes), type is quiet (immutable).
  - **Meta-line** under the `<h1>` surfacing `description · programName` (same shape as the list page's Name-column second line) in `text-sm text-gray-500` with a faded bullet joiner. Renders only when at least one part has content.
- **Spec amendment**: §7 header-chrome description updated to call out the type pill, the meta-line, and the outlined-vs-solid pill treatment requirement.
- **Commit**: `8eadd96`
- **Status**: ADDRESSED

---

## Round 1 — Re-validation Summary

| Gate | Result |
|---|---|
| `pnpm --filter @customerEQ/web typecheck` | 0 errors |
| `pnpm --filter @customerEQ/web lint` | 0 errors (pre-existing warnings only; no new ones from round-1 commits) |
| `pnpm --filter @customerEQ/web test` | 154 / 154 passing (+9 from the Phase-8 baseline of 145) |
| `pnpm test:smoke` (16 packages) | All green |
| `pnpm build` | 12 packages green |
| Manual browser revalidation at `http://localhost:3000/admin/surveys/[id]` | Items 1–3, 5–10 confirmed PASS by the user during the session; item 4 is a deletion with no UI to re-check |

All 10 round-1 items closed. Awaiting CI on PR #353 commit `8eadd96` to land green, then merge.
