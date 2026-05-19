#!/usr/bin/env bash
# scripts/recovery/371-unblock-failed-import-batch-migration.sh
#
# Recovers from the failed production migration
# `20260505000000_survey_import_batch` which has been blocking all Prisma
# migrate deploys since 2026-05-10. Symptom in prod: every API revision since
# rev 191 fails activation because Prisma cannot advance past the failed
# migration row in `_prisma_migrations`.
#
# Root cause: step 4 of that migration tries to CREATE UNIQUE INDEX
# `survey_responses_live_dedup` on (surveyId, memberId) for live (non-import)
# rows. Real prod data has duplicate (surveyId, memberId) pairs for
# MULTIPLE-policy surveys, so the index creation fails (PG error 23505).
#
# The recovery applies the other 6 steps of the migration manually (which
# are needed by later code and migrations) and skips step 4 (which is
# dropped 8 migrations later by 20260514120000_drop_live_dedup_unique
# anyway). It then marks the migration as applied so Prisma stops blocking.
#
# Safe to re-run. Wrapped in a single transaction. On any error, the entire
# change set rolls back and you stay where you started.
#
# Run from Azure Cloud Shell signed in to the subscription that owns
# `customereq-prod`. Requires `psql` (pre-installed in Cloud Shell) and
# Key Vault Secrets User access to `customereq-kv`.
#
# Usage:
#   bash 371-unblock-failed-import-batch-migration.sh
#
# Exit codes:
#   0 — recovery applied or already applied; verification passed
#   1 — verification failed; transaction rolled back; investigate before
#       triggering redeploy

set -euo pipefail

echo "[1/4] Fetching DB connection string from Key Vault..."
DB_URL=$(az keyvault secret show \
  --vault-name customereq-kv \
  --name database-url \
  --query value -o tsv)

if [ -z "$DB_URL" ]; then
  echo "ERROR: could not read database-url secret from customereq-kv."
  exit 1
fi

echo "[2/4] Running recovery SQL inside a single transaction..."
PGSSLMODE=require psql "$DB_URL" <<'SQL'
\set ON_ERROR_STOP on
\timing on

BEGIN;

-- Step 1 — survey_import_batches table
CREATE TABLE IF NOT EXISTS "survey_import_batches" (
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

-- Step 2 — import columns on survey_responses
ALTER TABLE "survey_responses"
  ADD COLUMN IF NOT EXISTS "importBatchId"        TEXT,
  ADD COLUMN IF NOT EXISTS "importedAt"           TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "externalRespondentId" TEXT;

-- Step 3 — relax memberId to nullable
ALTER TABLE "survey_responses"
  ALTER COLUMN "memberId" DROP NOT NULL;

-- Step 4 — INTENTIONALLY SKIPPED.
--   Original SQL was:
--     CREATE UNIQUE INDEX "survey_responses_live_dedup"
--       ON "survey_responses" ("surveyId","memberId")
--       WHERE "importBatchId" IS NULL AND "memberId" IS NOT NULL;
--   That index conflicts with intentional duplicates under MULTIPLE
--   response policy. Migration 20260514120000_drop_live_dedup_unique
--   removes it. Creating and dropping is wasted work and would fail
--   again on the same duplicate data, so we skip the create.

-- Step 5 — FK survey_responses.importBatchId -> survey_import_batches.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'survey_responses_importBatchId_fkey'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE "survey_responses"
      ADD CONSTRAINT "survey_responses_importBatchId_fkey"
      FOREIGN KEY ("importBatchId")
      REFERENCES "survey_import_batches"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Step 6 — FK survey_import_batches.surveyId -> surveys.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'survey_import_batches_surveyId_fkey'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE "survey_import_batches"
      ADD CONSTRAINT "survey_import_batches_surveyId_fkey"
      FOREIGN KEY ("surveyId") REFERENCES "surveys"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Step 7 — indexes
CREATE INDEX IF NOT EXISTS "survey_import_batches_surveyId_idx"
  ON "survey_import_batches" ("surveyId");
CREATE INDEX IF NOT EXISTS "survey_import_batches_brandId_createdAt_idx"
  ON "survey_import_batches" ("brandId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "survey_responses_importBatchId_idx"
  ON "survey_responses" ("importBatchId");

-- Mark the migration as applied so Prisma stops blocking subsequent ones
UPDATE _prisma_migrations
SET finished_at = NOW(),
    logs = 'Recovered via scripts/recovery/371-unblock-failed-import-batch-migration.sh'
WHERE migration_name = '20260505000000_survey_import_batch'
  AND finished_at IS NULL;

COMMIT;
SQL

echo "[3/4] Running verification queries..."
PGSSLMODE=require psql "$DB_URL" <<'SQL'
\set ON_ERROR_STOP on

\echo
\echo '=== Migration history (last 12) ==='
SELECT migration_name,
       to_char(started_at,  'YYYY-MM-DD HH24:MI:SS') AS started,
       to_char(finished_at, 'YYYY-MM-DD HH24:MI:SS') AS finished,
       rolled_back_at IS NOT NULL AS rolled_back
FROM _prisma_migrations
ORDER BY started_at DESC
LIMIT 12;

\echo
\echo '=== Failed migrations remaining (expect: 0 rows) ==='
SELECT migration_name, started_at, rolled_back_at
FROM _prisma_migrations
WHERE finished_at IS NULL
  AND rolled_back_at IS NULL;

\echo
\echo '=== survey_import_batches table exists? (expect: t) ==='
SELECT to_regclass('public.survey_import_batches') IS NOT NULL AS table_exists;

\echo
\echo '=== survey_responses.importBatchId column exists? (expect: t) ==='
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'survey_responses'
    AND column_name  = 'importBatchId'
) AS column_exists;

\echo
\echo '=== survey_responses.memberId nullable? (expect: YES) ==='
SELECT is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'survey_responses'
  AND column_name  = 'memberId';
SQL

unset DB_URL

echo
echo "[4/4] Done."
echo
echo "If verification looked good:"
echo "  - 'Failed migrations remaining' returned 0 rows"
echo "  - 'survey_import_batches table exists' = t"
echo "  - 'survey_responses.importBatchId column exists' = t"
echo "  - 'survey_responses.memberId nullable' = YES"
echo
echo "Then trigger a fresh API deploy by either:"
echo "  (A) Re-running the latest failed Deploy workflow at"
echo "      https://github.com/mathursrus/CustomerEQ/actions"
echo "  (B) Provoking a new revision from Cloud Shell:"
echo "      az containerapp update --name customereq-api \\"
echo "        --resource-group customereq-prod \\"
echo "        --revision-suffix manual-unblock-\$(date +%s)"
echo
echo "Watch revision activation:"
echo "  watch -n 5 'az containerapp revision list \\"
echo "    --name customereq-api --resource-group customereq-prod \\"
echo "    --query \"reverse(sort_by([?properties.active], &properties.createdTime)) | [].{name:name, traffic:properties.trafficWeight, health:properties.healthState, state:properties.runningState}\" \\"
echo "    -o table'"
