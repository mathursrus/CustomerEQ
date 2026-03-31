import { z } from 'zod'

export const TriggerConditionSchema = z.object({
  field: z.string().min(1),
  op: z.enum(['eq', 'ne', 'lt', 'lte', 'gt', 'gte', 'in', 'contains']),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.unknown())]),
})

export const ActionConfigSchema = z.object({
  points: z.number().int().positive().optional(),
  rewardId: z.string().optional(),
  message: z.string().max(500).optional(),
}).refine(
  (data) => data.points !== undefined || data.rewardId !== undefined || data.message !== undefined,
  { message: 'actionConfig must include points, rewardId, or message' }
)

export const CreateCampaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required').max(100),
  programId: z.string().min(1),
  triggerType: z.string().min(1, 'triggerType is required'),
  triggerCondition: TriggerConditionSchema.optional(),
  actionType: z.enum(['award_points', 'award_reward', 'send_message']),
  actionConfig: ActionConfigSchema,
  budgetCap: z.number().positive().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
})

export const UpdateCampaignStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'PAUSED', 'COMPLETED']),
})

export type CreateCampaignInput = z.infer<typeof CreateCampaignSchema>
export type UpdateCampaignStatusInput = z.infer<typeof UpdateCampaignStatusSchema>
export type TriggerCondition = z.infer<typeof TriggerConditionSchema>
export type ActionConfig = z.infer<typeof ActionConfigSchema>
