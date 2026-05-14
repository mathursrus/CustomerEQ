-- DropForeignKey
ALTER TABLE "conversations" DROP CONSTRAINT "conversations_memberId_fkey";

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_conversationId_fkey";

-- DropIndex (Prisma drift: HNSW index not tracked in schema.prisma because embedding is Unsupported)
-- Immediately recreated below to preserve vector search capability
DROP INDEX "kb_chunks_embedding_hnsw_idx";

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "anonId" TEXT,
ADD COLUMN     "channel" "ConversationChannel" NOT NULL DEFAULT 'WIDGET',
ADD COLUMN     "email" TEXT,
ADD COLUMN     "resolutionSource" "ResolutionSource",
ALTER COLUMN "memberId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "aiConfidence" DOUBLE PRECISION,
ADD COLUMN     "aiSources" JSONB,
ADD COLUMN     "draftedByAi" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "slackTs" TEXT;

-- AlterTable
ALTER TABLE "support_rules" ADD COLUMN     "actionMode" "SupportActionMode" NOT NULL DEFAULT 'ESCALATE',
ADD COLUMN     "confidenceThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.8;

-- CreateIndex
CREATE INDEX "conversations_brandId_channel_status_idx" ON "conversations"("brandId", "channel", "status");

-- CreateIndex
CREATE INDEX "conversations_brandId_anonId_idx" ON "conversations"("brandId", "anonId");

-- CreateIndex
CREATE INDEX "messages_conversationId_role_idx" ON "messages"("conversationId", "role");

-- CreateIndex
CREATE INDEX "support_rules_brandId_status_priority_idx" ON "support_rules"("brandId", "status", "priority");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Recreate HNSW index (dropped above due to Prisma Unsupported drift; must be kept in sync manually)
CREATE INDEX kb_chunks_embedding_hnsw_idx
  ON "kb_chunks"
  USING hnsw ("embedding" vector_cosine_ops);
