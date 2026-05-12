-- Issue #241 Slice 1 — Survey Admin UX schema deltas + D50 fan-out
-- (umbrella: #324; sub-issue: #325; RFC: docs/rfcs/241-survey-admin-ux.md §Schema Changes)
--
-- Single hand-edited forward migration. Pattern follows
-- 20260507083000_brandtheme_surveytheme_split (block-ordered, idempotent guards)
-- and 20260504000000_survey_response_data_model_rework (BEGIN/COMMIT wrapper,
-- header strategy doc).
--
-- All steps idempotent under repeated `migrate deploy`:
--   * IF EXISTS / IF NOT EXISTS guards for ADD/DROP COLUMN
--   * NOT EXISTS subquery guard for the incentivePoints fan-out (Block 2a) so
--     replay doesn't double-write rules
--   * Block 2b only matches rows still tagged 'survey_completion'; once
--     fanned out and deleted, replay is a no-op
--   * Block 4's enum rename is wrapped in a PL/pgSQL DO block that guards on
--     the source label still existing — replay against a renamed enum is a
--     no-op rather than an error
--
-- The worker (apps/worker/src/processors/loyaltyEvents.ts:81) consumes
-- `EarningRule.triggerEvent` via exact-string match. The fan-out below maps
-- every brand's prior earning intent into the canonical cx event shape that
-- the response handler already emits — zero worker changes required.

BEGIN;

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. Add Survey.title, backfill from Survey.name
-- ──────────────────────────────────────────────────────────────────────────────
-- Column stays nullable: future surveys MAY have null title at draft time;
-- R7 gates activation when title is empty, not at column-level.

ALTER TABLE "surveys" ADD COLUMN IF NOT EXISTS "title" TEXT;
UPDATE "surveys" SET "title" = "name" WHERE "title" IS NULL;

-- ──────────────────────────────────────────────────────────────────────────────
-- 2a. D50 fan-out — Survey.incentivePoints branch
-- ──────────────────────────────────────────────────────────────────────────────
-- For each (programId, brandId, survey.type) pair where at least one survey
-- carries incentivePoints > 0, create one EarningRule keyed on the matching
-- cx event. pointsAwarded = mode (most common intent across the rows).
--
-- The NOT EXISTS guard prevents double-writing on replay: if the operator
-- has already moved to the canonical shape (a live (programId, cx.<type>_response)
-- rule exists), we skip rather than create a duplicate. The migration's
-- name prefix '[#241 migration]' makes the seeded rows greppable post-deploy.

INSERT INTO "earning_rules" (
  id, "programId", "brandId", name, "triggerEvent", "pointsAwarded",
  multiplier, status, priority, stackable, "budgetUsedPoints", "validFrom", "createdAt"
)
SELECT
  'er_' || substr(md5(random()::text || clock_timestamp()::text), 1, 24),
  s."programId",
  s."brandId",
  '[#241 migration] ' || CASE s.type
    WHEN 'NPS'  THEN 'NPS survey completion'
    WHEN 'CSAT' THEN 'CSAT survey completion'
    WHEN 'CES'  THEN 'CES survey completion'
    ELSE             'Survey completion (Custom)'
  END,
  CASE s.type
    WHEN 'NPS'  THEN 'cx.nps_response'
    WHEN 'CSAT' THEN 'cx.csat_response'
    WHEN 'CES'  THEN 'cx.ces_response'
    ELSE             'cx.survey_completed'
  END AS "triggerEvent",
  MODE() WITHIN GROUP (ORDER BY s."incentivePoints") AS "pointsAwarded",
  1.0,
  'ACTIVE',
  0,
  FALSE,
  0,
  NOW(),
  NOW()
FROM "surveys" s
WHERE s."incentivePoints" IS NOT NULL
  AND s."incentivePoints" > 0
  AND NOT EXISTS (
    SELECT 1 FROM "earning_rules" er
    WHERE er."programId" = s."programId"
      AND er."triggerEvent" = CASE s.type
        WHEN 'NPS'  THEN 'cx.nps_response'
        WHEN 'CSAT' THEN 'cx.csat_response'
        WHEN 'CES'  THEN 'cx.ces_response'
        ELSE             'cx.survey_completed'
      END
  )
GROUP BY s."programId", s."brandId", s.type;

-- ──────────────────────────────────────────────────────────────────────────────
-- 2b. D50 fan-out — dead EarningRule(triggerEvent='survey_completion') branch
-- ──────────────────────────────────────────────────────────────────────────────
-- For every dead rule, emit one rule per distinct cx event type used by the
-- program's surveys, preserving the dead rule's pointsAwarded, conditions,
-- budget cap, and validity window. Then drop the dead rules. The worker never
-- consumed 'survey_completion' (no caller emits that string), so this is
-- purely a re-mapping of operator intent.
--
-- DISTINCT-CASE inside JOIN LATERAL collapses duplicate survey types within
-- a program to one rule per cx type. If a program has no surveys yet, no
-- rules are emitted (the lateral subquery yields no rows).

INSERT INTO "earning_rules" (
  id, "programId", "brandId", name, "triggerEvent", "pointsAwarded",
  multiplier, conditions, "maxUsesPerMember", status, priority, stackable,
  "budgetCapPoints", "budgetUsedPoints", "validFrom", "validTo", "createdAt"
)
SELECT
  'er_' || substr(md5(random()::text || clock_timestamp()::text), 1, 24),
  dead."programId",
  dead."brandId",
  '[#241 migration] ' || dead.name || ' → ' || cx_event,
  cx_event,
  dead."pointsAwarded",
  dead.multiplier,
  dead.conditions,
  dead."maxUsesPerMember",
  dead.status,
  dead.priority,
  dead.stackable,
  dead."budgetCapPoints",
  0,
  dead."validFrom",
  dead."validTo",
  NOW()
FROM "earning_rules" dead
JOIN LATERAL (
  SELECT DISTINCT CASE s.type
    WHEN 'NPS'  THEN 'cx.nps_response'
    WHEN 'CSAT' THEN 'cx.csat_response'
    WHEN 'CES'  THEN 'cx.ces_response'
    ELSE             'cx.survey_completed'
  END AS cx_event
  FROM "surveys" s
  WHERE s."programId" = dead."programId"
) types ON TRUE
WHERE dead."triggerEvent" = 'survey_completion';

-- Delete the dead rules now that intent is preserved. Replay is a no-op
-- (no rows remain with triggerEvent='survey_completion' after this point).
DELETE FROM "earning_rules" WHERE "triggerEvent" = 'survey_completion';

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. Drop legacy incentive columns
-- ──────────────────────────────────────────────────────────────────────────────
-- D19: incentive points never appear on the respondent form.
-- D40 / D50: earning is owned by EarningRule keyed on cx events.

ALTER TABLE "surveys" DROP COLUMN IF EXISTS "incentivePoints";
ALTER TABLE "surveys" DROP COLUMN IF EXISTS "showIncentivePoints";

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. SurveyStatus enum rename CLOSED → STOPPED (R25, D5)
-- ──────────────────────────────────────────────────────────────────────────────
-- ALTER TYPE … RENAME VALUE is supported on PostgreSQL 10+ (architecture.md §2
-- + ADR-0002: CustomerEQ runs PG16). Wrapped in a PL/pgSQL DO block so a raw
-- psql replay against an already-renamed enum is a no-op rather than a hard
-- error. Prisma's _prisma_migrations table prevents re-running under
-- `migrate deploy`; this guard is defensive against direct-psql test replay
-- (matches the convention from _patch_survey_distribution_gap).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'SurveyStatus'
      AND e.enumlabel = 'CLOSED'
      AND n.nspname = current_schema()
  ) THEN
    EXECUTE 'ALTER TYPE "SurveyStatus" RENAME VALUE ''CLOSED'' TO ''STOPPED''';
  END IF;
END $$;

COMMIT;
