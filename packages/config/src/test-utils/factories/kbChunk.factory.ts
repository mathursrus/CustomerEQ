import { getTestPrisma } from '../db/setup.js'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Prisma } from '@prisma/client'

let counter = 0

/**
 * Deterministic 1536-dim "embedding" — seeded by a string so equal inputs
 * produce equal vectors. Not cryptographic; just stable across test runs.
 */
export function deterministicEmbedding(seed: string): number[] {
  const vec = new Array<number>(1536)
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  for (let i = 0; i < 1536; i++) {
    h ^= i
    h = Math.imul(h, 16777619)
    vec[i] = ((h & 0xffff) / 65535 - 0.5) * 2
  }
  // L2-normalize so cosine similarity behaves
  let norm = 0
  for (const x of vec) norm += x * x
  norm = Math.sqrt(norm) || 1
  for (let i = 0; i < vec.length; i++) vec[i] /= norm
  return vec
}

export async function createKBChunk(opts: {
  articleId: string
  brandId: string
  chunkIndex?: number
  content?: string
  embedSeed?: string
  embedStatus?: 'PENDING' | 'EMBEDDED' | 'FAILED'
}) {
  const prisma = getTestPrisma()
  counter++
  const content = opts.content ?? `chunk content ${counter}`
  const embedding = deterministicEmbedding(opts.embedSeed ?? content)
  const tokenCount = Math.ceil(content.length / 4)
  const id = `chunk_${counter}_${Date.now()}`
  const vectorLiteral = `[${embedding.join(',')}]`
  const embedStatus = opts.embedStatus ?? 'EMBEDDED'

  await prisma.$executeRaw`
    INSERT INTO "kb_chunks" ("id", "articleId", "brandId", "chunkIndex", "content", "tokenCount", "embedding", "embedStatus", "createdAt", "updatedAt")
    VALUES (${id}, ${opts.articleId}, ${opts.brandId}, ${opts.chunkIndex ?? counter}, ${content}, ${tokenCount}, ${vectorLiteral}::vector, ${embedStatus}::"ChunkEmbedStatus", NOW(), NOW())
  `
  return prisma.kBChunk.findUniqueOrThrow({ where: { id } })
}
