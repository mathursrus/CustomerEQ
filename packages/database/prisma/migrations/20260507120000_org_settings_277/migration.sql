-- Issue #277 — Organization Settings schema additions (Slice 1 of #292).
-- All changes are forward-only. Single migration.
--
-- Block ordering: rename column → reshape enum (cast→recreate→cast back) → add new columns.

-- ── 1. Rename column sizeCategory → orgSize ───────────────────────────────────
-- No data loss; the column is unindexed, unconstrained, and has been NULL for
-- every brand row (pre-#277 UI never wrote sizeCategory).
ALTER TABLE "brands" RENAME COLUMN "sizeCategory" TO "orgSize";

-- ── 2. Reshape OrgSizeCategory enum ───────────────────────────────────────────
-- Drop superseded values SIZE_51_200, SIZE_201_PLUS; keep canonical six.
-- Postgres lacks ALTER TYPE … DROP VALUE, so this is the standard
-- create-new-type-and-swap pattern. Safe because the column is empty (NULL).
ALTER TABLE "brands" ALTER COLUMN "orgSize" TYPE TEXT;
ALTER TYPE "OrgSizeCategory" RENAME TO "OrgSizeCategory_old";
CREATE TYPE "OrgSizeCategory" AS ENUM (
  'SIZE_1_10',
  'SIZE_11_50',
  'SIZE_51_300',
  'SIZE_301_5000',
  'SIZE_5000_PLUS',
  'PREFER_NOT_TO_SAY'
);
ALTER TABLE "brands"
  ALTER COLUMN "orgSize" TYPE "OrgSizeCategory" USING "orgSize"::"OrgSizeCategory";
DROP TYPE "OrgSizeCategory_old";

-- ── 3. Add timezone + locale columns with safe defaults ───────────────────────
ALTER TABLE "brands"
  ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS "locale"   TEXT NOT NULL DEFAULT 'en-US';
