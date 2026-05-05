-- Issue #262: Historical survey data import
-- Adds SurveyImportBatch model and extends SurveyResponse with import tracking fields.
-- Live-response uniqueness (importBatchId IS NULL) is enforced via partial unique index below.

-- 1. Create survey_import_batches table
CREATE TABLE "survey_import_batches" (
    "id"            TEXT NOT NULL,
    "surveyId"      TEXT NOT NULL,
    "brandId"       TEXT NOT NULL,
    "filename"      TEXT NOT NULL,
    "totalRows"     INTEGER NOT NULL DEFAULT 0,
    "processedRows" INTEGER NOT NULL DEFAULT 0,
    "failedRows"    INTEGER NOT NULL DEFAULT 0,
    "status"        TEXT NOT NULL DEFAULT 'pending',
    "errors"        JSONB,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt"   TIMESTAMP(3),

    CONSTRAINT "survey_import_batches_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "survey_import_batches_surveyId_idx" ON "survey_import_batches"("surveyId");
CREATE INDEX "survey_import_batches_brandId_createdAt_idx" ON "survey_import_batches"("brandId", "createdAt");

ALTER TABLE "survey_import_batches"
    ADD CONSTRAINT "survey_import_batches_surveyId_fkey"
    FOREIGN KEY ("surveyId") REFERENCES "surveys"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2. Add import tracking columns to survey_responses
ALTER TABLE "survey_responses"
    ADD COLUMN "importBatchId"        TEXT,
    ADD COLUMN "importedAt"           TIMESTAMP(3),
    ADD COLUMN "externalRespondentId" TEXT;

ALTER TABLE "survey_responses"
    ADD CONSTRAINT "survey_responses_importBatchId_fkey"
    FOREIGN KEY ("importBatchId") REFERENCES "survey_import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "survey_responses_importBatchId_idx" ON "survey_responses"("importBatchId");

-- 3. Migrate the live-response uniqueness constraint.
--    Old: UNIQUE(surveyId, memberId)  — blocks multiple historical responses per member
--    New: partial UNIQUE on live rows + compound UNIQUE for historical rows
DROP INDEX IF EXISTS "survey_responses_surveyId_memberId_key";

-- Partial unique index: enforces one live response per (survey, member)
CREATE UNIQUE INDEX "survey_responses_live_unique"
    ON "survey_responses" ("surveyId", "memberId")
    WHERE "importBatchId" IS NULL;

-- Compound unique: enforces one response per (survey, member, batch) for historical imports
CREATE UNIQUE INDEX "survey_responses_surveyId_memberId_importBatchId_key"
    ON "survey_responses" ("surveyId", "memberId", "importBatchId");
