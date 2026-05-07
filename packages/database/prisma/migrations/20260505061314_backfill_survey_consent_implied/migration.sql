-- Issue #276 — Backfill all NULL consentMode rows to IMPLIED_ON_SUBMIT so
-- pre-existing surveys accept responses again (P0 production hotfix).
--
-- All brands, all organizations — per round-1 reviewer scope decision.
-- WHERE consentMode IS NULL makes this idempotent: a second run touches
-- zero rows (no Survey.updatedAt advances).
--
-- Audit columns get the fixed system identifier `__migration_276__` so the
-- audit-trail surface (#241, when it ships) can distinguish "machine-set
-- by hotfix" from "human-set by survey owner". Reason text is 191 chars,
-- well within the 500-char column cap.

UPDATE "surveys"
SET
  "consentMode"                  = 'IMPLIED_ON_SUBMIT',
  "consentSuppressedAttestedBy"  = '__migration_276__',
  "consentSuppressedAttestedAt"  = NOW(),
  "consentReason"                = 'Production hotfix #276 — pre-existing survey defaulting to IMPLIED_ON_SUBMIT to restore response collection. Override may be tightened by survey owner via #241 UX once shipped.'
WHERE "consentMode" IS NULL;
