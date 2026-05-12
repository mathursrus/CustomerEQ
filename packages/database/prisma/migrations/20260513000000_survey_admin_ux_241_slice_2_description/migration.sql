-- Issue #241 Slice 2 — Add Survey.description for list-page meta (R26 / D26)
-- (umbrella: #324; sub-issue: #328)
--
-- The RFC §API surface row for PATCH /v1/surveys/:id listed `description` as
-- an accepted body field but the original Slice 1 migration did not add the
-- column. This is a minimal additive migration — no data movement, no
-- backfill, no idempotency guard beyond the standard IF NOT EXISTS.

BEGIN;

ALTER TABLE "surveys" ADD COLUMN IF NOT EXISTS "description" TEXT;

COMMIT;
