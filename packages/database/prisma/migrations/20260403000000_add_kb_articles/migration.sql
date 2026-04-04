-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "KBArticleCategory" AS ENUM ('FAQ', 'POLICY', 'TROUBLESHOOTING', 'PRODUCT_GUIDE', 'PROCESS', 'OTHER');

-- CreateEnum
CREATE TYPE "KBArticleStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "kb_articles" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" "KBArticleCategory" NOT NULL DEFAULT 'FAQ',
    "tags" TEXT[],
    "status" "KBArticleStatus" NOT NULL DEFAULT 'DRAFT',
    "embedding" vector(1536),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kb_articles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kb_articles_brandId_status_idx" ON "kb_articles"("brandId", "status");

-- CreateIndex
CREATE INDEX "kb_articles_brandId_category_idx" ON "kb_articles"("brandId", "category");
