-- Issue #276 — Survey-level consent mode override (P0 production hotfix).
--
-- Two nullable column adds on `surveys`:
--   - consentMode  ConsentMode?  → null = inherit Brand.consentMode
--   - consentReason VARCHAR(500) → operator/system justification when override is set
--
-- Idempotency: ADD COLUMN IF NOT EXISTS so a `db push`-then-`migrate deploy`
-- flow does not error (lessons from #270 + #281). The CI gate from #270
-- catches regressions on every PR.
--
-- Schema-only here. The data backfill that flips every NULL row to
-- IMPLIED_ON_SUBMIT lives in the next-timestamped migration file —
-- separate concerns, separate diffs.

ALTER TABLE "surveys"
  ADD COLUMN IF NOT EXISTS "consentMode"   "ConsentMode",
  ADD COLUMN IF NOT EXISTS "consentReason" VARCHAR(500);
