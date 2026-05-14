-- CreateEnum
CREATE TYPE "CSATRating" AS ENUM ('THUMBS_UP', 'THUMBS_DOWN');

-- DropIndex
DROP INDEX "kb_chunks_embedding_hnsw_idx";

-- AlterTable
ALTER TABLE "brands" ADD COLUMN     "slackSigningSecret" TEXT,
ADD COLUMN     "slackSupportWebhookUrl" TEXT;

-- CreateTable
CREATE TABLE "csat_responses" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "rating" "CSATRating" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "csat_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "csat_responses_conversationId_key" ON "csat_responses"("conversationId");

-- CreateIndex
CREATE INDEX "csat_responses_brandId_createdAt_idx" ON "csat_responses"("brandId", "createdAt");

-- AddForeignKey
ALTER TABLE "csat_responses" ADD CONSTRAINT "csat_responses_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csat_responses" ADD CONSTRAINT "csat_responses_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Recreate HNSW index (dropped above due to Prisma Unsupported drift; must be kept in sync manually)
CREATE INDEX kb_chunks_embedding_hnsw_idx
  ON "kb_chunks"
  USING hnsw ("embedding" vector_cosine_ops);
