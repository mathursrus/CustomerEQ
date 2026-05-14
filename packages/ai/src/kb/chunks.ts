import { prisma } from '@customerEQ/database'
import { chunkArticleBody, type ArticleChunk } from '@customerEQ/shared'
import { generateEmbedding } from '../analysis/embeddings.js'

const CHUNK_TARGET_TOKENS = 500
const CHUNK_OVERLAP_TOKENS = 100

/**
 * Replace all KBChunks for an article. Idempotent: deletes existing chunks
 * for the article and re-creates them from the current body. Called on
 * article create, update, or crawl-driven re-ingest. Returns the number
 * of chunks written.
 *
 * pgvector requires raw SQL for the embedding column (Prisma `Unsupported` type).
 */
export async function rebuildArticleChunks(
  articleId: string,
  brandId: string,
  body: string,
): Promise<number> {
  if (!body.trim()) {
    await prisma.kBChunk.deleteMany({ where: { articleId } })
    return 0
  }

  const chunks: ArticleChunk[] = chunkArticleBody(body, {
    targetTokens: CHUNK_TARGET_TOKENS,
    overlapTokens: CHUNK_OVERLAP_TOKENS,
  })

  await prisma.$transaction(
    async (tx) => {
      await tx.kBChunk.deleteMany({ where: { articleId } })
      for (const c of chunks) {
        const embedding = await generateEmbedding(c.content)
        const vec = `[${embedding.join(',')}]`
        await tx.$executeRaw`
          INSERT INTO "kb_chunks" ("id", "articleId", "brandId", "chunkIndex", "content", "tokenCount", "embedding", "embedStatus", "createdAt", "updatedAt")
          VALUES (${`chunk_${articleId}_${c.chunkIndex}`}, ${articleId}, ${brandId}, ${c.chunkIndex}, ${c.content}, ${c.tokenCount}, ${vec}::public.vector, 'EMBEDDED'::"ChunkEmbedStatus", NOW(), NOW())
        `
      }
    },
    { timeout: 60_000 },
  )

  return chunks.length
}
