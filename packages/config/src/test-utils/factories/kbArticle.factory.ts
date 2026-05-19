import { getTestPrisma } from '../db/setup.js'

let counter = 0

export async function createKBArticle(opts: {
  brandId: string
  title?: string
  body?: string
  status?: 'DRAFT' | 'PUBLISHED'
  publishedAt?: Date | null
  sourceId?: string | null
  sourceUrl?: string | null
  contentHash?: string | null
}) {
  const prisma = getTestPrisma()
  counter++
  return prisma.kBArticle.create({
    data: {
      brandId: opts.brandId,
      title: opts.title ?? `article_${counter}`,
      body: opts.body ?? `body ${counter}`,
      status: opts.status ?? 'PUBLISHED',
      publishedAt: opts.publishedAt === undefined ? new Date() : opts.publishedAt,
      sourceId: opts.sourceId ?? null,
      sourceUrl: opts.sourceUrl ?? null,
      contentHash: opts.contentHash ?? null,
    },
  })
}
