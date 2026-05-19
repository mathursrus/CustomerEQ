# Runbook: Resolve Failed `_prisma_migrations` Record for `20260505000000_survey_import_batch`

**Issue**: #389
**Environment**: Production (Azure Container Apps + PostgreSQL)
**When to run**: After this PR is merged and deployed

---

## Background

Migration `20260505000000_survey_import_batch` failed at Step 4 in production
(`CREATE UNIQUE INDEX "survey_responses_live_dedup"` — duplicate rows blocked it).
Steps 5–7 were applied manually via psql. The `_prisma_migrations` table still records
this migration as failed, which causes `prisma migrate deploy` to error on subsequent
runs until resolved.

Issue #389 removes Step 4 from the migration SQL. This runbook updates the
`_prisma_migrations` record to reflect that the migration is now fully applied.

---

## Pre-flight Checks

```sql
-- 1. Confirm the current state of the failed migration
SELECT id, migration_name, applied_steps_count, steps_count, finished_at, logs
FROM _prisma_migrations
WHERE migration_name = '20260505000000_survey_import_batch';
-- Expected: applied_steps_count < steps_count, logs contains error text
```

```sql
-- 2. Confirm the index does not exist (it should not in production)
SELECT indexname FROM pg_indexes
WHERE tablename = 'survey_responses'
  AND indexname = 'survey_responses_live_dedup';
-- Expected: 0 rows (the index was never successfully created)
```

```sql
-- 3. Confirm Steps 5–7 artifacts are present
-- FK: survey_responses → survey_import_batches
SELECT constraint_name FROM information_schema.table_constraints
WHERE table_name = 'survey_responses'
  AND constraint_name = 'survey_responses_importBatchId_fkey';
-- Expected: 1 row

-- Index from Step 7
SELECT indexname FROM pg_indexes
WHERE tablename = 'survey_responses'
  AND indexname = 'survey_responses_importBatchId_idx';
-- Expected: 1 row
```

---

## Resolution SQL

Run this in a single transaction against the production database:

```sql
BEGIN;

-- Mark the migration as fully applied.
-- steps_count on disk is now 6 (Step 4 removed by Issue #389).
-- Set applied_steps_count = 6, clear the error log, set finished_at.
UPDATE _prisma_migrations
SET
  applied_steps_count = 6,
  logs                = NULL,
  finished_at         = NOW()
WHERE migration_name = '20260505000000_survey_import_batch';

-- Verify exactly 1 row was updated
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM _prisma_migrations
      WHERE migration_name = '20260505000000_survey_import_batch'
        AND applied_steps_count = 6
        AND logs IS NULL) <> 1 THEN
    RAISE EXCEPTION 'Unexpected state after update — rolling back';
  END IF;
END $$;

COMMIT;
```

---

## Post-Resolution Verification

```sql
-- Confirm migration is now recorded as applied
SELECT migration_name, applied_steps_count, steps_count, finished_at, logs
FROM _prisma_migrations
WHERE migration_name = '20260505000000_survey_import_batch';
-- Expected: applied_steps_count = 6, logs IS NULL, finished_at IS NOT NULL
```

```bash
# Confirm prisma migrate deploy reports no pending or failed migrations
prisma migrate deploy
# Expected: "All migrations have been successfully applied."
```

---

## Rollback

This update is safe to roll back before COMMIT. If `prisma migrate deploy` still errors
after applying, re-inspect `_prisma_migrations` for other failed migrations and check
the Prisma deploy logs.
