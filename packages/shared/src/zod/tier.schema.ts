import { z } from 'zod'

export const CreateTierSchema = z.object({
  name: z.string().min(1, 'Tier name is required').max(50),
  rank: z.number().int().min(1, 'Rank must be at least 1'),
  icon: z.string().optional(),
  minPoints: z.number().int().min(0).optional(),
  minSpendCents: z.number().int().min(0).optional(),
  benefits: z.array(z.string()).optional().default([]),
  multiplier: z.number().positive().optional().default(1.0),
})

export const UpdateTierSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  rank: z.number().int().min(1).optional(),
  icon: z.string().optional(),
  minPoints: z.number().int().min(0).optional(),
  minSpendCents: z.number().int().min(0).optional(),
  benefits: z.array(z.string()).optional(),
  multiplier: z.number().positive().optional(),
})

export type CreateTierInput = z.infer<typeof CreateTierSchema>
export type UpdateTierInput = z.infer<typeof UpdateTierSchema>
