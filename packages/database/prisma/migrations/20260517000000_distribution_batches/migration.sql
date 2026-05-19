-- Issue #378 — Personalized survey links for BYO-email distribution
--
-- Adds:
--   - DistributionBatch (new): operator-facing wave of tokenized links
--   - SurveyDistributionToken (new): per-(batch, member) opaque token with hash-at-rest
--   - SurveyDistribution.batchId (new column): links existing distribution rows to a batch (NULL for legacy / share-link / embed)
--   - SurveyResponse.distributionBatchId + distributionTokenId (new columns): lineage from response back to wave + token
--   - MemberEnrolledVia.BULK_DISTRIBUTION (new enum value): Custom List auto-enroll channel
--
-- Hand-written per architecture §3.4 — Prisma's auto-generation emits DROP-and-CREATE for the
-- SurveyDistribution unique-constraint move, which would lose existing rows. The migration below
-- adds the new column first, then drops the old constraint, then adds the new (NULL-distinct)
-- unique index. Postgres NULL-distinct semantics keep legacy rows (batchId IS NULL) valid.
--
-- Forward-only; no down migration. Idempotent guards inline (IF NOT EXISTS / IF EXISTS).

-- ─── 1. Add enum value (additive; PostgreSQL ALTER TYPE … ADD VALUE) ──────────
ALTER TYPE "MemberEnrolledVia" ADD VALUE IF NOT EXISTS 'BULK_DISTRIBUTION';

-- ─── 2. Create new tables ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "distribution_batches" (
  "id"               TEXT      NOT NULL,
  "surveyId"         TEXT      NOT NULL,
  "brandId"          TEXT      NOT NULL,
  "label"            TEXT      NOT NULL,
  "surveyNameInMail" TEXT      NOT NULL,
  "audienceSpec"     JSONB     NOT NULL,
  "expiresAt"        TIMESTAMP(3) NOT NULL,
  "samplingSeed"     TEXT,
  "createdBy"        TEXT      NOT NULL,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "distribution_batches_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "distribution_batches_surveyId_createdAt_idx"
  ON "distribution_batches" ("surveyId", "createdAt");
CREATE INDEX IF NOT EXISTS "distribution_batches_brandId_expiresAt_idx"
  ON "distribution_batches" ("brandId", "expiresAt");

ALTER TABLE "distribution_batches"
  DROP CONSTRAINT IF EXISTS "distribution_batches_surveyId_fkey";
ALTER TABLE "distribution_batches"
  ADD CONSTRAINT "distribution_batches_surveyId_fkey"
  FOREIGN KEY ("surveyId") REFERENCES "surveys"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "survey_distribution_tokens" (
  "id"          TEXT      NOT NULL,
  "batchId"     TEXT      NOT NULL,
  "memberId"    TEXT      NOT NULL,
  "brandId"     TEXT      NOT NULL,
  "tokenHash"   TEXT      NOT NULL,
  "tokenPrefix" TEXT      NOT NULL,
  "expiresAt"   TIMESTAMP(3) NOT NULL,
  "consumedAt"  TIMESTAMP(3),
  CONSTRAINT "survey_distribution_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "survey_distribution_tokens_tokenHash_key"
  ON "survey_distribution_tokens" ("tokenHash");
CREATE UNIQUE INDEX IF NOT EXISTS "survey_distribution_tokens_batchId_memberId_key"
  ON "survey_distribution_tokens" ("batchId", "memberId");
CREATE INDEX IF NOT EXISTS "survey_distribution_tokens_batchId_consumedAt_idx"
  ON "survey_distribution_tokens" ("batchId", "consumedAt");

ALTER TABLE "survey_distribution_tokens"
  DROP CONSTRAINT IF EXISTS "survey_distribution_tokens_batchId_fkey";
ALTER TABLE "survey_distribution_tokens"
  ADD CONSTRAINT "survey_distribution_tokens_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "distribution_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "survey_distribution_tokens"
  DROP CONSTRAINT IF EXISTS "survey_distribution_tokens_memberId_fkey";
ALTER TABLE "survey_distribution_tokens"
  ADD CONSTRAINT "survey_distribution_tokens_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── 3. SurveyDistribution: add batchId, move unique constraint ───────────────
ALTER TABLE "survey_distributions"
  ADD COLUMN IF NOT EXISTS "batchId" TEXT;

ALTER TABLE "survey_distributions"
  DROP CONSTRAINT IF EXISTS "survey_distributions_batchId_fkey";
ALTER TABLE "survey_distributions"
  ADD CONSTRAINT "survey_distributions_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "distribution_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop the existing (surveyId, memberId) unique constraint. Prisma generated
-- the index name "survey_distributions_surveyId_memberId_key" from the
-- @@unique([surveyId, memberId]) declaration. We use IF EXISTS so the
-- migration is idempotent if rerun.
ALTER TABLE "survey_distributions"
  DROP CONSTRAINT IF EXISTS "survey_distributions_surveyId_memberId_key";
DROP INDEX IF EXISTS "survey_distributions_surveyId_memberId_key";

-- Add the new (batchId, memberId) unique index. Postgres treats NULL as
-- distinct in unique constraints, so all existing rows (batchId IS NULL)
-- coexist; future share-link/embed rows continue to write with batchId IS NULL
-- and never collide.
CREATE UNIQUE INDEX IF NOT EXISTS "survey_distributions_batchId_memberId_key"
  ON "survey_distributions" ("batchId", "memberId");

-- ─── 4. SurveyResponse: add distributionBatchId + distributionTokenId ─────────
ALTER TABLE "survey_responses"
  ADD COLUMN IF NOT EXISTS "distributionBatchId" TEXT,
  ADD COLUMN IF NOT EXISTS "distributionTokenId" TEXT;

ALTER TABLE "survey_responses"
  DROP CONSTRAINT IF EXISTS "survey_responses_distributionBatchId_fkey";
ALTER TABLE "survey_responses"
  ADD CONSTRAINT "survey_responses_distributionBatchId_fkey"
  FOREIGN KEY ("distributionBatchId") REFERENCES "distribution_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "survey_responses"
  DROP CONSTRAINT IF EXISTS "survey_responses_distributionTokenId_fkey";
ALTER TABLE "survey_responses"
  ADD CONSTRAINT "survey_responses_distributionTokenId_fkey"
  FOREIGN KEY ("distributionTokenId") REFERENCES "survey_distribution_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "survey_responses_distributionBatchId_completedAt_idx"
  ON "survey_responses" ("distributionBatchId", "completedAt");
