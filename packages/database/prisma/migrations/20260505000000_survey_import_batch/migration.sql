-- Issue #262: Historical Survey Data Import
-- Adds SurveyImportBatch model and extends SurveyResponse for import tracking.
-- Runs after 20260504000000_survey_response_data_model_rework (#231) which already
-- dropped the old survey_responses_surveyId_memberId_key unique index.

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
ALTER TABLE "survey_responses" ALTER COLUMN "memberId" DROP NOT NULL;

-- 4. REMOVED (Issue #389): the partial unique index `survey_responses_live_dedup`
--    that was here contradicts Survey.responsePolicy = MULTIPLE (always insert a new
--    row). It was never successfully applied in production (failed with duplicate-row
--    error at deploy time). Migration 20260514120000_drop_live_dedup_unique drops the
--    index with DROP INDEX IF EXISTS for any environment where it was applied.

-- 5. FK: survey_responses → survey_import_batches
ALTER TABLE "survey_responses"
    ADD CONSTRAINT "survey_responses_importBatchId_fkey"
    FOREIGN KEY ("importBatchId") REFERENCES "survey_import_batches"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- 6. FK: survey_import_batches → surveys
ALTER TABLE "survey_import_batches"
    ADD CONSTRAINT "survey_import_batches_surveyId_fkey"
    FOREIGN KEY ("surveyId") REFERENCES "surveys"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- 7. Indexes
CREATE INDEX "survey_import_batches_surveyId_idx" ON "survey_import_batches"("surveyId");
CREATE INDEX "survey_import_batches_brandId_createdAt_idx" ON "survey_import_batches"("brandId", "createdAt" DESC);
CREATE INDEX "survey_responses_importBatchId_idx" ON "survey_responses"("importBatchId");
