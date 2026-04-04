import type { Job } from 'bullmq'
import pino from 'pino'
import { prisma } from '@customerEQ/database'
import type { EmbeddingGenerationPayload } from '@customerEQ/shared'
import { generateEmbedding } from '@customerEQ/ai'

const logger = pino({ name: 'embedding-generation' })

/**
 * BullMQ processor for embedding generation.
 * Generates an OpenAI embedding for a KB article and stores it via raw SQL
 * (Prisma cannot write Unsupported pgvector types).
 */
export async function processEmbeddingGeneration(
  job: Job<EmbeddingGenerationPayload>,
): Promise<{ articleId: string; dimensions: number }> {
  const { articleId, brandId, text } = job.data

  logger.info({ brandId, articleId, attempt: job.attemptsMade + 1 }, 'Generating embedding')

  const embedding = await generateEmbedding(text)

  // Store the embedding via raw SQL (Prisma Unsupported type workaround)
  const vectorStr = `[${embedding.join(',')}]`
  await prisma.$executeRawUnsafe(
    `UPDATE kb_articles SET embedding = $1::vector WHERE id = $2`,
    vectorStr,
    articleId,
  )

  logger.info(
    { brandId, articleId, embeddingDimensions: embedding.length },
    'Embedding generated and stored',
  )

  return { articleId, dimensions: embedding.length }
}
