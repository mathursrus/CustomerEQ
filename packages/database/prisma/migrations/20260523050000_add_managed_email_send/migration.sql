-- Issue #420 — Send Survey Emails via CustomerEQ (ACS).
-- Per RFC §2: 14-step hand-edited migration. Forward-only.
-- No backfill for Survey.sentCount (matches Survey.responsesCount / distributionCount pattern, schema.prisma:614-615).
-- sentAt stays NOT NULL (per D1 simplification — historical truth preserved; deliveredAt added for MANAGED_EMAIL provider-confirmed semantic).

-- 1. New enum
CREATE TYPE "SurveySendMode" AS ENUM ('SELF_SERVE', 'MANAGED_EMAIL');

-- 2. Brand.managedEmailSenderDomain
ALTER TABLE "brands" ADD COLUMN "managedEmailSenderDomain" TEXT;

-- 3. Member.unsubscribedSurveysAt — distinct from Member.emailOptIn (marketing-channel preference).
--    Survey dispatcher gate excludes emailOptIn per legitimate-interest exemption (R44).
ALTER TABLE "members" ADD COLUMN "unsubscribedSurveysAt" TIMESTAMP(3);

-- 4. Survey.sentCount — denormalized aggregate, default 0; no historical backfill.
ALTER TABLE "surveys" ADD COLUMN "sentCount" INTEGER NOT NULL DEFAULT 0;

-- 5. DistributionBatch.sendMode — every existing batch was a #378 SELF_SERVE batch.
ALTER TABLE "distribution_batches" ADD COLUMN "sendMode" "SurveySendMode" NOT NULL DEFAULT 'SELF_SERVE';

-- 6. DistributionBatch.composerSnapshot — JSONB for MANAGED_EMAIL composer state; null for SELF_SERVE.
ALTER TABLE "distribution_batches" ADD COLUMN "composerSnapshot" JSONB;

-- 7-11. SurveyDistribution per-recipient MANAGED_EMAIL lifecycle columns
ALTER TABLE "survey_distributions" ADD COLUMN "enqueuedAt"    TIMESTAMP(3);
ALTER TABLE "survey_distributions" ADD COLUMN "deliveredAt"   TIMESTAMP(3);
ALTER TABLE "survey_distributions" ADD COLUMN "failedAt"      TIMESTAMP(3);
ALTER TABLE "survey_distributions" ADD COLUMN "failureReason" TEXT;
ALTER TABLE "survey_distributions" ADD COLUMN "sendMode" "SurveySendMode" NOT NULL DEFAULT 'SELF_SERVE';

-- 12. MemberUnsubscribeToken — per-recipient unsubscribe token (mirrors #378 SurveyDistributionToken pattern).
CREATE TABLE "member_unsubscribe_tokens" (
    "id"          TEXT NOT NULL,
    "brandId"     TEXT NOT NULL,
    "memberId"    TEXT NOT NULL,
    "batchId"     TEXT NOT NULL,
    "tokenHash"   TEXT NOT NULL,
    "tokenPrefix" TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumedAt"  TIMESTAMP(3),

    CONSTRAINT "member_unsubscribe_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "member_unsubscribe_tokens_tokenHash_key" ON "member_unsubscribe_tokens"("tokenHash");
CREATE INDEX "member_unsubscribe_tokens_memberId_idx" ON "member_unsubscribe_tokens"("memberId");

ALTER TABLE "member_unsubscribe_tokens"
    ADD CONSTRAINT "member_unsubscribe_tokens_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "members"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "member_unsubscribe_tokens"
    ADD CONSTRAINT "member_unsubscribe_tokens_batchId_fkey"
    FOREIGN KEY ("batchId") REFERENCES "distribution_batches"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- 13-14. SurveyDistribution per-mode aggregation indexes
CREATE INDEX "survey_distributions_surveyId_sendMode_deliveredAt_idx" ON "survey_distributions" ("surveyId", "sendMode", "deliveredAt");
CREATE INDEX "survey_distributions_surveyId_sendMode_sentAt_idx" ON "survey_distributions" ("surveyId", "sendMode", "sentAt");
