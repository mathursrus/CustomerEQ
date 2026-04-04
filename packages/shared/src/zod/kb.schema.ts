import { z } from 'zod'

export const KB_CATEGORIES = [
  'FAQ', 'POLICY', 'TROUBLESHOOTING', 'PRODUCT_GUIDE', 'PROCESS', 'OTHER',
] as const

export const KB_STATUSES = ['DRAFT', 'PUBLISHED'] as const

export const CreateKBArticleSchema = z.object({
  title: z.string().min(1).max(500),
  body: z.string().min(1).max(100_000), // ~50 pages of Markdown
  category: z.enum(KB_CATEGORIES).default('FAQ'),
  tags: z.array(z.string().min(1).max(50)).max(20).default([]),
  status: z.enum(KB_STATUSES).default('DRAFT'),
})

export const UpdateKBArticleSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  body: z.string().min(1).max(100_000).optional(),
  category: z.enum(KB_CATEGORIES).optional(),
  tags: z.array(z.string().min(1).max(50)).max(20).optional(),
  status: z.enum(KB_STATUSES).optional(),
})

export const KBSearchQuerySchema = z.object({
  q: z.string().min(1).max(2000), // ~8000 tokens max for embedding
  limit: z.coerce.number().int().min(1).max(20).default(5),
})

export const ClassifyIntentSchema = z.object({
  text: z.string().min(1).max(10_000),
})

export type CreateKBArticle = z.infer<typeof CreateKBArticleSchema>
export type UpdateKBArticle = z.infer<typeof UpdateKBArticleSchema>
export type KBSearchQuery = z.infer<typeof KBSearchQuerySchema>
export type ClassifyIntentInput = z.infer<typeof ClassifyIntentSchema>
