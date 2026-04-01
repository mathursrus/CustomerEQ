import { z } from 'zod'

export const RedeemSchema = z.object({
  rewardId: z.string().min(1, 'rewardId is required'),
  memberId: z.string().min(1, 'memberId is required'),
})

export type RedeemInput = z.infer<typeof RedeemSchema>
