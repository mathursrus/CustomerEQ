-- CreateEnum
CREATE TYPE "KBSourceKind" AS ENUM ('MANUAL', 'URL', 'SITEMAP');

-- CreateEnum
CREATE TYPE "KBSourceStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "ChunkEmbedStatus" AS ENUM ('PENDING', 'EMBEDDED', 'FAILED');

-- CreateEnum
CREATE TYPE "SupportActionMode" AS ENUM ('AUTO_REPLY', 'DRAFT_FOR_AGENT', 'ESCALATE');

-- CreateEnum
CREATE TYPE "ResolutionSource" AS ENUM ('CSAT', 'AI_TIMEOUT', 'AGENT');

-- CreateEnum
CREATE TYPE "ConversationChannel" AS ENUM ('WIDGET', 'SLACK');

-- DropForeignKey
ALTER TABLE "survey_responses" DROP CONSTRAINT "survey_responses_memberId_fkey";

-- DropIndex
DROP INDEX "mcp_oauth_codes_expiresAt_idx";

-- DropIndex
DROP INDEX "survey_import_batches_brandId_createdAt_idx";

-- AlterTable
ALTER TABLE "case_follow_ups" ALTER COLUMN "surveyResponseId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "kb_articles" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "contentHash" TEXT,
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "sourceId" TEXT,
ADD COLUMN     "sourceUrl" TEXT;

-- AlterTable
ALTER TABLE "survey_import_batches" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "kb_sources" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "kind" "KBSourceKind" NOT NULL,
    "url" TEXT,
    "title" TEXT NOT NULL,
    "status" "KBSourceStatus" NOT NULL DEFAULT 'ACTIVE',
    "crawlCron" TEXT,
    "lastCrawledAt" TIMESTAMP(3),
    "lastErrorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kb_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kb_chunks" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "tokenCount" INTEGER NOT NULL,
    "embedding" public.vector(1536),
    "embedStatus" "ChunkEmbedStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kb_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kb_sources_brandId_status_idx" ON "kb_sources"("brandId", "status");

-- CreateIndex
CREATE INDEX "kb_sources_brandId_kind_idx" ON "kb_sources"("brandId", "kind");

-- CreateIndex
CREATE INDEX "kb_chunks_brandId_idx" ON "kb_chunks"("brandId");

-- CreateIndex
CREATE INDEX "kb_chunks_articleId_chunkIndex_idx" ON "kb_chunks"("articleId", "chunkIndex");

-- CreateIndex
CREATE INDEX "kb_articles_brandId_sourceId_idx" ON "kb_articles"("brandId", "sourceId");

-- CreateIndex
CREATE INDEX "mcp_oauth_codes_code_idx" ON "mcp_oauth_codes"("code");

-- CreateIndex
CREATE INDEX "survey_import_batches_brandId_createdAt_idx" ON "survey_import_batches"("brandId", "createdAt");

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_follow_ups" ADD CONSTRAINT "case_follow_ups_surveyResponseId_fkey" FOREIGN KEY ("surveyResponseId") REFERENCES "survey_responses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kb_sources" ADD CONSTRAINT "kb_sources_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kb_chunks" ADD CONSTRAINT "kb_chunks_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "kb_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kb_articles" ADD CONSTRAINT "kb_articles_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "kb_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- HNSW index for cosine-similarity retrieval (top-K queries are brandId-filtered)
CREATE INDEX kb_chunks_embedding_hnsw_idx
  ON "kb_chunks"
  USING hnsw ("embedding" vector_cosine_ops);
