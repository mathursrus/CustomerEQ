-- Issue #262: Historical Survey Data Import
-- Adds SurveyImportBatch model and extends SurveyResponse for import tracking.
-- Manual migration (shadow DB workaround).

-- 1. Create survey_import_batches table
CREATE TABLE "survey_import_batches" (
    "id"            TEXT NOT NULL,
    "surveyId"      TEXT NOT NULL,
    "brandId"       TEXT NOT NULL,
    "sourceType"    TEXT NOT NULL,
    "filename"      TEXT,
    "status"        TEXT NOT NULL DEFAULT 'pending',
    "totalRows"     INTEGER NOT NULL DEFAULT 0,
    "processedRows" INTEGER NOT NULL DEFAULT 0,
    "failedRows"    INTEGER NOT NULL DEFAULT 0,
    "errors"        JSONB NOT NULL DEFAULT '[]',
    "deletedAt"     TIMESTAMP(3),
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_import_batches_pkey" PRIMARY KEY ("id")
);

-- 2. Add import columns to survey_responses
ALTER TABLE "survey_responses"
    ADD COLUMN "importBatchId"        TEXT,
    ADD COLUMN "importedAt"           TIMESTAMP(3),
    ADD COLUMN "externalRespondentId" TEXT;

-- 3. Make memberId nullable (Google Reviews rows have no email → no member)
ALTER TABLE "survey_responses" ALTER COLUMN "member_id" DROP NOT NULL;

-- 4. Drop the old broad unique constraint (was: one response per member per survey regardless of source)
ALTER TABLE "survey_responses" DROP CONSTRAINT IF EXISTS "survey_responses_survey_id_member_id_key";

-- 5. Partial unique index for live responses (import_batch_id IS NULL, member_id NOT NULL)
--    Preserves original deduplication behaviour for all non-import submissions.
CREATE UNIQUE INDEX "survey_responses_live_dedup"
    ON "survey_responses" ("survey_id", "member_id")
    WHERE "importBatchId" IS NULL AND "member_id" IS NOT NULL;

-- 6. FK: survey_responses → survey_import_batches
ALTER TABLE "survey_responses"
    ADD CONSTRAINT "survey_responses_importBatchId_fkey"
    FOREIGN KEY ("importBatchId") REFERENCES "survey_import_batches"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- 7. FK: survey_import_batches → surveys
ALTER TABLE "survey_import_batches"
    ADD CONSTRAINT "survey_import_batches_surveyId_fkey"
    FOREIGN KEY ("surveyId") REFERENCES "surveys"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- 8. Indexes
CREATE INDEX "survey_import_batches_surveyId_idx" ON "survey_import_batches"("surveyId");
CREATE INDEX "survey_import_batches_brandId_createdAt_idx" ON "survey_import_batches"("brandId", "createdAt" DESC);
CREATE INDEX "survey_responses_importBatchId_idx" ON "survey_responses"("importBatchId");
