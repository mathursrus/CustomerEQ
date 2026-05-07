# Feature: Split brand-level theme from per-survey overrides — RFC

Issue: #291
Owner: Claude (claude-opus-4-7)
Status: draft (phase:design-authoring)
Spec: [`docs/feature-specs/291-brandtheme-surveytheme-split.md`](../feature-specs/291-brandtheme-surveytheme-split.md)

> **Closes:** #291.
> **Blocks:** [#277](https://github.com/mathursrus/CustomerEQ/issues/277) (Organization Settings) — F4 (Look & Feel) explicitly defers the underlying theme model to this RFC.
> **Resolved decisions** (from spec): DR1 = backfill before drop, DR2 = rename in place, DR3 = typed columns directly on `Survey`.

---

## Customer

Two customers. Brand admins (the editor's existing layout doesn't change; six input rows are removed). CustomerEQ engineering (#277 needs `Brand.defaultThemeId` pointing at a stable, brand-shaped theme model). Full customer narrative lives in the spec.

## Customer Problem being solved

`SurveyTheme` carries 6 fields that don't belong on a per-survey-rendering theme. PR #290's RFC was preparing to add `Brand.defaultThemeId → SurveyTheme.id`; shipping that FK locks the schema into a model both reviewers agreed is structurally wrong. #291 prunes the 6 fields, renames `SurveyTheme` → `BrandTheme`, restores the `Brand.defaultThemeId` `@relation`, and adds three typed columns to `Survey` for the per-survey thank-you fields.

## User Experience that will solve the problem

This is a refactor — the visible UX delta is on the admin theme editor (six input rows removed, no layout change) and is byte-for-byte invisible on the public survey-completion page (renderer rebinds to backfilled values; demos render identically). Spec's *Surface 1–4* sections enumerate every visible change. No new admin pages, no new API endpoints, no new screens.

The simpler developer workflow this enables: any future surface that wants the brand's visual identity (member portal header, embedded widget, email template) can read from `Brand` + `BrandTheme` directly, without inheriting per-survey concerns it doesn't need.

## Technical Details

### Schema changes

`packages/database/prisma/schema.prisma` — three model edits in one migration.

**Brand** (lines 193–233): add `@relation` for `defaultThemeId`, remove the drift comment at `:206-210`.

```prisma
model Brand {
  // ...existing fields unchanged...
  defaultThemeId        String?
  defaultTheme          BrandTheme?            @relation("BrandDefaultTheme", fields: [defaultThemeId], references: [id])
  // ...existing fields unchanged...
  brandThemes           BrandTheme[]           @relation("BrandThemes")
  // (was: surveyThemes SurveyTheme[] — relation name updated alongside the model rename)
}
```

**SurveyTheme → BrandTheme** (currently lines 692–730): rename model + table + drop 6 columns + update reverse relations.

```prisma
model BrandTheme {
  id        String  @id @default(cuid())
  brandId   String
  brand     Brand   @relation("BrandThemes", fields: [brandId], references: [id])
  name      String

  // colors (unchanged)
  primaryColor    String @default("#6366f1")
  secondaryColor  String @default("#818cf8")
  backgroundColor String @default("#ffffff")
  textColor       String @default("#111827")
  buttonColor     String @default("#6366f1")
  buttonTextColor String @default("#ffffff")
  accentColor     String @default("#6366f1")

  // typography (unchanged)
  fontFamily  String @default("system-ui")
  headingSize String @default("md")
  bodySize    String @default("md")

  // layout (unchanged)
  backgroundImageUrl String?
  cardStyle          String  @default("shadow")
  borderRadius       String  @default("md")
  maxWidth           String  @default("md")

  surveys            Survey[]
  defaultForBrands   Brand[] @relation("BrandDefaultTheme")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([brandId])
  @@map("brand_themes")
}
```

Dropped fields (per spec R1): `logoUrl`, `brandName`, `thankYouMessage`, `thankYouRedirectUrl`, `showIncentivePoints`, `isDefault`.

**Survey** (lines 599–636): add 3 columns; FK relation renamed alongside the model rename.

```prisma
model Survey {
  // ...existing fields unchanged through line 611...
  themeId            String?
  theme              BrandTheme?     @relation(fields: [themeId], references: [id])  // type renamed
  // ...existing fields unchanged...

  // NEW (#291) — per-survey thank-you copy/routing/toggle
  thankYouMessage     String   @default("Thank you for your feedback!")
  thankYouRedirectUrl String?
  showIncentivePoints Boolean  @default(true)

  // ...existing fields unchanged...
}
```

### Migration

`packages/database/prisma/migrations/<timestamp>_brandtheme_surveytheme_split/migration.sql` — hand-edited (see *Risks & Mitigations* on Prisma rename + ordering).

```sql
-- ── 1. Add new Survey columns (with safe defaults) ─────────────────────────────
ALTER TABLE "surveys"
  ADD COLUMN "thankYouMessage"     TEXT    NOT NULL DEFAULT 'Thank you for your feedback!',
  ADD COLUMN "thankYouRedirectUrl" TEXT,
  ADD COLUMN "showIncentivePoints" BOOLEAN NOT NULL DEFAULT TRUE;

-- ── 2. Rename theme table (preserves row identities and existing FKs) ─────────
ALTER TABLE "survey_themes" RENAME TO "brand_themes";
ALTER TABLE "brand_themes" RENAME CONSTRAINT "survey_themes_pkey" TO "brand_themes_pkey";
ALTER TABLE "brand_themes" RENAME CONSTRAINT "survey_themes_brandId_fkey" TO "brand_themes_brandId_fkey";
ALTER INDEX "survey_themes_brandId_idx" RENAME TO "brand_themes_brandId_idx";

-- The surveys.themeId FK was created against survey_themes(id); after RENAME it
-- silently retargets the renamed table (Postgres tracks FKs by oid, not name).
-- We rename the FK constraint to keep diagnostic tooling aligned with the new table.
ALTER TABLE "surveys" RENAME CONSTRAINT "surveys_themeId_fkey" TO "surveys_themeId_fkey_brand_themes";

-- ── 3. Backfill survey-level columns from theme rows BEFORE drop ──────────────
-- Per-survey thank-you copy/routing/toggle: copy the theme's value onto every
-- survey that points at that theme. (Backfill is unconditional — same number of
-- statements as a guarded backfill, and works whether values are default or
-- custom. The `?? default` semantics in the renderer carry forward unchanged
-- because the column defaults match the previous theme defaults.)
UPDATE "surveys" s
SET "thankYouMessage"     = bt."thankYouMessage",
    "thankYouRedirectUrl" = bt."thankYouRedirectUrl",
    "showIncentivePoints" = bt."showIncentivePoints"
FROM "brand_themes" bt
WHERE s."themeId" = bt."id";

-- ── 4. Backfill Brand.defaultThemeId from any isDefault=TRUE theme row ────────
-- One default per brand. If multiple rows have isDefault=TRUE for a brand
-- (impossible state the boolean shape technically permits), DISTINCT ON picks
-- the most-recently-created — same outcome as the application-layer
-- updateMany-then-update sequence we're removing.
UPDATE "brands" b
SET "defaultThemeId" = bt."id"
FROM (
  SELECT DISTINCT ON ("brandId") "id", "brandId"
  FROM "brand_themes"
  WHERE "isDefault" = TRUE
  ORDER BY "brandId", "createdAt" DESC
) bt
WHERE b."id" = bt."brandId";

-- ── 5. Drop the 6 columns now that values are preserved ───────────────────────
ALTER TABLE "brand_themes"
  DROP COLUMN "logoUrl",
  DROP COLUMN "brandName",
  DROP COLUMN "thankYouMessage",
  DROP COLUMN "thankYouRedirectUrl",
  DROP COLUMN "showIncentivePoints",
  DROP COLUMN "isDefault";

-- ── 6. Add Brand.defaultThemeId FK constraint (the @relation side) ────────────
ALTER TABLE "brands"
  ADD CONSTRAINT "brands_defaultThemeId_fkey"
  FOREIGN KEY ("defaultThemeId") REFERENCES "brand_themes"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
```

The migration is generated via `pnpm prisma migrate dev --create-only --name brandtheme_surveytheme_split` (which gives Prisma's draft) and then hand-edited per the SQL above before running `pnpm prisma migrate dev` to apply it. The hand-edit is necessary because Prisma's auto-generation defaults to DROP+CREATE on model rename and emits column DROP before our backfill UPDATE — both wrong shapes for this migration. See *Risks & Mitigations* below.

### File-level change list

Each row is a "modify" unless marked NEW. Verified by running grep on the actual files at HEAD; no aspirational rows.

| File | Change |
|---|---|
| `packages/database/prisma/schema.prisma` | Rename `SurveyTheme` → `BrandTheme` + `@@map("brand_themes")`; drop 6 columns; add 3 columns on `Survey`; restore `Brand.defaultThemeId` `@relation`; remove drift comment at lines 206–210; rename `Brand.surveyThemes` → `Brand.brandThemes` and add `Brand.defaultTheme` reverse relation. |
| `packages/database/prisma/migrations/<ts>_brandtheme_surveytheme_split/migration.sql` (NEW) | Hand-edited single migration as above. |
| `apps/api/src/routes/themes.ts` | Replace `prisma.surveyTheme` → `prisma.brandTheme` (8 call sites: lines 8, 17, 38, 51, 71, 76, 88, 101, 110, 117, 121); rewrite `POST /v1/themes/:id/default` (lines 105–128) to `prisma.brand.update({ where: { id: brandId }, data: { defaultThemeId: id } })` — drop the `updateMany`-clear + `update`-set sequence; in `POST /v1/themes` and `PATCH /v1/themes/:id`, drop `data.isDefault` handling (lines 31–36); in GET responses, derive `isDefault` server-side via `brand.defaultThemeId === theme.id`. |
| `apps/api/src/routes/surveys.ts` | In `POST /v1/surveys` (line 29) and `PATCH /v1/surveys/:id` (around line 164), accept `thankYouMessage`, `thankYouRedirectUrl`, `showIncentivePoints` from `parse.data` and persist on `prisma.survey.create`/`update`. **Public survey GET response**: include `brand: { name, logoUrl }` in the select set so the renderer can read `survey.brand.logoUrl`. |
| `packages/shared/src/zod/survey.schema.ts` | `CreateSurveyThemeSchema` / `UpdateSurveyThemeSchema` (around lines 100–140): drop `logoUrl`, `brandName`, `thankYouMessage`, `thankYouRedirectUrl`, `showIncentivePoints`, `isDefault`. `CreateSurveySchema` / `UpdateSurveySchema` (around lines 70–90): add the three thank-you fields with the same shapes (`thankYouMessage: z.string().max(500).default(...)`, `thankYouRedirectUrl: z.string().url().nullable().optional()`, `showIncentivePoints: z.boolean().default(true)`). |
| `apps/web/src/components/themes/ThemeForm.tsx` | Drop the `logoUrl` and `brandName` rows from the Brand section (lines 411–430); drop the entire Thank-you section (lines 491–523); drop the form-level `isDefault` checkbox section (lines 525–535); drop `theme.brandName` / `theme.logoUrl` placeholder render in the preview pane (lines 170–181); drop the thank-you screen preview block (lines 255–264); drop the 6 corresponding fields from `ThemeFormInitialData` and `ThemeFormState` interfaces (lines 8–28, 31–52); drop them from `DEFAULT_THEME` literal (lines 54–75); update the in-form "Default" badge data source (lines 386–390) — pass `isDefaultDerived` as a prop from the page that already knows the brand's `defaultThemeId`. The existing edit-mode "Set as Default" *button* (lines 548–556) stays; its `handleSetDefault` (line 359) keeps its existing `POST /v1/themes/:id/default` call (server-side handler is what changed in `themes.ts`). |
| `apps/web/src/app/(admin)/admin/settings/themes/page.tsx` | Update the `Theme` interface (line 8) to drop `isDefault` and rely on a derived value computed from a separate `GET /v1/admin/brand/profile` (or equivalent) that returns `defaultThemeId`. Simplest implementation: have `GET /v1/themes` include `brand.defaultThemeId` in its response payload; the page compares per-row. |
| `apps/web/src/app/(admin)/admin/settings/themes/[id]/page.tsx`, `apps/web/src/app/(admin)/admin/settings/themes/[id]/edit/page.tsx` | Pass `isDefaultDerived` prop (or the brand's `defaultThemeId`) into `<ThemeForm>` so the heading badge renders correctly in view + edit modes. |
| `apps/web/src/app/survey/[id]/page.tsx` | Drop 5 fields from `SurveyTheme` TS interface (lines 51–67): `logoUrl`, `brandName`, `thankYouMessage`, `thankYouRedirectUrl`, `showIncentivePoints`. Add to `SurveyData` interface (lines 69–78): `brand: { name; logoUrl?: string }` and the three thank-you fields directly on the survey object. Rebind reads at lines 347 (`survey.thankYouRedirectUrl`), 364 (`survey.showIncentivePoints`), 413 (`survey.thankYouMessage`), 446 (`survey.thankYouRedirectUrl`), 475–479 (`survey.brand.logoUrl`, `survey.brand.name`). |
| `examples/acme-coffee-demo/seed-acme.mjs` | Drop `brandName` from the `prisma.surveyTheme.create` call at line 137. (Theme creation continues to populate colors/typography only.) Acme has no thank-you customisation; no Survey edits needed. The renamed model means `prisma.surveyTheme` → `prisma.brandTheme`. |
| `scripts/seed-demo.ts` | StarBrew demo (lines 151–170): drop `brandName`, `thankYouMessage`, `showIncentivePoints` from theme `POST /v1/themes`. Add the three thank-you fields onto each `POST /v1/surveys` call (lines 174–223 — NPS + CSAT) — `thankYouMessage: 'Thank you for your feedback! Your voice helps us make every cup better.'`, `showIncentivePoints: true`. |
| `scripts/seed-demo.mjs` | Diamond demo (lines 76–95): same shape — drop `brandName`, `thankYouMessage`, `showIncentivePoints`, `isDefault` from theme creation. Add `thankYouMessage` + `showIncentivePoints` onto each survey create call (lines 102–127). After the theme is created, call `POST /v1/themes/:id/default` to mark it default (replacing the `isDefault: true` shortcut). |
| `scripts/seed-demo-rich.mjs` | Re-uses `getThemeId()` (line 296). No theme-create call to update; surveys at line 313 already use the existing theme. Add `thankYouMessage` / `showIncentivePoints` onto the surveys if the demo wants them — otherwise rely on the column defaults (recommended; rich demo is incremental data, not a fresh demo). |
| `packages/config/src/test-utils/db/seed.ts` | Move any test-utils `surveyTheme.create` call's dropped fields onto its corresponding survey create. Rename `prisma.surveyTheme` → `prisma.brandTheme`. |
| `packages/shared/src/zod/survey.schema.test.ts` | Update create/update tests at lines 318, 354 (themeId references unchanged); update theme schema tests at lines 465, 474, 488–490 to drop the 6 fields from the test fixtures; add new tests asserting that survey schemas accept the three thank-you fields. |
| `apps/web/test/e2e/themes-crud-pattern.spec.ts` | Drop the `thankYouMessage`, `thankYouRedirectUrl`, `showIncentivePoints` lines (lines 37–39) from the test fixture. The test stays — it asserts CRUD patterns on the renamed `brandTheme`. |
| `apps/api/test/integration/themes-templates.test.ts` | Replace `prisma.surveyTheme` → `prisma.brandTheme` at the 11 call sites. The integration test asserts theme CRUD; the dropped fields aren't asserted, so no other edits needed. |

### Failure modes & timeouts

- **Backfill fails midway** (e.g., a theme row with NULL `thankYouMessage` violates the new NOT-NULL Survey column): Postgres migrations run in a transaction by default — the failure rolls the migration back atomically. Recovery: investigate the offending row, fix the data, re-run `prisma migrate dev`. Acceptable for a one-time migration.
- **Concurrent writes during migration**: not a real concern — migrations run on the dev/CI DB before deploy; production deploys take a brief lock during ALTER TABLE statements (Postgres holds an `ACCESS EXCLUSIVE` lock for the duration). The migration's wall-clock cost is bounded by the row count of `surveys` and `brand_themes` (small in this repo's environment).
- **FK constraint timing**: `Brand.defaultThemeId` FK is added AFTER the rename and AFTER the column drops. If FK creation is reordered before the rename, Postgres won't find `brand_themes` (the old name was `survey_themes`). The migration ordering above is correct.
- **No timeouts apply** — this is a one-time schema migration, not a runtime path.

### Telemetry & analytics

No new metrics, logs, or alerts. The existing `pnpm prisma migrate dev` output is the audit record. SOC2 audit-trail concern is satisfied by the migration SQL being a single reviewable diff (spec R5). No `AuditEvent` rows are emitted (this is a one-time schema change, not a runtime mutation).

## Confidence Level

**90/100.**

- High confidence on the schema/migration shape — Prisma 5.13 is the team's standard ORM; the rename + column-drop pattern is well-trodden. The migration's hand-edit step is documented in *Risks & Mitigations* below.
- High confidence on the API/Zod/UI changes — all surfaces enumerated against actual files at HEAD; line numbers verified.
- 10-point uncertainty buffer for two narrow risks: (a) Prisma's draft migration may differ from the hand-edited form in unexpected ways depending on Prisma 5.13's exact rename-detection behavior; (b) the `surveys.themeId` FK constraint may not auto-retarget after `RENAME TO` on the parent table (Postgres docs say it does, but worth verifying with `pnpm prisma migrate dev` against a real DB before submission — covered by spec R13).

## Validation Plan

| User Scenario | Expected outcome | Validation method |
|---|---|---|
| Migration runs cleanly on a fresh Postgres | All 6 SQL blocks apply in order; `\d brand_themes` shows no pruned columns; `\d surveys` shows 3 new columns; `\d brands` shows `defaultThemeId` FK. | `docker compose up -d postgres && pnpm prisma migrate reset && pnpm prisma migrate dev` (DB validation). |
| Migration runs on a DB with the three demos pre-seeded | StarBrew + Diamond surveys carry their customised `thankYouMessage`. Diamond brand's `defaultThemeId` points at its theme. Acme is unchanged. | Integration test seeds Acme + StarBrew + Diamond before migrate, runs migrate, asserts row state (DB validation). |
| Theme editor renders without dropped fields | Browser at `/admin/settings/themes/new` and `/admin/settings/themes/:id/edit` shows Theme Name + Colors + Typography + Layout sections; no Logo URL, Brand Name, Thank-you, or "Set as default theme" checkbox. The "Set as Default" button on edit mode persists. | Playwright + manual browser walk (UI validation). |
| Theme list "Default" badge sources from FK | Click "Set as Default" on a non-default row; badge moves; `Brand.defaultThemeId` in DB matches. | Playwright + DB validation. |
| Survey API persists thank-you fields | `curl -X PATCH /v1/surveys/:id -d '{"thankYouMessage":"X","thankYouRedirectUrl":"https://Y","showIncentivePoints":false}'` returns 200; row reflects values. | API + DB validation. |
| Public survey completion page renders identically for all three demos | Playwright snapshot before vs. after migration: byte-identical DOM for Acme NPS, StarBrew NPS, Diamond NPS completion screens. | Playwright snapshot validation. |
| Cross-package grep clean post-merge | `git grep -nE "theme\\.(logoUrl\|brandName\|thankYouMessage\|thankYouRedirectUrl\|showIncentivePoints\|isDefault)"` (excluding migration backfill SQL) returns 0 lines. | CLI validation. |

## Test Matrix

### Unit (mocking ok)

- **Add**: `packages/shared/src/zod/survey.schema.test.ts` — new tests asserting (a) `CreateSurveyThemeSchema` / `UpdateSurveyThemeSchema` reject the 6 dropped fields when present in the body, (b) `CreateSurveySchema` / `UpdateSurveySchema` accept the 3 thank-you fields with their default values.
- **Modify**: existing tests in the same file — drop the 6 fields from theme test fixtures (lines 465, 474, 488–490).
- **No new test suites needed** — the existing zod test suite covers the shape changes.

### Integration (real DB, mock external services)

- **Add**: `apps/api/test/integration/themes-291-migration.test.ts` (NEW) — seeds Acme + StarBrew + Diamond demos via Prisma, runs the migration, asserts that survey rows carry backfilled `thankYouMessage` and Diamond's brand has `defaultThemeId` set. This is the load-bearing test for spec R13's "migration applies clean against fresh DB."
- **Modify**: `apps/api/test/integration/themes-templates.test.ts` — already covers theme CRUD; the only edits are `prisma.surveyTheme` → `prisma.brandTheme` (11 sites). Existing assertions on dropped fields are removed.
- **Add**: a small test in the same file that asserts `POST /v1/themes/:id/default` writes `Brand.defaultThemeId` (not `theme.isDefault`).

### E2E (1 at most, no mocking)

- **Add**: `apps/web/test/e2e/291-theme-editor-prune.spec.ts` (NEW) — Playwright walks `/admin/settings/themes/new`, asserts the 6 input rows are absent and the surrounding chrome is unchanged. Walks `/admin/settings/themes/:id/edit`, asserts the same. This is the single E2E for the UI prune; respondent-flow snapshot test (Playwright snapshot of completion page DOM) lives in the integration suite per spec R11.

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Prisma `migrate dev` auto-generates a DROP-and-CREATE migration on `SurveyTheme → BrandTheme` rename, losing row identities and breaking the `surveys.themeId` FK. | High (Prisma 5.13 prompts the user, but in CI/non-interactive mode defaults to DROP+CREATE). | Use `prisma migrate dev --create-only --name brandtheme_surveytheme_split`, then **hand-edit** the generated `migration.sql` to use `ALTER TABLE ... RENAME TO` + the backfill UPDATE statements before running `prisma migrate dev` to apply. The migration above documents the exact hand-edited form. |
| The auto-generated migration emits `DROP COLUMN` BEFORE the backfill UPDATE statements, losing the values being backfilled. | Certain (Prisma's draft is purely schema-delta, no UPDATE statements emitted). | Same mitigation — hand-edit the `--create-only` draft. The migration above orders: ADD columns → RENAME → BACKFILL UPDATEs → DROP columns → ADD FK. |
| `surveys.themeId` FK pointing at the renamed table loses validity after `ALTER TABLE survey_themes RENAME TO brand_themes`. | Low (Postgres tracks FKs by oid; the FK auto-retargets to the renamed table). | Verified via `pnpm prisma migrate dev` against a Docker-backed DB before PR submission (spec R13). The constraint is renamed for diagnostic clarity (`surveys_themeId_fkey` → `surveys_themeId_fkey_brand_themes`) but the underlying reference is preserved. |
| `Brand.defaultThemeId` exists in schema today but has no `@relation` (per the drift comment at lines 206–210). Adding the FK constraint may fail if any current `Brand.defaultThemeId` value references a non-existent theme row. | Low (`Brand.defaultThemeId` is currently always NULL — no code path writes it; the column was speculatively added under #277's Round 3 review). | The migration's `UPDATE brands SET defaultThemeId = ...` step (block 4) only writes valid theme IDs (joined from existing `brand_themes` rows). Pre-existing values, if any, are NULL. The FK addition (block 6) succeeds. |
| The renderer's `survey.brand.logoUrl` read assumes the public survey API response includes `brand.logoUrl`. If the response doesn't include it, the demo logos disappear post-migration. | Medium (the public survey route's `select` set is what controls this — needs a deliberate edit). | Spec R8's last bullet adds this to the API contract: "The public survey API response SHALL include `brand.logoUrl`." File-level change list above explicitly enumerates the edit in `apps/api/src/routes/surveys.ts`. Validation Plan's "Public survey completion page" snapshot test catches any regression. |
| Playwright snapshot test catches a 1px DOM difference between pre- and post-migration completion pages for one of the demos. | Low (the renderer rebind reads from the same default values; defaults match). | The snapshot is gated by spec R11 on the three demo surveys — Acme, StarBrew, Diamond — covering all three known consumers. If a 1px diff surfaces, it surfaces during the implementation phase's validation, before merge. |
| Demo seeds need re-running for the migration's backfill behavior to be visible in fresh test environments. | Low (the migration backfills from existing data; demos that haven't been seeded yet pick up the new defaults at seed time). | The seed-script edits (R12) move the three thank-you fields onto the survey-create calls, so any fresh `pnpm db:seed` after this PR lands writes them correctly without relying on the migration. |
| TypeScript compile breaks across consumers when `prisma.surveyTheme` → `prisma.brandTheme`. | Medium (the rename touches 4+ files: themes routes, integration tests, ThemeForm.tsx, seed scripts). | Prisma client regeneration via `pnpm db:generate` produces the new typed client; `pnpm typecheck` surfaces every consumer. The file-level change list above enumerates all known consumers; CI's `pnpm typecheck` step is the safety net. |

## Spike Findings

No spike was run. Two questions surfaced at requirements-analysis:
- *Prisma's behavior on @@map rename* — answered via Prisma 5.x release notes + existing codebase pattern: Prisma's auto-detection prompts the user in interactive mode but defaults to DROP+CREATE in non-interactive contexts. Hand-edit the migration via `--create-only`.
- *Migration ordering for backfill BETWEEN add and drop* — answered the same way: `--create-only` + hand-edit; Prisma never emits UPDATE statements in auto-generation.

Both questions are documentation-and-codebase scope, not PoC scope (per validated pattern *"Documentation-and-codebase spike (no PoC) is sufficient for many abstraction-shape questions"*). Risks captured in the table above; mitigation is concrete (hand-edited migration, validated against a real DB before submission per spec R13).

## Observability

No new logs, metrics, or alerts. The migration's success/failure is visible via `pnpm prisma migrate dev` output and the `_prisma_migrations` table. No runtime observability changes.

## Design Standards Applied

- Source: `docs/architecture/architecture.md` (authoritative tech / pattern decisions).
- **Prisma 5.13 ORM, multi-tenant `brandId` from JWT, BullMQ for async actions** — patterns followed unchanged. No new architectural decisions.
- **Centralized test infrastructure** at `packages/config/src/test-utils/` — the new integration test for the migration uses the existing `setupTestDb()` / `getTestPrisma()` / `seedTestDb()` helpers, not a hand-rolled DB harness.
- **Forward-only Prisma migrations** — the project convention; this RFC follows it.

## Architecture Analysis

Three-bucket classification of architectural patterns this design touches, vs. the current state of `docs/architecture/architecture.md`.

### Patterns Correctly Followed

| Pattern | Architecture-doc reference | Where this RFC follows it |
|---|---|---|
| Prisma 5.13 ORM with `@@map` for table naming, single migration per logical change | architecture.md §3.4 (Data Layer) and §1 Tech Stack (line 32) | Schema delta uses `@@map("brand_themes")`; migration is a single forward-only file. |
| TypeScript strict mode + Zod schemas at the API boundary | architecture.md §1 (line 27), §3.5 (Shared Layer) | Zod schemas in `packages/shared/src/zod/survey.schema.ts` are split (theme schemas drop 6 fields; survey schemas gain 3); typed Prisma client carries through. |
| Multi-tenant `brandId` from verified JWT only — never from request body | architecture.md §6 Architectural Patterns (line 416), project rule R6 | Theme and Survey routes continue to read `brandId` from `request.brandId` (the JWT-injected value); no `brandId` is taken from request bodies in this RFC. |
| Centralized test infrastructure at `packages/config/src/test-utils/` | architecture.md §6 (line 432), project rule R8 | The new integration test (`themes-291-migration.test.ts`) uses existing `setupTestDb()` / `getTestPrisma()` / `seedTestDb()` helpers; no hand-rolled DB harness. |
| Plugin registration order respected by Fastify routes | architecture.md §3.2 (line 65) | Themes/Surveys routes register after the standard middleware chain; this RFC doesn't change registration order. |
| Defense-in-depth on FK references | architecture.md §6 (line 416) | `Brand.defaultThemeId` gains a real FK constraint with `ON DELETE SET NULL ON UPDATE CASCADE`; matches the existing pattern on `surveys.themeId`. |
| Forward-only migrations | project convention (CLAUDE.md, prior issues like #198) | Migration is forward-only; no rollback path; verify-and-backfill before drop. |

### Patterns Missing from Architecture

| Pattern | Why this RFC needs it | Suggested architecture update |
|---|---|---|
| **Hand-edited Prisma migrations via `prisma migrate dev --create-only` + manual SQL edit.** | Prisma's auto-generation defaults to DROP-and-CREATE on model renames in non-interactive contexts and never emits `UPDATE` statements for backfills. Any migration that needs to (a) rename a table + preserve row identities, or (b) backfill between an `ADD COLUMN` and a `DROP COLUMN`, must hand-edit the draft migration. The pattern is repo-correct (PR #197's drift fix touched migrations directly; #198 followed up; the `20260430000000_patch_survey_distribution_gap` migration is hand-written `DO $$ ... END $$` PL/pgSQL) but `architecture.md` doesn't currently document it. | Add a 3-bullet sub-section under §3.4 Data Layer describing: (a) when to use `--create-only` (model rename, table rename, column-data move, backfill-before-drop), (b) the canonical hand-edit ordering (ADD → backfill UPDATE → DROP), (c) the recovery path if a partial migration ships (see existing `20260430000000_patch_survey_distribution_gap` as the reference example). |
| **Backfill-before-drop migration ordering** as a named pattern. | Same root cause as above; specifically about ordering when a column moves between rows. The risk if missed: silently dropping data during the migration. | Same proposed sub-section as above — document the ADD → BACKFILL → DROP ordering as the canonical shape for "field moves to another table" migrations. The reference example for #291 (after this PR merges) is `<timestamp>_brandtheme_surveytheme_split/migration.sql`. |
| **Public survey API `select` set as a versioned contract.** | The public survey GET endpoint's `select` set is what determines which `brand.*` fields are visible to the renderer. This RFC adds `brand.logoUrl` to the `select`; future renderers will read `brand.*` increasingly often as identity surfaces consolidate on `Brand`. There's no architecture-doc note today on what should and shouldn't be exposed via the public response. | Defer — single-data-point pattern. Capture as a candidate for a future architecture-gap retrospective if a second renderer issue lands and the same question recurs. Not blocking #291. |

### Patterns Incorrectly Followed

None identified. The design follows existing patterns; no design errors flagged.

### Recommendation

The two "missing from architecture" entries (hand-edited migrations, backfill-before-drop ordering) are real patterns the team uses but doesn't document. They would benefit from a small section in `architecture.md` §3.4. **However**, per the FRAIM phase instruction "no architecture updates yet — they happen during address-feedback," the architecture-doc edit is deferred until the reviewer confirms whether to add the sub-section in this PR or to file a separate doc-update issue. Surfaced here so the reviewer can choose.
