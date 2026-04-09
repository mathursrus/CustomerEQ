-- Issue #80: Response-to-Action Rule Builder and Loop Monitor
-- New tables: cx_playbooks, survey_rules
-- Column additions: surveys.distribution_count, campaigns.survey_id, campaign_events.survey_response_id

-- ─── New tables ───────────────────────────────────────────────────────────────

CREATE TABLE "cx_playbooks" (
  "id"          TEXT NOT NULL,
  "brandId"     TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "surveyType"  TEXT NOT NULL,
  "rules"       JSONB NOT NULL,
  "deletedAt"   TIMESTAMPTZ,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "cx_playbooks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cx_playbooks_brandId_name_key" UNIQUE ("brandId", "name"),
  CONSTRAINT "cx_playbooks_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "cx_playbooks_brandId_surveyType_idx" ON "cx_playbooks"("brandId", "surveyType");

CREATE TABLE "survey_rules" (
  "id"           TEXT NOT NULL,
  "brandId"      TEXT NOT NULL,
  "surveyId"     TEXT NOT NULL,
  "campaignId"   TEXT NOT NULL,
  "scoreMin"     DOUBLE PRECISION NOT NULL,
  "scoreMax"     DOUBLE PRECISION NOT NULL,
  "actionType"   TEXT NOT NULL,
  "actionConfig" JSONB NOT NULL,
  "ruleLabel"    TEXT,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "survey_rules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "survey_rules_campaignId_key" UNIQUE ("campaignId"),
  CONSTRAINT "survey_rules_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "surveys"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "survey_rules_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "survey_rules_surveyId_idx" ON "survey_rules"("surveyId");
CREATE INDEX "survey_rules_brandId_idx" ON "survey_rules"("brandId");

-- ─── Column additions ────────────────────────────────────────────────────────

-- surveys: distribution count for Loop Monitor "Surveys Sent" stage
ALTER TABLE "surveys" ADD COLUMN "distributionCount" INTEGER NOT NULL DEFAULT 0;

-- campaigns: denormalized survey FK for loop monitor queries
ALTER TABLE "campaigns" ADD COLUMN "surveyId" TEXT;
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_surveyId_fkey"
  FOREIGN KEY ("surveyId") REFERENCES "surveys"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "campaigns_surveyId_idx" ON "campaigns"("surveyId");

-- campaign_events: FK to survey_responses for loop monitor linkage
ALTER TABLE "campaign_events" ADD COLUMN "surveyResponseId" TEXT;
ALTER TABLE "campaign_events" ADD CONSTRAINT "campaign_events_surveyResponseId_fkey"
  FOREIGN KEY ("surveyResponseId") REFERENCES "survey_responses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "campaign_events_campaignId_surveyResponseId_idx"
  ON "campaign_events"("campaignId", "surveyResponseId");
