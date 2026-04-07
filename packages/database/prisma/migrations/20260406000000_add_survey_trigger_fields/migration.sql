-- Issue #79: Survey Trigger Wizard — add trigger fields to surveys table
-- and composite index on loyalty_events for reach-estimate query performance.

-- Add nullable trigger fields to surveys (backwards compatible)
ALTER TABLE "surveys" ADD COLUMN "triggerCategory" TEXT;
ALTER TABLE "surveys" ADD COLUMN "triggerKey" TEXT;
ALTER TABLE "surveys" ADD COLUMN "surveyTypeOverride" TEXT;

-- Composite index on loyalty_events for reach-estimate query (Issue #79)
CREATE INDEX "loyalty_events_brandId_eventType_createdAt_idx"
  ON "loyalty_events" ("brandId", "eventType", "createdAt");
