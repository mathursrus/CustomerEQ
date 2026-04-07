-- CreateEnum
CREATE TYPE "ExternalSourceType" AS ENUM ('GOOGLE_BUSINESS_PROFILE', 'LINKEDIN_ORG', 'REDDIT', 'X', 'GENERIC_WEBHOOK', 'GENERIC_API');

-- CreateEnum
CREATE TYPE "ExternalSyncMode" AS ENUM ('WEBHOOK', 'POLL', 'MANUAL');

-- CreateEnum
CREATE TYPE "ExternalSignalStatus" AS ENUM ('ACTIVE', 'HIDDEN', 'DELETED');

-- CreateEnum
CREATE TYPE "ExternalMatchStatus" AS ENUM ('UNMATCHED', 'CANDIDATE', 'MATCHED', 'REJECTED');

-- CreateTable
CREATE TABLE "external_signal_sources" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceType" "ExternalSourceType" NOT NULL,
    "connectionMethod" TEXT NOT NULL,
    "syncMode" "ExternalSyncMode" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "scopeConfig" JSONB NOT NULL,
    "filterConfig" JSONB,
    "matchingConfig" JSONB,
    "credentialRef" TEXT,
    "healthStatus" TEXT NOT NULL DEFAULT 'never_synced',
    "lastCursor" JSONB,
    "lastSyncAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastImportCount" INTEGER,
    "lastError" TEXT,
    "lastErrorAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_signal_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_signals" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "memberId" TEXT,
    "sourceType" "ExternalSourceType" NOT NULL,
    "externalId" TEXT NOT NULL,
    "status" "ExternalSignalStatus" NOT NULL DEFAULT 'ACTIVE',
    "matchStatus" "ExternalMatchStatus" NOT NULL DEFAULT 'UNMATCHED',
    "matchConfidence" DOUBLE PRECISION,
    "matchMethod" TEXT,
    "body" TEXT NOT NULL,
    "summary" TEXT,
    "rating" DOUBLE PRECISION,
    "sentiment" DOUBLE PRECISION,
    "confidence" DOUBLE PRECISION,
    "topics" TEXT[],
    "canonicalUrl" TEXT,
    "externalAuthorHandle" TEXT,
    "externalAuthorLabel" TEXT,
    "subjectType" TEXT,
    "subjectKey" TEXT,
    "subjectLabel" TEXT,
    "providerStatus" TEXT,
    "statusHistory" JSONB NOT NULL DEFAULT '[]',
    "providerMetadata" JSONB,
    "rawPayload" JSONB NOT NULL,
    "postedAt" TIMESTAMP(3),
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_signals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "external_signal_sources_brandId_enabled_idx" ON "external_signal_sources"("brandId", "enabled");

-- CreateIndex
CREATE INDEX "external_signal_sources_brandId_sourceType_idx" ON "external_signal_sources"("brandId", "sourceType");

-- CreateIndex
CREATE INDEX "external_signals_brandId_postedAt_idx" ON "external_signals"("brandId", "postedAt");

-- CreateIndex
CREATE INDEX "external_signals_brandId_matchStatus_postedAt_idx" ON "external_signals"("brandId", "matchStatus", "postedAt");

-- CreateIndex
CREATE INDEX "external_signals_brandId_memberId_postedAt_idx" ON "external_signals"("brandId", "memberId", "postedAt");

-- CreateIndex
CREATE UNIQUE INDEX "external_signals_sourceId_externalId_key" ON "external_signals"("sourceId", "externalId");

-- AddForeignKey
ALTER TABLE "external_signal_sources" ADD CONSTRAINT "external_signal_sources_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_signals" ADD CONSTRAINT "external_signals_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_signals" ADD CONSTRAINT "external_signals_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "external_signal_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_signals" ADD CONSTRAINT "external_signals_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
