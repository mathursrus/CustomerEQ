-- CreateEnum
CREATE TYPE "ProgramType" AS ENUM ('POINTS', 'TIERED', 'CASHBACK', 'HYBRID');

-- CreateEnum
CREATE TYPE "HaltBehavior" AS ENUM ('PAUSE_PROGRAM', 'PAUSE_RULES');

-- CreateEnum
CREATE TYPE "RewardType" AS ENUM ('DISCOUNT', 'FREE_ITEM', 'EXPERIENCE', 'VOUCHER');

-- CreateEnum
CREATE TYPE "ProgramStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RuleStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ERASED');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "RedemptionStatus" AS ENUM ('PENDING', 'FULFILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SurveyType" AS ENUM ('NPS', 'CSAT', 'CES', 'CUSTOM');

-- CreateEnum
CREATE TYPE "SurveyStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'CLOSED');

-- CreateTable
CREATE TABLE "brands" (
    "id" TEXT NOT NULL,
    "clerkOrgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "programs" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "pointCurrencyName" TEXT NOT NULL DEFAULT 'Points',
    "pointToCurrencyRatio" DOUBLE PRECISION NOT NULL DEFAULT 0.01,
    "status" "ProgramStatus" NOT NULL DEFAULT 'DRAFT',
    "type" "ProgramType" NOT NULL DEFAULT 'POINTS',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "budgetUsdCents" INTEGER,
    "monthlyBudgetUsdCents" INTEGER,
    "budgetSpentCents" INTEGER NOT NULL DEFAULT 0,
    "alertThresholdPct" DOUBLE PRECISION,
    "haltBehavior" "HaltBehavior",
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "earning_rules" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "triggerEvent" TEXT NOT NULL,
    "pointsAwarded" INTEGER NOT NULL,
    "multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "conditions" JSONB,
    "maxUsesPerMember" INTEGER,
    "status" "RuleStatus" NOT NULL DEFAULT 'ACTIVE',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "stackable" BOOLEAN NOT NULL DEFAULT false,
    "budgetCapPoints" INTEGER,
    "budgetUsedPoints" INTEGER NOT NULL DEFAULT 0,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "earning_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "members" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "clerkUserId" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "phone" TEXT,
    "pointsBalance" INTEGER NOT NULL DEFAULT 0,
    "status" "MemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "consentGivenAt" TIMESTAMP(3),
    "consentVersion" TEXT,
    "deletedAt" TIMESTAMP(3),
    "currentTierId" TEXT,
    "erased" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_events" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "pointsEarned" INTEGER NOT NULL,
    "payload" JSONB,
    "idempotencyKey" TEXT,
    "rulesApplied" TEXT[],
    "campaignId" TEXT,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rewards" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "pointsCost" INTEGER NOT NULL,
    "stock" INTEGER,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "type" "RewardType",
    "availableFrom" TIMESTAMP(3),
    "availableTo" TIMESTAMP(3),
    "eligibleTierIds" TEXT[],
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tiers" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "icon" TEXT,
    "minPoints" INTEGER,
    "minSpendCents" INTEGER,
    "benefits" TEXT[],
    "multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program_versions" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'explicit_save',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "program_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "redemptions" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "rewardId" TEXT NOT NULL,
    "pointsSpent" INTEGER NOT NULL,
    "status" "RedemptionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "triggerCondition" JSONB NOT NULL,
    "actionType" TEXT NOT NULL,
    "actionConfig" JSONB NOT NULL,
    "budgetCap" DOUBLE PRECISION,
    "budgetSpent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_events" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executedAt" TIMESTAMP(3),
    "latencyMs" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'executed',

    CONSTRAINT "campaign_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "surveys" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "SurveyType" NOT NULL DEFAULT 'NPS',
    "questions" JSONB NOT NULL,
    "settings" JSONB,
    "status" "SurveyStatus" NOT NULL DEFAULT 'DRAFT',
    "responsesCount" INTEGER NOT NULL DEFAULT 0,
    "incentivePoints" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "surveys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_responses" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "score" DOUBLE PRECISION,
    "sentiment" DOUBLE PRECISION,
    "topics" TEXT[],
    "channel" TEXT NOT NULL DEFAULT 'link',
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demo_requests" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "workEmail" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "companySize" TEXT,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demo_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "brandId" TEXT,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "brands_clerkOrgId_key" ON "brands"("clerkOrgId");

-- CreateIndex
CREATE INDEX "programs_brandId_idx" ON "programs"("brandId");

-- CreateIndex
CREATE INDEX "earning_rules_programId_status_idx" ON "earning_rules"("programId", "status");

-- CreateIndex
CREATE INDEX "earning_rules_brandId_idx" ON "earning_rules"("brandId");

-- CreateIndex
CREATE INDEX "members_brandId_idx" ON "members"("brandId");

-- CreateIndex
CREATE INDEX "members_clerkUserId_brandId_idx" ON "members"("clerkUserId", "brandId");

-- CreateIndex
CREATE UNIQUE INDEX "members_brandId_email_key" ON "members"("brandId", "email");

-- CreateIndex
CREATE INDEX "loyalty_events_brandId_createdAt_idx" ON "loyalty_events"("brandId", "createdAt");

-- CreateIndex
CREATE INDEX "loyalty_events_memberId_idx" ON "loyalty_events"("memberId");

-- CreateIndex
CREATE INDEX "loyalty_events_idempotencyKey_idx" ON "loyalty_events"("idempotencyKey");

-- CreateIndex
CREATE INDEX "rewards_brandId_isAvailable_idx" ON "rewards"("brandId", "isAvailable");

-- CreateIndex
CREATE INDEX "tiers_programId_rank_idx" ON "tiers"("programId", "rank");

-- CreateIndex
CREATE INDEX "tiers_brandId_idx" ON "tiers"("brandId");

-- CreateIndex
CREATE INDEX "program_versions_programId_idx" ON "program_versions"("programId");

-- CreateIndex
CREATE INDEX "program_versions_brandId_idx" ON "program_versions"("brandId");

-- CreateIndex
CREATE INDEX "redemptions_brandId_memberId_idx" ON "redemptions"("brandId", "memberId");

-- CreateIndex
CREATE INDEX "campaigns_brandId_status_idx" ON "campaigns"("brandId", "status");

-- CreateIndex
CREATE INDEX "campaign_events_brandId_campaignId_idx" ON "campaign_events"("brandId", "campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_events_campaignId_memberId_key" ON "campaign_events"("campaignId", "memberId");

-- CreateIndex
CREATE INDEX "surveys_brandId_status_idx" ON "surveys"("brandId", "status");

-- CreateIndex
CREATE INDEX "survey_responses_brandId_completedAt_idx" ON "survey_responses"("brandId", "completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "survey_responses_surveyId_memberId_key" ON "survey_responses"("surveyId", "memberId");

-- CreateIndex
CREATE INDEX "demo_requests_createdAt_idx" ON "demo_requests"("createdAt");

-- CreateIndex
CREATE INDEX "audit_events_brandId_createdAt_idx" ON "audit_events"("brandId", "createdAt");

-- AddForeignKey
ALTER TABLE "programs" ADD CONSTRAINT "programs_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "earning_rules" ADD CONSTRAINT "earning_rules_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_currentTierId_fkey" FOREIGN KEY ("currentTierId") REFERENCES "tiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_events" ADD CONSTRAINT "loyalty_events_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tiers" ADD CONSTRAINT "tiers_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_versions" ADD CONSTRAINT "program_versions_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "rewards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_events" ADD CONSTRAINT "campaign_events_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_events" ADD CONSTRAINT "campaign_events_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "surveys"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
