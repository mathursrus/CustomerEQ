-- Issue #543 F1 — Backfill `Survey.sentCount` for historical SELF_SERVE
-- recipients minted before #540 / commit cc0fd54.
--
-- The #540 fix bumped Survey.sentCount at SELF_SERVE batch mint time going
-- forward (apps/api/src/routes/distributionBatches.ts inside the create
-- transaction). But the denormalized field was already wrong for any
-- SELF_SERVE batch that minted before the deploy where the operator never
-- called mark-csv-downloaded (which used to be the only bump path). The
-- post-#540 code path can't retroactively fix those rows.
--
-- This migration recomputes sentCount from the source-of-truth tables for
-- every Survey that has ever distributed:
--   SELF_SERVE        : COUNT(survey_distribution_tokens) per batch where
--                       send_mode = 'SELF_SERVE'. Mint-time = sent for
--                       SELF_SERVE (no per-delivery signal).
--   MANAGED_EMAIL     : COUNT(survey_distributions) per batch where
--                       send_mode = 'MANAGED_EMAIL' AND deliveredAt IS NOT NULL.
--                       Matches the worker's markDelivered semantic, unchanged.
--
-- Properties:
--   - Idempotent. Re-running computes the same number from the truth tables.
--     Doesn't ADD to the existing field — replaces it with the recomputed
--     truth.
--   - Doesn't double-count post-fix data. A SELF_SERVE batch created AFTER
--     this migration runs has its mint-time `sentCount += minted.length`
--     bump (from #540 F3), AND the migration's COUNT also includes those
--     tokens. They agree by construction — the SQL counts tokens regardless
--     of mint timestamp.
--   - Covers MANAGED_EMAIL too. Backfills any historical MANAGED_EMAIL
--     recipient whose markDelivered bump may have raced or failed silently.
--   - The WHERE EXISTS guard keeps the UPDATE from touching surveys that
--     have never distributed; those keep sentCount at whatever it was
--     (default 0). Investigating non-zero stale values on never-distributed
--     surveys is a different concern, out of scope here.
--
-- Tables here use the snake_case form per Prisma `@@map` directives in
-- packages/database/prisma/schema.prisma. Column names stay camelCase
-- and are quoted per Rule 22a (existing migrations 20260517000000_
-- distribution_batches and 20260523050000_add_managed_email_send follow
-- the same convention).

UPDATE "surveys" sv
SET "sentCount" = COALESCE((
  SELECT COUNT(t."id")
  FROM "survey_distribution_tokens" t
  JOIN "distribution_batches" b ON b."id" = t."batchId"
  WHERE b."surveyId" = sv."id" AND b."sendMode" = 'SELF_SERVE'
), 0) + COALESCE((
  SELECT COUNT(d."id")
  FROM "survey_distributions" d
  JOIN "distribution_batches" b ON b."id" = d."batchId"
  WHERE b."surveyId" = sv."id" AND b."sendMode" = 'MANAGED_EMAIL'
        AND d."deliveredAt" IS NOT NULL
), 0)
WHERE EXISTS (
  SELECT 1 FROM "distribution_batches" b WHERE b."surveyId" = sv."id"
);
