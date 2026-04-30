-- Patch: complete gaps left by the partial application of
-- 20260427200452_add_survey_distribution.  That migration failed mid-run with
-- PG error 42704 (SurveyType enum not found on cx_playbooks ALTER TABLE) and
-- committed without a transaction rollback, leaving the schema inconsistent.
--
-- State going in:
--   members.emailOptIn / smsOptIn  EXISTS  (rename happened)
--   survey_themes, alert_rules, feedback_clusters, question_templates,
--   cluster_snapshots, feedback_anomalies, case_follow_ups              EXISTS
--   survey_distributions                                                MISSING
--   cx_playbooks.surveyType                             still TEXT (enum exists)
--   cx_playbooks timestamp columns                              not yet altered
--   surveys_brandId_triggerKey_status_idx                              MISSING
--   member_notes_brandId_memberId_createdAt_idx            dropped, may be gone

-- ── 1. Fix cx_playbooks ──────────────────────────────────────────────────────
-- Table has 0 rows: DROP+ADD NOT NULL is safe.
-- Dropping the column auto-drops cx_playbooks_brandId_surveyType_idx.
ALTER TABLE "cx_playbooks"
  DROP COLUMN "surveyType",
  ADD COLUMN  "surveyType" "SurveyType" NOT NULL,
  ALTER COLUMN "deletedAt" SET DATA TYPE TIMESTAMP(3),
  ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
  ALTER COLUMN "updatedAt" DROP DEFAULT,
  ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

CREATE INDEX "cx_playbooks_brandId_surveyType_idx"
  ON "cx_playbooks"("brandId", "surveyType");

-- ── 2. Create survey_distributions ──────────────────────────────────────────
CREATE TABLE "survey_distributions" (
    "id"       TEXT          NOT NULL,
    "surveyId" TEXT          NOT NULL,
    "memberId" TEXT          NOT NULL,
    "brandId"  TEXT          NOT NULL,
    "sentAt"   TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "survey_distributions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "survey_distributions_surveyId_memberId_sentAt_idx"
  ON "survey_distributions"("surveyId", "memberId", "sentAt");

CREATE UNIQUE INDEX "survey_distributions_surveyId_memberId_key"
  ON "survey_distributions"("surveyId", "memberId");

ALTER TABLE "survey_distributions"
  ADD CONSTRAINT "survey_distributions_surveyId_fkey"
  FOREIGN KEY ("surveyId") REFERENCES "surveys"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "survey_distributions"
  ADD CONSTRAINT "survey_distributions_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "members"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── 3. Missing indexes ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "surveys_brandId_triggerKey_status_idx"
  ON "surveys"("brandId", "triggerKey", "status");

-- Dropped in step 1 of original migration; may or may not have been recreated.
CREATE INDEX IF NOT EXISTS "member_notes_brandId_memberId_createdAt_idx"
  ON "member_notes"("brandId", "memberId", "createdAt");

-- Indexes on tables that were created by the partial run — may already exist.
CREATE INDEX IF NOT EXISTS "survey_themes_brandId_idx"
  ON "survey_themes"("brandId");

CREATE INDEX IF NOT EXISTS "question_templates_brandId_idx"
  ON "question_templates"("brandId");

CREATE INDEX IF NOT EXISTS "feedback_clusters_brandId_isActive_idx"
  ON "feedback_clusters"("brandId", "isActive");

CREATE UNIQUE INDEX IF NOT EXISTS "feedback_clusters_brandId_label_key"
  ON "feedback_clusters"("brandId", "label");

CREATE INDEX IF NOT EXISTS "cluster_snapshots_brandId_bucketDate_idx"
  ON "cluster_snapshots"("brandId", "bucketDate");

CREATE UNIQUE INDEX IF NOT EXISTS "cluster_snapshots_clusterId_bucketDate_key"
  ON "cluster_snapshots"("clusterId", "bucketDate");

CREATE INDEX IF NOT EXISTS "feedback_anomalies_brandId_detectedAt_idx"
  ON "feedback_anomalies"("brandId", "detectedAt");

CREATE INDEX IF NOT EXISTS "alert_rules_brandId_status_idx"
  ON "alert_rules"("brandId", "status");

CREATE INDEX IF NOT EXISTS "case_follow_ups_brandId_status_idx"
  ON "case_follow_ups"("brandId", "status");

CREATE INDEX IF NOT EXISTS "case_follow_ups_alertRuleId_idx"
  ON "case_follow_ups"("alertRuleId");

-- ── 4. FK constraints (idempotent — skip if already present) ─────────────────
DO $$ BEGIN
  ALTER TABLE "surveys" ADD CONSTRAINT "surveys_themeId_fkey"
    FOREIGN KEY ("themeId") REFERENCES "survey_themes"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "survey_themes" ADD CONSTRAINT "survey_themes_brandId_fkey"
    FOREIGN KEY ("brandId") REFERENCES "brands"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "question_templates" ADD CONSTRAINT "question_templates_brandId_fkey"
    FOREIGN KEY ("brandId") REFERENCES "brands"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_clusterId_fkey"
    FOREIGN KEY ("clusterId") REFERENCES "feedback_clusters"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "cluster_snapshots" ADD CONSTRAINT "cluster_snapshots_clusterId_fkey"
    FOREIGN KEY ("clusterId") REFERENCES "feedback_clusters"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_brandId_fkey"
    FOREIGN KEY ("brandId") REFERENCES "brands"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "case_follow_ups" ADD CONSTRAINT "case_follow_ups_brandId_fkey"
    FOREIGN KEY ("brandId") REFERENCES "brands"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "case_follow_ups" ADD CONSTRAINT "case_follow_ups_alertRuleId_fkey"
    FOREIGN KEY ("alertRuleId") REFERENCES "alert_rules"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
