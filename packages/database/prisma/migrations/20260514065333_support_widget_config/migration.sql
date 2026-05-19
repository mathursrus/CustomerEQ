-- CreateEnum
CREATE TYPE "WidgetPosition" AS ENUM ('BOTTOM_RIGHT', 'BOTTOM_LEFT');

-- DropIndex
DROP INDEX "kb_chunks_embedding_hnsw_idx";

-- CreateTable
CREATE TABLE "support_widget_configs" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "position" "WidgetPosition" NOT NULL DEFAULT 'BOTTOM_RIGHT',
    "launcherIconUrl" TEXT,
    "darkModeAuto" BOOLEAN NOT NULL DEFAULT false,
    "greeting" TEXT NOT NULL DEFAULT 'Hi! How can we help?',
    "offlineMessage" TEXT NOT NULL DEFAULT 'We''re not online right now. Leave us a message and we''ll get back to you.',
    "csatPromptText" TEXT NOT NULL DEFAULT 'Did this help?',
    "escalateButtonText" TEXT NOT NULL DEFAULT 'Talk to a human',
    "showCsatAfterAi" BOOLEAN NOT NULL DEFAULT true,
    "csatTimeoutSeconds" INTEGER NOT NULL DEFAULT 30,
    "anonAllowed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_widget_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "support_widget_configs_brandId_key" ON "support_widget_configs"("brandId");

-- AddForeignKey
ALTER TABLE "support_widget_configs" ADD CONSTRAINT "support_widget_configs_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Recreate HNSW index (dropped above due to Prisma Unsupported drift; must be kept in sync manually)
CREATE INDEX kb_chunks_embedding_hnsw_idx
  ON "kb_chunks"
  USING hnsw ("embedding" vector_cosine_ops);
