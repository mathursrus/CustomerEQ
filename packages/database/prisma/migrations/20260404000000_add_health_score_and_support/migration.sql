-- Phase B: Add health score fields to Member
ALTER TABLE "members" ADD COLUMN "healthScore" INTEGER;
ALTER TABLE "members" ADD COLUMN "healthScoreUpdatedAt" TIMESTAMP(3);
CREATE INDEX "members_brandId_healthScore_idx" ON "members"("brandId", "healthScore");

-- Phase D: Create enums for support widget
CREATE TYPE "ConversationStatus" AS ENUM ('ACTIVE', 'WAITING_ON_CUSTOMER', 'ESCALATED', 'RESOLVED', 'CLOSED');
CREATE TYPE "MessageRole" AS ENUM ('CUSTOMER', 'AI', 'AGENT');

-- Phase D: Create conversations table
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "status" "ConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "intent" TEXT,
    "confidence" DOUBLE PRECISION,
    "topic" TEXT,
    "summary" TEXT,
    "assignee" TEXT,
    "caseFollowUpId" TEXT,
    "escalatedAt" TIMESTAMP(3),
    "rulesMatched" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- Phase D: Create messages table
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- Phase D: Create support_rules table
CREATE TABLE "support_rules" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "intentFilters" TEXT[],
    "tierFilters" TEXT[],
    "healthScoreMin" DOUBLE PRECISION,
    "healthScoreMax" DOUBLE PRECISION,
    "topicFilters" TEXT[],
    "conditions" JSONB NOT NULL DEFAULT '{}',
    "autoRespondArticleId" TEXT,
    "escalateToAssignee" TEXT,
    "awardPoints" INTEGER,
    "triggerSurveyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_rules_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "conversations_brandId_status_idx" ON "conversations"("brandId", "status");
CREATE INDEX "conversations_memberId_idx" ON "conversations"("memberId");
CREATE INDEX "conversations_brandId_createdAt_idx" ON "conversations"("brandId", "createdAt");
CREATE INDEX "messages_conversationId_createdAt_idx" ON "messages"("conversationId", "createdAt");
CREATE INDEX "support_rules_brandId_status_idx" ON "support_rules"("brandId", "status");

-- Foreign keys
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "support_rules" ADD CONSTRAINT "support_rules_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
