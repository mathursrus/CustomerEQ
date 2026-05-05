-- Issue #231 — Survey response data model rework (PR1: Foundation)
--
-- Single transactional migration:
--   1. Brand additions (R4, R16) — new fields + 2 enum types, with safe defaults
--   2. Member additions (R4, R7, R15) — externalId + enrolledVia, with backfill
--   3. Survey additions (R3, R16, R17) — responsePolicy + consent override fields
--   4. SurveyResponse — drop one-response-per-member-per-survey unique constraint
--
-- IMPORTANT — pre-migration collision guard:
--   `packages/database/scripts/check-identifier-collisions.ts` MUST run before
--   this migration. It verifies that no `(brandId, LOWER(TRIM(email)))` pair
--   appears more than once. If collisions exist, this migration would fail at
--   step 5 (UNIQUE INDEX creation) — the guard catches it earlier so the
--   engineer can resolve duplicates manually before deploying.
--
-- Rollback: every step is reversible. Postgres aborts the tx on any failure.

BEGIN;

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. Enum types (Brand + Member + Survey)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TYPE "MemberIdentifierKind" AS ENUM ('EMAIL', 'PHONE', 'CUSTOMER_ID');
CREATE TYPE "ConsentMode"          AS ENUM ('EXPLICIT', 'IMPLIED_ON_SUBMIT');
CREATE TYPE "MemberEnrolledVia"    AS ENUM ('MANUAL_API', 'BULK_IMPORT', 'SURVEY_RESPONSE', 'EMBEDDED_FORM', 'CLERK_OAUTH');
CREATE TYPE "ResponsePolicy"       AS ENUM ('ONCE', 'MULTIPLE', 'LATEST_OVERWRITES');

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. Brand additions (R4, R16)
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TABLE "brands"
  ADD COLUMN "memberIdentifierKind" "MemberIdentifierKind" NOT NULL DEFAULT 'EMAIL',
  ADD COLUMN "consentMode"          "ConsentMode"          NOT NULL DEFAULT 'EXPLICIT',
  ADD COLUMN "consentTextDefault"   TEXT,
  ADD COLUMN "privacyPolicyUrl"     TEXT,
  ADD COLUMN "termsUrl"             TEXT;

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. Member additions (R4, R7, R15)
--    Two-phase: nullable add → backfill → promote NOT NULL → swap unique key
-- ──────────────────────────────────────────────────────────────────────────────

-- 3a. Add columns nullable
ALTER TABLE "members"
  ADD COLUMN "externalId"  TEXT,
  ADD COLUMN "enrolledVia" "MemberEnrolledVia";

-- 3b. Backfill — every existing member's externalId mirrors LOWER(TRIM(email)).
--     enrolledVia defaults to MANUAL_API (best-fit value for pre-#231 rows that
--     were created via the legacy enroll endpoint).
UPDATE "members" SET
  "externalId"  = LOWER(TRIM("email")),
  "enrolledVia" = 'MANUAL_API';

-- 3c. Promote to NOT NULL.
ALTER TABLE "members"
  ALTER COLUMN "externalId"  SET NOT NULL,
  ALTER COLUMN "enrolledVia" SET NOT NULL;

-- 3d. Add the new canonical unique key on (brandId, externalId).
--     PR1 keeps the existing (brandId, email) unique key for additivity —
--     every existing call site that uses brandId_email continues to work,
--     and brandId_externalId is the new canonical lookup. PR2 drops the
--     email unique key at the same time it makes `email` nullable.
CREATE UNIQUE INDEX "members_brandId_externalId_key" ON "members"("brandId", "externalId");
CREATE INDEX        "members_brandId_externalId_idx" ON "members"("brandId", "externalId");

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. Survey additions (R3, R16, R17)
--    Existing rows take the default responsePolicy = MULTIPLE per spec R14
--    (test customers only — testing the new V0 default beats preserving the
--    historical one-response policy). Brand admins explicitly set ONCE per
--    survey when they want the prior behavior.
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TABLE "surveys"
  ADD COLUMN "responsePolicy"              "ResponsePolicy" NOT NULL DEFAULT 'MULTIPLE',
  ADD COLUMN "consentTextOverride"         TEXT,
  ADD COLUMN "consentSuppressedAttestedBy" TEXT,
  ADD COLUMN "consentSuppressedAttestedAt" TIMESTAMP(3);

-- ──────────────────────────────────────────────────────────────────────────────
-- 5. SurveyResponse — drop the one-response-per-member-per-survey unique
--    constraint. Multiple responses per member-per-survey are now controlled
--    by `Survey.responsePolicy` at the application layer (R2 + R3).
-- ──────────────────────────────────────────────────────────────────────────────

DROP INDEX "survey_responses_surveyId_memberId_key";
CREATE INDEX "survey_responses_surveyId_memberId_idx" ON "survey_responses"("surveyId", "memberId");

COMMIT;
