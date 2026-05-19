import { getTestPrisma } from '../db/setup.js'

export async function createCSATResponse(opts: {
  conversationId: string
  brandId: string
  rating?: 'THUMBS_UP' | 'THUMBS_DOWN'
  comment?: string | null
}) {
  const prisma = getTestPrisma()
  return prisma.cSATResponse.create({
    data: {
      conversationId: opts.conversationId,
      brandId: opts.brandId,
      rating: opts.rating ?? 'THUMBS_UP',
      comment: opts.comment ?? null,
    },
  })
}
