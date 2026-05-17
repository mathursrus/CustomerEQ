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
