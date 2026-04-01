import { z } from 'zod'

export const CreateRewardSchema = z.object({
  name: z.string().min(1, 'Reward name is required').max(100),
  description: z.string().max(500).optional(),
  type: z.enum(['DISCOUNT', 'FREE_ITEM', 'EXPERIENCE', 'VOUCHER']),
  pointsCost: z.number().int().positive('Points cost must be positive'),
  stock: z.number().int().positive().optional(),
  availableFrom: z.string().datetime().optional(),
  availableTo: z.string().datetime().optional(),
  eligibleTierIds: z.array(z.string()).optional().default([]),
})

export const RetireRewardSchema = z.object({
  expireAt: z.string().datetime().optional(),
})

export type CreateRewardInput = z.infer<typeof CreateRewardSchema>
export type RetireRewardInput = z.infer<typeof RetireRewardSchema>
