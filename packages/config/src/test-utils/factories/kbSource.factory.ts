import { getTestPrisma } from '../db/setup.js'

let counter = 0

export async function createKBSource(opts: {
  brandId: string
  kind?: 'MANUAL' | 'URL' | 'SITEMAP'
  url?: string | null
  title?: string
  status?: 'ACTIVE' | 'DISABLED'
}) {
  const prisma = getTestPrisma()
  counter++
  return prisma.kBSource.create({
    data: {
      brandId: opts.brandId,
      kind: opts.kind ?? 'MANUAL',
      url: opts.url ?? null,
      title: opts.title ?? `source_${counter}`,
      status: opts.status ?? 'ACTIVE',
    },
  })
}
