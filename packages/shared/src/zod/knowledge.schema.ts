import { z } from 'zod'

export const KBSourceKindSchema = z.enum(['MANUAL', 'URL', 'SITEMAP'])
export type KBSourceKind = z.infer<typeof KBSourceKindSchema>

export const KBSourceStatusSchema = z.enum(['ACTIVE', 'DISABLED'])
export type KBSourceStatus = z.infer<typeof KBSourceStatusSchema>

export const ChunkEmbedStatusSchema = z.enum(['PENDING', 'EMBEDDED', 'FAILED'])
export type ChunkEmbedStatus = z.infer<typeof ChunkEmbedStatusSchema>

export const KBChunkRetrievedSchema = z.object({
  id: z.string(),
  articleId: z.string(),
  chunkIndex: z.number().int().nonnegative(),
  content: z.string(),
  similarity: z.number().min(0).max(1),
})
export type KBChunkRetrieved = z.infer<typeof KBChunkRetrievedSchema>

export const CreateKBSourceSchema = z.object({
  kind: KBSourceKindSchema,
  url: z.string().url().nullish(),
  title: z.string().min(1).max(200),
  status: KBSourceStatusSchema.optional(),
  crawlCron: z.string().nullish(),
}).refine(
  (v) => v.kind === 'MANUAL' || !!v.url,
  { message: 'url is required for URL and SITEMAP sources', path: ['url'] },
)
export type CreateKBSourceInput = z.infer<typeof CreateKBSourceSchema>

export const UpdateKBSourceSchema = z.object({
  url: z.string().url().nullish().optional(),
  title: z.string().min(1).max(200).optional(),
  status: KBSourceStatusSchema.optional(),
  crawlCron: z.string().nullish().optional(),
})
export type UpdateKBSourceInput = z.infer<typeof UpdateKBSourceSchema>

export const KBIngestionPayloadSchema = z.object({
  sourceId: z.string(),
  brandId: z.string(),
  triggeredBy: z.enum(['MANUAL', 'CRON']),
})
export type KBIngestionPayload = z.infer<typeof KBIngestionPayloadSchema>
