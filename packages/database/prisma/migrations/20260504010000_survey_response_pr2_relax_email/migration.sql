-- Issue #231 PR2 — relax Member.email + drop the now-redundant unique key.
--
-- PR1 (migration 20260504000000) shipped the new canonical lookup
-- @@unique([brandId, externalId]) alongside the existing
-- @@unique([brandId, email]) for strict additivity. PR2 ships the
-- behavior changes (auto-enrollment for non-EMAIL brands; idempotent
-- upsert path), which requires:
--   - email becoming nullable (a PHONE / CUSTOMER_ID brand's auto-
--     enrolled member has no email at create time)
--   - dropping the email unique key (externalId is now canonical)
--
-- Both are reversible — a `down` migration would re-add the unique and
-- restore NOT NULL after backfilling email from externalId where set.

BEGIN;

-- 1. Drop the old unique key (externalId is now the canonical lookup).
DROP INDEX "members_brandId_email_key";

-- 2. Make email nullable. Existing rows are unchanged (every member
--    enrolled before PR2 has an email; the column stays populated for
--    them).
ALTER TABLE "members" ALTER COLUMN "email" DROP NOT NULL;

COMMIT;
