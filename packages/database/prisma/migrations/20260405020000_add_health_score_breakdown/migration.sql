-- Persist full health score breakdown (sub-scores + note modifier +
-- inconsistency flag) so the Customer 360 endpoint can return it without
-- recomputing on every read.
ALTER TABLE "members" ADD COLUMN "healthScoreBreakdown" JSONB;
