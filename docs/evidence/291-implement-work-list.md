# Implementation Work List — Issue #291

Issue: [#291](https://github.com/mathursrus/CustomerEQ/issues/291)
Spec: [`docs/feature-specs/291-brandtheme-surveytheme-split.md`](../feature-specs/291-brandtheme-surveytheme-split.md)
RFC: [`docs/rfcs/291-brandtheme-surveytheme-split.md`](../rfcs/291-brandtheme-surveytheme-split.md)
Architecture: [`docs/architecture/architecture.md`](../architecture/architecture.md) (§3.4 Data Layer — hand-edited migration pattern documented)
Branch: `feature/291-implement-brandtheme-split`

**Issue type**: feature (schema refactor with backfill — not a bug fix)
**PR slicing decision**: single PR (confirmed by reviewer; the schema rename + Prisma client regen forces every consumer to update in lockstep — splitting would create transitional dual-naming).

---

## Validation Requirements

| Requirement | Required? | Notes |
|---|---|---|
| `uiValidationRequired` | **Yes** | Theme editor (`ThemeForm.tsx`), theme list page, public survey renderer all touched. Browser walk + Playwright snapshot per RFC validation plan. |
| `mobileValidationRequired` | **Yes — public survey renderer only** | The respondent-facing `apps/web/src/app/survey/[id]/page.tsx` must work on mobile (real-world respondent flow). Admin theme editor + theme list are desktop-only and exempt from emulator validation. |
| Browser baseline | Chromium (Playwright default) | Per repo convention. |
| Required breakpoints | Mobile (375×667) + desktop (1280×800) for the renderer; desktop only for admin editor. |
| DB validation | **Yes** | `pnpm prisma migrate dev` against Docker-backed Postgres before submit (spec R13). |
| Demo regression | **Yes** | Acme + StarBrew + Diamond surveys must render identically post-migration (RFC validation plan row 6). |
| Cross-package grep clean | **Yes** | `git grep -nE "theme\\.(logoUrl\|brandName\|thankYouMessage\|thankYouRedirectUrl\|showIncentivePoints\|isDefault)"` returns 0 lines (excluding migration backfill SQL). |
| Compliance evidence | GDPR/CCPA/SOC2/PCI-DSS — no PII change | RFC compliance section. Implementation does not introduce new compliance obligations. |
| UI Polish Validation evidence file | `docs/evidence/291-ui-polish-validation.md` | To be authored during implement-validate phase covering the three target journeys (theme editor, theme list set-default, public survey completion for the three demos). |

---

## Implementation Checklist

Mirrors the RFC's §File-level change list; line numbers verified at HEAD (commit `0624932`).

### Schema + migration (R1–R5)

- [ ] **`packages/database/prisma/schema.prisma`** — rename `SurveyTheme` → `BrandTheme`; add `@@map("brand_themes")`; drop 6 columns from BrandTheme (`logoUrl`, `brandName`, `thankYouMessage`, `thankYouRedirectUrl`, `showIncentivePoints`, `isDefault`); add 3 columns to `Survey` (`thankYouMessage String @default("Thank you for your feedback!")`, `thankYouRedirectUrl String?`, `showIncentivePoints Boolean @default(true)`); restore `Brand.defaultThemeId` `@relation("BrandDefaultTheme")`; rename `Brand.surveyThemes` → `Brand.brandThemes` (with relation `"BrandThemes"`); add `Brand.defaultTheme BrandTheme? @relation("BrandDefaultTheme")`; remove drift comment at lines 206–210; verify `Survey.theme BrandTheme?` retargets the renamed type.
- [ ] **`packages/database/prisma/migrations/<ts>_brandtheme_surveytheme_split/migration.sql`** *(NEW)* — generate via `pnpm prisma migrate dev --create-only --name brandtheme_surveytheme_split`, then hand-edit per RFC §Migration to use the 6-block ordering: ADD columns → RENAME table → BACKFILL × 2 → DROP columns × 6 → ADD FK. Include constraint and index renames.

### API + Zod (R6–R8)

- [ ] **`apps/api/src/routes/themes.ts`** — replace `prisma.surveyTheme` → `prisma.brandTheme` (8+ call sites). Rewrite `POST /v1/themes/:id/default` to `prisma.brand.update({ where: { id: brandId }, data: { defaultThemeId: id } })` — drop the `updateMany`-clear + `update`-set sequence. In `POST /v1/themes` and `PATCH /v1/themes/:id`, drop `data.isDefault` handling. In GET responses, derive `isDefault` server-side via `brand.defaultThemeId === theme.id`.
- [ ] **`apps/api/src/routes/surveys.ts`** — accept `thankYouMessage`, `thankYouRedirectUrl`, `showIncentivePoints` from `parse.data` in POST and PATCH; persist on `prisma.survey.create` / `update`. Public survey GET response: include `brand: { name, logoUrl }` in the `select` set so the renderer can read `survey.brand.logoUrl`.
- [ ] **`packages/shared/src/zod/survey.schema.ts`** — `CreateSurveyThemeSchema` / `UpdateSurveyThemeSchema`: drop the 6 fields. `CreateSurveySchema` / `UpdateSurveySchema`: add the 3 thank-you fields with the documented shapes (`z.string().max(500).default(...)`, `z.string().url().nullable().optional()`, `z.boolean().default(true)`).

### Admin UI (R9–R10)

- [ ] **`apps/web/src/components/themes/ThemeForm.tsx`** — drop the `logoUrl` and `brandName` rows from the Brand section (lines 411–430); drop the entire Thank-you section (lines 491–523); drop the form-level `isDefault` checkbox section (lines 525–535); drop the brand-name / logo placeholder render in the preview pane (lines 170–181); drop the thank-you screen preview block (lines 255–264); drop the 6 fields from `ThemeFormInitialData` and `ThemeFormState` interfaces (lines 8–28, 31–52); drop them from `DEFAULT_THEME` literal; pass `isDefaultDerived` as a prop and use it for the in-form "Default" badge. Keep the existing edit-mode "Set as Default" *button*.
- [ ] **`apps/web/src/app/(admin)/admin/settings/themes/page.tsx`** — update `Theme` interface to drop `isDefault`; consume derived `isDefault` from the `GET /v1/themes` response (which now includes `brand.defaultThemeId`); render the badge from the comparison.
- [ ] **`apps/web/src/app/(admin)/admin/settings/themes/[id]/page.tsx`** — pass `isDefaultDerived` prop into `<ThemeForm>` for the view mode.
- [ ] **`apps/web/src/app/(admin)/admin/settings/themes/[id]/edit/page.tsx`** — pass `isDefaultDerived` prop into `<ThemeForm>` for the edit mode.

### Public renderer (R11)

- [ ] **`apps/web/src/app/survey/[id]/page.tsx`** — drop the 5 fields from the `SurveyTheme` TS interface (lines 51–67): `logoUrl`, `brandName`, `thankYouMessage`, `thankYouRedirectUrl`, `showIncentivePoints`. Add to `SurveyData` interface (lines 69–78): `brand: { name; logoUrl?: string }` and the three thank-you fields directly on the survey object. Rebind reads at lines 347 (`survey.thankYouRedirectUrl`), 364 (`survey.showIncentivePoints`), 413 (`survey.thankYouMessage`), 446 (`survey.thankYouRedirectUrl`), 475–479 (`survey.brand.logoUrl`, `survey.brand.name`).

### Tests + seeds (R12)

- [ ] **`packages/shared/src/zod/survey.schema.test.ts`** — drop the 6 fields from theme test fixtures (lines 465, 474, 488–490). Add new tests asserting the survey schemas accept the 3 thank-you fields with their default values.
- [ ] **`apps/web/test/e2e/themes-crud-pattern.spec.ts`** — drop the `thankYouMessage`, `thankYouRedirectUrl`, `showIncentivePoints` lines (lines 37–39) from the test fixture. Test stays — asserts CRUD on the renamed `brandTheme`.
- [ ] **`apps/api/test/integration/themes-templates.test.ts`** — replace `prisma.surveyTheme` → `prisma.brandTheme` (11 sites). Existing assertions on dropped fields removed. Add a small new test asserting `POST /v1/themes/:id/default` writes `Brand.defaultThemeId` (not `theme.isDefault`).
- [ ] **`apps/api/test/integration/themes-291-migration.test.ts`** *(NEW)* — seed Acme + StarBrew + Diamond demos via Prisma; run the migration; assert that survey rows carry backfilled `thankYouMessage` and Diamond's brand has `defaultThemeId` set. Load-bearing test for spec R13.
- [ ] **`apps/web/test/e2e/291-theme-editor-prune.spec.ts`** *(NEW)* — Playwright walks `/admin/settings/themes/new` and `/admin/settings/themes/:id/edit`; asserts the 6 input rows are absent and surrounding chrome unchanged.

### Seed scripts

- [ ] **`examples/acme-coffee-demo/seed-acme.mjs`** — drop `brandName` from the `prisma.surveyTheme.create` call at line 137. Rename `prisma.surveyTheme` → `prisma.brandTheme` (the regenerated Prisma client requires this). Acme has no thank-you customisation; no Survey edits needed.
- [ ] **`scripts/seed-demo.ts`** (StarBrew) — drop `brandName`, `thankYouMessage`, `showIncentivePoints` from the theme `POST /v1/themes` body (lines 151–170). Add `thankYouMessage: 'Thank you for your feedback! Your voice helps us make every cup better.'` + `showIncentivePoints: true` onto each `POST /v1/surveys` call (NPS + CSAT, lines 174–223).
- [ ] **`scripts/seed-demo.mjs`** (Diamond) — drop `brandName`, `thankYouMessage`, `showIncentivePoints`, `isDefault` from theme creation (lines 76–95). Add `thankYouMessage` + `showIncentivePoints` onto each survey create call (lines 102–127). After the theme is created, call `POST /v1/themes/:id/default` to mark it default (replacing `isDefault: true`).
- [ ] **`scripts/seed-demo-rich.mjs`** — re-uses `getThemeId()` (line 296). No theme-create call to update; surveys at line 313 already use the existing theme. Decision: rely on the column defaults (recommended; rich demo is incremental data, not a fresh demo).
- [ ] **`packages/config/src/test-utils/db/seed.ts`** — rename `prisma.surveyTheme` → `prisma.brandTheme` and remove dropped fields from any test-utils theme creation. Move any thank-you values onto corresponding survey creation if present.

### Validation artifacts

- [ ] **`docs/evidence/291-ui-polish-validation.md`** *(NEW)* — UI polish validation report covering: theme editor (no dropped rows visible, layout unchanged), theme list (Default badge backed by FK), public survey completion for Acme NPS / StarBrew NPS / Diamond NPS (DOM byte-identical).
- [ ] **`docs/evidence/291-feature-implementation-evidence.md`** *(NEW)* — implementation evidence with traceability matrix R1–R13 → code changes; security review findings appended in-place per FRAIM phase 6.

---

## Done Definition

A PR is mergeable when **all** of the following hold:

1. All checkboxes above are checked.
2. `pnpm build && pnpm typecheck && pnpm lint && pnpm test:smoke && pnpm test:integration && pnpm test:e2e` all pass locally and in CI.
3. `pnpm prisma migrate dev` applied cleanly against a Docker-backed Postgres seeded with Acme + StarBrew + Diamond.
4. Cross-package grep returns 0 lines for the dropped theme fields (excluding migration backfill SQL).
5. Demo Playwright snapshots are byte-identical to pre-migration captures for the three demos.
6. UI polish validation evidence document captures browser walks and screenshots.
7. Architecture-doc update from spec+design PR is verified intact (`architecture.md` §3.4 fourth bullet present; no further updates anticipated).
8. PR body follows repo convention (no labels needed per PR #290 / #295 precedent), references `Closes #291`.

## Open Questions / Deferred

- None. All decisions resolved at spec/design phases (DR1, DR2, DR3, DR-arch all confirmed).

## Discovered Patterns (for quality-aware implementation)

- **Prisma client regeneration**: `pnpm db:generate` (architecture.md line 472). Required after every schema change to refresh `@prisma/client` types.
- **Migration application**: `pnpm db:migrate` (architecture.md line 473). Project convention.
- **Test infrastructure**: `setupTestDb()` / `getTestPrisma()` / `seedTestDb()` from `packages/config/src/test-utils/db/seed.ts` (architecture.md line 540). The new integration test must use these — no hand-rolled DB harness.
- **Brand-id from JWT**: `request.brandId` (project rule R6). Continues unchanged in routes.
- **Forward-only migrations**: project convention. No down/rollback file.
- **Hand-edited migration pattern**: `prisma migrate dev --create-only` + manual SQL edit, ordered `ADD → BACKFILL → DROP` with renames preceding backfills (architecture.md §3.4, fourth bullet — added in PR #295).

## Pre-execution Checks

- [x] Branch `feature/291-implement-brandtheme-split` created off `origin/main` (commit `0624932`).
- [x] Spec, RFC, architecture.md all in scope and current.
- [x] DR1, DR2, DR3, DR-arch all resolved.
- [ ] `git status` clean before any code changes (to be confirmed at start of implement-code phase).
- [ ] No `package-lock.json` pollution from any prep scripts.
