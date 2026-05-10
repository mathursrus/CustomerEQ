-- Issue #291 — Split BrandTheme from SurveyTheme
-- Hand-edited per RFC's 6-block ordering. Prisma's auto-generation defaults to
-- DROP-and-CREATE on model rename and never emits UPDATE statements for backfills;
-- both wrong shapes for this migration. See architecture.md §3.4 (4th bullet).
--
-- Block ordering: ADD columns → RENAME table → BACKFILL × 2 → DROP columns × 6 → ADD FK.

-- ── 1. Add new Survey columns (with safe defaults) ─────────────────────────────
ALTER TABLE "surveys"
  ADD COLUMN "thankYouMessage"     TEXT    NOT NULL DEFAULT 'Thank you for your feedback!',
  ADD COLUMN "thankYouRedirectUrl" TEXT,
  ADD COLUMN "showIncentivePoints" BOOLEAN NOT NULL DEFAULT TRUE;

-- ── 2. Rename theme table (preserves row identities and existing FKs) ─────────
-- Postgres tracks FKs by oid, so surveys.themeId silently retargets brand_themes.
ALTER TABLE "survey_themes" RENAME TO "brand_themes";
ALTER TABLE "brand_themes" RENAME CONSTRAINT "survey_themes_pkey" TO "brand_themes_pkey";
ALTER TABLE "brand_themes" RENAME CONSTRAINT "survey_themes_brandId_fkey" TO "brand_themes_brandId_fkey";
ALTER INDEX "survey_themes_brandId_idx" RENAME TO "brand_themes_brandId_idx";

-- ── 3. Backfill survey-level columns from theme rows BEFORE drop ──────────────
UPDATE "surveys" s
SET "thankYouMessage"     = bt."thankYouMessage",
    "thankYouRedirectUrl" = bt."thankYouRedirectUrl",
    "showIncentivePoints" = bt."showIncentivePoints"
FROM "brand_themes" bt
WHERE s."themeId" = bt."id";

-- ── 4. Backfill Brand.defaultThemeId from any isDefault=TRUE theme row ────────
-- One default per brand. DISTINCT ON keeps the most-recently-created row when
-- multiple isDefault=TRUE rows exist (impossible state the boolean technically
-- permits) — same outcome as the application-layer updateMany-then-update sequence.
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
