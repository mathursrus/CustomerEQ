/*
  Warnings:

  - You are about to drop the column `email_opt_in` on the `members` table. All the data in the column will be lost.
  - You are about to drop the column `sms_opt_in` on the `members` table. All the data in the column will be lost.
  - Changed the type of `surveyType` on the `cx_playbooks` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropIndex
DROP INDEX "member_notes_brandId_memberId_createdAt_idx";

-- AlterTable
ALTER TABLE "campaign_events" ADD COLUMN     "result" JSONB;

-- AlterTable
ALTER TABLE "cx_playbooks" DROP COLUMN "surveyType",
ADD COLUMN     "surveyType" "SurveyType" NOT NULL,
ALTER COLUMN "deletedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "member_notes" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "members" DROP COLUMN "email_opt_in",
DROP COLUMN "sms_opt_in",
ADD COLUMN     "emailOptIn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "smsOptIn" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "programs" ALTER COLUMN "slug" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "survey_responses" ADD COLUMN     "clusterId" TEXT,
ADD COLUMN     "confidence" DOUBLE PRECISION,
ADD COLUMN     "summary" TEXT;

-- AlterTable
ALTER TABLE "survey_rules" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "surveys" ADD COLUMN     "themeId" TEXT;

-- CreateTable
CREATE TABLE "survey_distributions" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_distributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_themes" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "logoUrl" TEXT,
    "brandName" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#6366f1',
    "secondaryColor" TEXT NOT NULL DEFAULT '#818cf8',
    "backgroundColor" TEXT NOT NULL DEFAULT '#ffffff',
    "textColor" TEXT NOT NULL DEFAULT '#111827',
    "buttonColor" TEXT NOT NULL DEFAULT '#6366f1',
    "buttonTextColor" TEXT NOT NULL DEFAULT '#ffffff',
    "accentColor" TEXT NOT NULL DEFAULT '#6366f1',
    "fontFamily" TEXT NOT NULL DEFAULT 'system-ui',
    "headingSize" TEXT NOT NULL DEFAULT 'md',
    "bodySize" TEXT NOT NULL DEFAULT 'md',
    "backgroundImageUrl" TEXT,
    "cardStyle" TEXT NOT NULL DEFAULT 'shadow',
    "borderRadius" TEXT NOT NULL DEFAULT 'md',
    "maxWidth" TEXT NOT NULL DEFAULT 'md',
    "thankYouMessage" TEXT NOT NULL DEFAULT 'Thank you for your feedback!',
    "thankYouRedirectUrl" TEXT,
    "showIncentivePoints" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "survey_themes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_templates" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "question" JSONB NOT NULL,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_clusters" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "keywords" TEXT[],
    "avgSentiment" DOUBLE PRECISION,
    "responseCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_clusters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cluster_snapshots" (
    "id" TEXT NOT NULL,
    "clusterId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "bucketDate" TIMESTAMP(3) NOT NULL,
    "volume" INTEGER NOT NULL,
    "avgSentiment" DOUBLE PRECISION,
    "isAnomaly" BOOLEAN NOT NULL DEFAULT false,
    "zScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cluster_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_anomalies" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "clusterId" TEXT,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "feedback_anomalies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_rules" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "surveyTypes" TEXT[],
    "scoreMin" DOUBLE PRECISION,
    "scoreMax" DOUBLE PRECISION,
    "sentimentThreshold" DOUBLE PRECISION,
    "topicFilters" TEXT[],
    "slackWebhookUrl" TEXT,
    "slackChannelName" TEXT,
    "emailRecipients" TEXT[],
    "teamsWebhookUrl" TEXT,
    "defaultAssignee" TEXT NOT NULL,
    "assignmentRules" JSONB NOT NULL DEFAULT '[]',
    "slaHours" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alert_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_follow_ups" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "alertRuleId" TEXT NOT NULL,
    "surveyResponseId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "assignee" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "slaDeadline" TIMESTAMP(3),
    "slaBreachedAt" TIMESTAMP(3),
    "slackMessageTs" TEXT,
    "notes" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "contactedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "case_follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "survey_distributions_surveyId_memberId_sentAt_idx" ON "survey_distributions"("surveyId", "memberId", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "survey_distributions_surveyId_memberId_key" ON "survey_distributions"("surveyId", "memberId");

-- CreateIndex
CREATE INDEX "survey_themes_brandId_idx" ON "survey_themes"("brandId");

-- CreateIndex
CREATE INDEX "question_templates_brandId_idx" ON "question_templates"("brandId");

-- CreateIndex
CREATE INDEX "feedback_clusters_brandId_isActive_idx" ON "feedback_clusters"("brandId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_clusters_brandId_label_key" ON "feedback_clusters"("brandId", "label");

-- CreateIndex
CREATE INDEX "cluster_snapshots_brandId_bucketDate_idx" ON "cluster_snapshots"("brandId", "bucketDate");

-- CreateIndex
CREATE UNIQUE INDEX "cluster_snapshots_clusterId_bucketDate_key" ON "cluster_snapshots"("clusterId", "bucketDate");

-- CreateIndex
CREATE INDEX "feedback_anomalies_brandId_detectedAt_idx" ON "feedback_anomalies"("brandId", "detectedAt");

-- CreateIndex
CREATE INDEX "alert_rules_brandId_status_idx" ON "alert_rules"("brandId", "status");

-- CreateIndex
CREATE INDEX "case_follow_ups_brandId_status_idx" ON "case_follow_ups"("brandId", "status");

-- CreateIndex
CREATE INDEX "case_follow_ups_alertRuleId_idx" ON "case_follow_ups"("alertRuleId");

-- CreateIndex
CREATE INDEX "cx_playbooks_brandId_surveyType_idx" ON "cx_playbooks"("brandId", "surveyType");

-- CreateIndex
CREATE INDEX "member_notes_brandId_memberId_createdAt_idx" ON "member_notes"("brandId", "memberId", "createdAt");

-- CreateIndex
CREATE INDEX "survey_responses_clusterId_idx" ON "survey_responses"("clusterId");

-- CreateIndex
CREATE INDEX "surveys_brandId_triggerKey_status_idx" ON "surveys"("brandId", "triggerKey", "status");

-- AddForeignKey
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "survey_themes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_distributions" ADD CONSTRAINT "survey_distributions_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "surveys"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_distributions" ADD CONSTRAINT "survey_distributions_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_themes" ADD CONSTRAINT "survey_themes_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_templates" ADD CONSTRAINT "question_templates_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "feedback_clusters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cluster_snapshots" ADD CONSTRAINT "cluster_snapshots_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "feedback_clusters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_follow_ups" ADD CONSTRAINT "case_follow_ups_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_follow_ups" ADD CONSTRAINT "case_follow_ups_alertRuleId_fkey" FOREIGN KEY ("alertRuleId") REFERENCES "alert_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
