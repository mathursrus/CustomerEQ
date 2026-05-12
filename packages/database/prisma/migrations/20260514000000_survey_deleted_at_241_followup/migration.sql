-- Issue #332 (#241 Slice 2 follow-up) — Add Survey.deletedAt for soft-delete
-- (umbrella: #324)
--
-- Survey lacks the soft-delete column that Program/Member/Reward already have
-- (verified in schema.prisma). The follow-up DELETE /v1/surveys/:id endpoint
-- writes deletedAt = NOW() rather than removing rows so that response history
-- and audit signatures are preserved. GET handlers filter `deletedAt: null`.
--
-- No backfill (NULL = active row). No indexes — low-cardinality; the existing
-- (brandId, status) index remains the leading predicate on list queries.

BEGIN;

ALTER TABLE "surveys" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

COMMIT;
