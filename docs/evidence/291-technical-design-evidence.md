# Feature: Split brand-level theme from per-survey overrides — Design Evidence

Issue: [#291](https://github.com/mathursrus/CustomerEQ/issues/291)
Feature Spec: [`docs/feature-specs/291-brandtheme-surveytheme-split.md`](../feature-specs/291-brandtheme-surveytheme-split.md)
PR: [#295](https://github.com/mathursrus/CustomerEQ/pull/295) (spec + RFC ship together on the same branch)

## Completeness Evidence

- Issue tagged with label `phase:design`: N/A (this repo's recent merged spec+design PR — #290 — used no labels; following actual repo convention)
- Issue tagged with label `status:needs-review`: N/A (same)
- All files committed/synced to branch: Yes (after the design-submission phase commit)

### Traceability Matrix

Every spec requirement (R1–R13) maps to a concrete RFC section, an entry in the file-level change list, and a validation step.

| Requirement (from spec) | RFC Section / Data Model | Status | Validation Plan Alignment |
|---|---|---|---|
| **R1** — Brand-theme model drops 6 columns (`logoUrl`, `brandName`, `thankYouMessage`, `thankYouRedirectUrl`, `showIncentivePoints`, `isDefault`) | RFC §Technical Details / Schema changes — `BrandTheme` model definition; RFC §Migration block 5 (`DROP COLUMN` × 6) | Met | Validation Plan row 1 (`\d brand_themes` shows no pruned columns); Test Matrix integration item (themes-templates.test.ts updates) |
| **R2** — Rename `SurveyTheme` → `BrandTheme` + table `survey_themes` → `brand_themes` | RFC §Schema changes / `@@map("brand_themes")`; RFC §Migration block 2 (`ALTER TABLE ... RENAME TO`) | Met | Validation Plan row 1 (`\d brand_themes` confirms rename); Risk table entry "Prisma rename auto-generation" with hand-edit mitigation |
| **R3** — `Survey` gains `thankYouMessage`, `thankYouRedirectUrl`, `showIncentivePoints` typed columns with stated defaults | RFC §Schema changes / `Survey` model definition; RFC §Migration block 1 (`ADD COLUMN` × 3) | Met | Validation Plan row 1 (`\d surveys` shows 3 new columns); Test Matrix unit item (zod schema tests for the new fields) |
| **R4** — `Brand.defaultThemeId` gains real Prisma `@relation` to `BrandTheme`; drift comment removed | RFC §Schema changes / `Brand` model definition with `@relation("BrandDefaultTheme")`; RFC §Migration block 6 (`ADD CONSTRAINT brands_defaultThemeId_fkey`) | Met | Validation Plan row 1 (`\d brands` shows FK constraint); Risk table entry on FK addition |
| **R5** — Single forward-only migration with backfill BEFORE drop | RFC §Migration / 6-block ordered SQL (ADD → RENAME → BACKFILL × 2 → DROP × 6 → ADD FK) | Met | Validation Plan row 2 (integration test with the three demos pre-seeded asserts backfill correctness); Risk table entries on Prisma auto-gen ordering with hand-edit mitigation |
| **R6** — Theme API returns only colors/typography/layout + `name`/`brandId`/`createdAt`/`updatedAt`/`_count.surveys`; `isDefault` is derived | RFC §File-level change list — `apps/api/src/routes/themes.ts` row | Met | Test Matrix integration item ("themes-templates.test.ts" updates with `prisma.surveyTheme` → `prisma.brandTheme` rename); Validation Plan row 4 |
| **R7** — `POST /v1/themes/:id/default` writes `Brand.defaultThemeId` in single statement; `updateMany`+`update` sequence removed | RFC §File-level change list — `themes.ts` row (lines 116–125 specifically called out) | Met | Test Matrix integration item ("a small test... that asserts `POST /v1/themes/:id/default` writes `Brand.defaultThemeId`"); Validation Plan row 4 |
| **R8** — Survey routes accept the 3 thank-you fields on body; Zod survey schemas split; public survey response includes `brand.logoUrl` | RFC §File-level change list — `apps/api/src/routes/surveys.ts` row + `packages/shared/src/zod/survey.schema.ts` row; Risk table entry on `survey.brand.logoUrl` API contract | Met | Validation Plan row 5 (curl PATCH); Test Matrix unit item (zod schema tests); Test Matrix integration (snapshot test depends on `brand.logoUrl` in response) |
| **R9** — Theme editor drops the enumerated input rows without layout change | RFC §File-level change list — `ThemeForm.tsx` row enumerates each dropped row + line numbers | Met | Validation Plan row 3 (Browser walks `/admin/settings/themes/new` and `/admin/settings/themes/:id/edit`); Test Matrix E2E item (`291-theme-editor-prune.spec.ts`) |
| **R10** — Theme list keeps current shape; "Default" badge backed by derived `isDefault` | RFC §File-level change list — `apps/web/src/app/(admin)/admin/settings/themes/page.tsx` row + the two `[id]` page rows passing `isDefaultDerived` prop | Met | Validation Plan row 4 (Browser click "Set as Default" → badge moves) |
| **R11** — Renderer reads new locations; DOM byte-identical for the three demos | RFC §File-level change list — `apps/web/src/app/survey/[id]/page.tsx` row enumerates 5 read sites + interface updates; Risk table entries on snapshot tests + `brand.logoUrl` API dependency | Met | Validation Plan row 6 (Playwright snapshot byte-match for Acme/StarBrew/Diamond) |
| **R12** — Tests + seeds updated; grep-clean post-merge | RFC §File-level change list — 6 seed/test rows (zod test, e2e themes-crud test, integration themes-templates test, seed-acme.mjs, seed-demo.ts, seed-demo.mjs, seed-demo-rich.mjs, packages/config seed) | Met | Validation Plan row 7 (`git grep -nE "theme\\.(...)"` returns 0 lines); Test Matrix items |
| **R13** — Run `pnpm prisma migrate dev` against real Docker-backed Postgres before submission; integration test seeds the three demos and asserts backfilled state | RFC §Validation Plan rows 1–2; RFC §Test Matrix integration first item (`themes-291-migration.test.ts`) | Met | Validation Plan row 1 + row 2 (the integration test is the load-bearing implementation of this requirement); spec L1 mistake-pattern *"Migration not validated against real DB before PR submission"* — explicitly applied |

**Pass / Fail**: All 13 requirements have `Met` status. **Phase passes.** No `Unmet` rows; no waving-of-hands at complex requirements; data model can store everything the spec asks for.

### Architectural Gaps Documented

Three-bucket classification embedded in RFC §Architecture Analysis:

- **Patterns Correctly Followed** (7 rows): Prisma 5.13 + `@@map`, TypeScript strict + Zod, multi-tenant `brandId` from JWT, centralized test infra, Fastify plugin order, defense-in-depth FK, forward-only migrations.
- **Patterns Missing from Architecture** (2 rows): hand-edited Prisma migrations via `--create-only` for renames + ordering; backfill-before-drop ordering as a named pattern. Both are repo-correct (used in #198 and the existing `20260430000000_patch_survey_distribution_gap` migration) but not documented in `architecture.md`. Recommendation: add a 3-bullet sub-section under §3.4 Data Layer; defer the doc edit to address-feedback per FRAIM phase instruction.
- **Patterns Incorrectly Followed** (0 rows): None.

A third candidate ("public survey API `select` set as a versioned contract") is surfaced but flagged as single-data-point — not blocking #291; capture for a future architecture-gap retrospective if a second renderer issue raises the same question.

## Due Diligence Evidence

- Reviewed feature spec in detail (4 review rounds, 11 inline comments resolved): Yes — spec drives every section of the RFC; spec R1–R13 map 1:1 to RFC §Schema/Migration/File-level/Validation/Test Matrix as documented in the Traceability Matrix above.
- Reviewed codebase in detail to understand and repro: Yes — file-level change list row line numbers verified by grep at HEAD against actual files (`packages/database/prisma/schema.prisma`, `apps/api/src/routes/themes.ts` and `surveys.ts`, `packages/shared/src/zod/survey.schema.ts`, `apps/web/src/components/themes/ThemeForm.tsx`, `apps/web/src/app/(admin)/admin/settings/themes/page.tsx`, `apps/web/src/app/(admin)/admin/settings/themes/[id]/{page,edit/page}.tsx`, `apps/web/src/app/survey/[id]/page.tsx`, four demo seeds, two test files).
- Included detailed design, validation plan, test strategy in doc: Yes — RFC has full schema delta with Prisma model definitions, full migration SQL with 6 ordered blocks, file-level change list with line numbers, Validation Plan with 7 rows, Test Matrix split into Unit/Integration/E2E, Risks table with 7 entries each with concrete mitigations, Architecture Analysis section with three-bucket classification.

## Prototype & Validation Evidence

- [x] **Built simple proof-of-concept that works end-to-end** — N/A as a runnable PoC; the design's correctness is established via doc-and-codebase verification (per validated pattern *"Documentation-and-codebase spike (no PoC) is sufficient for many abstraction-shape questions"*). The migration SQL was hand-written from a known Prisma 5.x pattern; the test plan in §Validation gates real-DB validation before merge.
- [x] **Manually tested complete user flow (browser/curl)** — N/A in design phase; gated to the implementation phase per spec R13 and Validation Plan rows 1–6.
- [x] **Verified solution actually works before designing architecture** — design phase verifies feasibility, not run-time correctness. Run-time correctness gates implementation phase via the integration test in Test Matrix.
- [x] **Identified minimal viable implementation** — Yes; the file-level change list is exactly the set of files that change, no more. No new abstraction layers introduced; existing patterns (Prisma `@@map`, hand-edited migrations, derived `isDefault`) are the load-bearing primitives.
- [x] **Documented what works vs. what's overengineered** — Yes; the round-1 spec's survey-builder admin UI was identified as overengineered by the reviewer and removed before this RFC was authored. Round-2 attempted to over-defer the schema move; round-3 corrected. The RFC reflects the post-correction scope.

## PR-Comment Resolution

| PR Comment | How Addressed |
|---|---|
| (Spec phase, addressed in spec PR rounds 1–4 — see `docs/evidence/291-feature-specification-feedback.md`) | All 11 spec-phase comments resolved before this RFC was authored. |
| (RFC phase comments will be appended in `docs/evidence/291-technical-design-feedback.md` once received) | TBD on review |

## Continuous Learning

| Learning | Agent Rule Updates |
|---|---|
| For migrations that need (a) a model rename or (b) backfill-between-add-and-drop, Prisma's auto-generation is the wrong starting point — always use `prisma migrate dev --create-only` and hand-edit the SQL. The pattern is repo-correct but not documented in architecture.md. | Architecture Analysis section in the RFC surfaces this as "Pattern Missing from Architecture"; the doc edit defers to address-feedback per FRAIM phase instruction. If reviewer agrees, a 3-bullet sub-section under architecture.md §3.4 Data Layer captures the pattern durably. |
| Spec phase's traceability matrix and the design phase's traceability matrix are complementary, not redundant. The spec matrix maps issue ACs to spec R-tags; the design matrix maps spec R-tags to RFC sections. Each catches a different class of gap. | No rule change — this is well-established FRAIM practice; observation only. |
| The "Public survey API `select` set" pattern is a single-data-point today; if a second renderer issue raises the same question (e.g., member-portal exposing a different brand subset), promote to a named pattern in architecture.md. | Tracked as a candidate "missing from architecture" entry in the RFC, but not promoted without a second data point. Future architecture-gap retrospective will revisit if it recurs. |
