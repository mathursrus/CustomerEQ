import { z } from 'zod'

export const CSATRatingSchema = z.enum(['THUMBS_UP', 'THUMBS_DOWN'])
export type CSATRating = z.infer<typeof CSATRatingSchema>

export const SubmitCSATSchema = z.object({
  rating: CSATRatingSchema,
  comment: z.string().max(2000).optional(),
  anonId: z.string().optional(),
})
export type SubmitCSATInput = z.infer<typeof SubmitCSATSchema>
